/*
 * $8D:C905 sram_verify_all_save_slots (knowledge/routines/sram_verify_all_save_slots.md), RTL, 16-bit A, X, Y.
 *
 * Verifies the checksum of all 4 SRAM save slots ($30:6002, stride $0331) via $8D:B478 and records
 * the bitmask of valid slots in $0B39 and A.
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   sram_verify_all_save_slots ($8DC905) [RTL]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  32 instructions (78 bytes)
 * - Compiled C ASM:   305 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   9.5x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      bbde2ed933463e50
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"
#include "soe_ram.h"

void sram_compute_checksum_bind(soe_regs r);

SOE_BIND(sram_verify_all_save_slots, 0x8DC905, RTL)
{
    uint8_t entry_db = r->db;

    SOE_AT(0xC905);
    ABS16(r, SAVE_MENU_SRAM_PTR_ADDR) = 0x6002;
    ABS16(r, VALID_SAVE_SLOTS_MASK_ADDR) = 0;
    ABS16(r, SAVE_MENU_SLOT_BITMASK_ADDR) = 0x0001;
    for (;;) {
        SOE_AT(0xC914);
        r->x = (uint16_t)(ABS16(r, SAVE_MENU_SRAM_PTR_ADDR) + 2);
        r->y = 0x032F;
        r->db = 0x30;
        sram_compute_checksum_bind(r);
        r->db = entry_db;
        r->x = ABS16(r, SAVE_MENU_SRAM_PTR_ADDR);
        soe_cmp16(r, r->a, LONG16(0x300000UL + r->x));
        if (r->p & SOE_Z) {
            SOE_AT(0xC930);
            uint16_t mask = ABS16(r, SAVE_MENU_SLOT_BITMASK_ADDR);
            ABS16(r, VALID_SAVE_SLOTS_MASK_ADDR) |= mask;
        }
        SOE_AT(0xC936);
        uint16_t bit = ABS16(r, SAVE_MENU_SLOT_BITMASK_ADDR);
        r->a = (uint16_t)(bit << 1);
        soe_cmp16(r, r->a, 0x0010);
        if (r->p & SOE_Z) break;
        SOE_AT(0xC93F);
        ABS16(r, SAVE_MENU_SLOT_BITMASK_ADDR) = r->a;
        r->p &= ~SOE_C;
        r->a = soe_adc16(r, ABS16(r, SAVE_MENU_SRAM_PTR_ADDR), 0x0331);
        ABS16(r, SAVE_MENU_SRAM_PTR_ADDR) = r->a;
    }
    SOE_AT(0xC94F);
    r->a = ABS16(r, VALID_SAVE_SLOTS_MASK_ADDR);
    soe_nz16(r, r->a);
}
