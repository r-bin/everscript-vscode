'use strict';
// The editor core (src/shared/webview/map-editor-core/) and the Mana editor model
// (src/mana-maps/webview/editor-model.js): plain data, no DOM, no ROM. Run: node tests/mana/mana-editor-core.test.js

const assert = require('assert');
const path = require('path');

const CORE = path.join(__dirname, '..', '..', 'src', 'shared', 'webview', 'map-editor-core');
const { editHistoryCreate } = require(path.join(CORE, 'edit-history.js'));
const { editSessionStore, editNotSavedHtml } = require(path.join(CORE, 'edit-session.js'));
const { editToolForKey, editHistoryForKey } = require(path.join(CORE, 'edit-tools.js'));
const M = require(path.join(__dirname, '..', '..', 'src', 'mana-maps', 'webview', 'editor-model.js'));

let passed = 0, failed = 0;
function test(name, fn) {
    try { fn(); console.log('  ✓ ' + name); passed++; }
    catch (e) { console.error('  ✗ ' + name + '\n    ' + (e.stack || e.message)); failed++; }
}

console.log('\nMap editor core:');

test('history: one gesture is one undo step, undo and redo walk it back and forth', () => {
    const log = [];
    const h = editHistoryCreate((c, which) => log.push(which + ':' + c.n), () => log.push('changed'));
    h.begin(); h.record({ n: 1 }); h.record({ n: 2 }); h.end();
    assert.strictEqual(h.canUndo(), true);
    assert.strictEqual(h.canRedo(), false);
    h.undo();
    assert.deepStrictEqual(log.filter(l => l !== 'changed'), ['before:2', 'before:1'], 'a step is reverted last change first');
    assert.strictEqual(h.canRedo(), true);
    h.redo();
    assert.deepStrictEqual(log.filter(l => l !== 'changed').slice(2), ['after:1', 'after:2'], 'and replayed in order');
});

test('history: an empty gesture leaves no step, a new change clears redo, dirty follows the stack', () => {
    const h = editHistoryCreate(() => {}, null);
    h.begin(); h.end();
    assert.strictEqual(h.dirty(), false);
    h.begin(); h.record({}); h.end();
    assert.strictEqual(h.dirty(), true);
    h.undo();
    assert.strictEqual(h.dirty(), false);
    assert.strictEqual(h.canRedo(), true);
    h.record({});                       // outside a gesture: its own step
    assert.strictEqual(h.canRedo(), false);
    assert.strictEqual(h.dirty(), true);
    h.clear();
    assert.strictEqual(h.dirty(), false);
});

test('history: the oldest steps are dropped past the limit', () => {
    const h = editHistoryCreate(() => {}, null);
    for (let i = 0; i < 520; i++) h.record({ i });
    let n = 0;
    while (h.undo()) n++;
    assert.strictEqual(n, 500);
});

test('sessions: one per key, made once, dirty ones listed', () => {
    let made = 0;
    const store = editSessionStore(key => { made++; return { key, history: editHistoryCreate(() => {}, null) }; });
    const a = store.get('a');
    assert.strictEqual(store.get('a'), a);
    assert.strictEqual(made, 1);
    assert.strictEqual(store.has('b'), false);
    store.get('b').history.record({});
    assert.deepStrictEqual(store.dirtyKeys(), ['b']);
    store.drop('b');
    assert.strictEqual(store.has('b'), false);
});

test('the not-saved notice names the map and says it lasts until the tab is closed', () => {
    const html = editNotSavedHtml('Secret of Mana map');
    assert.ok(/not saved/.test(html) && /Secret of Mana map/.test(html) && /closed/.test(html));
});

test('keys: tool letters, undo and redo', () => {
    const tools = [{ id: 'paint', key: 'b' }, { id: 'erase', key: 'e' }];
    assert.strictEqual(editToolForKey(tools, { key: 'E' }), 'erase');
    assert.strictEqual(editToolForKey(tools, { key: 'e', ctrlKey: true }), null);
    assert.strictEqual(editToolForKey(tools, { key: 'q' }), null);
    assert.strictEqual(editHistoryForKey({ key: 'z', ctrlKey: true }), 'undo');
    assert.strictEqual(editHistoryForKey({ key: 'Z', metaKey: true, shiftKey: true }), 'redo');
    assert.strictEqual(editHistoryForKey({ key: 'z' }), null);
});

console.log('\nMana editor model:');

const collision = new Array(192 * 4).fill(0);
collision[1 * 4] = 2; collision[3 * 4] = 3; collision[4 * 4] = 0x0B; collision[5 * 4 + 1] = 0x85; collision[6 * 4 + 2] = 0x16;
const data = () => ({
    id: 1, w: 3, h: 2, sizeB: { w: 2, h: 1 },
    a: [1, 1, 1, 1, 1, 1], b: [7, 8],
    collision: { a: collision, b: new Array(768).fill(0) }, backdrop: [0, 0, 0],
    events: { onEnter: 0x10, steps: [{ x: 1, y: 0, event: 0x123 }] },
    objects: [{ x: 2, y: 1, flags: 0x40, kind: 0xC001, bytes: [0, 0, 0x82, 1, 0, 0, 1, 0xC0] }],
});

test('collision bytes decode as the game reads them (src/mana/collision.ts)', () => {
    assert.deepStrictEqual(M.manaEdDecodeCollision([2, 0, 0, 0]), { floor: 2, diagonal: 0, switches: false, special: 0 });
    assert.deepStrictEqual(M.manaEdDecodeCollision([0x0B, 0, 0, 0]), { floor: 3, diagonal: 0, switches: true, special: 0 });
    assert.strictEqual(M.manaEdDecodeCollision([5, 0, 0, 0]).floor, 0, 'c0 values 4-7 are no floor');
    assert.strictEqual(M.manaEdDecodeCollision([0, 0x85, 0, 0]).special, 0x85);
    assert.strictEqual(M.manaEdDecodeCollision([0, 0, 0x16, 0]).diagonal, 6);
    assert.strictEqual(M.manaEdDecodeCollision([0, 0, 0x26, 0]).diagonal, 0, 'only $1n in c2 is a diagonal');
});

test('painting a cell changes its collision with the metatile', () => {
    const m = M.manaEdModel(data());
    assert.strictEqual(M.manaEdCollisionView(m).floor, '222222');
    const ch = M.manaEdSetCell(m, 'A', 0, 0, 3);
    assert.deepStrictEqual(ch, { k: 'cell', layer: 'A', i: 0, before: 1, after: 3 });
    assert.strictEqual(M.manaEdCollisionView(m).floor, '322222');
    M.manaEdApply(m, ch, 'before');
    assert.strictEqual(M.manaEdCollisionView(m).floor, '222222');
    M.manaEdApply(m, ch, 'after');
    assert.strictEqual(M.manaEdCollisionView(m).floor, '322222');
});

test('the overlay view lists level switches, specials and half walls of layer A', () => {
    const m = M.manaEdModel(data());
    M.manaEdSetCell(m, 'A', 1, 0, 4); M.manaEdSetCell(m, 'A', 2, 0, 5); M.manaEdSetCell(m, 'A', 0, 1, 6);
    const c = M.manaEdCollisionView(m);
    assert.deepStrictEqual(c.switches, [[1, 0]]);
    assert.deepStrictEqual(c.specials, [{ x: 2, y: 0, kind: 0x85 }]);
    assert.strictEqual(c.diagonal[3], '6');
});

test('setting a cell: no change, a metatile past the 192, a missing layer B and the grid edge all return null', () => {
    const m = M.manaEdModel(data());
    assert.strictEqual(M.manaEdSetCell(m, 'A', 0, 0, 1), null);
    assert.strictEqual(M.manaEdSetCell(m, 'A', 0, 0, 192), null);
    assert.strictEqual(M.manaEdSetCell(m, 'A', 3, 0, 2), null);
    assert.strictEqual(M.manaEdSetCell(M.manaEdModel(Object.assign(data(), { sizeB: null, b: [] })), 'B', 0, 0, 2), null);
});

test('layer B repeats with its own size: one cell of it shows in every repeat', () => {
    const m = M.manaEdModel(data());
    assert.strictEqual(M.manaEdCell(m, 'B', 0, 0), 7);
    assert.strictEqual(M.manaEdCell(m, 'B', 2, 0), 7, 'x = 2 wraps to 0 in a 2-wide layer');
    assert.strictEqual(M.manaEdCell(m, 'B', 2, 1), 7, 'and y wraps in a 1-high one');
    const ch = M.manaEdSetCell(m, 'B', 2, 1, 9);
    assert.strictEqual(ch.i, 0);
    assert.strictEqual(M.manaEdCell(m, 'B', 0, 0), 9);
    assert.strictEqual(M.manaEdCellChanged(m, 0, 0) && M.manaEdCellChanged(m, 2, 1), true);
    assert.strictEqual(M.manaEdCellChanged(m, 1, 0), false);
});

test('a cell is "changed" only while it differs from how the map opened', () => {
    const m = M.manaEdModel(data());
    assert.strictEqual(M.manaEdCellChanged(m, 1, 1), false);
    M.manaEdSetCell(m, 'A', 1, 1, 3);
    assert.strictEqual(M.manaEdCellChanged(m, 1, 1), true);
    M.manaEdSetCell(m, 'A', 1, 1, 1);
    assert.strictEqual(M.manaEdCellChanged(m, 1, 1), false);
});

test('objects: a new one copies the like object\'s unnamed bytes and kind, and keeps the flag bits when moved', () => {
    const m = M.manaEdModel(data());
    const o = M.manaEdNewObject(5, 6, m.objects[0]);
    assert.deepStrictEqual([o.x, o.y, o.kind], [5, 6, 0xC001]);
    assert.strictEqual(o.bytes[2], 0x80 | 5, 'byte 2 keeps its high bit (the flag bit $40 of $C807)');
    assert.strictEqual(o.bytes[3], 6);
    assert.deepStrictEqual(o.bytes.slice(4, 8), [0, 0, 1, 0xC0]);
    assert.strictEqual(m.objects[0].bytes[2], 0x82, 'the original is untouched');
    M.manaEdSetKind(o, 0x1234);
    assert.deepStrictEqual(o.bytes.slice(6), [0x34, 0x12]);
    const plain = M.manaEdNewObject(1, 2, null);
    assert.strictEqual(plain.kind, 0xC001, 'without a like object: the commonest kind');
});

test('lists change through snapshots: apply restores before and after', () => {
    const m = M.manaEdModel(data());
    const before = M.manaEdClone(m.objects);
    m.objects.push(M.manaEdNewObject(0, 0, null));
    const change = { k: 'objects', before, after: M.manaEdClone(m.objects) };
    M.manaEdApply(m, change, 'before');
    assert.strictEqual(m.objects.length, 1);
    M.manaEdApply(m, change, 'after');
    assert.strictEqual(m.objects.length, 2);
    assert.strictEqual(M.manaEdObjectAt(m, 0, 0), 1);
    assert.strictEqual(M.manaEdStepAt(m, 1, 0), 0);
    assert.strictEqual(M.manaEdStepAt(m, 0, 0), -1);
});

test('a state of a map change shows its cells over the map; what the user painted stays on top; it is a view, not an edit', () => {
    const d = data();
    d.pieces = [{ flag: 0x10, values: [0, 6], x: 1, y: 0, w: 2, h: 1, frames: [{ '0,0': { A: 3, B: -1 }, '1,0': { A: 4, B: -1 } }] }];
    const m = M.manaEdModel(d);
    assert.strictEqual(M.manaEdCell(m, 'A', 1, 0), 1, 'state 0 is the map as it opens');
    m.pieceState[0] = 1;
    assert.deepStrictEqual([M.manaEdCell(m, 'A', 1, 0), M.manaEdCell(m, 'A', 2, 0), M.manaEdCell(m, 'A', 0, 0)], [3, 4, 1]);
    assert.strictEqual(M.manaEdCellChanged(m, 1, 0), true);
    assert.strictEqual(M.manaEdCellEdited(m, 1, 0), false);
    M.manaEdSetCell(m, 'A', 1, 0, 9);
    assert.strictEqual(M.manaEdCell(m, 'A', 1, 0), 9, 'a painted cell wins over the state');
    assert.strictEqual(M.manaEdCellEdited(m, 1, 0), true);
    assert.strictEqual(M.manaEdCollisionView(m).floor.length, 6);
    m.pieceState[0] = 0;
    assert.strictEqual(M.manaEdCell(m, 'A', 2, 0), 1);
});

test('a piece\'s state has a box inside its area, and a click finds the piece whose area holds the cell', () => {
    const p = { x: 4, y: 2, w: 3, h: 3, frames: [{ '1,1': { A: 5, B: -1 }, '2,1': { A: 5, B: -1 }, '1,2': { A: 5, B: -1 } }] };
    assert.deepStrictEqual(M.manaEdFrameBounds(p, 1), { dx: 1, dy: 1, w: 2, h: 2, count: 3 });
    assert.strictEqual(M.manaEdFrameBounds({ frames: [{}] }, 1), null);
    const m = M.manaEdModel(Object.assign(data(), { pieces: [p] }));
    assert.strictEqual(M.manaEdPieceAt(m, 5, 3), 0);
    assert.strictEqual(M.manaEdPieceAt(m, 3, 3), -1);
});

test('records on one cell are all found, in order', () => {
    const d = data();
    d.objects.push({ x: 2, y: 1, flags: 0, kind: 0x420C, bytes: [0, 0, 2, 1, 0, 0, 0x0C, 0x42] });
    const m = M.manaEdModel(d);
    assert.deepStrictEqual(M.manaEdObjectsAt(m, 2, 1), [0, 1]);
    assert.strictEqual(M.manaEdObjectAt(m, 2, 1), 1, 'the topmost is the last');
    assert.deepStrictEqual(M.manaEdObjectsAt(m, 9, 9), []);
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
