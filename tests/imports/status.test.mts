// A converted room's status for the Rooms tab's rail colours (src/games/evermore/imports/common/status.ts): red when it
// cannot be played as an Evermore room, yellow when it differs from its source or spends past vanilla, and why.
// Synthetic counts; no ROM.
// Run: node tests/imports/status.test.mts   (npm run build:ts first)
import assert from 'node:assert';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { conversionStatus, failedStatus } = require('../../dist/games/evermore/imports/common/status');

let passed = 0, failed = 0;
function test(name: string, fn: () => void) {
    try { fn(); console.log('  ✓ ' + name); passed++; }
    catch (e) { console.error('  ✗ ' + name + '\n    ' + ((e as Error).stack || e)); failed++; }
}

test('a room converted as it is, within every ceiling: fine', () => {
    assert.deepStrictEqual(conversionStatus({ wramBytes: 9000, families: 5, graphics: 200, splitTiles: 4, croppedCells: 900 }), { level: 'ok', reasons: [] });
});

test('graphics drawn as a near twin, tiles recoloured: yellow, each said', () => {
    const s = conversionStatus({ wramBytes: 9000, families: 5, substitutedGraphics: 21, recolouredTiles: 1 });
    assert.strictEqual(s.level, 'warn');
    assert.deepStrictEqual(s.reasons.map((r: { text: string }) => r.text), [
        '21 graphics drawn as the nearest-looking one: past Evermore\'s 256',
        '1 tile redrawn in one palette: the source mixes palettes in them',
    ]);
});

test('only graphics that ran out (estimated, empty) are severe: they tint the name, the rest only add the dot', () => {
    const severe = (c: Record<string, number>) => conversionStatus(c).reasons.filter((r: { severe?: true }) => r.severe).length;
    assert.strictEqual(severe({ substitutedGraphics: 3 }), 1);
    assert.strictEqual(severe({ droppedGraphics: 1 }), 1);
    assert.strictEqual(severe({ recolouredTiles: 40, stillPaletteAnimations: 2, wramBytes: 32700, contextRooms: 1 }), 0);
});

test('past the vanilla WRAM high-water mark: yellow; past the 32 KB window: red', () => {
    assert.strictEqual(conversionStatus({ wramBytes: 32700 }).level, 'warn');
    const red = conversionStatus({ wramBytes: 42672, recolouredTiles: 3 });
    assert.strictEqual(red.level, 'error');
    assert.deepStrictEqual(red.reasons[0], { level: 'error', text: 'grid and stamps need 42672 bytes: Evermore\'s WRAM window holds 32768' });
    assert.strictEqual(red.reasons.length, 2, 'the warnings still listed');
});

test('more than seven families: red', () => {
    assert.strictEqual(conversionStatus({ families: 8 }).level, 'error');
});

test('a room that does not convert: red, with the reason', () => {
    assert.deepStrictEqual(failedStatus('no map of its own'), { level: 'error', reasons: [{ level: 'error', text: 'does not convert: no map of its own' }] });
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exitCode = failed ? 1 : 0;
