/*
 * $8C:DC74 script_op_59_music_fade_out (knowledge/routines/script_op_59_music_fade_out.md), RTS.
 *
 * Handler of script opcode 0x59: fade the music out.
 * Sets DP $9B = $F0 (-16), sets DB = $80, calls audio_music_fade_step ($8C:8619),
 * restores DB = $7E, sets Carry, and returns.
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   script_op_59_music_fade_out ($8CDC74) [RTS]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  10 instructions (19 bytes)
 * - Compiled C ASM:   77 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   7.7x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      3f94d28cfef0daf1
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"

SOE_BIND(script_op_59_music_fade_out, 0x8CDC74, RTS)
{
    r->p |= SOE_M;
    r->a = (uint16_t)((r->a & 0xFF00u) | 0xF0u);
    soe_nz8(r, 0xF0u);
    DP8(r, 0x9B) = 0xF0u;
    r->p &= (uint8_t)~SOE_M;
    r->db = 0x80u;
    soe_nz8(r, 0x80u);
    soe_call_rtl(0x8C8619u, r);
    r->db = 0x7Eu;
    soe_nz8(r, 0x7Eu);
    r->p |= SOE_C;
}
