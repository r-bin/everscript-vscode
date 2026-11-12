/*
 * $8F:D917 — ai_wander_step (RTL)
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   ai_wander_step ($8FD917) [RTL]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  39 instructions (113 bytes)
 * - Compiled C ASM:   318 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   8.2x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      5403e1dd2d25287a
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"

SOE_BIND(ai_wander_step, 0x8FD917, RTL);
void ai_wander_step_bind(soe_regs r)
{
    r->x = RAM16((uint16_t)(r->y + 0x006Au));
    if ((r->x & 0x8000u) == 0) {
        soe_call_rtl(0x8F9916u, r);
        RAM16((uint16_t)(r->y + 0x006Au)) = r->a;
    }

    uint16_t state = RAM16((uint16_t)(r->y + 0x0078u));
    if (state == 4u) {
        uint16_t t = RAM16((uint16_t)(r->y + 0x007Au));
        uint16_t diff = (uint16_t)(t - RAM16(0x0B19u));
        if ((diff & 0x8000u) == 0) {
            r->a = t;
            soe_nz16(r, diff);
            r->p |= SOE_C;
            return;
        }
    } else if (state == 5u) {
        uint16_t t = RAM16((uint16_t)(r->y + 0x007Au));
        uint16_t diff = (uint16_t)(t - RAM16(0x0B19u));
        if ((diff & 0x8000u) == 0) {
            r->a = t;
            soe_nz16(r, diff);
            r->p |= SOE_C;
            return;
        }
        RAM16((uint16_t)(r->y + 0x0078u)) = 4u;
        soe_call_rtl(0x80859Bu, r);
        uint16_t a = (uint16_t)(r->a & 0x007Fu);
        a = soe_adc16(r, a, 0x0014u);
        a = soe_adc16(r, a, RAM16(0x0B19u));
        RAM16((uint16_t)(r->y + 0x007Au)) = a;
        r->a = a;
        soe_call_rtl(0x90828Eu, r);
        return;
    } else {
        RAM16((uint16_t)(r->y + 0x007Au)) = 0;
    }

    RAM16((uint16_t)(r->y + 0x0078u)) = 5u;
    soe_call_rtl(0x80859Bu, r);
    RAM16((uint16_t)(r->y + 0x0022u)) = (uint16_t)(r->a & 0x000Cu);
    uint16_t a = (uint16_t)(RAM16(0x0134u) & 0x003Fu);
    a = soe_adc16(r, a, 0x001Eu);
    a = soe_adc16(r, a, RAM16(0x0B19u));
    RAM16((uint16_t)(r->y + 0x007Au)) = a;
    r->a = a;
    soe_call_rtl(0x90824Bu, r);
}

