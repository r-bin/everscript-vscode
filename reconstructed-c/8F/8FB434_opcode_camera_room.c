/**
 * Routine: $8F:B434 (spawn_characters_and_position_camera)
 * Bank: $8F (ROM Offset: $0FB434)
 * Calling convention: RTL
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   spawn_characters_and_position_camera ($8FB434) [RTL]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  16 instructions (36 bytes)
 * - Compiled C ASM:   143 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   8.9x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      88d27f0f680dca06
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"

SOE_BIND(spawn_characters_and_position_camera, 0x8FB434, RTL);

void spawn_characters_and_position_camera_bind(soe_regs r) {
    uint8_t saved_db = r->db;
    r->db = 0x7Eu;
    r->x = DP16(r, 0x46u);
    r->y = DP16(r, 0x48u);
    soe_call_rtl(0x909815u, r);
    soe_call_rtl(0x8FA93Bu, r);
    uint16_t boy = ABS16(r, 0x0F3Eu);
    r->y = boy;
    if (boy != 0u) {
        soe_call_rts(0x8FB458u, r);
    }
    uint16_t dog = ABS16(r, 0x0F40u);
    r->y = dog;
    if (dog != 0u) {
        soe_call_rts(0x8FB458u, r);
    }
    r->db = saved_db;
    soe_nz8(r, saved_db);
}
