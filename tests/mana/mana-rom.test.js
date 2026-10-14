'use strict';
// Secret of Mana library + som:// files against the real ROM. Skips without it.
// Run: EVERSCRIPT_MANA_ROM="/path/Secret of Mana (U) [!].smc" node tests/mana/mana-rom.test.js
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

const ROM_PATH = process.env.EVERSCRIPT_MANA_ROM || '';
if (!ROM_PATH || !fs.existsSync(ROM_PATH)) {
    console.log('\nSecret of Mana ROM tests skipped (set EVERSCRIPT_MANA_ROM).');
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
    assert.strictEqual(c.areas[c.areas.length - 1].slug, 'other');
    const total = c.areas.reduce((n, a) => n + a.maps.length, 0);
    assert.strictEqual(total, 408, 'every map is in exactly one area or other');
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

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
