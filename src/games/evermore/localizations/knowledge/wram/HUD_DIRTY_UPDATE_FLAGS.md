---
addr: $7E:0B29
name: HUD_DIRTY_UPDATE_FLAGS
type: u16
tags: []
confidence: verified
evidence: ["cdl", "disasm"]
---
HUD refresh latch flags (bit 0 = tilemap redraw required, bit 2 = HUD hidden).
