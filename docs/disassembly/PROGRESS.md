# Reverse Engineering & Decompilation Progress Dashboard

> Canonical tracking of Secret of Evermore engine decompilation, function identification, and WRAM mapping.
> Sessions can pick up directly from this document by checking the **Current Progress** and **Prioritized Next Targets**.

---

## 1. Overall Progress Summary

| Metric | Completed | Total / Scope | Progress (%) | Status |
|---|---|---|---|---|
| **CDL ROM Coverage** | ~42,584 bytes | ~450,000 code bytes | **9.3 %** | Expanding via scripted emulator runs |
| **Identified / Named Functions** | 50 | 403 (CDL recorded roots) | **12.4 %** | In Progress |
| **Fully Documented Functions** | 22 | 403 (CDL recorded roots) | **5.5 %** | In Progress |
| **Clean C Decompiled Functions** | 13 | 403 (CDL recorded roots) | **3.2 %** | Boot, Main Loop, NMI, Enter Room, Room Reset, Script VM Dispatcher, Expression Evaluator, Entity Pool, APU Handshake, Soundbank Loader, Music Player, Entity Physics, Trigger Scanner |
| **WRAM Variables Mapped** | 1,480 | 32,291 accessed bytes | **4.6 %** | Audio I/O shadows, physics vectors, and trigger context mapped |
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
| **Combat & Damage Math** | `$89:xxxx`, `$91:xxxx` | 6 / 38 | Formulas Identified | 🟡 Documented in [`docs/alchemy-damage.md`](../alchemy-damage.md) |
| **Audio / APU Handshake & Sound**| `$8C:8000` – `$8C:83FF` | 8 / 15 | 3 / 3 (`apu_command_handshake`, `load_song_soundbank`, `play_music_track`) | ✅ **Complete**: [`spc-handshake.md`](audio/spc-handshake.md) |

---

## 3. Prioritized Next Targets (For Autonomous Continuations)

When an agent is prompted with *"continue the decompilation"*, work down this ordered queue:

1. **Target 1: Tile Collision Word Evaluator & Height System (`$80:9040` – `$80:91A0`)**:
   - Location: Bank `$80` (`$80:9040` – `$80:91A0`).
   - Purpose: Evaluates 16-bit metatile collision words (`0x8000` interactive target, `0x4000` step-on, `0x2000` elevation mask, passability nibbles) during entity movement vector updates.
   - Evidence to consult: `docs/map-format/map_collision_mechanics.md`, `soe://rom/009040.asm`.
   - Deliverable: Decompile into clean C in `docs/disassembly/maps/tile-collision.md`.

2. **Target 2: Alchemy Damage & Formula Calculator (`$89:A000` / `$89:B100` / `$91:xxxx`)**:
   - Location: Bank `$89` / `$91`.
   - Purpose: Master damage scaling, ingredient power multipliers, leveling curves, and status effect duration math.
   - Evidence to consult: `docs/alchemy-damage.md`, `.agents/skills/alchemy-spell-mechanics/SKILL.md`.
   - Deliverable: Decompile into clean C in `docs/disassembly/combat/alchemy-formulas.md`.

3. **Target 3: Camera Scroll & Deadzone Tracking (`$80:8ED0` / `$8E:E800`)**:
   - Location: Bank `$80` (`$80:8ED0` – `$80:8F50`).
   - Purpose: Smooth camera viewport interpolation following target entity (`$0F42`), window margins, and room coordinate boundary clamping.
   - Evidence to consult: `main-loop.md` Part 2, `soe://rom/008ed0.asm`.
   - Deliverable: Decompile into clean C in `docs/disassembly/engine-core/camera-system.md`.

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
