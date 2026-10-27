# Engine Core WRAM Memory Map & Struct Definitions

This document details all Working RAM (WRAM, Bank `$7E` and `$7F`) addresses identified and utilized across the **Secret of Evermore** engine, reset handler, main loop scheduler, NMI interrupt handler, script VM, rendering pipeline, audio, combat, and gameplay subsystems.

---

## 1. C Struct Definition: Engine Core State

> **Reconstructed C Decompilation**:
> Source moved to [`reconstructed-c/80/808F8C_wram_map.c`](../../../reconstructed-c/80/808F8C_wram_map.c).
> [View in VFS: soe://rom/code/808F8C](soe://rom/code/808F8C?c=1&asm=0)


---

## 2. Address Catalog

| Address | Size | Identifier | Lifetime | Purpose & Behavior |
|---|---|---|---|---|
| `$7F:0000` | 49920 bytes | `ROOM_METATILE_GRID` | Room | Decompressed active room 16x16 metatile layout grid buffer. |
| `$7E:0002` | 2 bytes | `DP_SCRATCH_02` | Frame | Direct Page 16-bit math scratchpad; actor anchor screen X coordinate in sprite compositor (`func_C09040`); units digit in decimal conversion (`func_C0870C`); destination write pointer in LZSS decompression (`method_0x03`). |
| `$7E:0003` | 1 byte | `DP_DECIMAL_DIGIT_TENS` | Temp | Tens digit in decimal ASCII conversion (`func_C0870C`); high byte of `DP_SCRATCH_02`. |
| `$7E:0004` | 2 bytes | `DP_SCRATCH_04` | Frame | Direct Page 16-bit math scratchpad; actor anchor screen Y coordinate in sprite compositor (`func_C09040`); hundreds digit in decimal conversion (`func_C0870C`). |
| `$7E:0005` | 1 byte | `DP_DECIMAL_DIGIT_THOUSANDS` | Temp | Thousands digit in decimal ASCII conversion (`func_C0870C`); high byte of `DP_SCRATCH_04`. |
| `$7E:0006` | 2 bytes | `DP_SPRITE_PALETTE_BASE` | Frame | Sprite attribute base flags / palette base in compositor (`func_C09040`); Markov grid row buffer start offset in map decompression (`method_0x07`). |
| `$7E:0007` | 1 byte | `DP_SPRITE_FLAGS` | Frame | Sprite attribute modifier flags in compositor (bit 0 checked/cleared; horizontal flip, vertical flip, priority); end sentinel `$FF` in decimal conversion buffer (`func_C0870C`). |
| `$7E:0008` | 2 bytes | `DP_LZSS_WINDOW_CURSOR` | Temp | LZSS decompressor 4KB sliding ring buffer write cursor (initialized to `$A000` in `$7F:A000..$7F:AFFF`). |
| `$7E:000A` | 2 bytes | `DP_LZSS_FLAG_BIT_INDEX` | Temp | LZSS decompressor current flag bit position / shift counter (0..7); Markov grid column loop index. |
| `$7E:000C` | 2 bytes | `DP_LZSS_WINDOW_WRAP_LIMIT` | Temp | LZSS decompressor ring buffer wrap threshold (`$A000 + $1000 = $B000`); Markov grid row wrap threshold. |
| `$7E:000E` | 2 bytes | `DP_LZSS_FLAG_MASK` | Temp | LZSS decompressor active bitmask (`tbl_CC9A46,x`); Markov grid row width stride. |
| `$7E:0010` | 2 bytes | `DP_MARKOV_BIT_MULTIPLIER` | Temp | Markov grid 2D bit shift multiplier (`0x0001` left-shifted). |
| `$7E:0012` | 2 bytes | `DP_SPRITE_SLICE_SCREEN_X` | Frame | Sprite slice computed on-screen X position (`$02 + slice_dx`) with viewport clipping in `func_C09040`; high byte of LZSS match offset; DMA transfer byte count latch. |
| `$7E:0014` | 2 bytes | `DP_SPRITE_SLICE_SCREEN_Y` | Frame | Sprite slice computed on-screen Y position (`$04 + slice_dy`) with viewport clipping in `func_C09040`; Markov grid accumulator. |
| `$7E:0016` | 2 bytes | `DP_SPRITE_OAM_SLICE_X` | Frame | Final clamped on-screen X position written to Low OAM (`$7E:ABDE,x`); delta X scratchpad in entity facing routine (`func_CF9DBD`). |
| `$7E:0017` | 1 byte | `DP_SPRITE_OAM_SLICE_X_HIGH` | Frame | High bit (9th bit) of sprite slice X coordinate, latched into High OAM bitmask. |
| `$7E:0018` | 2 bytes | `DP_SPRITE_OAM_SLICE_Y` | Frame | Final clamped on-screen Y position written to Low OAM (`$7E:ABDF,x`). |
| `$7E:0026` | 3 bytes | `DP_SPRITE_DESCRIPTOR_PTR` | Frame | 24-bit pointer (`$26..$28`) to active sprite slice descriptor table; source memory far pointer in VRAM/CGRAM DMA queues. |
| `$7E:002A` | 2 bytes | `DP_SCRATCH_2A` | Frame | Direct page general calculation scratch word; used in math routines and coordinate shifts. |
| `$7E:002E` | 2 bytes | `DP_DMA_DEST_ADDR` | Frame | Destination hardware word address for queued VRAM (`$2116`) or CGRAM (`$2121`) DMA transfers. |
| `$7E:0034` | 2 bytes | `DP_DECOMP_PAYLOAD_SIZE` | Temp | Uncompressed payload size in bytes passed to decompression dispatcher (`$8C:988D`). |
| `$7E:0036` | 3 bytes | `DP_DECOMP_SRC_FAR_PTR` | Temp | 24-bit pointer (`$36..$38`) to compressed source data stream. |
| `$7E:003A` | 3 bytes | `DP_DECOMP_DST_FAR_PTR` | Temp | 24-bit pointer (`$3A..$3C`) to uncompressed destination memory buffer. |
| `$7E:0059` | 2 bytes | `CAMERA_FINAL_X` | Frame | Final shaken camera horizontal scroll coordinate in pixels (written to PPU BG1HOFS). |
| `$7E:005B` | 2 bytes | `CAMERA_FINAL_Y` | Frame | Final shaken camera vertical scroll coordinate in pixels (written to PPU BG1VOFS). |
| `$7E:0070` | 2 bytes | `DP_SCRATCH_70` | Frame | Direct page scratch pointer; used by decompression and script string decoders. |
| `$7E:0072` | 1 byte | `HDMA_ENABLE_MASK` | Frame | Restored into $420C by NMI handler at scanline 225 to enable Mode 7 perspective or HDMA color gradients. |
| `$7E:007E` | 2 bytes | `SCRIPT_CURRENT_THREAD_PTR` | Frame | Pointer to currently executing ScriptSlot in active script VM thread queue ($7E:28FC..$7E:2F28). |
| `$7E:0080` | 2 bytes | `SCRIPT_CALL_STACK_PTR` | Frame | Call stack pointer for nested script subroutines (gosub). |
| `$7E:0082` | 3 bytes | `SCRIPT_PC_FAR_PTR` | Frame | Active 24-bit instruction pointer ($82..$84) consumed by script_vm_opcode_dispatch ($8C:D09C). |
| `$7E:0086` | 1 byte | `SCRIPT_VM_FREEZE_GATE` | Frame | Global script thread execution freeze flag (non-zero pauses script VM processing). |
| `$7E:00BF` | 2 bytes | `CAMERA_BASE_X` | Frame | Base room viewport top-left world X coordinate before screen shake displacement. |
| `$7E:00C1` | 2 bytes | `CAMERA_BASE_Y` | Frame | Base room viewport top-left world Y coordinate before screen shake displacement. |
| `$7E:00C3` | 2 bytes | `SCREEN_SHAKING` | Save | Game script variable: SCREEN SHAKING |
| `$7E:00C5` | 2 bytes | `SHAKE_OFFSET_X` | Frame | Horizontal camera displacement offset applied during active screen shaking. |
| `$7E:00C7` | 2 bytes | `SHAKE_OFFSET_Y` | Frame | Vertical camera displacement offset applied during active screen shaking. |
| `$7E:00C9` | 2 bytes | `SCREEN_SHAKE_INTENSITY` | Frame | Intensity scaling factor applied to screen shake random displacement. |
| `$7E:00CB` | 1 byte | `DMA_QUEUE_INDEX` | Frame | Index offset into frame VRAM upload buffer; reset to 0 by $80:8F8C at start of each frame. |
| `$7E:00CD` | 1 byte | `DP_VRAM_TILE_QUEUE_CURSOR` | Frame | Cursor offset into deferred VRAM tile pattern DMA upload queue (`$7E:163C`). |
| `$7E:00D1` | 2 bytes | `DP_TILE_GRAPHIC_STAGING_PTR` | Frame | Cursor offset into dynamic sprite tile graphic staging buffer (`$7E:72D1`, 128 bytes per tile). |
| `$7E:00D3` | 2 bytes | `DP_OAM_LOW_BYTE_CURSOR` | Frame | Low OAM table write cursor (0, 4, 8, ... up to 512 bytes = 128 sprites × 4 bytes at `$7E:ABDE`). |
| `$7E:00D4` | 1 byte | `DP_OAM_OVERFLOW_FLAG` | Frame | OAM capacity overflow check flag; drawing halts if bit `#$FE` is non-zero. |
| `$7E:00D5` | 2 bytes | `DP_OAM_HIGH_BYTE_CURSOR` | Frame | High OAM table byte cursor offset (512..543 relative to `$7E:ABDE`, or 0..31 at `$7E:ADDE`). |
| `$7E:00D7` | 1 byte | `DP_OAM_HIGH_BIT_MASK` | Frame | High OAM 2-bit rotation mask (`0x01, 0x04, 0x10, 0x40`) tracking current sprite pair in High OAM byte. |
| `$7E:00D8` | 1 byte | `DP_DYNAMIC_VRAM_TILE_BUDGET` | Frame | Remaining VRAM dynamic tile allocation budget per frame; decremented per new slice allocated. |
| `$7E:00D9` | 1 byte | `FRAME_READY_FLAG` | Frame | Set non-zero when main loop completes drawing; NMI checks before uploading VRAM and clears after upload. |
| `$7E:00DB` | 1 byte | `DP_SPRITE_ALLOC_TILE_INDEX` | Frame | Allocated VRAM tile index for active sprite slice; written to Low OAM byte 2 (`$7E:ABE0,x`). |
| `$7E:00DD` | 2 bytes | `DP_SPRITE_PATTERN_ID` | Frame | Character/monster pattern ID requested for active slice. |
| `$7E:00DF` | 1 byte | `DP_SPRITE_SLICE_ATTR_FORMAT` | Frame | Current slice format byte (bit 0 = size 8x8 vs 16x16/32x32, bits 1..3 = palette/priority). |
| `$7E:00E0` | 1 byte | `DP_SPRITE_SLICE_COUNT` | Frame | Remaining slice count for current actor during sprite composition loop (`func_C09040`). |
| `$7E:00E1` | 1 byte | `DP_SPRITE_DESCRIPTOR_OFFSET` | Frame | Current byte offset inside active sprite slice descriptor table (`ldy.b #$01; sta.b $E1; adc.b #$04`). |
| `$7E:0100` | 2 bytes | `PPU_FRAME_COUNTER_LOW` | Frame | Low 16 bits of 32-bit hardware frame counter; incremented every VBlank interrupt by nmi_v_blank_handler ($80:8460). |
| `$7E:0102` | 2 bytes | `PPU_FRAME_COUNTER_HIGH` | Frame | High 16 bits of 32-bit hardware frame counter; incremented when low word overflows. |
| `$7E:0104` | 2 bytes | `INPUT_P1_TRIGGERED_BUTTONS` | Frame | Player 1 controller buttons newly pressed this frame (edge-triggered / debounced); computed via ($4218 & ~$0104). |
| `$7E:0105` | 1 byte | `JOYPAD1_BUTTONS_HI` | Frame | High byte of controller 1 input register (A, X, L, R buttons). |
| `$7E:0106` | 2 bytes | `PPU_SHADOW_INIDISP` | Frame | PPU Screen Display Register shadow; low byte copied to hardware register $2100 (INIDISP: bits 0-3 brightness 0..15, bit 7 forced screen blank). |
| `$7E:0108` | 2 bytes | `PPU_SHADOW_HTIMEL` | Frame | Hardware H-timer IRQ horizontal dot position shadow; copied to $4207 in VBlank. |
| `$7E:010A` | 2 bytes | `PPU_SHADOW_VTIMEL` | Frame | Hardware V-timer IRQ scanline position shadow; copied to $4209 in VBlank. |
| `$7E:010E` | 2 bytes | `PPU_SHADOW_BG1HOFS` | Frame | BG1 horizontal scroll offset shadow; low byte written to $210D, high byte written to $210D. |
| `$7E:0110` | 2 bytes | `PPU_SHADOW_BG1VOFS` | Frame | BG1 vertical scroll offset shadow; low byte written to $210E, high byte written to $210E. |
| `$7E:0112` | 2 bytes | `PPU_SHADOW_BG2HOFS` | Frame | BG2 horizontal scroll offset shadow; low byte written to $210F, high byte written to $210F. |
| `$7E:0114` | 2 bytes | `PPU_SHADOW_BG2VOFS` | Frame | BG2 vertical scroll offset shadow; low byte written to $2110, high byte written to $2110. |
| `$7E:0116` | 2 bytes | `PPU_SHADOW_BG3HOFS` | Frame | BG3 horizontal scroll offset shadow; written to $2111 (twice). |
| `$7E:0118` | 2 bytes | `PPU_SHADOW_BG3VOFS` | Frame | BG3 vertical scroll offset shadow; written to $2112 (twice). |
| `$7E:011A` | 2 bytes | `PPU_SHADOW_BG4HOFS` | Frame | BG4 horizontal scroll offset shadow; written to $2113 (twice). |
| `$7E:011C` | 2 bytes | `PPU_SHADOW_BG4VOFS` | Frame | BG4 vertical scroll offset shadow; written to $2114 (twice). |
| `$7E:0122` | 1 byte | `PPU_SHADOW_W12SEL` | Frame | Window 1 and 2 mask settings shadow for BG1 and BG2; copied to hardware register $2123. |
| `$7E:0123` | 1 byte | `PPU_SHADOW_W34SEL` | Frame | Window 1 and 2 mask settings shadow for BG3 and BG4; copied to hardware register $2124. |
| `$7E:0124` | 1 byte | `PPU_SHADOW_WOBJSEL` | Frame | Window 1 and 2 mask settings shadow for OBJ and Color math; copied to hardware register $2125. |
| `$7E:0125` | 3 bytes | `VBLANK_CALLBACK_PTR` | Frame | 24-bit indirect execution vector ($7E:0125..$7E:0127) called during NMI via jml [$0125]. |
| `$7E:0128` | 3 bytes | `VBLANK_QUEUED_CALLBACK_PTR` | Frame | Next 24-bit callback vector queued to replace $7E:0125 at end of current frame. |
| `$7E:0133` | 2 bytes | `RNG_SEED_0` | Frame | Cross-word carry pseudo-random number generator 16-bit seed word 0 (updated by func_C0859B). |
| `$7E:0135` | 2 bytes | `RNG_SEED_1` | Frame | Cross-word carry pseudo-random number generator 16-bit seed word 1. |
| `$7E:0137` | 2 bytes | `RNG_SEED_2` | Frame | Cross-word carry pseudo-random number generator 16-bit seed word 2. |
| `$7E:0139` | 2 bytes | `RNG_SEED_3` | Frame | Cross-word carry pseudo-random number generator 16-bit seed word 3 (combined $0133..$013A = 64-bit RNG state). |
| `$7E:013B` | 2 bytes | `VRAM_DMA_QUEUE_TAIL` | Frame | Read cursor index of deferred VRAM DMA queue (processed during VBlank). |
| `$7E:013D` | 2 bytes | `VRAM_DMA_QUEUE_CURSOR` | Frame | Cursor index into 16-slot deferred VRAM DMA transfer queue. |
| `$7E:013F` | 128 bytes | `VRAM_DMA_QUEUE` | Frame | 16-slot deferred VRAM DMA queue (8 bytes per descriptor: src bank/addr, dest VRAM addr, length). |
| `$7E:0341` | 2 bytes | `LAST_SPAWNED_ENTITY` | Room | Entity slot index of most recently allocated or spawned actor. |
| `$7E:0343` | 2 bytes | `JOYPAD_REPEAT_TIMER` | Frame | Countdown timer before typematic joypad directional repeat begins. |
| `$7E:0345` | 2 bytes | `JOYPAD_REPEAT_MASK` | Frame | Bitmask of joypad buttons eligible for typematic auto-repeat. |
| `$7E:0347` | 2 bytes | `JOYPAD_REPEAT_DELAY` | Boot | Initial typematic repeat delay duration threshold (frames). |
| `$7E:0349` | 2 bytes | `JOYPAD_REPEAT_RATE` | Boot | Sustained typematic auto-repeat interval rate (frames). |
| `$7E:034D` | 2 bytes | `WINDOW_0_STRING_OFFSET` | Room | Current read cursor offset inside active string stream for primary dialogue window 0. |
| `$7E:034F` | 2 bytes | `WINDOW_0_FORMAT_FLAGS` | Room | Formatting and layout flags for dialogue window 0. |
| `$7E:0351` | 2 bytes | `WINDOW_0_BORDER_STYLE` | Room | Border frame graphics style and palette index for dialogue window 0. |
| `$7E:0353` | 2 bytes | `WINDOW_0_TEXT_DELAY` | Room | Text display speed / delay setting (frames between characters) for dialogue window 0. |
| `$7E:0355` | 2 bytes | `WINDOW_0_WAIT_FLAG` | Room | Text advance pause flag (0 = printing, 1 = awaiting button press) for dialogue window 0. |
| `$7E:0357` | 2 bytes | `WINDOW_0_SCROLL_MODE` | Room | Vertical text scrolling speed and mode for dialogue window 0. |
| `$7E:0359` | 2 bytes | `WINDOW_0_LINE_INDEX` | Room | Current active line number within dialogue window 0. |
| `$7E:035B` | 2 bytes | `WINDOW_0_SCREEN_X` | Room | Screen X position (pixels) of dialogue window 0 upper-left corner. |
| `$7E:035D` | 2 bytes | `WINDOW_0_SCREEN_Y` | Room | Screen Y position (pixels) of dialogue window 0 upper-left corner. |
| `$7E:035F` | 2 bytes | `WINDOW_0_VRAM_ADDR` | Room | Destination VRAM tilemap word address for dialogue window 0. |
| `$7E:0361` | 2 bytes | `WINDOW_0_TILE_WIDTH` | Room | Width of dialogue window 0 in 8x8 character tiles. |
| `$7E:0363` | 2 bytes | `WINDOW_0_TILE_HEIGHT` | Room | Height of dialogue window 0 in 8x8 character tiles. |
| `$7E:0365` | 2 bytes | `WINDOW_0_ANIM_TARGET_WIDTH` | Room | Target tile width during window opening animation for window 0. |
| `$7E:0367` | 2 bytes | `WINDOW_0_ANIM_TARGET_HEIGHT` | Room | Target tile height during window opening animation for window 0. |
| `$7E:0369` | 2 bytes | `WINDOW_0_MAX_WIDTH` | Room | Maximum allowed tile width for dialogue window 0. |
| `$7E:036B` | 2 bytes | `WINDOW_0_DISPLAY_MODE` | Room | Window display mode flags (`0x02, 0x03, 0x06, 0x07`). |
| `$7E:036D` | 2 bytes | `WINDOW_0_ANIM_TIMER` | Room | Frame countdown timer for window opening / closing animation step. |
| `$7E:0371` | 2 bytes | `WINDOW_0_CHOICE_COUNT` | Room | Number of interactive options in choice box for window 0. |
| `$7E:0373` | 2 bytes | `WINDOW_0_SELECTION_CURSOR` | Room | Screen position / tile offset of selection arrow cursor for window 0. |
| `$7E:0375` | 2 bytes | `WINDOW_0_SELECTED_CHOICE` | Room | Currently selected choice option index (0..N-1) for window 0. |
| `$7E:0377` | 2 bytes | `WINDOW_0_STATE` | Room | Dialogue window 0 lifecycle state enum (0 = Closed / Inactive, 1 = Opening anim, 2 = Open / Active, 3 = Closing anim); polled by event script opcode `$2E`. |
| `$7E:0379` | 2 bytes | `WINDOW_1_STRING_OFFSET` | Room | Secondary dialogue window 1 / Choice box text read cursor offset. |
| `$7E:037B` | 2 bytes | `WINDOW_1_FORMAT_FLAGS` | Room | Formatting and layout flags for secondary window 1. |
| `$7E:0380` | 64 bytes | `CHOICE_BOX_DESCRIPTOR` | Room | Dialogue multiple-choice selector bounding box coordinates, cursor state, and item count. |
| `$7E:0387` | 2 bytes | `WINDOW_1_SCREEN_X` | Room | Screen X position (pixels) of secondary window 1. |
| `$7E:0389` | 2 bytes | `WINDOW_1_SCREEN_Y` | Room | Screen Y position (pixels) of secondary window 1. |
| `$7E:038B` | 2 bytes | `WINDOW_1_VRAM_ADDR` | Room | Destination VRAM tilemap address for secondary window 1. |
| `$7E:038D` | 2 bytes | `WINDOW_1_TILE_WIDTH` | Room | Width of secondary window 1 in 8x8 character tiles. |
| `$7E:038F` | 2 bytes | `WINDOW_1_TILE_HEIGHT` | Room | Height of secondary window 1 in 8x8 character tiles. |
| `$7E:039F` | 2 bytes | `WINDOW_1_SELECTION_CURSOR` | Room | Selection arrow position in secondary choice window 1. |
| `$7E:03A1` | 2 bytes | `WINDOW_1_SELECTED_CHOICE` | Room | Selected choice index in secondary choice window 1. |
| `$7E:03A3` | 2 bytes | `WINDOW_1_STATE` | Room | Secondary window 1 lifecycle state enum (0 = Closed, 1 = Opening, 2 = Open, 3 = Closing). |
| `$7E:051D` | 68 bytes | `HUD_BOY_STATUS_WIDGET` | Room | HUD graphics descriptor for Boy status bar, HP meter gauge, and numeric digit tilemaps ($7E:051D..$7E:0560). |
| `$7E:0561` | 68 bytes | `HUD_DOG_STATUS_WIDGET` | Room | HUD graphics descriptor for Dog status bar, HP meter gauge, and numeric digit tilemaps ($7E:0561..$7E:05A4). |
| `$7E:05A7` | 2 bytes | `RING_MENU_CALLER_ACTOR` | Room | Pointer to actor entity that opened active ring menu (Boy $7E:4E89 or Dog $7E:4F37). |
| `$7E:05A9` | 2 bytes | `RING_MENU_STATUS_FLAGS` | Room | Ring menu state and visibility bitflags (bit 15 $8000 set = ring menu active/open). |
| `$7E:05AB` | 2 bytes | `RING_MENU_CATEGORY_INDEX` | Room | Active ring menu category index (Items, Alchemy Formulas, Weapons, Settings). |
| `$7E:05B1` | 46 bytes | `DIALOGUE_LINE_DECODE_BUF` | Room | Formatted 46-byte ASCII / tilemap string line buffer generated by func_CC9E03 for banners and text boxes. |
| `$7E:0615` | 2 bytes | `RING_MENU_ORIGIN_X` | Room | Screen X center anchor around which revolving ring menu icons orbit. |
| `$7E:0617` | 2 bytes | `RING_MENU_ORIGIN_Y` | Room | Screen Y center anchor around which revolving ring menu icons orbit. |
| `$7E:0619` | 2 bytes | `RING_MENU_RADIUS_DISTANCE` | Room | Expansion radius distance (pixels) between ring icons and center anchor during open/close animations (func_CEB0CF). |
| `$7E:061B` | 2 bytes | `RING_MENU_ROTATION_ANGLE` | Room | Active rotational orbit angle (0..255) of ring menu icons. |
| `$7E:061D` | 2 bytes | `RING_MENU_ANGLE_2` | Room | Secondary angular rotational position for circular ring menu animation. |
| `$7E:061F` | 2 bytes | `DIALOGUE_CURSOR_POS` | Room | Current character blit cursor offset within dialogue window buffer. |
| `$7E:0621` | 2 bytes | `DIALOGUE_CTRL_STATE` | Room | Dialogue control opcode decoder parser state machine register. |
| `$7E:062B` | 1 byte | `DIALOGUE_ACTIVE_FLAG` | Room | Set non-zero when a dialogue or text box is currently open on screen. |
| `$7E:06A3` | 256 bytes | `RING_ICON_SLOTS` | Room | Ring menu items inventory icon array (weapons, alchemy spells, items). |
| `$7E:0810` | 2 bytes | `RING_MENU_ACTIVE_ITEM_COUNT` | Room | Number of selectable items/spells in currently active primary ring menu. |
| `$7E:0812` | 2 bytes | `RING_MENU_ACTIVE_SELECTION` | Room | Currently highlighted item index cursor in primary ring menu. |
| `$7E:0814` | 24 bytes | `RING_MENU_ACTIVE_ITEMS_BUF` | Room | Array of item / spell / formula IDs displayed in primary ring menu. |
| `$7E:0834` | 2 bytes | `RING_MENU_SECONDARY_ITEM_COUNT` | Room | Number of selectable items in secondary ring menu. |
| `$7E:0836` | 2 bytes | `RING_MENU_SECONDARY_SELECTION` | Room | Currently highlighted item index cursor in secondary ring menu. |
| `$7E:0838` | 24 bytes | `RING_MENU_SECONDARY_ITEMS_BUF` | Room | Array of item IDs displayed in secondary ring menu. |
| `$7E:0858` | 2 bytes | `AUX_ANIM_CHAN_0_ADDR` | Room | 16-bit bytecode address of auxiliary / spell animation channel 0. |
| `$7E:085A` | 1 byte | `AUX_ANIM_CHAN_0_BANK` | Room | Bank byte of auxiliary animation channel 0 bytecode. |
| `$7E:085B` | 2 bytes | `AUX_ANIM_CHAN_0_BASE` | Room | Base bytecode address for looping auxiliary animation channel 0. |
| `$7E:085D` | 1 byte | `AUX_ANIM_CHAN_0_DELAY` | Room | Frame delay countdown timer for auxiliary animation channel 0. |
| `$7E:0866` | 2 bytes | `AUX_ANIM_CHAN_0_STEP` | Room | Elapsed animation step counter for auxiliary animation channel 0. |
| `$7E:0868` | 2 bytes | `AUX_ANIM_CHAN_1_ADDR` | Room | 16-bit bytecode address of auxiliary / spell animation channel 1. |
| `$7E:086A` | 1 byte | `AUX_ANIM_CHAN_1_BANK` | Room | Bank byte of auxiliary animation channel 1 bytecode. |
| `$7E:086B` | 2 bytes | `AUX_ANIM_CHAN_1_BASE` | Room | Base bytecode address for looping auxiliary animation channel 1. |
| `$7E:086D` | 1 byte | `AUX_ANIM_CHAN_1_DELAY` | Room | Frame delay countdown timer for auxiliary animation channel 1. |
| `$7E:0876` | 2 bytes | `AUX_ANIM_CHAN_1_STEP` | Room | Elapsed animation step counter for auxiliary animation channel 1. |
| `$7E:08EE` | 2 bytes | `MENU_SFX_INDEX` | Frame | Sound effect cue ID triggered when cursor moves or option is selected in menu/choice box. |
| `$7E:08F6` | 2 bytes | `CAMERA_MAX_ROOM_X` | Room | Maximum allowed horizontal camera scroll limit based on active room metatile dimensions. |
| `$7E:08F8` | 2 bytes | `CAMERA_MAX_ROOM_Y` | Room | Maximum allowed vertical camera scroll limit based on active room metatile dimensions. |
| `$7E:0A26` | 74 bytes | `BOY_STATS_BLOCK` | Save | Persistent base stats, experience, equipment, and weapon levels structure for Boy character ($7E:0A26..$7E:0A6F). |
| `$7E:0A29` | 2 bytes | `BOY_LEVEL` | Save | Boy character current level (1..99). |
| `$7E:0A2B` | 2 bytes | `BOY_EXP_LOW` | Save | Low 16 bits of Boy character accumulated experience points. |
| `$7E:0A2D` | 2 bytes | `BOY_EXP_HIGH` | Save | High 16 bits of Boy character accumulated experience points. |
| `$7E:0A2F` | 2 bytes | `BOY_NEXT_LEVEL_EXP_LOW` | Save | Low 16 bits of experience points required for Boy next level up. |
| `$7E:0A31` | 2 bytes | `BOY_NEXT_LEVEL_EXP_HIGH` | Save | High 16 bits of experience points required for Boy next level up. |
| `$7E:0A33` | 2 bytes | `BOY_BASE_ATTACK` | Save | Boy base physical attack power stat. |
| `$7E:0A35` | 2 bytes | `BOY_MAX_HP` | Save | Boy maximum hit points stat (read by full heal cheat and level-up recalculation). |
| `$7E:0A37` | 2 bytes | `BOY_BASE_DEFENSE` | Save | Boy base physical defense power stat. |
| `$7E:0A39` | 2 bytes | `BOY_BASE_MAGIC_ATTACK` | Save | Boy base magic attack power stat. |
| `$7E:0A3B` | 2 bytes | `BOY_BASE_HIT_RATE` | Save | Boy base physical accuracy / hit rate percentage. |
| `$7E:0A3D` | 2 bytes | `BOY_BASE_EVADE` | Save | Boy base physical evasion / dodge rate percentage. |
| `$7E:0A3F` | 2 bytes | `BOY_BASE_MAGIC_DEFENSE` | Save | Boy base magic defense stat. |
| `$7E:0A41` | 2 bytes | `BOY_EQUIPPED_WEAPON` | Save | ID of currently equipped primary weapon (Bone Crusher, Gladiator Sword, etc.). |
| `$7E:0A43` | 2 bytes | `BOY_EQUIPPED_BODY_ARMOR` | Save | ID of currently equipped body armor (Grass Vest, Mammoth Skin, etc.). |
| `$7E:0A45` | 2 bytes | `BOY_EQUIPPED_HELMET` | Save | ID of currently equipped helmet (Grass Hat, Shell Helmet, etc.). |
| `$7E:0A47` | 2 bytes | `BOY_EQUIPPED_ARMBAND` | Save | ID of currently equipped armband / bracer (Vine Band, Mammoth Guard, etc.). |
| `$7E:0A49` | 2 bytes | `BOY_XP_LO` | Save | Boy player accumulated experience points low word. |
| `$7E:0A4B` | 2 bytes | `BOY_XP_HI` | Save | Boy player accumulated experience points high word. |
| `$7E:0A50` | 2 bytes | `BOY_LEVEL` | Save | Boy player character level (1..99). |
| `$7E:0A58` | 2 bytes | `WEAPON_EXP_SWORD` | Save | Accumulated weapon experience and skill level for Sword weapon class. |
| `$7E:0A5A` | 2 bytes | `WEAPON_EXP_AXE` | Save | Accumulated weapon experience and skill level for Axe weapon class. |
| `$7E:0A5C` | 2 bytes | `WEAPON_EXP_SPEAR` | Save | Accumulated weapon experience and skill level for Spear weapon class. |
| `$7E:0A5E` | 2 bytes | `WEAPON_EXP_BAZOOKA` | Save | Accumulated weapon experience and skill level for Bazooka weapon class. |
| `$7E:0A70` | 74 bytes | `DOG_STATS_BLOCK` | Save | Persistent base stats, experience, and equipment structure for Dog companion character ($7E:0A70..$7E:0AB9). |
| `$7E:0A73` | 2 bytes | `DOG_LEVEL` | Save | Dog companion current level (1..99). |
| `$7E:0A75` | 2 bytes | `DOG_EXP_LOW` | Save | Low 16 bits of Dog companion accumulated experience points. |
| `$7E:0A77` | 2 bytes | `DOG_EXP_HIGH` | Save | High 16 bits of Dog companion accumulated experience points. |
| `$7E:0A79` | 2 bytes | `DOG_NEXT_LEVEL_EXP_LOW` | Save | Low 16 bits of experience required for Dog next level up. |
| `$7E:0A7B` | 2 bytes | `DOG_NEXT_LEVEL_EXP_HIGH` | Save | High 16 bits of experience required for Dog next level up. |
| `$7E:0A7D` | 2 bytes | `DOG_BASE_ATTACK` | Save | Dog base physical attack power stat. |
| `$7E:0A7F` | 2 bytes | `DOG_MAX_HP` | Save | Dog maximum hit points stat (read by full heal cheat and level-up recalculation). |
| `$7E:0A81` | 2 bytes | `DOG_BASE_DEFENSE` | Save | Dog base physical defense power stat. |
| `$7E:0A83` | 2 bytes | `DOG_BASE_MAGIC_ATTACK` | Save | Dog base magic attack power stat. |
| `$7E:0A85` | 2 bytes | `DOG_BASE_HIT_RATE` | Save | Dog base physical accuracy / hit rate percentage. |
| `$7E:0A87` | 2 bytes | `DOG_BASE_EVADE` | Save | Dog base physical evasion / dodge rate percentage. |
| `$7E:0A89` | 2 bytes | `DOG_BASE_MAGIC_DEFENSE` | Save | Dog base magic defense stat. |
| `$7E:0A8B` | 2 bytes | `DOG_EQUIPPED_COLLAR` | Save | ID of currently equipped Dog collar / form item (Leather Collar, Spiky Collar, etc.). |
| `$7E:0A9A` | 2 bytes | `DOG_LEVEL` | Save | Dog companion character level (1..99). |
| `$7E:0ABA` | 1 byte | `EQUIPPED_WEAPON` | Save | Equipped weapon index (bone, axe, spear, bazooka, etc.). |
| `$7E:0AC6` | 2 bytes | `CURRENCY_TALONS` | Save | Prehistoria realm currency balance (Talons). |
| `$7E:0AC9` | 2 bytes | `CURRENCY_JEWELS` | Save | Antiqua realm currency balance (Jewels). |
| `$7E:0ACC` | 2 bytes | `CURRENCY_GOLD` | Save | Gothica realm currency balance (Gold Coins). |
| `$7E:0ACF` | 2 bytes | `CURRENCY_CREDITS` | Save | Omnitopia realm currency balance (Credits). |
| `$7E:0ADB` | 2 bytes | `CURRENT_ROOM_ID` | Room | Active room / map ID index into master pointer table $9F:FDE7; passed to enter_room ($8E:E4E2). |
| `$7E:0B09` | 2 bytes | `BOY_AI_AGGRESSION_SETTING` | Save | Boy companion AI attack setting (0 = never attack, 1..5 = attack radius 50..130 pixels). |
| `$7E:0B0B` | 2 bytes | `ROOM_STEP_TRIGGER` | Room | Pointer to step-on coordinate trigger descriptor table for current room. |
| `$7E:0B0D` | 2 bytes | `DOG_AI_AGGRESSION_SETTING` | Save | Dog companion AI attack setting (0 = never attack, 1..5 = widest search radius). |
| `$7E:0B19` | 2 bytes | `WAVE_PHASE_COUNTER` | Frame | Wave phase counter incremented per frame for HDMA underwater distortion. |
| `$7E:0B1F` | 2 bytes | `RING_MENU_SAVED_STACK_PTR` | Frame | Saved CPU stack pointer (S register) snapshot restored on ring menu closure. |
| `$7E:0B29` | 2 bytes | `HUD_DIRTY_UPDATE_FLAGS` | Frame | HUD refresh latch flags (bit 0 = tilemap redraw required, bit 2 = HUD hidden). |
| `$7E:0B2B` | 2 bytes | `DIALOGUE_TIMER` | Frame | Delay timer tracking pause duration between dialogue lines. |
| `$7E:0B2F` | 2 bytes | `ACTIVE_PLAYER_CHAR_INDEX` | Room | Index of currently player-controlled character (0 = Boy, 3 = Dog). |
| `$7E:0B31` | 2 bytes | `DIALOGUE_LINE_IDX` | Room | Active text line index inside dialogue window buffer. |
| `$7E:0B3B` | 2 bytes | `ACTIVE_SAVE_SLOT` | Boot | SRAM save slot index (0..3); read from battery RAM $30:6001. |
| `$7E:0B3D` | 2 bytes | `FONT_GLYPH_HEIGHT` | Boot | Height of dialogue text font glyphs in scanlines (default 8). |
| `$7E:0B3F` | 2 bytes | `FONT_LINE_STRIDE` | Boot | Byte pitch stride between raster text lines in dialogue buffer. |
| `$7E:0B41` | 2 bytes | `FONT_BUFFER_BASE` | Boot | Base address in High WRAM ($7F:A000) for 2bpp font glyph staging. |
| `$7E:0B47` | 2 bytes | `WEAPON_CHARGE_PERCENTAGE` | Room | Current physical attack charge meter level (0..100%). |
| `$7E:0B49` | 2 bytes | `WEAPON_CHARGE_LEVEL_STAGE` | Room | Attack charge stage tier (0 = Normal, 1 = Stage 1, 2 = Stage 2, 3 = Stage 3). |
| `$7E:0B4D` | 2 bytes | `WEAPON_STAMINA_RECOVERY_TIMER` | Room | Cooldown timer controlling stamina gauge recharge rate after an attack. |
| `$7E:0B4F` | 2 bytes | `SCREEN_FLASH_COLOR` | Frame | 15-bit BGR color value for active screen flash overlay. |
| `$7E:0B7F` | 2 bytes | `AUDIO_FADE_COUNTER` | Frame | Step counter tracking audio volume fade in/out transitions. |
| `$7E:0B83` | 2 bytes | `AUDIO_TARGET_VOLUME` | Room | Target master audio volume level latch for fade interpolation. |
| `$7E:0BF9` | 2 bytes | `RING_MENU_CURSOR_SECTOR` | Room | Latched cursor sector index during ring menu item selection ($FFFF = unlatched). |
| `$7E:0DFB` | 24 bytes | `DIALOGUE_QUEUE` | Room | FIFO message queue buffering pending dialogue box display requests. |
| `$7E:0E47` | 2 bytes | `APU_BLOCKS_LEFT` | Frame | Remaining audio data transfer blocks during SPC700 sound loading. |
| `$7E:0E49` | 2 bytes | `APU_DESC_CURSOR` | Frame | Index offset into audio sample block descriptor table. |
| `$7E:0E4B` | 1 byte | `APU_PORT0_MIRROR` | Frame | Shadow mirror of APU I/O port 0 ($2140). |
| `$7E:0E4D` | 1 byte | `APU_PORT1_MIRROR` | Frame | Shadow mirror of APU I/O port 1 ($2141). |
| `$7E:0E4F` | 1 byte | `APU_PORT2_MIRROR` | Frame | Shadow mirror of APU I/O port 2 ($2142). |
| `$7E:0E51` | 1 byte | `APU_PORT3_MIRROR` | Frame | Shadow mirror of APU I/O port 3 ($2143). |
| `$7E:0E65` | 2 bytes | `ENGINE_PAUSE_COUNTER` | Boot | Pause counter decremented at boot; engine skips actor simulation if > 0. |
| `$7E:0E6B` | 1 byte | `NMITIMEN_MIRROR` | Boot | Shadow copy of $4200 ($81 = NMI enabled, Auto-Joypad enabled). |
| `$7E:0E80` | 2 bytes | `WEAPON_CHARGE_METER` | Frame | Current physical attack charge meter level (0..100%). |
| `$7E:0EA0` | 2 bytes | `DAMAGE_RESULT_REG` | Frame | Calculated damage output value produced by combat math routines. |
| `$7E:0EAE` | 2 bytes | `PENDING_MAP_EVENT_0` | Room | Queued map event script ID pending trigger execution ($FFFF = none). |
| `$7E:0EB0` | 2 bytes | `PENDING_MAP_EVENT_1` | Room | Secondary queued map event script ID ($FFFF = none). |
| `$7E:0EB2` | 2 bytes | `DOG_CURRENT_HP` | Save | Dog companion current health points. |
| `$7E:0EB4` | 2 bytes | `PENDING_SWITCH_SCRIPT_SECONDARY` | Room | Secondary pending character Select switch event script ID ($FFFF = none). |
| `$7E:0EBE` | 2 bytes | `RING_16_CURSOR_0EBE` | Unknown | Cursor of a 16-byte-record ring at $5DC3-$6183. Moves on by 16 bytes per record; what the records are is not known. |
| `$7E:0EC0` | 32 bytes | `DEFERRED_SPAWN_BUF` | Room | Buffer storing entity spawn parameters queued during map transitions. |
| `$7E:0EC6` | 2 bytes | `INPUT_P1_HELD_BUTTONS` | Frame | Player 1 controller buttons currently held down (raw auto-joypad read from hardware register $4218). |
| `$7E:0F36` | 2 bytes | `STEP_DITHER_COUNTER` | Frame | Sub-pixel walk step dither accumulator for smooth actor movement. |
| `$7E:0F38` | 2 bytes | `CAMERA_SUBPIXEL_ACC` | Frame | Camera sub-pixel tracking fractional accumulator. |
| `$7E:0F3A` | 1 byte | `VRAM_DMA_LOCK` | Frame | In-flight active transfer counter / lock flag for deferred VRAM DMA queue. |
| `$7E:0F3C` | 1 byte | `CGRAM_DMA_LOCK` | Frame | In-flight active transfer counter / lock flag for deferred CGRAM DMA queue. |
| `$7E:0F3E` | 1 byte | `HUD_DRAW_SUPPRESSION_LOCK` | Frame | In-flight lock counter suppressing HUD tilemap rendering when non-zero. |
| `$7E:0F42` | 2 bytes | `CAMERA_TARGET_ACTOR_PTR` | Room | Pointer to primary actor entity record tracked by camera (points to Boy at $7E:4E89). |
| `$7E:0F44` | 2 bytes | `VIEWPORT_SCROLL_Y` | Frame | Vertical world coordinate of top-left camera viewport boundary. |
| `$7E:0F84` | 2 bytes | `MAP_HEADER_FLAGS` | Room | Bitmask flags loaded from map header (layering, Mode 7, weather). |
| `$7E:0F86` | 1 byte | `MAP_LOADED_FLAG` | Room | Set to 1 after room tilemaps, collision, and palettes are fully decompressed. |
| `$7E:0F8A` | 2 bytes | `LOADED_PALETTE_TAG` | Room | Identifier of currently loaded map palette family. |
| `$7E:0FAC` | 2 bytes | `ROOM_PALETTE_GROUP_ID` | Room | Active room palette group index (initialized to $11 by reset_per_room_state). |
| `$7E:0FB0` | 1 byte | `TERRAIN_MUT_ACTIVE` | Frame | Set non-zero when animated terrain tile mutations are active. |
| `$7E:0FB4` | 12 bytes | `CELL_COLLISION_FLAGS` | Room | Current 16x16 metatile cell collision properties and impassable edges. |
| `$7E:0FB9` | 2 bytes | `ENV_SFX_TRIGGER` | Room | Sound effect ID trigger for environmental audio (wind, waterfall, lava). |
| `$7E:0FBD` | 2 bytes | `ENV_SHAKE_TRIGGER` | Room | Magnitude trigger for environmental ground tremor effects. |
| `$7E:0FBF` | 2 bytes | `ENV_AUDIO_PARAM` | Room | Secondary audio parameter (pitch/pan) for environmental audio. |
| `$7E:0FD0` | 2 bytes | `GRASS_BATCH_CURSOR` | Room | Cursor index into pending cuttable grass tile swap queue. |
| `$7E:0FD2` | 48 bytes | `GRASS_SWAP_QUEUE` | Room | Coordinate swap queue holding tiles converted from standing to cut grass. |
| `$7E:1002` | 48 bytes | `GRASS_GRID_OFFSETS` | Room | Tilemap offset lookup table corresponding to pending grass swaps. |
| `$7E:1032` | 48 bytes | `GRASS_PACKED_COORDS` | Room | Packed world coordinates (X, Y) for cut grass tile locations. |
| `$7E:106C` | 2 bytes | `ACTIVE_ANIM_CHANNELS` | Room | Count of actively cycling animated tile channels on current map. |
| `$7E:106E` | 2 bytes | `ANIM_TILE_VRAM_BASE` | Room | Destination base address in VRAM where animated tiles are DMA-streamed. |
| `$7E:1076` | 2 bytes | `ROOM_FADE_FRAME_COUNT` | Room | Duration in frames of room transition screen brightness fade (default 6 frames). |
| `$7E:107E` | 80 bytes | `TERRAIN_FRAME_INDICES` | Room | Current animation frame indices for 80 terrain mutation channel slots. |
| `$7E:10CE` | 80 bytes | `TERRAIN_THRESHOLDS` | Room | Frame threshold limits for 80 terrain mutation channel slots. |
| `$7E:111E` | 80 bytes | `TERRAIN_COUNTDOWNS` | Room | Cycle countdown delay timers for 80 terrain mutation channel slots. |
| `$7E:116E` | 2 bytes | `VRAM_SINGLE_TILE_RATE_LIMIT` | Frame | Maximum number of individual 16-bit tile updates dispatched to VRAM per VBlank. |
| `$7E:1170` | 2 bytes | `VRAM_SINGLE_TILE_QUEUE_TAIL` | Frame | Read cursor index of individual tile VRAM update ring buffer. |
| `$7E:1172` | 2 bytes | `VRAM_SINGLE_TILE_QUEUE_HEAD` | Frame | Write cursor index of individual tile VRAM update ring buffer. |
| `$7E:1174` | 128 bytes | `VRAM_SINGLE_TILE_DATA_QUEUE` | Frame | Buffered 16-bit tile word values to be written to $2118 in VBlank. |
| `$7E:11F4` | 128 bytes | `VRAM_SINGLE_TILE_ADDR_QUEUE` | Frame | Destination VRAM word addresses written to $2116 corresponding to tile data queue. |
| `$7E:1274` | 2 bytes | `CURRENT_MUSIC_TRACK` | Room | Active background music track index; initialized to $FFFF at reset. |
| `$7E:1276` | 2 bytes | `SPRITE_FREE_LIST_HEAD` | Frame | Head pointer to available free nodes in dynamic sprite allocation pool (`$7E:50A7..$7E:512F`). |
| `$7E:1278` | 2 bytes | `SOUND_COMMAND_MAILBOX` | Frame | Sound effect request mailbox evaluated by APU interface routines. |
| `$7E:1288` | 6 bytes | `SPRITE_VRAM_CACHE` | Room | Dynamic VRAM allocation slot pointers for active actor sprite graphics. |
| `$7E:128E` | 2 bytes | `CGRAM_DMA_QUEUE_HEAD` | Frame | Head index cursor of deferred CGRAM DMA queue (`$7E:1292`, stride 7, wraps at 32 entries = `$00E0`). |
| `$7E:1290` | 2 bytes | `TILE_FAMILY_ANIM_TIMER` | Frame | Master frame tick counter synchronizing tile palette cycling and water animation. |
| `$7E:1292` | 224 bytes | `CGRAM_DMA_QUEUE_ENTRIES` | Frame | Deferred CGRAM DMA queue buffer (32 slots × 7 bytes: source pointer `$26..$28`, dest word offset `$2E`, size `$12`). |
| `$7E:13D2` | 30 bytes | `TILE_ANIM_BUFFERS` | Room | Intermediate staging buffers for animated tile family graphics. |
| `$7E:1432` | 2 bytes | `ANIM_FRAME_HOLD_TIMER` | Frame | Remaining frame duration before advancing to next animated tile phase. |
| `$7E:1434` | 2 bytes | `PENDING_TALK_TARGET_PTR` | Room | Pointer to NPC actor entity currently being spoken to or interacted with ($FFFF = none). |
| `$7E:143A` | 2 bytes | `CAMERA_SECONDARY_ACTOR_PTR` | Room | Pointer to secondary actor entity considered for camera framing (Dog at $7E:4F37). |
| `$7E:1518` | 2 bytes | `HDMA_ACTIVE_BANK_PTR` | Frame | Pointer to active double-buffer table feeding HDMA channel tables. |
| `$7E:151A` | 36 bytes | `HDMA_BUFFER_A` | Frame | HDMA scanline table double-buffer Bank A (color gradients / perspective lines). |
| `$7E:153E` | 36 bytes | `HDMA_BUFFER_B` | Frame | HDMA scanline table double-buffer Bank B (color gradients / perspective lines). |
| `$7E:15CC` | 2 bytes | `DYNAMIC_COLLISION_OVERRIDE_COUNT` | Room | Number of active dynamic collision grid metatile overrides in current room. |
| `$7E:15D2` | 1 byte | `AUDIO_MUTING_FLAG` | Room | Set non-zero to silence background music during dramatic cutscenes. |
| `$7E:15D6` | 1 byte | `APU_COMM_STATUS` | Frame | Handshake status register for SPC700 data transfer synchronization. |
| `$7E:163C` | 64 bytes | `VRAM_TILE_DMA_QUEUE` | Frame | Deferred VRAM tile pattern DMA upload request queue; processed during VBlank. |
| `$7E:2200` | 2 bytes | `SRAM_START_MARKER` | Save | Boundary marking start of battery-backed persistent save RAM ($7E:2200..$7E:27FF). |
| `$7E:2210` | 36 bytes | `BOY_NAME_BUFFER` | Save | Custom player character name string buffer (ASCII/tile indices). |
| `$7E:2234` | 36 bytes | `DOG_NAME_BUFFER` | Save | Custom dog companion name string buffer (ASCII/tile indices). |
| `$7E:2258` | 424 bytes | `STORY_FLAGS_ARRAY` | Save | Master bit-packed array of persistent world progression, boss, and chest flags. |
| `$7E:2260` | 1 byte | `BOSS_FLAGS_1` | Save | Boss defeat bitmask flags (bit 0x10 = Thraxx defeated). |
| `$7E:2261` | 2 bytes | `GAMEPLAY_SETTINGS_FLAGS` | Save | Gameplay settings bitmask (bit 0 = Dog HUD toggle, bit 1 = Boy HUD toggle, bit 2 = stereo sound). |
| `$7E:2262` | 1 byte | `ACTIVE_BUFFS_MASK` | Room | Bitmask flags for active positive status buffs (Speed, Atlas, Defend). |
| `$7E:2263` | 1 byte | `ACTIVE_DEBUFFS_MASK` | Room | Bitmask flags for active negative status debuffs (Poison, Confusion, Confounded). |
| `$7E:2284` | 2 bytes | `ALCHEMY_KNOWN_FLAGS` | Save | Bitmask flags tracking which alchemy formulas have been acquired by player. |
| `$7E:22EA` | 2 bytes | `SYSTEM_STATE_FLAGS` | Save | Engine system flags; bit 2 (0x0004) marks cold boot SRAM initialization completed. |
| `$7E:22EB` | 2 bytes | `ROOM_TRANSITION_FLAGS` | Room | Map flags; bit 2 (0x0004) triggers room enter script and tilemap reload. |
| `$7E:22FA` | 1 byte | `CAMERA_ZOOM_SCALE_X` | Room | Mode 7 horizontal scale factor for rooms utilizing perspective rendering (written to $211C). |
| `$7E:22FB` | 1 byte | `CAMERA_ZOOM_SCALE_Y` | Room | Mode 7 vertical scale factor for rooms utilizing perspective rendering (written to $211C). |
| `$7E:22FC` | 2 bytes | `DESERT_WRAP_Y_` | Save | Game script variable: DESERT WRAP Y? |
| `$7E:22FD` | 2 bytes | `DESERT_WRAP_X_` | Save | Game script variable: DESERT WRAP X? |
| `$7E:22FF` | 1 byte | `STORY_FLAGS_OFFSET_0` | Save | Primary story progression event flag byte. |
| `$7E:2345` | 1 byte | `BAZOOKA_AMMO` | Save | Bazooka ammo counts and the selected ammo. \ |
| `$7E:234B` | 2 bytes | `HUT_HOUSE_TO_ENTER` | Save | Game script variable: Hut/house to enter |
| `$7E:234F` | 2 bytes | `PRISON_TOWN_EXIT` | Save | Game script variable: PRISON TOWN EXIT |
| `$7E:2352` | 2 bytes | `QUEEN_S_KEY_ON_DOG` | Save | Game script variable: Queen's Key on Dog |
| `$7E:2353` | 2 bytes | `QUEEN_S_KEY_ON_BOY` | Save | Game script variable: Queen's Key on Boy |
| `$7E:2360` | 1 byte | `EQUIPPED_WEAPON_CLASS` | Save | Current weapon class (0=Sword, 2=Axe, 4=Spear, 6=Bazooka). |
| `$7E:2363` | 1 byte | `DOG_FORM_INDEX` | Save | Active visual form and breed of dog companion (0=Wolf, 1=Greyhound, 2=Poodle, 3=Toaster). |
| `$7E:238D` | 2 bytes | `CHANGE_MUSIC` | Save | Game script variable: CHANGE MUSIC |
| `$7E:2391` | 1 byte | `LOOT_MAILBOX` | Room | Loot mailbox — what the next pickup gives. \ |
| `$7E:2393` | 2 bytes | `AMOUNT` | Save | Game script variable: AMOUNT |
| `$7E:2395` | 2 bytes | `MAP_REF_` | Save | Game script variable: MAP REF? |
| `$7E:239B` | 2 bytes | `PRIZE_1_RATE` | Save | Game script variable: PRIZE 1 RATE |
| `$7E:239D` | 2 bytes | `PRIZE_2_RATE` | Save | Game script variable: PRIZE 2 RATE |
| `$7E:239F` | 2 bytes | `PRIZE_3_RATE` | Save | Game script variable: PRIZE 3 RATE |
| `$7E:23A1` | 2 bytes | `PRIZE_1_DROP` | Save | Game script variable: PRIZE 1 DROP |
| `$7E:23A3` | 2 bytes | `PRIZE_2_DROP` | Save | Game script variable: PRIZE 2 DROP |
| `$7E:23A5` | 2 bytes | `PRIZE_3_DROP` | Save | Game script variable: PRIZE 3 DROP |
| `$7E:23A7` | 2 bytes | `PRIZE_1_QTY` | Save | Game script variable: PRIZE 1 QTY |
| `$7E:23A9` | 2 bytes | `PRIZE_2_QTY` | Save | Game script variable: PRIZE 2 QTY |
| `$7E:23AB` | 2 bytes | `PRIZE_3_QTY` | Save | Game script variable: PRIZE 3 QTY |
| `$7E:23BF` | 2 bytes | `CUTSCENE_PENDING_FLAG` | Save | Story cutscene transition pending latch. |
| `$7E:23C3` | 2 bytes | `COMPANION_TIGHT_TETHER` | Unknown | Non-zero: the companion keeps close (tether limits 4/3/3/1). What sets it is not traced. |
| `$7E:23DB` | 2 bytes | `QUEUED_ROOM_EXIT_TRIGGER_0` | Room | ID of door or boundary exit trigger tripped by player ($FFFF = none). |
| `$7E:23DD` | 2 bytes | `QUEUED_ROOM_EXIT_TRIGGER_1` | Room | Secondary queued room transition exit trigger ID ($FFFF = none). |
| `$7E:23E9` | 2 bytes | `CAMERA_ROOM_BOUND_LEFT` | Room | Left boundary clamp limit (pixels) for active room camera. |
| `$7E:23EB` | 2 bytes | `CAMERA_ROOM_BOUND_TOP` | Room | Top boundary clamp limit (pixels) for active room camera. |
| `$7E:23ED` | 2 bytes | `CAMERA_ROOM_BOUND_RIGHT` | Room | Right boundary clamp limit (pixels) for active room camera. |
| `$7E:23EF` | 2 bytes | `CAMERA_ROOM_BOUND_BOTTOM` | Room | Bottom boundary clamp limit (pixels) for active room camera. |
| `$7E:2401` | 2 bytes | `VIEWPORT_LEFT_X` | Room | Active camera on-screen viewport left edge in world pixels ($BF). |
| `$7E:2403` | 2 bytes | `VIEWPORT_RIGHT_X` | Room | Active camera on-screen viewport right edge in world pixels ($BF + 256). |
| `$7E:2405` | 2 bytes | `VIEWPORT_TOP_Y` | Room | Active camera on-screen viewport top edge in world pixels ($C1). |
| `$7E:2407` | 2 bytes | `VIEWPORT_BOTTOM_Y` | Room | Active camera on-screen viewport bottom edge in world pixels ($C1 + 224). |
| `$7E:2409` | 2 bytes | `CAMERA_SPEED_FACTOR` | Room | Camera panning smoothing and interpolation factor. |
| `$7E:240B` | 2 bytes | `SHAKE_MAGNITUDE_Y` | Frame | Maximum vertical displacement magnitude for active screen shaking. |
| `$7E:240F` | 2 bytes | `CAMERA_DEADZONE_LEFT` | Room | Left horizontal deadzone threshold before camera scrolls to follow player. |
| `$7E:2411` | 2 bytes | `CAMERA_DEADZONE_RIGHT` | Room | Right horizontal deadzone threshold before camera scrolls to follow player. |
| `$7E:2413` | 2 bytes | `CAMERA_DEADZONE_TOP` | Room | Top vertical deadzone threshold before camera scrolls to follow player. |
| `$7E:2415` | 2 bytes | `CAMERA_DEADZONE_BOTTOM` | Room | Bottom vertical deadzone threshold before camera scrolls to follow player. |
| `$7E:2417` | 2 bytes | `CAMERA_WORLD_ORIGIN_X` | Room | Room camera world horizontal origin anchor (metatiles) used in Mode 7 matrix math. |
| `$7E:2419` | 2 bytes | `CAMERA_WORLD_ORIGIN_Y` | Room | Room camera world vertical origin anchor (metatiles) used in Mode 7 matrix math. |
| `$7E:241B` | 2 bytes | `CAMERA_SCREEN_CENTER_X` | Room | Screen center horizontal pixel coordinate offset for camera centering. |
| `$7E:241D` | 2 bytes | `CAMERA_SCREEN_CENTER_Y` | Room | Screen center vertical pixel coordinate offset for camera centering. |
| `$7E:241F` | 2 bytes | `CAMERA_SCROLL_MODE` | Room | Camera tracking mode enum (0 = Follow target player, 2 = Fixed / scripted focus). |
| `$7E:2429` | 2 bytes | `TRIGGER_SCRIPT_LOCK` | Room | Execution lock held while a step-on coordinate trigger script is running. |
| `$7E:242B` | 2 bytes | `CAMERA_SCRIPTED_TARGET_X` | Room | Forced scripted camera focus target X coordinate (-1 = follow player). |
| `$7E:242D` | 2 bytes | `CAMERA_SCRIPTED_TARGET_Y` | Room | Forced scripted camera focus target Y coordinate (-1 = follow player). |
| `$7E:242F` | 2 bytes | `CAMERA_PAN_VELOCITY` | Room | Transition panning speed between scripted camera targets. |
| `$7E:2435` | 2 bytes | `ROOM_AMBIENT_LIGHT_LEVEL` | Room | Ambient light/shade color tint parameter applied to room palette (default $15). |
| `$7E:2437` | 2 bytes | `MAP_PALETTE_INDEX` | Room | Active map color palette family identifier index. |
| `$7E:243D` | 2 bytes | `BUFF_REQUEST_1` | Room | Queued alchemy formula stat buff application register 1. |
| `$7E:243F` | 2 bytes | `BUFF_REQUEST_2` | Room | Queued alchemy formula stat buff application register 2. |
| `$7E:2441` | 2 bytes | `ROOM_TILESET_GRAPHIC_BANK` | Room | ROM graphic bank containing compressed 16x16 metatile graphics for current room. |
| `$7E:2443` | 2 bytes | `ROOM_METATILE_DESCRIPTOR_PTR` | Room | Pointer to room metatile layout descriptor table in ROM. |
| `$7E:2445` | 2 bytes | `PRESELECT_ALCHEMY` | Save | Game script variable: PRESELECT ALCHEMY |
| `$7E:2449` | 2 bytes | `SAVE_SPOT` | Save | Game script variable: SAVE SPOT |
| `$7E:2459` | 2 bytes | `INGREDIENT_SHOP` | Save | Game script variable: INGREDIENT SHOP |
| `$7E:2461` | 2 bytes | `LOOT_AMOUNT` | Room | Loot bonus — amount minus one for the next pickup. The loot script adds `1 + $2461`. Pickups that give more than one write `amount − 1` here before calling the |
| `$7E:2480` | 64 bytes | `WEATHER_PARTICLES` | Frame | Position, velocity, and lifetime particle physics state array (rain, snow, embers). |
| `$7E:2834` | 204 bytes | `TEMP_SCRATCH_RAM` | Temp | Compiler temporary scratchpad memory pool ($7E:2834..$7E:28FF); wiped on map reload. |
| `$7E:28FC` | 79 bytes | `SCRIPT_SLOT_00` | Room | Script VM execution thread slot 0 (primary room enter / cutscene script thread, stride 79 bytes). |
| `$7E:294B` | 79 bytes | `SCRIPT_SLOT_01` | Room | Script VM execution thread slot 1 (stride 79 bytes). |
| `$7E:299A` | 79 bytes | `SCRIPT_SLOT_02` | Room | Script VM execution thread slot 2 (stride 79 bytes). |
| `$7E:29E9` | 79 bytes | `SCRIPT_SLOT_03` | Room | Script VM execution thread slot 3 (stride 79 bytes). |
| `$7E:2A38` | 79 bytes | `SCRIPT_SLOT_04` | Room | Script VM execution thread slot 4 (stride 79 bytes). |
| `$7E:2A87` | 79 bytes | `SCRIPT_SLOT_05` | Room | Script VM execution thread slot 5 (stride 79 bytes). |
| `$7E:2AD6` | 79 bytes | `SCRIPT_SLOT_06` | Room | Script VM execution thread slot 6 (stride 79 bytes). |
| `$7E:2B25` | 79 bytes | `SCRIPT_SLOT_07` | Room | Script VM execution thread slot 7 (stride 79 bytes). |
| `$7E:2B74` | 79 bytes | `SCRIPT_SLOT_08` | Room | Script VM execution thread slot 8 (stride 79 bytes). |
| `$7E:2BC3` | 79 bytes | `SCRIPT_SLOT_09` | Room | Script VM execution thread slot 9 (stride 79 bytes). |
| `$7E:2C12` | 79 bytes | `SCRIPT_SLOT_10` | Room | Script VM execution thread slot 10 (stride 79 bytes). |
| `$7E:2C61` | 79 bytes | `SCRIPT_SLOT_11` | Room | Script VM execution thread slot 11 (stride 79 bytes). |
| `$7E:2CB0` | 79 bytes | `SCRIPT_SLOT_12` | Room | Script VM execution thread slot 12 (stride 79 bytes). |
| `$7E:2CFF` | 79 bytes | `SCRIPT_SLOT_13` | Room | Script VM execution thread slot 13 (stride 79 bytes). |
| `$7E:2D4E` | 79 bytes | `SCRIPT_SLOT_14` | Room | Script VM execution thread slot 14 (stride 79 bytes). |
| `$7E:2D9D` | 79 bytes | `SCRIPT_SLOT_15` | Room | Script VM execution thread slot 15 (stride 79 bytes). |
| `$7E:2DEC` | 79 bytes | `SCRIPT_SLOT_16` | Room | Script VM execution thread slot 16 (stride 79 bytes). |
| `$7E:2E3B` | 79 bytes | `SCRIPT_SLOT_17` | Room | Script VM execution thread slot 17 (stride 79 bytes). |
| `$7E:2E8A` | 79 bytes | `SCRIPT_SLOT_18` | Room | Script VM execution thread slot 18 (stride 79 bytes). |
| `$7E:2ED9` | 79 bytes | `SCRIPT_SLOT_19` | Room | Script VM execution thread slot 19 (stride 79 bytes). |
| `$7E:2F28` | 2 bytes | `SCRIPT_SLOT_QUEUE_TAIL` | Room | End sentinel and boundary limit pointer of Script VM thread pool ($7E:28FC..$7E:2F28). |
| `$7E:3ABE` | 1 byte | `JOYPAD_CHORD_HISTORY` | Boot | The joypad matcher's ring of recent button chords. 128 words, newest at `$3ABE + $3BBE`, older chords above it (the index counts down and wraps in 8 bits). A re |
| `$7E:3BBE` | 1 byte | `JOYPAD_CHORD_INDEX` | Boot | Offset of the newest chord in the joypad chord history. A byte offset into `$3ABE`, always even, moved down by 2 per new chord. `$3BBF` right after it is the te |
| `$7E:3BBF` | 2 bytes | `DIALOGUE_RING_CURSOR` | Room | Cyclic message buffer index for active dialogue text box rendering. |
| `$7E:3BC3` | 2 bytes | `CHILD_TASK_CURSOR` | Room | Child actor allocation index in multi-tasking scheduler pool. |
| `$7E:3BC5` | 2 bytes | `SCRIPT_TASK_SELECTOR` | Room | Active thread index in script virtual machine scheduler. |
| `$7E:3BC7` | 2 bytes | `ENTITY_FREE_LIST_HEAD` | Room | Head pointer to linked list of available actor entity slots in pool. |
| `$7E:3BC9` | 48 bytes | `COMPANION_WAYPOINTS_BUF` | Room | Breadcrumb pathfinding waypoint ring buffer for companion Dog (16 nodes × 3 bytes: `+0` X tile, `+1` Y tile, `+2` movement flags). |
| `$7E:3BFF` | 2 bytes | `BREADCRUMB_QUEUE_TAIL` | Room | Tail offset pointer for companion navigation breadcrumb coordinate queue. |
| `$7E:3C01` | 2 bytes | `COMPANION_ANCHOR` | Room | Target waypoint coordinate anchor guiding dog companion movement. |
| `$7E:3C10` | 2 bytes | `COMPANION_STEP_COUNT` | Room | Step counter regulating companion pathfinding recalculation frequency. |
| `$7E:3C12` | 2 bytes | `COMPANION_NAV_FLAGS` | Room | Behavioral flags for companion pathfinding (leash, obstacle avoidance, sniffing). |
| `$7E:3C14` | 64 bytes | `ACTOR_PARENT_LINKS` | Room | Hierarchy table linking child entity slots to their originating parent actors. |
| `$7E:3C22` | 2 bytes | `COMPANION_OBSTACLE_TARGET_X` | Room | Target X coordinate during active obstacle evasion pathfinding. |
| `$7E:3C58` | 2 bytes | `COMPANION_WAYPOINT_READ_PTR` | Room | Byte offset of intermediate target waypoint node in companion breadcrumb queue. |
| `$7E:3C5A` | 2 bytes | `COMPANION_WAYPOINT_WRITE_PTR` | Room | Byte offset of latest recorded waypoint node in companion breadcrumb queue. |
| `$7E:3C65` | 1 byte | `COMPANION_EVASION_COUNTER` | Room | Retry attempt counter when companion encounters wall or obstacle. |
| `$7E:3C67` | 2 bytes | `COMPANION_EVASION_DIRECTION` | Room | Evasion route direction enum (`0, 2, 4, 6, 8, 10, 12, 14`). |
| `$7E:3C69` | 2 bytes | `COMPANION_TARGET_FACING` | Room | Target facing direction calculated for companion toward current goal. |
| `$7E:3C6B` | 2 bytes | `COMPANION_TARGET_Y_LATCH` | Room | Latched goal Y position during companion pathfinding route execution. |
| `$7E:3C6D` | 2 bytes | `COMPANION_TARGET_ACTOR_PTR` | Room | Pointer to entity record companion is actively following (points to Boy at `$7E:4E89`). |
| `$7E:3C6F` | 2 bytes | `COMPANION_AI_STATE` | Room | Companion Dog AI behavior state enum (0 = Idle, 1 = Follow Boy, 2 = Sniffing alchemy, 3 = Obstacle evasion, 4 = Combat attack, 5 = Returning, 6 = Stuck retry). |
| `$7E:3DDF` | 2 bytes | `ACTIVE_ENTITY_HEAD` | Room | Head pointer of linked list chaining all active entities in current room. |
| `$7E:3DE5` | 4260 bytes | `ENTITY_SLOTS_POOL` | Room | Actor entity pool (30 slots × 142 bytes); stores positions, animations, stats, and state. |
| `$7E:4E89` | 174 bytes | `BOY_ENTITY_RECORD` | Room | Primary actor entity structure for boy player character. |
| `$7E:4E99` | 2 bytes | `BOY_STATUS_FLAGS` | Room | Primary action and collision status flags for Boy player entity (`+$10` in entity struct). |
| `$7E:4E9B` | 2 bytes | `BOY_ANIM_PHASE_TIMER` | Room | Sub-frame animation phase timer for Boy walk/run/attack cycles (`+$12` in entity struct). |
| `$7E:4EA1` | 2 bytes | `BOY_ACTION_STATE_FLAGS` | Room | Movement and action state flags for Boy player entity (`+$18` in entity struct). |
| `$7E:4EA3` | 2 bytes | `BOY_WORLD_X` | Room | Boy player entity current horizontal world coordinate in pixels (`+$1A` in entity struct). |
| `$7E:4EA5` | 2 bytes | `BOY_WORLD_Y` | Room | Boy player entity current vertical world coordinate in pixels (`+$1C` in entity struct). |
| `$7E:4EAB` | 2 bytes | `BOY_FACING_DIRECTION` | Room | Boy facing direction enum (`0`=N, `2`=NE, `4`=E, `6`=SE, `8`=S, `10`=SW, `12`=W, `14`=NW; `+$22` in entity struct). |
| `$7E:4EAD` | 2 bytes | `PRIMARY_ATTACKER_PTR` | Room | Pointer to entity record of actor initiating current physical or magic attack. |
| `$7E:4EB3` | 2 bytes | `BOY_COLLISION_RADIUS` | Room | Horizontal collision bounding box half-width for Boy entity (`+$2A` in entity struct). |
| `$7E:4EC3` | 2 bytes | `BOY_ELEVATION_Z` | Room | Boy entity current vertical elevation / Z-height off ground plane (`+$3A` in entity struct). |
| `$7E:4EC5` | 2 bytes | `BOY_MOVEMENT_VELOCITY` | Room | Movement velocity factor applied during Boy walking and running (`+$3C` in entity struct). |
| `$7E:4F37` | 174 bytes | `DOG_ENTITY_RECORD` | Room | Primary actor entity structure for dog companion character. |
| `$7E:4F47` | 2 bytes | `DOG_STATUS_FLAGS` | Room | Primary action and collision status flags for Dog companion entity (`+$10` in entity struct). |
| `$7E:4F49` | 2 bytes | `DOG_ANIM_PHASE_TIMER` | Room | Sub-frame animation phase timer for Dog companion entity (`+$12` in entity struct). |
| `$7E:4F4F` | 2 bytes | `DOG_ACTION_STATE_FLAGS` | Room | Movement and action state flags for Dog companion entity (`+$18` in entity struct). |
| `$7E:4F51` | 2 bytes | `DOG_WORLD_X` | Room | Dog companion entity current horizontal world coordinate in pixels (`+$1A` in entity struct). |
| `$7E:4F53` | 2 bytes | `DOG_WORLD_Y` | Room | Dog companion entity current vertical world coordinate in pixels (`+$1C` in entity struct). |
| `$7E:4F59` | 2 bytes | `DOG_FACING_DIRECTION` | Room | Dog facing direction enum (`0`=N, `2`=NE, `4`=E, `6`=SE, `8`=S, `10`=SW, `12`=W, `14`=NW; `+$22` in entity struct). |
| `$7E:4F5B` | 2 bytes | `SECONDARY_ATTACKER_PTR` | Room | Pointer to entity record of target entity receiving combat damage. |
| `$7E:4F61` | 2 bytes | `DOG_COLLISION_RADIUS` | Room | Horizontal collision bounding box half-width for Dog entity (`+$2A` in entity struct). |
| `$7E:4F71` | 2 bytes | `DOG_ELEVATION_Z` | Room | Dog entity current vertical elevation / Z-height off ground plane (`+$3A` in entity struct). |
| `$7E:4F73` | 2 bytes | `DOG_MOVEMENT_VELOCITY` | Room | Movement velocity factor applied during Dog walking, running, and sniffing (`+$3C` in entity struct). |
| `$7E:4FE6` | 50 bytes | `MAP_ANIM_FRAMES` | Room | Current animation frame indices for active map animated tile channels. |
| `$7E:5018` | 50 bytes | `MAP_ANIM_TIMERS` | Room | Countdown hold delay timers for active map animated tile channels. |
| `$7E:504A` | 50 bytes | `MAP_ANIM_CYCLES` | Room | Loop cycle iteration counters for active map animated tile channels. |
| `$7E:507D` | 34 bytes | `MAP_ANIM_DESCRIPTORS` | Room | ROM pointers to animated tile sequence descriptor definitions. |
| `$7E:50A7` | 136 bytes | `SPRITE_ALLOC_POOL` | Frame | Dynamic sprite allocation node pool (17 nodes × 8 bytes: `+$00` prev, `+$02` next, `+$04` state `$FFFF`=free, `+$06` parent). |
| `$7E:50AD` | 1 byte | `SPRITE_VRAM_ALLOC_TABLE` | Room | Sprite VRAM block allocation table. Used by the dynamic sprite engine in bank $80 to allocate VRAM tile slots for dynamic actors, weapon animations, and particl |
| `$7E:5127` | 2 bytes | `SPRITE_DRAW_QUEUE_HEAD` | Frame | Head pointer to sorted sprite render queue (`$7E:512F..$7E:516F`); traversed by `func_C096BB`. |
| `$7E:512F` | 64 bytes | `SPRITE_DRAW_QUEUE_NODES` | Frame | Dynamic sprite draw queue nodes (stride 16 bytes: `+$00` next link, `+$04` state, `+$06` X, `+$08` Y, `+$0A` attr flags, `+$0C..$0E` 24-bit slice table ptr). |
| `$7E:6187` | 32 bytes | `SPRITE_CGRAM_SHADOW` | Room | Sprite palette shadow buffer DMA-copied to SNES CGRAM during VBLANK. |
| `$7E:61A7` | 224 bytes | `MAP_TILE_PALETTES` | Room | Tile family CGRAM palette shadow buffers (7 families × 32 bytes). |
| `$7E:6289` | 28 bytes | `OAM_SLICE_DESCRIPTORS` | Frame | Hardware sprite OAM tile slice position and attribute descriptor array. |
| `$7E:62A5` | 224 bytes | `TILE_ANIM_VRAM_OFFSETS` | Room | Source VRAM tile offset table for animated tile family cycling. |
| `$7E:72D1` | 1024 bytes | `SPRITE_TILE_STAGING_BUF` | Frame | Staging buffer for 4bpp sprite tile graphics unpacked dynamically before VRAM DMA upload (128 bytes per 16x16 tile). |
| `$7E:7321` | 16 bytes | `LAVA_PALETTE_ROTATION` | Frame | Animated palette rotation buffer for bubbling molten lava surface glow. |
| `$7E:7331` | 16 bytes | `CRYSTAL_PALETTE_CYCLE` | Frame | Animated palette cycling buffer for glowing crystalline minerals. |
| `$7E:96A5` | 1 byte | `OBJ_TILE_LRU_PREV` | Room | OBJ 8x8 tile cache, prev links (130 bytes). `prev[i]` of the OBJ tile cache lists; see `$7E9727`. `$7E9725` = `prev[$80]` (next slot to evict), `$7E9726` = `pre |
| `$7E:9727` | 1 byte | `OBJ_TILE_LRU_NEXT` | Room | OBJ 8x8 tile cache, next links (130 bytes). Doubly linked list over the 128 dynamic OBJ tile slots; a slot number is the OBJ tile number (VRAM word `$6000 + slo |
| `$7E:97A9` | 256 bytes | `VRAM_TILE_PATTERN_LOOKUP` | Frame | Lookup table mapping ROM sprite pattern ID to allocated dynamic VRAM slot. |
| `$7F:A000` | 14366 bytes | `FONT_GLYPH_STAGING` | Room | High WRAM 2bpp font glyph rendering and decompression staging buffer. |
| `$7E:AA58` | 256 bytes | `VRAM_SLOT_PATTERN_MAP` | Frame | Table mapping dynamic VRAM tile slots back to their active pattern ID. |
| `$7E:AB18` | 96 bytes | `VRAM_TILE_LRU_PREV` | Frame | Backward links for least-recently-used (LRU) dynamic VRAM sprite tile allocator. |
| `$7E:AB78` | 1 byte | `VRAM_TILE_LRU_HEAD` | Frame | Head index of LRU dynamic VRAM tile allocator list. |
| `$7E:AB79` | 1 byte | `VRAM_TILE_LRU_MOST_RECENT` | Frame | Most recently allocated tile index in dynamic VRAM tile allocator. |
| `$7E:AB7A` | 96 bytes | `VRAM_TILE_LRU_NEXT` | Frame | Forward links for least-recently-used (LRU) dynamic VRAM sprite tile allocator. |
| `$7E:ABDE` | 512 bytes | `LOW_OAM_TABLE_BUF` | Frame | Low OAM staging buffer (128 hardware sprites × 4 bytes: X low, Y, tile number, attributes); uploaded to SNES OAM via DMA in VBlank. |
| `$7E:ADDE` | 32 bytes | `HIGH_OAM_TABLE_BUF` | Frame | High OAM staging buffer (32 bytes = 128 sprites × 2 bits: bit 0 = 9th bit of X, bit 1 = sprite size 8x8 vs 16x16/32x32); uploaded via DMA in VBlank. |
| `$7F:C300` | 1280 bytes | `ROOM_PALETTE_TABLE` | Room | Room tile palette index association table. |
| `$7F:C800` | 512 bytes | `SHADOW_TILEMAP_BUF` | Room | Staging buffer for HUD and text box background layer tilemap updates. |
| `$7F:D81E` | 10210 bytes | `DIALOGUE_ASCII_BUFFER` | Room | Dialogue box decoded ASCII text string rasterization buffer. |
