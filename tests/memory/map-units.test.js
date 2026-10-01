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

// ── object-stamps.ts ────────────────────────────────────────────────────────

/**
 * Build a stamp record: [tw][th] then an inline stream of one mask byte per 8
 * tiles, each set bit followed by its 16-bit XOR delta. The mask is what
 * upstream misses, and the values are deltas, not metatile ids.
 */
function stampRom(tw, th, groups) {
    const bytes = [tw, th];
    for (const [mask, words] of groups) {
        bytes.push(mask);
        for (const w of words) bytes.push(w & 0xff, (w >> 8) & 0xff);
    }
    const rom = new Uint8Array(256);
    rom.set(bytes, 8);
    return rom;
}

test('parseObjectStamp reads the tile mask and only the deltas it selects', () => {
    // 2x2, mask 0b0111: three tiles written, the fourth left alone.
    const st = maps.parseObjectStamp(stampRom(2, 2, [[0x07, [0x2470, 0x2410, 0x26d0]]]), 8, 0);
    assert.ok(st.valid);
    assert.strictEqual(st.tw, 2);
    assert.strictEqual(st.th, 2);
    assert.strictEqual(st.tileCount, 3);
    assert.deepStrictEqual(st.deltas, [0x2470, 0x2410, 0x26d0, null]);
    // 2 header + 1 mask + 3*2. This is the length that has to line up with the
    // next record's offset, and does for all 2726 records in the vanilla ROM.
    assert.strictEqual(st.byteLength, 9);
});

test('parseObjectStamp fetches a fresh mask byte every 8 tiles', () => {
    // 3x4 = 12 tiles: 8 from the first mask byte, 4 from the second. The mask
    // bytes are interleaved with their deltas, not gathered up front.
    const st = maps.parseObjectStamp(
        stampRom(3, 4, [[0x03, [0x10, 0x20]], [0x01, [0x30]]]), 8, 0);
    assert.ok(st.valid);
    assert.strictEqual(st.tileCount, 3);
    assert.strictEqual(st.deltas[0], 0x10);
    assert.strictEqual(st.deltas[1], 0x20);
    assert.strictEqual(st.deltas[2], null);
    assert.strictEqual(st.deltas[8], 0x30, 'second mask byte starts at tile 8');
    assert.strictEqual(st.byteLength, 2 + 1 + 4 + 1 + 2);
});

test('parseObjectStamp rejects bytes that cannot be a stamp', () => {
    assert.strictEqual(maps.parseObjectStamp(stampRom(0, 4, [[1, [1]]]), 8, 0).valid, false);
    assert.strictEqual(maps.parseObjectStamp(new Uint8Array(4), 0, 100).valid, false);
    // Runs off the end of the ROM rather than reading past it.
    assert.strictEqual(maps.parseObjectStamp(Uint8Array.from([4, 4, 0xff]), 0, 0).valid, false);
});

test('objectStampSignature ignores where a stamp sits, not what it writes', () => {
    const sig = (g) => maps.objectStampSignature(maps.parseObjectStamp(stampRom(2, 1, g), 8, 0));
    assert.strictEqual(sig([[0x03, [0x10, 0x20]]]), sig([[0x03, [0x10, 0x20]]]));
    assert.notStrictEqual(sig([[0x03, [0x10, 0x20]]]), sig([[0x03, [0x10, 0x28]]]));
    assert.notStrictEqual(sig([[0x03, [0x10, 0x20]]]), sig([[0x01, [0x10]]]), 'mask is part of it');
    assert.strictEqual(maps.objectStampSignature(maps.parseObjectStamp(new Uint8Array(4), 0, 0)), '');
});

// ── objects.ts ──────────────────────────────────────────────────────────────

/** A 2x2 room whose object 0 has one delta record, so two appearances. */
function stampedRoom() {
    // Record layout inside the fake object area at 0: the object record, then
    // the stamp it points at.
    const rom = new Uint8Array(256);
    rom.set([1, 1, 0, 0, 0x06, 0x00], 0);   // max_state 1; state 0: w,x=0,y=0,ptr=6
    rom.set([1, 1, 0x01, 0x40, 0x00], 6);   // stamp: 1x1, mask 0b1, delta 0x0040
    const room = {
        roomId: 1,
        objectArea: 0,
        baseMetatile: 0x100,
        metatileCount: 32,
        metatileSlices: { layer1: [], layer2: [], collision: [] },
        header: { widthTiles: 2, heightTiles: 1, originX: 0, originY: 0, displayTm: 0x17, subscreenTs: 0, colorMath: 0 },
        objects: [{ objectIndex: 0, maxState: 1, relativeOffset: 0,
                    states: [{ state: 0, width: 1, tileX: 0, tileY: 0, targetWidth: 1, targetHeight: 1, metatiles: [], metatileId: 6 }] }],
        layer1MetatileIds: [[0x100, 0x108]],
        layer1VramWords: [[1, 2]],
        layer2VramWords: [[3, 4]],
        collisionWords: [[0, 0]],
    };
    // slice index = (id - base) / 8, so 0x100 -> 0, 0x140 -> 8.
    for (let i = 0; i < 32; i++) {
        room.metatileSlices.layer1.push(0x1000 + i);
        room.metatileSlices.layer2.push(0x2000 + i);
        room.metatileSlices.collision.push(i);
    }
    return { rom, room };
}

test('objectStateCount is one more than the delta count', () => {
    const { room } = stampedRoom();
    // One delta record connects two appearances; state 0 needs no record.
    assert.strictEqual(maps.objectStateCount(room.objects[0]), 2);
});

test('applyObjectStates XORs the delta into the grid and re-resolves the tile', () => {
    const { rom, room } = stampedRoom();
    const out = maps.applyObjectStates(rom, room, { 0: 1 });
    // 0x100 ^ 0x40 = 0x140, which is slice index 8.
    assert.strictEqual(out.layer1MetatileIds[0][0], 0x140);
    assert.strictEqual(out.layer1VramWords[0][0], 0x1008);
    assert.strictEqual(out.layer2VramWords[0][0], 0x2008);
    assert.strictEqual(out.collisionWords[0][0], 8, 'collision follows the metatile');
    // Untouched tiles keep their decoded words, and the input is not mutated.
    assert.strictEqual(out.layer1VramWords[0][1], 2);
    assert.strictEqual(room.layer1MetatileIds[0][0], 0x100);
});

test('applyObjectStates is an involution over a full round trip', () => {
    const { rom, room } = stampedRoom();
    // XOR undoes itself, which is how the engine walks a state back down.
    const there = maps.applyObjectStates(rom, room, { 0: 1 });
    const back = maps.applyObjectStates(rom, there, { 0: 1 });
    assert.strictEqual(back.layer1MetatileIds[0][0], room.layer1MetatileIds[0][0]);
});

test('applyObjectStates clamps past the last state and ignores state 0', () => {
    const { rom, room } = stampedRoom();
    assert.strictEqual(maps.applyObjectStates(rom, room, { 0: 0 }), room, 'state 0 is a no-op');
    const clamped = maps.applyObjectStates(rom, room, { 0: 99 });
    assert.strictEqual(clamped.layer1MetatileIds[0][0], 0x140, 'clamped to the one delta available');
});

// ── animation.ts ───────────────────────────────────────────────────────────

/**
 * Build a Section 2 blob: the descriptor table, its 0xFF terminator, then the
 * shared frame data. Channel i owns the frames from its offset to the next
 * channel's — the doc's "0xFF-terminated frame stream" is really this one
 * 0xFF ending the table.
 */
function section2(channels) {
    const table = [];
    const frames = [];
    const first = channels.length * 4 + 1;
    for (const ch of channels) {
        table.push(ch.delay, ch.frames.length, (first + frames.length) & 0xff, (first + frames.length) >> 8);
        for (const f of ch.frames) frames.push(f.delay, f.tileId & 0xff, f.tileId >> 8);
    }
    const body = table.concat([0xff], frames);
    const rom = new Uint8Array(512);
    rom.set(body, 16);
    return { rom, ref: { table: 16, count: channels.length, len: body.length } };
}

test('parseAnimationChannels splits the shared frame data per channel', () => {
    // Room 0x71's real shape: a 4-frame torch and a 2-frame companion.
    const { rom, ref } = section2([
        { delay: 0, frames: [{ delay: 10, tileId: 0x740 }, { delay: 10, tileId: 0x741 },
                             { delay: 10, tileId: 0x742 }, { delay: 10, tileId: 0x743 }] },
        { delay: 0, frames: [{ delay: 8, tileId: 0x76b }, { delay: 8, tileId: 0x76c }] },
    ]);
    const ch = maps.parseAnimationChannels(rom, ref);
    assert.strictEqual(ch.length, 2);
    assert.deepStrictEqual(ch[0].frames.map((f) => f.tileId), [0x740, 0x741, 0x742, 0x743]);
    assert.deepStrictEqual(ch[1].frames.map((f) => f.tileId), [0x76b, 0x76c]);
    assert.strictEqual(ch[0].frames[0].delay, 10);
    assert.strictEqual(ch[1].frames[0].delay, 8);
});

test('parseAnimationChannels stops at the section length, not at a 0xFF byte', () => {
    // A tile id whose low byte is 0xFF must not be mistaken for a terminator.
    const { rom, ref } = section2([
        { delay: 0, frames: [{ delay: 5, tileId: 0x01ff }, { delay: 5, tileId: 0x0200 }] },
    ]);
    const ch = maps.parseAnimationChannels(rom, ref);
    assert.deepStrictEqual(ch[0].frames.map((f) => f.tileId), [0x01ff, 0x0200]);
});

test('parseAnimationChannels tolerates a frame list running past the section', () => {
    const { rom, ref } = section2([{ delay: 0, frames: [{ delay: 5, tileId: 0x10 }] }]);
    ref.len = 6; // truncate: the declared length no longer covers the frame
    const ch = maps.parseAnimationChannels(rom, ref);
    assert.strictEqual(ch.length, 1);
    assert.strictEqual(ch[0].frames.length, 0, 'frames outside the section are dropped');
});

test('parseAnimationChannels returns nothing for a room without Section 2', () => {
    assert.deepStrictEqual(maps.parseAnimationChannels(new Uint8Array(64), { table: 0, count: 0, len: 0 }), []);
});

test('buildOverlayTransfer measures an opaque mark as frozen', () => {
    // An opaque write ignores what was underneath, so probing over black and
    // over white gives the same answer — and re-applying it to any animation
    // frame reproduces the mark exactly.
    const t = maps.buildOverlayTransfer(2, 1, (img) => {
        img.data[0] = 10; img.data[1] = 20; img.data[2] = 30; img.data[3] = 255;
    });
    assert.deepStrictEqual(Array.from(t.atZero.slice(0, 3)), [10, 20, 30]);
    assert.deepStrictEqual(Array.from(t.atFull.slice(0, 3)), [10, 20, 30]);
    // The untouched second pixel is a pure passthrough: black stays black,
    // white stays white, so any frame colour survives unchanged.
    assert.deepStrictEqual(Array.from(t.atZero.slice(3, 6)), [0, 0, 0]);
    assert.deepStrictEqual(Array.from(t.atFull.slice(3, 6)), [255, 255, 255]);
});

test('buildOverlayTransfer pins a blend so it can be re-applied to any base', () => {
    // A 25% red wash, the shape every collision tint takes.
    const t = maps.buildOverlayTransfer(1, 1, (img) => {
        for (let ch = 0; ch < 3; ch++) {
            const c = ch === 0 ? 200 : 0;
            img.data[ch] = Math.trunc(c * 0.25 + img.data[ch] * 0.75);
        }
    });
    // out = base*(atFull-atZero)/255 + atZero must reproduce the wash for a
    // base the probe never saw.
    const apply = (base, ch) =>
        Math.round(base * (t.atFull[ch] - t.atZero[ch]) / 255 + t.atZero[ch]);
    for (const base of [0, 64, 128, 200, 255]) {
        assert.ok(Math.abs(apply(base, 0) - (200 * 0.25 + base * 0.75)) <= 1,
            'red channel at base ' + base);
        assert.ok(Math.abs(apply(base, 1) - base * 0.75) <= 1, 'green channel at base ' + base);
    }
});

// ── blank-room.ts ───────────────────────────────────────────────────────────

// "New maps are completely empty" (plan doc §8a.3): a blank room is filled with
// the donor's *blank* word, not its floor. The blank word is the most-placed
// canopy word, which is the same rule editBlankCanopy uses client-side.
test('emptyStamp puts the donor\'s most-placed canopy word on both layers, collision open', () => {
    const base = 100;
    const donor = {
        baseMetatile: base,
        metatileCount: 3,
        // entry 0: a floor (canopy $A800 over terrain $4C62), entry 1: a hide on
        // the same floor, entry 2: never placed at all.
        metatileSlices: { layer1: [0xa800, 0x2c66, 0x1111], layer2: [0x4c62, 0x4c62, 0x2222],
            collision: [0x0010, 0x101f, 0x0000] },
        layer1MetatileIds: [[base, base, base + 8], [base, base, base]],
    };
    assert.deepStrictEqual(maps.emptyStamp(donor), { layer1: 0xa800, layer2: 0xa800, collision: 0 });
});

test('emptyStamp counts placements per word, not per dictionary entry', () => {
    const base = 0;
    // Two entries share canopy $2000 (2 + 2 = 4 placements) and beat one entry
    // with canopy $A800 at 3. The word is what draws, so the word is what counts.
    const donor = {
        baseMetatile: base, metatileCount: 3,
        metatileSlices: { layer1: [0xa800, 0x2000, 0x2000], layer2: [1, 2, 3], collision: [0, 0, 0] },
        layer1MetatileIds: [[0, 0, 0, 8, 8, 16, 16]],
    };
    assert.strictEqual(maps.emptyStamp(donor).layer1, 0x2000);
});

// ── vanilla-adjacency.ts: the four sides, off one walk (§8b) ────────────────

/** Walk a synthetic `[canopy, terrain]` grid and compact it. */
function walkSynthetic(grid) {
    const adjacency = new Map();
    const cells = new Map();
    const tally = maps.newDirectionalTally();
    const edges = maps.walkResolvedGrid(grid, adjacency, cells, tally);
    return { adjacency, cells, edges, directional: maps.compactDirectional(tally) };
}
const U = undefined;
const graphicsOf = (list) => list.map((r) => r.graphic);

test('a tile with only an east neighbour has an empty west bucket', () => {
    // Terrain row: 1 2. Nothing is west of 1 and nothing is east of 2.
    const { directional } = walkSynthetic([[[U, 1], [U, 2]]]);
    const one = maps.directionalNeighbours(directional, 1, 1);
    assert.deepStrictEqual(graphicsOf(one.e), [2]);
    assert.deepStrictEqual([one.w, one.n, one.s], [[], [], []]);
    const two = maps.directionalNeighbours(directional, 2, 1);
    assert.deepStrictEqual(graphicsOf(two.w), [1]);
    assert.deepStrictEqual([two.e, two.n, two.s], [[], [], []]);
});

test('a down pair files b south of a and a north of b', () => {
    const { directional } = walkSynthetic([[[U, 1]], [[U, 2]]]);
    assert.deepStrictEqual(graphicsOf(maps.directionalNeighbours(directional, 1, 1).s), [2]);
    assert.deepStrictEqual(graphicsOf(maps.directionalNeighbours(directional, 2, 1).n), [1]);
    assert.deepStrictEqual(maps.directionalNeighbours(directional, 1, 1).e, []);
});

test('the four buckets count every edge, and sum to the undirected count', () => {
    // 1 2 1
    // 3 1 2
    const grid = [[[U, 1], [U, 2], [U, 1]], [[U, 3], [U, 1], [U, 2]]];
    const { adjacency, directional, edges } = walkSynthetic(grid);
    const one = maps.directionalNeighbours(directional, 1, 1);
    const count = (side, g) => (side.find((r) => r.graphic === g) || { uses: 0 }).uses;
    assert.strictEqual(count(one.e, 2), 2, 'row 0 col 0 and row 1 col 1 both have 2 east');
    assert.strictEqual(count(one.w, 2), 1, 'row 0 col 2 has 2 west');
    assert.strictEqual(count(one.w, 3), 1, 'row 1 col 1 has 3 west');
    assert.strictEqual(count(one.s, 2), 1, 'row 0 col 2 has 2 south');
    assert.strictEqual(count(one.s, 3), 1, 'row 0 col 0 has 3 south');
    assert.strictEqual(count(one.n, 2), 1, 'row 1 col 1 has 2 north');
    const sum = ['n', 'e', 's', 'w'].reduce((n, d) => n + count(one[d], 2), 0);
    assert.strictEqual(sum, adjacency.get(1).get(2), 'the four sides sum to the undirected pair');
    assert.strictEqual(edges, 7, '4 horizontal + 3 vertical edges, none a self pair');
});

test('the two layers never meet: a canopy tile is not beside the floor under it', () => {
    // Canopy 9 over floor 1, beside canopy 8 over floor 2.
    const { directional } = walkSynthetic([[[9, 1], [8, 2]]]);
    assert.deepStrictEqual(graphicsOf(maps.directionalNeighbours(directional, 9, 0).e), [8]);
    assert.deepStrictEqual(maps.directionalNeighbours(directional, 9, 1).e, [], 'nothing on the terrain side');
    assert.deepStrictEqual(graphicsOf(maps.directionalNeighbours(directional, 1, 1).e), [2]);
});

test('a tile beside itself is not its own candidate', () => {
    const { directional } = walkSynthetic([[[U, 5], [U, 5], [U, 6]]]);
    assert.deepStrictEqual(graphicsOf(maps.directionalNeighbours(directional, 5, 1).e), [6]);
});

test('the per-side score is Jaccard over that layer\'s cells, ranked best first', () => {
    // 1 is drawn 3 times. 2 is east of it once and drawn once (1/(3+1-1) = .33);
    // 4 is east of it once and drawn twice (1/(3+2-1) = .25) — 2 ranks first.
    const grid = [[[U, 1], [U, 2]], [[U, 1], [U, 4]], [[U, 1], [U, 7]], [[U, 4], [U, 7]]];
    const { directional } = walkSynthetic(grid);
    const east = maps.directionalNeighbours(directional, 1, 1).e;
    assert.deepStrictEqual(graphicsOf(east), [2, 4, 7]);
    assert.ok(Math.abs(east[0].score - 1 / 3) < 1e-9, String(east[0].score));
    assert.ok(Math.abs(east[1].score - 1 / 4) < 1e-9, String(east[1].score));
});

test('an unknown graphic has four empty sides, and limit caps each side', () => {
    const { directional } = walkSynthetic([[[U, 1], [U, 2]], [[U, 1], [U, 3]], [[U, 1], [U, 4]]]);
    assert.deepStrictEqual(maps.directionalNeighbours(directional, 99, 1), { n: [], e: [], s: [], w: [] });
    assert.strictEqual(maps.directionalNeighbours(directional, 1, 1, 2).e.length, 2);
});

// ── vanilla-procedural.ts ───────────────────────────────────────────────────

test('proceduralPatch places seedGraphic at center of grid', () => {
    const { adjacency, directional, cells } = walkSynthetic([
        [[U, 10], [U, 20]],
        [[U, 30], [U, 40]],
    ]);
    const mockIndex = {
        families: new Map([[10, [{ value: 1, uses: 5 }]], [20, [{ value: 1, uses: 5 }]]]),
        graphics: new Map(),
        rooms: new Map(),
        graphicRooms: new Map(),
        layers: new Map(),
        collisions: new Map(),
        canopyCollisions: new Map(),
        grass: new Map(),
        stairs: new Map(),
        animations: { framesOf: new Map(), frameZeroOf: new Map() },
        adjacency,
        directional,
        cells,
        geometry: [],
        roomCount: 1,
        placements: 4,
        edges: 4,
    };
    const patch3 = maps.proceduralPatch(mockIndex, 10, 1, 3, 3);
    assert.strictEqual(patch3.length, 3);
    assert.strictEqual(patch3[0].length, 3);
    assert.strictEqual(patch3[1][1].graphic, 10, 'center of 3x3 must be seed graphic');

    const patch4 = maps.proceduralPatch(mockIndex, 20, 1, 4, 4);
    assert.strictEqual(patch4.length, 4);
    assert.strictEqual(patch4[0].length, 4);
    assert.strictEqual(patch4[2][2].graphic, 20, 'center of 4x4 must be seed graphic');
});

test('proceduralPatch uses directional neighbours to populate adjacent cells', () => {
    const { adjacency, directional, cells } = walkSynthetic([
        [[U, 1], [U, 2]],
    ]);
    const mockIndex = {
        families: new Map([[1, [{ value: 5, uses: 10 }]], [2, [{ value: 5, uses: 10 }]]]),
        graphics: new Map(),
        rooms: new Map(),
        graphicRooms: new Map(),
        layers: new Map(),
        collisions: new Map(),
        canopyCollisions: new Map(),
        grass: new Map(),
        stairs: new Map(),
        animations: { framesOf: new Map(), frameZeroOf: new Map() },
        adjacency,
        directional,
        cells,
        geometry: [],
        roomCount: 1,
        placements: 2,
        edges: 1,
    };
    // 2 is east of 1
    const patch = maps.proceduralPatch(mockIndex, 1, 1, 3, 3, () => 0.5);
    // Center is (1, 1) = 1. East is (1, 2)
    assert.strictEqual(patch[1][1].graphic, 1);
    assert.strictEqual(patch[1][2].graphic, 2, 'east neighbour of 1 should be 2');
    assert.strictEqual(patch[1][2].family, 5);
});

test('tile category helpers classify unused, canopy, and dual-layer graphics', () => {
    const mockIndex = {
        cells: new Map([[100, 10], [200, 20], [300, 0]]),
        grass: new Map(),
        layers: new Map([
            [100, { canopy: 15, terrain: 2 }],
            [200, { canopy: 10, terrain: 10 }],
            [300, { canopy: 0, terrain: 0 }],
        ]),
        dualNoCanopy: new Map([[200, 15]]),
    };

    // 300 has 0 cells placed and no grass -> unused
    assert.strictEqual(maps.isUnusedGraphic(mockIndex, 300), true);
    assert.strictEqual(maps.isUnusedGraphic(mockIndex, 100), false);

    // 100 has canopy 15 > terrain 2 -> canopy
    assert.strictEqual(maps.isCanopyGraphic(mockIndex, 100), true);
    assert.strictEqual(maps.isCanopyGraphic(mockIndex, 200), false);

    // 200 has dualNoCanopy 15 >= singleGround (10 - 15 = 0) -> dual-layer
    assert.strictEqual(maps.isDualLayerGraphic(mockIndex, 200), true);
    assert.strictEqual(maps.isDualLayerGraphic(mockIndex, 100), false);

    // Bitmasks
    assert.strictEqual(maps.tileCategoryFlags(mockIndex, 300), 1, 'bit 0 for unused');
    assert.strictEqual(maps.tileCategoryFlags(mockIndex, 100), 2, 'bit 1 for canopy');
    assert.strictEqual(maps.tileCategoryFlags(mockIndex, 200), 4, 'bit 2 for dual');
});

console.log('\n' + (passed + failed) + ' run: ' + passed + ' passed, ' + failed + ' failed');
if (failed) process.exit(1);
