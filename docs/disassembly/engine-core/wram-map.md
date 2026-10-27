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
| `$7E:002A` | 2 bytes | `DP_SCRATCH_2A` | Frame | Direct page general calculation scratch word; used in math routines and coordinate shifts. |
| `$7E:0070` | 2 bytes | `DP_SCRATCH_70` | Frame | Direct page scratch pointer; used by decompression and script string decoders. |
| `$7E:0072` | 1 byte | `HDMA_ENABLE_MASK` | Frame | Restored into $420C by NMI handler at scanline 225 to enable Mode 7 perspective or HDMA color gradients. |
| `$7E:00C3` | 2 bytes | `SCREEN_SHAKING` | Save | Game script variable: SCREEN SHAKING |
| `$7E:00C5` | 2 bytes | `SHAKE_OFFSET_X` | Frame | Horizontal camera displacement offset applied during active screen shaking. |
| `$7E:00C7` | 2 bytes | `SHAKE_OFFSET_Y` | Frame | Vertical camera displacement offset applied during active screen shaking. |
| `$7E:00CB` | 1 byte | `DMA_QUEUE_INDEX` | Frame | Index offset into frame VRAM upload buffer; reset to 0 by $80:8F8C at start of each frame. |
| `$7E:00D9` | 1 byte | `FRAME_READY_FLAG` | Frame | Set non-zero when main loop completes drawing; NMI checks before uploading VRAM and clears after upload. |
| `$7E:0100` | 2 bytes | `FRAME_COUNTER_LO` | Boot | Incremented every NMI interrupt ($80:8462); polled by wait_for_frame ($80:858C) for 60 Hz pacing. |
| `$7E:0102` | 2 bytes | `FRAME_COUNTER_HI` | Boot | High word of 32-bit frame counter; increments when $7E:0100 wraps from $FFFF to $0000. |
| `$7E:0104` | 2 bytes | `JOYPAD1_CURRENT` | Frame | Controller 1 button mask; checked for player input, edge triggers, and typematic repeat. |
| `$7E:0105` | 1 byte | `JOYPAD1_BUTTONS_HI` | Frame | High byte of controller 1 input register (A, X, L, R buttons). |
| `$7E:0106` | 2 bytes | `INIDISP_SHADOW` | Frame | Shadow of SNES register $2100; $008F = screen off, $000F = screen full brightness. |
| `$7E:0108` | 2 bytes | `HTIME_SHADOW` | Frame | Shadow of $4207 (HTIMEL/HTIMEH) for raster IRQ horizontal position. |
| `$7E:010A` | 2 bytes | `VTIME_SHADOW` | Frame | Shadow of $4209 (VTIMEL/VTIMEH) for raster IRQ scanline position. |
| `$7E:010E` | 2 bytes | `BG4HOFS_SHADOW` | Frame | BG4 horizontal scroll offset; written twice to $210D during NMI. |
| `$7E:0110` | 2 bytes | `BG4VOFS_SHADOW` | Frame | BG4 vertical scroll offset; written twice to $210E during NMI. |
| `$7E:0112` | 2 bytes | `BG1VOFS_SHADOW` | Frame | BG1 vertical scroll offset; written twice to $210F during NMI. |
| `$7E:0114` | 2 bytes | `BG1HOFS_SHADOW` | Frame | BG1 horizontal scroll offset; written twice to $2110 during NMI. |
| `$7E:0116` | 2 bytes | `BG2VOFS_SHADOW` | Frame | BG2 vertical scroll offset; written twice to $2111 during NMI. |
| `$7E:0118` | 2 bytes | `BG2HOFS_SHADOW` | Frame | BG2 horizontal scroll offset; written twice to $2112 during NMI. |
| `$7E:011A` | 2 bytes | `BG3VOFS_SHADOW` | Frame | BG3 vertical scroll offset; written twice to $2113 during NMI. |
| `$7E:011C` | 2 bytes | `BG3HOFS_SHADOW` | Frame | BG3 horizontal scroll offset; written twice to $2114 during NMI. |
| `$7E:0122` | 1 byte | `W12SEL_SHADOW` | Frame | Window mask configuration for BG1 and BG2; written to $2123. |
| `$7E:0123` | 1 byte | `W34SEL_SHADOW` | Frame | Window mask configuration for BG3 and BG4; written to $2124. |
| `$7E:0124` | 1 byte | `WOBJSEL_SHADOW` | Frame | Window mask configuration for sprites; written to $2125. |
| `$7E:0133` | 2 bytes | `PRNG_SEED_0` | Boot | 64-bit PRNG seed state word 0; seeded at boot by latching PPU raster counters and XORing with $DEAD/$63C7. |
| `$7E:0135` | 2 bytes | `PRNG_SEED_1` | Boot | 64-bit PRNG seed state word 1; XORed with $BABE/$E294. |
| `$7E:0137` | 2 bytes | `PRNG_SEED_2` | Boot | 64-bit PRNG seed state word 2; XORed with $BEEF/$5A0D. |
| `$7E:0139` | 2 bytes | `PRNG_SEED_3` | Boot | 64-bit PRNG seed state word 3; XORed with $FACE/$18BF. |
| `$7E:013D` | 2 bytes | `VRAM_DMA_QUEUE_CURSOR` | Frame | Cursor index into 16-slot deferred VRAM DMA transfer queue. |
| `$7E:013F` | 128 bytes | `VRAM_DMA_QUEUE` | Frame | 16-slot deferred VRAM DMA queue (8 bytes per descriptor: src bank/addr, dest VRAM addr, length). |
| `$7E:0341` | 2 bytes | `LAST_SPAWNED_ENTITY` | Room | Entity slot index of most recently allocated or spawned actor. |
| `$7E:0343` | 2 bytes | `JOYPAD_REPEAT_TIMER` | Frame | Countdown timer before typematic joypad directional repeat begins. |
| `$7E:0345` | 2 bytes | `JOYPAD_REPEAT_MASK` | Frame | Bitmask of joypad buttons eligible for typematic auto-repeat. |
| `$7E:0347` | 2 bytes | `JOYPAD_REPEAT_DELAY` | Boot | Initial typematic repeat delay duration threshold (frames). |
| `$7E:0349` | 2 bytes | `JOYPAD_REPEAT_RATE` | Boot | Sustained typematic auto-repeat interval rate (frames). |
| `$7E:034D` | 46 bytes | `WINDOW_DESCRIPTOR` | Room | On-screen dialogue and choice window layout, border parameters, and clipping limits. |
| `$7E:0380` | 64 bytes | `CHOICE_BOX_DESCRIPTOR` | Room | Dialogue multiple-choice selector bounding box coordinates, cursor state, and item count. |
| `$7E:05A7` | 2 bytes | `ACTIVE_TARGET_INDEX` | Room | Active target actor entity slot index for player attacks and alchemy targeting. |
| `$7E:05A9` | 2 bytes | `SPAWN_TRIGGER_FLAGS` | Room | Bitmask flags indicating deferred monster and NPC spawn triggers scheduled for frame. |
| `$7E:05B1` | 64 bytes | `LINE_ACCUM_BUFFER` | Room | Text line assembly buffer for decoding dialogue strings and number printing. |
| `$7E:061B` | 2 bytes | `RING_MENU_ANGLE_1` | Room | Primary angular rotational position for circular ring menu icon layout. |
| `$7E:061D` | 2 bytes | `RING_MENU_ANGLE_2` | Room | Secondary angular rotational position for circular ring menu animation. |
| `$7E:061F` | 2 bytes | `DIALOGUE_CURSOR_POS` | Room | Current character blit cursor offset within dialogue window buffer. |
| `$7E:0621` | 2 bytes | `DIALOGUE_CTRL_STATE` | Room | Dialogue control opcode decoder parser state machine register. |
| `$7E:062B` | 1 byte | `DIALOGUE_ACTIVE_FLAG` | Room | Set non-zero when a dialogue or text box is currently open on screen. |
| `$7E:06A3` | 256 bytes | `RING_ICON_SLOTS` | Room | Ring menu items inventory icon array (weapons, alchemy spells, items). |
| `$7E:0A26` | 2 bytes | `ACTIVE_PLAYER_PTR` | Room | Direct pointer to active controlled player character entity record in WRAM. |
| `$7E:0A35` | 2 bytes | `BOY_MAX_HP` | Save | Boy player maximum health points. |
| `$7E:0A47` | 2 bytes | `BOY_ATTACK_POWER` | Save | Boy player base physical attack damage statistic. |
| `$7E:0A49` | 2 bytes | `BOY_XP_LO` | Save | Boy player accumulated experience points low word. |
| `$7E:0A4B` | 2 bytes | `BOY_XP_HI` | Save | Boy player accumulated experience points high word. |
| `$7E:0A50` | 2 bytes | `BOY_LEVEL` | Save | Boy player character level (1..99). |
| `$7E:0A70` | 2 bytes | `BOY_CURRENT_HP` | Save | Boy player current health points. |
| `$7E:0A7F` | 2 bytes | `DOG_MAX_HP` | Save | Dog companion maximum health points. |
| `$7E:0A9A` | 2 bytes | `DOG_LEVEL` | Save | Dog companion character level (1..99). |
| `$7E:0ABA` | 1 byte | `EQUIPPED_WEAPON` | Save | Equipped weapon index (bone, axe, spear, bazooka, etc.). |
| `$7E:0AC6` | 2 bytes | `CURRENCY_TALONS` | Save | Prehistoria realm currency balance (Talons). |
| `$7E:0AC9` | 2 bytes | `CURRENCY_JEWELS` | Save | Antiqua realm currency balance (Jewels). |
| `$7E:0ACC` | 2 bytes | `CURRENCY_GOLD` | Save | Gothica realm currency balance (Gold Coins). |
| `$7E:0ACF` | 2 bytes | `CURRENCY_CREDITS` | Save | Omnitopia realm currency balance (Credits). |
| `$7E:0ADB` | 2 bytes | `CURRENT_ROOM_ID` | Room | Active room / map ID index into master pointer table $9F:FDE7; passed to enter_room ($8E:E4E2). |
| `$7E:0B09` | 2 bytes | `ROOM_ENTER_SCRIPT` | Room | Pointer to map initialization enter script bytecode. |
| `$7E:0B0B` | 2 bytes | `ROOM_STEP_TRIGGER` | Room | Pointer to step-on coordinate trigger descriptor table for current room. |
| `$7E:0B19` | 2 bytes | `WAVE_PHASE_COUNTER` | Frame | Wave phase counter incremented per frame for HDMA underwater distortion. |
| `$7E:0B2B` | 2 bytes | `DIALOGUE_TIMER` | Frame | Delay timer tracking pause duration between dialogue lines. |
| `$7E:0B2F` | 2 bytes | `DIALOGUE_SCROLL_Y` | Room | Vertical scroll line offset of active dialogue window text box. |
| `$7E:0B31` | 2 bytes | `DIALOGUE_LINE_IDX` | Room | Active text line index inside dialogue window buffer. |
| `$7E:0B3B` | 2 bytes | `ACTIVE_SAVE_SLOT` | Boot | SRAM save slot index (0..3); read from battery RAM $30:6001. |
| `$7E:0B3D` | 2 bytes | `FONT_GLYPH_HEIGHT` | Boot | Height of dialogue text font glyphs in scanlines (default 8). |
| `$7E:0B3F` | 2 bytes | `FONT_LINE_STRIDE` | Boot | Byte pitch stride between raster text lines in dialogue buffer. |
| `$7E:0B41` | 2 bytes | `FONT_BUFFER_BASE` | Boot | Base address in High WRAM ($7F:A000) for 2bpp font glyph staging. |
| `$7E:0B4D` | 2 bytes | `SCREEN_FLASH_TIMER` | Frame | Remaining duration in frames for full-screen color flash effect. |
| `$7E:0B4F` | 2 bytes | `SCREEN_FLASH_COLOR` | Frame | 15-bit BGR color value for active screen flash overlay. |
| `$7E:0B7F` | 2 bytes | `AUDIO_FADE_COUNTER` | Frame | Step counter tracking audio volume fade in/out transitions. |
| `$7E:0B83` | 2 bytes | `AUDIO_TARGET_VOLUME` | Room | Target master audio volume level latch for fade interpolation. |
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
| `$7E:0EB2` | 2 bytes | `DOG_CURRENT_HP` | Save | Dog companion current health points. |
| `$7E:0EBE` | 2 bytes | `RING_16_CURSOR_0EBE` | Unknown | Cursor of a 16-byte-record ring at $5DC3-$6183. Moves on by 16 bytes per record; what the records are is not known. |
| `$7E:0EC0` | 32 bytes | `DEFERRED_SPAWN_BUF` | Room | Buffer storing entity spawn parameters queued during map transitions. |
| `$7E:0EC6` | 2 bytes | `JOYPAD1_BUTTONS` | Frame | Joypad 1 held buttons (B, Y, Select, Start, Up, Down, Left, Right, A, X, L, R) read from $4218. |
| `$7E:0F36` | 2 bytes | `STEP_DITHER_COUNTER` | Frame | Sub-pixel walk step dither accumulator for smooth actor movement. |
| `$7E:0F38` | 2 bytes | `CAMERA_SUBPIXEL_ACC` | Frame | Camera sub-pixel tracking fractional accumulator. |
| `$7E:0F3A` | 2 bytes | `VRAM_QUEUE_LOCK` | Room | Safety lock; NMI skips VRAM uploads when non-zero (used by camera scrolling $90:94AB and room resets). |
| `$7E:0F3C` | 2 bytes | `CGRAM_QUEUE_LOCK` | Frame | Lock preventing CGRAM palette DMA upload contention during VBLANK. |
| `$7E:0F42` | 2 bytes | `VIEWPORT_SCROLL_X` | Frame | Horizontal world coordinate of top-left camera viewport boundary. |
| `$7E:0F44` | 2 bytes | `VIEWPORT_SCROLL_Y` | Frame | Vertical world coordinate of top-left camera viewport boundary. |
| `$7E:0F84` | 2 bytes | `MAP_HEADER_FLAGS` | Room | Bitmask flags loaded from map header (layering, Mode 7, weather). |
| `$7E:0F86` | 1 byte | `MAP_LOADED_FLAG` | Room | Set to 1 after room tilemaps, collision, and palettes are fully decompressed. |
| `$7E:0F8A` | 2 bytes | `LOADED_PALETTE_TAG` | Room | Identifier of currently loaded map palette family. |
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
| `$7E:107E` | 80 bytes | `TERRAIN_FRAME_INDICES` | Room | Current animation frame indices for 80 terrain mutation channel slots. |
| `$7E:10CE` | 80 bytes | `TERRAIN_THRESHOLDS` | Room | Frame threshold limits for 80 terrain mutation channel slots. |
| `$7E:111E` | 80 bytes | `TERRAIN_COUNTDOWNS` | Room | Cycle countdown delay timers for 80 terrain mutation channel slots. |
| `$7E:116E` | 2 bytes | `MINIMAP_BUDGET_REG` | Frame | Chunk decompression CPU cycle budget limit for minimap rendering. |
| `$7E:1170` | 2 bytes | `VRAM_STAGING_CURSOR` | Frame | Buffer cursor offset within pending VRAM upload staging area. |
| `$7E:1172` | 2 bytes | `VRAM_STAGING_PENDING` | Frame | Byte count of dirty tile data awaiting DMA transfer to VRAM. |
| `$7E:1174` | 64 bytes | `MINI_RADAR_BUFFER` | Room | Decompressed minimap radar display coordinate buffer. |
| `$7E:11F4` | 2 bytes | `SCRIPT_SLOT_MAILBOX` | Room | Inter-thread script communication mailbox register; initialized to $FFFF at reset. |
| `$7E:1274` | 2 bytes | `CURRENT_MUSIC_TRACK` | Room | Active background music track index; initialized to $FFFF at reset. |
| `$7E:1276` | 2 bytes | `ACTIVE_PARTICLE_COUNT` | Frame | Number of active weather/atmospheric particles currently being updated. |
| `$7E:1278` | 2 bytes | `SOUND_COMMAND_MAILBOX` | Frame | Sound effect request mailbox evaluated by APU interface routines. |
| `$7E:1288` | 6 bytes | `SPRITE_VRAM_CACHE` | Room | Dynamic VRAM allocation slot pointers for active actor sprite graphics. |
| `$7E:128E` | 2 bytes | `CGRAM_QUEUE_CURSOR` | Frame | Cursor index into 32-slot deferred CGRAM DMA transfer queue. |
| `$7E:1290` | 2 bytes | `TILE_FAMILY_ANIM_TIMER` | Frame | Master frame tick counter synchronizing tile palette cycling and water animation. |
| `$7E:1292` | 224 bytes | `CGRAM_DMA_QUEUE` | Frame | 32-slot deferred CGRAM palette DMA queue (7 bytes per upload descriptor). |
| `$7E:13D2` | 30 bytes | `TILE_ANIM_BUFFERS` | Room | Intermediate staging buffers for animated tile family graphics. |
| `$7E:1432` | 2 bytes | `ANIM_FRAME_HOLD_TIMER` | Frame | Remaining frame duration before advancing to next animated tile phase. |
| `$7E:143A` | 2 bytes | `DOG_LEAD_DISTANCE` | Room | Target follow distance offset maintaining dog companion spacing behind player. |
| `$7E:1518` | 2 bytes | `HDMA_ACTIVE_BANK_PTR` | Frame | Pointer to active double-buffer table feeding HDMA channel tables. |
| `$7E:151A` | 36 bytes | `HDMA_BUFFER_A` | Frame | HDMA scanline table double-buffer Bank A (color gradients / perspective lines). |
| `$7E:153E` | 36 bytes | `HDMA_BUFFER_B` | Frame | HDMA scanline table double-buffer Bank B (color gradients / perspective lines). |
| `$7E:15D2` | 1 byte | `AUDIO_MUTING_FLAG` | Room | Set non-zero to silence background music during dramatic cutscenes. |
| `$7E:15D6` | 1 byte | `APU_COMM_STATUS` | Frame | Handshake status register for SPC700 data transfer synchronization. |
| `$7E:163C` | 128 bytes | `DMA_STAGING_BUFFER` | Frame | Intermediate staging area for tile uploads across VBLANK intervals. |
| `$7E:2200` | 2 bytes | `SRAM_START_MARKER` | Save | Boundary marking start of battery-backed persistent save RAM ($7E:2200..$7E:27FF). |
| `$7E:2210` | 36 bytes | `BOY_NAME_BUFFER` | Save | Custom player character name string buffer (ASCII/tile indices). |
| `$7E:2234` | 36 bytes | `DOG_NAME_BUFFER` | Save | Custom dog companion name string buffer (ASCII/tile indices). |
| `$7E:2258` | 424 bytes | `STORY_FLAGS_ARRAY` | Save | Master bit-packed array of persistent world progression, boss, and chest flags. |
| `$7E:2260` | 1 byte | `BOSS_FLAGS_1` | Save | Boss defeat bitmask flags (bit 0x10 = Thraxx defeated). |
| `$7E:2261` | 1 byte | `PARTY_PASS_THROUGH` | Save | Collision override flags allowing player and companion to walk through each other. |
| `$7E:2262` | 1 byte | `ACTIVE_BUFFS_MASK` | Room | Bitmask flags for active positive status buffs (Speed, Atlas, Defend). |
| `$7E:2263` | 1 byte | `ACTIVE_DEBUFFS_MASK` | Room | Bitmask flags for active negative status debuffs (Poison, Confusion, Confounded). |
| `$7E:2284` | 2 bytes | `ALCHEMY_KNOWN_FLAGS` | Save | Bitmask flags tracking which alchemy formulas have been acquired by player. |
| `$7E:22EA` | 2 bytes | `SYSTEM_STATE_FLAGS` | Save | Engine system flags; bit 2 (0x0004) marks cold boot SRAM initialization completed. |
| `$7E:22EB` | 2 bytes | `ROOM_TRANSITION_FLAGS` | Room | Map flags; bit 2 (0x0004) triggers room enter script and tilemap reload. |
| `$7E:22FC` | 2 bytes | `DESERT_WRAP_Y_` | Save | Game script variable: DESERT WRAP Y? |
| `$7E:22FD` | 2 bytes | `DESERT_WRAP_X_` | Save | Game script variable: DESERT WRAP X? |
| `$7E:22FF` | 1 byte | `STORY_FLAGS_OFFSET_0` | Save | Primary story progression event flag byte. |
| `$7E:2345` | 1 byte | `BAZOOKA_AMMO` | Save | Bazooka ammo counts and the selected ammo. \| address \| meaning \| \| |
| `$7E:234B` | 2 bytes | `HUT_HOUSE_TO_ENTER` | Save | Game script variable: Hut/house to enter |
| `$7E:234F` | 2 bytes | `PRISON_TOWN_EXIT` | Save | Game script variable: PRISON TOWN EXIT |
| `$7E:2352` | 2 bytes | `QUEEN_S_KEY_ON_DOG` | Save | Game script variable: Queen's Key on Dog |
| `$7E:2353` | 2 bytes | `QUEEN_S_KEY_ON_BOY` | Save | Game script variable: Queen's Key on Boy |
| `$7E:2360` | 1 byte | `EQUIPPED_WEAPON_CLASS` | Save | Current weapon class (0=Sword, 2=Axe, 4=Spear, 6=Bazooka). |
| `$7E:2363` | 1 byte | `DOG_FORM_INDEX` | Save | Active visual form and breed of dog companion (0=Wolf, 1=Greyhound, 2=Poodle, 3=Toaster). |
| `$7E:238D` | 2 bytes | `CHANGE_MUSIC` | Save | Game script variable: CHANGE MUSIC |
| `$7E:2391` | 1 byte | `LOOT_MAILBOX` | Room | Loot mailbox — what the next pickup gives. \| offset \| size \| meaning \| \| |
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
| `$7E:23DD` | 2 bytes | `SPAWN_LEASH_OVERRIDE` | Room | Leash radius for enemies spawned in this room (overrides record +$17). A room script can set one leash radius for every enemy it spawns afterwards. 0 turns the |
| `$7E:23E9` | 2 bytes | `MAP_X_START` | Save | Game script variable: MAP X start |
| `$7E:23EB` | 2 bytes | `MAP_Y_START` | Save | Game script variable: MAP Y start |
| `$7E:23ED` | 2 bytes | `MAP_X_END` | Save | Game script variable: MAP X end |
| `$7E:23EF` | 2 bytes | `MAP_Y_END` | Save | Game script variable: MAP Y end |
| `$7E:2401` | 8 bytes | `VIEWPORT_LIMITS` | Room | Active room camera viewport boundary coordinates (Min X, Max X, Min Y, Max Y). |
| `$7E:2409` | 2 bytes | `SHAKE_MAGNITUDE_X` | Frame | Maximum horizontal displacement magnitude for active screen shaking. |
| `$7E:240B` | 2 bytes | `SHAKE_MAGNITUDE_Y` | Frame | Maximum vertical displacement magnitude for active screen shaking. |
| `$7E:240F` | 8 bytes | `CAMERA_DEADZONES` | Room | Bounding deadzone coordinates controlling player-driven camera pan thresholds. |
| `$7E:2429` | 2 bytes | `TRIGGER_SCRIPT_LOCK` | Room | Execution lock held while a step-on coordinate trigger script is running. |
| `$7E:242B` | 1 byte | `CAMERA_TARGET` | Room | Fixed camera target (x, y), or follow an entity. Two words that pin the camera to a fixed map point (x at `$242B`, y at `$242D`, top-left of the view). `$FFFF` |
| `$7E:242F` | 2 bytes | `CAMERA_PAN_SPEED` | Room | Tracking speed multiplier applied during camera smooth pan interpolations. |
| `$7E:2435` | 2 bytes | `SHAKE_DECAY_RATE` | Frame | Attenuation decay rate reducing screen shake intensity each frame. |
| `$7E:2437` | 2 bytes | `MAP_PALETTE_INDEX` | Room | Active map color palette family identifier index. |
| `$7E:243D` | 2 bytes | `BUFF_REQUEST_1` | Room | Queued alchemy formula stat buff application register 1. |
| `$7E:243F` | 2 bytes | `BUFF_REQUEST_2` | Room | Queued alchemy formula stat buff application register 2. |
| `$7E:2441` | 2 bytes | `WEAPON_SWITCH_REQ` | Room | Queued weapon swap command register. |
| `$7E:2443` | 2 bytes | `DOG_FORM_REQUEST` | Room | The Dog form a room asks for (applied and cleared by $8F:946B). Values are the form table's byte index: `2` the act 1 wolf, `4` the wolf with the stick, `6` the |
| `$7E:2445` | 2 bytes | `PRESELECT_ALCHEMY` | Save | Game script variable: PRESELECT ALCHEMY |
| `$7E:2449` | 2 bytes | `SAVE_SPOT` | Save | Game script variable: SAVE SPOT |
| `$7E:2459` | 2 bytes | `INGREDIENT_SHOP` | Save | Game script variable: INGREDIENT SHOP |
| `$7E:2461` | 2 bytes | `LOOT_AMOUNT` | Room | Loot bonus — amount minus one for the next pickup. The loot script adds `1 + $2461`. Pickups that give more than one write `amount − 1` here before calling the |
| `$7E:2480` | 64 bytes | `WEATHER_PARTICLES` | Frame | Position, velocity, and lifetime particle physics state array (rain, snow, embers). |
| `$7E:2834` | 204 bytes | `TEMP_SCRATCH_RAM` | Temp | Compiler temporary scratchpad memory pool ($7E:2834..$7E:28FF); wiped on map reload. |
| `$7E:28FC` | 1 byte | `SCRIPT_SLOTS` | Room | Script slots — 20 × 0x4F bytes. \| offset \| size \| meaning \| \| |
| `$7E:2F28` | 1 byte | `SCRIPT_RUN_LIST` | Room | Script run list — slots in run order, zero-terminated. One word per running thread: the slot of the script that runs next for it (a callee replaces its caller i |
| `$7E:3ABE` | 1 byte | `JOYPAD_CHORD_HISTORY` | Boot | The joypad matcher's ring of recent button chords. 128 words, newest at `$3ABE + $3BBE`, older chords above it (the index counts down and wraps in 8 bits). A re |
| `$7E:3BBE` | 1 byte | `JOYPAD_CHORD_INDEX` | Boot | Offset of the newest chord in the joypad chord history. A byte offset into `$3ABE`, always even, moved down by 2 per new chord. `$3BBF` right after it is the te |
| `$7E:3BBF` | 2 bytes | `DIALOGUE_RING_CURSOR` | Room | Cyclic message buffer index for active dialogue text box rendering. |
| `$7E:3BC3` | 2 bytes | `CHILD_TASK_CURSOR` | Room | Child actor allocation index in multi-tasking scheduler pool. |
| `$7E:3BC5` | 2 bytes | `SCRIPT_TASK_SELECTOR` | Room | Active thread index in script virtual machine scheduler. |
| `$7E:3BC7` | 2 bytes | `ENTITY_FREE_LIST_HEAD` | Room | Head pointer to linked list of available actor entity slots in pool. |
| `$7E:3BC9` | 45 bytes | `COMPANION_BREADCRUMBS` | Room | FIFO coordinate queue tracking historical player positions for companion pathfinding. |
| `$7E:3BFF` | 2 bytes | `BREADCRUMB_QUEUE_TAIL` | Room | Tail offset pointer for companion navigation breadcrumb coordinate queue. |
| `$7E:3C01` | 2 bytes | `COMPANION_ANCHOR` | Room | Target waypoint coordinate anchor guiding dog companion movement. |
| `$7E:3C10` | 2 bytes | `COMPANION_STEP_COUNT` | Room | Step counter regulating companion pathfinding recalculation frequency. |
| `$7E:3C12` | 2 bytes | `COMPANION_NAV_FLAGS` | Room | Behavioral flags for companion pathfinding (leash, obstacle avoidance, sniffing). |
| `$7E:3C14` | 64 bytes | `ACTOR_PARENT_LINKS` | Room | Hierarchy table linking child entity slots to their originating parent actors. |
| `$7E:3DDF` | 2 bytes | `ACTIVE_ENTITY_HEAD` | Room | Head pointer of linked list chaining all active entities in current room. |
| `$7E:3DE5` | 4260 bytes | `ENTITY_SLOTS_POOL` | Room | Actor entity pool (30 slots × 142 bytes); stores positions, animations, stats, and state. |
| `$7E:4E89` | 174 bytes | `BOY_ENTITY_RECORD` | Room | Primary actor entity structure for boy player character. |
| `$7E:4EAD` | 2 bytes | `PRIMARY_ATTACKER_PTR` | Room | Pointer to entity record of actor initiating current physical or magic attack. |
| `$7E:4F37` | 174 bytes | `DOG_ENTITY_RECORD` | Room | Primary actor entity structure for dog companion character. |
| `$7E:4F5B` | 2 bytes | `SECONDARY_ATTACKER_PTR` | Room | Pointer to entity record of target entity receiving combat damage. |
| `$7E:4FE6` | 50 bytes | `MAP_ANIM_FRAMES` | Room | Current animation frame indices for active map animated tile channels. |
| `$7E:5018` | 50 bytes | `MAP_ANIM_TIMERS` | Room | Countdown hold delay timers for active map animated tile channels. |
| `$7E:504A` | 50 bytes | `MAP_ANIM_CYCLES` | Room | Loop cycle iteration counters for active map animated tile channels. |
| `$7E:507D` | 34 bytes | `MAP_ANIM_DESCRIPTORS` | Room | ROM pointers to animated tile sequence descriptor definitions. |
| `$7E:50AD` | 1 byte | `SPRITE_VRAM_ALLOC_TABLE` | Room | Sprite VRAM block allocation table. Used by the dynamic sprite engine in bank $80 to allocate VRAM tile slots for dynamic actors, weapon animations, and particl |
| `$7E:5127` | 1 byte | `SPRITE_QUEUE_INDEX` | Frame | Dynamic sprite queue index. Index into the pending dynamic sprite queue consumed during frame rendering by $80:96BB before direct OAM drawing. |
| `$7E:6187` | 32 bytes | `SPRITE_CGRAM_SHADOW` | Room | Sprite palette shadow buffer DMA-copied to SNES CGRAM during VBLANK. |
| `$7E:61A7` | 224 bytes | `MAP_TILE_PALETTES` | Room | Tile family CGRAM palette shadow buffers (7 families × 32 bytes). |
| `$7E:6289` | 28 bytes | `OAM_SLICE_DESCRIPTORS` | Frame | Hardware sprite OAM tile slice position and attribute descriptor array. |
| `$7E:62A5` | 224 bytes | `TILE_ANIM_VRAM_OFFSETS` | Room | Source VRAM tile offset table for animated tile family cycling. |
| `$7E:7321` | 16 bytes | `LAVA_PALETTE_ROTATION` | Frame | Animated palette rotation buffer for bubbling molten lava surface glow. |
| `$7E:7331` | 16 bytes | `CRYSTAL_PALETTE_CYCLE` | Frame | Animated palette cycling buffer for glowing crystalline minerals. |
| `$7E:96A5` | 1 byte | `OBJ_TILE_LRU_PREV` | Room | OBJ 8x8 tile cache, prev links (130 bytes). `prev[i]` of the OBJ tile cache lists; see `$7E9727`. `$7E9725` = `prev[$80]` (next slot to evict), `$7E9726` = `pre |
| `$7E:9727` | 1 byte | `OBJ_TILE_LRU_NEXT` | Room | OBJ 8x8 tile cache, next links (130 bytes). Doubly linked list over the 128 dynamic OBJ tile slots; a slot number is the OBJ tile number (VRAM word `$6000 + slo |
| `$7E:97A9` | 4782 bytes | `METATILE_BLOCK_TABLE` | Room | 16x16 metatile block composition table mapping 8x8 character tiles. |
| `$7E:AB18` | 96 bytes | `METATILE_LRU_QUEUE` | Room | LRU cache queue tracking loaded 16x16 metatiles in video memory. |
| `$7E:ABDE` | 512 bytes | `LOW_OAM_BUFFER` | Frame | Hardware Low OAM shadow buffer (128 sprites × 4 bytes: X, Y, tile, attributes). |
| `$7E:ADDE` | 32 bytes | `HIGH_OAM_TABLE` | Frame | Hardware High OAM shadow table (128 sprites × 2 bits: X MSB and size toggle). |
| `$7F:0000` | 49920 bytes | `ROOM_METATILE_GRID` | Room | Decompressed active room 16x16 metatile layout grid buffer. |
| `$7F:A000` | 14366 bytes | `FONT_GLYPH_STAGING` | Room | High WRAM 2bpp font glyph rendering and decompression staging buffer. |
| `$7F:C300` | 1280 bytes | `ROOM_PALETTE_TABLE` | Room | Room tile palette index association table. |
| `$7F:C800` | 512 bytes | `SHADOW_TILEMAP_BUF` | Room | Staging buffer for HUD and text box background layer tilemap updates. |
| `$7F:D81E` | 10210 bytes | `DIALOGUE_ASCII_BUFFER` | Room | Dialogue box decoded ASCII text string rasterization buffer. |
