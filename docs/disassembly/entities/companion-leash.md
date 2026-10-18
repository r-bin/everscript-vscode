# Companion Leash & Teleport Recovery System

> **ROM Bank**: `$8F` (Companion AI Engine)  
> **Source Routines**: `$8F:D018` (`companion_teleport_recovery`), `$8F:D0B0` (`companion_proximity_evaluator`)  
> **Related Routines**: `$8F:A78A` (Distance calculation $|dx| + |dy|$), `$8F:98A4` (Pathfinding validation), `$8C:DAC5` (Input & companion dispatcher)  
> **Memory Map**: `$7E:1443` (Target recovery X coordinate), `$7E:1445` (Target recovery Y coordinate), `$7E:1459` (Waypoint path validity flag), `$7E:4FAF` (Companion recovery state register)

---

## 1. Architectural Overview

In *Secret of Evermore*, the companion character (the Dog, or the Boy during Dog-first chapters) follows the primary player through dense top-down room terrain. Because the companion can get wedged behind obstacles, doors, or screen boundaries, the game implements an autonomous **tether / leash and teleport recovery system** in Bank `$8F`.

### Proximity Thresholds:
The distance between the two characters ($d = |dx| + |dy|$) governs companion behavior:
1. **$d \le 32$ pixels (Close)**: Companion enters idle behavior (sniffing ground spots, wagging tail, roaming).
2. **$32 < d \le 128$ pixels (Moderate)**: Companion walks towards the player along the path waypoint trail.
3. **$128 < d \le 384$ pixels (Far)**: Companion sprints / dashes at double speed to close the distance.
4. **$d > 384$ pixels or Path Blocked (Lost / Stranded)**: The engine triggers **Teleport Recovery** (`$8F:D018`).

### Key Subsystems:
1. **Pathfinding Validation (`$8F:D0B0`)**:
   - Calculates distance vector to partner character (`$4E89` or `$4F37`) via `$8F:A78A`.
   - Inspects waypoint list index `$0098,y`. If the companion cannot find a continuous path to the player or distance exceeds the tether threshold, execution diverts to `$8F:D018`.
2. **Teleport Recovery Protocol (`$8F:D018`)**:
   - Sets recovery state code `#$0009` in companion register `$4FAF`.
   - Reads the safe landing destination from player trailing anchor registers `$1443` and `$1445`.
   - Directly teleports the companion's world coordinates to the anchor position.
   - Resets the companion's velocity components and purges obsolete waypoint nodes via `$8F:9C24`.
   - Re-aligns the companion to face the same direction as the player.

---

## 2. 65816 Assembly Implementation

```assembly
; ==============================================================================
; $8F:D018 - Companion Teleport Recovery Handler
; Invoked when companion is stranded, wedged, or separated > 384 pixels
; ==============================================================================
companion_teleport_recovery:
    LDA #$0009
    STA $4FAF                   ; Set recovery state mode = 9

    LDA $1459                   ; Check path validity flag
    BEQ .perform_teleport

    JSL $8F98A4                 ; Test obstacle collision on current path
    BMI .perform_teleport       ; If blocked (negative), force teleport

    ; Update intermediate recovery coordinate
    LDA $1453
    STA $46
    LDA $1455
    STA $48
    LDA $1457
    STA $44
    JSL $8FA7AA
    JSL $8F9C24                 ; Purge stale navigation waypoints

.perform_teleport:
    LDX $4E                     ; Companion entity pointer
    LDA $3C12,X                 ; Check companion movement flags
    BIT #$0020                  ; Tether break bit asserted?
    BEQ .exit_recovery

    ; Snap coordinates directly to player trailing anchor ($1443, $1445)
    LDA $1443
    LDX $1445
    STA $001A,Y                 ; Companion X position = anchor X
    STX $001C,Y                 ; Companion Y position = anchor Y
    JSL $8F9C24                 ; Re-initialize waypoint queue

.exit_recovery:
    RTS
```

---

## 3. Clean C Decompilation

```c
#include <stdint.h>
#include <stdbool.h>
#include <stdlib.h>

#define DISTANCE_IDLE_MAX       32   /* <= 32px: idle / sniff */
#define DISTANCE_WALK_MAX       128  /* 33..128px: walk */
#define DISTANCE_RUN_MAX        384  /* 129..384px: sprint */
#define RECOVERY_STATE_TELEPORT 0x0009

typedef enum {
    COMPANION_MODE_IDLE   = 0,
    COMPANION_MODE_WALK   = 1,
    COMPANION_MODE_RUN    = 2,
    COMPANION_MODE_RECOVER= 3
} CompanionFollowMode;

typedef struct {
    uint16_t entity_id;
    int16_t  pos_x;             /* +0x1A */
    int16_t  pos_y;             /* +0x1C */
    int16_t  vel_x;
    int16_t  vel_y;
    uint16_t recovery_state;    /* $4FAF */
    uint16_t movement_flags;    /* $3C12 */
    uint8_t  waypoint_head;
} CompanionEntity;

typedef struct {
    int16_t safe_anchor_x;      /* $1443 */
    int16_t safe_anchor_y;      /* $1445 */
    bool    path_blocked;       /* $1459 */
} NavigationAnchor;

extern void companion_clear_waypoints(CompanionEntity *companion);
extern bool companion_check_path_blocked(int16_t from_x, int16_t from_y, int16_t to_x, int16_t to_y);

/**
 * Snaps a stranded or lost companion directly to the player's trailing anchor coordinate.
 * Corresponds to native routine $8F:D018.
 */
void companion_teleport_recovery(CompanionEntity *companion, const NavigationAnchor *anchor) {
    companion->recovery_state = RECOVERY_STATE_TELEPORT;

    /* Instant repositioning to safe partner anchor */
    companion->pos_x = anchor->safe_anchor_x;
    companion->pos_y = anchor->safe_anchor_y;
    companion->vel_x = 0;
    companion->vel_y = 0;

    /* Purge stale path nodes */
    companion_clear_waypoints(companion);
}

/**
 * Evaluates separation distance between companion and player, arbitrating follow speed or teleport.
 * Corresponds to native routine $8F:D0B0.
 */
CompanionFollowMode companion_proximity_evaluator(CompanionEntity *companion, int16_t player_x, int16_t player_y, const NavigationAnchor *anchor) {
    int16_t dx = abs(companion->pos_x - player_x);
    int16_t dy = abs(companion->pos_y - player_y);
    int16_t total_dist = dx + dy;

    /* Condition 1: Exceeded maximum tether (384px) or path obstructed */
    if (total_dist > DISTANCE_RUN_MAX || anchor->path_blocked) {
        companion_teleport_recovery(companion, anchor);
        return COMPANION_MODE_RECOVER;
    }

    /* Condition 2: Sprint to catch up */
    if (total_dist > DISTANCE_WALK_MAX) {
        return COMPANION_MODE_RUN;
    }

    /* Condition 3: Walk to catch up */
    if (total_dist > DISTANCE_IDLE_MAX) {
        return COMPANION_MODE_WALK;
    }

    /* Condition 4: Close proximity */
    return COMPANION_MODE_IDLE;
}
```
