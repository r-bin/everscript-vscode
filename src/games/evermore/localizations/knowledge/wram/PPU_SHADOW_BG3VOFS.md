---
addr: $7E:0118
name: PPU_SHADOW_BG3VOFS
type: u16
tags: [hud, hud.layout, widescreen, widescreen.hud]
confidence: verified
evidence: ["cdl", "disasm"]
---
BG3 vertical scroll offset shadow; written to $2112 (twice).

`$FFFF` in the field, ring menus and dialogue (measured 2026-11-10): BG3 row *r* starts on screen
line `8r + 1`, which puts the HUD's rows 24..27 on lines 193..223 (`docs/disassembly/ui/field-hud.md`).
