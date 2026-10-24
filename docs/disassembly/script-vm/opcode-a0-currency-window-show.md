# Script Opcode 0xA0: Show Currency in the Window

**Handler entry:** `$8C:E628`\
**Opcode table entry:** `$8C:E9FD`\
**Operands:** none\
**Confidence:** selected-index reads, formatter parameters, window record, and carry return confirmed

## Control Flow

The handler refreshes window record `$7E:0435` through `$8C:AF2B`. It takes the low
byte of `$7E:2348` as an index, reads bytes from `$7E:0AC6 + index` and
`$7E:0AC8 + index`, and passes those bytes to `$80:B21F` with destination `$7E:2FF4`.
It then expands variable tokens in window `$0435` through `$8C:9E03`, sets carry, and
returns to continue the current script turn.

The formatter and token expander are kept opaque; the model records only the parameter
flow visible at the handler.

## Reconstruction

The model is in
[`reconstructed-c/8C/8CE628_opcode_a0_currency_window_show.c`](../../../reconstructed-c/8C/8CE628_opcode_a0_currency_window_show.c).

## Evidence

- `$8C:E62B` loads Y=`$0435` and calls `$8C:AF2B`.
- `$8C:E632` loads `$7E:2348`, masks to `$00FF`, and uses the result as X.
- `$8C:E63A` and `$8C:E63F` read `$0AC6,X` and `$0AC8,X`, masking each to one byte.
- `$8C:E647`–`$8C:E651` set the formatter destination to `$7E:2FF4` and call `$80:B21F`.
- `$8C:E655` loads Y=`$0435`; `$8C:E658` calls `$8C:9E03`.
- `$8C:E65D` sets carry before `$8C:E65E` returns.