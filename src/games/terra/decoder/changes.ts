// Ownership: the map changes — parts of a room's map that the story switches (docs/terra/README.md §3.8), the
// game's counterpart of the other games' map objects. Pure: ROM bytes in, records out; applying one to a loaded room.
//
// After a room loads, the room change runs $8D:8FB4: for each set bit n of the array at `$7E:0710` (LSB first) it
// applies change n of the table at `$99:D4E7` if the change's room is the one loaded. A change is one or more 8-byte
// records (a record with bit 14 of its first word continues the change before it; bit 15 ends the table):
//   +0 word  room (bits 0-12), bit 13: on layer 1 (else layer 0)
//   +2       $FFFF: set one cell — +4 word the metatile, +6 / +7 the cell; its cell type comes from the layer's
//            cell-type table ($8D:9036)
//            else copy a block of the same layer — +2 / +3 the source cell, +4 / +5 width and height, +6 / +7 the
//            destination cell ($8D:90A1)
import type { TerraLayer, TerraRoom } from './room';

const CHANGE_TABLE = 0x99D4E7;
const RECORD = 8, MAX_RECORDS = 1024;

export type ChangeEdit =
    | { layer: number; kind: 'set'; x: number; y: number; metatile: number }
    | { layer: number; kind: 'copy'; from: [number, number]; w: number; h: number; x: number; y: number };

export interface MapChange {
    /** The bit of `$7E:0710` that switches it on, and its index in the table. */
    bit: number;
    edits: ChangeEdit[];
}

const file = (bus: number) => bus & 0x3FFFFF;
const word = (rom: Uint8Array, at: number) => rom[at] | (rom[at + 1] << 8);

/** Every change in the table, by bit, with its room. */
function allChanges(rom: Uint8Array): { room: number; change: MapChange }[] {
    const out: { room: number; change: MapChange }[] = [];
    for (let at = file(CHANGE_TABLE), k = 0; k < MAX_RECORDS && at + RECORD <= rom.length; at += RECORD, k++) {
        const head = word(rom, at);
        if (head & 0x8000) break;
        const layer = head & 0x2000 ? 1 : 0;
        const edit: ChangeEdit = word(rom, at + 2) === 0xFFFF
            ? { layer, kind: 'set', x: rom[at + 6], y: rom[at + 7], metatile: word(rom, at + 4) & 0x1FF }
            : { layer, kind: 'copy', from: [rom[at + 2], rom[at + 3]], w: rom[at + 4], h: rom[at + 5], x: rom[at + 6], y: rom[at + 7] };
        if (head & 0x4000 && out.length) out[out.length - 1].change.edits.push(edit);
        else out.push({ room: head & 0x1FFF, change: { bit: out.length, edits: [edit] } });
    }
    return out;
}

/** The changes that apply to room `id`, by bit. */
export function roomChanges(rom: Uint8Array, id: number): MapChange[] {
    return allChanges(rom).filter(c => c.room === id).map(c => c.change);
}

/** The cells a change writes: [layer, x, y, new map word], as the game leaves them (the occupied bit 15 clear). */
export function changeCells(room: TerraRoom, change: MapChange): [number, number, number, number][] {
    const out: [number, number, number, number][] = [];
    for (const e of change.edits) {
        const l = room.layers.find(x => x.index === e.layer);
        if (!l) continue;
        const at = (x: number, y: number) => (x >= 0 && y >= 0 && x < l.w && y < l.h ? y * l.w + x : -1);
        if (e.kind === 'set') {
            if (at(e.x, e.y) >= 0) out.push([e.layer, e.x, e.y, (e.metatile | ((l.types[e.metatile] & 0x7F) << 9)) & 0x7FFF]);
            continue;
        }
        for (let dy = 0; dy < e.h; dy++) for (let dx = 0; dx < e.w; dx++) {
            const src = at(e.from[0] + dx, e.from[1] + dy);
            if (src >= 0 && at(e.x + dx, e.y + dy) >= 0) out.push([e.layer, e.x + dx, e.y + dy, l.cells[src] & 0x7FFF]);
        }
    }
    return out;
}

/** A copy of `room` with `change` applied (layers' cells patched; the rest shared). */
export function withChange(room: TerraRoom, change: MapChange): TerraRoom {
    const cells = changeCells(room, change);
    const layers: TerraLayer[] = room.layers.map(l => {
        const mine = cells.filter(c => c[0] === l.index);
        if (!mine.length) return l;
        const copy = l.cells.slice();
        for (const [, x, y, w] of mine) copy[y * l.w + x] = w;
        return { ...l, cells: copy };
    });
    return { ...room, layers };
}
