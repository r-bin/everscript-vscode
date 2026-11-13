/*
 * Routine: room_header_reader_entry_stub ($90:8E80)
 * Prefix-sum A words starting at [$3A] in place: C=0, acc=D, then for i = 0..A-1
 * add acc + [$3A]+2i with CLC and write back to [$3A]+2i.
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   room_header_reader_entry_stub ($908E80) [RTS]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  12 instructions (16 bytes)
 * - Compiled C ASM:   141 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   11.8x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      91aea9d06933f0b8
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"

SOE_BIND(room_header_reader_entry_stub, 0x908E80, RTS) {
    uint16_t x = r->a;
    uint16_t a = r->d;
    uint16_t y = r->d;
    uint32_t base = SOE_DPPTR(r, 0x3Au);

    for (;;) {
        x = (uint16_t)(x - 1u);
        soe_nz16(r, x);
        if ((r->p & SOE_N) != 0u) {
            break;
        }
        soe_carry(r, false);
        {
            uint32_t ea = (base + (uint32_t)y) & 0xFFFFFFu;
            a = soe_adc16(r, a, LONG16(ea));
            LONG16(ea) = a;
        }
        y = (uint16_t)(y + 2u);
    }

    r->a = a;
    r->x = x;
    r->y = y;
}

