// The code a grown ingredients kind jumps into (ingredients.mts): one entry per kind of count access the game makes,
// each keeping vanilla's `$22FF + id` for ids below 22 and reading or writing the id's own WRAM word above. Hand
// assembled (implode writes bytes itself, no assembler); run on the 65816 interpreter by
// tests/open-evermore/ingredient-hooks.test.mts. Every entry is called by `jsl` with X 16 bits and returns by `rtl`
// with A, X, Y, D and DB as vanilla's access leaves them (flags aside: no caller reads them).

export const VANILLA_INGREDIENTS = 22;
/** `lda.l $7E22FF,x` and `sta.l $7E22FF,x`: vanilla's access, kept for the vanilla ids. */
export const LDA = [0xBF, 0xFF, 0x22, 0x7E], STA = [0x9F, 0xFF, 0x22, 0x7E];
export const le24 = (v: number) => [v & 0xFF, (v >> 8) & 0xFF, v >> 16];

/**
 * The hooks, assembled at `cells` − 2·22 (the cell table, one WRAM word address per new id, follows the code).
 * Each entry keeps vanilla's access for ids below 22 and reads or writes the id's cell above.
 */
export function hooks(cells: number): { code: number[]; entry: Record<'get16' | 'put16' | 'shopGet' | 'get8' | 'shopPut', number> } {
    const base = le24(cells - 2 * VANILLA_INGREDIENTS), cpx = [0xE0, VANILLA_INGREDIENTS, 0x00];
    const cell = [0xBF, ...base, 0xAA];                              // lda.l cells-44,x : tax
    const get16 = [...cpx, 0xB0, 0x05, ...LDA, 0x6B,                 // vanilla: lda.l $7E22FF,x : rtl
        0xDA, 0x8A, 0x0A, 0xAA, ...cell, 0xBF, 0x00, 0x00, 0x7E, 0xFA, 0x6B];      // phx : txa : asl : tax : cell : lda.l $7E0000,x : plx : rtl
    const put16 = [...cpx, 0xB0, 0x05, ...STA, 0x6B,
        0x48, 0xDA, 0x8A, 0x0A, 0xAA, ...cell, 0xA3, 0x03, 0x9F, 0x00, 0x00, 0x7E, 0xFA, 0x68, 0x6B];   // pha : phx : … : lda 3,s : sta.l : plx : pla
    const shopGet = [0xA6, 0x12, 0xE2, 0x20];                        // ldx $12 : sep #$20, then on into get8
    const get8 = [...cpx, 0xB0, 0x05, ...LDA, 0x6B,                  // A is 8 bits: the index math in 16, A's high byte kept
        0xDA, 0xC2, 0x20, 0x48, 0x8A, 0x0A, 0xAA, ...cell, 0x68, 0xE2, 0x20, 0xBF, 0x00, 0x00, 0x7E, 0xFA, 0x6B];
    const shopPut = [...cpx, 0xB0, 0x07, ...STA, 0xC2, 0x20, 0x6B,   // sta then vanilla's rep #$20
        0xDA, 0xC2, 0x20, 0x48, 0x8A, 0x0A, 0xAA, ...cell, 0x68, 0xE2, 0x20, 0x9F, 0x00, 0x00, 0x7E, 0xFA, 0xC2, 0x20, 0x6B];
    const parts = { get16, put16, shopGet, get8, shopPut };
    const entry = {} as Record<keyof typeof parts, number>;
    let at = 0;
    for (const [k, p] of Object.entries(parts) as [keyof typeof parts, number[]][]) { entry[k] = at; at += p.length; }
    return { code: Object.values(parts).flat(), entry };
}
export const HOOKS_LENGTH = hooks(0x7E0000).code.length;
