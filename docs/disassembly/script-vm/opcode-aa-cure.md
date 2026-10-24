# Script Opcode 0xAA: Cure Boy and Dog

**Handler entry:** `$8C:E7EF`\
**Status helper:** `$91:B9A7`\
**Opcode table entry:** `$8C:EA11`\
**Operands:** none\
**Confidence:** handler branch, call targets, entity values, and carry setup confirmed

## Control Flow

The handler reads `$7E:23C7`. If it is nonzero, it branches directly to `$8C:E806` and
returns without calling the status helper. The handler does not clear this flag on that
path, and `LDA`/`BNE` leave carry unchanged, so the returned carry is the incoming carry.

If the flag is zero, the handler sets carry and calls `$91:B9A7` with Y=`$4E89`, then
sets carry and calls it again with Y=`$4F37`. It sets carry once more before returning.
The helper's internal status-slot processing is left opaque here.

The flag's purpose is not inferred. This flow disagrees with the generated opcode summary
that describes a set flag being cleared before both helper calls; the handler assembly
shows no such clear or calls on the nonzero path.

## Model

[`reconstructed-c/8C/8CE7EF_opcode_aa_cure.c`](../../../reconstructed-c/8C/8CE7EF_opcode_aa_cure.c)
models the carry outcomes and call sequence while leaving `$91:B9A7`'s internal work to
an opaque helper.

## Evidence

- `$8C:E7EF` loads `$23C7`; `$8C:E7F2` branches to `$8C:E806` when nonzero.
- `$8C:E7F4` sets Y=`$4E89`; `$8C:E7F7` sets carry before the first call.
- `$8C:E7FC` sets Y=`$4F37`; `$8C:E7FF` sets carry before the second call.
- `$8C:E804` sets carry before `$8C:E805` returns.