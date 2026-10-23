/*
 * Routine: $8FD018 (companion_leash)
 * Bank: $8F (ROM Offset: $0FD018)
 * Source: docs/disassembly/entities/companion-leash.md
 */

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
