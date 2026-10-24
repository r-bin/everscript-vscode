# Script Opcode 0xA8: Sleep for a Word Duration

**Handler entry:** `$8C:D20F`\
**Shared scheduler:** `$8C:D220`\
**Opcode table entry:** `$8C:EA0D`\
**Operand:** one little-endian 16-bit frame duration\
**Confidence:** operand consumption, wake-tick calculation, thread state, and carry outcome confirmed

## Control Flow

The handler reads a little-endian word through DP `$82`, advances the script pointer by
two bytes, and joins the shared sleep scheduler at `$8C:D224`. A zero duration continues
the current script turn immediately. A nonzero duration sets thread state `$0004`, stores
the 32-bit wake tick as current frame count plus duration minus one at slot offsets
`+$05` and `+$07`, and returns carry clear to yield the turn.

The host-side model reuses the shared duration scheduling logic in
[`reconstructed-c/8C/8CD220_sleep_wait.c`](../../../reconstructed-c/8C/8CD220_sleep_wait.c).

## Evidence

- `$8C:D20F` reads through DP `$82`; `$8C:D211` and `$8C:D213` advance it by two bytes.
- `$8C:D215` branches to `$8C:D224`, the shared scheduler entry.
- The scheduler returns carry set for zero; nonzero duration is decremented and added to
  `$7E:0B19/$7E:0B1B`, stored at slot `+$05/+$07`, and marks slot `+$03` as sleep state 4.
- `$8C:D240` clears carry before returning on the yielding path.