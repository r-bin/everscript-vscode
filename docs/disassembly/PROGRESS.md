# Reverse Engineering & Decompilation Progress Dashboard

> Canonical tracking of Secret of Evermore engine decompilation, function identification, and WRAM mapping.
> Sessions can pick up directly from this document by checking the **Current Progress** and **Prioritized Next Targets**.

---

## 1. Overall Progress Summary

| Metric | Completed | Total / Scope | Progress (%) | Status |
|---|---|---|---|---|
| **CDL ROM Coverage** | ~42,584 bytes | ~450,000 code bytes | **9.3 %** | Expanding via scripted emulator runs |
| **Identified / Named Functions** | 50 | 403 (CDL recorded roots) | **12.4 %** | In Progress |
| **Fully Documented Functions** | 25 | 403 (CDL recorded roots) | **6.2 %** | In Progress |
| **Clean C Decompiled Functions** | 16 | 403 (CDL recorded roots) | **4.0 %** | Boot, Main Loop, NMI, Enter Room, Room Reset, Script VM Dispatcher, Expression Evaluator, Entity Pool, APU Handshake, Soundbank Loader, Music Player, Entity Physics, Trigger Scanner, Tile Collision, Spell Power Math, Camera Centering |
| **WRAM Variables Mapped** | 1,680 | 32,291 accessed bytes | **5.2 %** | Metatile records, camera bounds, and alchemy stats mapped |
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
| **Actor & Animation Engine** | `$80:9685`, `$90:xxxx` | 10 / 45 | 2 / 2 (`init_entity_pool`, `update_entity_physics`) | ✅ **Complete**: [`actor-lifecycle.md`](entities/actor-lifecycle.md), [`physics-integration.md`](entities/physics-integration.md) |
| **Combat & Damage Math** | `$89:xxxx`, `$91:xxxx` | 8 / 38 | 1 / 1 (`calc_spell_power_and_cast`) | ✅ **Complete**: [`alchemy-formulas.md`](combat/alchemy-formulas.md) |
| **Audio / APU Handshake & Sound**| `$8C:8000` – `$8C:83FF` | 8 / 15 | 3 / 3 (`apu_command_handshake`, `load_song_soundbank`, `play_music_track`) | ✅ **Complete**: [`spc-handshake.md`](audio/spc-handshake.md) |
| **Camera & Viewport Subsystem**| `$90:94AB` – `$90:9544` | 3 / 6 | 1 / 1 (`camera_center_and_clamp`) | ✅ **Complete**: [`camera-system.md`](engine-core/camera-system.md) |
| **Map Metatiles & Collision Grid**| `$90:9DE8` – `$90:9E72` | 4 / 10 | 2 / 2 (`eval_tile_collision`, `update_entity_plane`) | ✅ **Complete**: [`tile-collision.md`](maps/tile-collision.md) |

---

## 3. Prioritized Next Targets (For Autonomous Continuations)

When an agent is prompted with *"continue the decompilation"*, work down this ordered queue:

1. **Target 1: Ring Menu Engine & Item Selection (`$8E:8000` – `$8E:83FF`)**:
   - Location: Bank `$8E` (`$8E:8000` – `$8E:83FF`).
   - Purpose: Ring menu open/rotation animation, weapon/alchemy/item icon descriptors (`$8E:827C`), sub-menu navigation, and inventory validation.
   - Evidence to consult: `alchemy-spell-mechanics/SKILL.md` Section 1, `soe://rom/0e8000.asm`.
   - Deliverable: Decompile into clean C in `docs/disassembly/ui/ring-menu.md`.

2. **Target 2: Combat Damage Mitigation & Hurtbox Collision (`$91:9C90` – `$91:9D80`)**:
   - Location: Bank `$91` (`$91:9C90` – `$91:9D80`).
   - Purpose: Physical & magic damage calculations, defense reduction (`(64 - M.Def) / 64`), damage pop-up numbers, and HP subtraction/death state triggering.
   - Evidence to consult: `docs/disassembly/combat/alchemy-formulas.md`, `soe://rom/019c90.asm`.
   - Deliverable: Decompile into clean C in `docs/disassembly/combat/damage-mitigation.md`.

3. **Target 3: Animation Bytecode VM & Keyframe Driver (`$90:80CE` – `$90:8250`)**:
   - Location: Bank `$90` (`$90:80CE` – `$90:8250`).
   - Purpose: Secret of Evermore's animation bytecode interpreter (`$90`), frame duration timers, and keyframe event triggering.
   - Evidence to consult: `.agents/skills/animation-script/SKILL.md`, `soe://rom/0080ce.asm`.
   - Deliverable: Decompile into clean C in `docs/disassembly/animation/animation-vm.md`.

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
