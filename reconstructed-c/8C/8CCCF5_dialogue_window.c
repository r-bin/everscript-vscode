/**
 * Routine: $8C:CCF5 (decode_dialogue_string_key)
 * Bank: $8C (ROM Offset: $0CCCF5)
 * Calling convention: RTL
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   decode_dialogue_string_key ($8CCCF5) [RTL]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  29 instructions (62 bytes)
 * - Compiled C ASM:   209 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   7.2x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      4798fe3757d73da5
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"

SOE_BIND(decode_dialogue_string_key, 0x8CCCF5, RTL);

void decode_dialogue_string_key_bind(soe_regs r) {
    DP16(r, 0x26u) = r->a;
    DP16(r, 0x28u) = 0x0091u;
    r->y = 0xD000u;
    uint16_t low_word = LONG16(SOE_DPPTR(r, 0x26u) + 0xD000u);
    DP16(r, 0x22u) = (uint16_t)(low_word & 0x7FFFu);
    r->y = 0xD001u;
    uint16_t hi_word = LONG16(SOE_DPPTR(r, 0x26u) + 0xD001u);
    uint16_t compressed = (uint16_t)(hi_word & 0x8000u);
    r->p &= (uint8_t)~SOE_C;
    uint16_t bank = soe_adc16(r, (uint16_t)(((uint16_t)(hi_word << 1)) >> 8), 0x00C0u);
    DP16(r, 0x24u) = bank;
    if (compressed == 0u) {
        r->a = bank;
        soe_nz16(r, bank);
        soe_carry(r, false);
        return;
    }
    r->y = 0xD81Eu;
    soe_call_rtl(0x8CCD84u, r);
    DP16(r, 0x22u) = 0xD81Eu;
    r->a = 0x007Fu;
    soe_nz16(r, r->a);
    DP16(r, 0x24u) = r->a;
}
