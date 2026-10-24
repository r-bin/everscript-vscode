/*
 * $8F:D9D1 enemy_attack_reach_test (knowledge/rom/8fd9d1.md), RTS, 16-bit A and X. Answer in C.
 *
 * In: Y = the AI's record (DB-relative), its target X = rec[$24]; DP $02/$04 = target minus AI
 * (from ai_pick_target). C = 0: may not attack ($0EB8 has neither of bits 0 and 2 clear... exactly:
 * ($0EB8 ^ 5) & 5 == 0). C = 1 at once when the planes differ ((rec[$18] ^ target[$18]) & $30) and
 * neither has bit 6. Else the height difference |target z (rec[$20] << 4 + rec[$1E]) - own z| must be
 * below $140 (else C = 1), and the reach is checked per axis against the template values at
 * $8E:0013 + rec[$60] (own) and half the target template's $8E:000D + 5 (DP $12): the answer is the
 * carry of the last CMP. C = 1 means out of reach.
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   enemy_attack_reach_test ($8FD9D1) [RTS]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  56 instructions (122 bytes)
 * - Compiled C ASM:   497 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   8.9x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      1aa2ad185f61c028
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"
#include "soe_ram.h"

/* LDA dp; BPL +4; DEC A; EOR #$FFFF */
static uint16_t abs_dp(soe_regs r, uint8_t o)
{
    uint16_t a = DP16(r, o);

    soe_nz16(r, a);
    if (a & 0x8000) {
        a = (uint16_t)~(uint16_t)(a - 1);
        soe_nz16(r, a);
    }
    return a;
}

SOE_BIND(enemy_attack_reach_test, 0x8FD9D1, RTS)
{
    uint16_t y = r->y, x, a;

    a = (uint16_t)(ABS16(r, 0x0EB8) ^ 0x0005);
    soe_nz16(r, a);
    soe_bit_imm(r, a, 0x0005);
    r->a = a;
    if ((a & 0x0005) == 0) { soe_carry(r, false); return; }
    x = ABSI16(r, ENTITY_RECORD_AI_TARGET_OFF, y);
    r->x = x;
    a = ABSI16(r, ENTITY_RECORD_PLANE_OFF, y);
    if (!(a & 0x0040)) {
        a ^= ABSI16(r, ENTITY_RECORD_PLANE_OFF, x);
        if ((a & 0x0030) && !(a & 0x0040)) {
            soe_nz16(r, a);                                  /* EOR */
            soe_bit_imm(r, a, 0x0040);                       /* BIT #$0040: Z set */
            r->a = a;
            soe_carry(r, true);
            return;
        }
    }
    /* $D9F4: the height difference */
    a = ABSI16(r, ENTITY_RECORD_VSPEED_OFF, x);
    soe_carry(r, (a & 0x1000) != 0);                         /* the last of four ASL */
    a = (uint16_t)(a << 4);
    a = soe_adc16(r, a, ABSI16(r, ENTITY_RECORD_HEIGHT_OFF, x));
    a = soe_sbc16(r, a, ABSI16(r, ENTITY_RECORD_HEIGHT_OFF, y));
    if (a & 0x8000) {
        a = (uint16_t)~(uint16_t)(a - 1);
        soe_nz16(r, a);
    }
    soe_cmp16(r, a, 0x0140);
    r->a = a;
    if (r->p & SOE_C) return;
    x = ABSI16(r, ENTITY_RECORD_CHARACTER_OFF, x);
    a = LONG16(0x8E000DUL + x);
    soe_carry(r, a & 1);                                     /* LSR A */
    a = soe_adc16(r, (uint16_t)(a >> 1), 0x0005);
    DP16(r, 0x12) = a;
    x = ABSI16(r, ENTITY_RECORD_CHARACTER_OFF, y);
    r->x = x;
    a = abs_dp(r, 0x02);
    soe_cmp16(r, a, LONG16(0x8E0013UL + x));
    r->a = a;
    if (r->p & SOE_C) return;
    soe_cmp16(r, a, DP16(r, 0x12));
    if (r->p & SOE_C) {                                      /* $DA3C */
        a = abs_dp(r, 0x04);
        soe_cmp16(r, a, DP16(r, 0x12));
    } else {
        a = abs_dp(r, 0x04);
        soe_cmp16(r, a, LONG16(0x8E0013UL + x));
    }
    r->a = a;
}