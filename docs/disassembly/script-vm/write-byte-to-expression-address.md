# Write a Byte to an Expression-Selected Address

**Routine:** `$8C:E09D`–`$8C:E0AF`\
**Confidence:** instruction-level behavior confirmed; caller and opcode association unresolved

## Behavior

The routine evaluates one expression and saves its 16-bit result on the stack, then evaluates a second expression and restores the first result into `X`. It switches the accumulator to 8-bit mode, executes `STA $0000,X`, restores 16-bit accumulator mode, sets carry, and returns at `$8C:E0AF`.

The store writes the low byte of the second expression to the indexed address in the current data bank. The available evidence does not establish a caller or opcode-table entry for `$8C:E09D`, or identify the data-bank value and destination range.

## Reconstruction

Source: [`reconstructed-c/8C/8CE09D_write_byte_to_expression_address.c`](../../../reconstructed-c/8C/8CE09D_write_byte_to_expression_address.c)

The C model represents the byte-width store with an explicit data-bank helper and the carry-set return as `true`; it does not infer a higher-level command.

## Vanilla Evidence

- `$8C:E09D`–`$8C:E0AF`: two calls to `$8C:EA43`, `PHA`/`PLX`, `SEP #$20`, `STA $0000,X`, `REP #$20`, `SEC`, `RTS`.
- `$8C:E0B0` begins beyond the confirmed routine boundary.