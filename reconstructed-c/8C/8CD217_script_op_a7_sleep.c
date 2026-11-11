/*
 * $8C:D217 script_op_a7_sleep (knowledge/routines/script_op_a7_sleep.md), RTS.
 *
 * Reads an 8-bit sleep duration from [$82] and schedules the current thread ($7E) to wake
 * at frame_counter + (duration - 1), returning C=0 to yield or C=1 if duration == 0.
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   script_op_a7_sleep ($8CD217) [RTS]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  20 instructions (41 bytes)
 * - Compiled C ASM:   230 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   11.5x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      badf90ac5a2758bb
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"
#include "soe_ram.h"

SOE_BIND(script_op_a7_sleep, 0x8CD217, RTS)
{
    uint32_t pc = SOE_DPPTR(r, 0x82);
    uint16_t dur = (uint16_t)(LONG16(pc) & 0x00FFu);
    uint16_t y;
    uint16_t wake_lo, wake_hi;

    DP16(r, 0x82) = (uint16_t)(DP16(r, 0x82) + 1u);
    r->y = dur;
    if (dur == 0) {
        r->a = 0;
        soe_nz16(r, 0);
        r->p |= SOE_C;
        return;
    }

    y = DP16(r, 0x7E);
    r->y = y;
    soe_carry(r, false);
    wake_lo = soe_adc16(r, (uint16_t)(dur - 1u), ABS16(r, WAVE_PHASE_COUNTER_ADDR));
    ABSI16(r, 0x0005, y) = wake_lo;
    wake_hi = soe_adc16(r, ABS16(r, CONTROLLER_PREV_INPUT_ADDR), 0x0000u);
    ABSI16(r, 0x0007, y) = wake_hi;
    ABSI16(r, 0x0003, y) = 0x0004u;

    r->a = 0x0004u;
    soe_nz16(r, 0x0004u);
    r->p &= (uint8_t)~SOE_C;
}

