/*
 * $8C:CF18 script_allocate_slot (knowledge/rom/8ccf18.md), RTL.
 *
 * Takes a free script slot starting from $7E:28FC (stride 0x4F bytes, free when word at +3 is 0).
 * Decodes the packed script pointer in DP $26-$28 into a 24-bit bus address:
 *   bank    = $92 + (packed >> 15)
 *   address = $8000 | (packed & $7FFF)
 * Sets slot state to 2 (RUNNING), zeroes wait/link fields, transfers 10 argument words from
 * $7E:0E80..$7E:0E92 into slot +$0F..+$21 (clearing the source), and zeroes 22 local words at
 * +$23..+$4D. Returns the allocated slot pointer in X.
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   script_allocate_slot ($8CCF18) [RTL]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  85 instructions (220 bytes)
 * - Compiled C ASM:   368 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   4.3x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      4fe579aeb800885d
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"

SOE_BIND(script_allocate_slot, 0x8CCF18, RTL)
{
    uint16_t p_low = DP16(r, 0x26);
    uint8_t p_high = DP8(r, 0x28);
    uint8_t rol = (uint8_t)((p_high << 1) | ((p_low & 0x8000) ? 1 : 0));
    uint8_t bank;
    uint16_t addr = (uint16_t)(0x8000 | (p_low & 0x7FFF));
    uint16_t x = 0x28FC;
    uint16_t i;

    soe_carry(r, (p_high & 0x80) != 0);
    bank = soe_adc8(r, rol, 0x92);

    while (RAM16(x + 3) != 0) {
        x = (uint16_t)(x + 0x4F);
    }

    RAM16(x + 0) = addr;
    RAM8(x + 2) = bank;
    RAM16(x + 3) = 0x0002;
    RAM16(x + 5) = 0;
    RAM16(x + 9) = 0;
    RAM16(x + 0x0B) = 0;
    RAM16(x + 0x0D) = 0;

    for (i = 0; i < 10; i++) {
        uint16_t off = (uint16_t)(i << 1);
        RAM16(x + 0x0F + off) = RAM16(0x0E80 + off);
        RAM16(0x0E80 + off) = 0;
    }

    for (i = 0; i < 22; i++) {
        RAM16(x + 0x23 + (i << 1)) = 0;
    }

    r->a = RAM16(x + 0x21); /* last LDA was $0E92, transferred to slot +$21 */
    r->x = x;
    r->y = (uint16_t)(p_low << 1);
    soe_carry(r, false);
    soe_nz8(r, r->db);
}
