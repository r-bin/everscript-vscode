# Script Opcode 0x88: Clear Shop State

**Handler:** `$8C:E2AA`–`$8C:E2B4`\
**Opcode table entry:** `$8C:E9CD`\
**Operands:** none\
**Confidence:** direct writes and control flow confirmed

## Control Flow

In 16-bit accumulator mode, the handler writes `$FFFF` to `$7E:0B95`, then clears the
word at `$7E:0E6C`. It sets carry and returns, so the script VM continues in the same turn.

The opcode and ROM knowledge records describe these fields as an empty shop-list sentinel
and a zero item-kind count, respectively.

## Reconstruction

The C model is in
[`reconstructed-c/8C/8CE2AA_opcode_88_clear_shop.c`](../../../reconstructed-c/8C/8CE2AA_opcode_88_clear_shop.c).

## Evidence and Boundaries

- The opcode table at `$8C:E9CD` points to `$8C:E2AA`.
- `$8C:E2AA` loads `$FFFF` and stores it at `$0B95`; `$8C:E2B0` clears `$0E6C`.
- `$8C:E2B3` sets carry and `$8C:E2B4` returns.