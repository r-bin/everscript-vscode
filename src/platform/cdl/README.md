# platform/cdl/ — Code/Data Logger, xrefs, Asar export

The game-neutral engine behind the CDL recorder compiled into the debugger core
(`core/snes9x2005-wasm/source/cdl.c`, gated by `#if EVS_CDL`, constant on).
Design: `docs/reverse-engineering/cdl-design-history.md` section 9.
Usage (record → export → `build.sh` → `recomp.sh`): `docs/reverse-engineering/cdl-export-build-recomp.md`.

| File | Role |
|---|---|
| `library.ts` | Per-ROM library `<globalStorage>/cdl-library/<sha1>/`; mergeable files, atomic flush |
| `library-ext.ts` | Library streams for recomp / decomp / layout ports: `bus.cdl`, `bus-sites.bin`, `rom-cycles.bin` (cycles are summed deltas), `rets.bin` (call stack outcomes, exit widths), `regs.bin` (DB / D / Y), `bases.bin` (pointer bases), `wram-code.*`, `aram.cdl`; decoded views `retsList` / `regsByPc` / `basesByPc` |
| `rom-map.ts` | ROM offset ⇄ bus address (canonical HiROM `$C0+`, LoROM `$80+:8000`) |
| `xref-index.ts` | Functions, callers, enclosing function, accessors per address, labels |
| `disasm.ts` | Decode one instruction with recorded M/X; format Asar text that reassembles byte-exact |
| `asar-export.js` | `main.asm` + `banks/*.asm` + `rom.bin` (incbin for unreached / DMA runs). Options: `names` (curated labels + descriptions), `wramNames`, `assets` (from `tools/recomp/`, which may read `src/games/evermore/localizations` and `src/games/evermore/rom`; this domain may not) |
| `known-regions.ts` | Seeds the export before any CDL data: header + vectors, plus the game's regions handed in as `gameRegions`. Evermore's (`src/games/evermore/cdl/regions.ts`): the 127 room blobs (`rooms/*.bin`), the map table as `dl room_XX-$400000`, 3002 strings `str_<index>` and the key table as `dl strkey(str_XXXX)`, the room enter script table `room_enter_scripts`, the two string key readers (`string_keys_ref_N`, immediates as expressions) |
| `recomp-analysis.ts` | Recorded flow → snesrecomp directives: exit widths, `indirect_dispatch` (indexed / ptrtail / ptrcall / rtsstack), `ram_routine`, comments for patterns without a directive |
| `recomp-seeds.ts` | `recomp/cfg/bankXX.cfg` seeds for [snesrecomp](https://github.com/RetroPortingToolKit/snesrecomp) (func entries + entry M/X per runtime bank, data regions, indirect sites as comments) and `recomp.sh` |
| `mesen-export.ts` | Mesen2 files: `mesen/labels.mlb` (labels + comments for ROM and WRAM, `memtype:addr[-end]:label[:comment]`) and `mesen/rom.cdl` (`CDLv2` + CRC32 + flags, asset ranges as data) |
| `asar-build.ts` | `rom.cdl`, `export.json` (labels + original offsets), `build.sh` + standalone `build-cdl.js` (ROM + CDL, flags follow labels; both copied from `asar-kit/`, plain files run by the user's shell and node, so JS by design), appends `STEPS.md` once per export |
| `tables.js` | ROM lookup tables (HP per level, curves, dispatch tables) from indexed ROM reads: base, entry size, fields, index source, result → `tables.md` + header comments |
| `table-assets.js` | Safe tables → `tables/tbl_*.asm` (incsrc'd known regions), `tables.json`, `tables.h` |
| `structs.ts` | WRAM struct inference (indexed / pointer / D-relative accesses) → `structs.asm`, `structs.h`, `structs.json` |
| `enums.js` | Enums, states (value → handler) and bit flags → `enums.asm`, `enums.json` |
| `bus-report.ts` | `bus.json` / `bus.md`: ExHiROM and SA-1 audits from the bus-form stream (`bus.cdl`, `bus-sites.bin`), bytes per bank and form, top functions by cycles (`rom-cycles.bin`) |
| `library-values.ts` | Value streams: `io-values.bin` (values written per I/O register), `sram-flags.bin`, `word-ranges.bin` (16-bit WRAM stores: min / max / value list, natural and cheated sets); merge laws are tested in `tests/debugger/cdl-values.test.js` |
| `functions.ts` | `functions.json`: per-function widths, DB/D, WRAM / I/O footprint, SA-1 blockers |
| `wram-export.ts` | `ram.asm`: every WRAM address, accessors, values seen, enum / bit-flag guesses |
| `lookup.js` | "who calls / who touches" answers for the CDL tab |
| `host.js` | Panel glue (the only file that needs `vscode`): seed, snapshot, merge deltas, flush policy; export and lookup when given `tools.js`; remembers whether recording was on |
| `tools.js` | Exports, lookup and script naming for the CDL tab, handed to the panel by Everscript (`configureEmulator({ cdlTools })`); not in the SNES CDL Recorder |
| `bundle.ts` | Recording bundles: zip one library + its replays (`buildBundle`), merge one in (`importBundle`); summed streams add only the growth since that install's last bundle |

The webview half is `../cdl-view.js` (tab, tick / drain), `../cdl-strips.js` (ROM + WRAM strips) and `../cdl-float.js` (floating coverage gains over the active character).

## Invariants

- Recording is **off by default** in Everscript (`everscript.cdl.enabled`, or the tab's toggle) and **on** in
  the SNES CDL Recorder; the last switch of the toggle is remembered (`globalState` `everscript.emulator.cdlWanted`).
- A library's manifest records the ROM's `sha256` (since v0.219.0): replays (`# rom.sha256`) find their
  library by it when a bundle is exported.
- A bundle never holds ROM bytes. Importing the same bundle twice is refused; a newer bundle from the
  same recorder install replaces that install's hit / cycle counts instead of adding them again
  (`<library>/imports/<installId>/`).
- The SSD is never touched per instruction: the core records into WASM memory, the
  webview drains only changed chunks / new table entries every 15 s, and the host writes
  only files that changed: 60 s after the last change, at most every 5 min while changes
  keep coming, at once on pause / stop / ROM change / close (tmp-file + rename).
- Paused (Esc, pause button, breakpoint) or off, nothing runs: no tick, no drain, no write.
- Every stored field merges with OR / min / max / union — re-importing or merging sessions
  in any order gives the same library. Exception: hit counts (`rom-hits.bin`, `wram-hits.bin`,
  core `cdl-count.c`) are summed. The core drains them as deltas, so each count arrives once;
  merging the same library twice would double them.
- Export must reassemble byte-identical: `asar --fix-checksum=off main.asm out.sfc`
  (`./build.sh` in the export folder does this and writes `build/out.cdl`).
- Table assets are known regions too: a table becomes one only when no byte inside ran as code,
  it overlaps nothing, stays in one bank and its recorded indices are dense; editing a value in
  `tables/*.asm` changes only that value.
- Known regions win over the CDL for their bytes; each is a plain ROM slice, so a wrong
  boundary only misplaces a label, never breaks the rebuild. A pointer table entry is a
  label expression (`room_06-$400000`), so moving the target moves the pointer.
- `STEPS.md` is written on export only, never by recording.
- A 24-bit operand is labelled even through a mirror or inside a known region
  (`lda.l map_table+$0001-$400000,x`), so code follows a moved table.
  Branches always use a label (`seg_XXXXXX+$n` when no better one) because Asar reads a
  bare number in a branch as the displacement.
- Xrefs are capped at 128 distinct addresses per (instruction, space); beyond that the
  instruction is reported as a bulk range (clears, copies, table walks). Scripts touching
  more than 64 WRAM addresses (room loads) are reported as bulk in `ram.asm` / lookup.
- Script attribution: the host finds the interpreter's opcode fetch by byte pattern
  (`lda [$82] / inc $82 / and #$FF / asl / tax / jsr ($xxxx,x)`, SoE: ROM `$0CD0A6`);
  `everscript.cdl.scriptExcludes` keeps scratch / slot memory out.
- New library files are optional: older libraries load unchanged and gain them on the
  next flush (`wram.flags` is derived from the WRAM xrefs until then).

## Allowed dependencies

`../snes/` (header model, opcode matrix), `../zip.js`, Node built-ins — nothing outside `platform/` (`.depcruise.js` `platform-stands-alone`). The VS Code side is `src/core/emulator/cdl/host.ts`; the Evermore seeds and the CDL tab's tools (with script names from `address-lookup.ts`) are `src/games/evermore/cdl/`.
