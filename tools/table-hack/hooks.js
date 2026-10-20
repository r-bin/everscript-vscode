// TODO port to TS (docs/todo/port-to-ts.md)
// Hooks: the one place the table hack adds code. A sprite palette is a 16-bit address in bank $90 (character record
// +0x09/+0x0B, docs/entities/character_table.md), and bank $90 has no free space. Two routines read a palette:
//   $90:CF3A  copies its 15 colours to WRAM $7E6289+ with DB = its own bank (`phb : phk : plb : phy`)
//   $90:CFB8  points a CGRAM DMA at it with the bank hard-coded (`lda.w #$0090 : sta $28` at $90:CFD2)
// Every vanilla palette address is >= $8000 (upper half). The hooks read an address below $8000 as "bank $FA", where
// the new palettes live (file 0x3A0100+), and take the original path for everything else.
// The Boy's and Dog's low-HP flash ($8F:9583..) and $90:8A2F also hard-code bank $90; they read the party's own
// palettes, never an enemy's, and are left alone.
'use strict';

const PALETTE_BANK = 0xFA;                 // new palettes: $FA:0100-$7FFF (file 0x3A0100), 32 bytes each
const PALETTE_FIRST = 0x0100;              // a slot holding 0 is empty ($7E1278), so 0 is never a palette
const CODE = 0x3A8000;                     // the hooks, run from $BA:8000 (FastROM mirror)
const BUS = 0xBA8000;

// $BA:8000 replaces `phb : phk : plb : phy` at $90:CF3A, entered by JSL (A = palette address, 16-bit A/X/Y).
// It leaves the stack exactly as those four did ([Y lo][Y hi][old DB] where the return address was) and jumps
// back to $90:CF3E, with DB = $FA for a new palette and $90 for a vanilla one.
const LOADER = [
    0x08,             // php
    0xC2, 0x20,       // rep #$20
    0x48,             // pha                  S+1..2 = A, S+3 = P, S+4..6 = return address
    0x98,             // tya
    0x83, 0x04,       // sta 4,s              return lo/hi := Y
    0xE2, 0x20,       // sep #$20
    0x8B,             // phb
    0x68,             // pla                  A = caller's DB
    0x83, 0x06,       // sta 6,s              return bank := DB
    0xA3, 0x02,       // lda 2,s              palette address, high byte
    0x30, 0x06,       // bmi vanilla
    0xA9, PALETTE_BANK, // lda #$FA
    0x48, 0xAB,       // pha : plb
    0x80, 0x04,       // bra done
    0xA9, 0x90,       // vanilla: lda #$90
    0x48, 0xAB,       // pha : plb
    0xC2, 0x20,       // done: rep #$20
    0x68,             // pla                  A restored
    0x28,             // plp
    0x5C, 0x3E, 0xCF, 0x90, // jml $90CF3E
];
// $BA:8040 replaces `lda.w #$0090 : sta $28` at $90:CFD2 (JSL + NOP). $26 already holds the palette address plus a
// small offset; A and the flags are overwritten right after the original pair.
const UPLOAD_AT = 0x40;
const UPLOAD = [
    0xA5, 0x26,             // lda $26
    0x30, 0x05,             // bmi vanilla
    0xA9, PALETTE_BANK, 0x00, // lda #$00FA
    0x80, 0x03,             // bra store
    0xA9, 0x90, 0x00,       // vanilla: lda #$0090
    0x85, 0x28,             // store: sta $28
    0x6B,                   // rtl
];
const SITES = [
    { at: 0x10CF3A, expect: [0x8B, 0x4B, 0xAB, 0x5A], write: [0x22, BUS & 0xFF, (BUS >> 8) & 0xFF, BUS >> 16] },
    { at: 0x10CFD2, expect: [0xA9, 0x90, 0x00, 0x85, 0x28], write: [0x22, (BUS + UPLOAD_AT) & 0xFF, ((BUS + UPLOAD_AT) >> 8) & 0xFF, BUS >> 16, 0xEA] },
];

/** The 16-bit palette address for new palette `k` (what a character record's +0x09 holds). */
const paletteAddress = k => PALETTE_FIRST + 32 * k;

/** Install the hooks and write `palettes` (32-byte arrays). Returns a move-like summary for reports. */
function spritePalettes(img, palettes = []) {
    for (const s of SITES) {
        if (s.expect.some((b, i) => img[s.at + i] !== b)) throw new Error(`sprite_palettes: ${s.at.toString(16)} is not the vanilla code`);
        img.set(s.write, s.at);
    }
    img.set(LOADER, CODE);
    img.set(UPLOAD, CODE + UPLOAD_AT);
    if (paletteAddress(palettes.length) > 0x8000) throw new Error('sprite_palettes: more than the lower half of $FA holds');
    palettes.forEach((p, k) => {
        if (p.length !== 32) throw new Error('sprite_palettes: a palette is 32 bytes');
        img.set(p, (PALETTE_BANK - 0xC0) * 0x10000 + paletteAddress(k));
    });
    return {
        name: 'sprite_palettes', what: 'new sprite palettes in $FA:0100+ (hook, new code at $BA:8000)',
        count: 0, added: palettes.length, limit: (0x8000 - PALETTE_FIRST) / 32, bytes: palettes.length * 32,
        to: (PALETTE_BANK - 0xC0) * 0x10000 + PALETTE_FIRST, bus: (PALETTE_BANK << 16) | PALETTE_FIRST, wiped: null,
        rewritten: SITES.map(s => `$${s.at.toString(16).toUpperCase()}: ${s.expect.map(b => b.toString(16).padStart(2, '0')).join(' ')} -> ${s.write.map(b => b.toString(16).padStart(2, '0')).join(' ')}`),
        left: [],
    };
}

module.exports = { spritePalettes, paletteAddress, HOOKS: ['sprite_palettes'] };
