---
name: c-style
description: Use when writing, binding or touching a file in reconstructed-c/: how readable bound C should look (enums, structs, names, comments, no magic numbers) without changing what it does.
applyTo: "reconstructed-c/**"
---

# Skill: readable reconstructed C

The C in `reconstructed-c/` is how people read the game. Binding a routine is the moment to raise its
file to this standard. These are not gates: a binding may land without one of them when the fact is
not known yet. But each usually improves the file, so do what the evidence allows and leave the rest
as a plain address rather than a guessed name. Worked files: `8F/8F9817_field_spare_time_loop.c`,
`80/80858C_wait_for_nmi.c`.

Form, gates and Calypsi rules are in `code-vfs` §4. They come first: nothing here may change the
code. Names, enums and macros cost nothing, so the compiled result stays the same. The default code still
follows the asm instruction by instruction (`AGENTS.md` rule 11).

## The standard

- **Enums and structs.** A set of values is an enum (task addresses, directions, states). A record
  in WRAM is a struct or named `*_OFF` fields, not `base + 0x12`. An enum does not check anything:
  if a value can be out of range, say what happens then.
- **Readable names.** Name a function for what it does, a variable for what it holds. `a`, `x`, `tmp`
  only where they really are the registers. A `sub_8F9AC6` gets a name once you can say what it does.
- **Readable parameters.** `frame_at_entry`, not `f`, `v` or `arg1`; an out parameter says so.
- **Comments and javadoc.** Each function gets a `/** @brief */` block with `@param` and `@return`:
  what it means in the game, its inputs and outputs, and what each return value tells the caller. Say
  why, and what the asm does that is surprising. Do not repeat the line below in words.
- **No magic numbers.** A number gets a name when the name says more than the digits:
  - WRAM: `ABS16(r, CHILD_TASK_CURSOR_ADDR)` from `soe_ram.h`, generated from `knowledge/wram/`. Write
    the entry, then `node tools/c-to-rom/gen-ram-header.mts`; never edit that header.
  - Direct page: a slot that always holds one thing gets its own name in `include/soe_dp.h`
    (`DP16(r, DP_CHILD_RECORD)`). A slot reused for anything is scratch: name it for its role in
    this routine with a local `#define` (`#define DP_STEPS_LEFT 0x02`), or `DP_SCRATCH_0` if it has none.
  - Constants, bit masks, sizes, table addresses: a `#define` or enum near the top of the file.
- **Numbers that stay.** `SOE_AT(0x9821)` marks and the return address of a hand-over are ROM
  addresses, which is what they mean. So are the small arithmetic steps of the asm (`+ 2`, `<< 1`).

## Rules that keep it honest

- **A name is a claim.** Use a name only when the code or a trace supports it; check the existing
  ones first (`soe_ram.h`, `soe://rom/code/<name>/`, the knowledge entry). Record what you learn there
  in the same commit (`game-knowledge` skill).
- **Keep the addressing.** Naming does not change the macro: `LDA $3BC3` stays `ABS16` (bank DB) and
  does not become the `RAM16` accessor, unless DB is proven. `_ADDR` as a direct page offset is only true with D = 0.
- **Side effects:** `ROM16`, `ABS16` and friends evaluate their argument more than once on the host.
- **Rated files.** An edit changes a rated file's hash: rerun `tools/c-to-rom/rate-files.mts --update
  --rom <rom>`, G1, and, if the file is bound, the recomp's replay 01 gate.
- **Old files** are raised when you bind or touch them, not in a sweep of their own.
