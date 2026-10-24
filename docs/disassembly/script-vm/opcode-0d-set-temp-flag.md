# Script Opcode 0x0D: Set or Clear a Temporary Flag

**Routine:** `$8C:D82E`\
**Range:** `$8C:D82E`–`$8C:D87B`\
**Confidence:** confirmed operand flow and bit update

## Behavior

The handler reads a 16-bit bit index from the script stream and evaluates one expression. The target byte is `$7E:2834 + (bit_index >> 3)`, and the selected bit is `bit_index & 7`. A nonzero expression sets the bit; zero clears it. Both paths return carry set for same-turn continuation.

The address-and-mask preparation is specific to opcode `0x0D`; the set/clear tail beginning at `$8C:D84C` is shared with opcodes `0x0C` and `0x0E`. This opcode targets the room scratch area rather than the save flags or thread argument bytes.

The host-side model is [8CD82E_opcode_0d_set_temp_flag.c](../../../reconstructed-c/8C/8CD82E_opcode_0d_set_temp_flag.c). It delegates script-stream reads, expression evaluation, and WRAM access to VM interfaces.

## Evidence

- Vanilla VFS at `$8C:D82E` reads a word through `[$82]`, increments the script pointer twice, shifts the bit index right three places, and adds `$2834` to form the target byte address.
- `$8C:D84C` onward is the shared set/clear tail: it evaluates the expression, selects the set or clear mask from `$80:A87F` / `$80:A887`, updates the target byte, and returns through `$8C:D87B` with carry set.
- Opcode VFS entry `0x0D` identifies operands `u16 E` and handler `$8C:D82E`.