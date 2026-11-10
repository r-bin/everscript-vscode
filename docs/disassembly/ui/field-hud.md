# Field HUD: what draws it, what it occupies, what removing it would free

The HUD of field play: one box per character at the bottom of the screen (HP as `cur/max` on
the box's top edge, the weapon charge gauge inside), and each character's portrait beside its box.
Tag `hud` (`soe://tags/hud/`) links every address below.

Measured 2026-11-10 in the recomp (US ROM) from the player's save, room `0x51`, in five states:
plain field, the three ring menus and the status ring, and a dialogue with a choice box. Dumps of
VRAM, CGRAM, OAM, WRAM and the PPU registers, and pictures with single layers switched off
(`SNESRECOMP_LAYER_MASK`). The adaptive-HUD mod of the recomp is built on these facts
(SecretOfEvermoreRecomp `docs/mods/hud.md`).

## What draws it

| Part | Layer | Where | Palette | Notes |
|---|---|---|---|---|
| Boxes, HP digits, gauge | BG3 (2bpp) | map at VRAM word `$0800` (BG3SC `$08`), rows 24..27; Boy columns 3..12, Dog 19..28 | BG3 palette 2 = CGRAM 8..11 | priority bit set; BGMODE `$39` puts BG3 priority tiles over everything, sprites included |
| Portraits | OBJ, 16×16 | Boy tile `$080` at (8, 201), Dog `$082` at (232, 201); OAM priority 3 | OBJ palette 6 (Boy), 7 (Dog) | always two adjacent OAM slots; which ones moves (0/1 in the field, 9/10 or 11/12 under a ring menu) |

- **Screen lines.** BG3's vertical scroll is `$3FF` in every state (shadow `$0118` = `$FFFF`),
  so row *r* starts on line `8r + 1`: the HUD band is lines 193..223, its visible content 201..218.
- **Glyphs.** BG3 characters start at VRAM word `$0000`; the HUD uses the last 32 tiles,
  `$3E0..$3FF` (words `$1F00..$1FFF`). `$3E9` is the box's edge line, `$3EA` its corner (row 27
  uses it V-flipped), `$3EB` its side, `$3FF` is empty (all pixels 0). The digits carry the edge
  line in their bottom rows, so `30/30` sits on the box's top edge: `$3EC` 0, `$3EF` 3, `$3F2` 6,
  `$3F8` /. Tiles `$3E0..$3E3` (Boy) and `$3E4..$3E7` (Dog) are the gauge: their pixels are
  written into VRAM at the widget's `+$06` (`$1F00`, `$1F20`), and the widget's `+$08` holds the
  eight tilemap words that show them (`$3E3..$3E0` H-flipped, then `$3E0..$3E3`, palette 3).
- **Per frame.** Every NMI sets the VRAM address to `$0B44` and `$0B54`: row 26, columns 4 and 20,
  the eight interior words of each box. Nothing else of the HUD is written while it is unchanged.
- **Not mirrored in `$7F:C800`.** The window shadow holds `$23FF` (empty) at rows 25..27 while VRAM
  shows the boxes: the HUD is written to VRAM from the widgets, the shadow only carries windows.
- **BG3 rows 28..31** (VRAM words `$0B80..$0BFF`) hold no map in the field (other data). At the
  field's scroll the last line of row 31 is screen line 0.

### Widgets (`$051D` Boy, `$0561` Dog, 68 bytes each), as measured

| Offset | Boy | Dog | Meaning |
|---|---|---|---|
| `+$00` | `$0003` | `$0013` | widget type |
| `+$02` | `$0019` | `$0019` | unknown (the old reading "screen column" does not fit: both boxes are at different columns) |
| `+$04` | `$3A3E` | `$3A7E` | the character's popup node (`damage_popup_boy_node` / `damage_popup_dog_node`) |
| `+$06` | `$1F00` | `$1F20` | VRAM word address of the character's four gauge glyphs |
| `+$08` | 8 words | 8 words | the gauge strip's tilemap words |
| `+$28` | 7 words | 7 words | the HP string's tilemap words, edge line around the digits (`$2BE9 $2BEF $2BEC $2BF8 $2BEF $2BEC $2BE9` = `30/30`) |

### Routines

| Address | Entry | Role |
|---|---|---|
| `$8E:E08B` | `field_screen_ppu_layers_and_hud_vram_init` | field PPU set-up (BGMODE `$39`, maps, BG12NBA `$22`) |
| `$8F:8710` | `field_hud_weapon_stamina_gauge_vram_dma_upload` | fills the widgets (type, `$1F00`/`$1F20`), uploads HUD graphics |
| `$8F:87FE` | `field_hud_meters_refresh_and_reactivate` | redraws the HUD when a ring menu, the pause menu or a script screen closes; sets `$0B29` bit 1 |
| `$8F:8AE4` | `hud_stamina_meter_recharge_step` | charge percentage into the gauge words (`$2BE9`, `$2BF6`, `$2BF7`, `$2BFF`: palette 2 glyphs); flash timers `$0B4D`/`$0B4F` |
| `$8F:9144` | `hud_render_entity_hp_string` | `cur/max` into the widget (`format_16bit_integer_to_decimal_digits`, `$80:870C`) |
| `$8F:810E` | `hud_portraits_init` | portrait records: `$4EF7` = `$CC37AC` (Boy), `$4EFA` = `$CC3C8E` (Dog) |
| `$90:8CEE`, `$90:8D2D` | `hud_render_boy_hp_gauge_sprite`, `hud_render_dog_hp_gauge_sprite` | sprites of the HUD; their entries give positions (224, 16) and (96, 162) that match none of the measured sprites: unchecked |

## Who else uses what the HUD uses

| Resource | Other users seen | Not checked |
|---|---|---|
| BG3 palette 2 (CGRAM 8..11) | none: windows (dialogue, choice box, ring-menu title) use BG3 palettes 0 and 1 | full-screen pages (status, alchemy, save), shops, Mode 7, boss fights |
| BG 4bpp palette 0 (CGRAM 0..15, overlaps BG3 palettes 0..3) | BG1/BG2 entries with palette 0 in room `0x51` are all the empty tile 0; rooms never load palette 0 ([map_palette_extraction.md](../../map-format/map_palette_extraction.md)) | rooms other than `0x51` (the doc's rule covers them) |
| BG3 glyphs `$3E0..$3FF` | none of `$3E0..$3FE` in the four window states | the same pages as above |
| BG3 map rows 24..27 | none (windows use rows 0..23) | shop lists, long dialogue |
| OBJ palettes 6, 7 | the Boy's and the Dog's own sprites (the Boy's body is palette 6 too) | — |
| OBJ tiles `$080..$083`, `$090..$093` | the portraits only; the Boy's body was at `$088..$08B`, `$098..$09B` | — |

## What removing the HUD would free (a ROM hack that stops drawing it)

| What | Size | Free? |
|---|---|---|
| CGRAM 9..11 (BG3 palette 2; 8 is transparent) | 3 colours | yes in every state measured; check the pages above before relying on it |
| BG3 glyphs `$3E0..$3FF` | 32 tiles, 512 bytes of VRAM | yes in every state measured |
| BG3 map rows 24..27 | 128 words | yes (no window uses them) |
| Screen lines 193..223 | 31 lines | the picture's bottom becomes room |
| OAM slots and OBJ tiles of the portraits | 2 slots, 8 tiles (256 bytes) | yes; the portraits' palettes are not freed (6 and 7 stay the characters') |
| WRAM widgets `$051D..$05A4` | 136 bytes | only together with the code that fills them |
| NMI time | 16 VRAM words a frame, plus HP formatting on a change | yes |

So the answer to "does it free a palette": **part of one**. Three colours of BG3 palette 2, a
2bpp palette nothing else was seen to use; no sprite palette, since the portraits share theirs
with the characters.

## Open

- The charge gauge filling was not seen: the test save has no weapon. Which glyph pixels change
  while charging, and when `+$08` is shown instead of the empty interior.
- `$0B29` was `3` in all five states; when bit 2 ("hidden") is set was not seen.
- The positions in the two `$90:8C..8D` entries above.
- The full-screen pages, Mode 7 and boss fights for palette 2 and the glyphs.
