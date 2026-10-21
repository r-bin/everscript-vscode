// The Terranigma Maps page's model (src/games/terra/maps/webview/model.ts): map and tile words, a metatile's use
// and tiles, a cell, the rail, variants, the cell-type, collision and exit overlays, the display registers.
// Synthetic rooms and rules; no ROM.
// Run: node tests/terra/terra-maps-model.test.mts
import assert from 'node:assert';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const m = require('../../dist/games/terra/maps/webview/model');

let passed = 0, failed = 0;
function test(name: string, fn: () => void) {
    try { fn(); console.log('  ✓ ' + name); passed++; }
    catch (e) { console.error('  ✗ ' + name + '\n    ' + ((e as Error).stack || e)); failed++; }
}

/** A 2×2 room: layer 0 with metatiles 1 (type 0) and 2 (type 14); layer 1, 1×1, repeating. */
function room() {
    const metatiles = new Array(512 * 4).fill(0);
    metatiles.splice(4, 4, 0x1002, 0x1003, 0x5012, 0x9013);     // metatile 1: palette 4, flips on the last two
    return {
        id: 0x0F, hex: '00f', w: 2, h: 2, script: 0x9A8496, context: [],
        sections: [{ bit: 0x10, name: 'layer maps' }], sets: [1], display: true, backdrop: [0, 0, 0], palette: [],
        ppu: { mode: 9, main: 0x17, sub: 0x12, cgwsel: 0x82, cgadsub: 0x21, fixed: [0, 0, 0] },
        layers: [
            { index: 0, bg: 2, w: 2, h: 2, cells: [0x0001, 0x1C02, 0x0001, 0x9C02], metatiles },
            { index: 1, bg: 1, w: 1, h: 1, cells: [0x0003], metatiles },
        ],
        exits: [
            { x: 1, y: 0, w: 1, h: 2, inverted: false, at: 0x818E3C, targets: [{ room: 0x10, x: 384, y: 336, style: [0, 5], flag: null }] },
            { x: 0, y: 1, w: 1, h: 1, inverted: true, at: 0x818E48, targets: [{ room: 0x11, x: 16, y: 32, style: [0, 6], flag: 0x160 }, { room: 0x12, x: 0, y: 0, style: [0, 6], flag: 0 }] },
        ],
    };
}

/** Rules as cell-types.json has them: 0 open, 14 wall, 6 diagonal, 31 passes moving down only, 8 gated moving up. */
function rules() {
    const all = (r: string) => ({ up: r, down: r, left: r, right: r });
    const out = Array.from({ length: 32 }, (_, type) => ({ type, moves: all('open'), ground: 'open', groundWord: 0, look: 'open' }));
    out[14] = { type: 14, moves: all('wall'), ground: 'blocked', groundWord: 0xFFFF, look: 'wall' };
    out[6] = { type: 6, moves: all('diagonal'), ground: 'blocked', groundWord: 0xFFFF, look: 'diagonal' };
    out[31] = { type: 31, moves: { up: 'wall', down: 'open', left: 'wall', right: 'wall' }, ground: 'blocked', groundWord: 0xFFFF, look: 'one-way' };
    out[8] = { type: 8, moves: { up: 'gated', down: 'open', left: 'open', right: 'open' }, ground: 'blocked', groundWord: 0xFFFF, look: 'one-way' };
    return out;
}

console.log('\nTerranigma Maps page model:');

test('a map word is metatile (bits 0-8), cell type (9-13), bit 14 and the occupied bit 15', () => {
    assert.deepStrictEqual(m.mapWord(0x9C02), { metatile: 2, type: 14, bit14: 0, occupied: 1 });
    assert.deepStrictEqual(m.mapWord(0x41FF), { metatile: 0x1FF, type: 0, bit14: 1, occupied: 0 });
});

test('a tile word is the SNES character, palette, priority and flips', () => {
    assert.deepStrictEqual(m.tileWord(0x7D81), { char: 0x181, palette: 7, priority: 1, hflip: true, vflip: false });
});

test('cellWord reads a layer at a cell, a smaller layer repeats, off the room is -1', () => {
    const r = room();
    assert.strictEqual(m.cellWord(r, 0, 1, 1), 0x9C02);
    assert.strictEqual(m.cellWord(r, 1, 1, 1), 0x0003);
    assert.strictEqual(m.cellWord(r, 0, 2, 0), -1);
    assert.strictEqual(m.cellWord(r, 3, 0, 0), -1);
});

test('a metatile: how many cells use it and their types; its four tile words described', () => {
    const r = room();
    assert.deepStrictEqual(m.metatileUse(r.layers[0], 2), { cells: 2, types: [14] });
    const lines = m.metatileTiles(r.layers[0], 1);
    assert.strictEqual(lines.length, 4);
    assert.match(lines[0], /^top left: \$1002 · char \$002 · palette 4 · low priority$/);
    assert.match(lines[2], /flipped H$/);
    assert.match(lines[3], /flipped V$/);
});

test('describeCell names the map word, metatile and cell type', () => {
    assert.deepStrictEqual(m.describeCell(room(), 0, 1, 0), ['cell 1,0 · map word $1C02', 'metatile $002 · cell type 14 ($0E)']);
});

test('sheetRows covers the highest metatile the layer uses', () => {
    assert.strictEqual(m.sheetRows({ cells: [0x0001, 0x1C22] }), 3);
    assert.strictEqual(m.sheetRows({ cells: [0] }), 1);
});

test('the rail: one row per picture named by its first room, carrying every room id for search', () => {
    const rooms = new Map([[0x0C, { w: 32, h: 64 }]]);
    const areas = m.railAreas([{ name: 'Rooms $000–$03F', pictures: [[0x0C, 0x0D], [0x0F]], noMap: [] }], rooms);
    assert.strictEqual(areas[0].area, 'Rooms $000–$03F');
    assert.deepStrictEqual(areas[0].rooms[0], { name: 'Room $00C +1', tag: '32×64', attrs: { room: 0x0C, rooms: '12 13', hexes: '00c 00d' } });
    assert.strictEqual(areas[0].rooms[1].name, 'Room $00F');
});

test('variants: the rooms that show the same picture, in id order', () => {
    assert.deepStrictEqual(m.variantsOf([[0x13, 0x11]], 0x11), [0x11, 0x13]);
    assert.deepStrictEqual(m.variantsOf([[0x13]], 0x40), [0x40]);
});

test('the overlay lists layer 0 cells with a non-zero type', () => {
    assert.deepStrictEqual(m.typedCells(room()), [[1, 0, 14], [1, 1, 14]]);
});

test('the display registers in words', () => {
    assert.deepStrictEqual(m.describeDisplay(room()), ['BG mode 1', 'main screen: BG1 BG2 BG3 OBJ', 'sub screen: BG2 OBJ', 'colour math: add sub screen on BG1, backdrop']);
});

test('collision: layer 0 cells per type, the cells that are not open, and the edges a move cannot cross', () => {
    assert.deepStrictEqual([...m.typeCounts(room())], [[0, 2], [14, 2]]);
    assert.deepStrictEqual(m.collisionCells(room(), rules()), [[1, 0, 14], [1, 1, 14]]);
    assert.deepStrictEqual(m.collisionCells(room(), []), [], 'no rules: nothing drawn');
    assert.deepStrictEqual(m.blockedEdges(rules()[31]).map((e: { side: string }) => e.side), ['bottom', 'right', 'left'], 'moving up stops at the bottom edge');
    assert.deepStrictEqual(m.blockedEdges(rules()[8]), [{ side: 'bottom', gated: true }]);
});

test('collision: a type in words', () => {
    assert.strictEqual(m.moveSummary(rules()[0]), 'open: every move passes');
    assert.strictEqual(m.moveSummary(rules()[14]), 'wall: every move stops');
    assert.strictEqual(m.moveSummary(rules()[31]), 'passes ↓ · stops ↑ ← →');
    assert.strictEqual(m.moveSummary(rules()[8]), 'passes ↓ ← → · ↑ only while $097C bit 2 is set');
    const rows = m.describeType(rules()[31]);
    assert.strictEqual(rows[0], 'moving up into it ↑: stops at its edge');
    assert.match(rows[4], /^ground table \(\$80:E11C\): \$FFFF — characters without bit \$0400 cannot enter$/);
});

test('a diagonal’s solid half faces the walls next to it (type 6 `/`, type 7 `\\`)', () => {
    const metatiles = new Array(512 * 4).fill(0);
    const w = (t: number) => t << 9;
    // 3×3: walls (14) across the top and down the left, type 6 in the middle: solid toward the upper left.
    const inner = { ...room(), w: 3, h: 3, layers: [{ index: 0, bg: 2, w: 3, h: 3, metatiles,
        cells: [w(14), w(14), w(14), w(14), w(6), 0, w(14), 0, 0] }] };
    assert.strictEqual(m.diagonalSide(inner, rules(), 1, 1), 'ul');
    // The canopy's corner: walls below and to the right.
    const outer = { ...inner, layers: [{ ...inner.layers[0], cells: [0, 0, 0, 0, w(6), w(14), 0, w(14), w(14)] }] };
    assert.strictEqual(m.diagonalSide(outer, rules(), 1, 1), 'dr');
    const seven = { ...inner, layers: [{ ...inner.layers[0], cells: [0, 0, 0, w(14), w(7), 0, 0, w(14), 0] }] };
    const r7 = rules(); r7[7] = { ...r7[6], type: 7 };
    assert.strictEqual(m.diagonalSide(seven, r7, 1, 1), 'dl');
    const open = { ...inner, layers: [{ ...inner.layers[0], cells: [0, 0, 0, 0, w(6), 0, 0, 0, 0] }] };
    assert.strictEqual(m.diagonalSide(open, rules(), 1, 1), null, 'no walls: just the line');
    assert.match(m.moveSummary(rules()[6]), /^diagonal \/: a move slides along it/);
});

test('exits: which hold a cell, their targets, and a choice by flag in words', () => {
    assert.deepStrictEqual(m.exitsAt(room(), 1, 1), [0]);
    assert.deepStrictEqual(m.exitsAt(room(), 0, 1), [1]);
    assert.deepStrictEqual(m.exitsAt(room(), 0, 0), []);
    assert.strictEqual(m.exitTargets(room().exits[1]), '$011 / $012');
    assert.deepStrictEqual(m.describeExit(room().exits[0]), ['cells 1,0 · 1×2 · record $81:8E3C', 'room $010 at 384,336 (cell 24,21) · style $00 $05']);
    assert.deepStrictEqual(m.describeExit(room().exits[1]).slice(1), ['flag $160 clear: room $011 at 16,32 (cell 1,2) · style $00 $06', 'otherwise: room $012 at 0,0 (cell 0,0) · style $00 $06']);
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
