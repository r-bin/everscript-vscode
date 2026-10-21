// Ownership: what each cell type does to a character moving into it (docs/terra/README.md §3.6). Pure: read
// from the movement code's own tables in the ROM, then classified by which handler each entry jumps to.
//
// A character's move ($80:D0F9) checks the cell its leading edge enters, on the map at $7E:A000 (always layer 0):
// the cell type ((word >> 9) & $1F, $80:DA28) indexes one 32-entry jump table per direction. Each entry is one
// of a few handlers: let the move through, stop it (and, when the character straddles two cells, slide it around
// a corner by the second cell's type), the diagonal handlers (type 6 a `/` slope, 7 a `\` slope, also tested
// before the table at $80:D772: the character slides along the line from either side), and one gated handler. Which handler means what was read from the code; which entry holds
// which handler is read from the ROM here.

/** The four directions a character moves, and the jump table each reads ($80 bank, by cell type). */
const MOVE_TABLES = { up: 0x80D542, down: 0x80D8E8, left: 0x80DC60, right: 0x80DFDC } as const;
export type Move = keyof typeof MOVE_TABLES;
const MOVES = Object.keys(MOVE_TABLES) as Move[];

/**
 * What a direction's handler does with a character in line with the cell:
 *   open      the move goes through
 *   wall      the move stops at the cell's edge ($80:D3FD and its twins)
 *   diagonal  types 6 (/) and 7 (\): the character slides along the diagonal, from whichever side it comes
 *   gated     moving up into type 8 ($80:D506): a wall unless bit 2 of `$097C` is set
 */
export type MoveRule = 'open' | 'wall' | 'diagonal' | 'gated';

const HANDLERS: Record<number, MoveRule> = {
    0xD3AC: 'open', 0xD3B6: 'wall', 0xD3C0: 'wall', 0xD440: 'diagonal', 0xD4A0: 'diagonal', 0xD506: 'gated',
    0xD7A0: 'open', 0xD7AA: 'wall', 0xD7B4: 'wall', 0xD882: 'diagonal', 0xD827: 'diagonal',
    0xDB48: 'open', 0xDB52: 'wall', 0xDB5C: 'wall', 0xDBC9: 'diagonal', 0xDC12: 'diagonal',
    0xDEBE: 'open', 0xDEC8: 'wall', 0xDED2: 'wall', 0xDF8E: 'diagonal', 0xDF45: 'diagonal',
};

/**
 * The ground table of $80:D295 ($80:E11C, a word per type), read for characters without bit $0400 of their word
 * +4: $FFFF they cannot enter the cell, $8000 only while bit 15 of `$048A` is set, else they can (bit 0: drawn
 * with sprite priority $3000).
 */
const GROUND_TABLE = 0x80E11C;
export type GroundRule = 'open' | 'blocked' | 'flagged';

/** What one cell type does. */
export interface CellTypeRule {
    type: number;
    moves: Record<Move, MoveRule>;
    ground: GroundRule;
    /** The ground table's raw word. */
    groundWord: number;
}

/** The overall look of a type for the map overlay. */
export type CellClass = 'open' | 'wall' | 'diagonal' | 'one-way';

const file = (bus: number) => bus & 0x3FFFFF;
const word = (rom: Uint8Array, at: number) => rom[at] | (rom[at + 1] << 8);

/** The 32 cell types' rules, from the base ROM's movement tables (unknown handler addresses read as walls). */
export function cellTypeRules(rom: Uint8Array): CellTypeRule[] {
    return Array.from({ length: 32 }, (_, type) => {
        const moves = {} as Record<Move, MoveRule>;
        for (const m of MOVES) moves[m] = HANDLERS[word(rom, file(MOVE_TABLES[m]) + type * 2)] ?? 'wall';
        const g = word(rom, file(GROUND_TABLE) + type * 2);
        return { type, moves, groundWord: g, ground: g === 0xFFFF ? 'blocked' : g === 0x8000 ? 'flagged' : 'open' };
    });
}

/** How the overlay draws a type: no mark, a wall, a diagonal, or a cell some directions pass. */
export function cellClass(rule: CellTypeRule): CellClass {
    const v = MOVES.map(m => rule.moves[m]);
    if (v.includes('diagonal')) return 'diagonal';
    if (v.every(r => r === 'open')) return 'open';
    if (v.every(r => r === 'wall')) return 'wall';
    return 'one-way';
}
