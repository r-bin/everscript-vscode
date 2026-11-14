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
        // Seven exits lie on wall cells (closed doors): B-triggers, as step-on boxes the Boy could never fire them.
        assert.strictEqual(d.conversion.doorExits, 7);
        assert.ok(d.content.triggers.bTrigger.some((t) => t.x1 === 56 && t.y1 === 46 && /^Terranigma exit to \$01D \(door: B\)$/.test(t.label)));
        assert.deepStrictEqual(d.content.triggers.stepOn.map((t) => [t.x1, t.y1]), [[32, 12], [0, 62]]);
        assert.strictEqual(d.conversion.mapChanges, 1);
        const src = service.resolveRoom(0x200a), room = maps.decodeRoom(src.rom, src.roomId);
        assert.strictEqual(room.objects.length, 1);
        const t = d.content.triggers.stepOn[0];
        assert.ok(room.collisionWords[t.y1][t.x1] & 0x4000, 'the exit cell has the step-on bit');
        assert.strictEqual(room.collisionWords[46][56] & 0x800f, 0x800f, 'a door cell is a solid B-trigger cell');
        assert.deepStrictEqual(d.start, { x: 31, y: 58 });     // where the game's exits into Crysta arrive
    });

    test('Crysta: a ledge is a wall, a canopy\'s high half and a roof ridge cover the Boy, only the waterfall\'s colours turn', () => {
        // Docs/terra/evermore-rooms.md: type 8 (a ledge crossed in a jump) is a wall; cell (19,54) of a canopy notch draws its
        // lower half with priority (Ark walks behind it): split onto layer 1 at priority 1; palette helper $06 rotates palette 7.
        const { convertTerraRoom } = require('../../dist/games/evermore/imports/terra');
        const c = convertTerraRoom(terraRom, 0x0a, () => 42471), w = c.widthTiles, at = (x, y, k) => c.cells[(y * w + x) * 3 + k];
        assert.strictEqual(at(39, 10, 2), 0x2f);
        // The top of a diagonal ledge segment, a `/` with floor below and right (Ark walks up the slope into it): the
        // upper left is solid, not the lower right.
        assert.strictEqual(at(21, 12, 2) & 0x0f, 0x0a);
        assert.ok(at(19, 54, 0) & 0x2000, 'layer 1 holds the high half, at priority 1');
        assert.ok(!(at(19, 54, 1) & 0x2000), 'layer 2 keeps the rest at priority 0');
        const slot = c.families.findIndex((f) => f.palette === 7) + 1;
        assert.deepStrictEqual(c.paletteCycles, [[(slot << 4) | 1, 7, 6]]);
        // A roof ridge's high characters have transparent pixels (the backdrop shows): split too, so the backdrop
        // fill stays behind the Boy (Ark is seen through them).
        assert.ok(at(9, 4, 0) & 0x2000 && !(at(9, 4, 1) & 0x2000), 'the ridge is split');
        // Every pixel in a cycling colour is one in Terranigma too: past 256 graphics, the pond's still tile was drawn
        // as a solid river colour that blinked with the river.
        const room = terra.loadRoom(terraRom, 0x0a), l0 = room.layers.find((l) => l.index === 0);
        const chars = { vram: room.vram, base: room.ppu.bgs[terra.layerBg(l0) - 1].chars * 2, palette: room.palette };
        const { rawTile } = require('../../dist/games/evermore/imports/terra/graphics');
        const pixel = (word, x, y) => {
            const g = c.graphics[maps.wordSlot(word)];
            if (word & 0x4000) x = 15 - x;
            if (word & 0x8000) y = 15 - y;
            const o = ((y >> 3) * 2 + (x >> 3)) * 32 + (y & 7) * 2, m = 1 << (7 - (x & 7));
            return (g[o] & m ? 1 : 0) | (g[o + 1] & m ? 2 : 0) | (g[o + 16] & m ? 4 : 0) | (g[o + 17] & m ? 8 : 0);
        };
        let blinking = 0;
        for (let y = 0; y < c.heightTiles; y++) for (let x = 0; x < w; x++) {
            const t = rawTile(chars, l0.metatiles, l0.cells[y * l0.w + x] & 0x1ff);
            for (let i = 0; i < 256; i++) {
                const top = pixel(at(x, y, 0), i & 15, i >> 4) ? at(x, y, 0) : at(x, y, 1), k = pixel(top, i & 15, i >> 4);
                const cycles = ((top >> 10) & 7) === slot && k >= 1 && k <= 7;
                if (cycles && !(t.pal[i] === 7 && t.px[i] >= 1 && t.px[i] <= 7)) blinking++;
            }
        }
        assert.strictEqual(blinking, 0);
    });

    test('a chest becomes a solid B-trigger cell', () => {
        const d = service.detail('terra-108');
        const [chest] = terra.roomChests(terraRom, 0x108);
        const boxes = d.content.triggers.bTrigger.filter((t) => /^Terranigma chest/.test(t.label));
        assert.deepStrictEqual(boxes.map((t) => [t.x1, t.y1]), [[chest.x, chest.y]]);
        const src = service.resolveRoom(0x2108), room = maps.decodeRoom(src.rom, src.roomId);
        assert.strictEqual(room.collisionWords[chest.y][chest.x] & 0x800f, 0x800f);
    });

    test('Evermore\'s render of converted rooms agrees with the Terranigma render', () => {
        // Crysta, Ark's house, a town (BG2 kept on neither screen: left out), a village; the halving room keeps its dimming.
        const got = [0x0a, 0x0f, 0x60, 0x12, 0x4c].map((id) => Math.round(agreement(id) * 1000) / 10);
        assert.ok(got.every((v) => v >= 96), got.join(' '));
    });

    test('every picture converts into a room Evermore decodes', () => {
        let n = 0, over = 0, dropped = 0;
        for (const [id] of terra.roomCatalog(terraRom).pictures) {
            const d = service.detail('terra-' + id.toString(16));
            const src = service.resolveRoom(0x2000 + id), room = maps.decodeRoom(src.rom, src.roomId);
            assert.strictEqual(room.header.widthTiles * room.header.heightTiles, d.content.initMap.x2 * d.content.initMap.y2 / 4);
            if (d.conversion.substitutedGraphics) over++;
            dropped += d.conversion.droppedGraphics;
            n++;
        }
        assert.strictEqual(n, 511);
        assert.strictEqual(over, 15, 'rooms past Evermore\'s 256 graphics: their rarest tiles drawn as the nearest listed one');
        assert.strictEqual(dropped, 0, 'no tile drawn empty');
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
