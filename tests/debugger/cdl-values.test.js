'use strict';

/**
 * CDL value streams (core cdl-values.c, host library-values.js): I/O register values, SRAM access flags and the
 * 16-bit WRAM word ranges in two sets. Merge laws on random records, library store / reload, and (with a local
 * Secret of Evermore ROM, EVERSCRIPT_ROM or /Users/v/romhacking) the real core recording them from a replayed movie.
 */

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '../..');
const { CdlLibrary } = require('../../src/emulator/cdl/library');
const V = require('../../src/emulator/cdl/library-values');
const movie = require('../../src/emulator/tas/movie');

let passed = 0, failed = 0;
function test(name, fn) {
    try { fn(); console.log(`  [PASS] ${name}`); passed++; }
    catch (e) { console.error(`  [FAIL] ${name}\n    ${e.stack || e.message}`); failed++; }
}
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'evs-cdl-values-'));
console.log('CDL value stream tests:');

function makeRom() {
    const rom = new Uint8Array(0x20000);
    rom.set(Buffer.from('VAL TEST'.padEnd(21, ' ')), 0xFFC0);
    rom[0xFFD5] = 0x21;
    rom.set([0xFF, 0xFF, 0x00, 0x00], 0xFFDC);
    return rom;
}

function record(values) {
    const r = new Uint8Array(V.REC);
    if (!values.length) return r;
    const sorted = [...new Set(values)].sort((a, b) => a - b);
    const set16 = n => [n & 255, n >> 8];
    r.set([...set16(sorted[0]), ...set16(sorted[sorted.length - 1])], 0);
    if (sorted.length > 16) { r[4] = V.OVER; return r; }
    r[4] = sorted.length;
    sorted.forEach((v, i) => r.set(set16(v), 6 + i * 2));
    return r;
}

const merged = (a, b) => { const d = Uint8Array.from(a); V.mergeRecord(d, 0, b, 0); return d; };
const same = (a, b) => Buffer.from(a).equals(Buffer.from(b));

test('word record merge is commutative, associative and idempotent (random sets, overflow included)', () => {
    let seed = 12345;
    const rnd = n => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed % n; };
    for (let t = 0; t < 400; t++) {
        const make = () => record(Array.from({ length: rnd(14) }, () => rnd(40)));
        const a = make(), b = make(), c = make();
        assert.ok(same(merged(a, b), merged(b, a)), 'commutative');
        assert.ok(same(merged(merged(a, b), c), merged(a, merged(b, c))), 'associative');
        assert.ok(same(merged(a, a), a), 'idempotent');
    }
    const full = record(Array.from({ length: 16 }, (_, i) => i));
    const over = merged(full, record([100]));
    assert.strictEqual(over[4], V.OVER, 'a 17th distinct value overflows');
    assert.strictEqual(merged(over, record([1]))[4], V.OVER, 'overflow stays');
    assert.strictEqual(merged(full, record([3]))[4], 16, 'a known value does not overflow');
});

test('the library stores, merges and reloads the value streams', () => {
    const root = path.join(tmp, 'lib');
    const lib = new CdlLibrary(root, makeRom());
    const io = new Uint8Array(640 * 32);
    io[0 * 32 + 0] = 0x81;                    // $2100: values 0 and 7
    io[(256 + 0x0B) * 32 + 1] = 0x04;         // $420B: value 10
    const range = new Uint8Array(256 * 40);
    range.set(record([7, 300]), 5 * 40);
    lib.applyDelta({
        ioVals: [{ index: 0, data: io }],
        sramFlags: [{ index: 0, data: Uint8Array.from({ length: 4096 }, (_, i) => (i === 3 ? 6 : 0)) }],
        wordRanges: [{ set: 0, index: 0, data: range }, { set: 1, index: 0, data: record([9]).length ? (() => { const r = new Uint8Array(256 * 40); r.set(record([9]), 5 * 40); return r; })() : range }],
    });
    lib.applyDelta({ wordRanges: [{ set: 0, index: 0, data: (() => { const r = new Uint8Array(256 * 40); r.set(record([7, 8]), 5 * 40); return r; })() }] });
    assert.deepStrictEqual(V.ioValuesWritten(lib, 0x2100), [0, 7]);
    assert.deepStrictEqual(V.ioValuesWritten(lib, 0x420B), [10]);
    assert.strictEqual(V.ioValuesWritten(lib, 0x2101), null);
    assert.deepStrictEqual(V.wordRange(lib, 5, 0), { min: 7, max: 300, values: [7, 8, 300] });
    assert.deepStrictEqual(V.wordRange(lib, 5, 1), { min: 9, max: 9, values: [9] });
    assert.strictEqual(V.wordRange(lib, 6, 0), null);
    assert.strictEqual(lib.sramFlags[3], 6);
    assert.ok(lib.flush().includes('word-ranges.bin'));
    const again = new CdlLibrary(root, makeRom());
    assert.deepStrictEqual(V.wordRange(again, 5, 0), { min: 7, max: 300, values: [7, 8, 300] });
    assert.deepStrictEqual(V.ioValuesWritten(again, 0x420B), [10]);
    assert.strictEqual(again.sramFlags[3], 6);
    assert.ok(fs.statSync(path.join(again.dir, 'word-ranges.bin')).size === 2 * 0x20000 * 40, 'bounded size');
});

test('real core: a replayed movie records I/O values, word ranges (natural and cheated) and the SPC ports', () => {
    const rom = [process.env.EVERSCRIPT_ROM, '/Users/v/romhacking/Secret of Evermore (U) [!].smc'].filter(Boolean).find(p => fs.existsSync(p));
    if (!rom) { console.log('    (skipped: no local ROM)'); return; }
    const pads = Array.from({ length: 2400 }, (_, i) => (i % 50 < 3 ? 0x1000 : 0));
    const body = pads.map((p, i) => (i === 1200 ? 'W|7E1F00|DEADBEEF\n' : '') + movie.frameLine(p)).join('\n') + '\n';
    const file = path.join(tmp, 'm.evsmv');
    fs.writeFileSync(file, movie.evsmvHeader({ rom: 'x', romSha256: '', started: 't' }) + body);
    const libRoot = path.join(tmp, 'real');
    const r = spawnSync(process.execPath, [path.join(ROOT, 'tools/cdl/replay.js'), file, rom, '--cdl', libRoot, '--drain', '600'], { encoding: 'utf8', timeout: 240000 });
    assert.strictEqual(r.status, 0, r.stdout + r.stderr);
    const lib = new CdlLibrary(libRoot, new Uint8Array(fs.readFileSync(rom)));
    const inidisp = V.ioValuesWritten(lib, 0x2100);
    assert.ok(inidisp && inidisp.length >= 1, 'INIDISP was written');
    assert.ok(V.ioValuesWritten(lib, 0x2140), 'values were sent to the SPC port');
    assert.ok(V.ioValuesWritten(lib, 0x4200), 'NMITIMEN was written');
    assert.ok(lib.sramFlags.some(b => b & 1), 'the boot reads the save RAM (' + lib.sramFlags.filter(Boolean).length + ' bytes flagged)');
    let natural = 0, cheated = 0;
    for (let a = 0; a < 0x20000; a++) { if (V.wordRange(lib, a, 0)) natural++; if (V.wordRange(lib, a, 1)) cheated++; }
    assert.ok(natural > 100, 'word stores were recorded (' + natural + ')');
    assert.ok(cheated > 0 && cheated < natural, 'the 600 frames after the recorded write went to the second set (' + cheated + ')');
    // a word at a loop counter style address has min <= max and a value list inside [min, max]
    for (let a = 0; a < 0x20000; a++) {
        const w = V.wordRange(lib, a, 0);
        if (!w) continue;
        assert.ok(w.min <= w.max);
        if (w.values) assert.ok(w.values.every(v => v >= w.min && v <= w.max) && w.values.length >= 1);
    }
});

fs.rmSync(tmp, { recursive: true, force: true });
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
