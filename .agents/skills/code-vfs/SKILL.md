---
name: code-vfs
description: Use to find, read or decompile an Evermore routine: soe://rom/code/<name>/ (info, .asm, .c), search, the todo worklist, where C and facts go, and the gates C needs to run as Evermore.
applyTo: "reconstructed-c/**,src/games/evermore/resources/code-*,src/games/evermore/localizations/**"
---

# Skill: routines by name (`soe://rom/code/`)

A routine is known by its **name** (the knowledge entry's `name:`), never by its address. The
address in the entry is the US one; in any other ROM (PAL, a rebuilt or patched ROM) the routine
is found by its bytes. Read code through the VFS (MCP `soe_read`) instead of crawling the repo.

## 1. Find

| You have | Read |
|---|---|
| a word (`boy`, `fade`, `sleep`) | `soe://rom/code/index.md?q=<word>`: names, knowledge text, C, and WRAM entries whose name matches (`write BOY_ENTITY_RECORD`) |
| a WRAM address | `index.md?q=7E0B19` (or `q=0B19`): every routine touching the RAM entry that address is in, with read/write |
| a ROM address | `index.md?q=8CD230`: the routine containing it, and the routines calling it; old links `code/<address>` still resolve |
| a subsystem | `index.md?bank=8c`, `?category=🧠`, `?confidence=guess`; data: `index.json` (same query) |
| what to work on | `todo.md`, or `index.md?status=<kind>` (`no-c`, `magic`, `unnamed-calls`, `generic-name`, `no-purpose`, `legacy`, `uncommented`, `missing`, `todo`) |
| who uses WRAM; what lives where | `wram.md` (address → readers, writers), `banks.md` (routines, C, comments per bank) |

## 2. Read one routine: `soe://rom/code/<name>/`

- `info.md` — the knowledge entry, US address and the address in this ROM, calls, callers
  (direct calls between known routines only: jump tables are not followed), WRAM with access,
  record fields (`+$05,y`), I/O registers, open work.
- `<name>.asm` — the whole routine (runs past a return while an earlier branch lands further
  on; stops at the next known routine), the comments infused. `?comments=0`: raw.
- `<name>.c` — its function from `reconstructed-c/`; `?file=1`: the whole file.

## 3. Write — each fact has one home

| What | Where | How the VFS finds it |
|---|---|---|
| name, purpose, evidence | `localizations/knowledge/rom/<us addr>.md` (`game-knowledge` skill) | `name:` is the folder: unique, `lower_snake`, our own words |
| asm comments | `localizations/data/asm-comments.json`, key = US file offset (`0CD22B`) | infused at read time, also into a moved routine (same offset into it) |
| C | `reconstructed-c/<bank>/<addr>_<topic>.c`, many routines per file allowed | the comment block right above the function names the US address (`$8C:D220`), or the C name equals the entry's `name` |
| walkthroughs | `docs/disassembly/<subsystem>/`, linking `soe://rom/code/<name>/…` | — |

Done when `info.md` of the routine shows the C, `Open work` lost the kinds you fixed, and
`todo.md`'s counts went down. A routine named in `todo.md` under *Routines without an entry*
becomes known by writing its entry; then it gets a folder.

## 4. C that runs as Evermore

The C replaces its ROM routine and leaves exactly the state the asm leaves. Two ways to run it:
**in the ROM** (`tools/c-to-rom/`, Calypsi; the owner's choice of 2026-10-24) and in the recomp
(`hle_func`). Build, ABI and status: `docs/reverse-engineering/c-to-rom.md` §10.

Write the C in the bindable form (worked files: `reconstructed-c/80/80859B_*.c`, `90/909DE8_*.c`):

- `#include "soe.h"` (WRAM, ROM, I/O, DB-relative `ABS16`/`ABSI16`, `DP16`, flag helpers) and
  `"soe_ram.h"` (generated from `knowledge/ram/`: one name per address, `ENTITY_RECORD_*_OFF`).
  Name an address by writing its entry, then `node tools/c-to-rom/gen-ram-header.mts`.
- `SOE_BIND(name, 0x8FA963, RTS) { ... }` on the execution address. The binding reads the registers
  from `r` and writes back every register and flag the asm leaves: `soe_nz16` after the last load,
  pull or `TDC`, `soe_carry`, `soe_bit_imm`. Operands as the asm addresses them: `LDA $0139` is
  `ABS16(r, 0x0139)` (bank DB), `LDA $7E0139` is `RAM16(0x0139)`, `LDA $12` is `DP16(r, 0x12)`.
- Tables and assets are read from the ROM (`ROM16(0xC40002 + x)`), never copied into C. No static
  variables (the link fails). No comma expressions in conditions. Call C directly, asm through
  `soe_call_rtl`/`soe_call_rts`; a halt (BRK/STP) is `soe_stp()`.
- One routine, one file `<bank>/<addr>_<name>.c`; drop the old description of it from other files.
- **Preserve, never improve** (AGENTS.md rule 11): the default code follows the asm instruction by
  instruction and is never rewritten for speed. A faster variant may follow it under
  `#ifdef SOE_OPTIMIZE` (off; `build.mts --optimize`, `g1.mts --optimize` checks it), only for a
  measured need written in `c-to-rom.md` §10. The speed helpers (`SOE_BANK`, `BANKI16`, `DPB16`,
  `soe_flags_*`, `soe_mvn_7e`) exist only under that macro.

### 4.1 Strict C Code Quality Rules (Calypsi 65816 Codegen)

Calypsi (`compiler/calypsi.md`) generates near 1:1 assembly with vanilla 65816 ONLY when C strictly adheres to these rules:
1. **Integer Width Discipline**: Strictly use `uint16_t` and `uint8_t` (and signed `int16_t`/`int8_t`). NEVER use bare `int`, `long`, or `uint32_t` unless 32-bit arithmetic is required. 32-bit types double instruction count and cycle costs.
2. **Control Flow over Flags**: Never emit CPU status flag variables (`N`/`Z`/`C` booleans). Fold branches into high-level `if/else`, loops, and switches.
3. **Clean Signatures for Standalone/Clean Code**: For standalone modules and empty FastROM compilation, pass parameters in registers (`A` and `_Dp`/`X`) and return in `A`. Avoid `soe_regs` struct wrappers outside legacy bridges.
4. **Typed Structs over Raw Pointer Math**: Use typed structs (`entity->hp`) so Calypsi can generate indexed addressing modes (`lda [dp],y`).
5. **Local Scoping for Scratch**: Scratch variables must be local so Calypsi keeps them in virtual Direct Page registers (`_Dp`) rather than spilling to global WRAM.
6. **Compiler Settings & Traps**: Use `-O1 --speed` with `--target=snes` (never `-O2` due to sign reload bug). Use `--force-switch=if-else` or `jump-table`. No comma expressions in conditions. Detail: `compiler/README.md`.
7. **ASM-to-ASM Feedback Loop & 1.0x Parity**: After compiling C to assembly (`tests/memory/c-asm-parity.test.mts` or `npm run c-to-rom:rate`), compare its instruction count against the original vanilla 65816 routine (`soe://rom/code/<name>/?asm=1`). Target: **~1.0x**. If compiled code size is **> 1.0x**, consider an inline assembly (`__asm`) or compact variant under `#ifdef SOE_OPTIMIZE` (or `#ifdef SOE_USE_ASM`) mirroring the original logic to approach ~1.0x parity. Priority for ROM compilation is compact output (~1.0x ASM) and cycle parity over aesthetic C. If a micro-primitive cannot reach ~1.0x in C, use inline `__asm` or keep native ROM ASM.

A routine's C counts by **gate**, never by "a file exists":

| Gate | Passes when | Tool |
|---|---|---|
| G0 | Calypsi compiles it (the build; with `--optimize` too when it has a variant) | `build.mts` |
| G1 | equals the ROM's bytes on cpu65816.ts from sampled real entry states and fuzzed ones: registers, flags, S, WRAM except the dead stack, ordered I/O; snes9x agrees with the interpreter; a mutation is caught | `g1.mts` |
| G2 | the recomp with the binding equals the recomp without it | not built |
| G3 | per-frame WRAM equal to vanilla on the 2:20 reference | `compare.mts`: drifts by design (§7a) |

State on 2026-10-24 (v0.351.0): 27 routines pass G1, recorded as a `c: G1 passed` evidence line in
each knowledge entry. A file below G1 is a *description*.

## 5. Traps

- `$8x` and `$Cx` are the same code: search, calls and C matching fold them.
- Absolute operands above `$1FFF` count as WRAM only with DB = `$7E`: shown as `(DB $7E)`.
- Widths are assumed 16-bit A/X until a REP/SEP, linearly: a listing after a merge of paths
  with other widths can misdecode; check the CDL library (`cdl-recorder`) when it matters.
- In a PAL ROM `this ROM` may be `—` (code changed: no match for the US bytes) or
  `(ambiguous)`; never write a PAL address into an entry (`docs/evermore-releases.md`).
- Bind only a real routine: the build refuses entries reached only by falling through (a loop
  label such as `$8F:AFF5`), routines shorter than the trampoline, and trampoline bytes that some
  recorded jump lands on. Routines that pull their caller's stack (`PLB` of a pushed DB, `$90:9F21`)
  do not fit the bridge yet.
- `tools/compare` treats DP `$02–$0E` as noise between different backends, which is exactly where a C routine's
  scratch goes wrong unseen. G1 compares every byte.
- Long-term goals and what is open: `docs/todo/code-vfs.md`.
