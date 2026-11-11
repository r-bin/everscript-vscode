---
addr: $7E:0561
name: HUD_DOG_STATUS_WIDGET
type: HudStatusWidget
tags: [dog, graphics, hud, hud.widgets, widescreen, widescreen.hud]
confidence: verified
evidence: ["trace: widget words dumped in the recomp, 2026-11-10 (docs/disassembly/ui/field-hud.md)", "cdl", "disasm: func_CF8710 initializes widget type $13, X position $19, VRAM dest $1F20, and digit tiles $0589..$0595", "disasm: func_CF9144 updates Dog HP bar and converts current HP to decimal digits"]
---
68-byte struct (`$7E:0561`..`$7E:05A4`) defining the on-screen status bar widget for the Dog companion:

| Offset | Size | Name | Description |
|---|---|---|---|
| +$00 | 2 | WIDGET_TYPE | Widget type identifier ($0013) |
| +$02 | 2 | UNKNOWN_02 | `$0019` for both characters, so not a screen column as first read |
| +$04 | 2 | POPUP_NODE | The character's popup node ($3A7E, `damage_popup_dog_node`) |
| +$06 | 2 | GLYPH_VRAM | VRAM word address of the character's four gauge glyphs ($1F20; BG3 tiles $3E4..$3E7) |
| +$08 | 16 | GAUGE_WORDS | The gauge strip's eight BG3 tilemap words (the four glyphs H-flipped, then as is; palette 3) |
| +$18 | 16 | UNKNOWN_18 | zero in the field |
| +$28 | 14 | HP_WORDS | The HP string's seven BG3 tilemap words: edge line, digits, `/`, digits, edge line (palette 2) |
| +$36 | 14 | RESERVED | zero in the field |

Measured 2026-11-10 in the recomp (room `0x51`, field, ring menus, dialogue): the values above.
Where these words end up on screen: `docs/disassembly/ui/field-hud.md`.

## Notes

Previously believed: `+$02` screen column, `+$04` screen row, `+$06` the VRAM *tilemap*
address, `+$08` 32 bytes of meter tiles and `+$28` ASCII digits. `+$06` is a character (glyph)
address: BG3 characters start at word `$0000`, so `$1F20` is tile $3E4.
