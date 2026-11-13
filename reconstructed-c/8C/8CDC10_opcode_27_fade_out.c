/*
 * $8C:DC10 script_op_27_fade_out (knowledge/routines/script_op_27_fade_out.md), RTS.
 *
 * Writes $8000 to AUDIO_TARGET_VOLUME ($0B83) to trigger screen fade-out and returns C=1.
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   script_op_27_fade_out ($8CDC10) [RTS]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  4 instructions (8 bytes)
 * - Compiled C ASM:   41 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   10.3x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      d68d3dae4aa26fe7
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"
#include "soe_ram.h"

SOE_BIND(script_op_27_fade_out, 0x8CDC10, RTS)
{
    ABS16(r, AUDIO_TARGET_VOLUME_ADDR) = 0x8000u;
    r->a = 0x8000u;
    soe_nz16(r, 0x8000u);
    r->p |= SOE_C;
}
