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
| `$7E:0000` | 256 bytes | `DIRECT_PAGE_BLOCK` | Boot | SNES Direct Page continuous register scratchpad |
| `$7E:0000` | `Byte×256` | `direct_page_block` | `Frame` | Continuous 256-byte SNES Direct Page scratchpad ($7E:0000..$7E:00FF, CPU D=0x0000) containing math registers, camera coords, metasprite ptrs, VM registers, and loop counters. |
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
| `$7E:0022` | 3 bytes | `DP_MEMCPY_DEST_FAR_PTR` | Frame | Universal 24-bit destination memory far pointer ($22..$24) used by block copy ($80:B149) and DMA staging. |
| `$7E:0026` | 3 bytes | `DP_SPRITE_DESCRIPTOR_PTR` | Frame | 24-bit pointer (`$26..$28`) to active sprite slice descriptor table; source memory far pointer in VRAM/CGRAM DMA queues. |
| `$7E:002A` | 2 bytes | `DP_SCRATCH_2A` | Frame | Direct page general calculation scratch word; used in math routines and coordinate shifts. |
| `$7E:002E` | 2 bytes | `DP_DMA_DEST_ADDR` | Frame | Destination hardware word address for queued VRAM (`$2116`) or CGRAM (`$2121`) DMA transfers. |
| `$7E:0034` | 2 bytes | `DP_DECOMP_PAYLOAD_SIZE` | Temp | Uncompressed payload size in bytes passed to decompression dispatcher (`$8C:988D`). |
| `$7E:0036` | 3 bytes | `DP_DECOMP_SRC_FAR_PTR` | Temp | 24-bit pointer (`$36..$38`) to compressed source data stream. |
| `$7E:003A` | 3 bytes | `DP_DECOMP_DST_FAR_PTR` | Temp | 24-bit pointer (`$3A..$3C`) to uncompressed destination memory buffer. |
| `$7E:0046` | 2 bytes | `DP_ACTOR_WORLD_X` | Frame | Direct Page horizontal world position (pixels) of currently processing actor ($8F:AC84). |
| `$7E:0048` | 2 bytes | `DP_ACTOR_WORLD_Y` | Frame | Direct Page vertical world position (pixels) of currently processing actor ($8F:AC84). |
| `$7E:004C` | 2 bytes | `DP_CURRENT_ACTOR_PTR` | Frame | Direct Page pointer to actively executing character/monster entity record ($8F:9877, $8F:AC84). |
| `$7E:004E` | 2 bytes | `DP_CHILD_OR_TARGET_ACTOR_PTR` | Frame | Direct Page pointer to spawned child, projectile, or target actor record ($8F:9877). |
| `$7E:0059` | 2 bytes | `CAMERA_FINAL_X` | Frame | Final shaken camera horizontal scroll coordinate in pixels (written to PPU BG1HOFS). |
| `$7E:005B` | 2 bytes | `CAMERA_FINAL_Y` | Frame | Final shaken camera vertical scroll coordinate in pixels (written to PPU BG1VOFS). |
| `$7E:005D` | 2 bytes | `DP_COLLISION_BOX_EXTENTS` | Frame | Collision bounding box width and height extent offsets returned by $90:828E. |
| `$7E:0070` | 2 bytes | `DP_SCRATCH_70` | Frame | Direct page scratch pointer; used by decompression and script string decoders. |
| `$7E:0072` | 1 byte | `HDMA_ENABLE_MASK` | Frame | Restored into $420C by NMI handler at scanline 225 to enable Mode 7 perspective or HDMA color gradients. |
| `$7E:007E` | 2 bytes | `SCRIPT_CURRENT_THREAD_PTR` | Frame | Pointer to currently executing ScriptSlot in active script VM thread queue ($7E:28FC..$7E:2F28). |
| `$7E:0080` | 2 bytes | `SCRIPT_CALL_STACK_PTR` | Frame | Call stack pointer for nested script subroutines (gosub). |
| `$7E:0082` | 3 bytes | `SCRIPT_PC_FAR_PTR` | Frame | Active 24-bit instruction pointer ($82..$84) consumed by script_vm_opcode_dispatch ($8C:D09C). |
| `$7E:0086` | 1 byte | `SCRIPT_VM_FREEZE_GATE` | Frame | Global script thread execution freeze flag (non-zero pauses script VM processing). |
| `$7E:008E` | 2 bytes | `SCRIPT_WINDOW_TARGET_PTR` | Frame | Active dialogue text window stream target buffer pointer consumed by opcode 0x51 ($8C:DA0A). |
| `$7E:0095` | 2 bytes | `DP_MENU_DESCRIPTOR_PTR` | Room | Active inventory / ring menu descriptor table base pointer used with indirect indexing ($8E:A3EB). |
| `$7E:009F` | 1 | `AUDIO_APU_SYNC_COUNTER` | Frame | Audio Engine: Handshake sequence synchronization counter byte verified against APU port $2142 ($8C:81E4) |
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
| `$7E:010C` | 1 byte | `PPU_SHADOW_BG34NBA` | Frame | Hardware shadow register for PPU $210C (BG3 & BG4 tile base address in VRAM; $80:B3B0, $8E:E08B). |
| `$7E:010E` | 2 bytes | `PPU_SHADOW_BG1HOFS` | Frame | BG1 horizontal scroll offset shadow; low byte written to $210D, high byte written to $210D. |
| `$7E:0110` | 2 bytes | `PPU_SHADOW_BG1VOFS` | Frame | BG1 vertical scroll offset shadow; low byte written to $210E, high byte written to $210E. |
| `$7E:0112` | 2 bytes | `PPU_SHADOW_BG2HOFS` | Frame | BG2 horizontal scroll offset shadow; low byte written to $210F, high byte written to $210F. |
| `$7E:0114` | 2 bytes | `PPU_SHADOW_BG2VOFS` | Frame | BG2 vertical scroll offset shadow; low byte written to $2110, high byte written to $2110. |
| `$7E:0116` | 2 bytes | `PPU_SHADOW_BG3HOFS` | Frame | BG3 horizontal scroll offset shadow; written to $2111 (twice). |
| `$7E:0118` | 2 bytes | `PPU_SHADOW_BG3VOFS` | Frame | BG3 vertical scroll offset shadow; written to $2112 (twice). |
| `$7E:011A` | 2 bytes | `PPU_SHADOW_BG4HOFS` | Frame | BG4 horizontal scroll offset shadow; written to $2113 (twice). |
| `$7E:011C` | 2 bytes | `PPU_SHADOW_BG4VOFS` | Frame | BG4 vertical scroll offset shadow; written to $2114 (twice). |
| `$7E:011E` | 1 byte | `SCREEN_SHAKE_Y_DISPLACEMENT` | Frame | Vertical screen shake oscillation displacement offset ($8C:C6CB, $8F:C61E). |
| `$7E:0120` | 1 byte | `SCREEN_SHAKE_PREV_Y_DISPLACEMENT` | Frame | Latch of previous frame vertical screen shake displacement ($8C:C6CB). |
| `$7E:0122` | 1 byte | `PPU_SHADOW_W12SEL` | Frame | Window 1 and 2 mask settings shadow for BG1 and BG2; copied to hardware register $2123. |
| `$7E:0123` | 1 byte | `PPU_SHADOW_W34SEL` | Frame | Window 1 and 2 mask settings shadow for BG3 and BG4; copied to hardware register $2124. |
| `$7E:0124` | 1 byte | `PPU_SHADOW_WOBJSEL` | Frame | Window 1 and 2 mask settings shadow for OBJ and Color math; copied to hardware register $2125. |
| `$7E:0125` | 3 bytes | `VBLANK_CALLBACK_PTR` | Frame | 24-bit indirect execution vector ($7E:0125..$7E:0127) called during NMI via jml [$0125]. |
| `$7E:0128` | 3 bytes | `NMI_USER_HOOK_FAR_PTR` | Boot | 24-bit far indirect vector hook jumped to during VBlank NMI interrupt dispatch ($80:857F). |
| `$7E:0128` | 3 bytes | `VBLANK_QUEUED_CALLBACK_PTR` | Frame | Next 24-bit callback vector queued to replace $7E:0125 at end of current frame. |
| `$7E:012B` | 3 bytes | `IRQ_USER_HOOK_FAR_PTR` | Boot | 24-bit far indirect vector hook executed upon firing of H/V-Timer scanline IRQ ($80:8507, $80:8552). |
| `$7E:0133` | 2 bytes | `RNG_SEED_0` | Frame | Cross-word carry pseudo-random number generator 16-bit seed word 0 (updated by func_C0859B). |
| `$7E:0134` | 1 byte | `SECONDARY_RNG_JITTER_SEED` | Frame | Secondary pseudo-random byte seed for particle jitter calculations ($90:98A5). |
| `$7E:0135` | 2 bytes | `RNG_SEED_1` | Frame | Cross-word carry pseudo-random number generator 16-bit seed word 1. |
| `$7E:0137` | 2 bytes | `RNG_SEED_2` | Frame | Cross-word carry pseudo-random number generator 16-bit seed word 2. |
| `$7E:0139` | 2 bytes | `RNG_SEED_3` | Frame | Cross-word carry pseudo-random number generator 16-bit seed word 3 (combined $0133..$013A = 64-bit RNG state). |
| `$7E:013B` | 2 bytes | `VRAM_DMA_QUEUE_TAIL` | Frame | Read cursor index of deferred VRAM DMA queue (processed during VBlank). |
| `$7E:013D` | 2 bytes | `VRAM_DMA_QUEUE_CURSOR` | Frame | Cursor index into 16-slot deferred VRAM DMA transfer queue. |
| `$7E:013F` | 128 bytes | `VRAM_DMA_QUEUE` | Frame | 16-slot deferred VRAM DMA queue (8 bytes per descriptor: src bank/addr, dest VRAM addr, length). |
| `$7E:015F` | `Word×16` | `palette_bg_1` | `Room` | Background Palette 1 shadow buffer (16 colors, 32 bytes in 15-bit BGR555 format). |
| `$7E:017F` | `Word×16` | `palette_bg_2` | `Room` | Background Palette 2 shadow buffer (16 colors, 32 bytes in 15-bit BGR555 format). |
| `$7E:019F` | `Word×16` | `palette_bg_3` | `Room` | Background Palette 3 shadow buffer (16 colors, 32 bytes in 15-bit BGR555 format). |
| `$7E:01BF` | `Word×16` | `palette_bg_4` | `Room` | Background Palette 4 shadow buffer (16 colors, 32 bytes in 15-bit BGR555 format). |
| `$7E:01DF` | `Word×16` | `palette_bg_5` | `Room` | Background Palette 5 shadow buffer (16 colors, 32 bytes in 15-bit BGR555 format). |
| `$7E:01FF` | `Word×16` | `palette_bg_6` | `Room` | Background Palette 6 shadow buffer (16 colors, 32 bytes in 15-bit BGR555 format). |
| `$7E:021F` | `Word×16` | `palette_bg_7` | `Room` | Background Palette 7 shadow buffer (16 colors, 32 bytes in 15-bit BGR555 format). |
| `$7E:023F` | `Word×16` | `palette_spr_0` | `Room` | Sprite/OBJ Palette 0 shadow buffer (16 colors, 32 bytes in 15-bit BGR555 format). |
| `$7E:025F` | `Word×16` | `palette_spr_1` | `Room` | Sprite/OBJ Palette 1 shadow buffer (16 colors, 32 bytes in 15-bit BGR555 format). |
| `$7E:027F` | `Word×16` | `palette_spr_2` | `Room` | Sprite/OBJ Palette 2 shadow buffer (16 colors, 32 bytes in 15-bit BGR555 format). |
| `$7E:029F` | `Word×16` | `palette_spr_3` | `Room` | Sprite/OBJ Palette 3 shadow buffer (16 colors, 32 bytes in 15-bit BGR555 format). |
| `$7E:02BF` | `Word×16` | `palette_spr_4` | `Room` | Sprite/OBJ Palette 4 shadow buffer (16 colors, 32 bytes in 15-bit BGR555 format). |
| `$7E:02DF` | `Word×16` | `palette_spr_5` | `Room` | Sprite/OBJ Palette 5 shadow buffer (16 colors, 32 bytes in 15-bit BGR555 format). |
| `$7E:02FF` | `Word×16` | `palette_spr_6` | `Room` | Sprite/OBJ Palette 6 shadow buffer (16 colors, 32 bytes in 15-bit BGR555 format). |
| `$7E:031F` | `Word×16` | `palette_spr_7` | `Room` | Sprite/OBJ Palette 7 shadow buffer (16 colors, 32 bytes in 15-bit BGR555 format). |
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
| `$7E:03E1` | 2 | `SUBWINDOW_WIDTH` | Frame | UI Subsystem: Sub-menu window horizontal columns width (e.g. 4 columns, $8E:9EF0) |
| `$7E:03E3` | 2 | `SUBWINDOW_HEIGHT` | Frame | UI Subsystem: Sub-menu window vertical rows height (e.g. 1 row, $8E:9EF0) |
| `$7E:03F1` | 2 | `SUBWINDOW_VRAM_TILE_OFFSET` | Frame | UI Subsystem: Sub-menu window base VRAM tile offset ($0014, $8E:9EF0) |
| `$7E:03F9` | 2 | `SUBWINDOW_CURSOR_STRIDE` | Frame | UI Subsystem: Sub-menu cursor navigation step stride ($0008, $8E:9EF0) |
| `$7E:03FB` | 2 | `SUBWINDOW_OPTIONS_COUNT` | Frame | UI Subsystem: Sub-menu selectable options item count ($8E:9EF0) |
| `$7E:0403` | 2 | `SUBWINDOW_STR_TABLE_PTR` | Frame | UI Subsystem: Sub-menu localized menu string key table pointer ($1924, $8E:9EF0) |
| `$7E:0407` | `Word` | `window_4_border_tile` | `Frame` | Window 4 custom border corner tile index and attribute word ($8C:AB82). |
| `$7E:0421` | `Word` | `window_4_scroll_offset_x` | `Frame` | Window 4 horizontal text blitter pixel scroll offset ($8D:801B). |
| `$7E:0423` | `Word` | `window_4_scroll_offset_y` | `Frame` | Window 4 vertical text blitter pixel scroll offset ($8D:804B). |
| `$7E:0433` | `Word` | `window_5_border_tile` | `Frame` | Window 5 custom border corner tile index and attribute word ($8C:AB85). |
| `$7E:0435` | `Word` | `window_5_pos_x` | `Frame` | Window 5 screen tile column X origin coordinate ($8C:9E34). |
| `$7E:0437` | `Word` | `window_5_pos_y` | `Frame` | Window 5 screen tile row Y origin coordinate ($8C:A354). |
| `$7E:0439` | `Word` | `window_5_width` | `Frame` | Window 5 width in 8x8 character tiles ($8C:9EB5). |
| `$7E:043B` | `Word` | `window_5_height` | `Frame` | Window 5 height in 8x8 character tiles ($8C:9EB8). |
| `$7E:043D` | `Word` | `window_5_text_ptr_lo` | `Frame` | Window 5 active text string token read pointer low word ($8C:A35B). |
| `$7E:043F` | `Word` | `window_5_text_ptr_hi` | `Frame` | Window 5 active text string token read pointer high bank word ($8C:9E0E). |
| `$7E:0441` | `Word` | `window_5_cursor_line` | `Frame` | Window 5 current typewriter text raster line index ($8C:A361). |
| `$7E:0443` | `Word` | `window_5_cursor_col` | `Frame` | Window 5 current typewriter text column character position ($8C:9E42). |
| `$7E:0445` | `Word` | `window_5_flags` | `Frame` | Window 5 display flags bitfield (active, bordered, scrolling, paging). |
| `$7E:0447` | `Word` | `window_5_font_vram_base` | `Frame` | Window 5 font pattern base tile word offset in VRAM ($8C:9E46). |
| `$7E:0449` | `Word` | `window_5_bg_tile_attr` | `Frame` | Window 5 background fill tile pattern and palette attribute word ($8C:A370). |
| `$7E:044F` | `Word` | `window_5_line_pitch` | `Frame` | Window 5 character buffer line pitch / stride in bytes. |
| `$7E:0451` | `Word` | `window_5_vram_tilemap_dest` | `Frame` | Window 5 hardware VRAM tilemap destination base address ($8C:9E06). |
| `$7E:0453` | `Word` | `window_5_dismiss_timer` | `Frame` | Window 5 auto-close delay countdown timer ticks. |
| `$7E:0459` | `Word` | `window_6_pos_x` | `Frame` | Window 6 screen tile column X origin coordinate ($8C:A380). |
| `$7E:045B` | `Word` | `window_6_pos_y` | `Frame` | Window 6 screen tile row Y origin coordinate ($8C:A384). |
| `$7E:045D` | `Word` | `window_6_width` | `Frame` | Window 6 width in 8x8 character tiles. |
| `$7E:045F` | `Word` | `window_6_height` | `Frame` | Window 6 height in 8x8 character tiles. |
| `$7E:0485` | `Word` | `window_7_pos_x` | `Frame` | Window 7 screen tile column X origin coordinate. |
| `$7E:0487` | `Word` | `window_7_pos_y` | `Frame` | Window 7 screen tile row Y origin coordinate. |
| `$7E:0497` | `Word` | `window_7_flags` | `Frame` | Window 7 display flags bitfield. |
| `$7E:04B1` | `Word` | `window_8_pos_x` | `Frame` | Window 8 screen tile column X origin coordinate. |
| `$7E:04B3` | `Word` | `window_8_pos_y` | `Frame` | Window 8 screen tile row Y origin coordinate. |
| `$7E:04C3` | `Word` | `window_8_flags` | `Frame` | Window 8 display flags bitfield. |
| `$7E:051D` | 68 bytes | `HUD_BOY_STATUS_WIDGET` | Room | HUD graphics descriptor for Boy status bar, HP meter gauge, and numeric digit tilemaps ($7E:051D..$7E:0560). |
| `$7E:051F` | `Word` | `combat_damage_color_cycle` | `Frame` | HUD damage counter flash color cycle timer ticks ($8F:8755). |
| `$7E:0561` | 68 bytes | `HUD_DOG_STATUS_WIDGET` | Room | HUD graphics descriptor for Dog status bar, HP meter gauge, and numeric digit tilemaps ($7E:0561..$7E:05A4). |
| `$7E:05A7` | 2 bytes | `RING_MENU_CALLER_ACTOR` | Room | Pointer to actor entity that opened active ring menu (Boy $7E:4E89 or Dog $7E:4F37). |
| `$7E:05A9` | 2 bytes | `RING_MENU_STATUS_FLAGS` | Room | Ring menu state and visibility bitflags (bit 15 $8000 set = ring menu active/open). |
| `$7E:05AB` | 2 bytes | `RING_MENU_CATEGORY_INDEX` | Room | Active ring menu category index (Items, Alchemy Formulas, Weapons, Settings). |
| `$7E:05AD` | 2 | `TARGET_REQUEST_MASK` | Unknown | Target request mask — who a spell, item or cursor may pick |
| `$7E:05B1` | 46 bytes | `DIALOGUE_LINE_DECODE_BUF` | Room | Formatted 46-byte ASCII / tilemap string line buffer generated by func_CC9E03 for banners and text boxes. |
| `$7E:05B3` | 2 | `DIALOGUE_CHAR_TILE_01` | Frame | UI Subsystem: Rasterized tile word for dialogue character 1. |
| `$7E:05B5` | 2 | `DIALOGUE_CHAR_TILE_02` | Frame | UI Subsystem: Rasterized tile word for dialogue character 2. |
| `$7E:05B7` | 2 | `DIALOGUE_CHAR_TILE_03` | Frame | UI Subsystem: Rasterized tile word for dialogue character 3. |
| `$7E:05B9` | 2 | `DIALOGUE_CHAR_TILE_04` | Frame | UI Subsystem: Rasterized tile word for dialogue character 4. |
| `$7E:05BB` | 2 | `DIALOGUE_CHAR_TILE_05` | Frame | UI Subsystem: Rasterized tile word for dialogue character 5. |
| `$7E:05BD` | 2 | `DIALOGUE_CHAR_TILE_06` | Frame | UI Subsystem: Rasterized tile word for dialogue character 6. |
| `$7E:05BF` | 2 | `DIALOGUE_CHAR_TILE_07` | Frame | UI Subsystem: Rasterized tile word for dialogue character 7. |
| `$7E:05C1` | 2 | `DIALOGUE_CHAR_TILE_08` | Frame | UI Subsystem: Rasterized tile word for dialogue character 8. |
| `$7E:05C3` | 2 | `DIALOGUE_CHAR_TILE_09` | Frame | UI Subsystem: Rasterized tile word for dialogue character 9. |
| `$7E:05C5` | 2 | `DIALOGUE_CHAR_TILE_10` | Frame | UI Subsystem: Rasterized tile word for dialogue character 10. |
| `$7E:05C7` | 2 | `DIALOGUE_CHAR_TILE_11` | Frame | UI Subsystem: Rasterized tile word for dialogue character 11. |
| `$7E:05C9` | 2 | `DIALOGUE_CHAR_TILE_12` | Frame | UI Subsystem: Rasterized tile word for dialogue character 12. |
| `$7E:05CB` | 2 | `DIALOGUE_CHAR_TILE_13` | Frame | UI Subsystem: Rasterized tile word for dialogue character 13. |
| `$7E:05CD` | 2 | `DIALOGUE_CHAR_TILE_14` | Frame | UI Subsystem: Rasterized tile word for dialogue character 14. |
| `$7E:05CF` | 2 | `DIALOGUE_CHAR_TILE_15` | Frame | UI Subsystem: Rasterized tile word for dialogue character 15. |
| `$7E:0615` | 2 bytes | `RING_MENU_ORIGIN_X` | Room | Screen X center anchor around which revolving ring menu icons orbit. |
| `$7E:0617` | 2 bytes | `RING_MENU_ORIGIN_Y` | Room | Screen Y center anchor around which revolving ring menu icons orbit. |
| `$7E:0619` | 2 bytes | `FLIGHT_CRUISE_SPEED` | Room | Mode 7 flight cruise forward velocity factor (shared with RING_MENU_RADIUS_DISTANCE; $8E:AF80). |
| `$7E:0619` | 2 bytes | `RING_MENU_RADIUS_DISTANCE` | Room | Expansion radius distance (pixels) between ring icons and center anchor during open/close animations (func_CEB0CF). |
| `$7E:061B` | 2 bytes | `FLIGHT_HEADING_ANGLE` | Room | Mode 7 flight yaw heading angle in 512-step trigonometric circle (shared with RING_MENU_ROTATION_ANGLE; $8E:AF80). |
| `$7E:061B` | 2 bytes | `RING_MENU_ROTATION_ANGLE` | Room | Active rotational orbit angle (0..255) of ring menu icons. |
| `$7E:061D` | 2 bytes | `FLIGHT_PITCH_ANGLE` | Room | Mode 7 flight pitch/banking roll angle smoothed by hardware divider (shared with RING_MENU_ANGLE_2; $8E:AF80). |
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
| `$7E:08FA` | `Word×16` | `viewport_collision_row_0` | `Room` | Viewport metatile collision row 0 (16 words: solidity, ledge, stairs, elevation). |
| `$7E:091A` | `Word×16` | `viewport_collision_row_1` | `Room` | Viewport metatile collision row 1 (16 words: local terrain physics geometry). |
| `$7E:093A` | `Word×16` | `viewport_collision_row_2` | `Room` | Viewport metatile collision row 2 (16 words: local terrain physics geometry). |
| `$7E:095A` | `Word×16` | `viewport_collision_row_3` | `Room` | Viewport metatile collision row 3 (16 words: local terrain physics geometry). |
| `$7E:097A` | `Word×16` | `viewport_collision_row_4` | `Room` | Viewport metatile collision row 4 (16 words: local terrain physics geometry). |
| `$7E:099A` | `Word×16` | `viewport_collision_row_5` | `Room` | Viewport metatile collision row 5 (16 words: local terrain physics geometry). |
| `$7E:09BA` | `Word×16` | `viewport_collision_row_6` | `Room` | Viewport metatile collision row 6 (16 words: local terrain physics geometry). |
| `$7E:09DA` | `Word×16` | `viewport_collision_row_7` | `Room` | Viewport metatile collision row 7 (16 words: local terrain physics geometry). |
| `$7E:09FA` | `Word×16` | `viewport_collision_row_8` | `Room` | Viewport metatile collision row 8 (16 words: local terrain physics geometry). |
| `$7E:0A1A` | `Word×6` | `viewport_collision_row_9` | `Room` | Viewport metatile collision row 9 end boundary descriptor ($7E:0A1A..$7E:0A25). |
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
| `$7E:0AA0` | 2 | `DOG_BOOST_ATTACK` | Room | Companion Stats: Dog temporary attack power boost amount from Atlas alchemy formula. |
| `$7E:0AA2` | 2 | `DOG_FORM_BASE_DEFENSE` | Room | Companion Stats: Active Dog form base physical defense rating ($8F:9471). |
| `$7E:0AA4` | 2 | `DOG_FORM_BASE_MAGIC_ATK` | Room | Companion Stats: Active Dog form base magic attack power ($8F:9471). |
| `$7E:0AA6` | 2 | `DOG_FORM_BASE_HIT_RATE` | Room | Companion Stats: Active Dog form base accuracy / hit rate ($8F:9471). |
| `$7E:0AA8` | 2 | `DOG_FORM_BASE_EVADE_RATE` | Room | Companion Stats: Active Dog form base evasion / dodge rate ($8F:9471). |
| `$7E:0AAA` | 2 | `DOG_FORM_BASE_MAGIC_DEF` | Room | Companion Stats: Active Dog form base magic defense rating ($8F:9471). |
| `$7E:0AAC` | 2 | `DOG_FORM_SPEED_FACTOR` | Room | Companion Stats: Active Dog form walking/running movement speed scale factor ($8F:9471). |
| `$7E:0AAE` | 2 | `DOG_FORM_SCENT_RADIUS` | Room | Companion Stats: Active Dog form hidden alchemy ingredient sniffing detection radius ($8F:9471). |
| `$7E:0AB0` | 2 | `DOG_FORM_CHARGE_MULT` | Room | Companion Stats: Active Dog form charge attack damage multiplier ($8F:9471). |
| `$7E:0AB8` | 2 | `DOG_FORM_ATTACK_RANGE` | Room | Companion Stats: Active Dog form physical bite/dash attack hitbox range ($8F:9471). |
| `$7E:0ABA` | 1 byte | `EQUIPPED_WEAPON` | Save | Equipped weapon index (bone, axe, spear, bazooka, etc.). |
| `$7E:0ABE` | 2 bytes | `DOG_EQUIPPED_COLLAR` | Save | Identifier of currently equipped Dog companion collar armor (Leather Collar, Spiky Collar, etc.; $8F:857D). |
| `$7E:0AC6` | 2 bytes | `CURRENCY_TALONS` | Save | Prehistoria realm currency balance (Talons). |
| `$7E:0AC9` | 2 bytes | `CURRENCY_JEWELS` | Save | Antiqua realm currency balance (Jewels). |
| `$7E:0ACC` | 2 bytes | `CURRENCY_GOLD` | Save | Gothica realm currency balance (Gold Coins). |
| `$7E:0ACF` | 2 bytes | `CURRENCY_CREDITS` | Save | Omnitopia realm currency balance (Credits). |
| `$7E:0AD2` | 1 | `RING_EQUIPPED_ALCH_0` | Save | Alchemy Subsystem: Equipped formula ID in active Ring Menu quick-cast slot 0. |
| `$7E:0AD3` | 1 | `RING_EQUIPPED_ALCH_1` | Save | Alchemy Subsystem: Equipped formula ID in active Ring Menu quick-cast slot 1. |
| `$7E:0AD4` | 1 | `RING_EQUIPPED_ALCH_2` | Save | Alchemy Subsystem: Equipped formula ID in active Ring Menu quick-cast slot 2. |
| `$7E:0AD5` | 1 | `RING_EQUIPPED_ALCH_3` | Save | Alchemy Subsystem: Equipped formula ID in active Ring Menu quick-cast slot 3. |
| `$7E:0AD6` | 1 | `RING_EQUIPPED_ALCH_4` | Save | Alchemy Subsystem: Equipped formula ID in active Ring Menu quick-cast slot 4. |
| `$7E:0AD7` | 1 | `RING_EQUIPPED_ALCH_5` | Save | Alchemy Subsystem: Equipped formula ID in active Ring Menu quick-cast slot 5. |
| `$7E:0AD8` | 1 | `RING_EQUIPPED_ALCH_6` | Save | Alchemy Subsystem: Equipped formula ID in active Ring Menu quick-cast slot 6. |
| `$7E:0AD9` | 1 | `RING_EQUIPPED_ALCH_7` | Save | Alchemy Subsystem: Equipped formula ID in active Ring Menu quick-cast slot 7. |
| `$7E:0ADA` | 1 | `RING_EQUIPPED_ALCH_8` | Save | Alchemy Subsystem: Equipped formula ID in active Ring Menu quick-cast slot 8. |
| `$7E:0ADB` | 2 bytes | `CURRENT_ROOM_ID` | Room | Active room / map ID index into master pointer table $9F:FDE7; passed to enter_room ($8E:E4E2). |
| `$7E:0ADD` | 2 | `WEAPON_SKILL_FIST` | Save | Combat Progression: Unarmed fist combat proficiency level and experience ($0100 default). |
| `$7E:0ADF` | 2 | `WEAPON_SKILL_BONE_CLUB` | Save | Combat Progression: Bone Club sword skill level and experience ($0100 default, $8F:805A). |
| `$7E:0AE1` | 2 | `WEAPON_SKILL_SPIDER_CLAW` | Save | Combat Progression: Spider Claw sword skill level and experience ($0100 default, $8F:805D). |
| `$7E:0AE3` | 2 | `WEAPON_SKILL_GLADIATOR_SWD` | Save | Combat Progression: Gladiator Sword skill level and experience ($0100 default, $8F:8060). |
| `$7E:0AE5` | 2 | `WEAPON_SKILL_CRUSADER_SWD` | Save | Combat Progression: Crusader Sword skill level and experience ($0100 default, $8F:8063). |
| `$7E:0AE7` | 2 | `WEAPON_SKILL_BONE_CRUSHER` | Save | Combat Progression: Bone Crusher axe skill level and experience ($0100 default, $8F:8066). |
| `$7E:0AE9` | 2 | `WEAPON_SKILL_BRONZE_AXE` | Save | Combat Progression: Bronze Axe skill level and experience ($0100 default, $8F:8069). |
| `$7E:0AEB` | 2 | `WEAPON_SKILL_KNIGHT_BASHER` | Save | Combat Progression: Knight Basher axe skill level and experience ($0100 default, $8F:806C). |
| `$7E:0AED` | 2 | `WEAPON_SKILL_ATOM_SMASHER` | Save | Combat Progression: Atom Smasher axe skill level and experience ($0100 default, $8F:806F). |
| `$7E:0AEF` | 2 | `WEAPON_SKILL_HORN_SPEAR` | Save | Combat Progression: Horn Spear skill level and experience ($0100 default, $8F:8072). |
| `$7E:0AF1` | 2 | `WEAPON_SKILL_BRONZE_SPEAR` | Save | Combat Progression: Bronze Spear skill level and experience ($0100 default, $8F:8075). |
| `$7E:0AF3` | 2 | `WEAPON_SKILL_LANCE` | Save | Combat Progression: Lance spear skill level and experience ($0100 default, $8F:8078). |
| `$7E:0AF5` | 2 | `WEAPON_SKILL_LASER_LANCE` | Save | Combat Progression: Laser Lance spear skill level and experience ($0100 default, $8F:807B). |
| `$7E:0B07` | 2 | `BOY_CHARGE_CAPACITY` | Save | Combat Mechanics: Boy stamina charge gauge capacity ($0100 = 100% full attack power threshold) |
| `$7E:0B09` | 2 bytes | `BOY_AI_AGGRESSION_SETTING` | Save | Boy companion AI attack setting (0 = never attack, 1..5 = attack radius 50..130 pixels). |
| `$7E:0B0B` | 2 bytes | `ROOM_STEP_TRIGGER` | Room | Pointer to step-on coordinate trigger descriptor table for current room. |
| `$7E:0B0D` | 2 bytes | `DOG_AI_AGGRESSION_SETTING` | Save | Dog companion AI attack setting (0 = never attack, 1..5 = widest search radius). |
| `$7E:0B0F` | 2 | `DOG_STAMINA_RECOVERY_RATE` | Save | Combat Mechanics: Dog stamina recovery rate per frame tick (defaults to 2 in $8F:81BE) |
| `$7E:0B15` | `Word` | `game_boot_signature` | `Boot` | Warm boot RAM persistence validation signature word ($00A4 initialized in $80:8D30). |
| `$7E:0B17` | `Word` | `new_game_init_flag` | `Boot` | Assertion flag set during cold start / reset sequence to trigger state clearing ($80:8D33). |
| `$7E:0B19` | 2 bytes | `WAVE_PHASE_COUNTER` | Frame | Wave phase counter incremented per frame for HDMA underwater distortion. |
| `$7E:0B1A` | `Byte` | `controller_raw_input_hi` | `Boot` | Upper 8 bits of raw controller button state (Start, Select, D-Pad). |
| `$7E:0B1B` | `Word` | `controller_prev_input` | `Boot` | Previous frame joypad button state used to calculate edge-triggered presses. |
| `$7E:0B1F` | 2 bytes | `RING_MENU_SAVED_STACK_PTR` | Frame | Saved CPU stack pointer (S register) snapshot restored on ring menu closure. |
| `$7E:0B21` | `Word` | `menu_audio_pan_divisor` | `Frame` | Stereo audio panning coordinate factor for ring menu items. |
| `$7E:0B23` | `Word` | `menu_audio_sfx_pitch` | `Frame` | Pitch divisor passed to SPC700 sound driver when ring menu rotates. |
| `$7E:0B25` | `Word` | `menu_audio_sfx_volume` | `Frame` | Volume scale factor applied to UI menu sound effects. |
| `$7E:0B29` | 2 bytes | `HUD_DIRTY_UPDATE_FLAGS` | Frame | HUD refresh latch flags (bit 0 = tilemap redraw required, bit 2 = HUD hidden). |
| `$7E:0B2A` | `Byte` | `battle_stun_timer` | `Frame` | Hit stun / stagger duration countdown ticks applied to player during attack recovery. |
| `$7E:0B2B` | 2 bytes | `DIALOGUE_TIMER` | Frame | Delay timer tracking pause duration between dialogue lines. |
| `$7E:0B2C` | `Byte` | `combat_knockback_angle` | `Frame` | Directional knockback angle index (0..255) applied on incoming heavy hits. |
| `$7E:0B2F` | 2 bytes | `ACTIVE_PLAYER_CHAR_INDEX` | Room | Index of currently player-controlled character (0 = Boy, 3 = Dog). |
| `$7E:0B31` | 2 bytes | `DIALOGUE_LINE_IDX` | Room | Active text line index inside dialogue window buffer. |
| `$7E:0B39` | 1 byte | `VALID_SAVE_SLOTS_MASK` | Boot | Battery SRAM save slots validation bitmask (bits 0..3 for slots 0..3; $80:8B6C, $8D:C905). |
| `$7E:0B3B` | 2 bytes | `ACTIVE_SAVE_SLOT` | Boot | SRAM save slot index (0..3); read from battery RAM $30:6001. |
| `$7E:0B3C` | 2 | `ACTIVE_MAP_WORD` | Room | Alternate 16-bit word storage of current room ID |
| `$7E:0B3D` | 2 bytes | `FONT_GLYPH_HEIGHT` | Boot | Height of dialogue text font glyphs in scanlines (default 8). |
| `$7E:0B3F` | 2 bytes | `FONT_LINE_STRIDE` | Boot | Byte pitch stride between raster text lines in dialogue buffer. |
| `$7E:0B41` | 2 bytes | `FONT_BUFFER_BASE` | Boot | Base address in High WRAM ($7F:A000) for 2bpp font glyph staging. |
| `$7E:0B43` | `Byte` | `dialogue_audio_beep_tick` | `Frame` | Cooldown timer ticks between successive speech typewriter sound effect triggers. |
| `$7E:0B47` | 2 bytes | `WEAPON_CHARGE_PERCENTAGE` | Room | Current physical attack charge meter level (0..100%). |
| `$7E:0B49` | 2 bytes | `WEAPON_CHARGE_LEVEL_STAGE` | Room | Attack charge stage tier (0 = Normal, 1 = Stage 1, 2 = Stage 2, 3 = Stage 3). |
| `$7E:0B4D` | 2 bytes | `BOY_STAMINA_FLASH_TIMER` | Frame | HUD stamina gauge 100% full-charge flash alert countdown timer for Boy player ($8F:8AE4). |
| `$7E:0B4D` | 2 bytes | `WEAPON_STAMINA_RECOVERY_TIMER` | Room | Cooldown timer controlling stamina gauge recharge rate after an attack. |
| `$7E:0B4F` | 2 bytes | `DOG_STAMINA_FLASH_TIMER` | Frame | HUD stamina gauge 100% full-charge flash alert countdown timer for Dog companion ($8F:8AE4). |
| `$7E:0B4F` | 2 bytes | `SCREEN_FLASH_COLOR` | Frame | 15-bit BGR color value for active screen flash overlay. |
| `$7E:0B51` | `Word` | `alchemy_cast_effect_id` | `Frame` | Formula animation effect script identifier loaded into combat VM on cast. |
| `$7E:0B57` | 2 bytes | `HUD_POPUP_QUEUE_HEAD_PTR` | Room | Pointer to active 64-byte notification slot in floating combat text ring buffer ($7E:3074..$7E:3273; stepped by func_80B37A). |
| `$7E:0B6F` | `Word` | `dialogue_scroll_timer` | `Frame` | Typewriter text scroll delay counter decremented in per-frame tick ($8C:A229). |
| `$7E:0B70` | `Byte` | `dialogue_scroll_flags` | `Frame` | Scroll flags controlling instantaneous text paging vs smooth vertical line scrolling. |
| `$7E:0B77` | `Word` | `joypad_button_hold_timer` | `Frame` | Duration in ticks current button has been held down continuously. |
| `$7E:0B78` | `Byte` | `joypad_turbo_repeat_phase` | `Frame` | Autofire repeat pulse phase counter for held button inputs. |
| `$7E:0B79` | `Word` | `joypad_edge_trigger_mask` | `Frame` | Debounced button press event mask: buttons newly asserted on this frame ($8C:C5EA). |
| `$7E:0B7B` | 2 | `AUDIO_FADE_STATE` | Frame | APU master music volume fade state enum |
| `$7E:0B7F` | 2 bytes | `AUDIO_FADE_COUNTER` | Frame | Step counter tracking audio volume fade in/out transitions. |
| `$7E:0B80` | `Byte` | `window_fade_alpha_level` | `Frame` | Transparency alpha blend coefficient for UI overlay window borders ($8E:E5BA). |
| `$7E:0B83` | 2 bytes | `AUDIO_TARGET_VOLUME` | Room | Target master audio volume level latch for fade interpolation. |
| `$7E:0BF5` | 2 bytes | `WEAPON_NEXT_LEVEL_XP_THRESHOLD` | Room | Experience points milestone required for current weapon skill to level up in Status screen ($8E:AC9B). |
| `$7E:0BF9` | 2 bytes | `RING_MENU_CURSOR_SECTOR` | Room | Latched cursor sector index during ring menu item selection ($FFFF = unlatched). |
| `$7E:0BFB` | 2 | `MODE7_CAMERA_TARGET_OFFSET_X` | Frame | Mode 7 Engine: Camera target anchor X coordinate offset for flight viewport ($8E:B33D). |
| `$7E:0BFD` | 2 | `MODE7_CAMERA_TARGET_OFFSET_Y` | Frame | Mode 7 Engine: Camera target anchor Y coordinate offset for flight viewport ($8E:B33D). |
| `$7E:0BFF` | 2 bytes | `RING_MENU_KEY_ITEMS_COUNT` | Room | Number of eligible key / story items populated into Key Items ring menu ($8E:9DF9). |
| `$7E:0C01` | 2 bytes | `RING_MENU_KEY_ITEMS_SELECTION` | Room | Currently highlighted key / story item cursor selection in Key Items Ring Menu ($8E:9DF9). |
| `$7E:0C03` | 32 bytes | `RING_MENU_KEY_ITEMS_BUF` | Room | Key Items Ring Menu: 16-word item ID slot buffer ($7E:0C03..$7E:0C22). |
| `$7E:0C23` | 2 | `RING_MENU_WEAPONS_COUNT` | Room | Number of unlocked weapons in Weapons Ring Menu |
| `$7E:0C25` | 2 | `RING_MENU_WEAPONS_SELECTION` | Room | Currently highlighted weapon cursor selection in Weapons Ring Menu |
| `$7E:0C27` | 32 bytes | `RING_MENU_WEAPONS_BUF` | Room | Weapons Ring Menu: 16-word weapon ID slot buffer ($7E:0C27..$7E:0C46). |
| `$7E:0C47` | 2 | `RING_MENU_ITEMS_COUNT` | Room | Number of available consumable items in Items Ring Menu |
| `$7E:0C49` | 2 | `RING_MENU_ITEMS_SELECTION` | Room | Currently highlighted consumable item cursor selection in Items Ring Menu |
| `$7E:0C4B` | 32 bytes | `RING_MENU_ITEMS_BUF` | Room | Consumable Items Ring Menu: 16-word item ID slot buffer ($7E:0C4B..$7E:0C6A). |
| `$7E:0C6B` | 2 | `RING_MENU_SPELLS_COUNT` | Room | Number of eligible alchemy formulas in Formulas / Spells Ring Menu |
| `$7E:0C6D` | 2 | `RING_MENU_SPELLS_SELECTION` | Room | Currently highlighted formula cursor selection in Formulas / Spells Ring Menu |
| `$7E:0C6F` | 32 bytes | `RING_MENU_SPELLS_BUF` | Room | Formulas / Spells Ring Menu: 16-word formula ID slot buffer ($7E:0C6F..$7E:0C8E). |
| `$7E:0C8F` | 2 | `RING_MENU_ALCH_FORMULA_COUNT` | Room | Total learned alchemy formulas populated into secondary ring menu |
| `$7E:0C91` | 2 | `RING_MENU_ALCH_SELECTION` | Room | Currently highlighted formula cursor selection in secondary formula ring menu |
| `$7E:0C93` | 32 bytes | `RING_MENU_ALCH_FORMULAS_BUF` | Room | Secondary Alchemy Formulas Ring Menu: 16-word formula ID slot buffer ($7E:0C93..$7E:0CB2). |
| `$7E:0CB5` | 2 | `RING_MENU_FORMULA_ACTION_COUNT` | Room | Total available formula action commands in Ring Menu formula submenu |
| `$7E:0CB7` | 2 | `RING_MENU_FORMULA_ACTION_SELECTION` | Room | Currently highlighted formula action cursor selection in formula submenu |
| `$7E:0CB9` | 8 bytes | `RING_MENU_FORMULA_ACTIONS_BUF` | Room | Alchemy Formula Action Commands Submenu: 4-word action ID buffer ($7E:0CB9..$7E:0CC0). |
| `$7E:0CD9` | 2 | `SHOP_MENU_OPTION_COUNT` | Room | Total active shopkeeper dialogue interaction options in merchant choice menu |
| `$7E:0CDB` | 2 | `SHOP_MENU_SELECTION` | Room | Currently highlighted merchant interaction option cursor index |
| `$7E:0CDD` | 16 bytes | `SHOP_MENU_OPTIONS_BUF` | Room | Merchant Dialogue Choices: 8-word interaction option ID buffer ($7E:0CDD..$7E:0CEC). |
| `$7E:0D0D` | 2 | `SAVE_PROMPT_YES_NO_SELECTION` | Room | Selected option index in Save Menu Yes/No overwrite confirmation prompt |
| `$7E:0DFB` | 24 bytes | `DIALOGUE_QUEUE` | Room | FIFO message queue buffering pending dialogue box display requests. |
| `$7E:0E44` | 2 bytes | `ACTIVE_BGM_TRACK` | Room | Currently loaded and playing background music track ID in SPC700 ($8C:828F, $8C:8328). |
| `$7E:0E47` | 2 bytes | `APU_BLOCKS_LEFT` | Frame | Remaining audio data transfer blocks during SPC700 sound loading. |
| `$7E:0E48` | 1 | `AUDIO_TRANSFER_HIGH_FLAG` | Frame | Audio Engine: High byte transfer flag for SPC700 block stream ($00 / $FF) |
| `$7E:0E49` | 2 bytes | `APU_DESC_CURSOR` | Frame | Index offset into audio sample block descriptor table. |
| `$7E:0E4B` | 1 byte | `APU_PORT0_MIRROR` | Frame | Shadow mirror of APU I/O port 0 ($2140). |
| `$7E:0E4D` | 1 byte | `APU_PORT1_MIRROR` | Frame | Shadow mirror of APU I/O port 1 ($2141). |
| `$7E:0E4D` | 2 bytes | `PENDING_BGM_TRACK_ID` | Frame | Background music track ID queued for playback pending soundbank streaming ($8C:828F). |
| `$7E:0E4F` | 1 byte | `APU_PORT2_MIRROR` | Frame | Shadow mirror of APU I/O port 2 ($2142). |
| `$7E:0E4F` | 2 bytes | `PENDING_SFX_TRACK_ID` | Frame | Sound effect ID queued for playback pending soundbank streaming ($8C:82E3). |
| `$7E:0E51` | 1 byte | `APU_PORT3_MIRROR` | Frame | Shadow mirror of APU I/O port 3 ($2143). |
| `$7E:0E51` | 2 bytes | `APU_IPC_TRANSFER_DEPTH` | Frame | Re-entrant transfer nesting depth counter for APU IPC command execution ($8C:81FD). |
| `$7E:0E52` | 1 | `AUDIO_APU_SPINLOCK_HIGH` | Frame | Audio Engine: High byte of APU spinlock word register ($7E:0E51..$7E:0E52) |
| `$7E:0E65` | 2 bytes | `APU_IPC_MUTEX_LOCK` | Frame | Queue mutex lock word guarding APU communication during streaming transfers ($8C:81FD, $8C:81D4). |
| `$7E:0E65` | 2 bytes | `ENGINE_PAUSE_COUNTER` | Boot | Pause counter decremented at boot; engine skips actor simulation if > 0. |
| `$7E:0E6B` | 1 byte | `NMITIMEN_MIRROR` | Boot | Shadow copy of $4200 ($81 = NMI enabled, Auto-Joypad enabled). |
| `$7E:0E6C` | 2 | `SHOP_MODE_CONFIG_MASK` | Frame | Shop Subsystem: Shop mode configuration bitmask (bit 2: standard weapons/armor, bit 3: alchemy ingredients satchel) |
| `$7E:0E70` | 2 bytes | `MODE7_FLIGHT_STATE` | Room | Mode 7 Windwalker vehicle flight state (0=ground, 1=takeoff, 2=cruise, 3=landing, 4=touchdown, 5=realm transit; $80:C4A3). |
| `$7E:0E72` | 2 bytes | `MODE7_FLIGHT_PITCH_ANGLE` | Room | Mode 7 flight vehicle pitch tilt angle ($80:C412). |
| `$7E:0E80` | 2 bytes | `WEAPON_CHARGE_METER` | Frame | Current physical attack charge meter level (0..100%). |
| `$7E:0E96` | 2 bytes | `ENTITY_SCHEDULER_INTERVAL_TIMER` | Room | Entity scheduler PRNG countdown interval timer ($8F:DC49). |
| `$7E:0E98` | 2 bytes | `ENTITY_SCHEDULER_INTERVAL_TARGET` | Room | Entity scheduler secondary jitter countdown timer ($8F:DC34). |
| `$7E:0EA0` | 2 bytes | `DAMAGE_RESULT_REG` | Frame | Calculated damage output value produced by combat math routines. |
| `$7E:0EAE` | 2 bytes | `PENDING_MAP_EVENT_0` | Room | Queued map event script ID pending trigger execution ($FFFF = none). |
| `$7E:0EB0` | 2 bytes | `PENDING_MAP_EVENT_1` | Room | Secondary queued map event script ID ($FFFF = none). |
| `$7E:0EB2` | 2 bytes | `DOG_CURRENT_HP` | Save | Dog companion current health points. |
| `$7E:0EB4` | 2 bytes | `WINGS_ESCAPE_SCRIPT_ID` | Room | Wings / dungeon escape event script ID ($FFFF = none; ROOM_HOOK 5). |
| `$7E:0EBC` | 2 bytes | `ENTITY_ROUND_ROBIN_CURSOR` | Room | Entity pool round-robin processing cursor pointer ($8F:DCA3). |
| `$7E:0EBE` | 2 bytes | `SPAWN_RING_HEAD_PTR` | Room | Active scan cursor into 60-slot spawn ring table at $7E:5DC3..$7E:6182 (advanced by 16 bytes in func_8FDDBB). |
| `$7E:0EC0` | 32 bytes | `DEFERRED_SPAWN_BUF` | Room | Buffer storing entity spawn parameters queued during map transitions. |
| `$7E:0EC6` | 2 bytes | `INPUT_P1_HELD_BUTTONS` | Frame | Player 1 controller buttons currently held down (raw auto-joypad read from hardware register $4218). |
| `$7E:0F36` | 2 bytes | `STEP_DITHER_COUNTER` | Frame | Sub-pixel walk step dither accumulator for smooth actor movement. |
| `$7E:0F38` | 2 bytes | `CAMERA_SUBPIXEL_ACC` | Frame | Camera sub-pixel tracking fractional accumulator. |
| `$7E:0F3A` | 1 byte | `VRAM_DMA_LOCK` | Frame | In-flight active transfer counter / lock flag for deferred VRAM DMA queue. |
| `$7E:0F3C` | 1 byte | `CGRAM_DMA_LOCK` | Frame | In-flight active transfer counter / lock flag for deferred CGRAM DMA queue. |
| `$7E:0F3E` | 1 byte | `HUD_DRAW_SUPPRESSION_LOCK` | Frame | In-flight lock counter suppressing HUD tilemap rendering when non-zero. |
| `$7E:0F40` | 2 | `ENTITY_PTR_DOG` | Boot | Entity Subsystem: Address pointer to Companion (Dog) entity slot in WRAM (defaults to $4F37; initialized in $8F:8144) |
| `$7E:0F42` | 2 bytes | `CAMERA_TARGET_ACTOR_PTR` | Room | Pointer to primary actor entity record tracked by camera (points to Boy at $7E:4E89). |
| `$7E:0F44` | 2 bytes | `VIEWPORT_SCROLL_Y` | Frame | Vertical world coordinate of top-left camera viewport boundary. |
| `$7E:0F48` | 2 bytes | `VIEWPORT_CULL_MIN_X` | Frame | Camera viewport frustum left bound for 2D entity and shadow culling ($90:9545). |
| `$7E:0F4A` | 2 bytes | `VIEWPORT_CULL_MIN_Y` | Frame | Camera viewport frustum top bound for 2D entity and shadow culling ($90:9545). |
| `$7E:0F4C` | 2 bytes | `VIEWPORT_CULL_MAX_X` | Frame | Camera viewport frustum right bound for 2D entity and shadow culling ($90:9545). |
| `$7E:0F4E` | 2 bytes | `VIEWPORT_CULL_MAX_Y` | Frame | Camera viewport frustum bottom bound for 2D entity and shadow culling ($90:9545). |
| `$7E:0F84` | 2 bytes | `MAP_HEADER_FLAGS` | Room | Bitmask flags loaded from map header (layering, Mode 7, weather). |
| `$7E:0F86` | 2 bytes | `ROOM_TRIGGER_ORIGIN_X` | Room | Room step-on trigger origin X offset in 16px metatile cells ($8F:ACB1). |
| `$7E:0F88` | 2 bytes | `ROOM_TRIGGER_ORIGIN_Y` | Room | Room step-on trigger origin Y offset in 16px metatile cells ($8F:ACB1). |
| `$7E:0F8A` | 2 bytes | `LOADED_PALETTE_TAG` | Room | Identifier of currently loaded map palette family. |
| `$7E:0F8C` | 2 bytes | `MINIMAP_RADAR_WINDOW_TOP` | Room | Minimap radar viewport top vertical clipping bound ($90:A4EC). |
| `$7E:0F8E` | 2 bytes | `MINIMAP_RADAR_WINDOW_BOTTOM` | Room | Minimap radar viewport bottom vertical clipping bound ($90:A4EC). |
| `$7E:0F90` | 2 bytes | `MINIMAP_RADAR_WINDOW_LEFT` | Room | Minimap radar viewport left horizontal clipping bound ($90:A4EC). |
| `$7E:0F92` | 2 bytes | `MINIMAP_RADAR_WINDOW_RIGHT` | Room | Minimap radar viewport right horizontal clipping bound ($90:A4EC). |
| `$7E:0FAC` | 2 bytes | `ROOM_PALETTE_GROUP_ID` | Room | Active room palette group index (initialized to $11 by reset_per_room_state). |
| `$7E:0FB0` | 1 byte | `TERRAIN_MUT_ACTIVE` | Frame | Set non-zero when animated terrain tile mutations are active. |
| `$7E:0FB4` | 12 bytes | `CELL_COLLISION_FLAGS` | Room | Current 16x16 metatile cell collision properties and impassable edges. |
| `$7E:0FB6` | 2 bytes | `MINIMAP_SCREEN_DEST_OFFSET` | Frame | Screen tile buffer byte offset for minimap metatile rasterization ($90:A5D0). |
| `$7E:0FB8` | 2 bytes | `MINIMAP_TARGET_CELL_X` | Frame | Candidate cell X coordinate evaluated during minimap rasterization ($90:A5D0). |
| `$7E:0FB9` | 2 bytes | `ENV_SFX_TRIGGER` | Room | Sound effect ID trigger for environmental audio (wind, waterfall, lava). |
| `$7E:0FBA` | 2 bytes | `MINIMAP_TARGET_CELL_Y` | Frame | Candidate cell Y coordinate evaluated during minimap rasterization ($90:A5D0). |
| `$7E:0FBD` | 2 bytes | `ENV_SHAKE_TRIGGER` | Room | Magnitude trigger for environmental ground tremor effects. |
| `$7E:0FBE` | 2 bytes | `MINIMAP_TARGET_RIGHT_EDGE` | Frame | Candidate cell right edge bound for minimap clipping ($90:A5D0). |
| `$7E:0FBF` | 2 bytes | `ENV_AUDIO_PARAM` | Room | Secondary audio parameter (pitch/pan) for environmental audio. |
| `$7E:0FC0` | 2 bytes | `MINIMAP_TARGET_BOTTOM_EDGE` | Frame | Candidate cell bottom edge bound for minimap clipping ($90:A5D0). |
| `$7E:0FC2` | 2 bytes | `MINIMAP_VRAM_DMA_TRIGGER` | Frame | Flag set when dynamic minimap updates are ready to stream to VRAM via DMA ($90:A5D0). |
| `$7E:0FC6` | 2 bytes | `MINIMAP_POI_TYPE_INDEX` | Frame | Point of Interest type descriptor index during radar blip scanning ($90:A650). |
| `$7E:0FC8` | 2 bytes | `MINIMAP_METATILE_PROP_THRESH` | Room | Metatile transparency property threshold key for radar clipping ($90:A4EC). |
| `$7E:0FCA` | 2 bytes | `MINIMAP_POI_SCAN_OFFSET` | Frame | Scan offset into ROM POI table in bank $90 ($90:A650). |
| `$7E:0FCC` | 2 bytes | `MINIMAP_POI_OFFSET_X` | Room | World X translation offset applied to POI radar blip coordinates ($90:A650). |
| `$7E:0FCE` | 2 bytes | `MINIMAP_POI_OFFSET_Y` | Room | World Y translation offset applied to POI radar blip coordinates ($90:A650). |
| `$7E:0FD0` | 2 bytes | `GRASS_BATCH_CURSOR` | Room | Cursor index into pending cuttable grass tile swap queue. |
| `$7E:0FD2` | 48 bytes | `GRASS_SWAP_QUEUE` | Room | Coordinate swap queue holding tiles converted from standing to cut grass. |
| `$7E:1002` | 48 bytes | `GRASS_GRID_OFFSETS` | Room | Tilemap offset lookup table corresponding to pending grass swaps. |
| `$7E:1002` | 8 bytes | `MINIMAP_POI_BUFFER_OFFSETS` | Frame | Tilemap buffer byte offsets for 4 active dynamic POI radar blips ($90:A6B4). |
| `$7E:1032` | 48 bytes | `GRASS_PACKED_COORDS` | Room | Packed world coordinates (X, Y) for cut grass tile locations. |
| `$7E:1032` | 8 bytes | `MINIMAP_POI_PACKED_COORDS` | Frame | Packed coordinates (X | (Y << 8)) for 4 active dynamic POI radar blips ($90:A6B4). |
| `$7E:1067` | 2 bytes | `ROOM_STEP_TRIGGER_COUNT` | Room | Number of active step-on coordinate triggers loaded for current room ($8F:ACB1). |
| `$7E:1069` | 3 bytes | `ROOM_STEP_TRIGGER_TABLE_PTR` | Room | 24-bit far pointer to active room step-on trigger bounding boxes ($8F:ACB1). |
| `$7E:106C` | 2 bytes | `ACTIVE_ANIM_CHANNELS` | Room | Count of actively cycling animated tile channels on current map. |
| `$7E:106E` | 2 bytes | `ANIM_TILE_VRAM_BASE` | Room | Destination base address in VRAM where animated tiles are DMA-streamed. |
| `$7E:1070` | 2 bytes | `ENTITY_BATCH_TARGET_CAPACITY` | Room | Active entity processing target capacity ($8F:DC8A). |
| `$7E:1072` | 2 bytes | `ROOM_SPAWNED_ENTITY_COUNT` | Room | Current count of spawned active entities in room ($8F:B0A5). |
| `$7E:1074` | 2 bytes | `ROOM_CUMULATIVE_SPAWN_COUNT` | Room | Cumulative entity spawn counter for active room visit ($8F:B0A8). |
| `$7E:1076` | 2 bytes | `ENTITY_BATCH_PROCESS_LIMIT` | Room | Dynamic entity execution batch slice limit (1..6 entities/frame) ($8F:DC6A). |
| `$7E:1078` | 2 bytes | `ENTITY_SCHEDULER_FRAME_LATCH` | Frame | Entity scheduler frame counter snapshot latch ($8F:DC53). |
| `$7E:107A` | 2 bytes | `ENTITY_SCHEDULER_LAG_COUNTER` | Frame | Entity scheduler consecutive frame drop counter ($8F:DC73). |
| `$7E:107C` | 2 bytes | `ENTITY_SCHEDULER_STABILITY_TIMER` | Frame | Entity scheduler uninterrupted framerate stability timer ($8F:DC5E). |
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
| `$7E:1299` | `Byte×7` | `cgram_queue_slot_1` | `Frame` | Partial CGRAM DMA slot 1 descriptor (7 bytes: src offset, bank, CGRAM dest, count). |
| `$7E:12A0` | `Byte×7` | `cgram_queue_slot_2` | `Frame` | Partial CGRAM DMA slot 2 descriptor (7 bytes: src offset, bank, CGRAM dest, count). |
| `$7E:12A7` | `Byte×7` | `cgram_queue_slot_3` | `Frame` | Partial CGRAM DMA slot 3 descriptor (7 bytes: src offset, bank, CGRAM dest, count). |
| `$7E:12AE` | `Byte×7` | `cgram_queue_slot_4` | `Frame` | Partial CGRAM DMA slot 4 descriptor (7 bytes: src offset, bank, CGRAM dest, count). |
| `$7E:12B5` | `Byte×7` | `cgram_queue_slot_5` | `Frame` | Partial CGRAM DMA slot 5 descriptor (7 bytes: src offset, bank, CGRAM dest, count). |
| `$7E:12BC` | `Byte×7` | `cgram_queue_slot_6` | `Frame` | Partial CGRAM DMA slot 6 descriptor (7 bytes: src offset, bank, CGRAM dest, count). |
| `$7E:12C3` | `Byte×7` | `cgram_queue_slot_7` | `Frame` | Partial CGRAM DMA slot 7 descriptor (7 bytes: src offset, bank, CGRAM dest, count). |
| `$7E:12CA` | `Byte×7` | `cgram_queue_slot_8` | `Frame` | Partial CGRAM DMA slot 8 descriptor (7 bytes: src offset, bank, CGRAM dest, count). |
| `$7E:12D1` | `Byte×7` | `cgram_queue_slot_9` | `Frame` | Partial CGRAM DMA slot 9 descriptor (7 bytes: src offset, bank, CGRAM dest, count). |
| `$7E:12D8` | `Byte×7` | `cgram_queue_slot_10` | `Frame` | Partial CGRAM DMA slot 10 descriptor (7 bytes: src offset, bank, CGRAM dest, count). |
| `$7E:12DF` | `Byte×7` | `cgram_queue_slot_11` | `Frame` | Partial CGRAM DMA slot 11 descriptor (7 bytes: src offset, bank, CGRAM dest, count). |
| `$7E:12E6` | `Byte×7` | `cgram_queue_slot_12` | `Frame` | Partial CGRAM DMA slot 12 descriptor (7 bytes: src offset, bank, CGRAM dest, count). |
| `$7E:12ED` | `Byte×7` | `cgram_queue_slot_13` | `Frame` | Partial CGRAM DMA slot 13 descriptor (7 bytes: src offset, bank, CGRAM dest, count). |
| `$7E:12F4` | `Byte×7` | `cgram_queue_slot_14` | `Frame` | Partial CGRAM DMA slot 14 descriptor (7 bytes: src offset, bank, CGRAM dest, count). |
| `$7E:12FB` | `Byte×7` | `cgram_queue_slot_15` | `Frame` | Partial CGRAM DMA slot 15 descriptor (7 bytes: src offset, bank, CGRAM dest, count). |
| `$7E:1302` | `Byte×7` | `cgram_queue_slot_16` | `Frame` | Partial CGRAM DMA slot 16 descriptor (7 bytes: src offset, bank, CGRAM dest, count). |
| `$7E:1309` | `Byte×7` | `cgram_queue_slot_17` | `Frame` | Partial CGRAM DMA slot 17 descriptor (7 bytes: src offset, bank, CGRAM dest, count). |
| `$7E:1310` | `Byte×7` | `cgram_queue_slot_18` | `Frame` | Partial CGRAM DMA slot 18 descriptor (7 bytes: src offset, bank, CGRAM dest, count). |
| `$7E:1317` | `Byte×7` | `cgram_queue_slot_19` | `Frame` | Partial CGRAM DMA slot 19 descriptor (7 bytes: src offset, bank, CGRAM dest, count). |
| `$7E:131E` | `Byte×7` | `cgram_queue_slot_20` | `Frame` | Partial CGRAM DMA slot 20 descriptor (7 bytes: src offset, bank, CGRAM dest, count). |
| `$7E:1325` | `Byte×7` | `cgram_queue_slot_21` | `Frame` | Partial CGRAM DMA slot 21 descriptor (7 bytes: src offset, bank, CGRAM dest, count). |
| `$7E:132C` | `Byte×7` | `cgram_queue_slot_22` | `Frame` | Partial CGRAM DMA slot 22 descriptor (7 bytes: src offset, bank, CGRAM dest, count). |
| `$7E:1333` | `Byte×7` | `cgram_queue_slot_23` | `Frame` | Partial CGRAM DMA slot 23 descriptor (7 bytes: src offset, bank, CGRAM dest, count). |
| `$7E:133A` | `Byte×7` | `cgram_queue_slot_24` | `Frame` | Partial CGRAM DMA slot 24 descriptor (7 bytes: src offset, bank, CGRAM dest, count). |
| `$7E:1341` | `Byte×7` | `cgram_queue_slot_25` | `Frame` | Partial CGRAM DMA slot 25 descriptor (7 bytes: src offset, bank, CGRAM dest, count). |
| `$7E:1348` | `Byte×7` | `cgram_queue_slot_26` | `Frame` | Partial CGRAM DMA slot 26 descriptor (7 bytes: src offset, bank, CGRAM dest, count). |
| `$7E:134F` | `Byte×7` | `cgram_queue_slot_27` | `Frame` | Partial CGRAM DMA slot 27 descriptor (7 bytes: src offset, bank, CGRAM dest, count). |
| `$7E:1356` | `Byte×7` | `cgram_queue_slot_28` | `Frame` | Partial CGRAM DMA slot 28 descriptor (7 bytes: src offset, bank, CGRAM dest, count). |
| `$7E:135D` | `Byte×7` | `cgram_queue_slot_29` | `Frame` | Partial CGRAM DMA slot 29 descriptor (7 bytes: src offset, bank, CGRAM dest, count). |
| `$7E:1364` | `Byte×7` | `cgram_queue_slot_30` | `Frame` | Partial CGRAM DMA slot 30 descriptor (7 bytes: src offset, bank, CGRAM dest, count). |
| `$7E:136B` | `Byte×7` | `cgram_queue_slot_31` | `Frame` | Partial CGRAM DMA slot 31 descriptor (7 bytes: src offset, bank, CGRAM dest, count). |
| `$7E:1372` | 32 bytes | `PALETTE_ANIM_COLOR_INDEX` | Room | Destination CGRAM color indices for 32 dynamic palette color animation channels ($90:D5CF). |
| `$7E:1392` | 32 bytes | `PALETTE_ANIM_INTERP_A` | Room | Primary color interpolation step counters for 32 dynamic palette channels ($90:D59E). |
| `$7E:13B2` | 32 bytes | `PALETTE_ANIM_INTERP_B` | Room | Secondary color interpolation step limits for 32 dynamic palette channels ($90:D5A1). |
| `$7E:13D2` | 32 bytes | `PALETTE_ANIM_RATE` | Room | Speed rate and step direction flags (bit 7) for 32 dynamic palette channels ($90:D596). |
| `$7E:13F2` | 32 bytes | `PALETTE_ANIM_FRAME_TIMER` | Frame | Per-channel frame countdown timers for 32 dynamic palette channels ($90:D58E). |
| `$7E:1432` | 2 bytes | `ANIM_FRAME_HOLD_TIMER` | Frame | Remaining frame duration before advancing to next animated tile phase. |
| `$7E:1434` | 2 bytes | `PENDING_TALK_TARGET_PTR` | Room | Pointer to NPC actor entity currently being spoken to or interacted with ($FFFF = none). |
| `$7E:1436` | 2 bytes | `DISPATCH_MUTEX_LOCK` | Room | Event and script callback queue re-entrancy mutex lock ($8C:CFFD). |
| `$7E:1438` | 2 bytes | `OAM_HIGH_WATER_MARK` | Frame | Previous frame low OAM buffer byte cursor used for stale sprite hiding with $E0E0 ($80:8FF6). |
| `$7E:143A` | 2 bytes | `CAMERA_SECONDARY_ACTOR_PTR` | Room | Pointer to secondary actor entity considered for camera framing (Dog at $7E:4F37). |
| `$7E:143C` | 2 bytes | `PLAYER_DAMAGE_REACTION_ACTOR` | Frame | Pointer to player actor entity receiving damage or status reactions ($90:8554, $80:8D49). |
| `$7E:143E` | 1 | `DOG_SPRITE_ANIM_RECORD` | Room | Companion Mechanics: Low byte of current Dog sprite animation record offset ($8F:9471). |
| `$7E:143F` | 1 | `DOG_SPRITE_ANIM_BANK` | Room | Companion Mechanics: High byte / ROM bank of current Dog sprite animation record. |
| `$7E:1443` | 2 | `DOG_FORM_ANIM_9` | Room | Companion Mechanics: the form's animation record slot 9 ($8F:9471 copies entry +$1C-+$26 to $1443-$144D; sprites/dog-forms.ts). Not the HUD portrait: that sprite goes to $4FA5 (rom/8f9471.md, v0.377.0). |
| `$7E:1445` | 2 | `DOG_FORM_ANIM_10` | Room | Companion Mechanics: the form's animation record slot 10 ($8F:9471). |
| `$7E:1447` | `Word` | `dog_form_base_magic_def` | `Save` | Active dog breed base magic defense stat ($8F:94F0). |
| `$7E:1449` | `Word` | `dog_form_base_evade` | `Save` | Active dog breed base evasion percentage stat ($8F:94F7). |
| `$7E:144B` | `Word` | `dog_form_base_hit_rate` | `Save` | Active dog breed base accuracy / hit rate stat ($8F:94FE). |
| `$7E:144D` | `Word` | `dog_form_scent_radius` | `Save` | Active dog breed ingredient sniffing radius / detection range in pixels ($8F:9505). |
| `$7E:1459` | `Word` | `dog_ai_target_distance` | `Frame` | Euclidean distance word between Dog companion and active combat target ($8F:DCD0). |
| `$7E:1460` | `Word` | `dog_sniff_target_x` | `Frame` | World X coordinate of hidden ingredient / sniff spot currently alerted by Dog ($8F:822A). |
| `$7E:1462` | `Word` | `dog_sniff_target_y` | `Frame` | World Y coordinate of hidden ingredient / sniff spot currently alerted by Dog ($8F:8231). |
| `$7E:14B8` | 2 bytes | `MODE7_CAMERA_PITCH_ALTITUDE` | Frame | Camera elevation pitch and altitude parameter during Mode 7 flight navigation ($80:D23A). |
| `$7E:14C2` | 2 bytes | `MODE7_PARAM_M7A_OR_SCROLL_X` | Frame | Horizontal scroll coordinate / PPU matrix M7A parameter for Mode 7 flight rendering ($80:BE09). |
| `$7E:14C4` | 2 bytes | `MODE7_PARAM_M7B_OR_SCROLL_Y` | Frame | Vertical scroll coordinate / PPU matrix M7B parameter for Mode 7 flight rendering ($80:BE09). |
| `$7E:14C6` | 2 bytes | `MODE7_AIRCRAFT_YAW_HEADING` | Frame | Mode 7 aircraft flight yaw heading angle index (0..31 compass angle; $80:CFA9, $80:D58B). |
| `$7E:14C8` | 2 bytes | `MODE7_CAMERA_FOCAL_DISTANCE` | Frame | Mode 7 camera focal distance and altitude scaling factor added to ROM trig tables ($80:CFA9, $80:D113). |
| `$7E:14E6` | 2 bytes | `WEATHER_CAMERA_PREV_X` | Frame | Previous horizontal camera scroll baseline coordinate for weather particle relative motion ($91:BE05). |
| `$7E:14E8` | 2 bytes | `WEATHER_CAMERA_CURR_X` | Frame | Current horizontal camera scroll baseline coordinate for weather particle relative motion ($91:BE05). |
| `$7E:14EA` | 1 | `WEATHER_PARTICLE_PREV_Y` | Frame | Weather particle simulation previous Y baseline coordinate |
| `$7E:14EC` | 1 | `WEATHER_PARTICLE_CURR_Y` | Frame | Weather particle simulation current Y baseline coordinate |
| `$7E:14EE` | 2 | `WEATHER_PARTICLE_SLOT_INDEX` | Frame | Active weather particle slot pointer offset |
| `$7E:14FE` | 2 bytes | `WEATHER_PARTICLE_SPAWN_CURSOR` | Frame | Cyclic write cursor into 256-byte weather particle simulation state buffer ($91:C15B, wraps at $0100). |
| `$7E:150C` | 2 bytes | `COLOR_CROSSFADE_ACTIVE_FLAG` | Room | Color palette cross-fade animation active execution flag ($90:D481). |
| `$7E:150E` | 2 bytes | `COLOR_CROSSFADE_CURRENT_STEP` | Room | Palette cross-fade progress counter ($90:D481). |
| `$7E:1510` | 2 bytes | `COLOR_CROSSFADE_TARGET_STEP` | Room | Palette cross-fade target threshold step ($90:D481). |
| `$7E:1512` | 2 bytes | `COLOR_CROSSFADE_STEP_RATE` | Room | Palette cross-fade step increment / speed rate ($90:D481). |
| `$7E:1518` | 2 bytes | `HDMA_ACTIVE_BANK_PTR` | Frame | Pointer to active double-buffer table feeding HDMA channel tables. |
| `$7E:151A` | 36 bytes | `HDMA_BUFFER_A` | Frame | HDMA scanline table double-buffer Bank A (color gradients / perspective lines). |
| `$7E:153E` | 36 bytes | `HDMA_BUFFER_B` | Frame | HDMA scanline table double-buffer Bank B (color gradients / perspective lines). |
| `$7E:156A` | 2 bytes | `BARRIER_WINDOW_CENTER_X` | Frame | Force field barrier circular spotlight window center screen X coordinate ($91:C773). |
| `$7E:156C` | 2 bytes | `BARRIER_SCANLINE_OFFSET` | Frame | Barrier and spotlight window scanline offset accumulator ($91:C899). |
| `$7E:157C` | 2 bytes | `BARRIER_WINDOW_MODE` | Frame | Barrier spotlight window aperture shape mode (0 = circular, 1 = inverted; $91:C7F5). |
| `$7E:157E` | 2 bytes | `BARRIER_WINDOW_EXPANSION_RATE` | Frame | Force field barrier circular window radial expansion step delta ($91:C788). |
| `$7E:158A` | 2 bytes | `PPU_WINDOW_LOGIC_FLAG` | Frame | PPU window mask logic toggle flag (written to $0122..$0124; $91:C7F5). |
| `$7E:158C` | 2 bytes | `HDMA_WINDOW_BUFFER_XOR_MASK` | Frame | Toggle XOR mask ($6869 ^ $6A7D = $0214) for double-buffered window coordinates ($91:C7F5). |
| `$7E:158E` | 2 bytes | `HDMA_WINDOW_ACTIVE_BUFFER_PTR` | Frame | Active double-buffer base pointer for HDMA window coordinates ($7E:6869 or $7E:6A7D; $91:C899). |
| `$7E:1590` | 2 bytes | `HDMA_WINDOW_ACTIVE_BUFFER_END` | Frame | Active window coordinate buffer end boundary pointer ($158E + $0200; $91:C899). |
| `$7E:15CC` | 2 bytes | `DYNAMIC_COLLISION_OVERRIDE_COUNT` | Room | Number of active dynamic collision grid metatile overrides in current room. |
| `$7E:15D2` | 1 byte | `AUDIO_MUTING_FLAG` | Room | Set non-zero to silence background music during dramatic cutscenes. |
| `$7E:15D6` | 1 byte | `APU_COMM_STATUS` | Frame | Handshake status register for SPC700 data transfer synchronization. |
| `$7E:15D8` | 2 | `BG_TILEMAP_DMA_DEST_1` | Frame | PPU Subsystem: VRAM destination word address 1 for BG tilemap row/col DMA transfer ($80:829C) |
| `$7E:15DA` | 2 | `BG_TILEMAP_DMA_DEST_2` | Frame | PPU Subsystem: VRAM destination word address 2 for BG tilemap row/col DMA transfer |
| `$7E:15DC` | 2 | `BG_TILEMAP_DMA_DEST_3` | Frame | PPU Subsystem: VRAM destination word address 3 for BG tilemap row/col DMA transfer |
| `$7E:15DE` | 2 | `BG_TILEMAP_DMA_DEST_4` | Frame | PPU Subsystem: VRAM destination word address 4 for BG tilemap row/col DMA transfer |
| `$7E:15E0` | 2 | `BG_TILEMAP_DMA_DEST_5` | Frame | PPU Subsystem: VRAM destination word address 5 for BG tilemap row/col DMA transfer |
| `$7E:15E2` | 2 | `BG_TILEMAP_DMA_DEST_6` | Frame | PPU Subsystem: VRAM destination word address 6 for BG tilemap row/col DMA transfer |
| `$7E:15E4` | 2 | `BG_TILEMAP_DMA_DEST_7` | Frame | PPU Subsystem: VRAM destination word address 7 for BG tilemap row/col DMA transfer |
| `$7E:15E6` | 2 | `BG_TILEMAP_DMA_DEST_8` | Frame | PPU Subsystem: VRAM destination word address 8 for BG tilemap row/col DMA transfer |
| `$7E:15E8` | 2 | `BG_TILEMAP_DMA_DEST_9` | Frame | PPU Subsystem: VRAM destination word address 9 for BG tilemap row/col DMA transfer |
| `$7E:15EA` | 2 | `BG_TILEMAP_DMA_DEST_10` | Frame | PPU Subsystem: VRAM destination word address 10 for BG tilemap row/col DMA transfer |
| `$7E:15EC` | 2 | `BG_TILEMAP_DMA_DEST_11` | Frame | PPU Subsystem: VRAM destination word address 11 for BG tilemap row/col DMA transfer |
| `$7E:15EE` | 2 | `BG_TILEMAP_DMA_DEST_12` | Frame | PPU Subsystem: VRAM destination word address 12 for BG tilemap row/col DMA transfer |
| `$7E:15F0` | 2 | `BG_TILEMAP_DMA_DEST_13` | Frame | PPU Subsystem: VRAM destination word address 13 for BG tilemap row/col DMA transfer |
| `$7E:15F2` | 2 | `BG_TILEMAP_DMA_DEST_14` | Frame | PPU Subsystem: VRAM destination word address 14 for BG tilemap row/col DMA transfer |
| `$7E:15F4` | 2 | `BG_TILEMAP_DMA_DEST_15` | Frame | PPU Subsystem: VRAM destination word address 15 for BG tilemap row/col DMA transfer |
| `$7E:15F6` | 2 | `BG_TILEMAP_DMA_DEST_16` | Frame | PPU Subsystem: VRAM destination word address 16 for BG tilemap row/col DMA transfer |
| `$7E:15F8` | 2 | `BG_TILEMAP_DMA_DEST_17` | Frame | PPU Subsystem: VRAM destination word address 17 for BG tilemap row/col DMA transfer |
| `$7E:163C` | 64 bytes | `VRAM_TILE_DMA_QUEUE` | Frame | Deferred VRAM tile pattern DMA upload request queue; processed during VBlank. |
| `$7E:163E` | 2 | `BG_SEAM_DMA_DEST_1` | Frame | PPU Subsystem: VRAM destination word address 1 for BG metatile seam DMA transfer ($80:82E4) |
| `$7E:1640` | 2 | `BG_SEAM_DMA_DEST_2` | Frame | PPU Subsystem: VRAM destination word address 2 for BG metatile seam DMA transfer |
| `$7E:1642` | 2 | `BG_SEAM_DMA_DEST_3` | Frame | PPU Subsystem: VRAM destination word address 3 for BG metatile seam DMA transfer |
| `$7E:1644` | `Word` | `sprite_vram_dest_slot_2` | `Frame` | Dynamic sprite VRAM slot 2 destination word address ($80:82D6). |
| `$7E:1646` | `Word` | `sprite_vram_dest_slot_3` | `Frame` | Dynamic sprite VRAM slot 3 destination word address ($80:82D6). |
| `$7E:1648` | `Word` | `sprite_vram_dest_slot_4` | `Frame` | Dynamic sprite VRAM slot 4 destination word address ($80:9734). |
| `$7E:164A` | `Word` | `sprite_vram_dest_slot_5` | `Frame` | Dynamic sprite VRAM slot 5 destination word address ($80:9734). |
| `$7E:164C` | `Word` | `sprite_vram_dest_slot_6` | `Frame` | Dynamic sprite VRAM slot 6 destination word address ($80:82D6). |
| `$7E:164E` | `Word` | `sprite_vram_dest_slot_7` | `Frame` | Dynamic sprite VRAM slot 7 destination word address ($80:9734). |
| `$7E:1650` | `Word` | `sprite_vram_dest_slot_8` | `Frame` | Dynamic sprite VRAM slot 8 destination word address ($80:9734). |
| `$7E:1652` | `Word` | `sprite_vram_dest_slot_9` | `Frame` | Dynamic sprite VRAM slot 9 destination word address ($80:9734). |
| `$7E:1654` | `Word` | `sprite_vram_dest_slot_10` | `Frame` | Dynamic sprite VRAM slot 10 destination word address ($80:9734). |
| `$7E:1656` | `Word` | `sprite_vram_dest_slot_11` | `Frame` | Dynamic sprite VRAM slot 11 destination word address ($80:9734). |
| `$7E:1658` | `Word` | `sprite_vram_dest_slot_12` | `Frame` | Dynamic sprite VRAM slot 12 destination word address ($80:901B). |
| `$7E:2000` | `Byte` | `audio_chan_vol_atten_0` | `Save` | Audio channel 0 master volume attenuation factor ($0F..$FF initialized by $8C:9DEE). |
| `$7E:2001` | `Byte` | `audio_chan_vol_atten_1` | `Save` | Audio channel 1 master volume attenuation factor ($1F..$FF). |
| `$7E:2002` | `Byte` | `audio_chan_vol_atten_2` | `Save` | Audio channel 2 master volume attenuation factor ($2F..$FF). |
| `$7E:2003` | `Byte` | `audio_chan_vol_atten_3` | `Save` | Audio channel 3 master volume attenuation factor ($3F..$FF). |
| `$7E:2004` | `Byte` | `audio_chan_vol_atten_4` | `Save` | Audio channel 4 master volume attenuation factor ($4F..$FF). |
| `$7E:2005` | `Byte` | `audio_chan_vol_atten_5` | `Save` | Audio channel 5 master volume attenuation factor ($5F..$FF). |
| `$7E:2006` | `Byte` | `audio_chan_vol_atten_6` | `Save` | Audio channel 6 master volume attenuation factor ($6F..$FF). |
| `$7E:2007` | `Byte` | `audio_chan_vol_atten_7` | `Save` | Audio channel 7 master volume attenuation factor ($7F..$FF). |
| `$7E:2008` | `Byte` | `audio_chan_vol_atten_8` | `Save` | Audio channel 8 master volume attenuation factor ($8F..$FF). |
| `$7E:2009` | `Byte` | `audio_chan_vol_atten_9` | `Save` | Audio channel 9 master volume attenuation factor ($9F..$FF). |
| `$7E:200A` | `Byte` | `audio_chan_vol_atten_a` | `Save` | Audio channel 10 master volume attenuation factor ($AF..$FF). |
| `$7E:200B` | `Byte` | `audio_chan_vol_atten_b` | `Save` | Audio channel 11 master volume attenuation factor ($BF..$FF). |
| `$7E:200C` | `Byte` | `audio_chan_vol_atten_c` | `Save` | Audio channel 12 master volume attenuation factor ($CF..$FF). |
| `$7E:200D` | `Byte` | `audio_chan_vol_atten_d` | `Save` | Audio channel 13 master volume attenuation factor ($DF..$FF). |
| `$7E:200E` | `Byte` | `audio_chan_vol_atten_e` | `Save` | Audio channel 14 master volume attenuation factor ($EF..$FF). |
| `$7E:200F` | `Byte` | `audio_chan_vol_atten_f` | `Save` | Audio channel 15 master volume attenuation factor ($FF). |
| `$7E:2050` | 64 bytes | `MODE7_TRANSFORM_MATRIX_WORDS` | Frame | 32-entry perspective transformation scanline matrix table ($80:CFA9, $80:D113). |
| `$7E:2090` | 32 bytes | `MODE7_PERSPECTIVE_SCALE_BYTES` | Frame | 32-entry perspective scaling factors table loaded from ROM bank $90 ($80:D113). |
| `$7E:2110` | 256 bytes | `WEATHER_PARTICLE_BUFFER` | Frame | 64-entry cyclic state array for weather particle trajectories (4 bytes per particle; $91:C15B, $91:BE05). |
| `$7E:2200` | 2 bytes | `SRAM_START_MARKER` | Save | Boundary marking start of battery-backed persistent save RAM ($7E:2200..$7E:27FF). |
| `$7E:2210` | 36 bytes | `BOY_NAME_BUFFER` | Save | Custom player character name string buffer (ASCII/tile indices). |
| `$7E:2234` | 36 bytes | `DOG_NAME_BUFFER` | Save | Custom dog companion name string buffer (ASCII/tile indices). |
| `$7E:2258` | 424 bytes | `STORY_FLAGS_ARRAY` | Save | Master bit-packed array of persistent world progression, boss, and chest flags. |
| `$7E:2259` | 1 | `ALCHEMY_KNOWN_FLAGS_1` | Save | Alchemy Subsystem: Formula learned bitmask byte 1 (bits 0..7: Double Drain, Drain, Energize, Escape, Explosion, Fireball, Fire Power, Flash) |
| `$7E:225A` | 1 | `ALCHEMY_KNOWN_FLAGS_2` | Save | Alchemy Subsystem: Formula learned bitmask byte 2 (bits 0..7: Force Field, Hard Ball, Heal, Lance, Laser, Levitate, Lightning Storm, Miracle Cure) |
| `$7E:225B` | 1 | `ALCHEMY_KNOWN_FLAGS_3` | Save | Alchemy Subsystem: Formula learned bitmask byte 3 (bits 0..7: Nitro, One Up, Reflect, Regrowth, Revealer, Revive, Slow Burn, Speed) |
| `$7E:225C` | 1 | `ALCHEMY_KNOWN_FLAGS_4` | Save | Alchemy Subsystem: Formula learned bitmask byte 4 (bits 0..2: Sting, Stop, Super Heal) |
| `$7E:225D` | 1 byte | `SHOP_MENU_OPTION_FLAGS` | Save | Shopkeeper interaction menu option enable flags (bit 0 = trade/rare $F4, bit 1 = talk/exit $F6; $8E:8D05). |
| `$7E:2260` | 1 byte | `BOSS_FLAGS_1` | Save | Boss defeat bitmask flags (bit 0x10 = Thraxx defeated). |
| `$7E:2261` | 3 bytes | `CHARM_FLAGS` | Save | Passive charms, relics, and trade goods owned bitfield ($7E:2261..$7E:2263: Chocobo Egg, Silver Sheath, Moxa Stick, Wizard's Coin; $8F:857D). |
| `$7E:2264` | 1 | `EQUIPMENT_OWNED_FLAGS_3` | Save | Inventory Subsystem: Equipment owned bitmask byte 3 (bits 0,1,2,3,4,5: Item IDs 14..19). |
| `$7E:2269` | 1 | `PERSISTENT_ROOM_EVENT_FLAGS_2269` | Save | Persistent room-event flags (partially identified) |
| `$7E:226A` | 1 | `VOLCANO_ROOM_FLAGS_226A` | Save | Volcano room-script flags (individual meanings unknown) |
| `$7E:226B` | 1 | `CRUSTACIA_PICKUP_CLAIM_FLAGS` | Save | Crustacia pickup-claimed flags |
| `$7E:226C` | 1 | `QUICKSAND_FIELD_PICKUP_CLAIM_FLAGS` | Save | Quicksand Field pickup-claimed flags |
| `$7E:226D` | 1 | `PICKUP_CLAIM_FLAGS_226D` | Save | Pickup-claimed flags (rooms 0x35, 0x3B, 0x5A) |
| `$7E:2284` | 2 bytes | `ALCHEMY_KNOWN_FLAGS` | Save | Bitmask flags tracking which alchemy formulas have been acquired by player. |
| `$7E:228B` | 1 byte | `DOG_NAMED_FLAG` | Save | Companion dog custom name initialization flag (bit 0 prevents default ROM name overwrite at boot; $8E:E124). |
| `$7E:22DA` | 1 | `WEAPONS_OWNED_FLAGS_0` | Save | Combat Subsystem: Weapon unlocked bitmask byte 0 (bits 1..7: Bone Club, Spider Claw, Horn Spear, Gladiator Sword, Bronze Axe, Bronze Spear, Crusader Sword). |
| `$7E:22DB` | 1 | `WEAPONS_OWNED_FLAGS_1` | Save | Combat Subsystem: Weapon unlocked bitmask byte 1 (bits 0..5: Knight Basher, Lance, Neutron Blade, Atom Smasher, Laser Lance, Bazooka). |
| `$7E:22E9` | 1 | `ROOM_TRANSITION_MODE` | Room | Engine State: Room transition execution mode flag ($80:8CD3). |
| `$7E:22EA` | 1 byte | `GAMEPLAY_FLAGS_22EA` | Room | Multi-owner gameplay, room-load readiness, and render flags (bit 0 = loot success, bit 2 = SRAM boot path, bits 3-5 = collision/character/palette readiness in pre-roll loop, bit 7 = screen-layer override latch; see shared-flags-22ea-22eb.md). |
| `$7E:22EB` | 1 byte | `ROOM_TRANSITION_AND_SCRIPT_FLAGS_22EB` | Room | Room transition and script VM coordination flags (bit 0 = room-local script latch, bit 2 = reload default room path in main loop, bit 6 = doorway handoff; see shared-flags-22ea-22eb.md). |
| `$7E:22EC` | 1 | `ROOM_MUSIC_TRANSITION_FLAG` | Room | Engine State: Room change background music transition mode flag ($8C:D860). |
| `$7E:22EE` | 2 bytes | `SCRIPT_EXECUTION_LOCK_FLAGS` | Room | Script execution suspend gate and transition lock word (bit 0 set by func_8DB4FA during dialogue/cutscenes to lock VM execution; cleared by func_8CCEE9 on room transition to unfreeze actors and script threads). |
| `$7E:22EF` | 1 byte | `SCRIPT_MODE7_FLIGHT_LOCK` | Room | Mode 7 flight navigation suspend and landing trigger latch (upper byte of $7E:22EE, tested/cleared by $80:C4A3). |
| `$7E:22FA` | 1 byte | `CAMERA_ZOOM_SCALE_X` | Room | Mode 7 horizontal scale factor for rooms utilizing perspective rendering (written to $211C). |
| `$7E:22FB` | 1 byte | `CAMERA_ZOOM_SCALE_Y` | Room | Mode 7 vertical scale factor for rooms utilizing perspective rendering (written to $211C). |
| `$7E:22FC` | 1 byte | `DESERT_SECTOR_Y` | Save | Desert of Doom (Room 0x1B) endless navigation grid vertical sector coordinate (updated on boundary wrap triggers). |
| `$7E:22FD` | 1 byte | `DESERT_SECTOR_X` | Save | Desert of Doom (Room 0x1B) endless navigation grid horizontal sector coordinate (updated on boundary wrap triggers). |
| `$7E:22FF` | 1 byte | `STORY_FLAGS_OFFSET_0` | Save | Primary story progression event flag byte. |
| `$7E:2300` | 1 | `ING_QTY_WATER` | Save | Alchemy Inventory: Owned quantity of Water (Ingredient ID $01; max 99) |
| `$7E:2301` | 1 | `ING_QTY_VINEGAR` | Save | Alchemy Inventory: Owned quantity of Vinegar (Ingredient ID $02; max 99) |
| `$7E:2302` | 1 | `ING_QTY_ROOT` | Save | Alchemy Inventory: Owned quantity of Root (Ingredient ID $03; max 99) |
| `$7E:2303` | 1 | `ING_QTY_OIL` | Save | Alchemy Inventory: Owned quantity of Oil (Ingredient ID $04; max 99) |
| `$7E:2304` | 1 | `ING_QTY_MUSHROOM` | Save | Alchemy Inventory: Owned quantity of Mushroom (Ingredient ID $05; max 99) |
| `$7E:2305` | 1 | `ING_QTY_MUD_PEPPER` | Save | Alchemy Inventory: Owned quantity of Mud Pepper (Ingredient ID $06; max 1) |
| `$7E:2306` | 1 | `ING_QTY_METEORITE` | Save | Alchemy Inventory: Owned quantity of Meteorite (Ingredient ID $07; max 99) |
| `$7E:2307` | 1 | `ING_QTY_LIMESTONE` | Save | Alchemy Inventory: Owned quantity of Limestone (Ingredient ID $08; max 99) |
| `$7E:2308` | 1 | `ING_QTY_IRON` | Save | Alchemy Inventory: Owned quantity of Iron (Ingredient ID $09; max 99) |
| `$7E:2309` | 1 | `ING_QTY_GUNPOWDER` | Save | Alchemy Inventory: Owned quantity of Gunpowder (Ingredient ID $0A; max 99) |
| `$7E:230A` | 1 | `ING_QTY_GREASE` | Save | Alchemy Inventory: Owned quantity of Grease (Ingredient ID $0B; max 99) |
| `$7E:230B` | 1 | `ING_QTY_FEATHER` | Save | Alchemy Inventory: Owned quantity of Feather (Ingredient ID $0C; max 99) |
| `$7E:230C` | 1 | `ING_QTY_ETHANOL` | Save | Alchemy Inventory: Owned quantity of Ethanol / Alcohol (Ingredient ID $0D; max 99) |
| `$7E:230D` | 1 | `ING_QTY_DRY_ICE` | Save | Alchemy Inventory: Owned quantity of Dry Ice (Ingredient ID $0E; max 99) |
| `$7E:230E` | 1 | `ING_QTY_CRYSTAL` | Save | Alchemy Inventory: Owned quantity of Crystal (Ingredient ID $0F; max 99) |
| `$7E:230F` | 1 | `ING_QTY_CLAY` | Save | Alchemy Inventory: Owned quantity of Clay (Ingredient ID $10; max 99) |
| `$7E:2310` | 1 | `ING_QTY_BRIMSTONE` | Save | Alchemy Inventory: Owned quantity of Brimstone (Ingredient ID $11; max 99) |
| `$7E:2311` | 1 | `ING_QTY_BONE` | Save | Alchemy Inventory: Owned quantity of Bone (Ingredient ID $12; max 99) |
| `$7E:2312` | 1 | `ING_QTY_ATLAS_MEDALLION` | Save | Alchemy Inventory: Owned quantity of Atlas Medallion (Ingredient ID $13; max 99) |
| `$7E:2313` | 1 | `ING_QTY_ASH` | Save | Alchemy Inventory: Owned quantity of Ash (Ingredient ID $14; max 99) |
| `$7E:2314` | 1 | `ING_QTY_ACORN` | Save | Alchemy Inventory: Owned quantity of Acorn (Ingredient ID $15; max 99) |
| `$7E:2315` | 1 | `ING_SATCHEL_SLOT_0` | Save | Alchemy Satchel: Active inventory satchel quick-select slot 0 quantity ($8E:9140) |
| `$7E:2316` | 1 | `ING_SATCHEL_SLOT_1` | Save | Alchemy Satchel: Active inventory satchel quick-select slot 1 quantity |
| `$7E:2317` | 1 | `ING_SATCHEL_SLOT_2` | Save | Alchemy Satchel: Active inventory satchel quick-select slot 2 quantity |
| `$7E:2318` | 1 | `ING_SATCHEL_SLOT_3` | Save | Alchemy Satchel: Active inventory satchel quick-select slot 3 quantity |
| `$7E:2319` | 1 | `ING_SATCHEL_SLOT_4` | Save | Alchemy Satchel: Active inventory satchel quick-select slot 4 quantity |
| `$7E:231A` | 1 | `ING_SATCHEL_SLOT_5` | Save | Alchemy Satchel: Active inventory satchel quick-select slot 5 quantity |
| `$7E:231B` | 1 | `ING_SATCHEL_SLOT_6` | Save | Alchemy Satchel: Active inventory satchel quick-select slot 6 quantity |
| `$7E:231C` | 1 | `ING_SATCHEL_SLOT_7` | Save | Alchemy Satchel: Active inventory satchel quick-select slot 7 quantity |
| `$7E:231D` | 1 | `ARMOR_QTY_CHEST_1_1` | Save | Armor Inventory: Owned quantity of Grass Vest armor piece (Armor ID 0x231D; max 6). |
| `$7E:231E` | 1 | `ARMOR_QTY_CHEST_1_2` | Save | Armor Inventory: Owned quantity of Shell Armor armor piece (Armor ID 0x231E; max 6). |
| `$7E:231F` | 1 | `ARMOR_QTY_CHEST_1_3` | Save | Armor Inventory: Owned quantity of Dino Skin armor piece (Armor ID 0x231F; max 6). |
| `$7E:2320` | 1 | `ARMOR_QTY_CHEST_2_1` | Save | Armor Inventory: Owned quantity of Bronze Armor armor piece (Armor ID 0x2320; max 6). |
| `$7E:2321` | 1 | `ARMOR_QTY_CHEST_2_2` | Save | Armor Inventory: Owned quantity of Stone Plate armor piece (Armor ID 0x2321; max 6). |
| `$7E:2322` | 1 | `ARMOR_QTY_CHEST_2_3` | Save | Armor Inventory: Owned quantity of Centurion Cape armor piece (Armor ID 0x2322; max 6). |
| `$7E:2323` | 1 | `ARMOR_QTY_CHEST_3_1` | Save | Armor Inventory: Owned quantity of Shining Armor armor piece (Armor ID 0x2323; max 6). |
| `$7E:2324` | 1 | `ARMOR_QTY_CHEST_3_2` | Save | Armor Inventory: Owned quantity of Silver Mail armor piece (Armor ID 0x2324; max 6). |
| `$7E:2325` | 1 | `ARMOR_QTY_CHEST_3_3` | Save | Armor Inventory: Owned quantity of Gold Plated armor piece (Armor ID 0x2325; max 6). |
| `$7E:2326` | 1 | `ARMOR_QTY_CHEST_4_1` | Save | Armor Inventory: Owned quantity of Titanium Vest armor piece (Armor ID 0x2326; max 6). |
| `$7E:2327` | 1 | `ARMOR_QTY_CHEST_4_2` | Save | Armor Inventory: Owned quantity of Virtual Suit armor piece (Armor ID 0x2327; max 6). |
| `$7E:2328` | 1 | `ARMOR_QTY_CHEST_4_3` | Save | Armor Inventory: Owned quantity of Kevlar Vest armor piece (Armor ID 0x2328; max 6). |
| `$7E:2329` | 1 | `ARMOR_QTY_HELM_1_1` | Save | Armor Inventory: Owned quantity of Grass Hat armor piece (Armor ID 0x2329; max 6). |
| `$7E:232A` | 1 | `ARMOR_QTY_HELM_1_2` | Save | Armor Inventory: Owned quantity of Shell Hat armor piece (Armor ID 0x232A; max 6). |
| `$7E:232B` | 1 | `ARMOR_QTY_HELM_1_3` | Save | Armor Inventory: Owned quantity of Dino Helm armor piece (Armor ID 0x232B; max 6). |
| `$7E:232C` | 1 | `ARMOR_QTY_HELM_2_1` | Save | Armor Inventory: Owned quantity of Bronze Helm armor piece (Armor ID 0x232C; max 6). |
| `$7E:232D` | 1 | `ARMOR_QTY_HELM_2_2` | Save | Armor Inventory: Owned quantity of Stone Helm armor piece (Armor ID 0x232D; max 6). |
| `$7E:232E` | 1 | `ARMOR_QTY_HELM_2_3` | Save | Armor Inventory: Owned quantity of Centurion Helm armor piece (Armor ID 0x232E; max 6). |
| `$7E:232F` | 1 | `ARMOR_QTY_HELM_3_1` | Save | Armor Inventory: Owned quantity of Knight Helm armor piece (Armor ID 0x232F; max 6). |
| `$7E:2330` | 1 | `ARMOR_QTY_HELM_3_2` | Save | Armor Inventory: Owned quantity of Silver Helm armor piece (Armor ID 0x2330; max 6). |
| `$7E:2331` | 1 | `ARMOR_QTY_HELM_3_3` | Save | Armor Inventory: Owned quantity of Gold Helm armor piece (Armor ID 0x2331; max 6). |
| `$7E:2332` | 1 | `ARMOR_QTY_HELM_4_1` | Save | Armor Inventory: Owned quantity of Titanium Helm armor piece (Armor ID 0x2332; max 6). |
| `$7E:2333` | 1 | `ARMOR_QTY_HELM_4_2` | Save | Armor Inventory: Owned quantity of Virtual Helm armor piece (Armor ID 0x2333; max 6). |
| `$7E:2334` | 1 | `ARMOR_QTY_HELM_4_3` | Save | Armor Inventory: Owned quantity of Kevlar Helm armor piece (Armor ID 0x2334; max 6). |
| `$7E:2335` | 1 | `ARMOR_QTY_GLOVE_1_1` | Save | Armor Inventory: Owned quantity of Vine Bracer armor piece (Armor ID 0x2335; max 6). |
| `$7E:2336` | 1 | `ARMOR_QTY_GLOVE_1_2` | Save | Armor Inventory: Owned quantity of Shell Bracer armor piece (Armor ID 0x2336; max 6). |
| `$7E:2337` | 1 | `ARMOR_QTY_GLOVE_1_3` | Save | Armor Inventory: Owned quantity of Dino Bracer armor piece (Armor ID 0x2337; max 6). |
| `$7E:2338` | 1 | `ARMOR_QTY_GLOVE_2_1` | Save | Armor Inventory: Owned quantity of Bronze Gauntlet armor piece (Armor ID 0x2338; max 6). |
| `$7E:2339` | 1 | `ARMOR_QTY_GLOVE_2_2` | Save | Armor Inventory: Owned quantity of Stone Arm armor piece (Armor ID 0x2339; max 6). |
| `$7E:233A` | 1 | `ARMOR_QTY_GLOVE_2_3` | Save | Armor Inventory: Owned quantity of Centurion Guard armor piece (Armor ID 0x233A; max 6). |
| `$7E:233B` | 1 | `ARMOR_QTY_GLOVE_3_1` | Save | Armor Inventory: Owned quantity of Knight Gauntlet armor piece (Armor ID 0x233B; max 6). |
| `$7E:233C` | 1 | `ARMOR_QTY_GLOVE_3_2` | Save | Armor Inventory: Owned quantity of Silver Guard armor piece (Armor ID 0x233C; max 6). |
| `$7E:233D` | 1 | `ARMOR_QTY_GLOVE_3_3` | Save | Armor Inventory: Owned quantity of Gold Gauntlet armor piece (Armor ID 0x233D; max 6). |
| `$7E:233E` | 1 | `ARMOR_QTY_GLOVE_4_1` | Save | Armor Inventory: Owned quantity of Titanium Guard armor piece (Armor ID 0x233E; max 6). |
| `$7E:233F` | 1 | `ARMOR_QTY_GLOVE_4_2` | Save | Armor Inventory: Owned quantity of Virtual Guard armor piece (Armor ID 0x233F; max 6). |
| `$7E:2340` | 1 | `ARMOR_QTY_GLOVE_4_3` | Save | Armor Inventory: Owned quantity of Kevlar Guard armor piece (Armor ID 0x2340; max 6). |
| `$7E:2341` | 1 | `ARMOR_QTY_COLLAR_1` | Save | Armor Inventory: Owned quantity of Leather Collar armor piece (Armor ID 0x2341; max 6). |
| `$7E:2342` | 1 | `ARMOR_QTY_COLLAR_2` | Save | Armor Inventory: Owned quantity of Spiky Collar armor piece (Armor ID 0x2342; max 6). |
| `$7E:2343` | 1 | `ARMOR_QTY_COLLAR_3` | Save | Armor Inventory: Owned quantity of Defender Collar armor piece (Armor ID 0x2343; max 6). |
| `$7E:2344` | 1 | `ARMOR_QTY_COLLAR_4` | Save | Armor Inventory: Owned quantity of Spots Collar armor piece (Armor ID 0x2344; max 6). |
| `$7E:2345` | 1 byte | `BAZOOKA_AMMO` | Save | Bazooka ammo counts and the selected ammo. \ |
| `$7E:2346` | 1 | `AMMO_QTY_PARTICLE_BOMB` | Save | Ammunition Inventory: Owned quantity of Particle Bomb bazooka ammo (caps at 99). |
| `$7E:2347` | 1 | `AMMO_QTY_CRYO_BLAST` | Save | Ammunition Inventory: Owned quantity of Cryo-Blast bazooka ammo. |
| `$7E:2348` | 2 | `CURRENCY_WINDOW_ACTIVE_INDEX` | Frame | UI Subsystem: Active currency index for currency display window ($00 = Talons, $03 = Jewels, $06 = Coins, $09 = Credits; $8C:E628) |
| `$7E:2349` | 2 | `EQUIPMENT_PROFILE_INDEX` | Room | Combat Subsystem: Active equipment/weapon profile index (indexes weapon stats table at $C4:3874, $8F:81C9) |
| `$7E:234A` | 1 | `CALL_BEADS_CAPACITY` | Save | Inventory Mechanics: Maximum Call Beads inventory capacity limit. |
| `$7E:234B` | 2 bytes | `HUT_HOUSE_TO_ENTER` | Save | Game script variable: Hut/house to enter |
| `$7E:234D` | 1 | `CAVE_ENTRANCE_ID` | Transition | Antiqua caves shared room entrance sector index (1..6) |
| `$7E:234F` | 2 bytes | `PRISON_TOWN_EXIT` | Save | Game script variable: PRISON TOWN EXIT |
| `$7E:2350` | 1 | `DOG_SLEEP_SPOT` | Room | Antiqua Dog resting camp / separation location index (0..4) |
| `$7E:2352` | 2 bytes | `QUEEN_S_KEY_ON_DOG` | Save | Game script variable: Queen's Key on Dog |
| `$7E:2353` | 2 bytes | `QUEEN_S_KEY_ON_BOY` | Save | Game script variable: Queen's Key on Boy |
| `$7E:2357` | 1 | `PYRAMID_CURRENT_LEVEL` | Room | Antiqua Pyramid current floor level index (1 = bottom, 2 = top) |
| `$7E:2358` | 1 | `PYRAMID_ENTRANCE_SECTOR` | Room | Antiqua Pyramid entrance doorway / sector index (0..2) |
| `$7E:235B` | `Byte` | `dog_ai_behavior_command` | `Save` | Dog companion AI behavioral state command (0=follow, 1=heel, 2=sniff/search, 3=attack). |
| `$7E:235C` | `Byte` | `dog_ai_alert_timer` | `Save` | Timer countdown ticks for dog barking / alert animation when scent is detected. |
| `$7E:235D` | `Byte` | `dog_ai_leash_distance` | `Save` | Maximum leash tether distance before Dog AI breaks combat to return to player. |
| `$7E:235E` | `Byte` | `dog_ai_collision_mode` | `Save` | Dog navigation collision mode (wall sliding vs direct waypoint pathing). |
| `$7E:235F` | `Word` | `dog_companion_attack_mode` | `Save` | Companion attack behavior bitmask (passive, defend player, aggressive attack). |
| `$7E:2360` | `Word` | `dog_combat_target_priority` | `Save` | Target priority selector for Dog AI (nearest enemy vs player's current target). |
| `$7E:2363` | 1 byte | `DOG_FORM_INDEX` | Save | Active visual form and breed of dog companion (0=Wolf, 1=Greyhound, 2=Poodle, 3=Toaster). |
| `$7E:2365` | 19 bytes | `DIALOGUE_STRING_PARAM_REGISTERS` | Room | Dialogue and message box numeric string interpolation registers |
| `$7E:2369` | 2 | `MARKET_RELIC_PRICE_SURCHARGE` | Permanent | Nobilia Market relic vendor escalating price markup |
| `$7E:236B` | 2 | `MARKET_ENTRANCE_ENCOUNTER_TYPE` | Room | Nobilia Market entrance encounter random variant |
| `$7E:237D` | 2 | `MODE7_FLIGHT_STATUS_FLAG` | Room | Mode 7 overworld flight active flag / destination landing index |
| `$7E:2389` | 2 | `MARKET_CRITTER_INTERACTION_FLAGS` | Room | Nobilia Market entrance critter state flags |
| `$7E:238D` | 2 bytes | `CHANGE_MUSIC` | Save | Game script variable: CHANGE MUSIC |
| `$7E:2391` | 1 byte | `LOOT_MAILBOX` | Room | Loot mailbox — what the next pickup gives. \ |
| `$7E:2393` | 2 | `LOOT_AMOUNT_CURRENCY` | Room | Loot currency amount staged before calling global loot script (e.g. call 0x39 / 0x3a / 0x3b). |
| `$7E:2395` | 2 bytes | `LOOT_ROOM_OBJECT` | Room | Loot mailbox: Room object index of chest, gourd, or pot being opened/looted (written before calling loot handler). |
| `$7E:239B` | 2 bytes | `PRIZE_1_RATE` | Save | Game script variable: PRIZE 1 RATE |
| `$7E:239D` | 2 bytes | `PRIZE_2_RATE` | Save | Game script variable: PRIZE 2 RATE |
| `$7E:239F` | 2 bytes | `PRIZE_3_RATE` | Save | Game script variable: PRIZE 3 RATE |
| `$7E:23A1` | 2 bytes | `PRIZE_1_DROP` | Save | Game script variable: PRIZE 1 DROP |
| `$7E:23A3` | 2 bytes | `PRIZE_2_DROP` | Save | Game script variable: PRIZE 2 DROP |
| `$7E:23A5` | 2 bytes | `PRIZE_3_DROP` | Save | Game script variable: PRIZE 3 DROP |
| `$7E:23A7` | 2 bytes | `PRIZE_1_QTY` | Save | Game script variable: PRIZE 1 QTY |
| `$7E:23A9` | 2 bytes | `PRIZE_2_QTY` | Save | Game script variable: PRIZE 2 QTY |
| `$7E:23AB` | 2 bytes | `PRIZE_3_QTY` | Save | Game script variable: PRIZE 3 QTY |
| `$7E:23AD` | 2 | `BARRIER_CENTER_X` | Frame | Center world X coordinate of active protective barrier shield circle |
| `$7E:23AF` | 2 | `BARRIER_CENTER_Y` | Frame | Center world Y coordinate of active protective barrier shield circle |
| `$7E:23B1` | 2 | `BARRIER_RADIUS` | Frame | Current radius in pixels of active protective barrier shield circle |
| `$7E:23B3` | 2 | `BARRIER_EXPANSION_RATE` | Frame | Radial growth and shrinkage step rate per frame for active barrier circle |
| `$7E:23B5` | 2 | `BARRIER_STATE_OR_LIFETIME` | Frame | Barrier state machine mode and remaining lifetime countdown frames |
| `$7E:23B9` | 2 | `TARGET_X` | Room | Script waypoint / target position X in world pixels |
| `$7E:23BB` | 2 | `TARGET_Y` | Room | Script waypoint / target position Y in world pixels |
| `$7E:23BF` | 2 bytes | `PACIFIED` | Save | Pseudo-boolean pacified state ($0000 = False, $0001 = True; compiler: PACIFIED). |
| `$7E:23C1` | 2 bytes | `COMPANION_TETHER_MODE` | Room | Companion leash behavior state (0 = standard follow distance, non-zero = tight tether). |
| `$7E:23C3` | 2 bytes | `COMPANION_TIGHT_TETHER` | Room | Non-zero: the companion keeps close (tether limits 4/3/3/1). Cleared on room load by func_908E90; set by tight room/indoor scripts. |
| `$7E:23C5` | 2 bytes | `COMPANION_LEASH_RADIUS` | Room | Companion leash maximum distance parameter (default $2000; initialized in func_908E90). |
| `$7E:23C9` | 2 | `WEATHER_EFFECT_STATE` | Room | Weather particle system animation state and dispatch mode |
| `$7E:23CD` | 2 bytes | `WEAPON_PALETTE` | Save | Boy/weapon active sprite palette CGRAM byte offset ($40, $60, $80, $A0, $C0; checked in $8F:81C9). |
| `$7E:23CF` | 2 bytes | `DOG_PALETTE` | Save | Dog active sprite palette CGRAM byte offset ($40, $60, $80, $A0, $C0; checked in $8F:9471). |
| `$7E:23D3` | 2 bytes | `SUBTITLE_ACTIVE_FLAG` | Room | Subtitle text window active state flag evaluated by Script VM opcode 0x52 subtext ($8C:D99E). |
| `$7E:23D5` | 2 | `SCRIPT_DAMAGE_REDIRECT_FLAG` | Frame | Script VM: Opcode 0x92 damage redirect flag (0 = standard knockback damage, non-zero = redirect to opcode 0xBB damage without knockback) |
| `$7E:23D7` | 2 | `SCRIPT_DAMAGE_TRANSFORM_FLAG` | Frame | Script VM: Opcode 0x92 damage transform flag (0 = raw immediate damage, non-zero = transform damage through entity defense math) |
| `$7E:23DB` | 2 bytes | `QUEUED_ROOM_EXIT_TRIGGER_0` | Room | ID of door or boundary exit trigger tripped by player ($FFFF = none). |
| `$7E:23DD` | 2 bytes | `QUEUED_ROOM_EXIT_TRIGGER_1` | Room | Secondary queued room transition exit trigger ID ($FFFF = none). |
| `$7E:23E5` | 2 | `STATS_PTR_BOY` | Boot | Entity Subsystem: Pointer to Boy persistent base stats block ($0A26; initialized in $8F:8090) |
| `$7E:23E7` | 2 | `STATS_PTR_DOG` | Boot | Entity Subsystem: Pointer to Dog persistent base stats block ($0A70; initialized in $8F:8130) |
| `$7E:23E9` | 2 bytes | `CAMERA_ROOM_BOUND_LEFT` | Room | Left boundary clamp limit (pixels) for active room camera. |
| `$7E:23EB` | 2 bytes | `CAMERA_ROOM_BOUND_TOP` | Room | Top boundary clamp limit (pixels) for active room camera. |
| `$7E:23ED` | 2 bytes | `CAMERA_ROOM_BOUND_RIGHT` | Room | Right boundary clamp limit (pixels) for active room camera. |
| `$7E:23EF` | 2 bytes | `CAMERA_ROOM_BOUND_BOTTOM` | Room | Bottom boundary clamp limit (pixels) for active room camera. |
| `$7E:2401` | 2 bytes | `VIEWPORT_LEFT_X` | Room | Active camera on-screen viewport left edge in world pixels ($BF). |
| `$7E:2403` | 2 bytes | `VIEWPORT_RIGHT_X` | Room | Active camera on-screen viewport right edge in world pixels ($BF + 256). |
| `$7E:2405` | 2 bytes | `VIEWPORT_TOP_Y` | Room | Active camera on-screen viewport top edge in world pixels ($C1). |
| `$7E:2407` | 2 bytes | `VIEWPORT_BOTTOM_Y` | Room | Active camera on-screen viewport bottom edge in world pixels ($C1 + 224). |
| `$7E:2409` | 2 bytes | `SHAKE_MAGNITUDE_X` | Frame | Maximum horizontal displacement magnitude for active screen shaking ($90:989C). |
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
| `$7E:2421` | 2 | `TRIGGER_INTERACTION_X` | Room | Trigger interaction context entity X coordinate in world pixels |
| `$7E:2423` | 2 | `TRIGGER_INTERACTION_Y` | Room | Trigger interaction context entity Y coordinate in world pixels |
| `$7E:2425` | 2 bytes | `TRIGGER_INTERACTION_FACING` | Room | Actor facing direction index (0..3) recorded at moment of trigger interaction ($8F:ABED). |
| `$7E:2427` | 2 bytes | `TRIGGER_INTERACTION_FLAGS` | Room | Actor interaction status flags recorded at moment of trigger interaction ($8F:ABED). |
| `$7E:2429` | 2 bytes | `TRIGGER_SCRIPT_LOCK` | Room | Execution lock held while a step-on coordinate trigger script is running. |
| `$7E:242B` | 2 bytes | `CAMERA_SCRIPTED_TARGET_X` | Room | Forced scripted camera focus target X coordinate (-1 = follow player). |
| `$7E:242D` | 2 bytes | `CAMERA_SCRIPTED_TARGET_Y` | Room | Forced scripted camera focus target Y coordinate (-1 = follow player). |
| `$7E:242F` | 2 bytes | `CAMERA_PAN_VELOCITY` | Room | Transition panning speed between scripted camera targets. |
| `$7E:2431` | 2 bytes | `SPAWN_RESPAWN_RATE_DEFAULT` | Room | Default entity respawn interval countdown ticks (initialized to $0258 = 600 frames in func_8FDF14). |
| `$7E:2433` | 2 bytes | `SPAWN_SYSTEM_ENABLE` | Room | Entity spawn system global enable gate (1 = active, 0 = disabled; initialized in func_8FDF14). |
| `$7E:2435` | 2 bytes | `ROOM_AMBIENT_LIGHT_LEVEL` | Room | Ambient light/shade color tint parameter applied to room palette (default $15). |
| `$7E:2437` | 2 bytes | `MAP_PALETTE_INDEX` | Room | Active map color palette family identifier index. |
| `$7E:243B` | 2 bytes | `PENDING_SOUND_COMMAND` | Frame | Queued sound effect / audio driver mailbox flushed by Script VM opcodes 0x30..0x32 ($8C:D6A7). |
| `$7E:243D` | 2 | `EQUIPMENT_GRANT_COMMAND` | Frame | Pending equipment item grant ID |
| `$7E:243F` | 2 | `EQUIPMENT_TAKE_COMMAND` | Frame | Pending equipment item revoke/take ID |
| `$7E:2441` | 2 bytes | `ROOM_TILESET_GRAPHIC_BANK` | Room | ROM graphic bank containing compressed 16x16 metatile graphics for current room. |
| `$7E:2443` | 2 bytes | `ROOM_METATILE_DESCRIPTOR_PTR` | Room | Pointer to room metatile layout descriptor table in ROM. |
| `$7E:2445` | 2 bytes | `PRESELECT_ALCHEMY` | Save | Game script variable: PRESELECT ALCHEMY |
| `$7E:2449` | 2 bytes | `SAVE_SPOT` | Save | Game script variable: SAVE SPOT |
| `$7E:244D` | 2 | `LAST_ENTITY_HANDLE` | Room | Temporary entity struct pointer / handle of most recently spawned NPC |
| `$7E:244F` | 2 | `MARKET_PEDDLER_STAGE` | Room | Nobilia Market peddler dialogue index |
| `$7E:2451` | 2 | `MARKET_PEDDLER_TALK_COUNT` | Room | Nobilia Market peddler total interaction count |
| `$7E:2459` | 2 bytes | `INGREDIENT_SHOP` | Save | Game script variable: INGREDIENT SHOP |
| `$7E:2461` | 2 bytes | `LOOT_AMOUNT` | Room | Loot bonus — amount minus one for the next pickup. The loot script adds `1 + $2461`. Pickups that give more than one write `amount − 1` here before calling the |
| `$7E:2463` | 2 | `MARKET_ITEM_ID` | Room | Market commodity / trade item index passed to market dialogue routines |
| `$7E:246B` | 2 bytes | `INTRO_CREDITS_LINE_MODE` | Room | Title and credits sequence text line layout mode flag (0 = 3 lines, non-zero = 2 lines; $80:C6D2, $80:C763, $80:C881). |
| `$7E:2480` | 64 bytes | `WEATHER_PARTICLES` | Frame | Position, velocity, and lifetime particle physics state array (rain, snow, embers). |
| `$7E:2491` | 2 | `QUICKSAND_TRIGGER_OBJECT_INDEX` | Unknown | Quicksand Field trigger object index |
| `$7E:2497` | 2 | `TARGET_WAYPOINT_X` | Room | Generic target waypoint X coordinate |
| `$7E:2499` | 2 | `TARGET_WAYPOINT_Y` | Room | Generic target waypoint Y coordinate |
| `$7E:249D` | 2 | `TRANSIT_ORIGIN_X` | Room | Scripted lift / transit movement origin X coordinate in world pixels |
| `$7E:249F` | 2 | `TRANSIT_ORIGIN_Y` | Room | Scripted lift / transit movement origin Y coordinate in world pixels |
| `$7E:24A1` | 2 | `TRANSIT_DEST_X` | Room | Scripted lift / transit movement destination X coordinate in world pixels |
| `$7E:24A3` | 2 | `TRANSIT_DEST_Y` | Room | Scripted lift / transit movement destination Y coordinate in world pixels |
| `$7E:24A7` | 2 | `TRAJECTORY_VY` | Room | Current vertical trajectory velocity in subpixels (fixed-point 12.4) |
| `$7E:24AB` | 2 | `ACTIVE_CHAR_X` | Room | Staged X position of the active player character in world pixels or subpixels |
| `$7E:24AD` | 2 | `INACTIVE_CHAR_X` | Room | Staged X position of the inactive companion character in world pixels |
| `$7E:24AF` | 2 | `ACTIVE_CHAR_Y` | Room | Staged Y position of the active player character in world pixels or subpixels |
| `$7E:24B1` | 2 | `INACTIVE_CHAR_Y` | Room | Staged Y position of the inactive companion character in world pixels |
| `$7E:24B3` | 2 | `TRAJECTORY_INITIAL_VY` | Room | Initial upward trajectory launch speed parameter in subpixels |
| `$7E:24B5` | 2 | `TRAJECTORY_MAX_VY` | Room | Terminal downward trajectory velocity threshold parameter in subpixels |
| `$7E:24B7` | 2 | `TRAJECTORY_VX` | Room | Horizontal trajectory velocity per frame in subpixels (fixed-point 12.4) |
| `$7E:24C3` | 2 | `PIPE_DESTINATION_ID` | Transition | Volcano pipe maze chute outlet index (1–10) |
| `$7E:24E5` | 2 bytes | `SALABOG_ENTITY` | Save | Entity reference to spawned Salabog boss in Swamp (Room 0x01). |
| `$7E:24F9` | 2 | `DUCT_ENTRANCE_GRATE_OBJECT` | Room | Omnitopia ventilation duct entrance grate object ID |
| `$7E:24FB` | 2 | `DUCT_EXIT_GRATE_OBJECT` | Room | Omnitopia ventilation duct exit grate object ID |
| `$7E:24FD` | 2 | `DUCT_ENTRANCE_SECTOR_ID` | Room | Omnitopia ventilation duct entrance portal / sector index |
| `$7E:2513` | 2 | `MARKET_TIMER_START_FRAME` | Room | Nobilia Market 15-minute countdown start timestamp (low word of frame counter) |
| `$7E:2515` | 2 | `MARKET_TIMER_MINUTES_REMAINING` | Room | Nobilia Market countdown remaining minutes (15..1) |
| `$7E:2517` | `Word` | `sram_chest_flags_0` | `Save` | Persistent treasure chest / gourd collection bitmask words 0..1 (gourds 0..31 in Cartridge SRAM payload). |
| `$7E:2519` | `Word` | `sram_chest_flags_1` | `Save` | Persistent treasure chest / gourd collection bitmask words 2..3 (gourds 32..63). |
| `$7E:251B` | `Word` | `sram_chest_flags_2` | `Save` | Persistent treasure chest / gourd collection bitmask words 4..5 (gourds 64..95). |
| `$7E:251D` | `Word` | `sram_chest_flags_3` | `Save` | Persistent treasure chest / gourd collection bitmask words 6..7 (gourds 96..127). |
| `$7E:251F` | `Word` | `sram_chest_flags_4` | `Save` | Persistent treasure chest / gourd collection bitmask words 8..9 (gourds 128..159). |
| `$7E:2521` | `Word` | `sram_chest_flags_5` | `Save` | Persistent treasure chest / gourd collection bitmask words 10..11 (gourds 160..191). |
| `$7E:2523` | `Word` | `sram_chest_flags_6` | `Save` | Persistent treasure chest / gourd collection bitmask words 12..13 (gourds 192..223). |
| `$7E:2525` | `Word` | `sram_chest_flags_7` | `Save` | Persistent treasure chest / gourd collection bitmask words 14..15 (gourds 224..255). |
| `$7E:2533` | `Word` | `sram_boss_defeated_flags` | `Save` | Persistent campaign boss defeat bitmask (Thraxx, Salabog, Magmar, Vigor, Megataur, Rimsala, Carltron). |
| `$7E:2537` | 2 | `LOOT_TEXT_ARG_2` | Room | Secondary text parameter mailbox for loot pickup message box formatting |
| `$7E:2539` | 2 | `LOOT_TEXT_ARG_1` | Room | Primary text parameter mailbox for loot pickup message box formatting |
| `$7E:2545` | 2 | `DIALOGUE_SELECTION` | Room | Player selection choice index from message box menu |
| `$7E:254D` | 2 | `MARKET_PEDDLER_COOLDOWN_START_FRAME` | Room | Nobilia Market entrance peddler cooldown start timestamp |
| `$7E:2834` | `Word` | `script_temp_reg_0` | `Frame` | Script VM temporary evaluation register 0 / script variable base ($8C:D7E1, opcode $10..$18 indexed offset). |
| `$7E:2836` | `Word` | `script_temp_reg_1` | `Frame` | Script VM temporary evaluation register 1 / loop counter operand ($8C:D860). |
| `$7E:2838` | `Word` | `script_return_addr` | `Frame` | Script VM subroutine call return instruction pointer ($8C:D863). |
| `$7E:283A` | `Word` | `script_cond_flag` | `Frame` | Script VM conditional comparison test flag register (stores boolean result of comparisons for conditional branch opcodes). |
| `$7E:283D` | `Word` | `script_indirect_bank` | `Frame` | Script VM indirect memory bank pointer register ($8C:D872). |
| `$7E:283F` | `Word` | `script_sleep_accum` | `Frame` | Script VM timer tick accumulator for thread sleep and delay opcodes ($8C:D875). |
| `$7E:2841` | `Word` | `script_event_trigger_param` | `Frame` | Script VM event trigger identifier parameter word ($8C:ED6C). |
| `$7E:2843` | `Word` | `script_thread_priority` | `Frame` | Script VM thread scheduling priority override register ($8C:EE2C). |
| `$7E:2859` | `Word×6` | `script_eval_stack` | `Frame` | Script VM intermediate expression evaluation stack ($7E:2859..$7E:2865) for mathematical and logical opcodes. |
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
| `$7E:2ED6` | 2 | `FORMULA_LVL_ACID_RAIN` | Save | Alchemy Progression: Current level (0..9) for formula Acid Rain ($91:D850) |
| `$7E:2ED8` | 2 | `FORMULA_LVL_ATLAS` | Save | Alchemy Progression: Current level (0..9) for formula Atlas ($91:D850) |
| `$7E:2ED9` | 79 bytes | `SCRIPT_SLOT_19` | Room | Script VM execution thread slot 19 (stride 79 bytes). |
| `$7E:2EDA` | 2 | `FORMULA_LVL_BARRIER` | Save | Alchemy Progression: Current level (0..9) for formula Barrier ($91:D850) |
| `$7E:2EDC` | 2 | `FORMULA_LVL_CALL_UP` | Save | Alchemy Progression: Current level (0..9) for formula Call Up ($91:D850) |
| `$7E:2EDE` | 2 | `FORMULA_LVL_CORROSION` | Save | Alchemy Progression: Current level (0..9) for formula Corrosion ($91:D850) |
| `$7E:2EE0` | 2 | `FORMULA_LVL_CRUSH` | Save | Alchemy Progression: Current level (0..9) for formula Crush ($91:D850) |
| `$7E:2EE2` | 2 | `FORMULA_LVL_CURE` | Save | Alchemy Progression: Current level (0..9) for formula Cure ($91:D850) |
| `$7E:2EE4` | 2 | `FORMULA_LVL_DEFEND` | Save | Alchemy Progression: Current level (0..9) for formula Defend ($91:D850) |
| `$7E:2EE6` | 2 | `FORMULA_LVL_DOUBLE_DRAIN` | Save | Alchemy Progression: Current level (0..9) for formula Double Drain ($91:D850) |
| `$7E:2EE8` | 2 | `FORMULA_LVL_DRAIN` | Save | Alchemy Progression: Current level (0..9) for formula Drain ($91:D850) |
| `$7E:2EEA` | 2 | `FORMULA_LVL_ENERGIZE` | Save | Alchemy Progression: Current level (0..9) for formula Energize ($91:D850) |
| `$7E:2EEC` | 2 | `FORMULA_LVL_ESCAPE` | Save | Alchemy Progression: Current level (0..9) for formula Escape ($91:D850) |
| `$7E:2EEE` | 2 | `FORMULA_LVL_EXPLOSION` | Save | Alchemy Progression: Current level (0..9) for formula Explosion ($91:D850) |
| `$7E:2EF0` | 2 | `FORMULA_LVL_FIREBALL` | Save | Alchemy Progression: Current level (0..9) for formula Fireball ($91:D850) |
| `$7E:2EF2` | 2 | `FORMULA_LVL_FIRE_POWER` | Save | Alchemy Progression: Current level (0..9) for formula Fire Power ($91:D850) |
| `$7E:2EF4` | 2 | `FORMULA_LVL_FLASH` | Save | Alchemy Progression: Current level (0..9) for formula Flash ($91:D850) |
| `$7E:2EF6` | 2 | `FORMULA_LVL_FORCE_FIELD` | Save | Alchemy Progression: Current level (0..9) for formula Force Field ($91:D850) |
| `$7E:2EF8` | 2 | `FORMULA_LVL_HARD_BALL` | Save | Alchemy Progression: Current level (0..9) for formula Hard Ball ($91:D850) |
| `$7E:2EFA` | 2 | `FORMULA_LVL_HEAL` | Save | Alchemy Progression: Current level (0..9) for formula Heal ($91:D850) |
| `$7E:2EFC` | 2 | `FORMULA_LVL_LANCE` | Save | Alchemy Progression: Current level (0..9) for formula Lance ($91:D850) |
| `$7E:2EFE` | 2 | `FORMULA_LVL_LASER` | Save | Alchemy Progression: Current level (0..9) for formula Laser ($91:D850) |
| `$7E:2F00` | 2 | `FORMULA_LVL_LEVITATE` | Save | Alchemy Progression: Current level (0..9) for formula Levitate ($91:D850) |
| `$7E:2F02` | 2 | `FORMULA_LVL_LIGHTNING_STORM` | Save | Alchemy Progression: Current level (0..9) for formula Lightning Storm ($91:D850) |
| `$7E:2F04` | 2 | `FORMULA_LVL_MIRACLE_CURE` | Save | Alchemy Progression: Current level (0..9) for formula Miracle Cure ($91:D850) |
| `$7E:2F06` | 2 | `FORMULA_LVL_NITRO` | Save | Alchemy Progression: Current level (0..9) for formula Nitro ($91:D850) |
| `$7E:2F08` | 2 | `FORMULA_LVL_ONE_UP` | Save | Alchemy Progression: Current level (0..9) for formula One Up ($91:D850) |
| `$7E:2F0A` | 2 | `FORMULA_LVL_REFLECT` | Save | Alchemy Progression: Current level (0..9) for formula Reflect ($91:D850) |
| `$7E:2F0C` | 2 | `FORMULA_LVL_REGROWTH` | Save | Alchemy Progression: Current level (0..9) for formula Regrowth ($91:D850) |
| `$7E:2F0E` | 2 | `FORMULA_LVL_REVEALER` | Save | Alchemy Progression: Current level (0..9) for formula Revealer ($91:D850) |
| `$7E:2F10` | 2 | `FORMULA_LVL_REVIVE` | Save | Alchemy Progression: Current level (0..9) for formula Revive ($91:D850) |
| `$7E:2F12` | 2 | `FORMULA_LVL_SLOW_BURN` | Save | Alchemy Progression: Current level (0..9) for formula Slow Burn ($91:D850) |
| `$7E:2F14` | 2 | `FORMULA_LVL_SPEED` | Save | Alchemy Progression: Current level (0..9) for formula Speed ($91:D850) |
| `$7E:2F16` | 2 | `FORMULA_LVL_STING` | Save | Alchemy Progression: Current level (0..9) for formula Sting ($91:D850) |
| `$7E:2F18` | 2 | `FORMULA_LVL_STOP` | Save | Alchemy Progression: Current level (0..9) for formula Stop ($91:D850) |
| `$7E:2F1A` | 2 | `FORMULA_LVL_SUPER_HEAL` | Save | Alchemy Progression: Current level (0..9) for formula Super Heal ($91:D850) |
| `$7E:2F28` | 2 bytes | `SCRIPT_SLOT_QUEUE_TAIL` | Room | End sentinel and boundary limit pointer of Script VM thread pool ($7E:28FC..$7E:2F28). |
| `$7E:2F52` | 2 | `FORMULA_XP_ACID_RAIN` | Save | Alchemy Progression: Current experience points (0..99 XP) for formula Acid Rain ($91:D850) |
| `$7E:2F54` | 2 | `FORMULA_XP_ATLAS` | Save | Alchemy Progression: Current experience points (0..99 XP) for formula Atlas ($91:D850) |
| `$7E:2F56` | 2 | `FORMULA_XP_BARRIER` | Save | Alchemy Progression: Current experience points (0..99 XP) for formula Barrier ($91:D850) |
| `$7E:2F58` | 2 | `FORMULA_XP_CALL_UP` | Save | Alchemy Progression: Current experience points (0..99 XP) for formula Call Up ($91:D850) |
| `$7E:2F5A` | 2 | `FORMULA_XP_CORROSION` | Save | Alchemy Progression: Current experience points (0..99 XP) for formula Corrosion ($91:D850) |
| `$7E:2F5C` | 2 | `FORMULA_XP_CRUSH` | Save | Alchemy Progression: Current experience points (0..99 XP) for formula Crush ($91:D850) |
| `$7E:2F5E` | 2 | `FORMULA_XP_CURE` | Save | Alchemy Progression: Current experience points (0..99 XP) for formula Cure ($91:D850) |
| `$7E:2F60` | 2 | `FORMULA_XP_DEFEND` | Save | Alchemy Progression: Current experience points (0..99 XP) for formula Defend ($91:D850) |
| `$7E:2F62` | 2 | `FORMULA_XP_DOUBLE_DRAIN` | Save | Alchemy Progression: Current experience points (0..99 XP) for formula Double Drain ($91:D850) |
| `$7E:2F64` | 2 | `FORMULA_XP_DRAIN` | Save | Alchemy Progression: Current experience points (0..99 XP) for formula Drain ($91:D850) |
| `$7E:2F66` | 2 | `FORMULA_XP_ENERGIZE` | Save | Alchemy Progression: Current experience points (0..99 XP) for formula Energize ($91:D850) |
| `$7E:2F68` | 2 | `FORMULA_XP_ESCAPE` | Save | Alchemy Progression: Current experience points (0..99 XP) for formula Escape ($91:D850) |
| `$7E:2F6A` | 2 | `FORMULA_XP_EXPLOSION` | Save | Alchemy Progression: Current experience points (0..99 XP) for formula Explosion ($91:D850) |
| `$7E:2F6C` | 2 | `FORMULA_XP_FIREBALL` | Save | Alchemy Progression: Current experience points (0..99 XP) for formula Fireball ($91:D850) |
| `$7E:2F6E` | 2 | `FORMULA_XP_FIRE_POWER` | Save | Alchemy Progression: Current experience points (0..99 XP) for formula Fire Power ($91:D850) |
| `$7E:2F70` | 2 | `FORMULA_XP_FLASH` | Save | Alchemy Progression: Current experience points (0..99 XP) for formula Flash ($91:D850) |
| `$7E:2F72` | 2 | `FORMULA_XP_FORCE_FIELD` | Save | Alchemy Progression: Current experience points (0..99 XP) for formula Force Field ($91:D850) |
| `$7E:2F74` | 2 | `FORMULA_XP_HARD_BALL` | Save | Alchemy Progression: Current experience points (0..99 XP) for formula Hard Ball ($91:D850) |
| `$7E:2F76` | 2 | `FORMULA_XP_HEAL` | Save | Alchemy Progression: Current experience points (0..99 XP) for formula Heal ($91:D850) |
| `$7E:2F78` | 2 | `FORMULA_XP_LANCE` | Save | Alchemy Progression: Current experience points (0..99 XP) for formula Lance ($91:D850) |
| `$7E:2F7A` | 2 | `FORMULA_XP_LASER` | Save | Alchemy Progression: Current experience points (0..99 XP) for formula Laser ($91:D850) |
| `$7E:2F7C` | 2 | `FORMULA_XP_LEVITATE` | Save | Alchemy Progression: Current experience points (0..99 XP) for formula Levitate ($91:D850) |
| `$7E:2F7E` | 2 | `FORMULA_XP_LIGHTNING_STORM` | Save | Alchemy Progression: Current experience points (0..99 XP) for formula Lightning Storm ($91:D850) |
| `$7E:2F80` | 2 | `FORMULA_XP_MIRACLE_CURE` | Save | Alchemy Progression: Current experience points (0..99 XP) for formula Miracle Cure ($91:D850) |
| `$7E:2F82` | 2 | `FORMULA_XP_NITRO` | Save | Alchemy Progression: Current experience points (0..99 XP) for formula Nitro ($91:D850) |
| `$7E:2F84` | 2 | `FORMULA_XP_ONE_UP` | Save | Alchemy Progression: Current experience points (0..99 XP) for formula One Up ($91:D850) |
| `$7E:2F86` | 2 | `FORMULA_XP_REFLECT` | Save | Alchemy Progression: Current experience points (0..99 XP) for formula Reflect ($91:D850) |
| `$7E:2F88` | 2 | `FORMULA_XP_REGROWTH` | Save | Alchemy Progression: Current experience points (0..99 XP) for formula Regrowth ($91:D850) |
| `$7E:2F8A` | 2 | `FORMULA_XP_REVEALER` | Save | Alchemy Progression: Current experience points (0..99 XP) for formula Revealer ($91:D850) |
| `$7E:2F8C` | 2 | `FORMULA_XP_REVIVE` | Save | Alchemy Progression: Current experience points (0..99 XP) for formula Revive ($91:D850) |
| `$7E:2F8E` | 2 | `FORMULA_XP_SLOW_BURN` | Save | Alchemy Progression: Current experience points (0..99 XP) for formula Slow Burn ($91:D850) |
| `$7E:2F90` | 2 | `FORMULA_XP_SPEED` | Save | Alchemy Progression: Current experience points (0..99 XP) for formula Speed ($91:D850) |
| `$7E:2F92` | 2 | `FORMULA_XP_STING` | Save | Alchemy Progression: Current experience points (0..99 XP) for formula Sting ($91:D850) |
| `$7E:2F94` | 2 | `FORMULA_XP_STOP` | Save | Alchemy Progression: Current experience points (0..99 XP) for formula Stop ($91:D850) |
| `$7E:2F96` | 2 | `FORMULA_XP_SUPER_HEAL` | Save | Alchemy Progression: Current experience points (0..99 XP) for formula Super Heal ($91:D850) |
| `$7E:2F98` | 70 bytes | `FORMULA_COMBAT_POWER_ARRAY` | Save | 35-formula combat power ratings array (Acid Rain through Super Heal; $91:ADD0, $8D:C70D). |
| `$7E:2FDE` | 2 | `FORMULA_USAGE_ACID_RAIN` | Save | Alchemy Statistics: Total lifetime casts counter for formula Acid Rain ($91:D800) |
| `$7E:2FE0` | 2 | `FORMULA_USAGE_ATLAS` | Save | Alchemy Statistics: Total lifetime casts counter for formula Atlas ($91:D800) |
| `$7E:2FE2` | 2 | `FORMULA_USAGE_BARRIER` | Save | Alchemy Statistics: Total lifetime casts counter for formula Barrier ($91:D800) |
| `$7E:2FE4` | 2 | `FORMULA_USAGE_CALL_UP` | Save | Alchemy Statistics: Total lifetime casts counter for formula Call Up ($91:D800) |
| `$7E:2FE6` | 2 | `FORMULA_USAGE_CORROSION` | Save | Alchemy Statistics: Total lifetime casts counter for formula Corrosion ($91:D800) |
| `$7E:2FE8` | 2 | `FORMULA_USAGE_CRUSH` | Save | Alchemy Statistics: Total lifetime casts counter for formula Crush ($91:D800) |
| `$7E:2FEA` | 2 | `FORMULA_USAGE_CURE` | Save | Alchemy Statistics: Total lifetime casts counter for formula Cure ($91:D800) |
| `$7E:2FEC` | 2 | `FORMULA_USAGE_DEFEND` | Save | Alchemy Statistics: Total lifetime casts counter for formula Defend ($91:D800) |
| `$7E:2FEE` | 2 | `FORMULA_USAGE_DOUBLE_DRAIN` | Save | Alchemy Statistics: Total lifetime casts counter for formula Double Drain ($91:D800) |
| `$7E:2FF0` | 2 | `FORMULA_USAGE_DRAIN` | Save | Alchemy Statistics: Total lifetime casts counter for formula Drain ($91:D800) |
| `$7E:2FF2` | 2 | `FORMULA_USAGE_ENERGIZE` | Save | Alchemy Statistics: Total lifetime casts counter for formula Energize ($91:D800) |
| `$7E:2FF4` | String[16] | `CURRENCY_FORMATTED_STRING_BUF` | Frame | UI Subsystem: Formatted decimal string output buffer for currency window ($80:B21F / $8C:E628) |
| `$7E:2FF6` | 2 | `FORMULA_USAGE_EXPLOSION` | Save | Alchemy Statistics: Total lifetime casts counter for formula Explosion ($91:D800) |
| `$7E:2FF8` | 2 | `FORMULA_USAGE_FIREBALL` | Save | Alchemy Statistics: Total lifetime casts counter for formula Fireball ($91:D800) |
| `$7E:2FFA` | 2 | `FORMULA_USAGE_FIRE_POWER` | Save | Alchemy Statistics: Total lifetime casts counter for formula Fire Power ($91:D800) |
| `$7E:2FFC` | 2 | `FORMULA_USAGE_FLASH` | Save | Alchemy Statistics: Total lifetime casts counter for formula Flash ($91:D800) |
| `$7E:2FFE` | 2 | `FORMULA_USAGE_FORCE_FIELD` | Save | Alchemy Statistics: Total lifetime casts counter for formula Force Field ($91:D800) |
| `$7E:3000` | 2 | `FORMULA_USAGE_HARD_BALL` | Save | Alchemy Statistics: Total lifetime casts counter for formula Hard Ball ($91:D800) |
| `$7E:3002` | 2 | `FORMULA_USAGE_HEAL` | Save | Alchemy Statistics: Total lifetime casts counter for formula Heal ($91:D800) |
| `$7E:3004` | 2 | `FORMULA_USAGE_LANCE` | Save | Alchemy Statistics: Total lifetime casts counter for formula Lance ($91:D800) |
| `$7E:3006` | 2 | `FORMULA_USAGE_LASER` | Save | Alchemy Statistics: Total lifetime casts counter for formula Laser ($91:D800) |
| `$7E:3008` | 2 | `FORMULA_USAGE_LEVITATE` | Save | Alchemy Statistics: Total lifetime casts counter for formula Levitate ($91:D800) |
| `$7E:300A` | 2 | `FORMULA_USAGE_LIGHTNING_STORM` | Save | Alchemy Statistics: Total lifetime casts counter for formula Lightning Storm ($91:D800) |
| `$7E:300C` | 2 | `FORMULA_USAGE_MIRACLE_CURE` | Save | Alchemy Statistics: Total lifetime casts counter for formula Miracle Cure ($91:D800) |
| `$7E:300E` | 2 | `FORMULA_USAGE_NITRO` | Save | Alchemy Statistics: Total lifetime casts counter for formula Nitro ($91:D800) |
| `$7E:3010` | 2 | `FORMULA_USAGE_ONE_UP` | Save | Alchemy Statistics: Total lifetime casts counter for formula One Up ($91:D800) |
| `$7E:3012` | 2 | `FORMULA_USAGE_REFLECT` | Save | Alchemy Statistics: Total lifetime casts counter for formula Reflect ($91:D800) |
| `$7E:3014` | 2 | `FORMULA_USAGE_REGROWTH` | Save | Alchemy Statistics: Total lifetime casts counter for formula Regrowth ($91:D800) |
| `$7E:3016` | 2 | `FORMULA_USAGE_REVEALER` | Save | Alchemy Statistics: Total lifetime casts counter for formula Revealer ($91:D800) |
| `$7E:3018` | 2 | `FORMULA_USAGE_REVIVE` | Save | Alchemy Statistics: Total lifetime casts counter for formula Revive ($91:D800) |
| `$7E:301A` | 2 | `FORMULA_USAGE_SLOW_BURN` | Save | Alchemy Statistics: Total lifetime casts counter for formula Slow Burn ($91:D800) |
| `$7E:301C` | 2 | `FORMULA_USAGE_SPEED` | Save | Alchemy Statistics: Total lifetime casts counter for formula Speed ($91:D800) |
| `$7E:301E` | 2 | `FORMULA_USAGE_STING` | Save | Alchemy Statistics: Total lifetime casts counter for formula Sting ($91:D800) |
| `$7E:3020` | 2 | `FORMULA_USAGE_STOP` | Save | Alchemy Statistics: Total lifetime casts counter for formula Stop ($91:D800) |
| `$7E:3022` | 2 | `FORMULA_USAGE_SUPER_HEAL` | Save | Alchemy Statistics: Total lifetime casts counter for formula Super Heal ($91:D800) |
| `$7E:3074` | 512 bytes | `HUD_POPUP_TEXT_SLOTS` | Room | Floating combat text and HUD notification popup ring buffer (8 slots × 64 bytes) |
| `$7E:3294` | 208 bytes | `SPELL_EFFECT_EMITTER_SLOTS` | Room | Active spell particle and effect emitter slots (8 slots × 26 bytes) |
| `$7E:3364` | struct AnimAlchemySlot[8] | `ANIM_ALCHEMY_SLOTS_BASE` | Room | Combat Engine: 8-slot Animation Alchemy active array (stride $40=64 bytes; +$0E timer, +$12 spell ID, +$26 active flag, +$28 src, +$2A power) |
| `$7E:3564` | struct ProjAlchemySlot[8] | `PROJ_ALCHEMY_SLOTS_BASE` | Room | Combat Engine: 8-slot Projectile Alchemy active array (stride $76=118 bytes; +$12 spell ID, +$26 active flag, +$28 src, +$2A power, +$2E target) |
| `$7E:3578` | `Word` | `particle_slot_0_active` | `Frame` | Particle / projectile animation slot 0 active execution flag (+0x14 in $7E:3564, reset in $91:97AF). |
| `$7E:35EE` | `Word` | `particle_slot_1_active` | `Frame` | Particle / projectile animation slot 1 active execution flag (+0x14 in $7E:35DA, reset in $91:97AF). |
| `$7E:3664` | `Word` | `particle_slot_2_active` | `Frame` | Particle / projectile animation slot 2 active execution flag (+0x14 in $7E:3650, reset in $91:97AF). |
| `$7E:36DA` | `Word` | `particle_slot_3_active` | `Frame` | Particle / projectile animation slot 3 active execution flag (+0x14 in $7E:36C6, reset in $91:97AF). |
| `$7E:3750` | `Word` | `particle_slot_4_active` | `Frame` | Particle / projectile animation slot 4 active execution flag (+0x14 in $7E:373C, reset in $91:97AF). |
| `$7E:37C6` | `Word` | `particle_slot_5_active` | `Frame` | Particle / projectile animation slot 5 active execution flag (+0x14 in $7E:37B2, reset in $91:97AF). |
| `$7E:383C` | `Word` | `particle_slot_6_active` | `Frame` | Particle / projectile animation slot 6 active execution flag (+0x14 in $7E:3828, reset in $91:97AF). |
| `$7E:38B2` | `Word` | `particle_slot_7_active` | `Frame` | Particle / projectile animation slot 7 active execution flag (+0x14 in $7E:389E, reset in $91:97AF). |
| `$7E:3A3E` | `Byte×64` | `damage_popup_boy_node` | `Frame` | Player 1 (Boy) floating combat damage numbers & status popup node (stride 64 bytes: screen X, Y, value, lifetime ticks). |
| `$7E:3A7E` | `Byte×64` | `damage_popup_dog_node` | `Frame` | Player 2 (Dog) floating combat damage numbers & status popup node (stride 64 bytes: screen X, Y, value, lifetime ticks). |
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
| `$7E:3C71` | `Word` | `boss_segment_target_x` | `Room` | Target world X coordinate for tracking boss limb / satellite entity ($8C:D253). |
| `$7E:3C73` | `Word` | `boss_segment_target_y` | `Room` | Target world Y coordinate for tracking boss limb / satellite entity ($8C:D25D). |
| `$7E:3C75` | `Word` | `boss_segment_offset_x` | `Room` | Horizontal joint attachment offset X from parent boss body ($8F:9C41). |
| `$7E:3C77` | `Word` | `boss_segment_offset_y` | `Room` | Vertical joint attachment offset Y from parent boss body ($8F:9C46). |
| `$7E:3C7B` | `Byte×89` | `boss_segment_slot_2` | `Room` | Boss child segment slot 2 descriptor (89 bytes: joint offset, angle, limb anim state). |
| `$7E:3CAB` | `Word` | `boss_segment_limb_angle` | `Room` | Rotational articulation angle index for connected boss limb ($8F:A732). |
| `$7E:3CAC` | `Byte` | `boss_segment_anim_frame` | `Room` | Current sprite animation sequence frame index for boss child segment ($8F:A73A). |
| `$7E:3CAD` | `Byte` | `boss_segment_flash_timer` | `Room` | Hit flash color inversion timer ticks for multipart boss limb ($8F:A7C8). |
| `$7E:3CAE` | `Word` | `boss_segment_collision_box` | `Room` | Hitbox / hurtbox boundary dimension flags for child segment ($8F:9958). |
| `$7E:3CD4` | `Byte×89` | `boss_segment_slot_3` | `Room` | Boss child segment slot 3 descriptor (89 bytes: free link, joint offsets, parent ptr). |
| `$7E:3D1D` | `Word` | `boss_segment_3_status` | `Room` | Boss segment 3 active status flags / limb damage accumulator. |
| `$7E:3D1F` | `Word` | `boss_segment_3_parent_ptr` | `Room` | Boss segment 3 pointer referencing primary parent boss entity slot. |
| `$7E:3D2D` | `Byte×89` | `boss_segment_slot_4` | `Room` | Boss child segment slot 4 descriptor (89 bytes: free link, joint offsets, parent ptr). |
| `$7E:3D86` | `Byte×89` | `boss_segment_slot_5` | `Room` | Boss child segment slot 5 descriptor (89 bytes: free link, joint offsets, parent ptr). |
| `$7E:3DDF` | 2 bytes | `ACTIVE_ENTITY_HEAD` | Room | Head pointer of linked list chaining all active entities in current room. |
| `$7E:3DE5` | 142 | `ENTITY_SLOT_00_BASE` | Room | Entity Pool: Actor entity slot 0 base (142 bytes). |
| `$7E:3DFF` | 2 bytes | `ENTITY_SLOT_00_POS_X` | Room | Entity slot 0 current horizontal world position in pixels (+0x1A in struct at 7E:3DE5). |
| `$7E:3E01` | 2 bytes | `ENTITY_SLOT_00_POS_Y` | Room | Entity slot 0 current vertical world position in pixels (+0x1C in struct at 7E:3DE5). |
| `$7E:3E07` | 2 bytes | `ENTITY_SLOT_00_FACING` | Room | Entity slot 0 facing direction enum (0=N, 2=NE, 4=E, 6=SE, 8=S, 10=SW, 12=W, 14=NW; +0x22 in struct at 7E:3DE5). |
| `$7E:3E0F` | 2 bytes | `ENTITY_SLOT_00_HP` | Room | Entity Pool: Actor entity slot 0 current hit points (+0x2A in struct, 0 = inactive / dead; checked by ai_pick_target and func_8FC237). |
| `$7E:3E11` | 2 bytes | `ENTITY_SLOT_00_MAX_HP` | Room | Entity slot 0 maximum hit points (+0x2C in struct at 7E:3DE5). |
| `$7E:3E73` | 142 | `ENTITY_SLOT_01_BASE` | Room | Entity Pool: Actor entity slot 1 base (142 bytes). |
| `$7E:3E8D` | 2 bytes | `ENTITY_SLOT_01_POS_X` | Room | Entity slot 1 current horizontal world position in pixels (+0x1A in struct at 7E:3E73). |
| `$7E:3E8F` | 2 bytes | `ENTITY_SLOT_01_POS_Y` | Room | Entity slot 1 current vertical world position in pixels (+0x1C in struct at 7E:3E73). |
| `$7E:3E95` | 2 bytes | `ENTITY_SLOT_01_FACING` | Room | Entity slot 1 facing direction enum (0=N, 2=NE, 4=E, 6=SE, 8=S, 10=SW, 12=W, 14=NW; +0x22 in struct at 7E:3E73). |
| `$7E:3E9D` | 2 bytes | `ENTITY_SLOT_01_HP` | Room | Entity Pool: Actor entity slot 1 current hit points (+0x2A in struct, 0 = inactive / dead; checked by ai_pick_target and func_8FC237). |
| `$7E:3E9F` | 2 bytes | `ENTITY_SLOT_01_MAX_HP` | Room | Entity slot 1 maximum hit points (+0x2C in struct at 7E:3E73). |
| `$7E:3F01` | 142 | `ENTITY_SLOT_02_BASE` | Room | Entity Pool: Actor entity slot 2 base (142 bytes). |
| `$7E:3F1B` | 2 bytes | `ENTITY_SLOT_02_POS_X` | Room | Entity slot 2 current horizontal world position in pixels (+0x1A in struct at 7E:3F01). |
| `$7E:3F1D` | 2 bytes | `ENTITY_SLOT_02_POS_Y` | Room | Entity slot 2 current vertical world position in pixels (+0x1C in struct at 7E:3F01). |
| `$7E:3F23` | 2 bytes | `ENTITY_SLOT_02_FACING` | Room | Entity slot 2 facing direction enum (0=N, 2=NE, 4=E, 6=SE, 8=S, 10=SW, 12=W, 14=NW; +0x22 in struct at 7E:3F01). |
| `$7E:3F2B` | 2 bytes | `ENTITY_SLOT_02_HP` | Room | Entity Pool: Actor entity slot 2 current hit points (+0x2A in struct, 0 = inactive / dead; checked by ai_pick_target and func_8FC237). |
| `$7E:3F2D` | 2 bytes | `ENTITY_SLOT_02_MAX_HP` | Room | Entity slot 2 maximum hit points (+0x2C in struct at 7E:3F01). |
| `$7E:3F8F` | 142 | `ENTITY_SLOT_03_BASE` | Room | Entity Pool: Actor entity slot 3 base (142 bytes). |
| `$7E:3FA9` | 2 bytes | `ENTITY_SLOT_03_POS_X` | Room | Entity slot 3 current horizontal world position in pixels (+0x1A in struct at 7E:3F8F). |
| `$7E:3FAB` | 2 bytes | `ENTITY_SLOT_03_POS_Y` | Room | Entity slot 3 current vertical world position in pixels (+0x1C in struct at 7E:3F8F). |
| `$7E:3FB1` | 2 bytes | `ENTITY_SLOT_03_FACING` | Room | Entity slot 3 facing direction enum (0=N, 2=NE, 4=E, 6=SE, 8=S, 10=SW, 12=W, 14=NW; +0x22 in struct at 7E:3F8F). |
| `$7E:3FB9` | 2 bytes | `ENTITY_SLOT_03_HP` | Room | Entity Pool: Actor entity slot 3 current hit points (+0x2A in struct, 0 = inactive / dead; checked by ai_pick_target and func_8FC237). |
| `$7E:3FBB` | 2 bytes | `ENTITY_SLOT_03_MAX_HP` | Room | Entity slot 3 maximum hit points (+0x2C in struct at 7E:3F8F). |
| `$7E:401D` | 142 | `ENTITY_SLOT_04_BASE` | Room | Entity Pool: Actor entity slot 4 base (142 bytes). |
| `$7E:4037` | 2 bytes | `ENTITY_SLOT_04_POS_X` | Room | Entity slot 4 current horizontal world position in pixels (+0x1A in struct at 7E:401D). |
| `$7E:4039` | 2 bytes | `ENTITY_SLOT_04_POS_Y` | Room | Entity slot 4 current vertical world position in pixels (+0x1C in struct at 7E:401D). |
| `$7E:403F` | 2 bytes | `ENTITY_SLOT_04_FACING` | Room | Entity slot 4 facing direction enum (0=N, 2=NE, 4=E, 6=SE, 8=S, 10=SW, 12=W, 14=NW; +0x22 in struct at 7E:401D). |
| `$7E:4047` | 2 bytes | `ENTITY_SLOT_04_HP` | Room | Entity Pool: Actor entity slot 4 current hit points (+0x2A in struct, 0 = inactive / dead; checked by ai_pick_target and func_8FC237). |
| `$7E:4049` | 2 bytes | `ENTITY_SLOT_04_MAX_HP` | Room | Entity slot 4 maximum hit points (+0x2C in struct at 7E:401D). |
| `$7E:40AB` | 142 | `ENTITY_SLOT_05_BASE` | Room | Entity Pool: Actor entity slot 5 base (142 bytes). |
| `$7E:40C5` | 2 bytes | `ENTITY_SLOT_05_POS_X` | Room | Entity slot 5 current horizontal world position in pixels (+0x1A in struct at 7E:40AB). |
| `$7E:40C7` | 2 bytes | `ENTITY_SLOT_05_POS_Y` | Room | Entity slot 5 current vertical world position in pixels (+0x1C in struct at 7E:40AB). |
| `$7E:40CD` | 2 bytes | `ENTITY_SLOT_05_FACING` | Room | Entity slot 5 facing direction enum (0=N, 2=NE, 4=E, 6=SE, 8=S, 10=SW, 12=W, 14=NW; +0x22 in struct at 7E:40AB). |
| `$7E:40D5` | 2 bytes | `ENTITY_SLOT_05_HP` | Room | Entity Pool: Actor entity slot 5 current hit points (+0x2A in struct, 0 = inactive / dead; checked by ai_pick_target and func_8FC237). |
| `$7E:40D7` | 2 bytes | `ENTITY_SLOT_05_MAX_HP` | Room | Entity slot 5 maximum hit points (+0x2C in struct at 7E:40AB). |
| `$7E:4139` | 142 | `ENTITY_SLOT_06_BASE` | Room | Entity Pool: Actor entity slot 6 base (142 bytes). |
| `$7E:4153` | 2 bytes | `ENTITY_SLOT_06_POS_X` | Room | Entity slot 6 current horizontal world position in pixels (+0x1A in struct at 7E:4139). |
| `$7E:4155` | 2 bytes | `ENTITY_SLOT_06_POS_Y` | Room | Entity slot 6 current vertical world position in pixels (+0x1C in struct at 7E:4139). |
| `$7E:415B` | 2 bytes | `ENTITY_SLOT_06_FACING` | Room | Entity slot 6 facing direction enum (0=N, 2=NE, 4=E, 6=SE, 8=S, 10=SW, 12=W, 14=NW; +0x22 in struct at 7E:4139). |
| `$7E:4163` | 2 bytes | `ENTITY_SLOT_06_HP` | Room | Entity Pool: Actor entity slot 6 current hit points (+0x2A in struct, 0 = inactive / dead; checked by ai_pick_target and func_8FC237). |
| `$7E:4165` | 2 bytes | `ENTITY_SLOT_06_MAX_HP` | Room | Entity slot 6 maximum hit points (+0x2C in struct at 7E:4139). |
| `$7E:41C7` | 142 | `ENTITY_SLOT_07_BASE` | Room | Entity Pool: Actor entity slot 7 base (142 bytes). |
| `$7E:41E1` | 2 bytes | `ENTITY_SLOT_07_POS_X` | Room | Entity slot 7 current horizontal world position in pixels (+0x1A in struct at 7E:41C7). |
| `$7E:41E3` | 2 bytes | `ENTITY_SLOT_07_POS_Y` | Room | Entity slot 7 current vertical world position in pixels (+0x1C in struct at 7E:41C7). |
| `$7E:41E9` | 2 bytes | `ENTITY_SLOT_07_FACING` | Room | Entity slot 7 facing direction enum (0=N, 2=NE, 4=E, 6=SE, 8=S, 10=SW, 12=W, 14=NW; +0x22 in struct at 7E:41C7). |
| `$7E:41F1` | 2 bytes | `ENTITY_SLOT_07_HP` | Room | Entity Pool: Actor entity slot 7 current hit points (+0x2A in struct, 0 = inactive / dead; checked by ai_pick_target and func_8FC237). |
| `$7E:41F3` | 2 bytes | `ENTITY_SLOT_07_MAX_HP` | Room | Entity slot 7 maximum hit points (+0x2C in struct at 7E:41C7). |
| `$7E:4255` | 142 | `ENTITY_SLOT_08_BASE` | Room | Entity Pool: Actor entity slot 8 base (142 bytes). |
| `$7E:426F` | 2 bytes | `ENTITY_SLOT_08_POS_X` | Room | Entity slot 8 current horizontal world position in pixels (+0x1A in struct at 7E:4255). |
| `$7E:4271` | 2 bytes | `ENTITY_SLOT_08_POS_Y` | Room | Entity slot 8 current vertical world position in pixels (+0x1C in struct at 7E:4255). |
| `$7E:4277` | 2 bytes | `ENTITY_SLOT_08_FACING` | Room | Entity slot 8 facing direction enum (0=N, 2=NE, 4=E, 6=SE, 8=S, 10=SW, 12=W, 14=NW; +0x22 in struct at 7E:4255). |
| `$7E:427F` | 2 bytes | `ENTITY_SLOT_08_HP` | Room | Entity Pool: Actor entity slot 8 current hit points (+0x2A in struct, 0 = inactive / dead; checked by ai_pick_target and func_8FC237). |
| `$7E:4281` | 2 bytes | `ENTITY_SLOT_08_MAX_HP` | Room | Entity slot 8 maximum hit points (+0x2C in struct at 7E:4255). |
| `$7E:42E3` | 142 | `ENTITY_SLOT_09_BASE` | Room | Entity Pool: Actor entity slot 9 base (142 bytes). |
| `$7E:42FD` | 2 bytes | `ENTITY_SLOT_09_POS_X` | Room | Entity slot 9 current horizontal world position in pixels (+0x1A in struct at 7E:42E3). |
| `$7E:42FF` | 2 bytes | `ENTITY_SLOT_09_POS_Y` | Room | Entity slot 9 current vertical world position in pixels (+0x1C in struct at 7E:42E3). |
| `$7E:4305` | 2 bytes | `ENTITY_SLOT_09_FACING` | Room | Entity slot 9 facing direction enum (0=N, 2=NE, 4=E, 6=SE, 8=S, 10=SW, 12=W, 14=NW; +0x22 in struct at 7E:42E3). |
| `$7E:430D` | 2 bytes | `ENTITY_SLOT_09_HP` | Room | Entity Pool: Actor entity slot 9 current hit points (+0x2A in struct, 0 = inactive / dead; checked by ai_pick_target and func_8FC237). |
| `$7E:430F` | 2 bytes | `ENTITY_SLOT_09_MAX_HP` | Room | Entity slot 9 maximum hit points (+0x2C in struct at 7E:42E3). |
| `$7E:4371` | 142 | `ENTITY_SLOT_10_BASE` | Room | Entity Pool: Actor entity slot 10 base (142 bytes). |
| `$7E:438B` | 2 bytes | `ENTITY_SLOT_10_POS_X` | Room | Entity slot 10 current horizontal world position in pixels (+0x1A in struct at 7E:4371). |
| `$7E:438D` | 2 bytes | `ENTITY_SLOT_10_POS_Y` | Room | Entity slot 10 current vertical world position in pixels (+0x1C in struct at 7E:4371). |
| `$7E:4393` | 2 bytes | `ENTITY_SLOT_10_FACING` | Room | Entity slot 10 facing direction enum (0=N, 2=NE, 4=E, 6=SE, 8=S, 10=SW, 12=W, 14=NW; +0x22 in struct at 7E:4371). |
| `$7E:439B` | 2 bytes | `ENTITY_SLOT_10_HP` | Room | Entity Pool: Actor entity slot 10 current hit points (+0x2A in struct, 0 = inactive / dead; checked by ai_pick_target and func_8FC237). |
| `$7E:439D` | 2 bytes | `ENTITY_SLOT_10_MAX_HP` | Room | Entity slot 10 maximum hit points (+0x2C in struct at 7E:4371). |
| `$7E:43FF` | 142 | `ENTITY_SLOT_11_BASE` | Room | Entity Pool: Actor entity slot 11 base (142 bytes). |
| `$7E:4419` | 2 bytes | `ENTITY_SLOT_11_POS_X` | Room | Entity slot 11 current horizontal world position in pixels (+0x1A in struct at 7E:43FF). |
| `$7E:441B` | 2 bytes | `ENTITY_SLOT_11_POS_Y` | Room | Entity slot 11 current vertical world position in pixels (+0x1C in struct at 7E:43FF). |
| `$7E:4421` | 2 bytes | `ENTITY_SLOT_11_FACING` | Room | Entity slot 11 facing direction enum (0=N, 2=NE, 4=E, 6=SE, 8=S, 10=SW, 12=W, 14=NW; +0x22 in struct at 7E:43FF). |
| `$7E:4429` | 2 bytes | `ENTITY_SLOT_11_HP` | Room | Entity Pool: Actor entity slot 11 current hit points (+0x2A in struct, 0 = inactive / dead; checked by ai_pick_target and func_8FC237). |
| `$7E:442B` | 2 bytes | `ENTITY_SLOT_11_MAX_HP` | Room | Entity slot 11 maximum hit points (+0x2C in struct at 7E:43FF). |
| `$7E:448D` | 142 | `ENTITY_SLOT_12_BASE` | Room | Entity Pool: Actor entity slot 12 base (142 bytes). |
| `$7E:44A7` | 2 bytes | `ENTITY_SLOT_12_POS_X` | Room | Entity slot 12 current horizontal world position in pixels (+0x1A in struct at 7E:448D). |
| `$7E:44A9` | 2 bytes | `ENTITY_SLOT_12_POS_Y` | Room | Entity slot 12 current vertical world position in pixels (+0x1C in struct at 7E:448D). |
| `$7E:44AF` | 2 bytes | `ENTITY_SLOT_12_FACING` | Room | Entity slot 12 facing direction enum (0=N, 2=NE, 4=E, 6=SE, 8=S, 10=SW, 12=W, 14=NW; +0x22 in struct at 7E:448D). |
| `$7E:44B7` | 2 bytes | `ENTITY_SLOT_12_HP` | Room | Entity Pool: Actor entity slot 12 current hit points (+0x2A in struct, 0 = inactive / dead; checked by ai_pick_target and func_8FC237). |
| `$7E:44B9` | 2 bytes | `ENTITY_SLOT_12_MAX_HP` | Room | Entity slot 12 maximum hit points (+0x2C in struct at 7E:448D). |
| `$7E:451B` | 142 | `ENTITY_SLOT_13_BASE` | Room | Entity Pool: Actor entity slot 13 base (142 bytes). |
| `$7E:4535` | 2 bytes | `ENTITY_SLOT_13_POS_X` | Room | Entity slot 13 current horizontal world position in pixels (+0x1A in struct at 7E:451B). |
| `$7E:4537` | 2 bytes | `ENTITY_SLOT_13_POS_Y` | Room | Entity slot 13 current vertical world position in pixels (+0x1C in struct at 7E:451B). |
| `$7E:453D` | 2 bytes | `ENTITY_SLOT_13_FACING` | Room | Entity slot 13 facing direction enum (0=N, 2=NE, 4=E, 6=SE, 8=S, 10=SW, 12=W, 14=NW; +0x22 in struct at 7E:451B). |
| `$7E:4545` | 2 bytes | `ENTITY_SLOT_13_HP` | Room | Entity Pool: Actor entity slot 13 current hit points (+0x2A in struct, 0 = inactive / dead; checked by ai_pick_target and func_8FC237). |
| `$7E:4547` | 2 bytes | `ENTITY_SLOT_13_MAX_HP` | Room | Entity slot 13 maximum hit points (+0x2C in struct at 7E:451B). |
| `$7E:45A9` | 142 | `ENTITY_SLOT_14_BASE` | Room | Entity Pool: Actor entity slot 14 base (142 bytes). |
| `$7E:45C3` | 2 bytes | `ENTITY_SLOT_14_POS_X` | Room | Entity slot 14 current horizontal world position in pixels (+0x1A in struct at 7E:45A9). |
| `$7E:45C5` | 2 bytes | `ENTITY_SLOT_14_POS_Y` | Room | Entity slot 14 current vertical world position in pixels (+0x1C in struct at 7E:45A9). |
| `$7E:45CB` | 2 bytes | `ENTITY_SLOT_14_FACING` | Room | Entity slot 14 facing direction enum (0=N, 2=NE, 4=E, 6=SE, 8=S, 10=SW, 12=W, 14=NW; +0x22 in struct at 7E:45A9). |
| `$7E:45D3` | 2 bytes | `ENTITY_SLOT_14_HP` | Room | Entity Pool: Actor entity slot 14 current hit points (+0x2A in struct, 0 = inactive / dead; checked by ai_pick_target and func_8FC237). |
| `$7E:45D5` | 2 bytes | `ENTITY_SLOT_14_MAX_HP` | Room | Entity slot 14 maximum hit points (+0x2C in struct at 7E:45A9). |
| `$7E:4637` | 142 | `ENTITY_SLOT_15_BASE` | Room | Entity Pool: Actor entity slot 15 base (142 bytes). |
| `$7E:4651` | 2 bytes | `ENTITY_SLOT_15_POS_X` | Room | Entity slot 15 current horizontal world position in pixels (+0x1A in struct at 7E:4637). |
| `$7E:4653` | 2 bytes | `ENTITY_SLOT_15_POS_Y` | Room | Entity slot 15 current vertical world position in pixels (+0x1C in struct at 7E:4637). |
| `$7E:4659` | 2 bytes | `ENTITY_SLOT_15_FACING` | Room | Entity slot 15 facing direction enum (0=N, 2=NE, 4=E, 6=SE, 8=S, 10=SW, 12=W, 14=NW; +0x22 in struct at 7E:4637). |
| `$7E:4661` | 2 bytes | `ENTITY_SLOT_15_HP` | Room | Entity Pool: Actor entity slot 15 current hit points (+0x2A in struct, 0 = inactive / dead; checked by ai_pick_target and func_8FC237). |
| `$7E:4663` | 2 bytes | `ENTITY_SLOT_15_MAX_HP` | Room | Entity slot 15 maximum hit points (+0x2C in struct at 7E:4637). |
| `$7E:46C5` | 142 | `ENTITY_SLOT_16_BASE` | Room | Entity Pool: Actor entity slot 16 base (142 bytes). |
| `$7E:46DF` | 2 bytes | `ENTITY_SLOT_16_POS_X` | Room | Entity slot 16 current horizontal world position in pixels (+0x1A in struct at 7E:46C5). |
| `$7E:46E1` | 2 bytes | `ENTITY_SLOT_16_POS_Y` | Room | Entity slot 16 current vertical world position in pixels (+0x1C in struct at 7E:46C5). |
| `$7E:46E7` | 2 bytes | `ENTITY_SLOT_16_FACING` | Room | Entity slot 16 facing direction enum (0=N, 2=NE, 4=E, 6=SE, 8=S, 10=SW, 12=W, 14=NW; +0x22 in struct at 7E:46C5). |
| `$7E:46EF` | 2 bytes | `ENTITY_SLOT_16_HP` | Room | Entity Pool: Actor entity slot 16 current hit points (+0x2A in struct, 0 = inactive / dead; checked by ai_pick_target and func_8FC237). |
| `$7E:46F1` | 2 bytes | `ENTITY_SLOT_16_MAX_HP` | Room | Entity slot 16 maximum hit points (+0x2C in struct at 7E:46C5). |
| `$7E:4753` | 142 | `ENTITY_SLOT_17_BASE` | Room | Entity Pool: Actor entity slot 17 base (142 bytes). |
| `$7E:476D` | 2 bytes | `ENTITY_SLOT_17_POS_X` | Room | Entity slot 17 current horizontal world position in pixels (+0x1A in struct at 7E:4753). |
| `$7E:476F` | 2 bytes | `ENTITY_SLOT_17_POS_Y` | Room | Entity slot 17 current vertical world position in pixels (+0x1C in struct at 7E:4753). |
| `$7E:4775` | 2 bytes | `ENTITY_SLOT_17_FACING` | Room | Entity slot 17 facing direction enum (0=N, 2=NE, 4=E, 6=SE, 8=S, 10=SW, 12=W, 14=NW; +0x22 in struct at 7E:4753). |
| `$7E:477D` | 2 bytes | `ENTITY_SLOT_17_HP` | Room | Entity Pool: Actor entity slot 17 current hit points (+0x2A in struct, 0 = inactive / dead; checked by ai_pick_target and func_8FC237). |
| `$7E:477F` | 2 bytes | `ENTITY_SLOT_17_MAX_HP` | Room | Entity slot 17 maximum hit points (+0x2C in struct at 7E:4753). |
| `$7E:47E1` | 142 | `ENTITY_SLOT_18_BASE` | Room | Entity Pool: Actor entity slot 18 base (142 bytes). |
| `$7E:47FB` | 2 bytes | `ENTITY_SLOT_18_POS_X` | Room | Entity slot 18 current horizontal world position in pixels (+0x1A in struct at 7E:47E1). |
| `$7E:47FD` | 2 bytes | `ENTITY_SLOT_18_POS_Y` | Room | Entity slot 18 current vertical world position in pixels (+0x1C in struct at 7E:47E1). |
| `$7E:4803` | 2 bytes | `ENTITY_SLOT_18_FACING` | Room | Entity slot 18 facing direction enum (0=N, 2=NE, 4=E, 6=SE, 8=S, 10=SW, 12=W, 14=NW; +0x22 in struct at 7E:47E1). |
| `$7E:480B` | 2 bytes | `ENTITY_SLOT_18_HP` | Room | Entity Pool: Actor entity slot 18 current hit points (+0x2A in struct, 0 = inactive / dead; checked by ai_pick_target and func_8FC237). |
| `$7E:480D` | 2 bytes | `ENTITY_SLOT_18_MAX_HP` | Room | Entity slot 18 maximum hit points (+0x2C in struct at 7E:47E1). |
| `$7E:486F` | 142 | `ENTITY_SLOT_19_BASE` | Room | Entity Pool: Actor entity slot 19 base (142 bytes). |
| `$7E:4889` | 2 bytes | `ENTITY_SLOT_19_POS_X` | Room | Entity slot 19 current horizontal world position in pixels (+0x1A in struct at 7E:486F). |
| `$7E:488B` | 2 bytes | `ENTITY_SLOT_19_POS_Y` | Room | Entity slot 19 current vertical world position in pixels (+0x1C in struct at 7E:486F). |
| `$7E:4891` | 2 bytes | `ENTITY_SLOT_19_FACING` | Room | Entity slot 19 facing direction enum (0=N, 2=NE, 4=E, 6=SE, 8=S, 10=SW, 12=W, 14=NW; +0x22 in struct at 7E:486F). |
| `$7E:4899` | 2 bytes | `ENTITY_SLOT_19_HP` | Room | Entity Pool: Actor entity slot 19 current hit points (+0x2A in struct, 0 = inactive / dead; checked by ai_pick_target and func_8FC237). |
| `$7E:489B` | 2 bytes | `ENTITY_SLOT_19_MAX_HP` | Room | Entity slot 19 maximum hit points (+0x2C in struct at 7E:486F). |
| `$7E:48FD` | 142 | `ENTITY_SLOT_20_BASE` | Room | Entity Pool: Actor entity slot 20 base (142 bytes). |
| `$7E:4917` | 2 bytes | `ENTITY_SLOT_20_POS_X` | Room | Entity slot 20 current horizontal world position in pixels (+0x1A in struct at 7E:48FD). |
| `$7E:4919` | 2 bytes | `ENTITY_SLOT_20_POS_Y` | Room | Entity slot 20 current vertical world position in pixels (+0x1C in struct at 7E:48FD). |
| `$7E:491F` | 2 bytes | `ENTITY_SLOT_20_FACING` | Room | Entity slot 20 facing direction enum (0=N, 2=NE, 4=E, 6=SE, 8=S, 10=SW, 12=W, 14=NW; +0x22 in struct at 7E:48FD). |
| `$7E:4927` | 2 bytes | `ENTITY_SLOT_20_HP` | Room | Entity Pool: Actor entity slot 20 current hit points (+0x2A in struct, 0 = inactive / dead; checked by ai_pick_target and func_8FC237). |
| `$7E:4929` | 2 bytes | `ENTITY_SLOT_20_MAX_HP` | Room | Entity slot 20 maximum hit points (+0x2C in struct at 7E:48FD). |
| `$7E:498B` | 142 | `ENTITY_SLOT_21_BASE` | Room | Entity Pool: Actor entity slot 21 base (142 bytes). |
| `$7E:49A5` | 2 bytes | `ENTITY_SLOT_21_POS_X` | Room | Entity slot 21 current horizontal world position in pixels (+0x1A in struct at 7E:498B). |
| `$7E:49A7` | 2 bytes | `ENTITY_SLOT_21_POS_Y` | Room | Entity slot 21 current vertical world position in pixels (+0x1C in struct at 7E:498B). |
| `$7E:49AD` | 2 bytes | `ENTITY_SLOT_21_FACING` | Room | Entity slot 21 facing direction enum (0=N, 2=NE, 4=E, 6=SE, 8=S, 10=SW, 12=W, 14=NW; +0x22 in struct at 7E:498B). |
| `$7E:49B5` | 2 bytes | `ENTITY_SLOT_21_HP` | Room | Entity Pool: Actor entity slot 21 current hit points (+0x2A in struct, 0 = inactive / dead; checked by ai_pick_target and func_8FC237). |
| `$7E:49B7` | 2 bytes | `ENTITY_SLOT_21_MAX_HP` | Room | Entity slot 21 maximum hit points (+0x2C in struct at 7E:498B). |
| `$7E:4A19` | 142 | `ENTITY_SLOT_22_BASE` | Room | Entity Pool: Actor entity slot 22 base (142 bytes). |
| `$7E:4A33` | 2 bytes | `ENTITY_SLOT_22_POS_X` | Room | Entity slot 22 current horizontal world position in pixels (+0x1A in struct at 7E:4A19). |
| `$7E:4A35` | 2 bytes | `ENTITY_SLOT_22_POS_Y` | Room | Entity slot 22 current vertical world position in pixels (+0x1C in struct at 7E:4A19). |
| `$7E:4A3B` | 2 bytes | `ENTITY_SLOT_22_FACING` | Room | Entity slot 22 facing direction enum (0=N, 2=NE, 4=E, 6=SE, 8=S, 10=SW, 12=W, 14=NW; +0x22 in struct at 7E:4A19). |
| `$7E:4A43` | 2 bytes | `ENTITY_SLOT_22_HP` | Room | Entity Pool: Actor entity slot 22 current hit points (+0x2A in struct, 0 = inactive / dead; checked by ai_pick_target and func_8FC237). |
| `$7E:4A45` | 2 bytes | `ENTITY_SLOT_22_MAX_HP` | Room | Entity slot 22 maximum hit points (+0x2C in struct at 7E:4A19). |
| `$7E:4AA7` | 142 | `ENTITY_SLOT_23_BASE` | Room | Entity Pool: Actor entity slot 23 base (142 bytes). |
| `$7E:4AC1` | 2 bytes | `ENTITY_SLOT_23_POS_X` | Room | Entity slot 23 current horizontal world position in pixels (+0x1A in struct at 7E:4AA7). |
| `$7E:4AC3` | 2 bytes | `ENTITY_SLOT_23_POS_Y` | Room | Entity slot 23 current vertical world position in pixels (+0x1C in struct at 7E:4AA7). |
| `$7E:4AC9` | 2 bytes | `ENTITY_SLOT_23_FACING` | Room | Entity slot 23 facing direction enum (0=N, 2=NE, 4=E, 6=SE, 8=S, 10=SW, 12=W, 14=NW; +0x22 in struct at 7E:4AA7). |
| `$7E:4AD1` | 2 bytes | `ENTITY_SLOT_23_HP` | Room | Entity Pool: Actor entity slot 23 current hit points (+0x2A in struct, 0 = inactive / dead; checked by ai_pick_target and func_8FC237). |
| `$7E:4AD3` | 2 bytes | `ENTITY_SLOT_23_MAX_HP` | Room | Entity slot 23 maximum hit points (+0x2C in struct at 7E:4AA7). |
| `$7E:4B35` | 142 | `ENTITY_SLOT_24_BASE` | Room | Entity Pool: Actor entity slot 24 base (142 bytes). |
| `$7E:4B4F` | 2 bytes | `ENTITY_SLOT_24_POS_X` | Room | Entity slot 24 current horizontal world position in pixels (+0x1A in struct at 7E:4B35). |
| `$7E:4B51` | 2 bytes | `ENTITY_SLOT_24_POS_Y` | Room | Entity slot 24 current vertical world position in pixels (+0x1C in struct at 7E:4B35). |
| `$7E:4B57` | 2 bytes | `ENTITY_SLOT_24_FACING` | Room | Entity slot 24 facing direction enum (0=N, 2=NE, 4=E, 6=SE, 8=S, 10=SW, 12=W, 14=NW; +0x22 in struct at 7E:4B35). |
| `$7E:4B5F` | 2 bytes | `ENTITY_SLOT_24_HP` | Room | Entity Pool: Actor entity slot 24 current hit points (+0x2A in struct, 0 = inactive / dead; checked by ai_pick_target and func_8FC237). |
| `$7E:4B61` | 2 bytes | `ENTITY_SLOT_24_MAX_HP` | Room | Entity slot 24 maximum hit points (+0x2C in struct at 7E:4B35). |
| `$7E:4BC3` | 142 | `ENTITY_SLOT_25_BASE` | Room | Entity Pool: Actor entity slot 25 base (142 bytes). |
| `$7E:4BDD` | 2 bytes | `ENTITY_SLOT_25_POS_X` | Room | Entity slot 25 current horizontal world position in pixels (+0x1A in struct at 7E:4BC3). |
| `$7E:4BDF` | 2 bytes | `ENTITY_SLOT_25_POS_Y` | Room | Entity slot 25 current vertical world position in pixels (+0x1C in struct at 7E:4BC3). |
| `$7E:4BE5` | 2 bytes | `ENTITY_SLOT_25_FACING` | Room | Entity slot 25 facing direction enum (0=N, 2=NE, 4=E, 6=SE, 8=S, 10=SW, 12=W, 14=NW; +0x22 in struct at 7E:4BC3). |
| `$7E:4BED` | 2 bytes | `ENTITY_SLOT_25_HP` | Room | Entity Pool: Actor entity slot 25 current hit points (+0x2A in struct, 0 = inactive / dead; checked by ai_pick_target and func_8FC237). |
| `$7E:4BEF` | 2 bytes | `ENTITY_SLOT_25_MAX_HP` | Room | Entity slot 25 maximum hit points (+0x2C in struct at 7E:4BC3). |
| `$7E:4C51` | 142 | `ENTITY_SLOT_26_BASE` | Room | Entity Pool: Actor entity slot 26 base (142 bytes). |
| `$7E:4C6B` | 2 bytes | `ENTITY_SLOT_26_POS_X` | Room | Entity slot 26 current horizontal world position in pixels (+0x1A in struct at 7E:4C51). |
| `$7E:4C6D` | 2 bytes | `ENTITY_SLOT_26_POS_Y` | Room | Entity slot 26 current vertical world position in pixels (+0x1C in struct at 7E:4C51). |
| `$7E:4C73` | 2 bytes | `ENTITY_SLOT_26_FACING` | Room | Entity slot 26 facing direction enum (0=N, 2=NE, 4=E, 6=SE, 8=S, 10=SW, 12=W, 14=NW; +0x22 in struct at 7E:4C51). |
| `$7E:4C7B` | 2 bytes | `ENTITY_SLOT_26_HP` | Room | Entity Pool: Actor entity slot 26 current hit points (+0x2A in struct, 0 = inactive / dead; checked by ai_pick_target and func_8FC237). |
| `$7E:4C7D` | 2 bytes | `ENTITY_SLOT_26_MAX_HP` | Room | Entity slot 26 maximum hit points (+0x2C in struct at 7E:4C51). |
| `$7E:4CDF` | 142 | `ENTITY_SLOT_27_BASE` | Room | Entity Pool: Actor entity slot 27 base (142 bytes). |
| `$7E:4CF9` | 2 bytes | `ENTITY_SLOT_27_POS_X` | Room | Entity slot 27 current horizontal world position in pixels (+0x1A in struct at 7E:4CDF). |
| `$7E:4CFB` | 2 bytes | `ENTITY_SLOT_27_POS_Y` | Room | Entity slot 27 current vertical world position in pixels (+0x1C in struct at 7E:4CDF). |
| `$7E:4D01` | 2 bytes | `ENTITY_SLOT_27_FACING` | Room | Entity slot 27 facing direction enum (0=N, 2=NE, 4=E, 6=SE, 8=S, 10=SW, 12=W, 14=NW; +0x22 in struct at 7E:4CDF). |
| `$7E:4D09` | 2 bytes | `ENTITY_SLOT_27_HP` | Room | Entity Pool: Actor entity slot 27 current hit points (+0x2A in struct, 0 = inactive / dead; checked by ai_pick_target and func_8FC237). |
| `$7E:4D0B` | 2 bytes | `ENTITY_SLOT_27_MAX_HP` | Room | Entity slot 27 maximum hit points (+0x2C in struct at 7E:4CDF). |
| `$7E:4D6D` | 142 | `ENTITY_SLOT_28_BASE` | Room | Entity Pool: Actor entity slot 28 base (142 bytes). |
| `$7E:4D87` | 2 bytes | `ENTITY_SLOT_28_POS_X` | Room | Entity slot 28 current horizontal world position in pixels (+0x1A in struct at 7E:4D6D). |
| `$7E:4D89` | 2 bytes | `ENTITY_SLOT_28_POS_Y` | Room | Entity slot 28 current vertical world position in pixels (+0x1C in struct at 7E:4D6D). |
| `$7E:4D8F` | 2 bytes | `ENTITY_SLOT_28_FACING` | Room | Entity slot 28 facing direction enum (0=N, 2=NE, 4=E, 6=SE, 8=S, 10=SW, 12=W, 14=NW; +0x22 in struct at 7E:4D6D). |
| `$7E:4D97` | 2 bytes | `ENTITY_SLOT_28_HP` | Room | Entity Pool: Actor entity slot 28 current hit points (+0x2A in struct, 0 = inactive / dead; checked by ai_pick_target and func_8FC237). |
| `$7E:4D99` | 2 bytes | `ENTITY_SLOT_28_MAX_HP` | Room | Entity slot 28 maximum hit points (+0x2C in struct at 7E:4D6D). |
| `$7E:4DFB` | 142 | `ENTITY_SLOT_29_BASE` | Room | Entity Pool: Actor entity slot 29 base (142 bytes). |
| `$7E:4E15` | 2 bytes | `ENTITY_SLOT_29_POS_X` | Room | Entity slot 29 current horizontal world position in pixels (+0x1A in struct at 7E:4DFB). |
| `$7E:4E17` | 2 bytes | `ENTITY_SLOT_29_POS_Y` | Room | Entity slot 29 current vertical world position in pixels (+0x1C in struct at 7E:4DFB). |
| `$7E:4E1D` | 2 bytes | `ENTITY_SLOT_29_FACING` | Room | Entity slot 29 facing direction enum (0=N, 2=NE, 4=E, 6=SE, 8=S, 10=SW, 12=W, 14=NW; +0x22 in struct at 7E:4DFB). |
| `$7E:4E25` | 2 bytes | `ENTITY_SLOT_29_HP` | Room | Entity Pool: Actor entity slot 29 current hit points (+0x2A in struct, 0 = inactive / dead; checked by ai_pick_target and func_8FC237). |
| `$7E:4E27` | 2 bytes | `ENTITY_SLOT_29_MAX_HP` | Room | Entity slot 29 maximum hit points (+0x2C in struct at 7E:4DFB). |
| `$7E:4E89` | 174 bytes | `BOY_ENTITY_RECORD` | Room | Primary actor entity structure for boy player character. |
| `$7E:4E99` | 2 bytes | `BOY_STATUS_FLAGS` | Room | Primary action and collision status flags for Boy player entity (`+$10` in entity struct). |
| `$7E:4E9B` | 2 bytes | `BOY_ANIM_PHASE_TIMER` | Room | Sub-frame animation phase timer for Boy walk/run/attack cycles (`+$12` in entity struct). |
| `$7E:4EA1` | 2 bytes | `BOY_ACTION_STATE_FLAGS` | Room | Movement and action state flags for Boy player entity (`+$18` in entity struct). |
| `$7E:4EA3` | 2 bytes | `BOY_WORLD_X` | Room | Boy player entity current horizontal world coordinate in pixels (`+$1A` in entity struct). |
| `$7E:4EA5` | 2 bytes | `BOY_WORLD_Y` | Room | Boy player entity current vertical world coordinate in pixels (`+$1C` in entity struct). |
| `$7E:4EA7` | 2 bytes | `BOY_POS_Z` | Room | Boy entity current elevation / vertical height in pixels (`+$1E` in entity struct). |
| `$7E:4EAB` | 2 bytes | `BOY_FACING_DIRECTION` | Room | Boy facing direction enum (`0`=N, `2`=NE, `4`=E, `6`=SE, `8`=S, `10`=SW, `12`=W, `14`=NW; `+$22` in entity struct). |
| `$7E:4EAD` | 2 bytes | `PRIMARY_ATTACKER_PTR` | Room | Pointer to entity record of actor initiating current physical or magic attack. |
| `$7E:4EB3` | 2 bytes | `BOY_CURRENT_HP` | Room | Boy current hit points stat (`+$2A` in entity struct; read and reduced on damage in func_8FC237). |
| `$7E:4EB5` | 2 bytes | `BOY_MAX_HP` | Save | Player character (Boy) maximum hit points cap (+0x2C in struct at 7E:4E89; $8F:C237). |
| `$7E:4EB7` | 2 bytes | `BOY_STAMINA` | Room | Boy player attack charge meter / stamina (`+$2E` in entity struct; full at $0400). |
| `$7E:4EC3` | 2 bytes | `BOY_TILE_UNDER` | Room | Metatile index under Boy player entity feet (`+$3A` in entity struct). |
| `$7E:4EC5` | 2 bytes | `BOY_TILE_COLLISION` | Room | Collision property flags word of metatile currently under Boy entity (`+$3C` in entity struct). |
| `$7E:4ECF` | 6 bytes | `BOY_STATUS_SLOT_0` | Room | Boy active status effect slot 0 (status ID, duration timer, param boost rating; +0x46 in struct at 7E:4E89; $91:B632). |
| `$7E:4ED5` | 6 bytes | `BOY_STATUS_SLOT_1` | Room | Boy active status effect slot 1 (status ID, duration timer, param boost rating; +0x4C in struct at 7E:4E89; $91:B632). |
| `$7E:4EDB` | 6 bytes | `BOY_STATUS_SLOT_2` | Room | Boy active status effect slot 2 (status ID, duration timer, param boost rating; +0x52 in struct at 7E:4E89; $91:B632). |
| `$7E:4EE1` | 6 bytes | `BOY_STATUS_SLOT_3` | Room | Boy active status effect slot 3 (status ID, duration timer, param boost rating; +0x58 in struct at 7E:4E89; $91:B632). |
| `$7E:4EE7` | 2 bytes | `BOY_NEXT_ENTITY` | Room | Pointer to next entity in active entity linked list (`+$5E` in entity struct, $0000 = end of list). |
| `$7E:4EE9` | 2 bytes | `BOY_CHAR_TYPE_PTR` | Room | Pointer to character master definition struct in bank $8E (`+$60` in entity struct). |
| `$7E:4F1D` | 4 bytes | `BOY_EXP_POINTS` | Save | Player character (Boy) 32-bit accumulated experience points (+0x94 low word $7E:4F1D, +0x96 high word $7E:4F1F; $8D:A0E9). |
| `$7E:4F23` | 1 byte | `BOY_STATUS_GLOW_BITS` | Room | Boy status effect outline glow bitmask (Atlas, Barrier, Speed; +0x9A in struct at 7E:4E89; $91:B632). |
| `$7E:4F25` | 2 bytes | `BOY_POWER_SCALE_MULT` | Save | Boy combat power and damage scaling multiplier (+0x9C in entity struct at 7E:4E89; $8F:80DA). |
| `$7E:4F27` | 2 bytes | `BOY_SECONDARY_STATUS_FLAGS` | Save | Boy secondary status effect and modifier flags (+0x9E in entity struct at 7E:4E89; $8F:80D4). |
| `$7E:4F29` | 2 bytes | `BOY_GEAR_BONUS_MDEF` | Save | Boy equipment bonus magic defense rating (+0xA0 in struct at 7E:4E89; $8F:8600). |
| `$7E:4F2B` | 2 bytes | `BOY_GEAR_BONUS_PDEF` | Save | Boy equipment bonus physical defense rating (+0xA2 in struct at 7E:4E89; $8F:8600). |
| `$7E:4F2D` | 2 bytes | `BOY_GEAR_BONUS_ATK` | Save | Boy equipment bonus physical attack rating (+0xA4 in struct at 7E:4E89; $8F:8600). |
| `$7E:4F2F` | 2 bytes | `BOY_GEAR_BONUS_HIT` | Save | Boy equipment bonus accuracy / hit rate rating (+0xA6 in struct at 7E:4E89; $8F:8600). |
| `$7E:4F31` | 2 bytes | `BOY_GEAR_BONUS_EVADE` | Save | Boy equipment bonus evasion rate rating (+0xA8 in struct at 7E:4E89; $8F:8600). |
| `$7E:4F37` | 174 bytes | `DOG_ENTITY_RECORD` | Room | Primary actor entity structure for dog companion character. |
| `$7E:4F47` | 2 bytes | `DOG_STATUS_FLAGS` | Room | Primary action and collision status flags for Dog companion entity (`+$10` in entity struct). |
| `$7E:4F49` | 2 bytes | `DOG_ANIM_PHASE_TIMER` | Room | Sub-frame animation phase timer for Dog companion entity (`+$12` in entity struct). |
| `$7E:4F4F` | 2 bytes | `DOG_ACTION_STATE_FLAGS` | Room | Movement and action state flags for Dog companion entity (`+$18` in entity struct). |
| `$7E:4F51` | 2 bytes | `DOG_WORLD_X` | Room | Dog companion entity current horizontal world coordinate in pixels (`+$1A` in entity struct). |
| `$7E:4F53` | 2 bytes | `DOG_WORLD_Y` | Room | Dog companion entity current vertical world coordinate in pixels (`+$1C` in entity struct). |
| `$7E:4F55` | 2 bytes | `DOG_POS_Z` | Room | Dog companion entity current elevation / vertical height in pixels (`+$1E` in entity struct). |
| `$7E:4F59` | 2 bytes | `DOG_FACING_DIRECTION` | Room | Dog facing direction enum (`0`=N, `2`=NE, `4`=E, `6`=SE, `8`=S, `10`=SW, `12`=W, `14`=NW; `+$22` in entity struct). |
| `$7E:4F5B` | 2 bytes | `SECONDARY_ATTACKER_PTR` | Room | Pointer to entity record of target entity receiving combat damage. |
| `$7E:4F61` | 2 bytes | `DOG_CURRENT_HP` | Room | Dog companion current hit points stat (`+$2A` in entity struct; read and reduced on damage in func_8FC237). |
| `$7E:4F63` | 2 bytes | `DOG_MAX_HP` | Save | Companion character (Dog) maximum hit points cap (+0x2C in struct at 7E:4F37; $8F:C237). |
| `$7E:4F65` | 2 bytes | `DOG_STAMINA` | Room | Dog companion attack charge meter / stamina (`+$2E` in entity struct; full at $0400). |
| `$7E:4F71` | 2 bytes | `DOG_TILE_UNDER` | Room | Metatile index under Dog companion entity feet (`+$3A` in entity struct). |
| `$7E:4F73` | 2 bytes | `DOG_TILE_COLLISION` | Room | Collision property flags word of metatile currently under Dog entity (`+$3C` in entity struct). |
| `$7E:4F7D` | 6 bytes | `DOG_STATUS_SLOT_0` | Room | Dog active status effect slot 0 (status ID, duration timer, param boost rating; +0x46 in struct at 7E:4F37; $91:B632). |
| `$7E:4F83` | 6 bytes | `DOG_STATUS_SLOT_1` | Room | Dog active status effect slot 1 (status ID, duration timer, param boost rating; +0x4C in struct at 7E:4F37; $91:B632). |
| `$7E:4F89` | 6 bytes | `DOG_STATUS_SLOT_2` | Room | Dog active status effect slot 2 (status ID, duration timer, param boost rating; +0x52 in struct at 7E:4F37; $91:B632). |
| `$7E:4F8F` | 6 bytes | `DOG_STATUS_SLOT_3` | Room | Dog active status effect slot 3 (status ID, duration timer, param boost rating; +0x58 in struct at 7E:4F37; $91:B632). |
| `$7E:4F95` | 2 bytes | `DOG_NEXT_ENTITY` | Room | Pointer to next entity in active entity linked list (`+$5E` in entity struct; initialized to point to Boy at $7E:4E89 in func_8FB229). |
| `$7E:4F97` | 2 bytes | `DOG_CHAR_TYPE_PTR` | Room | Pointer to character master definition struct in bank $8E (`+$60` in entity struct). |
| `$7E:4FA5` | 2 | `DOG_FORM_SCRIPT_PTR_LOW` | Room | Companion Mechanics: Low 16-bit pointer to active Dog form animation walker script ($8F:9471). |
| `$7E:4FA6` | 1 | `DOG_FORM_SCRIPT_PTR_BANK` | Room | Companion Mechanics: Bank byte of active Dog form animation walker script. |
| `$7E:4FCB` | 4 bytes | `DOG_EXP_POINTS` | Save | Companion character (Dog) 32-bit accumulated experience points (+0x94 low word $7E:4FCB, +0x96 high word $7E:4FCD; $8D:A9A0). |
| `$7E:4FD1` | 1 byte | `DOG_STATUS_GLOW_BITS` | Room | Dog companion status effect outline glow bitmask (Atlas, Barrier, Speed; +0x9A in struct at 7E:4F37; $91:B632). |
| `$7E:4FD3` | 2 bytes | `DOG_POWER_SCALE_MULT` | Save | Dog combat power and damage scaling multiplier (+0x9C in entity struct at 7E:4F37; $8F:8162). |
| `$7E:4FD5` | 2 bytes | `DOG_SECONDARY_STATUS_FLAGS` | Save | Dog secondary status effect and modifier flags (+0x9E in entity struct at 7E:4F37; $8F:815C). |
| `$7E:4FD7` | 2 bytes | `DOG_GEAR_BONUS_MDEF` | Save | Dog equipment bonus magic defense rating (+0xA0 in struct at 7E:4F37; $8F:857D). |
| `$7E:4FD9` | 2 bytes | `DOG_GEAR_BONUS_PDEF` | Save | Dog equipment bonus physical defense rating (+0xA2 in struct at 7E:4F37; $8F:857D). |
| `$7E:4FDB` | 2 bytes | `DOG_GEAR_BONUS_ATK` | Save | Dog equipment bonus physical attack rating (+0xA4 in struct at 7E:4F37; $8F:857D). |
| `$7E:4FDD` | 2 bytes | `DOG_GEAR_BONUS_HIT` | Save | Dog equipment bonus accuracy / hit rate rating (+0xA6 in struct at 7E:4F37; $8F:857D). |
| `$7E:4FDF` | 2 bytes | `DOG_GEAR_BONUS_EVADE` | Save | Dog equipment bonus evasion rate rating (+0xA8 in struct at 7E:4F37; $8F:857D). |
| `$7E:4FE6` | 50 bytes | `MAP_ANIM_FRAMES` | Room | Current animation frame indices for active map animated tile channels. |
| `$7E:5018` | 50 bytes | `MAP_ANIM_TIMERS` | Room | Countdown hold delay timers for active map animated tile channels. |
| `$7E:504A` | 50 bytes | `MAP_ANIM_CYCLES` | Room | Loop cycle iteration counters for active map animated tile channels. |
| `$7E:507D` | 34 bytes | `MAP_ANIM_DESCRIPTORS` | Room | ROM pointers to animated tile sequence descriptor definitions. |
| `$7E:50A7` | 136 bytes | `SPRITE_ALLOC_POOL` | Frame | Dynamic sprite allocation node pool (17 nodes × 8 bytes: `+$00` prev, `+$02` next, `+$04` state `$FFFF`=free, `+$06` parent). |
| `$7E:50AD` | 1 byte | `SPRITE_VRAM_ALLOC_TABLE` | Room | Sprite VRAM block allocation table. Used by the dynamic sprite engine in bank $80 to allocate VRAM tile slots for dynamic actors, weapon animations, and particl |
| `$7E:50AF` | `Byte×8` | `sprite_sort_bucket_1` | `Frame` | Y-sorted sprite display list bucket 1 (Screen Y 64..127): +0 prev, +2 next, +4 key, +6 tail. |
| `$7E:50B7` | `Byte×8` | `sprite_sort_bucket_2` | `Frame` | Y-sorted sprite display list bucket 2 (Screen Y 128..191): +0 prev, +2 next, +4 key, +6 tail. |
| `$7E:50BF` | `Byte×8` | `sprite_sort_bucket_3` | `Frame` | Y-sorted sprite display list bucket 3 (Screen Y 192..255): +0 prev, +2 next, +4 key, +6 tail. |
| `$7E:50C7` | `Byte×8` | `sprite_sort_bucket_4` | `Frame` | Y-sorted sprite display list bucket 4 (Screen Y 256..319): +0 prev, +2 next, +4 key, +6 tail. |
| `$7E:50CF` | `Byte×8` | `sprite_sort_bucket_5` | `Frame` | Y-sorted sprite display list bucket 5 (Screen Y 320..383): +0 prev, +2 next, +4 key, +6 tail. |
| `$7E:50D7` | `Byte×8` | `sprite_sort_bucket_6` | `Frame` | Y-sorted sprite display list bucket 6 (Screen Y 384..447): +0 prev, +2 next, +4 key, +6 tail. |
| `$7E:50DF` | `Byte×8` | `sprite_sort_bucket_7` | `Frame` | Y-sorted sprite display list bucket 7 (Screen Y 448..511): +0 prev, +2 next, +4 key, +6 tail. |
| `$7E:50E7` | `Byte×8` | `sprite_sort_bucket_8` | `Frame` | Y-sorted sprite display list bucket 8 (Screen Y 512..575): +0 prev, +2 next, +4 key, +6 tail. |
| `$7E:50EF` | `Byte×8` | `sprite_sort_bucket_9` | `Frame` | Y-sorted sprite display list bucket 9 (Screen Y 576..639): +0 prev, +2 next, +4 key, +6 tail. |
| `$7E:50F7` | `Byte×8` | `sprite_sort_bucket_10` | `Frame` | Y-sorted sprite display list bucket 10 (Screen Y 640..703): +0 prev, +2 next, +4 key, +6 tail. |
| `$7E:50FF` | `Byte×8` | `sprite_sort_bucket_11` | `Frame` | Y-sorted sprite display list bucket 11 (Screen Y 704..767): +0 prev, +2 next, +4 key, +6 tail. |
| `$7E:5107` | `Byte×8` | `sprite_sort_bucket_12` | `Frame` | Y-sorted sprite display list bucket 12 (Screen Y 768..831): +0 prev, +2 next, +4 key, +6 tail. |
| `$7E:510F` | `Byte×8` | `sprite_sort_bucket_13` | `Frame` | Y-sorted sprite display list bucket 13 (Screen Y 832..895): +0 prev, +2 next, +4 key, +6 tail. |
| `$7E:5117` | `Byte×8` | `sprite_sort_bucket_14` | `Frame` | Y-sorted sprite display list bucket 14 (Screen Y 896..959): +0 prev, +2 next, +4 key, +6 tail. |
| `$7E:511F` | `Byte×8` | `sprite_sort_bucket_15` | `Frame` | Y-sorted sprite display list bucket 15 (Screen Y 960..1023): +0 prev, +2 next, +4 key, +6 tail. |
| `$7E:5127` | 2 bytes | `SPRITE_DRAW_QUEUE_HEAD` | Frame | Head pointer to sorted sprite render queue (`$7E:512F..$7E:516F`); traversed by `func_C096BB`. |
| `$7E:512F` | 64 bytes | `SPRITE_DRAW_QUEUE_NODES` | Frame | Dynamic sprite draw queue nodes (stride 16 bytes: `+$00` next link, `+$04` state, `+$06` X, `+$08` Y, `+$0A` attr flags, `+$0C..$0E` 24-bit slice table ptr). |
| `$7E:5DC3` | 960 bytes | `SPAWN_RECORDS_TABLE` | Room | 60-slot entity respawn descriptor ring table (stride 16 bytes: +$00 ID, +$02 X, +$04 Y, +$06 flags, +$08 cooldown, +$0A mult, +$0C cap, +$0E entity slot). |
| `$7E:6183` | 2 bytes | `SPAWN_CYCLE_FRAMES` | Room | Elapsed frame counter across spawn table scanning passes (reset in func_8FDDBB). |
| `$7E:6185` | 2 bytes | `SPAWN_SCAN_COUNTER` | Room | Number of spawn slots evaluated during current frame's spawn loop iteration. |
| `$7E:6187` | 32 bytes | `SPRITE_CGRAM_SHADOW` | Room | Sprite palette shadow buffer DMA-copied to SNES CGRAM during VBLANK. |
| `$7E:61A7` | 224 bytes | `MAP_TILE_PALETTES` | Room | Tile family CGRAM palette shadow buffers (7 families × 32 bytes). |
| `$7E:6289` | 256 bytes | `SPRITE_ANIM_CHANNELS` | Room | Dynamic sprite animation channel descriptors (8 channels × 32 bytes; active flags at +0x1C; $90:CC1A, $90:CF3A). |
| `$7E:62A5` | 224 bytes | `TILE_ANIM_VRAM_OFFSETS` | Room | Source VRAM tile offset table for animated tile family cycling. |
| `$7E:6387` | struct ProjectileSlot[8] | `PROJECTILE_SLOTS_BASE` | Room | Combat Engine: 8-slot active physics projectile array (stride 44 bytes; +$06 sprite, +$10 active, +$14 X, +$16 Y, +$18 Z, +$1E life, +$26 behaviour, +$28 power) |
| `$7E:65D1` | 32 bytes | `COLOR_CROSSFADE_DELTA_BUFFER` | Room | Palette cross-fade channel intermediate RGB delta buffer ($90:D481). |
| `$7E:6611` | 32 bytes | `COLOR_CROSSFADE_CGRAM_STAGING_BUF` | Room | CGRAM palette cross-fade output staging buffer (uploaded via $80:85FA). |
| `$7E:684D` | 7 bytes | `HDMA_WINDOW_INDIRECT_TABLE` | Frame | HDMA Channel 5 indirect table header for PPU Window 1 masking ($2126 WH0; $91:C7F5). |
| `$7E:6869` | 512 bytes | `HDMA_WINDOW_MASK_BUFFER_A` | Frame | PPU Window 1 scanline coordinate rasterization buffer A (256 words; $91:C7F5, $91:C899). |
| `$7E:6A7D` | 512 bytes | `HDMA_WINDOW_MASK_BUFFER_B` | Frame | PPU Window 1 scanline coordinate rasterization buffer B (256 words; $91:C7F5, $91:C899). |
| `$7E:6C91` | `Byte×1599` | `dynamic_vram_tiles_8x8` | `Frame` | Staging buffer for dynamic 8x8 4bpp SNES sprite tiles ($7E:6C91..$7E:72D0, 32 bytes per tile) queued for VRAM DMA by obj_tile_allocate ($C0:A4B5). |
| `$7E:72D1` | 1024 bytes | `SPRITE_TILE_STAGING_BUF` | Frame | Staging buffer for 4bpp sprite tile graphics unpacked dynamically before VRAM DMA upload (128 bytes per 16x16 tile). |
| `$7E:7321` | 16 bytes | `LAVA_PALETTE_ROTATION` | Frame | Animated palette rotation buffer for bubbling molten lava surface glow. |
| `$7E:7331` | 16 bytes | `CRYSTAL_PALETTE_CYCLE` | Frame | Animated palette cycling buffer for glowing crystalline minerals. |
| `$7E:7341` | 16 bytes | `HDMA_SKY_GRADIENT_TABLE` | Frame | 6-band HDMA sky horizon color gradient table constructed by func_80A1B4 for background PPU color math. |
| `$7E:7D51` | `Byte×6228` | `tier1_tile_slot_lookup` | `Frame` | Tier 1 dynamic sprite tile frame direct lookup table ($7E:7D51..$7E:95A4), mapping frame/tile ID to allocated cache slot index. |
| `$7E:95A5` | `Word×128` | `tier1_cache_slot_tiles` | `Frame` | Tier 1 dynamic sprite tile slot table ($7E:95A5..$7E:96A4, 128 words), tracking which tile ID occupies each VRAM slot. |
| `$7E:96A5` | 1 byte | `OBJ_TILE_LRU_PREV` | Room | OBJ 8x8 tile cache, prev links (130 bytes). `prev[i]` of the OBJ tile cache lists; see `$7E9727`. `$7E9725` = `prev[$80]` (next slot to evict), `$7E9726` = `pre |
| `$7E:9725` | `Byte` | `tier1_lru_head_node` | `Frame` | Most recently used (MRU) slot index in Tier 1 dynamic sprite tile cache. |
| `$7E:9726` | `Byte` | `tier1_lru_tail_node` | `Frame` | Least recently used (LRU) slot index in Tier 1 dynamic sprite tile cache (selected for next eviction). |
| `$7E:9727` | 1 byte | `OBJ_TILE_LRU_NEXT` | Room | OBJ 8x8 tile cache, next links (130 bytes). Doubly linked list over the 128 dynamic OBJ tile slots; a slot number is the OBJ tile number (VRAM word `$6000 + slo |
| `$7E:97A9` | 256 bytes | `VRAM_TILE_PATTERN_LOOKUP` | Frame | Lookup table mapping ROM sprite pattern ID to allocated dynamic VRAM slot. |
| `$7E:AA58` | 256 bytes | `VRAM_SLOT_PATTERN_MAP` | Frame | Table mapping dynamic VRAM tile slots back to their active pattern ID. |
| `$7E:AB18` | 96 bytes | `VRAM_TILE_LRU_PREV` | Frame | Backward links for least-recently-used (LRU) dynamic VRAM sprite tile allocator. |
| `$7E:AB78` | 1 byte | `VRAM_TILE_LRU_HEAD` | Frame | Head index of LRU dynamic VRAM tile allocator list. |
| `$7E:AB79` | 1 byte | `VRAM_TILE_LRU_MOST_RECENT` | Frame | Most recently allocated tile index in dynamic VRAM tile allocator. |
| `$7E:AB7A` | 96 bytes | `VRAM_TILE_LRU_NEXT` | Frame | Forward links for least-recently-used (LRU) dynamic VRAM sprite tile allocator. |
| `$7E:ABDE` | 512 bytes | `LOW_OAM_TABLE_BUF` | Frame | Low OAM staging buffer (128 hardware sprites × 4 bytes: X low, Y, tile number, attributes); uploaded to SNES OAM via DMA in VBlank. |
| `$7E:ADDE` | 32 bytes | `HIGH_OAM_TABLE_BUF` | Frame | High OAM staging buffer (32 bytes = 128 sprites × 2 bits: bit 0 = 9th bit of X, bit 1 = sprite size 8x8 vs 16x16/32x32); uploaded via DMA in VBlank. |
| `$7E:ADFE` | 20992 bytes | `UNUSED_WRAM_BANK_7E` | Boot | Large unallocated work RAM gap in Bank $7E (20.5 KB) |
| `$7E:FFFE` | 2 | `SCRIPT_VM_ZERO_WORD` | Boot | Constant zero word at top of Bank $7E read by script VM |
| `$7F:0000` | `Byte×40960` | `room_metatile_grid` | `Room` | Primary decompressed 16-bit room metatile grid & collision geometry layer ($7F:0000..$7F:9FFF, up to 64×64 metatiles). |
| `$7F:8000` | 2 | `DIALOGUE_DECOMP_BUFFER` | Room | Dialogue text string decompression and decoding staging buffer in Bank $7F |
| `$7F:A000` | `Byte×674` | `viewport_tilemap_composite` | `Room` | Active viewport screen tilemap composite staging buffer in Bank $7F ($7F:A000..$7F:A2A1). |
| `$7F:C300` | `Byte×1280` | `room_palette_table` | `Room` | Room tile palette index association table in Bank $7F ($7F:C300..$7F:C4A0). |
| `$7F:C800` | `Byte×4096` | `shadow_tilemap_buf` | `Room` | Staging buffer in Bank $7F ($7F:C800..$7F:D7FF) for HUD and dialogue text box tilemap transfers. |
| `$7F:C844` | `Byte×1593` | `hud_textbox_tilemap_staging` | `Frame` | Staging buffer in Bank $7F ($7F:C844..$7F:CE7C) for HUD and dialogue text box tilemap transfers. |
| `$7F:D81E` | `Byte×10210` | `dialogue_ascii_buffer` | `Room` | Dialogue box decoded ASCII text string rasterization buffer in Bank $7F ($7F:D81E..$7F:FFFE, unpacked by $8C:CCF5). |
| `$7F:FF00` | 32 bytes | `CAMERA_BOUNDARY_EXTEND_FLAGS` | Room | Camera viewport map edge extension and boundary override flags in Bank $7F |
| `$7F:FFFF` | 1 | `WRAM_TOP` | Boot | Upper limit of SNES 128 KB Work RAM (Bank $7F top) |
