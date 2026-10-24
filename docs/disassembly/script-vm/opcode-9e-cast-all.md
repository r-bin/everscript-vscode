# Script Opcode 0x9E: Cast a Spell

**Handler entry:** `$8C:D0D0`\
**Opcode table entry:** `$8C:E9F9`\
**Operands:** caster entity, spell, level, zero-terminated target entity expressions\
**Confidence:** dispatch branches, target-list filtering, no-slot consumption, and carry return confirmed

## Control Flow

The handler clears `$7E:3BC1`, evaluates the caster, spell, and level, then selects an
allocation routine by spell ID. Spell `$0002` and `$0016` call `$91:9777`; all other spell
IDs call `$91:9759`. A zero result from either allocator takes the no-slot path.

With a slot, target expressions are read until zero. Each nonzero target that differs from
the current `$7E:3BC1` value is written to the slot's `+$2E` target field. After the list,
the handler performs the spell setup and enqueue path, including calls to `$91:AD17`,
`$91:973E`, and `$8C:C521`. Those routines and the later per-target slot work remain opaque
in the host-side model.

Without a slot, the handler discards the previously evaluated caster, spell, and level
from the stack, then evaluates an entity expression and two ordinary expressions before
reading expressions until zero. Since the script cursor is already at the first target,
this consumes the first three target expressions as the discarded values. It reaches the
same terminator only when the list contains at least three targets; shorter lists can
consume following script data. The path sets carry and returns.

## Reconstruction

The host-side control-flow model is in
[`reconstructed-c/8C/8CD0D0_opcode_9e_cast_all.c`](../../../reconstructed-c/8C/8CD0D0_opcode_9e_cast_all.c).
It does not reproduce spell allocation, animation setup, or queue internals.

## Evidence

- `$8C:D0D0` clears `$7E:3BC1`; `$8C:D0D3` evaluates the caster; `$8C:D0D8` and
  `$8C:D0DD` evaluate spell and level.
- `$8C:D0E2` selects the `$91:9777` path for spell `$0002` and `$0016`; other spells
  branch to `$8C:D19E`, which calls `$91:9759`.
- The allocated-slot target loop at `$8C:D0FF` and `$8C:D1A9` terminates on zero and
  skips values equal to `$7E:3BC1` before storing a target at `+$2E`.
- The no-slot path at `$8C:D1F6` pops the saved operands, evaluates three expressions,
  then loops on expressions until zero; `$8C:D20B` sets carry before return.