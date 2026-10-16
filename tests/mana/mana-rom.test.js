'use strict';
// Secret of Mana library + som:// files against the real ROM. Skips without it.
// Run: node tests/mana/mana-rom.test.js  (the Mana ROM from the ROM library: npm run roms)
//
// The goldens are observed facts (counts, sizes, render hashes), never ROM bytes.
// The render hashes were taken after the renderer matched the running game:
// the Potos waterfall (map $80) captured headless agreed with the game's WRAM
// layer buffers, metatile tables, VRAM characters and CGRAM, and maps $30/$23
// loaded on demand matched the game's screen at 98.9% / 96.9% (the rest sprites).

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const mana = require('../../src/mana');
const { resolveSom, getCatalog } = require('../../src/mana-resources/files');

const ROM_PATH = require('../../dist/games').romPath('mana') || '';
if (!ROM_PATH || !fs.existsSync(ROM_PATH)) {
    console.log('\nSecret of Mana ROM tests skipped (add the Mana ROM: npm run roms -- add <path>).');
    process.exit(0);
}
const rom = new Uint8Array(fs.readFileSync(ROM_PATH));

let passed = 0, failed = 0;
function test(name, fn) {
    try { fn(); console.log('  ✓ ' + name); passed++; }
    catch (e) { console.error('  ✗ ' + name + '\n    ' + (e.stack || e.message)); failed++; }
}

console.log('\nSecret of Mana — ROM (' + ROM_PATH + '):');

test('the ROM is recognised by its title', () => assert.ok(mana.isManaRom(rom)));

test('408 of the 512 map ids have pieces', () => {
    let n = 0;
    for (let id = 0; id < mana.MAP_COUNT; id++) if (mana.mapSize(rom, id)) n++;
    assert.strictEqual(n, 408);
});

const GOLDEN = {
    128: [56, 82, '828fc103d1e54ce5'],   // Potos Falls: the waterfall
    129: [64, 72, 'e2b30a7e4c1c072f'],   // Potos Falls: the forest
    130: [40, 48, '92ffb26215c127c1'],   // Potos Falls: the stream
    113: [70, 70, 'b6f22aefdbf90a15'],   // Gold City (metatile halves from header byte 2)
    48: [64, 44, 'e9eeb2675c2e3927'],    // Moon Palace entrance
};
for (const [id, [w, h, hash]] of Object.entries(GOLDEN)) {
    test(`map ${id} is ${w}x${h} and renders unchanged`, () => {
        const m = mana.loadMap(rom, Number(id));
        assert.deepStrictEqual([m.w, m.h], [w, h]);
        const img = mana.renderMap(m);
        assert.strictEqual(crypto.createHash('sha256').update(img.rgba).digest('hex').slice(0, 16), hash);
    });
}

test('every map loads and every area id is a real map', () => {
    for (let id = 0; id < mana.MAP_COUNT; id++) {
        const size = mana.mapSize(rom, id);
        const m = mana.loadMap(rom, id);
        assert.strictEqual(!!m, !!size, `map ${id}`);
    }
    for (const a of mana.AREAS) for (const id of a.maps) assert.ok(mana.mapSize(rom, id), `${a.name}: ${id}`);
});

test('som:// lists areas and serves map pictures', () => {
    const c = getCatalog(rom);
    assert.strictEqual(c.maps.length, 408);
    assert.deepStrictEqual(c.areas[0], { name: 'Potos Falls', slug: 'potos-falls', maps: [128, 101, 129, 130], pictures: [[128, 101], [129], [130]] });
    // Variants are found by the picture the map draws, not its piece list: $8E lists two of $8B's pieces in
    // another order. A map listed under no area that draws an area's picture is a variant there ($67 of $88).
    const water = c.areas.find(a => a.name === 'Water Palace');
    assert.deepStrictEqual(water.pictures, [[0x88, 0x67], [0x8B, 0x8E, 0x8F], [0x87]]);
    assert.ok(!c.areas.find(a => a.slug === 'other').maps.includes(0x67));
    assert.strictEqual(c.areas[c.areas.length - 1].slug, 'other');
    const total = c.areas.reduce((n, a) => n + a.maps.length, 0);
    assert.strictEqual(total, 406, 'every map is in at most one area or other ($67 and $1B0 only as variants)');
    assert.strictEqual(new Set(c.areas.flatMap(a => a.pictures.flat())).size, 408, 'every map is shown somewhere');
    const png = resolveSom(['maps', '80.png'], rom).read();
    assert.deepStrictEqual([...png.subarray(1, 4)], [0x50, 0x4e, 0x47]);
    assert.strictEqual(png.readUInt32BE(16), 56 * 16);
    assert.ok(resolveSom(['areas', 'potos-falls.md'], rom).read().toString().includes('../maps/80.png'));
    const empty = [...Array(mana.MAP_COUNT).keys()].find(id => !mana.mapSize(rom, id));
    assert.strictEqual(resolveSom(['maps', empty.toString(16) + '.png'], rom), null);
});

test('map 128 animates the 38 characters and 13 colours the game animates', () => {
    // Checked against the running game: over 480 frames each of these took exactly
    // the same set of states as in the emulator, and nothing else changed there.
    const m = mana.loadMap(rom, 128);
    const t = mana.traceAnimation(rom, m.header);
    assert.strictEqual(t.chars.size, 38);
    assert.deepStrictEqual([...t.colours].sort((a, b) => a - b),
        [0x6b, 0x6c, 0x6d, 0x6e, 0x6f, 0x78, 0x79, 0x7a, 0x7b, 0x7c, 0x7d, 0x7e, 0x7f]);
    const a = JSON.parse(resolveSom(['maps', '80.anim.json'], rom).read());
    assert.strictEqual(a.kinds.length, 138);
    assert.ok(a.images.every(u => u.startsWith('data:image/png;base64,')));
    assert.strictEqual(mana.traceAnimation(rom, mana.readHeader(rom, 176)), null);
});

test('map 128 collision: walls, level-2 floors, a few level-1 and shared floors', () => {
    const m = mana.loadMap(rom, 128);
    const c = mana.collisionOf(rom, m);
    const count = [0, 0, 0, 0];
    for (let i = 0; i < c.w * c.h; i++) count[mana.floorOf(c.bytes[i * 4])]++;
    assert.deepStrictEqual(count, [48, 2, 1184, 3358]);
    const j = JSON.parse(resolveSom(['maps', '80.collision.json'], rom).read());
    assert.strictEqual(j.floor.length, 56 * 82);
    assert.strictEqual(j.specials.length, 4);
});

test('the game\'s own loaders, run on the interpreter, build the same tables and layers', () => {
    const { Cpu65816 } = require('../../src/mana/dist/cpu65816');
    const { SnesBus } = require('../../src/mana/dist/snes-bus');
    for (const id of [16, 113, 128]) {
        const bus = new SnesBus(rom), cpu = new Cpu65816(bus);
        const h = mana.readHeader(rom, id).bytes, m = mana.loadMap(rom, id);
        bus.wram[0x1C] = h[2]; bus.wram[0x1B] = h[1]; cpu.call(0x02A000);
        for (let i = 0; i < 768; i++) assert.strictEqual(bus.wram[0x1C000 + 2 * i] | (bus.wram[0x1C001 + 2 * i] << 8), m.tableA[i]);
        bus.wram[0xDC] = id & 0xFF; bus.wram[0xDD] = id >> 8;
        cpu.call(0x00CB90, { rts: true });
        for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) assert.strictEqual(bus.wram[0x10000 + y * 128 + x], m.mem[y * 128 + x]);
    }
});

test('objects: 2179 records; map $81 spawns its first ones where the game put them', () => {
    let n = 0;
    for (let id = 0; id < mana.MAP_COUNT; id++) if (mana.mapSize(rom, id)) n += mana.mapObjects(rom, id).length;
    assert.strictEqual(n, 2179);
    // Seen headless after a forced load: entities at (x, y) * 16 + 4 pixels.
    assert.deepStrictEqual(mana.mapObjects(rom, 0x81).slice(0, 4).map(o => [o.x, o.y, o.kind]),
        [[22, 37, 0xC001], [20, 26, 0xC001], [33, 21, 0xC001], [44, 20, 0xC001]]);
});

test('step events: map $10 runs the events the game ran (tools/mana/check-events.js)', () => {
    const e = mana.mapEvents(rom, mana.loadMap(rom, 0x10));
    assert.strictEqual(e.onEnter, 0x70E);
    assert.deepStrictEqual(e.steps.map(s => s.event), [0x83F, 0x83F, 0x803, 0x803, 0x606, 0x805, 0x607, 0x905, 0x11F, 0x608, 0x600, 0x601, 0x806, 0x806]);
});

test('cutting: the game\'s $01:D293 turns map $81\'s bush into $5F for weapon types 1 and 2 only', () => {
    const { Cpu65816 } = require('../../src/mana/dist/cpu65816');
    const { SnesBus } = require('../../src/mana/dist/snes-bus');
    const id = 0x81, m = mana.loadMap(rom, id), h = mana.readHeader(rom, id).bytes;
    const cut = (x, y, weapon) => {
        const bus = new SnesBus(rom), cpu = new Cpu65816(bus);
        bus.wram[0x1C] = h[2]; bus.wram[0x1B] = h[1]; cpu.call(0x02A000);
        bus.wram[0xDC] = id; bus.wram[0xDD] = 0; cpu.call(0x00CB90, { rts: true });
        const w16 = (a, v) => { bus.wram[a] = v & 255; bus.wram[a + 1] = v >> 8; };
        // Entity 0 standing on the cell, attack out ($E0C2), no reach ($E0C0), facing 0.
        w16(0xE002, x * 16 + 8); w16(0xE004, y * 16 + 8); bus.wram[0xE00B] = 0; bus.wram[0xE068] = weapon;
        w16(0xE0C0, 0); w16(0xE0C2, 1); w16(0xC0, m.w * 16); w16(0xC2, m.h * 16); w16(0x56, 0);
        cpu.x = 0; cpu.db = 0x7E;   // it reads the entity as $E0xx,X with the data bank at $7E
        cpu.call(0x01D293, { rts: true, maxSteps: 20000 });
        return bus.wram[0x10000 + y * 128 + x];
    };
    assert.deepStrictEqual([0, 1, 2, 3, 5].map(t => cut(6, 37, t)), [0x05, 0x5F, 0x5F, 0x05, 0x05]);
    assert.strictEqual(cut(3, 37, 1), 0x8C);
    const cells = mana.cuttableCells(rom, m).filter(c => c.x === 6 && c.y === 37);
    assert.deepStrictEqual(cells.map(c => [c.layer, c.from, c.to, c.weapons]), [['A', 0x05, 0x5F, 8]]);
    assert.deepStrictEqual(mana.weaponTypes(8), [1, 2]);
});

test('the editor\'s data (edit.json, tiles sheets) is the library\'s map, cell by cell and metatile by metatile', () => {
    const E = require('../../src/mana-maps/webview/editor-model.js');
    for (const id of [0x66, 0x80, 0x10]) {
        const m = mana.loadMap(rom, id);
        const hex = id.toString(16);
        const d = JSON.parse(resolveSom(['maps', hex + '.edit.json'], rom).read());
        assert.deepStrictEqual([d.w, d.h], [m.w, m.h]);
        assert.strictEqual(d.a.length, m.w * m.h);
        for (let y = 0; y < m.h; y += 7) for (let x = 0; x < m.w; x += 5) assert.strictEqual(d.a[y * m.w + x], m.cell('A', x, y), hex + ' A ' + x + ',' + y);
        if (m.sizeB) { assert.strictEqual(d.b.length, m.sizeB.w * m.sizeB.h); assert.strictEqual(E.manaEdCell(E.manaEdModel(d), 'B', m.w - 1, m.h - 1), m.cell('B', m.w - 1, m.h - 1)); }
        // The overlay the editor draws from the metatiles equals the collision the library reads per cell.
        const c = mana.collisionOf(rom, m), v = E.manaEdCollisionView(E.manaEdModel(d));
        for (let i = 0; i < c.w * c.h; i++) {
            assert.strictEqual(+v.floor[i], mana.floorOf(c.bytes[i * 4]), hex + ' floor ' + i);
            assert.strictEqual(+v.diagonal[i], mana.diagonalOf(c.bytes[i * 4 + 2]), hex + ' diagonal ' + i);
        }
        assert.strictEqual(v.specials.length, c.bytes.filter((_, i) => i % 4 === 1).filter(b => mana.specialOf(b)).length);
        assert.deepStrictEqual(d.events.steps, mana.mapEvents(rom, m).steps);
        assert.strictEqual(d.objects.length, mana.mapObjects(rom, id).length);
        for (const l of ['a', 'b']) {
            const png = resolveSom(['maps', hex + '.tiles.' + l + '.png'], rom).read();
            assert.strictEqual(png.readUInt32BE(16), 256);
            assert.strictEqual(png.readUInt32BE(20), 192);
        }
    }
});

test('the event-flag pieces: the editor\'s data is the converter\'s objects; Water Palace 2 has three 3x6 areas with two states', () => {
    const { flagObjects } = require('../../src/mana-to-evermore/pieces');
    for (const id of [0x66, 0x8B]) {
        const m = mana.loadMap(rom, id);
        const d = JSON.parse(resolveSom(['maps', id.toString(16) + '.edit.json'], rom).read());
        assert.deepStrictEqual(d.pieces, JSON.parse(JSON.stringify(flagObjects(rom, m))));
    }
    const wp = JSON.parse(resolveSom(['maps', '8b.edit.json'], rom).read()).pieces;
    assert.deepStrictEqual(wp.map(p => [p.w, p.h, p.frames.length + 1]), [[3, 6, 2], [3, 6, 2], [3, 6, 2]]);
    // A state's cells all lie inside its area.
    for (const p of wp) for (const k of Object.keys(p.frames[0])) { const [x, y] = k.split(',').map(Number); assert.ok(x < p.w && y < p.h); }
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
