/*
 * Table: $8F:CBE0 (ai_behaviour_table)
 * Bank: $8F (ROM Offset: $0FCBE0, 30 bytes)
 * Source: docs/entities/ai-behaviours.md, src/games/evermore/localizations/knowledge/routines/ai_behaviour_table.md
 *
 * Enemy AI behaviour jump table indexed by character record +$03 (even values $00..$1C):
 * Jumps to one of 15 archetype behaviour handlers in Bank $8F.
 */

#include <stdint.h>
#include <stdbool.h>

typedef struct Entity Entity;

typedef void (*AiBehaviourHandler)(Entity *e, int cmd);

extern void ai_chase(Entity *e, int cmd);               /* $00: $8F:D34B */
extern void ai_none(Entity *e, int cmd);                /* $02: $8F:D76A */
extern void ai_companion_boy(Entity *e, int cmd);       /* $04: $8F:D05E */
extern void ai_companion_dog(Entity *e, int cmd);       /* $06: $8F:D0A8 */
extern void ai_stationary(Entity *e, int cmd);          /* $08: $8F:D6FB */
extern void ai_wander(Entity *e, int cmd);              /* $0A: $8F:D76E */
extern void ai_chase_hovering(Entity *e, int cmd);      /* $0C: $8F:D4FB */
extern void ai_stationary_player(Entity *e, int cmd);   /* $0E: $8F:D715 */
extern void ai_roll_or_shoot(Entity *e, int cmd);       /* $10: $8F:D5D2 */
extern void ai_chase_or_roll(Entity *e, int cmd);       /* $12: $8F:D421 */
extern void ai_bounce(Entity *e, int cmd);              /* $14: $8F:D394 */
extern void ai_drift_east(Entity *e, int cmd);          /* $16: $8F:D3DC */
extern void ai_pursue_player(Entity *e, int cmd);       /* $18: $8F:D380 */
extern void ai_roll(Entity *e, int cmd);                /* $1A: $8F:D52E */
extern void ai_stationary_diagonal(Entity *e, int cmd); /* $1C: $8F:D708 */

/* Master 15-entry AI behaviour function pointer table ($8F:CBE0) */
const AiBehaviourHandler c_ai_behaviour_table[15] = {
    ai_chase,
    ai_none,
    ai_companion_boy,
    ai_companion_dog,
    ai_stationary,
    ai_wander,
    ai_chase_hovering,
    ai_stationary_player,
    ai_roll_or_shoot,
    ai_chase_or_roll,
    ai_bounce,
    ai_drift_east,
    ai_pursue_player,
    ai_roll,
    ai_stationary_diagonal
};

/**
 * Dispatches an entity's behaviour routine according to its character record behavior field.
 * Corresponds to JMP ($CBE0,x) at $8F:CD2E.
 */
void ai_behaviour_dispatch(Entity *e, uint16_t behaviour_offset, int cmd) {
    uint16_t index = behaviour_offset >> 1;
    if (index < 15) {
        c_ai_behaviour_table[index](e, cmd);
    }
}

