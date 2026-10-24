# Script Opcode 0xA1: Close the Currency Window

**Handler entry:** `$8C:E65F`\
**Opcode table entry:** `$8C:E9FF`\
**Operands:** none\
**Confidence:** helper argument, state clear, and carry return confirmed

## Control Flow

The handler calls `$8C:ADE5` with Y=`$0435` to clear the script text window, clears
`$7E:0CB3`, sets carry, and returns to continue the current script turn.

## Reconstruction

The host-side model is in
[`reconstructed-c/8C/8CE65F_opcode_a1_currency_window_close.c`](../../../reconstructed-c/8C/8CE65F_opcode_a1_currency_window_close.c).

## Evidence

- `$8C:E662` loads Y=`$0435`; `$8C:E665` calls `$8C:ADE5`.
- `$8C:E669` clears `$0CB3`.
- `$8C:E66D` sets carry before `$8C:E66E` returns.