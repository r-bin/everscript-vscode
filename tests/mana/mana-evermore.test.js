// TODO port to TS (docs/todo/port-to-ts.md)
'use strict';
// Secret of Mana maps as Evermore rooms (src/games/evermore/imports/mana), end to end on both real
// ROMs: converted, encoded with Evermore's own encoder, decoded and drawn by Evermore's
// renderer, and served to the Rooms tab. Skips without both ROMs.
// Run: node tests/mana/mana-evermore.test.js  (both ROMs from the ROM library: npm run roms)
//
// Goldens are observed facts (counts, ids, agreement), never ROM bytes. "Agreement" is the
// share of pixels where Evermore's render of the converted room equals src/games/mana/decoder's render
// of the map (5 bits per channel); Evermore has no backdrop colour, so its black there
// counts as the backdrop.

const assert = require('assert');
const fs = require('fs');
const mana = require('../../dist/games/mana/decoder');
const maps = require('../../dist/games/evermore/maps');
const bridge = require('../../dist/games/evermore/imports/mana');
const rooms = require('../../src/games/evermore/rooms');

let passed = 0, failed = 0;
function test(name, fn) {
    try { fn(); console.log('  ✓ ' + name); passed++; }
    catch (e) { console.error('  ✗ ' + name + '\n    ' + (e.stack || e.message)); failed++; }
}

console.log('\nSecret of Mana -> Evermore (no ROM):');

test('Mana collision becomes Evermore collision words', () => {
    assert.strictEqual(bridge.collisionWord(0x03, 0, false), 0x2F);        // wall
    assert.strictEqual(bridge.collisionWord(0x01, 0, false), 0x10);        // level-1 floor -> plane 1
    assert.strictEqual(bridge.collisionWord(0x02, 0, true), 0x4020);       // level-2 floor, step-on
    assert.strictEqual(bridge.collisionWord(0x00, 0, false), 0x60);        // either level -> plane-transparent
    assert.strictEqual(bridge.collisionWord(0x02, 0x14, false), 0x22);     // bottom-left half wall
});

test('a graphic survives Evermore\'s own decoder, and step cells merge into boxes', () => {
    const px = new Uint8Array(256).map((_, i) => (i * 7 + (i >> 4)) & 15);
    assert.deepStrictEqual(Array.from(maps.decodeTilePixels(bridge.encodeGraphic(px))), Array.from(px));
    assert.strictEqual(bridge.slotChr(9), 0x22);       // Block 1 slot 9 = character $22 (render.ts inverse)
    const boxes = bridge.triggerBoxes([{ x: 1, y: 1, event: 5 }, { x: 2, y: 1, event: 5 }, { x: 1, y: 2, event: 5 },
        { x: 2, y: 2, event: 5 }, { x: 4, y: 1, event: 6 }]);
    assert.deepStrictEqual(boxes, [{ x1: 1, y1: 1, x2: 3, y2: 3, scriptId: 5 }, { x1: 4, y1: 1, x2: 5, y2: 2, scriptId: 6 }]);
});

const SOE = require('../../dist/games').romPath('evermore') || '', SOM = require('../../dist/games').romPath('mana') || '';
if (!SOE || !SOM || !fs.existsSync(SOE) || !fs.existsSync(SOM)) {
    console.log('\nSecret of Mana -> Evermore ROM tests skipped (add both ROMs: npm run roms -- add <path>).');
    console.log(`\n${passed} passed, ${failed} failed`);
    process.exit(failed ? 1 : 0);
}

const soe = new Uint8Array(fs.readFileSync(SOE)), som = new Uint8Array(fs.readFileSync(SOM));

function agreement(id) {
    const room = bridge.convertManaMap(som, id);
    const image = bridge.buildVirtualRom(soe, room, id + 1);
    const ev = maps.renderRoomComposite(image.rom, maps.decodeRoom(image.rom, image.roomId));
    const map = mana.loadMap(som, id), mi = mana.renderMap(map);
    const q = (d, i) => (d[i] >> 3) << 10 | (d[i + 1] >> 3) << 5 | (d[i + 2] >> 3);
    const b = map.cgram[0], backdrop = (b & 31) << 10 | ((b >> 5) & 31) << 5 | ((b >> 10) & 31);
    let same = 0;
    const n = ev.width * ev.height;
    for (let i = 0; i < n; i++) {
        const a = ev.data[i * 4 + 3] ? q(ev.data, i * 4) : 0, m = q(mi.rgba, i * 4);
        if (a === m || (a === 0 && m === backdrop)) same++;
    }
    return same / n;
}

console.log('\nSecret of Mana -> Evermore rooms:');

const service = bridge.createManaRooms({ soeRom: () => soe, manaRom: () => som });

test('the rail lists the Mana areas, one row per picture', () => {
    const groups = service.railGroups();
    assert.strictEqual(groups[0].area, 'Potos Falls');
    assert.deepStrictEqual(groups[0].rooms.map(r => r.id), ['som-80', 'som-81', 'som-82']);
    assert.strictEqual(groups.reduce((n, g) => n + g.rooms.length, 0) > 200, true);
});

test('Potos Falls opens as room 0x1080 with families m.. and its three step-on events', () => {
    const d = service.detail('som-80', 'Potos Falls 1');
    assert.strictEqual(d.romRoomId, 0x1080);
    assert.strictEqual(d.imported, 'mana');
    assert.ok(d.families.length >= 1 && d.families.length <= 7);
    assert.ok(d.families.every(f => /^m\d+$/.test(f.label) && f.tiles > 0), 'every family draws something');
    assert.strictEqual(d.content.enemies.length, mana.mapObjects(som, 0x80).length);
    assert.deepStrictEqual(d.content.triggers.stepOn.map(t => [t.x1, t.y1, t.x2, t.y2, t.label]), [
        [47, 50, 48, 52, 'Mana event 847'], [40, 54, 41, 55, 'Mana event 104'], [26, 59, 27, 60, 'Mana event 102']]);
    assert.strictEqual(d.content.romHeader.mapW, 56);
    assert.strictEqual(d.content.romHeader.mapH, 82);
});

test('the converted room is real Evermore data: it decodes, with the step-on bit on its event cells', () => {
    const src = service.resolveRoom(0x1080);
    const room = maps.decodeRoom(src.rom, src.roomId);
    assert.strictEqual(room.header.widthTiles, 56);
    assert.strictEqual(room.triggers.stepOn.length, 3);
    assert.ok(room.collisionWords[50][47] & 0x4000);
    assert.ok(!(room.collisionWords[50][46] & 0x4000));
    assert.ok(room.tileFamilies.every(f => bridge.ids.isImportedFamily(f)));
    assert.strictEqual(service.resolveRoom(0x34), null);
});

test('the Rooms tab draws it, lists its stamps and its families\' tiles', () => {
    const src = service.resolveRoom(0x1080);
    const ov = rooms.buildRoomTileOverlay(src.rom, src.roomId, 0, 0, 'composite', '', '', false);
    assert.strictEqual(ov.imageWidth, 56 * 16);
    const pal = rooms.buildRoomMetatilePalette(src.rom, src.roomId);
    assert.ok(pal.entries.length > 100, String(pal.entries.length));
    const fam = service.detail('som-80').families[0].id;
    const conv = service.resolveFamily(fam);
    assert.ok(rooms.buildFamilySheet(conv.rom, fam, conv.roomId).count > 0);
});

test('Evermore\'s render of converted rooms agrees with the Mana render', () => {
    const got = [0x80, 0xb0, 0x10, 0x88].map(id => Math.round(agreement(id) * 1000) / 10);
    assert.ok(got[0] >= 90 && got[1] >= 98 && got[2] >= 99 && got[3] >= 95, got.join(' '));
});

test('weapon-cut cells become Evermore cuttable grass, event-flag pieces Evermore objects', () => {
    const r81 = bridge.convertManaMap(som, 0x81), v81 = bridge.buildVirtualRom(soe, r81, 0x82);
    assert.strictEqual(maps.decodeRoom(v81.rom, v81.roomId).cuttableGrass.tiles.length, r81.cut.length);
    assert.strictEqual(r81.cut.length, 154);
    const r66 = bridge.convertManaMap(som, 0x66), v66 = bridge.buildVirtualRom(soe, r66, 0x67);
    const objs = maps.decodeRoom(v66.rom, v66.roomId).objects;
    assert.deepStrictEqual(objs.map(o => [o.states[0].tileX, o.states[0].tileY, o.states[0].targetWidth, o.states[0].targetHeight]), [[29, 28, 3, 2]]);
    assert.deepStrictEqual(r66.objects.map(o => [o.flag, o.values]), [[0x10, [0, 6]]]);
});

test('every map converts into a room Evermore decodes', () => {
    let n = 0;
    for (let id = 0; id < mana.MAP_COUNT; id++) {
        const room = bridge.convertManaMap(som, id);
        if (!room) continue;
        const image = bridge.buildVirtualRom(soe, room, id + 1);
        const d = maps.decodeRoom(image.rom, image.roomId);
        assert.strictEqual(d.header.widthTiles * d.header.heightTiles, room.widthTiles * room.heightTiles);
        n++;
    }
    assert.strictEqual(n, 408);
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
