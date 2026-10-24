/*
 * $90:8453 anim_op_reset (knowledge/rom/908453.md), RTS, 8-bit A on entry and exit.
 *
 * In: Y = the entity record (DB-relative), copied to X. Clears +$82, +$16, +$42, +$06, +$08, +$0A,
 * sets +$44 = $FFF0; when +$16 had bit 4, also clears +$2E and bit 9 of +$14.
 * Leaves A = $FFF0, X = Y, N Z from the LDA #$FFF0.
 */
#include "soe.h"
#include "soe_ram.h"

SOE_BIND(anim_op_reset, 0x908453, RTS)
{
    uint16_t x = r->y;

    r->x = x;
    ABSI16(r, ENTITY_RECORD_TICK_HANDLER_OFF, x) = 0;
    if (ABSI16(r, ENTITY_RECORD_MODE_OFF, x) & 0x0010) {
        ABSI16(r, ENTITY_RECORD_STAMINA_OFF, x) = 0;
        ABSI16(r, ENTITY_RECORD_CLOSED_STATES_OFF, x) = (uint16_t)(ABSI16(r, ENTITY_RECORD_CLOSED_STATES_OFF, x) & 0xFDFF);
    }
    ABSI16(r, ENTITY_RECORD_MODE_OFF, x) = 0;
    ABSI16(r, ENTITY_RECORD_HURT_DX_OFF, x) = 0;
    ABSI16(r, ENTITY_RECORD_HURT_DY_OFF, x) = 0xFFF0;
    ABSI16(r, ENTITY_RECORD_SPRITE_OFF, x) = 0;
    ABSI16(r, ENTITY_RECORD_SPRITE_BANK_OFF, x) = 0;
    ABSI16(r, 0x000A, x) = 0;                                /* +$0A: meaning not known yet */
    r->a = 0xFFF0;
    soe_nz16(r, 0xFFF0);
    r->p |= SOE_M;
}
