/*
 * $90:D55F palette_family_reload_queue_process (knowledge/routines/palette_family_reload_queue_process.md), RTL, 16-bit A and X.
 *
 * Map palette family reload request queue processor:
 * Checks update suppression flag $7E:22EB bit 0.
 * If zero, sweeps 16 pending request slots at $13D2 (X = 0x001E down to 0, step 2).
 * For any active low-byte or high-byte palette change request, invokes reloader $90:D58C.
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   palette_family_reload_queue_process ($90D55F) [RTL]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  22 instructions (45 bytes)
 * - Compiled C ASM:   172 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   7.8x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      64257bc6e6bc1c89
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"

SOE_BIND(palette_family_reload_queue_process, 0x90D55F, RTL)
{
    uint16_t a;

    SOE_AT(0xD55F);
    a = RAM16(0x22EB);
    r->a = a;
    soe_nz16(r, a);

    SOE_AT(0xD563);
    soe_bit_imm(r, a, 0x0001);
    if (!(r->p & SOE_Z)) {
        return;
    }

    SOE_AT(0xD569);
    r->x = 0x001E;
    soe_nz16(r, r->x);

    while ((int16_t)r->x >= 0) {
        SOE_AT(0xD56C);
        a = ABSI16(r, 0x13D2, r->x);
        r->a = a;
        soe_nz16(r, a);

        if (a != 0) {
            SOE_AT(0xD576);
            soe_bit_imm(r, a, 0x00FF);
            if (!(r->p & SOE_Z)) {
                SOE_AT(0xD57B);
                soe_call_rts(0x90D58CUL, r);
                SOE_AT(0xD57F);
                r->a = a;
                soe_nz16(r, a);
            }

            SOE_AT(0xD580);
            soe_bit_imm(r, a, 0xFF00);
            if (!(r->p & SOE_Z)) {
                SOE_AT(0xD585);
                r->x = (uint16_t)(r->x + 1);
                soe_nz16(r, r->x);

                SOE_AT(0xD586);
                soe_call_rts(0x90D58CUL, r);

                SOE_AT(0xD589);
                r->x = (uint16_t)(r->x - 1);
                soe_nz16(r, r->x);
            }
        }

        SOE_AT(0xD571);
        r->x = (uint16_t)(r->x - 1);
        r->x = (uint16_t)(r->x - 1);
        soe_nz16(r, r->x);
    }
}

