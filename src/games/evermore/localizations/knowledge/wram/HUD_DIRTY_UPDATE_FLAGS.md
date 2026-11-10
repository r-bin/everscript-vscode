---
addr: $7E:0B29
name: HUD_DIRTY_UPDATE_FLAGS
type: u16
tags: [hud, hud.widgets]
confidence: verified
evidence: ["cdl", "disasm"]
---
HUD refresh latch flags (bit 0 = tilemap redraw required, bit 2 = HUD hidden).

Measured 2026-11-10 in the recomp: `$0003` in the field, under every ring menu and during a
dialogue with a choice box, while the HUD stays on screen in all of them. The menus' common exit
(`$8F:87FE`) sets bit 1. When bit 2 is set was not seen (`docs/disassembly/ui/field-hud.md`).
