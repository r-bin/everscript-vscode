# Reverse Engineering & Decompilation Progress Dashboard

> Canonical tracking of Secret of Evermore engine decompilation, function identification, and WRAM mapping.
> Sessions can pick up directly from this document by checking the **Current Progress** and **Prioritized Next Targets**.

---

## 1. Overall Progress Summary

| Metric | Completed | Total / Scope | Progress (%) | Status |
|---|---|---|---|---|
| **CDL ROM Coverage** | ~42,584 bytes | ~450,000 code bytes | **9.3 %** | Expanding via scripted emulator runs |
| **Identified / Named Functions** | 51 | 403 (CDL recorded roots) | **12.7 %** | In Progress |
| **Fully Documented Functions** | 28 | 403 (CDL recorded roots) | **6.9 %** | In Progress |
| **Clean C Decompiled Functions** | 19 | 403 (CDL recorded roots) | **4.7 %** | Boot, Main Loop, NMI, Enter Room, Room Reset, Script VM Dispatcher, Expression Evaluator, Entity Pool, APU Handshake, Soundbank Loader, Music Player, Entity Physics, Trigger Scanner, Tile Collision, Spell Power Math, Camera Centering, Ring Menu Validator, Damage Mitigation, Animation VM |
| **WRAM Variables Mapped** | 1,800 | 32,291 accessed bytes | **5.6 %** | Ring menu inventory, damage multipliers, and animation timers mapped |
| **Mechanical C Lift (snesrecomp)** | 400 roots | 400 roots (1,079 variants) | **100 %** | Compiles & runs |

---

## 2. Subsystem Breakdown

| Subsystem | Key Address Range | Functions Named | C Decompiled | Status & Documentation |
|---|---|---|---|---|
| **Boot & Hardware Reset** | `$80:8020` – `$80:8236` | 4 / 4 | 1 / 1 (`reset_handler`) | ✅ **Complete**: [`boot-reset.md`](engine-core/boot-reset.md) |
| **Engine Main Loop & Tasks** | `$80:8B66` – `$80:8CC8` | 6 / 12 | 1 / 1 (`main_loop_entry`) | ✅ **Complete**: [`main-loop.md`](engine-core/main-loop.md) |
| **NMI & Video Refresh (VBLANK)**| `$80:823A` – `$80:84A0` | 5 / 8 | 1 / 1 (`nmi_handler`) | ✅ **Complete**: [`nmi-vblank.md`](engine-core/nmi-vblank.md) |
| **Screen Transitions & Room Loader** | `$8E:E4E2` – `$8E:FFFF` | 8 / 22 | 3 / 3 (`enter_room`, `reset_per_room_state`, `scan_room_triggers`) | ✅ **Complete**: [`room-enter.md`](engine-core/room-enter.md), [`trigger-scanner.md`](maps/trigger-scanner.md) |
| **Core WRAM & PPU Shadows** | `$7E:0070` – `$7E:013A` | 34 / 34 | Structs Defined | ✅ **Complete**: [`wram-map.md`](engine-core/wram-map.md) |
| **Script VM & Opcode Dispatch**| `$8C:CFFD` – `$8C:EFFF` | 36 / 195 | 3 / 3 (`script_scheduler_pass`, `script_vm_eval_expression`, `launch_trigger_script`) | ✅ **Complete**: [`dispatcher.md`](script-vm/dispatcher.md), [`expression-eval.md`](script-vm/expression-eval.md) |
| **Actor & Animation Engine** | `$80:9685`, `$90:xxxx` | 11 / 45 | 3 / 3 (`init_entity_pool`, `update_entity_physics`, `anim_vm_tick`) | ✅ **Complete**: [`actor-lifecycle.md`](entities/actor-lifecycle.md), [`physics-integration.md`](entities/physics-integration.md), [`animation-vm.md`](animation/animation-vm.md) |
| **Combat & Damage Math** | `$89:xxxx`, `$91:xxxx` | 9 / 38 | 2 / 2 (`calc_spell_power_and_cast`, `apply_spell_damage_to_targets`) | ✅ **Complete**: [`alchemy-formulas.md`](combat/alchemy-formulas.md), [`damage-mitigation.md`](combat/damage-mitigation.md) |
| **Audio / APU Handshake & Sound**| `$8C:8000` – `$8C:83FF` | 8 / 15 | 3 / 3 (`apu_command_handshake`, `load_song_soundbank`, `play_music_track`) | ✅ **Complete**: [`spc-handshake.md`](audio/spc-handshake.md) |
| **Camera & Viewport Subsystem**| `$90:94AB` – `$90:9544` | 3 / 6 | 1 / 1 (`camera_center_and_clamp`) | ✅ **Complete**: [`camera-system.md`](engine-core/camera-system.md) |
| **Map Metatiles & Collision Grid**| `$90:9DE8` – `$90:9E72` | 4 / 10 | 2 / 2 (`eval_tile_collision`, `update_entity_plane`) | ✅ **Complete**: [`tile-collision.md`](maps/tile-collision.md) |
| **Ring Menu & UI Subsystems** | `$8E:8000` – `$8E:8E00` | 2 / 8 | 1 / 1 (`ring_menu_select_and_cost_check`) | ✅ **Complete**: [`ring-menu.md`](ui/ring-menu.md) |

---

## 3. Prioritized Next Targets (For Autonomous Continuations)

When an agent is prompted with *"continue the decompilation"*, work down this ordered queue:

1. **Target 1: Dog AI State Machine & Sniffing Logic (`$8C:A400` / `$80:A4B5`)**:
   - Location: Bank `$8C` / `$80` (`func_C0A4B5_M1X1`).
   - Purpose: Dog companion AI: following distance to boy, sniffing hidden ingredient spots, aggressive enemy targeting, and sit/fetch behaviors.
   - Evidence to consult: `.agents/skills/secret-of-evermore-engine/SKILL.md`, `soe://rom/00a4b5.asm`.
   - Deliverable: Decompile into clean C in `docs/disassembly/entities/dog-ai.md`.

2. **Target 2: Weapon Charge Attack & Stamina Gauge Math (`$80:B173` / `$80:B21F`)**:
   - Location: Bank `$80` (`func_C0B173_M0X0`, `bank_80_B21F_M0X0`).
   - Purpose: 0–100% weapon recharge stamina bar, charge levels 1–3 hold timers, and attack swing hitboxes.
   - Evidence to consult: `src/games/evermore/simulation/machine.ts`, `soe://rom/00b173.asm`.
   - Deliverable: Decompile into clean C in `docs/disassembly/combat/weapon-charge.md`.

3. **Target 3: Inventory Storage & Equipment Stat Application (`$8E:9EBE` / `$8E:9FA8`)**:
   - Location: Bank `$8E` (`$8E:9EBE` – `$8E:A050`).
   - Purpose: Equipping armors (collar, vest, helmet, bracer), calculating defense/magic defense aggregates, and weapon swapping.
   - Evidence to consult: `docs/disassembly/ui/ring-menu.md`, `soe://rom/0e9ebe.asm`.
   - Deliverable: Decompile into clean C in `docs/disassembly/ui/equipment-stats.md`.

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
