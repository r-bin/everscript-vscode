'use strict';
// The room blob write path (src/maps/encode.ts, custom-room.ts) and Export
// ROM (src/rooms/rendering/rom-export.js, map-editor-rom-export.js).
//
// The encoder is a port of everscript/tools/encode_room.py, so it is held to
// upstream's own two checks — `--verify` (byte-exact container) and
// `--verify-rebuild` (re-encoded blocks decode back) — across all 127 rooms.
// The ROM tests skip, not fail, when the ROM is unavailable.

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const maps = require('../../src/maps');
const { decompressLzss } = require('../../src/maps/dist/lzss');
const { decompressMarkovGrid } = require('../../src/maps/dist/markov');

const EVERSCRIPT_REPO = process.env.EVERSCRIPT_REPO ||
    path.join(path.dirname(path.dirname(path.dirname(path.resolve(__dirname)))), 'everscript');
const ROM_PATH = process.env.EVERSCRIPT_ROM || path.join(EVERSCRIPT_REPO, 'Secret of Evermore (U) [!].smc');

let passed = 0;
let failed = 0;
function test(name, fn) {
    try { fn(); console.log('  ✓ ' + name); passed += 1; }
    catch (e) { console.log('  ✗ ' + name + '\n    ' + (e && e.message)); failed += 1; }
}

// ── ROM-free ────────────────────────────────────────────────────────────────

test('LZSS round-trips literals, repeats and self-overlapping runs', () => {
    const cases = [
        new Uint8Array(0),
        Uint8Array.from([1, 2, 3]),
        new Uint8Array(300).fill(0xaa),                       // self-overlapping
        Uint8Array.from({ length: 5000 }, (_, i) => (i * 7) % 13), // periodic, past the window
        Uint8Array.from({ length: 700 }, (_, i) => (i * 2654435761) >>> 24),
    ];
    for (const raw of cases) {
        const packed = maps.lzssCompress(raw);
        const back = decompressLzss(packed, 0, raw.length);
        assert.deepStrictEqual(Array.from(back.slice(0, raw.length)), Array.from(raw));
    }
});

test('wrapBlock keeps raw when LZSS would not be smaller', () => {
    const noise = Uint8Array.from([0x13, 0x37, 0xc0, 0xde]);
    assert.strictEqual(maps.wrapBlock(noise, true).sub, maps.SUB_RAW);
    assert.strictEqual(maps.wrapBlock(new Uint8Array(400), true).sub, maps.SUB_LZSS);
});

test('Markov grid round-trips a first-appearance-ordered grid', () => {
    const w = 6, h = 5, base = w * h * 2;
    const order = [0, 0, 1, 1, 2, 0, 3, 3, 3, 1, 0, 4, 2, 2, 4, 0, 1, 5, 5, 5, 0, 0, 1, 2, 3, 4, 5, 6, 0, 6];
    const grid = order.map((i) => base + i * 8);
    const stream = maps.encodeMarkovGrid(grid, w, h, base, 0);
    assert.deepStrictEqual(decompressMarkovGrid(stream, 0, w, h, base, 0), grid);
});

test('Markov encoder refuses a grid that introduces ids out of order', () => {
    const w = 2, h = 2, base = 8;
    assert.throws(() => maps.encodeMarkovGrid([base + 16, base, base, base], w, h, base, 0), /ascending order/);
});

test('writeRoomAt refuses the lower half of a bank and a bank crossing', () => {
    const rom = new Uint8Array(0x400000);
    assert.throws(() => maps.writeRoomAt(rom, 0x15, new Uint8Array(4), 0x3d0000), /lower half/);
    assert.throws(() => maps.writeRoomAt(rom, 0x15, new Uint8Array(0x8001), 0x3d8000), /bank boundary/);
    maps.writeRoomAt(rom, 0x15, Uint8Array.from([1, 2]), 0x3d8000);
    const e = maps.MAP_LIST_ADDR + 0x15 * 4;
    assert.deepStrictEqual(Array.from(rom.slice(e, e + 3)), [0x00, 0x80, 0xbd]);
});

// ── the webview payload ─────────────────────────────────────────────────────

const WEBVIEW = path.join(__dirname, '..', '..', 'src', 'rooms', 'webview');
const read = (f) => fs.readFileSync(path.join(WEBVIEW, f), 'utf8');
const webview = new Function(`
  var _mtPalette = null;
  var _customActive = null;
  ${read('map-editor.js')}
  ${read('map-editor-stamps.js')}
  ${read('map-editor-rom-export.js')}
  return { editReset, editDraft, romExportPayload, setPalette: (p) => { _mtPalette = p; } };`)();

test('the payload resolves painted cells to their words and the rest to the empty stamp', () => {
    const d = webview.editReset(0x34);
    webview.setPalette({ count: 2, entries: [[0, 0x11, 0x12, 0x13, 0], [1, 0x21, 0x22, 0x23, 0]] });
    d.added.push({ layer1: 0x31, layer2: 0x32, collision: 0x33 });
    d.blank = { widthTiles: 3, heightTiles: 2, floor: { layer1: 0xa800, layer2: 0xa800, collision: 0 } };
    d.cells = { '1,0': 1, '2,1': 2 };
    d.start = { x: 2, y: 1 };
    d.addedGraphics = [0x777];
    d.families = [0x23];
    const p = webview.romExportPayload({});
    assert.strictEqual(p.borrowFrom, 0x34);
    assert.deepStrictEqual(p.cells, [
        0xa800, 0xa800, 0, 0x21, 0x22, 0x23, 0xa800, 0xa800, 0,
        0xa800, 0xa800, 0, 0xa800, 0xa800, 0, 0x31, 0x32, 0x33,
    ]);
    assert.deepStrictEqual(p.start, { x: 2, y: 1 });
    assert.deepStrictEqual(p.graphics, [0x777]);
    assert.deepStrictEqual(p.families, [0x23]);
});

test('a ROM room draft is not exportable', () => {
    webview.editReset(0x34);
    webview.setPalette({ count: 0, entries: [] });
    const why = {};
    assert.strictEqual(webview.romExportPayload(why), null);
    assert.match(why.text, /custom map/);
});

// ── against the ROM ─────────────────────────────────────────────────────────

if (!fs.existsSync(ROM_PATH)) {
    console.log(`SKIP rom-export ROM checks: ${ROM_PATH} not found`);
} else {
    const rom = new Uint8Array(fs.readFileSync(ROM_PATH));
    const script = require('../../src/script');
    const { buildExportRom, BRIAN_ROOM, INTRO_FIRST_CODE } = require('../../src/rooms/rendering/rom-export');

    test('buildBlob(modelFromRom()) is byte-exact for all 127 rooms (upstream --verify)', () => {
        for (let id = 0; id < maps.MAX_ROOMS; id++) {
            const off = maps.roomBlobOffset(rom, id);
            const blob = maps.buildBlob(maps.modelFromRom(rom, id));
            assert.ok(Buffer.from(blob).equals(Buffer.from(rom.slice(off, off + blob.length))), `room 0x${id.toString(16)}`);
        }
    });

    test('re-encoded Blocks 1-3 decode back for all 127 rooms (upstream --verify-rebuild)', () => {
        for (let id = 0; id < maps.MAX_ROOMS; id++) {
            const model = maps.modelFromRom(rom, id);
            const room = maps.decodeRoom(rom, id);
            const tag = `room 0x${id.toString(16)}`;
            const b1 = maps.encodeBlock1(room.tilePalette, true);
            assert.ok(Buffer.from(maps.unpackBlock(b1)).equals(Buffer.from(maps.unpackBlock(model.block1))), tag + ' block 1');
            const w = room.header.widthTiles, h = room.header.heightTiles;
            const fc4 = maps.parseBlobLayout(rom, maps.roomBlobOffset(rom, id)).fc4;
            const grid = [].concat(...room.layer1MetatileIds);
            const b2 = maps.encodeBlock2(grid, w, h, room.baseMetatile, fc4);
            assert.deepStrictEqual(decompressMarkovGrid(b2.data, 0, w, h, room.baseMetatile, fc4), grid, tag + ' block 2');
            const raw = maps.unpackBlock(model.block3);
            assert.ok(Buffer.from(maps.unpackBlock(maps.wrapBlock(raw, true))).equals(Buffer.from(raw)), tag + ' block 3');
        }
    });

    // A 16x14 map on the default donor: empty, with a painted patch.
    const donor = maps.decodeRoom(rom, 0x34);
    const empty = maps.emptyStamp(donor);
    const W = 16, H = 14;
    const cells = [];
    for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
            if (x > 3 && x < 12 && y > 3 && y < 10) {
                const k = (x * 7 + y) % donor.metatileCount;
                cells.push(donor.metatileSlices.layer1[k], donor.metatileSlices.layer2[k], donor.metatileSlices.collision[k]);
            } else {
                cells.push(empty.layer1, empty.layer2, empty.collision);
            }
        }
    }
    const draft = { borrowFrom: 0x34, widthTiles: W, heightTiles: H, cells, start: { x: 8, y: 7 } };

    test('Export ROM puts the map in room 0x15, and it decodes to the draft', () => {
        const { rom: out, report } = buildExportRom(rom, draft);
        assert.strictEqual(out.length, 0x400000);
        assert.strictEqual(report.blobAddress, 0xbd8000);
        const room = maps.decodeRoom(out, BRIAN_ROOM);
        assert.strictEqual(room.header.widthTiles, W);
        assert.strictEqual(room.header.heightTiles, H);
        for (let i = 0; i < W * H; i++) {
            const x = i % W, y = Math.floor(i / W);
            assert.deepStrictEqual(
                [room.layer1VramWords[y][x], room.layer2VramWords[y][x], room.collisionWords[y][x]],
                cells.slice(i * 3, i * 3 + 3), `cell ${x},${y}`);
        }
        // Every other room is untouched.
        for (const id of [0x14, 0x16, 0x34, 0x76]) {
            assert.strictEqual(maps.roomBlobOffset(out, id), maps.roomBlobOffset(rom, id));
        }
    });

    test('the intro loads room 0x15 at the start marker, and the room fades in', () => {
        const { rom: out } = buildExportRom(rom, draft);
        const intro = script.decodeScript(out, INTRO_FIRST_CODE).instructions;
        assert.deepStrictEqual(Array.from(out.slice(0x12e0ca, 0x12e0ca + 6)), [0x22, 17, 15, 0x15, 0x00, 0x00]);
        assert.strictEqual(intro[0].opcode, 0x22);
        const enter = script.buildRoomScriptModel(out, BRIAN_ROOM).enter;
        assert.deepStrictEqual(enter.instructions.map((r) => r.opcode), [0xa3, 0x00]);
        assert.match(enter.instructions[0].summary, /0x36/);
    });

    test('the header checksum is valid', () => {
        const { rom: out } = buildExportRom(rom, draft);
        const sum = out[0xffde] | (out[0xffdf] << 8);
        const inv = out[0xffdc] | (out[0xffdd] << 8);
        assert.strictEqual(sum ^ inv, 0xffff);
        let total = 0;
        for (let i = 0; i < out.length; i++) total = (total + out[i]) & 0xffff;
        assert.strictEqual(total, sum);
    });

    test('Export ROM refuses anything but the 3 MB vanilla ROM', () => {
        assert.throws(() => buildExportRom(new Uint8Array(0x400000), draft), /vanilla ROM/);
    });

    test('a draft with the wrong number of words is refused, not guessed at', () => {
        assert.throws(() => buildExportRom(rom, { ...draft, cells: cells.slice(3) }), /expected/);
    });
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
