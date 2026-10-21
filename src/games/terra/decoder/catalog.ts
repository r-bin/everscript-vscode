// Ownership: the list of Terranigma rooms and which of them show the same map (docs/terra/README.md §4.4).
// Pure; built once per ROM buffer from header-only loader runs (room.ts `headerRun`, ~1.5 s for every room).
//
// Two rooms show the same picture when their loads read the same script bytes, the same compressed
// blocks and leave the same palette and display registers (a room's display mode comes from its own
// property stream, $86:955C) — and, for a room that keeps graphics from before, the same room is
// loaded first (room.ts contextRooms). That can only over-split (two keys, one picture), never merge two different pictures.
// Room names are not decoded: rooms are listed by id, in groups of 64 ids.
import { readRoomBusAddress, isRoomSlotUsed, isBaseTerraRom, TERRA_ROOM_COUNT } from './rom';
import { contextRooms, headerRun } from './room';

export interface TerraRoomEntry {
    id: number;
    /** Three hex digits, the id in paths (terra://rom/rooms/<hex>.png). */
    hex: string;
    /** Bus address of the room's script (the room table entry). */
    script: number;
    /** Header sections the room's own load runs (flag bits). */
    sections: number[];
    /** Shared scripts (table B entries) it enters. */
    sets: number[];
    /** Its picture's size in 16 px cells (0 × 0: no map of its own). */
    w: number; h: number;
    /** The rooms loaded before it, oldest first, for the parts it keeps from before (graphics, palette, metatiles, display mode). */
    context: number[];
    /** Rooms with the same key show the same picture. */
    key: string;
}

export interface TerraGroup {
    name: string;
    /** Rooms that show a map, as pictures: each a list of room ids with the same picture, id order. */
    pictures: number[][];
    /** Used rooms in the range that load no map of their own. */
    noMap: number[];
}

export interface TerraCatalog {
    /** False for a ROM whose tables this decoder does not know (not the European base ROM). */
    supported: boolean;
    rooms: TerraRoomEntry[];
    pictures: number[][];
    groups: TerraGroup[];
    /** Used and unused slots of the room table. */
    used: number; unused: number;
}

/** Ids per rail group. */
const GROUP_SIZE = 0x40;

export const hex3 = (n: number) => n.toString(16).padStart(3, '0');

/** FNV-1a over numbers (each taken as up to 32 bits), as 8 hex digits. */
function fnv(values: Iterable<number>): string {
    let h = 0x811C9DC5;
    for (const v of values) for (let s = 0; s < 32; s += 8) h = Math.imul(h ^ ((v >>> s) & 0xFF), 0x01000193) >>> 0;
    return h.toString(16).padStart(8, '0');
}

/** The PPU registers that shape the picture: BG mode, tilemap and character bases, screens, colour math. */
const PICTURE_REGS = [0x05, 0x07, 0x08, 0x09, 0x0A, 0x0B, 0x0C, 0x2C, 0x2D, 0x30, 0x31];

function keyOf(rom: Uint8Array, id: number): string {
    const { run, sizes, palette, ppu } = headerRun(rom, id);
    return fnv([...run.read, -1, ...run.blocks.map(b => b.at), -1, ...sizes, -1, ...palette, -1, ...PICTURE_REGS.map(r => ppu[r]), run.display ? 1 : 0]);
}

const catalogs = new WeakMap<Uint8Array, TerraCatalog>();

/** Every used room and the pictures they show, cached per ROM buffer. */
export function roomCatalog(rom: Uint8Array): TerraCatalog {
    let c = catalogs.get(rom);
    if (c) return c;
    const supported = isBaseTerraRom(rom);
    const rooms: TerraRoomEntry[] = [];
    let unused = 0;
    for (let id = 0; id < TERRA_ROOM_COUNT; id++) {
        if (!isRoomSlotUsed(rom, id)) { unused++; continue; }
        if (!supported) continue;
        const { run, sizes } = headerRun(rom, id);
        const own = run.sections.includes(0x10);
        const context = contextRooms(rom, id);
        rooms.push({
            id, hex: hex3(id), script: readRoomBusAddress(rom, id) ?? 0,
            sections: run.sections, sets: run.sets,
            w: own ? Math.max(sizes[0], sizes[2]) : 0, h: own ? Math.max(sizes[1], sizes[3]) : 0,
            context, key: '',
        });
    }
    for (const r of rooms) r.key = [r.id, ...r.context].map(k => keyOf(rom, k)).join('+');
    const byKey = new Map<string, number[]>();
    for (const r of rooms) if (r.w) {
        const g = byKey.get(r.key);
        if (g) g.push(r.id); else byKey.set(r.key, [r.id]);
    }
    const pictures = [...byKey.values()].sort((a, b) => a[0] - b[0]);
    const groups: TerraGroup[] = [];
    for (let from = 0; from < TERRA_ROOM_COUNT; from += GROUP_SIZE) {
        const to = Math.min(TERRA_ROOM_COUNT, from + GROUP_SIZE) - 1;
        const g: TerraGroup = {
            name: `Rooms $${hex3(from).toUpperCase()}–$${hex3(to).toUpperCase()}`,
            pictures: pictures.filter(p => p[0] >= from && p[0] <= to),
            noMap: rooms.filter(r => !r.w && r.id >= from && r.id <= to).map(r => r.id),
        };
        if (g.pictures.length || g.noMap.length) groups.push(g);
    }
    c = { supported, rooms, pictures, groups, used: TERRA_ROOM_COUNT - unused, unused };
    catalogs.set(rom, c);
    return c;
}
