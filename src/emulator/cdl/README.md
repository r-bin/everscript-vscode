# emulator/cdl/ — Code/Data Logger, xrefs, Asar export

Host side of the CDL recorder compiled into the debugger core
(`core/snes9x2005-wasm/source/cdl.c`, gated by `#if EVS_CDL`, constant on).
Design: `docs/tracing-disassembler-and-asar-generation.md` section 9.
Usage (record → export → `build.sh` → `recomp.sh`): `docs/workflows/cdl-export-build-recomp.md`.

| File | Role |
|---|---|
| `opcodes.js` | 65816 opcode matrix — single source for the disassembler and the core's `cdl-optable.h` (`node tools/gen-cdl-optable.js`) |
| `library.js` | Per-ROM library `<globalStorage>/cdl-library/<sha1>/`; mergeable files, atomic flush |
| `library-ext.js` | Library streams for recomp / decomp: `rets.bin` (call stack outcomes, exit widths), `regs.bin` (DB / D / Y), `bases.bin` (pointer bases), `wram-code.*`, `aram.cdl`; decoded views `retsList` / `regsByPc` / `basesByPc` |
| `rom-map.js` | ROM offset ⇄ bus address (canonical HiROM `$C0+`, LoROM `$80+:8000`) |
| `xref-index.js` | Functions, callers, enclosing function, accessors per address, labels |
| `disasm.js` | Decode one instruction with recorded M/X; format Asar text that reassembles byte-exact |
| `asar-export.js` | `main.asm` + `banks/*.asm` + `rom.bin` (incbin for unreached / DMA runs) |
| `known-regions.js` | Seeds the export before any CDL data: header + vectors; for SoE the 127 room blobs (`rooms/*.bin`), the map table as `dl room_XX-$400000`, 3002 strings `str_<index>` and the key table as `dl strkey(str_XXXX)`, the room enter script table `room_enter_scripts`, the two string key readers (`string_keys_ref_N`, immediates as expressions) |
| `recomp-analysis.js` | Recorded flow → snesrecomp directives: exit widths, `indirect_dispatch` (indexed / ptrtail / ptrcall / rtsstack), `ram_routine`, comments for patterns without a directive |
| `recomp-seeds.js` | `recomp/cfg/bankXX.cfg` seeds for [snesrecomp](https://github.com/RetroPortingToolKit/snesrecomp) (func entries + entry M/X per runtime bank, data regions, indirect sites as comments) and `recomp.sh` |
| `asar-build.js` | `rom.cdl`, `export.json` (labels + original offsets), `build.sh` + standalone `build-cdl.js` (ROM + CDL, flags follow labels), appends `STEPS.md` once per export |
| `tables.js` | ROM lookup tables (HP per level, curves, dispatch tables) from indexed ROM reads: base, entry size, fields, index source, result → `tables.md` + header comments |
| `table-assets.js` | Safe tables → `tables/tbl_*.asm` (incsrc'd known regions), `tables.json`, `tables.h` |
| `structs.js` | WRAM struct inference (indexed / pointer / D-relative accesses) → `structs.asm`, `structs.h`, `structs.json` |
| `enums.js` | Enums, states (value → handler) and bit flags → `enums.asm`, `enums.json` |
| `functions.js` | `functions.json`: per-function widths, DB/D, WRAM / I/O footprint, SA-1 blockers |
| `wram-export.js` | `ram.asm`: every WRAM address, accessors, values seen, enum / bit-flag guesses |
| `lookup.js` | "who calls / who touches" answers for the CDL tab |
| `host.js` | Panel glue (the only file that needs `vscode`): seed, snapshot, merge deltas, flush policy, export, lookup, script naming |

The webview half is `../cdl-view.js` (tab, tick / drain), `../cdl-strips.js` (ROM + WRAM strips) and `../cdl-float.js` (floating coverage gains over the active character).

## Invariants

- Recording is **off by default** (`everscript.cdl.enabled`, or the tab's toggle per session).
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

`../snes-rom-header-model.js`, `../../maps` (room blob layout, `known-regions.js` only), Node built-ins; `host.js` additionally `vscode` and `../address-lookup.js` (script names).
