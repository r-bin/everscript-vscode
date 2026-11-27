---
addr: $7E:11F4
name: VRAM_SINGLE_TILE_ADDR_QUEUE
type: u16[64]
tags: [graphics]
confidence: verified
evidence: ["cdl", "disasm", "cdl library 2026-11-27 (wram-census.mts): $C0:844B ldx $11F4,y runs with Y = 2..$80, touching $11F6-$1275"]
---
Destination VRAM word addresses written to $2116 corresponding to tile data queue.

The reader `$C0:844B` (`ldx $11F4,y`) counts Y from 2 to `$80`: the cells in use are `$11F6`-`$1275`, so `$11F4` is never
read and the 64th cell is the word the WRAM map calls `CURRENT_MUSIC_TRACK` (`$1274`). Which of the two the word really is,
or whether a full queue overruns into the music id, is open. Open Evermore moves the queue and that word as one group.
