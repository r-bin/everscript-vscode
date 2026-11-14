// TODO port to TS (docs/todo/port-to-ts.md)
'use strict';
// Terranigma rooms as Evermore rooms (src/games/evermore/imports/terra), end to end on both real ROMs:
// converted, encoded with Evermore's own encoder, decoded and drawn by Evermore's renderer, and served to the
// Rooms tab. Skips without both ROMs. Rom tier: ~25 s (every picture is converted once).
// Run: node tests/terra/terra-evermore.test.js  (both ROMs from the ROM library: npm run roms)
//
// Goldens are observed facts (counts, ids, agreement), never ROM bytes. "Agreement" is the share of pixels
// where Evermore's render of the converted room equals src/games/terra/decoder's render (5 bits per channel).

const assert = require('assert');
const fs = require('fs');

const SOE = require('../../dist/games').romPath('evermore') || '', TERRA = require('../../dist/games').romPath('terra') || '';
let passed = 0, failed = 0;
function test(name, fn) {
    try { fn(); console.log('  ✓ ' + name); passed++; }
    catch (e) { console.error('  ✗ ' + name + '\n    ' + (e.stack || e.message)); failed++; }
}

console.log('\nTerranigma -> Evermore rooms:');
if (!SOE || !TERRA || !fs.existsSync(SOE) || !fs.existsSync(TERRA)) {
    console.log('  skipped (add both ROMs: npm run roms -- add <path>)');
} else {
    const terra = require('../../dist/games/terra/decoder');
    const maps = require('../../dist/games/evermore/maps');
    const { createImportedRooms } = require('../../dist/games/evermore/imports');
    const soe = new Uint8Array(fs.readFileSync(SOE)), terraRom = new Uint8Array(fs.readFileSync(TERRA));
    const service = createImportedRooms({ soeRom: () => soe, manaRom: () => null, terraRom: () => terraRom });
    const q = (d, i) => (d[i] >> 3) << 10 | (d[i + 1] >> 3) << 5 | (d[i + 2] >> 3);
    const agreement = (id) => {
        const src = service.resolveRoom(0x2000 + id);
        const ev = maps.renderRoomComposite(src.rom, maps.decodeRoom(src.rom, src.roomId)), tr = terra.renderRoom(terra.loadRoom(terraRom, id));
        let same = 0;
        for (let i = 0; i < ev.width * ev.height; i++) if ((ev.data[i * 4 + 3] ? q(ev.data, i * 4) : 0) === q(tr.rgba, i * 4)) same++;
        return same / (ev.width * ev.height);
    };

    test('the rail: one Terranigma group, a row per picture, in groups of 64 ids', () => {
        const g = service.groups().find((x) => x.key === 'terra');
        assert.strictEqual(g.label, 'Terranigma');
        assert.strictEqual(g.areas.reduce((n, a) => n + a.rooms.length, 0), 511);
        assert.deepStrictEqual(g.areas[0].rooms.find((r) => r.id === 'terra-a'), { id: 'terra-a', name: 'Room $00A', tag: 'terra 00a', same: [] });
    });

    test('Crysta opens as room 0x200A: families t<n>, exits as step-on boxes, its map change as an object', () => {
        const d = service.detail('terra-a');
        assert.strictEqual(d.romRoomId, 0x200a);
        assert.strictEqual(d.imported, 'terra');
        assert.ok(d.families.length >= 1 && d.families.length <= 7 && d.families.every((f) => /^t\d+$/.test(f.label) && f.tiles > 0));
        assert.strictEqual(d.conversion.exits, 9);
        assert.ok(d.content.triggers.stepOn.every((t) => /^Terranigma exit to \$/.test(t.label)));
        assert.strictEqual(d.conversion.mapChanges, 1);
        const src = service.resolveRoom(0x200a), room = maps.decodeRoom(src.rom, src.roomId);
        assert.strictEqual(room.objects.length, 1);
        const t = d.content.triggers.stepOn[0];
        assert.ok(room.collisionWords[t.y1][t.x1] & 0x4000, 'the exit cell has the step-on bit');
        assert.deepStrictEqual(d.start, { x: 31, y: 58 });     // where the game's exits into Crysta arrive
    });

    test('a chest becomes a solid B-trigger cell', () => {
        const d = service.detail('terra-108');
        const [chest] = terra.roomChests(terraRom, 0x108);
        assert.deepStrictEqual(d.content.triggers.bTrigger.map((t) => [t.x1, t.y1]), [[chest.x, chest.y]]);
        assert.match(d.content.triggers.bTrigger[0].label, /^Terranigma chest/);
        const src = service.resolveRoom(0x2108), room = maps.decodeRoom(src.rom, src.roomId);
        assert.strictEqual(room.collisionWords[chest.y][chest.x] & 0x800f, 0x800f);
    });

    test('Evermore\'s render of converted rooms agrees with the Terranigma render', () => {
        // Crysta, Ark's house, a town (BG2 kept on neither screen: left out), a village; the halving room keeps its dimming.
        const got = [0x0a, 0x0f, 0x60, 0x12, 0x4c].map((id) => Math.round(agreement(id) * 1000) / 10);
        assert.ok(got.every((v) => v >= 96), got.join(' '));
    });

    test('every picture converts into a room Evermore decodes', () => {
        let n = 0, over = 0;
        for (const [id] of terra.roomCatalog(terraRom).pictures) {
            const d = service.detail('terra-' + id.toString(16));
            const src = service.resolveRoom(0x2000 + id), room = maps.decodeRoom(src.rom, src.roomId);
            assert.strictEqual(room.header.widthTiles * room.header.heightTiles, d.content.initMap.x2 * d.content.initMap.y2 / 4);
            if (d.conversion.droppedGraphics) over++;
            n++;
        }
        assert.strictEqual(n, 511);
        assert.strictEqual(over, 11, 'rooms past Evermore\'s 264 graphics');
    });

    test('Play in emulator: a converted room becomes a ROM the game can address, drawing what the editor draws', () => {
        const own = require('../../dist/games/evermore/rooms/rendering/rom-export-own');
        for (const id of [0x200a, 0x2108, 0x213f]) {
            const p = service.playable(id);
            const { rom, report } = own.buildOwnRoomExportRom(soe, p.room, p.start);
            own.verifyOwnRoomExport(rom, p.shown);
            assert.strictEqual(report.room, 0x15);
            assert.strictEqual(maps.decodeRoom(rom, 0x15).triggers.stepOn.length, 0, 'Terranigma exits are left out');
        }
        assert.strictEqual(service.playable(0x34), null);
    });
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exitCode = failed ? 1 : 0;
