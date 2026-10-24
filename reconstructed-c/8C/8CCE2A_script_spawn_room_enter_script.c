/*
 * $8C:CE2A script_spawn_room_enter_script, RTL.
 *
 * Spawns the enter script for the active room:
 * Reads the 24-bit packed script pointer from the room header at $92:800C into DP $26-$28,
 * calls script_allocate_slot ($8C:CF18) to allocate and initialize a thread slot,
 * adds the slot to the active thread run list at $7E:2F28 (terminating with 0 at $7E:2F2A),
 * and sets DP $86 to 2.
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   script_spawn_room_enter_script ($8CCE2A) [RTL]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  15 instructions (35 bytes)
 * - Compiled C ASM:   84 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   5.6x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      53d585aae5c55e92
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"

SOE_BIND(script_spawn_room_enter_script, 0x8CCE2A, RTL)
{
    /* Load 24-bit packed enter script pointer from room header at $92:800C into DP $26-$28 */
    DP16(r, 0x26) = ROM16(0x92800CUL);
    DP16(r, 0x27) = ROM16(0x92800DUL);

    /* Allocate script slot */
    soe_call_rtl(0x8CCF18UL, r);

    /* Queue allocated slot into thread run list */
    RAM16(0x2F28) = r->x;
    RAM16(0x2F2A) = 0;

    /* Set active script state flag */
    DP16(r, 0x86) = 0x0002;
    r->a = 0x0002;

    /* PLB exit flags */
    soe_nz8(r, r->db);
}
