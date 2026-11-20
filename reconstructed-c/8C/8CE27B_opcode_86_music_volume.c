/*
 * $8C:E27B script_op_86_music_volume (knowledge/routines/script_op_86_music_volume.md), RTS.
 *
 * Handler of script opcode 0x86: set the music volume.
 * Evaluates inline script expression via $8C:EA43, clamps to 8-bit,
 * writes 16-bit word to DP $9A (volume $9A, clears fade step $9B),
 * sets DB = $80, sends APU command 0x0028 via $8C:81FD,
 * restores caller DB, sets Carry, and returns.
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   script_op_86_music_volume ($8CE27B) [RTS]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  13 instructions (26 bytes)
 * - Compiled C ASM:   96 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   7.4x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      589c9ea48c6a2d8e
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"

SOE_BIND(script_op_86_music_volume, 0x8CE27B, RTS)
{
    soe_call_rtl(0x8CEA43u, r);
    r->a &= 0x00FFu;
    soe_nz16(r, r->a);
    DP16(r, 0x9A) = r->a;
    uint8_t old_db = r->db;
    r->db = 0x80u;
    soe_nz8(r, 0x80u);
    r->y = r->a;
    soe_nz16(r, r->y);
    r->a = 0x0028u;
    soe_nz16(r, 0x0028u);
    soe_call_rtl(0x8C81FDu, r);
    r->db = old_db;
    soe_nz8(r, old_db);
    r->p |= SOE_C;
}
