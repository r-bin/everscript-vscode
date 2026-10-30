---
name: cdl-recorder
description: Use when touching the Code/Data Logger: the recorder in the snes9x core, the per-ROM library, xrefs, the Asar/Mesen/recomp exports, the CDL tab, or analysis built on recorded data.
applyTo: "src/platform/cdl/**,src/core/emulator/cdl/**,src/games/evermore/cdl/**,src/core/emulator/cdl-*.js,src/core/emulator/core/snes9x2005-wasm/source/cdl*,src/core/emulator/core/snes9x2005-wasm/source/spc700.h,src/core/emulator/core/snes9x2005-wasm/source/apumem.h,tools/gen-cdl-optable.js,tests/debugger/cdl*.test.js,docs/reverse-engineering/cdl-export-build-recomp.md,docs/reverse-engineering/asm-to-c-port.md"
---

# Skill: CDL recorder, library and exports

Read first: `src/platform/cdl/README.md` (file map, invariants, allowed deps).
Usage: `docs/reverse-engineering/cdl-export-build-recomp.md`. Goal and status: `docs/reverse-engineering/asm-to-c-port.md` §10–11.
Design history: `docs/reverse-engineering/cdl-design-history.md` §9 (§1–8 are the original
proposal and differ from what was built).

**Goal of everything here:** collect what a static recompilation (snesrecomp), a later
decompilation (readable C) and an even later SA-1 port need, which static analysis alone
cannot know: real entry/exit widths, jump-table targets, data bank / direct page, which
bytes are tables, how WRAM is laid out, and what each function touches.

## 1. Pipeline

```text
core (WASM, per instruction / access)        webview (every 5 s)         host (Node)
  cdl.c        rom.cdl/ext, edges, xrefs, ─► cdl-view.ts drains only ──► library.ts + library-ext.ts merge
               pcstats, wvals, DMA/HDMA/$2180    changed chunks /           (memory) write at most once a minute
  cdl-wram.c   wflags, script-xrefs, WRAM code   new table entries          (pause too), at once on stop/close/quit
  cdl-count.c  hit counters (deltas)                                        ▼
  cdl-flow.c   shadow call stack -> rets       asar-export ─► banks/, tables/ (assets), ram/enums/structs.asm,
  cdl-regs.c   DB / D, pointer bases + Y                      functions.json, recomp/cfg (snesrecomp), spc/aram.cdl
  cdl-spc.c    SPC700 ARAM coverage
```

## 2. Hard rules

- **Off by default** and **paused = idle** (no tick, no drain, no write).
- **Never touch the disk per instruction.** Record into WASM memory; drain only dirty data.
- **Never lose a session silently.** A flush that fails puts `CDL NOT SAVED` over the screen (`emuAlert`) and
  retries; the page drains (to host memory) on blur / pagehide / Ctrl+W; deactivate flushes. Disk writes stay at
  one a minute (owner: spare the SSD; never write per drain or per pause); a page cut off from its host
  pauses itself (`session-watch.ts`, `page/05-host-watch.js`). A webview outlives its extension host and a
  restarted host never takes it back: v0.353.5 kept 1 h of a 5 h Windows session. A flush of a big library
  (2.2 M script xrefs, ~650 MB heap) blocks the host ~0.4 s on a Mac: keep flushes off the hot path.
- **A drained delta is kept until it is on disk.** The page cannot write files; it numbers each delta
  (session, seq), keeps it until the host's `cdlSaved` (sent only after the write that holds it), parks
  the kept ones in its IndexedDB when the host goes quiet (VS Code keeps one webview origin per extension
  view type: checked in its workbench code) and the next page hands them over (`cdlRescue`,
  `cdl/rescue.ts`, `page/06-cdl-rescue.js`). Deltas run ~2 MB per 5 s (changed 64 KB chunks resent
  whole), so a disk journal of them would write more than the minute's flush (~12 MB): park only on failure.
- **Every field merges commutatively and idempotently** (OR, min, max, set union), so libraries
  from different sessions or players merge to the same result in any order. A new field needs
  a merge rule before it ships. Exception: the hit and cycle counters (`romHits`, `wramHits`, `romCycles`)
  are summed, so a delta must be merged exactly once: `manifest.json` `delivered` holds each page
  session's last merged delta, written with it, and a rescued delta at or below it is skipped.
- **Hit counts are the one exception: they are summed** (user decision, v0.173.0: having counts
  matters more than idempotence). Correct only because the core drains them as **deltas**
  (`cdl-count.c` zeroes what it hands out). Never seed counts back, never merge library files into each other
  directly: go through a **recording bundle** (`cdl/bundle.ts`). There the summed streams (`rom-hits.bin`,
  `wram-hits.bin`, `rom-cycles.bin`) are one counter per install, max-merged per key; the import takes the
  importer's own install id (`importBundle(..., selfId)`), so own exports, restores and forwarded bundles are
  counted once. A new summed stream must join `SUMMED` there.
- **`wram-code.bin` keeps the first bytes seen**; a later session with different bytes only sets
  `CHANGED` in `wram-code.state`. Never emit a `ram_routine` for a CHANGED byte range.
- **New library files are optional.** Old libraries must load unchanged; bump nothing, add a file.
- **Export must rebuild byte-identically** (`asar --fix-checksum=off`). Known regions win over
  the CDL for their bytes. Branches always use a label. Table assets are known regions that
  `incsrc` their file, so an asset that is wrong only misnames bytes, never changes them.
- **`opcodes.js` is the single source for the opcode tables** (`CDL_OpInfo`, `CDL_OpFlow`,
  `CDL_OpPtr`). After editing it run `node tools/gen-cdl-optable.js`, then rebuild the core.
- **Every C hook sits behind `#if EVS_CDL`** (`-DEVS_CDL=0` strips them; `CDL_SPC_*` macros
  compile to nothing). CPU hooks check `cdl.active` (true only inside `S9xMainLoop`, so debugger
  reads are never recorded). SPC hooks check `cdl.enabled`: the APU catches up outside it.
- **The active APU is `spc700.c` + `apumem.h`**, not `apu_blargg.c` (`USE_BLARGG_APU` is not
  defined). Hooks in `apu_blargg.c` would be dead code.
- `rom.cdl` keeps the **Mesen-S / BizHawk bit layout** (CODE 01, DATA 02, JUMP 04, SUB 08,
  IDX8 10, ACC8 20). Everything else goes in `rom.ext` or a new file. `rom.ext` and `wram.flags`
  have no free bits left (0x80 = HDMA / DMA since v0.174.0).
- **snesrecomp directives must match its parser** (`recompiler/v2/cfg_loader.py`): `rtsstack` is
  only valid on a `PEI` site; `exit_mx` widths use 1 = 8-bit; `indirect_dispatch` counts are
  entries, not bytes. When there is no directive for a pattern, write a `#` comment instead.
- **`idx:X` counts are statically extended** (`staticTableCount`): the CDL only sees taken entries,
  and an under-counted table broke SoE's title sprites (`$8F:9F46`, 16 entries, 8 observed).
  Pointer forms (`ptrcall`, `ptrtail`, `rtsstack`) with observed-only targets make snesrecomp
  **skip** unknown handlers: treat them as risky. Recomp debugging: `SecrefOfEvermoreRecomp docs/debugging.md` and `SecrefOfEvermoreRecomp docs/bugs-and-todos.md`.

## 3. What is recorded

| Recorded | Where | Notes |
|---|---|---|
| code/data per ROM byte, opcode head, M/X seen (both widths → conflict) | `rom.cdl`, `rom.ext` | |
| edges: call, jump, taken branch, indirect, interrupt, **FLOW_RETURN** (0x20) | `edges.bin` | FLOW_RETURN = return to an address the code pushed or adjusted |
| (PC, effective address, R/W, width, pointer, DMA) | `xrefs.bin` | capped at 128 addresses per (PC, space), then a bulk range in `pcstats` |
| HDMA table starts | `xrefs.bin` from PC 0 | labelled `hdma_*`; table bytes get `EXT_HDMA` |
| values written per WRAM byte | `wram-values.bin` | includes `$2180` writes and DMA into WRAM |
| WRAM R/W/width/exec/script/pointer/DMA per byte | `wram.flags` | `WF_POINTER` also for pointer fetches of `(dp),Y` etc. |
| script instruction → WRAM it touched | `script-xrefs.bin` | SoE interpreter fetch found by byte pattern |
| hit counts | `rom-hits.bin`, `wram-hits.bin` | summed deltas |
| return outcomes per (entry, return instr, entry M/X, exit M/X) | `rets.bin` | NORMAL / MODIFIED (adjusted return address) / DROPPED (call site never returned to) / INTERRUPT |
| DB and D per instruction, Y at pointer sites | `regs.bin` | change-filtered per ROM byte; ≤32 values per (PC, kind) |
| pointer behind `(dp)`, `(dp,X)`, `(dp),Y`, `[dp]`, `[dp],Y`, `(sr,S),Y` | `bases.bin` | read before the instruction runs; ≤32 per PC |
| code executed from WRAM: bytes + seen/changed | `wram-code.bin`, `wram-code.state` | |
| SPC700: exec / operand / read / write per ARAM byte | `aram.cdl` | operands = bytes between two sequential opcode fetches |
| **bus form** per ROM byte: low nibble = forms it was executed through, high nibble = read through (1 `$C0-$FF`, 2 `$80-$BF`, 4 `$00-$3F`, 8 `$40-$7D`) | `bus.cdl` (`cdl-bus.c`) | `rom.cdl`/xrefs keep only the ROM offset, so the mirror used is lost without this. OR-merged |
| instruction → lowest/highest bus address it read per form (data reads, DMA sources) | `bus-sites.bin` | CPU vector fetches (`$00:FFE0-FFFF` when an interrupt is taken) are recorded under pc 0, not under the interrupted instruction |
| values the CPU wrote to I/O registers (`$2100-$21FF` incl. SPC ports `$2140-$2143`, `$4200-$437F` incl. DMA channels): 256-bit bitmap per register | `io-values.bin` (`cdl-values.c`, `library-values.ts`) | not DMA-driven writes; the SPC upload makes `$2140` show all 256 values |
| SRAM bytes read / written (byte or word) | `sram-flags.bin` | what an SA-1 port must map to BW-RAM; the boot reads ~3300 bytes |
| 16-bit WRAM stores: min, max, and the sorted value list while there are at most 16 distinct values (else "more"), in two sets: 0 natural, 1 within 600 frames after a movie memory write (cheat, menu toggle) | `word-ranges.bin` (10.5 MB, fixed) | merge is commutative/associative/idempotent; headless replay picks the set (`cdlSetValueSet`), the live recorder always records set 0; byte values stay in `wram-values.bin` |
| master cycles per opcode head (gap to the next instruction, incl. DMA/interrupt stalls) | `rom-cycles.bin` (`cdl-count.c`) | summed deltas like hit counts; the scanline wrap is corrected with `H_Max`; idle loops (wait for NMI) dominate, leave them out of any analysis |

**Shadow call stack** (`cdl-flow.c`): calls and interrupts push (entry, expected return, call
site, S after the push). A return is matched **by S**: top frame → normal (or MODIFIED if the
target differs); deeper frame → the frames above are DROPPED; below every frame → a return
through a pushed address (FLOW_RETURN edge, target marked JUMP_TARGET). TCS/TXS do not reset it;
an RTS with S above every frame does (stack switch).

**Still not recorded:** per-value counts, read values,
SPC700 DSP / BRR sample origins, SA-1 / coprocessor buses (snes9x2005's SA-1 core is separate and
unhooked). Cycles are per instruction and not split by caller; `functions.json` sums them per function. HDMA hooks are not exercised on SoE (it uses general DMA
in every sampled frame); they are verified only by code review.

**Recording overhead** (headless, 3000 SoE frames): 900 ms off, 1260 ms with the v0.172 recorder,
1410 ms with everything above. The SPC fast path is inline in `cdl.h`; keep new per-instruction
work behind a "seen lately" or "already marked" check.

## 4. Changing the recorder: checklist

1. C: constant/prototype in `cdl.h`, code in the owning `cdl-*.c` (new stream → new file), a dirty
   bit or dirty list, a drain export (`EMSCRIPTEN_KEEPALIVE`, records into `CDL_Out`), alloc/free
   wired into `cdlEnable` / `cdlDisable`.
2. `debugger-post.js` `cdlDrain` (guard with `typeof Module._x === 'function'` so older cores
   still work), then **rebuild the core** (`sh tools/build_snes_core.sh custom`) — the glue is
   part of the build output.
3. `cdl-view.ts` posts it, `host.js` decodes it, `library.ts` / `library-ext.ts` merge and store it.
4. Consumers read through `xref-index.ts` / `library-ext.ts` helpers (`retsList`, `regsByPc`, `basesByPc`).
5. Tests: `tests/debugger/cdl.test.js` (core streams, export) and `tests/debugger/cdl-recomp.test.js`
   (new streams, directives, assets, structs, enums, functions). Check `-DEVS_CDL=0` still compiles.
6. Headless check: boot `../everscript/out/Secret of Evermore (U) [!].smc` (skips the intro), run a
   few thousand frames with scripted input, drain into a scratch `CdlLibrary`, export, `build.sh`.

## 5. Export products and how they are derived

The CDL tab's Exports run in workers (Asar/WRAM: `games/evermore/cdl/export-job.ts`; Bundle zip: `core/emulator/bundle-worker.ts`): seconds
and >1 GB froze the host. They read the library from disk (flushed first); every outcome answers the page (`cdlStatus`).

| File | Module | Derived from |
|---|---|---|
| `recomp/cfg/bankXX.cfg` | `recomp-seeds.ts`, `recomp-analysis.ts` | `func … entry_mx exit_mx`, `exit_mx_variant` / `exit_mx_set` from rets; `indirect_dispatch … idx:X` for `jmp/jsr (abs,X)` (count = highest table entry that is an observed target); `ptrtail` / `ptrcall` (PEA before) for `jmp (abs)` / `jml [abs]`; `rtsstack` for `pei ; rts`; `ram_routine` for unchanged WRAM code; comments for PHA/PEA+RTS dispatch, adjusted returns, never-returning callees |
| `tables.md`, `tables/tbl_*.asm`, `tables.json`, `tables.h` | `tables.ts`, `table-assets.ts` | indexed ROM reads. Asset only when dense (≥1 recorded index per 8 entries), no executed byte inside, no overlap, one bank; else comment only. Code operands into an asset become `tbl_X+$n` |
| `enums.asm`, `enums.json` | `enums.ts` | ram.asm classification; a state that feeds `asl / tax / jsr (abs,X)` maps each value to its handler |
| `structs.asm`, `structs.h`, `structs.json` | `structs.ts` | indexed absolute accesses, pointer bases + Y, D ≠ 0. Sets merge when they share ≥ half the smaller one and sit on the larger one's stride; byte-stride groups that overlap are dropped |
| `functions.json` | `functions.ts` | per function: entries, callers/callees, widths, DB/D, WRAM ranges, I/O by class, ROM data, pointer bases, SA-1 blockers (direct + through callees), `cycles`, `execForms` / `readForms` (mirrors used) |
| `bus.md`, `bus.json` | `bus-report.ts` | ExHiROM audit (bytes/instructions/edges through `$00-$3F`, `$40-$7D`), SA-1 audit (every form but `$C0-$FF`), bytes per file bank and form, top functions by cycles |
| `ram.asm` | `wram-export.ts` | every WRAM address, accessors, values, hit counts |
| `spc/aram.cdl` | `asar-export.ts` | ARAM coverage |
| `mesen/labels.mlb`, `mesen/rom.cdl` | `mesen-export.ts` | export comments + curated names (option `names`, `wramNames`), asset ranges (`assets`); formats in docs/reverse-engineering/formats.md §3 |

**Curated names** reach the export only through options (`exportAsar(lib, rom, dir, { names, wramNames, assets })`): the cdl domain may not import `src/games/evermore/localizations`. `tools/recomp/` (`npm run recomp`) collects them and runs export → asar → snesrecomp → `out/recomp/REPORT.md`. A name must be a valid Asar/C identifier; `buildIndex(lib, map, { names })` makes `labelName()` return it.

On SoE (headless, 6000 frames): 347 of 354 functions with exit widths, 32 indexed dispatch tables,
4 never-returning callees, 12 PHA/PEA+RTS dispatch sites (e.g. `8C:CB9C` with 12 targets; `8F:9821`
reached by "returns" from 8 places, a yield-like pattern), 26 table assets, 49 structs. Entity
records: `struct_7E3DE5`, stride `$8E`, 30+ slots seen through pointer bases; `$7E4E89` / `$7E4F37`
are two further records `$AE` apart (larger records, not on the `$8E` lattice).

## 5b. Building a library from a movie

Play once, replay forever: the input recording (`.evsmv`, `src/core/emulator/tas/README.md`) is the
source of truth and the library is derived. `node tools/cdl/replay.js <movie> <rom> --cdl <root>`
replays headless with the recorder on, drains and flushes every `--drain` frames, and stops
with exit code 2 at the first WRAM-checksum mismatch ("DESYNC at frame N"). Rerun it whenever
the recorder gains a stream. Movies record pad input, memory writes (cheats, object states, menu
toggles), soft resets, a WRAM CRC every 60 frames and a VRAM/CGRAM/OAM/SRAM/ARAM CRC every 600; a power-cycle starts
a new movie. The replay boots at the movie's audio rate (44100): the rate leaks into ARAM (`src/core/emulator/tas/README.md`).
Recording the CDL never changes emulation (tested: same checksums with `--cdl`).
`--states <dir>` saves a state at room changes (`$7E0ADB`, at least 60 s apart, none before frame 600: a state taken at
frame 1 does not reproduce the run) and `--from-state <file>` resumes from one (`tools/cdl/replay-states.js`,
`tests/debugger/tas-states.test.js`); `--from-frame <n>` starts from the newest state the movie itself carries
(`Z|` lines, one per minute of hand play, `movieStates()` in `movie.ts`); states hold ROM-derived memory and stay out of git. While you record by hand the
extension replays the session headless every `everscript.tas.verifyEveryMinutes` (default 30) and reports OK / desync
(`src/platform/tas/verify.ts`); a failure after resuming from a state is repeated from power-on before it is believed.
The package has no `tools/`: the check runs `bundle/replay.js` (`tools/bundle.mts`; core path in `EVS_CORE`),
spawned with `windowsHide` (Code.exe is a GUI program: without it every check opened a console window).
Until v0.355.2 every check in an installed extension failed on the missing tool, unnoticed.

## 6. What each goal still needs

Cross-tool plan (CDL + snesrecomp + Ghidra/ghidra-snes + REA, per goal): `docs/reverse-engineering/README.md`.
The CDL library also seeds Ghidra/REA (functions at their `$8x` execution address, names, WRAM labels): `docs/reverse-engineering/rea.md` §10.1.

- **Recomp (snesrecomp):** playable in the field (village, jungle, combat; `recomp` skill,
  `docs/recomp/README.md`: its own repository); lockstep vs snes9x drifts from NMI counter ~315 (timing);
  PHA/PEA+RTS sites need `hle_dispatch`; observed-only target lists are incomplete until played.
  The library used so far is a ~10 s recording (9.3 % of the ROM): a full-play CDL is the next input.
  `FUNC_EXCLUSIONS` also emit `force_lle`: dropping a root alone lets snesrecomp compile the routine
  as a JSL target (v0.201.19).
- **Decomp:** names. The assets give shapes (tables.h, structs.h, enums) but every name is still an
  address; `hle_func` replacements are checked against the lockstep diff (§6 of the port doc).
- **SA-1 port:** `functions.json` lists, per function, what keeps it on the S-CPU. The 12 SoE
  functions with no blockers and the ~190 that only touch WRAM are the first candidates; their WRAM
  ranges are what would move to BW-RAM / I-RAM. Cycles per function are recorded since v0.212.1 (`functions.json`, `bus.md`).
- **ExHiROM / SA-1 layout ports:** `bus.md` is the audit (what ran or was read through which mirror); plan and gates in `docs/exhirom/layout-options.md` §5.
