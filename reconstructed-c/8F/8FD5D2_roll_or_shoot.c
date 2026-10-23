/*
 * Routine: $8FD5D2 (roll_or_shoot) — behaviours $10 ROLL_OR_SHOOT ($8F:D5D2, Magmar) and
 * $1A ROLL ($8F:D52E, Megataur), and the roll rules $12 CHASE_OR_ROLL shares ($8F:D4A0).
 * Decompiled v0.342.0.
 * Bank: $8F (ROM Offset: $0FD5D2)
 * Source: docs/entities/ai-behaviours.md
 *
 * Previously this file (8FD5D2_boss_engine.c) held an invented Magmar state machine: submerge
 * timers, an HP-512 enrage and 2 px tracking. The routine reads no HP and has no timers but the
 * roll's; submerging and lava are its animation scripts.
 */

#include <stdint.h>
#include <stdbool.h>

typedef struct Entity Entity;          /* fields as in 8FCD17_enemy_ai.c */
struct Entity { int16_t x, y; uint16_t facing, stamina, state, timer, moved12; Entity *target; };

extern uint16_t now;                   /* $0B19 */
extern uint16_t rand16(void);          /* $80:859B */
extern bool     coin(void);            /* $0E94 */
extern Entity  *pick_target(Entity *e);                 /* $8F:D879 */
extern uint16_t face_diagonal(int dx, int dy);          /* $80:AE5C */
extern uint16_t face_cardinal(int dx, int dy);          /* $80:AE78 */
extern void     play(Entity *e, uint16_t anim_id);      /* $90:811B start */
extern void     play_on(Entity *e, uint16_t anim_id);   /* $90:8124 continue */
extern void     idle_animation(Entity *e);              /* $90:828E */

#define STAMINA_FULL 0x0400
#define ROLLING      15
#define CURLING      14

/*
 * One decision while rolling. d = the diagonal toward the target XOR the facing:
 * 0 straight ahead, 4 an adjacent diagonal, 8 straight behind.
 * At an obstacle: turn onto the adjacent diagonal, else stop.
 * Once the timer has run out: keep going while the target is ahead or adjacent, stop when behind.
 */
void roll_on(Entity *e, uint16_t anim_id, void (*stop)(Entity *)) {
    uint16_t want = face_diagonal(e->target->x - e->x, e->target->y - e->y);
    uint16_t d = want ^ e->facing;
    if (e->moved12 & 3) {
        if (!(d & 4)) { stop(e); return; }
        e->facing = want;
    } else if ((int16_t)(now - e->timer) > 0) {
        if (d && !(d & 4)) { stop(e); return; }
        e->facing = want;
    }
    play_on(e, anim_id);
}

static void start_roll(Entity *e) {                     /* $8F:D55F / $8F:D615 */
    e->timer = now + 30 + (rand16() & 31);
    pick_target(e);
    e->facing = face_diagonal(e->target->x - e->x, e->target->y - e->y);
    e->state = ROLLING;
    play(e, 0x4DCE);
}

/* $1A ROLL, $8F:D52E */
static void megataur_stop(Entity *e) { e->stamina = 0; e->state = 0; play(e, 0x546A); }   /* $8F:D5C4 */
void roll(Entity *e, int cmd) {
    (void)cmd;
    if (e->stamina < STAMINA_FULL) { if (e->state == ROLLING) megataur_stop(e); else idle_animation(e); return; }
    if (e->state == ROLLING) { roll_on(e, 0x4DCE, megataur_stop); return; }
    if (e->state == CURLING) { start_roll(e); return; }
    e->state = CURLING;
    play(e, 0x546A);                                     /* curl; hands back with state 14 */
}

/* $10 ROLL_OR_SHOOT, $8F:D5D2 */
static void magmar_stop(Entity *e) { e->state = 0; play(e, 0x4DCA); }   /* $8F:D67A: the charge is kept */
void roll_or_shoot(Entity *e, int cmd) {
    (void)cmd;
    if (e->stamina < STAMINA_FULL) { if (e->state == ROLLING) magmar_stop(e); else idle_animation(e); return; }
    if (e->state == ROLLING) { roll_on(e, 0x4DCE, magmar_stop); return; }
    if (e->state == CURLING) { start_roll(e); return; }
    if (coin()) {                                        /* $8F:D685: shoot */
        pick_target(e);
        uint16_t f = face_cardinal(e->target->x - e->x, e->target->y - e->y);
        play(e, f == 8 ? 0x4DE6 : 0x4DDA);               /* facing south / any other way */
        return;
    }
    e->state = CURLING;
    play(e, 0x4DCA);
}
