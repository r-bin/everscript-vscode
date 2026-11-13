/*
 * Routine: animation_script_inc_duration_if_above_e96 ($90:86D4)
 * Compare animation record field $001E,Y against $0E96; if >=, copy Y to X
 * and increment the duration word at $0005,X before restoring M=8.
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   animation_script_inc_duration_if_above_e96 ($9086D4) [RTS]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  8 instructions (17 bytes)
 * - Compiled C ASM:   190 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   23.8x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      87fa2e1d48617e5e
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"
#include "soe_ram.h"

SOE_BIND(animation_script_inc_duration_if_above_e96, 0x9086D4, RTS) {
    uint16_t val;

    /* REP #$30 */
    r->p &= (uint8_t)~(SOE_M | SOE_X);

    val = ABSI16(r, 0x001Eu, r->y);
    soe_cmp16(r, val, ABS16(r, ENTITY_SCHEDULER_INTERVAL_TIMER_ADDR));
    if ((r->p & SOE_C) != 0u) {
        uint16_t dur;
        r->x = r->y;
        dur = (uint16_t)(ABSI16(r, 0x0005u, r->x) + 1u);
        ABSI16(r, 0x0005u, r->x) = dur;
        soe_nz16(r, dur);
    }

    r->a = val;
    /* SEP #$20 */
    r->p |= SOE_M;
}

