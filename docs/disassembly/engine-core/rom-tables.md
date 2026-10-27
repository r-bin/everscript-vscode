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
| `$8E:B678` | `0x073678` | `tbl_character_records` | 74 bytes | 142 | 10,508 B | Master character record database (stats, AI, contact, loot) |
| `$8F:945D` | `0x07945D` | `tbl_dog_form_pointers` | 14 bytes | 4 | 56 B | Companion breed form base stats, sniffing range, palettes |
| `$8F:B6AE` | `0x07B6AE` | `tbl_contact_handlers` | 2 bytes | 15 | 30 B | Entity melee and projectile contact handler dispatch vectors |
| `$90:8052` | `0x080052` | `tbl_animation_vm_jump_table` | 2 bytes | 76 | 152 B | Sprite animation engine bytecode execution vector table |
| `$90:D5CF` | `0x0855CF` | `tbl_anim_tile_channel_bases` | 2 bytes | 4 | 8 B | VRAM destination pattern words for 4 animated tile channels |
| `$90:DF44` | `0x085F44` | `tbl_boomerang_orbit` | 4 bytes | 256 | 1,024 B | Elliptical orbital vector coordinates $(X, Y)$ in $1/16$ px |
| `$91:80A6` | `0x0880A6` | `tbl_alchemy_spell_blocks` | 2 bytes | 48 | 96 B | Pointers to spell bytecode blocks in Bank `$91` |
| `$9F:FDE7` | `0x0FFDE7` | `tbl_room_blob_pointers` | 4 bytes | 127 | 508 B | 32-bit far pointers to compressed room data blobs |
| `$C4:3874` | `0x223874` | `tbl_alchemy_formula_costs` | 6 bytes | 35 | 210 B | Ingredient requirements, count quantities, and formula base damage |
| `$C4:5D09` | `0x225D09` | `tbl_alchemy_formula_names` | 2 bytes | 35 | 70 B | Pointers to zero-terminated formula ASCII name strings |
| `$C4:5D51` | `0x225D51` | `tbl_formula_descriptions` | 2 bytes | 35 | 70 B | Pointers to zero-terminated formula description strings |
| `$C4:5DDF` | `0x225DDF` | `tbl_formula_blocks` | 2 bytes | 35 | 70 B | Offsets into `$91:80A6` for formula execution bytecode |
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
