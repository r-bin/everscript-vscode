/*
 * Routine: $8CAFEB (dialogue_window_arrow_cursor_draw)
 * Bank: $8C
 *
 * Initializes DP parameters ($02=0, $04=0, $06=$0020, $08=$0020) and Mode 7
 * matrix A ($211B = $0FFF), then streams 32 rows from $7F:C800 via DMA Channel 1.
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   dialogue_window_arrow_cursor_draw ($8CAFEB) [RTL]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  47 instructions (100 bytes)
 * - Compiled C ASM:   416 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   8.9x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      ff24cb3220fd2e72
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"

SOE_BIND(dialogue_window_arrow_cursor_draw, 0x8CAFEB, RTL) {
    uint16_t y, mul_in, prod, a_val, x, sz;
    uint32_t sum;
    uint8_t v_flag = 0, c_flag = 0;

    dp_u16(r, 0x02) = 0x0000;
    dp_u16(r, 0x04) = 0x0000;
    dp_u16(r, 0x06) = 0x0020;
    dp_u16(r, 0x08) = 0x0020;

    ABS8(r, 0x211B) = 0xFF;
    ABS8(r, 0x211B) = 0x0F;
    ABS8(r, 0x211C) = 0x01;

    y = dp_u16(r, 0x08);
    mul_in = dp_u16(r, 0x04) | 0x2000u;
    ABS16(r, 0x4202) = mul_in;
    prod = ABS16(r, 0x4216);

    sum = (uint32_t)dp_u16(r, 0x02) + (uint32_t)prod;
    a_val = (uint16_t)sum;
    dp_u16(r, 0x0A) = a_val;

    sum = (uint32_t)(uint16_t)(a_val << 1) + 0xC800u;
    x = (uint16_t)sum;
    a_val = x;

    do {
        ABS16(r, 0x4312) = a_val;
        sz = dp_u16(r, 0x06);
        ABS16(r, 0x4315) = (uint16_t)(sz << 1);
        ABS8(r, 0x4314) = 0x7F;
        ABS8(r, 0x4310) = 0x81;
        ABS8(r, 0x4311) = 0x34;
        ABS8(r, 0x420B) = 0x02;

        sum = (uint32_t)x + 0x0040u;
        a_val = (uint16_t)sum;
        v_flag = ((~(x ^ 0x0040u) & (x ^ a_val) & 0x8000u) != 0) ? 1 : 0;
        c_flag = (sum > 0xFFFFu) ? 1 : 0;
        x = a_val;
        y--;
    } while (y != 0);

    r->a = a_val;
    r->x = x;
    r->y = 0;
    r->p &= ~(SOE_M | SOE_N | SOE_V | SOE_C);
    r->p |= SOE_Z | (v_flag ? SOE_V : 0) | (c_flag ? SOE_C : 0);
}
