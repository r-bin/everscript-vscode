# Reverse Engineering & Decompilation Progress Dashboard

> Canonical tracking of Secret of Evermore engine decompilation, function identification, and WRAM mapping.
> Sessions can pick up directly from this document by checking the **Current Progress** and **Prioritized Next Targets**.

---

## 1. Overall Progress Summary

| Metric | Completed | Total / Scope | Progress (%) | Status |
|---|---|---|---|---|
| **CDL ROM Coverage** | ~42,584 bytes | ~450,000 code bytes | **9.3 %** | Expanding via scripted emulator runs |
| **Identified / Named Functions** | 79 | 403 (CDL recorded roots) | **19.6 %** | In Progress |
| **Fully Documented Functions** | 54 | 403 (CDL recorded roots) | **13.4 %** | In Progress |
| **Clean C Decompiled Functions** | 40 | 403 (CDL recorded roots) | **9.9 %** | Boot, Main Loop, NMI, Enter Room, Room Reset, Script VM Dispatcher, Expression Evaluator, Entity Pool, APU Handshake, Soundbank Loader, Music Player, Entity Physics, Trigger Scanner, Tile Collision, Spell Power Math, Camera Centering, Ring Menu Validator, Damage Mitigation, Animation VM, Companion & Dog AI, Weapon Stamina Regen, Attack Level Select, Damage Stamina Scaling, Name Profanity Filter, Equipped Armor Defense, Enemy AI Dispatcher, Roaming Monster AI, Aggro Detection Pipeline, Stationary Turret AI, Dialogue String Key Decoder, Magmar Boss State Machine, Static Boss Target Exposure, Submerging Swamp Boss AI, Alchemy Cost & XP Progression, Isometric Collision Overlap, Entity Movement Blocker, Hit Reaction & Knockback, Palette Cycle Groups 1 & 2, Weather Particles & Screen Shake |
| **WRAM Variables Mapped** | 2,650 | 32,291 accessed bytes | **8.2 %** | Ingredient counters $7E:22FF..$2314, spell XP registers, palette shadow buffers $7E:7321/$7331, and screen shake registers mapped |
| **Mechanical C Lift (snesrecomp)** | 400 roots | 400 roots (1,079 variants) | **100 %** | Compiles & runs |

---

## 2. Subsystem Breakdown

| Subsystem | Key Address Range | Functions Named | C Decompiled | Status & Documentation |
|---|---|---|---|---|
| **Boot, Hardware & Weather** | `$80:8020` – `$80:A3FF` | 7 / 16 | 4 / 4 (`reset_handler`, `cycle_palette_group_1`, `cycle_palette_group_2`, `weather_tick_and_screen_shake`) | ✅ **Complete**: [`boot-reset.md`](engine-core/boot-reset.md), [`weather-palette.md`](engine-core/weather-palette.md) |
| **Engine Main Loop & Tasks** | `$80:8B66` – `$80:8CC8` | 6 / 12 | 1 / 1 (`main_loop_entry`) | ✅ **Complete**: [`main-loop.md`](engine-core/main-loop.md) |
| **NMI & Video Refresh (VBLANK)**| `$80:823A` – `$80:84A0` | 5 / 8 | 1 / 1 (`nmi_handler`) | ✅ **Complete**: [`nmi-vblank.md`](engine-core/nmi-vblank.md) |
| **Screen Transitions & Room Loader** | `$8E:E4E2` – `$8E:FFFF` | 9 / 22 | 4 / 4 (`enter_room`, `reset_per_room_state`, `scan_room_triggers`, `spawn_character_script_thread`) | ✅ **Complete**: [`room-enter.md`](engine-core/room-enter.md), [`trigger-scanner.md`](maps/trigger-scanner.md), [`equipment-stats.md`](ui/equipment-stats.md) |
| **Core WRAM & PPU Shadows** | `$7E:0070` – `$7E:013A` | 34 / 34 | Structs Defined | ✅ **Complete**: [`wram-map.md`](engine-core/wram-map.md) |
| **Script VM & Opcode Dispatch**| `$8C:CFFD` – `$8C:EFFF` | 38 / 195 | 5 / 5 (`script_scheduler_pass`, `script_vm_eval_expression`, `launch_trigger_script`, `decode_dialogue_string_key`, `decode_dialogue_string_key_secondary`) | ✅ **Complete**: [`dispatcher.md`](script-vm/dispatcher.md), [`expression-eval.md`](script-vm/expression-eval.md), [`dialogue-window.md`](ui/dialogue-window.md) |
| **Actor & Animation Engine** | `$80:9685`, `$90:xxxx` | 13 / 45 | 5 / 5 (`init_entity_pool`, `update_entity_physics`, `anim_vm_tick`, `companion_input_ai_dispatcher`, `companion_entity_update`) | ✅ **Complete**: [`actor-lifecycle.md`](entities/actor-lifecycle.md), [`physics-integration.md`](entities/physics-integration.md), [`animation-vm.md`](animation/animation-vm.md), [`dog-ai.md`](entities/dog-ai.md) |
| **Combat, Hitboxes & Enemy AI** | `$89:xxxx`, `$8F:Bxxx`–`$8F:Dxxx` | 24 / 52 | 14 / 14 (`calc_spell_power_and_cast`, `apply_spell_damage_to_targets`, `recharge_entity_stamina`, `select_attack_level_by_stamina`, `scale_damage_by_stamina`, `enemy_ai_dispatcher`, `enemy_ai_roaming_chaser`, `enemy_ai_check_aggro`, `boss_ai_magmar`, `boss_part_static_target`, `alchemy_deduct_ingredients_and_award_xp`, `entity_collision_check`, `test_entity_pair_overlap`, `dispatch_hit_reaction_and_knockback`) | ✅ **Complete**: [`alchemy-formulas.md`](combat/alchemy-formulas.md), [`damage-mitigation.md`](combat/damage-mitigation.md), [`weapon-charge.md`](combat/weapon-charge.md), [`enemy-ai.md`](entities/enemy-ai.md), [`boss-engine.md`](combat/boss-engine.md), [`alchemy-ingredients.md`](combat/alchemy-ingredients.md), [`hitbox-intersections.md`](combat/hitbox-intersections.md) |
| **Audio / APU Handshake & Sound**| `$8C:8000` – `$8C:83FF` | 8 / 15 | 3 / 3 (`apu_command_handshake`, `load_song_soundbank`, `play_music_track`) | ✅ **Complete**: [`spc-handshake.md`](audio/spc-handshake.md) |
| **Camera & Viewport Subsystem**| `$90:94AB` – `$90:9544` | 3 / 6 | 1 / 1 (`camera_center_and_clamp`) | ✅ **Complete**: [`camera-system.md`](engine-core/camera-system.md) |
| **Map Metatiles & Collision Grid**| `$90:9DE8` – `$90:9E72` | 4 / 10 | 2 / 2 (`eval_tile_collision`, `update_entity_plane`) | ✅ **Complete**: [`tile-collision.md`](maps/tile-collision.md) |
| **Ring Menu & UI Subsystems** | `$8E:8000` – `$8E:9F00` | 6 / 12 | 5 / 5 (`ring_menu_select_and_cost_check`, `calc_equipped_armor_defense`, `init_equipment_screen_slots`, `check_name_profanity`, `decode_dialogue_string_key`) | ✅ **Complete**: [`ring-menu.md`](ui/ring-menu.md), [`equipment-stats.md`](ui/equipment-stats.md), [`weapon-charge.md`](combat/weapon-charge.md), [`dialogue-window.md`](ui/dialogue-window.md) |

---

## 3. Prioritized Next Targets (For Autonomous Continuations)

When an agent is prompted with *"continue the decompilation"*, work down this ordered queue:

1. **Target 1: Player Dash / Sprinting Mechanics & Collision Slopes (`$80:92E0` – `$80:9400`)**:
   - Location: Bank `$80` (`$80:92E0` – `$80:9400`).
   - Purpose: B-button sprinting velocity boost, stamina bar drain while running, sub-pixel acceleration accumulation, and 45-degree slope guide velocity vector projection.
   - Evidence to consult: `src/games/evermore/simulation/machine.ts`, `soe://rom/0092e0.asm`.
   - Deliverable: Decompile into clean C in `docs/disassembly/engine-core/player-movement.md`.

2. **Target 2: Shop Buying, Selling & Currency Exchange Engine (`$8E:8400` – `$8E:8700`)**:
   - Location: Bank `$8E` (`$8E:8400` – `$8E:8700`).
   - Purpose: 4 world currency converters (Talons, Jewels, Gold Coins, Credits), item cost calculation, inventory 6-item capacity validation, and transaction confirmation.
   - Evidence to consult: `docs/script-format/shops.md`, `soe://rom/0e8400.asm`.
   - Deliverable: Decompile into clean C in `docs/disassembly/ui/shop-system.md`.

3. **Target 3: Sound Effect Queue & Multi-Voice Channel Allocator (`$8C:8300` – `$8C:8450`)**:
   - Location: Bank `$8C` (`$8C:8300` – `$8C:8450`).
   - Purpose: SFX priority arbitration, queueing up to 4 concurrent sound effects across SPC700 voice channels 4–7, pitch modulation, and interruption logic.
   - Evidence to consult: `docs/disassembly/audio/spc-handshake.md`, `soe://rom/0c8300.asm`.
   - Deliverable: Decompile into clean C in `docs/disassembly/audio/sfx-queue.md`.

---

## 4. Session History

- **2026-10-18 (Session 1)**: Initialized `docs/disassembly/engine-core/`. Disassembled, analyzed, and reconstructed C decompilations for `reset_handler` (`$80:8020`), `main_loop_entry` (`$80:8B66`), `nmi_handler` (`$80:823A`), and mapped core engine WRAM. Created progress tracking dashboard and `.agents/agents/decomp-curator.md`.
- **2026-10-18 (Session 2)**: Continued decompilation with Target 1 & 2: `enter_room` (`$8E:E4E2`) and `reset_per_room_state` (`$90:8E90`). Analyzed audio silence commands, camera deadzones, VRAM lock `$0F3A`, metatile dimension unpack from `$9F:FDE7`, and character spawn loops. Added `room-enter.md` and upgraded knowledge entries to `confirmed`.
- **2026-10-18 (Session 3)**: Decompiled Target 1, Target 2, and Target 3 from queue:
  - Script VM Turn Dispatcher (`$8C:CFFD` – `$8C:D0C2`): analyzed thread run-list, state jump table (`$8C:D029`), modes 2, 4, 6, 8, 10, 12, opcode dispatcher loop, and carry-flag yield protocol (`docs/disassembly/script-vm/dispatcher.md`).
  - Script VM Expression / Argument Evaluator (`$8C:D315` – `$8C:EA65`): analyzed postfix stack evaluation, terminal bit 7 rotating into `$8A`, sub-op table `$8C:F041`, and argument writeback to `$0E80` (`docs/disassembly/script-vm/expression-eval.md`).
  - Actor & Entity Active Pool Initialization (`$80:9685`): analyzed circular doubly-linked active list nodes (`$7E:50A7`..`$7E:512F`), status sentinels, and tail limit `$1276` (`docs/disassembly/entities/actor-lifecycle.md`).
  - Improved `findCuratedC` scoring in `src/games/evermore/resources/decomp-view.js` to match primary documents over casual mentions.
  - Added new knowledge entry `809685.md` and cross-linked knowledge entries. Advanced queue to Audio SPC Handshake and Actor Velocity integration.
- **2026-10-18 (Session 4)**: Decompiled Audio Driver, Entity Physics, and Map Triggers:
  - Audio Handshake & Driver (`$8C:81FD`, `$8C:8236`, `$8C:828F`): analyzed APU spinlock on `$2140`–`$2143` with 0x2800 timeout recovery, soundbank streaming through IPL bootloader `$805B`, and music track playback dispatcher (`docs/disassembly/audio/spc-handshake.md`).
  - Actor Velocity & Coordinate Physics Integration (`$80:96BB`): analyzed reverse traversal of entity doubly-linked list (`$7E:5127` down to `$7E:50A7`), coordinate/velocity unpacking, boundary testing via `$80:9040`, and sentinel termination (`docs/disassembly/entities/physics-integration.md`).
  - Map Trigger Scanner & Script Launcher (`$8F:ACCE` – `$8F:AD4D`, `$8C:CE5C`): analyzed pixel-to-metatile cell conversion (`>> 4`), 6-byte bounding box evaluations (`y1, x1, y2, x2, scriptId`), script address resolution from `$92:8000`, VM slot allocation (`$8C:CF18`), and run-list scheduling (`docs/disassembly/maps/trigger-scanner.md`).
  - Upgraded knowledge entries `8c81fd.md`, `8c8236.md`, `8c828f.md`, `8facce.md` to confirmed; added `8096bb.md` and `8cce5c.md`. Advanced queue to Tile Collision, Alchemy Formulas, and Camera Tracking.
- **2026-10-18 (Session 5)**: Decompiled Tile Collision, Alchemy Formula Engine, and Camera Viewport System:
  - Metatile Collision Evaluator & Elevation Plane Mechanics (`$90:9DE8`, `$8F:A914`): analyzed 16-bit collision words, entity gates 3, 5, 7, plane transparency bit 6, elevation plane matching bits 5..4, always-walkable override bit 13, and sub-tile slope codes (`docs/disassembly/maps/tile-collision.md`).
  - Alchemy Formula Engine & Spell Power Math (`$91:CCD8`): analyzed target counting at `slot+$2E`, gross power math using hardware multiplier `$4202`, multi-target division via `$4204`, random variance (50% min + RNG), and formula experience/level-up progression (`docs/disassembly/combat/alchemy-formulas.md`).
  - Camera Centering & Margin Clamping (`$90:94AB`): analyzed fixed cutscene targets (`$242B`) vs entity tracking (`$0F42`), VRAM safety locking (`$0F3A++`), centering arithmetic, and clamping to `$7E:23E9`..`$23EF` (`docs/disassembly/engine-core/camera-system.md`).
  - Upgraded knowledge entries `909de8.md`, `8fa914.md`, `91ccd8.md`, `9094ab.md` to confirmed. Advanced queue to Ring Menu, Damage Mitigation, and Animation VM.
- **2026-10-18 (Session 6)**: Decompiled Ring Menu Subsystem, Combat Damage Mitigation, and Animation VM:
  - Ring Menu Engine & Item Descriptors (`$8E:8000`, `$8E:8D80`): analyzed 16-bit pointer table, 8-byte item structs, sub-item identifier extraction, player currency validation, and transaction rejection (`docs/disassembly/ui/ring-menu.md`).
  - Combat Damage Mitigation & Hurtbox Resolution (`$91:9C90`): analyzed asymmetric defense reduction (player linear MDef subtraction vs enemy 64-base fractional reduction via Mode 7 multiplier `$211B`/`$2135`), damage clamping 1..999, HP subtraction, and floating number dispatch via `$8F:C0D3` (`docs/disassembly/combat/damage-mitigation.md`).
  - Animation Bytecode VM & Keyframe Driver (`$90:80CE`): analyzed 24-bit script instruction pointer `[$5D]`, bit 7 end-of-frame marker, opcode dispatch via `$90:8000`, hold timer countdown (`slot+$05`), and PC advancement (`docs/disassembly/animation/animation-vm.md`).
  - Created `8e8d80.md`; upgraded `919c90.md` and `9080ce.md` to confirmed. Advanced queue to Dog AI, Weapon Charge, and Equipment Stats.
- **2026-10-18 (Session 7)**: Decompiled Companion Dog AI, Weapon Charge & Stamina Mechanics, and Equipment Stats:
  - Companion & Dog AI State Machine (`$8C:DAC5`, `$8F:CD4D`, `$92:A44C`): analyzed party controller input routing vs follower AI, companion waypoint navigation (`$8F:9937`), distance leash thresholds (32px idle, 128px run, 384px desync teleport), sniffing spot proximity detection, and B-trigger loot excavation (`docs/disassembly/entities/dog-ai.md`).
  - Weapon Charge, Stamina Gauge Math & String Profanity Filter (`$8F:CC5D`, `$90:82D8`, `$8F:C02B`, `$80:B173`): analyzed 0..1024 (`$0400`) stamina gauge, per-tick `charge_speed` addition, attack animation tier selection (Level 0 jab under 100%, Level 1 standard at 100%, Levels 2/3 charge tiers), attack power scaling (quarter damage penalty under 50%), attack swing discharge (`STZ $002E,X`), and case-insensitive naming screen profanity detection setting `$7E:22E9` bit 5 (`docs/disassembly/combat/weapon-charge.md`).
  - Equipment Inventory, Armor Defense Calculation & Script Spawning (`$8E:99D2`, `$8E:9A86`, `$8E:A091`): analyzed 4 gear categories (helmets/collars `0x16`, vests `0x1A`, bracers `0x1C`, accessories `0x1E`), bitmask validation against `$C4:59A4` / `$C4:59C0`, accumulation into `$7E:07A4` (defense) and `$7E:07A6` (MDef), propagation to character stat blocks (`$7E:0ABA` / `$7E:0A26` / `$7E:0A70`), and character script VM thread instantiation (`docs/disassembly/ui/equipment-stats.md`).
  - Created confirmed knowledge entries `8cdac5.md`, `8fcd4d.md`, `8fcc5d.md`, `9082d8.md`, `8fc02b.md`, `80b173.md`, `8e99d2.md`, `8e9a86.md`, `8ea091.md`. Advanced queue to Enemy AI, Dialogue Window, and Boss Multi-Part Drivers.
- **2026-10-18 (Session 8)**: Decompiled Enemy AI Behavioral State Machine, Dialogue String Key Decoder, and Boss Multi-Part State Driver:
  - Enemy AI Dispatcher & Roaming Monster Loop (`$8F:CD17`, `$8F:D34B`, `$8F:D69B`, `$8F:D6FB`): analyzed character record offset `entity +0x60`, behavior word read from `$8E0003,X`, 15-entry jump table `$8F:CBE0`, aggro filter pipeline (100% stamina gate `$0400`, RNG roll vs `aggro_chance`, bounding box $|dx| < \text{range}$ and $|dy| < \text{range}$ checks for Boy and Dog), stationary turret hazard loop, and target pointer lock in `entity +0x24` (`docs/disassembly/entities/enemy-ai.md`).
  - Dialogue Window & Text Box String Decoder Engine (`$8C:CCF5`, `$8C:CD35`, `$91:D000`): analyzed 3,002-entry string keys table, bit 23 dictionary compression flag, bank/offset resolution, word dictionary expansions (`$91:F46C` / `$91:F3EC`), digraph substitutions (`$91:F32E`), and plain ASCII blitting into WRAM buffer `$7F:D81E` for Script VM opcode `0x51` (`docs/disassembly/ui/dialogue-window.md`).
  - Boss Multi-Part State Driver & HP Phase Transitions (`$8F:D5D2`, `$8F:D76A`, `$8F:D715`): analyzed Magmar lava boss AI (submerged subterranean tracking, surfaced lava projectile spit `$DA66`, HP < 512 enrage rolling boulder with mode `$4000` continuous charging contact damage), static boss core targets (Thraxx Heart, Coleoptera Heart, Aegis shielding exposure), and submerging multi-segment body links (`0x57`) for Salabog and Tar Skull (`docs/disassembly/combat/boss-engine.md`).
  - Created confirmed knowledge entries `8fcd17.md`, `8fd34b.md`, `8fd69b.md`, `8fd6fb.md`, `8cccf5.md`, `8ccd35.md`, `8fd5d2.md`, `8fd76a.md`, `8fd715.md`, and upgraded `d1d000.md`. Advanced queue to Alchemy Ingredients, Hitbox Intersections, and Weather/Palettes.
- **2026-10-18 (Session 9)**: Decompiled Alchemy Ingredient Consumption Math, Hitbox Damage Intersections, and Weather/Palette Animation Engine:
  - Alchemy Formula Inventory & Ingredient Consumption Math (`$91:D800`, `$C4:601F`, `$7E:22FF`): analyzed 22 alchemical ingredients (`$7E:22FF`–`$7E:2314`), cost table `$C4:601F` (`[ing1, ing2, qty1, qty2]`), pre-cast validation and inventory subtraction, formula usage counter `$7E:2FDE`, formula experience award `$7E:2F52` via `$C4:5B9C` (`10 XP` at Lv0 down to `1 XP` at Lv6..Lv9), and level advance at 100 XP (`docs/disassembly/combat/alchemy-ingredients.md`).
  - Hitbox Damage Intersections, Elliptical Collision & Knockback Vectors (`$8F:B46D`, `$8F:B4AB`, `$8F:C0D3`): analyzed 2:1 isometric collision ellipse rule ($|dx| < r_1 + r_2$ and $2 \cdot |dy| < r_1 + r_2$), overlapping mover bypass (`$8F:B4FD`), invulnerability flash timer in `entity +0x14` (30 frames), floating damage number dispatch (`$8F:C09A`), and normalized knockback velocity vector integration (`docs/disassembly/combat/hitbox-intersections.md`).
  - Weather Effects, Palette Cycling & Screen Shake Engine (`$80:9E93`, `$80:A003`, `$80:A2E0`): analyzed animated palette cycling rotation in WRAM shadow buffers `$7E:7321` and `$7E:7331` for molten lava and glowing crystals, queued for VBLANK CGRAM DMA, falling weather particle simulation (rain/snow/embers), and screen shake decay curve in `$C3` / `$7E:2435` with camera displacement `$7E:2437` (`docs/disassembly/engine-core/weather-palette.md`).
  - Created confirmed knowledge entries `91d800.md`, `8fb46d.md`, `8fb4ab.md`, `8fc0d3.md`, `809e93.md`, `80a003.md`, `80a2e0.md`, and upgraded `c4601f.md`. Advanced queue to Player Dash/Sprint, Shop Currency Engine, and Sound Effect Allocator.



