/*
 * Routine: $90:88F3 (animation_script_send_apu_command_30)
 * Bank: $90 (ROM Offset: $1088F3)
 * Calling convention: RTS
 *
 * Animation script opcode $8C: send APU command $30.
 * Reads a 16-bit sound effect ID from the script [<$5D],
 * advances the script pointer by 2, and sends it to the APU via
 * apu_command_handshake ($8C:81FD) as command $0030.
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   animation_script_send_apu_command_30 ($9088F3) [RTS]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  25 instructions (46 bytes)
 * - Compiled C ASM:   219 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   8.8x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      69497263670ed271
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"

SOE_BIND(animation_script_send_apu_command_30, 0x9088F3, RTS)
{
    if (r->y >= 0x4FE5u) {
        r->p |= SOE_C;
    } else {
        r->p &= (uint8_t)~SOE_C;
    }

    if (r->y >= 0x3DE5u && r->y < 0x4FE5u) {
        uint8_t flags = ABSI8(r, 0x0014u, r->y);
        r->a = (uint16_t)((r->a & 0xFF00u) | flags);
        soe_nz8(r, flags);
        if (flags & 0x20u) {
            r->p &= (uint8_t)~SOE_Z;
            return;
        }
        r->p |= SOE_Z;
    }

    uint8_t saved_db = r->db;
    r->db = 0x90u;
    uint16_t saved_y = r->y;

    r->p &= (uint8_t)~SOE_M;
    uint16_t sfx = LONG16(SOE_DPPTR(r, 0x5Du));
    if (sfx != 0u) {
        r->y = sfx;
        soe_nz16(r, sfx);
        r->a = 0x0030u;
        soe_nz16(r, 0x0030u);
        soe_call_rtl(0x8C81FDu, r);
    }

    uint16_t pc = (uint16_t)(DP16(r, 0x5Du) + 2u);
    DP16(r, 0x5Du) = pc;
    r->a = pc;
    soe_nz16(r, pc);

    r->y = saved_y;
    r->p |= SOE_M;
    r->db = saved_db;
    soe_nz8(r, saved_db);
}
