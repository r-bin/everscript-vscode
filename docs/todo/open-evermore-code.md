# Code as files (Open Evermore `code` kind)

Every 65C816 routine of Evermore as an Asar file by name, placed by implode. The design, the hazards of moving code and
the reasoning are in [../open-evermore/code.md](../open-evermore/code.md); the kind's spec is
[../open-evermore/resources.md](../open-evermore/resources.md) §code. This page is the tracker: what holds today, and
the open steps, smallest first.

## Current state (v0.477.0, 2026-11-28)

- **Every recorded routine is a file.** `code/<routine>.asm`: 1,448 files (plus the folder's README), 117,208 bytes,
  57,892 lines. Each is in the CDL export's Asar syntax. Names come from the knowledge base (the names of
  `soe://rom/code/`), with `func_<address>` for an unnamed call target and `loc_<address>` for any other start, and a
  `loc_` label at every jump and branch target.
- **Pinned.** Every routine stays at its vanilla address and size, the pinned-kind exception to the hard rule
  ([../open-evermore/README.md](../open-evermore/README.md) §1). A same-size edit builds. A routine that grows, a new
  file, an `org` and a `skip` over bytes of its own are errors (`code-size`, `code-new`, `code-org`, `code-skip`), and
  so is an assembly error (`asm`, by line).
- **Other kinds' bytes stay theirs**: 3,715 operands (`; operand written by wram`, …) and 10 files with `skip` (item
  hooks, tables read in place) are holes of the routine's item, written by their kind.
- **Built by implode itself**: `src/platform/snes/asm65816.ts`, our assembler for the export's syntax. All 1,024 opcode
  × width forms and all 49,848 census instructions assemble back to their bytes.
- **Asar agrees** (checked by hand, 2026-11-28): Asar 1.90pre assembling the 1,448 files onto an image whose code bytes
  were blanked to `$FF` (a `main.asm` of `hirom` plus one `org $<run address>` and `incsrc` per file, the address from
  `_base/_base.json` homes) writes back all 117,208 bytes and gives the vanilla sha1. No label was undefined, and the five
  `mvn` keep their bytes (the operand order the review left open).
- **Input**: the census `tools/open-evermore/evermore/map/us.code.json` (49,848 instructions in 562 runs, widths
  run-length coded, 987 entries), from the vanilla CDL library by `tools/open-evermore/code-census.mts`. It is checked in,
  so explode needs no CDL library.
- **Proven**: implode `--strict` gives the vanilla sha1; random seeds 1 and 2026, ExHiROM and SA-1 round-trip
  (`tests/open-evermore/g0.test.mts`). Edits of other instruction lengths, a routine in a subfolder, a label of the
  modder's own used from another routine and an edited README round-trip: a routine compares by the bytes it assembles
  to. `prove` was not run, since no byte changes and no routine moves.
- **What is not covered**:
  - Code the CDL never saw run stays in `_base/`: 80 named knowledge entries, banks `$93`/`$96`/`$9A`, and the 35
    branches into such places, which a file keeps as `db` with a comment.
  - Data operands are numbers with a comment naming the target (`; → strings/…`), not labels.
  - Only the US release: the census is US, and so are the knowledge base's addresses. Another release keeps its code in
    `_base/`.

## Steps

| # | Step | State |
|---|---|---|
| C0 | Every recorded routine a file, pinned, assembled by implode (code.md §2.1) | ✅ v0.477.0 |
| C0a | **The Asar check as a tool**: implode writes `_build/main.asm` (the `org` + `incsrc` list above), and a test or `prove` step runs Asar on it when `ASAR` is set, comparing the bytes. It is the by-hand check of 2026-11-28, kept | 🔴 |
| C0b | **Data by label** (code.md §3.1): a long or DB-relative operand into another kind's resource written as that resource's label (`<kind>/<name>` → an Asar name), a `symbols.asm` from placement, the codecs' operand patches retired one at a time | 🔴 |
| C0c | **WRAM by name in the code**: the `wram` kind's names as Asar defines or labels on the operands it rewrites (the 3,715 `operand written by wram` lines), so a file reads `lda.w BOY_HP` and the census site becomes a reference | 🔴 depends on C0b's label scheme |
| C0d | **Code the CDL never saw**: a static pass from table entries and the 35 branch targets (symbolic-export M7, Ghidra seeds as hints only), checked against a recording before it joins the census | 🔴 |
| C0e | **Other releases**: a census per release (a CDL recording of that release, or the US one carried over by `locate`'s byte signatures), and names from the US knowledge through `code-locate.ts` | 🔴 |
| C0f | One `prove` smoke seed with code exploded (bytes are identical, so it should add nothing; the skill's rule for naming-only changes) | 🟡 not run |
| C1 | **New routines by name**: a file with no home placed by `placement.mts` in FastROM space (4th MB), reached by `jsl` from other files, handler tables naming it through a generated `jml` stub in their bank. Then the item and ingredient hooks (`consumable-hooks.mts`, `ingredient-hooks.mts`) become generated `code/` files instead of TS byte arrays | 🔴 next |
| C2 | Symbols the export still lacks: game regions (M0), local labels for the `seg_+off` branches (M1), DB-relative operands (M4), a padding test per bank (M8) | 🔴 |
| C3 | Move `jsl`-only leaves (no `jsr.w` caller, no `phk : plb`, no `pea`, no mid entry) inside FastROM, under `prove --strict` | 🔴 |
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
