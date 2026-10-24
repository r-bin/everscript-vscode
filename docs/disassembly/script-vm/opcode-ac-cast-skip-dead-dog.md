# Script Opcode 0xAC: Cast, Skipping a Dead Dog

**Handler entry:** `$8C:D0C3`\
**Shared cast path:** `$8C:D0D3`\
**Opcode table entry:** `$8C:EA15`\
**Operands:** caster expression, spell expression, level expression, zero-terminated target expressions\
**Confidence:** Dog HP test, marker write, and shared-path entry confirmed

## Control Flow

The handler checks Dog HP at entity `$4F37` offset `+$2A`. If HP is zero, it writes
`$4F37` to `$7E:3BC1` and branches to the shared cast path at `$8C:D0D3`. Otherwise it
enters `$8C:D0D0`, whose first instruction clears `$7E:3BC1`, then falls through to the
same shared path.

The shared cast path evaluates caster, spell, and level, allocates a spell slot, then
reads zero-terminated target expressions. It omits a target equal to the marker in
`$3BC1`. Thus AC excludes the Dog only when the HP test found the Dog dead. Slot
allocation and remaining cast setup reuse opcode 9E's reconstruction.

## Model

[`reconstructed-c/8C/8CD0C3_opcode_ac_cast.c`](../../../reconstructed-c/8C/8CD0C3_opcode_ac_cast.c)
selects the target marker; [`reconstructed-c/8C/8CD0D0_opcode_9e_cast_all.c`](../../../reconstructed-c/8C/8CD0D0_opcode_9e_cast_all.c)
models the shared cast path through `script_cast_all_with_target_marker`.

## Evidence

- `$8C:D0C3` loads X=`$4F37`, tests entity `+$2A`, and branches to `$8C:D0D0` when
  nonzero.
- For zero HP, `$8C:D0CB` stores X to `$3BC1`; `$8C:D0CE` branches to `$8C:D0D3`.
- `$8C:D0D0` clears `$3BC1` before entering the common code at `$8C:D0D3`.
- The shared target loop compares each evaluated target with `$3BC1` before storing it.