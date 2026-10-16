'use strict';
// A made-up Secret of Mana map for the page tests: 6x2 cells, a hand-made metatile sheet (metatile n is a
// solid colour, n=0 clear), collision, one step event, one object, an animation; map b1 also a cuttable bush,
// a strike cell, an exit and stairs. No ROM bytes.

const fs = require('fs');
const path = require('path');
const { encodePng } = require('../../dist/platform');

const tileColour = n => [(n * 23) % 256, 40 + n, 200 - n];

function sheetPng() {
    const w = 256, h = 192, rgba = new Uint8Array(w * h * 4);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const n = (y >> 4) * 16 + (x >> 4), i = (y * w + x) * 4;
        if (!n) continue;
        const c = tileColour(n);
        rgba[i] = c[0]; rgba[i + 1] = c[1]; rgba[i + 2] = c[2]; rgba[i + 3] = 255;
    }
    return encodePng(w, h, rgba);
}

const collision = new Array(192 * 4).fill(0);
collision[1 * 4] = 2; collision[2 * 4] = 2;       // metatiles 1, 2: level-2 floor
collision[3 * 4] = 3;                             // metatile 3: a wall
collision[4 * 4 + 1] = 0x87;                      // metatile 4: a special cell
// Map b1 also shows: 5 a bush cut by weapon type 1 into metatile 6, 7 a strike cell (event $6F8), 8 an exit
// back to the previous map, 9 stairs. All level-2 floor like the rest.
[[5, [2, 0, 0xC1, 6]], [6, [2, 0, 0, 0]], [7, [2, 0, 0xF8, 0x6F]], [8, [2, 0x10, 0, 0]], [9, [2, 0, 0x21, 0]]]
    .forEach(([n, c]) => c.forEach((b, k) => { collision[n * 4 + k] = b; }));

const edit = id => ({
    id, w: 6, h: 2, sizeB: null,
    a: id === 177 ? [1, 1, 1, 1, 1, 9, 2, 2, 2, 5, 7, 8] : [1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2], b: [],
    collision: { a: collision, b: new Array(768).fill(0) },
    backdrop: [10, 20, 30], lead: 0, ownEvent: false,
    events: { onEnter: null, steps: [{ x: 1, y: 0, event: 0x123 }] },
    // One record on its own cell, and two on (0, 1): the game spawns what their flags allow.
    objects: [{ index: 0, x: 2, y: 1, flags: 0, kind: 0xC001, bytes: [0, 0, 2, 1, 0, 0, 1, 0xC0] },
        { index: 1, x: 0, y: 1, flags: 0, kind: 0x420C, bytes: [0, 0, 0, 1, 0, 0, 0x0C, 0x42] },
        { index: 2, x: 0, y: 1, flags: 0, kind: 0x420D, bytes: [0, 0, 0, 1, 0, 0, 0x0D, 0x42] }],
    // One event-flag piece: cells (1,0) and (2,0) turn into metatile 3 from flag $10 = 6.
    pieces: [{ flag: 0x10, values: [0, 6], x: 1, y: 0, w: 2, h: 1, frames: [{ '0,0': { A: 3, B: -1 }, '1,0': { A: 3, B: -1 } }] }],
});

const INIT = {
    title: 'Test',
    maps: [{ id: 176, hex: 'b0', w: 6, h: 2, area: 'Wide' }, { id: 177, hex: 'b1', w: 6, h: 2, area: 'Wide' },
        { id: 178, hex: 'b2', w: 6, h: 2, area: null }],
    // b0 and b2 draw the same picture (b2 is listed under no area): one room with two variants, b1 a second room.
    areas: [{ name: 'Wide', slug: 'wide', maps: [176, 177], pictures: [[176, 178], [177]] }],
};

const anim = { length: 60, images: ['data:image/png;base64,AA==', 'data:image/png;base64,AQ=='],
    kinds: [{ cells: [[0, 0], [1, 0], [2, 0]], starts: [0, 30], frames: [0, 1] }] };

/** What the stub host answers for a `som://rom/` path, or null. */
function hostFile(p) {
    if (/^maps\/b[012]\.edit\.json$/.test(p)) return JSON.stringify(edit(p === 'maps/b1.edit.json' ? 177 : p === 'maps/b2.edit.json' ? 178 : 176));
    if (p === 'maps/b0.anim.json') return JSON.stringify(anim);
    if (/^maps\/b[01]\.collision\.json$/.test(p)) return null;
    return null;
}

/** A temp dir laid out like som://rom/ for the images the page loads (sheets, pictures); returns its path. */
function somDir() {
    const dir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'mana-som-'));
    fs.mkdirSync(path.join(dir, 'maps'));
    ['b0', 'b1', 'b2'].forEach(h => fs.writeFileSync(path.join(dir, 'maps', h + '.tiles.a.png'), sheetPng()));
    return dir;
}

module.exports = { INIT, tileColour, hostFile, somDir };
