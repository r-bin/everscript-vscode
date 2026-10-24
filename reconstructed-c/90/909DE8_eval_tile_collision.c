/*
 * $90:9DE8 eval_tile_collision (knowledge/rom/909de8.md), RTL, 16-bit A and X.
 *
 * In: DP $50 = the collision word of a metatile, DP $4C = the moving entity's record, DP $44 = its
 * plane word. Out: A = the geometry code, $0F = solid.
 *  1. Gate bit 8: bits 11..8 pick who may pass: $3 (^$300 = 0) only records below the Boy ($4E89),
 *     $5 only the Dog ($4F37) is blocked, $7 records from the Boy on are blocked; others no gate.
 *  2. Bit 6 set (plane-transparent): the plane bits 5..4 must equal the entity's, else open (A = D).
 *  3. Else the plane must match: d = (word - plane) & $30 == 0. Two exceptions still pass to the
 *     geometry: d = $10 when the word has bit 13, d = $30 when the entity's plane word has bit 6.
 *  4. Geometry: bit 13 set -> the word's low nibble through the table at $90:9E73 (X = nibble * 2),
 *     else the low nibble itself.
 * Flags as the asm leaves them: C and V from the last CMP/SBC on the path (or as entered), N Z
 * from the last load/AND; X changes only on the table path.
 */
#include "soe.h"

#define SOLID 0x000F
#define GEOMETRY_TABLE 0x909E73UL

static void ret_a(soe_regs r, uint16_t a)
{
    r->a = a;
    soe_nz16(r, a);
}

/* $9E2F: the geometry of the word */
static void geometry(soe_regs r, uint16_t word)
{
    uint16_t nibble = word & 0x000F;

    if (word & 0x2000) {
        r->x = (uint16_t)(nibble << 1);       /* ASL A clears C (bit 15 of a nibble), TAX */
        soe_carry(r, false);
        ret_a(r, ROM16(GEOMETRY_TABLE + r->x));
    } else {
        ret_a(r, nibble);
    }
}

SOE_BIND(eval_tile_collision, 0x909DE8, RTL)
{
    uint16_t word = DP16(r, 0x50);
    uint16_t a = word;
    uint16_t plane = DP16(r, 0x44);

    if (word & 0x0100) {
        bool blocked = false, gated = true;
        uint16_t actor = DP16(r, 0x4C);

        if (((a ^= 0x0300) & 0x0F00) == 0) {
            soe_cmp16(r, actor, 0x4E89);
            blocked = !(r->p & SOE_C);        /* BCC: records below the Boy */
        } else if (((a ^= 0x0600) & 0x0F00) == 0) {
            soe_cmp16(r, actor, 0x4F37);
            blocked = (r->p & SOE_Z) != 0;    /* BEQ: the Dog */
        } else if (((a ^= 0x0200) & 0x0F00) == 0) {
            soe_cmp16(r, actor, 0x4E89);
            blocked = (r->p & SOE_C) != 0;    /* BCS: the Boy and later records */
        } else {
            gated = false;                    /* no gate: on to $9E22 with the XORed word */
        }
        if (blocked) { ret_a(r, SOLID); return; }
        if (gated) a = word;                  /* $9E20 LDA $50 */
    }
    /* $9E22 */
    if (a & 0x0040) {
        if (((a ^ plane) & 0x0030) != 0) { ret_a(r, r->d); return; }   /* TDC */
        ret_a(r, word & 0x000F);
        return;
    }
    soe_carry(r, true);
    a = (uint16_t)(soe_sbc16(r, a, plane) & 0x0030);
    if (a == 0) { geometry(r, word); return; }
    /* $9E53: the planes differ */
    if (!(a & 0x0020)) {                      /* difference $10: only with bit 13, through the table ($9E68) */
        if (word & 0x2000) geometry(r, word);
        else ret_a(r, SOLID);
        return;
    }
    if ((a & 0x0010) && (plane & 0x0040)) { geometry(r, word); return; }   /* $30 and entity bit 6 */
    ret_a(r, SOLID);
}
