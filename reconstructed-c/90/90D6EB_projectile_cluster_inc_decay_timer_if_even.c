/**
 * Routine: $90:D6EB (projectile_cluster_inc_decay_timer_if_even)
 * Bank: $90 (ROM Offset: $10D6EB)
 * Calling convention: RTS
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   projectile_cluster_inc_decay_timer_if_even ($90D6EB) [RTS]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  32 instructions (63 bytes)
 * - Compiled C ASM:   350 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   10.9x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      8ea4358814c287fc
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"

SOE_BIND(projectile_cluster_inc_decay_timer_if_even, 0x90D6EB, RTS);

void projectile_cluster_inc_decay_timer_if_even_bind(soe_regs r) {
    uint16_t frame_lo = ABS8(r, 0x0B19u);
    if ((frame_lo & 1u) == 0u) {
        uint16_t x8 = (uint8_t)r->y;
        ABSI8(r, 0x0ECFu, x8) = (uint8_t)(ABSI8(r, 0x0ECFu, x8) + 1u);
    }
    uint8_t saved_y = (uint8_t)r->y;
    uint8_t x = (uint8_t)r->y;
    uint8_t cnt = ABSI8(r, 0x0ECEu, x);
    do {
        uint8_t vel = (uint8_t)(ABSI8(r, 0x0ED5u, x) - 1u);
        ABSI8(r, 0x0ED5u, x) = vel;
        uint8_t pos = (uint8_t)(vel + ABSI8(r, 0x0ED0u, x));
        ABSI8(r, 0x0ED0u, x) = pos;
        if (pos == 0u) {
            uint8_t neg = (uint8_t)(0xF9u - vel);
            if ((neg & 0x80u) || neg == 0u) {
                neg = 0x01u;
            }
            ABSI8(r, 0x0ED5u, x) = neg;
        }
        x = (uint8_t)(x + 1u);
        cnt = (uint8_t)(cnt - 1u);
    } while (cnt != 0u);
    r->x = x;
    r->y = saved_y;
    r->p &= (uint8_t)~(SOE_M | SOE_X);
    soe_call_rtl(0x90D749u, r);
    soe_carry(r, false);
}
