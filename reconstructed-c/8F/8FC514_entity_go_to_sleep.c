/*
 * $8F:C514 entity_go_to_sleep (knowledge/routines/entity_go_to_sleep.md), RTS, 16-bit A, X, Y.
 *
 * Put an active entity to sleep:
 * 1. Decrements awake count $1070, increments asleep count $1072.
 * 2. Frees attached segment table at +$86 if non-zero.
 * 3. If navigation/waypoint index at +$6A >= 0, releases it via $8F:9916 and saves return ($FFFF).
 * 4. Clears velocity, motion, and impulse words +$78, +$16, +$1E, +$20.
 * 5. Flips status bits +$10: $0100 (awake) -> $0200 (asleep) via EOR #$0300.
 * 6. Moves entity slot from awake list ($3D81) to asleep list ($3D83) via $8F:B29B.
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   entity_go_to_sleep ($8FC514) [RTS]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  24 instructions (64 bytes)
 * - Compiled C ASM:   394 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   16.4x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      b61b2fdbb93749c7
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"

SOE_BIND(entity_go_to_sleep, 0x8FC514, RTS)
{
    uint16_t a;

    SOE_AT(0xC514);
    RAM16(0x1070) = (uint16_t)(RAM16(0x1070) - 1);
    RAM16(0x1072) = (uint16_t)(RAM16(0x1072) + 1);

    SOE_AT(0xC51A);
    r->y = DP16(r, 0x4C);
    soe_nz16(r, r->y);

    SOE_AT(0xC51C);
    r->x = ABSI16(r, 0x0086, r->y);
    soe_nz16(r, r->x);
    if (r->x != 0) {
        SOE_AT(0xC521);
        r->a = 0;
        soe_nz16(r, 0);
        RAM16(r->x) = 0;
        ABSI16(r, 0x0086, r->y) = 0;
    }

    SOE_AT(0xC528);
    r->x = ABSI16(r, 0x006A, r->y);
    soe_nz16(r, r->x);
    if (!(r->p & SOE_N)) {
        SOE_AT(0xC52D);
        soe_call_rtl(0x8F9916UL, r);
        ABSI16(r, 0x006A, r->y) = r->a;
    }

    SOE_AT(0xC534);
    r->a = 0;
    soe_nz16(r, 0);
    ABSI16(r, 0x0078, r->y) = 0;
    ABSI16(r, 0x0016, r->y) = 0;
    ABSI16(r, 0x001E, r->y) = 0;
    ABSI16(r, 0x0020, r->y) = 0;

    SOE_AT(0xC541);
    a = (uint16_t)(ABSI16(r, 0x0010, r->y) ^ 0x0300);
    ABSI16(r, 0x0010, r->y) = a;
    r->a = a;
    soe_nz16(r, a);

    SOE_AT(0xC54A);
    r->x = 0x3D81;
    r->y = 0x3D83;
    soe_call_rts(0x8FB29BUL, r);
}

