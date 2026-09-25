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
// map-editor-special.js is DOM-free too: its catalog and bit math only
// touch editDraft()/editAddStamp()/editStampWords(), which map-editor.js
// (now split into map-editor.js + map-editor-stamps.js) already supplies.
// map-editor-trigger-select.js is DOM-free the same way: every render call
// it makes is guarded by `typeof renderEditChrome === 'function'` etc., so
// it runs with none of those defined; `_mtPalette`/`_editActiveTab` are
// stubbed here since their real owners (metatile-palette.js/
// map-editor-tabs.js) are not part of this minimal bundle. escH is only used
// by the HTML-string builders (specialTabHtml, buildSpecialFilterChipHtml)
// that this suite does not call, so no stub is needed for it.
const api = new Function(`
  var _mtPalette = null;
  var _editActiveTab = 'tile';
  ${read('map-editor.js')}
  ${read('map-editor-stamps.js')}
  ${read('map-editor-paint.js')}
  ${read('map-editor-phases.js')}
  ${read('map-editor-special.js')}
  ${read('map-editor-trigger-select.js')}
return { editReset, editActive, editDraft, editKey, editApply, editUndo, editRedo,
         editAddStamp, editStampWords, editExport, editStampCount,
         editCellAt, editRectWrites, editPasteWrites, editTakeSelection,
         editStampSvg, editCellPos,
         editSpecialById, editSpecialAppliedIndex, editSpecialAt, editSpecialGroupOf,
         groups: EDIT_SPECIAL_GROUPS,
         setSel: (s) => { _editSel = s; }, clip: () => _editClip,
         editTriggerList, editTriggerAt, editTriggerFind, triggerParseRef,
         triggerSelect, triggerDeleteSelected, triggerCommitMove,
         triggerCopySelected, triggerPasteClipboard,
         setPalette: (p) => { _mtPalette = p; }, getActiveTab: () => _editActiveTab,
         setActiveTab: (t) => { _editActiveTab = t; } };`)();

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

/**
 * The crop is the nested viewport clipping, and nothing else.
 *
 * A nested <svg> clips to its own width/height by default, which is what
 * turns a 256px-wide sheet into one 16x16 stamp. Overriding that in CSS
 * draws the entire atlas at every painted cell, smeared across the map —
 * which is not a subtle wrong colour, it is the map gone. Cheap to assert,
 * and no runtime test would have caught it.
 */
test('the stylesheet does not switch off the crop', () => {
    const css = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'shared', 'shared.css'), 'utf8');
    const rule = css.match(/\.rg-edit-cell\s*\{([^}]*)\}/);
    assert.ok(rule, '.rg-edit-cell must have a rule; the crop depends on it');
    assert.ok(/overflow\s*:\s*hidden/.test(rule[1]),
        '.rg-edit-cell must clip: ' + rule[1].trim());
    assert.ok(!/overflow\s*:\s*visible/.test(rule[1]));
});

test('cell positions are two map units apart, from the map origin', () => {
    assert.deepStrictEqual(api.editCellPos({ x: 0, y: 9 }, 3, 4), { x: 6, y: 17 });
});

// ---------------------------------------------------------------------------
// The Special tab's collision-bit math and its undo batching.
//
// Gate and drift are the two picks docs/map-format/map_collision_mechanics.md
// actually backs (§4, §6); stairs and entrance carry no `gate`/`drift` field
// in the catalog, so they must never touch the collision word — pinned here
// so a future edit to the catalog can't accidentally invent one.
// ---------------------------------------------------------------------------

console.log('\nspecial tab: collision-bit math:');

test('a gate pick writes only the documented nibble into bits 11..8', () => {
    const p = palette();
    api.editReset(0x76);
    const idx = api.editSpecialAppliedIndex(p, 0, 'gate-dog', false);
    const w = api.editStampWords(p, idx);
    assert.strictEqual(w.collision, (0x101f & ~0x0f00) | (0x5 << 8));
    assert.strictEqual(w.layer1, 0xa800, 'the picture is untouched');
    assert.strictEqual(w.layer2, 0x19ce, 'so is the terrain');
});

test('a drift pick sets the AW bit and repurposes the low nibble as direction', () => {
    const p = palette();
    api.editReset(0x76);
    const idx = api.editSpecialAppliedIndex(p, 0, 'drift-e', false);
    assert.strictEqual(api.editStampWords(p, idx).collision, (0x101f & ~0x200f) | 0x2000 | 0xa);
});

test('stairs and entrance never touch the collision word — no encoding is attested', () => {
    const p = palette();
    api.editReset(0x76);
    assert.strictEqual(api.editSpecialAppliedIndex(p, 0, 'stairs-vert', false), 0,
        'no new stamp, because nothing changed');
    assert.strictEqual(api.editSpecialAppliedIndex(p, 0, 'entrance-n', false), 0);
});

test('erasing a special clears exactly its own bits, keeping the rest of the stamp', () => {
    const p = palette();
    api.editReset(0x76);
    const gated = api.editSpecialAppliedIndex(p, 0, 'gate-dog', false);
    const cleared = api.editSpecialAppliedIndex(p, gated, null, true);
    assert.strictEqual(api.editStampWords(p, cleared).collision, 0x101f, 'back to the room’s own word');
});

test('the catalog marks gate/drift as real writes and nothing else as one', () => {
    const flat = [].concat(...api.groups.map((g) => g.items));
    const stairsOnly = flat.filter((it) => it.id.indexOf('stairs-') === 0);
    assert.ok(stairsOnly.length && stairsOnly.every((it) => it.gate == null && it.drift == null),
        'a "stairs" item may never carry a bitfield — none is attested');
    const entrance = flat.filter((it) => it.id.indexOf('entrance-') === 0);
    assert.ok(entrance.length && entrance.every((it) => it.gate == null && it.drift == null));
    assert.strictEqual(api.editSpecialById('gate-boy').gate, 0x7);
    assert.strictEqual(api.editSpecialById('drift-n').drift, 0x8);
});

console.log('\nspecial cells + undo:');

test('a special write batches into the same undo step as its cell write', () => {
    api.editReset(0x76);
    assert.strictEqual(api.editApply([{ x: 1, y: 1, index: 4 }], [{ x: 1, y: 1, id: 'gate-dog' }]), 2);
    assert.strictEqual(api.editDraft().specialCells['1,1'], 'gate-dog');
    assert.strictEqual(api.editDraft().undo.length, 1, 'one click, one undo step');
    assert.strictEqual(api.editUndo(), true);
    assert.ok(!('1,1' in api.editDraft().specialCells), 'the glyph goes with the cell');
    assert.ok(!('1,1' in api.editDraft().cells));
    assert.strictEqual(api.editRedo(), true);
    assert.strictEqual(api.editDraft().specialCells['1,1'], 'gate-dog');
});

test('a special-only write, with no tile change, is still one undoable step', () => {
    api.editReset(0x76);
    assert.strictEqual(api.editApply([], [{ x: 2, y: 2, id: 'entrance-default' }]), 1);
    assert.strictEqual(api.editDraft().undo.length, 1);
    assert.strictEqual(api.editUndo(), true);
    assert.ok(!('2,2' in api.editDraft().specialCells));
});

test('editSpecialAt reads the same map editApply writes', () => {
    api.editReset(0x76);
    assert.strictEqual(api.editSpecialAt(3, 3), null);
    api.editApply([], [{ x: 3, y: 3, id: 'stairs-vert' }]);
    assert.strictEqual(api.editSpecialAt(3, 3), 'stairs-vert');
});

test('specialCells is a UI-only overlay, never part of the export', () => {
    const p = palette();
    api.editReset(0x76);
    api.editApply([], [{ x: 0, y: 0, id: 'entrance-default' }]);
    const out = api.editExport(p);
    assert.ok(!('specialCells' in out), 'entrances/stairs glyphs are not ROM data');
});

// ---------------------------------------------------------------------------
// The Select tool's trigger model — map-editor-trigger-select.js. An 8x8
// room, one base step trigger and one base B-trigger, so a move has room to
// land and a clamp has an edge to reach. See
// docs/map-editor-redesign-plan.md Phase 4 for the unification this pins:
// base triggers (`_mtPalette.attachments`, read-only) and this draft's own
// (`_edit.placed`) as one selectable/movable/deletable/copy-pasteable list.
// ---------------------------------------------------------------------------

console.log('\nSelect tool: the unified trigger model:');

function triggerPalette() {
    return {
        widthTiles: 8, heightTiles: 8,
        attachments: {
            stepOn: [[1, 1, 2, 2, 0x1111]],
            bTrigger: [[7, 0, 7, 1, 0x2222]],
            objects: [],
        },
    };
}

test('the list merges base and placed triggers of one kind', () => {
    api.editReset(0x76);
    api.setPalette(triggerPalette());
    const step = api.editTriggerList('step');
    assert.strictEqual(step.length, 1);
    assert.deepStrictEqual(step[0].ref, { kind: 'step', id: 'base:0' });
    assert.strictEqual(step[0].origin, 'base');
    assert.deepStrictEqual([step[0].x1, step[0].y1, step[0].x2, step[0].y2], [1, 1, 2, 2]);
    assert.strictEqual(api.editTriggerList('b').length, 1);
});

test('hit-testing finds the trigger under a cell, and nothing off it', () => {
    api.editReset(0x76);
    api.setPalette(triggerPalette());
    assert.deepStrictEqual(api.editTriggerAt(1, 1), { kind: 'step', id: 'base:0' });
    assert.deepStrictEqual(api.editTriggerAt(7, 0), { kind: 'b', id: 'base:0' });
    assert.strictEqual(api.editTriggerAt(0, 0), null, 'outside every box');
});

test('selecting switches the active tab to Trigger; deselecting does not touch it', () => {
    api.editReset(0x76);
    api.setPalette(triggerPalette());
    api.setActiveTab('tile');
    api.triggerSelect({ kind: 'step', id: 'base:0' });
    assert.strictEqual(api.getActiveTab(), 'trigger');
    api.setActiveTab('info');
    api.triggerSelect(null);
    assert.strictEqual(api.getActiveTab(), 'info', 'clearing a selection is not itself a reason to switch tabs');
});

test('moving a base trigger hides the base one and adds a placed one at the new spot', () => {
    api.editReset(0x76);
    api.setPalette(triggerPalette());
    api.triggerSelect({ kind: 'step', id: 'base:0' });
    api.triggerCommitMove({ kind: 'step', id: 'base:0' }, 4, 4);

    const list = api.editTriggerList('step');
    assert.strictEqual(list.length, 1, 'one trigger, not two — the base one is hidden, not duplicated');
    assert.strictEqual(list[0].origin, 'placed');
    assert.deepStrictEqual([list[0].x1, list[0].y1, list[0].x2, list[0].y2], [4, 4, 5, 5]);
    assert.strictEqual(list[0].scriptId, 0x1111, 'the script id travels with the move');
    assert.deepStrictEqual(api.editDraft().selectedTriggerRef, list[0].ref,
        'the selection follows the trigger to its new identity');

    assert.strictEqual(api.editUndo(triggerPalette()), true);
    assert.strictEqual(api.editTriggerList('step')[0].origin, 'base', 'undo restores the base trigger');
    assert.strictEqual(api.editRedo(triggerPalette()), true);
    assert.strictEqual(api.editTriggerList('step')[0].origin, 'placed', 'redo moves it again');
});

test('moving an already-placed trigger mutates it in place, keeping its identity', () => {
    api.editReset(0x76);
    api.setPalette(triggerPalette());
    api.triggerSelect({ kind: 'step', id: 'base:0' });
    api.triggerCommitMove({ kind: 'step', id: 'base:0' }, 4, 4);
    const firstRef = api.editDraft().selectedTriggerRef;

    api.triggerCommitMove(firstRef, 6, 6);
    assert.deepStrictEqual(api.editDraft().selectedTriggerRef, firstRef, 'same placed trigger, not a new one');
    assert.strictEqual(api.editDraft().undo.length, 2, 'two separate moves, two undo steps');
});

test('a move is clamped to the last position that keeps the whole box on the grid', () => {
    api.editReset(0x76);
    api.setPalette(triggerPalette());
    api.triggerSelect({ kind: 'step', id: 'base:0' });
    api.triggerCommitMove({ kind: 'step', id: 'base:0' }, 20, 20);
    const t = api.editTriggerFind(api.editDraft().selectedTriggerRef);
    // 8 wide, box is 2 wide: the last position that fits is 6.
    assert.deepStrictEqual([t.x1, t.y1, t.x2, t.y2], [6, 6, 7, 7]);
});

test('deleting a base trigger marks it removed rather than mutating the base array', () => {
    const p = triggerPalette();
    api.editReset(0x76);
    api.setPalette(p);
    api.triggerSelect({ kind: 'b', id: 'base:0' });
    api.triggerDeleteSelected();

    assert.strictEqual(api.editTriggerList('b').length, 0);
    assert.deepStrictEqual(p.attachments.bTrigger, [[7, 0, 7, 1, 0x2222]],
        'the room’s own attachments array is never touched');
    assert.strictEqual(api.editDraft().selectedTriggerRef, null);
    assert.ok(api.editDraft().removedTriggers.some((r) => r.kind === 'b' && r.index === 0));

    assert.strictEqual(api.editUndo(p), true);
    assert.strictEqual(api.editTriggerList('b').length, 1, 'undo brings it back');
    assert.strictEqual(api.editRedo(p), true);
    assert.strictEqual(api.editTriggerList('b').length, 0);
});

test('deleting a placed trigger soft-deletes it, so `placed` stays append-only', () => {
    api.editReset(0x76);
    api.setPalette(triggerPalette());
    api.triggerSelect({ kind: 'step', id: 'base:0' });
    api.triggerCommitMove({ kind: 'step', id: 'base:0' }, 4, 4);
    const ref = api.editDraft().selectedTriggerRef;

    api.triggerDeleteSelected();
    assert.strictEqual(api.editTriggerList('step').length, 0);
    const raw = api.editDraft().placed.filter((p) => p.uid != null);
    assert.strictEqual(raw.length, 1, 'the entry is still there, just tombstoned');
    assert.strictEqual(raw[0].removed, true);

    assert.strictEqual(api.editUndo(triggerPalette()), true);
    assert.deepStrictEqual(api.editDraft().selectedTriggerRef, null,
        'undo restores the trigger, but does not re-select it — selection is UI focus, not part of the snapshot');
    assert.strictEqual(api.editTriggerList('step').length, 1);
    assert.deepStrictEqual(api.editTriggerFind(ref).ref, ref, 'and it is the very same trigger, not a new one');
});

test('copy/paste offsets by +1 row, +1 col, clamped, and selects the new one', () => {
    api.editReset(0x76);
    api.setPalette(triggerPalette());
    api.triggerSelect({ kind: 'step', id: 'base:0' });   // box (1,1)-(2,2)
    api.triggerCopySelected();
    api.triggerPasteClipboard();

    const list = api.editTriggerList('step');
    assert.strictEqual(list.length, 2, 'the original base trigger is untouched by a copy');
    const placedOnes = list.filter((t) => t.origin === 'placed');
    assert.strictEqual(placedOnes.length, 1);
    assert.deepStrictEqual([placedOnes[0].x1, placedOnes[0].y1], [2, 2], 'offset by +1, +1 from (1,1)');
    assert.strictEqual(placedOnes[0].scriptId, 0x1111);
    assert.deepStrictEqual(api.editDraft().selectedTriggerRef, placedOnes[0].ref);
});

test('pasting past the edge clamps like a drag would', () => {
    api.editReset(0x76);
    api.setPalette(triggerPalette());
    api.triggerSelect({ kind: 'step', id: 'base:0' });
    api.triggerCommitMove({ kind: 'step', id: 'base:0' }, 6, 6);   // already at the max clamp
    api.triggerCopySelected();
    api.triggerPasteClipboard();
    const t = api.editTriggerFind(api.editDraft().selectedTriggerRef);
    assert.deepStrictEqual([t.x1, t.y1], [6, 6], '+1 offset from (6,6) clamps right back to (6,6)');
});

test('exporting drops soft-deleted placed triggers and carries removedTriggers', () => {
    const p = triggerPalette();
    api.editReset(0x76);
    api.setPalette(p);
    api.triggerSelect({ kind: 'b', id: 'base:0' });
    api.triggerDeleteSelected();          // a removed base trigger
    api.triggerSelect({ kind: 'step', id: 'base:0' });
    api.triggerCommitMove({ kind: 'step', id: 'base:0' }, 4, 4);   // a placed trigger
    api.triggerDeleteSelected();          // ...then soft-deleted

    const out = api.editExport(p);
    // Two hidden base triggers: the B-trigger deleted outright, and the step
    // trigger hidden by its own move (before the moved copy was itself
    // deleted) — both are real removals the exported room must account for.
    assert.deepStrictEqual(out.removedTriggers, [{ kind: 'b', index: 0 }, { kind: 'step', index: 0 }]);
    assert.ok(!out.attachments.some((a) => a.removed), 'no soft-deleted placed trigger is exported');
    assert.strictEqual(out.attachments.length, 0);
});

test('triggerParseRef splits only on the first colon, since an id can contain one', () => {
    assert.deepStrictEqual(api.triggerParseRef('step:base:2'), { kind: 'step', id: 'base:2' });
    assert.deepStrictEqual(api.triggerParseRef('b:placed:14'), { kind: 'b', id: 'placed:14' });
});

// ---------------------------------------------------------------------------
// The composer, run against a stub DOM.
//
// "add stamp" silently did nothing when a source was missing, which from the
// outside is indistinguishable from a broken button. These tests pin both
// halves: what it refuses, and that a complete composition really lands.
// ---------------------------------------------------------------------------

console.log('\ncomposing a stamp:');

/** All five webview files in one scope, as the browser concatenates them. */
const ui = new Function(`
  var document = { getElementById: function () { return null; } };
  function escH(s) { return String(s); }
  ${read('metatile-palette.js')}
  ${read('map-editor.js')}
  ${read('map-editor-stamps.js')}
  ${read('map-editor-paint.js')}
  ${read('map-editor-ui.js')}
  ${read('map-editor-phases.js')}
  ${read('map-editor-constructs.js')}
  ${read('map-editor-families.js')}
  ${read('map-editor-relations.js') /* the adjacency model (undirected + per side), split out of chips in §8a */}
  ${read('map-editor-chips.js')}
  ${read('map-editor-stranded.js') /* the invalid-family banner, §8a */}
  ${read('map-editor-tiles.js')}
  ${read('map-editor-neighbours.js') /* the plus-shaped LIKELY NEIGHBORS card, §8b */}
  ${read('map-editor-special.js')}
  ${read('map-editor-trigger-select.js')}
  ${read('map-editor-trigger-panel.js')}
  ${read('map-editor-toolbar.js') /* the floating tool pill, split out of map-editor-ui.js in Phase 7a */}
  ${read('map-editor-filterbar.js') /* the docked filter bar + status bar, likewise Phase 7a */}
  ${read('tables-builder.js') /* buildEntityTablesHtml, still used above the map outside edit mode */}
  ${read('map-editor-tabs.js')}
  ${read('map-editor-panels.js')}
  ${read('map-editor-gestures.js')}
  ${read('map-editor-input.js')}
  ${read('map-editor-actions.js')}
  ${read('map-editor-newroom.js')}
  ${read('map-editor-start.js') /* the Boy's start on a drafted map */}
  return {
    tileSlotWord: tileSlotWord, editOnTilePicked: editOnTilePicked,
    editAction: editAction, editReset: editReset, editDraft: editDraft,
    controls: metatilePaletteControls, editFamilies: editFamilies,
    editAdoptFamilyFor: editAdoptFamilyFor,
    budgetBar: budgetBar, vanillaEvidence: vanillaEvidence,
    editResolve: editResolve, editBlankCanopy: editBlankCanopy,
    editSaveConstruct: editSaveConstruct, editConstructWrites: editConstructWrites,
    editNeededStamps: editNeededStamps, editErrors: editErrors,
    toolbar: buildEditToolbarHtml, tileGroup: tileGroupHtml,
    setSheet: function (f, sheet) { _famSheets[f] = sheet; },
    setGroupOpen: function (f, on) { if (on) _tileGroupOpen[f] = true; else delete _tileGroupOpen[f]; },
    uiPrefs: applyUiPrefs,
    setRelated: function (map) { _related = map; },
    strandedCells: editStrandedCells,
    setSel2: function (s) { _editSel = s; },
    compose: function () { return _editCompose; },
    setPalette: function (p) { _mtPalette = p; },
    setSelected: function (i) { _mtSelected = i; },
    setView: function (v, pal) { _mtView = v; if (pal) _mtBgPalette = pal; },
    specialTab: specialTabHtml, specialFilterChip: buildSpecialFilterChipHtml,
    editStroke: editStroke, editSpecialAt: editSpecialAt,
  };`)();

/** A palette with the tile sheet the host now sends alongside it. */
function tilePalette() {
    const p = palette();
    p.tileFamilies = [35, 187, 58, 165, 149, 59, 166];
    p.tiles = {
        count: 2, columns: 16, cell: 16, palette: 3, paletteCount: 7,
        // [slot, chr, graphicId, animated]
        slots: [[0, 0, 0x0422, 0], [1, 2, 0x0423, 1]],
        imageUri: 'data:img/tiles',
    };
    return p;
}

test('a graphic names itself with chr plus the family it is shown in', () => {
    const p = tilePalette();
    // A tilemap word is vhopppcccccccccc: chr in the low ten bits, the
    // background palette in bits 10..12. Family 3 of this room is $58.
    assert.strictEqual(ui.tileSlotWord(p, 0), 0x0c00);
    assert.strictEqual(ui.tileSlotWord(p, 1), 0x0c02);
    assert.strictEqual(ui.tileSlotWord(p, 9), null, 'past the end there is no word');
});

test('the family tabs are labelled with the room’s family ids', () => {
    ui.setView('tiles', 1);
    const html = ui.controls(tilePalette());
    assert.ok(/data-mt-bgpal="1"[^>]*>35</.test(html), 'tab 1 is family 35: ' + html);
    assert.ok(/data-mt-bgpal="7"[^>]*>166</.test(html), 'tab 7 is family 166');
    assert.ok(html.includes('tiles · 2'), 'the view button says how many graphics there are');
});

test('a picked graphic fills the armed layer source', () => {
    const p = tilePalette();
    ui.setPalette(p);
    ui.editReset(0x34).on = true;
    ui.compose().layer1 = null; ui.compose().layer2 = null; ui.compose().collision = null;

    ui.compose().pick = 'layer2';
    ui.compose().armed = true;
    assert.strictEqual(ui.editOnTilePicked(ui.tileSlotWord(p, 1)), true);
    assert.strictEqual(ui.compose().layer2, 0x0c02);
    assert.strictEqual(ui.compose().armed, false, 'one pick, one slot');

    // Nothing in a graphic says what is solid, so the collision slot has to
    // wait for a stamp; taking a tilemap word here would invent geometry.
    ui.compose().pick = 'collision';
    ui.compose().armed = true;
    assert.strictEqual(ui.editOnTilePicked(0x0c00), false);
    assert.strictEqual(ui.compose().collision, null);
});

test('add stamp refuses a half-composed stamp and takes a whole one', () => {
    const p = tilePalette();
    ui.setPalette(p);
    const d = ui.editReset(0x34);
    d.on = true;
    ui.compose().layer1 = null;
    ui.compose().layer2 = 0x0c02;
    ui.compose().collision = null;
    ui.editAction('compose-add');
    assert.strictEqual(d.added.length, 0, 'no canopy word, no stamp');

    ui.compose().layer1 = 0x0c00;
    ui.editAction('compose-add');
    assert.strictEqual(d.added.length, 1, 'both words present, the stamp lands');
    assert.strictEqual(d.brush, p.count, 'and becomes the brush');
    // No stamp in this room draws that terrain word, so the collision falls
    // back to 0 rather than borrowing an unrelated one.
    assert.strictEqual(d.added[0].collision, 0);
});

// ---------------------------------------------------------------------------
// The budget meter and the vanilla evidence.
//
// Both exist to stop the editor asserting things it cannot back up: a
// ceiling it would silently blow through, and a suggestion with no stated
// confidence. See docs/map-format/building-a-room-from-a-picture.md §2, §4.
// ---------------------------------------------------------------------------

test('the budget meter marks the family ceiling as full, not merely used', () => {
    const p = tilePalette();
    p.budget = {
        graphics: { used: 92, max: 264, vanilla: 255 },
        families: { used: 7, max: 7, vanilla: 7 },
        stamps: { used: 175, max: null, vanilla: 2131 },
        wram: { used: 2048, max: 32768, vanilla: 32680 },
        attested: 157,
    };
    const html = ui.budgetBar(p);
    assert.ok(html.includes('92/264'), 'graphics reads used/max');
    assert.ok(html.includes('7/7'));
    // Seven of seven is at the ceiling, so the bar warns; it is not over it.
    assert.ok(/rs-bg-bar warn[^>]*><i style="width:100\.0%/.test(html), 'full families warn: ' + html);
    assert.ok(!html.includes('rs-bg-bar over'), 'nothing here is past its ceiling');
    // Stamps have no known field limit, so no bar may be drawn for them.
    assert.ok(html.includes('no field limit'));
    assert.ok(html.includes('175') && !/>175\/[0-9]/.test(html), 'stamps show no denominator');
    assert.ok(html.includes('157'), 'the attested vocabulary is shown');
});

test('a budget past its ceiling reads as over, not as 100%', () => {
    const p = tilePalette();
    p.budget = {
        graphics: { used: 270, max: 264, vanilla: 255 },
        families: { used: 7, max: 7, vanilla: 7 },
        stamps: { used: 1, max: null, vanilla: 2131 },
        wram: { used: 10, max: 32768, vanilla: 32680 },
        attested: 3,
    };
    assert.ok(ui.budgetBar(p).includes('rs-bg-bar over'));
});

test('vanilla evidence always carries its confidence', () => {
    const p = tilePalette();
    //         [family, family%, familiesSeen, collision, collision%]
    p.vanilla = [[58, 100, 1, 0x101f, 94], [149, 80, 2, null, 0], null];
    const one = ui.vanillaEvidence(p, 0);
    assert.ok(one.includes('family 58') && one.includes('100%'), one);
    assert.ok(one.includes('only one seen'), 'an unambiguous graphic says so');
    assert.ok(one.includes('$101F') && one.includes('94%'), 'collision comes with its share');

    const two = ui.vanillaEvidence(p, 1);
    assert.ok(two.includes('2 families seen'), 'an ambiguous one admits it');
    assert.ok(!two.includes('collision'), 'a canopy-only graphic claims no collision');

    assert.ok(ui.vanillaEvidence(p, 2).includes('never drawn'), 'and silence is stated, not blank');
});

// ---------------------------------------------------------------------------
// Layer phases, the eraser and constructs.
//
// The phase split is the load-bearing part: "first draw the room, then fill
// it with deco" is only real if a deco stroke writes different words from a
// room stroke. Room 0x34's decorations are canopy words over an unchanged
// terrain word, which is exactly what these assert.
// ---------------------------------------------------------------------------

console.log('\nlayer phases and constructs:');

/** A palette shaped like room 0x34: a bare floor plus a decorated cell. */
function decoPalette() {
    return {
        count: 3,
        baseMetatile: 8,
        // [index, canopy, terrain, collision, uses]
        entries: [
            [0, 0xa800, 0x4c62, 0x0010, 40],   // bare floor, blank canopy, walkable
            [1, 0x2c66, 0x4c62, 0x001f, 3],    // the hide: a canopy over that same floor
            [2, 0xa800, 0x0c2c, 0x101f, 9],    // a different floor
        ],
        grid: [[0, 1, 2], [0, 0, 0]],
        widthTiles: 3,
        heightTiles: 2,
        attachments: {
            bTrigger: [[1, 0, 1, 0, 1854]],
            stepOn: [],
            objects: [[1, 0, 1, 1, 7]],
        },
    };
}

test('the blank canopy is derived from the room, not assumed', () => {
    // $A800 carries 40 + 9 placements here against the hide's 3, and in the
    // ROM it is the most-placed canopy word in every room measured.
    assert.strictEqual(ui.editBlankCanopy(decoPalette()), 0xa800);
    assert.strictEqual(ui.editBlankCanopy(null), 0xa800, 'with no palette, fall back to it');
});

test('a ground brush replaces everything; a canopy brush keeps the floor', () => {
    const p = decoPalette();
    ui.setPalette(p);
    const d = ui.editReset(0x34);
    d.on = true;

    // §8a.2: no phase argument. Which of the two a stroke does is read off
    // the brush's own words — stamp 2 is a floor (blank canopy $A800), so it
    // wins outright, exactly as the old `room` phase did.
    assert.strictEqual(ui.editResolve(p, 0, 1, 2, false), 2);
    assert.strictEqual(d.added.length, 0, 'and it invents nothing');

    // Stamp 1 is the hide: a real canopy word ($2C66) over a floor. Painting
    // it at (2,0) — which is stamp 2, terrain $0C2C — must take the hide's
    // canopy and collision but keep $0C2C underneath, which is what the old
    // `deco` phase did and what "put this on top of that" means.
    const made = ui.editResolve(p, 2, 0, 1, false);
    assert.strictEqual(made, p.count, 'a new stamp is needed');
    assert.deepStrictEqual(d.added[0], { layer1: 0x2c66, layer2: 0x0c2c, collision: 0x001f });
});

test('erasing takes the picture and the collision back off the floor', () => {
    const p = decoPalette();
    ui.setPalette(p);
    const d = ui.editReset(0x34);
    d.on = true;

    // Cell (1,0) is the hide: canopy $2C66, solid. Erasing restores the
    // blank canopy and the collision the room uses on bare $4C62 — which is
    // stamp 0's $0010, not the hide's $001F. Otherwise removing a gourd
    // would leave a hole you still cannot walk through.
    const bare = ui.editResolve(p, 1, 0, -1, true);
    assert.strictEqual(bare, 0, 'it resolves to the floor stamp the room already has');
    assert.strictEqual(d.added.length, 0, 'so nothing new is needed');

    // Erasing bare floor is a no-op rather than a pointless new stamp.
    assert.strictEqual(ui.editResolve(p, 0, 1, -1, true), 0);
    assert.strictEqual(d.added.length, 0);

    // §8a.2: erase no longer depends on a mode being set first. It used to be
    // a flat no-op outside `deco` phase no matter what was under the cursor,
    // so removing a decoration meant remembering to flip a toggle. Now the
    // only thing that stops it is there being nothing there — a cell off the
    // grid has no stamp to take a canopy off.
    assert.strictEqual(ui.editResolve(p, 9, 9, -1, true), -1);
    assert.strictEqual(d.added.length, 0);
});

test('a construct carries the triggers and objects inside its selection', () => {
    const p = decoPalette();
    ui.setPalette(p);
    const d = ui.editReset(0x34);
    d.on = true;

    // (1,0) holds the hide, and the fixture puts both a B-trigger and an
    // object on that same cell — the gourd case.
    const gourd = ui.editSaveConstruct(p, { x1: 1, y1: 0, x2: 1, y2: 0 }, 'gourd');
    assert.strictEqual(gourd.cells.length, 1);
    assert.strictEqual(gourd.attachments.objects.length, 1, 'the object comes with it');
    assert.strictEqual(gourd.attachments.bTrigger.length, 1, 'and so does the B-trigger');
    assert.strictEqual(gourd.attachments.bTrigger[0].scriptId, 1854);

    // (0,1) is plain floor with nothing on it — the hide case.
    const hide = ui.editSaveConstruct(p, { x1: 0, y1: 1, x2: 0, y2: 1 }, 'hide');
    assert.strictEqual(hide.attachments.objects.length, 0, 'metatiles only');
    assert.strictEqual(hide.attachments.bTrigger.length, 0);
});

test('stamping a construct reuses stamps and clips at the edge', () => {
    const p = decoPalette();
    ui.setPalette(p);
    const d = ui.editReset(0x34);
    d.on = true;
    const c = ui.editSaveConstruct(p, { x1: 0, y1: 0, x2: 1, y2: 0 }, 'pair');

    const got = ui.editConstructWrites(p, c, 0, 1);
    assert.deepStrictEqual(got.writes, [{ x: 0, y: 1, index: 0 }, { x: 1, y: 1, index: 1 }],
        'both cells resolve to stamps the room already has');
    assert.deepStrictEqual(got.problems, [], 'and nothing had to be adopted');
    assert.strictEqual(d.added.length, 0, 'so the construct costs no dictionary space');

    // Placed so half of it hangs off the right edge, only the half that fits lands.
    assert.strictEqual(ui.editConstructWrites(p, c, 2, 0).writes.length, 1);
});

test('the checks catch what the format will not forgive', () => {
    const p = decoPalette();
    p.budget = {
        graphics: { used: 92, max: 264, vanilla: 255 },
        families: { used: 9, max: 7, vanilla: 7 },
        stamps: { used: 3, max: null, vanilla: 2131 },
        wram: { used: 40, max: 32768, vanilla: 32680 },
        attested: 20,
    };
    ui.setPalette(p);
    const d = ui.editReset(0x34);
    d.on = true;
    d.brush = 0;
    const errs = ui.editErrors(p);
    assert.ok(errs.some((e) => e[0] === 'hard' && /families 9\/7/.test(e[1])), JSON.stringify(errs));

    // Past vanilla but inside the window is a warning, not a blocker.
    p.budget.families.used = 7;
    p.budget.wram.used = 32700;
    const warn = ui.editErrors(p);
    assert.ok(warn.some((e) => e[0] === 'warn' && /more than any vanilla room/.test(e[1])));
    assert.ok(!warn.some((e) => e[0] === 'hard'), 'nothing hard: ' + JSON.stringify(warn));
});

/**
 * The grouped view shows one image many times, not many images.
/**
 * A family group is a window onto one sheet, so the data URI belongs on the
 * group wrapper and nowhere else. Repeating it per swatch once cost 150 KB
 * of markup for one 13 KB image — invisible on screen, and exactly the kind
 * of thing that creeps back.
 */
test('a tile group embeds its sheet once, not once per swatch', () => {
    ui.editReset(0x34);
    ui.setPalette(tilePalette());
    ui.setSheet(58, {
        family: 58, count: 3, total: 74, roomCount: 3, columns: 16, cell: 16,
        slots: [[0, 0, 4191, 10, 90, 10], [1, 2, 4195, 5, 2, 40], [2, 4, 4200, 99, 0, 0]],
        imageUri: 'data:image/png;base64,' + 'A'.repeat(2048),
    });
    ui.setRelated({});
    ui.setGroupOpen(58, true);
    const html = ui.tileGroup(58);
    ui.setGroupOpen(58, false);
    const uses = html.split('data:image/png').length - 1;
    assert.strictEqual(uses, 1, `the sheet URL appears ${uses} times, not once`);
    assert.strictEqual(html.split('data-fam-tile=').length - 1, 3, 'all three tiles are offered');
});

/**
 * Relationship beats popularity, and that is the point: 4200 has ten times
 * the placements of 4191 and no relationship to anything in the map, so it
 * goes last.
 */
test('a group is ordered by relationship first, placements second', () => {
    ui.editReset(0x34);
    ui.setPalette(tilePalette());
    ui.setSheet(58, {
        family: 58, count: 3, total: 74, roomCount: 3, columns: 16, cell: 16,
        slots: [[0, 0, 4191, 10, 0, 0], [1, 2, 4195, 5, 0, 0], [2, 4, 4200, 99, 0, 0]],
        imageUri: 'data:image/png;base64,ZmFt',
    });
    ui.setRelated({ 4191: 92, 4195: 3 });
    ui.setGroupOpen(58, true);
    const order = [...ui.tileGroup(58).matchAll(/data-fam-tile="(\d+)"/g)].map((m) => m[1]);
    assert.deepStrictEqual(order, ['4191', '4195', '4200']);

    // With nothing placed there is nothing to be related to, so the ordering
    // falls back to how often vanilla places each tile. A real cold start,
    // not a bug.
    ui.setRelated({});
    const cold = [...ui.tileGroup(58).matchAll(/data-fam-tile="(\d+)"/g)].map((m) => m[1]);
    assert.deepStrictEqual(cold, ['4200', '4191', '4195']);
    ui.setGroupOpen(58, false);
});

/**
 * Seven groups of art open at once bury the one you are drawing with, so a
 * group starts as just its header until it is opened; what is open is
 * remembered by the host (`uiPrefs`).
 */
test('a tile group starts collapsed, and the remembered set opens it', () => {
    ui.editReset(0x34);
    ui.setPalette(tilePalette());
    ui.setSheet(58, {
        family: 58, count: 1, total: 1, roomCount: 1, columns: 16, cell: 16,
        slots: [[0, 0, 4191, 10, 0, 0]], imageUri: 'data:image/png;base64,ZmFt',
    });
    const shut = ui.tileGroup(58);
    assert.ok(!shut.includes('data-fam-tile='), 'collapsed shows no art');
    assert.ok(/rg-group-count">1</.test(shut), 'but the header still says how much there is');
    assert.ok(shut.includes('data-tile-group="58"') && shut.includes('aria-expanded="false"'),
        'the header is the toggle');
    assert.strictEqual(shut.split('<div').length, shut.split('</div>').length, 'every div is closed');

    ui.uiPrefs({ openFamilies: [58] });
    const open = ui.tileGroup(58);
    assert.ok(open.includes('data-fam-tile="4191"') && open.includes('aria-expanded="true"'));
    ui.uiPrefs({});
    assert.ok(!ui.tileGroup(58).includes('data-fam-tile='), 'prefs replace, they do not add');
});

/**
 * Freeing a family does not silently recolour anything: the word still names
 * palette slot N, and slot N is now empty.
 */
test('clearing a family strands the cells that were drawn in it', () => {
    const p = tilePalette();
    ui.setPalette(p);
    const d = ui.editReset(0x34);
    d.on = true;
    // Palette slot 3 holds family 58, so a word with pal 3 names it.
    d.added.push({ layer1: 0x0c00, layer2: 0xa800, collision: 0 });
    d.cells['1,1'] = p.count;
    assert.deepStrictEqual(ui.strandedCells(), [], 'nothing is stranded while it is loaded');
    ui.editFamilies()[2] = undefined;
    assert.deepStrictEqual(ui.strandedCells(), ['1,1']);
});

test('the toolbar has no phase pair, and erase is never gated on one', () => {
    const d = ui.editReset(0x34);
    d.on = true;
    const bar = ui.toolbar();

    // §8a.2 removed the room/deco pair outright: layer targeting is the Tile
    // tab's own auto|front|ground row, and editResolve reads decoration-vs-
    // ground off the brush itself, so the pill has nothing to offer here.
    assert.ok(!bar.includes('data-edit-phase'), 'no phase buttons remain');
    assert.ok(!/\brg-phase\b/.test(bar), 'and no phase styling is left behind');

    // Erase used to be dimmed with "switch to deco first" outside deco phase.
    // With no phase to switch to, the gate is gone and the tool is plain.
    assert.ok(!bar.includes('switch to deco first'), 'erase carries no mode caveat');
    assert.ok(bar.includes('data-edit-tool="erase"'), 'and is still offered');

    assert.ok(bar.includes('data-edit-act="new-room"'), 'and a new room can be drafted');
    assert.strictEqual(d.phase, undefined, 'the draft carries no phase field at all');
});

// ---------------------------------------------------------------------------
// The Special tab's markup and its integration with a real paint/erase
// stroke — editStroke itself, not just the bit math it calls.
// ---------------------------------------------------------------------------

console.log('\nspecial tab markup and strokes:');

test('the Special tab renders all three groups and their chips', () => {
    const html = ui.specialTab();
    assert.ok(html.includes('Stairs &amp; Drift') || html.includes('Stairs & Drift'), html.slice(0, 200));
    assert.ok(/data-edit-special="gate-dog"/.test(html));
    assert.ok(/data-edit-special="entrance-n"/.test(html));
});

test('the filter chip carries a caret and the three sub-toggles', () => {
    const html = ui.specialFilterChip();
    assert.ok(html.includes('data-hide="hide-special"'));
    assert.ok(html.includes('data-edit-special-menu'));
    assert.ok(html.includes('data-hide="hide-special-stairs"'));
    assert.ok(html.includes('data-hide="hide-special-gate"'));
    assert.ok(html.includes('data-hide="hide-special-entrance"'));
});

test('painting a glyph-only special alongside a brush leaves the tile index alone', () => {
    const p = tilePalette();
    ui.setPalette(p);
    const d = ui.editReset(0x34);
    d.on = true;
    d.brush = 0;
    d.currentSpecialId = 'entrance-default';   // no gate/drift field: cosmetic only
    ui.editStroke({ x: 0, y: 0 }, 'down');
    assert.strictEqual(d.cells['0,0'], 0, 'the tile brush still wins the cell');
    assert.strictEqual(ui.editSpecialAt(0, 0), 'entrance-default');
    assert.strictEqual(d.undo.length, 1, 'one click, one undo step');
});

test('painting a gate/drift special alongside a brush rewrites the stamp it lands on', () => {
    const p = tilePalette();
    ui.setPalette(p);
    const d = ui.editReset(0x34);
    d.on = true;
    d.brush = 0;
    d.currentSpecialId = 'gate-dog';
    ui.editStroke({ x: 0, y: 0 }, 'down');
    assert.notStrictEqual(d.cells['0,0'], 0, 'a new stamp carries the gate bits, not the brush’s own');
    assert.strictEqual(ui.editSpecialAt(0, 0), 'gate-dog');
    assert.strictEqual(d.undo.length, 1, 'still one click, one undo step');
});

test('painting a special with no brush armed still stamps the glyph', () => {
    const p = tilePalette();
    ui.setPalette(p);
    const d = ui.editReset(0x34);
    d.on = true;
    d.brush = -1;
    d.currentSpecialId = 'stairs-vert';
    ui.editStroke({ x: 1, y: 0 }, 'down');
    assert.strictEqual(ui.editSpecialAt(1, 0), 'stairs-vert');
    assert.ok(!('1,0' in d.cells), 'no brush, so the grid falls through to the room’s own tile');
});

test('erasing takes the glyph and its collision bits off in one click', () => {
    const p = tilePalette();
    ui.setPalette(p);
    const d = ui.editReset(0x34);
    d.on = true;
    d.brush = 0;
    d.currentSpecialId = 'gate-dog';
    ui.editStroke({ x: 0, y: 0 }, 'down');
    const gatedIndex = d.cells['0,0'];

    d.tool = 'erase';
    d.phase = 'deco';
    ui.editStroke({ x: 0, y: 0 }, 'down');
    assert.strictEqual(ui.editSpecialAt(0, 0), null, 'the glyph is gone');
    assert.notStrictEqual(d.cells['0,0'], gatedIndex, 'the gate bits went with it');
});

test('“from brush” starts the composer off a stamp that already works', () => {
    const p = tilePalette();
    ui.setPalette(p);
    const d = ui.editReset(0x34);
    d.on = true;
    d.brush = 2;
    ui.editAction('compose-brush');
    assert.deepStrictEqual(
        [ui.compose().layer1, ui.compose().layer2, ui.compose().collision],
        [0x358a, 0x19cc, 0x0010],
    );
});

console.log(`\n  ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
