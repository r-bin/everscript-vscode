// The code a grown consumables kind jumps into (items.mts): the counts of new consumables in their own WRAM words, and
// the items ring's action dispatch for them. Hand assembled (implode writes bytes itself, no assembler); run on the
// 65816 interpreter by tests/open-evermore/item-hooks.test.mts. Every entry is called by `jsl` with A and X 16 bits.
import * as map from '../map.mts';

/** Consumable ids the game counts at `$2315 + id`: 0-7; 8 is the Pouch (an action, no count: `$231D` is armour's). */
export const VANILLA_CONSUMABLES = 9, POUCH = 8;
/** `lda.l $7E2315,x` and `sta.l $7E2315,x`: vanilla's access, kept for the vanilla ids. */
export const LDA = [0xBF, 0x15, 0x23, 0x7E], STA = [0x9F, 0x15, 0x23, 0x7E];
/** What the dispatch site holds: `tax : jsr ($A873,x)` ($8E:A866, after `asl`), the item_actions table. */
export const DISPATCH = [0xAA, 0xFC, 0x73, 0xA8];
/** The handler every new consumable runs: pick a target and use it ($8E:8CA7, `item_use_on_target`). */
export const USE_HANDLER = map.offset('consumables.use_handler');
const le24 = (v: number) => [v & 0xFF, (v >> 8) & 0xFF, v >> 16];

/**
 * The hooks, assembled at `cells` − 2·9 (the cell table, one WRAM word address per new id, follows the code).
 *   get16     `lda.l $7E2315,x` with X = id: vanilla's for 0-7, 0 for the Pouch (the ring build reads every id), a new
 *             id's word above
 *   put16     `sta.l $7E2315,x`, A and X kept
 *   dispatch  `tax : jsr ($A873,x)` with A = 2·id, called from bank $8E: turns the long return into the short one the
 *             handler's `rts` takes, then enters the handler in bank $8E by `rtl` (vanilla's table below 9, the use
 *             handler above) with X = A = 2·id, as `jsr` would have
 */
export function hooks(cells: number): { code: number[]; entry: Record<'get16' | 'put16' | 'dispatch', number> } {
    const cell = [0xBF, ...le24(cells - 2 * VANILLA_CONSUMABLES), 0xAA];        // lda.l cells-18,x : tax
    const get16 = [0xE0, POUCH, 0x00, 0x90, 0x11, 0xF0, 0x14,                   // cpx #8 : bcc vanilla : beq pouch
        0xDA, 0x8A, 0x0A, 0xAA, ...cell, 0xBF, 0x00, 0x00, 0x7E, 0xFA, 0x6B,    // phx : txa : asl : tax : cell : lda.l $7E0000,x : plx : rtl
        ...LDA, 0x6B,                                                           // vanilla: lda.l $7E2315,x : rtl
        0xA9, 0x00, 0x00, 0x6B];                                                // pouch: lda #0 : rtl
    const put16 = [0xE0, VANILLA_CONSUMABLES, 0x00, 0xB0, 0x05, ...STA, 0x6B,
        0x48, 0xDA, 0x8A, 0x0A, 0xAA, ...cell, 0xA3, 0x03, 0x9F, 0x00, 0x00, 0x7E, 0xFA, 0x68, 0x6B];   // pha : phx : … : lda 3,s : sta.l : plx : pla
    const dispatch = [0xAA,                                                     // tax
        0xA3, 0x01, 0x83, 0x02,                                                 // lda 1,s : sta 2,s (the return word one byte down)
        0xE2, 0x20, 0xA9, 0x8E, 0x83, 0x01, 0xC2, 0x20,                         // sep #$20 : lda #$8E : sta 1,s : rep #$20 (bank $8E below it)
        0xE0, 2 * VANILLA_CONSUMABLES, 0x00, 0xB0, 0x06,                        // cpx #18 : bcs new
        0xBF, 0x73, 0xA8, 0x8E, 0x80, 0x03,                                     // lda.l $8EA873,x : bra go
        0xA9, USE_HANDLER & 0xFF, USE_HANDLER >> 8,                             // new: lda #handler
        0x3A, 0x48, 0x8A, 0x6B];                                                // go: dec : pha : txa : rtl
    const parts = { get16, put16, dispatch };
    const entry = {} as Record<keyof typeof parts, number>;
    let at = 0;
    for (const [k, p] of Object.entries(parts) as [keyof typeof parts, number[]][]) { entry[k] = at; at += p.length; }
    return { code: Object.values(parts).flat(), entry };
}
export const HOOKS_LENGTH = hooks(0x7E0000).code.length;
