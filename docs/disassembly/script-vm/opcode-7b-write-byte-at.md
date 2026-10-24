# Script Opcode 0x7B: Write Byte at Address

**Handler:** `$8C:E09D`\
**Operands:** address expression, value expression\
**Reachability:** 0 statically reachable instructions\
**Confidence:** confirmed handler behavior; unused by original scripts

The handler evaluates the destination and value expressions, narrows the value to A's low byte, and stores that byte at the destination through the current data bank (the script VM's WRAM bank, `$7E`). It returns carry set. No range check is performed.

The host-side model is the existing [8CE09D_write_byte_to_expression_address.c](../../../reconstructed-c/8C/8CE09D_write_byte_to_expression_address.c). It parallels the word-write handler at `$8C:E08E` but intentionally writes only one byte.

## Evidence

- Opcode table entry `$8C:E9B3` dispatches to `$8C:E09D`.
- `$8C:E09D` evaluates and pushes the destination, evaluates the value, narrows A with `SEP #$20`, stores with `STA $0000,X`, restores 16-bit accumulator width, then returns with carry set.
- The VFS opcode record reports zero static reachability.