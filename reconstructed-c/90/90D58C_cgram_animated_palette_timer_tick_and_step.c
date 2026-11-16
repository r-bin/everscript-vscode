/*
 * $90:D58C cgram_animated_palette_timer_tick_and_step (knowledge/routines/cgram_animated_palette_timer_tick_and_step.md), RTS.
 *
 * Ticks one palette-color cycle in slot X and rotates its colors in CGRAM:
 * - Decrements 8-bit timer at $13F2,X. If non-zero, returns immediately.
 * - At zero: reloads timer with |rate| ($13D2,X, signed 8-bit).
 * - Rotates color span partition between $1392,X and $13B2,X.
 * - Enqueues up to two palette transfers from CGRAM mirror $7E:6187 via $80:85FA.
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   cgram_animated_palette_timer_tick_and_step ($90D58C) [RTS]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  63 instructions (145 bytes)
 * - Compiled C ASM:   700 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   11.1x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      ad12c48c0a754dde
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"
#include "soe_ram.h"

void cgram_palette_dma_enqueue_or_immediate_bind(soe_regs r);

SOE_BIND(cgram_animated_palette_timer_tick_and_step, 0x90D58C, RTS)
{
    uint16_t x = r->x;

    uint8_t timer = (uint8_t)(ABS8(r, 0x13F2u + x) - 1u);
    ABS8(r, 0x13F2u + x) = timer;
    if (timer != 0u) {
        r->p &= (uint8_t)~(SOE_M | SOE_X);
        soe_nz8(r, timer);
        return;
    }

    int8_t rate = (int8_t)ABS8(r, 0x13D2u + x);
    if (rate >= 0) {
        ABS8(r, 0x13F2u + x) = (uint8_t)rate;
        uint8_t o = (uint8_t)(ABS8(r, 0x1392u + x) + 1u);
        ABS8(r, 0x1392u + x) = o;
        uint8_t rem = (uint8_t)(ABS8(r, 0x13B2u + x) - 1u);
        ABS8(r, 0x13B2u + x) = rem;
        if (rem == 0u) {
            ABS8(r, 0x13B2u + x) = o;
            ABS8(r, 0x1392u + x) = 0u;
        }
    } else {
        uint8_t abs_rate = (uint8_t)(-(int16_t)rate);
        ABS8(r, 0x13F2u + x) = abs_rate;
        uint8_t rem = (uint8_t)(ABS8(r, 0x13B2u + x) + 1u);
        ABS8(r, 0x13B2u + x) = rem;
        uint8_t o = (uint8_t)(ABS8(r, 0x1392u + x) - 1u);
        ABS8(r, 0x1392u + x) = o;
        if (o == 0u) {
            ABS8(r, 0x1392u + x) = rem;
            ABS8(r, 0x13B2u + x) = 0u;
        }
    }

    r->p &= (uint8_t)~(SOE_M | SOE_X);
    DP16(r, 0x28u) = 0x007Eu;

    uint16_t start = (uint16_t)(ABS8(r, 0x1372u + x) & 0x00FFu);
    DP16(r, 0x2Eu) = start;

    uint16_t b2 = (uint16_t)(ABS8(r, 0x13B2u + x) & 0x00FFu);
    DP16(r, 0x26u) = (uint16_t)((uint16_t)(((start + b2) & 0x00FFu) << 1) + 0x6187u);

    uint16_t count1 = (uint16_t)(ABS8(r, 0x1392u + x) & 0x00FFu);
    if (count1 != 0u) {
        r->x = (uint16_t)(count1 << 1);
        r->a = r->x;
        cgram_palette_dma_enqueue_or_immediate_bind(r);
        r->x = x;
    }

    uint16_t o2 = (uint16_t)(ABS8(r, 0x1392u + x) & 0x00FFu);
    DP16(r, 0x2Eu) = (uint16_t)((start + o2) & 0x00FFu);
    DP16(r, 0x26u) = (uint16_t)((uint16_t)(start << 1) + 0x6187u);

    uint16_t count2 = (uint16_t)(ABS8(r, 0x13B2u + x) & 0x00FFu);
    if (count2 != 0u) {
        r->x = (uint16_t)(count2 << 1);
        r->a = r->x;
        cgram_palette_dma_enqueue_or_immediate_bind(r);
        r->x = x;
        soe_nz16(r, x);
    } else {
        r->a = 0u;
        soe_nz16(r, 0u);
    }
}
