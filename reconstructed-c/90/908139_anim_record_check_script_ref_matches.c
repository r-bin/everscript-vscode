/**
 * Routine: $90:8139 (anim_record_check_script_ref_matches)
 * Bank: $90 (ROM Offset: $108139)
 * Calling convention: RTL
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   anim_record_check_script_ref_matches ($908139) [RTL]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  21 instructions (54 bytes)
 * - Compiled C ASM:   199 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   9.5x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      3f117f4138e5c13c
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"

#define ANIM_RECORD_ROM_BASE 0xC40000u

SOE_BIND(anim_record_check_script_ref_matches, 0x908139, RTL);

/**
 * Compares the 24-bit animation script reference at $C4:0000,x against the
 * active script reference on slot DB:Y (+0x03 word, +0x02 bank). If it differs,
 * restarts the slot animation via $90:817B.
 */
void anim_record_check_script_ref_matches_bind(soe_regs r) {
    uint16_t anim_off = ROM16(ANIM_RECORD_ROM_BASE + r->x);
    uint16_t slot_off = ABSI16(r, 0x0003u, r->y);
    r->a = anim_off;
    soe_cmp16(r, anim_off, slot_off);
    if (anim_off != slot_off) {
        soe_call_rtl(0x90817Bu, r);
        return;
    }

    uint8_t anim_bank = ROM8(ANIM_RECORD_ROM_BASE + r->x + 2u);
    uint8_t slot_bank = ABSI8(r, 0x0002u, r->y);
    r->a = (uint16_t)((anim_off & 0xFF00u) | anim_bank);
    soe_cmp8(r, anim_bank, slot_bank);
    r->p &= (uint8_t)~SOE_M;
    if (anim_bank != slot_bank) {
        soe_call_rtl(0x90817Bu, r);
    }
}
