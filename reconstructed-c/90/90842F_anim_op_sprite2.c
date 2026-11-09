/*
 * $90:842F anim_op_sprite2 (knowledge/routines/anim_op_sprite2.md), RTS, 8-bit A on entry and exit.
 *
 * Animation command 2C: loads secondary sprite descriptor (shadow/sub-sprite)
 * 24-bit address from script stream [<$5D].
 * Stores bank byte to +$09,Y and 16-bit offset word to +$0A,Y.
 * Advances script pointer $5D by 3 bytes.
 * Leaves A = 16-bit sprite offset (high byte in B), X = new pointer, N Z from INX, M=1.
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   anim_op_sprite2 ($90842F) [RTS]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  13 instructions (24 bytes)
 * - Compiled C ASM:   186 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   14.3x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      6a84d92479d16dde
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"
#include "soe_ram.h"

SOE_BIND(anim_op_sprite2, 0x90842F, RTS)
{
    uint8_t bank;
    uint16_t word, x;

    SOE_AT(0x842F);
    bank = LONG8(SOE_DPPTR(r, 0x5D));
    ABSI8(r, 0x09, r->y) = bank;

    SOE_AT(0x8434);
    x = (uint16_t)(DP16(r, 0x5D) + 1);
    DP16(r, 0x5D) = x;
    word = LONG16(SOE_DPPTR(r, 0x5D));
    ABSI16(r, 0x0A, r->y) = word;

    SOE_AT(0x8440);
    x = (uint16_t)(x + 2);
    DP16(r, 0x5D) = x;
    r->a = word;
    r->x = x;
    soe_nz16(r, x);
    r->p |= SOE_M;
}
