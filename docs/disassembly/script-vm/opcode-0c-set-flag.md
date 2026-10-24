# Script Opcode 0x0C: Set or Clear a Save Flag

**Routine:** `$8C:D83E`\
**Range:** `$8C:D83E`–`$8C:D87B`\
**Confidence:** confirmed operand flow and bit update

## Behavior

The handler reads a 16-bit bit index from the script stream and evaluates one expression. The target byte is `$7E:2258 + (bit_index >> 3)`, and the selected bit is `bit_index & 7`. A nonzero expression sets the bit; zero clears it. Both paths return carry set for same-turn continuation.

The address-and-mask preparation is specific to opcode `0x0C`; the set/clear tail beginning at `$8C:D84C` is shared with opcode `0x0E`. Opcode `0x0E` instead derives its destination from the active thread slot's argument area at `+$0F`.

The host-side model is [8CD83E_opcode_0c_set_flag.c](../../../reconstructed-c/8C/8CD83E_opcode_0c_set_flag.c). It delegates script-stream reads, expression evaluation, and WRAM access to VM interfaces.

## Evidence

- Vanilla VFS at `$8C:D83E` reads a word through `[$82]`, increments the script pointer twice, shifts the bit index right three places, and adds `$2258` to form the target byte address.
- `$8C:D84D` masks the original bit index with `7`; the shared tail evaluates the expression, selects the set or clear mask from `$80:A87F` / `$80:A887`, updates the target byte, and returns through `$8C:D87B` with carry set.
- Opcode VFS entry `0x0C` identifies operands `u16 E` and handler `$8C:D83E`.