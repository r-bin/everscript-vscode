# Engine Core ROM Enumerations & Type Systems

This document details all Read-Only Memory (ROM) enumerations, symbolic constant spaces, contact action codes, formula indices, opcode categories, and physics attributes defined within the retail **Secret of Evermore** ROM.

All values are derived directly from the SNES ROM image and verified against routine dispatch vectors and byte table decoders.

---

## 1. Contact Handler Action IDs (`CONTACT_ACTION`)

Table `$8F:B6AE` contains 15 word pointers called via `JSR ($B6AE,x)`. A character record's `+$30` field and projectile records in `$0E9A` specify this even ID:

```c
typedef enum {
    CONTACT_NPC_TALK            = 0x00, /* Friendly NPC dialogue trigger ($8F:B6DE) */
    CONTACT_PROJECTILE_STANDARD = 0x02, /* Projectile collision; checks immunity +$07 bit 4 ($8F:B6E0) */
    CONTACT_PROJECTILE_PIERCING = 0x04, /* Piercing projectile; passes through target ($8F:B724) */
    CONTACT_PROJECTILE_IGNORE_DEF= 0x06, /* Projectile bypassing defense ($8F:B73C) */
    CONTACT_MELEE_BOY_SKILL     = 0x08, /* Melee hit; kill increments Boy weapon level ($8F:B75A) */
    CONTACT_MELEE_DOG_SKILL     = 0x0A, /* Melee hit; kill increments Dog attack skill ($8F:B77D) */
    CONTACT_SWALLOW_ANIM        = 0x0C, /* Melee hit triggering devour/swallow sequence ($8F:B7A0) */
    CONTACT_INSECT_INCENSE      = 0x0E, /* Melee blocked if insect incense active ($8F:B7D7) */
    CONTACT_UNCONDITIONAL_HIT   = 0x10, /* Direct hit without incense check ($8F:B7DF) */
    CONTACT_POISON_CHANCE       = 0x12, /* Melee hit; 25% chance of applying poison ($8F:B7FB) */
    CONTACT_POISON_INCENSE      = 0x14, /* Melee poison hit blocked by incense ($8F:B7F3) */
    CONTACT_PLAGUE_CHANCE       = 0x16, /* Melee hit; 12.5% chance of plague ($8F:B85E) */
    CONTACT_POISON_ALWAYS       = 0x18, /* Guaranteed poison application ($8F:B82D) */
    CONTACT_PURE_DAMAGE         = 0x1A, /* Direct damage from $0E9C without to-hit roll ($8F:B8E3) */
    CONTACT_CONFOUND_PLAGUE     = 0x1C  /* Melee hit; 25% chance of confound or plague ($8F:B898) */
} ContactAction;
```

---

## 2. Alchemy Formula IDs (`FORMULA_ID`)

Formula indices correspond to the 35 formulas indexed at `$C4:5D09` (names), `$C4:5D51` (descriptions), `$C4:5DDF` (bytecode blocks), and `$C4:3874` (ingredient costs):

```c
typedef enum {
    FORMULA_FLASH               = 0,  /* Attack spell (Fire/Light) */
    FORMULA_HARD_BALL           = 1,  /* Projectile attack */
    FORMULA_DEFEND              = 2,  /* Defense buff */
    FORMULA_HEAL                = 3,  /* Base HP recovery */
    FORMULA_MIRACLE_CURE        = 4,  /* Status recovery */
    FORMULA_LEVITATE            = 5,  /* Environmental puzzle trigger */
    FORMULA_SPEED               = 6,  /* Agility / movement speed buff */
    FORMULA_FIREBALL            = 7,  /* Ranged fire projectile */
    FORMULA_CORROSION           = 8,  /* Continuous armor / HP burn */
    FORMULA_CRUSH               = 9,  /* Heavy earth damage */
    FORMULA_STING               = 10, /* Rapid energy needle */
    FORMULA_REVIVE              = 11, /* Companion resurrection */
    FORMULA_ATLAS               = 12, /* Attack power buff */
    FORMULA_REFLECT             = 13, /* Magic reflection barrier */
    FORMULA_FLARE               = 14, /* Radiant flame burst */
    FORMULA_ESCAPE              = 15, /* Dungeon warp exit */
    FORMULA_DOUBLE_DRAIN        = 16, /* Dual HP siphon */
    FORMULA_REGROWTH            = 17, /* Regeneration tick buff */
    FORMULA_LANCE               = 18, /* High-velocity piercing attack */
    FORMULA_STOP                = 19, /* Enemy temporal freeze */
    FORMULA_ACID_RAIN           = 20, /* Area damage + defense degradation */
    FORMULA_FIRE_POWER          = 21, /* Heavy incendiary blast */
    FORMULA_SLOW_BURN           = 22, /* Delayed high-yield thermal burst */
    FORMULA_EXPLOSION           = 23, /* Kinetic concussive shockwave */
    FORMULA_BARRIER             = 24, /* Invulnerability shield */
    FORMULA_SUPER_HEAL          = 25, /* High-potency HP recovery */
    FORMULA_ENERGIZE            = 26, /* Instant maximum charge */
    FORMULA_FORCE_FIELD         = 27, /* Full damage absorption */
    FORMULA_LIGHTNING           = 28, /* Electrical discharge */
    FORMULA_NITRO               = 29, /* Chemical concussive bomb */
    FORMULA_DRAIN               = 30, /* Single HP siphon */
    FORMULA_REFLECT_ALT         = 31, /* Secondary reflection field */
    FORMULA_CALL_UP             = 32, /* Call bead summon */
    FORMULA_ONE_UP              = 33, /* Major status & health restoration */
    FORMULA_CONFOUND            = 34  /* Confuses target orientation */
} FormulaId;
```

---

## 3. Cast Spell IDs (`CAST_ID`)

The script opcodes `$9E` (cast all) and `$AC` (cast skip dead companion) take an even spell ID referencing the block offsets at `$C4:5F97` and names at `$C4:5FC5`:

| Cast ID | Name in ROM | $91 Block Offset | Category |
|---|---|---|---|
| `0x00` | Flash | `$0000` | Offensive |
| `0x02` | Hard Ball | `$0002` | Offensive Projectile |
| `0x04` | Defend | `$0004` | Defensive Buff |
| `0x06` | Heal | `$0006` | Recovery |
| `0x08` | Miracle Cure | `$0008` | Status Cure |
| `0x0A` | Levitate | `$000A` | Utility / Puzzle |
| `0x0C` | Fireball | `$000C` | Offensive Projectile |
| `0x0E` | Crush | `$000E` | Offensive Impact |
| `0x10` | Sting | `$0010` | Offensive Piercing |
| `0x12` | Revive | `$0012` | Recovery |
| `0x14` | Atlas | `$0014` | Attack Buff |
| `0x16` | Flare | `$0016` | Offensive Burst |
| `0x18` | Acid Rain | `$0018` | Area Debuff |
| `0x1A` | Explosion | `$001A` | Area Burst |
| `0x1C` | Barrier | `$001C` | Shield |
| `0x1E` | Super Heal | `$001E` | Recovery |
| `0x20` | Lightning | `$0020` | Offensive Elemental |
| `0x22` | Nitro | `$0022` | Offensive Burst |
| `0x24` | Drain | `$0024` | Life Leech |
| `0x26` | Confound | `$0026` | Status Debuff |
| `0x28` | Laser Blast | `$0028` | Enemy Special (Carltron) |
| `0x2A` | Magmar Geyser | `$002A` | Boss Special (Magmar) |
| `0x2C` | Fire Breath | `$002C` | Boss Special (Timberdrake) |

---

## 4. Alchemy Ingredients (`INGREDIENT_ID`)

22 distinct catalytic ingredients indexed at `$C4:5FF3`:

| ID | Name | Category | Primary Sources |
|---|---|---|---|
| `0` | Water | Solvent | Wells, ponds, swamps |
| `1` | Wax | Organic | Beehives, candle vendors |
| `2` | Oil | Fuel | Tar pits, desert vendors |
| `3` | Ash | Mineral | Fire pits, volcano vents |
| `4` | Clay | Earth | Riverbanks, caves |
| `5` | Limestone | Mineral | Ancient ruins, quarris |
| `6` | Vinegar | Acid | Antiquity kitchens |
| `7` | Crystal | Gem | Underground caverns |
| `8` | Iron | Metal | Crates, weapon smiths |
| `9` | Brimstone | Volcanic | Volcano, crater fields |
| `10` | Ethanol | Chemical | Omnitopia laboratories |
| `11` | Dry Ice | Cryogenic | Omnitopia refrigeration |
| `12` | Gunpowder | Explosive | Pirate dens, Omnitopia |
| `13` | Feather | Organic | Avian enemies |
| `14` | Mushroom | Organic | Bugmuck fungus groves |
| `15` | Root | Organic | Prehistoric flora |
| `16` | Acorn | Organic | Woodland foraging |
| `17` | Grease | Industrial | Junkyard scrap, robots |
| `18` | Fine Ash | Volcanic | Rare deep volcano vents |
| `19` | Meteorite | Rare Cosmic | Crater excavation |
| `20` | Spark | Energy | Power generators |
| `21` | Atlas Ring | Catalyst | Rare treasure gourds |

---

## 5. Metatile Collision Physics Enums (`COLLISION_TYPE`)

Nibble / word collision definitions decoded by `func_90A420` (`tile_collision_probe`):

```c
typedef enum {
    COLL_PASSABLE               = 0x0, /* Standard traversable floor */
    COLL_IMPASSABLE_WALL        = 0x1, /* Solid impassable barrier */
    COLL_DEEP_WATER             = 0x2, /* Impassable liquid / deep water */
    COLL_PITFALL                = 0x3, /* Fall trap (triggers damage and reset) */
    COLL_CONVEYOR_NORTH         = 0x4, /* Forced scroll push north */
    COLL_CONVEYOR_SOUTH         = 0x5, /* Forced scroll push south */
    COLL_SLOPE_NW               = 0x6, /* 45° slope barrier: solid top-left */
    COLL_SLOPE_NE               = 0x7, /* 45° slope barrier: solid top-right */
    COLL_SLOPE_SW               = 0x8, /* 45° slope barrier: solid bottom-left */
    COLL_SLOPE_SE               = 0x9, /* 45° slope barrier: solid bottom-right */
    COLL_SHALLOW_WATER          = 0xA, /* Traversable wading liquid; halving speed */
    COLL_LEDGE_JUMP_SOUTH       = 0xB, /* One-way ledge jump southward */
    COLL_LEDGE_JUMP_NORTH       = 0xC, /* One-way ledge jump northward */
    COLL_CUTTABLE_GRASS         = 0xD, /* Mower-interactive metatile overlay */
    COLL_BREAKABLE_WALL         = 0xE, /* Weapon-vulnerable obstacle (Axe required) */
    COLL_WARP_DOORWAY           = 0xF  /* Step-on room transition gateway */
} CollisionType;
```

---

## 6. Call Bead Invocations (`CALL_BEAD_ID`)

The 16 Call Bead spells indexed at `$C4:5F17` (power table) and invoked by script commands:

```c
typedef enum {
    CALL_BEAD_LIFE_SPARK        = 0x00, /* Party HP recovery and companion resurrection (Power 300) */
    CALL_BEAD_HEAT_WAVE         = 0x02, /* Area incendiary bombardment across all enemies (Power 450) */
    CALL_BEAD_STORM             = 0x04, /* Electrical atmospheric shockwave (Power 550) */
    CALL_BEAD_FLARE             = 0x06, /* Focused thermal solar blast (Power 600) */
    CALL_BEAD_TIME_WARP         = 0x08, /* Temporal freeze; halts all hostile actors */
    CALL_BEAD_FIRST_AID         = 0x0A, /* Emergency health recovery for Boy (Power 250) */
    CALL_BEAD_CONFOUND          = 0x0C, /* Mass confusion and disorientation */
    CALL_BEAD_REGENERATE        = 0x0E, /* Continuous HP regeneration buff (Power 150) */
    CALL_BEAD_AURA              = 0x10, /* Invulnerability barrier */
    CALL_BEAD_SHOCK_WAVE        = 0x12, /* High-impact kinetic seismic pulse (Power 700) */
    CALL_BEAD_SHIELD            = 0x14, /* Physical defense hardening buff */
    CALL_BEAD_PLAGUE            = 0x16, /* Virulent ongoing poison/plague status */
    CALL_BEAD_HYPNOTIZE         = 0x18, /* Deep sleep inducement */
    CALL_BEAD_DISRUPT           = 0x1A, /* Dispel hostile magical shields and energy (Power 850) */
    CALL_BEAD_RESTORE           = 0x1C, /* Complete restoration and full revive (Power 999) */
    CALL_BEAD_ELECTRA_BOLT      = 0x1E  /* High-voltage vertical lightning strike (Power 900) */
} CallBeadId;
```

---

## 7. Projectile Movement Routine Indices (`PROJECTILE_ROUTINE`)

Movement routines in table `$90:D967` called by projectile update loop `$90:DE5E`:

```c
typedef enum {
    PROJ_ROUTINE_CUSTOM         = 0, /* Special script-directed path */
    PROJ_ROUTINE_HOMING         = 1, /* Tracks entity coordinates */
    PROJ_ROUTINE_STRAIGHT_SCALED= 2, /* Straight flight scaled by thrower attack ($0A3F) */
    PROJ_ROUTINE_ARCING         = 3, /* Parabolic arc trajectory with gravity */
    PROJ_ROUTINE_STRAIGHT       = 4, /* Unscaled straight line flight along facing */
    PROJ_ROUTINE_ORBIT          = 5, /* Elliptical orbit ($90:DF44) */
    PROJ_ROUTINE_SPREAD         = 6  /* Multi-directional scatter */
} ProjectileRoutine;
```

---

## 8. Projectile Lifecycle Behavior Types (`PROJECTILE_BEHAVIOR`)

Field `+0x0C` of projectile records in table `$90:D9A6`:

```c
typedef enum {
    PROJ_BEHAVIOR_FALLING       = 0x0E, /* Parabolic drop: z-speed decrements until ground hit */
    PROJ_BEHAVIOR_TIMED         = 0x12, /* Fixed altitude: lifetime counter decrements */
    PROJ_BEHAVIOR_PLANE_TIMED   = 0x1A, /* Fixed altitude on thrower's depth plane */
    PROJ_BEHAVIOR_ORBIT         = 0x1E  /* Angular step increment in ellipse lookup */
} ProjectileBehavior;
```

---

## 9. Formula Targeting Cursor Modes (`TARGETING_MODE`)

Bitfield values loaded from `$C4:5BF5` to control targeting reticle behavior:

| Bitmask | Mode Identifier | Target Scope | Representative Formulas |
|---|---|---|---|
| `0x0008` | `TARGET_PARTY_MEMBER` | Single party member (Boy or Dog) | Heal, Defend, Barrier, Speed, Regrowth |
| `0x0800` | `TARGET_BOY_ONLY` | Boy character only | Atlas, Call Up, One Up |
| `0x0802` | `TARGET_PARTY_BOTH` | Both Boy and Dog simultaneously | Escape, Super Heal |
| `0x0A00` | `TARGET_PARTY_ITEM` | Consumable item targeting | Petal, Nectar, Honey, Essence, Pixie Dust |
| `0x2010` | `TARGET_ENEMY_ALL` | Single enemy or all enemies in room | Flash, Fireball, Crush, Sting, Acid Rain, Nitro |
| `0x0014` | `TARGET_DOG_DEAD` | Defeated / unconscious Dog entity | Revive |
| `0x0214` | `TARGET_DOG_BISCUIT` | Dog snack reward | Dog Biscuit |
| `0x2200` | `TARGET_ENVIRONMENT` | Environmental puzzle trigger | Levitate |
| `0x0240` | `TARGET_REVEALER` | Invisible bridge / secret passage | Revealer |
| `0x6600` | `TARGET_MENU` | Ring menu trigger invocation | Call Beads, Pouch |

---

## 10. Equippable Armor & Gear IDs (`ARMOR_ID`)

The 40 pieces of defense equipment defined in table `$C4:3B02` with inventory tracking in `$7E:231D`..`$7E:2344`:

```c
typedef enum {
    /* Chest Armors (0..11) */
    ARMOR_GRASS_VEST            = 0,
    ARMOR_SHELL_PLATE           = 1,
    ARMOR_DINO_SKIN             = 2,
    ARMOR_BRONZE_ARMOR          = 3,
    ARMOR_STONE_VEST            = 4,
    ARMOR_CENTURION_CAPE        = 5,
    ARMOR_SILVER_MAIL           = 6,
    ARMOR_GOLD_PLATED_VEST      = 7,
    ARMOR_SHINING_ARMOR         = 8,
    ARMOR_MAGNA_MAIL            = 9,
    ARMOR_TITANIUM_VEST         = 10,
    ARMOR_VIRTUAL_VEST          = 11,

    /* Helmets (12..23) */
    HELM_GRASS_HAT              = 12,
    HELM_SHELL_HAT              = 13,
    HELM_DINO_HELM              = 14,
    HELM_BRONZE_HELMET          = 15,
    HELM_OBSIDIAN_HELM          = 16,
    HELM_CENTURION_HELM         = 17,
    HELM_TITANS_CROWN           = 18,
    HELM_DRAGON_HELM            = 19,
    HELM_KNIGHTS_HELM           = 20,
    HELM_LIGHTNING_HELM         = 21,
    HELM_OLD_RELIABLE           = 22,
    HELM_BRAINSTORM             = 23,

    /* Armbands / Gauntlets (24..35) */
    GLOVE_VINE_BRACELET         = 24,
    GLOVE_MAMMOTH_GUARD         = 25,
    GLOVE_CLAW_GUARD            = 26,
    GLOVE_SERPENT_BRACER        = 27,
    GLOVE_BRONZE_GAUNTLET       = 28,
    GLOVE_GLOVES_OF_RA          = 29,
    GLOVE_IRON_BRACER           = 30,
    GLOVE_MAGICIANS_RING        = 31,
    GLOVE_DRAGONS_CLAW          = 32,
    GLOVE_CYBERGLOVE            = 33,
    GLOVE_PROTECTOR_RING        = 34,
    GLOVE_VIRTUAL_GLOVE         = 35,

    /* Dog Collars (36..39) */
    COLLAR_LEATHER              = 36,
    COLLAR_SPIKY                = 37,
    COLLAR_DEFENDER             = 38,
    COLLAR_SPOTS                = 39
} ArmorId;
```

---

## 11. Consumable Inventory Item IDs (`CONSUMABLE_ID`)

The 8 recovery and utility items indexed in table `$C4:5AA0`:

```c
typedef enum {
    ITEM_PETAL                  = 0,  /* Heals 40 HP for target party member (Icon $008E) */
    ITEM_NECTAR                 = 1,  /* Heals 120 HP for target party member (Icon $0090) */
    ITEM_HONEY                  = 2,  /* Heals 300 HP for target party member (Icon $0092) */
    ITEM_DOG_BISCUIT            = 3,  /* Heals companion Dog HP (Icon $0094) */
    ITEM_WINGS                  = 4,  /* Dungeon warp escape to entrance (Icon $0096) */
    ITEM_HERBAL_ESSENCE         = 5,  /* Full cure for all negative status afflictions (Icon $0098) */
    ITEM_PIXIE_DUST             = 6,  /* Resurrects defeated companion Dog (Icon $009A) */
    ITEM_CALL_BEADS             = 7   /* Alchemy summon catalyst for 16 Call Bead spells (Icon $009C) */
} ConsumableId;
```

---

## 12. Weapon Stamina Charge Tiers (`STAMINA_TIER`)

Combat attack stamina scaling parsed by `$8F:CC5D` and `$8F:C02B`:

```c
typedef enum {
    STAMINA_TIER_EXHAUSTED      = 0,  /* < 0x0200 (< 50%): 0.25x damage (chip damage / weak jab) */
    STAMINA_TIER_WEAK           = 1,  /* 0x0200..0x03FF (50%..99%): 0.5x damage (uncharged strike) */
    STAMINA_TIER_STANDARD       = 2,  /* 0x0400..0x07FF (100%..199%): 1.0x baseline damage (Level 1) */
    STAMINA_TIER_CHARGED_2      = 3,  /* 0x0800..0x0BFF (200%..299%): 2.0x damage (Level 2 charge special) */
    STAMINA_TIER_CHARGED_3      = 4   /* >= 0x0C00 (300%): 4.0x damage (Level 3 maximum special) */
} StaminaTier;
```
