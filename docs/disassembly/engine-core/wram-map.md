# Secret of Evermore — Bank $7E Memory Map

```json
{
  "areas": {
    "dp":     { "range": ["0x0000", "0x01FF"], "behavior": "scratch" },
    "system": { "range": ["0x0200", "0x21FF"], "behavior": "system" },
    "sram":   { "range": ["0x2200", "0x27FF"], "behavior": "sram" },
    "temp":   { "range": ["0x2834", "0x28FB"], "behavior": "scratch" },
    "vm":     { "range": ["0x28FC", "0x4FFF"], "behavior": "room" }
  },
  "tag_tree": {
    "player": ["boy", "dog"],
    "progression": ["alchemy", "weapon", "armor", "item", "currency"],
    "combat": ["combat", "entity"],
    "world": ["map", "mode7", "weather"],
    "engine": ["graphics", "audio", "system", "script", "dialogue", "hud", "ppu"],
    "quality": ["untouched", "scratch_candidate", "direct-page", "unused"]
  }
}
```

## Memory Layout (Contiguous, 0x0000..0xFFFF)

| Address | Identifier | Type | Tag | Summary |
|---|---|---|---|---|
| `$7E:0000` | [`DIRECT_PAGE_BLOCK`](knowledge/wram/DIRECT_PAGE_BLOCK.md) | `DirectPageBlock` | system, direct-page | SNES Direct Page continuous register scratchpad ($7E:0000..$7E:00FF). |
| `$7E:0100` | [`PPU_FRAME_COUNTER_LOW`](knowledge/wram/PPU_FRAME_COUNTER_LOW.md) | `u16` | graphics | Low 16 bits of 32-bit hardware frame counter; incremented every VBlank interrupt by nmi_v_blank_handler ($80:8460). |
| `$7E:0102` | [`PPU_FRAME_COUNTER_HIGH`](knowledge/wram/PPU_FRAME_COUNTER_HIGH.md) | `u16` | graphics | High 16 bits of 32-bit hardware frame counter; incremented when low word overflows. |
| `$7E:0104` | [`JOYPAD1_HELD`](knowledge/wram/JOYPAD1_HELD.md) | `JoypadButtons` | system | Joypad 1 held buttons minus acknowledged ones: a bit cleared by TRB $0104 stays clear until the button is released (NMI $80:847A). |
| `$7E:0106` | [`JOYPAD1_TRIGGERED`](knowledge/wram/JOYPAD1_TRIGGERED.md) | `JoypadButtons` | script, system | Joypad 1 newly pressed button triggers this frame |
| `$7E:0108` | [`PPU_SHADOW_HTIMEL`](knowledge/wram/PPU_SHADOW_HTIMEL.md) | `u16` | graphics | Hardware H-timer IRQ horizontal dot position shadow; copied to $4207 in VBlank. |
| `$7E:010A` | [`PPU_SHADOW_VTIMEL`](knowledge/wram/PPU_SHADOW_VTIMEL.md) | `u16` | graphics | Hardware V-timer IRQ scanline position shadow; copied to $4209 in VBlank. |
| `$7E:010C` | [`PPU_SHADOW_BG34NBA`](knowledge/wram/PPU_SHADOW_BG34NBA.md) | `u16` | graphics, ppu | Hardware shadow register word for PPU $210C (BG3 & BG4 tile base address in VRAM; $80:B3B0, $8E:E08B). |
| `$7E:010E` | [`PPU_SHADOW_BG1HOFS`](knowledge/wram/PPU_SHADOW_BG1HOFS.md) | `u16` | graphics | BG1 horizontal scroll offset shadow; low byte written to $210D, high byte written to $210D. |
| `$7E:0110` | [`PPU_SHADOW_BG1VOFS`](knowledge/wram/PPU_SHADOW_BG1VOFS.md) | `u16` | graphics | BG1 vertical scroll offset shadow; low byte written to $210E, high byte written to $210E. |
| `$7E:0112` | [`PPU_SHADOW_BG2HOFS`](knowledge/wram/PPU_SHADOW_BG2HOFS.md) | `u16` | graphics | BG2 horizontal scroll offset shadow; low byte written to $210F, high byte written to $210F. |
| `$7E:0114` | [`PPU_SHADOW_BG2VOFS`](knowledge/wram/PPU_SHADOW_BG2VOFS.md) | `u16` | graphics | BG2 vertical scroll offset shadow; low byte written to $2110, high byte written to $2110. |
| `$7E:0116` | [`PPU_SHADOW_BG3HOFS`](knowledge/wram/PPU_SHADOW_BG3HOFS.md) | `u16` | graphics | BG3 horizontal scroll offset shadow; written to $2111 (twice). |
| `$7E:0118` | [`PPU_SHADOW_BG3VOFS`](knowledge/wram/PPU_SHADOW_BG3VOFS.md) | `u16` | graphics | BG3 vertical scroll offset shadow; written to $2112 (twice). |
| `$7E:011A` | [`PPU_SHADOW_BG4HOFS`](knowledge/wram/PPU_SHADOW_BG4HOFS.md) | `u16` | graphics | BG4 horizontal scroll offset shadow; written to $2113 (twice). |
| `$7E:011C` | [`PPU_SHADOW_BG4VOFS`](knowledge/wram/PPU_SHADOW_BG4VOFS.md) | `u16` | graphics | BG4 vertical scroll offset shadow; written to $2114 (twice). |
| `$7E:011E` | [`SCREEN_SHAKE_Y_DISPLACEMENT`](knowledge/wram/SCREEN_SHAKE_Y_DISPLACEMENT.md) | `i16` | graphics, map | Vertical screen shake oscillation displacement signed offset ($8C:C6CB, $8F:C61E). |
| `$7E:0120` | [`SCREEN_SHAKE_PREV_Y_DISPLACEMENT`](knowledge/wram/SCREEN_SHAKE_PREV_Y_DISPLACEMENT.md) | `i16` | graphics | Latch of previous frame vertical screen shake signed displacement ($8C:C6CB). |
| `$7E:0122` | [`PPU_SHADOW_W12SEL`](knowledge/wram/PPU_SHADOW_W12SEL.md) | `u8` | graphics | Window 1 and 2 mask settings shadow for BG1 and BG2; copied to hardware register $2123. |
| `$7E:0123` | [`PPU_SHADOW_W34SEL`](knowledge/wram/PPU_SHADOW_W34SEL.md) | `u8` | graphics | Window 1 and 2 mask settings shadow for BG3 and BG4; copied to hardware register $2124. |
| `$7E:0124` | [`PPU_SHADOW_WOBJSEL`](knowledge/wram/PPU_SHADOW_WOBJSEL.md) | `u8` | graphics | Window 1 and 2 mask settings shadow for OBJ and Color math; copied to hardware register $2125. |
| `$7E:0125` | [`VBLANK_CALLBACK_PTR`](knowledge/wram/VBLANK_CALLBACK_PTR.md) | `u24` | system | 24-bit indirect execution vector ($7E:0125..$7E:0127) called during NMI via jml [$0125]. |
| `$7E:0128` | [`NMI_USER_HOOK_FAR_PTR`](knowledge/wram/NMI_USER_HOOK_FAR_PTR.md) | `u24` | system | 24-bit far indirect vector hook jumped to during VBlank NMI interrupt dispatch ($80:857F). |
| `$7E:012B` | [`IRQ_USER_HOOK_FAR_PTR`](knowledge/wram/IRQ_USER_HOOK_FAR_PTR.md) | `u24` | system | 24-bit far indirect vector hook executed upon firing of H/V-Timer scanline IRQ ($80:8507, $80:8552). |
| `$7E:012E` | [`DIRECT_PAGE_RNG_ALIGN_PAD`](knowledge/wram/DIRECT_PAGE_RNG_ALIGN_PAD.md) | `u8[5]` | system, unused | 5-byte direct page alignment gap ($7E:012E..$7E:0132) between interrupt dispatch vector and RNG seed state (unused to our knowledge). |
| `$7E:0133` | [`RNG_SEED_0`](knowledge/wram/RNG_SEED_0.md) | `u16` | system | Cross-word carry pseudo-random number generator 16-bit seed word 0 (updated by func_C0859B). |
| `$7E:0135` | [`RNG_SEED_1`](knowledge/wram/RNG_SEED_1.md) | `u16` | system | Cross-word carry pseudo-random number generator 16-bit seed word 1. |
| `$7E:0137` | [`RNG_SEED_2`](knowledge/wram/RNG_SEED_2.md) | `u16` | system | Cross-word carry pseudo-random number generator 16-bit seed word 2. |
| `$7E:0139` | [`RNG_SEED_3`](knowledge/wram/RNG_SEED_3.md) | `u16` | system | Cross-word carry pseudo-random number generator 16-bit seed word 3 (combined $0133..$013A = 64-bit RNG state). |
| `$7E:013B` | [`VRAM_DMA_QUEUE_TAIL`](knowledge/wram/VRAM_DMA_QUEUE_TAIL.md) | `u16` | graphics | Read cursor index of deferred VRAM DMA queue (processed during VBlank). |
| `$7E:013D` | [`VRAM_DMA_QUEUE_CURSOR`](knowledge/wram/VRAM_DMA_QUEUE_CURSOR.md) | `u16` | graphics | Cursor index into 16-slot deferred VRAM DMA transfer queue. |
| `$7E:013F` | [`VRAM_DMA_QUEUE`](knowledge/wram/VRAM_DMA_QUEUE.md) | `VramDmaEntry[16]` | graphics, script | 16-slot deferred VRAM DMA queue (8 bytes per descriptor: src bank/addr, dest VRAM addr, length). |
| `$7E:01BF` | [`palette_bg_4`](knowledge/wram/palette_bg_4.md) | `u16[16]` | graphics | Background Palette 4 shadow buffer (16 colors, 32 bytes in 15-bit BGR555 format). |
| `$7E:01DF` | [`palette_bg_5`](knowledge/wram/palette_bg_5.md) | `u16[16]` | graphics | Background Palette 5 shadow buffer (16 colors, 32 bytes in 15-bit BGR555 format). |
| `$7E:01FF` | [`palette_bg_6`](knowledge/wram/palette_bg_6.md) | `u16[16]` | graphics | Background Palette 6 shadow buffer (16 colors, 32 bytes in 15-bit BGR555 format). |
| `$7E:021F` | [`palette_bg_7`](knowledge/wram/palette_bg_7.md) | `u16[16]` | graphics | Background Palette 7 shadow buffer (16 colors, 32 bytes in 15-bit BGR555 format). |
| `$7E:023F` | [`palette_spr_0`](knowledge/wram/palette_spr_0.md) | `u16[16]` | graphics | Sprite/OBJ Palette 0 shadow buffer (16 colors, 32 bytes in 15-bit BGR555 format). |
| `$7E:025F` | [`palette_spr_1`](knowledge/wram/palette_spr_1.md) | `u16[16]` | graphics | Sprite/OBJ Palette 1 shadow buffer (16 colors, 32 bytes in 15-bit BGR555 format). |
| `$7E:027F` | [`palette_spr_2`](knowledge/wram/palette_spr_2.md) | `u16[16]` | graphics | Sprite/OBJ Palette 2 shadow buffer (16 colors, 32 bytes in 15-bit BGR555 format). |
| `$7E:029F` | [`palette_spr_3`](knowledge/wram/palette_spr_3.md) | `u16[16]` | graphics | Sprite/OBJ Palette 3 shadow buffer (16 colors, 32 bytes in 15-bit BGR555 format). |
| `$7E:02BF` | [`palette_spr_4`](knowledge/wram/palette_spr_4.md) | `u16[16]` | graphics | Sprite/OBJ Palette 4 shadow buffer (16 colors, 32 bytes in 15-bit BGR555 format). |
| `$7E:02DF` | [`palette_spr_5`](knowledge/wram/palette_spr_5.md) | `u16[16]` | graphics | Sprite/OBJ Palette 5 shadow buffer (16 colors, 32 bytes in 15-bit BGR555 format). |
| `$7E:02FF` | [`palette_spr_6`](knowledge/wram/palette_spr_6.md) | `u16[16]` | graphics | Sprite/OBJ Palette 6 shadow buffer (16 colors, 32 bytes in 15-bit BGR555 format). |
| `$7E:031F` | [`palette_spr_7`](knowledge/wram/palette_spr_7.md) | `u16[16]` | graphics | Sprite/OBJ Palette 7 shadow buffer (16 colors, 32 bytes in 15-bit BGR555 format). |
| `$7E:033F` | [`PALETTE_SPAL_ALIGN_PAD`](knowledge/wram/PALETTE_SPAL_ALIGN_PAD.md) | `u8[2]` | graphics, unused | Alignment padding byte buffer ($7E:033F..$7E:0340) between sprite palette buffer 7 and last spawned entity slot index (unused to our knowledge). |
| `$7E:0341` | [`LAST_SPAWNED_ENTITY`](knowledge/wram/LAST_SPAWNED_ENTITY.md) | `entity` | entity | Entity slot index of most recently allocated or spawned actor. |
| `$7E:0343` | [`JOYPAD_REPEAT_TIMER`](knowledge/wram/JOYPAD_REPEAT_TIMER.md) | `u16` | system | Countdown timer before typematic joypad directional repeat begins. |
| `$7E:0345` | [`JOYPAD_REPEAT_MASK`](knowledge/wram/JOYPAD_REPEAT_MASK.md) | `u16` | system | Bitmask of joypad buttons eligible for typematic auto-repeat. |
| `$7E:0347` | [`JOYPAD_REPEAT_DELAY`](knowledge/wram/JOYPAD_REPEAT_DELAY.md) | `u16` | system | Initial typematic repeat delay duration threshold (frames). |
| `$7E:0349` | [`JOYPAD_REPEAT_RATE`](knowledge/wram/JOYPAD_REPEAT_RATE.md) | `u16` | system | Sustained typematic auto-repeat interval rate (frames). |
| `$7E:034B` | [`RING_MENU_DEPTH`](knowledge/wram/RING_MENU_DEPTH.md) | `u16` | dialogue | Ring menu hierarchy nesting depth level (0 = root, 1 = sub-ring, 2 = item selection). |
| `$7E:034D` | [`WINDOW_DESCRIPTOR_0`](knowledge/wram/WINDOW_DESCRIPTOR_0.md) | `WindowDescriptor` | dialogue | Primary dialogue window 0 layout descriptor (44 bytes). |
| `$7E:0379` | [`WINDOW_DESCRIPTOR_1`](knowledge/wram/WINDOW_DESCRIPTOR_1.md) | `WindowDescriptor` | dialogue | Secondary dialogue window 1 / Choice box layout descriptor (44 bytes). |
| `$7E:03A5` | [`WINDOW_DESCRIPTOR_2`](knowledge/wram/WINDOW_DESCRIPTOR_2.md) | `WindowDescriptor` | dialogue | Interactive item / alchemy selection window 2 layout descriptor (44 bytes). |
| `$7E:03D1` | [`WINDOW_SUBGRID_2`](knowledge/wram/WINDOW_SUBGRID_2.md) | `WindowSubgrid` | dialogue | Menu option subgrid descriptor for window 2 (12 bytes). |
| `$7E:03DD` | [`WINDOW_DESCRIPTOR_3`](knowledge/wram/WINDOW_DESCRIPTOR_3.md) | `WindowDescriptor` | dialogue | Alchemy formula / weapon description window 3 layout descriptor (44 bytes). |
| `$7E:0409` | [`WINDOW_DESCRIPTOR_4`](knowledge/wram/WINDOW_DESCRIPTOR_4.md) | `WindowDescriptor` | dialogue | Shop price / inventory count window 4 layout descriptor (44 bytes). |
| `$7E:0435` | [`WINDOW_DESCRIPTOR_5`](knowledge/wram/WINDOW_DESCRIPTOR_5.md) | `WindowDescriptor` | dialogue | Equipment / status summary window 5 layout descriptor (44 bytes). |
| `$7E:0461` | [`WINDOW_SUBGRID_5`](knowledge/wram/WINDOW_SUBGRID_5.md) | `WindowSubgrid` | dialogue | Menu option subgrid descriptor for window 5 (12 bytes). |
| `$7E:046D` | [`WINDOW_DESCRIPTOR_6`](knowledge/wram/WINDOW_DESCRIPTOR_6.md) | `WindowDescriptor` | dialogue | Controller options / button configuration window 6 layout descriptor (44 bytes). |
| `$7E:0499` | [`WINDOW_DESCRIPTOR_7`](knowledge/wram/WINDOW_DESCRIPTOR_7.md) | `WindowDescriptor` | dialogue | Name entry letter grid window 7 layout descriptor (44 bytes). |
| `$7E:04C5` | [`WINDOW_DESCRIPTOR_8`](knowledge/wram/WINDOW_DESCRIPTOR_8.md) | `WindowDescriptor` | dialogue | Target party member selection window 8 layout descriptor (44 bytes). |
| `$7E:04F1` | [`WINDOW_DESCRIPTOR_9`](knowledge/wram/WINDOW_DESCRIPTOR_9.md) | `WindowDescriptor` | dialogue | Auxiliary system / debug menu window 9 layout descriptor (44 bytes). |
| `$7E:051D` | [`HUD_BOY_STATUS_WIDGET`](knowledge/wram/HUD_BOY_STATUS_WIDGET.md) | `HudStatusWidget` | boy, graphics | HUD graphics descriptor for Boy status bar, HP meter gauge, and numeric digit tilemaps ($7E:051D..$7E:0560). |
| `$7E:0561` | [`HUD_DOG_STATUS_WIDGET`](knowledge/wram/HUD_DOG_STATUS_WIDGET.md) | `HudStatusWidget` | dog, graphics | HUD graphics descriptor for Dog status bar, HP meter gauge, and numeric digit tilemaps ($7E:0561..$7E:05A4). |
| `$7E:05A5` | [`HUD_DOG_ALIGN_PAD`](knowledge/wram/HUD_DOG_ALIGN_PAD.md) | `u8[2]` | dog, graphics, unused | 2-byte alignment padding ($7E:05A5..$7E:05A6) between Dog HUD status widget and ring menu caller actor pointer (unused to our knowledge). |
| `$7E:05A7` | [`RING_MENU_CALLER_ACTOR`](knowledge/wram/RING_MENU_CALLER_ACTOR.md) | `entity` | dialogue, entity | Pointer to actor entity that opened active ring menu (Boy $7E:4E89 or Dog $7E:4F37). |
| `$7E:05A9` | [`RING_MENU_STATUS_FLAGS`](knowledge/wram/RING_MENU_STATUS_FLAGS.md) | `u16` | dialogue, script | Ring menu state and visibility bitflags (bit 15 $8000 set = ring menu active/open). |
| `$7E:05AB` | [`RING_MENU_CATEGORY_INDEX`](knowledge/wram/RING_MENU_CATEGORY_INDEX.md) | `u16` | alchemy, weapon | Active ring menu category index (Items, Alchemy Formulas, Weapons, Settings). |
| `$7E:05AD` | [`TARGET_REQUEST_MASK`](knowledge/wram/TARGET_REQUEST_MASK.md) | `u16` | system | Target request mask — who a spell, item or cursor may pick |
| `$7E:05AF` | [`SELECTED_TARGET_ACTOR`](knowledge/wram/SELECTED_TARGET_ACTOR.md) | `entity` | combat, entity | Target actor entity record pointer selected during interactive combat targeting cursor loop ($8C:89D6, $8E:88A5). |
| `$7E:05B1` | [`DIALOGUE_LINE_DECODE_BUF`](knowledge/wram/DIALOGUE_LINE_DECODE_BUF.md) | `u8[100]` | dialogue | 100-byte active dialogue and menu text line staging buffer ($7E:05B1..$7E:0614) populated by dialogue_format_and_append_line ($8C:9E03). |
| `$7E:0615` | [`RING_MENU_ORIGIN_X`](knowledge/wram/RING_MENU_ORIGIN_X.md) | `u16` | dialogue | Screen X center anchor around which revolving ring menu icons orbit. |
| `$7E:0617` | [`RING_MENU_ORIGIN_Y`](knowledge/wram/RING_MENU_ORIGIN_Y.md) | `u16` | dialogue | Screen Y center anchor around which revolving ring menu icons orbit. |
| `$7E:0619` | [`FLIGHT_CRUISE_SPEED`](knowledge/wram/FLIGHT_CRUISE_SPEED.md) | `u16` | mode7, map | Mode 7 flight cruise forward velocity factor (shared with RING_MENU_RADIUS_DISTANCE; $8E:AF80). |
| `$7E:061B` | [`FLIGHT_HEADING_ANGLE`](knowledge/wram/FLIGHT_HEADING_ANGLE.md) | `u16` | mode7 | Mode 7 flight yaw heading angle in 512-step trigonometric circle (shared with RING_MENU_ROTATION_ANGLE; $8E:AF80). |
| `$7E:061D` | [`FLIGHT_PITCH_ANGLE`](knowledge/wram/FLIGHT_PITCH_ANGLE.md) | `u16` | mode7 | Mode 7 flight pitch/banking roll angle smoothed by hardware divider (shared with RING_MENU_ANGLE_2; $8E:AF80). |
| `$7E:061F` | [`DIALOGUE_TOKEN_CALL_DEPTH`](knowledge/wram/DIALOGUE_TOKEN_CALL_DEPTH.md) | `u16` | dialogue | Active call nesting depth (0..4) of dialogue token control subroutines in typewriter renderer ($8C:A472). |
| `$7E:0621` | [`DIALOGUE_CTRL_STATE`](knowledge/wram/DIALOGUE_CTRL_STATE.md) | `u16` | dialogue | Dialogue control opcode decoder parser state machine register. |
| `$7E:0623` | [`DIALOGUE_TOKEN_CALL_STACK`](knowledge/wram/DIALOGUE_TOKEN_CALL_STACK.md) | `u16[8]` | dialogue, script | 4-frame call stack ($7E:0623..$7E:0632, 16 bytes) storing return string offset and format flags during nested dialogue token expansion ($8C:A472, $8C:A7C6). |
| `$7E:0633` | [`DIALOGUE_STACK_ALIGN_GAP`](knowledge/wram/DIALOGUE_STACK_ALIGN_GAP.md) | `u8[112]` | dialogue, unused | 112-byte alignment gap ($7E:0633..$7E:06A2) between dialogue token call stack and ring menu icon slots (unused to our knowledge). |
| `$7E:06A3` | [`RING_ICON_SLOTS`](knowledge/wram/RING_ICON_SLOTS.md) | `u8[256]` | alchemy, weapon | Ring menu items inventory icon array (weapons, alchemy spells, items). |
| `$7E:07A3` | [`RING_ICON_ALIGN_PAD`](knowledge/wram/RING_ICON_ALIGN_PAD.md) | `u8` | dialogue, unused | 1-byte alignment padding ($7E:07A3) between byte array RING_ICON_SLOTS and 16-bit word-aligned ring menu buffers (unused to our knowledge). |
| `$7E:07A4` | [`SHOP_EQUIP_WEAPONS_COUNT`](knowledge/wram/SHOP_EQUIP_WEAPONS_COUNT.md) | `u16` | weapon | Number of selectable weapons currently owned and populated in weapon ring menu ($8E:99E6). |
| `$7E:07A6` | [`SHOP_EQUIP_WEAPONS_SELECTION`](knowledge/wram/SHOP_EQUIP_WEAPONS_SELECTION.md) | `u16` | weapon | Currently highlighted weapon selection index cursor in weapon ring menu ($8E:99E6). |
| `$7E:07A8` | [`SHOP_EQUIP_WEAPONS_ITEMS_BUF`](knowledge/wram/SHOP_EQUIP_WEAPONS_ITEMS_BUF.md) | `u16[16]` | weapon | 16-entry array ($7E:07A8..$7E:07C7, 32 bytes) of owned weapon item IDs displayed in weapon ring menu ($8E:99E6). |
| `$7E:07C8` | [`SHOP_RARE_ITEMS_COUNT`](knowledge/wram/SHOP_RARE_ITEMS_COUNT.md) | `u16` | system | Number of key items and rare artifacts currently held and populated in rare items ring menu ($8E:9B6F). |
| `$7E:07CA` | [`SHOP_RARE_ITEMS_SELECTION`](knowledge/wram/SHOP_RARE_ITEMS_SELECTION.md) | `u16` | system | Currently highlighted selection index cursor in rare items ring menu ($8E:9B6F). |
| `$7E:07CC` | [`SHOP_RARE_ITEMS_ITEMS_BUF`](knowledge/wram/SHOP_RARE_ITEMS_ITEMS_BUF.md) | `u16[16]` | system | 16-entry array ($7E:07CC..$7E:07EB, 32 bytes) of held key and quest item IDs displayed in rare items ring menu ($8E:9B6F). |
| `$7E:07EC` | [`SHOP_INGREDIENTS_COUNT`](knowledge/wram/SHOP_INGREDIENTS_COUNT.md) | `u16` | alchemy | Number of alchemy ingredients currently held in inventory and populated in ingredients ring menu ($8E:9B3A). |
| `$7E:07EE` | [`SHOP_INGREDIENTS_SELECTION`](knowledge/wram/SHOP_INGREDIENTS_SELECTION.md) | `u16` | alchemy | Currently highlighted selection index cursor in alchemy ingredients ring menu ($8E:9B3A). |
| `$7E:07F0` | [`SHOP_INGREDIENTS_ITEMS_BUF`](knowledge/wram/SHOP_INGREDIENTS_ITEMS_BUF.md) | `u16[16]` | alchemy | 16-entry array ($7E:07F0..$7E:080F, 32 bytes) of held alchemy ingredient item IDs displayed in ingredients ring menu ($8E:9B3A). |
| `$7E:0810` | [`RING_MENU_ACTIVE_ITEM_COUNT`](knowledge/wram/RING_MENU_ACTIVE_ITEM_COUNT.md) | `u16` | dialogue | Number of selectable items/spells in currently active primary ring menu. |
| `$7E:0812` | [`RING_MENU_ACTIVE_SELECTION`](knowledge/wram/RING_MENU_ACTIVE_SELECTION.md) | `u16` | dialogue | Currently highlighted item index cursor in primary ring menu. |
| `$7E:0814` | [`RING_MENU_ACTIVE_ITEMS_BUF`](knowledge/wram/RING_MENU_ACTIVE_ITEMS_BUF.md) | `u16[16]` | alchemy, dialogue | 16-entry array ($7E:0814..$7E:0833, 32 bytes) of item / spell / formula IDs displayed in primary ring menu. |
| `$7E:0834` | [`RING_MENU_SECONDARY_ITEM_COUNT`](knowledge/wram/RING_MENU_SECONDARY_ITEM_COUNT.md) | `u16` | dialogue | Number of selectable items in secondary ring menu. |
| `$7E:0836` | [`RING_MENU_SECONDARY_SELECTION`](knowledge/wram/RING_MENU_SECONDARY_SELECTION.md) | `u16` | dialogue | Currently highlighted item index cursor in secondary ring menu. |
| `$7E:0838` | [`RING_MENU_SECONDARY_ITEMS_BUF`](knowledge/wram/RING_MENU_SECONDARY_ITEMS_BUF.md) | `u16[16]` | dialogue | 16-entry array ($7E:0838..$7E:0857, 32 bytes) of item IDs displayed in secondary / equipment ring menu. |
| `$7E:0858` | [`AUX_ANIM_CHAN_0`](knowledge/wram/AUX_ANIM_CHAN_0.md) | `AuxAnimChannel` | combat, graphics | Auxiliary / spell animation channel 0 state descriptor (16 bytes). |
| `$7E:0868` | [`AUX_ANIM_CHAN_1`](knowledge/wram/AUX_ANIM_CHAN_1.md) | `AuxAnimChannel` | combat, graphics | Auxiliary / spell animation channel 1 state descriptor (16 bytes). |
| `$7E:0878` | [`MOSAIC_TRANSITION_STEP`](knowledge/wram/MOSAIC_TRANSITION_STEP.md) | `u16` | graphics | Active full-screen PPU mosaic transition step parameter ($8C:BB72) and torchlight mosaic jitter register ($90:9B30) written to PPU $2106. |
| `$7E:087A` | [`TARGET_CURSOR_ANIM`](knowledge/wram/TARGET_CURSOR_ANIM.md) | `AuxAnimChannel` | combat, graphics | Combat and alchemy targeting cursor animation state descriptor (16 bytes). |
| `$7E:088A` | [`BOY_PALETTE_BUFFER`](knowledge/wram/BOY_PALETTE_BUFFER.md) | `u16[16]` | boy, graphics | Active Boy character 16-color sprite palette staging buffer ($7E:088A..$7E:08A9, 32 bytes) restored on status cleanse ($90:C9B2). |
| `$7E:08AA` | [`DOG_PALETTE_BUFFER`](knowledge/wram/DOG_PALETTE_BUFFER.md) | `u16[16]` | dog, graphics | Active Dog companion 16-color sprite palette staging buffer ($7E:08AA..$7E:08C9, 32 bytes) restored on status cleanse ($90:C9B2). |
| `$7E:08CA` | [`CGRAM_UPLOAD_HEADER`](knowledge/wram/CGRAM_UPLOAD_HEADER.md) | `u16` | graphics | CGRAM DMA upload control header word (high byte: color count, low byte: CGRAM destination start index; $90:8A40). |
| `$7E:08CC` | [`CGRAM_UPLOAD_PALETTE_BUF`](knowledge/wram/CGRAM_UPLOAD_PALETTE_BUF.md) | `u16[15]` | graphics | 15-color staging buffer ($7E:08CC..$7E:08E9, 30 bytes) for dynamic sprite palette data uploaded to CGRAM via DMA ($90:8A40). |
| `$7E:08EA` | [`DOG_INPUT_MODE`](knowledge/wram/DOG_INPUT_MODE.md) | `u16` | dog, system | Dog companion manual player input override / control mode state ($8F:CFFA). |
| `$7E:08EC` | [`ROOM_METATILE_ALIGN_PAD`](knowledge/wram/ROOM_METATILE_ALIGN_PAD.md) | `u8[2]` | map, unused | 2-byte alignment padding ($7E:08EC..$7E:08ED) preceding room metatile dimensions (unused to our knowledge). |
| `$7E:08EE` | [`ROOM_METATILE_WIDTH`](knowledge/wram/ROOM_METATILE_WIDTH.md) | `u16` | map | Active room map width in 16x16 metatiles loaded from room header byte 0 ($90:8E45). |
| `$7E:08F0` | [`ROOM_METATILE_HEIGHT`](knowledge/wram/ROOM_METATILE_HEIGHT.md) | `u16` | map | Active room map height in 16x16 metatiles loaded from room header byte 1 ($90:8E45). |
| `$7E:08F2` | [`ROOM_PIXEL_WIDTH`](knowledge/wram/ROOM_PIXEL_WIDTH.md) | `u16` | map | Active room map width in screen pixels (ROOM_METATILE_WIDTH * 16; $90:8E45). |
| `$7E:08F4` | [`ROOM_PIXEL_HEIGHT`](knowledge/wram/ROOM_PIXEL_HEIGHT.md) | `u16` | map | Active room map height in screen pixels (ROOM_METATILE_HEIGHT * 16; $90:8E45). |
| `$7E:08F6` | [`CAMERA_MAX_ROOM_X`](knowledge/wram/CAMERA_MAX_ROOM_X.md) | `u16` | map | Maximum allowed horizontal camera scroll limit based on active room metatile dimensions. |
| `$7E:08F8` | [`CAMERA_MAX_ROOM_Y`](knowledge/wram/CAMERA_MAX_ROOM_Y.md) | `u16` | map | Maximum allowed vertical camera scroll limit based on active room metatile dimensions. |
| `$7E:08FA` | [`viewport_collision_row_0`](knowledge/wram/viewport_collision_row_0.md) | `u16[16]` | map | BG1 column staging buffer of the tilemap streamer $90:98FA, words 0..15 of 32 (not collision; widescreen research 2026-11-09). |
| `$7E:091A` | [`viewport_collision_row_1`](knowledge/wram/viewport_collision_row_1.md) | `u16[16]` | map | BG1 column staging buffer, words 16..31 (streamer $90:98FA; not collision). |
| `$7E:093A` | [`viewport_collision_row_2`](knowledge/wram/viewport_collision_row_2.md) | `u16[16]` | map | BG2 column staging buffer, words 0..15 (streamer $90:98FA; not collision). |
| `$7E:095A` | [`viewport_collision_row_3`](knowledge/wram/viewport_collision_row_3.md) | `u16[16]` | map | BG2 column staging buffer, words 16..31 (streamer $90:98FA; not collision). |
| `$7E:097A` | [`viewport_collision_row_4`](knowledge/wram/viewport_collision_row_4.md) | `u16[16]` | map | BG1 row staging buffer, words 0..15 (streamer $90:98FA; not collision). |
| `$7E:099A` | [`viewport_collision_row_5`](knowledge/wram/viewport_collision_row_5.md) | `u16[16]` | map | BG1 row staging buffer, words 16..31 (streamer $90:98FA; not collision). |
| `$7E:09BA` | [`viewport_collision_row_6`](knowledge/wram/viewport_collision_row_6.md) | `u16[16]` | map | BG2 row staging buffer, words 0..15 (streamer $90:98FA; not collision). |
| `$7E:09DA` | [`viewport_collision_row_7`](knowledge/wram/viewport_collision_row_7.md) | `u16[16]` | map | BG2 row staging buffer, words 16..31 (streamer $90:98FA; not collision). |
| `$7E:09FA` | [`viewport_collision_row_8`](knowledge/wram/viewport_collision_row_8.md) | `u16[16]` | map | Viewport metatile collision row 8 (16 words: local terrain physics geometry). |
| `$7E:0A1A` | [`viewport_collision_row_9`](knowledge/wram/viewport_collision_row_9.md) | `u16[6]` | map, script | Viewport metatile collision row 9 end boundary descriptor ($7E:0A1A..$7E:0A25). |
| `$7E:0A26` | [`BOY_STATS`](knowledge/wram/BOY_STATS.md) | `CharacterStats` | boy | Boy base RPG stats, level, experience, and equipment block (74 bytes) |
| `$7E:0A70` | [`DOG_STATS`](knowledge/wram/DOG_STATS.md) | `CharacterStats` | dog, armor | Dog companion base RPG stats, level, experience, and collar block (74 bytes) |
| `$7E:0ABA` | [`EQUIPPED_WEAPON`](knowledge/wram/EQUIPPED_WEAPON.md) | `u16` | weapon | Equipped weapon index word (0 = Bone, 1 = Sword, 2 = Axe, 3 = Spear, 4 = Bazooka). |
| `$7E:0ABC` | [`EQUIPPED_WEAPON_STATUS`](knowledge/wram/EQUIPPED_WEAPON_STATUS.md) | `u16` | weapon | Equipped weapon secondary attribute / ammo status indicator ($8F:8B80, $8F:878A). |
| `$7E:0ABE` | [`EQUIPPED_HELMET`](knowledge/wram/EQUIPPED_HELMET.md) | `u16` | armor | Currently equipped helmet / collar armor ID ($8E:925F, $8E:A64E). |
| `$7E:0AC0` | [`EQUIPPED_ACCESSORY`](knowledge/wram/EQUIPPED_ACCESSORY.md) | `u16` | armor | Currently equipped accessory / ring ID ($8E:928A, $8E:A662). |
| `$7E:0AC2` | [`EQUIPPED_BRACERS`](knowledge/wram/EQUIPPED_BRACERS.md) | `u16` | armor | Currently equipped arm bracers / gauntlets armor ID ($8E:927F, $8E:A658). |
| `$7E:0AC4` | [`EQUIPPED_BODY_ARMOR`](knowledge/wram/EQUIPPED_BODY_ARMOR.md) | `u16` | armor | Currently equipped vest / body armor ID ($8E:926F, $8E:A64E). |
| `$7E:0AC6` | [`CURRENCY_TALONS`](knowledge/wram/CURRENCY_TALONS.md) | `u24` | currency | Prehistoria Talons currency balance (24-bit integer, 0..16,777,215) |
| `$7E:0AC9` | [`CURRENCY_JEWELS`](knowledge/wram/CURRENCY_JEWELS.md) | `u24` | currency | Antiqua Jewels currency balance (24-bit integer, 0..16,777,215) |
| `$7E:0ACC` | [`CURRENCY_GOLD`](knowledge/wram/CURRENCY_GOLD.md) | `u24` | currency | Gothica Gold coins currency balance (24-bit integer, 0..16,777,215) |
| `$7E:0ACF` | [`CURRENCY_CREDITS`](knowledge/wram/CURRENCY_CREDITS.md) | `u24` | currency | Omnitopia Energy Credits currency balance (24-bit integer, 0..16,777,215) |
| `$7E:0AD2` | [`RING_EQUIPPED_ALCH_0`](knowledge/wram/RING_EQUIPPED_ALCH_0.md) | `u8` | alchemy, system | Alchemy Subsystem: Equipped formula ID in active Ring Menu quick-cast slot 0. |
| `$7E:0AD3` | [`RING_EQUIPPED_ALCH_1`](knowledge/wram/RING_EQUIPPED_ALCH_1.md) | `u8` | alchemy, system | Alchemy Subsystem: Equipped formula ID in active Ring Menu quick-cast slot 1. |
| `$7E:0AD4` | [`RING_EQUIPPED_ALCH_2`](knowledge/wram/RING_EQUIPPED_ALCH_2.md) | `u8` | alchemy, system | Alchemy Subsystem: Equipped formula ID in active Ring Menu quick-cast slot 2. |
| `$7E:0AD5` | [`RING_EQUIPPED_ALCH_3`](knowledge/wram/RING_EQUIPPED_ALCH_3.md) | `u8` | alchemy, system | Alchemy Subsystem: Equipped formula ID in active Ring Menu quick-cast slot 3. |
| `$7E:0AD6` | [`RING_EQUIPPED_ALCH_4`](knowledge/wram/RING_EQUIPPED_ALCH_4.md) | `u8` | alchemy, system | Alchemy Subsystem: Equipped formula ID in active Ring Menu quick-cast slot 4. |
| `$7E:0AD7` | [`RING_EQUIPPED_ALCH_5`](knowledge/wram/RING_EQUIPPED_ALCH_5.md) | `u8` | alchemy, system | Alchemy Subsystem: Equipped formula ID in active Ring Menu quick-cast slot 5. |
| `$7E:0AD8` | [`RING_EQUIPPED_ALCH_6`](knowledge/wram/RING_EQUIPPED_ALCH_6.md) | `u8` | alchemy, system | Alchemy Subsystem: Equipped formula ID in active Ring Menu quick-cast slot 6. |
| `$7E:0AD9` | [`RING_EQUIPPED_ALCH_7`](knowledge/wram/RING_EQUIPPED_ALCH_7.md) | `u8` | alchemy, system | Alchemy Subsystem: Equipped formula ID in active Ring Menu quick-cast slot 7. |
| `$7E:0ADA` | [`RING_EQUIPPED_ALCH_8`](knowledge/wram/RING_EQUIPPED_ALCH_8.md) | `u8` | alchemy, map | Alchemy Subsystem: Equipped formula ID in active Ring Menu quick-cast slot 8. |
| `$7E:0ADB` | [`CURRENT_ROOM_ID`](knowledge/wram/CURRENT_ROOM_ID.md) | `u16` | map | Active room / map ID index into master pointer table $9F:FDE7; passed to enter_room ($8E:E4E2). |
| `$7E:0ADD` | [`WEAPON_SKILL_FIST`](knowledge/wram/WEAPON_SKILL_FIST.md) | `u16` | weapon, combat | Combat Progression: Unarmed fist combat proficiency level and experience ($0100 default). |
| `$7E:0ADF` | [`WEAPON_SKILL_BONE_CLUB`](knowledge/wram/WEAPON_SKILL_BONE_CLUB.md) | `u16` | weapon, combat | Combat Progression: Bone Club sword skill level and experience ($0100 default, $8F:805A). |
| `$7E:0AE1` | [`WEAPON_SKILL_SPIDER_CLAW`](knowledge/wram/WEAPON_SKILL_SPIDER_CLAW.md) | `u16` | weapon, combat | Combat Progression: Spider Claw sword skill level and experience ($0100 default, $8F:805D). |
| `$7E:0AE3` | [`WEAPON_SKILL_GLADIATOR_SWD`](knowledge/wram/WEAPON_SKILL_GLADIATOR_SWD.md) | `u16` | weapon, combat | Combat Progression: Gladiator Sword skill level and experience ($0100 default, $8F:8060). |
| `$7E:0AE5` | [`WEAPON_SKILL_CRUSADER_SWD`](knowledge/wram/WEAPON_SKILL_CRUSADER_SWD.md) | `u16` | weapon, combat | Combat Progression: Crusader Sword skill level and experience ($0100 default, $8F:8063). |
| `$7E:0AE7` | [`WEAPON_SKILL_BONE_CRUSHER`](knowledge/wram/WEAPON_SKILL_BONE_CRUSHER.md) | `u16` | weapon, combat | Combat Progression: Bone Crusher axe skill level and experience ($0100 default, $8F:8066). |
| `$7E:0AE9` | [`WEAPON_SKILL_BRONZE_AXE`](knowledge/wram/WEAPON_SKILL_BRONZE_AXE.md) | `u16` | weapon, combat | Combat Progression: Bronze Axe skill level and experience ($0100 default, $8F:8069). |
| `$7E:0AEB` | [`WEAPON_SKILL_KNIGHT_BASHER`](knowledge/wram/WEAPON_SKILL_KNIGHT_BASHER.md) | `u16` | weapon, combat | Combat Progression: Knight Basher axe skill level and experience ($0100 default, $8F:806C). |
| `$7E:0AED` | [`WEAPON_SKILL_ATOM_SMASHER`](knowledge/wram/WEAPON_SKILL_ATOM_SMASHER.md) | `u16` | weapon, combat | Combat Progression: Atom Smasher axe skill level and experience ($0100 default, $8F:806F). |
| `$7E:0AEF` | [`WEAPON_SKILL_HORN_SPEAR`](knowledge/wram/WEAPON_SKILL_HORN_SPEAR.md) | `u16` | weapon, combat | Combat Progression: Horn Spear skill level and experience ($0100 default, $8F:8072). |
| `$7E:0AF1` | [`WEAPON_SKILL_BRONZE_SPEAR`](knowledge/wram/WEAPON_SKILL_BRONZE_SPEAR.md) | `u16` | weapon, combat | Combat Progression: Bronze Spear skill level and experience ($0100 default, $8F:8075). |
| `$7E:0AF3` | [`WEAPON_SKILL_LANCE`](knowledge/wram/WEAPON_SKILL_LANCE.md) | `u16` | weapon, combat | Combat Progression: Lance spear skill level and experience ($0100 default, $8F:8078). |
| `$7E:0AF5` | [`WEAPON_SKILL_LASER_LANCE`](knowledge/wram/WEAPON_SKILL_LASER_LANCE.md) | `u16` | weapon, combat | Combat Progression: Laser Lance spear skill level and experience ($0100 default, $8F:807B). |
| `$7E:0AF7` | [`WEAPON_SKILL_EXP_PADDING`](knowledge/wram/WEAPON_SKILL_EXP_PADDING.md) | `u8[16]` | weapon, unused | 16-byte alignment padding gap ($7E:0AF7..$7E:0B06) between weapon skill experience array and stamina charge capacity (unused to our knowledge). |
| `$7E:0B07` | [`BOY_CHARGE_CAPACITY`](knowledge/wram/BOY_CHARGE_CAPACITY.md) | `u16` | boy, combat | Combat Mechanics: Boy stamina charge gauge capacity ($0100 = 100% full attack power threshold) |
| `$7E:0B09` | [`BOY_AI_AGGRESSION_SETTING`](knowledge/wram/BOY_AI_AGGRESSION_SETTING.md) | `u16` | boy | Boy companion AI attack setting (0 = never attack, 1..5 = attack radius 50..130 pixels). |
| `$7E:0B0B` | [`ROOM_STEP_TRIGGER`](knowledge/wram/ROOM_STEP_TRIGGER.md) | `u16` | map, script | Pointer to step-on coordinate trigger descriptor table for current room. |
| `$7E:0B0D` | [`DOG_AI_AGGRESSION_SETTING`](knowledge/wram/DOG_AI_AGGRESSION_SETTING.md) | `u16` | dog | Dog companion AI attack setting (0 = never attack, 1..5 = widest search radius). |
| `$7E:0B0F` | [`DOG_STAMINA_RECOVERY_RATE`](knowledge/wram/DOG_STAMINA_RECOVERY_RATE.md) | `u16` | dog, combat | Combat Mechanics: Dog stamina recovery rate per frame tick (defaults to 2 in $8F:81BE) |
| `$7E:0B11` | [`BOY_FOOTSTEP_TIMER`](knowledge/wram/BOY_FOOTSTEP_TIMER.md) | `u16` | boy, audio | Active footstep sound effect cadence timer for Boy player character, triggering SFX #$0030 every 14-20 frames ($8F:8C9C). |
| `$7E:0B13` | [`DOG_FOOTSTEP_TIMER`](knowledge/wram/DOG_FOOTSTEP_TIMER.md) | `u16` | dog, audio | Active footstep sound effect cadence timer for Dog companion character, triggering walking/running SFX ($8F:8C9A). |
| `$7E:0B15` | [`game_boot_signature`](knowledge/wram/game_boot_signature.md) | `u16` | system | Warm boot RAM persistence validation signature word ($00A4 initialized in $80:8D30). |
| `$7E:0B17` | [`new_game_init_flag`](knowledge/wram/new_game_init_flag.md) | `u16` | script, system | Assertion flag set during cold start / reset sequence to trigger state clearing ($80:8D33). |
| `$7E:0B19` | [`FIELD_FRAME_COUNTER`](knowledge/wram/FIELD_FRAME_COUNTER.md) | `u32` | script, system | Field frame counter (32-bit, `$7E:0B19..$7E:0B1C`): +1 per field frame; script `sleep` deadlines and wake-ups count in it ($8E:E41E, $8C:D037). |
| `$7E:0B1D` | [`MODE7_FLIGHT_HUD_VISIBLE`](knowledge/wram/MODE7_FLIGHT_HUD_VISIBLE.md) | `u16` | mode7 | Active toggle flag for Mode 7 flight instrument panel and HUD gauge overlay, toggled via controller R button ($80:C1F7, $80:C5DB). |
| `$7E:0B1F` | [`RING_MENU_SAVED_STACK_PTR`](knowledge/wram/RING_MENU_SAVED_STACK_PTR.md) | `u16` | dialogue | Saved CPU stack pointer (S register) snapshot restored on ring menu closure. |
| `$7E:0B21` | [`CONTROL_CONFIGURATION`](knowledge/wram/CONTROL_CONFIGURATION.md) | `u16` | input | Control Prefs configuration: 0 = Configuration 1 (action B, run A), 2 = Configuration 2 (action A, run B); index into $8D:A091/$8D:A095. |
| `$7E:0B23` | [`RUN_BUTTON`](knowledge/wram/RUN_BUTTON.md) | `u16` | input, boy, dog | Run button mask of the control setup ($4218 order); BIT against $0104 at $8F:CE7C / $8F:CFB5 picks the run step $90:82A8. |
| `$7E:0B25` | [`ACTION_BUTTON`](knowledge/wram/ACTION_BUTTON.md) | `u16` | input, boy, dog, combat | Attack / talk button mask of the control setup ($4218 order); a new press swings or checks a B-trigger ($8F:CE0D), held at 100 % it charges. |
| `$7E:0B27` | [`ALCHEMY_RING_BROWSE_MODE`](knowledge/wram/ALCHEMY_RING_BROWSE_MODE.md) | `u16` | alchemy | Alchemy ring menu browse / assign mode flag; when non-zero, disables grey-out of uncastable formulas ($8D:BA77, $90:87B0). |
| `$7E:0B29` | [`HUD_DIRTY_UPDATE_FLAGS`](knowledge/wram/HUD_DIRTY_UPDATE_FLAGS.md) | `u16` | map, dialogue | HUD refresh latch flags (bit 0 = tilemap redraw required, bit 2 = HUD hidden). |
| `$7E:0B2B` | [`CHOICE_PROMPT_STATE`](knowledge/wram/CHOICE_PROMPT_STATE.md) | `ChoiceBoxState` | dialogue, system | Dialogue interactive choice selection box state machine |
| `$7E:0B2D` | [`ACTIVE_PLAYER_CHAR_ALIGN_PAD`](knowledge/wram/ACTIVE_PLAYER_CHAR_ALIGN_PAD.md) | `u8[2]` | entity, unused | 2-byte alignment padding ($7E:0B2D..$7E:0B2E) preceding active player character index (unused to our knowledge). |
| `$7E:0B2F` | [`ACTIVE_PLAYER_CHAR_INDEX`](knowledge/wram/ACTIVE_PLAYER_CHAR_INDEX.md) | `u16` | system | Index of currently player-controlled character (0 = Boy, 3 = Dog). |
| `$7E:0B31` | [`DIALOGUE_LINE_IDX`](knowledge/wram/DIALOGUE_LINE_IDX.md) | `u16` | dialogue | Active text line index inside dialogue window buffer. |
| `$7E:0B33` | [`SAVE_MENU_SLOT_BITMASK`](knowledge/wram/SAVE_MENU_SLOT_BITMASK.md) | `u16` | system | Active battery save slot test bitmask (1, 2, 4, 8) in save file management menu ($8D:CC02). |
| `$7E:0B35` | [`SAVE_MENU_SLOT_INDEX`](knowledge/wram/SAVE_MENU_SLOT_INDEX.md) | `u16` | system | Active battery save slot selection index offset (2, 4, 6, 8) in save file selection menu ($8D:CC02). |
| `$7E:0B37` | [`SAVE_MENU_SRAM_PTR`](knowledge/wram/SAVE_MENU_SRAM_PTR.md) | `u16` | system | Active SRAM slot base address pointer in bank $30 ($6002, $6402, $6802, $6C02) in save menu ($8D:CC02). |
| `$7E:0B39` | [`VALID_SAVE_SLOTS_MASK`](knowledge/wram/VALID_SAVE_SLOTS_MASK.md) | `u16` | system | 16-bit validation bitmask of detected battery SRAM save slots (bits 0..3 for slots 0..3; $80:8B6C, $8D:C905). |
| `$7E:0B3B` | [`ACTIVE_SAVE_SLOT`](knowledge/wram/ACTIVE_SAVE_SLOT.md) | `u16` | system | SRAM save slot index (0..3); read from battery RAM $30:6001. |
| `$7E:0B3D` | [`FONT_GLYPH_HEIGHT`](knowledge/wram/FONT_GLYPH_HEIGHT.md) | `u16` | dialogue | Height of dialogue text font glyphs in scanlines (default 8). |
| `$7E:0B3F` | [`FONT_LINE_STRIDE`](knowledge/wram/FONT_LINE_STRIDE.md) | `u16` | dialogue | Byte pitch stride between raster text lines in dialogue buffer. |
| `$7E:0B41` | [`FONT_BUFFER_BASE`](knowledge/wram/FONT_BUFFER_BASE.md) | `u16` | dialogue | Base address in High WRAM ($7F:A000) for 2bpp font glyph staging. |
| `$7E:0B43` | [`dialogue_audio_beep_tick`](knowledge/wram/dialogue_audio_beep_tick.md) | `u8` | audio, dialogue | Cooldown timer ticks between successive speech typewriter sound effect triggers. |
| `$7E:0B44` | [`WEAPON_CHARGE_ALIGN_PAD`](knowledge/wram/WEAPON_CHARGE_ALIGN_PAD.md) | `u8[3]` | weapon, unused | 3-byte alignment padding ($7E:0B44..$7E:0B46) preceding weapon charge meter percentage (unused to our knowledge). |
| `$7E:0B47` | [`WEAPON_CHARGE_PERCENTAGE`](knowledge/wram/WEAPON_CHARGE_PERCENTAGE.md) | `u16` | weapon | Current physical attack charge meter level (0..100%). |
| `$7E:0B49` | [`WEAPON_CHARGE_LEVEL_STAGE`](knowledge/wram/WEAPON_CHARGE_LEVEL_STAGE.md) | `u16` | weapon | Attack charge stage tier (0 = Normal, 1 = Stage 1, 2 = Stage 2, 3 = Stage 3). |
| `$7E:0B4B` | [`STATUS_CLEANSE_ACTIVE_FLAG`](knowledge/wram/STATUS_CLEANSE_ACTIVE_FLAG.md) | `u16` | system | Party status condition cleanse in-progress flag, set during party-wide status recovery ($91:AC58). |
| `$7E:0B4D` | [`BOY_STAMINA_FLASH_TIMER`](knowledge/wram/BOY_STAMINA_FLASH_TIMER.md) | `u16` | boy, system | HUD stamina gauge 100% full-charge flash alert countdown timer for Boy player ($8F:8AE4). |
| `$7E:0B4F` | [`DOG_STAMINA_FLASH_TIMER`](knowledge/wram/DOG_STAMINA_FLASH_TIMER.md) | `u16` | dog, system | HUD stamina gauge 100% full-charge flash alert countdown timer for Dog companion ($8F:8AE4). |
| `$7E:0B51` | [`alchemy_cast_effect_id`](knowledge/wram/alchemy_cast_effect_id.md) | `u16` | alchemy, combat | Formula animation effect script identifier loaded into combat VM on cast. |
| `$7E:0B53` | [`COMBAT_POPUP_QUEUE_ALIGN_PAD`](knowledge/wram/COMBAT_POPUP_QUEUE_ALIGN_PAD.md) | `u8[4]` | combat, unused | 4-byte alignment padding ($7E:0B53..$7E:0B56) preceding combat popup queue head pointer (unused to our knowledge). |
| `$7E:0B57` | [`HUD_POPUP_QUEUE_HEAD_PTR`](knowledge/wram/HUD_POPUP_QUEUE_HEAD_PTR.md) | `u16` | combat, dialogue | Pointer to active 64-byte notification slot in floating combat text ring buffer ($7E:3074..$7E:3273; stepped by func_80B37A). |
| `$7E:0B59` | [`DIALOGUE_SCROLL_ALIGN_GAP`](knowledge/wram/DIALOGUE_SCROLL_ALIGN_GAP.md) | `u8[22]` | dialogue, unused | 22-byte alignment gap ($7E:0B59..$7E:0B6E) preceding dialogue scroll timer (unused to our knowledge). |
| `$7E:0B6F` | [`dialogue_scroll_timer`](knowledge/wram/dialogue_scroll_timer.md) | `u16` | dialogue | Typewriter text scroll delay counter decremented in per-frame tick ($8C:A229). |
| `$7E:0B71` | [`TARGET_SELECTION_ACTOR_LIST_PTR`](knowledge/wram/TARGET_SELECTION_ACTOR_LIST_PTR.md) | `u16` | alchemy, combat | Pointer to candidate entity target actor array used by combat and alchemy targeting cursor loop ($8E:8677, $8C:89DF). |
| `$7E:0B73` | [`SPEAKER_LEFT_FIGURE_ACTOR`](knowledge/wram/SPEAKER_LEFT_FIGURE_ACTOR.md) | `u16` | dialogue, entity | Entity actor assigned to left speaker portrait / figure slot in dialogue script VM opcodes 0x64 / 0x65 ($8C:C627). |
| `$7E:0B75` | [`SPEAKER_RIGHT_FIGURE_ACTOR`](knowledge/wram/SPEAKER_RIGHT_FIGURE_ACTOR.md) | `u16` | dialogue, entity | Entity actor assigned to right speaker portrait / figure slot in dialogue script VM opcodes 0x68 / 0x69 ($8C:C627). |
| `$7E:0B77` | [`joypad_button_hold_timer`](knowledge/wram/joypad_button_hold_timer.md) | `u16` | system | Duration in ticks current button has been held down continuously. |
| `$7E:0B79` | [`joypad_edge_trigger_mask`](knowledge/wram/joypad_edge_trigger_mask.md) | `u16` | script, system | Debounced button press event mask: buttons newly asserted on this frame ($8C:C5EA). |
| `$7E:0B7B` | [`AUDIO_VOLUME_FADE_STATE`](knowledge/wram/AUDIO_VOLUME_FADE_STATE.md) | `AudioFadeState` | audio | Master audio volume fade interpolation state machine |
| `$7E:0B7D` | [`AUDIO_FADE_ALIGN_PAD`](knowledge/wram/AUDIO_FADE_ALIGN_PAD.md) | `u8[2]` | audio, unused | 2-byte alignment padding ($7E:0B7D..$7E:0B7E) preceding audio fade counter (unused to our knowledge). |
| `$7E:0B7F` | [`AUDIO_FADE_COUNTER`](knowledge/wram/AUDIO_FADE_COUNTER.md) | `u16` | audio | Step counter tracking audio volume fade in/out transitions. |
| `$7E:0B81` | [`AUDIO_VOLUME_ALIGN_PAD`](knowledge/wram/AUDIO_VOLUME_ALIGN_PAD.md) | `u8[2]` | audio, unused | 2-byte alignment padding ($7E:0B81..$7E:0B82) preceding audio target volume (unused to our knowledge). |
| `$7E:0B83` | [`AUDIO_TARGET_VOLUME`](knowledge/wram/AUDIO_TARGET_VOLUME.md) | `u16` | audio, graphics | Target master audio volume level latch for fade interpolation. |
| `$7E:0B85` | [`SHOP_ITEM_STREAM_ALIGN_PAD`](knowledge/wram/SHOP_ITEM_STREAM_ALIGN_PAD.md) | `u8[16]` | dialogue, unused | 16-byte alignment padding gap ($7E:0B85..$7E:0B94) preceding shopkeeper inventory stream buffer (unused to our knowledge). |
| `$7E:0B95` | [`SHOP_ITEM_STREAM_BUF`](knowledge/wram/SHOP_ITEM_STREAM_BUF.md) | `u8[12]` | system | Merchant stock item ID stream buffer terminated by 0x80 ($8E:9BC1). |
| `$7E:0BA1` | [`SHOP_CATALOG_COUNT`](knowledge/wram/SHOP_CATALOG_COUNT.md) | `u16` | system | Total active merchandise items in current shopkeeper inventory ($8E:9BC1). |
| `$7E:0BA3` | [`SHOP_CATALOG_SELECTION`](knowledge/wram/SHOP_CATALOG_SELECTION.md) | `u16` | system | Currently highlighted item selection index cursor in shop menu ($8E:9BC1). |
| `$7E:0BA5` | [`SHOP_CATALOG_ITEMS_BUF`](knowledge/wram/SHOP_CATALOG_ITEMS_BUF.md) | `u16[16]` | system | 16-entry array ($7E:0BA5..$7E:0BC4, 32 bytes) of item IDs for active shop merchandise ($8E:9BC1). |
| `$7E:0BC5` | [`SHOP_CATALOG_PRICES_BUF`](knowledge/wram/SHOP_CATALOG_PRICES_BUF.md) | `u16[16]` | system | 16-entry array ($7E:0BC5..$7E:0BE4, 32 bytes) of resolved item purchase prices ($8E:9BC1). |
| `$7E:0BE5` | [`WEAPON_XP_THRESHOLD_PAD`](knowledge/wram/WEAPON_XP_THRESHOLD_PAD.md) | `u8[16]` | weapon, unused | 16-byte alignment padding gap ($7E:0BE5..$7E:0BF4) preceding weapon experience threshold (unused to our knowledge). |
| `$7E:0BF5` | [`WEAPON_NEXT_LEVEL_XP_THRESHOLD`](knowledge/wram/WEAPON_NEXT_LEVEL_XP_THRESHOLD.md) | `u16` | weapon, combat | Experience points milestone required for current weapon skill to level up in Status screen ($8E:AC9B). |
| `$7E:0BF7` | [`RING_MENU_CURSOR_ALIGN_PAD`](knowledge/wram/RING_MENU_CURSOR_ALIGN_PAD.md) | `u8[2]` | dialogue, unused | 2-byte alignment padding ($7E:0BF7..$7E:0BF8) preceding ring menu cursor sector (unused to our knowledge). |
| `$7E:0BF9` | [`RING_MENU_CURSOR_SECTOR`](knowledge/wram/RING_MENU_CURSOR_SECTOR.md) | `u16` | mode7, dialogue | Latched cursor sector index during ring menu item selection ($FFFF = unlatched). |
| `$7E:0BFB` | [`MODE7_CAMERA_TARGET_OFFSET_X`](knowledge/wram/MODE7_CAMERA_TARGET_OFFSET_X.md) | `u16` | mode7, map | Mode 7 Engine: Camera target anchor X coordinate offset for flight viewport ($8E:B33D). |
| `$7E:0BFD` | [`MODE7_CAMERA_TARGET_OFFSET_Y`](knowledge/wram/MODE7_CAMERA_TARGET_OFFSET_Y.md) | `u16` | mode7, map | Mode 7 Engine: Camera target anchor Y coordinate offset for flight viewport ($8E:B33D). |
| `$7E:0BFF` | [`RING_MENU_KEY_ITEMS_COUNT`](knowledge/wram/RING_MENU_KEY_ITEMS_COUNT.md) | `u16` | dialogue | Number of eligible key / story items populated into Key Items ring menu ($8E:9DF9). |
| `$7E:0C01` | [`RING_MENU_KEY_ITEMS_SELECTION`](knowledge/wram/RING_MENU_KEY_ITEMS_SELECTION.md) | `u16` | dialogue | Currently highlighted key / story item cursor selection in Key Items Ring Menu ($8E:9DF9). |
| `$7E:0C03` | [`RING_MENU_KEY_ITEMS_BUF`](knowledge/wram/RING_MENU_KEY_ITEMS_BUF.md) | `u16[16]` | dialogue | 16-entry array ($7E:0C03..$7E:0C22, 32 bytes) of held key and quest item IDs displayed in Key Items ring menu ($8E:9DF9). |
| `$7E:0C23` | [`RING_MENU_WEAPONS_COUNT`](knowledge/wram/RING_MENU_WEAPONS_COUNT.md) | `u16` | weapon, dialogue | Number of unlocked weapons in Weapons Ring Menu |
| `$7E:0C25` | [`RING_MENU_WEAPONS_SELECTION`](knowledge/wram/RING_MENU_WEAPONS_SELECTION.md) | `u16` | weapon, dialogue | Currently highlighted weapon cursor selection in Weapons Ring Menu |
| `$7E:0C27` | [`RING_MENU_WEAPONS_BUF`](knowledge/wram/RING_MENU_WEAPONS_BUF.md) | `u16[16]` | weapon, dialogue | 16-entry array ($7E:0C27..$7E:0C46, 32 bytes) of owned weapon item IDs displayed in Weapons ring menu. |
| `$7E:0C47` | [`RING_MENU_ITEMS_COUNT`](knowledge/wram/RING_MENU_ITEMS_COUNT.md) | `u16` | dialogue | Number of available consumable items in Items Ring Menu |
| `$7E:0C49` | [`RING_MENU_ITEMS_SELECTION`](knowledge/wram/RING_MENU_ITEMS_SELECTION.md) | `u16` | dialogue | Currently highlighted consumable item cursor selection in Items Ring Menu |
| `$7E:0C4B` | [`RING_MENU_ITEMS_BUF`](knowledge/wram/RING_MENU_ITEMS_BUF.md) | `u16[16]` | dialogue | 16-entry array ($7E:0C4B..$7E:0C6A, 32 bytes) of held consumable item IDs displayed in Consumables ring menu. |
| `$7E:0C6B` | [`RING_MENU_SPELLS_COUNT`](knowledge/wram/RING_MENU_SPELLS_COUNT.md) | `u16` | alchemy, dialogue | Number of eligible alchemy formulas in Formulas / Spells Ring Menu |
| `$7E:0C6D` | [`RING_MENU_SPELLS_SELECTION`](knowledge/wram/RING_MENU_SPELLS_SELECTION.md) | `u16` | alchemy, dialogue | Currently highlighted formula cursor selection in Formulas / Spells Ring Menu |
| `$7E:0C6F` | [`RING_MENU_SPELLS_BUF`](knowledge/wram/RING_MENU_SPELLS_BUF.md) | `u16[16]` | alchemy, dialogue | 16-entry array ($7E:0C6F..$7E:0C8E, 32 bytes) of eligible alchemy formula IDs displayed in Spells ring menu. |
| `$7E:0C8F` | [`RING_MENU_ALCH_FORMULA_COUNT`](knowledge/wram/RING_MENU_ALCH_FORMULA_COUNT.md) | `u16` | alchemy, dialogue | Total learned alchemy formulas populated into secondary ring menu |
| `$7E:0C91` | [`RING_MENU_ALCH_SELECTION`](knowledge/wram/RING_MENU_ALCH_SELECTION.md) | `u16` | alchemy, dialogue | Currently highlighted formula cursor selection in secondary formula ring menu |
| `$7E:0C93` | [`RING_MENU_ALCH_FORMULAS_BUF`](knowledge/wram/RING_MENU_ALCH_FORMULAS_BUF.md) | `u16[16]` | alchemy, dialogue | 16-entry array ($7E:0C93..$7E:0CB2, 32 bytes) of learned formula IDs displayed in secondary formula ring menu. |
| `$7E:0CB3` | [`RING_MENU_ALCH_ALIGN_PAD`](knowledge/wram/RING_MENU_ALCH_ALIGN_PAD.md) | `u8[2]` | alchemy, unused | 2-byte alignment padding ($7E:0CB3..$7E:0CB4) preceding formula action commands submenu (unused to our knowledge). |
| `$7E:0CB5` | [`RING_MENU_FORMULA_ACTION_COUNT`](knowledge/wram/RING_MENU_FORMULA_ACTION_COUNT.md) | `u16` | alchemy, dialogue | Total available formula action commands in Ring Menu formula submenu |
| `$7E:0CB7` | [`RING_MENU_FORMULA_ACTION_SELECTION`](knowledge/wram/RING_MENU_FORMULA_ACTION_SELECTION.md) | `u16` | alchemy, dialogue | Currently highlighted formula action cursor selection in formula submenu |
| `$7E:0CB9` | [`RING_MENU_FORMULA_ACTIONS_BUF`](knowledge/wram/RING_MENU_FORMULA_ACTIONS_BUF.md) | `u16[16]` | alchemy, dialogue | 16-entry array ($7E:0CB9..$7E:0CD8, 32 bytes) of available action command IDs in ring menu formula submenu. |
| `$7E:0CD9` | [`SHOP_MENU_OPTION_COUNT`](knowledge/wram/SHOP_MENU_OPTION_COUNT.md) | `u16` | dialogue | Total active shopkeeper dialogue interaction options in merchant choice menu |
| `$7E:0CDB` | [`SHOP_MENU_SELECTION`](knowledge/wram/SHOP_MENU_SELECTION.md) | `u16` | dialogue | Currently highlighted merchant interaction option cursor index |
| `$7E:0CDD` | [`SHOP_MENU_OPTIONS_BUF`](knowledge/wram/SHOP_MENU_OPTIONS_BUF.md) | `u16[8]` | dialogue | 8-entry array ($7E:0CDD..$7E:0CEC, 16 bytes) of merchant interaction choice option IDs in shopkeeper menu. |
| `$7E:0CED` | [`SHOP_MENU_OPTIONS_ALIGN_PAD`](knowledge/wram/SHOP_MENU_OPTIONS_ALIGN_PAD.md) | `u8[32]` | dialogue, unused | 32-byte alignment gap ($7E:0CED..$7E:0D0C) preceding quest and alchemy menu state (unused to our knowledge). |
| `$7E:0D0D` | [`SAVE_PROMPT_YES_NO_SELECTION`](knowledge/wram/SAVE_PROMPT_YES_NO_SELECTION.md) | `u16` | dialogue | Selected option index in Save Menu Yes/No overwrite confirmation prompt |
| `$7E:0D0F` | [`QUEST_MENU_LATCHED_SELECTION`](knowledge/wram/QUEST_MENU_LATCHED_SELECTION.md) | `u16` | alchemy | Previously latched menu selection cursor index ($FFFF = unlatched) used for change detection in quest / alchemy menu ($8C:C180). |
| `$7E:0D11` | [`RING_MENU_CALLER_CHAR_INDEX`](knowledge/wram/RING_MENU_CALLER_CHAR_INDEX.md) | `u16` | dialogue, entity | Character slot index of actor who opened ring menu (0 = Boy, 2 = Dog; $8D:8674). |
| `$7E:0D13` | [`ALCHEMY_MENU_ACTIVE_FORMULA`](knowledge/wram/ALCHEMY_MENU_ACTIVE_FORMULA.md) | `u16` | alchemy | Currently highlighted alchemy formula ID in alchemy assignment menu ($8D:BA77). |
| `$7E:0D15` | [`RING_MENU_AVAILABLE_CATEGORIES_MASK`](knowledge/wram/RING_MENU_AVAILABLE_CATEGORIES_MASK.md) | `u16` | dialogue | Bitmask of active and populated ring menu categories available to the player ($8D:91D5). |
| `$7E:0D17` | [`ALCHEMY_MENU_PAGE_INDEX`](knowledge/wram/ALCHEMY_MENU_PAGE_INDEX.md) | `u16` | alchemy | Active page index offset within alchemy formula assignment menu ($8D:B9DE). |
| `$7E:0D19` | [`ALCHEMY_MENU_SELECTED_SPELL_INDEX`](knowledge/wram/ALCHEMY_MENU_SELECTED_SPELL_INDEX.md) | `u16` | alchemy | Cursor selection index within current alchemy formula assignment catalog ($8D:B9DE). |
| `$7E:0D1B` | [`ALCHEMY_MENU_SCROLL_OFFSET`](knowledge/wram/ALCHEMY_MENU_SCROLL_OFFSET.md) | `u16` | alchemy | Vertical scroll line offset in alchemy formula catalog window ($8D:B9DE). |
| `$7E:0D1D` | [`ALCHEMY_MENU_SPELL_IDS_BUF`](knowledge/wram/ALCHEMY_MENU_SPELL_IDS_BUF.md) | `u16[16]` | alchemy | 16-entry array ($7E:0D1D..$7E:0D3C, 32 bytes) of formula IDs displayed in alchemy assignment catalog. |
| `$7E:0D3D` | [`STATUS_GAUGE_ALIGN_PAD`](knowledge/wram/STATUS_GAUGE_ALIGN_PAD.md) | `u8[38]` | graphics, unused | 38-byte alignment padding gap ($7E:0D3D..$7E:0D62) preceding status screen stat gauge widgets (unused to our knowledge). |
| `$7E:0D63` | [`STATUS_GAUGE_ATTACK`](knowledge/wram/STATUS_GAUGE_ATTACK.md) | `StatusGaugeWidget` | system | Attack stat bar gauge widget animation and coordinate record ($7E:0D63..$7E:0D7A, 24 bytes) in status menu ($8D:A85B). |
| `$7E:0D7B` | [`STATUS_GAUGE_DEFENSE`](knowledge/wram/STATUS_GAUGE_DEFENSE.md) | `StatusGaugeWidget` | system | Defense stat bar gauge widget animation and coordinate record ($7E:0D7B..$7E:0D92, 24 bytes) in status menu ($8D:A85B). |
| `$7E:0D93` | [`STATUS_GAUGE_MAGIC_DEF`](knowledge/wram/STATUS_GAUGE_MAGIC_DEF.md) | `StatusGaugeWidget` | system | Magic defense stat bar gauge widget animation and coordinate record ($7E:0D93..$7E:0DAA, 24 bytes) in status menu ($8D:A85B). |
| `$7E:0DAB` | [`STATUS_GAUGE_EVADE`](knowledge/wram/STATUS_GAUGE_EVADE.md) | `StatusGaugeWidget` | combat | Evade stat bar gauge widget animation and coordinate record ($7E:0DAB..$7E:0DC2, 24 bytes) in status menu ($8D:A85B). |
| `$7E:0DC3` | [`STATUS_GAUGE_HIT_RATE`](knowledge/wram/STATUS_GAUGE_HIT_RATE.md) | `StatusGaugeWidget` | system | Hit rate stat bar gauge widget animation and coordinate record ($7E:0DC3..$7E:0DDA, 24 bytes) in status menu ($8D:A85B). |
| `$7E:0DDB` | [`MODE7_COCKPIT_OCCUPANT_ANIM`](knowledge/wram/MODE7_COCKPIT_OCCUPANT_ANIM.md) | `u8[12]` | mode7 | Mode 7 Windwalker aircraft cockpit occupant animation record ($7E:0DDB..$7E:0DE6, 12 bytes; $8E:AE80). |
| `$7E:0DE7` | [`MODE7_SPRITE_CACHE_SLOT_0`](knowledge/wram/MODE7_SPRITE_CACHE_SLOT_0.md) | `u16` | mode7, graphics | Allocated dynamic VRAM 3-slot sprite cache address 0 for flight cockpit overlay ($8E:AE80). |
| `$7E:0DE9` | [`MODE7_SPRITE_CACHE_ALIGN_PAD_0`](knowledge/wram/MODE7_SPRITE_CACHE_ALIGN_PAD_0.md) | `u8[2]` | mode7, unused | 2-byte alignment padding ($7E:0DE9..$7E:0DEA) preceding Mode 7 cockpit overlay animation record (unused to our knowledge). |
| `$7E:0DEB` | [`MODE7_COCKPIT_OVERLAY_ANIM`](knowledge/wram/MODE7_COCKPIT_OVERLAY_ANIM.md) | `u8[12]` | mode7 | Mode 7 Windwalker aircraft cockpit dashboard overlay animation record ($7E:0DEB..$7E:0DF6, 12 bytes; $8E:AE80). |
| `$7E:0DF7` | [`MODE7_SPRITE_CACHE_SLOT_1`](knowledge/wram/MODE7_SPRITE_CACHE_SLOT_1.md) | `u16` | mode7, graphics | Allocated dynamic VRAM 3-slot sprite cache address 1 for flight cockpit overlay ($8E:AE80). |
| `$7E:0DF9` | [`MODE7_SPRITE_CACHE_ALIGN_PAD_1`](knowledge/wram/MODE7_SPRITE_CACHE_ALIGN_PAD_1.md) | `u8[2]` | mode7, unused | 2-byte alignment padding ($7E:0DF9..$7E:0DFA) preceding cutscene dialogue queue (unused to our knowledge). |
| `$7E:0DFB` | [`DIALOGUE_QUEUE`](knowledge/wram/DIALOGUE_QUEUE.md) | `u24[9]` | dialogue, script | Event cutscene script circular FIFO queue (9 slots, stride 3 bytes = 24-bit pointer pc_low, pc_high, bank; $7E:0DFB..$7E:0E15; $8C:C521). |
| `$7E:0E16` | [`CUTSCENE_DIALOGUE_ALIGN_GAP`](knowledge/wram/CUTSCENE_DIALOGUE_ALIGN_GAP.md) | `u8[46]` | dialogue, unused | 46-byte alignment gap ($7E:0E16..$7E:0E43) between cutscene dialogue queue and active BGM track (unused to our knowledge). |
| `$7E:0E44` | [`ACTIVE_BGM_TRACK`](knowledge/wram/ACTIVE_BGM_TRACK.md) | `u16` | audio | Currently loaded and playing background music track ID in SPC700 ($8C:828F, $8C:8328). |
| `$7E:0E46` | [`APU_SOUND_LOAD_ALIGN_PAD`](knowledge/wram/APU_SOUND_LOAD_ALIGN_PAD.md) | `u8` | audio, unused | 1-byte alignment padding ($7E:0E46) between active BGM track and APU sound loading registers (unused to our knowledge). |
| `$7E:0E47` | [`APU_BLOCKS_LEFT`](knowledge/wram/APU_BLOCKS_LEFT.md) | `u16` | audio | Remaining audio data transfer blocks during SPC700 sound loading. |
| `$7E:0E49` | [`APU_DESC_CURSOR`](knowledge/wram/APU_DESC_CURSOR.md) | `u16` | audio, script | Index offset into audio sample block descriptor table. |
| `$7E:0E4B` | [`RESIDENT_SOUNDBANK_ID`](knowledge/wram/RESIDENT_SOUNDBANK_ID.md) | `u16` | audio | Soundbank package resident in SPC700 RAM (low byte); the high byte holds the new id while load_song_soundbank ($8C:8236) streams it ($8C:8266), 0 again at $8C:828B. |
| `$7E:0E4D` | [`ACTIVE_MUSIC_TRACK_ID`](knowledge/wram/ACTIVE_MUSIC_TRACK_ID.md) | `u16` | audio | Currently requested music track ID staged for playback dispatch ($7E:0E4D..$7E:0E4E; $8C:828F). |
| `$7E:0E4F` | [`SOUND_EFFECT_ID`](knowledge/wram/SOUND_EFFECT_ID.md) | `u16` | audio, script | Sound effect ID parameter register staged for APU command byte 0x04 trigger ($7E:0E4F..$7E:0E50; $8C:831D). |
| `$7E:0E51` | [`APU_TRANSFER_DEPTH`](knowledge/wram/APU_TRANSFER_DEPTH.md) | `u16` | audio | APU streaming transfer recursion / active depth counter ($7E:0E51..$7E:0E52; $8C:81D4). |
| `$7E:0E53` | [`APU_TRANSFER_ALIGN_GAP`](knowledge/wram/APU_TRANSFER_ALIGN_GAP.md) | `u8[18]` | audio, unused | 18-byte alignment gap ($7E:0E53..$7E:0E64) between APU transfer depth counter and APU IPC mutex lock (unused to our knowledge). |
| `$7E:0E65` | [`APU_IPC_MUTEX_LOCK`](knowledge/wram/APU_IPC_MUTEX_LOCK.md) | `u16` | system | Queue mutex lock word guarding APU communication during streaming transfers ($8C:81FD, $8C:81D4). |
| `$7E:0E67` | [`DEMO_ABORT_REQUESTED`](knowledge/wram/DEMO_ABORT_REQUESTED.md) | `u16` | system | Title screen demo sequence abort flag, set to 1 if player presses Start or action buttons during title roll ($80:B506). |
| `$7E:0E69` | [`DEMO_ABORT_BUTTON_MASK`](knowledge/wram/DEMO_ABORT_BUTTON_MASK.md) | `u16` | system | Bitmask of joypad buttons eligible to abort the title screen demo sequence ($80:B506). |
| `$7E:0E6B` | [`NMITIMEN_MIRROR`](knowledge/wram/NMITIMEN_MIRROR.md) | `u8` | system | Shadow copy of $4200 ($81 = NMI enabled, Auto-Joypad enabled). |
| `$7E:0E6C` | [`SHOP_MODE_CONFIG_MASK`](knowledge/wram/SHOP_MODE_CONFIG_MASK.md) | `u16` | alchemy, weapon | Shop Subsystem: Shop mode configuration bitmask (bit 2: standard weapons/armor, bit 3: alchemy ingredients satchel) |
| `$7E:0E6E` | [`MODE7_FLIGHT_STATE_ALIGN_PAD`](knowledge/wram/MODE7_FLIGHT_STATE_ALIGN_PAD.md) | `u8[2]` | mode7, unused | 2-byte alignment padding ($7E:0E6E..$7E:0E6F) between shop mode config mask and Mode 7 flight state (unused to our knowledge). |
| `$7E:0E70` | [`MODE7_FLIGHT_STATE`](knowledge/wram/MODE7_FLIGHT_STATE.md) | `u16` | mode7 | Mode 7 Windwalker vehicle flight state (0=ground, 1=takeoff, 2=cruise, 3=landing, 4=touchdown, 5=realm transit; $80:C4A3). |
| `$7E:0E72` | [`MODE7_FLIGHT_PITCH_ANGLE`](knowledge/wram/MODE7_FLIGHT_PITCH_ANGLE.md) | `u16` | mode7 | Mode 7 flight vehicle pitch tilt angle ($80:C412). |
| `$7E:0E74` | [`MODE7_DEPARTURE_MAP_X`](knowledge/wram/MODE7_DEPARTURE_MAP_X.md) | `u8` | mode7, map | Departure map metatile X coordinate for Mode 7 Windwalker transit flight scene ($8C:D8C6, $80:C338). |
| `$7E:0E75` | [`MODE7_DEPARTURE_MAP_Y`](knowledge/wram/MODE7_DEPARTURE_MAP_Y.md) | `u8` | mode7, map | Departure map metatile Y coordinate for Mode 7 Windwalker transit flight scene ($8C:D8C6, $80:C338). |
| `$7E:0E76` | [`MODE7_ARRIVAL_MAP_X`](knowledge/wram/MODE7_ARRIVAL_MAP_X.md) | `u8` | mode7, map | Destination/arrival map metatile X coordinate for Mode 7 Windwalker transit flight scene ($8C:D8C6, $80:C338). |
| `$7E:0E77` | [`MODE7_ARRIVAL_MAP_Y`](knowledge/wram/MODE7_ARRIVAL_MAP_Y.md) | `u8` | mode7, map | Destination/arrival map metatile Y coordinate for Mode 7 Windwalker transit flight scene ($8C:D8C6, $80:C338). |
| `$7E:0E78` | [`MODE7_INITIAL_HEADING_ANGLE`](knowledge/wram/MODE7_INITIAL_HEADING_ANGLE.md) | `u16` | mode7, map | Initial camera heading angle for Mode 7 flight scene (copied to $7E:14B0 in $80:BDCE). |
| `$7E:0E7A` | [`WINDOW_SLIDE_TRANSITION_STEP`](knowledge/wram/WINDOW_SLIDE_TRANSITION_STEP.md) | `u16` | map, dialogue | Dialogue window opening/closing slide transition frame step counter (0..$1C; subtracted from camera horizontal scroll delta in $80:D786, $80:DCE1). |
| `$7E:0E7C` | [`SCENE_TRANSITION_PAUSE_FLAG`](knowledge/wram/SCENE_TRANSITION_PAUSE_FLAG.md) | `u16` | system | Scene transition timer hold/pause flag, clamps counter $7E:14BA at ceiling $7F until fade/scene transition completes ($80:C681, $80:CDF3). |
| `$7E:0E7E` | [`WINDOW_FRAME_SPRITE_MASK`](knowledge/wram/WINDOW_FRAME_SPRITE_MASK.md) | `u16` | graphics, dialogue | Sprite attribute bitmask staging for dialogue window border animation ($80:D786). |
| `$7E:0E80` | [`VM_SCRIPT_CALL_ARG_0`](knowledge/wram/VM_SCRIPT_CALL_ARG_0.md) | `u16` | script | Script call argument 0 parameter staging register, copied to new script thread slot +$0F ($8C:9422). |
| `$7E:0E82` | [`VM_SCRIPT_CALL_ARG_1`](knowledge/wram/VM_SCRIPT_CALL_ARG_1.md) | `u16` | script | Script call argument 1 parameter staging register, copied to new script thread slot +$11 ($8C:9424). |
| `$7E:0E84` | [`VM_SCRIPT_CALL_ARG_2`](knowledge/wram/VM_SCRIPT_CALL_ARG_2.md) | `u16` | script | Script call argument 2 parameter staging register, copied to new script thread slot +$13 ($8C:9426). |
| `$7E:0E86` | [`VM_SCRIPT_CALL_ARG_3`](knowledge/wram/VM_SCRIPT_CALL_ARG_3.md) | `u16` | script | Script call argument 3 parameter staging register, copied to new script thread slot +$15 ($8C:9428). |
| `$7E:0E88` | [`VM_SCRIPT_CALL_ARG_4`](knowledge/wram/VM_SCRIPT_CALL_ARG_4.md) | `u16` | script | Script call argument 4 parameter staging register, copied to new script thread slot +$17 ($8C:9430). |
| `$7E:0E8A` | [`VM_SCRIPT_CALL_ARG_5`](knowledge/wram/VM_SCRIPT_CALL_ARG_5.md) | `u16` | script | Script call argument 5 parameter staging register, copied to new script thread slot +$19 ($8C:9432). |
| `$7E:0E8C` | [`VM_SCRIPT_CALL_ARG_6`](knowledge/wram/VM_SCRIPT_CALL_ARG_6.md) | `u16` | script | Script call argument 6 parameter staging register, copied to new script thread slot +$1B ($8C:9434). |
| `$7E:0E8E` | [`VM_SCRIPT_CALL_ARG_7`](knowledge/wram/VM_SCRIPT_CALL_ARG_7.md) | `u16` | script | Script call argument 7 parameter staging register, copied to new script thread slot +$1D ($8C:9436). |
| `$7E:0E90` | [`VM_SCRIPT_CALL_ARG_8`](knowledge/wram/VM_SCRIPT_CALL_ARG_8.md) | `u16` | script | Script call argument 8 parameter staging register, copied to new script thread slot +$1F ($8C:9438). |
| `$7E:0E92` | [`VM_SCRIPT_CALL_ARG_9`](knowledge/wram/VM_SCRIPT_CALL_ARG_9.md) | `u16` | script | Script call argument 9 parameter staging register, copied to new script thread slot +$21 ($8C:9440). |
| `$7E:0E94` | [`ANIM_SCRIPT_RANDOM_BIT_POOL`](knowledge/wram/ANIM_SCRIPT_RANDOM_BIT_POOL.md) | `u16` | script | Animation script 50% random branch condition bit pool, shifted with LSR, reseeded from RNG when 0 ($90:86FE). |
| `$7E:0E96` | [`ENTITY_SCHEDULER_INTERVAL_TIMER`](knowledge/wram/ENTITY_SCHEDULER_INTERVAL_TIMER.md) | `u16` | entity, system | Entity scheduler PRNG countdown interval timer ($8F:DC49). |
| `$7E:0E98` | [`ENTITY_SCHEDULER_INTERVAL_TARGET`](knowledge/wram/ENTITY_SCHEDULER_INTERVAL_TARGET.md) | `u16` | entity | Entity scheduler secondary jitter countdown timer ($8F:DC34). |
| `$7E:0E9A` | [`ATTACK_SOURCE_ENTITY`](knowledge/wram/ATTACK_SOURCE_ENTITY.md) | `u16` | combat, entity | Entity record address pointer of attacker delivering physical strike or spell effect ($8F:B8E3, $90:DC49). |
| `$7E:0E9C` | [`RAW_STRIKE_POWER`](knowledge/wram/RAW_STRIKE_POWER.md) | `u16` | combat | Raw strike attack power / incoming damage value before defense mitigation ($8F:B8E3, $8F:C06D). |
| `$7E:0E9E` | [`ATTACK_TARGET_ENTITY`](knowledge/wram/ATTACK_TARGET_ENTITY.md) | `u16` | combat, entity | Entity record address pointer of target actor receiving strike ($8F:B8E3, $90:DC49). |
| `$7E:0EA0` | [`DAMAGE_RESULT_REG`](knowledge/wram/DAMAGE_RESULT_REG.md) | `u16` | combat | Calculated damage output value produced by combat math routines. |
| `$7E:0EA2` | [`ROOM_HOOK_0_MASK`](knowledge/wram/ROOM_HOOK_0_MASK.md) | `u16` | map, script | Event trigger bitmask for room hook 1 ($7E:0EA2; script opcode 0x3F in $8C:DD60). |
| `$7E:0EA4` | [`ROOM_HOOK_1_MASK`](knowledge/wram/ROOM_HOOK_1_MASK.md) | `u16` | map, script | Event trigger bitmask for room hook 2 ($7E:0EA4; script opcode 0x3F in $8C:DD60). |
| `$7E:0EA6` | [`ROOM_HOOK_2_MASK`](knowledge/wram/ROOM_HOOK_2_MASK.md) | `u16` | map, script | Event trigger bitmask for room hook 3 ($7E:0EA6; script opcode 0x3F in $8C:DD60). |
| `$7E:0EA8` | [`ROOM_HOOK_3_MASK`](knowledge/wram/ROOM_HOOK_3_MASK.md) | `u16` | map, script | Event trigger bitmask for room hook 4 / Select button switch override ($7E:0EA8; script opcode 0x3F). |
| `$7E:0EAA` | [`ROOM_HOOK_4_MASK`](knowledge/wram/ROOM_HOOK_4_MASK.md) | `u16` | map, script | Event trigger bitmask for room hook 5 / Wings escape hook ($7E:0EAA; script opcode 0x3F). |
| `$7E:0EAC` | [`ROOM_HOOK_0_SCRIPT_ID`](knowledge/wram/ROOM_HOOK_0_SCRIPT_ID.md) | `u16` | map, script | Trigger script ID attached to room hook 1 ($FFFF = none; script opcode 0x3F). |
| `$7E:0EAE` | [`ROOM_HOOK_1_SCRIPT_ID`](knowledge/wram/ROOM_HOOK_1_SCRIPT_ID.md) | `u16` | map, script | Trigger script ID attached to room hook 2 ($FFFF = none; script opcode 0x3F). |
| `$7E:0EB0` | [`ROOM_HOOK_2_SCRIPT_ID`](knowledge/wram/ROOM_HOOK_2_SCRIPT_ID.md) | `u16` | map, script | Trigger script ID attached to room hook 3 ($FFFF = none; script opcode 0x3F). |
| `$7E:0EB2` | [`ROOM_HOOK_3_SCRIPT_ID`](knowledge/wram/ROOM_HOOK_3_SCRIPT_ID.md) | `u16` | map, script | Trigger script ID attached to room hook 4 / Select character switch button override ($FFFF = normal swap; $8C:F17C). |
| `$7E:0EB4` | [`ROOM_HOOK_4_SCRIPT_ID`](knowledge/wram/ROOM_HOOK_4_SCRIPT_ID.md) | `u16` | map, script | Trigger script ID attached to room hook 5 / Wings of Serenity dungeon escape ($FFFF = none; $8C:DD60). |
| `$7E:0EB6` | [`ENTITY_TICK_FLAGS_10`](knowledge/wram/ENTITY_TICK_FLAGS_10.md) | `u16` | entity, script | Latched copy of entity status flags word +$10 during entity physics and gravity tick ($8F:CC1E). |
| `$7E:0EB8` | [`ENTITY_TICK_FLAGS_12`](knowledge/wram/ENTITY_TICK_FLAGS_12.md) | `u16` | entity, script | Latched copy of entity status flags word +$12 during entity physics and gravity tick ($8F:CC1E). |
| `$7E:0EBA` | [`ENTITY_TICK_FLAGS_14`](knowledge/wram/ENTITY_TICK_FLAGS_14.md) | `u16` | entity, script | Latched copy of entity status flags word +$14 during entity physics and gravity tick ($8F:CC1E). |
| `$7E:0EBC` | [`ENTITY_ROUND_ROBIN_CURSOR`](knowledge/wram/ENTITY_ROUND_ROBIN_CURSOR.md) | `u16` | entity | Entity pool round-robin processing cursor pointer ($8F:DCA3). |
| `$7E:0EBE` | [`SPAWN_RING_HEAD_PTR`](knowledge/wram/SPAWN_RING_HEAD_PTR.md) | `u16` | entity | Active scan cursor into 60-slot spawn ring table at $7E:5DC3..$7E:6182 (advanced by 16 bytes in func_8FDDBB). |
| `$7E:0EC0` | [`DEFERRED_SPAWN_BUF`](knowledge/wram/DEFERRED_SPAWN_BUF.md) | `u16` | map, entity | Buffer storing entity spawn parameters queued during map transitions. |
| `$7E:0EC2` | [`PROJECTILE_SLOT_CURSOR`](knowledge/wram/PROJECTILE_SLOT_CURSOR.md) | `u16` | weapon, entity | Active projectile slot pointer into projectile entity buffer $7E:6387..$7E:64E7 (advanced by 44 bytes in $90:DC21). |
| `$7E:0EC4` | [`INPUT_P1_BUTTONS_ALIGN_PAD`](knowledge/wram/INPUT_P1_BUTTONS_ALIGN_PAD.md) | `u8[2]` | system, unused | 2-byte alignment padding ($7E:0EC4..$7E:0EC5) between projectile slot cursor and player 1 held buttons (unused to our knowledge). |
| `$7E:0EC6` | [`INPUT_P1_HELD_BUTTONS`](knowledge/wram/INPUT_P1_HELD_BUTTONS.md) | `u16` | entity, system | Player 1 held button mask filtered for current gameplay mode and entity interaction ($80:8985, $8F:B3D4). |
| `$7E:0EC8` | [`PROJECTILE_ACTIVE_SLOT_0`](knowledge/wram/PROJECTILE_ACTIVE_SLOT_0.md) | `ProjectileSlot` | weapon, script | Active projectile descriptor slot record 0 ($7E:0EC8..$7E:0EE2, 27 bytes; managed in $90:D7CB). |
| `$7E:0EE3` | [`PROJECTILE_ACTIVE_SLOT_1`](knowledge/wram/PROJECTILE_ACTIVE_SLOT_1.md) | `ProjectileSlot` | weapon, script | Active projectile descriptor slot record 1 ($7E:0EE3..$7E:0EFD, 27 bytes; managed in $90:D7CB). |
| `$7E:0EFE` | [`PROJECTILE_ACTIVE_SLOT_2`](knowledge/wram/PROJECTILE_ACTIVE_SLOT_2.md) | `ProjectileSlot` | weapon, script | Active projectile descriptor slot record 2 ($7E:0EFE..$7E:0F18, 27 bytes; managed in $90:D7CB). |
| `$7E:0F19` | [`PROJECTILE_ACTIVE_SLOT_3`](knowledge/wram/PROJECTILE_ACTIVE_SLOT_3.md) | `ProjectileSlot` | weapon, script | Active projectile descriptor slot record 3 ($7E:0F19..$7E:0F33, 27 bytes; managed in $90:D7CB). |
| `$7E:0F34` | [`PROJECTILE_ACTIVE_SLOT_INDEX`](knowledge/wram/PROJECTILE_ACTIVE_SLOT_INDEX.md) | `u16` | weapon, system | Active projectile slot byte offset within slot array ($00, $1B, $36, $51; $90:D7CB). |
| `$7E:0F36` | [`STEP_DITHER_COUNTER`](knowledge/wram/STEP_DITHER_COUNTER.md) | `u16` | entity | Sub-pixel walk step dither accumulator for smooth actor movement. |
| `$7E:0F38` | [`CAMERA_SUBPIXEL_ACC`](knowledge/wram/CAMERA_SUBPIXEL_ACC.md) | `u16` | map | Camera sub-pixel tracking fractional accumulator. |
| `$7E:0F3A` | [`VRAM_DMA_LOCK`](knowledge/wram/VRAM_DMA_LOCK.md) | `u16` | graphics, system | Active transfer counter and lock word for deferred VRAM DMA queue ($7E:0F3A..$7E:0F3B; $80:8A86, $90:8E40). |
| `$7E:0F3C` | [`CGRAM_DMA_LOCK`](knowledge/wram/CGRAM_DMA_LOCK.md) | `u16` | graphics, system | Active transfer counter and lock word for deferred CGRAM DMA queue ($7E:0F3C..$7E:0F3D; $80:8A40, $8C:D172). |
| `$7E:0F3E` | [`ENTITY_PTR_BOY`](knowledge/wram/ENTITY_PTR_BOY.md) | `u16` | boy, entity, script | Pointer to the Boy's entity record ($7E:4E89), set at new game ($8F:80B9); the script expression sub-op `$50` (`boy()`). |
| `$7E:0F40` | [`ENTITY_PTR_DOG`](knowledge/wram/ENTITY_PTR_DOG.md) | `u16` | dog, entity | Entity Subsystem: Address pointer to Companion (Dog) entity slot in WRAM (defaults to $4F37; initialized in $8F:8144) |
| `$7E:0F42` | [`CAMERA_TARGET_ACTOR_PTR`](knowledge/wram/CAMERA_TARGET_ACTOR_PTR.md) | `entity` | boy, map | Pointer to primary actor entity record tracked by camera (points to Boy at $7E:4E89). |
| `$7E:0F44` | [`VIEWPORT_SCROLL_Y`](knowledge/wram/VIEWPORT_SCROLL_Y.md) | `u16` | map | Vertical world coordinate of top-left camera viewport boundary. |
| `$7E:0F46` | [`ROOM_TILE_WIDTH`](knowledge/wram/ROOM_TILE_WIDTH.md) | `u16` | map | Room map collision/terrain grid width in 8x8 character tiles (row pitch stride = metatile width * 2; $90:8EE2, $8F:B8E3). |
| `$7E:0F48` | [`VIEWPORT_CULL_MIN_X`](knowledge/wram/VIEWPORT_CULL_MIN_X.md) | `u16` | map, entity | Room-edge inset box for movement probes (14/7 px inside the room), set once per room by $90:8F80; not the camera. |
| `$7E:0F4A` | [`VIEWPORT_CULL_MIN_Y`](knowledge/wram/VIEWPORT_CULL_MIN_Y.md) | `u16` | map, entity | Camera viewport frustum top bound for 2D entity and shadow culling ($90:9545). |
| `$7E:0F4C` | [`VIEWPORT_CULL_MAX_X`](knowledge/wram/VIEWPORT_CULL_MAX_X.md) | `u16` | map, entity | Camera viewport frustum right bound for 2D entity and shadow culling ($90:9545). |
| `$7E:0F4E` | [`VIEWPORT_CULL_MAX_Y`](knowledge/wram/VIEWPORT_CULL_MAX_Y.md) | `u16` | map, entity | Camera viewport frustum bottom bound for 2D entity and shadow culling ($90:9545). |
| `$7E:0F50` | [`PROJECTILE_CLUSTER_HEADING`](knowledge/wram/PROJECTILE_CLUSTER_HEADING.md) | `u16` | weapon, system | Projectile cluster trajectory heading angle register ($90:D68F, $90:D7C0). |
| `$7E:0F52` | [`PROJECTILE_CLUSTER_MASTER_ENTITY`](knowledge/wram/PROJECTILE_CLUSTER_MASTER_ENTITY.md) | `u16` | weapon, entity | Projectile cluster master owner entity ID / tracking anchor ($90:D68F). |
| `$7E:0F54` | [`PROJECTILE_CLUSTER_TRACKING_DIST`](knowledge/wram/PROJECTILE_CLUSTER_TRACKING_DIST.md) | `u16` | weapon, system | Projectile cluster tracking distance threshold / accumulator ($90:D68F). |
| `$7E:0F56` | [`PROJECTILE_CLUSTER_TRACKING_VELOCITY`](knowledge/wram/PROJECTILE_CLUSTER_TRACKING_VELOCITY.md) | `u16` | weapon, system | Projectile cluster tracking angular velocity step ($90:D68F). |
| `$7E:0F58` | [`PROJECTILE_CLUSTER_TRACKING_RATE`](knowledge/wram/PROJECTILE_CLUSTER_TRACKING_RATE.md) | `u16` | weapon, system | Projectile cluster tracking acceleration / rate parameter ($90:D68F). |
| `$7E:0F5A` | [`ROOM_PPU_MIRROR_ALIGN_GAP`](knowledge/wram/ROOM_PPU_MIRROR_ALIGN_GAP.md) | `u8[38]` | map, graphics, unused | 38-byte alignment gap ($7E:0F5A..$7E:0F7F) between projectile cluster tracking registers and room PPU screen mirrors (unused to our knowledge). |
| `$7E:0F80` | [`MAP_TM_MIRROR`](knowledge/wram/MAP_TM_MIRROR.md) | `u8` | graphics, map | Main screen designation register mirror ($212C) loaded from room header byte ($90:8EE2). |
| `$7E:0F81` | [`MAP_TS_MIRROR`](knowledge/wram/MAP_TS_MIRROR.md) | `u8` | graphics, map | Sub screen designation register mirror ($212D) loaded from room header byte ($90:8EE2). |
| `$7E:0F82` | [`MAP_CGADSUB_MIRROR`](knowledge/wram/MAP_CGADSUB_MIRROR.md) | `u8` | graphics, map | Color math addition/subtraction designation register mirror ($2131) loaded from room header byte ($90:8EE2). |
| `$7E:0F83` | [`MAP_CGWSEL_MIRROR`](knowledge/wram/MAP_CGWSEL_MIRROR.md) | `u8` | graphics, map | Color math control register mirror ($2130) loaded from room header byte ($90:8EE2). |
| `$7E:0F84` | [`MAP_HEADER_FLAGS`](knowledge/wram/MAP_HEADER_FLAGS.md) | `u16` | weather, map | Bitmask flags loaded from map header (layering, Mode 7, weather). |
| `$7E:0F86` | [`ROOM_TRIGGER_ORIGIN_X`](knowledge/wram/ROOM_TRIGGER_ORIGIN_X.md) | `u16` | map, script | Room step-on trigger origin X offset in 16px metatile cells ($8F:ACB1). |
| `$7E:0F88` | [`ROOM_TRIGGER_ORIGIN_Y`](knowledge/wram/ROOM_TRIGGER_ORIGIN_Y.md) | `u16` | map, script | Room step-on trigger origin Y offset in 16px metatile cells ($8F:ACB1). |
| `$7E:0F8A` | [`LOADED_PALETTE_TAG`](knowledge/wram/LOADED_PALETTE_TAG.md) | `u16` | graphics, map | Identifier of currently loaded map palette family. |
| `$7E:0F8C` | [`MINIMAP_RADAR_WINDOW_TOP`](knowledge/wram/MINIMAP_RADAR_WINDOW_TOP.md) | `u16` | map | Top metatile row of the streamed BG1 window ((BG1VOFS+1)>>4; $90:98FA); not a minimap. |
| `$7E:0F8E` | [`MINIMAP_RADAR_WINDOW_BOTTOM`](knowledge/wram/MINIMAP_RADAR_WINDOW_BOTTOM.md) | `u16` | map | Bottom metatile row of the streamed BG1 window (top+15); not a minimap. |
| `$7E:0F90` | [`MINIMAP_RADAR_WINDOW_LEFT`](knowledge/wram/MINIMAP_RADAR_WINDOW_LEFT.md) | `u16` | map | Left metatile column of the streamed BG1 window (BG1HOFS>>4; $90:98FA); not a minimap. |
| `$7E:0F92` | [`MINIMAP_RADAR_WINDOW_RIGHT`](knowledge/wram/MINIMAP_RADAR_WINDOW_RIGHT.md) | `u16` | map | Right metatile column of the streamed BG1 window (left+$0FAC); not a minimap. |
| `$7E:0F94` | [`BG2_METATILE_VIEWPORT_TOP`](knowledge/wram/BG2_METATILE_VIEWPORT_TOP.md) | `u16` | graphics, map | BG2 visible metatile viewport top row boundary (ppu_shadow_bg2vofs / 16; $90:93DF). |
| `$7E:0F96` | [`BG2_METATILE_VIEWPORT_BOTTOM`](knowledge/wram/BG2_METATILE_VIEWPORT_BOTTOM.md) | `u16` | map | BG2 visible metatile viewport bottom row boundary (top + 15; $90:93DF). |
| `$7E:0F98` | [`BG2_METATILE_VIEWPORT_LEFT`](knowledge/wram/BG2_METATILE_VIEWPORT_LEFT.md) | `u16` | graphics, map | BG2 visible metatile viewport left column boundary (ppu_shadow_bg2hofs / 16; $90:93DF). |
| `$7E:0F9A` | [`BG2_METATILE_VIEWPORT_RIGHT`](knowledge/wram/BG2_METATILE_VIEWPORT_RIGHT.md) | `u16` | map | BG2 visible metatile viewport right column boundary (left + screen width; $90:93DF). |
| `$7E:0F9C` | [`ROOM_PALETTES_STREAM_PTR`](knowledge/wram/ROOM_PALETTES_STREAM_PTR.md) | `u16` | graphics, map | Byte offset inside room header data stream [$8B] where tile palette definitions are stored ($90:8EE2). |
| `$7E:0F9E` | [`ROOM_PALETTE_CYCLES_STREAM_PTR`](knowledge/wram/ROOM_PALETTE_CYCLES_STREAM_PTR.md) | `u16` | graphics, map | Byte offset inside room header data stream [$8B] where animated palette cycle definitions are stored ($90:8EE2). |
| `$7E:0FA0` | [`ROOM_TILE_GRAPHICS_STREAM_PTR`](knowledge/wram/ROOM_TILE_GRAPHICS_STREAM_PTR.md) | `u16` | graphics, map | Byte offset inside room header data stream [$8B] where compressed tile graphics are stored ($90:8EE2). |
| `$7E:0FA2` | [`ROOM_OBJECTS_TABLE_STREAM_PTR`](knowledge/wram/ROOM_OBJECTS_TABLE_STREAM_PTR.md) | `u16` | map | Byte offset inside room header data stream [$8B] where Section 3 Object Pointer Table is stored ($90:8EE2, $90:B3D6). |
| `$7E:0FA4` | [`ROOM_COLLISION_STREAM_PTR`](knowledge/wram/ROOM_COLLISION_STREAM_PTR.md) | `u16` | map | Byte offset inside room header data stream [$8B] where compressed terrain and collision data are stored ($90:8EE2). |
| `$7E:0FA6` | [`ROOM_METATILE_STREAM_PTR`](knowledge/wram/ROOM_METATILE_STREAM_PTR.md) | `u16` | map | Byte offset inside room header data stream [$8B] where metatile definitions are stored ($90:8EE2). |
| `$7E:0FA8` | [`ROOM_COMPRESSED_DATA_SIZE`](knowledge/wram/ROOM_COMPRESSED_DATA_SIZE.md) | `u16` | map | Compressed data byte size for collision and terrain stream passed to decompression dispatcher ($90:8EE2). |
| `$7E:0FAA` | [`ROOM_METATILE_COUNT_BYTES`](knowledge/wram/ROOM_METATILE_COUNT_BYTES.md) | `u16` | map | Total metatile definition byte length ((metatiles / 3) * 4) in current room blob ($90:8EE2). |
| `$7E:0FAC` | [`ROOM_PALETTE_GROUP_ID`](knowledge/wram/ROOM_PALETTE_GROUP_ID.md) | `u16` | graphics, map | Width of the streamed tilemap window in metatiles (17; 28/32 in HDMA effect rooms); not a palette group. |
| `$7E:0FAE` | [`ROOM_OBJECTS_COUNT`](knowledge/wram/ROOM_OBJECTS_COUNT.md) | `u16` | map | Count of interactive / destructible environmental map objects in current room ($90:8EE2). |
| `$7E:0FB0` | [`TERRAIN_MUT_ACTIVE`](knowledge/wram/TERRAIN_MUT_ACTIVE.md) | `u16` | system | Set non-zero when animated terrain tile mutations are active in current room. |
| `$7E:0FB2` | [`STATUS_EFFECTS_FRAME_COUNTER`](knowledge/wram/STATUS_EFFECTS_FRAME_COUNTER.md) | `u16` | combat | Frame counter incremented during status effects per-frame tick dispatcher ($91:BB95, $91:8007). |
| `$7E:0FB4` | [`CELL_COLLISION_FLAGS`](knowledge/wram/CELL_COLLISION_FLAGS.md) | `u16` | map, script | Current 16x16 metatile cell collision properties and impassable edges. |
| `$7E:0FB6` | [`MINIMAP_SCREEN_DEST_OFFSET`](knowledge/wram/MINIMAP_SCREEN_DEST_OFFSET.md) | `u16` | map | Screen tile buffer byte offset for minimap metatile rasterization ($90:A5D0). |
| `$7E:0FB8` | [`MINIMAP_TARGET_CELL_X`](knowledge/wram/MINIMAP_TARGET_CELL_X.md) | `u16` | map | Candidate cell X coordinate evaluated during minimap rasterization ($90:A5D0). |
| `$7E:0FBA` | [`MINIMAP_TARGET_CELL_Y`](knowledge/wram/MINIMAP_TARGET_CELL_Y.md) | `u16` | map | Candidate cell Y coordinate evaluated during minimap rasterization ($90:A5D0). |
| `$7E:0FBC` | [`MINIMAP_BOUND_ORIGIN_X`](knowledge/wram/MINIMAP_BOUND_ORIGIN_X.md) | `u16` | map | Minimap rasterization bounding box origin X coordinate restored at start of each line wrap ($90:A582, $90:A653). |
| `$7E:0FBE` | [`MINIMAP_BOUND_MAX_X`](knowledge/wram/MINIMAP_BOUND_MAX_X.md) | `u16` | map | Minimap rasterization bounding box right / maximum X coordinate ($90:A585, $90:A669). |
| `$7E:0FC0` | [`MINIMAP_BOUND_MAX_Y`](knowledge/wram/MINIMAP_BOUND_MAX_Y.md) | `u16` | map | Minimap rasterization bounding box bottom / maximum Y coordinate ($7E:0FC0..$7E:0FC1; $90:A596, $90:A674). |
| `$7E:0FC2` | [`MINIMAP_VRAM_DMA_TRIGGER`](knowledge/wram/MINIMAP_VRAM_DMA_TRIGGER.md) | `u16` | graphics, map | Flag set when dynamic minimap updates are ready to stream to VRAM via DMA ($90:A5D0). |
| `$7E:0FC4` | [`ROOM_METATILE_LAYER_BIT_DEPTH`](knowledge/wram/ROOM_METATILE_LAYER_BIT_DEPTH.md) | `u16` | map | Room metatile bitplane layer count / bit depth parameter in 2D Markov grid decoder ($8C:9B60, $90:8EE2). |
| `$7E:0FC6` | [`MINIMAP_POI_TYPE_INDEX`](knowledge/wram/MINIMAP_POI_TYPE_INDEX.md) | `u16` | map, script | Point of Interest type descriptor index during radar blip scanning ($90:A650). |
| `$7E:0FC8` | [`MINIMAP_METATILE_PROP_THRESH`](knowledge/wram/MINIMAP_METATILE_PROP_THRESH.md) | `u16` | map | Metatile transparency property threshold key for radar clipping ($90:A4EC). |
| `$7E:0FCA` | [`MINIMAP_POI_SCAN_OFFSET`](knowledge/wram/MINIMAP_POI_SCAN_OFFSET.md) | `u16` | map | Scan offset into ROM POI table in bank $90 ($90:A650). |
| `$7E:0FCC` | [`MINIMAP_POI_OFFSET_X`](knowledge/wram/MINIMAP_POI_OFFSET_X.md) | `u16` | map | World X translation offset applied to POI radar blip coordinates ($90:A650). |
| `$7E:0FCE` | [`MINIMAP_POI_OFFSET_Y`](knowledge/wram/MINIMAP_POI_OFFSET_Y.md) | `u16` | map | World Y translation offset applied to POI radar blip coordinates ($90:A650). |
| `$7E:0FD0` | [`GRASS_BATCH_CURSOR`](knowledge/wram/GRASS_BATCH_CURSOR.md) | `u16` | map | Cursor index into pending cuttable grass tile swap queue. |
| `$7E:0FD2` | [`GRASS_SWAP_QUEUE`](knowledge/wram/GRASS_SWAP_QUEUE.md) | `u16[24]` | map, graphics | Coordinate swap queue holding 24 tile indices converted from standing to cut grass ($7E:0FD2..$7E:1001, 24 words). |
| `$7E:1002` | [`GRASS_SWAP_TILEMAP_OFFSETS`](knowledge/wram/GRASS_SWAP_TILEMAP_OFFSETS.md) | `u16[24]` | graphics, map | VRAM/metatile tilemap buffer byte offsets for 24 cuttable grass swap animation slots ($7E:1002..$7E:1031; $90:A6D2, $90:A6F7). |
| `$7E:1032` | [`GRASS_SWAP_PACKED_COORDS`](knowledge/wram/GRASS_SWAP_PACKED_COORDS.md) | `u16[24]` | map, graphics | Packed grid coordinates (X or Y << 8) for 24 cuttable grass swap animation slots ($7E:1032..$7E:1061; $90:A6D2, $90:A6F7). |
| `$7E:1062` | [`ROOM_METATILE_TRIGGER_COUNT`](knowledge/wram/ROOM_METATILE_TRIGGER_COUNT.md) | `u16` | map, script | Byte length of the room's step-on trigger table, 6 bytes per record (measured 2026-11-10; $90:8EE2, $8F:B0B3). |
| `$7E:1064` | [`ROOM_METATILE_TRIGGER_TABLE_PTR`](knowledge/wram/ROOM_METATILE_TRIGGER_TABLE_PTR.md) | `u24` | map, script | 24-bit pointer to the room's step-on trigger table in ROM ($7E:1064..$7E:1066; $90:8EE2). |
| `$7E:1067` | [`ROOM_STEP_TRIGGER_COUNT`](knowledge/wram/ROOM_STEP_TRIGGER_COUNT.md) | `u16` | map, script | Byte length of the room's B-trigger table, 6 bytes per record (measured 2026-11-10). |
| `$7E:1069` | [`ROOM_STEP_TRIGGER_TABLE_PTR`](knowledge/wram/ROOM_STEP_TRIGGER_TABLE_PTR.md) | `u24` | map, script | 24-bit pointer to the room's B-trigger table in ROM (measured 2026-11-10). |
| `$7E:106C` | [`ACTIVE_ANIM_CHANNELS`](knowledge/wram/ACTIVE_ANIM_CHANNELS.md) | `u16` | map | Count of actively cycling animated tile channels on current map. |
| `$7E:106E` | [`ANIM_TILE_VRAM_BASE`](knowledge/wram/ANIM_TILE_VRAM_BASE.md) | `u16` | graphics | Destination base address in VRAM where animated tiles are DMA-streamed. |
| `$7E:1070` | [`ENTITY_BATCH_TARGET_CAPACITY`](knowledge/wram/ENTITY_BATCH_TARGET_CAPACITY.md) | `u16` | entity | Number of awake entities, Boy and Dog included (2 at room setup; +1 wake, -1 sleep). |
| `$7E:1072` | [`ROOM_SPAWNED_ENTITY_COUNT`](knowledge/wram/ROOM_SPAWNED_ENTITY_COUNT.md) | `u16` | map, entity | Current count of spawned active entities in room ($8F:B0A5). |
| `$7E:1074` | [`ROOM_CUMULATIVE_SPAWN_COUNT`](knowledge/wram/ROOM_CUMULATIVE_SPAWN_COUNT.md) | `u16` | map, entity | Cumulative entity spawn counter for active room visit ($8F:B0A8). |
| `$7E:1076` | [`ENTITY_BATCH_PROCESS_LIMIT`](knowledge/wram/ENTITY_BATCH_PROCESS_LIMIT.md) | `u16` | entity | Awake-entity budget (6, lowered to 5 on lag; $8F:DC34); not a per-frame slot count. |
| `$7E:1078` | [`ENTITY_SCHEDULER_FRAME_LATCH`](knowledge/wram/ENTITY_SCHEDULER_FRAME_LATCH.md) | `u16` | entity | Entity scheduler frame counter snapshot latch ($8F:DC53). |
| `$7E:107A` | [`ENTITY_SCHEDULER_LAG_COUNTER`](knowledge/wram/ENTITY_SCHEDULER_LAG_COUNTER.md) | `u16` | entity | Entity scheduler consecutive frame drop counter ($8F:DC73). |
| `$7E:107C` | [`ENTITY_SCHEDULER_STABILITY_TIMER`](knowledge/wram/ENTITY_SCHEDULER_STABILITY_TIMER.md) | `u16` | entity, system | Entity scheduler uninterrupted framerate stability timer ($8F:DC5E). |
| `$7E:107E` | [`TERRAIN_FRAME_INDICES`](knowledge/wram/TERRAIN_FRAME_INDICES.md) | `u8[80]` | system | Current animation frame indices for 80 terrain mutation channel slots. |
| `$7E:10CE` | [`TERRAIN_THRESHOLDS`](knowledge/wram/TERRAIN_THRESHOLDS.md) | `u8[80]` | map | Frame threshold limits for 80 terrain mutation channel slots. |
| `$7E:111E` | [`TERRAIN_COUNTDOWNS`](knowledge/wram/TERRAIN_COUNTDOWNS.md) | `u8[80]` | system | Cycle countdown delay timers for 80 terrain mutation channel slots. |
| `$7E:116E` | [`VRAM_SINGLE_TILE_RATE_LIMIT`](knowledge/wram/VRAM_SINGLE_TILE_RATE_LIMIT.md) | `u16` | graphics | Maximum number of individual 16-bit tile updates dispatched to VRAM per VBlank. |
| `$7E:1170` | [`VRAM_SINGLE_TILE_QUEUE_TAIL`](knowledge/wram/VRAM_SINGLE_TILE_QUEUE_TAIL.md) | `u16` | graphics | Read cursor index of individual tile VRAM update ring buffer. |
| `$7E:1172` | [`VRAM_SINGLE_TILE_QUEUE_HEAD`](knowledge/wram/VRAM_SINGLE_TILE_QUEUE_HEAD.md) | `u16` | graphics | Write cursor index of individual tile VRAM update ring buffer. |
| `$7E:1174` | [`VRAM_SINGLE_TILE_DATA_QUEUE`](knowledge/wram/VRAM_SINGLE_TILE_DATA_QUEUE.md) | `u16[64]` | graphics | Buffered 16-bit tile word values to be written to $2118 in VBlank (64 words = 128 bytes). |
| `$7E:11F4` | [`VRAM_SINGLE_TILE_ADDR_QUEUE`](knowledge/wram/VRAM_SINGLE_TILE_ADDR_QUEUE.md) | `u16[64]` | graphics | Destination VRAM word addresses written to $2116 corresponding to tile data queue (64 words = 128 bytes). |
| `$7E:1274` | [`CURRENT_MUSIC_TRACK`](knowledge/wram/CURRENT_MUSIC_TRACK.md) | `u16` | audio | Active background music track index; initialized to $FFFF at reset. |
| `$7E:1276` | [`SPRITE_FREE_LIST_HEAD`](knowledge/wram/SPRITE_FREE_LIST_HEAD.md) | `u16` | graphics | Head pointer to available free nodes in dynamic sprite allocation pool (`$7E:50A7..$7E:512F`). |
| `$7E:1278` | [`SOUND_COMMAND_MAILBOX`](knowledge/wram/SOUND_COMMAND_MAILBOX.md) | `u16` | audio | Sound effect request mailbox evaluated by APU interface routines. |
| `$7E:127A` | [`PALETTE_CYCLE_STEP_0`](knowledge/wram/PALETTE_CYCLE_STEP_0.md) | `u16` | graphics | Animated palette cycle channel 0 step / state register ($90:CC1A, $90:D494). |
| `$7E:127C` | [`PALETTE_CYCLE_STEP_1`](knowledge/wram/PALETTE_CYCLE_STEP_1.md) | `u16` | graphics | Animated palette cycle channel 1 step / state register ($90:CC1A, $90:D494). |
| `$7E:127E` | [`PALETTE_CYCLE_STEP_2`](knowledge/wram/PALETTE_CYCLE_STEP_2.md) | `u16` | graphics | Animated palette cycle channel 2 step / state register ($90:CC1A, $90:D494). |
| `$7E:1280` | [`PALETTE_CYCLE_STEP_3`](knowledge/wram/PALETTE_CYCLE_STEP_3.md) | `u16` | graphics | Animated palette cycle channel 3 step / state register ($90:CC1A, $90:D494). |
| `$7E:1282` | [`PALETTE_CYCLE_STEP_4`](knowledge/wram/PALETTE_CYCLE_STEP_4.md) | `u16` | graphics | Animated palette cycle channel 4 step / state register ($90:CC1A, $90:D494). |
| `$7E:1284` | [`PALETTE_CYCLE_STEP_5`](knowledge/wram/PALETTE_CYCLE_STEP_5.md) | `u16` | boy, graphics | Animated palette cycle channel 5 / boy sprite palette ID register ($90:CC1A, $90:CF3A). |
| `$7E:1286` | [`PALETTE_CYCLE_STEP_6`](knowledge/wram/PALETTE_CYCLE_STEP_6.md) | `u16` | dog, graphics | Animated palette cycle channel 6 / dog sprite palette ID register ($90:CC1A, $90:CF3A). |
| `$7E:1288` | [`SPRITE_VRAM_CACHE`](knowledge/wram/SPRITE_VRAM_CACHE.md) | `u16[3]` | graphics, entity | Dynamic VRAM allocation slot pointers for active actor sprite graphics (3 words = 6 bytes). |
| `$7E:128E` | [`CGRAM_DMA_QUEUE_HEAD`](knowledge/wram/CGRAM_DMA_QUEUE_HEAD.md) | `u16` | graphics | Head index cursor of deferred CGRAM DMA queue (`$7E:1292`, stride 7, wraps at 32 entries = `$00E0`). |
| `$7E:1290` | [`TILE_FAMILY_ANIM_TIMER`](knowledge/wram/TILE_FAMILY_ANIM_TIMER.md) | `u16` | graphics, system | Master frame tick counter synchronizing tile palette cycling and water animation. |
| `$7E:1292` | [`CGRAM_DMA_QUEUE`](knowledge/wram/CGRAM_DMA_QUEUE.md) | `CgramQueueEntry[32]` | graphics, script | 32-slot deferred CGRAM DMA queue (7 bytes per descriptor: src offset, bank, CGRAM dest, count; $80:8A40). |
| `$7E:1372` | [`PALETTE_ANIM_COLOR_INDEX`](knowledge/wram/PALETTE_ANIM_COLOR_INDEX.md) | `u16[16]` | graphics | Target CGRAM base color indices for 16 active dynamic palette color animation channels ($7E:1372..$7E:1391, 32 bytes; $90:D520, $90:D5CF). |
| `$7E:1392` | [`PALETTE_ANIM_INTERP_A`](knowledge/wram/PALETTE_ANIM_INTERP_A.md) | `u16[16]` | graphics | Primary color interpolation step accumulators for 16 dynamic palette animation channels ($7E:1392..$7E:13B1, 32 bytes; $90:D59E). |
| `$7E:13B2` | [`PALETTE_ANIM_INTERP_B`](knowledge/wram/PALETTE_ANIM_INTERP_B.md) | `u16[16]` | graphics | Secondary color interpolation step limits for 16 dynamic palette animation channels ($7E:13B2..$7E:13D1, 32 bytes; $90:D5A1). |
| `$7E:13D2` | [`PALETTE_ANIM_RATE`](knowledge/wram/PALETTE_ANIM_RATE.md) | `u16[16]` | graphics, script | Signed transition rate and direction flags for 16 dynamic palette animation channels ($7E:13D2..$7E:13F1, 32 bytes; cleared in $90:CC12; $90:D596). |
| `$7E:13F2` | [`PALETTE_ANIM_FRAME_TIMER`](knowledge/wram/PALETTE_ANIM_FRAME_TIMER.md) | `u16[32]` | graphics, system | Per-channel frame countdown timers and phase buffers for dynamic palette color channels ($7E:13F2..$7E:1431, 64 bytes; $90:D58E). |
| `$7E:1432` | [`ANIM_FRAME_HOLD_TIMER`](knowledge/wram/ANIM_FRAME_HOLD_TIMER.md) | `u16` | system | Remaining frame duration before advancing to next animated tile phase. |
| `$7E:1434` | [`PENDING_TALK_TARGET_PTR`](knowledge/wram/PENDING_TALK_TARGET_PTR.md) | `u16` | entity | Pointer to NPC actor entity currently being spoken to or interacted with ($FFFF = none). |
| `$7E:1436` | [`DISPATCH_MUTEX_LOCK`](knowledge/wram/DISPATCH_MUTEX_LOCK.md) | `u16` | script | Event and script callback queue re-entrancy mutex lock ($8C:CFFD). |
| `$7E:1438` | [`OAM_HIGH_WATER_MARK`](knowledge/wram/OAM_HIGH_WATER_MARK.md) | `u16` | graphics | Previous frame low OAM buffer byte cursor used for stale sprite hiding with $E0E0 ($80:8FF6). |
| `$7E:143A` | [`CAMERA_SECONDARY_ACTOR_PTR`](knowledge/wram/CAMERA_SECONDARY_ACTOR_PTR.md) | `entity` | dog, map | Pointer to secondary actor entity considered for camera framing (Dog at $7E:4F37). |
| `$7E:143C` | [`PLAYER_DAMAGE_REACTION_ACTOR`](knowledge/wram/PLAYER_DAMAGE_REACTION_ACTOR.md) | `u16` | combat, entity | Pointer to player actor entity receiving damage or status reactions ($90:8554, $80:8D49). |
| `$7E:143E` | [`DOG_SPRITE_ANIM_RECORD`](knowledge/wram/DOG_SPRITE_ANIM_RECORD.md) | `u16` | dog, graphics | Companion Mechanics: Low 16-bit address offset of current Dog sprite animation record in ROM bank $CB ($8F:9471, $8D:883E). |
| `$7E:1440` | [`DOG_SPRITE_ANIM_BANK`](knowledge/wram/DOG_SPRITE_ANIM_BANK.md) | `u8` | dog, graphics | Companion Mechanics: ROM bank byte ($CB) of current Dog sprite animation record far pointer ($8F:9471, $8D:8843). |
| `$7E:1441` | [`DOG_FORM_ANIM_ALIGN_PAD`](knowledge/wram/DOG_FORM_ANIM_ALIGN_PAD.md) | `u8[2]` | dog, unused | 2-byte alignment buffer ($7E:1441..$7E:1442) between Dog sprite animation far pointer and Dog form animation records (unused to our knowledge). |
| `$7E:1443` | [`DOG_FORM_ANIM_9`](knowledge/wram/DOG_FORM_ANIM_9.md) | `u16` | dog, graphics | Companion Mechanics: the form's animation record slot 9 ($8F:9471 copies entry +$1C-+$26 to $1443-$144D; sprites/dog-forms.ts). Not the HUD portrait: that sprite goes to $4FA5 (routines/dog_load_form.md, v0.377.0). |
| `$7E:1445` | [`DOG_FORM_ANIM_10`](knowledge/wram/DOG_FORM_ANIM_10.md) | `u16` | dog | Companion Mechanics: the form's animation record slot 10 ($8F:9471). |
| `$7E:1447` | [`dog_form_base_magic_def`](knowledge/wram/dog_form_base_magic_def.md) | `u16` | dog | Active dog breed base magic defense stat ($8F:94F0). |
| `$7E:1449` | [`dog_form_base_evade`](knowledge/wram/dog_form_base_evade.md) | `u16` | dog, combat | Active dog breed base evasion percentage stat ($8F:94F7). |
| `$7E:144B` | [`dog_form_base_hit_rate`](knowledge/wram/dog_form_base_hit_rate.md) | `u16` | dog | Active dog breed base accuracy / hit rate stat ($8F:94FE). |
| `$7E:144D` | [`dog_form_scent_radius`](knowledge/wram/dog_form_scent_radius.md) | `u16` | dog, alchemy | Active dog breed ingredient sniffing radius / detection range in pixels ($8F:9505). |
| `$7E:144F` | [`COMPANION_TARGET_ENTITY_PTR`](knowledge/wram/COMPANION_TARGET_ENTITY_PTR.md) | `u16` | dog, alchemy | Companion and alchemy priority target entity pointer in WRAM ($8E:919F, $8F:D796, $8F:D7CF). |
| `$7E:1451` | [`ALCHEMY_TARGET_MONSTER_TYPE`](knowledge/wram/ALCHEMY_TARGET_MONSTER_TYPE.md) | `u16` | alchemy, combat | Species / monster type identifier of entity selected for offensive alchemy spell targeting ($8E:91A6). |
| `$7E:1453` | [`DOG_ROAM_TARGET_X`](knowledge/wram/DOG_ROAM_TARGET_X.md) | `u16` | dog, graphics | Companion Mechanics: Target world X coordinate in pixels for Dog companion autonomous roaming / sniffing waypoint ($8F:D029, $8F:DCF9, $8F:DD92). |
| `$7E:1455` | [`DOG_ROAM_TARGET_Y`](knowledge/wram/DOG_ROAM_TARGET_Y.md) | `u16` | dog, graphics | Companion Mechanics: Target world Y coordinate in pixels for Dog companion autonomous roaming / sniffing waypoint ($8F:D02E, $8F:DD0B, $8F:DDA0). |
| `$7E:1457` | [`DOG_ROAM_TARGET_PLANE`](knowledge/wram/DOG_ROAM_TARGET_PLANE.md) | `u16` | dog, graphics | Companion Mechanics: Target elevation / plane height for Dog companion autonomous roaming waypoint ($8F:D033, $8F:DDA9). |
| `$7E:1459` | [`DOG_ROAM_WAYPOINT_ACTIVE`](knowledge/wram/DOG_ROAM_WAYPOINT_ACTIVE.md) | `u16` | dog, graphics | Companion Mechanics: Flag indicating whether an autonomous roaming / sniffing destination waypoint is currently active (0 = inactive/arrived, 1 = active; $8F:DCD0, $8F:DD22, $8F:DDAF). |
| `$7E:145B` | [`DOG_ROAM_TARGET_TILE_INDEX`](knowledge/wram/DOG_ROAM_TARGET_TILE_INDEX.md) | `u16` | dog, graphics | Companion Mechanics: Map terrain collision / tile array word offset corresponding to Dog sniffing roaming waypoint ($8F:DCD5, $8F:DD84). |
| `$7E:145D` | [`RING_MENU_WEAPON_CURSOR_SPRITE_OFFSET`](knowledge/wram/RING_MENU_WEAPON_CURSOR_SPRITE_OFFSET.md) | `u16` | weapon, graphics | Weapon Ring Menu: Sprite animation record offset for weapon submenu selection cursor arrow ($8F:92BB, $8D:8805). |
| `$7E:145F` | [`RING_MENU_WEAPON_CURSOR_SPRITE_BANK`](knowledge/wram/RING_MENU_WEAPON_CURSOR_SPRITE_BANK.md) | `u8` | weapon, graphics | Weapon Ring Menu: ROM bank byte ($CA) for weapon submenu selection cursor arrow sprite animation record ($8F:92BB, $8D:880A). |
| `$7E:1460` | [`dog_sniff_target_x`](knowledge/wram/dog_sniff_target_x.md) | `u16` | dog, alchemy | World X coordinate of hidden ingredient / sniff spot currently alerted by Dog ($8F:822A). |
| `$7E:1462` | [`dog_sniff_target_y`](knowledge/wram/dog_sniff_target_y.md) | `u16` | dog, alchemy | World Y coordinate of hidden ingredient / sniff spot currently alerted by Dog ($8F:8231). |
| `$7E:1464` | [`DOG_FORAGE_COOLDOWN_TIMER`](knowledge/wram/DOG_FORAGE_COOLDOWN_TIMER.md) | `u16` | dog, system | Companion Mechanics: Frame countdown timer governing Dog foraging and sniffing idle behavior (reloaded with 1200..3247 random frames in $8F:B297; checked in $8F:CD88, $8F:CE91). |
| `$7E:1466` | [`DOG_FORAGE_ALERT_ANIM_STEP`](knowledge/wram/DOG_FORAGE_ALERT_ANIM_STEP.md) | `u16` | dog, script | Companion Mechanics: Animation step and direction state index triggered when foraging timer expires and sniff spot is detected ($8F:CEB3, $8F:CEB9). |
| `$7E:1468` | [`BAZOOKA_BASE_ATTACK_POWER`](knowledge/wram/BAZOOKA_BASE_ATTACK_POWER.md) | `u16` | weapon, combat | Combat Subsystem: Unmitigated base attack power for Bazooka weapon cartridge ammunition ($8F:846C, $8F:C038). |
| `$7E:146A` | [`COMPANION_TETHER_MAX_STEPS`](knowledge/wram/COMPANION_TETHER_MAX_STEPS.md) | `u16` | dog | Companion Mechanics: Maximum breadcrumb step history distance before Dog companion abandons current action to follow Boy ($8F:D1C7, $8F:D203). |
| `$7E:146C` | [`COMPANION_TETHER_FOLLOW_STEPS`](knowledge/wram/COMPANION_TETHER_FOLLOW_STEPS.md) | `u16` | dog | Companion Mechanics: Breadcrumb step distance threshold to initiate walking follow behavior toward Boy ($8F:D1CD, $8F:D237). |
| `$7E:146E` | [`COMPANION_TETHER_WARN_STEPS`](knowledge/wram/COMPANION_TETHER_WARN_STEPS.md) | `u16` | dog, script | Companion Mechanics: Breadcrumb step distance threshold triggering tether warning / leash tension check ($8F:D1D3, $8F:D20E). |
| `$7E:1470` | [`COMPANION_TETHER_MIN_STEPS`](knowledge/wram/COMPANION_TETHER_MIN_STEPS.md) | `u16` | dog | Companion Mechanics: Minimum breadcrumb step distance to maintain idle proximity to Boy ($8F:D1D9, $8F:D214). |
| `$7E:1472` | [`MODE7_CAMERA_ALIGN_PAD`](knowledge/wram/MODE7_CAMERA_ALIGN_PAD.md) | `u8[2]` | mode7, unused | 2-byte alignment buffer ($7E:1472..$7E:1473) between companion tether limits and Mode 7 flight registers (unused to our knowledge). |
| `$7E:1474` | [`MODE7_CAMERA_PAN_MAX_SPEED`](knowledge/wram/MODE7_CAMERA_PAN_MAX_SPEED.md) | `u16` | mode7, map | Mode 7 Flight: Camera panning and scrolling maximum velocity ceiling parameter ($80:C5DE, $80:C641, $80:CD67). |
| `$7E:1476` | [`MODE7_CAMERA_PAN_ACCEL`](knowledge/wram/MODE7_CAMERA_PAN_ACCEL.md) | `u16` | mode7, map | Mode 7 Flight: Camera panning subpixel acceleration and friction step rate ($80:BCB4, $80:C64A, $80:CE7A). |
| `$7E:1478` | [`MODE7_CAMERA_PAN_DEFAULT_SPEED`](knowledge/wram/MODE7_CAMERA_PAN_DEFAULT_SPEED.md) | `u16` | mode7, map | Mode 7 Flight: Camera default cruise pan speed copied to max speed register during flight ($80:BCBA, $80:C4B8, $80:C5DB). |
| `$7E:147A` | [`MODE7_CAMERA_BOOST_SPEED`](knowledge/wram/MODE7_CAMERA_BOOST_SPEED.md) | `u16` | mode7, map | Mode 7 Flight: Camera turbo boost maximum velocity threshold ($80:BCC0). |
| `$7E:147C` | [`MODE7_CAMERA_VELOCITY_MAX`](knowledge/wram/MODE7_CAMERA_VELOCITY_MAX.md) | `u16` | mode7, map | Mode 7 Flight: Maximum forward velocity clamp ceiling ($80:BCC6, $80:C609, $80:CD8A). |
| `$7E:147E` | [`MODE7_CAMERA_VELOCITY_MIN`](knowledge/wram/MODE7_CAMERA_VELOCITY_MIN.md) | `u16` | mode7, map | Mode 7 Flight: Minimum forward velocity floor clamp ($80:BCCC, $80:C625, $80:CDA6). |
| `$7E:1480` | [`MODE7_CAMERA_ACCEL_RATE`](knowledge/wram/MODE7_CAMERA_ACCEL_RATE.md) | `u16` | mode7, map | Mode 7 Flight: Forward flight velocity acceleration and braking step rate ($80:BCD2, $80:C606, $80:CD87). |
| `$7E:1482` | [`MODE7_CAMERA_PARAMS_PADDING`](knowledge/wram/MODE7_CAMERA_PARAMS_PADDING.md) | `u8[6]` | mode7, unused | 6-byte alignment buffer ($7E:1482..$7E:1487) in Mode 7 flight camera parameters table (unused to our knowledge). |
| `$7E:1488` | [`MODE7_DEPARTURE_MAP_OFFSET_X`](knowledge/wram/MODE7_DEPARTURE_MAP_OFFSET_X.md) | `u16` | mode7, map | Mode 7 Flight: Takeoff departure map tile X coordinate offset ($80:BCEB, $80:BE37). |
| `$7E:148A` | [`MODE7_DEPARTURE_MAP_OFFSET_Y`](knowledge/wram/MODE7_DEPARTURE_MAP_OFFSET_Y.md) | `u16` | mode7, map | Mode 7 Flight: Takeoff departure map tile Y coordinate offset ($80:BCF1, $80:BE3C). |
| `$7E:148C` | [`MODE7_ARRIVAL_MAP_OFFSET_X`](knowledge/wram/MODE7_ARRIVAL_MAP_OFFSET_X.md) | `u16` | mode7, map | Mode 7 Flight: Landing destination map tile X coordinate offset ($80:BCF7, $80:BE51). |
| `$7E:148E` | [`MODE7_ARRIVAL_MAP_OFFSET_Y`](knowledge/wram/MODE7_ARRIVAL_MAP_OFFSET_Y.md) | `u16` | mode7, map | Mode 7 Flight: Landing destination map tile Y coordinate offset ($80:BCFD, $80:BE56). |
| `$7E:1490` | [`MODE7_CAMERA_WAYPOINT_X`](knowledge/wram/MODE7_CAMERA_WAYPOINT_X.md) | `u16` | mode7, map | Mode 7 Flight: Autonomous flight cutscene navigation waypoint target X coordinate ($80:BD03, $80:BE6B). |
| `$7E:1492` | [`MODE7_CAMERA_WAYPOINT_Y`](knowledge/wram/MODE7_CAMERA_WAYPOINT_Y.md) | `u16` | mode7, map | Mode 7 Flight: Autonomous flight cutscene navigation waypoint target Y coordinate ($80:BD09, $80:BE70). |
| `$7E:1494` | [`MODE7_CAMERA_WAYPOINT_ALT`](knowledge/wram/MODE7_CAMERA_WAYPOINT_ALT.md) | `u16` | mode7, map | Mode 7 Flight: Autonomous flight cutscene navigation waypoint target altitude ($80:BD0F, $80:C0D2). |
| `$7E:1496` | [`MODE7_CAMERA_WAYPOINT_HEADING`](knowledge/wram/MODE7_CAMERA_WAYPOINT_HEADING.md) | `u16` | mode7, map | Mode 7 Flight: Autonomous flight cutscene navigation waypoint target heading angle ($80:BD15, $80:C0D7). |
| `$7E:1498` | [`MODE7_SHADOW_MATRIX_M7A`](knowledge/wram/MODE7_SHADOW_MATRIX_M7A.md) | `u16` | mode7 | Mode 7 Flight: Computed shadow projection matrix M7A parameter for aircraft ground shadow ($80:BC93, $80:C22E, $80:D8C7). |
| `$7E:149A` | [`MODE7_SHADOW_MATRIX_M7B`](knowledge/wram/MODE7_SHADOW_MATRIX_M7B.md) | `u16` | mode7 | Mode 7 Flight: Computed shadow projection matrix M7B parameter for aircraft ground shadow ($80:BC99, $80:C23A, $80:D900). |
| `$7E:149C` | [`MODE7_SHADOW_MATRIX_M7C`](knowledge/wram/MODE7_SHADOW_MATRIX_M7C.md) | `u16` | mode7 | Mode 7 Flight: Computed shadow projection matrix M7C parameter for aircraft ground shadow ($80:BC9F, $80:C246, $80:D8F9). |
| `$7E:149E` | [`MODE7_SHADOW_MATRIX_M7D`](knowledge/wram/MODE7_SHADOW_MATRIX_M7D.md) | `u16` | mode7 | Mode 7 Flight: Computed shadow projection matrix M7D parameter for aircraft ground shadow ($80:BCA5, $80:C252, $80:D8CA). |
| `$7E:14A0` | [`MODE7_CENTER_X`](knowledge/wram/MODE7_CENTER_X.md) | `u16` | mode7, graphics | Mode 7 Flight: Horizon center pivot X coordinate for PPU M7X center-of-rotation register ($80:DCDD, $80:DD18, $80:DFBD). |
| `$7E:14A2` | [`MODE7_CENTER_Y`](knowledge/wram/MODE7_CENTER_Y.md) | `u16` | mode7, graphics | Mode 7 Flight: Horizon center pivot Y coordinate for PPU M7Y center-of-rotation register ($80:DCC1, $80:DCFB, $80:DFC9). |
| `$7E:14A4` | [`MODE7_AIRCRAFT_POS_X`](knowledge/wram/MODE7_AIRCRAFT_POS_X.md) | `u16` | mode7, graphics | Mode 7 Flight: Aircraft sprite screen position X coordinate ($80:DAC1, $80:DAE4). |
| `$7E:14A6` | [`MODE7_AIRCRAFT_POS_Y`](knowledge/wram/MODE7_AIRCRAFT_POS_Y.md) | `u16` | mode7, graphics | Mode 7 Flight: Aircraft sprite screen position Y coordinate ($80:DABA, $80:DAF4). |
| `$7E:14A8` | [`MODE7_AIRCRAFT_VEL_X`](knowledge/wram/MODE7_AIRCRAFT_VEL_X.md) | `u16` | mode7 | Mode 7 Flight: Aircraft banking motion horizontal velocity vector ($80:DADD, $80:DAE9, $80:DB11). |
| `$7E:14AA` | [`MODE7_AIRCRAFT_VEL_Y`](knowledge/wram/MODE7_AIRCRAFT_VEL_Y.md) | `u16` | mode7 | Mode 7 Flight: Aircraft banking motion vertical velocity vector ($80:DAED, $80:DAF9, $80:DB1C). |
| `$7E:14AC` | [`MODE7_CAMERA_WORLD_X`](knowledge/wram/MODE7_CAMERA_WORLD_X.md) | `u16` | mode7, map | Mode 7 Flight: World map camera viewpoint anchor X coordinate ($80:BCAB, $80:BD5E, $80:D812). |
| `$7E:14AE` | [`MODE7_CAMERA_WORLD_Y`](knowledge/wram/MODE7_CAMERA_WORLD_Y.md) | `u16` | mode7, map | Mode 7 Flight: World map camera viewpoint anchor Y coordinate ($80:BCAE, $80:BD73, $80:D83A). |
| `$7E:14B0` | [`MODE7_CAMERA_HEADING_ANGLE`](knowledge/wram/MODE7_CAMERA_HEADING_ANGLE.md) | `u16` | mode7, map | Mode 7 Flight: Active camera compass heading angle (0..31 directional index; initialized from $7E:0E78 in $80:BDCE; $80:C492, $80:CE35). |
| `$7E:14B2` | [`MODE7_CAMERA_PAN_VELOCITY`](knowledge/wram/MODE7_CAMERA_PAN_VELOCITY.md) | `u16` | mode7, map | Mode 7 Flight: Camera subpixel lateral panning velocity accumulated from player steering inputs ($80:BCE0, $80:C4DA, $80:C638, $80:CDCE). |
| `$7E:14B4` | [`MODE7_AIRCRAFT_ROLL_ANGLE`](knowledge/wram/MODE7_AIRCRAFT_ROLL_ANGLE.md) | `u16` | mode7, graphics | Mode 7 Flight: Aircraft banking roll angle index used to select banked flying sprite frames ($80:C992, $80:DCEA, $80:DEEB). |
| `$7E:14B6` | [`MODE7_CAMERA_FORWARD_VELOCITY`](knowledge/wram/MODE7_CAMERA_FORWARD_VELOCITY.md) | `u16` | mode7, map | Mode 7 Flight: Camera forward flight velocity ($80:BCE3, $80:C600, $80:CD81). |
| `$7E:14B8` | [`MODE7_CAMERA_PITCH_ALTITUDE`](knowledge/wram/MODE7_CAMERA_PITCH_ALTITUDE.md) | `u16` | mode7, map | Camera elevation pitch and altitude parameter during Mode 7 flight navigation ($80:D23A). |
| `$7E:14BA` | [`MODE7_SCENE_TRANSITION_STEP`](knowledge/wram/MODE7_SCENE_TRANSITION_STEP.md) | `u16` | mode7, map | Mode 7 Flight: Scene transition progress step counter (increments toward $9F / $7F threshold before room load commit; $80:BCDA, $80:C672, $80:CDF3). |
| `$7E:14BC` | [`MODE7_AIRCRAFT_SPRITE_Y`](knowledge/wram/MODE7_AIRCRAFT_SPRITE_Y.md) | `u16` | mode7, graphics | Mode 7 Flight: Screen Y pixel coordinate for rendering aircraft vehicle sprite ($80:DED9). |
| `$7E:14BE` | [`MODE7_AIRCRAFT_SPRITE_X`](knowledge/wram/MODE7_AIRCRAFT_SPRITE_X.md) | `u16` | mode7, graphics | Mode 7 Flight: Screen X pixel coordinate for rendering aircraft vehicle sprite ($80:D8BA, $80:DF3B). |
| `$7E:14C0` | [`MODE7_AIRCRAFT_SPRITE_FRAME`](knowledge/wram/MODE7_AIRCRAFT_SPRITE_FRAME.md) | `u16` | mode7, graphics | Mode 7 Flight: Active sprite animation frame index for aircraft vehicle ($80:DF30). |
| `$7E:14C2` | [`MODE7_PARAM_M7A_OR_SCROLL_X`](knowledge/wram/MODE7_PARAM_M7A_OR_SCROLL_X.md) | `u16` | mode7, graphics | Horizontal scroll coordinate / PPU matrix M7A parameter for Mode 7 flight rendering ($80:BE09). |
| `$7E:14C4` | [`MODE7_PARAM_M7B_OR_SCROLL_Y`](knowledge/wram/MODE7_PARAM_M7B_OR_SCROLL_Y.md) | `u16` | mode7, graphics | Vertical scroll coordinate / PPU matrix M7B parameter for Mode 7 flight rendering ($80:BE09). |
| `$7E:14C6` | [`MODE7_AIRCRAFT_YAW_HEADING`](knowledge/wram/MODE7_AIRCRAFT_YAW_HEADING.md) | `u16` | mode7, map | Mode 7 aircraft flight yaw heading angle index (0..31 compass angle; $80:CFA9, $80:D58B). |
| `$7E:14C8` | [`MODE7_CAMERA_FOCAL_DISTANCE`](knowledge/wram/MODE7_CAMERA_FOCAL_DISTANCE.md) | `u16` | mode7, map | Mode 7 camera focal distance and altitude scaling factor added to ROM trig tables ($80:CFA9, $80:D113). |
| `$7E:14CA` | [`WEATHER_SIM_STATE_ALIGN_PAD`](knowledge/wram/WEATHER_SIM_STATE_ALIGN_PAD.md) | `u8[16]` | weather, unused | 16-byte alignment buffer ($7E:14CA..$7E:14D9) between Mode 7 flight registers and weather particle simulation state (unused to our knowledge). |
| `$7E:14DA` | [`WEATHER_PARTICLE_PREV_SCROLL_DELTA_X`](knowledge/wram/WEATHER_PARTICLE_PREV_SCROLL_DELTA_X.md) | `u16` | weather | Weather Particle Engine: Previous horizontal screen scroll delta for relative motion compensation ($91:C3B9). |
| `$7E:14DC` | [`WEATHER_PARTICLE_PREV_SCROLL_DELTA_Y`](knowledge/wram/WEATHER_PARTICLE_PREV_SCROLL_DELTA_Y.md) | `u16` | weather | Weather Particle Engine: Previous vertical screen scroll delta for relative motion compensation ($91:C2B0, $91:C3BD). |
| `$7E:14DE` | [`WEATHER_PARTICLE_WIND_BASE_RATE`](knowledge/wram/WEATHER_PARTICLE_WIND_BASE_RATE.md) | `u16` | weather | Weather Particle Engine: Baseline horizontal wind drift velocity rate ($91:C2B6, $91:C2DE, $91:C3B4). |
| `$7E:14E0` | [`WEATHER_PARTICLE_ANIM_FRAME`](knowledge/wram/WEATHER_PARTICLE_ANIM_FRAME.md) | `u16` | weather, graphics | Weather Particle Engine: Current animation phase / frame index for cycling weather sprites ($91:C2BC, $91:C2D1, $91:C377). |
| `$7E:14E2` | [`WEATHER_PRESET_ALIGN_PAD`](knowledge/wram/WEATHER_PRESET_ALIGN_PAD.md) | `u8[2]` | weather, unused | 2-byte alignment buffer ($7E:14E2..$7E:14E3) in weather simulation registers (unused to our knowledge). |
| `$7E:14E4` | [`WEATHER_SYSTEM_ACTIVE_FLAG`](knowledge/wram/WEATHER_SYSTEM_ACTIVE_FLAG.md) | `u16` | weather, system | Weather Particle Engine: Master ambient weather particle system active flag (0 = inactive, 1 = active; $90:8EAD, $91:C38B, $91:C3A7). |
| `$7E:14E6` | [`WEATHER_CAMERA_PREV_X`](knowledge/wram/WEATHER_CAMERA_PREV_X.md) | `u16` | weather, map | Previous horizontal camera scroll baseline coordinate for weather particle relative motion ($91:BE05). |
| `$7E:14E8` | [`WEATHER_CAMERA_CURR_X`](knowledge/wram/WEATHER_CAMERA_CURR_X.md) | `u16` | weather, map | Current horizontal camera scroll baseline coordinate for weather particle relative motion ($91:BE05). |
| `$7E:14EA` | [`WEATHER_PARTICLE_PREV_Y`](knowledge/wram/WEATHER_PARTICLE_PREV_Y.md) | `u16` | weather | Weather particle simulation previous Y baseline coordinate word ($91:BE42). |
| `$7E:14EC` | [`WEATHER_PARAMS_ALIGN_PAD`](knowledge/wram/WEATHER_PARAMS_ALIGN_PAD.md) | `u16` | weather, unused | 2-byte alignment buffer ($7E:14EC..$7E:14ED) following weather particle velocity and timer (unused to our knowledge). |
| `$7E:14EE` | [`WEATHER_PARTICLE_SLOT_INDEX`](knowledge/wram/WEATHER_PARTICLE_SLOT_INDEX.md) | `u16` | weather | Active weather particle slot pointer offset |
| `$7E:14F0` | [`WEATHER_WIND_ALIGN_PAD`](knowledge/wram/WEATHER_WIND_ALIGN_PAD.md) | `u8[4]` | weather, unused | 4-byte alignment buffer ($7E:14F0..$7E:14F3) between weather particle slot index and wind control parameters (unused to our knowledge). |
| `$7E:14F4` | [`WEATHER_PARTICLE_CURRENT_WIND`](knowledge/wram/WEATHER_PARTICLE_CURRENT_WIND.md) | `u16` | weather | Weather Particle Engine: Current horizontal wind drift rate, indexed into pattern block table ($91:BDF4, $91:BF69, $91:C122). |
| `$7E:14F6` | [`WEATHER_PARTICLE_TARGET_WIND`](knowledge/wram/WEATHER_PARTICLE_TARGET_WIND.md) | `u16` | weather | Weather Particle Engine: Target horizontal wind drift rate toward which current wind accelerates ($91:BDF7, $91:BF7C, $91:BFAD). |
| `$7E:14F8` | [`WEATHER_PARTICLE_WIND_CHANGE_TIMER`](knowledge/wram/WEATHER_PARTICLE_WIND_CHANGE_TIMER.md) | `u16` | weather, system | Weather Particle Engine: Frame countdown timer until next random target wind drift shift ($91:BE00, $91:BF8D, $91:BF9D). |
| `$7E:14FA` | [`WEATHER_PARTICLE_WIND_STEP_TIMER`](knowledge/wram/WEATHER_PARTICLE_WIND_STEP_TIMER.md) | `u16` | weather, system | Weather Particle Engine: Frame interval countdown timer between incremental wind drift adjustments ($91:BF6E, $91:BF76). |
| `$7E:14FC` | [`WEATHER_PARTICLE_CACHED_TILE_OFFSET`](knowledge/wram/WEATHER_PARTICLE_CACHED_TILE_OFFSET.md) | `u16` | weather, graphics | Weather Particle Engine: Cached VRAM tile pattern block offset to suppress redundant DMA uploads ($91:BDEE, $91:C12A). |
| `$7E:14FE` | [`WEATHER_PARTICLE_SPAWN_CURSOR`](knowledge/wram/WEATHER_PARTICLE_SPAWN_CURSOR.md) | `u16` | weather, entity | Cyclic write cursor into 256-byte weather particle simulation state buffer ($91:C15B, wraps at $0100). |
| `$7E:1500` | [`WEATHER_PARTICLE_STATE_PAD`](knowledge/wram/WEATHER_PARTICLE_STATE_PAD.md) | `u8[12]` | weather, unused | 12-byte alignment buffer ($7E:1500..$7E:150B) following weather particle simulation state (unused to our knowledge). |
| `$7E:150C` | [`COLOR_CROSSFADE_ACTIVE_FLAG`](knowledge/wram/COLOR_CROSSFADE_ACTIVE_FLAG.md) | `u16` | graphics | Color palette cross-fade animation active execution flag ($90:D481). |
| `$7E:150E` | [`COLOR_CROSSFADE_CURRENT_STEP`](knowledge/wram/COLOR_CROSSFADE_CURRENT_STEP.md) | `u16` | graphics | Palette cross-fade progress counter ($90:D481). |
| `$7E:1510` | [`COLOR_CROSSFADE_TARGET_STEP`](knowledge/wram/COLOR_CROSSFADE_TARGET_STEP.md) | `u16` | graphics | Palette cross-fade target threshold step ($90:D481). |
| `$7E:1512` | [`COLOR_CROSSFADE_STEP_RATE`](knowledge/wram/COLOR_CROSSFADE_STEP_RATE.md) | `u16` | graphics | Palette cross-fade step increment / speed rate ($90:D481). |
| `$7E:1514` | [`HDMA_RASTER_TIMING_ALIGN_PAD`](knowledge/wram/HDMA_RASTER_TIMING_ALIGN_PAD.md) | `u8[2]` | graphics, unused | 2-byte alignment buffer ($7E:1514..$7E:1515) preceding HDMA scanline raster timing registers (unused to our knowledge). |
| `$7E:1516` | [`HDMA_DOUBLE_BUFFER_ALIGN_PAD`](knowledge/wram/HDMA_DOUBLE_BUFFER_ALIGN_PAD.md) | `u16` | graphics, unused | 4-byte alignment buffer ($7E:1516..$7E:1519) preceding HDMA scanline double-buffer Bank A (unused to our knowledge). |
| `$7E:1518` | [`HDMA_ACTIVE_BANK_PTR`](knowledge/wram/HDMA_ACTIVE_BANK_PTR.md) | `u16` | graphics | Pointer to active double-buffer table feeding HDMA channel tables. |
| `$7E:151A` | [`HDMA_BUFFER_A`](knowledge/wram/HDMA_BUFFER_A.md) | `u8[36]` | graphics | HDMA scanline table double-buffer Bank A (color gradients / perspective lines). |
| `$7E:153E` | [`HDMA_BUFFER_B`](knowledge/wram/HDMA_BUFFER_B.md) | `u8[36]` | graphics | HDMA scanline table double-buffer Bank B (color gradients / perspective lines). |
| `$7E:1562` | [`BARRIER_WINDOW_PRE_PAD`](knowledge/wram/BARRIER_WINDOW_PRE_PAD.md) | `u8[8]` | graphics, unused | 8-byte alignment buffer ($7E:1562..$7E:1569) preceding barrier force field window aperture registers (unused to our knowledge). |
| `$7E:156A` | [`BARRIER_WINDOW_CENTER_X`](knowledge/wram/BARRIER_WINDOW_CENTER_X.md) | `u16` | combat, graphics | Force field barrier circular spotlight window center screen X coordinate ($91:C773). |
| `$7E:156C` | [`BARRIER_SCANLINE_OFFSET`](knowledge/wram/BARRIER_SCANLINE_OFFSET.md) | `u16` | combat, graphics | Barrier and spotlight window scanline offset accumulator ($91:C899). |
| `$7E:156E` | [`BARRIER_APERTURE_RADIUS_X`](knowledge/wram/BARRIER_APERTURE_RADIUS_X.md) | `u16` | combat, graphics | Barrier Force Field Window: Current scanline horizontal radius component computed via circle rasterization algorithm ($91:C938, $91:C969, $91:CA15). |
| `$7E:1570` | [`BARRIER_APERTURE_RADIUS_Y`](knowledge/wram/BARRIER_APERTURE_RADIUS_Y.md) | `u16` | combat, graphics | Barrier Force Field Window: Current scanline vertical radius component computed via circle rasterization algorithm ($91:C93F, $91:C966, $91:CA3F). |
| `$7E:1572` | [`BARRIER_BRESENHAM_ERR`](knowledge/wram/BARRIER_BRESENHAM_ERR.md) | `u16` | combat, graphics | Barrier Force Field Window: Midpoint / Bresenham circle rasterization algorithm decision parameter / error accumulator ($91:C94A, $91:C973, $91:C99E). |
| `$7E:1574` | [`BARRIER_BRESENHAM_DX`](knowledge/wram/BARRIER_BRESENHAM_DX.md) | `u16` | combat, graphics | Barrier Force Field Window: Midpoint / Bresenham circle rasterization algorithm delta X increment ($91:C950, $91:C97C, $91:C9A6). |
| `$7E:1576` | [`BARRIER_BRESENHAM_DY`](knowledge/wram/BARRIER_BRESENHAM_DY.md) | `u16` | combat, graphics | Barrier Force Field Window: Midpoint / Bresenham circle rasterization algorithm delta Y increment ($91:C95F, $91:C98A, $91:C9B0). |
| `$7E:1578` | [`BARRIER_WINDOW_INNER_PAD`](knowledge/wram/BARRIER_WINDOW_INNER_PAD.md) | `u8[4]` | graphics, unused | 4-byte alignment buffer ($7E:1578..$7E:157B) within barrier window aperture calculations (unused to our knowledge). |
| `$7E:157C` | [`BARRIER_WINDOW_MODE`](knowledge/wram/BARRIER_WINDOW_MODE.md) | `u16` | combat | Barrier spotlight window aperture shape mode (0 = circular, 1 = inverted; $91:C7F5). |
| `$7E:157E` | [`BARRIER_WINDOW_EXPANSION_RATE`](knowledge/wram/BARRIER_WINDOW_EXPANSION_RATE.md) | `u16` | combat, graphics | Force field barrier circular window radial expansion step delta ($91:C788). |
| `$7E:1580` | [`BARRIER_WINDOW_ALIGN_PAD`](knowledge/wram/BARRIER_WINDOW_ALIGN_PAD.md) | `u16` | graphics, unused | 2-byte alignment buffer ($7E:1580..$7E:1581) preceding barrier window quadrant coordinates (unused to our knowledge). |
| `$7E:1582` | [`BARRIER_WINDOW_QUADRANT_1_X`](knowledge/wram/BARRIER_WINDOW_QUADRANT_1_X.md) | `u16` | combat, graphics | Barrier Force Field Window: Calculated right aperture boundary scanline coordinate for quadrant 1 ($91:C9DF, $91:CA5F). |
| `$7E:1584` | [`BARRIER_WINDOW_QUADRANT_2_X`](knowledge/wram/BARRIER_WINDOW_QUADRANT_2_X.md) | `u16` | combat, graphics | Barrier Force Field Window: Calculated left aperture boundary scanline coordinate for quadrant 2 ($91:CA08, $91:CA89). |
| `$7E:1586` | [`BARRIER_WINDOW_QUADRANT_3_X`](knowledge/wram/BARRIER_WINDOW_QUADRANT_3_X.md) | `u16` | combat, graphics | Barrier Force Field Window: Calculated right aperture boundary scanline coordinate for quadrant 3 ($91:C9C9, $91:CA35). |
| `$7E:1588` | [`BARRIER_WINDOW_QUADRANT_4_X`](knowledge/wram/BARRIER_WINDOW_QUADRANT_4_X.md) | `u16` | combat, graphics | Barrier Force Field Window: Calculated left aperture boundary scanline coordinate for quadrant 4 ($91:C9F2, $91:CA0B). |
| `$7E:158A` | [`PPU_WINDOW_LOGIC_FLAG`](knowledge/wram/PPU_WINDOW_LOGIC_FLAG.md) | `u16` | graphics | PPU window mask logic toggle flag (written to $0122..$0124; $91:C7F5). |
| `$7E:158C` | [`HDMA_WINDOW_BUFFER_XOR_MASK`](knowledge/wram/HDMA_WINDOW_BUFFER_XOR_MASK.md) | `u16` | graphics | Toggle XOR mask ($6869 ^ $6A7D = $0214) for double-buffered window coordinates ($91:C7F5). |
| `$7E:158E` | [`HDMA_WINDOW_ACTIVE_BUFFER_PTR`](knowledge/wram/HDMA_WINDOW_ACTIVE_BUFFER_PTR.md) | `u16` | graphics | Active double-buffer base pointer for HDMA window coordinates ($7E:6869 or $7E:6A7D; $91:C899). |
| `$7E:1590` | [`HDMA_WINDOW_ACTIVE_BUFFER_END`](knowledge/wram/HDMA_WINDOW_ACTIVE_BUFFER_END.md) | `u16` | graphics | Active window coordinate buffer end boundary pointer ($158E + $0200; $91:C899). |
| `$7E:1592` | [`ALCHEMY_PALETTE_CYCLE_SPEED`](knowledge/wram/ALCHEMY_PALETTE_CYCLE_SPEED.md) | `u16` | alchemy, graphics | Alchemy VFX: Frame interval duration reload value governing palette color cycling speed ($91:A892, $91:A92A). |
| `$7E:1594` | [`SPELL_PROJECTILE_ORIGIN_X`](knowledge/wram/SPELL_PROJECTILE_ORIGIN_X.md) | `u16` | alchemy, weapon | Alchemy Subsystem: Screen origin X pixel coordinate for casting spell projectile animations ($91:A8D4, $91:A9DA). |
| `$7E:1596` | [`SPELL_PROJECTILE_ORIGIN_Y`](knowledge/wram/SPELL_PROJECTILE_ORIGIN_Y.md) | `u16` | alchemy, weapon | Alchemy Subsystem: Screen origin Y pixel coordinate for casting spell projectile animations ($91:A8DA, $91:AA6D). |
| `$7E:1598` | [`ALCHEMY_PALETTE_CYCLE_STEPS`](knowledge/wram/ALCHEMY_PALETTE_CYCLE_STEPS.md) | `u16[26]` | alchemy, graphics | Alchemy VFX: Array of 26 16-bit color cycle step delta words for alchemy spell screen palette cycling ($7E:1598..$7E:15CB, 52 bytes; $91:A8A3, $91:A95D). |
| `$7E:15CC` | [`DYNAMIC_COLLISION_OVERRIDE_COUNT`](knowledge/wram/DYNAMIC_COLLISION_OVERRIDE_COUNT.md) | `u16` | map | Number of active dynamic collision grid metatile overrides in current room. |
| `$7E:15CE` | [`ALCHEMY_PALETTE_CYCLE_TIMER`](knowledge/wram/ALCHEMY_PALETTE_CYCLE_TIMER.md) | `u16` | alchemy, graphics | Alchemy VFX: Frame countdown timer decrementing toward next palette cycle step transition ($91:A92D, $91:AA7F). |
| `$7E:15D0` | [`ANIM_SCRIPT_OAM_BUFFER_OFFSET`](knowledge/wram/ANIM_SCRIPT_OAM_BUFFER_OFFSET.md) | `u16` | graphics, script | Animation Script VM: Byte cursor offset into OAM shadow queue buffer ($08CC), advancing in 4-byte steps ($90:8A40, $90:8A51). |
| `$7E:15D2` | [`AUDIO_MUTING_FLAG`](knowledge/wram/AUDIO_MUTING_FLAG.md) | `u16` | audio, script | Set non-zero to silence background music during dramatic cutscenes. |
| `$7E:15D4` | [`BG_TILEMAP_UPLOAD_ALIGN_PAD`](knowledge/wram/BG_TILEMAP_UPLOAD_ALIGN_PAD.md) | `u16` | graphics, unused | 2-byte alignment buffer ($7E:15D4..$7E:15D5) between map mute flag and BG tilemap DMA source offset (unused to our knowledge). |
| `$7E:15D6` | [`BG_TILEMAP_DMA_DEST`](knowledge/wram/BG_TILEMAP_DMA_DEST.md) | `u16[18]` | graphics, map | PPU Subsystem: VRAM destination word addresses for 18 BG tilemap row/col DMA transfers ($80:829C). |
| `$7E:15FA` | [`BG_TILEMAP_DMA_ALIGN_PAD`](knowledge/wram/BG_TILEMAP_DMA_ALIGN_PAD.md) | `u16[33]` | graphics, unused | 6-byte alignment buffer ($7E:15FA..$7E:15FF) following BG tilemap DMA destination address array (unused to our knowledge). |
| `$7E:163C` | [`VRAM_TILE_DMA_QUEUE`](knowledge/wram/VRAM_TILE_DMA_QUEUE.md) | `u32` | graphics | Deferred VRAM tile pattern DMA upload request queue; processed during VBlank. |
| `$7E:1640` | [`BG_SEAM_DMA_DEST_2`](knowledge/wram/BG_SEAM_DMA_DEST_2.md) | `u16` | graphics, map | PPU Subsystem: VRAM destination word address 2 for BG metatile seam DMA transfer |
| `$7E:1642` | [`SPRITE_VRAM_DEST_ALIGN_PAD`](knowledge/wram/SPRITE_VRAM_DEST_ALIGN_PAD.md) | `u16` | graphics, unused | 2-byte alignment buffer ($7E:1642..$7E:1643) preceding sprite VRAM destination table slot 2 (unused to our knowledge). |
| `$7E:1644` | [`SPRITE_VRAM_DEST_SLOTS`](knowledge/wram/SPRITE_VRAM_DEST_SLOTS.md) | `u16[11]` | graphics | Dynamic sprite VRAM slot destination word address table (11 slots: 2..12, $80:82D6, $80:9734, $80:901B). |
| `$7E:165A` | [`VRAM_MACROTILE_DMA_DEST_TAIL`](knowledge/wram/VRAM_MACROTILE_DMA_DEST_TAIL.md) | `u16[7]` | graphics, system | PPU Subsystem: Tail array of 7 VRAM destination word addresses for dynamic 16x16 sprite macro-tile DMA upload queue (slots 15..21, $7E:165A..$7E:1667; $80:82CA, $80:9734). |
| `$7E:1668` | [`SPRITE_AUDIO_ARENA_GAP`](knowledge/wram/SPRITE_AUDIO_ARENA_GAP.md) | `u8[2456]` | system, unused | 2,456-byte alignment arena ($7E:1668..$7E:1FFF) between dynamic sprite DMA staging queues and audio attenuation registers (unused to our knowledge). |
| `$7E:2000` | [`AUDIO_CHAN_VOL_ATTEN`](knowledge/wram/AUDIO_CHAN_VOL_ATTEN.md) | `u8[10]` | audio, entity | Master volume attenuation factors array for 10 audio channels ($7E:2000..$7E:2009, 10 bytes; $8C:9DEE). |
| `$7E:200A` | [`audio_chan_vol_atten_a`](knowledge/wram/audio_chan_vol_atten_a.md) | `u8` | audio, entity | Audio channel 10 master volume attenuation factor ($AF..$FF). |
| `$7E:200B` | [`audio_chan_vol_atten_b`](knowledge/wram/audio_chan_vol_atten_b.md) | `u8` | audio, entity | Audio channel 11 master volume attenuation factor ($BF..$FF). |
| `$7E:200C` | [`audio_chan_vol_atten_c`](knowledge/wram/audio_chan_vol_atten_c.md) | `u8` | audio, entity | Audio channel 12 master volume attenuation factor ($CF..$FF). |
| `$7E:200D` | [`audio_chan_vol_atten_d`](knowledge/wram/audio_chan_vol_atten_d.md) | `u8` | audio, entity | Audio channel 13 master volume attenuation factor ($DF..$FF). |
| `$7E:200E` | [`audio_chan_vol_atten_e`](knowledge/wram/audio_chan_vol_atten_e.md) | `u8` | audio, entity | Audio channel 14 master volume attenuation factor ($EF..$FF). |
| `$7E:200F` | [`audio_chan_vol_atten_f`](knowledge/wram/audio_chan_vol_atten_f.md) | `u8` | audio, entity | Audio channel 15 master volume attenuation factor ($FF). |
| `$7E:2010` | [`AUDIO_ATTEN_TABLE_ALIGN_PAD`](knowledge/wram/AUDIO_ATTEN_TABLE_ALIGN_PAD.md) | `u8[64]` | audio, mode7, graphics | 64-byte zeroed Row 0 (horizontal OPT = 0) of the 128-byte Mode 2 OPT table ($7E:2010..$7E:208F) DMA'd to VRAM $6400 during Mode 7 flight ($80:D91B). |
| `$7E:2050` | [`MODE7_TRANSFORM_MATRIX_WORDS`](knowledge/wram/MODE7_TRANSFORM_MATRIX_WORDS.md) | `u16[32]` | mode7, graphics | 32-entry Mode 2 OPT vertical scroll row shearing the sky layer during Mode 7 flight ($7E:2050..$7E:208F; $80:CFA9, $80:D91B). |
| `$7E:2090` | [`MODE7_PERSPECTIVE_SCALE_BYTES`](knowledge/wram/MODE7_PERSPECTIVE_SCALE_BYTES.md) | `u8[32]` | mode7, bug, unused | 32-byte unread buffer written by the $80:D113 Bank $B0 out-of-bounds read bug ($7E:2090..$7E:20AF; $80:D113). |
| `$7E:20B0` | [`MODE7_PERSPECTIVE_ALIGN_PAD`](knowledge/wram/MODE7_PERSPECTIVE_ALIGN_PAD.md) | `u8[96]` | mode7, unused | 96-byte alignment buffer ($7E:20B0..$7E:210F) between Mode 7 scaling table and weather particle buffer (unused to our knowledge). |
| `$7E:2110` | [`WEATHER_PARTICLE_BUFFER`](knowledge/wram/WEATHER_PARTICLE_BUFFER.md) | `u8[256]` | weather | 64-entry cyclic state array for weather particle trajectories (4 bytes per particle; $91:C15B, $91:BE05). |
| `$7E:2210` | [`BOY_NAME_BUFFER`](knowledge/wram/BOY_NAME_BUFFER.md) | `u8[36]` | boy | Custom player character name string buffer (ASCII/tile indices). |
| `$7E:2234` | [`DOG_NAME_BUFFER`](knowledge/wram/DOG_NAME_BUFFER.md) | `u8[36]` | dog | Custom dog companion name string buffer (ASCII/tile indices). |
| `$7E:2258` | [`ALCHEMY_KNOWN_FLAGS`](knowledge/wram/ALCHEMY_KNOWN_FLAGS.md) | `u32` | alchemy, script | Alchemy formula learned bits, alphabetical from Acid Rain (bit 0); the last in `$7E:225C`. |
| `$7E:225C` | [`ALCHEMY_KNOWN_FLAGS_4`](knowledge/wram/ALCHEMY_KNOWN_FLAGS_4.md) | `u8` | alchemy, script | Alchemy Subsystem: Formula learned bitmask byte 4 (bits 0..2: Sting, Stop, Super Heal) |
| `$7E:225D` | [`SHOP_MENU_OPTION_FLAGS`](knowledge/wram/SHOP_MENU_OPTION_FLAGS.md) | `u8` | dialogue, script | Shopkeeper interaction menu option enable flags (bit 0 = trade/rare $F4, bit 1 = talk/exit $F6; $8E:8D05). |
| `$7E:225E` | [`STORY_FLAGS_225E`](knowledge/wram/STORY_FLAGS_225E.md) | `u8[2]` | script, system | Save RAM Subsystem: Persistent world progression and quest event bitmask flags (bytes 6 and 7 of save flag block, bit indices 48..63; $7E:225E..$7E:225F). |
| `$7E:2260` | [`BOSS_FLAGS_1`](knowledge/wram/BOSS_FLAGS_1.md) | `u8` | combat, script | Boss defeat bitmask flags (bit 0x10 = Thraxx defeated). |
| `$7E:2261` | [`CHARM_FLAGS`](knowledge/wram/CHARM_FLAGS.md) | `u24` | item, combat | Passive charms, relics, and trade goods owned bitfield ($7E:2261..$7E:2263: Chocobo Egg, Silver Sheath, Moxa Stick, Wizard's Coin; $8F:857D). |
| `$7E:2264` | [`EQUIPMENT_OWNED_FLAGS_3`](knowledge/wram/EQUIPMENT_OWNED_FLAGS_3.md) | `u8` | armor, script | Inventory Subsystem: Equipment owned bitmask byte 3 (bits 0,1,2,3,4,5: Item IDs 14..19). |
| `$7E:2265` | [`STORY_FLAGS_2265`](knowledge/wram/STORY_FLAGS_2265.md) | `u8[4]` | map, script | Save RAM Subsystem: Persistent story progression, map transition and room-event bitmask flags (bytes 13..16 of save flag block, bit indices 104..135; $7E:2265..$7E:2268). |
| `$7E:2269` | [`PERSISTENT_ROOM_EVENT_FLAGS_2269`](knowledge/wram/PERSISTENT_ROOM_EVENT_FLAGS_2269.md) | `u8` | item, map | Persistent room-event flags (partially identified) |
| `$7E:226A` | [`VOLCANO_ROOM_FLAGS_226A`](knowledge/wram/VOLCANO_ROOM_FLAGS_226A.md) | `u8` | map, script | Volcano room-script progress and event bitmask (pipe-maze side rooms 0x3E and Volcano path 0x69) |
| `$7E:226B` | [`CRUSTACIA_PICKUP_CLAIM_FLAGS`](knowledge/wram/CRUSTACIA_PICKUP_CLAIM_FLAGS.md) | `u8` | item, script | Crustacia pickup-claimed flags |
| `$7E:226C` | [`QUICKSAND_FIELD_PICKUP_CLAIM_FLAGS`](knowledge/wram/QUICKSAND_FIELD_PICKUP_CLAIM_FLAGS.md) | `u8` | item, script | Quicksand Field pickup-claimed flags |
| `$7E:226D` | [`PICKUP_CLAIM_FLAGS_226D`](knowledge/wram/PICKUP_CLAIM_FLAGS_226D.md) | `u8` | item, map | Pickup-claimed flags (rooms 0x35, 0x3B, 0x5A) |
| `$7E:226E` | [`STORY_CHEST_FLAGS_226E`](knowledge/wram/STORY_CHEST_FLAGS_226E.md) | `u8[22]` | item, script | Save RAM Subsystem: Persistent story progression, chest opened, and item pickup claimed bitmask flags array (22 bytes, $7E:226E..$7E:2283). |
| `$7E:2284` | [`OMNITOPIA_CHESTS_A`](knowledge/wram/OMNITOPIA_CHESTS_A.md) | `u8` | item, script | Omnitopia chests opened (storage room, greenhouse). |
| `$7E:2285` | [`STORY_CHEST_FLAGS_2285`](knowledge/wram/STORY_CHEST_FLAGS_2285.md) | `u8` | item, script | Save RAM flags next to `OMNITOPIA_CHESTS_A`; bits not traced. |
| `$7E:2286` | [`STORY_CHEST_FLAGS_2286`](knowledge/wram/STORY_CHEST_FLAGS_2286.md) | `u8[5]` | item, script | Save RAM Subsystem: Persistent story progression, chest opened, and item pickup claimed bitmask flags array (5 bytes, $7E:2286..$7E:228A). |
| `$7E:228B` | [`DOG_NAMED_FLAG`](knowledge/wram/DOG_NAMED_FLAG.md) | `u8` | dog | Companion dog custom name initialization flag (bit 0 prevents default ROM name overwrite at boot; $8E:E124). |
| `$7E:228C` | [`STORY_PROGRESSION_FLAGS_228C`](knowledge/wram/STORY_PROGRESSION_FLAGS_228C.md) | `u8[78]` | dialogue, script | Save RAM Subsystem: Master persistent quest, NPC dialogue progression, and world event bitmask flags array (78 bytes, $7E:228C..$7E:22D9). |
| `$7E:22DA` | [`WEAPONS_OWNED_FLAGS_0`](knowledge/wram/WEAPONS_OWNED_FLAGS_0.md) | `u8` | weapon, combat | Combat Subsystem: Weapon unlocked bitmask byte 0 (bits 1..7: Bone Club, Spider Claw, Horn Spear, Gladiator Sword, Bronze Axe, Bronze Spear, Crusader Sword). |
| `$7E:22DB` | [`WEAPONS_OWNED_FLAGS_1`](knowledge/wram/WEAPONS_OWNED_FLAGS_1.md) | `u8` | weapon, combat | Combat Subsystem: Weapon unlocked bitmask byte 1 (bits 0..5: Knight Basher, Lance, Neutron Blade, Atom Smasher, Laser Lance, Bazooka). |
| `$7E:22DC` | [`STORY_ROOM_FLAGS_22DC`](knowledge/wram/STORY_ROOM_FLAGS_22DC.md) | `u8[13]` | map, script | Save RAM Subsystem: Persistent room selector, dungeon puzzle, and scene progression flags array (13 bytes, $7E:22DC..$7E:22E8). |
| `$7E:22E9` | [`ROOM_TRANSITION_MODE`](knowledge/wram/ROOM_TRANSITION_MODE.md) | `u8` | map | Engine State: Room transition execution mode flag ($80:8CD3). |
| `$7E:22EA` | [`GAMEPLAY_FLAGS_22EA`](knowledge/wram/GAMEPLAY_FLAGS_22EA.md) | `u8` | item, graphics | Multi-owner gameplay, room-load readiness, and render flags (bit 0 = loot success, bit 2 = SRAM boot path, bits 3-5 = collision/character/palette readiness in pre-roll loop, bit 7 = screen-layer override latch; see shared-flags-22ea-22eb.md). |
| `$7E:22EB` | [`ROOM_TRANSITION_AND_SCRIPT_FLAGS_22EB`](knowledge/wram/ROOM_TRANSITION_AND_SCRIPT_FLAGS_22EB.md) | `u8` | map, script | Room transition and script VM coordination flags (bit 0 = room-local script latch, bit 2 = reload default room path in main loop, bit 6 = doorway handoff; see shared-flags-22ea-22eb.md). |
| `$7E:22EC` | [`ROOM_MUSIC_TRANSITION_FLAG`](knowledge/wram/ROOM_MUSIC_TRANSITION_FLAG.md) | `u8` | audio, map | Engine State: Room change background music transition mode flag ($8C:D860). |
| `$7E:22ED` | [`STORY_FLAGS_22ED`](knowledge/wram/STORY_FLAGS_22ED.md) | `u8` | map, script | Save RAM Subsystem: Persistent story event and scene cutscene coordination flag byte (tested in rooms 0x0C, 0x51, 0x5C; bits 0x04 and 0x20). |
| `$7E:22EE` | [`SCRIPT_EXECUTION_LOCK_FLAGS`](knowledge/wram/SCRIPT_EXECUTION_LOCK_FLAGS.md) | `u16` | map, dialogue | Script execution suspend gate and transition lock word (bit 0 set by func_8DB4FA during dialogue/cutscenes to lock VM execution; cleared by func_8CCEE9 on room transition to unfreeze actors and script threads). |
| `$7E:22F0` | [`STORY_FLAGS_22F0`](knowledge/wram/STORY_FLAGS_22F0.md) | `u8[10]` | map, script | Save RAM Subsystem: Persistent story progression, room arrival, and Omnitopia duct transition flags array (10 bytes, $7E:22F0..$7E:22F9). |
| `$7E:22FA` | [`CAMERA_ZOOM_SCALE_X`](knowledge/wram/CAMERA_ZOOM_SCALE_X.md) | `u8` | mode7, map | Mode 7 horizontal scale factor for rooms utilizing perspective rendering (written to $211C). |
| `$7E:22FB` | [`CAMERA_ZOOM_SCALE_Y`](knowledge/wram/CAMERA_ZOOM_SCALE_Y.md) | `u8` | mode7, map | Mode 7 vertical scale factor for rooms utilizing perspective rendering (written to $211C). |
| `$7E:22FC` | [`DESERT_SECTOR_Y`](knowledge/wram/DESERT_SECTOR_Y.md) | `u8` | map, script | Desert of Doom (Room 0x1B) endless navigation grid vertical sector coordinate (updated on boundary wrap triggers). |
| `$7E:22FD` | [`DESERT_SECTOR_X`](knowledge/wram/DESERT_SECTOR_X.md) | `u8` | map, script | Desert of Doom (Room 0x1B) endless navigation grid horizontal sector coordinate (updated on boundary wrap triggers). |
| `$7E:22FE` | [`STORY_EXPLORATION_STATE_22FE`](knowledge/wram/STORY_EXPLORATION_STATE_22FE.md) | `u8` | map, script | Save RAM Subsystem: Persistent room exploration state byte evaluated by Desert of Doom and Oubliette navigation scripts in rooms 0x36 and 0x3A. |
| `$7E:22FF` | [`ING_QTY_WAX`](knowledge/wram/ING_QTY_WAX.md) | `u8` | alchemy, item | Wax (Ingredient 0x00) |
| `$7E:2300` | [`ING_QTY_WATER`](knowledge/wram/ING_QTY_WATER.md) | `u8` | alchemy | Water (Ingredient 0x01) |
| `$7E:2301` | [`ING_QTY_VINEGAR`](knowledge/wram/ING_QTY_VINEGAR.md) | `u8` | alchemy | Vinegar (Ingredient 0x02) |
| `$7E:2302` | [`ING_QTY_ROOT`](knowledge/wram/ING_QTY_ROOT.md) | `u8` | alchemy | Root (Ingredient 0x03) |
| `$7E:2303` | [`ING_QTY_OIL`](knowledge/wram/ING_QTY_OIL.md) | `u8` | alchemy | Oil (Ingredient 0x04) |
| `$7E:2304` | [`ING_QTY_MUSHROOM`](knowledge/wram/ING_QTY_MUSHROOM.md) | `u8` | alchemy, map | Mushroom (Ingredient 0x05) |
| `$7E:2305` | [`ING_QTY_MUD_PEPPER`](knowledge/wram/ING_QTY_MUD_PEPPER.md) | `u8` | alchemy | Mud Pepper (Ingredient 0x06) |
| `$7E:2306` | [`ING_QTY_METEORITE`](knowledge/wram/ING_QTY_METEORITE.md) | `u8` | alchemy | Meteorite (Ingredient 0x07) |
| `$7E:2307` | [`ING_QTY_LIMESTONE`](knowledge/wram/ING_QTY_LIMESTONE.md) | `u8` | alchemy | Limestone (Ingredient 0x08) |
| `$7E:2308` | [`ING_QTY_IRON`](knowledge/wram/ING_QTY_IRON.md) | `u8` | alchemy | Iron (Ingredient 0x09) |
| `$7E:2309` | [`ING_QTY_GREASE`](knowledge/wram/ING_QTY_GREASE.md) | `u8` | alchemy, item | Grease (Ingredient 0x0A) |
| `$7E:230A` | [`ING_QTY_FEATHER`](knowledge/wram/ING_QTY_FEATHER.md) | `u8` | alchemy | Feather (Ingredient 0x0B) |
| `$7E:230B` | [`ING_QTY_ETHANOL`](knowledge/wram/ING_QTY_ETHANOL.md) | `u8` | alchemy | Ethanol (Ingredient 0x0C) |
| `$7E:230C` | [`ING_QTY_DRY_ICE`](knowledge/wram/ING_QTY_DRY_ICE.md) | `u8` | alchemy | Dry Ice (Ingredient 0x0D) |
| `$7E:230D` | [`ING_QTY_CLAY`](knowledge/wram/ING_QTY_CLAY.md) | `u8` | alchemy | Clay (Ingredient 0x0E) |
| `$7E:230E` | [`ING_QTY_CRYSTAL`](knowledge/wram/ING_QTY_CRYSTAL.md) | `u8` | alchemy | Crystal (Ingredient 0x0F) |
| `$7E:230F` | [`ING_QTY_BRIMSTONE`](knowledge/wram/ING_QTY_BRIMSTONE.md) | `u8` | alchemy | Brimstone (Ingredient 0x10) |
| `$7E:2310` | [`ING_QTY_BONE`](knowledge/wram/ING_QTY_BONE.md) | `u8` | alchemy | Bone (Ingredient 0x11) |
| `$7E:2311` | [`ING_QTY_ATLAS_MEDALLION`](knowledge/wram/ING_QTY_ATLAS_MEDALLION.md) | `u8` | alchemy | Atlas Medallion (Ingredient 0x12) |
| `$7E:2312` | [`ING_QTY_ASH`](knowledge/wram/ING_QTY_ASH.md) | `u8` | alchemy | Ash (Ingredient 0x13) |
| `$7E:2313` | [`ING_QTY_ACORN`](knowledge/wram/ING_QTY_ACORN.md) | `u8` | alchemy | Acorn (Ingredient 0x14) |
| `$7E:2314` | [`ING_QTY_ROOT_EXTRA`](knowledge/wram/ING_QTY_ROOT_EXTRA.md) | `u8` | alchemy | Root Extra (Ingredient 0x15) |
| `$7E:2315` | [`ING_QTY_GUNPOWDER`](knowledge/wram/ING_QTY_GUNPOWDER.md) | `u8` | alchemy | Gunpowder (Ingredient 0x16) |
| `$7E:2316` | [`ING_QTY_PETALS`](knowledge/wram/ING_QTY_PETALS.md) | `u8` | alchemy | Petals (Ingredient 0x17) |
| `$7E:2317` | [`ING_SATCHEL_SLOT_2`](knowledge/wram/ING_SATCHEL_SLOT_2.md) | `u8` | alchemy | Alchemy Satchel: Active inventory satchel quick-select slot 2 quantity |
| `$7E:2318` | [`ING_SATCHEL_SLOT_3`](knowledge/wram/ING_SATCHEL_SLOT_3.md) | `u8` | alchemy | Alchemy Satchel: Active inventory satchel quick-select slot 3 quantity |
| `$7E:2319` | [`ING_SATCHEL_SLOT_4`](knowledge/wram/ING_SATCHEL_SLOT_4.md) | `u8` | alchemy | Alchemy Satchel: Active inventory satchel quick-select slot 4 quantity |
| `$7E:231A` | [`ING_SATCHEL_SLOT_5`](knowledge/wram/ING_SATCHEL_SLOT_5.md) | `u8` | alchemy | Alchemy Satchel: Active inventory satchel quick-select slot 5 quantity |
| `$7E:231B` | [`ING_SATCHEL_SLOT_6`](knowledge/wram/ING_SATCHEL_SLOT_6.md) | `u8` | alchemy | Alchemy Satchel: Active inventory satchel quick-select slot 6 quantity |
| `$7E:231C` | [`ING_SATCHEL_SLOT_7`](knowledge/wram/ING_SATCHEL_SLOT_7.md) | `u8` | alchemy | Alchemy Satchel: Active inventory satchel quick-select slot 7 quantity |
| `$7E:231D` | [`ARMOR_QTY_GRASS_VEST`](knowledge/wram/ARMOR_QTY_GRASS_VEST.md) | `u8` | armor | Owned count for GRASS VEST |
| `$7E:231E` | [`ARMOR_QTY_SHELL_ARMOR`](knowledge/wram/ARMOR_QTY_SHELL_ARMOR.md) | `u8` | armor | Owned count for SHELL ARMOR |
| `$7E:231F` | [`ARMOR_QTY_DINO_SKIN`](knowledge/wram/ARMOR_QTY_DINO_SKIN.md) | `u8` | armor | Owned count for DINO SKIN |
| `$7E:2320` | [`ARMOR_QTY_BRONZE_ARMOR`](knowledge/wram/ARMOR_QTY_BRONZE_ARMOR.md) | `u8` | armor | Owned count for BRONZE ARMOR |
| `$7E:2321` | [`ARMOR_QTY_STONE_PLATE`](knowledge/wram/ARMOR_QTY_STONE_PLATE.md) | `u8` | armor | Owned count for STONE PLATE |
| `$7E:2322` | [`ARMOR_QTY_CENTURION_CAPE`](knowledge/wram/ARMOR_QTY_CENTURION_CAPE.md) | `u8` | armor | Owned count for CENTURION CAPE |
| `$7E:2323` | [`ARMOR_QTY_SHINING_ARMOR`](knowledge/wram/ARMOR_QTY_SHINING_ARMOR.md) | `u8` | armor | Owned count for SHINING ARMOR |
| `$7E:2324` | [`ARMOR_QTY_SILVER_MAIL`](knowledge/wram/ARMOR_QTY_SILVER_MAIL.md) | `u8` | armor | Owned count for SILVER MAIL |
| `$7E:2325` | [`ARMOR_QTY_GOLD_PLATED`](knowledge/wram/ARMOR_QTY_GOLD_PLATED.md) | `u8` | armor | Owned count for GOLD PLATED |
| `$7E:2326` | [`ARMOR_QTY_TITANIUM_VEST`](knowledge/wram/ARMOR_QTY_TITANIUM_VEST.md) | `u8` | armor | Owned count for TITANIUM VEST |
| `$7E:2327` | [`ARMOR_QTY_VIRTUAL_SUIT`](knowledge/wram/ARMOR_QTY_VIRTUAL_SUIT.md) | `u8` | armor | Owned count for VIRTUAL SUIT |
| `$7E:2328` | [`ARMOR_QTY_KEVLAR_VEST`](knowledge/wram/ARMOR_QTY_KEVLAR_VEST.md) | `u8` | armor | Owned count for KEVLAR VEST |
| `$7E:2329` | [`ARMOR_QTY_GRASS_HAT`](knowledge/wram/ARMOR_QTY_GRASS_HAT.md) | `u8` | armor | Owned count for GRASS HAT |
| `$7E:232A` | [`ARMOR_QTY_SHELL_HELMET`](knowledge/wram/ARMOR_QTY_SHELL_HELMET.md) | `u8` | armor | Owned count for SHELL HELMET |
| `$7E:232B` | [`ARMOR_QTY_DINO_HELMET`](knowledge/wram/ARMOR_QTY_DINO_HELMET.md) | `u8` | armor | Owned count for DINO HELMET |
| `$7E:232C` | [`ARMOR_QTY_BRONZE_HELMET`](knowledge/wram/ARMOR_QTY_BRONZE_HELMET.md) | `u8` | armor | Owned count for BRONZE HELMET |
| `$7E:232D` | [`ARMOR_QTY_STONE_CAP`](knowledge/wram/ARMOR_QTY_STONE_CAP.md) | `u8` | armor | Owned count for STONE CAP |
| `$7E:232E` | [`ARMOR_QTY_CENTURION_HELM`](knowledge/wram/ARMOR_QTY_CENTURION_HELM.md) | `u8` | armor | Owned count for CENTURION HELM |
| `$7E:232F` | [`ARMOR_QTY_TITAN_CROWN`](knowledge/wram/ARMOR_QTY_TITAN_CROWN.md) | `u8` | armor | Owned count for TITAN CROWN |
| `$7E:2330` | [`ARMOR_QTY_DRAGON_HELM`](knowledge/wram/ARMOR_QTY_DRAGON_HELM.md) | `u8` | armor | Owned count for DRAGON HELM |
| `$7E:2331` | [`ARMOR_QTY_KNIGHT_HELM`](knowledge/wram/ARMOR_QTY_KNIGHT_HELM.md) | `u8` | armor | Owned count for KNIGHT HELM |
| `$7E:2332` | [`ARMOR_QTY_LIGHTNING_HELM`](knowledge/wram/ARMOR_QTY_LIGHTNING_HELM.md) | `u8` | armor | Owned count for LIGHTNING HELM |
| `$7E:2333` | [`ARMOR_QTY_VIRTUAL_HELM`](knowledge/wram/ARMOR_QTY_VIRTUAL_HELM.md) | `u8` | armor | Owned count for VIRTUAL HELM |
| `$7E:2334` | [`ARMOR_QTY_VINE_BRACER`](knowledge/wram/ARMOR_QTY_VINE_BRACER.md) | `u8` | armor | Owned count for VINE BRACER |
| `$7E:2335` | [`ARMOR_QTY_SHELL_BRACER`](knowledge/wram/ARMOR_QTY_SHELL_BRACER.md) | `u8` | armor | Owned count for SHELL BRACER |
| `$7E:2336` | [`ARMOR_QTY_DINO_BRACER`](knowledge/wram/ARMOR_QTY_DINO_BRACER.md) | `u8` | armor | Owned count for DINO BRACER |
| `$7E:2337` | [`ARMOR_QTY_BRONZE_GAUNTLET`](knowledge/wram/ARMOR_QTY_BRONZE_GAUNTLET.md) | `u8` | armor | Owned count for BRONZE GAUNTLET |
| `$7E:2338` | [`ARMOR_QTY_IRON_BRACER`](knowledge/wram/ARMOR_QTY_IRON_BRACER.md) | `u8` | armor | Owned count for IRON BRACER |
| `$7E:2339` | [`ARMOR_QTY_SILVER_GAUNTLET`](knowledge/wram/ARMOR_QTY_SILVER_GAUNTLET.md) | `u8` | armor | Owned count for SILVER GAUNTLET |
| `$7E:233A` | [`ARMOR_QTY_DRAGON_GAUNTLET`](knowledge/wram/ARMOR_QTY_DRAGON_GAUNTLET.md) | `u8` | armor | Owned count for DRAGON GAUNTLET |
| `$7E:233B` | [`ARMOR_QTY_TITAN_GAUNTLET`](knowledge/wram/ARMOR_QTY_TITAN_GAUNTLET.md) | `u8` | armor | Owned count for TITAN GAUNTLET |
| `$7E:233C` | [`ARMOR_QTY_VIRTUAL_GLOVE`](knowledge/wram/ARMOR_QTY_VIRTUAL_GLOVE.md) | `u8` | armor | Owned count for VIRTUAL GLOVE |
| `$7E:233D` | [`ARMOR_QTY_LEATHER_COLLAR`](knowledge/wram/ARMOR_QTY_LEATHER_COLLAR.md) | `u8` | armor | Owned count for LEATHER COLLAR |
| `$7E:233E` | [`ARMOR_QTY_SPIKED_COLLAR`](knowledge/wram/ARMOR_QTY_SPIKED_COLLAR.md) | `u8` | armor | Owned count for SPIKED COLLAR |
| `$7E:233F` | [`ARMOR_QTY_DEFENDER_COLLAR`](knowledge/wram/ARMOR_QTY_DEFENDER_COLLAR.md) | `u8` | armor | Owned count for DEFENDER COLLAR |
| `$7E:2340` | [`ARMOR_QTY_TITAN_COLLAR`](knowledge/wram/ARMOR_QTY_TITAN_COLLAR.md) | `u8` | armor | Owned count for TITAN COLLAR |
| `$7E:2341` | [`ARMOR_QTY_DRAGON_COLLAR`](knowledge/wram/ARMOR_QTY_DRAGON_COLLAR.md) | `u8` | armor | Owned count for DRAGON COLLAR |
| `$7E:2342` | [`ARMOR_QTY_SILVER_COLLAR`](knowledge/wram/ARMOR_QTY_SILVER_COLLAR.md) | `u8` | armor | Owned count for SILVER COLLAR |
| `$7E:2343` | [`ARMOR_QTY_GOLD_COLLAR`](knowledge/wram/ARMOR_QTY_GOLD_COLLAR.md) | `u8` | armor | Owned count for GOLD COLLAR |
| `$7E:2344` | [`ARMOR_QTY_SPOT_COLLAR`](knowledge/wram/ARMOR_QTY_SPOT_COLLAR.md) | `u8` | armor | Owned count for SPOT COLLAR |
| `$7E:2345` | [`AMMO_THUNDER_BALL`](knowledge/wram/AMMO_THUNDER_BALL.md) | `u8` | weapon | Owned Thunder Ball ammo count |
| `$7E:2346` | [`AMMO_PARTICLE_BOMB`](knowledge/wram/AMMO_PARTICLE_BOMB.md) | `u8` | weapon | Owned Particle Bomb ammo count |
| `$7E:2347` | [`AMMO_CRYO_BLAST`](knowledge/wram/AMMO_CRYO_BLAST.md) | `u8` | weapon | Owned Cryo-Blast ammo count |
| `$7E:2348` | [`AMMO_RESERVED_2348`](knowledge/wram/AMMO_RESERVED_2348.md) | `u8` | weapon | Reserved ammo slot byte |
| `$7E:2349` | [`AMMO_SELECTED_TYPE`](knowledge/wram/AMMO_SELECTED_TYPE.md) | `u8` | weapon | Currently selected Bazooka ammunition type index |
| `$7E:234A` | [`CALL_BEADS_CAPACITY`](knowledge/wram/CALL_BEADS_CAPACITY.md) | `u8` | item | Inventory Mechanics: Maximum Call Beads inventory capacity limit. |
| `$7E:234B` | [`HUT_HOUSE_TO_ENTER`](knowledge/wram/HUT_HOUSE_TO_ENTER.md) | `u16` | map, script | Game script variable: Hut/house to enter |
| `$7E:234D` | [`CAVE_ENTRANCE_ID`](knowledge/wram/CAVE_ENTRANCE_ID.md) | `u8` | map | Antiqua caves shared room entrance sector index (1..6) |
| `$7E:234E` | [`CAVE_EXIT_SECTOR_ID`](knowledge/wram/CAVE_EXIT_SECTOR_ID.md) | `u8` | map, script | Game Script Subsystem: Antiqua cave exit doorway and waypoint sector destination index (0..5; paired with $7E:234D). |
| `$7E:234F` | [`PRISON_TOWN_EXIT`](knowledge/wram/PRISON_TOWN_EXIT.md) | `u16` | map, script | Game script variable: PRISON TOWN EXIT |
| `$7E:2351` | [`PRISON_CELL_EXIT_ID`](knowledge/wram/PRISON_CELL_EXIT_ID.md) | `u8` | map, script | Game Script Subsystem: Ivor Tower prison cell door and exit interaction state index (values 0 and 4; room 0x74). |
| `$7E:2352` | [`QUEEN_S_KEY_ON_DOG`](knowledge/wram/QUEEN_S_KEY_ON_DOG.md) | `u16` | dog, script | Game script variable: Queen's Key on Dog |
| `$7E:2354` | [`IVOR_SEWER_PROGRESSION`](knowledge/wram/IVOR_SEWER_PROGRESSION.md) | `u8[3]` | map, script | Game Script Subsystem: Ivor Tower sewer maze, prison key handoff, and pipe navigation progression state registers ($7E:2354..$7E:2356). |
| `$7E:2357` | [`PYRAMID_CURRENT_LEVEL`](knowledge/wram/PYRAMID_CURRENT_LEVEL.md) | `u8` | map | Antiqua Pyramid current floor level index (1 = bottom, 2 = top) |
| `$7E:2358` | [`PYRAMID_ENTRANCE_SECTOR`](knowledge/wram/PYRAMID_ENTRANCE_SECTOR.md) | `u16` | map | Antiqua Pyramid entrance doorway / sector index word (0..2). |
| `$7E:235A` | [`DOG_AI_STATE_ALIGN_PAD`](knowledge/wram/DOG_AI_STATE_ALIGN_PAD.md) | `u8` | dog, unused | 1-byte alignment gap ($7E:235A) between Great Pyramid sector and Dog AI registers (unused to our knowledge). |
| `$7E:235B` | [`DOG_AI_STATE`](knowledge/wram/DOG_AI_STATE.md) | `DogAiCommand` | dog | Dog AI behavioral command state (Follow, Heel, Sniff, Attack) |
| `$7E:235C` | [`dog_ai_alert_timer`](knowledge/wram/dog_ai_alert_timer.md) | `u8` | dog | Timer countdown ticks for dog barking / alert animation when scent is detected. |
| `$7E:235D` | [`dog_ai_leash_distance`](knowledge/wram/dog_ai_leash_distance.md) | `u8` | dog, combat | Maximum leash tether distance before Dog AI breaks combat to return to player. |
| `$7E:235E` | [`dog_ai_collision_mode`](knowledge/wram/dog_ai_collision_mode.md) | `u8` | dog, map | Dog navigation collision mode (wall sliding vs direct waypoint pathing). |
| `$7E:235F` | [`dog_companion_attack_mode`](knowledge/wram/dog_companion_attack_mode.md) | `u16` | system | Companion attack behavior bitmask (passive, defend player, aggressive attack). |
| `$7E:2361` | [`DOG_FORM_INDEX_ALIGN_PAD`](knowledge/wram/DOG_FORM_INDEX_ALIGN_PAD.md) | `u8[2]` | dog, unused | 2-byte alignment gap ($7E:2361..$7E:2362) between companion attack mode and Dog form index (unused to our knowledge). |
| `$7E:2363` | [`DOG_FORM_INDEX`](knowledge/wram/DOG_FORM_INDEX.md) | `DogType` | dog | Active visual form and breed of Dog companion (Wolf, Greyhound, Poodle, Toaster) |
| `$7E:2364` | [`DIALOGUE_PARAM_ALIGN_PAD`](knowledge/wram/DIALOGUE_PARAM_ALIGN_PAD.md) | `u8` | dialogue, unused | 1-byte alignment gap ($7E:2364) between Dog form index and dialogue parameter registers (unused to our knowledge). |
| `$7E:2365` | [`DIALOGUE_STRING_PARAM_REGISTERS`](knowledge/wram/DIALOGUE_STRING_PARAM_REGISTERS.md) | `u8[24]` | dialogue | Dialogue and message box numeric string interpolation registers ($7E:2365..$7E:237C, 24 bytes). |
| `$7E:237D` | [`MODE7_FLIGHT_STATUS_FLAG`](knowledge/wram/MODE7_FLIGHT_STATUS_FLAG.md) | `u16` | mode7 | Mode 7 overworld flight active flag / destination landing index |
| `$7E:237F` | [`MODE7_LANDING_WAYPOINT_RECS`](knowledge/wram/MODE7_LANDING_WAYPOINT_RECS.md) | `u16[5]` | mode7, system | Mode 7 / Flight Subsystem: Array of 5 16-bit registers staging landing destination region ID, world X/Y coordinates, heading angle, and elevation ($7E:237F..$7E:2388). |
| `$7E:2389` | [`PEDDLER_SPEECH_VARIATION`](knowledge/wram/PEDDLER_SPEECH_VARIATION.md) | `u8` | dialogue, scratch_candidate | Nobilia market peddler speech variation index; candidate for 2834++ scratch |
| `$7E:238A` | [`CHANGE_MUSIC_CMD_ALIGN_PAD`](knowledge/wram/CHANGE_MUSIC_CMD_ALIGN_PAD.md) | `u8[3]` | audio, script, unused | 3-byte alignment gap ($7E:238A..$7E:238C) between peddler speech variation index and CHANGE_MUSIC command word (unused to our knowledge). |
| `$7E:238D` | [`CHANGE_MUSIC`](knowledge/wram/CHANGE_MUSIC.md) | `u16` | audio, script | Game script variable: CHANGE MUSIC |
| `$7E:238F` | [`TRANSITION_ENTER_DIRECTION`](knowledge/wram/TRANSITION_ENTER_DIRECTION.md) | `u16` | map, script | Engine State / Script Subsystem: Doorway and room transition character facing and walk-in direction mode word ($7E:238F). |
| `$7E:2391` | [`LOOT_MAILBOX`](knowledge/wram/LOOT_MAILBOX.md) | `u16` | alchemy, armor | Loot mailbox: reward item ID ($02xx ingredient, $04xx armor, $08xx consumable, 1 money; $7E:2391..$7E:2392). |
| `$7E:2393` | [`LOOT_AMOUNT_CURRENCY`](knowledge/wram/LOOT_AMOUNT_CURRENCY.md) | `u16` | item, currency | Loot currency amount staged before calling global loot script (e.g. call 0x39 / 0x3a / 0x3b). |
| `$7E:2395` | [`LOOT_ROOM_OBJECT`](knowledge/wram/LOOT_ROOM_OBJECT.md) | `u16` | item, map | Loot mailbox: Room object index of chest, gourd, or pot being opened/looted (written before calling loot handler). |
| `$7E:2397` | [`LOOT_DISPENSE_FLAGS`](knowledge/wram/LOOT_DISPENSE_FLAGS.md) | `u16[2]` | item, entity | Loot Subsystem: Staging registers for loot presentation style and recipient entity ($7E:2397..$7E:239A). |
| `$7E:239B` | [`PRIZE_1_RATE`](knowledge/wram/PRIZE_1_RATE.md) | `u16` | item, script | Game script variable: PRIZE 1 RATE |
| `$7E:239D` | [`PRIZE_2_RATE`](knowledge/wram/PRIZE_2_RATE.md) | `u16` | item, script | Game script variable: PRIZE 2 RATE |
| `$7E:239F` | [`PRIZE_3_RATE`](knowledge/wram/PRIZE_3_RATE.md) | `u16` | item, script | Game script variable: PRIZE 3 RATE |
| `$7E:23A1` | [`PRIZE_1_DROP`](knowledge/wram/PRIZE_1_DROP.md) | `u16` | item, script | Game script variable: PRIZE 1 DROP |
| `$7E:23A3` | [`PRIZE_2_DROP`](knowledge/wram/PRIZE_2_DROP.md) | `u16` | item, script | Game script variable: PRIZE 2 DROP |
| `$7E:23A5` | [`PRIZE_3_DROP`](knowledge/wram/PRIZE_3_DROP.md) | `u16` | item, script | Game script variable: PRIZE 3 DROP |
| `$7E:23A7` | [`PRIZE_1_QTY`](knowledge/wram/PRIZE_1_QTY.md) | `u16` | item, script | Game script variable: PRIZE 1 QTY |
| `$7E:23A9` | [`PRIZE_2_QTY`](knowledge/wram/PRIZE_2_QTY.md) | `u16` | item, script | Game script variable: PRIZE 2 QTY |
| `$7E:23AB` | [`PRIZE_3_QTY`](knowledge/wram/PRIZE_3_QTY.md) | `u16` | item, script | Game script variable: PRIZE 3 QTY |
| `$7E:23AD` | [`BARRIER_CENTER_X`](knowledge/wram/BARRIER_CENTER_X.md) | `u16` | combat | Center world X coordinate of active protective barrier shield circle |
| `$7E:23AF` | [`BARRIER_CENTER_Y`](knowledge/wram/BARRIER_CENTER_Y.md) | `u16` | combat | Center world Y coordinate of active protective barrier shield circle |
| `$7E:23B1` | [`BARRIER_RADIUS`](knowledge/wram/BARRIER_RADIUS.md) | `u16` | combat | Current radius in pixels of active protective barrier shield circle |
| `$7E:23B3` | [`BARRIER_EXPANSION_RATE`](knowledge/wram/BARRIER_EXPANSION_RATE.md) | `u16` | combat | Radial growth and shrinkage step rate per frame for active barrier circle |
| `$7E:23B5` | [`BARRIER_STATE_OR_LIFETIME`](knowledge/wram/BARRIER_STATE_OR_LIFETIME.md) | `u16` | combat | Barrier state machine mode and remaining lifetime countdown frames |
| `$7E:23B7` | [`SCRIPT_TARGET_COORDS_PAD_0`](knowledge/wram/SCRIPT_TARGET_COORDS_PAD_0.md) | `u8[2]` | script, unused | 2-byte alignment gap ($7E:23B7..$7E:23B8) between barrier parameters and script target coordinates (unused to our knowledge). |
| `$7E:23B9` | [`TARGET_X`](knowledge/wram/TARGET_X.md) | `u16` | script | Script waypoint / target position X in world pixels |
| `$7E:23BB` | [`TARGET_Y`](knowledge/wram/TARGET_Y.md) | `u16` | script | Script waypoint / target position Y in world pixels |
| `$7E:23BD` | [`ROOM_SCRATCH_ALIGN_PAD`](knowledge/wram/ROOM_SCRATCH_ALIGN_PAD.md) | `u8[2]` | script, unused | 2-byte alignment gap ($7E:23BD..$7E:23BE) between script target coordinates and room scratch registers (unused to our knowledge). |
| `$7E:23BF` | [`PACIFIED`](knowledge/wram/PACIFIED.md) | `u16` | combat | Pseudo-boolean pacified state ($0000 = False, $0001 = True; compiler: PACIFIED). |
| `$7E:23C1` | [`COMPANION_TETHER_MODE`](knowledge/wram/COMPANION_TETHER_MODE.md) | `u16` | dog | Companion leash behavior state (0 = standard follow distance, non-zero = tight tether). |
| `$7E:23C3` | [`COMPANION_TIGHT_TETHER`](knowledge/wram/COMPANION_TIGHT_TETHER.md) | `u16` | dog, map | Non-zero: the companion keeps close (tether limits 4/3/3/1). Cleared on room load by func_908E90; set by tight room/indoor scripts. |
| `$7E:23C5` | [`COMPANION_LEASH_RADIUS`](knowledge/wram/COMPANION_LEASH_RADIUS.md) | `u16` | dog | Companion leash maximum distance parameter (default $2000; initialized in func_908E90). |
| `$7E:23C7` | [`STATUS_CLEANSE_MODE`](knowledge/wram/STATUS_CLEANSE_MODE.md) | `u16` | combat, script | Script VM: Status cure dispatch mode word ($8C:E7EF; 1 = full cleanse of all ailments on Boy and Dog, 0 = standard selective cure). |
| `$7E:23C9` | [`WEATHER_EFFECT_STATE`](knowledge/wram/WEATHER_EFFECT_STATE.md) | `u16` | weather, system | Weather particle system animation state and dispatch mode |
| `$7E:23CB` | [`ALCHEMY_PALETTE_CYCLE_PHASE`](knowledge/wram/ALCHEMY_PALETTE_CYCLE_PHASE.md) | `u16` | alchemy, graphics | Alchemy Subsystem: Sprite palette cycling phase offset word ($00 or $20; added to $A7CB in $8C:E8A0). |
| `$7E:23CD` | [`WEAPON_PALETTE`](knowledge/wram/WEAPON_PALETTE.md) | `u16` | boy, weapon | Boy/weapon active sprite palette CGRAM byte offset ($40, $60, $80, $A0, $C0; checked in $8F:81C9). |
| `$7E:23CF` | [`DOG_PALETTE`](knowledge/wram/DOG_PALETTE.md) | `u16` | dog, graphics | Dog active sprite palette CGRAM byte offset ($40, $60, $80, $A0, $C0; checked in $8F:9471). |
| `$7E:23D1` | [`NEXT_PROJECTILE_DAMAGE`](knowledge/wram/NEXT_PROJECTILE_DAMAGE.md) | `u16` | weapon, combat | Script VM: Velocity and damage override parameter for spawned projectiles ($90:DCC0). |
| `$7E:23D3` | [`SUBTITLE_ACTIVE_FLAG`](knowledge/wram/SUBTITLE_ACTIVE_FLAG.md) | `u16` | dialogue, script | Subtitle text window active state flag evaluated by Script VM opcode 0x52 subtext ($8C:D99E). |
| `$7E:23D5` | [`SCRIPT_DAMAGE_REDIRECT_FLAG`](knowledge/wram/SCRIPT_DAMAGE_REDIRECT_FLAG.md) | `u16` | combat, script | Script VM: Opcode 0x92 damage redirect flag (0 = standard knockback damage, non-zero = redirect to opcode 0xBB damage without knockback) |
| `$7E:23D7` | [`SCRIPT_DAMAGE_TRANSFORM_FLAG`](knowledge/wram/SCRIPT_DAMAGE_TRANSFORM_FLAG.md) | `u16` | combat, entity | Script VM: Opcode 0x92 damage transform flag (0 = raw immediate damage, non-zero = transform damage through entity defense math) |
| `$7E:23D9` | [`ANIMATION_PLAY_OVERRIDE`](knowledge/wram/ANIMATION_PLAY_OVERRIDE.md) | `u16` | entity, script | Script VM: Forced animation playback override flag word ($8C:E0B0; forces animation even if entity bit $0008 busy). |
| `$7E:23DB` | [`QUEUED_ROOM_EXIT_TRIGGER_0`](knowledge/wram/QUEUED_ROOM_EXIT_TRIGGER_0.md) | `u16` | map, script | ID of door or boundary exit trigger tripped by player ($FFFF = none). |
| `$7E:23DD` | [`QUEUED_ROOM_EXIT_TRIGGER_1`](knowledge/wram/QUEUED_ROOM_EXIT_TRIGGER_1.md) | `u16` | map, script | Secondary queued room transition exit trigger ID ($FFFF = none). |
| `$7E:23DF` | [`ENTITY_SPAWN_OVERRIDE_X`](knowledge/wram/ENTITY_SPAWN_OVERRIDE_X.md) | `u16` | entity, system | Entity Subsystem: Spawn position horizontal override coordinate word ($8F:B178). |
| `$7E:23E1` | [`ENTITY_SPAWN_OVERRIDE_Y`](knowledge/wram/ENTITY_SPAWN_OVERRIDE_Y.md) | `u16` | entity, system | Entity Subsystem: Spawn position vertical override coordinate word ($8F:B183). |
| `$7E:23E3` | [`SCRIPT_MOVE_COLLISION_RESULT`](knowledge/wram/SCRIPT_MOVE_COLLISION_RESULT.md) | `u16` | map, entity | Script VM: Opcode 0xB9 move_entity_by_pixel_offset collision outcome (1 = path clear, 0 = blocked). |
| `$7E:23E5` | [`STATS_PTR_BOY`](knowledge/wram/STATS_PTR_BOY.md) | `u16` | boy, entity | Entity Subsystem: Pointer to Boy persistent base stats block ($0A26; initialized in $8F:8090) |
| `$7E:23E7` | [`STATS_PTR_DOG`](knowledge/wram/STATS_PTR_DOG.md) | `u16` | dog, entity | Entity Subsystem: Pointer to Dog persistent base stats block ($0A70; initialized in $8F:8130) |
| `$7E:23E9` | [`CAMERA_ROOM_BOUND_LEFT`](knowledge/wram/CAMERA_ROOM_BOUND_LEFT.md) | `u16` | map | Left boundary clamp limit (pixels) for active room camera. |
| `$7E:23EB` | [`CAMERA_ROOM_BOUND_TOP`](knowledge/wram/CAMERA_ROOM_BOUND_TOP.md) | `u16` | map | Top boundary clamp limit (pixels) for active room camera. |
| `$7E:23ED` | [`CAMERA_ROOM_BOUND_RIGHT`](knowledge/wram/CAMERA_ROOM_BOUND_RIGHT.md) | `u16` | map | Right boundary clamp limit (pixels) for active room camera. |
| `$7E:23EF` | [`CAMERA_ROOM_BOUND_BOTTOM`](knowledge/wram/CAMERA_ROOM_BOUND_BOTTOM.md) | `u16` | map | Bottom boundary clamp limit (pixels) for active room camera. |
| `$7E:23F1` | [`SCRIPT_CUTSCENE_WAYPOINTS`](knowledge/wram/SCRIPT_CUTSCENE_WAYPOINTS.md) | `u16[8]` | script | Script VM: Multi-point scripted cutscene walking waypoint coordinates array ($7E:23F1..$7E:2400, 4 X/Y coordinate pairs; opcode 0x1B). |
| `$7E:2401` | [`VIEWPORT_LEFT_X`](knowledge/wram/VIEWPORT_LEFT_X.md) | `u16` | map | Active camera on-screen viewport left edge in world pixels ($BF). |
| `$7E:2403` | [`VIEWPORT_RIGHT_X`](knowledge/wram/VIEWPORT_RIGHT_X.md) | `u16` | map | Active camera on-screen viewport right edge in world pixels ($BF + 256). |
| `$7E:2405` | [`VIEWPORT_TOP_Y`](knowledge/wram/VIEWPORT_TOP_Y.md) | `u16` | map | Active camera on-screen viewport top edge in world pixels ($C1). |
| `$7E:2407` | [`VIEWPORT_BOTTOM_Y`](knowledge/wram/VIEWPORT_BOTTOM_Y.md) | `u16` | map | Active camera on-screen viewport bottom edge in world pixels ($C1 + 224). |
| `$7E:2409` | [`SHAKE_MAGNITUDE_X`](knowledge/wram/SHAKE_MAGNITUDE_X.md) | `u16` | graphics, map | Maximum horizontal displacement magnitude for active screen shaking ($90:989C). |
| `$7E:240B` | [`SHAKE_MAGNITUDE_Y`](knowledge/wram/SHAKE_MAGNITUDE_Y.md) | `u16` | graphics | Maximum vertical displacement magnitude for active screen shaking. |
| `$7E:240D` | [`VENDOR_RECOMMEND_CURRENCY_CHANGE`](knowledge/wram/VENDOR_RECOMMEND_CURRENCY_CHANGE.md) | `u16` | currency, dialogue | Market / Vendor: Currency exchange recommendation mode word (0 = recommend change to local currency). |
| `$7E:240F` | [`CAMERA_DEADZONE_LEFT`](knowledge/wram/CAMERA_DEADZONE_LEFT.md) | `u16` | map | Left horizontal deadzone threshold before camera scrolls to follow player. |
| `$7E:2411` | [`CAMERA_DEADZONE_RIGHT`](knowledge/wram/CAMERA_DEADZONE_RIGHT.md) | `u16` | map | Right horizontal deadzone threshold before camera scrolls to follow player. |
| `$7E:2413` | [`CAMERA_DEADZONE_TOP`](knowledge/wram/CAMERA_DEADZONE_TOP.md) | `u16` | map | Top vertical deadzone threshold before camera scrolls to follow player. |
| `$7E:2415` | [`CAMERA_DEADZONE_BOTTOM`](knowledge/wram/CAMERA_DEADZONE_BOTTOM.md) | `u16` | map | Bottom vertical deadzone threshold before camera scrolls to follow player. |
| `$7E:2417` | [`CAMERA_WORLD_ORIGIN_X`](knowledge/wram/CAMERA_WORLD_ORIGIN_X.md) | `u16` | map | Room camera world horizontal origin anchor (metatiles) used in Mode 7 matrix math. |
| `$7E:2419` | [`CAMERA_WORLD_ORIGIN_Y`](knowledge/wram/CAMERA_WORLD_ORIGIN_Y.md) | `u16` | map | Room camera world vertical origin anchor (metatiles) used in Mode 7 matrix math. |
| `$7E:241B` | [`CAMERA_SCREEN_CENTER_X`](knowledge/wram/CAMERA_SCREEN_CENTER_X.md) | `u16` | map | Screen center horizontal pixel coordinate offset for camera centering. |
| `$7E:241D` | [`CAMERA_SCREEN_CENTER_Y`](knowledge/wram/CAMERA_SCREEN_CENTER_Y.md) | `u16` | map | Screen center vertical pixel coordinate offset for camera centering. |
| `$7E:241F` | [`CAMERA_SCROLL_MODE`](knowledge/wram/CAMERA_SCROLL_MODE.md) | `u16` | map, script | Camera tracking mode enum (0 = Follow target player, 2 = Fixed / scripted focus). |
| `$7E:2421` | [`ENGINE_CONTEXT_SCRATCH_21`](knowledge/wram/ENGINE_CONTEXT_SCRATCH_21.md) | `u16` | dialogue, scratch_candidate | Transient engine context register; candidate for 2834++ scratch |
| `$7E:2423` | [`ENGINE_CONTEXT_SCRATCH_23`](knowledge/wram/ENGINE_CONTEXT_SCRATCH_23.md) | `u16` | dialogue, scratch_candidate | Transient engine context register; candidate for 2834++ scratch |
| `$7E:2425` | [`TRIGGER_INTERACTION_FACING`](knowledge/wram/TRIGGER_INTERACTION_FACING.md) | `u16` | map, entity | Actor facing direction index (0..3) recorded at moment of trigger interaction ($8F:ABED). |
| `$7E:2427` | [`TRIGGER_INTERACTION_FLAGS`](knowledge/wram/TRIGGER_INTERACTION_FLAGS.md) | `u16` | entity, script | Actor interaction status flags recorded at moment of trigger interaction ($8F:ABED). |
| `$7E:2429` | [`TRIGGER_SCRIPT_LOCK`](knowledge/wram/TRIGGER_SCRIPT_LOCK.md) | `u16` | script | Execution lock held while a step-on coordinate trigger script is running. |
| `$7E:242B` | [`CAMERA_SCRIPTED_TARGET_X`](knowledge/wram/CAMERA_SCRIPTED_TARGET_X.md) | `u16` | map, script | Forced scripted camera focus target X coordinate (-1 = follow player). |
| `$7E:242D` | [`CAMERA_SCRIPTED_TARGET_Y`](knowledge/wram/CAMERA_SCRIPTED_TARGET_Y.md) | `u16` | map, script | Forced scripted camera focus target Y coordinate (-1 = follow player). |
| `$7E:242F` | [`CAMERA_PAN_VELOCITY`](knowledge/wram/CAMERA_PAN_VELOCITY.md) | `u16` | map, script | Transition panning speed between scripted camera targets. |
| `$7E:2431` | [`SPAWN_RESPAWN_RATE_DEFAULT`](knowledge/wram/SPAWN_RESPAWN_RATE_DEFAULT.md) | `u16` | entity | Default entity respawn interval countdown ticks (initialized to $0258 = 600 frames in func_8FDF14). |
| `$7E:2433` | [`SPAWN_SYSTEM_ENABLE`](knowledge/wram/SPAWN_SYSTEM_ENABLE.md) | `u16` | entity, system | Entity spawn system global enable gate (1 = active, 0 = disabled; initialized in func_8FDF14). |
| `$7E:2435` | [`ROOM_AMBIENT_LIGHT_LEVEL`](knowledge/wram/ROOM_AMBIENT_LIGHT_LEVEL.md) | `u16` | graphics, map | Ambient light/shade color tint parameter applied to room palette (default $15). |
| `$7E:2437` | [`MAP_PALETTE_INDEX`](knowledge/wram/MAP_PALETTE_INDEX.md) | `u16` | graphics, map | Active map color palette family identifier index. |
| `$7E:2439` | [`ENDING_CREDITS_SCENE_INDEX`](knowledge/wram/ENDING_CREDITS_SCENE_INDEX.md) | `u16` | currency, dialogue | Ending credits cutscene location sequence index (0..5: Thraxx, Nobilia, Chessboard, Ebon Keep, Omnitopia, Fin). |
| `$7E:243B` | [`PENDING_SOUND_COMMAND`](knowledge/wram/PENDING_SOUND_COMMAND.md) | `u16` | audio, script | Queued sound effect / audio driver mailbox flushed by Script VM opcodes 0x30..0x32 ($8C:D6A7). |
| `$7E:243D` | [`EQUIPMENT_GRANT_COMMAND`](knowledge/wram/EQUIPMENT_GRANT_COMMAND.md) | `u16` | armor | Pending equipment item grant ID |
| `$7E:243F` | [`EQUIPMENT_TAKE_COMMAND`](knowledge/wram/EQUIPMENT_TAKE_COMMAND.md) | `u16` | armor | Pending equipment item revoke/take ID |
| `$7E:2441` | [`ROOM_TILESET_GRAPHIC_BANK`](knowledge/wram/ROOM_TILESET_GRAPHIC_BANK.md) | `u16` | boy, weapon | ROM graphic bank containing compressed 16x16 metatile graphics for current room. |
| `$7E:2443` | [`ROOM_METATILE_DESCRIPTOR_PTR`](knowledge/wram/ROOM_METATILE_DESCRIPTOR_PTR.md) | `u16` | dog, map | Pointer to room metatile layout descriptor table in ROM. |
| `$7E:2445` | [`PRESELECT_ALCHEMY`](knowledge/wram/PRESELECT_ALCHEMY.md) | `u16` | alchemy, script | Game script variable: PRESELECT ALCHEMY |
| `$7E:2447` | [`TRANSACTION_COST`](knowledge/wram/TRANSACTION_COST.md) | `u16` | currency, dialogue | Market / Vendor: Scripted transaction price / cost staging word ($95:E8A8; Nobilia Atlas Medallion 100 Jewels). |
| `$7E:2449` | [`SAVE_SPOT`](knowledge/wram/SAVE_SPOT.md) | `u16` | script | Game script variable: SAVE SPOT |
| `$7E:244B` | [`LAST_ENTITY_HANDLE_PAD`](knowledge/wram/LAST_ENTITY_HANDLE_PAD.md) | `u8[2]` | entity, unused | 2-byte alignment gap ($7E:244B..$7E:244C) between save spot and last entity handle (unused to our knowledge). |
| `$7E:244D` | [`LAST_ENTITY_HANDLE`](knowledge/wram/LAST_ENTITY_HANDLE.md) | `u16` | entity | Temporary entity struct pointer / handle of most recently spawned NPC |
| `$7E:244F` | [`PEDDLER_STAGE`](knowledge/wram/PEDDLER_STAGE.md) | `u8` | dialogue, scratch_candidate | Nobilia market entrance peddler dialogue progression stage; candidate for 2834++ scratch |
| `$7E:2450` | [`PEDDLER_INTERACTION_ALIGN_PAD`](knowledge/wram/PEDDLER_INTERACTION_ALIGN_PAD.md) | `u8` | dialogue, unused | 1-byte alignment padding ($7E:2450) between peddler stage and interaction count (unused to our knowledge). |
| `$7E:2451` | [`PEDDLER_INTERACTION_COUNT`](knowledge/wram/PEDDLER_INTERACTION_COUNT.md) | `u8` | dialogue, scratch_candidate | Nobilia market entrance peddler interaction count; candidate for 2834++ scratch |
| `$7E:2452` | [`VENDOR_ENTITY_ALIGN_PAD`](knowledge/wram/VENDOR_ENTITY_ALIGN_PAD.md) | `u8[3]` | entity, dialogue, unused | 3-byte alignment gap ($7E:2452..$7E:2454) preceding vendor entity handle (unused to our knowledge). |
| `$7E:2455` | [`VENDOR_ENTITY`](knowledge/wram/VENDOR_ENTITY.md) | `u16` | dialogue, entity | Vendor Subsystem: Target vendor entity slot index at center of shop ring menu ($93:AE92). |
| `$7E:2457` | [`VENDOR_SHOP_ITEMS_SELL`](knowledge/wram/VENDOR_SHOP_ITEMS_SELL.md) | `u16` | dialogue, script | Vendor Subsystem: Vendor sell item catalogue descriptor index word ($92:C2C7). |
| `$7E:2459` | [`INGREDIENT_SHOP`](knowledge/wram/INGREDIENT_SHOP.md) | `u16` | alchemy, script | Game script variable: INGREDIENT SHOP |
| `$7E:245B` | [`CUTSCENE_ACTOR_ENTITY`](knowledge/wram/CUTSCENE_ACTOR_ENTITY.md) | `u16` | entity, script | Script Subsystem: Cutscene NPC actor entity handle word ($94:DCFA, $94:DD08). |
| `$7E:245D` | [`FALL_ANIMATION_DELAY`](knowledge/wram/FALL_ANIMATION_DELAY.md) | `u16` | script, system | Script Subsystem: Falling / swirling exit animation duration parameter word ($93:E515). |
| `$7E:245F` | [`ROOM_ARRIVAL_DIALOGUE_TRIGGERED`](knowledge/wram/ROOM_ARRIVAL_DIALOGUE_TRIGGERED.md) | `u16` | map, dialogue | Room Script Subsystem: One-shot room arrival dialogue executed flag word ($94:D033). |
| `$7E:2461` | [`LOOT_AMOUNT`](knowledge/wram/LOOT_AMOUNT.md) | `u16` | item, script | Loot bonus — amount minus one for the next pickup. The loot script adds `1 + $2461`. Pickups that give more than one write `amount − 1` here before calling the |
| `$7E:2463` | [`DIALOGUE_TEMP_ARG_0`](knowledge/wram/DIALOGUE_TEMP_ARG_0.md) | `u16` | dialogue, scratch_candidate | Transient dialogue parameter mailbox register; candidate for 2834++ scratch |
| `$7E:2465` | [`PATH_VECTOR_ORIGIN_X`](knowledge/wram/PATH_VECTOR_ORIGIN_X.md) | `u16` | map, script | Script Subsystem: Interpolated movement path origin horizontal coordinate word ($97:A52F). |
| `$7E:2467` | [`PATH_VECTOR_ORIGIN_Y`](knowledge/wram/PATH_VECTOR_ORIGIN_Y.md) | `u16` | map, script | Script Subsystem: Interpolated movement path origin vertical coordinate word ($97:A52F). |
| `$7E:2469` | [`PUZZLE_STEP_COUNTER`](knowledge/wram/PUZZLE_STEP_COUNTER.md) | `u16` | map, script | Dungeon Script Subsystem: Room puzzle / sequence step iteration counter word ($9A:B910). |
| `$7E:246B` | [`INTRO_CREDITS_LINE_MODE`](knowledge/wram/INTRO_CREDITS_LINE_MODE.md) | `u16` | currency, dialogue | Title and credits sequence text line layout mode flag (0 = 3 lines, non-zero = 2 lines; $80:C6D2, $80:C763, $80:C881). |
| `$7E:246D` | [`EXPLOSION_SCATTER_DIRECTION`](knowledge/wram/EXPLOSION_SCATTER_DIRECTION.md) | `u16` | combat, system | Combat Visual Effects Subsystem: Random multi-hit explosion particle scatter direction index (0..7; $92:D60E). |
| `$7E:246F` | [`PREHISTORIA_NPC_DIALOGUE_STAGE`](knowledge/wram/PREHISTORIA_NPC_DIALOGUE_STAGE.md) | `u16` | dialogue, script | Script Subsystem: Prehistoria jungle NPC dialogue progression stage word ($92:CC4F, $94:C41F). |
| `$7E:2471` | [`FE_VILLAGE_NPC_DIALOGUE_STAGE`](knowledge/wram/FE_VILLAGE_NPC_DIALOGUE_STAGE.md) | `u16` | dialogue, script | Script Subsystem: Fire Eyes Village NPC conversation progression stage word ($92:CC67, $94:C837). |
| `$7E:2473` | [`CAMP_EVENT_STAGE`](knowledge/wram/CAMP_EVENT_STAGE.md) | `u16` | script, system | Script Subsystem: Antiqua campfire story event progression stage word ($96:C012). |
| `$7E:2475` | [`CREDITS_STAFF_PAGE`](knowledge/wram/CREDITS_STAFF_PAGE.md) | `u16` | currency, dialogue | Game Script Subsystem: Ending credits staff presentation page index word ($92:D0FD; 1..18). |
| `$7E:2477` | [`DRAGGING_CUTSCENE_X`](knowledge/wram/DRAGGING_CUTSCENE_X.md) | `u16` | script, system | Script Subsystem: Beach dragging cutscene horizontal position coordinate word ($93:9002). |
| `$7E:2479` | [`DRAGGING_CUTSCENE_Y`](knowledge/wram/DRAGGING_CUTSCENE_Y.md) | `u16` | script, system | Script Subsystem: Beach dragging cutscene vertical position coordinate word ($93:9002). |
| `$7E:247B` | [`QUICKSAND_STAGE_OBJECT_0`](knowledge/wram/QUICKSAND_STAGE_OBJECT_0.md) | `u16` | script, system | Script Subsystem: Quicksand vortex primary object index staging word ($93:9797). |
| `$7E:247D` | [`QUICKSAND_STAGE_OBJECT_1`](knowledge/wram/QUICKSAND_STAGE_OBJECT_1.md) | `u16` | script, system | Script Subsystem: Quicksand vortex secondary object index staging word ($93:98F1). |
| `$7E:247F` | [`QUICKSAND_STAGE_OBJECT_2`](knowledge/wram/QUICKSAND_STAGE_OBJECT_2.md) | `u8` | script, system | Script Subsystem: Quicksand vortex tertiary object index staging byte ($93:99BB). |
| `$7E:2480` | [`WEATHER_PARTICLES`](knowledge/wram/WEATHER_PARTICLES.md) | `u32` | weather | Position, velocity, and lifetime particle physics state array (rain, snow, embers). |
| `$7E:2484` | [`QUICKSAND_STAGE_ALIGN_PAD_0`](knowledge/wram/QUICKSAND_STAGE_ALIGN_PAD_0.md) | `u8` | script, unused | 1-byte alignment padding ($7E:2484) preceding quicksand object staging table (unused to our knowledge). |
| `$7E:2485` | [`QUICKSAND_STAGE_OBJECT_3`](knowledge/wram/QUICKSAND_STAGE_OBJECT_3.md) | `u16` | script, system | Script Subsystem: Quicksand vortex object 3 staging word ($93:9891). |
| `$7E:2487` | [`QUICKSAND_STAGE_ALIGN_PAD_1`](knowledge/wram/QUICKSAND_STAGE_ALIGN_PAD_1.md) | `u8[2]` | script, unused | 2-byte alignment gap ($7E:2487..$7E:2488) between quicksand stage registers (unused to our knowledge). |
| `$7E:2489` | [`QUICKSAND_STAGE_OBJECT_4`](knowledge/wram/QUICKSAND_STAGE_OBJECT_4.md) | `u16` | script, system | Script Subsystem: Quicksand vortex object 4 staging word ($93:9857). |
| `$7E:248B` | [`QUICKSAND_STAGE_OBJECT_5`](knowledge/wram/QUICKSAND_STAGE_OBJECT_5.md) | `u16` | script, system | Script Subsystem: Quicksand vortex object 5 staging word ($93:97F7). |
| `$7E:248D` | [`QUICKSAND_STAGE_OBJECT_6`](knowledge/wram/QUICKSAND_STAGE_OBJECT_6.md) | `u16` | script, system | Script Subsystem: Quicksand vortex object 6 staging word ($93:9ADB). |
| `$7E:248F` | [`QUICKSAND_STAGE_OBJECT_7`](knowledge/wram/QUICKSAND_STAGE_OBJECT_7.md) | `u16` | script, system | Script Subsystem: Quicksand vortex object 7 staging word ($93:9827). |
| `$7E:2491` | [`QUICKSAND_TRIGGER_OBJECT_INDEX`](knowledge/wram/QUICKSAND_TRIGGER_OBJECT_INDEX.md) | `u16` | script | Quicksand Field trigger object index |
| `$7E:2493` | [`LIFT_WAYPOINT_X`](knowledge/wram/LIFT_WAYPOINT_X.md) | `u16` | script, system | Script Subsystem: Lift / elevator transit target waypoint horizontal coordinate word ($93:90A6). |
| `$7E:2495` | [`LIFT_WAYPOINT_Y`](knowledge/wram/LIFT_WAYPOINT_Y.md) | `u16` | script, system | Script Subsystem: Lift / elevator transit target waypoint vertical coordinate word ($93:90A6). |
| `$7E:2497` | [`TARGET_WAYPOINT_X`](knowledge/wram/TARGET_WAYPOINT_X.md) | `u16` | system, scratch_candidate | Transient destination X coordinate for forced character walk; candidate for 2834++ scratch |
| `$7E:2499` | [`TARGET_WAYPOINT_Y`](knowledge/wram/TARGET_WAYPOINT_Y.md) | `u16` | system, scratch_candidate | Transient destination Y coordinate for forced character walk; candidate for 2834++ scratch |
| `$7E:249B` | [`PUZZLE_TARGET_OBJECT`](knowledge/wram/PUZZLE_TARGET_OBJECT.md) | `u16` | map, script | Script Subsystem: Dungeon puzzle target object index word ($93:CFE1). |
| `$7E:249D` | [`TRANSIT_ORIGIN_X`](knowledge/wram/TRANSIT_ORIGIN_X.md) | `u16` | script | Scripted lift / transit movement origin X coordinate in world pixels |
| `$7E:249F` | [`TRANSIT_ORIGIN_Y`](knowledge/wram/TRANSIT_ORIGIN_Y.md) | `u16` | script | Scripted lift / transit movement origin Y coordinate in world pixels |
| `$7E:24A1` | [`TRANSIT_DEST_X`](knowledge/wram/TRANSIT_DEST_X.md) | `u16` | script | Scripted lift / transit movement destination X coordinate in world pixels |
| `$7E:24A3` | [`TRANSIT_DEST_Y`](knowledge/wram/TRANSIT_DEST_Y.md) | `u16` | script | Scripted lift / transit movement destination Y coordinate in world pixels |
| `$7E:24A5` | [`ROLLING_ACTOR_ENTITY`](knowledge/wram/ROLLING_ACTOR_ENTITY.md) | `u16` | entity, script | Script Subsystem: Rolling lizard NPC actor entity handle ($93:D617). |
| `$7E:24A7` | [`SIMULATION_SCRATCH_A7`](knowledge/wram/SIMULATION_SCRATCH_A7.md) | `u16` | system, scratch_candidate | Transient physics simulation scratch word; candidate for 2834++ scratch |
| `$7E:24A9` | [`INACTIVE_TRAJECTORY_VY`](knowledge/wram/INACTIVE_TRAJECTORY_VY.md) | `u16` | dog, script | Script Subsystem: Inactive companion character vertical trajectory velocity word ($93:E82C). |
| `$7E:24AB` | [`ACTIVE_CHAR_X`](knowledge/wram/ACTIVE_CHAR_X.md) | `u16` | system | Staged X position of the active player character in world pixels or subpixels |
| `$7E:24AD` | [`INACTIVE_CHAR_X`](knowledge/wram/INACTIVE_CHAR_X.md) | `u16` | dog | Staged X position of the inactive companion character in world pixels |
| `$7E:24AF` | [`ACTIVE_CHAR_Y`](knowledge/wram/ACTIVE_CHAR_Y.md) | `u16` | system | Staged Y position of the active player character in world pixels or subpixels |
| `$7E:24B1` | [`INACTIVE_CHAR_Y`](knowledge/wram/INACTIVE_CHAR_Y.md) | `u16` | dog | Staged Y position of the inactive companion character in world pixels |
| `$7E:24B3` | [`SCRIPT_CALL_ARG_1`](knowledge/wram/SCRIPT_CALL_ARG_1.md) | `u16` | script, scratch_candidate | Transient script call parameter register 1; candidate for 2834++ scratch |
| `$7E:24B5` | [`SCRIPT_CALL_ARG_2`](knowledge/wram/SCRIPT_CALL_ARG_2.md) | `u16` | script, scratch_candidate | Transient script call parameter register 2; candidate for 2834++ scratch |
| `$7E:24B7` | [`SCRIPT_CALL_ARG_3`](knowledge/wram/SCRIPT_CALL_ARG_3.md) | `u16` | script, scratch_candidate | Transient script call parameter register 3; candidate for 2834++ scratch |
| `$7E:24B9` | [`INACTIVE_TRAJECTORY_VX`](knowledge/wram/INACTIVE_TRAJECTORY_VX.md) | `u16` | dog, script | Script Subsystem: Inactive companion character horizontal trajectory velocity word ($93:E81F). |
| `$7E:24BB` | [`CAMERA_PAN_TARGET_OBJECT`](knowledge/wram/CAMERA_PAN_TARGET_OBJECT.md) | `u16` | map, script | Script Subsystem: Target object index focused prior to camera pan sequence ($94:8E1D). |
| `$7E:24BD` | [`TRANSITION_STAGING_ALIGN_PAD`](knowledge/wram/TRANSITION_STAGING_ALIGN_PAD.md) | `u8[6]` | map, script, unused | 6-byte alignment gap ($7E:24BD..$7E:24C2) between camera pan target object and transition staging cell (unused to our knowledge). |
| `$7E:24C3` | [`TRANSITION_STAGING_C3`](knowledge/wram/TRANSITION_STAGING_C3.md) | `u16` | map, scratch_candidate | Transient room transition staging cell; candidate for 2834++ scratch |
| `$7E:24C5` | [`BUGMUCK_CUTSCENE_STAGE_0`](knowledge/wram/BUGMUCK_CUTSCENE_STAGE_0.md) | `u16` | script, system | Script Subsystem: Prehistoria Bugmuck cutscene stage slot 0 word ($94:B680). |
| `$7E:24C7` | [`BUGMUCK_CUTSCENE_STAGE_1`](knowledge/wram/BUGMUCK_CUTSCENE_STAGE_1.md) | `u16` | script, system | Script Subsystem: Prehistoria Bugmuck cutscene stage slot 1 word ($94:B6CE). |
| `$7E:24C9` | [`BUGMUCK_CUTSCENE_STAGE_2`](knowledge/wram/BUGMUCK_CUTSCENE_STAGE_2.md) | `u16` | script, system | Script Subsystem: Prehistoria Bugmuck cutscene stage slot 2 word ($94:B69F). |
| `$7E:24CB` | [`BUGMUCK_CUTSCENE_STAGE_3`](knowledge/wram/BUGMUCK_CUTSCENE_STAGE_3.md) | `u16` | script, system | Script Subsystem: Prehistoria Bugmuck cutscene stage slot 3 word ($94:B650). |
| `$7E:24CD` | [`BUGMUCK_CUTSCENE_STAGE_4`](knowledge/wram/BUGMUCK_CUTSCENE_STAGE_4.md) | `u16` | script, system | Script Subsystem: Prehistoria Bugmuck cutscene stage slot 4 word ($94:B6BE). |
| `$7E:24CF` | [`CUTSCENE_WAYPOINT_X_CF`](knowledge/wram/CUTSCENE_WAYPOINT_X_CF.md) | `u16` | map, script | Script Subsystem: Cutscene target waypoint horizontal coordinate word ($94:E7EF). |
| `$7E:24D1` | [`CUTSCENE_WAYPOINT_Y_D1`](knowledge/wram/CUTSCENE_WAYPOINT_Y_D1.md) | `u16` | map, script | Script Subsystem: Cutscene target waypoint vertical coordinate word ($94:E7EF). |
| `$7E:24D3` | [`CUTSCENE_WAYPOINT_X_D3`](knowledge/wram/CUTSCENE_WAYPOINT_X_D3.md) | `u16` | map, script | Script Subsystem: Cutscene waypoint horizontal coordinate word ($95:84AF). |
| `$7E:24D5` | [`CUTSCENE_WAYPOINT_Y_D5`](knowledge/wram/CUTSCENE_WAYPOINT_Y_D5.md) | `u16` | map, script | Script Subsystem: Cutscene waypoint vertical coordinate word ($95:84BB). |
| `$7E:24D7` | [`CUTSCENE_ACTOR_ENTITY_D7`](knowledge/wram/CUTSCENE_ACTOR_ENTITY_D7.md) | `u16` | entity, script | Script Subsystem: Cutscene NPC actor entity handle ($96:BA82). |
| `$7E:24D9` | [`CUTSCENE_WAYPOINT_X_D9`](knowledge/wram/CUTSCENE_WAYPOINT_X_D9.md) | `u16` | map, script | Script Subsystem: Cutscene target waypoint horizontal coordinate word ($97:8C9D). |
| `$7E:24DB` | [`CUTSCENE_WAYPOINT_Y_DB`](knowledge/wram/CUTSCENE_WAYPOINT_Y_DB.md) | `u16` | map, script | Script Subsystem: Cutscene target waypoint vertical coordinate word ($97:8C9D). |
| `$7E:24DD` | [`CUTSCENE_WAYPOINT_X_DD`](knowledge/wram/CUTSCENE_WAYPOINT_X_DD.md) | `u16` | map, script | Script Subsystem: Cutscene movement waypoint horizontal coordinate word ($97:89D0). |
| `$7E:24DF` | [`CUTSCENE_WAYPOINT_Y_DF`](knowledge/wram/CUTSCENE_WAYPOINT_Y_DF.md) | `u16` | map, script | Script Subsystem: Cutscene movement waypoint vertical coordinate word ($97:89D0). |
| `$7E:24E1` | [`CUTSCENE_SEQUENCE_STATE_E1`](knowledge/wram/CUTSCENE_SEQUENCE_STATE_E1.md) | `u16` | script, system | Script Subsystem: Cutscene sequence progress state word ($97:8CF2). |
| `$7E:24E3` | [`CUTSCENE_SEQUENCE_BRANCH_E3`](knowledge/wram/CUTSCENE_SEQUENCE_BRANCH_E3.md) | `u16` | script, system | Script Subsystem: Cutscene sequence branch / condition word ($97:8D59). |
| `$7E:24E5` | [`SALABOG_ENTITY`](knowledge/wram/SALABOG_ENTITY.md) | `entity` | combat, map, scratch_candidate | Entity reference to spawned Salabog boss in Swamp (Room 0x01); candidate for 2834++ scratch |
| `$7E:24E7` | [`CUTSCENE_PROGRESS_E7`](knowledge/wram/CUTSCENE_PROGRESS_E7.md) | `u16` | script, system | Script Subsystem: Cutscene progress stage word ($97:98B5). |
| `$7E:24E9` | [`CUTSCENE_WAYPOINT_X_E9`](knowledge/wram/CUTSCENE_WAYPOINT_X_E9.md) | `u16` | map, script | Script Subsystem: Cutscene target waypoint horizontal coordinate word ($97:A550). |
| `$7E:24EB` | [`CUTSCENE_WAYPOINT_Y_EB`](knowledge/wram/CUTSCENE_WAYPOINT_Y_EB.md) | `u16` | map, script | Script Subsystem: Cutscene target waypoint vertical coordinate word ($97:A550). |
| `$7E:24ED` | [`TOWER_LIFT_WAYPOINT_PAD`](knowledge/wram/TOWER_LIFT_WAYPOINT_PAD.md) | `u8[2]` | script, map, unused | 2-byte alignment gap ($7E:24ED..$7E:24EE) between cutscene waypoint registers and tower lift coordinates (unused to our knowledge). |
| `$7E:24EF` | [`TOWER_LIFT_WAYPOINT_X_0`](knowledge/wram/TOWER_LIFT_WAYPOINT_X_0.md) | `u16` | map, script | Script Subsystem: Gomi's tower lift primary horizontal destination coordinate word ($99:9C7D). |
| `$7E:24F1` | [`TOWER_LIFT_WAYPOINT_Y_0`](knowledge/wram/TOWER_LIFT_WAYPOINT_Y_0.md) | `u16` | map, script | Script Subsystem: Gomi's tower lift primary vertical destination coordinate word ($99:9C7D). |
| `$7E:24F3` | [`TOWER_LIFT_WAYPOINT_X_1`](knowledge/wram/TOWER_LIFT_WAYPOINT_X_1.md) | `u16` | map, script | Script Subsystem: Gomi's tower lift secondary horizontal destination coordinate word ($99:9C84). |
| `$7E:24F5` | [`TOWER_LIFT_WAYPOINT_Y_1`](knowledge/wram/TOWER_LIFT_WAYPOINT_Y_1.md) | `u16` | map, script | Script Subsystem: Gomi's tower lift secondary vertical destination coordinate word ($99:9C84). |
| `$7E:24F7` | [`CUTSCENE_TRIGGER_INDEX_F7`](knowledge/wram/CUTSCENE_TRIGGER_INDEX_F7.md) | `u16` | script, system | Script Subsystem: Cutscene trigger condition / step index word ($99:A7E6). |
| `$7E:24F9` | [`ROOM_OBJECT_INDEX_A`](knowledge/wram/ROOM_OBJECT_INDEX_A.md) | `u16` | map, scratch_candidate | Transient room-local object index; candidate for 2834++ scratch |
| `$7E:24FB` | [`ROOM_OBJECT_INDEX_B`](knowledge/wram/ROOM_OBJECT_INDEX_B.md) | `u16` | map, scratch_candidate | Transient room-local object index; candidate for 2834++ scratch |
| `$7E:24FD` | [`INTER_ROOM_HANDSHAKE`](knowledge/wram/INTER_ROOM_HANDSHAKE.md) | `u16` | map, scratch_candidate | Transient room transition handshake flag; candidate for 2834++ scratch |
| `$7E:24FF` | [`CUTSCENE_ACTOR_ENTITY_FF`](knowledge/wram/CUTSCENE_ACTOR_ENTITY_FF.md) | `u16` | entity, script | Script Subsystem: Cutscene NPC actor entity handle ($9A:E367). |
| `$7E:2501` | [`CUTSCENE_WAYPOINT_2501`](knowledge/wram/CUTSCENE_WAYPOINT_2501.md) | `u16` | map, script | Script Subsystem: Cutscene target waypoint parameter word ($9A:E36F). |
| `$7E:2503` | [`CUTSCENE_WAYPOINT_X_2503`](knowledge/wram/CUTSCENE_WAYPOINT_X_2503.md) | `u16` | map, script | Script Subsystem: Cutscene destination horizontal coordinate word ($9A:E357). |
| `$7E:2505` | [`CUTSCENE_WAYPOINT_Y_2505`](knowledge/wram/CUTSCENE_WAYPOINT_Y_2505.md) | `u16` | map, script | Script Subsystem: Cutscene destination vertical coordinate word ($9A:E35F). |
| `$7E:2507` | [`TIMED_EVENT_TARGET_X_07`](knowledge/wram/TIMED_EVENT_TARGET_X_07.md) | `u16` | script, system | Script Subsystem: Timed event target waypoint horizontal coordinate word 0 ($9B:CD6C). |
| `$7E:2509` | [`TIMED_EVENT_TARGET_Y_09`](knowledge/wram/TIMED_EVENT_TARGET_Y_09.md) | `u16` | script, system | Script Subsystem: Timed event target waypoint vertical coordinate word 0 ($9B:CD74). |
| `$7E:250B` | [`TIMED_EVENT_TARGET_X_0B`](knowledge/wram/TIMED_EVENT_TARGET_X_0B.md) | `u16` | script, system | Script Subsystem: Timed event target waypoint horizontal coordinate word 1 ($9B:CD7C). |
| `$7E:250D` | [`TIMED_EVENT_TARGET_Y_0D`](knowledge/wram/TIMED_EVENT_TARGET_Y_0D.md) | `u16` | script, system | Script Subsystem: Timed event target waypoint vertical coordinate word 1 ($9B:CD86). |
| `$7E:250F` | [`TIMED_EVENT_TARGET_X_0F`](knowledge/wram/TIMED_EVENT_TARGET_X_0F.md) | `u16` | script, system | Script Subsystem: Timed event target waypoint horizontal coordinate word 2 ($9B:CD90). |
| `$7E:2511` | [`TIMED_EVENT_TARGET_Y_11`](knowledge/wram/TIMED_EVENT_TARGET_Y_11.md) | `u16` | script, system | Script Subsystem: Timed event target waypoint vertical coordinate word 2 ($9B:CD98). |
| `$7E:2513` | [`VOLATILE_COUNTDOWN_TIMER`](knowledge/wram/VOLATILE_COUNTDOWN_TIMER.md) | `u16` | map, system, scratch_candidate | Volatile room event timer countdown register; candidate for 2834++ scratch |
| `$7E:2515` | [`MARKET_TIMER_MINUTES_REMAINING`](knowledge/wram/MARKET_TIMER_MINUTES_REMAINING.md) | `u16` | dialogue, system | Nobilia Market countdown remaining minutes (15..1) |
| `$7E:2517` | [`sram_chest_flags_0`](knowledge/wram/sram_chest_flags_0.md) | `u16` | script | Persistent treasure chest / gourd collection bitmask words 0..1 (gourds 0..31 in Cartridge SRAM payload). |
| `$7E:2519` | [`sram_chest_flags_1`](knowledge/wram/sram_chest_flags_1.md) | `u16` | script | Persistent treasure chest / gourd collection bitmask words 2..3 (gourds 32..63). |
| `$7E:251B` | [`sram_chest_flags_2`](knowledge/wram/sram_chest_flags_2.md) | `u16` | script | Persistent treasure chest / gourd collection bitmask words 4..5 (gourds 64..95). |
| `$7E:251D` | [`sram_chest_flags_3`](knowledge/wram/sram_chest_flags_3.md) | `u16` | script | Persistent treasure chest / gourd collection bitmask words 6..7 (gourds 96..127). |
| `$7E:251F` | [`sram_chest_flags_4`](knowledge/wram/sram_chest_flags_4.md) | `u16` | script | Persistent treasure chest / gourd collection bitmask words 8..9 (gourds 128..159). |
| `$7E:2521` | [`sram_chest_flags_5`](knowledge/wram/sram_chest_flags_5.md) | `u16` | script | Persistent treasure chest / gourd collection bitmask words 10..11 (gourds 160..191). |
| `$7E:2523` | [`sram_chest_flags_6`](knowledge/wram/sram_chest_flags_6.md) | `u16` | script | Persistent treasure chest / gourd collection bitmask words 12..13 (gourds 192..223). |
| `$7E:2525` | [`sram_chest_flags_7`](knowledge/wram/sram_chest_flags_7.md) | `u16` | script | Persistent treasure chest / gourd collection bitmask words 14..15 (gourds 224..255). |
| `$7E:2527` | [`sram_chest_flags_8`](knowledge/wram/sram_chest_flags_8.md) | `u16` | script | Persistent treasure chest / gourd collection bitmask words 16..17 (gourds 256..287). |
| `$7E:2529` | [`sram_chest_flags_9`](knowledge/wram/sram_chest_flags_9.md) | `u16` | script | Persistent treasure chest / gourd collection bitmask words 18..19 (gourds 288..319). |
| `$7E:252B` | [`sram_chest_flags_10`](knowledge/wram/sram_chest_flags_10.md) | `u16` | script | Persistent treasure chest / gourd collection bitmask words 20..21 (gourds 320..351). |
| `$7E:252D` | [`sram_chest_flags_11`](knowledge/wram/sram_chest_flags_11.md) | `u16` | script | Persistent treasure chest / gourd collection bitmask words 22..23 (gourds 352..383). |
| `$7E:252F` | [`sram_chest_flags_12`](knowledge/wram/sram_chest_flags_12.md) | `u16` | script | Persistent treasure chest / gourd collection bitmask words 24..25 (gourds 384..415). |
| `$7E:2531` | [`sram_chest_flags_13`](knowledge/wram/sram_chest_flags_13.md) | `u16` | script | Persistent treasure chest / gourd collection bitmask words 26..27 (gourds 416..447). |
| `$7E:2533` | [`sram_boss_defeated_flags`](knowledge/wram/sram_boss_defeated_flags.md) | `u16` | combat, script | Persistent campaign boss defeat bitmask (Thraxx, Salabog, Magmar, Vigor, Megataur, Rimsala, Carltron). |
| `$7E:2535` | [`LOOT_TEXT_ARG_ALIGN_PAD`](knowledge/wram/LOOT_TEXT_ARG_ALIGN_PAD.md) | `u8[2]` | script, dialogue, unused | 2-byte alignment gap ($7E:2535..$7E:2536) between overworld zone index and loot text arg (unused to our knowledge). |
| `$7E:2537` | [`LOOT_TEXT_ARG_2`](knowledge/wram/LOOT_TEXT_ARG_2.md) | `u16` | item, dialogue | Secondary text parameter mailbox for loot pickup message box formatting |
| `$7E:2539` | [`LOOT_TEXT_ARG_1`](knowledge/wram/LOOT_TEXT_ARG_1.md) | `u16` | item, dialogue | Primary text parameter mailbox for loot pickup message box formatting |
| `$7E:253B` | [`FLIGHT_LANDING_ARG`](knowledge/wram/FLIGHT_LANDING_ARG.md) | `u16` | mode7 | Overworld flight landing parameter word ($93:DC39). |
| `$7E:253D` | [`DIALOGUE_SELECTION_ALIGN_PAD`](knowledge/wram/DIALOGUE_SELECTION_ALIGN_PAD.md) | `u8[8]` | dialogue, unused | 8-byte alignment gap ($7E:253D..$7E:2544) between flight landing parameter and dialogue selection index (unused to our knowledge). |
| `$7E:2545` | [`DIALOGUE_SELECTION`](knowledge/wram/DIALOGUE_SELECTION.md) | `u16` | dialogue, scratch_candidate | Player choice selection index from interactive menu; candidate for 2834++ scratch |
| `$7E:2547` | [`MARKET_PEDDLER_SELECTION`](knowledge/wram/MARKET_PEDDLER_SELECTION.md) | `u16` | dialogue | Nobilia Market peddler dialogue branch selection index ($92:CBC1). |
| `$7E:2549` | [`PEDDLER_TRANSACTION_ALIGN_PAD`](knowledge/wram/PEDDLER_TRANSACTION_ALIGN_PAD.md) | `u8[4]` | dialogue, unused | 4-byte alignment gap ($7E:2549..$7E:254C) between market peddler selection and transaction count (unused to our knowledge). |
| `$7E:254D` | [`PEDDLER_COOLDOWN_START_FRAME`](knowledge/wram/PEDDLER_COOLDOWN_START_FRAME.md) | `u16` | dialogue, scratch_candidate | Nobilia market entrance peddler cooldown start frame; candidate for 2834++ scratch |
| `$7E:254F` | [`STAGED_WARP_MAP`](knowledge/wram/STAGED_WARP_MAP.md) | `u16` | map, script | Script Subsystem: Staged warp / transit destination map index word ($94:A5EA). |
| `$7E:2551` | [`WARP_RETURN_FLAG`](knowledge/wram/WARP_RETURN_FLAG.md) | `u16` | map, script | Script Subsystem: Warp / return transition branch flag word ($94:A591). |
| `$7E:2553` | [`EVENT_DISPATCH_FLAG`](knowledge/wram/EVENT_DISPATCH_FLAG.md) | `u16` | script, system | Script Subsystem: Global event sequence dispatch flag word ($92:C7C0). |
| `$7E:2555` | [`PARTICLE_EFFECT_STEP`](knowledge/wram/PARTICLE_EFFECT_STEP.md) | `u16` | script, system | Script Subsystem: Explosion / particle effect animation step counter ($92:D5BD). |
| `$7E:2557` | [`PUZZLE_STATE_2557`](knowledge/wram/PUZZLE_STATE_2557.md) | `u16` | map, script | Script Subsystem: Puzzle / minigame progress register word ($9A:BB9A). |
| `$7E:2559` | [`COMPILER_ARENA_PRE_BUFFER`](knowledge/wram/COMPILER_ARENA_PRE_BUFFER.md) | `u8[731]` | system, unused | 731-byte unreferenced memory buffer ($7E:2559..$7E:2833) preceding compiler scratch arena (unused to our knowledge). |
| `$7E:2834` | [`TEMP_COMPILER_ARENA`](knowledge/wram/TEMP_COMPILER_ARENA.md) | `u8[0xC8]` | map, script | Everscript compiler room scratch; wiped automatically on room load |
| `$7E:28FC` | [`VM_SCRIPT_SLOTS`](knowledge/wram/VM_SCRIPT_SLOTS.md) | `ScriptSlot[20]` | script | Active Script VM thread execution queue (20 slots × 79 bytes) |
| `$7E:2F28` | [`SCRIPT_SLOT_QUEUE_TAIL`](knowledge/wram/SCRIPT_SLOT_QUEUE_TAIL.md) | `u16[21]` | script | Script VM: Active thread run list, slots in run order, zero-terminated ($7E:2F28..$7E:2F51). |
| `$7E:2F52` | [`FORMULA_XP_ACID_RAIN`](knowledge/wram/FORMULA_XP_ACID_RAIN.md) | `u16` | alchemy | Alchemy Progression: Current experience points (0..99 XP) for formula Acid Rain ($91:D850) |
| `$7E:2F54` | [`FORMULA_XP_ATLAS`](knowledge/wram/FORMULA_XP_ATLAS.md) | `u16` | alchemy | Alchemy Progression: Current experience points (0..99 XP) for formula Atlas ($91:D850) |
| `$7E:2F56` | [`FORMULA_XP_BARRIER`](knowledge/wram/FORMULA_XP_BARRIER.md) | `u16` | alchemy | Alchemy Progression: Current experience points (0..99 XP) for formula Barrier ($91:D850) |
| `$7E:2F58` | [`FORMULA_XP_CALL_UP`](knowledge/wram/FORMULA_XP_CALL_UP.md) | `u16` | alchemy | Alchemy Progression: Current experience points (0..99 XP) for formula Call Up ($91:D850) |
| `$7E:2F5A` | [`FORMULA_XP_CORROSION`](knowledge/wram/FORMULA_XP_CORROSION.md) | `u16` | alchemy | Alchemy Progression: Current experience points (0..99 XP) for formula Corrosion ($91:D850) |
| `$7E:2F5C` | [`FORMULA_XP_CRUSH`](knowledge/wram/FORMULA_XP_CRUSH.md) | `u16` | alchemy | Alchemy Progression: Current experience points (0..99 XP) for formula Crush ($91:D850) |
| `$7E:2F5E` | [`FORMULA_XP_CURE`](knowledge/wram/FORMULA_XP_CURE.md) | `u16` | alchemy | Alchemy Progression: Current experience points (0..99 XP) for formula Cure ($91:D850) |
| `$7E:2F60` | [`FORMULA_XP_DEFEND`](knowledge/wram/FORMULA_XP_DEFEND.md) | `u16` | alchemy | Alchemy Progression: Current experience points (0..99 XP) for formula Defend ($91:D850) |
| `$7E:2F62` | [`FORMULA_XP_DOUBLE_DRAIN`](knowledge/wram/FORMULA_XP_DOUBLE_DRAIN.md) | `u16` | alchemy | Alchemy Progression: Current experience points (0..99 XP) for formula Double Drain ($91:D850) |
| `$7E:2F64` | [`FORMULA_XP_DRAIN`](knowledge/wram/FORMULA_XP_DRAIN.md) | `u16` | alchemy | Alchemy Progression: Current experience points (0..99 XP) for formula Drain ($91:D850) |
| `$7E:2F66` | [`FORMULA_XP_ENERGIZE`](knowledge/wram/FORMULA_XP_ENERGIZE.md) | `u16` | alchemy | Alchemy Progression: Current experience points (0..99 XP) for formula Energize ($91:D850) |
| `$7E:2F68` | [`FORMULA_XP_ESCAPE`](knowledge/wram/FORMULA_XP_ESCAPE.md) | `u16` | alchemy | Alchemy Progression: Current experience points (0..99 XP) for formula Escape ($91:D850) |
| `$7E:2F6A` | [`FORMULA_XP_EXPLOSION`](knowledge/wram/FORMULA_XP_EXPLOSION.md) | `u16` | alchemy | Alchemy Progression: Current experience points (0..99 XP) for formula Explosion ($91:D850) |
| `$7E:2F6C` | [`FORMULA_XP_FIREBALL`](knowledge/wram/FORMULA_XP_FIREBALL.md) | `u16` | alchemy | Alchemy Progression: Current experience points (0..99 XP) for formula Fireball ($91:D850) |
| `$7E:2F6E` | [`FORMULA_XP_FIRE_POWER`](knowledge/wram/FORMULA_XP_FIRE_POWER.md) | `u16` | alchemy | Alchemy Progression: Current experience points (0..99 XP) for formula Fire Power ($91:D850) |
| `$7E:2F70` | [`FORMULA_XP_FLASH`](knowledge/wram/FORMULA_XP_FLASH.md) | `u16` | alchemy | Alchemy Progression: Current experience points (0..99 XP) for formula Flash ($91:D850) |
| `$7E:2F72` | [`FORMULA_XP_FORCE_FIELD`](knowledge/wram/FORMULA_XP_FORCE_FIELD.md) | `u16` | alchemy | Alchemy Progression: Current experience points (0..99 XP) for formula Force Field ($91:D850) |
| `$7E:2F74` | [`FORMULA_XP_HARD_BALL`](knowledge/wram/FORMULA_XP_HARD_BALL.md) | `u16` | alchemy | Alchemy Progression: Current experience points (0..99 XP) for formula Hard Ball ($91:D850) |
| `$7E:2F76` | [`FORMULA_XP_HEAL`](knowledge/wram/FORMULA_XP_HEAL.md) | `u16` | alchemy | Alchemy Progression: Current experience points (0..99 XP) for formula Heal ($91:D850) |
| `$7E:2F78` | [`FORMULA_XP_LANCE`](knowledge/wram/FORMULA_XP_LANCE.md) | `u16` | alchemy | Alchemy Progression: Current experience points (0..99 XP) for formula Lance ($91:D850) |
| `$7E:2F7A` | [`FORMULA_XP_LASER`](knowledge/wram/FORMULA_XP_LASER.md) | `u16` | alchemy | Alchemy Progression: Current experience points (0..99 XP) for formula Laser ($91:D850) |
| `$7E:2F7C` | [`FORMULA_XP_LEVITATE`](knowledge/wram/FORMULA_XP_LEVITATE.md) | `u16` | alchemy | Alchemy Progression: Current experience points (0..99 XP) for formula Levitate ($91:D850) |
| `$7E:2F7E` | [`FORMULA_XP_LIGHTNING_STORM`](knowledge/wram/FORMULA_XP_LIGHTNING_STORM.md) | `u16` | alchemy | Alchemy Progression: Current experience points (0..99 XP) for formula Lightning Storm ($91:D850) |
| `$7E:2F80` | [`FORMULA_XP_MIRACLE_CURE`](knowledge/wram/FORMULA_XP_MIRACLE_CURE.md) | `u16` | alchemy | Alchemy Progression: Current experience points (0..99 XP) for formula Miracle Cure ($91:D850) |
| `$7E:2F82` | [`FORMULA_XP_NITRO`](knowledge/wram/FORMULA_XP_NITRO.md) | `u16` | alchemy | Alchemy Progression: Current experience points (0..99 XP) for formula Nitro ($91:D850) |
| `$7E:2F84` | [`FORMULA_XP_ONE_UP`](knowledge/wram/FORMULA_XP_ONE_UP.md) | `u16` | alchemy | Alchemy Progression: Current experience points (0..99 XP) for formula One Up ($91:D850) |
| `$7E:2F86` | [`FORMULA_XP_REFLECT`](knowledge/wram/FORMULA_XP_REFLECT.md) | `u16` | alchemy | Alchemy Progression: Current experience points (0..99 XP) for formula Reflect ($91:D850) |
| `$7E:2F88` | [`FORMULA_XP_REGROWTH`](knowledge/wram/FORMULA_XP_REGROWTH.md) | `u16` | alchemy | Alchemy Progression: Current experience points (0..99 XP) for formula Regrowth ($91:D850) |
| `$7E:2F8A` | [`FORMULA_XP_REVEALER`](knowledge/wram/FORMULA_XP_REVEALER.md) | `u16` | alchemy | Alchemy Progression: Current experience points (0..99 XP) for formula Revealer ($91:D850) |
| `$7E:2F8C` | [`FORMULA_XP_REVIVE`](knowledge/wram/FORMULA_XP_REVIVE.md) | `u16` | alchemy | Alchemy Progression: Current experience points (0..99 XP) for formula Revive ($91:D850) |
| `$7E:2F8E` | [`FORMULA_XP_SLOW_BURN`](knowledge/wram/FORMULA_XP_SLOW_BURN.md) | `u16` | alchemy | Alchemy Progression: Current experience points (0..99 XP) for formula Slow Burn ($91:D850) |
| `$7E:2F90` | [`FORMULA_XP_SPEED`](knowledge/wram/FORMULA_XP_SPEED.md) | `u16` | alchemy | Alchemy Progression: Current experience points (0..99 XP) for formula Speed ($91:D850) |
| `$7E:2F92` | [`FORMULA_XP_STING`](knowledge/wram/FORMULA_XP_STING.md) | `u16` | alchemy | Alchemy Progression: Current experience points (0..99 XP) for formula Sting ($91:D850) |
| `$7E:2F94` | [`FORMULA_XP_STOP`](knowledge/wram/FORMULA_XP_STOP.md) | `u16` | alchemy | Alchemy Progression: Current experience points (0..99 XP) for formula Stop ($91:D850) |
| `$7E:2F96` | [`FORMULA_XP_SUPER_HEAL`](knowledge/wram/FORMULA_XP_SUPER_HEAL.md) | `u16` | alchemy | Alchemy Progression: Current experience points (0..99 XP) for formula Super Heal ($91:D850) |
| `$7E:2F98` | [`FORMULA_COMBAT_POWER_ARRAY`](knowledge/wram/FORMULA_COMBAT_POWER_ARRAY.md) | `u8[70]` | alchemy, combat | 35-formula combat power ratings array (Acid Rain through Super Heal; $91:ADD0, $8D:C70D). |
| `$7E:2FDE` | [`FORMULA_USAGE_ACID_RAIN`](knowledge/wram/FORMULA_USAGE_ACID_RAIN.md) | `u16` | alchemy | Alchemy Statistics: Total lifetime casts counter for formula Acid Rain ($91:D800) |
| `$7E:2FE0` | [`FORMULA_USAGE_ATLAS`](knowledge/wram/FORMULA_USAGE_ATLAS.md) | `u16` | alchemy | Alchemy Statistics: Total lifetime casts counter for formula Atlas ($91:D800) |
| `$7E:2FE2` | [`FORMULA_USAGE_BARRIER`](knowledge/wram/FORMULA_USAGE_BARRIER.md) | `u16` | alchemy | Alchemy Statistics: Total lifetime casts counter for formula Barrier ($91:D800) |
| `$7E:2FE4` | [`FORMULA_USAGE_CALL_UP`](knowledge/wram/FORMULA_USAGE_CALL_UP.md) | `u16` | alchemy | Alchemy Statistics: Total lifetime casts counter for formula Call Up ($91:D800) |
| `$7E:2FE6` | [`FORMULA_USAGE_CORROSION`](knowledge/wram/FORMULA_USAGE_CORROSION.md) | `u16` | alchemy | Alchemy Statistics: Total lifetime casts counter for formula Corrosion ($91:D800) |
| `$7E:2FE8` | [`FORMULA_USAGE_CRUSH`](knowledge/wram/FORMULA_USAGE_CRUSH.md) | `u16` | alchemy | Alchemy Statistics: Total lifetime casts counter for formula Crush ($91:D800) |
| `$7E:2FEA` | [`FORMULA_USAGE_CURE`](knowledge/wram/FORMULA_USAGE_CURE.md) | `u16` | alchemy | Alchemy Statistics: Total lifetime casts counter for formula Cure ($91:D800) |
| `$7E:2FEC` | [`FORMULA_USAGE_DEFEND`](knowledge/wram/FORMULA_USAGE_DEFEND.md) | `u16` | alchemy | Alchemy Statistics: Total lifetime casts counter for formula Defend ($91:D800) |
| `$7E:2FEE` | [`FORMULA_USAGE_DOUBLE_DRAIN`](knowledge/wram/FORMULA_USAGE_DOUBLE_DRAIN.md) | `u16` | alchemy | Alchemy Statistics: Total lifetime casts counter for formula Double Drain ($91:D800) |
| `$7E:2FF0` | [`FORMULA_USAGE_DRAIN`](knowledge/wram/FORMULA_USAGE_DRAIN.md) | `u16` | alchemy | Alchemy Statistics: Total lifetime casts counter for formula Drain ($91:D800) |
| `$7E:2FF2` | [`FORMULA_USAGE_ENERGIZE`](knowledge/wram/FORMULA_USAGE_ENERGIZE.md) | `u16` | alchemy | Alchemy Statistics: Total lifetime casts counter for formula Energize ($91:D800) |
| `$7E:2FF4` | [`CURRENCY_FORMATTED_STRING_BUF`](knowledge/wram/CURRENCY_FORMATTED_STRING_BUF.md) | `u8[2]` | currency, dialogue | UI Subsystem: Formatted decimal string output buffer for currency window ($80:B21F / $8C:E628) |
| `$7E:2FF6` | [`FORMULA_USAGE_EXPLOSION`](knowledge/wram/FORMULA_USAGE_EXPLOSION.md) | `u16` | alchemy | Alchemy Statistics: Total lifetime casts counter for formula Explosion ($91:D800) |
| `$7E:2FF8` | [`FORMULA_USAGE_FIREBALL`](knowledge/wram/FORMULA_USAGE_FIREBALL.md) | `u16` | alchemy | Alchemy Statistics: Total lifetime casts counter for formula Fireball ($91:D800) |
| `$7E:2FFA` | [`FORMULA_USAGE_FIRE_POWER`](knowledge/wram/FORMULA_USAGE_FIRE_POWER.md) | `u16` | alchemy | Alchemy Statistics: Total lifetime casts counter for formula Fire Power ($91:D800) |
| `$7E:2FFC` | [`FORMULA_USAGE_FLASH`](knowledge/wram/FORMULA_USAGE_FLASH.md) | `u16` | alchemy | Alchemy Statistics: Total lifetime casts counter for formula Flash ($91:D800) |
| `$7E:2FFE` | [`FORMULA_USAGE_FORCE_FIELD`](knowledge/wram/FORMULA_USAGE_FORCE_FIELD.md) | `u16` | alchemy | Alchemy Statistics: Total lifetime casts counter for formula Force Field ($91:D800) |
| `$7E:3000` | [`FORMULA_USAGE_HARD_BALL`](knowledge/wram/FORMULA_USAGE_HARD_BALL.md) | `u16` | alchemy | Alchemy Statistics: Total lifetime casts counter for formula Hard Ball ($91:D800) |
| `$7E:3002` | [`FORMULA_USAGE_HEAL`](knowledge/wram/FORMULA_USAGE_HEAL.md) | `u16` | alchemy | Alchemy Statistics: Total lifetime casts counter for formula Heal ($91:D800) |
| `$7E:3004` | [`FORMULA_USAGE_LANCE`](knowledge/wram/FORMULA_USAGE_LANCE.md) | `u16` | alchemy | Alchemy Statistics: Total lifetime casts counter for formula Lance ($91:D800) |
| `$7E:3006` | [`FORMULA_USAGE_LASER`](knowledge/wram/FORMULA_USAGE_LASER.md) | `u16` | alchemy | Alchemy Statistics: Total lifetime casts counter for formula Laser ($91:D800) |
| `$7E:3008` | [`FORMULA_USAGE_LEVITATE`](knowledge/wram/FORMULA_USAGE_LEVITATE.md) | `u16` | alchemy | Alchemy Statistics: Total lifetime casts counter for formula Levitate ($91:D800) |
| `$7E:300A` | [`FORMULA_USAGE_LIGHTNING_STORM`](knowledge/wram/FORMULA_USAGE_LIGHTNING_STORM.md) | `u16` | alchemy | Alchemy Statistics: Total lifetime casts counter for formula Lightning Storm ($91:D800) |
| `$7E:300C` | [`FORMULA_USAGE_MIRACLE_CURE`](knowledge/wram/FORMULA_USAGE_MIRACLE_CURE.md) | `u16` | alchemy | Alchemy Statistics: Total lifetime casts counter for formula Miracle Cure ($91:D800) |
| `$7E:300E` | [`FORMULA_USAGE_NITRO`](knowledge/wram/FORMULA_USAGE_NITRO.md) | `u16` | alchemy | Alchemy Statistics: Total lifetime casts counter for formula Nitro ($91:D800) |
| `$7E:3010` | [`FORMULA_USAGE_ONE_UP`](knowledge/wram/FORMULA_USAGE_ONE_UP.md) | `u16` | alchemy | Alchemy Statistics: Total lifetime casts counter for formula One Up ($91:D800) |
| `$7E:3012` | [`FORMULA_USAGE_REFLECT`](knowledge/wram/FORMULA_USAGE_REFLECT.md) | `u16` | alchemy | Alchemy Statistics: Total lifetime casts counter for formula Reflect ($91:D800) |
| `$7E:3014` | [`FORMULA_USAGE_REGROWTH`](knowledge/wram/FORMULA_USAGE_REGROWTH.md) | `u16` | alchemy | Alchemy Statistics: Total lifetime casts counter for formula Regrowth ($91:D800) |
| `$7E:3016` | [`FORMULA_USAGE_REVEALER`](knowledge/wram/FORMULA_USAGE_REVEALER.md) | `u16` | alchemy | Alchemy Statistics: Total lifetime casts counter for formula Revealer ($91:D800) |
| `$7E:3018` | [`FORMULA_USAGE_REVIVE`](knowledge/wram/FORMULA_USAGE_REVIVE.md) | `u16` | alchemy | Alchemy Statistics: Total lifetime casts counter for formula Revive ($91:D800) |
| `$7E:301A` | [`FORMULA_USAGE_SLOW_BURN`](knowledge/wram/FORMULA_USAGE_SLOW_BURN.md) | `u16` | alchemy | Alchemy Statistics: Total lifetime casts counter for formula Slow Burn ($91:D800) |
| `$7E:301C` | [`FORMULA_USAGE_SPEED`](knowledge/wram/FORMULA_USAGE_SPEED.md) | `u16` | alchemy | Alchemy Statistics: Total lifetime casts counter for formula Speed ($91:D800) |
| `$7E:301E` | [`FORMULA_USAGE_STING`](knowledge/wram/FORMULA_USAGE_STING.md) | `u16` | alchemy | Alchemy Statistics: Total lifetime casts counter for formula Sting ($91:D800) |
| `$7E:3020` | [`FORMULA_USAGE_STOP`](knowledge/wram/FORMULA_USAGE_STOP.md) | `u16` | alchemy | Alchemy Statistics: Total lifetime casts counter for formula Stop ($91:D800) |
| `$7E:3022` | [`FORMULA_USAGE_SUPER_HEAL`](knowledge/wram/FORMULA_USAGE_SUPER_HEAL.md) | `u16` | alchemy | Alchemy Statistics: Total lifetime casts counter for formula Super Heal ($91:D800) |
| `$7E:3024` | [`HUD_POPUP_TEXT_PRE_BUFFER`](knowledge/wram/HUD_POPUP_TEXT_PRE_BUFFER.md) | `u8[0x50]` | dialogue, unused | 80-byte memory buffer ($7E:3024..$7E:3073) between formula usage statistics table and HUD popup text slots (unused to our knowledge). |
| `$7E:3074` | [`HUD_POPUP_TEXT_SLOTS`](knowledge/wram/HUD_POPUP_TEXT_SLOTS.md) | `DamagePopupNode[8]` | combat, dialogue | Floating combat text and HUD notification popup ring buffer (8 slots × 64 bytes). |
| `$7E:3274` | [`ALCHEMY_FX_PALETTE_BUFFER`](knowledge/wram/ALCHEMY_FX_PALETTE_BUFFER.md) | `u16[16]` | alchemy, graphics | CGRAM transfer buffer (16 colors / 32 bytes) for alchemy visual effect palette cycling. |
| `$7E:3294` | [`SPELL_EFFECT_EMITTER_SLOTS`](knowledge/wram/SPELL_EFFECT_EMITTER_SLOTS.md) | `SpellEmitterSlot[8]` | alchemy, combat | Active spell particle and effect emitter slots (8 slots × 26 bytes) |
| `$7E:3364` | [`ANIM_ALCHEMY_SLOTS_BASE`](knowledge/wram/ANIM_ALCHEMY_SLOTS_BASE.md) | `AnimAlchemySlot[8]` | alchemy, combat | Combat Engine: 8-slot Animation Alchemy active array (stride $40=64 bytes; +$0E timer, +$12 spell ID, +$26 active flag, +$28 src, +$2A power). |
| `$7E:3564` | [`PROJ_ALCHEMY_SLOTS_BASE`](knowledge/wram/PROJ_ALCHEMY_SLOTS_BASE.md) | `ProjAlchemySlot[8]` | alchemy, weapon | Combat Engine: 8-slot Projectile Alchemy active array (stride $76=118 bytes; +$12 spell ID, +$26 active flag, +$28 src, +$2A power, +$2E target). |
| `$7E:3914` | [`PROJ_ALCHEMY_ALIGN_PAD`](knowledge/wram/PROJ_ALCHEMY_ALIGN_PAD.md) | `u8[2]` | weapon, combat, unused | 2-byte alignment gap ($7E:3914..$7E:3915) following projectile alchemy active array (unused to our knowledge). |
| `$7E:3916` | [`TARGET_SELECTION_ACTOR_0`](knowledge/wram/TARGET_SELECTION_ACTOR_0.md) | `u16` | combat, entity | Combat Subsystem: Primary candidate entity handle staged for combat target selection cursor ($8C:872E). |
| `$7E:3918` | [`TARGET_SELECTION_ACTOR_1`](knowledge/wram/TARGET_SELECTION_ACTOR_1.md) | `u16` | combat, entity | Combat Subsystem: Secondary candidate entity handle / list terminator for combat target selection cursor ($8C:8731). |
| `$7E:391A` | [`DAMAGE_POPUP_PRE_BUFFER`](knowledge/wram/DAMAGE_POPUP_PRE_BUFFER.md) | `u8[292]` | combat, hud, unused | 292-byte memory buffer ($7E:391A..$7E:3A3D) preceding damage popup nodes (unused to our knowledge). |
| `$7E:3A3E` | [`damage_popup_boy_node`](knowledge/wram/damage_popup_boy_node.md) | `DamagePopupNode` | boy, combat | Player 1 (Boy) floating combat damage numbers & status popup node (stride 64 bytes: screen X, Y, value, lifetime ticks). |
| `$7E:3A7E` | [`damage_popup_dog_node`](knowledge/wram/damage_popup_dog_node.md) | `DamagePopupNode` | dog, combat | Player 2 (Dog) floating combat damage numbers & status popup node (stride 64 bytes: screen X, Y, value, lifetime ticks). |
| `$7E:3ABE` | [`JOYPAD_CHORD_HISTORY`](knowledge/wram/JOYPAD_CHORD_HISTORY.md) | `u16[128]` | system | The joypad matcher's ring of recent button chords (128 words, newest at $3ABE + $3BBE). |
| `$7E:3BBE` | [`JOYPAD_CHORD_INDEX`](knowledge/wram/JOYPAD_CHORD_INDEX.md) | `u8` | system | Offset of the newest chord in the joypad chord history. A byte offset into `$3ABE`, always even, moved down by 2 per new chord. `$3BBF` right after it is the te |
| `$7E:3BBF` | [`DIALOGUE_RING_CURSOR`](knowledge/wram/DIALOGUE_RING_CURSOR.md) | `u16` | dialogue | Cyclic message buffer index for active dialogue text box rendering. |
| `$7E:3BC1` | [`SCRIPT_SPELL_TARGET_FILTER`](knowledge/wram/SCRIPT_SPELL_TARGET_FILTER.md) | `u16` | alchemy, combat | Target entity filter / exclusion value during script opcode 0x9E (cast spell) target list evaluation. |
| `$7E:3BC3` | [`CHILD_TASK_CURSOR`](knowledge/wram/CHILD_TASK_CURSOR.md) | `u16` | entity | Child actor allocation index in multi-tasking scheduler pool. |
| `$7E:3BC5` | [`SCRIPT_TASK_SELECTOR`](knowledge/wram/SCRIPT_TASK_SELECTOR.md) | `u16` | script | Active thread index in script virtual machine scheduler. |
| `$7E:3BC7` | [`ENTITY_FREE_LIST_HEAD`](knowledge/wram/ENTITY_FREE_LIST_HEAD.md) | `u16` | combat, entity | Head pointer to linked list of available actor entity slots in pool. |
| `$7E:3BC9` | [`COMPANION_WAYPOINTS_BUF`](knowledge/wram/COMPANION_WAYPOINTS_BUF.md) | `WaypointBreadcrumb[16]` | dog, combat | Breadcrumb pathfinding waypoint ring buffer for companion Dog (16 nodes × 3 bytes: `+0` X tile, `+1` Y tile, `+2` movement flags). |
| `$7E:3BF9` | [`COMPANION_WAYPOINT_16_COORDS`](knowledge/wram/COMPANION_WAYPOINT_16_COORDS.md) | `u8[3]` | dog, map | 17th waypoint coordinate entry in companion Dog breadcrumb history ring buffer (X metatile grid position, Y metatile grid position, elevation layer plane). |
| `$7E:3BFC` | [`COMPANION_LATCHED_OBSTACLE`](knowledge/wram/COMPANION_LATCHED_OBSTACLE.md) | `u16` | dog, map | Latched obstacle collision descriptor index for companion Dog waypoint navigation ($FFFF = path clear / no obstacle). |
| `$7E:3BFE` | [`BREADCRUMB_QUEUE_ALIGN_PAD`](knowledge/wram/BREADCRUMB_QUEUE_ALIGN_PAD.md) | `u8` | dog, map, unused | 1-byte alignment padding ($7E:3BFE) preceding companion breadcrumb queue tail pointer (unused to our knowledge). |
| `$7E:3BFF` | [`BREADCRUMB_QUEUE_TAIL`](knowledge/wram/BREADCRUMB_QUEUE_TAIL.md) | `u16` | dog | Tail offset pointer for companion navigation breadcrumb coordinate queue. |
| `$7E:3C01` | [`COMPANION_ANCHOR`](knowledge/wram/COMPANION_ANCHOR.md) | `u16` | dog | Target waypoint coordinate anchor guiding dog companion movement. |
| `$7E:3C03` | [`COMPANION_SUB_TARGET_X`](knowledge/wram/COMPANION_SUB_TARGET_X.md) | `u16` | dog | Sub-waypoint horizontal world coordinate used for fine interpolation along companion breadcrumbs. |
| `$7E:3C05` | [`COMPANION_SUB_TARGET_LAYER`](knowledge/wram/COMPANION_SUB_TARGET_LAYER.md) | `u8` | dog, map | Sub-waypoint elevation collision layer plane used for companion pathfinding. |
| `$7E:3C06` | [`COMPANION_TARGET_X`](knowledge/wram/COMPANION_TARGET_X.md) | `u16` | dog | Active target world horizontal coordinate toward which companion Dog steers during breadcrumb navigation. |
| `$7E:3C08` | [`COMPANION_TARGET_Y`](knowledge/wram/COMPANION_TARGET_Y.md) | `u16` | dog | Active target world vertical coordinate toward which companion Dog steers during breadcrumb navigation. |
| `$7E:3C0A` | [`COMPANION_INTERP_DIST`](knowledge/wram/COMPANION_INTERP_DIST.md) | `u16` | dog | Distance accumulator and step interpolator for companion waypoint navigation. |
| `$7E:3C0C` | [`COMPANION_SUB_HEADING`](knowledge/wram/COMPANION_SUB_HEADING.md) | `u16` | dog | Sub-heading 16-direction angle index computed for intermediate steering towards active waypoint. |
| `$7E:3C0E` | [`COMPANION_HEADING_DIR`](knowledge/wram/COMPANION_HEADING_DIR.md) | `u16` | dog | Active steering heading direction (16-direction angle index: 0=Up, 4=Right, 8=Down, 12=Left) applied to companion Dog physics. |
| `$7E:3C10` | [`COMPANION_STEP_COUNT`](knowledge/wram/COMPANION_STEP_COUNT.md) | `u16` | dog | Step counter regulating companion pathfinding recalculation frequency. |
| `$7E:3C12` | [`COMPANION_NAV_FLAGS`](knowledge/wram/COMPANION_NAV_FLAGS.md) | `u16` | dog, script | Behavioral flags for companion pathfinding (leash, obstacle avoidance, sniffing). |
| `$7E:3C14` | [`ACTOR_PARENT_LINKS`](knowledge/wram/ACTOR_PARENT_LINKS.md) | `u32` | entity | Hierarchy table linking child entity slots to their originating parent actors. |
| `$7E:3C18` | [`WAYPOINT_NODE_COORDS_PRE_PAD`](knowledge/wram/WAYPOINT_NODE_COORDS_PRE_PAD.md) | `u8[4]` | dog, unused | 4-byte alignment buffer ($7E:3C18..$7E:3C1B) preceding waypoint node world coordinates (unused to our knowledge). |
| `$7E:3C1C` | [`COMPANION_WAYPOINT_TARGET_X`](knowledge/wram/COMPANION_WAYPOINT_TARGET_X.md) | `u16` | dog | Target world horizontal pixel coordinate configured for waypoint route node 0 or primary multipart child attachment. |
| `$7E:3C1E` | [`COMPANION_WAYPOINT_TARGET_Y`](knowledge/wram/COMPANION_WAYPOINT_TARGET_Y.md) | `u16` | dog | Target world vertical pixel coordinate configured for waypoint route node 0 or primary multipart child attachment. |
| `$7E:3C20` | [`WAYPOINT_NODE_0_PAD`](knowledge/wram/WAYPOINT_NODE_0_PAD.md) | `u8[2]` | dog, unused | 2-byte trailing padding ($7E:3C20..$7E:3C21) of waypoint node 0 preceding node 1 (unused to our knowledge). |
| `$7E:3C22` | [`COMPANION_OBSTACLE_TARGET_X`](knowledge/wram/COMPANION_OBSTACLE_TARGET_X.md) | `u16` | dog | Target X coordinate during active obstacle evasion pathfinding. |
| `$7E:3C24` | [`OBSTACLE_WAYPOINTS_BUF`](knowledge/wram/OBSTACLE_WAYPOINTS_BUF.md) | `u8[52]` | dog, map | Secondary waypoint breadcrumb ring buffer used by companion Dog obstacle evasion routines (stores X/Y/layer coordinate entries and collision descriptor). |
| `$7E:3C58` | [`COMPANION_WAYPOINT_READ_PTR`](knowledge/wram/COMPANION_WAYPOINT_READ_PTR.md) | `u16` | dog | Byte offset of intermediate target waypoint node in companion breadcrumb queue. |
| `$7E:3C5A` | [`COMPANION_WAYPOINT_WRITE_PTR`](knowledge/wram/COMPANION_WAYPOINT_WRITE_PTR.md) | `u16` | dog | Byte offset of latest recorded waypoint node in companion breadcrumb queue. |
| `$7E:3C5C` | [`OBSTACLE_TARGET_COORDS`](knowledge/wram/OBSTACLE_TARGET_COORDS.md) | `u8[9]` | dog | Intermediate coordinate block (sub-target X/Y, target X/Y, interpolation flag) guiding companion Dog around environmental obstacles. |
| `$7E:3C65` | [`COMPANION_EVASION_COUNTER`](knowledge/wram/COMPANION_EVASION_COUNTER.md) | `u8` | dog | Retry attempt counter when companion encounters wall or obstacle. |
| `$7E:3C66` | [`COMPANION_EVASION_MODE`](knowledge/wram/COMPANION_EVASION_MODE.md) | `u8` | dog | Active evasion mode flag regulating companion Dog obstacle avoidance and detour state. |
| `$7E:3C67` | [`COMPANION_EVASION_DIRECTION`](knowledge/wram/COMPANION_EVASION_DIRECTION.md) | `u16` | dog | Evasion route direction enum (`0, 2, 4, 6, 8, 10, 12, 14`). |
| `$7E:3C69` | [`COMPANION_TARGET_FACING`](knowledge/wram/COMPANION_TARGET_FACING.md) | `u16` | dog | Target facing direction calculated for companion toward current goal. |
| `$7E:3C6B` | [`COMPANION_TARGET_Y_LATCH`](knowledge/wram/COMPANION_TARGET_Y_LATCH.md) | `u16` | dog | Latched goal Y position during companion pathfinding route execution. |
| `$7E:3C6D` | [`COMPANION_TARGET_ACTOR_PTR`](knowledge/wram/COMPANION_TARGET_ACTOR_PTR.md) | `entity` | dog, entity | Pointer to entity record companion is actively following (points to Boy at `$7E:4E89`). |
| `$7E:3C6F` | [`COMPANION_AI_STATE`](knowledge/wram/COMPANION_AI_STATE.md) | `u16` | dog, alchemy | Companion Dog AI behavior state enum (0 = Idle, 1 = Follow Boy, 2 = Sniffing alchemy, 3 = Obstacle evasion, 4 = Combat attack, 5 = Returning, 6 = Stuck retry). |
| `$7E:3C71` | [`boss_segment_target_x`](knowledge/wram/boss_segment_target_x.md) | `u16` | combat, entity | Target world X coordinate for tracking boss limb / satellite entity ($8C:D253). |
| `$7E:3C73` | [`boss_segment_target_y`](knowledge/wram/boss_segment_target_y.md) | `u16` | combat, entity | Target world Y coordinate for tracking boss limb / satellite entity ($8C:D25D). |
| `$7E:3C75` | [`boss_segment_offset_x`](knowledge/wram/boss_segment_offset_x.md) | `u16` | combat | Horizontal joint attachment offset X from parent boss body ($8F:9C41). |
| `$7E:3C77` | [`boss_segment_offset_y`](knowledge/wram/boss_segment_offset_y.md) | `u16` | combat | Vertical joint attachment offset Y from parent boss body ($8F:9C46). |
| `$7E:3C79` | [`WAYPOINT_NODE_1_PAD`](knowledge/wram/WAYPOINT_NODE_1_PAD.md) | `u8[2]` | dog, combat, unused | 2-byte trailing alignment padding ($7E:3C79..$7E:3C7A) of waypoint node 1 preceding slot 2 (unused to our knowledge). |
| `$7E:3C7B` | [`boss_segment_slot_2`](knowledge/wram/boss_segment_slot_2.md) | `BossSegmentSlot` | combat, script | Boss child segment slot 2 descriptor (89 bytes: joint offset, angle, limb anim state). |
| `$7E:3CD4` | [`boss_segment_slot_3`](knowledge/wram/boss_segment_slot_3.md) | `BossSegmentSlot` | combat, script | Boss child segment slot 3 descriptor (89 bytes: free link, joint offsets, parent ptr). |
| `$7E:3D2D` | [`boss_segment_slot_4`](knowledge/wram/boss_segment_slot_4.md) | `BossSegmentSlot` | combat, script | Boss child segment slot 4 descriptor (89 bytes: free link, joint offsets, parent ptr). |
| `$7E:3D86` | [`boss_segment_slot_5`](knowledge/wram/boss_segment_slot_5.md) | `BossSegmentSlot` | combat, script | Boss child segment slot 5 descriptor (89 bytes: free link, joint offsets, parent ptr). |
| `$7E:3DDF` | [`ACTIVE_ENTITY_HEAD`](knowledge/wram/ACTIVE_ENTITY_HEAD.md) | `u16` | map, entity | Head pointer of linked list chaining all active entities in current room. |
| `$7E:3DE1` | [`ACTIVE_COMPANION_HEAD`](knowledge/wram/ACTIVE_COMPANION_HEAD.md) | `u16` | dog, entity | Head of the asleep entity list (link +$5E; $8F:C514 / $8F:C40F). |
| `$7E:3DE3` | [`ENTITY_RECORD_FREE_HEAD`](knowledge/wram/ENTITY_RECORD_FREE_HEAD.md) | `u16` | entity | Head pointer to singly-linked pool of free runtime entity records in dynamic actor memory. |
| `$7E:3DE5` | [`ENTITY_DYNAMIC_POOL`](knowledge/wram/ENTITY_DYNAMIC_POOL.md) | `EntityRecord[30]` | entity | Active enemy, NPC, and dynamic entity instance slots (30 slots × 142 bytes) |
| `$7E:4E89` | [`ENTITY_PLAYER_BOY`](knowledge/wram/ENTITY_PLAYER_BOY.md) | `CharacterEntity` | boy, combat | Main player entity instance with full combat and progression stats |
| `$7E:4F37` | [`ENTITY_COMPANION_DOG`](knowledge/wram/ENTITY_COMPANION_DOG.md) | `CharacterEntity` | dog, combat | Dog companion entity instance with full combat and progression stats |
| `$7E:4FE5` | [`DOG_RECORD_ALIGN_PAD`](knowledge/wram/DOG_RECORD_ALIGN_PAD.md) | `u8` | dog, combat, unused | 1-byte alignment padding ($7E:4FE5) between Dog companion entity record and map anim buffers (unused to our knowledge). |
| `$7E:4FE6` | [`MAP_ANIM_FRAMES`](knowledge/wram/MAP_ANIM_FRAMES.md) | `u8[50]` | graphics, map | Current animation frame indices for active map animated tile channels. |
| `$7E:5018` | [`MAP_ANIM_TIMERS`](knowledge/wram/MAP_ANIM_TIMERS.md) | `u8[50]` | graphics, map | Countdown hold delay timers for active map animated tile channels. |
| `$7E:504A` | [`MAP_ANIM_CYCLES`](knowledge/wram/MAP_ANIM_CYCLES.md) | `u8[50]` | map | Loop cycle iteration counters for active map animated tile channels. |
| `$7E:507C` | [`MAP_ANIM_CYCLES_ALIGN_PAD`](knowledge/wram/MAP_ANIM_CYCLES_ALIGN_PAD.md) | `u8` | graphics, map, unused | 1-byte alignment padding ($7E:507C) between map animation cycles array and descriptor table (unused to our knowledge). |
| `$7E:507D` | [`MAP_ANIM_DESCRIPTORS`](knowledge/wram/MAP_ANIM_DESCRIPTORS.md) | `u16[16]` | graphics, map | Background tile animation ROM descriptor slot pointers (16 channels × 16-bit offset into active room blob). |
| `$7E:509D` | [`SPRITE_ALLOC_ALIGN_BUFFER`](knowledge/wram/SPRITE_ALLOC_ALIGN_BUFFER.md) | `u8[10]` | graphics, map, unused | 10-byte alignment buffer ($7E:509D..$7E:50A6) between map background tile animation descriptor table and sprite allocation pool (unused to our knowledge). |
| `$7E:50A7` | [`SPRITE_ALLOC_POOL`](knowledge/wram/SPRITE_ALLOC_POOL.md) | `SpriteAllocNode[17]` | graphics | Dynamic sprite allocation node pool (17 nodes × 8 bytes: `+$00` prev, `+$02` next, `+$04` state `$FFFF`=free, `+$06` parent). |
| `$7E:512F` | [`SPRITE_DRAW_QUEUE_NODES`](knowledge/wram/SPRITE_DRAW_QUEUE_NODES.md) | `u8[3220]` | graphics | Dynamic Y-sorted sprite draw list command node pool (occupies $7E:512F through $7E:5DC2; stride 15 bytes per node). |
| `$7E:5DC3` | [`SPAWN_RECORDS_TABLE`](knowledge/wram/SPAWN_RECORDS_TABLE.md) | `SpawnRecord[60]` | map, entity | 60-slot entity respawn descriptor ring table (stride 16 bytes: +$00 ID, +$02 X, +$04 Y, +$06 flags, +$08 cooldown, +$0A mult, +$0C cap, +$0E entity slot). |
| `$7E:6183` | [`SPAWN_CYCLE_FRAMES`](knowledge/wram/SPAWN_CYCLE_FRAMES.md) | `u16` | entity | Elapsed frame counter across spawn table scanning passes (reset in func_8FDDBB). |
| `$7E:6185` | [`SPAWN_SCAN_COUNTER`](knowledge/wram/SPAWN_SCAN_COUNTER.md) | `u16` | entity | Number of spawn slots evaluated during current frame's spawn loop iteration. |
| `$7E:6187` | [`SPRITE_CGRAM_SHADOW`](knowledge/wram/SPRITE_CGRAM_SHADOW.md) | `u16[16]` | graphics | Sprite palette 0 shadow buffer DMA-copied to SNES CGRAM during VBLANK (16 colors × 2 bytes = 32 bytes). |
| `$7E:61A7` | [`MAP_TILE_PALETTES`](knowledge/wram/MAP_TILE_PALETTES.md) | `u16[112]` | graphics, map | Tile family CGRAM palette shadow buffers (7 families × 32 bytes = 224 bytes: $7E:61A7..$7E:6286). |
| `$7E:6287` | [`SPRITE_ANIM_CHAN_PAD`](knowledge/wram/SPRITE_ANIM_CHAN_PAD.md) | `u8[2]` | graphics, unused | 2-byte trailing alignment padding ($7E:6287..$7E:6288) preceding dynamic sprite animation channel descriptors (unused to our knowledge). |
| `$7E:6289` | [`SPRITE_ANIM_CHANNELS`](knowledge/wram/SPRITE_ANIM_CHANNELS.md) | `SpriteAnimChannel[8]` | graphics, script | Dynamic sprite animation channel descriptors (8 channels × 32 bytes; active flags at +0x1C; $90:CC1A, $90:CF3A). |
| `$7E:6389` | [`PROJECTILE_ENTITY_POOL`](knowledge/wram/PROJECTILE_ENTITY_POOL.md) | `u8[350]` | weapon, combat | Active projectile entity slot allocation arena (8 slots × 44 bytes minus 2 bytes header: $7E:6389..$7E:64E6). |
| `$7E:64E7` | [`PROJECTILE_POOL_POST_BUFFER`](knowledge/wram/PROJECTILE_POOL_POST_BUFFER.md) | `u8[234]` | weapon, combat, unused | 234-byte unused RAM buffer ($7E:64E7..$7E:65D0) between projectile entity arena and palette color delta buffer (unused to our knowledge). |
| `$7E:65D1` | [`COLOR_CROSSFADE_DELTA_BUFFER`](knowledge/wram/COLOR_CROSSFADE_DELTA_BUFFER.md) | `u16[32]` | graphics | Palette cross-fade channel intermediate RGB delta buffer (32 words = 64 bytes: $7E:65D1..$7E:6610). |
| `$7E:6611` | [`COLOR_CROSSFADE_CGRAM_STAGING_BUF`](knowledge/wram/COLOR_CROSSFADE_CGRAM_STAGING_BUF.md) | `u8[572]` | graphics | CGRAM palette cross-fade output staging buffer (572 bytes: $7E:6611..$7E:684C) transferred to CGRAM during VBLANK. |
| `$7E:684D` | [`HDMA_WINDOW_INDIRECT_TABLE`](knowledge/wram/HDMA_WINDOW_INDIRECT_TABLE.md) | `u8[28]` | graphics | HDMA Channel 5 indirect table header for PPU Window 1 masking ($7E:684D..$7E:6868). |
| `$7E:6869` | [`HDMA_WINDOW_MASK_BUFFER_A`](knowledge/wram/HDMA_WINDOW_MASK_BUFFER_A.md) | `u16[266]` | graphics | PPU Window 1 scanline coordinate rasterization buffer A (266 words = 532 bytes: $7E:6869..$7E:6A7C). |
| `$7E:6A7D` | [`HDMA_WINDOW_MASK_BUFFER_B`](knowledge/wram/HDMA_WINDOW_MASK_BUFFER_B.md) | `u16[266]` | graphics | PPU Window 1 scanline coordinate rasterization buffer B (266 words = 532 bytes: $7E:6A7D..$7E:6C90). |
| `$7E:6C91` | [`dynamic_vram_tiles_8x8`](knowledge/wram/dynamic_vram_tiles_8x8.md) | `u8[1599]` | graphics | Staging buffer for dynamic 8x8 4bpp SNES sprite tiles ($7E:6C91..$7E:72D0, 32 bytes per tile) queued for VRAM DMA by obj_tile_allocate ($C0:A4B5). |
| `$7E:72D0` | [`SPRITE_TILE_STAGING_PAD`](knowledge/wram/SPRITE_TILE_STAGING_PAD.md) | `u8` | graphics, unused | 1-byte alignment padding ($7E:72D0) preceding dynamic sprite tile staging buffer (unused to our knowledge). |
| `$7E:72D1` | [`SPRITE_TILE_STAGING_BUF`](knowledge/wram/SPRITE_TILE_STAGING_BUF.md) | `u8[80]` | graphics | Staging buffer header for 4bpp sprite tile graphics unpacked dynamically before VRAM DMA upload (80 bytes: $7E:72D1..$7E:7320). |
| `$7E:7321` | [`LAVA_PALETTE_ROTATION`](knowledge/wram/LAVA_PALETTE_ROTATION.md) | `u8[16]` | graphics | Animated palette rotation buffer for bubbling molten lava surface glow. |
| `$7E:7331` | [`CRYSTAL_PALETTE_CYCLE`](knowledge/wram/CRYSTAL_PALETTE_CYCLE.md) | `u8[16]` | graphics | Animated palette cycling buffer for glowing crystalline minerals. |
| `$7E:7341` | [`HDMA_SKY_GRADIENT_TABLE`](knowledge/wram/HDMA_SKY_GRADIENT_TABLE.md) | `u8[16]` | graphics | 6-band HDMA sky horizon color gradient table constructed by func_80A1B4 for background PPU color math. |
| `$7E:7351` | [`SPRITE_TILE_DECOMP_ARENA`](knowledge/wram/SPRITE_TILE_DECOMP_ARENA.md) | `u8[2560]` | graphics | Dynamic sprite tile decompression and assembly staging arena (20 tiles × 128 bytes per 16x16 4bpp tile: $7E:7351..$7E:7D50). |
| `$7E:7D51` | [`tier1_tile_slot_lookup`](knowledge/wram/tier1_tile_slot_lookup.md) | `u8[6228]` | graphics, map | Tier 1 dynamic sprite tile frame direct lookup table ($7E:7D51..$7E:95A4), mapping frame/tile ID to allocated cache slot index. |
| `$7E:95A5` | [`tier1_cache_slot_tiles`](knowledge/wram/tier1_cache_slot_tiles.md) | `u16[128]` | graphics | Tier 1 dynamic sprite tile slot table ($7E:95A5..$7E:96A4, 128 words), tracking which tile ID occupies each VRAM slot. |
| `$7E:96A5` | [`OBJ_TILE_LRU_PREV`](knowledge/wram/OBJ_TILE_LRU_PREV.md) | `u8[128]` | graphics, map | OBJ 8x8 tile cache reverse link array (128 slots: $7E:96A5..$7E:9724) mapping predecessor in LRU eviction queue. |
| `$7E:9725` | [`tier1_lru_head_node`](knowledge/wram/tier1_lru_head_node.md) | `u8` | graphics | Most recently used (MRU) slot index in Tier 1 dynamic sprite tile cache. |
| `$7E:9726` | [`tier1_lru_tail_node`](knowledge/wram/tier1_lru_tail_node.md) | `u8` | graphics | Least recently used (LRU) slot index in Tier 1 dynamic sprite tile cache (selected for next eviction). |
| `$7E:9727` | [`OBJ_TILE_LRU_NEXT`](knowledge/wram/OBJ_TILE_LRU_NEXT.md) | `u8[130]` | graphics | OBJ 8x8 tile cache forward link array (130 bytes: $7E:9727..$7E:97A8) chaining 128 dynamic OBJ tile slots in LRU order. |
| `$7E:97A9` | [`tier2_tile_slot_lookup`](knowledge/wram/tier2_tile_slot_lookup.md) | `u8[4783]` | graphics, map | Tier 2 dynamic sprite tile frame direct lookup table ($7E:97A9..$7E:AA57, 4783 bytes), mapping pattern IDs to secondary cache slot indices. |
| `$7E:AA58` | [`tier2_cache_slot_tiles`](knowledge/wram/tier2_cache_slot_tiles.md) | `u16[96]` | graphics | Tier 2 dynamic sprite tile cache slot table (96 words = 192 bytes: $7E:AA58..$7E:AB17), tracking which pattern ID occupies each secondary VRAM slot. |
| `$7E:AB18` | [`VRAM_TILE_LRU_PREV`](knowledge/wram/VRAM_TILE_LRU_PREV.md) | `u8[96]` | graphics | Reverse link array for secondary 96-slot dynamic VRAM sprite tile LRU cache ($7E:AB18..$7E:AB77). |
| `$7E:AB78` | [`VRAM_TILE_LRU_HEAD`](knowledge/wram/VRAM_TILE_LRU_HEAD.md) | `u8` | graphics | Head index of LRU dynamic VRAM tile allocator list. |
| `$7E:AB79` | [`VRAM_TILE_LRU_MOST_RECENT`](knowledge/wram/VRAM_TILE_LRU_MOST_RECENT.md) | `u8` | graphics | Most recently allocated tile index in dynamic VRAM tile allocator. |
| `$7E:AB7A` | [`VRAM_TILE_LRU_NEXT`](knowledge/wram/VRAM_TILE_LRU_NEXT.md) | `u8[96]` | graphics | Forward links for least-recently-used (LRU) dynamic VRAM sprite tile allocator. |
| `$7E:ABDA` | [`LOW_OAM_ALIGN_PAD`](knowledge/wram/LOW_OAM_ALIGN_PAD.md) | `u8[4]` | graphics, unused | 4-byte trailing alignment buffer ($7E:ABDA..$7E:ABDD) preceding low OAM staging buffer (unused to our knowledge). |
| `$7E:ABDE` | [`LOW_OAM_TABLE_BUF`](knowledge/wram/LOW_OAM_TABLE_BUF.md) | `u8[512]` | graphics | Low OAM staging buffer (128 hardware sprites × 4 bytes = 512 bytes: $7E:ABDE..$7E:ADDD) uploaded to SNES OAM during VBLANK. |
| `$7E:ADDE` | [`HIGH_OAM_TABLE_BUF`](knowledge/wram/HIGH_OAM_TABLE_BUF.md) | `u8[32]` | graphics | High OAM staging buffer (32 bytes = 128 sprites × 2 bits: $7E:ADDE..$7E:ADFD) uploaded to SNES OAM during VBLANK. |
| `$7E:ADFE` | [`HIGH_OAM_ALIGN_PAD`](knowledge/wram/HIGH_OAM_ALIGN_PAD.md) | `u16` | graphics, unused | 2-byte alignment gap ($7E:ADFE..$7E:ADFF) trailing high OAM bit table (unused to our knowledge). |
| `$7E:AE00` | [`BANK_7E_RESERVED_RAM`](knowledge/wram/BANK_7E_RESERVED_RAM.md) | `u8[0x51FE]` | system, unused | 20.5 KB unallocated work RAM buffer ($7E:AE00..$7E:FFFD) in Bank $7E (unused to our knowledge). |
| `$7E:FFFE` | [`SCRIPT_VM_ZERO_WORD`](knowledge/wram/SCRIPT_VM_ZERO_WORD.md) | `u16` | script | Constant zero word at top of Bank $7E read by script VM |
