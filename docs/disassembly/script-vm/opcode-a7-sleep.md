# Script Opcode 0xA7: Sleep for a Byte Duration

**Handler entry:** `$8C:D217`\
**Shared scheduler:** `$8C:D220`\
**Opcode table entry:** `$8C:EA0B`\
**Operand:** one-byte frame duration\
**Confidence:** operand consumption, zero behavior, wake-tick calculation, thread state, and carry outcome confirmed

## Control Flow

The handler reads one byte through DP `$82`, advances the script pointer, masks the value
to `$00FF`, and branches to the shared sleep scheduler. A zero duration continues the
current script turn immediately. A nonzero duration sets thread state `$0004`, stores
the 32-bit wake tick as current frame count plus duration minus one at slot offsets
`+$05` and `+$07`, and returns carry clear to yield the turn.

The host-side model reuses the duration scheduling logic in
[`reconstructed-c/8C/8CD220_sleep_wait.c`](../../../reconstructed-c/8C/8CD220_sleep_wait.c).

## Evidence

- `$8C:D217` reads through DP `$82`; `$8C:D219` advances it; `$8C:D21B` masks the byte.
- `$8C:D21E` branches to `$8C:D224`, which joins the shared scheduler at `$8C:D220`.
- In `$8C:D220`, zero returns carry set; nonzero duration is decremented and added to
  `$7E:0B19/$7E:0B1B`, stored at slot `+$05/+$07`, and marks slot `+$03` as sleep state 4.
- `$8C:D240` clears carry before returning on the yielding path.