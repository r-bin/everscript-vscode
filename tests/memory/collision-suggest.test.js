'use strict';
// Suggested collision (maps/vanilla-suggest.ts suggestGeometry, room-draft.js,
// map-editor-collision.js) and a drafted map's collision layer.
//
// The ROM checks skip, not fail, when the ROM is unavailable.

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const maps = require('../../src/maps');

const LOCAL_ROM = path.join(__dirname, '..', '..', 'script_parser', 'dependencies', 'Secret of Evermore (U) [!].smc');
const EVERSCRIPT_REPO = process.env.EVERSCRIPT_REPO ||
    path.join(path.dirname(path.dirname(path.dirname(path.resolve(__dirname)))), 'everscript');
const ROM_PATH = process.env.EVERSCRIPT_ROM || (fs.existsSync(LOCAL_ROM) ? LOCAL_ROM : path.join(EVERSCRIPT_REPO, 'Secret of Evermore (U) [!].smc'));

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

    test('the widget library carries every family vanilla draws its graphics in', () => {
        const { widgetGraphicFamilies } = require('../../src/rooms/custom-host');
        const urn = { cells: [{ dx: 0, dy: 0, canopy: { graphic: 643, family: 115 } }],
            frames: [{ cells: [] }, { cells: [{ dx: 0, dy: 0, terrain: { graphic: 4739, family: 220 } }] }] };
        const got = widgetGraphicFamilies([urn], { loadRom: () => ({ romBuf: rom }) });
        assert.deepStrictEqual(got[643], index.families.get(643).map((a) => [a.value, a.uses]));
        assert.deepStrictEqual(got[643].map((f) => f[0]), [115, 35, 127, 139, 159, 188, 158], 'no #128/#111/#141');
        assert.deepStrictEqual(got[4739].map((f) => f[0]), [220, 291, 231], 'an animation frame counts too');
        assert.deepStrictEqual(widgetGraphicFamilies([urn], { loadRom: () => ({ romBuf: null }) }), {});
    });

    test('the canvas animates the slots it is told about, and a ROM room its own channels only', () => {
        const { buildStampAnimations } = require('../../src/rooms/rendering/stamp-animation');
        const room = maps.decodeRoom(rom, 0x2d);
        const base = room.tilePalette.length;
        const torch = room.animation.findIndex((c) => c.frames[0].tileId === 2742);
        const word = maps.tileSlotChr(base + torch) | (1 << 10);
        const entries = [{ layer1: word, layer2: 0, collision: 0 }];
        const own = buildStampAnimations(rom, room, entries, { columns: 16, layer: 'composite' });
        assert.ok(own && own.entries.length === 1, 'a ROM room: its own channel moves');
        const none = buildStampAnimations(rom, room, entries, { columns: 16, layer: 'composite', channels: [] });
        assert.strictEqual(none, null, 'told about no channels: still, though vanilla animates the graphic');
        const told = buildStampAnimations(rom, room, entries, { columns: 16, layer: 'composite',
            channels: [{ slot: base + torch, frames: [2742, 2745], delays: [9, 3] }] });
        assert.deepStrictEqual(told.entries[0][1], [9, 3]);
    });

    test('a vanilla object cut out of a room keeps each part’s channel', () => {
        const moves = (c) => (c.canopy && c.canopy.anim) || (c.terrain && c.terrain.anim);
        let moving = [];
        for (const d of rooms.decoIndex(rom)) {
            moving = (rooms.decoCells(rom, d.id).cells || []).filter(moves);
            if (moving.length) break;
        }
        assert.ok(moving.length > 0, 'a torch’s parts carry their animation');
        const a = (moving[0].canopy && moving[0].canopy.anim) || moving[0].terrain.anim;
        assert.ok(a.frames.length > 1 && a.frames.length === a.delays.length);
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
        assert.ok(row && row.length === 17, JSON.stringify(row));
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

    test('tile-by-tile collision fills each solid pixel in its level’s colour', () => {
        const w = 2, h = 2;
        // A solid tile on level 1 beside one on level 0; open below.
        const words = [[0x1f, 0x0f], [0x10, 0x10]];
        const cells = [];
        words.forEach((row) => row.forEach((cw) => cells.push(0xa800, 0xa800, cw)));
        const out = rooms.buildDraftCollision(rom, { borrowFrom: 0x34, widthTiles: w, heightTiles: h, cells, mode: 'tiles' });
        assert.ok(out.imageUri.length > 50);
        const buf = { width: 32, height: 32, data: new Uint8ClampedArray(32 * 32 * 4) };
        const room = maps.blankRoom(rom, { widthTiles: w, heightTiles: h, borrowFrom: 0x34, minTiles: 1 });
        const drafted = { ...room, collisionWords: words, elevationPlanes: maps.planesUsed(words) };
        maps.drawCollisionOverlay(buf, drafted, { contours: true, tiles: true, drift: false, grass: false, gates: false,
            transparent: false, elevation: false, objects: false, triggers: false, labels: false });
        const px = (x, y) => Array.from(buf.data.slice((y * 32 + x) * 4, (y * 32 + x) * 4 + 3));
        assert.ok(px(8, 8)[0] > px(8, 8)[2], 'level 1 is red: ' + px(8, 8));
        assert.ok(px(24, 8)[2] > px(24, 8)[0], 'level 0 is blue: ' + px(24, 8));
    });

    test('animations: every phase of a cycle is one animation, named by its lowest graphic', () => {
        const a = index.animations;
        // Room 0x71's torch runs 1856..1859; the Halls torches run one cycle at several phases.
        assert.deepStrictEqual(a.byFirst.get(1856).frames, [1856, 1857, 1858, 1859]);
        assert.deepStrictEqual(a.frameOf.get(1858), { first: 1856, index: 2 });
        assert.ok(a.byFirst.has(2742) && !a.byFirst.has(2743), '2743 starts a channel too, but it is 2742’s cycle');
        assert.strictEqual(a.frameOf.get(2743).first, 2742);
        const sheet = rooms.buildFamilySheet(rom, 115, 0x34);
        const first = sheet.slots.find((r) => r[2] === 2742);
        assert.deepStrictEqual(first.slice(13, 16), [1, 2742, 0]);
        assert.deepStrictEqual(sheet.slots.find((r) => r[2] === 2743).slice(13, 16), [2, 2742, 1]);
        assert.ok(sheet.animations[2742].delays.length === sheet.animations[2742].frames.length);
        const cat = rooms.buildFamilyCatalogue(rom).find((f) => f.id === 115);
        assert.ok(cat.frames > 0 && cat.frames < cat.tiles);
    });

    test('every ROM channel finds its own cycle and its own ticks among vanilla’s patterns (none reads as custom)', () => {
        const canon = (fr) => { let at = 0; fr.forEach((g, i) => { if (g < fr[at]) at = i; }); return fr.slice(at).concat(fr.slice(0, at)).join(','); };
        const turn = (xs, r) => xs.slice(r).concat(xs.slice(0, r));
        let n = 0;
        for (let id = 0; id < 127; id++) {
            let room;
            try { room = maps.decodeRoom(rom, id); } catch (e) { continue; }
            for (const ch of room.animation || []) {
                if (ch.frames.length < 2) continue;
                const fr = ch.frames.map((f) => f.tileId), de = ch.frames.map((f) => f.delay).join(',');
                const c = (index.animations.cycles.get(Math.min(...fr)) || []).find((x) => canon(x.frames) === canon(fr));
                assert.ok(c, 'room ' + id + ': ' + fr.join(' '));
                assert.ok(fr.some((_, r) => turn(c.frames, r).join() === fr.join() && c.timings.some((t) => turn(t.delays, r).join(',') === de)), 'room ' + id + ' ticks');
                n += 1;
            }
        }
        assert.ok(n > 1000);
        // The palette carries the table the Animation tab letters from: every channel of the room is in it.
        const pal = rooms.buildRoomMetatilePalette(rom, 0x3b);
        for (const ch of pal.channels) {
            const fr = ch[2].map((f) => f[0]);
            assert.ok(pal.cycles[canon(fr)], '0x3b channel ' + fr.join(' '));
        }
    });

    test('a placed animated tile carries its other frames, rendered with the stamp', () => {
        const room = maps.decodeRoom(rom, 0x34);
        // Where the draft's first added graphic lands: after Block 1 and the animated tiles.
        const slot = room.tilePalette.length + room.animatedTiles.length;
        const torch = maps.tileSlotChr(slot) | (1 << 10);
        const still = maps.tileSlotChr(0) | (1 << 10);
        const cycle = index.animations.byFirst.get(2742);
        const stamps = [{ layer1: still, layer2: still, collision: 0 }, { layer1: torch, layer2: still, collision: 0 }];
        const quiet = rooms.buildComposedPreview(rom, 0x34, stamps, 'composite', { graphics: [2742] });
        assert.strictEqual(quiet.anim, null, 'no channel says it moves: a still frame');
        const p = rooms.buildComposedPreview(rom, 0x34, stamps, 'composite',
            { graphics: [2742], channels: [{ slot, frames: cycle.frames, delays: cycle.delays }] });
        assert.ok(p.anim, 'the torch stamp animates');
        assert.deepStrictEqual(p.anim.entries.map((e) => e[0]), [1], 'only the torch stamp, by its index');
        assert.deepStrictEqual(p.anim.entries[0][1], cycle.delays);
        assert.strictEqual(p.anim.sheets.length, cycle.frames.length - 1, 'one sheet per later frame');
        assert.notStrictEqual(p.anim.sheets[0].imageUri, p.anim.sheets[1].imageUri);
    });

    test('relationship scores never pass 100%', () => {
        let worst = 0;
        for (const g of [...index.adjacency.keys()].slice(0, 400)) {
            for (const r of maps.relatedGraphics(index, g, 50)) worst = Math.max(worst, r.score);
        }
        assert.ok(worst <= 1, 'worst ' + worst);
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

    test('vanillaExamples returns real scenario patches for attested graphic', () => {
        const examples = rooms.vanillaExamples(rom, 120, 5);
        assert.ok(examples.length > 0, 'must find at least one vanilla room using graphic 120');
        const ex0 = examples[0];
        assert.ok(ex0.roomId !== undefined);
        assert.ok(ex0.roomName);
        assert.ok(ex0.area);
        assert.ok(ex0.count >= 1);
        assert.strictEqual(ex0.patch.length, 3, 'patch must be 3 rows');
        assert.strictEqual(ex0.patch[0].length, 3, 'patch must be 3 cols');
        // Center of patch (1, 1) must contain graphic 120 on canopy or terrain
        const center = ex0.patch[1][1];
        assert.ok(center, 'center cell must exist');
        const gCenter = (center.c && center.c[0]) || (center.t && center.t[0]);
        assert.strictEqual(gCenter, 120, 'center cell of scenario must be graphic 120');
    });

    test('proceduralFill generates 3x3 and 4x4 combinations from relationship graph', () => {
        const patch3 = rooms.proceduralFill(rom, 120, 'canopy', 3, 3, 42);
        assert.strictEqual(patch3.length, 3);
        assert.strictEqual(patch3[0].length, 3);
        assert.strictEqual(patch3[1][1].graphic, 120);

        const patch4 = rooms.proceduralFill(rom, 120, 'terrain', 4, 4, 99);
        assert.strictEqual(patch4.length, 4);
        assert.strictEqual(patch4[0].length, 4);
        assert.strictEqual(patch4[2][2].graphic, 120);
    });
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
