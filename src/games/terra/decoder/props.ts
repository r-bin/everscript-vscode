// Ownership: a room's doors and pots — cells the check action (the A button) changes by their metatile alone, with no
// list behind them (docs/terra/README.md §3.9). Pure: a loaded room in, cells and the words they turn into out.
//
// $87:C7AE, with the cell in front of the player: metatile $0F3 → kind 3 → $87:9724, a door: the player's pose, then
// the door cell and the one above ($0F2) are redrawn $0F5 / $0F4, then $0F7 / $0F6 (~10 frames apart, seen in the
// game), each with its cell type from the layer's table — a wall until it opens, then the open cell's ($0F7: 0, or 2
// in rooms whose table says so). $0FA-$0FC → $87:95DD, a pot: refused while the player holds one ($0988), else the
// pot's metatile to $09C7, $0988 to one of three slots ($098A / $098F / $0994 by the metatile), and the cell becomes
// $0F8 (seen in the game: `$18FA` → `$00F8`, the floor under it).
// What a cell becomes is a metatile and that layer-0 table's type, as for a map change's set (changes.ts).
import type { TerraRoom } from './room';

/** A closed door's lower cell (the one the A check reads) and the upper cell above it. */
const DOOR = 0x0F3, DOOR_TOP = 0x0F2;
/** The door's two later pictures, lower and upper: half open, then open. */
const DOOR_FRAMES: [number, number][] = [[0x0F5, 0x0F4], [0x0F7, 0x0F6]];
/** The three pots and what a lifted one leaves. */
const POT_FIRST = 0x0FA, POT_LAST = 0x0FC, POT_GONE = 0x0F8;

/** A cell a prop writes, as changes.ts gives it: [layer 0, x, y, map word]. */
export type PropCell = [number, number, number, number];

export interface TerraProp {
    kind: 'door' | 'pot';
    /** The cell the A check reads (a door's lower cell). */
    x: number; y: number;
    /** The metatile there ($0F3, $0FA-$0FC). */
    metatile: number;
    /** The cells after each step: a door's half-open and open pictures, a pot's one (lifted). */
    frames: PropCell[][];
}

/**
 * Room `id`'s doors and pots on layer 0. A door is a `$0F3` cell under a `$0F2` one: three pictures use `$0F3` for
 * something else (`$0FD`, `$106`, `$280`: a floor cell, no `$0F2` above); the game would still run the door there.
 */
export function roomProps(room: TerraRoom): TerraProp[] {
    const l = room.layers.find(x => x.index === 0);
    if (!l) return [];
    const word = (m: number) => (m | ((l.types[m] & 0x7F) << 9)) & 0x7FFF;
    const out: TerraProp[] = [];
    for (let i = 0; i < l.cells.length; i++) {
        const m = l.cells[i] & 0x1FF, x = i % l.w, y = (i / l.w) | 0;
        if (m === DOOR && y > 0 && (l.cells[i - l.w] & 0x1FF) === DOOR_TOP) {
            out.push({ kind: 'door', x, y, metatile: m, frames: DOOR_FRAMES.map(([lo, hi]) => [[0, x, y, word(lo)], [0, x, y - 1, word(hi)]]) });
        } else if (m >= POT_FIRST && m <= POT_LAST) {
            out.push({ kind: 'pot', x, y, metatile: m, frames: [[[0, x, y, word(POT_GONE)]]] });
        }
    }
    return out;
}
