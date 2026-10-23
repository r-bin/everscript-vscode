/*
 * Routine: $8FCD17 (enemy_ai) — the behaviour dispatcher, the behaviours $00-$1C (except the
 * rollers, 8FD5D2_roll_or_shoot.c, and the companions, 8FD018_companion_follow.c) and the helpers
 * they share. Decompiled from $8F:CCFA-$8F:DC33 (v0.342.0).
 * Bank: $8F (ROM Offset: $0FCD17)
 * Source: docs/entities/ai-behaviours.md
 *
 * Previously this file held a reconstruction with an aggro roll in every chaser and other
 * behaviour the code does not have.
 */

#include <stdint.h>
#include <stdbool.h>

typedef struct Entity Entity;
typedef struct Record Record;          /* character record, bank $8E (docs/entities/character-properties.md) */

struct Record {
    uint16_t behaviour;                /* +$03 */
    uint16_t radius;                   /* +$0D */
    uint16_t aggro_range;              /* +$13 */
    uint16_t aggro_chance;             /* +$15 */
};

struct Entity {
    uint8_t  *anim_resume;             /* +$00: where the animation script stopped */
    uint16_t z_low;                    /* +$0E: compared with 20 by keep_going, meaning open */
    uint16_t flags10;                  /* +$10: bit 1 friendly, bit 5 left out of targeting, $0400 phasing */
    uint16_t moved12;                  /* +$12: bit 1 step blocked, bit 0 slid ($8F:AEE1, $8F:AF11) */
    uint16_t state14;                  /* +$14: $F000 = scripted movement */
    uint16_t mode;                     /* +$16: `mode` (animation_script.md § The mode word) */
    int16_t  x, y, z;                  /* +$1A, +$1C, +$1E */
    uint16_t facing;                   /* +$22: 0 N, 2 NE, 4 E, 6 SE, 8 S, $A SW, $C W, $E NW */
    Entity  *target;                   /* +$24 */
    int16_t  home_x, home_y;           /* +$26, +$28: the spawn point */
    uint16_t hp;                       /* +$2A */
    uint16_t stamina;                  /* +$2E */
    uint16_t leash;                    /* +$40 */
    Record  *record;                   /* +$60 */
    int16_t  path;                     /* +$6A: < 0 = none */
    uint16_t anim_flags6C;             /* +$6C: bit 15 = the script lets the AI decide */
    uint16_t state;                    /* +$78 */
    uint16_t timer;                    /* +$7A: a deadline against the tick counter */
    Entity  *attacked_by;              /* +$80 */
};

extern Entity  *controlled;            /* $0F42 */
extern uint16_t now;                   /* $0B19, the field tick */
extern uint16_t rand16(void);          /* $80:859B */
extern bool     coin(void);            /* one bit of $0E94, refilled from rand16 */
extern uint16_t face_8(int dx, int dy);        /* $80:ADF0 */
extern uint16_t face_cardinal(int dx, int dy); /* $80:AE78 */
extern uint16_t face_diagonal(int dx, int dy); /* $80:AE5C */
extern void idle_animation(Entity *e);          /* $90:828E: stand / walk by movement */
extern void walk_animation(Entity *e);          /* $90:824B */
extern void play(Entity *e, uint16_t anim_id);  /* $90:811B */
extern void attack_by_charge(Entity *e);        /* $90:82D8 */
extern void follow_path(Entity *e);             /* $8F:9C24 / $8F:9C15 (running) */
extern bool find_path(Entity *e, Entity *to);   /* $8F:9877 + $8F:A78A */
extern void head_for(Entity *e, int x, int y);  /* $8F:AB92 */
extern Entity *other_party_member(Entity *p);   /* p ^ $01BE: $4E89 <-> $4F37 */

#define ABS(v) ((v) < 0 ? -(v) : (v))
#define STAMINA_FULL 0x0400

typedef void Behaviour(Entity *e, int cmd);
Behaviour chase, none, companion_boy, companion_dog, stationary, wander, chase_hovering, stationary_player,
          roll_or_shoot, chase_or_roll, bounce, drift_east, pursue_player, roll, stationary_diagonal;

/* $8F:CBE0, indexed by the record's +$03 (IDLE_BEHAVIOR) */
static Behaviour *const behaviour_table[15] = {
    chase,          /* $00 $8F:D34B */   none,              /* $02 $8F:D76A */
    companion_boy,  /* $04 $8F:D05E */   companion_dog,     /* $06 $8F:D0A8 */
    stationary,     /* $08 $8F:D6FB */   wander,            /* $0A $8F:D76E */
    chase_hovering, /* $0C $8F:D4FB */   stationary_player, /* $0E $8F:D715 */
    roll_or_shoot,  /* $10 $8F:D5D2 */   chase_or_roll,     /* $12 $8F:D421 */
    bounce,         /* $14 $8F:D394 */   drift_east,        /* $16 $8F:D3DC */
    pursue_player,  /* $18 $8F:D380 */   roll,              /* $1A $8F:D52E */
    stationary_diagonal,                 /* $1C $8F:D708 */
};

/* $8F:CCFA: every tick, after the charge (§ +$2E) */
void ai_tick(Entity *e) {
    if (!(e->anim_flags6C & 0x8000)) return;            /* $8F:CD35: the animation carries on */
    if (e->flags10 & 0x0021) { idle_animation(e); return; }
    if (e < (Entity *)0x4E89 && (e->state14 & 0xF000)) { /* $8F:D2DA: scripted movement */ return; }
    int cmd = *e->anim_resume;                           /* $8F:CD29: lda [$5D] & $FF */
    /* $8F:CD1A: the record is read every time, so changing TYPE (+$60) changes the behaviour */
    behaviour_table[e->record->behaviour / 2](e, cmd);   /* jmp ($CBE0,x) */
}

/* $8F:D8D2: keep a target only if it may be targeted */
static Entity *accept(Entity *e, Entity *t) {
    if ((t->flags10 & 0x0020) || (t->state14 & 0x0100)) t = 0;
    e->target = t;
    return t;
}

/* $8F:D879: no range and no chance — the controlled character unless the partner is 20 px closer */
Entity *pick_target(Entity *e) {
    Entity *c = controlled, *o = other_party_member(c);
    int dc = ABS(c->x - e->x) + ABS(c->y - e->y);
    if (o->hp && ABS(o->x - e->x) + ABS(o->y - e->y) + 20 < dc) return accept(e, o);
    return accept(e, c);
}

/* $8F:D9D1: lined up within reach (carry clear in the ROM) */
bool in_reach(Entity *e) {
    Entity *t = e->target;
    int s = t->record->radius / 2 + 5;
    int dx = ABS(t->x - e->x), dy = ABS(t->y - e->y);
    if (ABS(t->z - e->z) >= 0x140) return false;        /* velocity·16 + z in the ROM */
    if (dx >= e->record->aggro_range) return false;
    return dx < s ? dy < e->record->aggro_range : dy < s;
}

/* $8F:DC1D */
void engage(Entity *e, Entity *t) {
    e->target = t;
    if (!t->attacked_by) t->attacked_by = e;
    e->state = 7;
    attack_by_charge(e);
}

/* $8F:DA4B / $8F:DA5C */
void attack(Entity *e) {
    e->facing = face_cardinal(e->target->x - e->x, e->target->y - e->y);
    engage(e, e->target);
}
void attack_diagonal(Entity *e) {
    e->facing = face_diagonal(e->target->x - e->x, e->target->y - e->y);
    engage(e, e->target);
}

/* $8F:DA6D */
void approach(Entity *e) {
    e->state = 8;
    if (!(e->flags10 & 0x0400) && find_path(e, e->target)) { follow_path(e); walk_animation(e); return; }
    head_for(e, e->target->x, e->target->y);
    walk_animation(e);
}

/* $8F:DBCC: walk away from the target while recharging */
extern const uint16_t retreat_turns[32];                 /* $8F:DB4C */
void retreat(Entity *e) {
    if (e->state == 3 && !(e->moved12 & 1)) { /* keep walking: record +$34 */ return; }
    e->state = 3;
    uint16_t toward = face_8(e->target->x - e->x, e->target->y - e->y);   /* $8F:9DBD */
    e->facing = ((retreat_turns[(rand16() & 0x3E) / 2] + toward) ^ 8) & 0xE;
    walk_animation(e);
}

/* $8F:D9BB */
void fight(Entity *e) {
    if (e->stamina < STAMINA_FULL) retreat(e);
    else if (in_reach(e)) attack(e);
    else approach(e);
}

/* $8F:DAA7: rom/8fdaa7.md */
void leash(Entity *e) {
    if (!e->leash) return;
    uint16_t limit = e->state == 6 ? e->leash / 2 : e->leash;
    if (ABS(e->x - e->home_x) + ABS(e->y - e->home_y) < limit) return;
    e->state = 6;                                        /* heads for (home_x, home_y) */
}

/* $8F:D917: stand 20-147 ticks, walk 30-93 ticks one cardinal way, repeat */
void start_pause(Entity *e) {                            /* $8F:D94B */
    e->state = 4;
    e->timer = now + 20 + (rand16() & 0x7F);
    idle_animation(e);
}
void wander_step(Entity *e) {
    if (e->path >= 0) { /* $8F:9916 */ }
    if (e->state == 4) { if ((int16_t)(e->timer - now) > 0) return; }
    else if (e->state == 5) { if ((int16_t)(e->timer - now) > 0) return; start_pause(e); return; }
    e->state = 5;                                        /* $8F:D965 */
    e->facing = rand16() & 0x0C;
    e->timer = now + 30 + (rand16() & 0x3F);
    walk_animation(e);
}

/* $8F:D988: true when the caller should re-plan */
bool keep_going(Entity *e) {
    if (e->path >= 0) { follow_path(e); return false; }
    return (e->moved12 & 1) && e->z_low >= 20;
}

/* $8F:D69B: the stationary engage test; true after engaging */
bool engage_test(Entity *e, uint16_t (*face)(int, int)) {
    if (e->stamina < STAMINA_FULL) return false;
    if ((rand16() & 0xFF) >= e->record->aggro_chance) return false;
    int r = e->record->aggro_range;
    Entity *ps[2] = { (Entity *)0x4E89, (Entity *)0x4F37 };   /* $0F3E, $0F40 */
    for (int i = 0; i < 2; i++) {
        Entity *p = ps[i];
        if (p->hp && ABS(p->x - e->x) < r && ABS(p->y - e->y) < r) {
            e->facing = face(p->x - e->x, p->y - e->y);
            engage(e, p);
            return true;
        }
    }
    return false;
}

/* ---- the behaviours ---- */

/* $00 CHASE, $8F:D34B */
void chase(Entity *e, int cmd) {
    if (e->flags10 & 0x0002) { wander(e, cmd); return; }   /* friendly: acts as WANDER */
    if (cmd != 0x21 && e->state) {
        if (e->state == 8) { if (pick_target(e)) fight(e); else wander_step(e); return; }
        if (!keep_going(e)) return;
    }
    leash(e);
    if (pick_target(e)) fight(e); else wander_step(e);
}

/* $02 NONE, $8F:D76A */
void none(Entity *e, int cmd) { (void)cmd; idle_animation(e); }

/* $08 STATIONARY, $8F:D6FB; $1C STATIONARY_DIAGONAL, $8F:D708 */
void stationary(Entity *e, int cmd)          { (void)cmd; if (!engage_test(e, face_cardinal)) idle_animation(e); }
void stationary_diagonal(Entity *e, int cmd) { (void)cmd; if (!engage_test(e, face_diagonal)) idle_animation(e); }

/* $0E STATIONARY_PLAYER, $8F:D715: only the controlled character, no HP check, 8 directions */
void stationary_player(Entity *e, int cmd) {
    (void)cmd;
    Record *r = e->record;
    if (e->stamina < STAMINA_FULL || (rand16() & 0xFF) >= r->aggro_chance) { idle_animation(e); return; }
    Entity *p = controlled;
    if (ABS(p->x - e->x) >= r->aggro_range || ABS(p->y - e->y) >= r->aggro_range) { idle_animation(e); return; }
    e->facing = face_8(p->x - e->x, p->y - e->y);
    engage(e, p);
}

/* $0A WANDER, $8F:D76E */
void wander(Entity *e, int cmd) {
    if (cmd != 0x21) { if (keep_going(e)) start_pause(e); return; }
    if (e->target) { approach(e); return; }
    leash(e);
    wander_step(e);
}

/* $0C CHASE_HOVERING, $8F:D4FB */
void chase_hovering(Entity *e, int cmd) {
    if (e->z < 0x50) e->z += 16;
    else if (e->z >= 0x280) e->z -= 16;
    else e->z += coin() ? -16 : 16;
    chase(e, cmd);
}

/* $14 BOUNCE, $8F:D394 */
void bounce(Entity *e, int cmd) {
    (void)cmd;
    if (e->moved12 & 3)
        e->facing = coin() ? rand16() & 0x0E : face_8(controlled->x - e->x, controlled->y - e->y);
    walk_animation(e);
}

/* $16 DRIFT_EAST, $8F:D3DC */
void drift_east(Entity *e, int cmd) {
    (void)cmd;
    if ((e->moved12 & 1) || ((e->x + e->y + 8) & 15) == 0) {
        uint16_t r = rand16() & 15;
        e->facing = r < 2 ? 8 : r < 4 ? 0 : 4;          /* south 1/8, north 1/8, east 3/4 */
    }
    walk_animation(e);
}

/* $18 PURSUE_PLAYER, $8F:D380: never engages; hurts by contact (mode $8004) */
void pursue_player(Entity *e, int cmd) {
    (void)cmd;
    e->target = controlled;
    if (e->stamina >= STAMINA_FULL) approach(e); else retreat(e);
}

/* $12 CHASE_OR_ROLL, $8F:D421 */
extern void roll_on(Entity *e, uint16_t anim_id, void (*stop)(Entity *));   /* 8FD5D2_roll_or_shoot.c */
static void viper_stop(Entity *e) { e->state = 0; play(e, 0x4C86); }
void chase_or_roll(Entity *e, int cmd) {
    if (e->flags10 & 0x0002) { wander(e, cmd); return; }
    if (cmd != 0x21 && !keep_going(e)) return;
    leash(e);
    if (!pick_target(e)) { wander_step(e); return; }
    if (e->state == 15) {                                /* $8F:D4A0: rolling */
        if (e->stamina < STAMINA_FULL) { viper_stop(e); return; }
        roll_on(e, /* the record's attack 3, +$3E */ 0, viper_stop);
        return;
    }
    if (e->stamina < STAMINA_FULL) { retreat(e); return; }
    if (in_reach(e)) { attack_diagonal(e); return; }
    if (e->state == 8 || coin()) { approach(e); return; }
    e->state = 15;                                       /* start a roll */
    e->timer = now + 90 + (rand16() & 31);
    e->facing = face_diagonal(e->target->x - e->x, e->target->y - e->y);
    play(e, 0x4C26);
}
