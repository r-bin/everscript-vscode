---
addr: $7E:08F2
name: ROOM_PIXEL_WIDTH
type: u16
tags: [widescreen, widescreen.room_bounds]
confidence: verified
evidence: ["cdl", "disasm"]
---
Active room map width in screen pixels (ROOM_METATILE_WIDTH * 16; $90:8E45).

## Widescreen notes

Set by `room_header_reader_to` ($90:8F80) as width * 16; the same value goes to the camera right bound `$7E:23ED`. 13 of 127 vanilla rooms are narrower than a 342 px (16:9) view, 27 narrower than 448 px (21:9) (room headers read 2026-11-09).
