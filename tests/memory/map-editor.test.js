'use strict';
// The map editor's state model, run headless.
//
// map-editor.js is deliberately free of DOM: the draft, the undo stack, the
// dedup rule and the export shape are all plain data, so they can be tested
// without a webview. The parts that touch the DOM are not tested here, and
// the split exists so this much can be.
//
// The export shape is checked against what the sibling repo's
// `rebuild_model` actually consumes — `layer1_metatile_ids` holds WRAM ids,
// not dictionary indices, so a draft that hands back indices would be
// silently wrong. See docs/map-format/map_editor_ui.md §6.

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const WEBVIEW = path.join(__dirname, '..', '..', 'src', 'rooms', 'webview');
const read = (f) => fs.readFileSync(path.join(WEBVIEW, f), 'utf8');

// The webview files share one scope and are concatenated, so they are
// loaded the same way the browser gets them: evaluated together, then the
// DOM-free functions handed back. map-editor-paint.js is included for the
// region maths; its one DOM function (renderEditLayer) is not called.
const api = new Function(`${read('map-editor.js')}\n${read('map-editor-paint.js')}
return { editReset, editActive, editDraft, editKey, editApply, editUndo, editRedo,
         editAddStamp, editStampWords, editExport, editStampCount,
         editCellAt, editRectWrites, editPasteWrites, editTakeSelection,
         editStampSvg, editCellPos,
         setSel: (s) => { _editSel = s; }, clip: () => _editClip };`)();

let passed = 0;
let failed = 0;
function test(name, fn) {
    try { fn(); console.log('  ✓ ' + name); passed += 1; }
    catch (e) { console.error('  ✗ ' + name + '\n    ' + e.message); failed += 1; }
}

/** A palette shaped like the one the host sends, with three stamps. */
function palette() {
    return {
        count: 3,
        baseMetatile: 0x1c70,
        // [index, layer1, layer2, collision, uses]
        entries: [
            [0, 0xa800, 0x19ce, 0x101f, 34],
            [1, 0xa800, 0x19cc, 0x101f, 12],
            [2, 0x358a, 0x19cc, 0x0010, 0],
        ],
        grid: [[0, 0, 1], [1, 2, 0]],
        widthTiles: 3,
        heightTiles: 2,
    };
}

console.log('\nmap editor state:');

test('a fresh draft is off and empty', () => {
    const d = api.editReset(0x76);
    assert.strictEqual(d.roomId, 0x76);
    assert.strictEqual(api.editActive(), false);
    assert.deepStrictEqual(d.cells, {});
    assert.strictEqual(d.brush, -1);
});

test('writes land and count only once', () => {
    api.editReset(0x76);
    assert.strictEqual(api.editApply([{ x: 1, y: 1, index: 5 }]), 1);
    // Writing the same value again is not a change, so it is not undoable.
    assert.strictEqual(api.editApply([{ x: 1, y: 1, index: 5 }]), 0);
    assert.strictEqual(api.editDraft().cells['1,1'], 5);
    assert.strictEqual(api.editDraft().undo.length, 1);
});

test('a batch undoes as one step', () => {
    api.editReset(0x76);
    api.editApply([{ x: 0, y: 0, index: 1 }, { x: 1, y: 0, index: 1 }, { x: 2, y: 0, index: 1 }]);
    assert.strictEqual(Object.keys(api.editDraft().cells).length, 3);
    assert.strictEqual(api.editUndo(), true);
    assert.strictEqual(Object.keys(api.editDraft().cells).length, 0, 'the whole fill should be gone');
    assert.strictEqual(api.editRedo(), true);
    assert.strictEqual(Object.keys(api.editDraft().cells).length, 3);
});

test('undo restores the previous value, not an empty cell', () => {
    api.editReset(0x76);
    api.editApply([{ x: 4, y: 4, index: 1 }]);
    api.editApply([{ x: 4, y: 4, index: 2 }]);
    api.editUndo();
    assert.strictEqual(api.editDraft().cells['4,4'], 1);
    api.editUndo();
    assert.ok(!('4,4' in api.editDraft().cells), 'the cell should be untouched again');
});

test('undo past the start is a no-op, not a crash', () => {
    api.editReset(0x76);
    assert.strictEqual(api.editUndo(), false);
    assert.strictEqual(api.editRedo(), false);
});

test('composing an existing combination costs nothing', () => {
    const p = palette();
    api.editReset(0x76);
    // Exactly stamp #2 — the room already has it.
    const i = api.editAddStamp(p, { layer1: 0x358a, layer2: 0x19cc, collision: 0x0010 });
    assert.strictEqual(i, 2);
    assert.strictEqual(api.editDraft().added.length, 0, 'no dictionary growth for a stamp that exists');
});

test('a genuinely new combination is appended once', () => {
    const p = palette();
    api.editReset(0x76);
    const want = { layer1: 0x358a, layer2: 0x19ce, collision: 0x101f };
    const a = api.editAddStamp(p, want);
    const b = api.editAddStamp(p, want);
    assert.strictEqual(a, 3, 'new stamps continue past the room’s own dictionary');
    assert.strictEqual(b, a, 'asking twice must not add it twice');
    assert.strictEqual(api.editDraft().added.length, 1);
    assert.strictEqual(api.editStampCount(p), 4);
});

test('a stamp resolves whether it is the room’s or the draft’s', () => {
    const p = palette();
    api.editReset(0x76);
    api.editAddStamp(p, { layer1: 0x1111, layer2: 0x2222, collision: 0x3333 });
    assert.deepStrictEqual(api.editStampWords(p, 1),
        { layer1: 0xa800, layer2: 0x19cc, collision: 0x101f, added: false });
    assert.deepStrictEqual(api.editStampWords(p, 3),
        { layer1: 0x1111, layer2: 0x2222, collision: 0x3333, added: true });
    assert.strictEqual(api.editStampWords(p, 99), null);
});

test('the export speaks WRAM ids, which is what the encoder consumes', () => {
    const p = palette();
    api.editReset(0x76);
    api.editApply([{ x: 2, y: 1, index: 1 }, { x: 0, y: 0, index: 2 }]);
    api.editAddStamp(p, { layer1: 0x1111, layer2: 0x2222, collision: 0x3333 });
    const out = api.editExport(p);

    assert.strictEqual(out.roomId, 0x76);
    assert.strictEqual(out.baseMetatile, 0x1c70);
    assert.strictEqual(out.originalMetatileCount, 3);
    // Sorted row-major, so a diff of two drafts is readable.
    assert.deepStrictEqual(out.cells, [
        { x: 0, y: 0, metatileId: 0x1c70 + 2 * 8 },
        { x: 2, y: 1, metatileId: 0x1c70 + 1 * 8 },
    ]);
    assert.deepStrictEqual(out.appendMetatiles, [{ layer1: 0x1111, layer2: 0x2222, collision: 0x3333 }]);
});

test('an id round-trips back to the index it came from', () => {
    const p = palette();
    api.editReset(0x76);
    api.editApply([{ x: 1, y: 0, index: 2 }]);
    const cell = api.editExport(p).cells[0];
    assert.strictEqual((cell.metatileId - p.baseMetatile) / 8, 2);
});

test('a cell reads from the draft first, then the room\u2019s own grid', () => {
    const p = palette();
    api.editReset(0x76);
    assert.strictEqual(api.editCellAt(p, 1, 1), 2, 'untouched cells come from the grid');
    api.editApply([{ x: 1, y: 1, index: 0 }]);
    assert.strictEqual(api.editCellAt(p, 1, 1), 0, 'an edit wins over the grid');
    assert.strictEqual(api.editCellAt(p, 9, 9), -1, 'off the map is not a cell');
});

test('a rectangle fill stops at the edge of the room', () => {
    const p = palette();
    api.editReset(0x76);
    // The room is 3x2; ask for 4x4 and only the real cells come back.
    const w = api.editRectWrites(0, 0, 3, 3, 1, p);
    assert.strictEqual(w.length, 6);
    assert.ok(w.every((c) => c.x < 3 && c.y < 2));
});

/**
 * "Move the window to the side" — the gesture the editor exists for. Take a
 * region, backfill it with the brush, then stamp it somewhere else.
 */
test('move takes a region, backfills it, and pastes it elsewhere', () => {
    const p = palette();
    const d = api.editReset(0x76);
    d.brush = 0;                       // what the hole is filled with
    api.setSel({ x1: 0, y1: 0, x2: 1, y2: 0 });   // the two cells at the top left

    const backfill = api.editTakeSelection(p, true);
    assert.deepStrictEqual(api.clip(), { w: 2, h: 1, cells: [0, 0] });
    assert.strictEqual(backfill.length, 2);
    assert.ok(backfill.every((c) => c.index === 0));
    api.editApply(backfill);

    const paste = api.editPasteWrites(1, 1, p);
    assert.deepStrictEqual(paste, [{ x: 1, y: 1, index: 0 }, { x: 2, y: 1, index: 0 }]);
    api.editApply(paste);

    // And the whole move is two undo steps, not eight.
    assert.strictEqual(api.editUndo(), true);
    assert.strictEqual(api.editCellAt(p, 2, 1), 0, 'the paste is gone, the grid shows through');
});

test('copy leaves the source alone', () => {
    const p = palette();
    const d = api.editReset(0x76);
    d.brush = 0;
    api.setSel({ x1: 0, y1: 0, x2: 1, y2: 0 });
    assert.deepStrictEqual(api.editTakeSelection(p, false), [], 'copy writes nothing');
    assert.strictEqual(api.clip().w, 2);
});

test('a paste clipped by the edge drops the cells that fall off', () => {
    const p = palette();
    api.editReset(0x76);
    api.setSel({ x1: 0, y1: 0, x2: 1, y2: 0 });
    api.editTakeSelection(p, false);
    assert.deepStrictEqual(api.editPasteWrites(2, 0, p), [{ x: 2, y: 0, index: 0 }]);
});

/**
 * A painted cell is drawn from the atlas the tab already has, so a stroke
 * costs no round trip. The crop has to name the right cell of the right
 * sheet, and a composed stamp has to come from the preview sheet.
 */
test('a painted cell crops the right stamp out of the right sheet', () => {
    const p = Object.assign(palette(), {
        imageUri: 'data:img/room', imageWidth: 256, imageHeight: 16, columns: 16, cell: 16,
    });
    const composed = { imageUri: 'data:img/new', imageWidth: 256, imageHeight: 16, columns: 16, cell: 16, count: 2 };
    api.editReset(0x76);

    const own = api.editStampSvg(p, composed, 2, 10, 20, 'c');
    assert.ok(own.includes('data:img/room'), 'a room stamp comes from the palette sheet');
    assert.ok(own.includes('viewBox="32 0 16 16"'), 'stamp 2 is the third cell of the first row');
    assert.ok(own.includes('x="10" y="20" width="2" height="2"'), 'a metatile is two map units');

    const made = api.editStampSvg(p, composed, 4, 0, 0, 'c');
    assert.ok(made.includes('data:img/new'), 'index 4 is composed #1, from the preview sheet');
    assert.ok(made.includes('viewBox="16 0 16 16"'));

    assert.strictEqual(api.editStampSvg(p, composed, 99, 0, 0, 'c'), '', 'an index with no sheet draws nothing');
});

test('cell positions are two map units apart, from the map origin', () => {
    assert.deepStrictEqual(api.editCellPos({ x: 0, y: 9 }, 3, 4), { x: 6, y: 17 });
});

console.log(`\n  ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
