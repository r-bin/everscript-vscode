/*
 * $90:817B anim_record_init_from_script_ref (knowledge/routines/anim_record_init_from_script_ref.md), RTL, 16-bit A, X, Y.
 *
 * In: X = animation offset into $C4:0000 table, Y = entity record (DB-relative).
 * 1. Loads word from $C40000,X and stores to rec+3 (restart offset) and rec+0 (script ptr low word).
 * 2. Stores DP register D to rec+$0E (TDC; STA $000E,y).
 * 3. Switches to 8-bit A (SEP #$20).
 * 4. Loads byte from $C40002,X and stores to rec+2 (script ptr bank).
 * 5. Stores 1 to rec+5 (timer).
 * 6. Switches back to 16-bit A (REP #$20).
 * Leaves A = (D & 0xFF00) | 1, N=0, Z=0.
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   anim_record_init_from_script_ref ($90817B) [RTL]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  12 instructions (31 bytes)
 * - Compiled C ASM:   215 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   17.9x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      bb6a8d80883f8870
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"
#include "soe_ram.h"

SOE_BIND(anim_record_init_from_script_ref, 0x90817B, RTL)
{
    uint16_t x = r->x;
    uint16_t y = r->y;
    uint16_t word;
    uint8_t byte;

    SOE_AT(0x817B);
    word = ROM16(0xC40000UL + x);
    r->a = word;
    soe_nz16(r, word);

    SOE_AT(0x817F);
    ABS16(r, (uint16_t)(y + 0x0003)) = word;

    SOE_AT(0x8182);
    ABS16(r, (uint16_t)(y + 0x0000)) = word;

    SOE_AT(0x8185);
    r->a = r->d;
    soe_nz16(r, r->d);

    SOE_AT(0x8186);
    ABS16(r, (uint16_t)(y + 0x000E)) = r->d;

    SOE_AT(0x8189);
    r->p |= SOE_M;

    SOE_AT(0x818B);
    byte = ROM8(0xC40002UL + x);
    soe_set_a8(r, byte);
    soe_nz8(r, byte);

    SOE_AT(0x818F);
    ABS8(r, (uint16_t)(y + 0x0002)) = byte;

    SOE_AT(0x8192);
    soe_set_a8(r, 0x01);
    soe_nz8(r, 0x01);

    SOE_AT(0x8194);
    ABS8(r, (uint16_t)(y + 0x0005)) = 0x01;

    SOE_AT(0x8197);
    r->p &= ~SOE_M;
}

