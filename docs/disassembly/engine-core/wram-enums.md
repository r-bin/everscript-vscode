# Engine Core WRAM Enumerations & State Machines

This document details all Working RAM (WRAM, Bank `$7E` and `$7F`) enumerations, state machines, operational modes, direction encodings, and discrete status registers identified across the **Secret of Evermore** engine core, script VM, rendering pipeline, combat engine, and companion AI.

---

## 1. C Enumeration Definitions

```c
#include <stdint.h>

/* Window Lifecycle State ($7E:0377, $7E:03A3) */
typedef enum {
    WINDOW_STATE_CLOSED     = 0x0000, /* Window completely closed and inactive */
    WINDOW_STATE_OPENING    = 0x0001, /* Frame expansion animation underway */
    WINDOW_STATE_OPEN       = 0x0002, /* Window fully open; text typewriter or prompt active */
    WINDOW_STATE_CLOSING    = 0x0003  /* Frame collapse / dismissal animation underway */
} WindowState;

/* Dialogue Choice Prompt State ($7E:0B2B) */
typedef enum {
    CHOICE_STATE_INACTIVE   = 0x0000, /* No interactive choice prompt active */
    CHOICE_STATE_OPENING    = 0x0001, /* Choice frame border being composed */
    CHOICE_STATE_ACTIVE     = 0x0002, /* Player D-pad cursor selection active */
    CHOICE_STATE_CONFIRMED  = 0x0003  /* Selection made; closing box */
} ChoiceBoxState;

/* Audio Volume Fade State ($7E:0B7B) */
typedef enum {
    AUDIO_FADE_STEADY       = 0x0000, /* Master volume steady at target */
    AUDIO_FADE_IN           = 0x0001, /* Volume ramping up toward target $7E:0B83 */
    AUDIO_FADE_OUT          = 0x0002  /* Volume ramping down toward silence */
} AudioFadeState;

/* APU Music Sequence Dispatch State ($7E:0E4F) */
typedef enum {
    APU_SEQ_IDLE            = 0x0000, /* Ready for next sequence command */
    APU_SEQ_STREAMING       = 0x0001, /* Block transfer in progress via ports $2140..$2143 */
    APU_SEQ_PLAYING         = 0x0002  /* Sequence playing on SPC700 */
} ApuSeqStatus;

/* $7E:22EA and $7E:22EB are shared bitfields, not mutually exclusive enums.
 * See shared-flags-22ea-22eb.md for the observed masks and access paths. */

/* Dog AI Behavioral Command ($7E:235B) */
typedef enum {
    DOG_CMD_FOLLOW          = 0x00,   /* Follow player with standard tether leash */
    DOG_CMD_HEEL            = 0x01,   /* Stay strictly adjacent to the Boy */
    DOG_CMD_SNIFF           = 0x02,   /* Seek and inspect hidden alchemy spots */
    DOG_CMD_ATTACK          = 0x03    /* Aggressively engage nearest hostile entity */
} DogAiCommand;

/* Equipped Weapon Class ($7E:2360) */
typedef enum {
    WEAPON_CLASS_SWORD      = 0x0000, /* Swords (Bone Crusher, Gladiator, Crusader) */
    WEAPON_CLASS_AXE        = 0x0002, /* Axes (Spider's Claw, Bronze Axe, Knight Basher) */
    WEAPON_CLASS_SPEAR      = 0x0004, /* Spears (Horn Spear, Bronze Spear, Lance) */
    WEAPON_CLASS_BAZOOKA    = 0x0006  /* Bazooka (requires artillery shells) */
} WeaponClass;

/* Equipped Bazooka Ammunition Type ($7E:2349) */
typedef enum {
    AMMO_THUNDER_BALL       = 0x0000, /* Standard artillery shell ($7E:2345 count) */
    AMMO_PARTICLE_BOMB      = 0x0002, /* High-explosive thermal shell ($7E:2346 count) */
    AMMO_CRYO_BLAST         = 0x0004  /* Cryogenic frost artillery shell ($7E:2347 count) */
} BazookaAmmoType;

/* Dog Breed Era Form ($7E:2363) */
typedef enum {
    DOG_FORM_WOLF           = 0x00,   /* Prehistoric Wolfhound */
    DOG_FORM_GREYHOUND      = 0x01,   /* Antiquity Greyhound */
    DOG_FORM_POODLE         = 0x02,   /* Medieval Poodle */
    DOG_FORM_TOASTER        = 0x03    /* Omnitopia Toaster / Hover Dog */
} DogBreedForm;

/* Camera Viewport Tracking Mode ($7E:241F) */
typedef enum {
    CAM_MODE_FOLLOW_BOY     = 0x0000, /* Smooth tracking centered on Boy entity ($7E:0F42) */
    CAM_MODE_FOLLOW_DOG     = 0x0001, /* Smooth tracking centered on Dog entity ($7E:143A) */
    CAM_MODE_FIXED_SCRIPTED = 0x0002  /* Fixed boss arena or script-driven focus */
} CameraScrollMode;

/* Companion Dog AI State Machine ($7E:3C6F) */
typedef enum {
    COMPANION_AI_IDLE       = 0x0000, /* Stationary idle animation */
    COMPANION_AI_FOLLOW     = 0x0001, /* Traversal along player breadcrumb trail */
    COMPANION_AI_SNIFF      = 0x0002, /* Moving toward alchemy scent point and barking */
    COMPANION_AI_EVADE      = 0x0003, /* Wall-sliding / obstacle deflection */
    COMPANION_AI_ATTACK     = 0x0004, /* Engaging hostile target with bite/tackle */
    COMPANION_AI_RETURN     = 0x0005, /* Forced return after exceeding leash boundary */
    COMPANION_AI_STUCK      = 0x0006  /* Geometry collision unstuck retry */
} CompanionAiState;

/* 8-Way Cardinal & Diagonal Facing Direction ($7E:4EAB, $7E:4F59, Entity +$22) */
typedef enum {
    DIR_NORTH               = 0x0000, /*   0° North */
    DIR_NORTHEAST           = 0x0002, /*  45° Northeast */
    DIR_EAST                = 0x0004, /*  90° East */
    DIR_SOUTHEAST           = 0x0006, /* 135° Southeast */
    DIR_SOUTH               = 0x0008, /* 180° South */
    DIR_SOUTHWEST           = 0x000A, /* 225° Southwest */
    DIR_WEST                = 0x000C, /* 270° West */
    DIR_NORTHWEST           = 0x000E  /* 315° Northwest */
} FacingDirection;

/* Player / Companion Status Effect ID ($7E:0A35, $7E:0A7F) */
typedef enum {
    STATUS_NORMAL           = 0x0000, /* Normal status */
    STATUS_POISON           = 0x0001, /* Periodic poison tick damage */
    STATUS_CONFOUNDED       = 0x0002, /* Inverted D-pad movement vectors */
    STATUS_DEFENSE_DOWN     = 0x0003, /* Reduced physical defense rating */
    STATUS_ATTACK_DOWN      = 0x0004, /* Reduced physical attack power */
    STATUS_CORROSION        = 0x0005  /* Continuous acidic armor degradation */
} StatusEffectId;

/* Era Currency Selector ($7E:2309..$7E:2314, Opcode 0x7E) */
typedef enum {
    CURRENCY_TALONS         = 0x00, /* Prehistoric Talons ($7E:2309) */
    CURRENCY_JEWELS         = 0x03, /* Antiquity Jewels ($7E:230C) */
    CURRENCY_GOLD_COINS     = 0x06, /* Medieval Gold Coins ($7E:230F) */
    CURRENCY_CREDITS        = 0x09  /* Omnitopia Credits ($7E:2312) */
} CurrencyId;
```

---

## 2. WRAM Enumerations Catalog

| Address | Size | Type / Identifier | Values & Meaning | Handlers & Readers |
|---|---|---|---|---|
| `$7E:2309` | 3 bytes | `CurrencyId`<br>`TALONS_BALANCE` | 24-bit integer (`0`..`16,777,215`) | Prehistoric shops, opcode `0x7E` |
| `$7E:230C` | 3 bytes | `CurrencyId`<br>`JEWELS_BALANCE` | 24-bit integer (`0`..`16,777,215`) | Antiquity / Nobilia market, opcode `0x7E` |
| `$7E:230F` | 3 bytes | `CurrencyId`<br>`GOLD_COINS_BALANCE`| 24-bit integer (`0`..`16,777,215`) | Medieval shops, opcode `0x7E` |
| `$7E:2312` | 3 bytes | `CurrencyId`<br>`CREDITS_BALANCE` | 24-bit integer (`0`..`16,777,215`) | Omnitopia terminal shops, opcode `0x7E` |
| `$7E:0377` | 2 bytes | `WindowState`<br>`WINDOW_0_STATE` | `0` = Closed<br>`1` = Opening<br>`2` = Open<br>`3` = Closing | `func_CCAC8A` (state step)<br>Opcode `$2E` (poll close)<br>Opcode `$44`..`$47` (open) |
| `$7E:03A3` | 2 bytes | `WindowState`<br>`WINDOW_1_STATE` | `0` = Closed<br>`1` = Opening<br>`2` = Open<br>`3` = Closing | Secondary window compositor (`func_CCB120`) |
| `$7E:0B2B` | 2 bytes | `ChoiceBoxState`<br>`CHOICE_BOX_STATE` | `0` = Inactive<br>`1` = Opening<br>`2` = Active (awaiting joypad)<br>`3` = Confirmed | Dialogue engine choice selector (`func_CCB4E2`) |
| `$7E:0B7B` | 2 bytes | `AudioFadeState`<br>`AUDIO_FADE_STATE` | `0` = Steady volume<br>`1` = Fade in<br>`2` = Fade out | `func_8C801F`, NMI audio service (`$80:830C`) |
| `$7E:0E4F` | 2 bytes | `ApuSeqStatus`<br>`APU_SEQ_STATUS` | `0` = Idle<br>`1` = Streaming data<br>`2` = Playing | APU port communication driver (`func_8C81FD`) |
| `$7E:22EA` | 1 byte | `GameplayFlags`<br>`GAMEPLAY_FLAGS_22EA` | Bitfield: loot result, room-load readiness, intro/outro control, PPU layer latch; see linked bit table. | Loot globals, room pre-roll, opcodes `0x82`/`0x83` |
| `$7E:22EB` | 1 byte | `RoomScriptFlags`<br>`ROOM_TRANSITION_AND_SCRIPT_FLAGS_22EB` | Bitfield: unresolved engine-control latches, default-room reload path, route and doorway handoffs, room-script flags; see linked bit table. | Main loop, room reset, transition globals, room scripts |
| `$7E:2349` | 2 bytes | `BazookaAmmoType`<br>`EQUIPPED_BAZOOKA_AMMO`| `0` = Thunder Ball<br>`2` = Particle Bomb<br>`4` = Cryo-Blast | Ring menu ammo selector (`$8E:9200`) |
| `$7E:235B` | 1 byte | `DogAiCommand`<br>`DOG_AI_COMMAND` | `0` = Follow<br>`1` = Heel<br>`2` = Sniff<br>`3` = Attack | Companion AI command parser (`func_CF803C`) |
| `$7E:2360` | 2 bytes | `WeaponClass`<br>`EQUIPPED_WEAPON_CLASS`| `0` = Sword<br>`2` = Axe<br>`4` = Spear<br>`6` = Bazooka | Ring menu weapon selector (`func_8F9299`) |
| `$7E:2363` | 1 byte | `DogBreedForm`<br>`DOG_FORM_INDEX` | `0` = Wolfhound<br>`1` = Greyhound<br>`2` = Poodle<br>`3` = Toaster | `func_CF946B` (breed unpack), palette loader |
| `$7E:241F` | 2 bytes | `CameraScrollMode`<br>`CAMERA_SCROLL_MODE`| `0` = Follow Boy<br>`1` = Follow Dog<br>`2` = Fixed / Scripted | Viewport tracking compositor (`func_909E93`) |
| `$7E:3C67` | 2 bytes | `FacingDirection`<br>`COMPANION_EVASION_DIR`| `0`..`14` (even) = 8-way evasion route | Evasion navigation vector resolver (`func_8F9820`) |
| `$7E:3C6F` | 2 bytes | `CompanionAiState`<br>`COMPANION_AI_STATE` | `0` = Idle<br>`1` = Follow<br>`2` = Sniff<br>`3` = Evade<br>`4` = Attack<br>`5` = Return<br>`6` = Stuck | Dog state machine dispatcher (`func_CF98B5`) |
| `$7E:4EAB` | 2 bytes | `FacingDirection`<br>`BOY_FACING_DIRECTION` | `0` = N, `2` = NE, `4` = E, `6` = SE,<br>`8` = S, `10` = SW, `12` = W, `14` = NW | Player input physics integrator (`func_909040`) |
| `$7E:4F59` | 2 bytes | `FacingDirection`<br>`DOG_FACING_DIRECTION` | `0` = N, `2` = NE, `4` = E, `6` = SE,<br>`8` = S, `10` = SW, `12` = W, `14` = NW | Dog movement steering routine (`func_CF9040`) |
| `$7E:0A35` | 2 bytes | `StatusEffectId`<br>`BOY_STATUS_EFFECT` | `0` = Normal, `1` = Poison, `2` = Confounded,<br>`3` = Def Down, `4` = Atk Down, `5` = Corrosion | Combat status tick handler (`func_8FBA06`) |
| `$7E:0A7F` | 2 bytes | `StatusEffectId`<br>`DOG_STATUS_EFFECT` | `0` = Normal, `1` = Poison, `2` = Confounded,<br>`3` = Def Down, `4` = Atk Down, `5` = Corrosion | Dog status tick handler (`func_8FBA06`) |
