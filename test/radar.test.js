'use strict';
/**
 * test/radar.test.js — unit tests for radar-utils.js pure functions.
 * Run with: node test/radar.test.js
 */

const assert = require('assert');
const {
    radarLifecycle, radarH, radarEsc,
    radarExtractEmoji, radarParseName, radarParseNotes, parseEvsNum,
} = require('../radar-utils');

let passed = 0, failed = 0;
function test(name, fn) {
    try { fn(); console.log('  ✓ ' + name); passed++; }
    catch (e) { console.error('  ✗ ' + name + '\n    ' + e.message); failed++; }
}

// ── radarLifecycle ──────────────────────────────────────────────────────────
console.log('\nradarLifecycle — temp region (0x2834–0x28FF):');
test('0x2834 is temp (first byte)',  () => assert.strictEqual(radarLifecycle(0x2834, '', ''), 'temp'));
test('0x28FF is temp (last byte)',   () => assert.strictEqual(radarLifecycle(0x28FF, '', ''), 'temp'));
test('0x2850 is temp (mid range)',   () => assert.strictEqual(radarLifecycle(0x2850, '', ''), 'temp'));
test('0x2833 is NOT temp (one below)',() => assert.notStrictEqual(radarLifecycle(0x2833, '', ''), 'temp'));
test('0x2900 is NOT temp (one above)',() => assert.notStrictEqual(radarLifecycle(0x2900, '', ''), 'temp'));

console.log('\nradarLifecycle — session region (0x2200–0x27FF):');
test('0x2200 is session (first byte)', () => assert.strictEqual(radarLifecycle(0x2200, '', ''), 'session'));
test('0x27FF is session (last byte)',  () => assert.strictEqual(radarLifecycle(0x27FF, '', ''), 'session'));
test('0x22D8 is session (mid range)',  () => assert.strictEqual(radarLifecycle(0x22D8, '', ''), 'session'));
test('0x21FF is NOT session',          () => assert.notStrictEqual(radarLifecycle(0x21FF, '', ''), 'session'));
test('0x2800 is NOT session',          () => assert.notStrictEqual(radarLifecycle(0x2800, '', ''), 'session'));

console.log('\nradarLifecycle — SRAM tag (outside temp/session range):');
test('[SRAM] at 0x0500 → sram',           () => assert.strictEqual(radarLifecycle(0x0500, 'Byte [SRAM]', ''), 'sram'));
test('[SRAM] in notes at 0x0800 → sram',  () => assert.strictEqual(radarLifecycle(0x0800, 'Byte', 'some [SRAM] note'), 'sram'));
test('[SRAM] at 0x2260 (session) → session (addr wins)', () => assert.strictEqual(radarLifecycle(0x2260, 'Byte [SRAM]', ''), 'session'));
test('[SRAM] at 0x2840 (temp) → temp (addr wins)',       () => assert.strictEqual(radarLifecycle(0x2840, 'Byte [SRAM]', ''), 'temp'));

console.log('\nradarLifecycle — system:');
test('0x0000 is system', () => assert.strictEqual(radarLifecycle(0x0000, '', ''), 'system'));
test('0x0341 is system', () => assert.strictEqual(radarLifecycle(0x0341, '', ''), 'system'));
test('0x2900 is system', () => assert.strictEqual(radarLifecycle(0x2900, '', ''), 'system'));
test('0x4EBF is system', () => assert.strictEqual(radarLifecycle(0x4EBF, '', ''), 'system'));

// gap entry: 0x28FC is the last few bytes of temp range
console.log('\nradarLifecycle — gap entry boundary (the main bug):');
test('0x28FC is temp (inside temp range, even in gap entry)', () => assert.strictEqual(radarLifecycle(0x28FC, 'Byte×6100', 'Unmapped'), 'temp'));
test('0x2900 from gap entry is system', () => assert.strictEqual(radarLifecycle(0x2900, 'Byte×6100', 'Unmapped'), 'system'));
test('0x4EB2 from gap entry is system', () => assert.strictEqual(radarLifecycle(0x4EB2, 'Byte×6100', 'Unmapped'), 'system'));

// ── radarH ──────────────────────────────────────────────────────────────────
console.log('\nradarH:');
test('0x2834 formats as 0x2834',  () => assert.strictEqual(radarH(0x2834), '0x2834'));
test('0x0100 pads to 4 digits',   () => assert.strictEqual(radarH(0x100),  '0x0100'));
test('0x0000',                     () => assert.strictEqual(radarH(0),      '0x0000'));
test('uppercase hex digits',       () => assert.strictEqual(radarH(0xABCD), '0xABCD'));

// ── radarEsc ────────────────────────────────────────────────────────────────
console.log('\nradarEsc:');
test('escapes &',  () => assert.strictEqual(radarEsc('a&b'),   'a&amp;b'));
test('escapes <',  () => assert.strictEqual(radarEsc('a<b'),   'a&lt;b'));
test('escapes >',  () => assert.strictEqual(radarEsc('a>b'),   'a&gt;b'));
test('escapes "',  () => assert.strictEqual(radarEsc('a"b'),   'a&quot;b'));
test('no change for plain text', () => assert.strictEqual(radarEsc('hello'), 'hello'));

// ── radarParseName ──────────────────────────────────────────────────────────
console.log('\nradarParseName:');
test('single name, no br',
    () => assert.deepStrictEqual(radarParseName('DOG_NAME'), ['DOG_NAME']));
test('strips HTML tags',
    () => assert.deepStrictEqual(radarParseName('⚙️ <b>FOO</b>'), ['⚙️ FOO']));
test('splits on <br>',
    () => assert.deepStrictEqual(radarParseName('A (0x01)<br>B (0x02)'), ['A (0x01)', 'B (0x02)']));
test('splits on <br/>',
    () => assert.deepStrictEqual(radarParseName('A<br/>B<br/>C'), ['A', 'B', 'C']));
test('splits on <BR> (case insensitive)',
    () => assert.deepStrictEqual(radarParseName('A<BR>B'), ['A', 'B']));
test('filters empty parts',
    () => assert.deepStrictEqual(radarParseName('<br>A<br><br>B<br>'), ['A', 'B']));
test('emoji bit-field split',
    () => {
        const parts = radarParseName('⚙️ One-time trigger (0x01)<br>⚙️ Switch OBJ 8 (0x02)');
        assert.strictEqual(parts.length, 2);
        assert.ok(parts[0].includes('0x01'));
        assert.ok(parts[1].includes('0x02'));
    });

// ── radarParseNotes ─────────────────────────────────────────────────────────
console.log('\nradarParseNotes:');
test('converts <br> to newline',
    () => assert.strictEqual(radarParseNotes('A<br>B'), 'A\nB'));
test('converts <br/> to newline',
    () => assert.strictEqual(radarParseNotes('A<br/>B'), 'A\nB'));
test('strips other HTML tags',
    () => assert.strictEqual(radarParseNotes('A<b>bold</b>B'), 'AboldB'));
test('normalises double spaces',
    () => assert.strictEqual(radarParseNotes('A  B'), 'A B'));
test('trims result',
    () => assert.strictEqual(radarParseNotes('  hello  '), 'hello'));
test('empty string',
    () => assert.strictEqual(radarParseNotes(''), ''));

// ── parseEvsNum ────────────────────────────────────────────────────────────
console.log('\nparseEvsNum:');
test('0x2A → 42',        () => assert.strictEqual(parseEvsNum('0x2A'), 42));
test('0xFF → 255',       () => assert.strictEqual(parseEvsNum('0xFF'), 255));
test('0X1F → 31',        () => assert.strictEqual(parseEvsNum('0X1f'), 31));
test('0d42 → 42',        () => assert.strictEqual(parseEvsNum('0d42'), 42));
test('0D100 → 100',      () => assert.strictEqual(parseEvsNum('0D100'), 100));
test('plain 99 → 99',    () => assert.strictEqual(parseEvsNum('99'), 99));
test('plain 0 → 0',      () => assert.strictEqual(parseEvsNum('0'), 0));
test('trims whitespace', () => assert.strictEqual(parseEvsNum('  0x10  '), 16));
test('empty → NaN',      () => assert.ok(isNaN(parseEvsNum(''))));
test('null → NaN',       () => assert.ok(isNaN(parseEvsNum(null))));
test('undefined → NaN',  () => assert.ok(isNaN(parseEvsNum(undefined))));

// ── Summary ──────────────────────────────────────────────────────────────────
console.log('\n' + passed + ' passed, ' + failed + ' failed\n');
if (failed) process.exit(1);
