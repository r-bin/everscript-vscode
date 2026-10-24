# Script Opcode 0x9F: Open the Currency Window

**Handler entry:** `$8C:E5B0`\
**Opcode table entry:** `$8C:E9FB`\
**Operands:** none\
**Confidence:** record constants, helper arguments, counter increment, palette store, and carry return confirmed

## Control Flow

The handler initializes fixed fields in the window record beginning at `$7E:0435`,
then calls `$8C:AC8A` with Y set to `$0435`. It increments `$7E:0CB3`, loads the
currency-window graphics using X=`$56E6` and Y=`$0DEB` at `$90:817B`, then requests
palette resource `$AACB` from `$90:CE92` and stores the returned value at `$7E:0DF7`.
It sets carry before returning, continuing the script turn.

The resource loader and palette manager are kept opaque in the host-side model.

## Reconstruction

The model is in
[`reconstructed-c/8C/8CE5B0_opcode_9f_currency_window_open.c`](../../../reconstructed-c/8C/8CE5B0_opcode_9f_currency_window_open.c).

## Evidence

- `$8C:E5B6`–`$8C:E604` write the fixed record values, including style `$1924` at
  `$045B` and `$0001` at `$043B`.
- `$8C:E607` sets Y=`$0435` and calls `$8C:AC8A`.
- `$8C:E60E` increments `$0CB3`.
- `$8C:E612` sets Y=`$0DEB`, X=`$56E6`, and calls `$90:817B`.
- `$8C:E61C` passes `$AACB` to `$90:CE92`; `$8C:E623` stores its result at `$0DF7`.
- `$8C:E626` sets carry before `$8C:E627` returns.