/*
 * $8F:A9B1 elevation_dominant_axis_direction (knowledge/routines/elevation_dominant_axis_direction.md), RTL, 8-bit accumulator.
 *
 * One of four cardinal direction codes from dominant axis of dx = DP $12 and dy = DP $13:
 * Computes abs(dx) into DP $14, and abs(dy) in A.
 * Compares abs(dy) >= abs(dx):
 *   If true (vertical dominant or tie): dy < 0 -> $00 (North), else $08 (South).
 *   If false (horizontal dominant): dx < 0 -> $0C (West), else $04 (East).
 * Leaves A low byte = the code, N and Z as LDA #code leaves them, Carry from CMP, 8-bit A.
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   elevation_dominant_axis_direction ($8FA9B1) [RTL]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  23 instructions (40 bytes)
 * - Compiled C ASM:   193 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   8.4x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      a943c43d06fe4b27
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"

SOE_BIND(elevation_dominant_axis_direction, 0x8FA9B1, RTL)
{
    uint8_t dx, dy, abs_dx, abs_dy, code;

    SOE_AT(0xA9B1);
    dx = DP8(r, 0x12);
    if (dx & 0x80) {
        SOE_AT(0xA9B5);
        dx = (uint8_t)((dx - 1) ^ 0xFF);
    }
    SOE_AT(0xA9B8);
    abs_dx = dx;
    DP8(r, 0x14) = abs_dx;

    SOE_AT(0xA9BA);
    dy = DP8(r, 0x13);
    if (dy & 0x80) {
        SOE_AT(0xA9BE);
        dy = (uint8_t)((dy - 1) ^ 0xFF);
    }
    SOE_AT(0xA9C1);
    abs_dy = dy;
    soe_cmp8(r, abs_dy, abs_dx);

    if (abs_dy >= abs_dx) {
        SOE_AT(0xA9CF);
        dy = DP8(r, 0x13);
        if (dy & 0x80) {
            SOE_AT(0xA9D3);
            code = 0x00;
        } else {
            SOE_AT(0xA9D6);
            code = 0x08;
        }
    } else {
        SOE_AT(0xA9C5);
        dx = DP8(r, 0x12);
        if (dx & 0x80) {
            SOE_AT(0xA9C9);
            code = 0x0C;
        } else {
            SOE_AT(0xA9CC);
            code = 0x04;
        }
    }

    soe_set_a8(r, code);
    soe_nz8(r, code);
}

