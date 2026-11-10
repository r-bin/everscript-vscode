/*
 * $80:85FA cgram_palette_dma_enqueue_or_immediate (knowledge/routines/cgram_palette_dma_enqueue_or_immediate.md), RTL, 16-bit X.
 *
 * Transfers or queues a block of palette color data for PPU CGRAM:
 *  - In: DP $26..$28 = 24-bit source pointer, DP $2E = destination CGRAM palette index, X = byte count.
 *  - When the PPU INIDISP shadow ($0106) has bit 7 set (forced blank), executes an immediate DMA channel 1 transfer
 *    to CGDATA ($2122) under the CGRAM lock byte ($0F3C), returning with 16-bit A/X/Y, X = $2200, A low byte = $02,
 *    and N Z from DEC $0F3C.
 *  - When $0106 bit 7 is clear (display active), writes a 7-byte descriptor into the CGRAM DMA queue at $1292,x
 *    (indexed by cursor $128E, wrapping at 224 bytes = 32 slots * 7).
 *    Leaves A = new cursor, X = old cursor, and flags from the cursor advance.
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   cgram_palette_dma_enqueue_or_immediate ($8085FA) [RTL]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  36 instructions (86 bytes)
 * - Compiled C ASM:   545 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   15.1x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      6cfb872462c9a629
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"
#include "soe_ram.h"

SOE_BIND(cgram_palette_dma_enqueue_or_immediate, 0x8085FA, RTL)
{
    uint8_t inidisp;

    SOE_AT(0x85FA);
    r->p |= SOE_M;
    inidisp = ABS8(r, 0x0106);
    soe_nz8(r, inidisp);

    if (inidisp & 0x80) {
        SOE_AT(0x8601);
        ABS8(r, 0x0F3C)++;

        SOE_AT(0x8604);
        soe_set_a8(r, DP8(r, 0x2E));
        ABS8(r, 0x2121) = (uint8_t)r->a;

        SOE_AT(0x8609);
        ABS16(r, 0x4315) = r->x;

        SOE_AT(0x860C);
        r->x = DP16(r, 0x26);
        ABS16(r, 0x4312) = r->x;

        SOE_AT(0x8611);
        soe_set_a8(r, DP8(r, 0x28));
        ABS8(r, 0x4314) = (uint8_t)r->a;

        SOE_AT(0x8616);
        r->x = 0x2200;
        ABS16(r, 0x4310) = r->x;

        SOE_AT(0x861C);
        soe_set_a8(r, 0x02);
        ABS8(r, 0x420B) = 0x02;

        SOE_AT(0x8621);
        uint8_t lock = (uint8_t)(ABS8(r, 0x0F3C) - 1);
        ABS8(r, 0x0F3C) = lock;
        soe_nz8(r, lock);

        SOE_AT(0x8624);
        r->p &= ~(SOE_M | SOE_X);
    } else {
        uint16_t cursor, new_cursor;

        SOE_AT(0x8627);
        DP16(r, 0x12) = r->x;

        SOE_AT(0x8629);
        cursor = ABS16(r, 0x128E);
        r->x = cursor;
        soe_nz16(r, cursor);

        SOE_AT(0x862C);
        soe_set_a8(r, DP8(r, 0x28));
        ABSI8(r, 0x1294, cursor) = (uint8_t)r->a;

        SOE_AT(0x8631);
        r->p &= ~(SOE_M | SOE_X | SOE_C);

        SOE_AT(0x8633);
        r->a = DP16(r, 0x2E);
        ABSI16(r, 0x1295, cursor) = r->a;

        SOE_AT(0x8638);
        r->a = DP16(r, 0x26);
        ABSI16(r, 0x1292, cursor) = r->a;

        SOE_AT(0x863D);
        r->a = DP16(r, 0x12);
        ABSI16(r, 0x1297, cursor) = r->a;

        SOE_AT(0x8642);
        r->a = cursor;
        new_cursor = soe_adc16(r, cursor, 0x0007);
        r->a = new_cursor;
        soe_cmp16(r, new_cursor, 0x00E0);

        if (r->p & SOE_N) {
            SOE_AT(0x864C);
            ABS16(r, 0x128E) = new_cursor;
        } else {
            SOE_AT(0x864B);
            r->a = r->d;
            soe_nz16(r, r->a);
            ABS16(r, 0x128E) = r->a;
        }
    }
}
