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

---

## 13. Rare Charms & Passive Relics (`CHARM_ID`)

Passive relics with game-altering effects (items `0x0100`..`0x010D`):

```c
typedef enum {
    CHARM_ARMOR_POLISH          = 0x0100, /* Passively enhances physical armor defense */
    CHARM_CHOCOBO_EGG           = 0x0101, /* Increases maximum health point capacity */
    CHARM_INSECT_INCENSE        = 0x0102, /* Deflects and blocks melee hits from insect enemies */
    CHARM_JADE_DISK             = 0x0103, /* Increases physical evasion against attacks */
    CHARM_JAGUAR_RING           = 0x0104, /* Unlocks continuous sprint / running capability */
    CHARM_MAGIC_GOURD           = 0x0105, /* Increases alchemical formula damage output */
    CHARM_MOXA_STICK            = 0x0106, /* Boosts HP restored by healing formula spells */
    CHARM_ORACLE_BONE           = 0x0107, /* Enhances discovery and formula acquisition */
    CHARM_RUBY_HEART            = 0x0108, /* Reduces physical damage received from enemies */
    CHARM_SILVER_SHEATH         = 0x0109, /* Increases melee strike power for swords */
    CHARM_STAFF_OF_LIFE         = 0x010A, /* Increases companion Dog defense and protection */
    CHARM_SUN_STONE             = 0x010B, /* Protects party against heat, fire, and magma */
    CHARM_THUGS_CLOAK           = 0x010C, /* Increases dodge rate and reduces enemy to-hit roll */
    CHARM_WIZARDS_COIN          = 0x010D  /* Increases party magic defense by 5% ($8C:9447) */
} CharmId;
```

---

## 14. Bazooka Ammunition Codes (`BAZOOKA_AMMO_ID`)

The three heavy artillery shell types fired by the Bazooka (`$7E:2441 = 0x001A`):

```c
typedef enum {
    BAZOOKA_THUNDER_BALL        = 0x00, /* Standard explosive artillery shell ($7E:2345) */
    BAZOOKA_PARTICLE_BOMB       = 0x02, /* High-damage thermal shock shell ($7E:2346) */
    BAZOOKA_CRYO_BLAST          = 0x04  /* Piercing cryogenic freezing shell ($7E:2347) */
} BazookaAmmoId;
```

---

## 15. Enemy Combat AI Behavioral Modes (`AI_BEHAVIOR`)

Jump table `$8F:CBE0` indexes 15 AI routines dispatched every tick by `$8F:CD17` according to character record `+0x03`:

```c
typedef enum {
    AI_CHASE                    = 0x00, /* Aggressive pursuit, combat alignment, retreat while recharging ($8F:D34B) */
    AI_NONE                     = 0x02, /* Passive idle entity, animated solely by scripts ($8F:D76A) */
    AI_COMPANION_BOY            = 0x04, /* Autonomous Boy companion following & target selection ($8F:D05E) */
    AI_COMPANION_DOG            = 0x06, /* Autonomous Dog companion following & sniffing ($8F:D0A8) */
    AI_STATIONARY               = 0x08, /* 4-cardinal stationary combat turret ($8F:D6FB) */
    AI_WANDER                   = 0x0A, /* Friendly town NPC random walk and pause sequence ($8F:D76E) */
    AI_CHASE_HOVERING           = 0x0C, /* Airborne hovering entity with sinusoidal bobbing ($8F:D4FB) */
    AI_STATIONARY_PLAYER        = 0x0E, /* Stationary boss turret tracking the player in 8 directions ($8F:D715) */
    AI_ROLL_OR_SHOOT            = 0x10, /* Full-charge projectile launch or curl-and-roll rush (Magmar, $8F:D5D2) */
    AI_CHASE_OR_ROLL            = 0x12, /* Pursuit with 50% probability of rolling charge attack (Viper, $8F:D421) */
    AI_BOUNCE                   = 0x14, /* Continuous walking with obstacle reflection bounce (Rimsala, $8F:D394) */
    AI_DRIFT_EAST               = 0x16, /* Directional eastern drift with northward/southward bias ($8F:D3DC) */
    AI_PURSUE_PLAYER            = 0x18, /* Continuous pursuit when charged, retreat when uncharged ($8F:D380) */
    AI_ROLL                     = 0x1A, /* Full-charge rolling assault attack (Megataur, $8F:D52E) */
    AI_STATIONARY_DIAGONAL      = 0x1C  /* Diagonal-facing stationary entity (Tentacles, $8F:D708) */
} AiBehavior;
```

---

## 16. Sprite Animation Engine VM Bytecode (`ANIM_OPCODE`)

Vector jump table `$90:8000` defines the instruction handlers for the animation bytecode interpreter `$90:80CE` (opcodes `0x00`..`0x66`):

```c
typedef enum {
    ANIM_NOP                    = 0x00, /* No operation ($90:878A) */
    ANIM_SLEEP_RANDOM           = 0x1F, /* Hold for random duration between min and max ticks ($90:837C) */
    ANIM_SLEEP                  = 0x20, /* Hold for operand tick duration ($90:835A) */
    ANIM_FRAME_NOP              = 0x21, /* Frame-boundary synchronization nop ($90:878B) */
    ANIM_SPRITE2                = 0x2C, /* Double sprite frame draw with offset coordinates ($90:842F) */
    ANIM_LOOP                   = 0x2D, /* Reset execution to script beginning ($90:877D) */
    ANIM_SOUND                  = 0x2E, /* Play audio sound effect ID ($90:8921) */
    ANIM_SOUND_MAYBE            = 0x2F, /* Conditional sound effect with RNG check ($90:894E) */
    ANIM_RESTART_HERE           = 0x30, /* Set loop resume point to current PC ($90:8AE0) */
    ANIM_SET8                   = 0x31, /* Write 8-bit immediate value to entity offset ($90:8AEB) */
    ANIM_SET16                  = 0x32, /* Write 16-bit immediate value to entity offset ($90:8B00) */
    ANIM_SET24                  = 0x33, /* Write 24-bit immediate pointer to entity offset ($90:8B1A) */
    ANIM_POKE                   = 0x34, /* Direct memory poke to bus address ($90:8B3C) */
    ANIM_ADD8                   = 0x35, /* Add 8-bit immediate to entity offset ($90:8B81) */
    ANIM_ADD16                  = 0x36, /* Add 16-bit immediate to entity offset ($90:8B99) */
    ANIM_CLEAR_BITS             = 0x37, /* Bitwise clear entity flag bits ($90:8B5A) */
    ANIM_DEC_JNZ                = 0x39, /* Decrement loop counter; branch if nonzero ($90:8BBE) */
    ANIM_JUMP_POS               = 0x3A, /* Branch to instruction address ($90:8BE4) */
    ANIM_STEP                   = 0x41, /* Movement step advance along facing vector ($90:86A9) */
    ANIM_HURTBOX                = 0x4B, /* Update entity damage collision hurtbox bounds ($90:885A) */
    ANIM_PROJECTILE             = 0x56  /* Spawn ballistic projectile archetype ($90:878C) */
} AnimOpcode;
```

---

## 17. Dialogue Script Text Formatting Control Codes (`DIALOGUE_CONTROL_CODE`)

Formatting tokens recognized by the dialogue typewriter interpreter `$8C:CD84`:

```c
typedef enum {
    TEXT_LF                     = 0x0A, /* [LF] Line Feed: Advance to next dialog row */
    TEXT_ARROW_RIGHT            = 0x5E, /* -> Right Arrow symbol */
    TEXT_ELLIPSIS               = 0x5F, /* … Ellipsis pause symbol */
    TEXT_OK                     = 0x7E, /* [OK] Joypad button prompt wait */
    TEXT_ARROW_LEFT             = 0x7F, /* <- Left Arrow symbol */
    TEXT_PAUSE                  = 0x80, /* [PAUSE] Timed frame delay */
    TEXT_BOY_NAME               = 0x81, /* [BOY] Boy custom name string ($7E:0A35) */
    TEXT_DOG_NAME               = 0x82, /* [DOG] Companion Dog custom name string ($7E:0A50) */
    TEXT_B_BUTTON               = 0x86, /* [B] In-line red B-button controller glyph */
    TEXT_PAGE_BREAK             = 0x87, /* [PAGE] Clear window and await player press */
    TEXT_CHOICE_RIGHT           = 0x8A, /* [CHOICE_RIGHT] Selectable choice right-column item */
    TEXT_CHOICE_INLINE          = 0x8B, /* [CHOICE_INLINE] Selectable choice inline item */
    TEXT_NOP                    = 0x8F, /* [NOP] Null format operation */
    TEXT_BOLD                   = 0x90, /* [BOLD] Shadowed bold font weight */
    TEXT_UNBOLD                 = 0x91, /* [UNBOLD] Standard font weight */
    TEXT_CENTER                 = 0x92, /* [CENTER] Center align line */
    TEXT_LEFT                   = 0x93, /* [LEFT] Left align line */
    TEXT_RIGHT                  = 0x94, /* [RIGHT] Right align line */
    TEXT_SLOW                   = 0x96, /* [SLOW] Half-speed typewriter rate */
    TEXT_UNSLOW                 = 0x97, /* [UNSLOW] Nominal typewriter rate */
    TEXT_INVERTED               = 0x98, /* [INVERTED] Inverse palette color font */
    TEXT_MEM1                   = 0xA1, /* [MEM1] Print memory integer 1 */
    TEXT_MEM2                   = 0xA2, /* [MEM2] Print memory integer 2 */
    TEXT_MEM3                   = 0xA3  /* [MEM3] Print memory integer 3 */
} DialogueControlCode;
```

---

## 18. APU Communication Port IPC Commands (`APU_IPC_COMMAND`)

Commands dispatched across SNES I/O ports `$2140`–`$2143` to the SPC700 audio coprocessor by `apu_command_handshake` (`$8C:81FD`):

```c
typedef enum {
    APU_CMD_PLAY_SFX_DIRECT     = 0x0004, /* Play sound effect directly with active soundbank */
    APU_CMD_PLAY_SFX_PACKAGE    = 0x0006, /* Stream required soundbank package before playing SFX */
    APU_CMD_LOAD_SONGBANK       = 0x000A, /* Stream music sequence & instrument bank to SPC700 ARAM */
    APU_CMD_PLAY_MUSIC          = 0x000C, /* Start playback for specified BGM track ID */
    APU_CMD_VOLUME_LATCH        = 0x0028, /* Latch master music volume fade target level */
    APU_CMD_SET_ATTENUATED_VOL  = 0x0036, /* Set 2D distance-attenuated volume for emitter sound effect */
    APU_CMD_SET_STEREO_PAN      = 0x003E, /* Set left/right stereo pan coordinate (-100..+100) */
    APU_CMD_VOLUME_RESTORE      = 0x00A9  /* Restore master volume to default nominal level */
} ApuIpcCommand;
```


