# Engine Core ROM Data Tables & Master Vectors

This document catalogues all Read-Only Memory (ROM) static data tables, jump vector matrices, progression curves, mathematical lookup arrays, and archetype databases identified within **Secret of Evermore (US)**.

All entries list their SNES bus address, ROM file offset (HiROM mapping), element stride, element count, total size, structure layout, and primary reader routines.

---

## 1. Master Table Index

| SNES Address | File Offset | Identifier | Stride | Count | Total Bytes | Category / Purpose |
|---|---|---|---|---|---|---|
| `$80:88A3` | `0x0088A3` | `tbl_trig_sine` | 2 bytes | 320 | 640 B | 8.8 fixed-point trigonometric sine curve (`-255`..`+256`) |
| `$80:8923` | `0x008923` | `tbl_trig_cosine` | 2 bytes | 256 | 512 B | Trigonometric cosine (+64 offset alias of `tbl_trig_sine`) |
| `$8C:8BD0` | `0x068BD0` | `tbl_xp_boy` | 3 bytes | 100 | 300 B | Cumulative XP progression for Boy (levels 1..100, `$FFFFFF` cap) |
| `$8C:8CFC` | `0x068CFC` | `tbl_xp_dog` | 3 bytes | 99 | 297 B | Cumulative XP progression for companion Dog |
| `$8C:9700` | `0x069700` | `tbl_weapon_charge_multipliers` | 2 bytes | 16 | 32 B | Charge attack damage multipliers for weapon tiers 0..3 |
| `$8C:D7E1` | `0x06D7E1` | `tbl_script_opcode_jump_table` | 2 bytes | 256 | 512 B | Script VM opcode execution jump vectors (`$00`..`$FF`) |
| `$8E:B55A` | `0x07355A` | `tbl_enemy_index` | 2 bytes | 143 | 286 B | ENEMY id to character record address in bank $8E ($8E:B678..) |
| `$8E:B678` | `0x073678` | `tbl_character_records` | 74 bytes | 142 | 10,508 B | Master character record database (stats, AI, contact, loot) |
| `$8F:945D` | `0x07945D` | `tbl_dog_form_pointers` | 14 bytes | 4 | 56 B | Companion breed form base stats, sniffing range, palettes |
| `$8F:B6AE` | `0x07B6AE` | `tbl_contact_handlers` | 2 bytes | 15 | 30 B | Entity melee and projectile contact handler dispatch vectors |
| `$90:8052` | `0x080052` | `tbl_animation_vm_jump_table` | 2 bytes | 76 | 152 B | Sprite animation engine bytecode execution vector table |
| `$90:D5CF` | `0x0855CF` | `tbl_anim_tile_channel_bases` | 2 bytes | 4 | 8 B | VRAM destination pattern words for 4 animated tile channels |
| `$90:D9A6` | `0x08D9A6` | `tbl_projectile_records` | 24 bytes | 21 | 504 B | Projectile archetype definitions (anim, palette, routine, speed, power) |
| `$90:DF44` | `0x085F44` | `tbl_boomerang_orbit` | 4 bytes | 256 | 1,024 B | Elliptical orbital vector coordinates $(X, Y)$ in $1/16$ px |
| `$91:80A6` | `0x0880A6` | `tbl_alchemy_spell_blocks` | 2 bytes | 48 | 96 B | Pointers to spell bytecode blocks in Bank `$91` |
| `$9F:FDE7` | `0x0FFDE7` | `tbl_room_blob_pointers` | 4 bytes | 127 | 508 B | 32-bit far pointers to compressed room data blobs |
| `$C4:0C02` | `0x220C02` | `tbl_font_glyph_widths` | 1 byte | 95 | 95 B | Proportional character glyph pixel widths (ASCII 32..126) |
| `$C4:3874` | `0x223874` | `tbl_alchemy_formula_costs` | 6 bytes | 35 | 210 B | Ingredient requirements, count quantities, and formula base damage |
| `$C4:38E6` | `0x2238E6` | `tbl_boy_weapons` | 36 bytes | 15 | 540 B | Boy melee weapon master records (attack power, knockback) |
| `$C4:3B02` | `0x223B02` | `tbl_armor_records` | 10 bytes | 40 | 400 B | Master armor and collar attributes (pdef, mdef, name, icon) |
| `$C4:3C92` | `0x223C92` | `tbl_animate_id_records` | 2 bytes | 212 | 424 B | Script `animate(entity, mode, id)` ID to bank `$C4` record pointer |
| `$C4:5AA0` | `0x225AA0` | `tbl_consumable_items` | 2 bytes | 16 | 32 B | Consumable item recovery HP and ring icon selectors ($008E..$009C) |
| `$C4:5B4A` | `0x225B4A` | `tbl_weapon_charge_xp` | 2 bytes | 16 | 32 B | Weapon charge tier level-up cumulative XP thresholds (tiers 0..3) |
| `$C4:5B9C` | `0x225B9C` | `tbl_formula_xp_gain` | 1 byte | 10 | 10 B | Formula experience points awarded per cast at spell levels 0..9 |
| `$C4:5BA5` | `0x225BA5` | `tbl_formula_level_multiplier` | 1 byte | 10 | 10 B | Formula power multiplier percentage across spell levels 0..9 |
| `$C4:5BF5` | `0x225BF5` | `tbl_formula_targeting` | 2 bytes | 35 | 70 B | Spell targeting cursor bitfields (single, ally, party, enemy) |
| `$C4:5D09` | `0x225D09` | `tbl_alchemy_formula_names` | 2 bytes | 35 | 70 B | Pointers to zero-terminated formula ASCII name strings |
| `$C4:5D51` | `0x225D51` | `tbl_formula_descriptions` | 2 bytes | 35 | 70 B | Pointers to zero-terminated formula description strings |
| `$C4:5DDF` | `0x225DDF` | `tbl_formula_blocks` | 2 bytes | 35 | 70 B | Offsets into `$91:80A6` for formula execution bytecode |
| `$C4:5E6B` | `0x225E6B` | `tbl_formula_base_power` | 2 bytes | 35 | 70 B | Base power and recovery coefficients for formulas 0..34 |
| `$C4:5F17` | `0x225F17` | `tbl_call_bead_powers` | 2 bytes | 16 | 32 B | Base spell power coefficients for Call Bead summons 0..15 |
| `$C4:5F97` | `0x225F97` | `tbl_cast_blocks` | 2 bytes | 23 | 46 B | Offsets into `$91:80A6` for opcode `$9E` and `$AC` spells |
| `$C4:5FC5` | `0x225FC5` | `tbl_cast_names` | 2 bytes | 23 | 46 B | Pointers to zero-terminated spell name strings |
| `$C4:5FF3` | `0x225FF3` | `tbl_ingredient_names` | 2 bytes | 22 | 44 B | Pointers to zero-terminated ingredient name strings |

---

## 2. Table Specifications & Struct Layouts

### 2.1 Trigonometric Sine & Cosine Tables (`$80:88A3`, `$80:8923`)
- **Format**: Signed 16-bit integers (`int16_t[320]`).
- **Precision**: 8.8 fixed-point scaling factor: `256 = 1.0`, `0 = 0.0`, `-255 = -1.0`.
- **Lookahead Cushion**: Standard circle is 256 steps (`0..255`). Table stores 320 entries (+64 entries = 90° quadrature phase), enabling cosine reads at `tbl_trig_sine[angle + 64]` without modulus arithmetic.
- **Readers**: Mode 7 flight orientation (`$8E:B379`), projectile homing trajectories (`$8F:B094`), and ring menu angular positioning (`func_8FB6A5`).

### 2.2 Character Record Master Database (`$8E:B678`)
- **Format**: `struct CharacterRecord tbl_character_records[142]`, 74 bytes per record (`0x4A` stride).
- **Internal Layout**:
  ```c
  struct CharacterRecord {
      uint16_t name_ptr;           /* +0x00: Far 16-bit pointer to zero-terminated ASCII name */
      uint8_t  unknown_02;         /* +0x02: Reserved padding */
      uint8_t  ai_script_id;       /* +0x03: AI script routine index (read by $8F:CD1A) */
      uint16_t max_hp;             /* +0x04: Base maximum hit points */
      uint16_t attack_power;       /* +0x06: Base melee attack strength */
      uint16_t defense_power;      /* +0x08: Base physical armor / damage absorption */
      uint16_t magic_defense;      /* +0x0A: Resistance against formula damage */
      uint16_t evade_rate;         /* +0x0C: To-hit evasion threshold */
      uint16_t exp_reward;         /* +0x0E: XP awarded to player party upon defeat */
      uint16_t gold_reward;        /* +0x10: Talons / Jewels dropped */
      uint16_t drop_item_1;        /* +0x12: Primary drop item ID */
      uint16_t drop_item_2;        /* +0x14: Secondary rare drop item ID */
      uint16_t drop_chance_mask;   /* +0x16: Probability bitmask for loot drops */
      uint8_t  sprite_attributes[24]; /* +0x18: OAM dimension, frame layout, and palette bank */
      uint16_t contact_action_id;  /* +0x30: Vector selector into tbl_contact_handlers ($8F:B6AE) */
      uint8_t  combat_flags[24];   /* +0x32..0x49: Elemental immunities and behavioral procs */
  };
  ```

### 2.3 Alchemy Formula Cost & Attribute Matrix (`$C4:3874`)
- **Format**: `struct FormulaCost tbl_alchemy_formula_costs[35]`, 6 bytes per formula.
- **Internal Layout**:
  ```c
  struct FormulaCost {
      uint8_t ingredient_1_id;     /* +0x00: Index into tbl_ingredient_names (0..21) */
      uint8_t ingredient_1_count;  /* +0x01: Required quantity of ingredient 1 (1..9) */
      uint8_t ingredient_2_id;     /* +0x02: Index into tbl_ingredient_names (0..21) */
      uint8_t ingredient_2_count;  /* +0x03: Required quantity of ingredient 2 (1..9) */
      uint8_t formula_flags;       /* +0x04: Targeting bits (single, all enemies, party buff) */
      uint8_t base_power;          /* +0x05: Base damage / heal scaling coefficient */
  };
  ```

### 2.4 Companion Breed Form Stat Table (`$8F:945D`)
- **Format**: `struct DogBreedAttributes tbl_dog_form_pointers[4]`, 14 bytes per era form.
- **Internal Layout**:
  ```c
  struct DogBreedAttributes {
      uint16_t base_attack;        /* +0x00: Base physical bite / tackle power */
      uint16_t base_defense;       /* +0x02: Base physical armor */
      uint16_t base_magic_def;     /* +0x04: Base magic resistance */
      uint16_t scent_radius;       /* +0x06: Detection range in world pixels ($7E:144D) */
      uint16_t palette_group;      /* +0x08: CGRAM palette group index */
      uint16_t sprite_block_base;  /* +0x0A: CHR pattern VRAM allocation base */
      uint16_t combat_flags;       /* +0x0C: Form special ability bits (e.g., hover / laser) */
  };
  ```

### 2.5 Projectile Archetype Database (`$90:D9A6`)
- **Format**: `struct ProjectileRecord tbl_projectile_records[21]`, 24 bytes per record (`0x18` stride).
- **Internal Layout**:
  ```c
  struct ProjectileRecord {
      uint16_t anim_record;        /* +0x00: Animation record offset in bank $C4 (0 = none) */
      uint16_t palette_group;      /* +0x02: Palette group in bank $90 (0 = keep thrower palette) */
      uint16_t unknown_04;         /* +0x04: Reserved padding */
      uint16_t unknown_06;         /* +0x06: Reserved padding */
      uint16_t routine_index;      /* +0x08: Movement routine selector in tbl_projectile_routines ($90:D967) */
      uint16_t unknown_0a;         /* +0x0A: Reserved padding */
      uint16_t behavior_type;      /* +0x0C: Lifecycle behavior: 0x0E falling, 0x12 timed, 0x1A plane timed */
      uint16_t speed;              /* +0x0E: Flight velocity in 1/16 pixels per tick */
      uint16_t field_10;           /* +0x10: Entity field +0x1E copy */
      int16_t  field_12;           /* +0x12: Entity field +0x24 copy (initial vertical velocity) */
      uint16_t field_14;           /* +0x14: Entity field +0x2A copy */
      uint16_t base_power;         /* +0x16: Base impact power (0 = inherit from thrower) */
  };
  ```

### 2.6 Animate ID Record Vector Table (`$C4:3C92`)
- **Format**: `uint16_t tbl_animate_id_records[212]`, 2 bytes per ID (424 bytes total).
- **Purpose**: Maps global `animate(entity, mode, id)` animation ID (0..211) to the 16-bit offset of its animation record in bank `$C4` (`$C4:3E3A`..`$C4:5801`). Read by `$8C:E13C`.

### 2.7 Boy Melee Weapon Master Table (`$C4:38E6`)
- **Format**: `struct BoyWeaponRecord tbl_boy_weapons[15]`, 36 bytes per weapon (`0x24` stride).
- **Internal Layout**:
  ```c
  struct BoyWeaponRecord {
      uint16_t attack_power;       /* +0x00: Base physical weapon damage */
      uint8_t  knockback_dist;     /* +0x02: Target knockback distance in pixels */
      uint8_t  reserved[33];       /* +0x03..0x23: Strike boxes, animation links, charge timing */
  };
  ```

### 2.8 Formula Targeting Cursor Bitfield Table (`$C4:5BF5`)
- **Format**: `uint16_t tbl_formula_targeting[35]`, 2 bytes per formula (70 bytes total).
- **Purpose**: Defines reticle locking behavior during alchemy selection:
  - `0x0008`: Single ally / party member (Heal, Defend, Barrier, Speed, Regrowth)
  - `0x0800`: Boy only (Atlas, Call Up, One Up)
  - `0x0802`: Both party members simultaneously (Super Heal, Escape)
  - `0x0014`: Fallen Dog (Revive)
  - `0x2010`: All active enemies (Flash, Fireball, Crush, Sting, Acid Rain, Nitro)
  - `0x2200`: World puzzle point (Levitate)

### 2.9 Call Bead Power Table (`$C4:5F17`)
- **Format**: `uint16_t tbl_call_bead_powers[16]`, 2 bytes per invocation (32 bytes total).
- **Purpose**: Base power and restoration coefficients for the 16 Call Bead spells (0 = utility/buff, 250..999 for damaging/recovery spells).

### 2.10 Master Armor and Collar Database (`$C4:3B02`)
- **Format**: `struct ArmorRecord tbl_armor_records[40]`, 10 bytes per piece (`0x0A` stride).
- **Internal Layout**:
  ```c
  struct ArmorRecord {
      uint16_t physical_defense;   /* +0x00: Base physical defense rating */
      uint16_t magic_defense;      /* +0x02: Base magic defense rating */
      uint16_t name_ptr;           /* +0x04: 16-bit far pointer in bank $C4 to zero-terminated ASCII name */
      uint16_t desc_ptr;           /* +0x06: 16-bit far pointer in bank $C4 to description/status string */
      uint16_t ring_icon_id;       /* +0x08: 16-bit ring menu icon selector ($00A0..$00EE) */
  };
  ```
- **Categories**:
  - `0..11`: 12 Chest Armors (Grass Vest through Virtual Vest)
  - `12..23`: 12 Helmets (Grass Hat through Brainstorm)
  - `24..35`: 12 Armbands & Gauntlets (Vine Bracelet through Virtual Glove)
  - `36..39`: 4 Dog Collars (Leather Collar through Spot's Collar)
- **Readers**: Equipment defense calculation routine `$8E:99D2` (`calc_equipped_armor_defense`) and ring menu status renderers.

### 2.11 Enemy Spawn Archetype Index Table (`$8E:B55A`)
- **Format**: `uint16_t tbl_enemy_index[143]`, 2 bytes per enemy ID (286 bytes total, `$8E:B55A`..`$8E:B677`).
- **Purpose**: Maps the `ENEMY` ID operand of script spawn opcodes (`0xBA`, `0x3C`, `0xA2`, `0xC2`) to the 16-bit address of its character record in bank `$8E` (`$8E:B678`..`$8E:DF23`). Read by `$8C:DC9A`, `$8C:DCC3`, `$8C:DCD9`, `$8C:DCEC`.

### 2.12 Consumable Item Recovery & Icon Table (`$C4:5AA0`)
- **Format**: `struct ConsumableItemTable { uint16_t heal_hp[8]; uint16_t ring_icons[8]; }`, 32 bytes total.
- **Internal Layout**:
  - `+0x00..0x0F`: Base HP restored upon use: Petal (40), Nectar (120), Honey (300), Dog Biscuit (100). Wings, Herbal Essence, Pixie Dust, and Call Beads store 0 (scripted/status handlers).
  - `+0x10..0x1F`: 8 ring menu icon selectors (`$008E`, `$0090`, `$0092`, `$0094`, `$0096`, `$0098`, `$009A`, `$009C`).
- **Readers**: Ring menu item execution handler and inventory display routines.

### 2.13 Formula Execution Blocks Table (`$C4:5DDF` -> `$91:80A6`)
- **Format**: `uint16_t tbl_formula_blocks[35]`, 2 bytes per formula (70 bytes total, `$C4:5DDF`..`$C4:5E24`).
- **Internal Layout**:
  - Each word represents an even byte offset into the master block pointer table at `$91:80A6`.
  - The pointer at `$91:80A6 + offset` resolves to the entry point address within Bank `$91` where spell execution bytecode and animation record IDs reside.
  - Formula 0 (Acid Rain) and Formula 20 (Laser) both point to offset `0x0002` (`$91:86F0`).
- **Readers**: Spell invocation engine `$91:CCD8` and animation record parser.

### 2.14 Bazooka Artillery Weapon Database (`$C4:388E`)
- **Format**: `uint16_t tbl_bazooka_weapon_pointers[3]` pointing to 36-byte weapon descriptors (`$C4:3A96`, `$C4:3ABA`, `$C4:3ADE`).
- **Internal Layout**:
  - Shell 0 (`$00`): Thunder Ball descriptor at `$C4:3A96` (standard artillery, sprite palette `$0086`).
  - Shell 1 (`$02`): Particle Bomb descriptor at `$C4:3ABA` (heavy thermal explosion, sprite palette `$00CB`).
  - Shell 2 (`$04`): Cryo-Blast descriptor at `$C4:3ADE` (cryogenic frost artillery, sprite palette `$1E02`).
- **Readers**: Active weapon loader `$8F:81C9` (selects descriptor by reading `$7E:2349`) and combat projectile dispatcher.

### 2.15 Formula Description Text Pointer Table (`$C4:5D51`)
- **Format**: `uint16_t tbl_formula_descriptions[35]`, 2 bytes per formula (70 bytes total, `$C4:5D51`..`$C4:5D96`).
- **Internal Layout**:
  - Each word represents a 16-bit far pointer in Bank `$C4` to a zero-terminated printable ASCII string describing the formula.
  - Used in the alchemy ring menu when a player highlights a formula to display spell effects.
- **Readers**: Ring menu formula details compositor and Data tab (Tables › Formula ring menu descriptions).

### 2.16 Projectile Movement Routine Jump Table (`$90:D967`)
- **Format**: `uint16_t tbl_projectile_routines[31]`, 2 bytes per vector (62 bytes total, `$90:D967`..`$90:D9A5`).
- **Internal Layout**:
  - `+$00` (`$90:D985`): Custom script-directed trajectory (records 14, 17)
  - `+$02` (`$90:DD58`): Target homing coordinates tracking
  - `+$04` (`$90:DD61`): Straight flight scaled by thrower attack power (record 4)
  - `+$06` (`$90:DEF7`): Parabolic ballistic arc with gravity
  - `+$08` (`$90:DD2D`): Straight flight along thrower facing (records 0..3, 5, 10..13, 15..16, 20)
  - `+$0A` (`$90:DCE7`): Elliptical orbital trajectory around center entity
  - `+$0C` (`$90:DD26`): Multi-directional radial scatter pattern (record 7)
  - `+$10` (`$90:DF44`): Elliptical orbital coordinates table
  - `+$16` (`$90:DDCA`): Direct fast ballistic trajectory (records 8, 9)
  - `+$18` (`$90:DE11`): High-speed homing ballistic curve (records 6, 18, 19)
- **Readers**: Projectile physics dispatcher `$90:DE5E` via `JSR ($D967,x)` using offset read from archetype record `+$08`.

### 2.17 Formula Learned Persistence Bitfield Tables (`$C4:5C3B`, `$C4:5C81`)
- **Format**:
  - `tbl_formula_learned_addr`: `uint16_t[35]`, 70 bytes at `$C4:5C3B`..`$C4:5C80`
  - `tbl_formula_learned_mask`: `uint16_t[35]`, 70 bytes at `$C4:5C81`..`$C4:5CC6`
- **Internal Layout**:
  - Maps each of the 35 formulas to its SRAM battery-backed persistence byte in `$7E:2258`..`$7E:225C` and its 16-bit bitmask (`$0001`..`$0080`):
    - Formulas 0..7 (Acid Rain through Defend): `$7E:2258`, bits 0..7
    - Formulas 8..15 (Double Drain through Flash): `$7E:2259`, bits 0..7
    - Formulas 16..23 (Force Field through Miracle Cure): `$7E:225A`, bits 0..7
    - Formulas 24..31 (Nitro through Speed): `$7E:225B`, bits 0..7
    - Formulas 32..34 (Sting, Stop, Super Heal): `$7E:225C`, bits 0..2
- **Readers**: Formula learning opcode handlers and ring menu spell catalog loader `$8E:8000`.

### 2.18 Room Compressed Blob Pointer Table (`$9F:FDE7`)
- **Format**: `uint32_t tbl_room_blob_pointers[127]`, 4 bytes per room (508 bytes total, `$9F:FDE7`..`$9F:FFDE`).
- **Internal Layout**:
  - 24-bit SNES far pointers (plus 1 padding byte) resolving the file location of the LZSS compressed room data blob for each map ID 0..126.
  - Room data blobs contain the tilemap layer definitions, metatile collision matrices, and enter event bytecode.
- **Readers**: Master room transition loader `$8E:E4E2` (`enter_room`).



