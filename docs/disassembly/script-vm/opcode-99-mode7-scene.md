# Script Opcode 0x99: Run a Mode 7 Scene

**Handler:** `$8C:E66F`–`$8C:E6CE`\
**Opcode table entry:** `$8C:E9EF`\
**Operands:** six expressions\
**Confidence:** operand stores, helper order, and return carry confirmed

## Operand Setup

The handler evaluates six expressions in order:

1. The first 16-bit result is stored at `$7E:0E70`.
2. The next four results are truncated to bytes and stored at `$7E:0E74` through
   `$7E:0E77`, respectively.
3. The sixth result is byte-swapped by `XBA` and stored as a 16-bit word at `$7E:0E78`.
   Thus the store writes both `$0E78` and `$0E79`.

## Engine and Return Flow

The handler saves the prior data bank and switches DB to `$80`, then calls, in order:

1. `$80:BC00`
2. `$80:85D8`
3. `$8E:E08B`
4. `$80:858C`
5. `$8C:AB10`
6. `$8F:87FE`
7. `$80:8E9A`

It restores the prior data bank, sets carry, and returns, continuing the current script
turn. The scene renderer and field helpers are not reconstructed by this opcode-level
model.

## Reconstruction

The host-side wrapper model is in
[`reconstructed-c/8C/8CE66F_opcode_99_mode7_scene.c`](../../../reconstructed-c/8C/8CE66F_opcode_99_mode7_scene.c).
The engine and field helpers remain opaque calls.

## Evidence and Boundaries

- The opcode table entry at `$8C:E9EF` selects `$8C:E66F`.
- The first result is stored at `$0E70` at `$8C:E673`.
- `SEP #$20` / `STA` / `REP #$20` sequences at `$8C:E67A`–`$8C:E6A0` write the next four
  low bytes at `$0E74`–`$0E77`.
- `$8C:E6A6` executes `XBA`; `$8C:E6A7` stores the resulting 16-bit A at `$0E78`.
- `$8C:E6B0`–`$8C:E6C8` make the listed calls; `$8C:E6CD` sets carry before return.