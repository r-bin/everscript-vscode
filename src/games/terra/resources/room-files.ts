// Ownership: the files of one room under terra://rom/rooms/ — pictures, sheets and data. Pure (no `vscode`):
// ROM bytes and a room id in, Buffers out.
//
//   <hex>.png / <hex>.l0.png / <hex>.l1.png   the room's map with both layers / layer 0 / layer 1 only
//   <hex>.tiles.l0.png / .tiles.l1.png        a layer's 512 metatiles, 16 per row (colour 0 clear)
//   <hex>.c<k>.png                            the map with the room's map change k applied (k: its index in the json)
//   <hex>.json                                everything the Maps page starts from: sizes, both layers' map
//                                             words and metatile tile words, palette, display registers,
//                                             what the load ran and which room was loaded before it, its exits,
//                                             chests and map changes (with the cells each one writes)

import * as terra from '../decoder';
import { encodePng } from '../../../platform/png';

/** The extensions a room has (after `<hex>.`). */
export const ROOM_FILE_EXTS = ['png', 'l0.png', 'l1.png', 'json', 'tiles.l0.png', 'tiles.l1.png'];

const png = (p: terra.Picture): Buffer => encodePng(p.width, p.height, p.rgba);
const json = (v: unknown): Buffer => Buffer.from(JSON.stringify(v) + '\n', 'utf8');

/** The last rooms loaded (one room's files are usually read together). */
const recent = new Map<string, terra.TerraRoom>();
const RECENT_MAX = 6;
const romIds = new WeakMap<Uint8Array, number>();
let romSeq = 0;

function load(rom: Uint8Array, id: number): terra.TerraRoom {
    let rid = romIds.get(rom);
    if (rid === undefined) { rid = ++romSeq; romIds.set(rom, rid); }
    const key = rid + ':' + id;
    let room = recent.get(key);
    if (!room) {
        const r = terra.loadRoom(rom, id);
        if (!r || !r.layers.length) throw new Error(`room ${terra.hex3(id)} has no map of its own`);
        room = r;
        if (recent.size >= RECENT_MAX) recent.delete(recent.keys().next().value as string);
        recent.set(key, room);
    }
    return room;
}

function data(rom: Uint8Array, id: number): Buffer {
    const room = load(rom, id), size = terra.roomSize(room);
    return json({
        id, hex: terra.hex3(id), w: size.w, h: size.h,
        script: terra.readRoomBusAddress(rom, id),
        context: room.context,
        sections: room.run.sections.map(bit => ({ bit, name: terra.SECTION_NAMES[bit] })),
        sets: room.run.sets,
        display: room.run.display,
        backdrop: terra.rgbOf(room.palette[0]),
        palette: Array.from(room.palette),
        ppu: room.ppu,
        layers: room.layers.map(l => ({
            index: l.index, bg: terra.layerBg(l), w: l.w, h: l.h,
            cells: Array.from(l.cells), metatiles: Array.from(l.metatiles),
        })),
        exits: terra.roomExits(rom, id),
        chests: terra.roomChests(rom, id),
        changes: terra.roomChanges(rom, id).map(c => ({ ...c, cells: terra.changeCells(room, c) })),
    });
}

/** How to produce `<hex>.<ext>` for room `id`, or null for an extension rooms do not have. */
export function roomFile(rom: Uint8Array, id: number, ext: string): (() => Buffer) | null {
    switch (ext) {
        case 'png': return () => png(terra.renderRoom(load(rom, id)));
        case 'l0.png': return () => png(terra.renderRoom(load(rom, id), { layers: [0] }));
        case 'l1.png': return () => png(terra.renderRoom(load(rom, id), { layers: [1] }));
        case 'tiles.l0.png': return () => png(terra.renderMetatileSheet(load(rom, id), 0));
        case 'tiles.l1.png': return () => png(terra.renderMetatileSheet(load(rom, id), 1));
        case 'json': return () => data(rom, id);
    }
    const change = /^c(\d+)\.png$/.exec(ext);
    const c = change ? terra.roomChanges(rom, id)[Number(change[1])] : undefined;
    if (c) return () => png(terra.renderRoom(terra.withChange(load(rom, id), c)));
    return null;
}
