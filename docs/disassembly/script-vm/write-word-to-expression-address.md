# Write a Word to an Expression-Selected Address

**Routine:** `$8C:E08E`–`$8C:E09C`\
**Confidence:** instruction-level behavior confirmed; caller and opcode association unresolved

## Behavior

The routine evaluates one expression and saves its 16-bit result on the stack. It evaluates a second expression, restores the first result into `X`, and executes `STA $0000,X`. This stores the second result as a word at the indexed address in the current data bank. It then sets carry and returns at `$8C:E09C`.

The routine immediately follows the separate handler ending at `$8C:E08D`. The available evidence does not establish a caller or opcode-table entry for `$8C:E08E`; in particular, opcode `0x98` maps to `$8C:E5A1`, not this routine. The data bank and destination address range depend on caller state and are not further identified here.

## Reconstruction

Source: [`reconstructed-c/8C/8CE08E_write_word_to_expression_address.c`](../../../reconstructed-c/8C/8CE08E_write_word_to_expression_address.c)

The C model keeps the store data-bank-relative through an explicit host helper and represents the routine's carry-set return as `true`. It does not assign a higher-level opcode or caller.

## Vanilla Evidence

- `$8C:E08E`–`$8C:E09C`: two calls to `$8C:EA43`, `PHA`/`PLX`, `STA $0000,X`, `SEC`, `RTS`.
- `$8C:E09D` begins a separate byte-store routine and is not included in this reconstruction.