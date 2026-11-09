---
addr: $7E:0FAC
name: ROOM_PALETTE_GROUP_ID
type: u16
tags: [widescreen, widescreen.streaming]
confidence: likely
evidence: ["cdl", "disasm"]
---
Active room palette group index (initialized to $11 by reset_per_room_state).

## Widescreen notes

Not a palette group: the **width of the streamed tilemap window in metatiles**. `reset_per_room_state` sets 17 (`$11` = 256 px + one cell), the HDMA effect setups `$90:9BFF` / `$90:9C33` set 28 (`$1C`) / 32 (`$20`, the whole 32-cell VRAM ring). The streamer `$90:98FA` adds it to the left column (`$0F90`/`$0F98`) for the right edge and uses it as the row length; the full upload `$90:93AA` draws this many cells per row. For widescreen the columns past cell 17 of the ring are blank after a room load and stale afterwards, so margins need a renderer-side prefill from `$7F:0000` (framework rule P2); raising this value would also work but changes guest state (asm read 2026-11-09).
