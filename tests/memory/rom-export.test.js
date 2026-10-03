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
  var sent = [];
  var vs = { postMessage: function (m) { sent.push(m); } };
  function editNote() {}
  function renderEditChrome() {}
  ${read('map-editor.js')}
  ${read('map-editor-stamps.js')}
  ${read('map-editor-rom-export.js')}
  return { editReset, editDraft, romExportPayload, editExportRom, editPlayRom, applyRomExportDone,
           sent: sent, setPalette: (p) => { _mtPalette = p; } };`)();

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

test('Play in emulator sends the same draft as Export ROM, under its own command', () => {
    const d = webview.editReset(0x34);
    webview.setPalette({ count: 0, entries: [] });
    d.blank = { widthTiles: 2, heightTiles: 2, floor: { layer1: 0xa800, layer2: 0xa800, collision: 0 } };
    webview.sent.length = 0;
    webview.editExportRom();
    webview.applyRomExportDone({ path: '/x.sfc' });
    webview.editPlayRom();
    webview.applyRomExportDone({ played: 'x.sfc' });
    assert.deepStrictEqual(webview.sent.map((m) => m.command), ['mapExportRom', 'mapPlayRom']);
    assert.deepStrictEqual(webview.sent[0].draft, webview.sent[1].draft);
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

    test('modelFromRom keeps the whole object area: every stamping block, and nothing past it', () => {
        // Comparing a rebuilt blob with the ROM from its start cannot see a
        // short or a long object area; measure the blob's own records instead.
        for (let id = 0; id < maps.MAX_ROOMS; id++) {
            const blob = maps.buildBlob(maps.modelFromRom(rom, id));
            const L = maps.parseBlobLayout(blob, 0);
            let end = L.objectArea;
            for (let i = 0; i < L.objectCount; i++) {
                const rec = L.objectArea + maps.read16(blob, L.section3 + 1 + i * 2);
                end = Math.max(end, rec + 1 + blob[rec] * 5);
                for (let s = 0; s < blob[rec]; s++) {
                    const ptr = maps.read16(blob, rec + 1 + s * 5 + 3);
                    const stamp = maps.parseObjectStamp(blob, L.objectArea, ptr);
                    assert.ok(stamp.valid, `room 0x${id.toString(16)} object ${i} state ${s}`);
                    end = Math.max(end, L.objectArea + ptr + stamp.byteLength);
                }
            }
            assert.strictEqual(blob.length, end, `room 0x${id.toString(16)}`);
        }
    });

    test('an object state descriptor\'s byte 0 is how long that state is held', () => {
        const room = maps.decodeRoom(rom, 0x00);
        assert.deepStrictEqual(room.objects[0].states.map((s) => s.hold), [4, 4, 4, 4, 4, 4]);
        assert.deepStrictEqual(room.objects[2].states.map((s) => s.hold), [0, 1, 1]);
    });

    test('palette sets: room 0x18 stores two, its script switches to 7, and the render follows MAP_PALETTE', () => {
        const { buildRoomMetatilePalette } = require('../../src/rooms/rendering/metatile-palette');
        const { withHeader } = require('../../src/rooms/rendering/header-overrides');
        const pal = buildRoomMetatilePalette(rom, 0x18, 'composite', 1, null);
        assert.strictEqual(pal.tileFamilies.length, 14);
        assert.deepStrictEqual(pal.familySets.scriptValues, [7], 'Thraxx\'s room writes MAP_PALETTE = 7');
        assert.strictEqual(pal.familySets.colors.length, 14);
        assert.strictEqual(buildRoomMetatilePalette(rom, 0x34, 'composite', 1, null).familySets, null, 'seven or fewer: no sets');
        const room = maps.decodeRoom(rom, 0x18);
        const white = withHeader(room, { mapPalette: 7 });
        assert.deepStrictEqual(white.tileFamilies, room.tileFamilies.slice(7));
        const px = (r) => Buffer.from(maps.renderRoomComposite(rom, r).data);
        assert.ok(!px(room).equals(px(white)), 'the map is drawn in other colours');
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

    // The cuttable layer (maps/custom-room.ts): Section 4 sources first,
    // one per (cuttable stamp, stamp beneath) pair, each cut to what it covers.
    test('a cuttable layer becomes vanilla-shaped grass records, each cut to the tile beneath', () => {
        const floorA = [0xa800, 0x05c6, 0x0000];
        const floorB = [0xa800, 0x05e4, 0x0000];
        const grass = [0xa800, 0x45c0, 0x000f];
        const cells2 = cells.slice();
        const set = (x, y, wds) => { const i = (y * W + x) * 3; cells2[i] = wds[0]; cells2[i + 1] = wds[1]; cells2[i + 2] = wds[2]; };
        set(2, 2, floorA); set(3, 2, floorA); set(4, 2, floorB);
        const cut = [[2, 2, ...grass], [3, 2, ...grass], [4, 2, ...grass]];
        const { rom: out, report } = buildExportRom(rom, { ...draft, cells: cells2, cut });
        assert.strictEqual(report.cuttable, 3);
        const room = maps.decodeRoom(out, BRIAN_ROOM);
        const g = room.cuttableGrass;
        assert.deepStrictEqual(g.tiles, [[2, 2], [3, 2], [4, 2]]);
        assert.deepStrictEqual(g.warnings, [], 'sources are entries 0..N-1 and the header counts them');
        // The same grass over two different floors is two sources.
        assert.strictEqual(g.table.sourceCount, 2);
        assert.ok(g.table.records.every((r) => r.steps === 1 && r.sequence.length === 1), 'vanilla 7-byte records');
        const S = room.metatileSlices;
        for (const [x, y] of g.tiles) {
            assert.strictEqual(room.layer2VramWords[y][x], grass[1], 'the room loads showing the grass');
            const dst = (g.table.swaps.get(room.layer1MetatileIds[y][x]) - room.baseMetatile) / 8;
            const want = x === 4 ? floorB : floorA;
            assert.deepStrictEqual([S.layer1[dst], S.layer2[dst], S.collision[dst]], want, `cutting (${x},${y})`);
        }
    });

    // Section 2 (maps/custom-animation.ts): a placed graphic vanilla animates
    // moves past Block 1 with a channel of its own, starting at the frame placed.
    test('placed animated graphics get Section 2 channels and play their vanilla cycle', () => {
        const index = maps.buildVanillaIndex(rom);
        const base = donor.tilePalette.length + donor.animatedTiles.length;
        const word = (slot, bits) => maps.tileSlotChr(slot) | (1 << 10) | bits;
        const cells3 = cells.slice();
        const set = (x, y, l1) => { const i = (y * W + x) * 3; cells3[i] = l1; };
        set(1, 1, word(base, 0)); set(2, 1, word(base, 0x4000)); set(1, 2, word(base + 1, 0));
        const { rom: out, report } = buildExportRom(rom, { ...draft, cells: cells3, graphics: [2743, 1856] });
        assert.strictEqual(report.animated, 2);
        const room = maps.decodeRoom(out, BRIAN_ROOM);
        assert.deepStrictEqual(room.animatedTiles, [2743, 1856], 'frame 0 of each channel is the graphic placed');
        const flame = index.animations.byFirst.get(2742);
        const at = flame.frames.indexOf(2743);
        assert.deepStrictEqual(room.animation[0].frames.map((f) => f.tileId),
            flame.frames.slice(at).concat(flame.frames.slice(0, at)), 'the cycle, from the placed frame');
        assert.deepStrictEqual(room.animation[1].frames.map((f) => f.tileId), [1856, 1857, 1858, 1859]);
        const ids = room.tilePalette.concat(room.animatedTiles);
        const shows = (x, y) => ids[maps.wordSlot(room.layer1VramWords[y][x])];
        assert.strictEqual(shows(1, 1), 2743);
        assert.strictEqual(shows(2, 1), 2743);
        assert.strictEqual(room.layer1VramWords[1][2] & 0x4000, 0x4000, 'the mirror bit is kept');
        assert.strictEqual(shows(1, 2), 1856);
        assert.ok(maps.wordSlot(room.layer1VramWords[1][1]) >= room.tilePalette.length, 'past Block 1: animated');
    });

    // The Animation tab's channels (map-editor-animations.js): exactly those
    // slots animate, at the tab's timing; the same graphic in another slot,
    // a frame picked on its own, stays still.
    test('explicit channels animate their slots at their timing; a still copy of the graphic stays still', () => {
        const base = donor.tilePalette.length + donor.animatedTiles.length;
        const word = (slot) => maps.tileSlotChr(slot) | (1 << 10);
        const cells4 = cells.slice();
        const set = (x, y, l1) => { const i = (y * W + x) * 3; cells4[i] = l1; };
        set(1, 1, word(base)); set(2, 1, word(base + 1));
        const channels = [{ slot: base, frames: [2742, 2743, 2744], delays: [4, 9, 2], init: 7 }];
        const { rom: out, report } = buildExportRom(rom, { ...draft, cells: cells4, graphics: [2742, 2742], channels });
        assert.strictEqual(report.animated, 1, 'one channel, not one per animated-looking graphic');
        const room = maps.decodeRoom(out, BRIAN_ROOM);
        assert.strictEqual(room.animation.length, 1);
        assert.deepStrictEqual(room.animation[0].frames.map((f) => [f.tileId, f.delay]), [[2742, 4], [2743, 9], [2744, 2]]);
        assert.strictEqual(room.animation[0].delay, 7, 'the initial countdown');
        const ids = room.tilePalette.concat(room.animatedTiles);
        assert.ok(maps.wordSlot(room.layer1VramWords[1][1]) >= room.tilePalette.length, 'the animated copy is past Block 1');
        assert.ok(maps.wordSlot(room.layer1VramWords[1][2]) < room.tilePalette.length, 'the still copy is in Block 1');
        assert.strictEqual(ids[maps.wordSlot(room.layer1VramWords[1][2])], 2742);
        // No channels at all: nothing moves, even graphics vanilla animates.
        const { report: none } = buildExportRom(rom, { ...draft, cells: cells4, graphics: [2742, 2742], channels: [] });
        assert.strictEqual(none.animated, 0);
    });

    test('the intro loads room 0x15 at the start marker; the Boy gets a spear, and the room fades in', () => {
        const { rom: out } = buildExportRom(rom, draft);
        const intro = script.decodeScript(out, INTRO_FIRST_CODE).instructions;
        assert.deepStrictEqual(Array.from(out.slice(0x12e0ca, 0x12e0ca + 6)), [0x22, 17, 15, 0x15, 0x00, 0x00]);
        assert.strictEqual(intro[0].opcode, 0x22);
        const enter = script.buildRoomScriptModel(out, BRIAN_ROOM).enter;
        assert.deepStrictEqual(enter.instructions.map((r) => r.opcode), [0x14, 0xa3, 0x00]);
        assert.match(enter.instructions[0].summary, /\$2441\) = .*\(0x18\)/, 'GAIN_WEAPON = SPEAR_4');
        assert.match(enter.instructions[1].summary, /0x36/);
    });

    test('header fields set on the Info tab are written; origin and size stay the map\'s', () => {
        const { rom: out } = buildExportRom(rom, { ...draft, header: { displayTm: 0x16, effectVariant: 1, param: 0x1234 } });
        const room = maps.decodeRoom(out, BRIAN_ROOM);
        assert.strictEqual(room.header.displayTm, 0x16, 'BG1 off');
        assert.strictEqual(room.header.effectVariant, 1);
        assert.strictEqual(maps.read16(out, room.romPointerFile + 9), 0x1234);
        assert.deepStrictEqual([room.header.originX, room.header.originY], [0, 0]);
        assert.strictEqual(room.header.widthTiles, draft.widthTiles);
        assert.strictEqual(room.header.subscreenTs, maps.decodeRoom(rom, 0x34).header.subscreenTs, 'unset fields are the donor\'s');
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

    // v0.65.2: the extension hands over its cached ROM as a Node Buffer, whose
    // `slice()` is a view. Setting the new map's size in a "copied" header
    // wrote 16x14 into the donor's header in that cache, and the second
    // export (and every render of room 0x34) failed.
    test('exporting from a Buffer leaves it untouched, and a second export works', () => {
        const buf = Buffer.from(rom);
        buildExportRom(buf, draft);
        buildExportRom(buf, draft);
        assert.ok(buf.equals(Buffer.from(rom)), 'the vanilla buffer changed');
        const model = maps.modelFromRom(buf, 0x34);
        model.header[2] = 1;
        assert.ok(buf.equals(Buffer.from(rom)), 'modelFromRom returned a view, not a copy');
    });

    test('Export ROM refuses anything but the 3 MB vanilla ROM', () => {
        assert.throws(() => buildExportRom(new Uint8Array(0x400000), draft), /vanilla ROM/);
    });

    test('a draft with the wrong number of words is refused, not guessed at', () => {
        assert.throws(() => buildExportRom(rom, { ...draft, cells: cells.slice(3) }), /expected/);
    });

    // A map smaller than one screen loads, but the engine's first tilemap
    // upload reads outside the grid unless the Boy starts top-left: the
    // scrambled screen of a 14x14 export (blank-room.ts MIN_WIDTH).
    test('a room smaller than one screen (16x14) is never drafted and never exported', () => {
        const small = (w, h) => ({ ...draft, widthTiles: w, heightTiles: h, cells: new Array(w * h * 3).fill(0), start: { x: 0, y: 0 } });
        assert.throws(() => buildExportRom(rom, small(14, 14)), /smaller than one screen/);
        assert.throws(() => buildExportRom(rom, small(16, 13)), /smaller than one screen/);
        assert.throws(() => buildExportRom(rom, small(15, 14)), /smaller than one screen/);
        const room = maps.blankRoom(rom, { widthTiles: 14, heightTiles: 2, borrowFrom: 0x34 });
        assert.deepStrictEqual([room.header.widthTiles, room.header.heightTiles], [16, 14], 'a smaller map opens at one screen');
        assert.deepStrictEqual(maps.roomProblems(room), []);
        const widget = maps.blankRoom(rom, { widthTiles: 1, heightTiles: 1, borrowFrom: 0x34, minTiles: 1 });
        assert.deepStrictEqual([widget.header.widthTiles, widget.header.heightTiles], [1, 1], 'a widget canvas may be 1x1');
        assert.deepStrictEqual(maps.roomProblems(widget, 1), []);
    });

    test('objects are encoded into Section 3 and transition in state 1', () => {
        const objDraft = {
            ...draft,
            objects: [{
                x: 2, y: 2, w: 2, h: 2, states: 2,
                frames: [{
                    '0,0': { layer1: 0x0005, layer2: 0x0000, collision: 0x0001 },
                    '1,0': { layer1: 0x0005, layer2: 0x0000, collision: 0x0001 },
                }],
            }],
        };
        const { rom: out } = buildExportRom(rom, objDraft);
        const room = maps.decodeRoom(out, BRIAN_ROOM);
        assert.strictEqual(room.objects.length, 1);
        assert.strictEqual(room.objects[0].maxState, 1);
        assert.strictEqual(room.objects[0].states[0].tileX, 2);
        assert.strictEqual(room.objects[0].states[0].tileY, 2);

        // Applying state 1 transforms the metatile at (2, 2)
        const morphed = maps.applyObjectStates(out, room, { 0: 1 });
        assert.notStrictEqual(morphed.layer1MetatileIds[2][2], room.layer1MetatileIds[2][2]);
    });

    test('every state of a custom object is reached in turn, with its holds', () => {
        // Frames are how the area looks in each state; the engine XORs each
        // descriptor into the state before it, so state 2 must not come out
        // as state 1's delta on top of state 2's.
        const at = (k) => ({ layer1: donor.metatileSlices.layer1[k], layer2: donor.metatileSlices.layer2[k],
            collision: donor.metatileSlices.collision[k] });
        const objDraft = {
            ...draft,
            objects: [{
                x: 5, y: 5, w: 2, h: 1, states: 3, holds: [0, 9],
                frames: [{ '0,0': at(3), '1,0': at(4) }, { '0,0': at(5) }],
            }],
        };
        const { rom: out } = buildExportRom(rom, objDraft);
        const room = maps.decodeRoom(out, BRIAN_ROOM);
        assert.deepStrictEqual(room.objects[0].states.map((s) => s.hold), [0, 9]);
        const words = (r, x, y) => [r.layer1VramWords[y][x], r.layer2VramWords[y][x], r.collisionWords[y][x]];
        const want = (w) => [w.layer1, w.layer2, w.collision];
        const s1 = maps.applyObjectStates(out, room, { 0: 1 });
        assert.deepStrictEqual(words(s1, 5, 5), want(at(3)));
        assert.deepStrictEqual(words(s1, 6, 5), want(at(4)));
        const s2 = maps.applyObjectStates(out, room, { 0: 2 });
        assert.deepStrictEqual(words(s2, 5, 5), want(at(5)));
        // Not in state 2's frame: back to the map's own.
        assert.deepStrictEqual(words(s2, 6, 5), words(room, 6, 5));
    });
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
