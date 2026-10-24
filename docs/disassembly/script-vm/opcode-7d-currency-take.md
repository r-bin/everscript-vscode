# Script Opcode 0x7D: Take Currency

**Handler:** `$8C:D501`\
**Operands:** currency offset expression, inline `u16`, inline `u8`\
**Reachability:** 24 statically reachable instructions\
**Confidence:** confirmed

The handler evaluates the offset, fetches a 24-bit immediate amount as a little-endian word followed by a byte, then subtracts it from the three-byte balance at WRAM `$0AC6 + offset`. Borrow propagates from the low word into the high byte. There is no underflow check; the balance wraps modulo $2^{24}$. The handler explicitly returns carry set after restoring 16-bit accumulator width, regardless of whether the arithmetic borrowed.

The host-side model is [8CD501_opcode_7d_currency_take.c](../../../reconstructed-c/8C/8CD501_opcode_7d_currency_take.c).

## Evidence

- Opcode table entry `$8C:E9B7` dispatches to `$8C:D501`.
- `$8C:D501` evaluates the offset and places it in X, fetches and advances over a word and a byte, subtracts the word from `$7E:0AC6,X`, then subtracts the byte with borrow from `$7E:0AC8,X`.
- The handler restores 16-bit accumulator width and executes `SEC; RTS`.