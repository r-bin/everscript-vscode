/*
 * Routine: $90:88BC (animation_script_send_panned_sfx_command)
 * Bank: $90 (ROM Offset: $1088BC)
 * Calling convention: RTS
 *
 * Sends a stereo-panned sound effect command to SPC700 from script.
 * Validates entity range $3DE5..$4FE5 and state flags +$14,Y.
 * Reads sound effect index from script pointer [<$5D].
 * If sound index is non-zero, calculates panning parameter from $7E:4EB7,
 * and issues APU command $0030 via apu_command_handshake ($8C:81FD).
 * Advances script pointer <$5D by 2 bytes and returns via RTS.
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   animation_script_send_panned_sfx_command ($9088BC) [RTS]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  29 instructions (55 bytes)
 * - Compiled C ASM:   242 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   8.3x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      cf98a73505cf34f1
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"

SOE_BIND(animation_script_send_panned_sfx_command, 0x9088BC, RTS)
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
        uint16_t pan = LONG16(0x7E4EB7UL);
        if (pan & 0x0002u) {
            r->p |= SOE_C;
        } else {
            r->p &= (uint8_t)~SOE_C;
        }
        pan = (uint16_t)((pan >> 2) ^ 0xFFFFu);
        r->y = pan;
        soe_nz16(r, pan);
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

