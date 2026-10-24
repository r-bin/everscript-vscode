# Script Opcode 0x7C: Add Currency

**Handler:** `$8C:D557`\
**Operands:** currency offset expression, inline `u16`, inline `u8`\
**Reachability:** 18 statically reachable instructions\
**Confidence:** confirmed

The handler evaluates the offset, fetches a 24-bit immediate addend as a little-endian word followed by a byte, then adds it to the three-byte amount at WRAM `$0AC6 + offset`. The low word is added first and carry propagates into the high byte. The result wraps modulo $2^{24}$; there is no overflow check. The handler returns carry set.

The host-side model is [8CD557_opcode_7c_currency_add.c](../../../reconstructed-c/8C/8CD557_opcode_7c_currency_add.c).

## Evidence

- Opcode table entry `$8C:E9B5` dispatches to `$8C:D557`.
- `$8C:D557` evaluates the offset and places it in X, fetches and advances over a word and a byte, then adds the word to `$7E:0AC6,X` and the byte plus carry to `$7E:0AC8,X`.
- The handler restores 16-bit accumulator width and returns with carry set.