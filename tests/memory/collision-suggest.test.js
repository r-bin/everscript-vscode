'use strict';
// Suggested collision (maps/vanilla-suggest.ts suggestGeometry, room-draft.js,
// map-editor-collision.js) and a drafted map's collision layer.
//
// The ROM checks skip, not fail, when the ROM is unavailable.

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const maps = require('../../src/maps');

const EVERSCRIPT_REPO = process.env.EVERSCRIPT_REPO ||
    path.join(path.dirname(path.dirname(path.dirname(path.resolve(__dirname)))), 'everscript');
const ROM_PATH = process.env.EVERSCRIPT_ROM || path.join(EVERSCRIPT_REPO, 'Secret of Evermore (U) [!].smc');

let passed = 0;
let failed = 0;
function test(name, fn) {
    try { fn(); console.log('  ✓ ' + name); passed += 1; }
    catch (e) { console.log('  ✗ ' + name + '\n    ' + (e && e.message)); failed += 1; }
}

// ── the webview module, DOM-free parts ──────────────────────────────────────

const WEBVIEW = path.join(__dirname, '..', '..', 'src', 'rooms', 'webview');
const web = new Function(`
  var _currentOverlay = 'c';
  var _layerForce = null;
  var EMPTY_COLLISION = 0;
  function editLayerPreference() { return null; }
  ${fs.readFileSync(path.join(WEBVIEW, 'map-editor-collision.js'), 'utf8')}
  return { COLL_SHAPES, tileCollisionFor, tileSuggestedCollision, tileCollisionMarkHtml,
           setOverlay: (s) => { _currentOverlay = s; } };`)();

/** Shoelace area of a "x,y x,y ..." polygon. */
function area(points) {
    const p = points.split(' ').map((xy) => xy.split(',').map(Number));
    let a = 0;
    for (let i = 0; i < p.length; i++) {
        const [x1, y1] = p[i];
        const [x2, y2] = p[(i + 1) % p.length];
        a += x1 * y2 - x2 * y1;
    }
    return Math.abs(a) / 2;
}

test('every shape polygon covers what maps/collision.ts geometryMask makes solid', () => {
    for (let code = 0; code < 16; code++) {
        const solid = maps.geometryMask(code).reduce((n, v) => n + v, 0);
        const poly = web.COLL_SHAPES[code];
        if (!solid) { assert.strictEqual(poly, undefined, `code 0x${code.toString(16)} has no solid pixels`); continue; }
        assert.ok(poly, `code 0x${code.toString(16)} is solid but has no polygon`);
        // A diagonal's mask includes its diagonal pixels, so allow one row.
        assert.ok(Math.abs(area(poly) - solid) <= 16, `code 0x${code.toString(16)}: polygon ${area(poly)} vs mask ${solid}`);
    }
});

test('a slot suggests its ground shape or its front shape, by layer', () => {
    const slot = [0, 0, 641, 10, 0, 10, 0x0f, 99, 0x00, 70];
    assert.deepStrictEqual(web.tileCollisionFor(slot, 'terrain'), { shape: 0x0f, pct: 99 });
    assert.deepStrictEqual(web.tileCollisionFor(slot, 'canopy'), { shape: 0x00, pct: 70 });
    assert.strictEqual(web.tileSuggestedCollision(slot, 'terrain'), 0x0f);
    assert.strictEqual(web.tileSuggestedCollision([0, 0, 1, 0, 0, 0, -1, 0, -1, 0], 'terrain'), 0, 'never seen -> open');
    assert.strictEqual(web.tileSuggestedCollision(null, 'terrain'), 0);
});

test('the swatch mark appears only while Collision is on, and is dashed when unsure', () => {
    const sure = [0, 0, 641, 10, 0, 10, 0x0f, 99, -1, 0];
    const unsure = [0, 0, 642, 10, 0, 10, 0x0f, 55, -1, 0];
    web.setOverlay('c');
    assert.match(web.tileCollisionMarkHtml(sure), /<polygon/);
    assert.doesNotMatch(web.tileCollisionMarkHtml(sure), /unsure/);
    assert.match(web.tileCollisionMarkHtml(unsure), /unsure/);
    web.setOverlay('dpe');
    assert.strictEqual(web.tileCollisionMarkHtml(sure), '');
});

// ── ROM-free host helper ────────────────────────────────────────────────────

test('overlayLayer recovers what a blend drew, as colour and alpha', () => {
    const img = maps.overlayLayer(2, 1, (buf) => {
        const d = buf.data;
        // Pixel 0: 50% of (200, 40, 40). Pixel 1: untouched.
        for (let c = 0; c < 3; c++) d[c] = Math.trunc([200, 40, 40][c] * 0.5 + d[c] * 0.5);
    });
    assert.ok(Math.abs(img.data[3] - 128) <= 1, 'alpha ' + img.data[3]);
    assert.ok(Math.abs(img.data[0] - 200) <= 2 && Math.abs(img.data[1] - 40) <= 2, 'colour ' + Array.from(img.data.slice(0, 3)));
    assert.strictEqual(img.data[7], 0, 'untouched pixel stays transparent');
});

// ── against the ROM ─────────────────────────────────────────────────────────

if (!fs.existsSync(ROM_PATH)) {
    console.log(`SKIP collision ROM checks: ${ROM_PATH} not found`);
} else {
    const rom = new Uint8Array(fs.readFileSync(ROM_PATH));
    const rooms = require('../../src/rooms');
    const index = maps.buildVanillaIndex(rom);

    test('suggestGeometry votes on the shape, with its share of vanilla', () => {
        const wall = maps.suggestGeometry(index, 641, 'terrain');
        assert.strictEqual(wall.value, 0x0f);
        assert.ok(wall.confidence > 0.9, 'confidence ' + wall.confidence);
        const shares = wall.alternatives.reduce((n, a) => n + a.uses, 0);
        assert.ok(wall.alternatives.every((a) => a.value >= 0 && a.value <= 0x0f), 'values are shapes, not words');
        assert.ok(shares > 0);
        assert.strictEqual(maps.suggestGeometry(index, 0xfffff, 'terrain'), null);
    });

    test('the canopy tally leaves out each room’s blank canopy word', () => {
        assert.ok(index.canopyCollisions.size > 0);
        // Graphic 489 is drawn as the blank canopy in many rooms; as *real*
        // canopy it is far rarer than as the blank.
        const asBlank = (index.layers.get(489) || { canopy: 0 }).canopy;
        const asArt = (index.canopyCollisions.get(489) || []).reduce((n, a) => n + a.uses, 0);
        assert.ok(asArt < asBlank, `${asArt} real-canopy placements vs ${asBlank} canopy placements`);
    });

    test('family sheet slots carry ground and front shapes with their scores', () => {
        const sheet = rooms.buildFamilySheet(rom, 32, 0x34);
        const row = sheet.slots.find((s) => s[2] === 641);
        assert.ok(row && row.length === 13, JSON.stringify(row));
        assert.strictEqual(row[6], 0x0f);
        assert.ok(row[7] >= 90);
    });

    test('cuttable grass flags the graphics a swap record changes, not the blank it leaves', () => {
        assert.strictEqual(index.grass.size, 38);
        assert.strictEqual(index.grass.has(489), false, 'the blank canopy graphic is not grass');
        assert.ok([...index.grass.values()].every((f) => f >= 1 && f <= 3));
        const f32 = rooms.buildFamilyCatalogue(rom).find((f) => f.id === 32);
        assert.strictEqual(f32.grass, 31);
        const sheet = rooms.buildFamilySheet(rom, 32, 0x34);
        assert.strictEqual(sheet.slots.filter((r) => r[10]).length, 31);
        // The stubble cut grass reveals in Act 1 is never *placed* — it only
        // exists at run time — yet it must be in its family's tile list.
        for (const g of [677, 685, 691]) {
            const row = sheet.slots.find((r) => r[2] === g);
            assert.ok(row && row[10] === 2, `graphic ${g} missing from family 32 or not flagged as cut state`);
            assert.strictEqual(maps.suggestGeometry(index, g, 'terrain').value, 0x00, `cut grass ${g} is walkable`);
        }
    });

    test('stairs: vanilla’s stair art carries bit 13 + a shear nibble, and its direction follows the H flip', () => {
        // Graphic 1833: stair art in Ebon Keep, drawn as ground and as front.
        const g = maps.suggestStairs(index, 1833, 'terrain');
        assert.ok(g && (g.nibble === 1 || g.nibble === 2) && g.confidence >= 0.5, JSON.stringify(g));
        assert.strictEqual(maps.suggestStairs(index, 641, 'terrain'), null, 'a wall is not stairs');
        assert.strictEqual(maps.stairsNibble(0x2001), 1);
        assert.strictEqual(maps.stairsNibble(0x2008), 0, 'drift north is not stairs');
        assert.strictEqual(maps.stairsNibble(0x2000), 3, 'bit 13 with no drift is vertical stairs');
        assert.strictEqual(maps.stairsForWord(3, 0x4000), 3, 'a flip does not turn vertical stairs');
        // Vertical stairs: the step art beside the diagonals in 0x0b/0x2b, and 1877 in Ebon Keep.
        for (const g of [1592, 1595, 1877]) assert.strictEqual(maps.suggestStairs(index, g, 'terrain').nibble, 3, 'graphic ' + g);
        assert.strictEqual(maps.stairsNibble(0x0001), 0, 'without bit 13 the nibble is geometry');
        assert.strictEqual(maps.stairsForWord(1, 0x4000), 2);
        // The shape of a bit-13 word is open, not the diagonal its nibble would
        // be as geometry — stairs are walkable.
        assert.strictEqual(maps.shapeOf(0x2001), 0);
        assert.strictEqual(maps.suggestGeometry(index, 1833, 'terrain').value, 0);
        // Every stairs placement in vanilla, normalised to the art's frame,
        // agrees with its graphic's direction most of the time.
        let agree = 0; let all = 0;
        for (const [, v] of index.stairs) for (const c of [v.terrain, v.canopy]) {
            all += c.stairs; agree += Math.max(c.right, c.stairs - c.right);
        }
        assert.ok(agree / all > 0.9, `direction follows the flip in ${(100 * agree / all).toFixed(1)}%`);
        const sheet = rooms.buildFamilySheet(rom, maps.suggestFamily(index, 1833).value, 0x34);
        const row = sheet.slots.find((s) => s[2] === 1833);
        assert.ok(row && (row[11] || row[12]), JSON.stringify(row));
        const cat = rooms.buildFamilyCatalogue(rom);
        assert.ok(cat.filter((f) => f.stairs).length >= 25, 'many families have stair art, vertical included');
    });

    test('a drafted map’s collision layer draws solid cells and leaves open ones clear', () => {
        const w = 6, h = 4, cells = [];
        for (let i = 0; i < w * h; i++) cells.push(0xa800, 0xa800, (i % w) >= 2 && (i % w) <= 3 ? 0x0f : 0);
        const out = rooms.buildDraftCollision(rom, { borrowFrom: 0x34, widthTiles: w, heightTiles: h, cells });
        assert.strictEqual(out.imageWidth, 96);
        assert.strictEqual(out.imageHeight, 64);
        const png = Buffer.from(out.imageUri.split(',')[1], 'base64');
        assert.ok(png.length > 100);
        assert.throws(() => rooms.buildDraftCollision(rom, { widthTiles: w, heightTiles: h, cells: cells.slice(3) }), /does not match/);
    });
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
