'use strict';
// Ownership: an Evermore ROM image with one converted room in it — the user's Evermore
// ROM, copied, plus the room's graphics, its families' colours and its blob (ids.js says
// where). Built in memory, never written to disk. Every Evermore reader then sees an
// ordinary room: decodeRoom, the renderer, the collision overlay, the tile palette.
//
// The blob is made with Evermore's own encoder (src/maps encode.ts), so the room is real
// Evermore data: a grid of stamps numbered by first appearance (the order the Markov
// encoder accepts, custom-room.ts), the dictionary, Block 1, step-on triggers.

const maps = require('../maps');
const ids = require('./ids');

/** Header bytes 11-12 are not known; they are copied from this vanilla room. */
const HEADER_DONOR = 0x34;

function dictionary(room) {
    const w = room.widthTiles, h = room.heightTiles, base = w * h * 2;
    const key = new Map(), l1 = [], l2 = [], cw = [], grid = new Array(w * h);
    for (let i = 0; i < w * h; i++) {
        const k = room.cells[i * 3] + ',' + room.cells[i * 3 + 1] + ',' + room.cells[i * 3 + 2];
        let n = key.get(k);
        if (n === undefined) {
            n = l1.length;
            key.set(k, n);
            l1.push(room.cells[i * 3]); l2.push(room.cells[i * 3 + 1]); cw.push(room.cells[i * 3 + 2]);
        }
        grid[i] = base + n * 8;
    }
    return { base, l1, l2, cw, grid };
}

function header(soeRom, room) {
    const donor = maps.modelFromRom(soeRom, HEADER_DONOR).header;
    const h = Uint8Array.from(donor);
    h[0] = 0; h[1] = 0;                         // trigger origin: boxes are in map cells
    h[2] = room.widthTiles; h[3] = room.heightTiles;
    h[4] = room.display.tm; h[5] = room.display.ts;
    h[6] = room.display.colorMath; h[7] = room.display.colorWindow;
    h[8] = 0; h[9] = 0; h[10] = 0;              // no effect
    return h;
}

/** The blob for a converted room, and what it costs against Evermore's budgets. */
function buildRoomBlob(soeRom, room) {
    const d = dictionary(room);
    const model = {
        header: header(soeRom, room),
        stepOn: room.stepOn.map((t) => ({ y1: t.y1, x1: t.x1, y2: t.y2, x2: t.x2, scriptId: t.scriptId & 0xFFFF })),
        bTrigger: [],
        tileFamilies: room.families.map((f) => f.id),
        extras: new Uint8Array(0),
        block1: maps.encodeBlock1(room.graphics.map((_, i) => ids.GRAPHIC_BASE + i), true),
        section2Count: 0,
        section2Data: Uint8Array.from([0xFF]),
        objectOffsets: [],
        block2: maps.encodeBlock2(d.grid, room.widthTiles, room.heightTiles, d.base, 0),
        section4: Uint8Array.from([0x00]),
        block3: maps.encodeBlock3(d.l1, d.l2, d.cw, true),
        objectArea: new Uint8Array(0),
    };
    return { blob: maps.buildBlob(model), metatileCount: d.l1.length, wramBytes: d.base + d.l1.length * 8 };
}

/**
 * The image: `soeRom` (a stock-size Evermore ROM) with `room` in slot ids.ROOM_SLOT.
 * Its length differs per map (`salt`), so caches keyed on a ROM fingerprint never mix
 * two converted rooms.
 */
function buildVirtualRom(soeRom, room, salt) {
    if (soeRom.length > ids.ROM_END) throw new Error('an expanded Evermore ROM leaves no room for converted maps');
    const rom = new Uint8Array(ids.IMAGE_SIZE + (salt & 0xFFF));
    rom.set(soeRom.subarray(0, ids.ROM_END));
    room.graphics.forEach((g, i) => {
        const at = ids.GRAPHIC_DATA + i * 129;
        rom[at] = 0x3F;                         // uncompressed: 64 words ($8CC8B0)
        rom.set(g, at + 1);
        const ptr = ids.GRAPHIC_TABLE + (ids.GRAPHIC_BASE + i) * 3, bus = 0xC00000 | at;
        rom[ptr] = bus & 0xFF; rom[ptr + 1] = (bus >> 8) & 0xFF; rom[ptr + 2] = bus >> 16;
    });
    for (const f of room.families) {
        const at = ids.PALETTE_TABLE + f.id * 32;
        f.colours.forEach((c, k) => { rom[at + k * 2] = c & 0xFF; rom[at + k * 2 + 1] = c >> 8; });
    }
    const built = buildRoomBlob(soeRom, room);
    if (built.blob.length > ids.BLOB_MAX) throw new Error(`the converted room needs ${built.blob.length} bytes, one bank half holds ${ids.BLOB_MAX}`);
    maps.writeRoomAt(rom, ids.ROOM_SLOT, built.blob, ids.BLOB_AT);
    return { rom, roomId: ids.ROOM_SLOT, blobBytes: built.blob.length, metatileCount: built.metatileCount, wramBytes: built.wramBytes };
}

module.exports = { buildVirtualRom, buildRoomBlob };
