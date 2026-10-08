---
name: cdl-recorder
description: Use when touching the Code/Data Logger (CDL) — the recorder compiled into the snes9x core (cdl*.c, hook sites in cpuexec/getset/dma/cpuops/spc700.h/apumem.h), the per-ROM library, xrefs, the Asar export and its assets (tables/, enums, structs, functions.json, snesrecomp cfgs), the CDL tab, or any analysis built on recorded data for a recomp, decomp or SA-1 port.
applyTo: "src/emulator/cdl/**,src/emulator/cdl-*.js,src/emulator/core/snes9x2005-wasm/source/cdl*,src/emulator/core/snes9x2005-wasm/source/spc700.h,src/emulator/core/snes9x2005-wasm/source/apumem.h,tools/gen-cdl-optable.js,tests/debugger/cdl*.test.js,docs/workflows/cdl-export-build-recomp.md,docs/asm-to-c-port.md"
---

# Skill: CDL recorder, library and exports

Read first: `src/emulator/cdl/README.md` (file map, invariants, allowed deps).
Usage: `docs/workflows/cdl-export-build-recomp.md`. Goal and status: `docs/asm-to-c-port.md` §10–11.
Design history: `docs/tracing-disassembler-and-asar-generation.md` §9 (§1–8 are the original
proposal and differ from what was built).

**Goal of everything here:** collect what a static recompilation (snesrecomp), a later
decompilation (readable C) and an even later SA-1 port need, which static analysis alone
cannot know: real entry/exit widths, jump-table targets, data bank / direct page, which
bytes are tables, how WRAM is laid out, and what each function touches.

## 1. Pipeline

```text
core (WASM, per instruction / access)        webview (every 15 s)        host (Node)
  cdl.c        rom.cdl/ext, edges, xrefs, ─► cdl-view.js drains only ──► library.js + library-ext.js merge
               pcstats, wvals, DMA/HDMA/$2180    changed chunks /           flush 60 s after last change
  cdl-wram.c   wflags, script-xrefs, WRAM code   new table entries          (max every 5 min, at once on pause/stop)
  cdl-count.c  hit counters (deltas)                                        ▼
  cdl-flow.c   shadow call stack -> rets       asar-export ─► banks/, tables/ (assets), ram/enums/structs.asm,
  cdl-regs.c   DB / D, pointer bases + Y                      functions.json, recomp/cfg (snesrecomp), spc/aram.cdl
  cdl-spc.c    SPC700 ARAM coverage
```

## 2. Hard rules

- **Off by default** and **paused = idle** (no tick, no drain, no write).
- **Never touch the disk per instruction.** Record into WASM memory; drain only dirty data.
- **Every field merges commutatively and idempotently** (OR, min, max, set union), so libraries
  from different sessions or players merge to the same result in any order. A new field needs
  a merge rule before it ships.
- **Hit counts are the one exception: they are summed** (user decision, v0.173.0: having counts
  matters more than idempotence). Correct only because the core drains them as **deltas**
  (`cdl-count.c` zeroes what it hands out). Never seed counts back, never merge a library into itself.
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

**Shadow call stack** (`cdl-flow.c`): calls and interrupts push (entry, expected return, call
site, S after the push). A return is matched **by S**: top frame → normal (or MODIFIED if the
target differs); deeper frame → the frames above are DROPPED; below every frame → a return
through a pushed address (FLOW_RETURN edge, target marked JUMP_TARGET). TCS/TXS do not reset it;
an RTS with S above every frame does (stack switch).

**Still not recorded:** per-value counts, word values as words (wvals split bytes), read values,
SPC700 DSP / BRR sample origins, SA-1 / coprocessor buses (snes9x2005's SA-1 core is separate and
unhooked), timing (cycles per function). HDMA hooks are not exercised on SoE (it uses general DMA
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
3. `cdl-view.js` posts it, `host.js` decodes it, `library.js` / `library-ext.js` merge and store it.
4. Consumers read through `xref-index.js` / `library-ext.js` helpers (`retsList`, `regsByPc`, `basesByPc`).
5. Tests: `tests/debugger/cdl.test.js` (core streams, export) and `tests/debugger/cdl-recomp.test.js`
   (new streams, directives, assets, structs, enums, functions). Check `-DEVS_CDL=0` still compiles.
6. Headless check: boot `../everscript/out/Secret of Evermore (U) [!].smc` (skips the intro), run a
   few thousand frames with scripted input, drain into a scratch `CdlLibrary`, export, `build.sh`.

## 5. Export products and how they are derived

| File | Module | Derived from |
|---|---|---|
| `recomp/cfg/bankXX.cfg` | `recomp-seeds.js`, `recomp-analysis.js` | `func … entry_mx exit_mx`, `exit_mx_variant` / `exit_mx_set` from rets; `indirect_dispatch … idx:X` for `jmp/jsr (abs,X)` (count = highest table entry that is an observed target); `ptrtail` / `ptrcall` (PEA before) for `jmp (abs)` / `jml [abs]`; `rtsstack` for `pei ; rts`; `ram_routine` for unchanged WRAM code; comments for PHA/PEA+RTS dispatch, adjusted returns, never-returning callees |
| `tables.md`, `tables/tbl_*.asm`, `tables.json`, `tables.h` | `tables.js`, `table-assets.js` | indexed ROM reads. Asset only when dense (≥1 recorded index per 8 entries), no executed byte inside, no overlap, one bank; else comment only. Code operands into an asset become `tbl_X+$n` |
| `enums.asm`, `enums.json` | `enums.js` | ram.asm classification; a state that feeds `asl / tax / jsr (abs,X)` maps each value to its handler |
| `structs.asm`, `structs.h`, `structs.json` | `structs.js` | indexed absolute accesses, pointer bases + Y, D ≠ 0. Sets merge when they share ≥ half the smaller one and sit on the larger one's stride; byte-stride groups that overlap are dropped |
| `functions.json` | `functions.js` | per function: entries, callers/callees, widths, DB/D, WRAM ranges, I/O by class, ROM data, pointer bases, SA-1 blockers (direct + through callees) |
| `ram.asm` | `wram-export.js` | every WRAM address, accessors, values, hit counts |
| `spc/aram.cdl` | `asar-export.js` | ARAM coverage |

On SoE (headless, 6000 frames): 347 of 354 functions with exit widths, 32 indexed dispatch tables,
4 never-returning callees, 12 PHA/PEA+RTS dispatch sites (e.g. `8C:CB9C` with 12 targets; `8F:9821`
reached by "returns" from 8 places, a yield-like pattern), 26 table assets, 49 structs. Entity
records: `struct_7E3DE5`, stride `$8E`, 30+ slots seen through pointer bases; `$7E4E89` / `$7E4F37`
are two further records `$AE` apart (larger records, not on the `$8E` lattice).

## 6. What each goal still needs

- **Recomp (snesrecomp):** the generated C must boot (host / frame driver, `asm-to-c-port.md` §11);
  PHA/PEA+RTS sites need `hle_dispatch`; observed-only target lists are incomplete until played.
- **Decomp:** names. The assets give shapes (tables.h, structs.h, enums) but every name is still an
  address; `hle_func` replacements are checked against the lockstep diff (§6 of the port doc).
- **SA-1 port:** `functions.json` lists, per function, what keeps it on the S-CPU. The 12 SoE
  functions with no blockers and the ~190 that only touch WRAM are the first candidates; their WRAM
  ranges are what would move to BW-RAM / I-RAM. Timing data (cycles per function) is not recorded yet.
