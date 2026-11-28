# Code as files (Open Evermore `code` kind)

Every 65C816 routine of Evermore as an Asar file by name, placed by implode. The design, the hazards of moving code and
the reasoning are in [../open-evermore/code.md](../open-evermore/code.md); the kind's spec is
[../open-evermore/resources.md](../open-evermore/resources.md) §code. This page is the tracker: what holds today, and
the open steps, smallest first.

## Current state (v0.478.0, 2026-11-28)

- **Every recorded routine is a file.** `code/<routine>.asm`: 1,448 files (plus the folder's README), 117,208 bytes,
  in Asar syntax. Names come from the knowledge base (`soe://rom/code/`), with `func_<address>` for an unnamed call
  target and `loc_<address>` for any other start, plus `loc_` labels at jump and branch targets.
- **Symbolic WRAM and table-reader operands (C0b, C0c)**: all `3,448` WRAM census operands (`wram.asm`, using
  `VAR-$7E0000` for the 59 `$00:xxxx` bank-0 long accesses) and all `lda.l` table readers for `maps`, `tiles`,
  `scripts`, `animations`, `characters._enemy_index`, `sprite_blocks_16`, and `sprite_blocks_8` (`tbl_*` in
  `symbols.asm`) are emitted symbolically and owned by `code/` (`code/owned-sites` handoff).
- **New routines and movable `jsl`-only leaves (C1, C3)**: new `code/<name>.asm` files without `org` and `154` pure
  `jsl`-only leaves (no `jsr.w` caller, no remaining foreign holes, no `tableAt` sites, no `phk`/`pea`/`per`/data, no
  WRAM indirect-jump hook references, and no `_base` pointer matches) relocate freely in FastROM via `layout.mts`.
- **Two-phase assembly + standalone whole-game Asar project (C0a)**: `src/platform/snes/asm65816.ts` (extended with
  `!DEFINE`s, `NAME = expr` constants, parenthesized expressions, and unary `~`/`+`/`-`) assembles `code/*.asm` after
  placement, and `implode` emits `_build/asar/` (`main.asm`, `enums.asm`, `wram.asm`, `symbols.asm`, `blobs/`). Running
  Asar 1.90pre via `implode --asar` builds byte-identical ROMs for both `--strict` (`79e7738630fff5699217ef58ecc421bc8fcbcd89`)
  and `--random 1` (`d7816e1413c6c7f13f86be8a6d9af314671c7aca`, with 132 moved routines).
- **Proven**: `implode --strict` gives the vanilla sha1; `g0.test.mts` verifies random seeds 1 and 2026, ExHiROM, SA-1,
  WRAM moves in `code/`, C1 new routines, C3 movable routines, and real Asar parity; `prove --random 1` passes all
  14,638 frames in lockstep (`attract-loop.evsmv`: 6,224 frames, `intro-2m20.evsmv`: 8,414 frames).
- **What is not covered**:
  - Code the CDL never saw run stays in `_base/`: 80 named knowledge entries, banks `$93`/`$96`/`$9A`, and the 35
    branches into such places, which a file keeps as `db` with a comment.
  - Remaining non-`lda.l` codec operand patches (`rings`, `dog_forms`, `consumables`, `ingredients`, `palettes`,
    `characters` bank bytes) stay as foreign holes (`skip` / `; operand written by ...`) and post-code `blobs/patches.bin`
    slices in `_build/asar/main.asm`.
  - Only the US release: the census is US, and so are the knowledge base's addresses. Another release keeps its code in
    `_base/`.

## Steps

| # | Step | State |
|---|---|---|
| C0 | Every recorded routine a file, pinned, assembled by implode (code.md §2.1) | ✅ v0.477.0 |
| C0a | **The Asar check as a tool**: `implode` emits `_build/asar/` (`main.asm`, `enums.asm`, `wram.asm`, `symbols.asm`, `blobs/`) and `--asar` verifies byte-identical Asar builds | ✅ v0.478.0 |
| C0b | **Data by label** (code.md §3.1): generated-table `lda.l` readers (`maps`, `tiles`, `scripts`, `animations`, `characters._enemy_index`, `sprite_blocks_16`, `sprite_blocks_8`) symbolized as `tbl_*`; remaining non-`lda.l` codec patches still open | 🟨 v0.478.0 |
| C0c | **WRAM by name in the code**: all `3,448` WRAM census operands written by WRAM symbol (`wram.asm`) and owned by `code/` | ✅ v0.478.0 |
| C0d | **Code the CDL never saw**: a static pass from table entries and the 35 branch targets (symbolic-export M7, Ghidra seeds as hints only), checked against a recording before it joins the census | 🔴 |
| C0e | **Other releases**: a census per release (a CDL recording of that release, or the US one carried over by `locate`'s byte signatures), and names from the US knowledge through `code-locate.ts` | 🔴 |
| C0f | `prove --random 1` smoke + lockstep check with symbolic WRAM/tables and C3 moved routines (14,638 frames in step) | ✅ v0.478.0 |
| C1 | **New routines by name**: `code/<name>.asm` without `org` placed by `layout.mts` in FastROM, using WRAM, `tbl_*`/`res_*` symbols, and `!ENUM`/`!STRUCT` defines (handler-table bank stubs and moving `consumable-hooks.mts`/`ingredient-hooks.mts` into `code/` files still open) | ✅ v0.478.0 |
| C2 | Symbols the export still lacks: game regions (M0), local labels for the `seg_+off` branches (M1), DB-relative operands (M4), a padding test per bank (M8) | 🔴 |
| C3 | Move `154` `jsl`-only leaves inside FastROM, verified under `prove --random 1` and `g0.test.mts` | ✅ v0.478.0 |
| C4 | Move a bank's handlers with their jump table, or a whole `jsr.w` group; fall-through chains (a named mid-entry is its own file today) move as one | 🔴 |
| C5 | Header vectors by routine name (S8, `header.json`) | 🔴 |
| C6 | Address immediates, pointers in data (M5, M6), with the ratchet that only shrinks | 🔴 |

## Smaller open items

- **Editor support for the tree's `.asm`**: hover and go-to-definition from a label to `soe://rom/code/<routine>/` and
  to the knowledge entry; the Code tab reading the tree. 💡
- **One owner for the 4th MB** (*owner's call*, code.md §6.4): the hotkey hack (`$F80000`), C to ROM (`$F8-$FB`), the
  everscript patches (`$FE5000`, `$FE6000`) and MSU-1 (`$FE6000`) overlap. C1 places new code there, so the claims must
  become manifest regions or tree files first. 🔴
- **Everscript `#patch` asm as tree files**: the sibling compiler's `patches/*.asm` written as `code/` files placed by
  implode instead of fixed `org`s. 💡
- **Assembler edges** (from the review, harmless for explode's text): a bare `brk`/`cop` needs `#$00`; a label named `a`
  reads as the accumulator. 🟢
- **Open questions** (code.md §7): address immediates that are code addresses, `jsr` with inline parameters, who fills
  `$7E0140`, code addresses in the save, re-keying the WRAM census sites by routine + offset once code moves.
