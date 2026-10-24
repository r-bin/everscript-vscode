# Script Opcode 0x80: Dialogue Next

**Handler:** `$8C:E203`–`$8C:E208`\
**Opcode table entry:** `$8C:E9BD`\
**Operands:** none\
**Confidence:** wrapper control flow confirmed; callee internals outside this reconstruction

## Control Flow

The handler calls `$8C:C55D`, then sets carry and returns:

| Address | Operation |
|---|---|
| `$8C:E203` | `JSL $8C:C55D` |
| `$8C:E207` | `SEC` |
| `$8C:E208` | `RTS` |

The wrapper therefore continues executing the current script turn after the callee
returns. The callee is identified in the vanilla disassembly as dequeuing a pending
dialogue request and constructing a 20-by-30 text window in VRAM; this C reconstruction
does not model those internals.

## Reconstruction

The wrapper model is in
[`reconstructed-c/8C/8CE203_opcode_80_dialogue_next.c`](../../../reconstructed-c/8C/8CE203_opcode_80_dialogue_next.c).

## Evidence and Boundaries

- The opcode table at `$8C:E9BD` points to `$8C:E203`.
- The handler ends at `$8C:E208`; `$8C:E207` sets carry before the return.
- `$8C:C55D` is treated as an opaque callee here. Its implementation boundary is not
  included in the `$8C:E203` handler reconstruction.