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

The target is C that replaces the ROM routine in the recomp (`hle_func`) and leaves exactly the
state the asm leaves. That is the zelda3 / Super Metroid recomp / Lufia 2 method. A ROM stays the
Asar export: no working decomp compiles C into a SNES ROM. Plan, comparison and the worked example
(`random_below`): `docs/reverse-engineering/c-to-rom.md`.

Write the C in the form the recomp can bind:

- **Interface where the asm keeps it.** Inputs/outputs in registers, DP slots or flags; entry
  widths, DB/D, `RTS` vs `RTL`: written in the knowledge entry first, from the `.asm`.
- **Scratch is WRAM.** DP temporaries the asm writes, the C writes the same way.
- **One name per address** from the shared RAM header over `g_ram`, instead of local `extern`s;
  ROM data read from the ROM image by table label; `uint8_t`/`uint16_t` with an explicit cast
  wherever the asm wraps; integer math only (fixed-point as the asm does).
- **One routine, one file**, its gate in the header comment and the knowledge entry.

A routine's C counts by **gate**, never by "a file exists":

| Gate | Passes when |
|---|---|
| G0 | compiles on the host with `-Werror` against the shared headers |
| G1 | equals the ROM's bytes run in `cpu65816.ts` on captured and edge entry states: registers, flags, S, full WRAM, ordered I/O; a deliberate mutation of the ROM routine is caught |
| G2 | the recomp with the binding equals the recomp without it, every frame of a playback |
| G3 | per-frame WRAM/VRAM/CGRAM/OAM equal to vanilla snes9x on recorded playbacks |

State on 2026-10-24: no file has passed G1. The shared header, the G1 harness and the binding
step are still to build (`c-to-rom.md` §9). Until a file passes G1, call it a *description*.

## 5. Traps

- `$8x` and `$Cx` are the same code: search, calls and C matching fold them.
- Absolute operands above `$1FFF` count as WRAM only with DB = `$7E`: shown as `(DB $7E)`.
- Widths are assumed 16-bit A/X until a REP/SEP, linearly: a listing after a merge of paths
  with other widths can misdecode; check the CDL library (`cdl-recorder`) when it matters.
- In a PAL ROM `this ROM` may be `—` (code changed: no match for the US bytes) or
  `(ambiguous)`; never write a PAL address into an entry (`docs/evermore-releases.md`).
- `tools/recomp/lockstep.js` treats DP `$02–$0E` as noise, which is exactly where a C routine's
  scratch goes wrong unseen. G1 compares every byte.
- Long-term goals and what is open: `docs/todo/code-vfs.md`.
