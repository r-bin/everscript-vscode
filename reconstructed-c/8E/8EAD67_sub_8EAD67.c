/*
 * $8E:AD67 sub_8EAD67 (knowledge/routines/sub_8EAD67.md), RTL.
 *
 * Ring menu exit restoration and window closure routine:
 * - Clears submenu state $034B.
 * - Restores stack pointer from $0B1F and pulls previous Y.
 * - Tests and clears bit 15 of $05A9; if set, saves Y to $7E:0090,X (X = $05A7).
 * - Sets DP $02 = $0010, DP $04 = $00E0 and calls $90:D020 and $90:CC69.
 * - Clears camera follow latch $143A.
 * - Closes window $034D via $8C:ADE5.
 * - Tests and clears bit 0 of $05AB; if set, closes window $03DD via $8C:ADE5.
 * - Clears bit 14 of $0F84.
 * - Clears $0BFB, $0BFD, $95, and $05AB.
 */
#include "soe.h"
#include "soe_ram.h"

SOE_BIND(sub_8EAD67, 0x8EAD67, RTL)
{
    RAM16(0x034B) = 0;

    r->y = RAM16(0x0B1F);

    if (RAM16(0x05A9) & 0x8000u) {
        RAM16(0x05A9) &= ~0x8000u;
        uint16_t x = RAM16(0x05A7);
        RAM16(0x0090 + x) = r->y;
    }

    DP16(r, 0x02) = 0x0010u;
    DP16(r, 0x04) = 0x00E0u;
    soe_call_rtl(0x90D020, r);
    soe_call_rtl(0x90CC69, r);

    RAM16(0x143A) = 0;

    r->y = 0x034Du;
    soe_call_rtl(0x8CADE5, r);

    if (RAM16(0x05AB) & 0x0001u) {
        RAM16(0x05AB) &= ~0x0001u;
        r->y = 0x03DDu;
        soe_call_rtl(0x8CADE5, r);
    }

    RAM16(0x0F84) &= ~0x4000u;
    RAM16(0x0BFB) = 0;
    RAM16(0x0BFD) = 0;
    DP16(r, 0x95) = 0;
    RAM16(0x05AB) = 0;

    r->a = 0;
    soe_nz16(r, 0);
}

