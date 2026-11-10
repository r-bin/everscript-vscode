/*
 * $80:8F85 vram_oam_buffer_dma_commit_on_nmi (knowledge/routines/vram_oam_buffer_dma_commit_on_nmi.md), RTL, 16-bit A, X, Y.
 *
 * Flushes dynamic VRAM and OAM tile allocation LRU queues upon V-Blank:
 * 1. Checks frame dirty flag DP $D9. If zero, returns immediately with RTL.
 * 2. Clears DP $D9 = 0.
 * 3. Sets DB = $7E (preserving entry DB).
 * 4. Clears DMA staging pointers: DP $CB, $CD, $CF, $D1 = 0.
 * 5. Switches to 8-bit mode (SEP #$30).
 * 6. Flushes OBJ tile LRU queue: if tail $9726 != $81, unlinks/resets active node.
 * 7. Flushes VRAM tile LRU queue: if tail $AB79 != $61, unlinks/resets active node.
 * 8. Resets queue sentinels: $9726 = $81, $97A8 = $81, $AB79 = $61, $ABDB = $61.
 * 9. Sets active VRAM tile page DP $D8 = $96.
 * 10. Restores 16-bit mode (REP #$30) and entry DB (PLB), returning via RTL.
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   vram_oam_buffer_dma_commit_on_nmi ($808F85) [RTL]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  48 instructions (105 bytes)
 * - Compiled C ASM:   338 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   7.0x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      51a7f185cb90eeb4
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"
#include "soe_ram.h"

SOE_BIND(vram_oam_buffer_dma_commit_on_nmi, 0x808F85, RTL)
{
    SOE_AT(0x8F85);
    uint16_t d9 = DP16(r, 0xD9);
    r->a = d9;
    soe_nz16(r, d9);

    if (d9 == 0) {
        SOE_AT(0x8F89);
        return;
    }

    SOE_AT(0x8F8A);
    DP16(r, 0xD9) = 0;

    uint8_t entry_db = r->db;
    r->db = 0x7E;

    DP16(r, 0xCB) = 0;
    DP16(r, 0xCD) = 0;
    DP16(r, 0xCF) = 0;
    DP16(r, 0xD1) = 0;

    r->p |= (SOE_M | SOE_X);
    r->x &= 0x00FF;
    r->y &= 0x00FF;

    SOE_AT(0x8F9C);
    r->y = RAM8(0x9726);
    soe_cmp8(r, (uint8_t)r->y, 0x81);
    if ((uint8_t)r->y != 0x81) {
        SOE_AT(0x8FA3);
        r->x = RAM8(0x97A7);
        RAM8(0x96A5 + r->x) = (uint8_t)r->y;
        RAM8(0x9727 + r->y) = (uint8_t)r->x;
        r->y = RAM8(0x97A8);
        RAM8(0x96A5 + r->y) = 0x80;
        RAM8(0x97A7) = (uint8_t)r->y;
    }

    SOE_AT(0x8FB9);
    r->y = RAM8(0xAB79);
    soe_cmp8(r, (uint8_t)r->y, 0x61);
    if ((uint8_t)r->y != 0x61) {
        SOE_AT(0x8FC0);
        r->x = RAM8(0xABDA);
        RAM8(0xAB18 + r->x) = (uint8_t)r->y;
        RAM8(0xAB7A + r->y) = (uint8_t)r->x;
        r->y = RAM8(0xABDB);
        RAM8(0xAB18 + r->y) = 0x60;
        RAM8(0xABDA) = (uint8_t)r->y;
    }

    SOE_AT(0x8FD6);
    RAM8(0x9726) = 0x81;
    RAM8(0x97A8) = 0x81;
    RAM8(0xAB79) = 0x61;
    RAM8(0xABDB) = 0x61;
    DP8(r, 0xD8) = 0x96;

    r->a = (uint16_t)((r->a & 0xFF00) | 0x0096);
    r->p &= ~(SOE_M | SOE_X);

    r->db = entry_db;
    soe_nz8(r, entry_db);
}
