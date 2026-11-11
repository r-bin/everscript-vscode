/*
 * $80:8860 vram_dma_stream_rectangular_tile_matrix (knowledge/routines/vram_dma_stream_rectangular_tile_matrix.md), RTL, 16-bit A, X, Y.
 *
 * Streams Y rows of X words per row from source [DP $26..$28] to VRAM address DP $2E (stride $0020)
 * using DMA channel 0.
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   vram_dma_stream_rectangular_tile_matrix ($808860) [RTL]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  33 instructions (67 bytes)
 * - Compiled C ASM:   277 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   8.4x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      f5ad42a7045c8d69
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"
#include "soe_ram.h"

SOE_BIND(vram_dma_stream_rectangular_tile_matrix, 0x808860, RTL)
{
    SOE_AT(0x8860);
    r->a = (uint16_t)(r->x << 1);
    r->x = (uint16_t)(r->a & 0x00FF);
    r->y &= 0x00FF;
    ABS8(r, 0x4304) = DP8(r, 0x28);
    ABS8(r, 0x4300) = 0x01;
    ABS8(r, 0x2115) = 0x80;
    ABS8(r, 0x4301) = 0x18;
    r->p &= ~(SOE_M | SOE_X);
    do {
        SOE_AT(0x887B);
        ABS16(r, 0x4305) = r->x;
        r->a = DP16(r, 0x2E);
        ABS16(r, 0x2116) = r->a;
        r->a = DP16(r, 0x26);
        ABS16(r, 0x4302) = r->a;
        ABS8(r, 0x420B) = 0x01;
        r->p &= ~SOE_C;
        r->a = soe_adc16(r, r->x, DP16(r, 0x26));
        DP16(r, 0x26) = r->a;
        r->p &= ~SOE_C;
        r->a = soe_adc16(r, 0x0020, DP16(r, 0x2E));
        DP16(r, 0x2E) = r->a;
        r->y = (uint16_t)(r->y - 1);
        soe_nz16(r, r->y);
    } while (r->y != 0);
}
