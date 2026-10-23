/*
 * Routine: $8FD018 (companion_follow) — behaviours $04 COMPANION_BOY ($8F:D05E) and
 * $06 COMPANION_DOG ($8F:D0A8): the party member the player does not control.
 * With $8F:D018 (the Dog with L/R held), $8F:D1BF (the tether), $8F:D28C (the Dog at 0 HP) and
 * $8F:D787 (target pick by the AI setting). Decompiled v0.342.0.
 * Bank: $8F (ROM Offset: $0FD018)
 * Source: docs/entities/ai-behaviours.md
 *
 * Previously this file (8FD018_companion_leash.c) held invented pixel distances (32 / 128 / 384)
 * and a teleport state; the tether counts breadcrumb steps ($8F:AB0B) and there is no teleport here.
 */

#include <stdint.h>
#include <stdbool.h>

typedef struct Entity Entity;          /* fields as in 8FCD17_enemy_ai.c */
struct Entity { int16_t x, y; uint16_t hp, stamina, state, flags10, state14; Entity *target, *attacked_by; uint16_t moved12; };

extern Entity  *controlled;            /* $0F42 */
extern Entity  *forced_target;         /* $144F */
extern Entity  *entity_list;           /* $3DDF, linked by +$5E */
extern uint16_t boy_setting, dog_setting;               /* $0B09, $0B0D: 0 = never attack, 1-5 */
extern uint16_t boy_charge_goal, dog_charge_goal;       /* $0B0B, $0B0F: index into $8F:DDB3 */
extern uint16_t tight_tether;          /* $23C3 */
extern uint16_t buttons;               /* $0EC6 */
extern const uint16_t charge_goal[4];  /* $8F:DDB3: $40, $400, $800, $C00 */
extern const uint16_t engage_square[6];/* $8F:D821: 0, 50, 70, 90, 110, 130 */
extern void follow_leader(Entity *e);                   /* $8F:A78A */
extern void player_control_boy(Entity *e), player_control_dog(Entity *e);  /* $8F:CD88, $8F:CECC */
extern void retreat(Entity *e), approach(Entity *e), attack(Entity *e);    /* 8FCD17_enemy_ai.c */
extern bool in_reach(Entity *e);
extern void sniff_or_stand(Entity *e);                  /* $8F:D0F7: the sniff spot $1453-$1459, else states $B/$D/$C */
extern void walk_to_sniff_spot(Entity *e);              /* $8F:D018 */
extern void run_animation(Entity *e), walk_animation(Entity *e), idle_animation(Entity *e);

#define ABS(v) ((v) < 0 ? -(v) : (v))

/* $8F:D82F: an enemy within the square around the controlled character */
static bool near_leader(Entity *t, int r) {
    if (!t->hp || ((t->flags10 ^ 0x0100) & 0x4106) || (t->state14 & 0x0040)) return false;
    return ABS(t->x - controlled->x) < r && ABS(t->y - controlled->y) < r;   /* the ROM adds the hurt-box offsets */
}

/* $8F:D787 */
static Entity *pick_by_setting(Entity *e, uint16_t setting) {
    if (!setting) return e->target = 0;
    int r = engage_square[setting];
    if (forced_target && forced_target->hp && (forced_target->flags10 & 0x0300) && (forced_target->flags10 & 0x0100))
        return e->target = forced_target;
    if (e->attacked_by && near_leader(e->attacked_by, r)) return e->target = e->attacked_by;
    if (e->target && near_leader(e->target, r)) return e->target;
    Entity *best = 0;
    for (Entity *t = entity_list; t; t = 0 /* t->next */)
        if (near_leader(t, r)) best = t;                 /* the ROM narrows r to each hit: the nearest wins */
    return e->target = best;
}

/*
 * $8F:D1BF / $8F:D1F6: the tether. Four limits in breadcrumb steps go to $146A/$146C/$146E/$1470
 * (10/6/8/3; 4/3/3/1 while $23C3 is set; 13/10/8/4 for the Dog at 0 HP) and $8F:AB0B measures
 * against them. The outcomes seen in the code: carry on fighting; or drop the target (+$24 = 0)
 * and follow the leader in state 1 (running, $90:8279) or state 2 (walking, $90:824B). How
 * $8F:AB0B measures is not decoded, so the comparisons are not written out here.
 * Returns true to carry on fighting.
 */
extern bool tether(Entity *e, int a, int b, int c, int d);

static void fight_by_setting(Entity *e, uint16_t setting, uint16_t goal) {
    if (!pick_by_setting(e, setting)) { e->state = 4; idle_animation(e); return; }
    if (e->stamina < charge_goal[goal / 2]) retreat(e);
    else if (in_reach(e)) attack(e);
    else approach(e);
}

/* $04 COMPANION_BOY, $8F:D05E */
void companion_boy(Entity *e, int cmd) {
    (void)cmd;
    if (e == controlled) { player_control_boy(e); return; }
    follow_leader(e);
    if (tight_tether ? !tether(e, 4, 3, 3, 1) : !tether(e, 10, 6, 8, 3)) return;
    fight_by_setting(e, boy_setting, boy_charge_goal);
}

/* $06 COMPANION_DOG, $8F:D0A8 */
void companion_dog(Entity *e, int cmd) {
    (void)cmd;
    if (e == controlled) { player_control_dog(e); return; }
    follow_leader(e);
    if (!e->hp) {                                        /* $8F:D28C: wider tether, the form's $1447 animation */
        tight_tether ? tether(e, 4, 3, 3, 1) : tether(e, 13, 10, 8, 4);
        e->state = 10;
        return;
    }
    if (buttons & 0x0030) { walk_to_sniff_spot(e); return; }   /* L or R held */
    if (tight_tether ? !tether(e, 4, 3, 3, 1) : !tether(e, 10, 6, 8, 3)) return;
    if (!pick_by_setting(e, dog_setting)) { sniff_or_stand(e); return; }
    if (e->stamina < charge_goal[dog_charge_goal / 2]) retreat(e);
    else if (in_reach(e)) attack(e);
    else approach(e);
}
