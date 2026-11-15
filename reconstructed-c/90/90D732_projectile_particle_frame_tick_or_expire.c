/**
 * Routine: $90:D732 (projectile_particle_frame_tick_or_expire)
 * Bank: $90 (ROM Offset: $10D732)
 * Calling convention: RTS
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   sub_90D6FB ($90D6FB) [RTS]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  25 instructions (49 bytes)
 * - Compiled C ASM:   257 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   10.3x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      4e05b8e897e5fb95
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"

SOE_BIND(projectile_particle_frame_tick_or_expire, 0x90D732, RTS);
SOE_BIND(sub_90D6FB, 0x90D6FB, RTS);

void projectile_particle_frame_tick_or_expire_bind(soe_regs r) {
    r->x = r->y;
    uint16_t frame = ABS16(r, 0x0100u);
    r->a = (uint16_t)(frame >> 1);
    soe_carry(r, (frame & 1u) != 0u);
    if (frame & 1u) {
        soe_nz16(r, r->a);
        soe_call_rtl(0x90D749u, r);
        soe_carry(r, false);
        return;
    }
    uint16_t ttl = (uint16_t)(ABSI16(r, 0x0ECFu, r->x) - 1u);
    ABSI16(r, 0x0ECFu, r->x) = ttl;
    soe_nz16(r, ttl);
    if ((ttl & 0x8000u) == 0u) {
        soe_call_rtl(0x90D749u, r);
        soe_carry(r, false);
        return;
    }
    ABSI16(r, 0x0ECAu, r->x) = 0u;
    soe_carry(r, false);
}

SOE_BIND(sub_90D6FB, 0x90D6FB, RTS) {
    uint16_t orig_y = r->y;
    uint8_t x = (uint8_t)r->y;
    uint8_t count = ABS8(r, 0x0ECEu + x);
    do {
        uint8_t a = (uint8_t)(ABS8(r, 0x0ED5u + x) - 1u);
        ABS8(r, 0x0ED5u + x) = a;
        uint8_t sum = (uint8_t)(a + ABS8(r, 0x0ED0u + x));
        ABS8(r, 0x0ED0u + x) = sum;
        if (sum == 0u) {
            uint8_t diff = (uint8_t)(0xF9u - a);
            uint8_t next_ed5 = ((diff & 0x80u) || diff == 0u) ? 0x01u : diff;
            ABS8(r, 0x0ED5u + x) = next_ed5;
        }
        x = (uint8_t)(x + 1u);
        } while (--count != 0u);
    r->y = orig_y;
    r->x = x;
    r->p &= (uint8_t)~(SOE_M | SOE_X);
    soe_call_rtl(0x90D749u, r);
    soe_carry(r, false);
}
