/**
 * Routine: $8F:B75A (attack_proc_melee_boy_kill_xp)
 * Bank: $8F (ROM Offset: $0FB75A)
 * Calling convention: RTS
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   attack_proc_melee_boy_kill_xp ($8FB75A) [RTS]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  13 instructions (35 bytes)
 * - Compiled C ASM:   140 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   10.8x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      196320f503471523
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"

SOE_BIND(attack_proc_melee_boy_kill_xp, 0x8FB75A, RTS);

void attack_proc_melee_boy_kill_xp_bind(soe_regs r) {
    soe_call_rtl(0x8FBA06u, r);
    if (r->p & SOE_C) {
        soe_call_rtl(0x8FC067u, r);
        soe_call_rtl(0x8FC0D3u, r);
        soe_call_rtl(0x8FC17Fu, r);
        uint16_t hp = ABS16(r, 0x0EA0u);
        r->a = hp;
        soe_nz16(r, hp);
        if (hp != 0u) {
            r->p |= SOE_C;
            uint16_t diff = soe_sbc16(r, hp, ABSI16(r, 0x002Au, r->y));
            r->a = diff;
            if (!(r->p & SOE_N)) {
                soe_call_rtl(0x8F973Eu, r);
            }
        }
    }
    soe_carry(r, true);
}
