/**
 * Routine: $8F:B094 (projectile_spawn_master)
 * Bank: $8F (ROM Offset: $0FB094)
 * Calling convention: RTL
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   projectile_spawn_master ($8FB094) [RTL]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  8 instructions (16 bytes)
 * - Compiled C ASM:   53 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   6.6x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      dc609e3cf929bbfc
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"

SOE_BIND(projectile_spawn_master, 0x8FB094, RTL);

void projectile_spawn_master_bind(soe_regs r) {
    uint8_t saved_db = r->db;
    r->db = 0x7Eu;
    soe_nz8(r, 0x7Eu);
    soe_call_rtl(0x8FB2BEu, r);
    soe_call_rtl(0x8FB0A4u, r);
    r->db = saved_db;
    soe_nz8(r, saved_db);
}
