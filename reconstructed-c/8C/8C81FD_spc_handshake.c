/*
 * Routine: $8C:81FD (apu_command_handshake)
 * Bank: $8C (ROM Offset: $0C81FD)
 * Calling convention: RTL
 *
 * Atomic APU command transfer handshake across $2140-$2143.
 * Disables interrupts, spin-waits for SPC700 acknowledge in $2142,
 * advances sequence counter in DP $9F, writes payload to $2140 and
 * command+seq to $2142, restores context and returns.
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   apu_command_handshake ($8C81FD) [RTL]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  29 instructions (57 bytes)
 * - Compiled C ASM:   283 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   9.8x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      9ab557c434bdcb67
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"

SOE_BIND(apu_command_handshake, 0x8C81FD, RTL)
{
    uint8_t saved_p = r->p;
    uint16_t saved_x = r->x;
    uint16_t saved_0e65 = ABS16(r, 0x0E65);

    ABS8(r, 0x0E65) = 0;
    ABS8(r, 0x0E51) = (uint8_t)(ABS8(r, 0x0E51) + 1u);

    uint16_t a16 = (uint16_t)((r->a >> 8) | (r->a << 8));
    uint16_t x = 0x2800u;
    uint8_t a = DP8(r, 0x9F);

    while (1) {
        if (a == ABS8(r, 0x2142)) {
            break;
        }
        x--;
        if (x == 0) {
            a = ABS8(r, 0x2142);
            break;
        }
    }

    do {
        a++;
    } while (a == 0);
    DP8(r, 0x9F) = a;

    r->a = (uint16_t)((a16 & 0xFF00u) | a);
    ABS16(r, 0x2140) = r->y;
    ABS16(r, 0x2142) = r->a;
    ABS16(r, 0x0E51) = (uint16_t)(ABS16(r, 0x0E51) - 1u);
    ABS16(r, 0x0E65) = saved_0e65;

    r->x = saved_x;
    r->p = saved_p;
}
