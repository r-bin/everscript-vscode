/*
 * $8F:DF14 sound_or_event_queue_init (knowledge/routines/sound_or_event_queue_init.md), RTL, 16-bit A, X, Y.
 *
 * Initializes the 60-entry event / sound dispatch ring buffer in WRAM:
 * 1. Sets active flag $7E:2433 = 1 and timer $7E:2431 = 600 ($0258).
 * 2. Clears pointers $6183 and $6185.
 * 3. Sets queue head and tail pointers $0EBE and $0EC0 = $5DC3.
 * 4. Iterates 60 slots starting at $5DC3 (16-byte stride), clearing slot offset +$0C,X.
 * Leaves A = X = $6183, Y = 0, N=0, Z=1, C=0.
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   sound_or_event_queue_init ($8FDF14) [RTL]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  18 instructions (45 bytes)
 * - Compiled C ASM:   215 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   11.9x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      699aadae425ba2f1
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"
#include "soe_ram.h"

SOE_BIND(sound_or_event_queue_init, 0x8FDF14, RTL)
{
    uint16_t a;
    uint16_t x;
    uint16_t y;

    SOE_AT(0xDF14);
    a = 0x0001;
    r->a = a;
    soe_nz16(r, a);

    SOE_AT(0xDF17);
    RAM16(0x2433) = a;

    SOE_AT(0xDF1B);
    a = 0x0258;
    r->a = a;
    soe_nz16(r, a);

    SOE_AT(0xDF1E);
    RAM16(0x2431) = a;

    SOE_AT(0xDF22);
    ABS16(r, 0x6183) = 0;

    SOE_AT(0xDF25);
    ABS16(r, 0x6185) = 0;

    SOE_AT(0xDF28);
    x = 0x5DC3;
    r->x = x;
    soe_nz16(r, x);

    SOE_AT(0xDF2B);
    ABS16(r, 0x0EBE) = x;

    SOE_AT(0xDF2E);
    ABS16(r, 0x0EC0) = x;

    SOE_AT(0xDF31);
    y = 0x003C;
    r->y = y;
    soe_nz16(r, y);

    SOE_AT(0xDF34);
    a = x;
    r->a = a;
    soe_nz16(r, a);

    do {
        SOE_AT(0xDF35);
        ABS16(r, (uint16_t)(x + 0x000C)) = 0;

        SOE_AT(0xDF38);
        soe_carry(r, false);

        SOE_AT(0xDF39);
        a = soe_adc16(r, a, 0x0010);
        r->a = a;

        SOE_AT(0xDF3C);
        x = a;
        r->x = x;
        soe_nz16(r, x);

        SOE_AT(0xDF3D);
        y--;
        r->y = y;
        soe_nz16(r, y);
    } while (y != 0);
}

