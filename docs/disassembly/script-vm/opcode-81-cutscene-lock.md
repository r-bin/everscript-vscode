# Script Opcode 0x81: Cutscene Lock

**Handler:** `$8C:E209`–`$8C:E20E`\
**Opcode table entry:** `$8C:E9BF`\
**Operands:** none\
**Confidence:** wrapper control flow confirmed; callee internals outside this reconstruction

## Control Flow

The handler calls `$8C:C543`, then sets carry and returns:

| Address | Operation |
|---|---|
| `$8C:E209` | `JSL $8C:C543` |
| `$8C:E20D` | `SEC` |
| `$8C:E20E` | `RTS` |

The wrapper therefore continues executing the current script turn after the callee
returns. The handler's disassembly labels the callee as enabling the cutscene pause guard
and locking player engine inputs; this C reconstruction does not model those internals.

## Reconstruction

The wrapper model is in
[`reconstructed-c/8C/8CE209_opcode_81_cutscene_lock.c`](../../../reconstructed-c/8C/8CE209_opcode_81_cutscene_lock.c).

## Evidence and Boundaries

- The opcode table at `$8C:E9BF` points to `$8C:E209`.
- The handler ends at `$8C:E20E`; `$8C:E20D` sets carry before the return.
- `$8C:C543` is treated as an opaque callee here. Its implementation boundary is not
  included in the `$8C:E209` handler reconstruction.