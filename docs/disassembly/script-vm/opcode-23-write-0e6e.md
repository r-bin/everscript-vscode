# Script Opcode 0x23: Write $0E6E

**Handler:** `$8C:E405`–`$8C:E410`\
**Opcode table entry:** `$8C:E903`\
**Operand:** one word\
**Confidence:** direct control flow confirmed; field purpose unresolved

## Control Flow

The handler reads a word through `[$82]`, advances `$82` twice, stores the value at
`$7E:0E6E`, sets carry, and returns. Carry set means the script VM continues with the next
opcode in the same turn.

The opcode record reports that a byte search for absolute-address read forms found no
other code reading `$0E6E`. That supports describing this as an apparently unused write;
the original purpose of the field is unknown.

## Reconstruction

The control-flow model is in
[`reconstructed-c/8C/8CE405_opcode_23_write_0e6e.c`](../../../reconstructed-c/8C/8CE405_opcode_23_write_0e6e.c).

## Evidence and Boundaries

- The opcode table at `$8C:E903` points to `$8C:E405`.
- The handler reads a word from `[$82]`, increments `$82` twice, stores to `$0E6E`, then
  executes `SEC; RTS` at `$8C:E40E`–`$8C:E410`.
- `$8C:E411` is outside the displayed handler body; no following routine boundary is
  inferred here.