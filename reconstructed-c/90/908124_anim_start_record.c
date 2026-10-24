/*
 * $90:8124 anim_start_record (knowledge/rom/908124.md), RTL, 16-bit A and X.
 *
 * In: X = an animation's offset into the $C4 animation table, Y = an entity record (DB-relative).
 * An entry ($C4:0000+X) is a word and a byte. Bit 15 of the word after it ($C4:0002+X) asks for
 * two record steps (X += 2 * rec[$22]), bit 14 for one from the table at $90:815B indexed by
 * rec[$22]. If the record already plays this animation (word at rec+3, byte at rec+2) nothing
 * changes; else the record restarts it: rec+3 = rec+0 = word, rec+$0E = D, rec+2 = byte, rec+5 = 1.
 * Leaves X = the final entry offset, A and N V Z C as the asm does (see the paths below).
 */
#include "soe.h"

#define ANIM_TABLE 0xC40000UL
#define FACING_STEP 0x90815BUL

SOE_BIND(anim_start_record, 0x908124, RTL)
{
    uint16_t x = r->x, y = r->y;
    uint16_t a = ROM16(ANIM_TABLE + 2 + x);
    uint16_t word;
    uint8_t byte;

    if (a & 0x8000) {                                        /* $8150 */
        uint16_t step = ABSI16(r, 0x0022, y);
        soe_carry(r, false);
        a = soe_adc16(r, x, step);
        a = soe_adc16(r, a, step);
        x = a;
    } else if (a & 0x4000) {                                 /* $812F */
        uint16_t i = ABSI16(r, 0x0022, y);
        soe_carry(r, false);
        x = soe_adc16(r, x, ROM16(FACING_STEP + i));
    }
    /* $8139 */
    r->x = x;
    word = ROM16(ANIM_TABLE + x);
    soe_cmp16(r, word, ABSI16(r, 0x0003, y));
    if (r->p & SOE_Z) {
        byte = ROM8(ANIM_TABLE + 2 + x);
        soe_cmp8(r, byte, ABSI8(r, 0x0002, y));
        if (r->p & SOE_Z) {
            r->a = (uint16_t)((word & 0xFF00) | byte);       /* LDA in 8-bit keeps the word's high byte */
            return;
        }
    }
    /* $817B / $817F: restart */
    ABSI16(r, 0x0003, y) = word;
    ABSI16(r, 0x0000, y) = word;
    ABSI16(r, 0x000E, y) = r->d;                             /* TDC */
    ABSI8(r, 0x0002, y) = ROM8(ANIM_TABLE + 2 + x);
    ABSI8(r, 0x0005, y) = 1;
    r->a = (uint16_t)((r->d & 0xFF00) | 0x01);
    soe_nz8(r, 0x01);
}
