'use strict';
// Ownership: one Secret of Mana map rewritten in Evermore's terms, cell by cell — the
// three words of an Evermore stamp (layer 1, layer 2, collision), 16x16 graphics,
// seven tile families and step-on trigger boxes. Pure: Mana ROM bytes in, data out.
//
// What maps onto what (docs/mana/evermore-rooms.md):
//   Mana layer A (BG1)          -> layer 1 (canopy, BG1)
//   Mana layer B (BG2)          -> layer 2 (terrain, BG2), repeated over the map
//   Mana metatile (4 chars)     -> one 16x16 graphic; one palette and one priority
//                                  per cell, so a metatile that mixes them is redrawn
//                                  in its main palette (nearest colours) — counted
//   Mana BG palette 1..7        -> family m<set*8 + palette-1>; only the palettes the map
//                                  draws with, in slots 1..k
//   Mana collision (c0, c2)     -> geometry + plane; step events -> bit 14 + a box
// Only SNES facts are shared: both games use Mode 1 tilemap words with the same bits.

const mana = require('../mana');
const { FAMILY_BASE, MAX_GRAPHICS } = require('./ids');

const EMPTY_GRAPHIC = 0;        // slot 0 is always the fully transparent graphic

/** Evermore geometry nibble for each Mana diagonal (docs/map-format/map_collision_mechanics.md §5). */
const DIAGONAL_GEOMETRY = { 4: 0x02, 5: 0x09, 6: 0x0A, 7: 0x01 };
const SOLID = 0x0F, PLANE_1 = 0x10, PLANE_2 = 0x20, PLANE_TRANSPARENT = 0x40, STEP_ON = 0x4000;

/**
 * Evermore collision word for Mana collision bytes c0, c2.
 * Level 1 and 2 floors become planes 1 and 2 (each solid from the other, as in Mana);
 * a floor of no level is plane-transparent, open from both.
 */
function collisionWord(c0, c2, step) {
    const floor = c0 & 7, diag = mana.diagonalOf(c2);
    let w;
    if (diag) w = DIAGONAL_GEOMETRY[diag] | (floor === 1 ? PLANE_1 : PLANE_2);
    else if (floor === 3) w = SOLID | PLANE_2;
    else if (floor === 1) w = PLANE_1;
    else if (floor === 2) w = PLANE_2;
    else w = PLANE_2 | PLANE_TRANSPARENT;
    return step ? w | STEP_ON : w;
}

const rgb = (c) => [c & 31, (c >> 5) & 31, (c >> 10) & 31];

/** The colour of palette `to` nearest to colour `c` of palette `from` (index 1..15). */
function nearest(cgram, from, c, to) {
    const want = rgb(cgram[from * 16 + c]);
    let best = 1, bestD = Infinity;
    for (let k = 1; k < 16; k++) {
        const have = rgb(cgram[to * 16 + k]);
        const d = (want[0] - have[0]) ** 2 + (want[1] - have[1]) ** 2 + (want[2] - have[2]) ** 2;
        if (d < bestD) { bestD = d; best = k; }
    }
    return best;
}

/** A metatile drawn as one 16x16 graphic: 256 colour indices, its palette and priority. */
function metatilePixels(map, table, n, stats) {
    const px = new Uint8Array(256), pal = new Uint8Array(256);
    const palCount = new Array(8).fill(0);
    let prio = 0, opaque = 0;
    for (let q = 0; q < 4; q++) {
        const word = table[n * 4 + q];
        const base = (word & 0x3FF) * 32, p = (word >> 10) & 7;
        const hf = word & 0x4000, vf = word & 0x8000;
        for (let y = 0; y < 8; y++) {
            const r = base + (vf ? 7 - y : y) * 2;
            const p0 = map.vram[r], p1 = map.vram[r + 1], p2 = map.vram[r + 16], p3 = map.vram[r + 17];
            for (let x = 0; x < 8; x++) {
                const bit = hf ? x : 7 - x;
                const c = ((p0 >> bit) & 1) | ((p1 >> bit) & 1) << 1 | ((p2 >> bit) & 1) << 2 | ((p3 >> bit) & 1) << 3;
                if (!c) continue;
                const i = ((q >> 1) * 8 + y) * 16 + (q & 1) * 8 + x;
                px[i] = c; pal[i] = p;
                palCount[p]++; opaque++;
                if (word & 0x2000) prio++;
            }
        }
    }
    if (!opaque) return { px, palette: 1, priority: 0, empty: true };
    let main = 1;
    for (let p = 1; p < 8; p++) if (palCount[p] > palCount[main]) main = p;
    if (palCount[main] < opaque) {
        stats.recolouredTiles++;
        for (let i = 0; i < 256; i++) {
            if (px[i] && pal[i] !== main) { px[i] = nearest(map.cgram, pal[i], px[i], main); stats.recolouredPixels++; }
        }
    }
    if (prio && prio < opaque) stats.mixedPriority++;
    return { px, palette: main, priority: prio * 2 >= opaque ? 1 : 0, empty: false };
}

const flipH = (px) => { const o = new Uint8Array(256); for (let i = 0; i < 256; i++) o[i] = px[(i & ~15) | (15 - (i & 15))]; return o; };
const flipV = (px) => { const o = new Uint8Array(256); for (let i = 0; i < 256; i++) o[i] = px[(15 - (i >> 4)) * 16 + (i & 15)]; return o; };
const keyOf = (px) => Buffer.from(px.buffer, px.byteOffset, px.length).toString('latin1');

/** Evermore's 16x16 graphic layout: four 8x8 4bpp planar characters, TL TR BL BR. */
function encodeGraphic(px) {
    const out = new Uint8Array(128);
    for (let s = 0; s < 4; s++) {
        const ox = (s & 1) * 8, oy = (s >> 1) * 8;
        for (let row = 0; row < 8; row++) {
            let b0 = 0, b1 = 0, b2 = 0, b3 = 0;
            for (let col = 0; col < 8; col++) {
                const c = px[(oy + row) * 16 + ox + col], m = 1 << (7 - col);
                if (c & 1) b0 |= m; if (c & 2) b1 |= m; if (c & 4) b2 |= m; if (c & 8) b3 |= m;
            }
            out[s * 32 + row * 2] = b0; out[s * 32 + row * 2 + 1] = b1;
            out[s * 32 + row * 2 + 16] = b2; out[s * 32 + row * 2 + 17] = b3;
        }
    }
    return out;
}

/** Block 1 slot -> character index of a tilemap word (the inverse of `floor(chr/0x20)*8 + floor(chr%0x20/2)`). */
const slotChr = (slot) => Math.floor(slot / 8) * 0x20 + (slot % 8) * 2;

/** The graphics list: deduplicated, mirrored copies sharing one slot. */
function graphicTable(stats) {
    const slots = [new Uint8Array(256)], index = new Map([[keyOf(slots[0]), 0]]);
    return {
        slots,
        /** {slot, h, v} for a pixel block, adding it when it is new. */
        place(px) {
            const tries = [[px, 0, 0], [flipH(px), 1, 0], [flipV(px), 0, 1], [flipV(flipH(px)), 1, 1]];
            for (const [p, h, v] of tries) {
                const s = index.get(keyOf(p));
                if (s !== undefined) return { slot: s, h, v };
            }
            if (slots.length >= MAX_GRAPHICS) { stats.droppedGraphics++; return { slot: EMPTY_GRAPHIC, h: 0, v: 0 }; }
            index.set(keyOf(px), slots.length);
            slots.push(px);
            return { slot: slots.length - 1, h: 0, v: 0 };
        },
    };
}

/** Step-event cells as boxes: runs along a row, merged with the identical run above. */
function triggerBoxes(steps) {
    const runs = [];
    const sorted = steps.slice().sort((a, b) => a.y - b.y || a.x - b.x);
    for (const s of sorted) {
        const last = runs[runs.length - 1];
        if (last && last.y1 === s.y && last.x2 === s.x && last.scriptId === s.event) last.x2++;
        else runs.push({ x1: s.x, y1: s.y, x2: s.x + 1, y2: s.y + 1, scriptId: s.event });
    }
    const boxes = [];
    for (const r of runs) {
        const above = boxes.find((b) => b.y2 === r.y1 && b.x1 === r.x1 && b.x2 === r.x2 && b.scriptId === r.scriptId);
        if (above) above.y2 = r.y2;
        else boxes.push(r);
    }
    return boxes;
}

/**
 * Convert map `id`. Returns null for an id without pieces.
 * `cells` holds three words per cell, row by row; `graphics` 128-byte Evermore graphics
 * by Block 1 slot; `families` the palettes the map draws with, by slot.
 */
function convertManaMap(manaRom, id) {
    const map = mana.loadMap(manaRom, id);
    if (!map) return null;
    const stats = { recolouredTiles: 0, recolouredPixels: 0, mixedPriority: 0, droppedGraphics: 0 };
    const graphics = graphicTable(stats);
    // First every metatile the map shows, so only the palettes it draws with become
    // families, packed into slots 1..k in palette order (a word names its slot).
    const tiles = { A: new Map(), B: new Map() };
    const tileOf = (layer, n) => {
        if (n < 0 || n >= 192) return null;
        let t = tiles[layer].get(n);
        if (!t) {
            const m = metatilePixels(map, layer === 'A' ? map.tableA : map.tableB, n, stats);
            t = { m, g: m.empty ? { slot: EMPTY_GRAPHIC, h: 0, v: 0 } : graphics.place(m.px) };
            tiles[layer].set(n, t);
        }
        return t;
    };
    for (let y = 0; y < map.h; y++) for (let x = 0; x < map.w; x++) { tileOf('A', map.cell('A', x, y)); tileOf('B', map.cell('B', x, y)); }
    const used = new Map();                     // Mana palette -> graphic slots drawn in it
    for (const layer of ['A', 'B']) for (const t of tiles[layer].values()) {
        if (t.m.empty) continue;
        if (!used.has(t.m.palette)) used.set(t.m.palette, new Set());
        used.get(t.m.palette).add(t.g.slot);
    }
    const palettes = [...used.keys()].sort((x, y) => x - y);
    if (!palettes.length) palettes.push(1);
    const slotOf = (p) => palettes.indexOf(p) + 1;
    const wordFor = (layer, n) => {
        const t = tileOf(layer, n);
        if (!t || t.m.empty) return 1 << 10;    // the empty graphic, in slot 1
        return (t.g.v << 15) | (t.g.h << 14) | (t.m.priority << 13) | (slotOf(t.m.palette) << 10) | slotChr(t.g.slot);
    };
    const col = mana.collisionOf(manaRom, map);
    const events = mana.mapEvents(manaRom, map);
    const stepAt = new Set(events.steps.map((s) => s.y * map.w + s.x));
    const cells = new Array(map.w * map.h * 3);
    for (let y = 0; y < map.h; y++) {
        for (let x = 0; x < map.w; x++) {
            const i = y * map.w + x;
            cells[i * 3] = wordFor('A', map.cell('A', x, y));
            cells[i * 3 + 1] = wordFor('B', map.cell('B', x, y));
            cells[i * 3 + 2] = collisionWord(col.bytes[i * 4], col.bytes[i * 4 + 2], stepAt.has(i));
        }
    }
    const set = map.header.paletteSet;
    const families = palettes.map((p) => {
        const colours = Array.from(map.cgram.subarray(p * 16, p * 16 + 16), (c) => c & 0x7FFF);
        const n = set * 8 + p - 1;
        return { id: FAMILY_BASE + n, label: 'm' + n, paletteSet: set, palette: p, colours,
            graphics: used.has(p) ? used.get(p).size : 0 };
    });
    return {
        id, widthTiles: map.w, heightTiles: map.h,
        display: { tm: map.display.main, ts: map.display.sub, colorMath: map.display.math, colorWindow: 0x02 },
        cells,
        graphics: graphics.slots.map(encodeGraphic),
        families,
        stepOn: triggerBoxes(events.steps),
        onEnter: events.onEnter,
        objects: mana.mapObjects(manaRom, id).map((o) => ({ x: o.x, y: o.y, kind: o.kind })),
        stats: Object.assign(stats, { graphics: graphics.slots.length, stepCells: events.steps.length }),
    };
}

module.exports = { convertManaMap, collisionWord, encodeGraphic, triggerBoxes, slotChr };
