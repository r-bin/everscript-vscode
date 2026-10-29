# ROM Data Extraction, Master Tables, Enums & Decompilation Backlog

> **Domain:** ROM Static Data Extraction, WRAM State Enums, Master Data Tables, and Engine Routine Identification  
> **Master Dashboard & Progress Tracker:** [`docs/disassembly/PROGRESS.md`](../disassembly/PROGRESS.md)  
> **Data Tab Models:** [`src/games/evermore/data-tab/model/tables.ts`](../../src/games/evermore/data-tab/model/tables.ts), [`enums.ts`](../../src/games/evermore/data-tab/model/enums.ts)  
> **Disassembly Reference:** [`docs/disassembly/engine-core/rom-tables.md`](../disassembly/engine-core/rom-tables.md), [`rom-enums.md`](../disassembly/engine-core/rom-enums.md), [`wram-enums.md`](../disassembly/engine-core/wram-enums.md)  
> **Current Status (v0.384.0):** 40 Decoded Master Tables · 40 Decoded Enums · 352 Named Functions (87.3%) · 391 Clean C Functions (97.0%)

---

## 1. Context & Completed Foundation

During Sessions 70–79, the engine data extraction effort reached the milestone of **40 Master Tables** and **40 Enums** decoded live in the editor's `Radar › Data` tab:

- **Mathematical Curves**: Sine/cosine (`$80:88A3`), Boomerang orbit (`$90:DF44`), Integer squares table (`$80:AA27`).
- **Progression & Character Data**: Boy/Dog cumulative XP (`$8C:8BD0`), weapon charge multipliers (`$8C:9700`), Dog form base stats (`$8F:945D`), companion Dog HP base curve (`$8C:9515`), master character records (`$8E:B678`), equippable armor stats (`$C4:3B02`), Boy weapons (`$C4:38E6`), consumable recovery items (`$C4:5AA0`).
- **Alchemy & Magic Subsystems**: Ingredient formula costs (`$C4:3874`), formula targeting cursor bitfields (`$C4:5BF5`), formula descriptions (`$C4:5D51`), Bank `$91` bytecode blocks (`$C4:5DDF`), formula base power (`$C4:5E6B`), Call Bead powers (`$C4:5F17`), cast spell blocks (`$C4:5F97`), ingredient names (`$C4:5FF3`), formula learned persistence flags (`$C4:5C3B`).
- **Script VM & Opcode Dispatch**: Script opcode execution jump table (`$8C:E8BD`), room enter scripts table (`$92:801B`), compressed room blob far pointers (`$9F:FDE7`).
- **Dialogue & Typography**: Proportional font glyph widths (`$C4:0C02`), DTE 2-character digraph pairs (`$91:F32E`), secondary 63-word MTE vocabulary table (`$91:F3EC`), primary 256-word dictionary phrases (`$91:F46C`).
- **Audio & Sound**: Master song packages (`$81:9903`), script sound effect translation table (`$8C:8362`), 2D distance audio volume attenuation curve (`$8C:84D4`), ring menu item icon descriptors (`$CE:8000`).
- **Environmental & Particle Systems**: Environmental weather presets (`$EC:0000`).
- **Engine Core Routines**: Named and documented the top four most-called unnamed routines (`$80:8FEE`, `$80:B21F`, `$8C:AF2B`, `$90:824B`), resolving 47 caller references, and reconstructed `$80:8FEE` in clean C.

---

## 2. Open Tasks: Remaining ROM Tables to Extract & Document

While the core 40 master tables cover the game's primary gameplay and engine systems, several secondary databases, lookups, and parameter matrices remain available for future extraction into `docs/disassembly/engine-core/rom-tables.md` and the Data tab (`tables.ts`):

### 2.1 Combat & Enemy AI Sub-Tables
- [ ] **Enemy Attack Transition Probability Matrices (`$8F:CBE0`)**:
  - Detailed state-machine weights for enemy behavioral loops beyond the top-level 15 contact handlers.
  - Reader: `enemy_ai_dispatcher` (`$8F:CB70`).
- [ ] **Loot & Item Drop Tables (`$8E:xxxx` / `$C4:xxxx`)**:
  - Enemy defeat item drop percentages, gourd drop rates across regions (Prehistoria, Antiqua, Gothica, Omnitopia).
  - Stride: 4–8 bytes per enemy archetype or chest ID.
- [ ] **Boss Multipart Attachment Offsets (`$8F:xxxx`)**:
  - Relative coordinate attachment vectors for composite multi-part bosses (Magmar head/claws, Megataur horns/hooves, Timberdrake segments).

### 2.2 Map, Collision & Physical Geometry
- [ ] **Slope & Stair Shear Elevation Displacement Vectors (`$8F:A93B`)**:
  - Metatile plane transition matrices bridging elevation bits 13 and 14 for 45-degree slope ramps and diagonal staircases.
  - Documented in `docs/disassembly/maps/ramp-elevation.md`, ready for structured table decoding.
- [ ] **Conveyor Belt Physics Vector Matrices (`$90:A1B4`)**:
  - Directional acceleration force constants for factory conveyor segments and sewer currents.
  - Reader: `dispatch_tile_drift_vector` (`$90:A1B4`).
- [ ] **Room Palette Map Index (`$7E:0F9C` / `$7E:61A7`)**:
  - ROM table mapping room IDs to their initial 7-family palette load sets in Bank `$8E`/`$8F`.

### 2.3 Audio, SPC700 & Sound Driver Tables
- [ ] **SPC700 BRR Sample Directory Tables (Bank `$8A` / `$8B`)**:
  - 4-byte BRR loop point and start address headers for music sequence instruments and sound effects.
  - Reader: SPC700 IPL stream uploader (`$8C:805B`).
- [ ] **Wolfgang Sound Driver Instrument Pitch & ADSR Envelopes**:
  - Attack/Decay/Sustain/Release configuration tables for the 8 APU DSP voices.

### 2.4 Mode 7 Horizon & Perspective Lookups
- [ ] **Mode 7 Perspective Scaling Curves (`$8E:AF80`)**:
  - Non-linear horizon projection curves mapping altitude and pitch angles to PPU Mode 7 matrix coefficients ($A, B, C, D$).
  - Documented in `docs/disassembly/engine-core/flight-horizon.md`.

---

## 3. Open Tasks: Remaining Enums & State Machines to Extract

The 40 enums in `enums.ts` cover major state machines; the following secondary bitmasks and enumerations remain documented in disassembly but not yet exposed in the Data tab:

- [ ] **`ENEMY_TARGETING_WEIGHTS` (`$8F:xxxx`)**: Aggro prioritization modes (closest player, lowest HP, last attacker).
- [ ] **`MAP_PALETTE_CYCLE_MODES` (`$1372..$1411`)**: Color cycle phase parameters (step speed, hold time, ping-pong vs continuous loop).
- [ ] **`SRAM_SLOT_OFFSETS` (`$8D:B400`)**: NVRAM battery-backed save file slot structure addresses and checksum flags.
- [ ] **`COLLISION_SURFACE_TYPES` (`+$3C,Y`)**: Surface friction types (normal terrain, slippery ice, swamp slowness, conveyor drift, lava hazard).
- [ ] **`DIALOGUE_WINDOW_STYLES` (`$034D..$0400`)**: Window frame presentation styles (standard bordered, bottom subtitle, full-screen transparent centered `$0047`, choice selection).

---

## 4. Open Tasks: Engine Core Decompilation Worklist

From the CDL decompilation worklist (`soe://rom/code/todo.md`), following the resolution of `$80:8FEE`, `$80:B21F`, `$8C:AF2B`, and `$90:824B`, the next prioritized routines by caller density are:

1. **`$90:80D2` (9 callers)**:
   - Callers: `ring_menu_close_and_restore_screen`, `ring_menu_rotate_previous_item`, `mode7_flight_frame_engine`, `mode7_vehicle_landing_touchdown_stepper`, `mode7_flight_frame_coordinator`.
   - Purpose: OAM / VBLANK screen restoration dispatcher when exiting overlay menus and flight sub-modes.
   - Target: Write `src/games/evermore/localizations/knowledge/rom/9080d2.md`, reconstruct C.
2. **`$90:828E` (8 callers)**:
   - Callers: `b_button_bit_15_search_b_triggers_else_swing`, `player_human_control_dog`, `ai_companion_boy`, `ai_roll`, `ai_roll_or_shoot`.
   - Purpose: Character record melee attack/swing animation track dispatcher (reads record `+$38,X`).
   - Target: Write `src/games/evermore/localizations/knowledge/rom/90828e.md`, reconstruct C.
3. **`$8E:AD67` (7 callers)**:
   - Callers: `ring_menu_select_and_cost_check`, `shop_vendor_buy_commit`, `ring_menu_subitem_select`, `weapon_equip_and_experience_update`, `consumable_item_satchel_deduct`.
   - Purpose: Universal inventory satchel quantity subtraction and clamping routine.
   - Target: Write `src/games/evermore/localizations/knowledge/rom/8ead67.md`, reconstruct C.
4. **`$8E:E08B` (6 callers)**:
   - Callers: `main_loop_entry`, `script_op_63_select_alchemy`, `script_animate_mode_10_path`, `script_op_8c_save_menu`, `script_op_99_mode7_scene`.
   - Purpose: Field transition recovery, screen fade-in, and camera anchor re-attachment to active actor `$0F3E`.
   - Target: Write `src/games/evermore/localizations/knowledge/rom/8ee08b.md`, reconstruct C.
5. **`$8C:AB10` (6 callers)**:
   - Callers: `script_op_63_select_alchemy`, `script_animate_mode_10_path`, `script_op_8c_save_menu`, `script_op_99_mode7_scene`, `ring_menu_consumable_item_execute`.
   - Purpose: Joypad button input filter re-arm and typematic repeat reset on menu closure.
   - Target: Write `src/games/evermore/localizations/knowledge/rom/8cab10.md`, reconstruct C.
6. **`$90:9815` (6 callers)**:
   - Callers: `elevation_plane_update_bits_5_4_kept_on`, `spawn_eval_tile_plane_elevation`, `probe_metatile_collision`, `entity_slot_allocate_and_init`, `spawn_characters_and_position_camera`.
   - Purpose: Metatile elevation plane evaluation and collision mesh Z-height binding.
   - Target: Write `src/games/evermore/localizations/knowledge/rom/909815.md`, reconstruct C.

---

## 5. UI & Presentation Enhancements for the Data Tab

- [ ] **Table Cross-Linking**: Add clickable cross-reference links between tables (e.g., clicking an ingredient ID in `formula-costs` opens `ingredients-table`; clicking an opcode in `script-opcodes-table` deep links to `soe://rom/assets/scripts/opcodes/`).
- [ ] **Search across All Datasets**: Global search filter in the rail column searching across all 40 tables and 40 enums simultaneously.
- [ ] **Table Export**: One-click JSON / CSV export button for any decoded table for external romhacking tools and compiler verification.
- [ ] **Multi-Variant Table View**: Toggle between US 1.0, PAL German, PAL French, and PAL Spanish offsets in the table detail view.

