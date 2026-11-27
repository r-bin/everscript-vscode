---
addr: $7E:1274
name: CURRENT_MUSIC_TRACK
type: u16
tags: []
confidence: verified
evidence: ["cdl", "disasm", "cdl library 2026-11-27: also reached as the last cell of VRAM_SINGLE_TILE_ADDR_QUEUE by $C0:844B ldx $11F4,y (Y up to $80)"]
---
Active background music track index; initialized to $FFFF at reset.

Also read as the 64th cell of `VRAM_SINGLE_TILE_ADDR_QUEUE` (`$C0:844B`, see there): which name is right is open.
