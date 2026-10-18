// Ownership: the files of one map under som://rom/maps/ — pictures, data, collision
// and animation. Pure (no `vscode`): ROM bytes and a map id in, Buffers out.
//
//   <id>.png / <id>.a.png / <id>.b.png  both layers / layer A (BG1) only / layer B (BG2) only
//   <id>.json             header bytes, sets, halves, display mode, placed/skipped pieces
//   <id>.collision.json   per cell: floor class, diagonal, layer switch; special cells
//   <id>.anim.json        animated cells: frames (PNG data URIs, shared), when each starts
//   <id>.objects.json     the map's objects: cell, kind word, flag bits, raw bytes
//   <id>.edit.json        everything the editor starts from: both layers' metatile numbers, each
//                         metatile's 4 collision bytes, the step events, the character records, the event-flag
//                         pieces and their states, the backdrop
//   <id>.tiles.a.png / .tiles.b.png   layer A's / B's 192 metatiles as a 16x12 sheet (colour 0 clear)

import * as mana from '../decoder';
import * as platform from '../../../platform';
import type { ManaMap } from '../decoder/map';

const encodePng = (img: { width: number; height: number; rgba: Uint8Array; }): Buffer => platform.encodePng(img.width, img.height, img.rgba);

const json = (v: unknown): Buffer => Buffer.from(JSON.stringify(v) + '\n', 'utf8');

function load(rom: Uint8Array, id: number) {
    const map = mana.loadMap(rom, id);
    if (!map) throw new Error(`map ${id.toString(16)} has no pieces`);
    return map;
}

function picture(rom: Uint8Array, id: number, layers: 'both' | 'a' | 'b') {
    const map = load(rom, id);
    const opts = layers === 'both' ? {} : { layers: { a: layers === 'a', b: layers === 'b' } };
    return encodePng(mana.renderMap(map, opts));
}

function data(rom: Uint8Array, id: number) {
    const m = load(rom, id);
    return json({
        id, w: m.w, h: m.h, sizeB: m.sizeB,
        header: m.header.bytes,
        charSet: m.header.charSet, paletteSet: m.header.paletteSet,
        metatileSet: m.header.metatileSet, halves: [m.header.halfA, m.header.halfB],
        display: m.display,
        placed: m.placed, skipped: m.skipped,
    });
}

function collision(rom: Uint8Array, id: number) {
    const m = load(rom, id);
    const c = mana.collisionOf(rom, m);
    let floor = '', diagonal = '';
    const switches: [number, number][] = [], specials: { x: number; y: number; kind: number }[] = [];
    for (let i = 0; i < c.w * c.h; i++) {
        const [c0, c1, c2] = c.bytes.subarray(i * 4, i * 4 + 3);
        floor += mana.floorOf(c0);
        diagonal += mana.diagonalOf(c2);
        const x = i % c.w, y = Math.floor(i / c.w);
        if (mana.switchesLevel(c0)) switches.push([x, y]);
        const kind = mana.specialOf(c1);
        if (kind) specials.push({ x, y, kind });
    }
    return json({ w: c.w, h: c.h, floor, diagonal, switches, specials });
}

function animation(rom: Uint8Array, id: number) {
    const m = load(rom, id);
    const trace = mana.traceAnimation(rom, m.header);
    if (!trace) return json({ length: 0, images: [], kinds: [] });
    const cells = mana.animateCells(m, trace);
    const images: string[] = [], index = new Map<string, number>();
    const kinds = cells.kinds.map(k => ({
        cells: k.cells,
        starts: k.starts,
        frames: k.images.map(img => {
            const key = Buffer.from(img.rgba.buffer, img.rgba.byteOffset, img.rgba.length).toString('base64');
            let i = index.get(key);
            if (i === undefined) {
                i = images.length;
                index.set(key, i);
                images.push('data:image/png;base64,' + encodePng(img).toString('base64'));
            }
            return i;
        }),
    }));
    return json({ length: cells.length, images, kinds });
}

function objects(rom: Uint8Array, id: number) {
    load(rom, id);
    return json({ objects: mana.mapObjects(rom, id) });
}

/** Both layers' metatile numbers, cell by cell (layer B with its own size, as the game repeats it). */
function layerCells(m: ManaMap, layer: 'A' | 'B', w: number, h: number): number[] {
    const out: number[] = [];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) out.push(m.cell(layer, x, y));
    return out;
}

/** Collision bytes of every metatile of a layer's half, 4 each, in metatile order. */
function halfCollision(rom: Uint8Array, m: ManaMap, layer: 'A' | 'B'): number[] {
    const out: number[] = [];
    for (let n = 0; n < mana.METATILES_PER_HALF; n++) out.push(...mana.metatileCollision(rom, m, layer, n));
    return out;
}

function editModel(rom: Uint8Array, id: number) {
    const m = load(rom, id);
    const bd = m.display.backdrop;
    const ev = mana.mapEvents(rom, m);
    const b3 = m.header.bytes[3];
    return json({
        id, w: m.w, h: m.h, sizeB: m.sizeB,
        a: layerCells(m, 'A', m.w, m.h),
        b: m.sizeB ? layerCells(m, 'B', m.sizeB.w, m.sizeB.h) : [],
        collision: { a: halfCollision(rom, m, 'A'), b: halfCollision(rom, m, 'B') },
        backdrop: [(bd & 31) << 3 | (bd & 31) >> 2, (bd >> 5 & 31) << 3 | (bd >> 5 & 31) >> 2, (bd >> 10 & 31) << 3 | (bd >> 10 & 31) >> 2],
        // How step events number their metatiles ($00:B637): values from $C0 - lead up run an event.
        lead: b3 & 3, ownEvent: (b3 & 4) !== 0,
        events: ev,
        objects: mana.mapObjects(rom, id),
        // The event-flag pieces: the parts of the map that change with the story, as states (src/games/mana/decoder/flag-pieces.ts).
        pieces: mana.flagPieces(rom, m),
    });
}

function tileSheet(rom: Uint8Array, id: number, layer: 'A' | 'B') {
    return encodePng(mana.renderMetatileSheet(load(rom, id), layer));
}

/** File name -> producer for one map, or null. */
function mapFile(rom: Uint8Array, id: number, ext: string): (() => Buffer) | null {
    switch (ext) {
        case 'png': return () => picture(rom, id, 'both');
        case 'a.png': return () => picture(rom, id, 'a');
        case 'b.png': return () => picture(rom, id, 'b');
        case 'json': return () => data(rom, id);
        case 'collision.json': return () => collision(rom, id);
        case 'anim.json': return () => animation(rom, id);
        case 'objects.json': return () => objects(rom, id);
        case 'edit.json': return () => editModel(rom, id);
        case 'tiles.a.png': return () => tileSheet(rom, id, 'A');
        case 'tiles.b.png': return () => tileSheet(rom, id, 'B');
    }
    return null;
}

const MAP_FILE_EXTS = ['png', 'a.png', 'b.png', 'json', 'collision.json', 'anim.json', 'objects.json', 'edit.json', 'tiles.a.png', 'tiles.b.png'];

export { mapFile, MAP_FILE_EXTS };
