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

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
