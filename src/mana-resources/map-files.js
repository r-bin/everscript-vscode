'use strict';
// Ownership: the files of one map under som://rom/maps/ — pictures, data, collision
// and animation. Pure (no `vscode`): ROM bytes and a map id in, Buffers out.
//
//   <id>.png / <id>.a.png / <id>.b.png  both layers / layer A (BG1) only / layer B (BG2) only
//   <id>.json             header bytes, sets, halves, display mode, placed/skipped pieces
//   <id>.collision.json   per cell: floor class, diagonal, level switch; special cells
//   <id>.anim.json        animated cells: frames (PNG data URIs, shared), when each starts

const mana = require('../mana');
const { encodePng } = require('./png');

const json = v => Buffer.from(JSON.stringify(v) + '\n', 'utf8');

/** @param {Uint8Array} rom @param {number} id */
function load(rom, id) {
    const map = mana.loadMap(rom, id);
    if (!map) throw new Error(`map ${id.toString(16)} has no pieces`);
    return map;
}

/** @param {Uint8Array} rom @param {number} id @param {'both'|'a'|'b'} layers */
function picture(rom, id, layers) {
    const map = load(rom, id);
    const opts = layers === 'both' ? {} : { layers: { a: layers === 'a', b: layers === 'b' } };
    return encodePng(mana.renderMap(map, opts));
}

/** @param {Uint8Array} rom @param {number} id */
function data(rom, id) {
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

/** @param {Uint8Array} rom @param {number} id */
function collision(rom, id) {
    const m = load(rom, id);
    const c = mana.collisionOf(rom, m);
    let floor = '', diagonal = '';
    const switches = [], specials = [];
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

/** @param {Uint8Array} rom @param {number} id */
function animation(rom, id) {
    const m = load(rom, id);
    const trace = mana.traceAnimation(rom, m.header);
    if (!trace) return json({ length: 0, images: [], kinds: [] });
    const cells = mana.animateCells(m, trace);
    const images = [], index = new Map();
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

/** File name -> producer for one map, or null. */
function mapFile(rom, id, ext) {
    switch (ext) {
        case 'png': return () => picture(rom, id, 'both');
        case 'a.png': return () => picture(rom, id, 'a');
        case 'b.png': return () => picture(rom, id, 'b');
        case 'json': return () => data(rom, id);
        case 'collision.json': return () => collision(rom, id);
        case 'anim.json': return () => animation(rom, id);
    }
    return null;
}

const MAP_FILE_EXTS = ['png', 'a.png', 'b.png', 'json', 'collision.json', 'anim.json'];

module.exports = { mapFile, MAP_FILE_EXTS };
