/*
 * $8C:DD60 — script_op_3f_attach_script (RTS)
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   script_op_3f_attach_script ($8CDD60) [RTS]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  41 instructions (80 bytes)
 * - Compiled C ASM:   435 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   10.6x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      cf489c64322d58a5
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"

SOE_BIND(script_op_3f_attach_script, 0x8CDD60, RTS);
void script_op_3f_attach_script_bind(soe_regs r)
{
    soe_call_rtl(0x8CEA43u, r);
    if (r->a >= 0x2000u) {
        r->p |= SOE_C;
        r->y = r->a;
        uint16_t s68 = LONG16(((uint32_t)DP8(r, 0x84) << 16) | DP16(r, 0x82));
        DP16(r, 0x82) = (uint16_t)(DP16(r, 0x82) + 2u);
        LONG16(((uint32_t)r->db << 16) + 0x0068u + r->y) = s68;
        r->x = s68;

        uint16_t s66 = LONG16(((uint32_t)DP8(r, 0x84) << 16) | DP16(r, 0x82));
        DP16(r, 0x82) = (uint16_t)(DP16(r, 0x82) + 2u);
        LONG16(((uint32_t)r->db << 16) + 0x0066u + r->y) = s66;

        r->a = (uint16_t)(r->x & 0x0400u);
        soe_nz16(r, r->a);
        if (r->a != 0) {
            soe_call_rtl(0x8CCE4Du, r);
        }
        r->p |= SOE_C;
        return;
    }

    r->x = (uint16_t)((uint16_t)(r->a - 1u) << 1);
    uint16_t a2 = LONG16(((uint32_t)DP8(r, 0x84) << 16) | DP16(r, 0x82));
    uint16_t pc0 = (uint16_t)(DP16(r, 0x82) + 2u);
    DP16(r, 0x82) = pc0;
    LONG16(((uint32_t)r->db << 16) + 0x0EA2u + r->x) = a2;
    if (pc0 != 0) {
        uint16_t ac = LONG16(((uint32_t)DP8(r, 0x84) << 16) | DP16(r, 0x82));
        uint16_t pc = (uint16_t)(DP16(r, 0x82) + 2u);
        DP16(r, 0x82) = pc;
        LONG16(((uint32_t)r->db << 16) + 0x0EACu + r->x) = ac;
        r->a = ac;
        soe_nz16(r, pc);
    } else {
        DP16(r, 0x82) = (uint16_t)(DP16(r, 0x82) + 2u);
        LONG16(((uint32_t)r->db << 16) + 0x0EACu + r->x) = 0xFFFFu;
        r->a = 0xFFFFu;
        soe_nz16(r, 0xFFFFu);
    }
    r->p |= SOE_C;
}
