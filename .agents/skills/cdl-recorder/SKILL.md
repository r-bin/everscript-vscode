---
name: cdl-recorder
description: Use when touching the Code/Data Logger (CDL) — the recorder compiled into the snes9x core (cdl.c, cdl-wram.c, cdl-table.c, hook sites in cpuexec/getset/dma/cpuops), the per-ROM library, xrefs, the Asar / ram.asm / snesrecomp exports, the CDL tab, or any analysis built on recorded coverage (struct inference, indirect-jump resolution, recomp seeds).
applyTo: "src/emulator/cdl/**,src/emulator/cdl-*.js,src/emulator/core/snes9x2005-wasm/source/cdl*,tools/gen-cdl-optable.js,tests/debugger/cdl.test.js,docs/workflows/cdl-export-build-recomp.md,docs/asm-to-c-port.md"
---

# Skill: CDL recorder, library and exports

Read first: `src/emulator/cdl/README.md` (file map, invariants, allowed deps).
Usage: `docs/workflows/cdl-export-build-recomp.md`. Goal and status: `docs/asm-to-c-port.md` §10–11.
Design history: `docs/tracing-disassembler-and-asar-generation.md` §9 (§1–8 are the original
proposal; parts of it were never built, e.g. struct fingerprinting).

## 1. Pipeline

```text
core (WASM, per instruction / access)        webview (every 15 s)        host (Node)
  cdl.c       rom.cdl + rom.ext, edges,  ──► cdl-view.js drains only ──► library.js merges (OR/min/max/union)
              xrefs, pcstats, wvals           changed chunks / dirty      flushes 60 s after last change
  cdl-wram.c  wflags, script-xrefs            table entries                (max every 5 min, at once on pause/stop)
                                                                           ▼
                                   asar-export / wram-export / recomp-seeds / asar-build
```

## 2. Hard rules

- **Off by default** and **paused = idle** (no tick, no drain, no write).
- **Never touch the disk per instruction.** Record into WASM memory; drain only dirty data.
- **Every field merges commutatively and idempotently** (OR, min, max, set union), so libraries
  from different sessions or players merge to the same result in any order. A new field needs
  a merge rule before it ships.
- **Hit counts are the one exception: they are summed** (user decision, v0.173.0: having counts
  matters more than idempotence). This is only correct because the core drains counts as
  **deltas** (`cdl-count.c` zeroes what it hands out) and the library adds each delta once.
  Never seed counts back into the core, and never re-apply a library's counts to itself.
- **New library files are optional.** Old libraries must load unchanged; bump nothing, add a file.
- **Export must rebuild byte-identically** (`asar --fix-checksum=off`). Known regions win over
  the CDL for their bytes. Branches always use a label, never a bare number.
- **`opcodes.js` is the single source for the opcode table.** After editing it, run
  `node tools/gen-cdl-optable.js` (regenerates `cdl-optable.h`; a test fails on drift),
  then rebuild the core (emulator-subsystem skill).
- **Every C hook sits behind `#if EVS_CDL`** and checks `cdl.active` with `__builtin_expect(…, 0)`.
  `cdl.active` is only true inside `S9xMainLoop`, so debugger reads are never recorded.
- `rom.cdl` keeps the **Mesen-S / BizHawk bit layout** (CODE 01, DATA 02, JUMP 04, SUB 08,
  IDX8 10, ACC8 20). Anything else goes in `rom.ext` or a new file.

## 3. What is recorded (and what is not)

| Recorded | Where | Notes |
|---|---|---|
| code/data per ROM byte, opcode head, M/X seen (both widths → conflict) | `rom.cdl`, `rom.ext` | M/X per instruction byte |
| control-flow edges: call, jump, taken branch, indirect, interrupt | `edges.bin` | **no return edges** (RTS/RTL/RTI are not flow kinds) |
| (PC, effective address, R/W, byte/word, pointer, DMA) | `xrefs.bin` | **capped at 128 addresses per (PC, space)**, beyond → bulk range in `pcstats` |
| values written per WRAM byte (256-bit set) | `wram-values.bin` | writes only, per byte (word values are split) |
| WRAM R/W/width/exec/script/pointer per byte | `wram.flags` | |
| script instruction → WRAM it touched | `script-xrefs.bin` | needs the interpreter fetch pattern (SoE `$0CD0A6`) |
| DMA source ranges in ROM (VRAM/CGRAM kind) | `rom.ext`, xrefs | general DMA only |
| executions per opcode head, reads per ROM data byte | `rom-hits.bin` (core `cdl-count.c`) | summed; Float64 in the host, 2×uint32 on disk |
| reads / writes per WRAM byte | `wram-hits.bin` | a word access counts at its low byte |

**Not recorded** (known gaps):
- **DB and D register values.** Effective addresses are right, but the base/offset split for
  dp modes and the bank for `abs` cannot be recovered when D ≠ 0 or DB ≠ $7E/$80.
- **Pointer bases of indirect modes** (`(dp),y`, `[dp],y`, `(sr,s),y`): only the effective address
  is stored, so a field offset in Y and a struct base in the pointer cannot be separated.
  The pointer fetch itself is only flagged `XR_POINTER` for indirect *jumps*.
- **HDMA table reads** (`S9xDoHDMA` reads through raw pointers, no hook), so HDMA tables in ROM stay unmarked.
- **WRAM writes through `$2180` (WMDATA)** and DMA into WRAM: recorded as an I/O access, the
  WRAM bytes they write get no flags or values.
- **Return-address tricks**: stack drops (`PLA:PLA` before RTS), push-address-then-RTS dispatch,
  and inline arguments after `JSR`. These produce no edge or flag. (On SoE, recorded data shows
  no inline args after JSR/JSL so far.)
- **SPC700 / ARAM**: only "ROM byte streamed to `$2140-3`" (`EXT_APU_SOURCE`).
- **Stack-relative accesses** (`lda $07,s`) further than 4 bytes from S land in WRAM xrefs as noise.
- Edge/xref tables grow up to `TABLE_MAX`, then **drop new keys silently**.

## 4. Changing the recorder: checklist

1. C side: add the bit/table in `cdl.h` / `cdl.c` (or `cdl-wram.c` for WRAM), a dirty bit,
   and a drain export (`EMSCRIPTEN_KEEPALIVE`, records into `CDL_Out`).
2. Keep the per-instruction path allocation-free; filter repeats through the `recent*` cache
   before touching a hash table.
3. Webview: drain it in `cdl-view.js` and post a delta. Host: merge it in `library.js` with a
   commutative rule, and write it as a new optional file.
4. Export consumers: `xref-index.js` first (all exporters read through it).
5. Tests: `tests/debugger/cdl.test.js` (merge order independence, rebuild byte-identity).
6. Rebuild the core and run the headless boot to check that recording still keeps up at full speed.

## 5. Analyses that work on today's data

- **ROM lookup tables** (`tables.js`, exported as `tables.md` plus `; table:` header comments).
  Each `abs,X` / `abs,Y` / `long,X` ROM read gives `index = address − operand`. Sites sharing a
  base form one table; neighbouring bases with the same index set are fields of one record;
  the entry size is the gcd of the indices. A walk back finds the index source
  (`$7E0010 > asl > tax`), and a walk forward finds the result (`sta $7E0020`, or the A operand of
  `cmp/adc`). Entries are classified as increasing/decreasing curves, code pointers or plain lookups.
  On vanilla SoE: 202 tables. Limits: only indices that were actually used are seen (play the
  level-ups to see a stat table), `[dp],y` reads are not covered, and a walk back can cross a
  loop join and report the wrong source.

- **Struct inference from indexed absolute modes** (`abs,X`, `abs,Y`, `long,X`). The operand
  is static, so `index = effective − operand`. Group PCs by identical index sets: the shared set
  gives the instance bases, and the operands give the field offsets. On vanilla SoE, 129 PCs
  share the set `$3DE5 $3E73 $3F01 $3F8F $401D $40AB $4E89 $4F37` (six entity slots, stride
  `$8E`, plus two more at `$4E89/$4F37`) with 62 fields from `+$03` to `+$8C`. A second set
  gives an array at `$3BC9`, stride `$59`. No exporter emits this yet.
  (The `$4E45/$4EB5` stride `$70` example in the tracing doc does not match the recorded data.)
- **Indirect dispatch tables**: the site instruction (`jmp (abs,x)` etc.) gives the table base,
  and the edges give the observed targets. Read the table forward while entries point at code or
  into the same bank's code range to get `indirect_dispatch` counts for snesrecomp.
- **Exit width**: the M/X recorded on a function's RTS/RTL heads gives its exit state.
- `dp`-mode xrefs: valid as effective addresses, but only decomposable when D = 0
  (SoE executes TCD at only 5 sites and PLD at 1; check those functions before trusting dp offsets there).
