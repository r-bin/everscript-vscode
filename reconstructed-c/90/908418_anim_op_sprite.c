/*
 * $90:8418 anim_op_sprite (knowledge/rom/908418.md), RTS, 8-bit A, 16-bit X.
 *
 * In: X = the opcode byte, Y = the entity record (DB-relative), DP $5D = the animation script
 * pointer (24-bit). rec + 8 = (X low byte >> 1) + $A8 + carry (the bit shifted out); rec + 6 = the word
 * at the script pointer, which then steps by 2. Leaves A = that word (16-bit load), X = the new
 * pointer, N Z from the INX, C V from the ADC, an 8-bit accumulator.
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   anim_op_sprite ($908418) [RTS]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  13 instructions (23 bytes)
 * - Compiled C ASM:   178 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   13.7x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      972ec8336ba0a2e4
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"
#include "soe_ram.h"

SOE_BIND(anim_op_sprite, 0x908418, RTS)
{
    uint8_t a8 = (uint8_t)r->x;
    uint16_t word, x;

    soe_carry(r, a8 & 1);                                    /* LSR A */
    a8 = soe_adc8(r, (uint8_t)(a8 >> 1), 0xA8);
    ABSI8(r, ENTITY_RECORD_SPRITE_BANK_OFF, r->y) = a8;
    word = LONG16(SOE_DPPTR(r, 0x5D));
    ABSI16(r, ENTITY_RECORD_SPRITE_OFF, r->y) = word;
    x = (uint16_t)(DP16(r, 0x5D) + 2);
    DP16(r, 0x5D) = x;
    r->a = word;
    r->x = x;
    soe_nz16(r, x);
    r->p |= SOE_M;
}