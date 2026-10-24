# Script Opcode 0x9A: Select the Font

**Handler:** `$8C:E6CF`–`$8C:E6E5`\
**Opcode table entry:** `$8C:E9F1`\
**Operand:** one expression\
**Confidence:** table lookup, helper call, and return carry confirmed

## Control Flow

The handler evaluates the expression and uses its value directly as the byte offset for
the indexed word read at `$8C:E6E6`. It transfers that selected word to X, saves the
current data bank, switches DB to `$80`, and calls `$8C:9DAF`. It restores the prior DB,
sets carry, and returns, continuing the current script turn.

The table contains two words, `$0000` and `$0C82`. The handler does not bounds-check the
expression; other offsets read adjacent ROM data. The helper is modeled as an opaque font
header loader.

## Reconstruction

The host-side handler model is in
[`reconstructed-c/8C/8CE6CF_opcode_9a_font.c`](../../../reconstructed-c/8C/8CE6CF_opcode_9a_font.c).

## Evidence and Boundaries

- The opcode table entry at `$8C:E9F1` selects `$8C:E6CF`.
- `$8C:E6CF` evaluates one expression; `$8C:E6D3` transfers it to X; `$8C:E6D4` reads
  `$8CE6E6 + X`; `$8C:E6D8` transfers the selected word to X.
- `$8C:E6D9`–`$8C:E6DE` saves DB and sets it to `$80`; `$8C:E6DF` calls `$8C:9DAF`.
- `$8C:E6E3` restores DB; `$8C:E6E4` sets carry before returning.
- `$8C:E6E6` contains `$0000`; `$8C:E6E8` contains `$0C82`.