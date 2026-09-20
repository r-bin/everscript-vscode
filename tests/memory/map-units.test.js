'use strict';
// Unit tests for the map decoder/renderer modules in isolation.
//
// map-parity.test.js proves the whole pipeline matches the Python
// implementation, but only end to end — two compensating bugs could cancel out
// and still pass on the sampled rooms. These assert the individual invariants
// directly, and need neither a ROM nor the everscript checkout.

const assert = require('assert');
const maps = require('../../src/maps');

let passed = 0, failed = 0;
function test(name, fn) {
    try { fn(); console.log('  ✓ ' + name); passed++; }
    catch (e) { console.error('  ✗ ' + name + '\n    ' + e.message); failed++; }
}

// ── rom.ts ──────────────────────────────────────────────────────────────────

test('snesToRom masks to the 4MB ROM window', () => {
    assert.strictEqual(maps.snesToRom(0xc00000), 0x000000);
    assert.strictEqual(maps.snesToRom(0x9ffde7), 0x1ffde7);
    assert.strictEqual(maps.snesToRom(0xffffff), 0x3fffff);
});

test('read16/read24 are little-endian', () => {
    const rom = Uint8Array.from([0x34, 0x12, 0x9a, 0x78, 0x56]);
    assert.strictEqual(maps.read16(rom, 0), 0x1234);
    assert.strictEqual(maps.read24(rom, 2), 0x56789a);
});

test('hex formats fixed width uppercase', () => {
    assert.strictEqual(maps.hex(0x2a, 4), '0x002A');
    assert.strictEqual(maps.hex(0xffff, 4), '0xFFFF');
});

// ── palette.ts ──────────────────────────────────────────────────────────────

function romWithPalette(familyId, colors16) {
    // Palette table lives at ROM 0x1CC322, 32 bytes per family.
    const rom = new Uint8Array(0x200000);
    const base = 0x1cc322 + familyId * 32;
    colors16.forEach((c, i) => {
        rom[base + i * 2] = c & 0xff;
        rom[base + i * 2 + 1] = (c >> 8) & 0xff;
    });
    return rom;
}

test('palette colour 0 is transparent, 1..15 opaque', () => {
    const pal = maps.extractTileFamilyPalette(romWithPalette(0, new Array(16).fill(0x7fff)), 0);
    assert.strictEqual(pal.length, 16);
    assert.strictEqual(pal[0][3], 0, 'colour 0 must be transparent');
    for (let i = 1; i < 16; i++) assert.strictEqual(pal[i][3], 255, 'colour ' + i + ' must be opaque');
});

test('BGR555 expands to 8-bit with (c<<3)|(c>>2)', () => {
    // 0x7FFF = all channels 0x1F -> 0xFF. 0x001F = red only.
    const pal = maps.extractTileFamilyPalette(romWithPalette(0, [0, 0x7fff, 0x001f, 0x03e0, 0x7c00]), 0);
    assert.deepStrictEqual(pal[1].slice(0, 3), [255, 255, 255], 'white');
    assert.deepStrictEqual(pal[2].slice(0, 3), [255, 0, 0], 'red is bits 0..4');
    assert.deepStrictEqual(pal[3].slice(0, 3), [0, 255, 0], 'green is bits 5..9');
    assert.deepStrictEqual(pal[4].slice(0, 3), [0, 0, 255], 'blue is bits 10..14');
});

test('a 5-bit channel of 1 expands to 8 (not 0)', () => {
    const pal = maps.extractTileFamilyPalette(romWithPalette(0, [0, 0x0001]), 0);
    assert.strictEqual(pal[1][0], (1 << 3) | (1 >> 2));
});

test('CGRAM build yields 8 sub-palettes, slot 0 the system default', () => {
    const rom = romWithPalette(3, new Array(16).fill(0x7fff));
    const pals = maps.buildRoomCgramPalettes(rom, [3]);
    assert.strictEqual(pals.length, 8);
    assert.strictEqual(pals[0][1][3], 255, 'palette 0 entries opaque');
    assert.deepStrictEqual(pals[1][1].slice(0, 3), [255, 255, 255], 'family 3 lands in slot 1');
    assert.deepStrictEqual(pals[7][1].slice(0, 3), [0, 0, 0], 'unused slots are the empty palette');
});

// ── chr.ts ──────────────────────────────────────────────────────────────────

/** A 128-byte tile whose first sub-tile row 0 has a known bit pattern. */
function tileWithTopLeftPixel() {
    const t = new Uint8Array(128);
    // Sub-tile 0, row 0: set bit 7 (leftmost pixel) in all four bitplanes -> index 15.
    t[0] = 0x80;   // plane 0
    t[1] = 0x80;   // plane 1
    t[16] = 0x80;  // plane 2
    t[17] = 0x80;  // plane 3
    return t;
}

test('decodeTilePixels returns 256 indices within 0..15', () => {
    const px = maps.decodeTilePixels(tileWithTopLeftPixel());
    assert.strictEqual(px.length, 256);
    for (const v of px) assert.ok(v >= 0 && v <= 15, 'index out of range: ' + v);
});

test('all four bitplanes set gives palette index 15', () => {
    const px = maps.decodeTilePixels(tileWithTopLeftPixel());
    assert.strictEqual(px[0], 15, 'top-left pixel');
    assert.strictEqual(px[1], 0, 'neighbour untouched');
});

test('bitplane weighting is 1/2/4/8', () => {
    const t = new Uint8Array(128);
    t[1] = 0x80;               // plane 1 only -> index 2
    assert.strictEqual(maps.decodeTilePixels(t)[0], 2);
    const u = new Uint8Array(128);
    u[17] = 0x80;              // plane 3 only -> index 8
    assert.strictEqual(maps.decodeTilePixels(u)[0], 8);
});

test('hflip mirrors across x, vflip across y, both across the corner', () => {
    const t = tileWithTopLeftPixel();
    assert.strictEqual(maps.decodeTilePixels(t, true, false)[15], 15, 'hflip -> top-right');
    assert.strictEqual(maps.decodeTilePixels(t, false, true)[15 * 16], 15, 'vflip -> bottom-left');
    assert.strictEqual(maps.decodeTilePixels(t, true, true)[15 * 16 + 15], 15, 'both -> bottom-right');
});

test('hflip mirrors every pixel, not just the corners', () => {
    // A single set corner only proves one pixel moved. Use an asymmetric tile
    // and check the whole grid against its mirror.
    const t = new Uint8Array(128);
    for (let i = 0; i < 128; i++) t[i] = (i * 37) & 0xff;
    const plain = maps.decodeTilePixels(t);
    const h = maps.decodeTilePixels(t, true, false);
    const v = maps.decodeTilePixels(t, false, true);
    for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
            assert.strictEqual(h[y * 16 + x], plain[y * 16 + (15 - x)], 'hflip at ' + x + ',' + y);
            assert.strictEqual(v[y * 16 + x], plain[(15 - y) * 16 + x], 'vflip at ' + x + ',' + y);
        }
    }
});

test('CHR mode 1 (uncompressed) fills 128 bytes and repeats the last word', () => {
    // Pointer table at 0x2E0000, 3 bytes per tile id -> data address.
    const rom = new Uint8Array(0x400000);
    const dataAddr = 0x300000;
    rom[0x2e0000] = dataAddr & 0xff;
    rom[0x2e0001] = (dataAddr >> 8) & 0xff;
    rom[0x2e0002] = (dataAddr >> 16) & 0xff;
    rom[dataAddr] = 0x01;          // bit 7 clear -> mode 1, (1 & 0x7F) + 1 = 2 words
    rom[dataAddr + 1] = 0xaa; rom[dataAddr + 2] = 0xbb;
    rom[dataAddr + 3] = 0xcc; rom[dataAddr + 4] = 0xdd;

    const out = maps.decompressTile16x16(rom, 0);
    assert.strictEqual(out.length, 128);
    assert.deepStrictEqual(Array.from(out.slice(0, 4)), [0xaa, 0xbb, 0xcc, 0xdd]);
    assert.deepStrictEqual(Array.from(out.slice(4, 6)), [0xcc, 0xdd], 'last word repeats to fill');
    assert.deepStrictEqual(Array.from(out.slice(126, 128)), [0xcc, 0xdd]);
});

// ── collision.ts ────────────────────────────────────────────────────────────

test('tilePlane reads bits 5..4', () => {
    assert.strictEqual(maps.tilePlane(0x0000), 0);
    assert.strictEqual(maps.tilePlane(0x0010), 1);
    assert.strictEqual(maps.tilePlane(0x0020), 2);
    assert.strictEqual(maps.tilePlane(0x0030), 3);
});

test('passability: open stays open, solid stays solid on the same plane', () => {
    assert.strictEqual(maps.passability(0x0000, 0), maps.OPEN);
    assert.strictEqual(maps.passability(0x000f, 0), maps.SOLID);
});

test('always-walkable (bit 13) forces geometry open on its own plane', () => {
    assert.strictEqual(maps.passability(0x200f, 0), maps.OPEN);
    assert.ok(maps.isAlwaysWalkable(0x2000));
});

test('plane-transparent (bit 6) is open from a different plane', () => {
    // Tile on plane 0, transparent; entity on plane 1 walks through.
    assert.strictEqual(maps.passability(0x004f, 1), maps.OPEN);
    // Same plane keeps the tile's own geometry.
    assert.strictEqual(maps.passability(0x004f, 0), 0x0f);
});

test('entity gates block the documented entities', () => {
    assert.strictEqual(maps.entityGate(0x0000), -1, 'bit 8 clear -> no gate');
    assert.strictEqual(maps.entityGate(0x0300), 3);
    assert.strictEqual(maps.passability(0x0300, 0, 'other'), maps.SOLID, 'gate 3 blocks others');
    assert.strictEqual(maps.passability(0x0500, 0, 'dog'), maps.SOLID, 'gate 5 blocks the dog');
    assert.strictEqual(maps.passability(0x0700, 0, 'boy'), maps.SOLID, 'gate 7 blocks the boy');
});

test('driftVector maps the eight compass handlers, and shear separately', () => {
    assert.deepStrictEqual(maps.driftVector(0x2008), { dx: 0, dy: -2, name: 'N' });
    assert.deepStrictEqual(maps.driftVector(0x200a), { dx: 2, dy: 0, name: 'E' });
    assert.deepStrictEqual(maps.driftVector(0x200f), { dx: 0, dy: 2, name: 'S' });
    assert.strictEqual(maps.driftVector(0x2001).name, 'SHEAR+');
    assert.strictEqual(maps.driftVector(0x2002).name, 'SHEAR-');
    assert.strictEqual(maps.driftVector(0x0008).name, '', 'no drift without bit 13');
});

test('geometryMask: 0x0F all solid, 0x00 all open, 0x03 bottom half', () => {
    const full = maps.geometryMask(0x0f);
    const none = maps.geometryMask(0x00);
    const bottom = maps.geometryMask(0x03);
    assert.strictEqual(full.length, 256);
    assert.ok(Array.from(full).every((v) => v === 1));
    assert.ok(Array.from(none).every((v) => v === 0));
    assert.strictEqual(bottom[7 * 16], 0, 'row 7 open');
    assert.strictEqual(bottom[8 * 16], 1, 'row 8 solid');
});

test('planesUsed is sorted and deduplicated', () => {
    assert.deepStrictEqual(maps.planesUsed([[0x0030, 0x0000], [0x0010, 0x0030]]), [0, 1, 3]);
});

// ── cuttable-grass.ts ───────────────────────────────────────────────────────

test('grass section with no records yields an empty table', () => {
    // section_len = 1, source_count = 0
    const rom = Uint8Array.from([0x01, 0x00, 0x00, 0x00, 0x00]);
    const t = maps.parseGrassSwapSection(rom, 0);
    assert.strictEqual(t.sourceCount, 0);
    assert.strictEqual(t.swaps.size, 0);
    assert.strictEqual(t.truncated, false);
});

test('grass swap keeps the first record when sources repeat', () => {
    // len, count, then: steps, seq words terminated by 0x0000
    const bytes = [
        0x0c, 0x00,       // section_len = 12
        0x01,             // source_count
        0x05, 0x10, 0x20, 0x30, 0x40, 0x00, 0x00, // steps=5, source=0x2010, seq=[0x4030]
        0x07, 0x10, 0x20, 0x99, 0x99, 0x00, 0x00, // duplicate source, later record
    ];
    const t = maps.parseGrassSwapSection(Uint8Array.from(bytes), 0);
    assert.strictEqual(t.swaps.get(0x2010), 0x4030, 'first record wins');
    assert.ok(t.records.length >= 1);
});

test('findCuttableGrassTiles returns coords sorted by x then y', () => {
    const table = { swaps: new Map([[0x1000, 0x2000]]) };
    const grid = [
        [0x0000, 0x1000],
        [0x1000, 0x0000],
    ];
    assert.deepStrictEqual(maps.findCuttableGrassTiles(table, grid), [[0, 1], [1, 0]]);
});

// ── room.ts validation (non-stock / patched ROMs) ───────────────────────────

test('decodeRoom rejects an out-of-range room id', () => {
    const rom = new Uint8Array(0x400000);
    assert.throws(() => maps.decodeRoom(rom, -1), /out of range/);
    assert.throws(() => maps.decodeRoom(rom, 127), /out of range/);
    assert.throws(() => maps.decodeRoom(rom, 1.5), /out of range/);
});

test('decodeRoom rejects a ROM too small to hold the pointer table', () => {
    assert.throws(() => maps.decodeRoom(new Uint8Array(1024), 0), /ROM too small/);
});

test('decodeRoom rejects a pointer that lands past the end of the ROM', () => {
    // Pointer table present, but the entry points beyond the buffer.
    const rom = new Uint8Array(0x200100);
    const e = 0x1ffde7;
    rom[e] = 0xff; rom[e + 1] = 0xff; rom[e + 2] = 0x3f; // -> 0x3FFFFF, past end
    assert.throws(() => maps.decodeRoom(rom, 0), /past the end of the ROM/);
});

test('decodeRoom rejects a zero-sized room header', () => {
    const rom = new Uint8Array(0x400000);
    const e = 0x1ffde7;
    const blob = 0x100000;
    rom[e] = blob & 0xff; rom[e + 1] = (blob >> 8) & 0xff; rom[e + 2] = (blob >> 16) & 0xff;
    // width/height at blob+2/+3 stay 0.
    assert.throws(() => maps.decodeRoom(rom, 0), /metatiles/);
});

// ── render.ts ───────────────────────────────────────────────────────────────

test('renderVramLayer produces a correctly sized RGBA buffer', () => {
    const rom = new Uint8Array(0x400000);
    const room = {
        header: { widthTiles: 2, heightTiles: 3, displayTm: 0x17, subscreenTs: 0, colorMath: 0 },
        tileFamilies: [], tilePalette: [], animatedTiles: [],
        layer1VramWords: [[0, 0], [0, 0], [0, 0]],
        layer2VramWords: [[0, 0], [0, 0], [0, 0]],
    };
    const img = maps.renderVramLayer(rom, room, room.layer1VramWords);
    assert.strictEqual(img.width, 32);
    assert.strictEqual(img.height, 48);
    assert.strictEqual(img.data.length, 32 * 48 * 4);
});

test('composite falls back to the backdrop where no layer is enabled', () => {
    const room = {
        header: { widthTiles: 1, heightTiles: 1, displayTm: 0x00, subscreenTs: 0, colorMath: 0 },
        layer1VramWords: [[0]], layer2VramWords: [[0]],
    };
    const blank = { width: 16, height: 16, data: new Uint8Array(16 * 16 * 4) };
    const out = maps.compositeLayers(room, blank, blank, { backdrop: [9, 8, 7, 255] });
    assert.deepStrictEqual(Array.from(out.data.slice(0, 4)), [9, 8, 7, 255]);
});

test('composite prefers BG1 over BG2 at equal priority', () => {
    const room = {
        header: { widthTiles: 1, heightTiles: 1, displayTm: 0x03, subscreenTs: 0, colorMath: 0 },
        layer1VramWords: [[0]], layer2VramWords: [[0]],
    };
    const mk = (r, g, b) => {
        const d = new Uint8Array(16 * 16 * 4);
        for (let i = 0; i < d.length; i += 4) { d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = 255; }
        return { width: 16, height: 16, data: d };
    };
    // l1 is BG2 (canopy), l2 is BG1 (terrain) — BG1 wins the main screen.
    const out = maps.compositeLayers(room, mk(10, 0, 0), mk(0, 20, 0));
    assert.deepStrictEqual(Array.from(out.data.slice(0, 3)), [10, 0, 0]);
});

// ── png.ts ──────────────────────────────────────────────────────────────────

test('encodePng emits a valid signature, IHDR dimensions and IEND', () => {
    const img = { width: 3, height: 2, data: new Uint8Array(3 * 2 * 4) };
    const png = maps.encodePng(img);
    assert.deepStrictEqual(Array.from(png.slice(0, 8)), [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    assert.strictEqual(png.slice(12, 16).toString('ascii'), 'IHDR');
    assert.strictEqual(png.readUInt32BE(16), 3, 'width');
    assert.strictEqual(png.readUInt32BE(20), 2, 'height');
    assert.strictEqual(png[24], 8, 'bit depth');
    assert.strictEqual(png[25], 6, 'colour type RGBA');
    assert.strictEqual(png.slice(-8, -4).toString('ascii'), 'IEND');
});

test('encodePngDataUri is a base64 png data URI', () => {
    const uri = maps.encodePngDataUri({ width: 1, height: 1, data: new Uint8Array(4) });
    assert.ok(uri.startsWith('data:image/png;base64,'));
    assert.ok(uri.length > 'data:image/png;base64,'.length);
});

// ── font.ts ─────────────────────────────────────────────────────────────────

/** A blank RGBA buffer plus a helper to ask whether a pixel got inked. */
function inkCanvas(w, h) {
    const buf = new Uint8Array(w * h * 4);
    return { buf, lit: (x, y) => buf[(y * w + x) * 4 + 3] !== 0 };
}

test('drawString3x5 inks the glyph bitmap and its 1px shadow', () => {
    const { buf, lit } = inkCanvas(16, 16);
    maps.drawString3x5(buf, 16, 2, 2, '1');
    // '1' is "010/110/010/010/111": (1,0) set, (0,0) clear.
    assert.ok(lit(3, 2), 'glyph pixel');
    assert.ok(!lit(2, 2), 'glyph gap stays clear');
    assert.ok(lit(4, 3), 'shadow is offset by one pixel');
    // Ink is white, shadow black — the shadow is what keeps it readable.
    assert.strictEqual(buf[(2 * 16 + 3) * 4], 255);
    assert.strictEqual(buf[(3 * 16 + 4) * 4], 0);
});

test('drawString3x5 clips rather than wrapping at the right edge', () => {
    const { buf, lit } = inkCanvas(8, 8);
    maps.drawString3x5(buf, 8, 7, 0, '8', [255, 255, 255, 255], null);
    assert.ok(lit(7, 0), 'the column that fits is drawn');
    for (let y = 0; y < 8; y++) assert.ok(!lit(0, y), 'nothing wraps to column 0');
});

test('textWidth3x5 counts 4px per glyph minus the trailing gap', () => {
    assert.strictEqual(maps.textWidth3x5('1EF'), 11);
    assert.strictEqual(maps.textWidth3x5(''), -1);
});

test('drawLabelInRect skips boxes too small to hold a label', () => {
    const { buf, lit } = inkCanvas(32, 32);
    maps.drawLabelInRect(buf, 32, 32, 0, 0, 5, 5, '7');
    for (let i = 0; i < buf.length; i++) assert.strictEqual(buf[i], 0, 'nothing drawn');
    maps.drawLabelInRect(buf, 32, 32, 0, 0, 16, 16, '7');
    assert.ok(lit(3, 3), 'a 16px box does get one');
});

test('drawLabelInRect anchors bottom labels near the lower edge', () => {
    const top = inkCanvas(64, 64);
    const bottom = inkCanvas(64, 64);
    maps.drawLabelInRect(top.buf, 64, 64, 8, 8, 40, 40, '3', [255, 255, 255, 255], 'top');
    maps.drawLabelInRect(bottom.buf, 64, 64, 8, 8, 40, 40, '3', [255, 255, 255, 255], 'bottom');
    assert.ok(top.lit(11, 11) && !top.lit(11, 32), 'top anchor sits at y1+3');
    assert.ok(bottom.lit(11, 31) && !bottom.lit(11, 11), 'bottom anchor sits at y2-9');
});

// ── overlay-features.ts ─────────────────────────────────────────────────────

/**
 * A 2x2 room whose collision words are supplied directly. Plane bits are
 * 5..4, geometry 3..0, so 0x000f is a plain wall and 0x0000 open floor.
 */
function featureRoom(words, extra) {
    return Object.assign({
        roomId: 0x2a,
        header: { widthTiles: words[0].length, heightTiles: words.length, originX: 0, originY: 0 },
        collisionWords: words,
        objects: [],
        triggers: { stepOn: [], bTrigger: [] },
        cuttableGrass: { tiles: [], warnings: [] },
    }, extra || {});
}

test('classifyRoom picks the plane with the most walkable tiles', () => {
    // Plane 0 is open in three tiles; plane 1 is solid everywhere it appears.
    const f = maps.classifyRoom(featureRoom([[0x0000, 0x0000], [0x0000, 0x001f]]));
    assert.deepStrictEqual(f.planes, [0, 1]);
    assert.strictEqual(f.mainPlane, 0);
});

test('classifyRoom groups entity gates by which entities they block', () => {
    // Bit 8 set plus nibble 11..8: gate 5 blocks the dog.
    const f = maps.classifyRoom(featureRoom([[0x0500, 0x0000], [0x0000, 0x0500]]));
    assert.strictEqual(f.gated.length, 2);
    assert.deepStrictEqual(f.gated[0], [0, 0, 5]);
});

test('buildSummary reads like render_map.py header banner', () => {
    const room = featureRoom([[0x0000, 0x0000]]);
    const pairs = maps.buildSummary(room, maps.classifyRoom(room));
    const asText = pairs.map((p) => p[0] + ' ' + p[1]).join(' - ');
    assert.ok(asText.startsWith('ROOM 0x2A - TILES 2x1 - PLANES 1 (0)'), asText);
    // Absent features are omitted rather than reported as zero.
    assert.ok(!/ENTITY GATES/.test(asText));
});

test('buildLegend omits absent features and marks non-dominant planes dotted', () => {
    const room = featureRoom([[0x0000, 0x0000], [0x0000, 0x001f]]);
    const labels = maps.buildLegend(maps.classifyRoom(room)).map((l) => l.label);
    assert.ok(labels.indexOf('PLANE 0 BOUNDARY') >= 0);
    assert.ok(labels.indexOf('PLANE 1 BOUNDARY (DOTTED)') >= 0);
    assert.ok(!labels.some((l) => /CUTTABLE GRASS/.test(l)), 'no grass in this room');
    // Objects and triggers are always keyed, since their boxes are always drawn.
    assert.ok(labels.some((l) => /OBJECT STAMP/.test(l)));
});

// ── collision-overlay.ts ────────────────────────────────────────────────────

function overlayOf(opts) {
    const room = featureRoom([[0x000f, 0x0000], [0x2000, 0x0000]]);
    const img = { width: 32, height: 32, data: new Uint8Array(32 * 32 * 4) };
    maps.drawCollisionOverlay(img, room, opts);
    return img.data;
}

test('every overlay pass defaults to on', () => {
    const full = overlayOf({});
    const none = overlayOf({
        contours: false, drift: false, transparent: false, elevation: false,
        gates: false, grass: false, objects: false, triggers: false, labels: false,
    });
    assert.ok(full.some((v, i) => v !== none[i]), 'the default view draws something');
    assert.ok(none.every((v) => v === 0), 'all-off leaves the image untouched');
});

test('switching one pass off changes only that pass', () => {
    const full = overlayOf({});
    const noDrift = overlayOf({ drift: false });
    assert.ok(full.some((v, i) => v !== noDrift[i]), 'drift tile 0x2000 was being drawn');
    const noGrass = overlayOf({ grass: false });
    assert.deepStrictEqual(Array.from(noGrass), Array.from(full), 'no grass here, so no change');
});

console.log('\n' + (passed + failed) + ' run: ' + passed + ' passed, ' + failed + ' failed');
if (failed) process.exit(1);
