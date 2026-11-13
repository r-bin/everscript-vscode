/**
 * Routine: $8F:9877 (multipart_child_get_or_create_primary)
 * Bank: $8F (ROM Offset: $0F9877)
 * Calling convention: RTL
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   multipart_child_get_or_create_primary ($8F9877) [RTL]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  21 instructions (45 bytes)
 * - Compiled C ASM:   247 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   11.8x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      25ef4004ace90b46
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"

SOE_BIND(multipart_child_get_or_create_primary, 0x8F9877, RTL);

void multipart_child_get_or_create_primary_bind(soe_regs r) {
    r->y = DP16(r, 0x4Cu);
    uint16_t existing = ABSI16(r, 0x006Au, r->y);
    r->x = existing;
    if ((existing & 0x8000u) == 0u) {
        DP16(r, 0x4Eu) = existing;
        r->a = existing;
        soe_nz16(r, existing);
        return;
    }
    uint16_t free_head = ABS16(r, 0x3BC7u);
    r->x = free_head;
    if (free_head & 0x8000u) {
        DP16(r, 0x4Eu) = free_head;
        soe_nz16(r, free_head);
        return;
    }
    ABS16(r, 0x3BC7u) = ABSI16(r, 0x3BC9u, free_head);
    ABSI16(r, 0x3C14u, free_head) = r->y;
    r->a = free_head;
    ABSI16(r, 0x006Au, r->y) = free_head;
    DP16(r, 0x4Eu) = free_head;
    ABSI16(r, 0x3C12u, free_head) = 0u;
    soe_call_rtl(0x8F9937u, r);
    r->x = DP16(r, 0x4Eu);
    soe_nz16(r, r->x);
}
