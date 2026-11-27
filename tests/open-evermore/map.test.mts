// Open Evermore, the game mapping file (tools/open-evermore/evermore/map.mts, map/<release>.json; docs/open-evermore/
// mapping.md): every value parses, every address the codecs ask for exists and every one listed is asked for, a release
// that extends another overrides only what it names, and the rules equal the ones the codecs wrote before the map.
// No ROM, no dist/. Run: node tests/open-evermore/map.test.mts
import assert from 'node:assert';
import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import * as map from '../../tools/open-evermore/evermore/map.mts';
import { locateOne } from '../../tools/open-evermore/evermore/map-locate.mts';

let passed = 0, failed = 0;
function test(name: string, fn: () => void) {
    try { fn(); console.log('  ✓ ' + name); passed++; }
    catch (e) { console.error('  ✗ ' + name + '\n    ' + ((e as Error).stack || e)); failed++; }
}

const ROOT = new URL('../../tools/open-evermore/evermore/', import.meta.url);
const US = new URL('map/us.json', ROOT);
const sources = [new URL('kinds.mts', ROOT), ...readdirSync(new URL('codecs/', ROOT)).map(f => new URL(`codecs/${f}`, ROOT))].map(u => readFileSync(u, 'utf8')).join('\n');
/** Every map.<accessor>('…') the codecs make: literals, and template strings as patterns. */
const asked = [...sources.matchAll(/map\.(file|files|bus|offset|bank|readers|rule|window|memory)\(\s*(['`])([^'`]+)\2/g)].map(m => ({ accessor: m[1], key: m[3] }));
const pattern = (key: string) => new RegExp('^' + key.replace(/[.]/g, '\\.').replace(/\$\{[^}]+\}/g, '[a-z0-9_]+') + '$');

test('us.json loads and every value parses', () => {
    const m = map.loadMap('us');
    assert.strictEqual(m.release, 'us');
    assert.ok(m.addresses.size > 100, `${m.addresses.size} addresses`);
});

test('every address a codec asks for is in us.json, and every one there is asked for', () => {
    const m = map.loadMap('us'), keys = [...m.addresses.keys()], kinds = [...m.placement.keys()];
    for (const a of asked) {
        if (a.accessor === 'memory') continue;
        const pool = a.accessor === 'rule' || a.accessor === 'window' ? kinds : keys, p = pattern(a.key);
        assert.ok(pool.some(k => p.test(k)), `map.${a.accessor}('${a.key}'): not in us.json`);
    }
    const unused = keys.filter(k => !asked.some(a => a.accessor !== 'rule' && a.accessor !== 'window' && a.accessor !== 'memory' && pattern(a.key).test(k)));
    assert.deepStrictEqual(unused, [], 'addresses nothing reads');
    const unusedRules = kinds.filter(k => !asked.some(a => (a.accessor === 'rule' || a.accessor === 'window') && pattern(a.key).test(k)));
    assert.deepStrictEqual(unusedRules, [], 'placements nothing reads');
    const spaces = [...m.memory.keys()], askedSpaces = asked.filter(a => a.accessor === 'memory').map(a => a.key);
    assert.deepStrictEqual(spaces.filter(s => !askedSpaces.includes(s)), [], 'memories nothing reads');
    assert.deepStrictEqual(askedSpaces.filter(s => !spaces.includes(s)), [], 'memories asked for that us.json lacks');
});

test('memory regions: in order, no hole or overlap in a bank, each with how the engine reaches it', () => {
    const wram = map.memory('wram');
    assert.deepStrictEqual(wram.map(r => r.name), ['direct_page', 'low', 'system', 'save', 'temp', 'room', 'bank_7f']);
    assert.deepStrictEqual(wram[0], { name: 'direct_page', from: 0x7E0000, to: 0x7E0100, reach: 'direct', why: wram[0].why });
    assert.strictEqual(wram.find(r => r.name === 'low')!.to, 0x7E2000, 'the low mirror ends at $1FFF');
    assert.deepStrictEqual(wram.find(r => r.name === 'temp')!, { name: 'temp', from: 0x7E2834, to: 0x7E28FC, reach: 'bank', why: wram.find(r => r.name === 'temp')!.why });
    assert.throws(() => map.memory('vram'), /has no memory "vram"/);
});

test('the rules are the ones the codecs wrote before the map', () => {
    assert.deepStrictEqual(map.rule('strings'), { lowerHalf: true, noCrossBank: true, below: 0x400000 });
    assert.deepStrictEqual(map.rule('texts'), { above: 0x040000, below: 0x050000, noCrossBank: true });
    assert.deepStrictEqual(map.rule('metasprites'), { above: 0x0A0000, below: 0x140000, noCrossBank: true });
    assert.deepStrictEqual(map.rule('maps'), { upperHalf: true, noCrossBank: true, maxSize: 0x8000 });
    assert.deepStrictEqual(map.rule('music'), { upperHalf: true, noCrossBank: true, noBankEnd: true, below: 0x400000 });
    assert.deepStrictEqual(map.window('scripts'), { from: 0x12, to: 0x40 });
    assert.deepStrictEqual(map.window('music/window'), { from: 0x00, to: 0x40 });
    assert.deepStrictEqual(map.pastEnd(), [{ start: 0x30E293, end: 0x30E293 + 0x7C0 }]);
});

test('accessors: file offset, bus form, bank, readers with signed adds', () => {
    assert.strictEqual(map.file('strings.singles'), 0x11F3AE);
    assert.strictEqual(map.bus('alchemy.ingredient_names'), 0xC45FF3);
    assert.strictEqual(map.offset('characters.records'), 0xB678);
    assert.strictEqual(map.bank('sprite_palettes.table'), 0xD0);
    assert.strictEqual(map.bank('sprite_blocks_16.base'), 0xD9);
    assert.deepStrictEqual(map.readers('experience.boy_readers')[0], { at: 0x0DB677, add: -3 });
    assert.throws(() => map.file('strings.nothing'), /has no address "strings.nothing"/);
});

test('a release that extends another gives only what differs', () => {
    const dir = mkdtempSync(join(tmpdir(), 'oe-map-'));
    writeFileSync(join(dir, 'us.json'), readFileSync(US));
    writeFileSync(join(dir, 'xx.json'), JSON.stringify({ release: 'xx', name: 'test build', extends: 'us', addresses: { strings: { singles: '$92:F000' } }, placement: { texts: { banks: '$C5', why: 'test' } } }));
    const m = map.loadMap('xx', pathToFileURL(dir + '/'));
    assert.deepStrictEqual(m.chain, ['us', 'xx']);
    assert.strictEqual(m.addresses.get('strings.singles'), '$92:F000');
    assert.strictEqual(m.addresses.get('strings.pairs'), '$91:F32E');
    assert.strictEqual(m.placement.get('texts')!.banks, '$C5');
    assert.strictEqual(m.pastEnd.length, 1);
    writeFileSync(join(dir, 'bad.json'), JSON.stringify({ release: 'bad', name: 'x', extends: 'us', addresses: { strings: { singles: '0x11F3AE' } }, placement: {} }));
    assert.throws(() => map.loadMap('bad', pathToFileURL(dir + '/')), /is no address/);
    assert.throws(() => map.loadMap('eu', pathToFileURL(dir + '/')), /no mapping file for release "eu"/);
});

test('one release per process: another one after the codecs read the map is refused', () => {
    map.gameMap();
    assert.strictEqual(map.selectRelease('us').release, 'us');
    assert.strictEqual(map.selectRelease(null).release, 'us');
    assert.throws(() => map.selectRelease('eu'), /already read the map of "us"/);
});

test('locate: a moved table by its bytes, a moved operand by the code around it, nothing when not sure', () => {
    const us = Buffer.alloc(0x400), rom = Buffer.alloc(0x400);
    for (let i = 0; i < 0x400; i++) { us[i] = (i * 7 + 3) & 0xFF; rom[i] = (i * 13 + 5) & 0xFF; }
    const table = Buffer.from('a table of sixty-four bytes that only this one place in the ROM holds!!').subarray(0, 64);
    table.copy(us, 0x100); table.copy(rom, 0x220);
    assert.deepStrictEqual(locateOne(us, rom, 0x100), { at: 0x220, how: 'bytes' });
    // code: 8 bytes, an operand that differs, 8 bytes
    const before = Buffer.from([0xA9, 1, 0, 0x85, 0x28, 0xA0, 0, 0xD0]), after = Buffer.from([0xB7, 0x26, 0x29, 0xFF, 0, 0xF0, 0x04, 0x60]);
    before.copy(us, 0x300); Buffer.from([0x11, 0x22, 0x33]).copy(us, 0x308); after.copy(us, 0x30B);
    before.copy(rom, 0x340); Buffer.from([0x44, 0x55, 0x66]).copy(rom, 0x348); after.copy(rom, 0x34B);
    assert.deepStrictEqual(locateOne(us, rom, 0x308), { at: 0x348, how: 'around' });
    // the same bytes twice: not sure, so nothing
    table.copy(rom, 0x2A0);
    assert.strictEqual(locateOne(us, rom, 0x100), null);
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
