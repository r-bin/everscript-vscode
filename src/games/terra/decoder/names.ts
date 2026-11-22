// Ownership: names for Terranigma's rooms (docs/terra/room-names.md). Pure: ROM bytes and the catalog's rooms in,
// plain records out.
//
// The ROM holds no room names, so they are ours. A room's AREA comes from the exit graph: take the rooms the
// exits link, leave out the three world maps (`HUBS`, whose exits reach every area) and what stays connected
// is one place — a town with its houses, a tower, a cave. Each such place is named by one of its rooms
// (`AREAS`, the anchor), checked against that room's picture. Inside an area a room is named by how far its
// door is from the world map: the way in is the area itself, the rest are numbered rooms in walking order.
//
// Town names are the ones the game's story gives them. A place whose name could not be checked against the
// game gets a description of what it looks like instead (`guess`), never an invented proper name.
import { roomExits } from './exits';

export interface TerraArea {
    /** One room of the area; the area is every room connected to it. */
    anchor: number;
    name: string;
    /** True when the name describes the picture instead of naming the place. */
    guess: boolean;
}

const named = (anchor: number, name: string): TerraArea => ({ anchor, name, guess: false });
const seen = (anchor: number, name: string): TerraArea => ({ anchor, name, guess: true });

/** The world maps: the player walks between areas on them. */
export const HUBS: ReadonlyMap<number, string> = new Map([
    [0x002, 'Overworld'],
    [0x003, 'Underworld'],
    [0x005, 'Overworld (flying)'],
]);

/**
 * The areas, by one room each. The two eras of a town are two areas (the rooms differ), so the later one is
 * "(modern)"; two places that look alike share the name and a suffix.
 */
export const AREAS: readonly TerraArea[] = [
    named(0x0BE, 'Loire'), named(0x0A0, 'Loire Castle'),
    named(0x1A8, 'Louran'), named(0x062, 'Louran houses'),
    named(0x00A, 'Crysta'), named(0x1F4, 'Stockholm'),
    named(0x356, 'Liberty'), named(0x34C, 'Liberty houses'), named(0x36F, 'Liberty (modern)'),
    named(0x3EC, 'Suncoast'), named(0x3FA, 'Suncoast (modern)'),
    named(0x436, 'Nirlake (modern)'),
    named(0x27C, 'Astarica'), named(0x44B, "Rich's house"),
    seen(0x258, 'Metal fortress'), seen(0x24E, 'Stone fortress'),
    seen(0x1D6, 'Purple castle'), seen(0x41E, 'Purple castle (late)'),
    seen(0x15A, 'Dark tunnels'), seen(0x178, 'Ice cave'), seen(0x12D, 'Crystal cave'), seen(0x23D, 'Pool cave'),
    seen(0x15E, 'Forest'), seen(0x079, 'Snow village'), seen(0x40C, 'Snow town'), seen(0x213, 'Rocky canyon'),
    seen(0x3AA, 'Harbour'), seen(0x095, 'Igloo village'), seen(0x226, 'Conveyor tower'),
    seen(0x10F, 'Dark temple'), seen(0x102, 'Blue hall'), seen(0x109, 'Pink castle'), seen(0x116, 'Red temple'),
    seen(0x21C, 'Crypt'), seen(0x053, 'Waterfall pond'),
    seen(0x088, 'Desert camp'), seen(0x08C, 'Grass camp'), seen(0x090, 'Oasis camp'),
    seen(0x2DA, 'Hidden cave'), seen(0x448, 'Farm'), seen(0x44E, 'Tent'),
    seen(0x39A, 'Houses (west)'), seen(0x38F, 'Houses (south-west)'), seen(0x3C9, 'Houses (centre)'),
    seen(0x3B0, 'Houses (east)'), seen(0x3BE, 'Houses (far east)'),
    seen(0x04C, 'Cottage pair (west)'), seen(0x050, 'Cottage pair (east)'), seen(0x071, 'Cottages (north)'),
    seen(0x073, 'Cottages (far north)'), seen(0x076, 'Village interiors'),
];

/** Rooms the repo's checks already identify (docs/terra/README.md §5): they keep that name inside their area. */
const KNOWN_ROOMS: ReadonlyMap<number, string> = new Map([[0x00F, "Ark's house"]]);

export interface TerraRoomName {
    /** The area it is in ('Worlds' for a world map, 'Other rooms' for what no exit links). */
    area: string;
    /** The room's own name: the area's, or the area's with a room number. */
    name: string;
    /** The area's name is a description, not a proper name. */
    guess: boolean;
}

const WORLDS = 'Worlds', HIDDEN = 'Hidden areas', OTHER = 'Other rooms';

/** Room ids → exit targets (rooms that have a list; a target counts even when that room has none). */
function exitGraph(rom: Uint8Array, ids: number[]): Map<number, number[]> {
    const known = new Set(ids);
    const g = new Map<number, number[]>();
    for (const id of ids) {
        const to = new Set<number>();
        for (const e of roomExits(rom, id)) for (const t of e.targets) if (known.has(t.room)) to.add(t.room);
        g.set(id, [...to]);
    }
    return g;
}

/**
 * A name for every room in `ids` (the used rooms). Connected pieces of the exit graph without the world maps
 * are the areas; a piece no anchor names is "Hidden areas" when it is a single room a world map leads to, else
 * "Other rooms".
 */
export function nameRooms(rom: Uint8Array, ids: number[]): Map<number, TerraRoomName> {
    const out = new Map<number, TerraRoomName>();
    const g = exitGraph(rom, ids);
    const adj = new Map<number, Set<number>>(ids.map(i => [i, new Set()]));
    const fromHub = new Set<number>();
    for (const [a, to] of g) for (const b of to) {
        if (HUBS.has(a) && !HUBS.has(b)) fromHub.add(b);
        if (HUBS.has(a) || HUBS.has(b)) continue;
        adj.get(a)!.add(b); adj.get(b)!.add(a);
    }
    for (const id of ids) if (HUBS.has(id)) out.set(id, { area: WORLDS, name: HUBS.get(id)!, guess: false });
    const done = new Set<number>(HUBS.keys());
    const anchorOf = new Map(AREAS.map(a => [a.anchor, a]));
    for (const start of ids) {
        if (done.has(start)) continue;
        const piece: number[] = [start];
        done.add(start);
        for (let k = 0; k < piece.length; k++) for (const n of adj.get(piece[k])!) if (!done.has(n)) { done.add(n); piece.push(n); }
        piece.sort((a, b) => a - b);
        const area = piece.map(r => anchorOf.get(r)).find(a => a);
        if (!area) {
            const hidden = piece.length === 1 && fromHub.has(piece[0]);
            const label = hidden ? HIDDEN : OTHER;
            for (const r of piece) out.set(r, { area: label, name: hidden ? `Hidden area $${r.toString(16).toUpperCase().padStart(3, '0')}` : `Room $${r.toString(16).toUpperCase().padStart(3, '0')}`, guess: false });
            continue;
        }
        nameArea(piece, area, adj, fromHub, out);
    }
    return out;
}

/** Name the rooms of one area: the ways in first (breadth-first from them), the way in is the area itself. */
function nameArea(piece: number[], area: TerraArea, adj: Map<number, Set<number>>, fromHub: Set<number>, out: Map<number, TerraRoomName>): void {
    const entries = piece.filter(r => fromHub.has(r));
    const roots = entries.length ? entries : [piece[0]];
    const order: number[] = [];
    const depth = new Map<number, number>();
    for (const r of roots) { depth.set(r, 0); order.push(r); }
    for (let k = 0; k < order.length; k++) {
        for (const n of [...adj.get(order[k])!].sort((a, b) => a - b)) if (!depth.has(n)) { depth.set(n, depth.get(order[k])! + 1); order.push(n); }
    }
    let rooms = 0;
    roots.forEach((r, i) => out.set(r, { area: area.name, name: roots.length > 1 ? `${area.name} ${i + 1}` : area.name, guess: area.guess }));
    for (const r of order) if (!out.has(r)) {
        const known = KNOWN_ROOMS.get(r);
        out.set(r, { area: area.name, name: known ? `${area.name}, ${known}` : `${area.name}, room ${++rooms}`, guess: area.guess });
    }
}
