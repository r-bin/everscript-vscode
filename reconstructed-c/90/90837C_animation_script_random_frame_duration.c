/**
 * Routine: $90:837C (animation_script_random_frame_duration)
 * Bank: $90 (ROM Offset: $10837C)
 * Calling convention: RTS
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   animation_script_random_frame_duration ($90837C) [RTS]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  21 instructions (48 bytes)
 * - Compiled C ASM:   271 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   12.9x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      5039d380ddef0a9c
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"

SOE_BIND(animation_script_random_frame_duration, 0x90837C, RTS);

void animation_script_random_frame_duration_bind(soe_regs r) {
    uint8_t range = LONG8(SOE_DPPTR(r, 0x5Du));
    IO8(0x4202u) = range;
    r->p &= (uint8_t)~SOE_M;
    soe_set_a8(r, range);
    soe_call_rtl(0x80859Bu, r);
    r->p |= SOE_M;
    IO8(0x4203u) = SOE_A8(r);
    uint8_t pc_lo = (uint8_t)(DP8(r, 0x5Du) + 1u);
    DP8(r, 0x5Du) = pc_lo;
    if (pc_lo == 0u) {
        DP8(r, 0x5Eu) = (uint8_t)(DP8(r, 0x5Eu) + 1u);
    }
    r->a = r->d;
    uint8_t base = LONG8(SOE_DPPTR(r, 0x5Du));
    r->p &= (uint8_t)~SOE_C;
    uint8_t dur = soe_adc8(r, base, IO8(0x4217u));
    ABSI8(r, 0x0005u, r->y) = dur;
    r->p &= (uint8_t)~SOE_M;
    uint16_t pc = (uint16_t)(DP16(r, 0x5Du) + 1u);
    r->a = pc;
    DP16(r, 0x5Du) = pc;
    ABSI16(r, 0x0000u, r->y) = pc;
    soe_nz16(r, pc);
    r->p |= (SOE_M | SOE_C);
}
