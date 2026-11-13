/*
 * $8C:CEE9 script_stop_all_threads (knowledge/routines/script_stop_all_threads.md), RTL.
 *
 * Clears bit 0 of $7E:22EE, resets $7E:4EC7 and $7E:4F75 to $4000, clears all script
 * thread state words across $7E:28FC..$7E:2F27 (stride $4F), and resets DP $86 and $7E:2F28.
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   script_stop_all_threads ($8CCEE9) [RTL]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  21 instructions (47 bytes)
 * - Compiled C ASM:   99 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   4.7x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      bdfd50b4ae7979b5
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"
#include "soe_ram.h"

SOE_BIND(script_stop_all_threads, 0x8CCEE9, RTL)
{
    uint16_t x;
    uint8_t saved_db = r->db;

    RAM16(SCRIPT_EXECUTION_LOCK_FLAGS_ADDR) &= 0xFFFEu;
    RAM16(0x4EC7) = 0x4000u;
    RAM16(0x4F75) = 0x4000u;

    {
        uint16_t a = 0x28FCu;
        do {
            x = a;
            RAM16(x + 0x0003u) = 0x0000u;
            a = (uint16_t)(a + 0x004Fu);
        } while (a < 0x2F28u);

        DP16(r, 0x86) = 0x0000u;
        RAM16(0x2F28) = 0x0000u;

        r->a = a;
        r->x = x;
        r->db = saved_db;
        soe_nz8(r, saved_db);
        r->p = (uint8_t)((r->p & (uint8_t)~SOE_V) | SOE_C);
    }
}

