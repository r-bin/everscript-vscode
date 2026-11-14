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
// counts as the backdrop. Animated cells are left out of it: Mana draws them from the
// characters at load, which its pixel effects never show again; they are checked apart.

const assert = require('assert');
const fs = require('fs');
const mana = require('../../dist/games/mana/decoder');
const maps = require('../../dist/games/evermore/maps');
const bridge = require('../../dist/games/evermore/imports/mana');
const rooms = require('../../dist/games/evermore/rooms');

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
    assert.strictEqual(bridge.collisionWord(0x00, 0, false), 0x2020);      // no level -> always walkable: the plane may change here
    assert.strictEqual(bridge.collisionWord(0x05, 0, false), 0x60);        // keeps the level (bridge deck) -> plane-transparent
    assert.strictEqual(bridge.collisionWord(0x00, 0x22, false), 0x2021);   // stairs, going right climbs -> shear 1
    assert.strictEqual(bridge.collisionWord(0x02, 0x23, false), 0x2022);   // going right descends -> shear 2
    assert.strictEqual(bridge.collisionWord(0x02, 0x21, false), 0x2020);   // vertical stairs
    assert.strictEqual(bridge.collisionWord(0x02, 0x32, false), 0x202D);   // push left -> drift west
    assert.strictEqual(bridge.collisionWord(0x02, 0, false, 0x07), 0x1020);   // sprite in front -> bit 12
    assert.strictEqual(bridge.collisionWord(0x02, 0, false, 0x02), 0x0420);   // split sprite -> gate nibble 4 (wading)
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

test('a Mana rotation becomes an Evermore palette-cycle descriptor, two per palette at most', () => {
    const rot = (palette, first, count, period, direction) => ({ palette, first, count, period, direction });
    const slotOf = (p) => (p === 7 ? 3 : p === 6 ? 2 : 0);
    const out = bridge.paletteCycles([rot(7, 8, 8, 4, -1), rot(6, 11, 5, 6, 1), rot(7, 1, 2, 2, 1), rot(7, 3, 2, 2, 1), rot(5, 1, 3, 8, 1)], slotOf);
    assert.deepStrictEqual(out.records, [[0x38, 8, 0xFC], [0x2B, 5, 6], [0x31, 2, 2]]);
    assert.strictEqual(out.dropped, 1);                // the third on palette 7; palette 5 draws nothing here
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
    const slot = (w) => ((w & 0x3FF) >> 5) * 8 + ((w & 0x1F) >> 1);
    const moves = (cell) => slot(room.cells[cell * 3]) >= room.graphics.length || slot(room.cells[cell * 3 + 1]) >= room.graphics.length;
    let same = 0, n = 0;
    for (let i = 0; i < ev.width * ev.height; i++) {
        if (moves(Math.floor(i / ev.width / 16) * room.widthTiles + Math.floor((i % ev.width) / 16))) continue;
        const a = ev.data[i * 4 + 3] ? q(ev.data, i * 4) : 0, m = q(mi.rgba, i * 4);
        if (a === m || (a === 0 && m === backdrop)) same++;
        n++;
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

test('Potos Falls opens as room 0x1080 with families m.., two step-on events and a B-trigger', () => {
    const d = service.detail('som-80', 'Potos Falls 1');
    assert.strictEqual(d.romRoomId, 0x1080);
    assert.strictEqual(d.imported, 'mana');
    assert.ok(d.families.length >= 1 && d.families.length <= 7);
    assert.ok(d.families.every(f => /^m\d+$/.test(f.label) && f.tiles > 0), 'every family draws something');
    assert.strictEqual(d.content.enemies.length, mana.mapObjects(som, 0x80).length);
    assert.deepStrictEqual(d.content.triggers.stepOn.map(t => [t.x1, t.y1, t.x2, t.y2, t.label]), [
        [40, 54, 41, 55, 'Mana event 104'], [26, 59, 27, 60, 'Mana event 102']]);
    // The sword in the stone: Mana runs it when walked into (c1 bit 6 clear), so it is solid and B runs it.
    assert.deepStrictEqual(d.content.triggers.bTrigger.map(t => [t.x1, t.y1, t.x2, t.y2, t.label]), [[47, 50, 48, 52, 'Mana event 847']]);
    assert.strictEqual(d.content.romHeader.mapW, 56);
    assert.strictEqual(d.content.romHeader.mapH, 82);
});

test('the converted room is real Evermore data: it decodes, with the step-on bit or a solid B-trigger cell on its events', () => {
    const src = service.resolveRoom(0x1080);
    const room = maps.decodeRoom(src.rom, src.roomId);
    assert.strictEqual(room.header.widthTiles, 56);
    assert.strictEqual(room.triggers.stepOn.length, 2);
    assert.strictEqual(room.triggers.bTrigger.length, 1);
    assert.ok(room.collisionWords[54][40] & 0x4000);
    assert.strictEqual(room.collisionWords[50][47] & 0xC00F, 0x800F);    // solid, B, no step-on
    assert.ok(!(room.collisionWords[50][46] & 0xC000));
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

test('where Mana shows its backdrop through the bushes, Evermore shows it too (not black)', () => {
    // Maps whose sub screen holds BG2 (map $10's bushes): the fill once stopped there entirely.
    // What stays is a few pixels where one bush graphic lies under layer A in one cell, not in another.
    for (const [id, most] of [[0x10, 100], [0x27, 0], [0x17, 3500]]) {
        const room = bridge.convertManaMap(som, id), image = bridge.buildVirtualRom(soe, room, id + 1);
        const ev = maps.renderRoomComposite(image.rom, maps.decodeRoom(image.rom, image.roomId)), mi = mana.renderMap(mana.loadMap(som, id));
        let black = 0;
        for (let i = 0; i < ev.width * ev.height * 4; i += 4) {
            if (ev.data[i] < 8 && ev.data[i + 1] < 8 && ev.data[i + 2] < 8 && (mi.rgba[i] >= 8 || mi.rgba[i + 1] >= 8 || mi.rgba[i + 2] >= 8)) black++;
        }
        assert.ok(black <= most, `map ${id.toString(16)}: ${black} black pixels Mana draws in colour`);
    }
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

test('Potos Falls animates: its colour rotations become palette cycles, its moving tiles channels', () => {
    // Mana map $80 (rom test): palette 6 colours 11-15 move up every 6 frames, palette 7 colours
    // 8-15 (the waterfall) move down every 4. Evermore's rate is frames per shift, its sign the way.
    const src = service.resolveRoom(0x1080), room = maps.decodeRoom(src.rom, src.roomId);
    const conv = bridge.convertManaMap(som, 0x80);
    const slot = (p) => conv.families.findIndex((f) => f.palette === p) + 1;
    assert.deepStrictEqual(room.paletteCycles.map((c) => [c.paletteIndex, c.colorStart, c.span, c.rate]), [[slot(6), 11, 5, 6], [slot(7), 8, 8, -4]]);
    assert.ok(room.animation.length >= 20 && room.animation.every((c) => c.frames.length >= 2), String(room.animation.length));
    assert.strictEqual(room.animatedTiles.length, room.animation.length);
    const ov = rooms.buildRoomTileOverlay(src.rom, src.roomId, 0, 0, 'composite', '', '', true);
    assert.ok(ov.animation && ov.animation.groups.length > 0, JSON.stringify(ov.animation && ov.animation.skipped));
});

test('Potos Falls: the stairs\' shear lies on Mana\'s stair cells only', () => {
    // Shaping once spread a `$23` shear cell by cell over the grass right of the bridge.
    const conv = bridge.convertManaMap(som, 0x80), src = mana.loadMap(som, 0x80);
    const sheared = [];
    for (let y = 0; y < conv.heightTiles; y++) for (let x = 0; x < conv.widthTiles; x++) {
        const v = conv.cells[(y * conv.widthTiles + x) * 3 + 2];
        if ((v & 0x2000) && ((v & 0xF) === 1 || (v & 0xF) === 2)) sheared.push([x, y, mana.metatileCollision(som, src, 'A', src.cell('A', x, y))[2]]);
    }
    assert.ok(sheared.length > 0 && sheared.every(([, , c2]) => c2 === 0x22 || c2 === 0x23), JSON.stringify(sheared));
});

test('Play in emulator: a converted map becomes a ROM the game can address, drawing what the editor draws', () => {
    // The game reaches graphics and families through 16-bit offsets ($CC:C88C, $90:A1B4: 3·id; 32·family),
    // so the ROM takes over the top vanilla ids rather than the in-memory image's (rom-export-own.ts).
    const own = require('../../dist/games/evermore/rooms/rendering/rom-export-own');
    for (const id of [0x80, 0x10, 0x66, 0x88]) {
        const p = service.playable(0x1000 + id);
        const { rom, report } = own.buildOwnRoomExportRom(soe, p.room, p.start);
        own.verifyOwnRoomExport(rom, p.shown);
        assert.strictEqual(rom.length, 0x400000);
        assert.ok(report.graphicIds[1] * 3 < 0x10000 && report.familyIds.every((f) => f < 365), JSON.stringify(report));
        assert.strictEqual(maps.decodeRoom(rom, 0x15).triggers.stepOn.length, 0, 'Mana step events are left out');
    }
    assert.deepStrictEqual(service.playable(0x1080).start, { x: 33, y: 40 });   // plain floor: no stair, no current
    assert.strictEqual(service.playable(0x34), null);
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
