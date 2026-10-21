// The Terranigma decoder (src/games/terra/decoder) and terra:// (src/games/terra/resources): ROM identification on
// synthetic headers, then — with the European ROM from the ROM library — the room table, the catalog, one room as
// the game's own loader builds it (checked against the running game: docs/terra/README.md §5), the context of a
// room that keeps graphics from before, the pictures. Skips the ROM part without the ROM.
// Run: node tests/terra/terra-rom.test.mts
import assert from 'node:assert';
import * as fs from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { identifyRom } = require('../../dist/platform');
const terra = require('../../dist/games/terra');
const { resolveTerra } = require('../../dist/games/terra/resources/files');

let passed = 0, failed = 0;
function test(name: string, fn: () => void) {
    try { fn(); console.log('  ✓ ' + name); passed++; }
    catch (e) { console.error('  ✗ ' + name + '\n    ' + ((e as Error).stack || e)); failed++; }
}

console.log('\nTerranigma — synthetic:');

test('isTerraRom detects Terranigma titles and rejects others', () => {
    const rom = new Uint8Array(0x100000);
    rom.set(Buffer.from('TERRANIGMA P         '), 0xFFC0);
    rom[0xFFD5] = 0x31;
    rom[0xFFDE] = 0xFF; rom[0xFFDF] = 0xFF;
    assert.strictEqual(terra.isTerraRom(rom), true);
    rom.set(Buffer.from('TENCHI-JPN           '), 0xFFC0);
    assert.strictEqual(terra.isTerraRom(rom), true);
    rom.set(Buffer.from('SECRET OF EVERMORE   '), 0xFFC0);
    assert.strictEqual(terra.isTerraRom(rom), false);
});

test('room table bounds; a ROM other than the base one is not decoded', () => {
    assert.strictEqual(terra.TERRA_ROOM_COUNT, 1104);
    const small = new Uint8Array(100);
    assert.strictEqual(terra.readRoomBusAddress(small, 0), null);
    assert.strictEqual(terra.readRoomBusAddress(small, -1), null);
    assert.strictEqual(terra.readRoomBusAddress(small, 2000), null);
    const other = new Uint8Array(0x400000);
    other.set([0x50, 0x83, 0x9A], terra.TERRA_BASE_ROOM_TABLE_OFFSET);
    assert.strictEqual(terra.isBaseTerraRom(other), false);
    assert.strictEqual(terra.loadRoom(other, 0), null);
    assert.strictEqual(terra.roomCatalog(other).supported, false);
});

const romPath: string = require('../../dist/games').romPath('terra') || '';
const rom = romPath && fs.existsSync(romPath) ? new Uint8Array(fs.readFileSync(romPath)) : null;

if (!rom) {
    console.log('\nTerranigma ROM tests skipped (add the ROM with npm run roms -- add <path>).');
} else {
    console.log('\nTerranigma — ROM (' + romPath + '):');

    test('the ROM is the European base release, HiROM FastROM PAL', () => {
        const id = identifyRom(rom);
        assert.strictEqual(id.game, 'terra');
        assert.strictEqual(id.variant, 'eu');
        assert.strictEqual(terra.isBaseTerraRom(rom), true);
        const h = terra.readTerraHeader(rom);
        assert.strictEqual(h.title, 'TERRANIGMA P');
        assert.strictEqual(h.mapMode, 0x31);
    });

    test('room table: script pointers, unused slots ($000002)', () => {
        assert.strictEqual(terra.readRoomBusAddress(rom, 0x00A), 0x9A8350);
        assert.strictEqual(terra.readRoomFileOffset(rom, 0x00A), 0x1A8350);
        assert.strictEqual(terra.isRoomSlotUsed(rom, 0x008), false);
        assert.strictEqual(terra.readRoomFileOffset(rom, 0x008), null);
    });

    let catalog: { rooms: { id: number; w: number; context: number[] }[]; pictures: number[][]; groups: unknown[]; used: number; unused: number };
    test('the catalog: every used room, which load a map, the pictures they show (header-only runs, fast)', () => {
        const t0 = Date.now();
        catalog = terra.roomCatalog(rom);
        const ms = Date.now() - t0;
        assert.strictEqual(catalog.used, 903);
        assert.strictEqual(catalog.unused, 201);
        assert.strictEqual(catalog.rooms.filter(r => r.w).length, 881);
        assert.ok(catalog.pictures.length > 380 && catalog.pictures.length < 881, String(catalog.pictures.length));
        assert.ok(catalog.pictures.some(p => p.includes(0x00C) && p.includes(0x00D)), 'rooms $00C and $00D share a picture');
        assert.strictEqual(catalog.groups.length, 18);
        assert.ok(ms < 10000, ms + ' ms');
    });

    test('room $00F (Ark’s house) as the loader builds it: layers, sizes, display registers (as in the running game)', () => {
        const r = terra.loadRoom(rom, 0x00F);
        assert.ok(r);
        assert.deepStrictEqual(r.layers.map((l: { index: number; bg: number; w: number; h: number }) => [l.index, l.bg, l.w, l.h]), [[0, 2, 32, 64], [1, 1, 32, 64]]);
        assert.deepStrictEqual(r.context, []);
        assert.deepStrictEqual([r.ppu.mode, r.ppu.main, r.ppu.sub, r.ppu.cgwsel, r.ppu.cgadsub], [0x09, 0x17, 0x12, 0x82, 0x21]);
        for (const s of [0x80, 0x40, 0x20, 0x10]) assert.ok(r.run.sections.includes(s), 'section $' + s.toString(16));
        assert.ok(r.run.sets.includes(1), 'enters shared script 1');
        assert.strictEqual(r.palette[0], r.palette[32], 'the backdrop is colour 32 ($8D:8C52)');
        const pic = terra.renderRoom(r);
        assert.deepStrictEqual([pic.width, pic.height], [512, 1024]);
        const colours = new Set<number>();
        for (let i = 0; i < pic.rgba.length; i += 4) colours.add(pic.rgba[i] << 16 | pic.rgba[i + 1] << 8 | pic.rgba[i + 2]);
        assert.ok(colours.size > 60, colours.size + ' colours');
    });

    test('a room that keeps graphics from before is loaded after the closest rooms that load them', () => {
        assert.deepStrictEqual(terra.contextRooms(rom, 0x041), [0x025, 0x040]);
        assert.deepStrictEqual(terra.contextRooms(rom, 0x00F), []);
        assert.deepStrictEqual(terra.contextRooms(rom, 0x03C), [], 'no map of its own: no context');
    });

    test('collision: the movement tables give each cell type a rule per direction ($80:D542, $80:D8E8, $80:DC60, $80:DFDC)', () => {
        const rules = terra.cellTypeRules(rom);
        const look = (t: number) => terra.cellClass(rules[t]);
        assert.strictEqual(rules.length, 32);
        assert.strictEqual(look(0), 'open', 'floor in Ark’s house');
        assert.strictEqual(look(2), 'open', 'the door gap');
        assert.strictEqual(look(14), 'wall');
        assert.strictEqual(look(12), 'wall', 'furniture');
        assert.strictEqual(look(6), 'diagonal');
        assert.strictEqual(look(7), 'diagonal');
        assert.deepStrictEqual(rules[31].moves, { up: 'wall', down: 'open', left: 'wall', right: 'wall' }, 'a drop: passes moving down only');
        assert.deepStrictEqual(rules[26].moves, { up: 'wall', down: 'wall', left: 'open', right: 'open' });
        assert.strictEqual(rules[8].moves.up, 'gated');
        assert.deepStrictEqual([rules[0].ground, rules[2].ground, rules[14].ground], ['open', 'flagged', 'blocked']);
    });

    test('exits ($81:8000): rooms $00F and $00A as the running game takes them, and they lead back', () => {
        const ark = terra.roomExits(rom, 0x00F);
        assert.deepStrictEqual(ark.map((e: { x: number; y: number; w: number; h: number; targets: { room: number }[] }) => [e.x, e.y, e.w, e.h, e.targets[0].room]),
            [[24, 12, 1, 2, 0x010], [27, 5, 1, 1, 0x122]]);
        const crysta = terra.roomExits(rom, 0x00A);
        assert.strictEqual(crysta.length, 9);
        assert.deepStrictEqual(crysta[0].targets[0], { flag: null, room: 0x01D, x: 368, y: 432, style: [0, 6] });
        assert.deepStrictEqual(terra.roomExits(rom, 0x001), []);
        // Across the game nearly every exit has one back from the room it leads to.
        let all = 0, back = 0;
        for (let id = 0; id < terra.TERRA_ROOM_COUNT; id++) for (const e of terra.roomExits(rom, id)) for (const t of e.targets) {
            all++;
            if (terra.roomExits(rom, t.room).some((b: { targets: { room: number }[] }) => b.targets.some(u => u.room === id))) back++;
        }
        assert.ok(all > 2000 && back / all > 0.95, back + ' of ' + all);
        assert.ok(terra.roomExits(rom, 0x00A).every((e: { at: number }) => e.at >> 16 === 0x81));
    });

    test('chests ($99:D859): room $103’s chest as the running game opens it; every list', () => {
        assert.deepStrictEqual(terra.roomChests(rom, 0x103), [{ x: 12, y: 37, flags: 0, gate: null, contents: 0x10, opened: 0x580, at: 0x99E142 }]);
        assert.deepStrictEqual(terra.roomChests(rom, 0x00F), []);
        let n = 0, rooms = 0, gated = 0;
        for (let id = 0; id < terra.TERRA_ROOM_COUNT; id++) {
            const c = terra.roomChests(rom, id);
            if (c.length) rooms++;
            n += c.length; gated += c.filter((x: { gate: number | null }) => x.gate !== null).length;
        }
        assert.deepStrictEqual([n, rooms, gated], [132, 96, 2]);
    });

    test('map changes ($99:D4E7): rooms $101 and $109 as the running game applies them', () => {
        const c101 = terra.roomChanges(rom, 0x101);
        assert.deepStrictEqual(c101.map((c: { bit: number }) => c.bit), [0, 1]);
        assert.deepStrictEqual(c101[0].edits, [{ layer: 0, kind: 'copy', from: [0, 47], w: 2, h: 1, x: 7, y: 4 }]);
        const room = terra.loadRoom(rom, 0x101);
        // In the game, with bit 0 set: cell 7,4 of layer 0 becomes $00C4 (8,4 already holds $0EC5).
        assert.deepStrictEqual(terra.changeCells(room, c101[0]), [[0, 7, 4, 0x00C4], [0, 8, 4, 0x0EC5]]);
        // With bit 6 set: room $109's cell 16,8 becomes metatile $0FF with its type from the type table ($1CFF).
        const c109 = terra.roomChanges(rom, 0x109);
        assert.deepStrictEqual(terra.changeCells(terra.loadRoom(rom, 0x109), c109[0]), [[0, 16, 8, 0x1CFF]]);
        const after = terra.withChange(room, c101[0]);
        assert.strictEqual(after.layers[0].cells[4 * 16 + 7], 0x00C4);
        assert.notStrictEqual(room.layers[0].cells[4 * 16 + 7], 0x00C4, 'the loaded room is untouched');
    });

    test('terra://: info, rooms, a room’s data and pictures', () => {
        const read = (p: string) => { const n = resolveTerra(p.split('/').filter(Boolean), rom); return n && n.kind === 'file' ? n.read() : null; };
        assert.strictEqual(JSON.parse(read('info.json')!.toString()).rooms, 903);
        const data = JSON.parse(read('rooms/00f.json')!.toString());
        assert.deepStrictEqual([data.w, data.h, data.layers.length, data.layers[0].cells.length, data.layers[0].metatiles.length], [32, 64, 2, 2048, 2048]);
        assert.strictEqual(data.exits.length, 2);
        assert.deepStrictEqual([data.chests.length, data.changes.length], [0, 0]);
        assert.ok(read('rooms/101.c1.png'), 'a room with a map change applied');
        assert.strictEqual(resolveTerra(['rooms', '101.c2.png'], rom), null, 'room $101 has two map changes');
        const types = JSON.parse(read('cell-types.json')!.toString());
        assert.deepStrictEqual([types.length, types[14].look, types[31].look], [32, 'wall', 'one-way']);
        assert.deepStrictEqual([...read('rooms/00f.png')!.subarray(1, 4)], [0x50, 0x4E, 0x47]);
        assert.ok(read('rooms/00f.tiles.l1.png'));
        assert.strictEqual(resolveTerra(['rooms', '008.png'], rom), null, 'unused slot');
        assert.strictEqual(resolveTerra(['rooms', '03c.png'], rom), null, 'no map of its own');
    });
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
