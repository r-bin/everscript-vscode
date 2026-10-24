/*
 * $8F:D879 ai_pick_target (knowledge/rom/8fd879.md, its tail 8fd8d2.md), RTS, 16-bit A and X.
 *
 * In: Y = the AI's record (DB-relative). Picks which party member to go for: the one the camera
 * follows ($0F42), or the other one (record ^ $01BE, Boy <-> Dog) when it is active (rec[$2A] != 0)
 * and its Manhattan distance + $14 is below the first one's (CMP's N flag). A member with rec[$10]
 * bit 5 or rec[$14] bit 8 is not targetable: target 0. Out: Y's rec[$24] = the target (0 = none),
 * X = A = the target, DP $02/$04 = its x/y minus the AI's (when the other member was taken, or the
 * first member's offsets from the distance step), DP $12/$14 = the distances.
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   ai_pick_target ($8FD879) [RTS]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  74 instructions (158 bytes)
 * - Compiled C ASM:   698 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   9.4x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      5fbfc2ec5ac7f335
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"
#include "soe_ram.h"

/* SEC / SBC; BPL +4 / DEC A / EOR #$FFFF: |a - b| as the asm leaves it (N Z from the last step) */
static uint16_t absdiff(soe_regs r, uint16_t a, uint16_t b)
{
    soe_carry(r, true);
    a = soe_sbc16(r, a, b);
    if (a & 0x8000) {
        a = (uint16_t)~(uint16_t)(a - 1);
        soe_nz16(r, a);
    }
    return a;
}

/* $D911 / $D90C / $D8F4: the target, or none */
static void choose(soe_regs r, uint16_t x, uint16_t y)
{
    if ((ABSI16(r, ENTITY_RECORD_FLAGS_OFF, x) & 0x0020) || (ABSI16(r, ENTITY_RECORD_CLOSED_STATES_OFF, x) & 0x0100)) {
        r->a = r->x = r->d;
        soe_nz16(r, r->d);
        ABSI16(r, ENTITY_RECORD_AI_TARGET_OFF, y) = r->d;
        return;
    }
    r->x = r->a = x;
    soe_nz16(r, x);
    ABSI16(r, ENTITY_RECORD_AI_TARGET_OFF, y) = x;
}

SOE_BIND(ai_pick_target, 0x8FD879, RTS)
{
    uint16_t y = r->y, x = ABS16(r, 0x0F42), d, other;

    DP16(r, 0x02) = (uint16_t)(ABSI16(r, ENTITY_RECORD_POS_X_OFF, x) - ABSI16(r, ENTITY_RECORD_POS_X_OFF, y));
    DP16(r, 0x12) = absdiff(r, ABSI16(r, ENTITY_RECORD_POS_X_OFF, x), ABSI16(r, ENTITY_RECORD_POS_X_OFF, y));
    DP16(r, 0x04) = (uint16_t)(ABSI16(r, ENTITY_RECORD_POS_Y_OFF, x) - ABSI16(r, ENTITY_RECORD_POS_Y_OFF, y));
    d = absdiff(r, ABSI16(r, ENTITY_RECORD_POS_Y_OFF, x), ABSI16(r, ENTITY_RECORD_POS_Y_OFF, y));
    soe_carry(r, false);
    DP16(r, 0x12) = soe_adc16(r, d, DP16(r, 0x12));
    other = (uint16_t)(x ^ 0x01BE);
    r->x = other;
    if (ABSI16(r, ENTITY_RECORD_HP_OFF, other) != 0) {
        uint16_t e;
        e = absdiff(r, ABSI16(r, ENTITY_RECORD_POS_X_OFF, other), ABSI16(r, ENTITY_RECORD_POS_X_OFF, y));
        DP16(r, 0x14) = e;
        e = absdiff(r, ABSI16(r, ENTITY_RECORD_POS_Y_OFF, other), ABSI16(r, ENTITY_RECORD_POS_Y_OFF, y));
        soe_carry(r, false);
        e = soe_adc16(r, e, DP16(r, 0x14));
        soe_carry(r, false);
        e = soe_adc16(r, e, 0x0014);
        soe_cmp16(r, e, DP16(r, 0x12));
        if (r->p & SOE_N) {                                  /* $8F:D8D2: the other member */
            if ((ABSI16(r, ENTITY_RECORD_FLAGS_OFF, other) & 0x0020) || (ABSI16(r, ENTITY_RECORD_CLOSED_STATES_OFF, other) & 0x0100)) {
                choose(r, other, y);
                return;
            }
            soe_carry(r, true);
            DP16(r, 0x02) = soe_sbc16(r, ABSI16(r, ENTITY_RECORD_POS_X_OFF, other), ABSI16(r, ENTITY_RECORD_POS_X_OFF, y));
            soe_carry(r, true);
            DP16(r, 0x04) = soe_sbc16(r, ABSI16(r, ENTITY_RECORD_POS_Y_OFF, other), ABSI16(r, ENTITY_RECORD_POS_Y_OFF, y));
            choose(r, other, y);
            return;
        }
    }
    choose(r, ABS16(r, 0x0F42), y);                          /* $D8F9 */
}