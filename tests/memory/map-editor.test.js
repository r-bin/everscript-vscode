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
  ${read('map-editor-history.js')}
  ${read('map-editor-stamps.js')}
  ${read('map-editor-paint.js')}
  ${read('map-editor-phases.js')}
  ${read('map-editor-special.js')}
  ${read('map-editor-flag-overlays.js')}
  ${read('map-editor-trigger-select.js')}
return { editReset, editActive, editDraft, editKey, editApply, editUndo, editRedo,
         editAddStamp, editStampWords, editExport, editStampCount,
         editCellAt, editRectWrites, editPasteWrites, editTakeSelection,
         editStampSvg, editCellPos,
         editSpecialById, editSpecialAppliedIndex, editSpecialAt, editSpecialGroupOf,
         editSpecialsAt, editCellSymbols, editSpecialGlyphSvg, flagOverlaySvg,
         editCellStepOnState, stepOnOverlayOn, editStepOnToggle, editDeadStepTriggers,
         editCellInteractState, interactOverlayOn, editInteractToggle,
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

test('an entrance never touches the collision word; vertical stairs write bit 13 + nibble 0', () => {
    const p = palette();
    api.editReset(0x76);
    assert.strictEqual(api.editSpecialAppliedIndex(p, 0, 'entrance-n', false), 0, 'no new stamp');
    // Vanilla puts bit 13 with nibble 0 under its step art (maps/vanilla-stairs.ts).
    const vert = api.editSpecialAppliedIndex(p, 0, 'stairs-vert', false);
    assert.strictEqual(api.editStampWords(p, vert).collision & 0x200f, 0x2000);
});

test('erasing a special clears exactly its own bits, keeping the rest of the stamp', () => {
    const p = palette();
    api.editReset(0x76);
    const gated = api.editSpecialAppliedIndex(p, 0, 'gate-dog', false);
    const cleared = api.editSpecialAppliedIndex(p, gated, null, true);
    assert.strictEqual(api.editStampWords(p, cleared).collision, 0x101f, 'back to the room’s own word');
});

test('the catalog marks gate/drift/stairs as real writes and nothing else as one', () => {
    const flat = [].concat(...api.groups.map((g) => g.items));
    // Diagonal stairs are the two shear drift nibbles vanilla puts under its
    // stair art (maps/vanilla-stairs.ts); vertical stairs have no encoding.
    assert.strictEqual(api.editSpecialById('stairs-diag-r').drift, 0x1, 'rises to the right');
    assert.strictEqual(api.editSpecialById('stairs-diag-l').drift, 0x2, 'rises to the left');
    assert.strictEqual(api.editSpecialById('stairs-vert').drift, 0x0, 'vertical: walkable, no drift');
    const entrance = flat.filter((it) => it.id.indexOf('entrance-') === 0);
    assert.ok(entrance.length && entrance.every((it) => it.gate == null && it.drift == null));
    assert.strictEqual(api.editSpecialById('gate-boy').gate, 0x7);
    assert.strictEqual(api.editSpecialById('drift-n').drift, 0x8);
    assert.strictEqual(api.editSpecialById('interact-force-1').interact, 1);
    assert.strictEqual(api.editSpecialById('interact-force-0').interact, 0);
    assert.strictEqual(api.editSpecialById('deflect').deflect, 1);
    assert.strictEqual(api.editSpecialById('deflect').gate, 0x1);
    assert.strictEqual(api.editSpecialById('deflect').glyph, 'DF');
});

test('deflect special sets bit 8 (0x0100) in collision word and displays DF glyph', () => {
    const p = palette();
    api.editReset(0x76);
    const defIdx = api.editSpecialAppliedIndex(p, 0, 'deflect', false);
    assert.strictEqual(api.editStampWords(p, defIdx).collision & 0x0100, 0x0100, 'Bit 8 set');
    assert.strictEqual(api.editStampWords(p, defIdx).collision, 0x111f, '0x101f with bit 8 = 0x111f');
    const svg = api.editSpecialGlyphSvg('deflect', 0, 0);
    assert.ok(svg.includes('>DF<'), 'renders DF glyph');
});

test('interact picks force Bit 15 on (Force 1) or off (Force 0)', () => {
    const p = palette();
    api.editReset(0x76);
    const f1 = api.editSpecialAppliedIndex(p, 0, 'interact-force-1', false);
    assert.strictEqual(api.editStampWords(p, f1).collision & 0x8000, 0x8000, 'Bit 15 set');
    assert.strictEqual(api.editStampWords(p, f1).collision, 0x901f, '0x101f | 0x8000 = 0x901f');

    const f0 = api.editSpecialAppliedIndex(p, f1, 'interact-force-0', false);
    assert.strictEqual(api.editStampWords(p, f0).collision & 0x8000, 0, 'Bit 15 cleared');
    assert.strictEqual(api.editStampWords(p, f0).collision, 0x101f);
});

test('editCellInteractState reports forced 1, forced 0, natural 1, and 0', () => {
    const p = palette();
    api.setPalette(p);
    api.editReset(0x76);
    assert.strictEqual(api.editCellInteractState(p, 0, 0), '0');

    api.editApply([], [{ x: 1, y: 1, id: 'interact-force-1' }]);
    assert.strictEqual(api.editCellInteractState(p, 1, 1), 'forced 1');

    api.editApply([], [{ x: 2, y: 2, id: 'interact-force-0' }]);
    assert.strictEqual(api.editCellInteractState(p, 2, 2), 'forced 0');

    const s1 = api.editAddStamp(p, { layer1: 0, layer2: 0, collision: 0x9019 });
    api.editApply([{ x: 3, y: 3, index: s1 }], []);
    assert.strictEqual(api.editCellInteractState(p, 3, 3), '1');
});

test('step-on picks force Bit 14 like Interact does Bit 15; the eraser takes it off', () => {
    const p = palette();
    api.setPalette(p);
    api.editReset(0x76);
    const f1 = api.editSpecialAppliedIndex(p, 0, 'stepon-force-1', false);
    assert.strictEqual(api.editStampWords(p, f1).collision, 0x501f, '0x101f | 0x4000');
    const f0 = api.editSpecialAppliedIndex(p, f1, 'stepon-force-0', false);
    assert.strictEqual(api.editStampWords(p, f0).collision, 0x101f, 'Bit 14 cleared');
    const erased = api.editSpecialAppliedIndex(p, f1, null, true);
    assert.strictEqual(api.editStampWords(p, erased).collision & 0x4000, 0, 'the eraser clears it with the other specials');
    assert.ok(api.groups.some((g) => g.id === 'stepon'), 'a Step-on group on the Special tab');

    api.editApply([], [{ x: 1, y: 1, id: 'stepon-force-1' }]);
    assert.strictEqual(api.editCellStepOnState(p, 1, 1), 'forced 1');
    const s14 = api.editAddStamp(p, { layer1: 0, layer2: 0, collision: 0x4010 });
    api.editApply([{ x: 2, y: 0, index: s14 }], []);
    assert.strictEqual(api.editCellStepOnState(p, 2, 0), '1');
    assert.strictEqual(api.editCellStepOnState(p, 0, 0), '0');
    // With its overlay on, a bit-14 cell carries an S.
    const real = global.document;
    global.document = { querySelectorAll: () => [], getElementById: () => null };
    try {
        api.editStepOnToggle();
        assert.ok(api.editCellSymbols(p, 2, 0, []).includes('S'));
        api.editStepOnToggle();
        assert.ok(!api.editCellSymbols(p, 2, 0, []).includes('S'), 'off: no S');
    } finally {
        global.document = real;
    }
});

test('a step-on box with no Bit 14 cell under it is reported: it can never fire', () => {
    const p = palette();
    p.attachments = { bTrigger: [], objects: [], stepOn: [[0, 0, 0, 0, 9], [2, 0, 2, 0, 12]] };
    api.setPalette(p);
    api.editReset(0x76);
    const s14 = api.editAddStamp(p, { layer1: 0, layer2: 0, collision: 0x4010 });
    api.editApply([{ x: 2, y: 0, index: s14 }], []);
    const dead = api.editDeadStepTriggers(p);
    assert.strictEqual(dead.length, 1, 'the box over the bit-14 cell is fine');
    assert.strictEqual(dead[0].x1, 0);
});

test('multiple special flags can be added to a tile and render in grid', () => {
    const p = palette();
    api.setPalette(p);
    const d = api.editReset(0x76);

    // 1. Paint vertical stairs
    api.editApply([], [{ x: 2, y: 2, id: 'stairs-vert' }]);
    assert.deepStrictEqual(api.editSpecialsAt(2, 2), ['stairs-vert']);
    assert.deepStrictEqual(api.editCellSymbols(p, 2, 2), ['⭥']);

    // 2. Also paint Force 1 (F1): both stairs and F1 are kept, NO duplicate 1!
    api.editApply([], [{ x: 2, y: 2, id: 'interact-force-1' }]);
    assert.deepStrictEqual(api.editSpecialsAt(2, 2), ['stairs-vert', 'interact-force-1']);
    const syms2 = api.editCellSymbols(p, 2, 2);
    assert.deepStrictEqual(syms2, ['⭥', 'F1'], 'vertical stairs + F1 gives [⭥, F1], not F1+1');

    // 3. Grid of 4 (2x2 layout): SVG contains both glyphs and dashed box
    const svg2 = api.editSpecialGlyphSvg(['stairs-vert', 'interact-force-1'], 4, 4);
    assert.ok(svg2.includes('>⭥<'));
    assert.ok(svg2.includes('>F1<'));
    assert.ok(svg2.includes('rg-special-cell-box'));

    // 4. Paint Gate (Boy): adds B into 3rd slot of 4-grid
    api.editApply([], [{ x: 2, y: 2, id: 'gate-boy' }]);
    assert.deepStrictEqual(api.editSpecialsAt(2, 2), ['stairs-vert', 'interact-force-1', 'gate-boy']);
    assert.deepStrictEqual(api.editCellSymbols(p, 2, 2), ['⭥', 'F1', 'B']);

    // 5. Paint drift-n: replaces stairs-vert (same group stairs) but preserves F1 and B
    api.editApply([], [{ x: 2, y: 2, id: 'drift-n' }]);
    assert.deepStrictEqual(api.editSpecialsAt(2, 2), ['interact-force-1', 'gate-boy', 'drift-n']);
    assert.deepStrictEqual(api.editCellSymbols(p, 2, 2), ['F1', 'B', '↑']);

    // 6. Active B-trigger covering the tile adds 1 as 4th symbol
    d.placed.push({ kind: 'bTrigger', uid: 99, x: 2, y: 2, w: 1, h: 1 });
    assert.deepStrictEqual(api.editCellSymbols(p, 2, 2), ['F1', 'B', '↑', '1']);

    // 7. 5 to 9 symbols render as 3x3 grid (up to 9 items)
    api.editApply([], [{ x: 2, y: 2, id: 'entrance-n' }]);
    const syms5 = api.editCellSymbols(p, 2, 2);
    assert.deepStrictEqual(syms5, ['F1', 'B', '↑', '▲', '1']);
    const svg5 = api.editSpecialGlyphSvg(api.editDraft().specialCells['2,2'], 4, 4);
    assert.ok(svg5.includes('>▲<'));

    // 8. Explicit Force 0 suppresses the B-trigger's '1' and displays 'F0'
    api.editApply([], [{ x: 2, y: 2, id: 'interact-force-0' }]);
    const symsF0 = api.editCellSymbols(p, 2, 2);
    assert.ok(symsF0.includes('F0'), 'includes F0');
    assert.ok(!symsF0.includes('1'), 'suppresses 1');
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
/** Only the named top-level functions of a webview file — utils.js whole would replace the stubs above. */
function helpersFrom(file, names) {
    const src = read(file);
    return names.map((n) => {
        const a = src.indexOf('function ' + n + '(');
        if (a < 0) throw new Error(n + ' not in ' + file);
        const b = src.indexOf('\n}\n', a);
        return src.slice(a, b + 2);
    }).join('\n');
}

const ui = new Function(`
  var document = {
    getElementById: function () { return null; },
    querySelector: function () { return null; },
    querySelectorAll: function () { return []; }
  };
  function escH(s) { return String(s); }
  function renderRoomDetail() {}
  function romLayerButtonHtml() { return ''; }
  function romAllOverlaysButtonHtml() { return ''; }
  function romOverlayButtonHtml() { return ''; }
  function romAnimateButtonHtml() { return ''; }
  function romExportButtonHtml() { return ''; }
  ${read('metatile-palette.js')}
  ${read('map-editor.js')}
  ${read('map-editor-history.js')}
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
  ${read('map-editor-tile-filters.js')}
  ${read('map-editor-collision.js')}
  ${read('map-editor-collision-tab.js')}
  ${read('map-editor-neighbours.js') /* the plus-shaped LIKELY NEIGHBORS card, §8b */}
  ${read('map-editor-special.js')}
  ${read('map-editor-flag-overlays.js')}
  ${read('map-editor-trigger-select.js')}
  ${read('map-editor-trigger-panel.js')}
  ${read('map-editor-toolbar.js') /* the floating tool pill, split out of map-editor-ui.js in Phase 7a */}
  ${read('map-editor-filterbar.js') /* the docked filter bar + status bar, likewise Phase 7a */}
  ${read('map-editor-trigger-scripts.js') /* the scripts in the Trigger tab's rows */}
  ${helpersFrom('utils.js', ['lootLabel', 'exitLabel', 'hexNum', 'normScriptAddr'])}
  ${read('map-editor-tabs.js')}
  ${read('map-editor-panels.js')}
  ${read('map-editor-gestures.js')}
  ${read('map-editor-input.js')}
  ${read('map-editor-actions.js')}
  ${read('map-editor-newroom.js')}
  ${read('map-editor-start.js') /* the Boy's start on a drafted map */}
  ${read('map-editor-custom.js') /* custom maps: their rail rows and drafts */}
  ${read('map-editor-drawable.js') /* what the pencil draws: the open tab's pick */}
  ${read('map-editor-levels.js')}
  ${read('map-editor-groups.js')}
  ${read('map-editor-custom-store.js')}
  ${read('map-editor-clipboard.js')}
  ${read('map-editor-pick.js')}
  ${read('map-editor-animations.js')}
  ${read('map-editor-anim-tab.js')}
  ${read('map-editor-anim-sets.js')}
  ${read('map-editor-anim-map.js')}
  ${read('map-editor-anim-placed.js')}
  ${read('map-editor-objects.js')}
  ${read('map-editor-object-list.js')}
  ${read('map-editor-object-holds.js')}
  ${read('map-editor-family-sets.js')}
  ${read('map-editor-placed-list.js')}
  ${read('map-editor-widgets.js')}
  ${read('map-editor-widget-colours.js')}
  ${read('map-editor-widget-edit.js')}
  ${read('map-editor-preview.js')}
  ${read('map-editor-special-select.js')}
  ${read('map-editor-romroom.js') /* a vanilla room in the editor (map-editor-rules §7) */}
  ${read('map-editor-cutlayer.js') /* the cuttable layer, and a ROM room's grass */}
  ${read('map-editor-info.js') /* the Info tab */}
  return {
    editOnTilePicked: editOnTilePicked,
    editAction: editAction, editReset: editReset, editDraft: editDraft,
    editFamilies: editFamilies,
    editAdoptFamilyFor: editAdoptFamilyFor,
    editResolve: editResolve, editBlankCanopy: editBlankCanopy,
    editSaveConstruct: editSaveConstruct, editConstructWrites: editConstructWrites,
    editNeededStamps: editNeededStamps, editErrors: editErrors,
    toolbar: buildEditToolbarHtml, headActs: editHeadActsHtml, tileGroup: tileGroupHtml,
    setSheet: function (f, sheet) { _famSheets[f] = sheet; },
    setCatalogue: function (c) { _famCatalogue = c; },
    sheetHeight: tileSheetHeight,
    setRelated: function (map) { _related = map; },
    strandedCells: editStrandedCells,
    setSel2: function (s) { _editSel = s; },
    compose: function () { return _editCompose; },
    setPalette: function (p) { _mtPalette = p; },
    setSelected: function (i) { _mtSelected = i; },
    specialTab: specialTabHtml, specialFilterChip: buildSpecialFilterChipHtml,
    editStroke: editStroke, editSpecialAt: editSpecialAt, editStampWords: editStampWords,
    setTab: function (t) { _editActiveTab = t; },
    editBegin: editBegin, editEnd: editEnd, editUndo: editUndo, editRedo: editRedo, editApply: editApply,
    editStampGroup: editStampGroup, editGroupMove: editGroupMove, editGroupDelete: editGroupDelete,
    editGroupAt: editGroupAt, editCellAt: editCellAt, editBakedCells: editBakedCells,
    editObjectFrameIndex: editObjectFrameIndex, editGroupsUpgrade: editGroupsUpgrade, editGroupDisband: editGroupDisband,
    placedReorder: placedReorder, widgetsTab: widgetsTabHtml, setWidgetsView: function (v) { _widgetsView = v; },
    triggerDeleteSelected: triggerDeleteSelected, editRemoveObject: editRemoveObject, editPruneAdded: editPruneAdded, editLevelPick: editLevelPick,
    customIsPristine: customIsPristine, setCustom: function (list, active) { _customMaps = list; _customActive = active; },
    editClipboardKey: editClipboardKey, editAddStamp: editAddStamp, editSmartPick: editSmartPick, startSelectGesture: startSelectGesture,
    setSel: function (s) { _editSel = s; }, setHover: function (c) { _editHover = c; },
    groupSel: function () { return _groupSel; }, startSel: function () { return _startSel; },
    tab: function () { return _editActiveTab; }, brushTile: function () { return _brushTile; },
    triggerKind: function () { return _editTriggerKind; },
    specialSel: function () { return _specialSel; }, triggerTab: triggerTabPanelHtml,
    setTriggerKind: function (k) { _editTriggerKind = k; },
    pasteFloat: function () { return _pasteFloat; }, dropPaste: function () { _pasteFloat = null; },
    tileSlotPasses: tileSlotPasses, tileFilterToggle: tileFilterToggle, tileAnimPlay: tileAnimPlay, tileFramesPick: tileFramesPick, tileShapePick: function (v) { _tileShape = v === 'all' ? null : v; },
    editStampedConstruct: editStampedConstruct, widgetPlacedIn: widgetPlacedIn, editObjectFrames: editObjectFrames,
    customDuplicateMap: customDuplicateMap, customMaps: function () { return _customMaps; }, setPanelRoom: function (r) { _editPanelRoom = r; },
    groupBoxSvg: groupBoxSvg, editObjectSvg: editObjectSvg, editDeselectAll: editDeselectAll,
    setGroupSel: function (g) { _groupSel = g; },
    widgetHasSelection: widgetHasSelection, widgetSaveFromSelection: widgetSaveFromSelection,
    editBuildConstruct: editBuildConstruct, moreFilterGroupHtml: moreFilterGroupHtml,
    getEditSel: function () { return _editSel; }, customCopyMapReady: customCopyMapReady,
    setLayerForce: function (f) { _layerForce = f; },
    objectSelect: objectSelect, objectSelectFrame: objectSelectFrame,
    objectHolds: objectHolds, objectSetHold: objectSetHold, objectAddFrame: objectAddFrame, objectRemoveFrame: objectRemoveFrame,
    objectMoveFrame: objectMoveFrame, objectStatesHtml: objectStatesHtml, objectRunTicks: objectRunTicks, objectPlay: objectPlay,
    objectPlaying: function () { return _objectPlay; },
    setInfoSub: function (v) { _editInfoSub = v; }, editInfoSubtabsHtml: editInfoSubtabsHtml,
    familySetsHtml: familySetsHtml, familySetPick: familySetPick, familySetStart: familySetStart, infoRenderHeader: infoRenderHeader,
    editPreviewFamilies: editPreviewFamilies,
    mtPaletteFits: mtPaletteFits, editSeedRoomObjects: editSeedRoomObjects, editObjects: editObjects,
    editWordSpecialIds: editWordSpecialIds, editOnRomRoom: editOnRomRoom, editTriggerSvg: editTriggerSvg,
    editRoomSpecialsSvg: editRoomSpecialsSvg, editExport: editExport, infoTabHtml: infoTabHtml, infoMeasure: infoMeasure,
    editHeaderSet: editHeaderSet, infoHeaderBit: infoHeaderBit, infoHeader: infoHeader,
    setPanelRoom: function (r) { _editPanelRoom = r; }, triggerToggle: triggerToggle, triggerEnterPick: triggerEnterPick,
    triggerScriptWhat: triggerScriptWhat, scriptHighlight: scriptHighlight, lootFilterToggle: lootFilterToggle,
    editPreviewSvg: editPreviewSvg, setPreviewCell: function (c) { _previewCell = c; },
    editRoomCutBeneathSvg: editRoomCutBeneathSvg, setCutLayer: function (v) { _editCutLayer = v; },
    editGridPatchSvg: editGridPatchSvg, editSpecialAppliedIndex: editSpecialAppliedIndex,
    editCollisionOverlaySvg: editCollisionOverlaySvg, collMaskPath: collMaskPath,
    editCollisionStrokeTest: editCollisionStroke, collPick: collPick, collClick: collClick, collCodeOfQuarters: collCodeOfQuarters,
    collBadgeSvg: collBadgeSvg, editDrawable: editDrawable, collisionTabHtml: collisionTabHtml, editCollisionAt: editCollisionAt,
    editCollisionApplied: editCollisionApplied, editClipboardKeyTest: function (k) { return editClipboardKey({ key: k }, true); },
    chipDrop: chipDrop, editResizeStep: editResizeStep, resizeKeep: function () { var k = _resizeKeep; _resizeKeep = false; return k; },
    customRename: customRename, editPutDown: editPutDown, construct: function () { return _editConstruct; },
    clampRoomSide: clampRoomSide, widgetEditHeadHtml: widgetEditHeadHtml,
    setWidgetEdit: function (w) { _widgetEdit = w; },
    widgetNormalize: widgetNormalize, widgetAnimated: widgetAnimated,
    widgetConstruct: widgetConstruct, widgetArm: widgetArm,
    setWidgets: function (ws) { _widgets = ws; },
    editAnims: editAnims, editAnimChannels: editAnimChannels, editAnimsListed: editAnimsListed,
    editAdoptAnimated: editAdoptAnimated, editAdoptGraphic: editAdoptGraphic, editAnimOfSlot: editAnimOfSlot,
    editSeedRoomAnims: editSeedRoomAnims, animTabHtml: animTabHtml, animClick: animClick, editAnimShownFrame: editAnimShownFrame,
    editAnimPresets: editAnimPresets, editAnimLetter: editAnimLetter, editAnimComplete: editAnimComplete, animTile: animTile,
    setAnimOff: function (v) { _animOff = v; },
    editAnimTileStroke: editAnimTileStroke, editAnimRuns: editAnimRuns, editAnimSetRunTicks: editAnimSetRunTicks,
    animInputHandler: animInputHandler, animClipboardKey: animClipboardKey, setHover: function (c) { _editHover = c; }, editAnimSvg: editAnimSvg, setAnimMarks: function (v) { _animMarks = v; },
    editAnimGesture: editAnimGesture, editWordAnimSpec: editWordAnimSpec, editPartFromWord: editPartFromWord,
    editWordFromPart: editWordFromPart, placedTimingHtml: placedTimingHtml, placedSetTiming: placedSetTiming,
    editUseFamilyTile: editUseFamilyTile, setFramesSplit: function (v) { _tileFramesSplit = v; },
    setAnimSel: function (u, f) { _animSel = u; _animFrame = f || 0; }, animSel: function () { return _animSel; },
    objectLooksStatic: objectLooksStatic, objectIsOpen: objectIsOpen, setObjectOpen: function (k, v) { _objectOpen[k] = v; }, objectReorder: objectReorder, objectTabHtml: objectTabHtml,
    neighbourCardHtml: neighbourCardHtml, setNbMode: setNbMode, getNbMode: getNbMode,
    applyNeighbourTiles: applyNeighbourTiles,
    applyVanillaExamples: applyVanillaExamples, applyProceduralFill: applyProceduralFill,
    widgetCardHtml: widgetCardHtml, placedRowHtml: placedRowHtml, placedListHtml: placedListHtml, placedSetVariation: placedSetVariation,
    widgetAttestedFamilies: widgetAttestedFamilies, widgetEnsureVariations: widgetEnsureVariations, applyWidgets: applyWidgets,
    setBrushTile: function (bt) { _brushTile = bt; },
    setPanelOpen: function (k, v) { _panelOpen[k] = v; },
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

test('a picked graphic fills the armed layer source', () => {
    const p = tilePalette();
    ui.setPalette(p);
    ui.editReset(0x34).on = true;
    ui.compose().layer1 = null; ui.compose().layer2 = null; ui.compose().collision = null;

    ui.compose().pick = 'layer2';
    ui.compose().armed = true;
    assert.strictEqual(ui.editOnTilePicked(0x0c02), true);   // slot 1's word in family 3
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

test('the Info tab bars only real ceilings, and counts the draft\'s own families', () => {
    const p = tilePalette();
    p.budget = {
        graphics: { used: 92, max: 264, vanilla: 255 },
        families: { used: 7, max: 7, vanilla: 7 },
        stamps: { used: 175, max: null, vanilla: 2131 },
        wram: { used: 2048, max: 32768, vanilla: 32680 },
        attested: 157,
    };
    ui.setPalette(p);
    const d = ui.editReset(0x34);
    d.families = [35, 187, 58, 165, 149, 59];       // six, like room 0x33
    ui.setInfoSub('budget');
    const html = ui.infoTabHtml(p);
    assert.ok(html.includes('6/7 · 86%'), 'families are the draft\'s, as on the Tile tab');
    assert.ok(html.includes('92/264'));
    assert.strictEqual((html.match(/rg-cap-fill( full| over)?"/g) || []).length, 3, 'ceiling bars for families, graphics and WRAM only');
    assert.ok(!/\/128|\/16\b/.test(html), 'no placeholder ceilings from the mock');
    ui.setInfoSub('map');
    const map = ui.infoTabHtml(p);
    assert.ok(map.includes('Nothing blocking'), 'an empty check list says so, on the Map sub-tab');
    assert.ok(!map.includes('no brush selected'), 'the brush hint is not a check');
    ui.setInfoSub('header');
});

test('the Info tab measures the map: walkable, solid, canopy, levels', () => {
    const p = palette();                       // stamps: 0,1 blank canopy solid ($101F), 2 front art open ($0010)
    ui.setPalette(p);
    const d = ui.editReset(0x34);
    const f = ui.infoMeasure(p);
    assert.strictEqual(f.cells, 6);
    assert.strictEqual(f.solid, 5, 'geometry F');
    assert.strictEqual(f.open, 1, 'geometry 0');
    assert.strictEqual(f.canopy, 1, 'one cell has front art');
    assert.deepStrictEqual(f.levels, [0, 6, 0, 0], 'all on level 1');
    ui.setInfoSub('map');
    const html = ui.infoTabHtml(p);
    ui.setInfoSub('header');
    assert.ok(html.includes('rg-cap-fill measured'), 'measured shares are bars in their own colour');
    assert.ok(html.includes('5/6 · 83%'), 'solid: five of six drawn cells');
    d.on = true;
});

test('palette sets: a room with more than seven families previews another set, and writes nothing', () => {
    const fams = [10, 11, 12, 13, 14, 15, 16, 20, 21, 22, 23, 24, 25, 26];
    const colors = fams.map((f) => ['#' + String(f).padStart(6, '0')]);
    const p = Object.assign(palette(), { roomId: 0x18, tileFamilies: fams, familySets: { colors, scriptValues: [7] } });
    ui.setPalette(p);
    const d = ui.editReset(0x18);
    d.families = fams.slice(0, 7);
    const html = ui.familySetsHtml(p);
    assert.match(html, /data-family-set="0"[^]*loads with[^]*data-family-set="7"[^]*a script here sets it/, 'the set it loads with, then the script\'s');
    assert.ok(/other values:[^]*data-family-set="1"/.test(html), 'the rest offered as plain values');
    ui.familySetPick(7);
    assert.strictEqual(ui.familySetStart(0x18), 7);
    assert.deepStrictEqual(ui.infoRenderHeader(0x18), { mapPalette: 7 }, 'the host renders it through the overrides');
    assert.deepStrictEqual(ui.editPreviewFamilies(), [20, 21, 22, 23, 24, 25, 26]);
    assert.strictEqual(d.header, null, 'a view: no header written');
    assert.strictEqual(d.undo.length, 0, 'and nothing on the history');
    assert.strictEqual(ui.familySetStart(0x34), 0, 'only for its own room');
    ui.familySetPick(0);
    assert.strictEqual(ui.infoRenderHeader(0x18), null);

    // A short set (8 entries, MAP_PALETTE 4) reaches slots 1..4; 5..7 keep the colours the room loaded with.
    const short = Object.assign(palette(), { roomId: 0x5e, tileFamilies: [1, 2, 3, 4, 5, 6, 7, 8],
        familySets: { colors: [1, 2, 3, 4, 5, 6, 7, 8].map(() => ['#000']), scriptValues: [4] } });
    ui.setPalette(short);
    const d2 = ui.editReset(0x5e);
    d2.families = [1, 2, 3, 4, 5, 6, 7];
    ui.familySetPick(4);
    assert.deepStrictEqual(ui.editPreviewFamilies(), [5, 6, 7, 8, 5, 6, 7]);
    assert.strictEqual((ui.familySetsHtml(short).match(/rg-fset-strip kept/g) || []).length, 3, 'the set at 4 leaves three slots kept, drawn dim');
    ui.familySetPick(0);

    // Seven or fewer: one set, said so.
    const one = Object.assign(palette(), { roomId: 0x34, tileFamilies: [1, 2, 3], familySets: null });
    assert.match(ui.familySetsHtml(one), /One set/);
});

test('header fields are editable when unlocked, one undo step each, and ride the exports', () => {
    const p = Object.assign(palette(), { header: { originX: 3, originY: 6, widthTiles: 3, heightTiles: 2,
        displayTm: 0x17, subscreenTs: 0x11, colorMath: 2, colorWindow: 2, effectVariant: 0, param: 0 } });
    ui.setPalette(p);
    const d = ui.editReset(0x34);
    d.on = true;
    d.locked = true;
    ui.infoHeaderBit('displayTm:0');
    assert.strictEqual(d.header, null, 'locked: nothing changes');
    d.locked = false;
    ui.infoHeaderBit('displayTm:0');           // BG1 off: no foreground
    assert.deepStrictEqual(d.header, { displayTm: 0x16 });
    assert.strictEqual(d.undo.length, 1, 'one undo step');
    ui.editHeaderSet('param', 0x1234);
    assert.strictEqual(ui.infoHeader(p).param, 0x1234);
    assert.strictEqual(ui.editExport(p).header.param, 0x1234, 'the vanilla handoff carries it');
    ui.editUndo(p);
    assert.deepStrictEqual(d.header, { displayTm: 0x16 }, 'undo takes the last change back');
    ui.infoHeaderBit('displayTm:0');           // back to the room's own value
    assert.strictEqual(d.header, null, 'the room\'s own value is no override');
    const html = ui.infoTabHtml(p);
    assert.ok(html.includes('$212C'), 'the register is named');
    assert.ok(html.includes('rg-info-header') && !html.includes('Capacity'), 'the Header sub-tab is the header alone');
    const tabWas = ui.tab();
    ui.setTab('info');
    assert.match(ui.editInfoSubtabsHtml(), /data-edit-info-sub="header"[\s\S]*data-edit-info-sub="budget"[\s\S]*data-edit-info-sub="map"/);
    ui.setTab(tabWas);
    // Name and value on one line, the controls on their own line beneath.
    assert.match(html, /rg-hdr-top"><span class="rg-cap-l">Main screen<\/span><span class="rg-hdr-v">Front · Ground · HUD · Sprites<\/span><\/div><div class="rg-hdr-ctl">[^]*?data-header-bit/,
        'unlocked: the value in words, the controls beneath');
    d.locked = true;
    const locked = ui.infoTabHtml(p);
    assert.ok(!locked.includes('data-header-bit'), 'locked: no controls');
    assert.ok(locked.includes('>Front · Ground · HUD · Sprites<'), 'TM $17 in words');
    assert.ok(locked.includes('>Add on Ground<'), 'CGADSUB $02 in words');
    assert.ok(locked.includes('>sub screen, everywhere<'), 'CGWSEL $02 in words');
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

    // Erasing bare floor makes no new stamp. Since v0.69.2 it asks for the
    // draft's own write at the cell to be taken back (EDIT_ERASE_CELL, -2);
    // the stroke only does that where the draft painted, so the room's own
    // floor here is left as it is.
    assert.strictEqual(ui.editResolve(p, 0, 1, -1, true), -2);
    assert.strictEqual(d.added.length, 0);

    // §8a.2: erase no longer depends on a mode being set first. It used to be
    // a flat no-op outside `deco` phase no matter what was under the cursor,
    // so removing a decoration meant remembering to flip a toggle. Now the
    // only thing that stops it is there being nothing there — a cell off the
    // grid has no stamp to take a canopy off.
    assert.strictEqual(ui.editResolve(p, 9, 9, -1, true), -1);
    assert.strictEqual(d.added.length, 0);
});

test('the Tile tab\'s front/ground picks what the eraser takes; auto takes the top-most', () => {
    const p = palette();
    ui.setPalette(p);
    const d = ui.editReset(0x34);
    d.on = true;
    const words = (i) => { const w = ui.editStampWords(p, i); return [w.layer1, w.layer2]; };
    // Cell (1,1) is stamp 2: front art $358A over ground $19CC. (0,0) is bare ground.
    ui.setLayerForce('canopy');
    assert.deepStrictEqual(words(ui.editResolve(p, 1, 1, -1, true)), [0xa800, 0x19cc], 'front: the art goes, the ground stays');
    assert.strictEqual(ui.editResolve(p, 0, 0, -1, true), 0, 'front on bare ground: nothing to take');
    ui.setLayerForce('terrain');
    assert.deepStrictEqual(words(ui.editResolve(p, 1, 1, -1, true)), [0x358a, 0xa800], 'ground: the art stays, the ground goes');
    assert.strictEqual(ui.editResolve(p, 0, 0, -1, true), -2, 'ground under no front art: the whole cell');
    ui.setLayerForce(null);
    assert.deepStrictEqual(words(ui.editResolve(p, 1, 1, -1, true)), [0xa800, 0x19cc], 'auto: the front art first');
    assert.strictEqual(ui.editResolve(p, 0, 0, -1, true), -2, 'auto on bare ground: the painted tile');
    // A stroke with nothing on the chosen layer writes nothing.
    d.tool = 'erase';
    ui.setLayerForce('canopy');
    ui.editStroke({ x: 0, y: 0 }, 'down');
    assert.strictEqual(d.cells['0,0'], undefined, 'no write, so the draft is not dirtied');
    ui.editStroke({ x: 1, y: 1 }, 'down');
    assert.deepStrictEqual(words(d.cells['1,1']), [0xa800, 0x19cc], 'the front art is erased');
    ui.setLayerForce(null);
    d.tool = 'paint';
});

test('one click erases one layer: down, move and up do not erase the same cell twice', () => {
    const p = palette();
    ui.setPalette(p);
    const d = ui.editReset(0x34);
    d.on = true;
    d.tool = 'erase';
    ui.setLayerForce(null);
    // (1,1) is front art over ground. The stroke runs on down and on up; the
    // second pass used to take the rest and put the vanilla cell back.
    ui.editStroke({ x: 1, y: 1 }, 'down');
    ui.editStroke({ x: 1, y: 1 }, 'move');
    ui.editStroke({ x: 1, y: 1 }, 'up');
    const w = ui.editStampWords(p, d.cells['1,1']);
    assert.deepStrictEqual([w.layer1, w.layer2], [0xa800, 0x19cc], 'the front art is gone, the ground stays');
    ui.editStroke({ x: 1, y: 1 }, 'down');
    assert.strictEqual(d.cells['1,1'], undefined, 'the next click takes the painted tile itself');
    d.tool = 'paint';
});

test('a locked map changes nothing: strokes are refused, picking still works', () => {
    const p = palette();
    ui.setPalette(p);
    const d = ui.editReset(0x34);
    d.on = true;
    d.locked = true;
    d.tool = 'erase';
    ui.editStroke({ x: 1, y: 1 }, 'down');
    d.tool = 'paint'; d.brush = 2;
    ui.editStroke({ x: 0, y: 0 }, 'down');
    assert.deepStrictEqual(d.cells, {}, 'neither erase nor paint wrote');
    assert.strictEqual(d.undo.length, 0);
    d.tool = 'pick'; d.brush = -1;
    ui.editStroke({ x: 1, y: 1 }, 'down');
    assert.notStrictEqual(d.brush, -1, 'the eyedropper still picks');
    d.locked = false; d.tool = 'paint';
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
    const html = ui.tileGroup(58);
    const uses = html.split('data:image/png').length - 1;
    assert.strictEqual(uses, 1, `the sheet URL appears ${uses} times, not once`);
    assert.strictEqual(html.split('data-fam-tile=').length - 1, 3, 'all three tiles are offered');
});

/**
 * Relationship beats popularity, and that is the point: 4200 has ten times
 * the placements of 4191 and no relationship to anything in the map, so it
 * goes last.
 */
test('a group is ordered by placements, and relationship never reorders it', () => {
    ui.editReset(0x34);
    ui.setPalette(tilePalette());
    ui.setSheet(58, {
        family: 58, count: 3, total: 74, roomCount: 3, columns: 16, cell: 16,
        slots: [[0, 0, 4191, 10, 0, 0], [1, 2, 4195, 5, 0, 0], [2, 4, 4200, 99, 0, 0]],
        imageUri: 'data:image/png;base64,ZmFt',
    });
    // "the order of the tile list still changes once you use one. it should
    // not" — the % badge says how related a tile is; its place does not move.
    ui.setRelated({ 4191: 92, 4195: 3 });
    const order = [...ui.tileGroup(58).matchAll(/data-fam-tile="(\d+)"/g)].map((m) => m[1]);
    assert.deepStrictEqual(order, ['4200', '4191', '4195']);
    ui.setRelated({});
    const cold = [...ui.tileGroup(58).matchAll(/data-fam-tile="(\d+)"/g)].map((m) => m[1]);
    assert.deepStrictEqual(cold, order);
});

/**
 * Every family is listed, and a group whose sheet has not arrived is drawn at
 * the height it will have — so lazy loading never moves the list (§8e).
 */
test('a group not loaded yet is a placeholder at its final height, fetched when seen', () => {
    ui.editReset(0x34);
    ui.setPalette(tilePalette());
    ui.setCatalogue([{ id: 77, tiles: 20, rooms: 1, areas: ['Gothica'], names: [] }]);
    const html = ui.tileGroup(77, 370);
    assert.ok(/data-lazy-fam="77"/.test(html), 'it waits to be seen: ' + html);
    assert.ok(/rg-group-count">20</.test(html), 'and already says how much art it has');
    // 370px wide: (370 - 10 + 4) / 36 = 10 per row, so 20 tiles are two rows.
    assert.strictEqual(ui.sheetHeight(20, 370), 2 * 32 + 4 + 10);
    assert.ok(html.includes('height:' + ui.sheetHeight(20, 370) + 'px'));
    assert.strictEqual(html.split('<div').length, html.split('</div>').length, 'every div is closed');
    ui.setCatalogue(null);
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

    // v0.94.0: the ⋯ menu moved to the room's name line (editHeadActsHtml).
    assert.ok(ui.headActs().includes('data-edit-act="export"'), 'and the draft can be handed over');
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

// The pencil draws the open tab's pick and only that (map-editor-drawable.js):
// a stairs special armed on the Special tab used to ride along with every
// tile stroke on the Tile tab.
test('on the Tile tab the pencil paints the tile only, even with a special armed', () => {
    const p = tilePalette();
    ui.setPalette(p);
    const d = ui.editReset(0x34);
    d.on = true;
    d.tool = 'paint';
    d.brush = 1;
    d.currentSpecialId = 'stairs-diag-r';
    ui.setTab('tile');
    ui.editStroke({ x: 0, y: 0 }, 'down');
    assert.strictEqual(d.cells['0,0'], 1, 'the tile, exactly');
    assert.strictEqual(ui.editSpecialAt(0, 0), null, 'and no special came with it');
    assert.strictEqual(d.undo.length, 1, 'one click, one undo step');
});

test('on the Special tab the pencil puts down the special only, keeping the cell’s tile', () => {
    const p = tilePalette();
    ui.setPalette(p);
    const d = ui.editReset(0x34);
    d.on = true;
    d.tool = 'paint';
    d.brush = 1;
    d.currentSpecialId = 'gate-dog';
    ui.setTab('special');
    ui.editStroke({ x: 0, y: 0 }, 'down');
    const w = ui.editStampWords(p, d.cells['0,0']);
    assert.strictEqual(w.layer2, 0x19ce, 'the room’s own ground, not the armed tile’s');
    assert.strictEqual((w.collision >> 8) & 0xf, 0x5, 'with the gate bits');
    assert.strictEqual(ui.editSpecialAt(0, 0), 'gate-dog');
    assert.strictEqual(d.undo.length, 1, 'still one click, one undo step');
    ui.setTab('tile');
});

test('diagonal stairs write the stairs flag: always-walkable + the shear nibble', () => {
    const p = tilePalette();
    ui.setPalette(p);
    const d = ui.editReset(0x34);
    d.on = true;
    d.tool = 'paint';
    d.currentSpecialId = 'stairs-diag-l';
    ui.setTab('special');
    ui.editStroke({ x: 2, y: 0 }, 'down');
    assert.strictEqual(ui.editStampWords(p, d.cells['2,0']).collision & 0x200f, 0x2002);
    ui.setTab('tile');
});

test('a glyph-only special stamps the glyph and leaves the grid alone', () => {
    const p = tilePalette();
    ui.setPalette(p);
    const d = ui.editReset(0x34);
    d.on = true;
    d.tool = 'paint';
    d.brush = -1;
    d.currentSpecialId = 'entrance-n';
    ui.setTab('special');
    ui.editStroke({ x: 1, y: 0 }, 'down');
    assert.strictEqual(ui.editSpecialAt(1, 0), 'entrance-n');
    assert.ok(!('1,0' in d.cells), 'the grid falls through to the room’s own tile');
    ui.setTab('tile');
});

test('on the Trigger tab the pencil drags out a B-trigger by default, one undo step', () => {
    const p = tilePalette();
    p.attachments = { bTrigger: [], stepOn: [], objects: [] };
    ui.setPalette(p);
    const d = ui.editReset(0x34);
    d.on = true;
    d.tool = 'paint';
    d.brush = 0;
    ui.setTab('trigger');
    ui.editStroke({ x: 0, y: 0 }, 'down');
    ui.editStroke({ x: 2, y: 1 }, 'move');
    ui.editStroke({ x: 2, y: 1 }, 'up');
    assert.deepStrictEqual(d.cells, {}, 'no tile was painted');
    assert.strictEqual(d.placed.length, 1);
    const t = d.placed[0];
    assert.deepStrictEqual([t.kind, t.x, t.y, t.w, t.h], ['bTrigger', 0, 0, 3, 2]);
    assert.strictEqual(d.selectedTriggerRef.kind, 'b', 'and it is selected');
    assert.strictEqual(d.undo.length, 1);
    // The eraser on the same tab takes it off again.
    d.tool = 'erase';
    ui.editStroke({ x: 1, y: 1 }, 'down');
    assert.ok(d.placed[0].removed, 'erased');
    ui.setTab('tile');
});

test('erasing takes the glyph and its collision bits off in one click', () => {
    const p = tilePalette();
    ui.setPalette(p);
    const d = ui.editReset(0x34);
    d.on = true;
    d.brush = 0;
    d.currentSpecialId = 'gate-dog';
    ui.setTab('special');
    ui.editStroke({ x: 0, y: 0 }, 'down');
    const gatedIndex = d.cells['0,0'];

    d.tool = 'erase';
    d.phase = 'deco';
    ui.editStroke({ x: 0, y: 0 }, 'down');
    assert.strictEqual(ui.editSpecialAt(0, 0), null, 'the glyph is gone');
    assert.notStrictEqual(d.cells['0,0'], gatedIndex, 'the gate bits went with it');
    ui.setTab('tile');
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

// ---------------------------------------------------------------------------
// v0.71.0: one gesture is one step, levels, stamped objects as groups, and a
// history that is kept for good (docs/map-format/custom-map-files.md).
// ---------------------------------------------------------------------------

console.log('\nsteps, levels and groups:');

/** A fresh draft on the tile palette, pencil on the Tile tab. */
function fresh() {
    const p = tilePalette();
    p.attachments = { bTrigger: [], stepOn: [], objects: [] };
    ui.setPalette(p);
    const d = ui.editReset(0x34);
    d.on = true;
    d.tool = 'paint';
    ui.setTab('tile');
    return { p, d };
}

test('a pencil drag across three cells is one undo step, and undo takes all three back', () => {
    const { d } = fresh();
    d.brush = 2;
    ui.editBegin();
    ui.editStroke({ x: 0, y: 0 }, 'down');
    ui.editStroke({ x: 1, y: 0 }, 'move');
    ui.editStroke({ x: 2, y: 0 }, 'move');
    ui.editStroke({ x: 2, y: 0 }, 'up');
    ui.editEnd();
    assert.strictEqual(Object.keys(d.cells).length, 3);
    assert.strictEqual(d.undo.length, 1, 'one gesture, one step');
    ui.editUndo(ui.editDraft && tilePalette());
    assert.deepStrictEqual(d.cells, {}, 'all three undone together');
    ui.editRedo(tilePalette());
    assert.strictEqual(Object.keys(d.cells).length, 3, 'and redone together');
});

test('crossing the same cell twice in one drag still undoes to what it was before the drag', () => {
    const { d } = fresh();
    ui.editApply([{ x: 0, y: 0, index: 1 }]);
    ui.editBegin();
    ui.editApply([{ x: 0, y: 0, index: 2 }]);
    ui.editApply([{ x: 0, y: 0, index: 0 }]);
    ui.editEnd();
    ui.editUndo(tilePalette());
    assert.strictEqual(d.cells['0,0'], 1);
});

test('tiles land on the chosen level: collision bits 5..4, the rest of the word kept', () => {
    const { p, d } = fresh();
    d.brush = 2;                        // collision 0x0010: level 1
    ui.editStroke({ x: 0, y: 0 }, 'down');
    assert.strictEqual(ui.editStampWords(p, d.cells['0,0']).collision, 0x0010, 'level 1 is the default');
    ui.editLevelPick(3);
    ui.editStroke({ x: 1, y: 0 }, 'down');
    assert.strictEqual(ui.editStampWords(p, d.cells['1,0']).collision, 0x0030);
    ui.editLevelPick(0);
    ui.editStroke({ x: 2, y: 0 }, 'down');
    assert.strictEqual(ui.editStampWords(p, d.cells['2,0']).collision, 0x0000);
    assert.strictEqual(d.plane, 0, 'the level is the draft’s, so it is saved with the map');
});

const GOURD = {
    name: 'gourd', w: 2, h: 1,
    cells: [{ dx: 0, dy: 0, canopy: { word: 0x358a }, terrain: null, collision: 0x001f },
            { dx: 1, dy: 0, canopy: { word: 0x358b }, terrain: null, collision: 0x001f }],
    attachments: { bTrigger: [{ dx: 0, dy: 0, w: 2, h: 1, scriptId: 0x40 }], stepOn: [], objects: [] },
};

test('stamping an object makes one group, in one undo step, with its trigger', () => {
    const { p, d } = fresh();
    ui.editStampGroup(p, GOURD, 0, 1);
    assert.strictEqual(d.groups.length, 1);
    const g = d.groups[0];
    assert.deepStrictEqual([g.x, g.y, g.w, g.h], [0, 1, 2, 1]);
    assert.strictEqual(g.placed.length, 1, 'its B-trigger belongs to it');
    assert.strictEqual(d.undo.length, 1);
    assert.strictEqual(ui.editGroupAt(1, 1).uid, g.uid);
    ui.editUndo(p);
    assert.strictEqual(d.groups.length, 0, 'undo takes the group, its cells and its trigger');
    assert.deepStrictEqual(d.cells, {});
    assert.strictEqual(d.placed.filter((x) => !x.removed).length, 0);
});

test('a group moves whole: the map under it shows again, its trigger follows, one step', () => {
    const { p, d } = fresh();
    const words = (i) => ui.editStampWords(p, i);
    ui.editApply([{ x: 0, y: 1, index: 1 }]);      // something under the gourd
    ui.editStampGroup(p, GOURD, 0, 1);
    const uid = d.groups[0].uid;
    assert.deepStrictEqual(d.cells, { '0,1': 1 }, 'a group is not written into the map');
    assert.strictEqual(words(ui.editCellAt(p, 0, 1)).layer1, 0x358a, 'but the map shows it');
    const steps = d.undo.length;
    assert.ok(ui.editGroupMove(p, uid, 1, 0));
    assert.strictEqual(d.undo.length, steps + 1, 'a move is one step');
    assert.strictEqual(ui.editCellAt(p, 0, 1), 1, 'the cell it covered shows again');
    assert.strictEqual(ui.editCellAt(p, 1, 1), p.grid[1][1], 'and so does the room’s own');
    assert.strictEqual(words(ui.editCellAt(p, 1, 0)).layer1, 0x358a, 'the gourd is at its new place');
    assert.strictEqual(words(ui.editCellAt(p, 1, 0)).layer2, words(p.grid[0][1]).layer2, 'on the floor there');
    const trig = d.placed.find((x) => x.kind === 'bTrigger');
    assert.deepStrictEqual([trig.x, trig.y], [1, 0], 'its trigger moved with it');
    assert.ok(!ui.editGroupMove(p, uid, 5, 0), 'it will not move off the map');
    ui.editUndo(p);
    assert.strictEqual(words(ui.editCellAt(p, 0, 1)).layer1, 0x358a, 'undo puts it back where it was');
    assert.deepStrictEqual([d.groups[0].x, d.groups[0].y], [0, 1]);
});

test('a stamped object sits over the floor: its states keep it, wherever it goes', () => {
    const { p, d } = fresh();
    const words = (i) => ui.editStampWords(p, i);
    const red = ui.editAddStamp(p, { layer1: 0xa800, layer2: 0x0c02, collision: 0x0010 });
    ui.editApply([{ x: 0, y: 1, index: red }]);
    const pot = { name: 'gourd', w: 1, h: 1,
        cells: [{ dx: 0, dy: 0, canopy: { word: 0x358a }, terrain: null, collision: 0x001f }],
        attachments: { bTrigger: [], stepOn: [], objects: [{ dx: 0, dy: 0, w: 1, h: 1, states: 2,
            frames: [[{ dx: 0, dy: 0, canopy: { word: 0x358b }, terrain: { word: 0xa800 }, collision: 0x001f }]] }] } };
    ui.editStampGroup(p, pot, 0, 1);
    const o = d.placed.find((x) => x.kind === 'object');
    const state1 = () => words(ui.editObjectFrameIndex(o, '0,0', o.frames[0]['0,0']));
    assert.strictEqual(o.activeFrame, 0, 'it shows state 0 until a state is picked');
    assert.strictEqual(d.cells['0,1'], red, 'the red floor is still the map’s');
    assert.strictEqual(words(ui.editCellAt(p, 0, 1)).layer2, 0x0c02, 'state 0 shows on it');
    assert.strictEqual(state1().layer2, 0x0c02, 'and so does state 1, not a black one');
    const grass = ui.editAddStamp(p, { layer1: 0xa800, layer2: 0x0c00, collision: 0x0010 });
    ui.editApply([{ x: 0, y: 1, index: grass }]);
    assert.strictEqual(words(ui.editCellAt(p, 0, 1)).layer1, 0x358a, 'painting the floor under it keeps the gourd');
    assert.strictEqual(state1().layer2, 0x0c00, 'and its states are on the new floor');
    ui.editApply([{ x: 0, y: 1, index: red }]);
    assert.ok(ui.editGroupMove(p, d.groups[0].uid, 1, 0));
    const floor = words(p.grid[0][1]).layer2;
    assert.strictEqual(ui.editCellAt(p, 0, 1), red, 'the red floor shows where it was');
    assert.strictEqual(words(ui.editCellAt(p, 1, 0)).layer2, floor, 'the gourd is on the floor where it went');
    assert.strictEqual(state1().layer1, 0x358b);
    assert.strictEqual(state1().layer2, floor, 'state 1 too');
    ui.editGroupDelete(d.groups[0].uid);
    assert.deepStrictEqual(d.cells, { '0,1': red }, 'deleting it leaves the map as it was');
    assert.deepStrictEqual(Object.keys(ui.editBakedCells(p)), ['0,1']);
});

test('a group saved before v0.95.0 is lifted out of the map it was written into', () => {
    const { p, d } = fresh();
    const gourd = ui.editAddStamp(p, { layer1: 0x358a, layer2: 0x19cc, collision: 0x001f });
    d.cells['0,0'] = gourd;
    d.groups = [{ uid: 1, name: 'gourd', x: 0, y: 0, w: 1, h: 1, cells: [{ dx: 0, dy: 0, index: gourd }],
        under: [{ dx: 0, dy: 0, index: 1 }], placed: [] }];
    ui.editGroupsUpgrade(p);
    assert.deepStrictEqual(d.cells, { '0,0': 1 }, 'the map gets back what it covered');
    assert.deepStrictEqual(d.groups[0].cells[0], { dx: 0, dy: 0, collision: 0x001f, layer1: 0x358a, layer2: null },
        'and the group keeps only what it changed');
    assert.strictEqual(ui.editStampWords(p, ui.editCellAt(p, 0, 0)).layer1, 0x358a, 'the map shows the same');
});

test('groups stacked before v0.95.0 lift out together: the map gets back what was first under them', () => {
    const { p, d } = fresh();
    const words = (i) => ui.editStampWords(p, i);
    // A pasted floor (group 1) over the room's own cell, then a gourd (group 2) on that floor.
    const floor = ui.editAddStamp(p, { layer1: 0xa800, layer2: 0x0c02, collision: 0x0010 });
    const gourd = ui.editAddStamp(p, { layer1: 0x358a, layer2: 0x0c02, collision: 0x001f });
    d.cells['0,0'] = gourd;
    d.groups = [
        { uid: 1, name: 'pasted', x: 0, y: 0, w: 1, h: 1, cells: [{ dx: 0, dy: 0, index: floor }], under: [{ dx: 0, dy: 0, index: null }], placed: [] },
        { uid: 2, name: 'gourd', x: 0, y: 0, w: 1, h: 1, cells: [{ dx: 0, dy: 0, index: gourd }], under: [{ dx: 0, dy: 0, index: floor }], placed: [] },
    ];
    ui.editGroupsUpgrade(p);
    assert.deepStrictEqual(d.cells, {}, 'the room’s own cell, not the floor the gourd covered');
    assert.strictEqual(d.groups[0].cells[0].layer2, 0x0c02, 'the paste keeps its floor');
    assert.deepStrictEqual(d.groups[1].cells[0], { dx: 0, dy: 0, layer1: 0x358a, layer2: null, collision: 0x001f },
        'the gourd keeps only what it changed');
    const shown = words(ui.editCellAt(p, 0, 0));
    assert.deepStrictEqual([shown.layer1, shown.layer2], [0x358a, 0x0c02], 'the gourd shows on the pasted floor');
    ui.editGroupDelete(2);
    assert.strictEqual(words(ui.editCellAt(p, 0, 0)).layer2, 0x0c02, 'without it, the pasted floor shows');
});

test('a cell an old group did not change is dropped, collision too', () => {
    const { p, d } = fresh();
    d.groups = [{ uid: 1, name: 'x', x: 0, y: 0, w: 1, h: 1, cells: [{ dx: 0, dy: 0, index: 0 }],
        under: [{ dx: 0, dy: 0, index: null }], placed: [] }];
    ui.editGroupsUpgrade(p);
    assert.deepStrictEqual(d.groups[0].cells, []);
    assert.strictEqual(ui.editCellAt(p, 0, 0), 0);
});

test('Widgets › Placed lists what is stamped, in draw order; reordering changes what is on top', () => {
    const { p, d } = fresh();
    const words = (i) => ui.editStampWords(p, i);
    ui.setWidgetsView('placed');
    assert.match(ui.widgetsTab(), /none yet/, 'empty at first');
    const one = (w) => ({ name: 'n' + w.toString(16), w: 1, h: 1, attachments: { bTrigger: [], stepOn: [], objects: [] },
        cells: [{ dx: 0, dy: 0, canopy: { word: w }, terrain: null, collision: 0x001f }] });
    ui.editStampGroup(p, one(0x358a), 0, 0);
    ui.editStampGroup(p, one(0x358b), 0, 0);
    const html = ui.widgetsTab();
    assert.ok(html.indexOf('#0 · n358a') >= 0 && html.indexOf('#1 · n358b') > html.indexOf('#0 · n358a'), 'rows in draw order');
    assert.strictEqual(words(ui.editCellAt(p, 0, 0)).layer1, 0x358b, 'the later one is on top');
    const steps = d.undo.length;
    ui.placedReorder(d.groups[1].uid, d.groups[0].uid);
    assert.strictEqual(words(ui.editCellAt(p, 0, 0)).layer1, 0x358a, 'moved below, it is under');
    assert.strictEqual(d.undo.length, steps + 1, 'one step');
    ui.setWidgetsView('library');
});

test('a placed widget’s parts are locked to it; disbanding writes it into the map and lets them go', () => {
    const { p, d } = fresh();
    const words = (i) => ui.editStampWords(p, i);
    const red = ui.editAddStamp(p, { layer1: 0xa800, layer2: 0x0c02, collision: 0x0010 });
    ui.editApply([{ x: 0, y: 1, index: red }]);
    const pot = { name: 'gourd', w: 1, h: 1,
        cells: [{ dx: 0, dy: 0, canopy: { word: 0x358a }, terrain: null, collision: 0x001f }],
        attachments: { bTrigger: [{ dx: 0, dy: 0, w: 1, h: 1, scriptId: 0x40 }], stepOn: [], objects: [{ dx: 0, dy: 0, w: 1, h: 1, states: 2,
            frames: [[{ dx: 0, dy: 0, canopy: { word: 0x358b }, terrain: null, collision: 0x001f }]] }] } };
    ui.editStampGroup(p, pot, 0, 1);
    const g = d.groups[0];
    const trig = d.placed.find((x) => x.kind === 'bTrigger');
    const obj = d.placed.find((x) => x.kind === 'object');
    d.selectedTriggerRef = { kind: 'b', id: 'placed:' + trig.uid };
    ui.triggerDeleteSelected();
    assert.ok(!trig.removed, 'its trigger cannot be deleted on its own');
    ui.editRemoveObject(obj.uid);
    assert.ok(d.placed.includes(obj), 'nor its object');
    const steps = d.undo.length;
    assert.ok(ui.editGroupDisband(p, g.uid));
    assert.strictEqual(d.undo.length, steps + 1, 'disbanding is one step');
    assert.strictEqual(d.groups.length, 0);
    const cell = words(d.cells['0,1']);
    assert.deepStrictEqual([cell.layer1, cell.layer2], [0x358a, 0x0c02], 'the map holds it now, on its floor');
    assert.strictEqual(words(obj.frames[0]['0,0']).layer2, 0x0c02, 'its state keeps that floor');
    d.selectedTriggerRef = { kind: 'b', id: 'placed:' + trig.uid };
    ui.triggerDeleteSelected();
    assert.ok(trig.removed, 'its trigger is its own now');
    ui.editUndo(p);                       // the trigger's delete
    ui.editUndo(p);                       // the disband
    assert.strictEqual(d.groups.length, 1, 'undo brings the widget back');
    assert.strictEqual(d.cells['0,1'], red, 'and the map as it was');
});

test('deleting a group restores what it covered and removes its trigger, in one step', () => {
    const { p, d } = fresh();
    ui.editStampGroup(p, GOURD, 0, 0);
    ui.editGroupDelete(d.groups[0].uid);
    assert.deepStrictEqual(d.cells, {});
    assert.strictEqual(d.groups.length, 0);
    assert.ok(d.placed.every((x) => x.removed), 'its trigger is gone');
    ui.editUndo(p);
    assert.strictEqual(d.groups.length, 1, 'and undo brings it all back');
    assert.ok(d.placed.some((x) => !x.removed));
});

test('a stamp the history writes back comes back, even after it was pruned', () => {
    const { p, d } = fresh();
    // A level-2 stamp is painted, then a level-3 one over it: the level-2
    // stamp is on the map no more, but undo writes it back.
    d.brush = 2;
    ui.editLevelPick(2);
    ui.editStroke({ x: 0, y: 0 }, 'down');
    const first = d.cells['0,0'];
    ui.editLevelPick(3);
    ui.editStroke({ x: 0, y: 0 }, 'down');
    ui.editPruneAdded(p);
    const firstWords = ui.editStampWords(p, first);
    ui.editUndo(p);
    assert.deepStrictEqual(ui.editStampWords(p, d.cells['0,0']), firstWords, 'the same stamp, by its words');
    ui.editRedo(p);
    assert.strictEqual(ui.editStampWords(p, d.cells['0,0']).collision & 0x30, 0x30, 'and redo too');
    ui.editUndo(p);
    // As it would after a restart: the history as JSON, the pruned tail gone.
    const hist = JSON.parse(JSON.stringify(d.redo));
    d.added.length = 0;
    d.redo = hist;
    ui.editRedo(p);
    assert.strictEqual(ui.editStampWords(p, d.cells['0,0']).collision & 0x30, 0x30, 'from saved history as well');
});

test('a custom map is untouched until something is done to it', () => {
    const { d } = fresh();
    const m = { key: 'k1', w: 16, h: 14, borrow: 0x34, saved: null, history: null };
    d.customKey = 'k1';
    ui.setCustom([m], 'k1');
    assert.ok(ui.customIsPristine(m));
    d.brush = 2;
    ui.editStroke({ x: 0, y: 0 }, 'down');
    assert.ok(!ui.customIsPristine(m), 'painted');
    ui.editUndo(tilePalette());
    assert.ok(ui.customIsPristine(m), 'undone back to empty, it is empty again — New Map may reuse it');
    ui.setCustom([], null);
});

console.log('\nselection, the eyedropper, copy and paste:');

test('the Special eraser takes a stairs flag off a tile that has no glyph', () => {
    const { p, d } = fresh();
    const w = ui.editStampWords(p, 0);
    d.cells['0,0'] = ui.editAddStamp(p, { layer1: w.layer1, layer2: w.layer2, collision: 0x2010 });
    ui.setTab('special');
    d.tool = 'erase';
    ui.editStroke({ x: 0, y: 0 }, 'down');
    assert.strictEqual(ui.editStampWords(p, d.cells['0,0']).collision & 0x2000, 0, 'the stairs bit is gone');
    assert.strictEqual(ui.editStampWords(p, d.cells['0,0']).collision & 0x30, 0x10, 'the level stays');
    ui.setTab('tile');
});

test('the Boy: a click selects him, a drag moves him in one step', () => {
    const { d } = fresh();
    d.start = { x: 1, y: 1 };
    d.tool = 'select';
    ui.editBegin();
    ui.editStroke({ x: 1, y: 1 }, 'down');
    assert.ok(ui.startSel(), 'selected');
    ui.editStroke({ x: 2, y: 0 }, 'move');
    ui.editStroke({ x: 2, y: 1 }, 'up');
    ui.editEnd();
    assert.deepStrictEqual(d.start, { x: 2, y: 1 });
    assert.strictEqual(d.undo.length, 1);
    ui.editStroke({ x: 0, y: 0 }, 'down');
    assert.ok(!ui.startSel(), 'a click elsewhere lets him go');
});

test('the eyedropper picks a tile with its tab, the pencil, its flip and its level', () => {
    const { p, d } = fresh();
    ui.setTab('special');
    d.tool = 'pick';
    ui.editStroke({ x: 2, y: 0 }, 'down');       // the room's own stamp 1 (0x101f: level 1)
    assert.strictEqual(ui.tab(), 'tile');
    assert.strictEqual(d.tool, 'paint');
    assert.strictEqual(d.brush, 1);
    assert.strictEqual(d.plane, 1);
});

test('the eyedropper picks a special or a trigger with their own tab', () => {
    const { d } = fresh();
    d.specialCells['1,0'] = 'gate-dog';
    d.tool = 'pick';
    ui.editStroke({ x: 1, y: 0 }, 'down');
    assert.strictEqual(ui.tab(), 'special');
    assert.strictEqual(d.currentSpecialId, 'gate-dog');
    d.placed.push({ kind: 'stepOn', x: 0, y: 1, w: 1, h: 1, scriptId: null, uid: 99 });
    ui.setTab('trigger');
    d.tool = 'pick';
    ui.editStroke({ x: 0, y: 1 }, 'down');
    assert.strictEqual(ui.tab(), 'trigger');
    assert.strictEqual(ui.triggerKind(), 'step');
    assert.deepStrictEqual(d.selectedTriggerRef, { kind: 'step', id: 'placed:99' });
    ui.setTab('tile');
});

test('copy a region; paste picks it up on the pointer, a click puts it down as one selected object', () => {
    const { p, d } = fresh();
    d.tool = 'copy';
    ui.setSel({ x1: 0, y1: 0, x2: 1, y2: 0 });
    const key = (k) => ui.editClipboardKey({ key: k }, true);
    assert.ok(key('c'));
    ui.setHover({ x: 1, y: 1 });
    assert.ok(key('v'));
    assert.strictEqual(d.groups.length, 0, 'nothing is written until the click');
    assert.deepStrictEqual(ui.pasteFloat(), { x: 0, y: 1 }, 'centred on the pointer, kept on the map');
    ui.editStroke({ x: 1, y: 1 }, 'down');
    assert.strictEqual(d.groups.length, 1);
    const g = d.groups[0];
    assert.deepStrictEqual([g.x, g.y, g.w, g.h], [0, 1, 2, 1], 'where it was shown');
    assert.strictEqual(ui.groupSel(), g.uid, 'and selected');
    assert.strictEqual(ui.pasteFloat(), null);
    ui.editBegin();
    ui.editStroke({ x: 1, y: 1 }, 'down');
    ui.editStroke({ x: 2, y: 1 }, 'move');
    ui.editStroke({ x: 2, y: 1 }, 'up');
    ui.editEnd();
    assert.deepStrictEqual([d.groups[0].x, d.groups[0].y], [1, 1], 'dragged while selected');
    ui.editStroke({ x: 0, y: 0 }, 'down');
    assert.strictEqual(ui.groupSel(), null, 'a click elsewhere lets it go');
});

console.log('\nv0.73.0:');

test('the Select tool on the Special tab selects a cell’s specials and drags them, glyph and bits', () => {
    const { p, d } = fresh();
    d.currentSpecialId = 'gate-dog';
    ui.setTab('special');
    ui.editStroke({ x: 0, y: 0 }, 'down');                   // pencil: a dog gate at 0,0
    d.tool = 'select';
    ui.editBegin();
    ui.editStroke({ x: 0, y: 0 }, 'down');
    assert.deepStrictEqual(ui.specialSel(), { x: 0, y: 0 }, 'selected');
    ui.editStroke({ x: 2, y: 1 }, 'move');
    ui.editStroke({ x: 2, y: 1 }, 'up');
    ui.editEnd();
    assert.strictEqual(ui.editSpecialAt(0, 0), null, 'the glyph left');
    assert.strictEqual(ui.editSpecialAt(2, 1), 'gate-dog', 'and arrived');
    assert.strictEqual((ui.editStampWords(p, d.cells['0,0']).collision >> 8) & 0xf, 0, 'the source lost the gate');
    assert.strictEqual((ui.editStampWords(p, d.cells['2,1']).collision >> 8) & 0xf, 5, 'the target has it');
    ui.editUndo(p);
    assert.strictEqual(ui.editSpecialAt(0, 0), 'gate-dog', 'one step: undo puts it back');
    ui.setTab('tile');
});

test('a stairs flag with no glyph moves too', () => {
    const { p, d } = fresh();
    const w = ui.editStampWords(p, 0);
    d.cells['0,0'] = ui.editAddStamp(p, { layer1: w.layer1, layer2: w.layer2, collision: 0x2012 });
    ui.setTab('special');
    d.tool = 'select';
    ui.editStroke({ x: 0, y: 0 }, 'down');
    ui.editStroke({ x: 1, y: 0 }, 'up');
    assert.strictEqual(ui.editStampWords(p, d.cells['1,0']).collision & 0x200f, 0x2002);
    assert.strictEqual(ui.editStampWords(p, d.cells['0,0']).collision & 0x2000, 0);
    ui.setTab('tile');
});

test('Escape drops a copy on the pointer without writing anything', () => {
    const { d } = fresh();
    d.tool = 'copy';
    ui.setSel({ x1: 0, y1: 0, x2: 0, y2: 0 });
    ui.editClipboardKey({ key: 'c' }, true);
    ui.editClipboardKey({ key: 'v' }, true);
    assert.ok(ui.pasteFloat());
    ui.dropPaste();
    ui.editStroke({ x: 2, y: 1 }, 'down');
    assert.strictEqual(d.groups.length, 0);
});

test('the Trigger tab has a sub-tab per kind; the open one is what the pencil draws and what is listed', () => {
    const { d } = fresh();
    d.placed.push({ kind: 'stepOn', x: 0, y: 0, w: 1, h: 1, scriptId: null, uid: 7 });
    ui.setTab('trigger');
    ui.setTriggerKind('b');
    const html = ui.triggerTab();
    assert.match(html, /rg-subtab rg-trigger-kind rg-trigger-kind-b on/);
    assert.ok(!/placed #7/.test(html), 'the step trigger is on the other sub-tab');
    ui.setTab('tile');
});

test('the rectangle tool is gone', () => {
    fresh();
    assert.ok(!ui.toolbar().includes('data-edit-tool="rect"'));
});

console.log('\nv0.74.0:');

test('floor / edge / wall list tiles by the collision they would be painted with', () => {
    // [slot, chr, graphic, uses, canopyUses, terrainUses, groundShape, groundPct, frontShape, frontPct, grass, gStairs, fStairs]
    const row = (shape, stairs) => [0, 0, 5000 + shape, 1, 0, 9, shape, 90, -1, 0, 0, stairs || 0, 0];
    ui.tileShapePick('floor');
    assert.ok(ui.tileSlotPasses(row(0)) && ui.tileSlotPasses(row(0x0f, 3)), 'open, and stairs');
    assert.ok(!ui.tileSlotPasses(row(0x0f)));
    ui.tileShapePick('wall');
    assert.ok(ui.tileSlotPasses(row(0x0f)) && !ui.tileSlotPasses(row(0x03)));
    ui.tileShapePick('edge');
    assert.ok(ui.tileSlotPasses(row(0x03)) && ui.tileSlotPasses(row(0x05)) && !ui.tileSlotPasses(row(0)));
    assert.ok(!ui.tileSlotPasses([0, 0, 1, 1, 0, 0, -1, 0, -1, 0, 0, 0, 0]), 'never seen: only under all');
    ui.tileShapePick('all');
    assert.ok(ui.tileSlotPasses(row(0x05)));
});

test('tiles list filters by special flags: drift, deflect and interact', () => {
    // [slot, chr, graphic, uses, canopyUses, terrainUses, groundShape, groundPct, frontShape, frontPct, grass, gStairs, fStairs, animKind, animFirst, animFrame, specialFlags]
    const rowWithFlags = (flags) => [0, 0, 6000, 1, 0, 9, 0, 90, -1, 0, 0, 0, 0, 0, 0, 0, flags];
    const plain = rowWithFlags(0);
    const driftTile = rowWithFlags(1 | (8 << 4)); // drift flag (1) + north (8)
    const deflectTile = rowWithFlags(2);          // deflect flag (2)
    const interactTile = rowWithFlags(4);         // interact flag (4)

    // Filter drift
    ui.tileFilterToggle('drift');
    assert.ok(ui.tileSlotPasses(driftTile), 'drift tile passes drift filter');
    assert.ok(!ui.tileSlotPasses(plain), 'plain tile fails drift filter');
    assert.ok(!ui.tileSlotPasses(deflectTile), 'deflect tile fails drift filter');

    // Filter deflect
    ui.tileFilterToggle('deflect');
    assert.ok(ui.tileSlotPasses(deflectTile), 'deflect tile passes deflect filter');
    assert.ok(!ui.tileSlotPasses(plain), 'plain tile fails deflect filter');
    assert.ok(!ui.tileSlotPasses(driftTile), 'drift tile fails deflect filter');

    // Filter interact
    ui.tileFilterToggle('interact');
    assert.ok(ui.tileSlotPasses(interactTile), 'interact tile passes interact filter');
    assert.ok(!ui.tileSlotPasses(plain), 'plain tile fails interact filter');
    assert.ok(!ui.tileSlotPasses(deflectTile), 'deflect tile fails interact filter');

    // Turn filter off
    ui.tileFilterToggle('interact');
    assert.ok(ui.tileSlotPasses(plain), 'plain tile passes when filter is off');
});

test('tiles list filters by unused, canopy, and 2-layer', () => {
    // [slot, chr, graphic, uses, canopyUses, terrainUses, groundShape, groundPct, frontShape, frontPct, grass, gStairs, fStairs, animKind, animFirst, animFrame, specialFlags, categoryFlags]
    const rowWithCat = (uses, canopyUses, terrainUses, catFlags) => [0, 0, 6000, uses, canopyUses, terrainUses, 0, 90, -1, 0, 0, 0, 0, 0, 0, 0, 0, catFlags];
    const unusedTile = rowWithCat(0, 0, 0, 1);
    const canopyTile = rowWithCat(5, 5, 0, 2);
    const dualTile = rowWithCat(4, 4, 4, 4);
    const plain = rowWithCat(10, 0, 10, 0);

    // Filter unused
    ui.tileFilterToggle('unused');
    assert.ok(ui.tileSlotPasses(unusedTile), 'unused tile passes unused filter');
    assert.ok(!ui.tileSlotPasses(plain), 'plain tile fails unused filter');
    assert.ok(!ui.tileSlotPasses(canopyTile), 'canopy tile fails unused filter');

    // Filter canopy
    ui.tileFilterToggle('canopy');
    assert.ok(ui.tileSlotPasses(canopyTile), 'canopy tile passes canopy filter');
    assert.ok(!ui.tileSlotPasses(plain), 'plain tile fails canopy filter');
    assert.ok(!ui.tileSlotPasses(unusedTile), 'unused tile fails canopy filter');

    // Filter dual (2-layer)
    ui.tileFilterToggle('dual');
    assert.ok(ui.tileSlotPasses(dualTile), 'dual-layer tile passes dual filter');
    assert.ok(!ui.tileSlotPasses(plain), 'plain tile fails dual filter');
    assert.ok(!ui.tileSlotPasses(unusedTile), 'unused tile fails dual filter');

    // Turn filter off
    ui.tileFilterToggle('dual');
    assert.ok(ui.tileSlotPasses(plain), 'plain tile passes when filter is off');
});

test('a stamped or pasted object lands on the level of the floor under it', () => {
    const { p, d } = fresh();
    ui.editLevelPick(2);
    // v0.79.0: the room's floor here is level 1, so the gourd is too, whatever
    // the bar says — on open ground the bar decides (map-editor-dom.test.js).
    const got = ui.editStampGroup(p, GOURD, 0, 0);
    assert.strictEqual(got.level, 1);
    assert.strictEqual(ui.editStampWords(p, ui.editCellAt(p, 0, 0)).collision & 0x30, 0x10);
    ui.editLevelPick(1);
});

test('on the Trigger tab the Select tool picks a trigger over a stamped object', () => {
    const { p, d } = fresh();
    ui.editStampGroup(p, GOURD, 0, 0);                        // its B-trigger covers it
    d.tool = 'select';
    ui.setTab('tile');
    ui.editStroke({ x: 0, y: 0 }, 'down');
    assert.ok(ui.groupSel() != null && !d.selectedTriggerRef, 'elsewhere: the object');
    ui.setTab('trigger');
    ui.editStroke({ x: 0, y: 0 }, 'down');
    assert.ok(d.selectedTriggerRef && d.selectedTriggerRef.kind === 'b', 'on the Trigger tab: the trigger');
    ui.setTab('tile');
});

test('the tile list keeps its order when a tile is used', () => {
    const { p } = fresh();
    ui.setSheet(51, { family: 51, count: 3, columns: 16, cell: 16, imageUri: 'data:,',
        slots: [[0, 0, 901, 5, 0, 5, -1, 0, -1, 0, 0, 0, 0], [1, 0, 902, 9, 0, 9, -1, 0, -1, 0, 0, 0, 0],
                [2, 0, 903, 1, 0, 1, -1, 0, -1, 0, 0, 0, 0]] });
    const order = () => (ui.tileGroup(51, 360).match(/data-fam-tile="(\d+)"/g) || []).join();
    const before = order();
    ui.setRelated({ 903: 100 });                              // 903 now "goes with" the map
    assert.strictEqual(order(), before, 'related-ness does not reorder it');
    assert.ok(before.indexOf('902') < before.indexOf('901'), 'most-placed first');
    ui.setRelated({});
});

console.log('\nv0.75.0 — animations in the tile list:');

test('an animation is one swatch that plays its frames; `frames` lists each frame', () => {
    fresh();
    const row = (g, kind, first, frame) => [0, 0, g, 1, 0, 1, -1, 0, -1, 0, 0, 0, 0, kind, first, frame];
    const sheet = { family: 9, columns: 16, cell: 16, imageUri: 'data:,',
        slots: [row(700, 1, 700, 0), row(701, 2, 700, 1), row(702, 2, 700, 2), row(710, 0, 0, 0)],
        animations: { 700: { frames: [700, 701, 702], delays: [10, 10, 20] } } };
    assert.ok(ui.tileSlotPasses(sheet.slots[0]) && !ui.tileSlotPasses(sheet.slots[1]), 'later frames folded in');
    const play = ui.tileAnimPlay(sheet, sheet.slots[0]);
    assert.match(play.css, /@keyframes rg-anim-9-700\{0\.00%\{background-position:-0px -0px\}25\.00%\{background-position:-16px -0px\}50\.00%/);
    assert.match(play.style, /0\.667s steps\(1,end\) infinite/, '40 ticks at 60 Hz');
    ui.tileFramesPick('frames');
    assert.ok(ui.tileSlotPasses(sheet.slots[1]), 'each frame on its own');
    assert.strictEqual(ui.tileAnimPlay(sheet, sheet.slots[0]).css, '', 'and nothing plays');
    ui.tileFramesPick('anim');
});

test('widgets preserve every object frame across save and reopen', () => {
    const p = tilePalette();
    ui.setPalette(p);
    const d = ui.editReset(0x34);
    d.on = true;

    // A widget whose object has two delta frames (state 0 is the base room).
    const w = {
        name: 'gourd', w: 2, h: 2, cells: [],
        attachments: {
            bTrigger: [], stepOn: [],
            objects: [{
                dx: 0, dy: 0, w: 2, h: 2, states: 3,
                frames: [
                    [{ dx: 0, dy: 0, canopy: { word: 0x1422 }, terrain: null, collision: 0x001f }],
                    [{ dx: 1, dy: 1, canopy: { word: 0x1423 }, terrain: null, collision: 0x001f }],
                ],
            }],
        },
    };
    ui.editStampedConstruct(w, 0, 0);
    const placed = d.placed.filter((x) => x.kind === 'object');
    assert.strictEqual(placed.length, 1, 'object was placed');
    const o = placed[0];
    const frames = ui.editObjectFrames(o);
    assert.strictEqual(frames.length, 2, 'both delta frames restored');
    assert.ok(frames[0]['0,0'] >= 0, 'frame 1 tile restored');
    assert.ok(frames[1]['1,1'] >= 0, 'frame 2 tile restored');

    // Edit frame 2 and save the widget: every frame must survive the round-trip.
    o.layer = frames[1];
    const saved = ui.widgetPlacedIn(d, { x1: 0, y1: 0, x2: 1, y2: 1 });
    assert.strictEqual(saved.objects.length, 1, 'object serialized');
    const so = saved.objects[0];
    assert.strictEqual(so.states, 3, 'states count includes base + two deltas');
    assert.ok(Array.isArray(so.frames) && so.frames.length === 2, 'both frames serialized');
    assert.strictEqual(so.frames[0].length, 1, 'frame 1 cells saved');
    assert.strictEqual(so.frames[1].length, 1, 'frame 2 cells saved');
    assert.strictEqual(so.frames[1][0].dx, 1, 'frame 2 delta position saved');
});

console.log('\nv0.82.8 — copy room as widget and map editor bugfixes:');

test('SVG overlay elements for groups and objects carry pointer-events="none"', () => {
    const box = ui.groupBoxSvg(2, 3, { w: 2, h: 2, name: 'hut' }, { x: 0, y: 0 }, 'rg-group');
    assert.match(box, /pointer-events="none"/, 'groupBoxSvg carries pointer-events="none"');

    const p = tilePalette();
    ui.setPalette(p);
    const d = ui.editReset(0x34);
    d.on = true;
    d.placed.push({
        kind: 'object', uid: 10, x: 2, y: 2, w: 2, h: 2, states: 1, frames: [], layer: {}
    });
    const objSvg = ui.editObjectSvg(p, null, { x: 0, y: 0 });
    assert.match(objSvg, /class="rg-obj-area rg-obj-cluster[^"]*"[^>]*pointer-events="none"/, 'object cluster carries pointer-events="none"');
});

test('More menu includes Copy map button', () => {
    const html = ui.moreFilterGroupHtml({ romId: 0x34, hasMap: true });
    assert.match(html, /data-edit-act="copy-map"/, 'More menu has Copy map button');
    assert.match(html, /Copy map<\/button>/, 'Copy map button text');
});

test('customDuplicateMap duplicates a vanilla room with pre-seeded cells and attachments', () => {
    ui.editReset(0x34);
    const p = tilePalette();
    p.widthTiles = 4;
    p.heightTiles = 4;
    p.grid = [
        [0, 1, 0, 1],
        [1, 0, 1, 0],
        [0, 1, 0, 1],
        [1, 0, 1, 0]
    ];
    p.roomId = 0x34;
    p.attachments = {
        bTrigger: [[1, 1, 2, 2, 0x1234]],
        stepOn: [],
        objects: [[2, 2, 1, 1, 5]]
    };
    // The object with its states, as the host sends it (object-previews.js's editorObjects).
    p.roomObjects = [{ index: 5, x: 2, y: 2, w: 1, h: 1, frames: [{ '0,0': 1 }] }];
    ui.setPalette(p);
    ui.setPanelRoom({ romRoomId: 0x34, name: "Strongheart's Hut", widthTiles: 4, heightTiles: 4 });
    ui.setCustom([], null);

    const dup = ui.customDuplicateMap();
    assert.ok(dup, 'duplicate map created');
    assert.strictEqual(dup.name, "Copy of Strongheart's Hut");
    assert.strictEqual(dup.borrow, 0x34);
    assert.strictEqual(dup.w, 4);
    assert.strictEqual(dup.h, 4);
    assert.ok(dup.saved, 'draft data saved');
    assert.strictEqual(dup.saved.cells['0,0'], 0);
    assert.strictEqual(dup.saved.cells['1,0'], 1);
    assert.strictEqual(dup.saved.placed.length, 2, 'bTrigger and object copied');
    const trig = dup.saved.placed.find((q) => q.kind === 'bTrigger');
    assert.deepStrictEqual([trig.x, trig.y, trig.w, trig.h], [1, 1, 2, 2], 'inclusive cells 1..2 are a 2x2 box');
    const obj = dup.saved.placed.find((q) => q.kind === 'object');
    assert.deepStrictEqual(obj.frames, [{ '0,0': 1 }], 'the object keeps its states');
    assert.strictEqual(obj.activeFrame, 0, 'and shows the room as it loads');
    assert.deepStrictEqual(dup.saved.families, p.tileFamilies);
});

test('switching tabs with keepSelection preserves selection and widgetHasSelection returns true', () => {
    ui.setSel(null);
    ui.setGroupSel(5);
    assert.strictEqual(ui.widgetHasSelection(), true, 'group selection is active');

    ui.editDeselectAll(true);
    assert.strictEqual(ui.widgetHasSelection(), true, 'selection preserved after tab change');

    ui.editDeselectAll(false);
    assert.strictEqual(ui.widgetHasSelection(), false, 'selection cleared on tool change / escape');

    ui.setSel({ x1: 1, y1: 1, x2: 3, y2: 3 });
    assert.strictEqual(ui.widgetHasSelection(), true, 'box selection is active');
    ui.setSel(null);
    assert.strictEqual(ui.widgetHasSelection(), false, 'cleared');
});

test('editBuildConstruct captures specialCells and editConstructWrites reproduces them', () => {
    const p = tilePalette();
    ui.setPalette(p);
    const d = ui.editReset(0x34);
    d.cells['0,0'] = 0;
    d.specialCells = { '0,0': 'gate-dog' };

    const c = ui.editBuildConstruct(p, { x1: 0, y1: 0, x2: 1, y2: 1 }, 'test');
    assert.ok(c, 'construct built');
    const cellWithSpecial = c.cells.find((cell) => cell.dx === 0 && cell.dy === 0);
    assert.ok(cellWithSpecial, 'cell found');
    assert.strictEqual(cellWithSpecial.special, 'gate-dog', 'special recorded in cell');

    const written = ui.editConstructWrites(p, c, 0, 0);
    assert.ok(written.specials && written.specials.length === 1, 'special collected in writes');
    assert.strictEqual(written.specials[0].id, 'gate-dog');
    assert.strictEqual(written.specials[0].x, 0);
    assert.strictEqual(written.specials[0].y, 0);
});

test('editStroke clamps out-of-bounds drag coordinates on move and up, allowing edge selection', () => {
    const p = tilePalette();
    p.widthTiles = 4;
    p.heightTiles = 4;
    ui.setPalette(p);
    const d = ui.editReset(0x34);
    d.on = true;
    d.tool = 'copy';

    // Start inside at (0, 0)
    ui.editStroke({ x: 0, y: 0 }, 'down');
    // Drag way past bottom-right edge to (10, 10)
    ui.editStroke({ x: 10, y: 10 }, 'move');
    // Release outside bounds at (12, 12)
    ui.editStroke({ x: 12, y: 12 }, 'up');

    const sel = ui.getEditSel();
    assert.ok(sel, 'selection created even when dragged past edge');
    assert.strictEqual(sel.x1, 0);
    assert.strictEqual(sel.y1, 0);
    assert.strictEqual(sel.x2, 3, 'clamped to widthTiles - 1');
    assert.strictEqual(sel.y2, 3, 'clamped to heightTiles - 1');
});

test('editObjectSvg renders object delta tiles even when object is unselected', () => {
    const p = Object.assign(tilePalette(), {
        imageUri: 'data:img/room', imageWidth: 256, imageHeight: 16, columns: 16, cell: 16
    });
    ui.setPalette(p);
    const d = ui.editReset(0x34);
    d.on = true;
    d.placed = [{
        kind: 'object', uid: 42, x: 1, y: 1, w: 2, h: 2, states: 2,
        frames: [{ '0,0': 1 }], layer: { '0,0': 1 }, activeFrame: 1
    }];

    // Deselect any selected object
    ui.editDeselectAll();
    const svg = ui.editObjectSvg(p, null, { x: 0, y: 0 });
    assert.ok(svg.includes('rg-obj-cell'), 'delta tile is rendered even without object selection');
});

test('customDuplicateMap defers copying vanilla room until palette loads and copies correctly', () => {
    ui.editReset(0x33);
    ui.setPanelRoom({ romRoomId: 0x33, name: "Strong Heart's Exterior", widthTiles: 4, heightTiles: 4 });
    ui.setCustom([], null);
    // Palette is not loaded yet for 0x33
    ui.setPalette(null);

    const pending = ui.customDuplicateMap();
    assert.strictEqual(pending, null, 'defers synchronously when palette is not loaded');

    // Simulate palette arrival from host
    const p = tilePalette();
    p.roomId = 0x33;
    p.widthTiles = 4;
    p.heightTiles = 4;
    p.grid = [[0, 1, 0, 1], [1, 0, 1, 0], [0, 1, 0, 1], [1, 0, 1, 0]];
    p.attachments = { bTrigger: [[0, 0, 2, 2, 0x99]], stepOn: [], objects: [] };
    ui.setPalette(p);

    ui.customCopyMapReady();
    const maps = ui.customMaps();
    assert.strictEqual(maps.length, 1, 'map duplicated once palette ready');
    assert.strictEqual(maps[0].name, "Copy of Strong Heart's Exterior");
    assert.strictEqual(maps[0].saved.cells['0,0'], 0);
    assert.strictEqual(maps[0].saved.cells['1,0'], 1);
    assert.strictEqual(maps[0].saved.placed.length, 1);
});

// ── a vanilla room, connected to the editor ─────────────────────────────────

test('a custom map\'s palette is never taken for its donor vanilla room', () => {
    // map-editor-newroom.js reshapes the donor's palette into the blank map
    // and keeps its roomId — opening the donor then kept the map's grid,
    // size and families on the ROM room.
    const p = Object.assign(tilePalette(), { roomId: 0x34 });
    ui.setPalette(p);
    assert.strictEqual(ui.mtPaletteFits({ romRoomId: 0x34 }), true, 'the room\'s own palette fits');
    ui.setPalette(Object.assign({}, p, { customBlank: true }));
    assert.strictEqual(ui.mtPaletteFits({ romRoomId: 0x34 }), false, 'a custom map\'s does not');
    assert.strictEqual(ui.mtPaletteFits({ romRoomId: 0x33 }), false, 'nor another room\'s');
});

test('a vanilla room\'s objects join its draft once, with their frames, at the loaded state', () => {
    const p = Object.assign(tilePalette(), { roomId: 0x34,
        roomObjects: [{ index: 0, x: 1, y: 0, w: 2, h: 1, frames: [{ '0,0': 2 }, { '0,0': 2, '1,0': 1 }] }] });
    ui.setPalette(p);
    const d = ui.editReset(0x34);
    ui.editSeedRoomObjects();
    ui.editSeedRoomObjects();
    const objs = ui.editObjects();
    assert.strictEqual(objs.length, 1, 'seeded once, however often asked');
    assert.strictEqual(objs[0].roomObject, 0);
    assert.strictEqual(objs[0].states, 3, 'two deltas are three states');
    assert.strictEqual(objs[0].activeFrame, 0, 'shows the room as it loads');
    // Frames are the draft's own copies: editing one must not edit the palette.
    objs[0].frames[0]['0,0'] = 1;
    assert.strictEqual(p.roomObjects[0].frames[0]['0,0'], 2);
    // Not a new attachment in the export — it is already in the ROM.
    const ex = ui.editExport(p);
    assert.strictEqual(ex.attachments.length, 0);
    assert.strictEqual(ex.roomObjects.length, 1);
    assert.ok(d.roomObjectsSeeded);
});

test('a vanilla object brings how long it holds each state; frames keep their holds when added, moved, removed', () => {
    const p = Object.assign(tilePalette(), { roomId: 0x34,
        roomObjects: [{ index: 0, x: 0, y: 0, w: 1, h: 1, frames: [{ '0,0': 1 }, { '0,0': 2 }, { '0,0': 1 }], holds: [0, 7, 9] }] });
    ui.setPalette(p);
    ui.editReset(0x34);
    ui.editSeedRoomObjects();
    const tabBefore = ui.tab();
    let o = ui.editObjects()[0];
    assert.deepStrictEqual(o.holds, [0, 7, 9]);
    // Only the held states have a field to edit.
    ui.objectSelect(o.uid);
    const html = ui.objectStatesHtml(o, 0);
    assert.deepStrictEqual((html.match(/data-object-hold="(\d+)"/g) || []).map((m) => m.match(/\d+/)[0]), ['1', '2']);
    assert.match(html, /data-object-play=/);
    // State 0 to 1 is always the next tick: a greyed-out 1, not a field.
    assert.match(html, /<input[^>]*rg-object-hold-fixed[^>]*value="1" disabled/);
    assert.strictEqual((html.match(/rg-object-hold-none/g) || []).length, 1, 'only the last state has no box');
    // 1 for the first step, then 7 and 9.
    assert.strictEqual(ui.objectRunTicks(o), 17);

    ui.objectSetHold(o.uid, 1, 12);
    assert.deepStrictEqual(o.holds, [0, 12, 9]);
    ui.objectSetHold(o.uid, 3, 5);
    assert.deepStrictEqual(o.holds, [0, 12, 9], 'the last state has no hold to set');
    ui.editUndo();
    // Undo puts the objects back wholesale: ask for it again.
    o = ui.editObjects()[0];
    assert.deepStrictEqual(o.holds, [0, 7, 9], 'one undo step');

    ui.objectSelectFrame(1, o.uid);
    ui.objectMoveFrame(o.uid, 1);
    assert.deepStrictEqual(o.holds, [0, 9, 7], 'a state takes its hold where it goes');
    ui.objectRemoveFrame(o.uid, 1);
    assert.deepStrictEqual(o.holds, [0, 7]);
    ui.objectAddFrame(o.uid);
    assert.deepStrictEqual(o.holds, [0, 7, 1], 'the state that stopped being last is held for the usual 1');
    // Module state: selecting an object picked it and the Object tab for every later test.
    ui.objectSelect(null);
    ui.setTab(tabBefore);
});

test('Play steps an object one state at a time, holding each for its ticks', () => {
    const p = Object.assign(tilePalette(), { roomId: 0x34,
        roomObjects: [{ index: 0, x: 0, y: 0, w: 1, h: 1, frames: [{ '0,0': 1 }, { '0,0': 2 }], holds: [0, 6] }] });
    ui.setPalette(p);
    ui.editReset(0x34);
    ui.editSeedRoomObjects();
    const o = ui.editObjects()[0];
    const tabBefore = ui.tab();
    const timers = [], real = global.setTimeout;
    global.setTimeout = (fn, ms) => { timers.push({ fn, ms }); return timers.length; };
    try {
        ui.objectSelect(o.uid);
        ui.objectPlay(o.uid);
        assert.ok(ui.objectPlaying());
        assert.ok(timers[0].ms < 17, 'the first step is the next tick');
        timers[0].fn();
        assert.strictEqual(o.activeFrame, 1);
        assert.ok(Math.abs(timers[1].ms - 6 * 1000 / 60.0988) < 0.01, 'state 1 held 6 ticks');
        timers[1].fn();
        assert.strictEqual(o.activeFrame, 2);
        assert.strictEqual(ui.objectPlaying(), null, 'stops at the last state');
        assert.strictEqual(timers.length, 2);
        // Like setting it to 0x7e from the start: again from state 0, never back down.
        ui.objectPlay(o.uid);
        assert.strictEqual(o.activeFrame, 0);
        timers[2].fn();
        assert.strictEqual(o.activeFrame, 1);
    } finally {
        global.setTimeout = real;
        ui.objectSelect(null);
        ui.setTab(tabBefore);
    }
});

test('seeding waits outside an open undo step, and never touches a custom map', () => {
    const p = Object.assign(tilePalette(), { roomId: 0x34,
        roomObjects: [{ index: 0, x: 0, y: 0, w: 1, h: 1, frames: [{ '0,0': 1 }] }] });
    ui.setPalette(p);
    ui.editReset(0x34);
    ui.editBegin();
    ui.editSeedRoomObjects();
    assert.strictEqual(ui.editObjects().length, 0, 'not inside a gesture');
    ui.editEnd();
    ui.editSeedRoomObjects();
    assert.strictEqual(ui.editObjects().length, 1);
    const d = ui.editReset(0x34);
    d.customKey = 'custom-x';
    ui.editSeedRoomObjects();
    assert.strictEqual(ui.editObjects().length, 0, 'a custom map has only its own objects');
});

test('a collision word names the Special tab pick it already carries', () => {
    assert.deepStrictEqual(ui.editWordSpecialIds(0x0000), []);
    assert.deepStrictEqual(ui.editWordSpecialIds(0x2000), ['stairs-vert']);
    assert.deepStrictEqual(ui.editWordSpecialIds(0x2001), ['stairs-diag-r']);
    assert.deepStrictEqual(ui.editWordSpecialIds(0x2002), ['stairs-diag-l']);
    assert.deepStrictEqual(ui.editWordSpecialIds(0x200a), ['drift-e']);
    // The four diagonal handlers and 3..7 (§6), all placed in vanilla.
    assert.deepStrictEqual(ui.editWordSpecialIds(0x2009), ['drift-ne']);
    assert.deepStrictEqual(ui.editWordSpecialIds(0x200c), ['drift-nw']);
    assert.deepStrictEqual(ui.editWordSpecialIds(0x2006), ['walkable']);
    // Gates: bit 8 plus the nibble; 9 has no effect of its own and no pick.
    assert.deepStrictEqual(ui.editWordSpecialIds(0x0510), ['gate-dog']);
    assert.deepStrictEqual(ui.editWordSpecialIds(0x0910), []);
    assert.deepStrictEqual(ui.editWordSpecialIds(0x0400), [], 'no gate without bit 8');
    assert.deepStrictEqual(ui.editWordSpecialIds(0x2708), ['drift-n', 'gate-boy']);
});

test('editing a vanilla room draws its own triggers and specials; a custom map only its own', () => {
    const p = Object.assign(tilePalette(), { roomId: 0x34,
        entries: [[0, 0xa800, 0x19ce, 0x2008, 1], [1, 0xa800, 0x19cc, 0x101f, 1], [2, 0x358a, 0x19cc, 0x0010, 0]],
        attachments: { bTrigger: [[0, 0, 1, 0, 0x99]], stepOn: [], objects: [] } });
    ui.setPalette(p);
    const d = ui.editReset(0x34);
    assert.strictEqual(ui.editOnRomRoom(), false, 'not while browsing');
    d.on = true;
    assert.strictEqual(ui.editOnRomRoom(), true);
    assert.ok(ui.editTriggerSvg({ x: 0, y: 0 }).includes('rg-trigger-placed-b'), 'the room\'s B-trigger is drawn');
    // Stamp 0 carries drift north; the grid has it at 0,0 1,1 2,1... per palette().grid.
    const svg = ui.editRoomSpecialsSvg(p, { x: 0, y: 0 }, d, {});
    assert.ok(svg.includes('↑'), 'its drift shows with the Special tab\'s glyph');
    d.customKey = 'custom-x';
    assert.strictEqual(ui.editOnRomRoom(), false);
    assert.ok(!ui.editTriggerSvg({ x: 0, y: 0 }).includes('rg-trigger-placed'), 'a custom map draws only placed ones');
});
test('an object whose states all look alike starts collapsed; rows reorder by drag, one undo step', () => {
    const p = Object.assign(tilePalette(), { roomId: 0x34 });
    const here = p.grid[0][0], other = [0, 1, 2].find((i) => i !== here && i !== p.grid[0][1]);
    p.roomObjects = [
        { index: 0, x: 0, y: 0, w: 1, h: 1, frames: [{ '0,0': here }] },        // a sniff spot: nothing changes
        { index: 1, x: 1, y: 0, w: 1, h: 1, frames: [{ '0,0': other }] },       // a real change
    ];
    ui.setPalette(p);
    const d = ui.editReset(0x34);
    ui.editSeedRoomObjects();
    const [a, b] = ui.editObjects();
    assert.ok(ui.objectLooksStatic(a) && !ui.objectIsOpen(a), 'alike: collapsed');
    assert.ok(!ui.objectLooksStatic(b) && ui.objectIsOpen(b), 'changes: open');
    const html = ui.objectTabHtml();
    assert.ok(!html.includes('Base look'), 'no State 0 caption');
    assert.ok(html.includes('draggable="true"') && html.includes('rg-trigger-where'), 'drawn like a trigger row');
    ui.objectReorder(b.uid, a.uid);
    assert.deepStrictEqual(ui.editObjects().map((o) => o.roomObject), [1, 0]);
    assert.strictEqual(d.undo.length, 1, 'one undo step');
    ui.editUndo(p);
    assert.deepStrictEqual(ui.editObjects().map((o) => o.roomObject), [0, 1]);
});


test('an object’s caret is kept per map: uids start again in every map', () => {
    const p = Object.assign(tilePalette(), { roomId: 0x34 });
    const other = [0, 1, 2].find((i) => i !== p.grid[0][1]);
    p.roomObjects = [{ index: 0, x: 1, y: 0, w: 1, h: 1, frames: [{ '0,0': other }] }];
    ui.setPalette(p);
    ui.editReset(0x34);
    ui.editSeedRoomObjects();
    const o = ui.editObjects()[0];
    ui.setObjectOpen('0x33-elsewhere:' + o.uid, false);   // the same uid, closed in another map
    assert.ok(ui.objectIsOpen(o), 'another map\'s caret does not reach this one');
});

test('a locked map’s trigger rows have no grip, no remove, and do not drag', () => {
    ui.setPalette(tilePalette());
    const d = ui.editReset(0x34);
    d.on = true;
    d.placed.push({ kind: 'bTrigger', x: 0, y: 0, w: 2, h: 3, scriptId: 1, uid: 1 });
    assert.ok(ui.triggerTab().includes('#0 · 2×3 tiles'), 'size as W×H tiles');
    assert.ok(ui.triggerTab().includes('draggable="true"'));
    d.locked = true;
    const html = ui.triggerTab();
    assert.ok(!html.includes('draggable') && !html.includes('rg-trigger-grip') && !html.includes('data-trigger-remove'));
});

test('trigger rows start collapsed, say what their script does, and open to its lines; Enter shows the enter script', () => {
    const p = Object.assign(tilePalette(), { roomId: 0x34 });
    p.attachments = { bTrigger: [[1, 1, 2, 2, 0x201]], stepOn: [], objects: [] };
    ui.setPalette(p);
    const d = ui.editReset(0x34);
    d.on = true;
    const script = { scriptId: 0x201, scriptAddressSnes: 0x96ab5e, terminated: true,
        loot: [{ itemName: 'Mushroom', amount: 2 }],
        instructions: [{ addressSnes: 0x96ab5e, opcodeHex: '0x3c', summary: 'give Mushroom ×2' },
                       { addressSnes: 0x96ab62, opcodeHex: '0x00', terminal: true }] };
    ui.setPanelRoom({ content: { triggers: { bTrigger: [script], stepOn: [],
        enter: { scriptAddressSnes: 0x96b630, instructions: [{ addressSnes: 0x96b630, summary: 'fade in' }] } } } });
    let html = ui.triggerTab();
    assert.ok(html.replace(/<[^>]+>/g, '').includes('Mushroom ×2'), 'the collapsed row says what it hands over');
    assert.ok(!html.includes('give Mushroom'), 'collapsed: no script lines');
    ui.triggerToggle('b:base:0');
    html = ui.triggerTab();
    const text = html.replace(/<[^>]+>/g, '');
    assert.ok(text.includes('give Mushroom ×2') && text.includes('op 0x00'), 'open: one line per instruction, summary or opcode');
    assert.ok(html.includes('<span class="sx-num">0x00</span>'), 'numbers are coloured');
    assert.ok(html.includes('data-script-addr="96AB5E"'), 'the emulator highlight can find the line');
    ui.triggerEnterPick(true);
    html = ui.triggerTab();
    assert.ok(html.includes('fade in') && html.includes('rg-trigger-kind-enter on'), 'the Enter tab shows the enter script');
    assert.ok(!html.includes('data-trigger-ref'), 'and no trigger rows');
    ui.triggerEnterPick(false);
    ui.setPanelRoom(null);
});

test('a pickup reads as its Everscript, and script lines colour numbers, names and the closing note', () => {
    assert.strictEqual(ui.triggerScriptWhat({ loot: [{ itemName: 'Oil', amount: 1 }], everscript: ['_loot_chest(0x03, OIL);'] }),
        '_loot_chest(0x03, OIL);');
    const h = ui.scriptHighlight('IF $2273&0x01 SKIP 19 (to 0x94e65d)');
    assert.ok(h.includes('SKIP <span class="sx-num">19</span>'), 'the skip count is a value');
    assert.ok(h.includes('<span class="sx-aside">(to '), 'the note that ends the line is dimmed');
    assert.ok(!ui.scriptHighlight('$2273 |= 0x01 if ($22ea & 0x01) else $2273 &= ~0x01').includes('sx-aside'),
        'a condition mid-line is not a note');
    assert.ok(ui.scriptHighlight('CALL "Loot gourd?" (0x3a)').includes('<span class="sx-str">"Loot gourd?"</span>'));
});

test('an object row says what the script that names it hands over, as its Everscript', () => {
    const p = Object.assign(tilePalette(), { roomId: 0x34 });
    const other = [0, 1, 2].find((i) => i !== p.grid[0][1]);
    p.roomObjects = [{ index: 1, x: 1, y: 0, w: 1, h: 1, frames: [{ '0,0': other }] }];
    p.attachments = { bTrigger: [[1, 0, 1, 0, 0x73e]], stepOn: [], objects: [] };
    ui.setPalette(p);
    ui.editReset(0x34).on = true;
    ui.editSeedRoomObjects();
    ui.setPanelRoom({ content: { triggers: { stepOn: [], bTrigger: [{ scriptId: 0x73e, instructions: [],
        loot: [{ objectId: 0, itemName: 'Wax', amount: 1 }, { objectId: 1, itemName: 'Oil', amount: 1 }],
        everscript: ['_loot_chest(0x00, WAX, 0d01);', '_loot_chest(0x01, OIL, 0d01);'] }] } } });
    const text = ui.objectTabHtml().replace(/<[^>]+>/g, '');
    assert.ok(text.includes('_loot_chest(0x01, OIL, 0d01);'), 'its own call, by object number: ' + text);
    assert.ok(!text.includes('WAX'), 'not the other object’s');
    ui.setPanelRoom(null);
});

test('the lock and the ⋯ menu sit on the room’s name line; locked, the tools that change the map go dark', () => {
    ui.setPalette(tilePalette());
    const d = ui.editReset(0x34);
    d.on = true;
    d.tool = 'paint';
    d.locked = false;
    let html = ui.toolbar();
    const acts = ui.headActs();
    assert.ok(/id="rg-lock-btn"[^>]*data-edit-act="lock"/.test(acts) && acts.includes('<svg class="rg-lock-ic"'), 'a padlock on the name line');
    assert.ok(!html.includes('rg-lock-btn') && !html.includes('rg-tool-dropdown'), 'not on the tool pill');
    assert.ok(!/data-edit-tool="paint"[^>]*disabled/.test(html), 'unlocked: the pencil works');
    ui.editAction('lock');
    assert.strictEqual(d.locked, true);
    assert.strictEqual(d.tool, 'select', 'locking puts the pencil down');
    html = ui.toolbar();
    ['paint', 'erase', 'move', 'stamp'].forEach((k) =>
        assert.ok(new RegExp('data-edit-tool="' + k + '"[^>]*disabled').test(html), k + ' is off while locked'));
    ['select', 'pick', 'copy'].forEach((k) =>
        assert.ok(!new RegExp('data-edit-tool="' + k + '"[^>]*disabled').test(html), k + ' still works'));
    assert.ok(/data-edit-act="undo"[^>]*disabled/.test(html), 'undo too');
    assert.ok(/data-edit-level="1"[^>]*disabled/.test(html), 'and the level bar');
    ui.editAction('lock');
    assert.strictEqual(d.locked, false);
});

test('“Loot only” narrows the trigger list to what hands something over, and rows keep their numbers', () => {
    const p = Object.assign(tilePalette(), { roomId: 0x34 });
    p.attachments = { bTrigger: [[0, 0, 0, 0, 0x100], [1, 0, 1, 0, 0x101]], stepOn: [], objects: [] };
    ui.setPalette(p);
    ui.editReset(0x34).on = true;
    ui.setPanelRoom({ content: { triggers: { stepOn: [], bTrigger: [
        { scriptId: 0x100, instructions: [] },
        { scriptId: 0x101, instructions: [], loot: [{ objectId: 0, itemName: 'Oil', amount: 1 }] }] } } });
    let html = ui.triggerTab();
    assert.ok(html.includes('Loot only · 1'), 'the chip counts the rows with loot');
    assert.strictEqual((html.match(/data-trigger-ref=/g) || []).length, 2, 'off: every row');
    ui.lootFilterToggle('trigger');
    html = ui.triggerTab();
    assert.strictEqual((html.match(/data-trigger-ref=/g) || []).length, 1, 'on: only the loot row');
    assert.ok(html.replace(/<[^>]+>/g, '').includes('#1 · 1×1 tiles'), 'still #1, its place in the table');
    ui.lootFilterToggle('trigger');
    ui.setPanelRoom(null);
});

test('a hover shows what a click would do, and looking adds nothing to the dictionary', () => {
    const p = palette();
    ui.setPalette(p);
    const d = ui.editReset(0x34);
    d.on = true;
    ui.setTab('tile');
    ui.setLayerForce(null);
    d.tool = 'paint';
    d.brush = 2;
    ui.setPreviewCell({ x: 0, y: 0 });
    assert.ok(ui.editPreviewSvg().includes('rg-preview-box'), 'the pencil: a box where the tile lands');
    assert.strictEqual(d.added.length, 0, 'no stamp made by looking');
    assert.deepStrictEqual(d.cells, {}, 'nor a cell written');
    d.tool = 'erase';
    ui.setPreviewCell({ x: 1, y: 1 });
    assert.ok(ui.editPreviewSvg().includes('rg-preview-erase'), 'the eraser over front art: struck through');
    ui.setPreviewCell({ x: 0, y: 0 });
    assert.ok(!ui.editPreviewSvg().includes('rg-preview-erase'), 'over bare ground it has nothing to take');
    assert.strictEqual(d.added.length, 0, 'and the eraser preview made no stamp either');
    d.locked = true;
    assert.strictEqual(ui.editPreviewSvg(), '', 'locked: nothing would happen, so nothing is shown');
    d.locked = false;
    ui.setPreviewCell(null);
    d.tool = 'paint';
});

test('a widget canvas goes down to 1×1, a room stays at 2×2; its name line becomes an app bar', () => {
    assert.strictEqual(ui.clampRoomSide(0, 5), 2, 'a room: 2 is the smallest grid that encodes');
    assert.strictEqual(ui.clampRoomSide(1, 5), 2);
    ui.setWidgetEdit({ key: 'widget-t', widget: 'w-t', name: 'Pot', w: 1, h: 1, borrow: 0x34 });
    assert.strictEqual(ui.clampRoomSide(1, 5), 1, 'a widget: one cell is fine');
    assert.strictEqual(ui.clampRoomSide(0, 5), 1, 'and a drag past it stops there, not back at the start');
    const head = ui.widgetEditHeadHtml();
    assert.ok(/rg-appbar-back[^>]*data-widget-act="done"/.test(head), 'back on the left saves and returns');
    assert.ok(head.includes('id="rg-widget-name"') && head.includes('value="Pot"'), 'the name is the title');
    assert.ok(head.includes('1×1'), 'with its size under it');
    ui.editReset(0x34).on = true;
    const acts = ui.headActs();
    assert.ok(acts.includes('data-widget-act="delete"') && !acts.includes('rg-lock-btn'), 'the widget’s actions replace the map’s');
    ui.setWidgetEdit(null);
});

test('a widget with no tiles — a sniff spot — still places its trigger and object, and is selected by its box', () => {
    const p = palette();
    ui.setPalette(p);
    const d = ui.editReset(0x34);
    d.on = true;
    const sniff = { name: 'sniff spot', w: 1, h: 1, cells: [], attachments: {
        bTrigger: [{ dx: 0, dy: 0, w: 1, h: 1, scriptId: null }], stepOn: [],
        objects: [{ dx: 0, dy: 0, w: 1, h: 1, states: 2, cells: [], frames: [[]] }] } };
    const got = ui.editStampGroup(p, sniff, 2, 1);
    assert.strictEqual(got.placed, 2, 'the B-trigger and the object');
    assert.strictEqual(d.placed.filter((x) => !x.removed).length, 2);
    assert.deepStrictEqual(d.cells, {}, 'and no tile written');
    assert.strictEqual(d.groups.length, 1);
    assert.deepStrictEqual([d.groups[0].w, d.groups[0].h], [1, 1], 'its box is the widget’s size');
    assert.strictEqual(ui.editGroupAt(2, 1), d.groups[0], 'found by its box');
    assert.strictEqual(ui.editGroupAt(0, 0), null);
    assert.strictEqual(ui.editGroupMove(p, d.groups[0].uid, 5, 5), false, 'it cannot be moved off the map');
    assert.strictEqual(ui.editGroupMove(p, d.groups[0].uid, 0, 0), true);
    assert.ok(d.placed.every((x) => x.x === 0 && x.y === 0), 'its parts move with it');
    const empty = ui.editStampGroup(p, { name: 'nothing', w: 1, h: 1, cells: [], attachments: {} }, 0, 0);
    assert.ok(!empty.placed && d.groups.length === 1, 'a widget with nothing at all places nothing');
});

test('the ⋯ menu has no discard or new room; a custom map renames; Escape lets go of what is on the pointer', () => {
    ui.editReset(0x34).on = true;
    const acts = ui.headActs();
    assert.ok(!acts.includes('data-edit-act="clear"') && !acts.includes('data-edit-act="new-room"'), 'both entries are gone');
    assert.ok(acts.includes('data-edit-act="export-rom"'), 'the rest stay');

    const m = { key: 'custom-t', name: 'Old', borrow: 0x34, w: 16, h: 14 };
    ui.setCustom([m], null);
    ui.customRename('custom-t', '  New name ');
    assert.strictEqual(m.name, 'New name', 'trimmed');
    ui.customRename('custom-t', '   ');
    assert.strictEqual(m.name, 'New name', 'an empty name is not applied');
    ui.setCustom([], null);

    const d = ui.editDraft();
    d.constructs.push({ name: 'pot', w: 1, h: 1, cells: [], attachments: {} });
    ui.setTab('widgets');
    d.tool = 'paint';
    ui.editPutDown(d);
    assert.strictEqual(ui.construct(), -1, 'the widget is disarmed');
    assert.strictEqual(d.tool, 'select', 'and the pencil put down');
    d.tool = 'pick';
    ui.editPutDown(d);
    assert.strictEqual(d.tool, 'pick', 'a tool that draws nothing stays');
    ui.setTab('tile');
});

test('see-through (bit 6) is a special: painted, read back off a ROM word, and taken off by the eraser', () => {
    const p = palette();
    ui.setPalette(p);
    ui.editReset(0x34);
    const i = ui.editSpecialAppliedIndex(p, 0, 'plane-transparent', false);
    assert.strictEqual(ui.editStampWords(p, i).collision, 0x101f | 0x40, 'bit 6 set, the rest kept');
    assert.deepStrictEqual(ui.editWordSpecialIds(0x0050), ['plane-transparent'], 'a vanilla word with bit 6 shows it');
    const off = ui.editSpecialAppliedIndex(p, i, null, true);
    assert.strictEqual(ui.editStampWords(p, off).collision & 0x40, 0, 'the eraser clears it');
});

test('a ROM room’s grass shows what is beneath it while Cuttable is off', () => {
    const p = Object.assign(palette(), { roomId: 0x34, imageUri: 'data:img', imageWidth: 48, imageHeight: 16,
        columns: 3, cell: 16, cuttable: [[0, 0, 2], [1, 0, -1]] });
    ui.setPalette(p);
    const d = ui.editReset(0x34);
    d.on = true;
    ui.setCutLayer(false);
    const svg = ui.editRoomCutBeneathSvg(p, null, { x: 0, y: 0 });
    assert.strictEqual((svg.match(/rg-cut-beneath/g) || []).length, 1, 'the cell with a known cut stamp, only');
    assert.ok(svg.includes('viewBox="32 0 16 16"'), 'drawn with the stamp the swap table names (index 2)');
    d.cells['0,0'] = 1;
    assert.strictEqual(ui.editRoomCutBeneathSvg(p, null, { x: 0, y: 0 }), '', 'a cell the draft changed is the draft’s');
    delete d.cells['0,0'];
    ui.setCutLayer(true);
    assert.strictEqual(ui.editRoomCutBeneathSvg(p, null, { x: 0, y: 0 }), '', 'on: the grass is shown, to be edited');
    ui.setCutLayer(false);
});

test('an object’s tiles get the grid drawn back over them, under the grid toggles’ classes', () => {
    const svg = ui.editGridPatchSvg({ x: 4, y: 2 }, 2, 1);
    assert.ok(/class="rg-grid-fine rg-grid-patch"/.test(svg) && /class="rg-grid-coarse rg-grid-patch"/.test(svg));
    assert.ok(svg.includes('M4 2V4') && svg.includes('M8 2V4'), 'lines at both edges of the 2×1 box');
});

test('disbanding a widget stamped on a pasted floor keeps it on top: the floor beneath gives those cells up', () => {
    const { p, d } = fresh();
    const FLOOR = { name: 'floor', w: 3, h: 1, attachments: {},
        cells: [0, 1, 2].map((dx) => ({ dx, dy: 0, canopy: { word: 0xa800 }, terrain: { word: 0x0c02 }, collision: 0x0010 })) };
    ui.editStampGroup(p, FLOOR, 0, 1);
    ui.editStampGroup(p, GOURD, 0, 1);
    const words = (x, y) => { const w = ui.editStampWords(p, ui.editCellAt(p, x, y)); return [w.layer1, w.layer2]; };
    const before = [0, 1, 2].map((x) => words(x, 1));
    assert.deepStrictEqual(before[0], [0x358a, 0x0c02], 'the gourd, on the pasted floor');
    ui.editGroupDisband(p, d.groups[1].uid);
    assert.deepStrictEqual([0, 1, 2].map((x) => words(x, 1)), before, 'the map shows exactly what it did');
    assert.strictEqual(d.groups.length, 1, 'the floor stays a group');
    assert.deepStrictEqual(d.groups[0].cells.map((c) => c.dx), [2], 'minus the cells the map now holds');
    ui.editUndo(p);
    assert.strictEqual(d.groups.length, 2, 'undo brings the widget back');
    assert.strictEqual(d.groups[0].cells.length, 3, 'and the floor whole');
});

test('freeing a family slot by hand is one undo step, and redo frees it again', () => {
    const { p, d } = fresh();
    d.families = [35, 187, 58];
    ui.chipDrop(1);
    assert.strictEqual(d.families[1], undefined);
    assert.strictEqual(d.undo.length, 1, 'one step');
    ui.editUndo(p);
    assert.strictEqual(d.families[1], 187, 'undo puts it back in its slot');
    ui.editRedo(p);
    assert.strictEqual(d.families[1], undefined, 'redo frees it again, a hole and not a null');
    assert.ok(!d.families.includes(null));
});

test('a resize is one undo step that redo can repeat; a rename is not on the history', () => {
    const { p, d } = fresh();
    d.start = { x: 5, y: 5 };
    ui.editResizeStep({ w: 16, h: 14 }, { w: 4, h: 4 });
    d.start = { x: 3, y: 3 };                       // what the shrink's blank room clamps him to
    assert.ok(ui.editUndo(p));
    assert.ok(ui.resizeKeep(), 'undo asks for the old size, keeping the cells');
    assert.deepStrictEqual(d.start, { x: 5, y: 5 }, 'and the Boy goes back where he was');
    assert.deepStrictEqual(d.redo[d.redo.length - 1].resize, { before: { w: 16, h: 14 }, after: { w: 4, h: 4 } });
    assert.ok(ui.editRedo(p), 'redo is there');
    assert.ok(ui.resizeKeep());
    const m = { key: 'custom-r', name: 'A', borrow: 0x34, w: 16, h: 14 };
    ui.setCustom([m], null);
    const steps = d.undo.length;
    ui.customRename('custom-r', 'B');
    assert.strictEqual(d.undo.length, steps, 'renaming adds no step');
    ui.setCustom([], null);
});

test('the eraser leaves a placed widget’s tiles alone until it is disbanded', () => {
    const { p, d } = fresh();
    ui.editStampGroup(p, GOURD, 0, 1);
    d.tool = 'erase';
    const steps = d.undo.length;
    ui.editBegin(); ui.editStroke({ x: 0, y: 1 }, 'down'); ui.editEnd();
    assert.strictEqual(d.undo.length, steps, 'locked: nothing written');
    assert.deepStrictEqual(d.cells, {});
    ui.editGroupDisband(p, d.groups[0].uid);
    ui.editBegin(); ui.editStroke({ x: 0, y: 1 }, 'down'); ui.editEnd();
    assert.strictEqual(d.undo.length, steps + 2, 'disbanded: its tile is the map’s, and erasable');
    d.tool = 'paint';
});

test('the Collision tab sets a shape over the tile’s estimate; erasing brings the estimate back', () => {
    const { p, d } = fresh();
    ui.setTab('collision');
    const html = ui.collisionTabHtml();
    assert.strictEqual((html.match(/data-coll-pick=/g) || []).length, 17, 'the 8px pen, and every geometry code §5 documents');
    assert.ok(html.includes('diagonal SW · slides') && html.includes('diagonal SW · stops'), 'diagonal twins say which is which');
    ui.collPick(0x0f);
    assert.strictEqual(d.tool, 'paint', 'picking arms the pencil');
    ui.editBegin(); ui.editStroke({ x: 1, y: 0 }, 'down'); ui.editEnd();
    assert.strictEqual(ui.editCollisionAt(1, 0), 0x0f);
    assert.deepStrictEqual(d.cells, {}, 'the tile itself is untouched — its estimate stays in its stamp');
    assert.strictEqual(ui.editCollisionApplied(1, 0, 0x2018), 0x001f, 'applied: the shape, always-walkable cleared, the level kept');
    assert.strictEqual(ui.editCollisionApplied(2, 0, 0x2018), 0x2018, 'a cell without one is its own');
    assert.deepStrictEqual(ui.editExport(p).collisionOverrides, [{ x: 1, y: 0, geometry: 0x0f }], 'the handoff carries it apart');
    ui.editUndo(p);
    assert.strictEqual(ui.editCollisionAt(1, 0), -1, 'one undo step');
    ui.editRedo(p);
    d.tool = 'erase';
    ui.editBegin(); ui.editStroke({ x: 1, y: 0 }, 'down'); ui.editEnd();
    assert.strictEqual(ui.editCollisionAt(1, 0), -1, 'the eraser takes it off');
    d.tool = 'paint';
    ui.setTab('tile');
});

test('Cmd/Ctrl+A selects the whole map for the copy tool', () => {
    const { p, d } = fresh();
    assert.ok(ui.editClipboardKeyTest('a'));
    assert.strictEqual(d.tool, 'copy');
    assert.deepStrictEqual(ui.getEditSel(), { x1: 0, y1: 0, x2: p.widthTiles - 1, y2: p.heightTiles - 1 });
    ui.setSel(null);
    d.tool = 'paint';
});

test('the Collision tab’s filter hides what no vanilla room places', () => {
    const { p } = fresh();
    p.vanillaGeometry = [9, 1, 1, 1, 0, 1, 1, 1, 1, 1, 1, 0, 1, 1, 1, 9];
    let html = ui.collisionTabHtml();
    assert.strictEqual((html.match(/data-coll-pick=/g) || []).length, 15, '0x04 and 0x0B hidden');
    ui.collClick({ dataset: { collVanilla: '1' } });
    html = ui.collisionTabHtml();
    assert.strictEqual((html.match(/data-coll-pick=/g) || []).length, 17, 'off: all of them');
    assert.ok(html.includes('open in the engine’s tables, and no vanilla room places it'));
    ui.collClick({ dataset: { collVanilla: '1' } });
    delete p.vanillaGeometry;
});

test('one pen: it draws and carves 8px squares into the predicted collision; a cell takes a tile only while it matches', () => {
    // Bits: 1 TL, 2 TR, 4 BL, 8 BR; the second argument picks the twin that stops.
    assert.strictEqual(ui.collCodeOfQuarters(0, false), 0x00, '__ / __: open');
    assert.strictEqual(ui.collCodeOfQuarters(15, false), 0x0f, '## / ##: solid');
    assert.strictEqual(ui.collCodeOfQuarters(1 | 4 | 8, false), 0x02, '#_ / ##: 45°');
    assert.strictEqual(ui.collCodeOfQuarters(2 | 4 | 8, false), 0x01, '_# / ##: 45°');
    assert.strictEqual(ui.collCodeOfQuarters(1 | 4 | 8, true), 0x06, 'the twin that stops');
    assert.strictEqual(ui.collCodeOfQuarters(1 | 2, false), 0x0c, '## / __: the top half');
    assert.strictEqual(ui.collCodeOfQuarters(1, false), -1, '#_ / __: invalid');
    assert.strictEqual(ui.collCodeOfQuarters(8, false), -1, '__ / _#: invalid');
    assert.strictEqual(ui.collCodeOfQuarters(1 | 8, false), -1, 'opposite corners: invalid');
    const { p, d } = fresh();
    ui.setTab('collision');
    ui.collPick(-1);
    assert.ok(ui.editDrawable().icon.includes('rg-coll-swatch'), 'the pencil’s badge shows the pen');
    assert.strictEqual(ui.editStampWords(p, ui.editCellAt(p, 2, 1)).collision & 0x0f, 0x0f, 'predicted solid here');
    const at = (how, qx, qy) => { ui.editBegin(); ui.editCollisionStrokeTest({ x: 2, y: 1, qx, qy }, how); ui.editEnd(); };
    at('draw', 0, 0);
    assert.strictEqual((d.collDraw || {})['2,1'], undefined, 'drawing on solid changes nothing');
    at('carve', 1, 0);
    assert.strictEqual(ui.editCollisionAt(2, 1), 0x02, 'carving a corner off the prediction: the 45°');
    at('carve', 1, 1);
    assert.strictEqual(ui.editCollisionAt(2, 1), 0x07, 'and another: the left half');
    at('carve', 0, 0);
    assert.strictEqual(ui.editCollisionAt(2, 1), -1, 'a lone corner matches none: the cell keeps its own');
    assert.strictEqual((d.collDraw || {})['2,1'], 4, 'but it stays drawn');
    at('carve', 0, 1);
    assert.strictEqual(ui.editCollisionAt(2, 1), 0x00, 'all carved away: open');
    at('draw', 0, 0); at('draw', 1, 0); at('draw', 0, 1); at('draw', 1, 1);
    assert.strictEqual((d.collDraw || {})['2,1'], undefined, 'drawn back to the prediction: no override left');
    ui.collPick(0x0c);
    at('draw');
    assert.strictEqual(ui.editCollisionAt(2, 1), 0x0c, 'a picked shape sets the whole cell');
    at('carve');
    assert.strictEqual(ui.editCollisionAt(2, 1), 0x00, 'right-click with a shape opens the cell');
    at('reset');
    assert.strictEqual(ui.editCollisionAt(2, 1), -1, 'the eraser: back to the prediction');
    ui.collPick(-1);
    ui.setTab('tile');
    d.tool = 'paint';
});

test('a drawn L shows as the 45° tile it makes; a lone corner shows as unmatched, not in a level colour', () => {
    const { d } = fresh();
    ui.setTab('collision');
    d.collDraw = { '0,0': 1 | 4 | 8, '1,0': 1 };
    const svg = ui.editCollisionOverlaySvg({ x: 0, y: 0 });
    assert.ok(svg.includes(ui.collMaskPath(0x02, 0, 0, 2 / 16)), 'the L is drawn as diagonal SW');
    assert.ok(/drawn: diagonal SW/.test(svg));
    assert.ok(/class="rg-coll-drawn bad"[\s\S]*>\?<\/text>/.test(svg), 'the corner gets a "?"');
    assert.ok(/no collision tile looks like this/.test(svg));
    d.collDraw = {};
    ui.setTab('tile');
});

test('prediction card supports relationship +, vanilla examples, and procedural fill modes', () => {
    const { d } = fresh();
    const p = tilePalette();
    ui.setPalette(p);
    // Arm brush with a stamp whose layer2 has graphic 0x0422 (chr 0 in palette slot 0)
    d.brush = ui.editAddStamp(p, { layer1: 0xa800, layer2: 0x0400, collision: 0 });
    ui.setBrushTile({ graphic: 0x0422, family: 35 });
    ui.setPanelOpen('neighbours', true);
    // Initial call sets _nbKey
    ui.neighbourCardHtml();
    ui.applyNeighbourTiles({
        graphic: 0x0422,
        terrain: { n: [], e: [], s: [], w: [] },
        canopy: { n: [], e: [], s: [], w: [] },
    });

    // Initial default mode is cross (relationship +)
    let card = ui.neighbourCardHtml();
    assert.ok(card.includes('data-nb-mode="cross"'));
    assert.ok(card.includes('data-nb-mode="examples"'));
    assert.ok(card.includes('data-nb-mode="fill"'));
    assert.ok(card.includes('class="rg-nb-plus"'), 'cross mode must render plus shape');

    // Switch to vanilla examples mode
    ui.setNbMode('examples');
    assert.strictEqual(ui.getNbMode(), 'examples');

    // Provide mock examples
    ui.applyVanillaExamples({
        graphic: 0x0422,
        examples: [{
            roomId: 1,
            hexId: '0x01',
            roomName: "Exterior of Blimp's Hut",
            area: 'Prehistoria',
            count: 3,
            layer: 'canopy',
            patch: [
                [null, { c: [10, 8, 0, 0] }, null],
                [{ c: [11, 8, 0, 0] }, { c: [0x0422, 8, 0, 0] }, { c: [12, 8, 0, 0] }],
                [null, { c: [13, 8, 0, 0] }, null],
            ],
        }],
    });
    card = ui.neighbourCardHtml();
    assert.ok(card.includes("Exterior of Blimp's Hut"), 'examples mode must render room name');
    assert.ok(card.includes('data-nb-example-stamp="0"'), 'examples mode must offer arm stamp');
    assert.ok(card.includes('data-nb-example-room="0x01"'), 'examples mode must offer open room');

    // Switch to procedural filling mode
    ui.setNbMode('fill');
    assert.strictEqual(ui.getNbMode(), 'fill');
    card = ui.neighbourCardHtml();
    assert.ok(card.includes('data-nb-regenerate="1"'), 'fill mode must render re-generate button');
    assert.ok(card.includes('data-nb-fill-stamp="1"'), 'fill mode must render arm stamp button');

    // Provide mock procedural fill patch
    ui.applyProceduralFill({
        graphic: 0x0422,
        patch: [
            [{ graphic: 10, family: 8 }, { graphic: 11, family: 8 }, { graphic: 12, family: 8 }],
            [{ graphic: 13, family: 8 }, { graphic: 0x0422, family: 8 }, { graphic: 14, family: 8 }],
            [{ graphic: 15, family: 8 }, { graphic: 16, family: 8 }, { graphic: 17, family: 8 }],
        ],
    });
    card = ui.neighbourCardHtml();
    assert.ok(card.includes('data-nb-tile-pick="10"'), 'fill mode renders generated tiles');

    // Reset back to cross
    ui.setNbMode('cross');
});

// What custom-host.js sends with the library for the urn's and the fan's art (ROM counts).
const URN_FAMILIES = {
    643: [[115, 49], [35, 11], [127, 8], [139, 7], [159, 6], [188, 2], [158, 1]],
    644: [[115, 49], [35, 11], [127, 7], [139, 7], [159, 6], [188, 2], [158, 1]],
    647: [[115, 49], [35, 22], [139, 14], [159, 6], [188, 4], [158, 2]],
    648: [[115, 49], [35, 23], [139, 14], [159, 6], [188, 4], [158, 2]],
    4739: [[220, 40], [291, 9], [231, 4]], 4740: [[220, 40], [291, 9], [231, 4]],
};

test('a widget is its cells: no frames, no variations; older libraries keep their first frame with art', () => {
    const ws = require('../../src/rooms/data/widget-store');
    const os = require('os');
    const tempFile = path.join(os.tmpdir(), 'widgets-test-' + Date.now() + '.json');
    const legacy = ws.saveWidget(tempFile, {
        id: 'w-legacy', name: 'Legacy Pot', w: 2, h: 2,
        cells: [{ dx: 0, dy: 0, canopy: { graphic: 10, family: 35, flags: 0 }, collision: 0 }],
    }).find((w) => w.id === 'w-legacy');
    assert.strictEqual(legacy.cells.length, 1);
    assert.ok(!('frames' in legacy) && !('variations' in legacy) && !('animated' in legacy));
    const fan = ws.saveWidget(tempFile, {
        id: 'w-fan', name: 'Fan', w: 1, h: 1, animated: true,
        frames: [{ cells: [{ dx: 0, dy: 0, terrain: { graphic: 4739, family: 220 } }], delay: 6 }, { cells: [], delay: 6 }],
    }).find((w) => w.id === 'w-fan');
    assert.strictEqual(fan.cells[0].terrain.graphic, 4739, 'frame 0 is what it stamps');
    assert.ok(!('frames' in fan));
    const raw = JSON.parse(fs.readFileSync(tempFile, 'utf8'));
    raw.widgets.push({ id: 'w-old', name: 'Old', w: 1, h: 1, cells: [], variations: [
        { id: 'fam-115', name: '#115', frames: [{ cells: [{ dx: 0, dy: 0, canopy: { graphic: 643, family: 115 } }], delay: 8 }] },
        { id: 'var-b', name: 'B', frames: [{ cells: [], delay: 8 }] }] });
    fs.writeFileSync(tempFile, JSON.stringify(raw));
    const old = ws.listWidgets(tempFile).find((w) => w.id === 'w-old');
    assert.strictEqual(old.cells[0].canopy.graphic, 643);
    assert.ok(!('variations' in old));

    // The editor has no variation row and no timeline: animation is the Animation tab's.
    ui.setWidgets([ui.widgetNormalize({ id: 'w-x', name: 'X', w: 1, h: 1, cells: [] })]);
    ui.setWidgetEdit({ key: 'widget-x', widget: 'w-x', name: 'X', w: 1, h: 1, borrow: 0x34 });
    const head = ui.widgetEditHeadHtml();
    assert.ok(!head.includes('data-widget-var') && !head.includes('Animation:'));
    ui.setWidgetEdit(null);
});

test('a colouring recolours every object state, and keeps each part’s animation', () => {
    ui.applyWidgets({ widgets: [], graphicFamilies: URN_FAMILIES });
    const anim = { frames: [643, 644], delays: [8, 8], init: 0 };
    const cell = (g, a) => ({ dx: 0, dy: 0, canopy: { graphic: g, family: 115, flags: 0, anim: a || null }, terrain: null });
    const urn = ui.widgetNormalize({ id: 'w-urn2', name: 'Urn', w: 1, h: 1, cells: [cell(643, anim)],
        attachments: { bTrigger: [], stepOn: [], objects: [{ dx: 0, dy: 0, w: 1, h: 1, states: 3, cells: [cell(643)], frames: [[cell(644)], [cell(647)]] }] } });
    ui.widgetEnsureVariations(urn);
    const c = ui.widgetConstruct(urn, urn.variations.findIndex((v) => v.id === 'fam-35'));
    const fams = [];
    const note = (cells) => (cells || []).forEach((x) => x.canopy && fams.push(x.canopy.family));
    note(c.cells);
    c.attachments.objects.forEach((o) => { note(o.cells); (o.frames || []).forEach(note); });
    assert.strictEqual(fams.length, 4);
    assert.ok(fams.every((f) => f === 35), 'every one in #35: ' + fams.join(','));
    assert.deepStrictEqual(c.cells[0].canopy.anim, anim, 'the part still moves');
    assert.strictEqual(urn.attachments.objects[0].cells[0].canopy.family, 115, 'the widget itself is untouched');
    assert.ok(ui.widgetAnimated(urn));
});

test('placed widgets render object-like cards with clickable variant preview chips and clean library cards', () => {
    const ws = require('../../src/rooms/data/widget-store');
    const os = require('os');
    const tempFile = path.join(os.tmpdir(), 'widgets-placed-test-' + Date.now() + '.json');

    ui.applyWidgets({ widgets: [], graphicFamilies: { 3736: [[166, 67], [184, 10], [35, 4]] } });
    const multiVarGourd = ws.saveWidget(tempFile, {
        id: 'w-gourd-variants', name: 'Prehistoric Gourd', w: 2, h: 2,
        cells: [{ dx: 0, dy: 0, canopy: { graphic: 3736, family: 166 } }],
    });
    const found = ui.widgetNormalize(multiVarGourd.find((w) => w.id === 'w-gourd-variants'));
    assert.ok(found);

    ui.setWidgets([found]);

    // 1. Library card is clean without ro-chips
    const cardHtml = ui.widgetCardHtml(found);
    assert.ok(!cardHtml.includes('ro-chips'), 'library card does not have ro-chips');
    assert.ok(!cardHtml.includes('rg-widget-card-chips'), 'library card does not have giant chip stack');
    assert.ok(cardHtml.includes('2×2 · 3v'), 'library card shows compact variation count badge');

    // 2. Placed widget renders as an object-like card (.rg-object-card.rg-placed-card)
    const placedGroup = {
        uid: 1, name: 'Prehistoric Gourd', x: 0, y: 0, w: 2, h: 2, level: 0,
        widget: 'w-gourd-variants',
        cells: [{ dx: 0, dy: 0, layer1: 0x1234, layer2: null, collision: null }],
        placed: [],
    };
    const rowHtml = ui.placedRowHtml(placedGroup, 0);

    assert.ok(rowHtml.includes('class="rg-object-card rg-placed-card'), 'renders as rg-object-card');
    assert.ok(rowHtml.includes('class="rg-trigger-row rg-placed-row'), 'contains placed trigger row');
    assert.ok(rowHtml.includes('class="rg-object-caret"'), 'contains expand/collapse caret');
    assert.ok(rowHtml.includes('class="rg-object-expanded"'), 'contains expanded section');
    assert.ok(rowHtml.includes('class="ro-chips"'), 'contains ro-chips container in placed widget');

    // 3. Variant preview chips
    assert.ok(rowHtml.includes('data-placed-var-uid="1" data-placed-var-idx="0"'), 'chip for variant 0');
    assert.ok(rowHtml.includes('data-placed-var-uid="1" data-placed-var-idx="1"'), 'chip for variant 1');
    assert.ok(rowHtml.includes('data-placed-var-uid="1" data-placed-var-idx="2"'), 'chip for variant 2');
    assert.ok(rowHtml.includes('class="ro-img rg-widget-var-thumb"'), 'variant image thumbnail');
    assert.ok(rowHtml.includes('<span class="ro-lbl">#166</span>'), 'variant label 166');
    assert.ok(rowHtml.includes('<span class="ro-lbl">#184</span>'), 'variant label 184');
    assert.ok(rowHtml.includes('<span class="ro-lbl">#35</span>'), 'variant label 35');
    assert.ok(rowHtml.includes('ro-chip sel'), 'default variant is selected');

    // 4. No extra buttons like + or delete
    assert.ok(!rowHtml.includes('ro-chip-add'), 'no + button on placed chips');
    assert.ok(!rowHtml.includes('rg-widget-var-del'), 'no delete variation buttons');

    // 5. Switching variation
    const p = tilePalette();
    p.widthTiles = 10;
    p.heightTiles = 10;
    p.tileFamilies = [166, 184, 35];
    ui.setPalette(p);
    ui.editReset(1).on = true;
    const d = ui.editDraft();
    d.groups = [placedGroup];
    ui.placedSetVariation(p, 1, 1);
    assert.strictEqual(placedGroup.variationIdx, 1, 'placed widget switched to variation index 1');
    assert.strictEqual(placedGroup.variation, 'fam-184', 'placed widget has colouring #184');

    const updatedRowHtml = ui.placedRowHtml(placedGroup, 0);
    assert.ok(updatedRowHtml.includes('data-placed-var-idx="1" title="Variation #184"><i class="ro-img rg-widget-var-thumb"'), 'variant 1 rendered as active');
});


test('a widget offers every colouring vanilla attests for any of its pieces, and no other', () => {
    const urnCells = [
        { dx: 0, dy: 0, canopy: { graphic: 643, family: 115, flags: 0 }, terrain: null },
        { dx: 1, dy: 0, canopy: { graphic: 644, family: 115, flags: 0 }, terrain: null },
        { dx: 0, dy: 1, canopy: { graphic: 647, family: 115, flags: 0 }, terrain: null },
        { dx: 1, dy: 1, canopy: { graphic: 648, family: 115, flags: 0 }, terrain: null },
    ];
    ui.applyWidgets({ widgets: [], graphicFamilies: URN_FAMILIES });
    // A union, by summed uses: #127 colours only the top half and still counts.
    assert.deepStrictEqual(ui.widgetAttestedFamilies(urnCells), [115, 35, 139, 159, 127, 188, 158]);
    assert.strictEqual(ui.widgetAttestedFamilies([{ dx: 0, dy: 0, canopy: { graphic: 1, family: 2 } }]), null);

    // Colourings are derived, never kept: a widget saved with invented ones loses them on load.
    const old = [115, 35, 127, 139, 159, 188, 158, 128, 111, 141].map((f) => ({ id: 'fam-' + f, name: '#' + f,
        frames: [{ cells: urnCells.map((c) => ({ ...c, canopy: { ...c.canopy, family: f } })) }] }));
    const saved = ui.widgetNormalize({ id: 'w-old', cells: urnCells, variations: old });
    ui.widgetEnsureVariations(saved);
    assert.deepStrictEqual(saved.variations.map((v) => v.id), ['fam-115', 'fam-35', 'fam-139', 'fam-159', 'fam-127', 'fam-188', 'fam-158']);
});

test('switching a placed widget variation replaces its family slot, and deleting it frees the slot', () => {
    const urnCells = [{ dx: 0, dy: 0, canopy: { graphic: 643, family: 115, flags: 0 }, terrain: null }];
    const urnWidget = { id: 'w-urn', name: 'Antiqua Urn', w: 1, h: 1, cells: urnCells };
    ui.applyWidgets({ widgets: [], graphicFamilies: URN_FAMILIES });
    ui.widgetEnsureVariations(urnWidget);
    const p = tilePalette();
    p.widthTiles = 10;
    p.heightTiles = 10;
    p.tileFamilies = [206];
    ui.setPalette(p);
    ui.editReset(1).on = true;
    const d = ui.editDraft();
    d.families = [206];
    ui.applyWidgets({ widgets: [urnWidget] });
    ui.widgetEnsureVariations(urnWidget);
    const c = ui.widgetConstruct(urnWidget, 0);
    c.widget = 'w-urn'; c.variation = 'fam-115';
    ui.editStampGroup(p, c, 2, 2);
    const g = d.groups[0];
    assert.deepStrictEqual(ui.editFamilies().filter((f) => f !== undefined), [206, 115], 'stamping brings #115 in');

    for (let idx = 1; idx < urnWidget.variations.length; idx++) {
        ui.placedSetVariation(p, g.uid, idx);
        const want = Number(urnWidget.variations[idx].id.slice(4));
        assert.strictEqual(g.variationIdx, idx);
        assert.deepStrictEqual(ui.editFamilies().filter((f) => f !== undefined), [206, want], `variant ${idx} replaced the old family`);
    }
    // One undo step per switch, slots included.
    ui.editUndo(p);
    assert.deepStrictEqual(ui.editFamilies().filter((f) => f !== undefined), [206, Number(urnWidget.variations[urnWidget.variations.length - 2].id.slice(4))]);
    ui.editRedo(p);

    ui.editGroupDelete(g.uid);
    assert.deepStrictEqual(ui.editFamilies().filter((f) => f !== undefined), [206], 'the widget took its family with it');
    ui.editUndo(p);
    assert.strictEqual(ui.editFamilies().filter((f) => f !== undefined).length, 2, 'undoing the delete brings it back');
});


// ── animated tiles (map-editor-animations.js, map-editor-anim-tab.js) ─────

const TORCH = { frames: [2742, 2743, 2744, 2745, 2746, 2744], delays: [5, 5, 5, 5, 3, 3] };
const chrOf = (slot) => (slot >> 3) * 0x20 + (slot & 7) * 2;
const slotOfWord = (w) => { const c = w & 0x3ff; return (c >> 5) * 8 + ((c & 0x1f) >> 1); };
const VENT_SHEET = { family: 115, count: 1, columns: 16, cell: 16, imageUri: 'data:,',
    // [13] 1: an animation's frame 0, [14] its first graphic (room-draft.js)
    slots: [[0, 0, 2742, 10, 0, 0, -1, 0, -1, 0, 0, 0, 0, 1, 2742, 0]],
    animations: { 2742: { frames: TORCH.frames, delays: [7, 7, 7, 7, 7, 4], pick: 1,
        timings: [{ delays: [5, 5, 5, 5, 3, 3], channels: 17 }, { delays: [7, 7, 7, 7, 7, 4], channels: 2 }] } } };

/** A room with two still graphics in slots 0 and 1, a canopy at (1,0) and (2,1) on slot 1. */
function animPalette() {
    const p = tilePalette();
    p.entries = [[0, 0xa800, 0x0400, 0, 4], [1, 0x0402, 0x0400, 0, 2]];
    p.count = 2;
    p.grid = [[0, 1, 0], [0, 0, 1]];
    p.widthTiles = 3; p.heightTiles = 2;
    return p;
}

test('an animated tile is one channel: a ▶ pick gets a slot of its own, the same frame picked alone stays still', () => {
    const p = animPalette();
    ui.setPalette(p);
    ui.editReset(1).on = true;
    const still = ui.editAdoptGraphic(p, 2742, null);
    const moving = ui.editAdoptAnimated(p, 2742, TORCH, null);
    assert.notStrictEqual(still, moving, 'one graphic, two slots');
    assert.strictEqual(ui.editAnimOfSlot(p, still), null);
    const e = ui.editAnimOfSlot(p, moving);
    assert.ok(e && e.vanilla, 'vanilla’s frames: locked');
    assert.strictEqual(ui.editAdoptAnimated(p, 2742, TORCH, null), moving, 'the same frames and ticks: the same animated tile');
    assert.notStrictEqual(ui.editAdoptAnimated(p, 2742, { frames: TORCH.frames, delays: [7, 7, 7, 7, 7, 4] }, null), moving,
        'other ticks: another animated tile, since every cell of one changes together');
    assert.strictEqual(ui.editAdoptGraphic(p, 2742, null), still);
    assert.strictEqual(ui.editAnimChannels(p).length, 2);
    assert.strictEqual(ui.editAnimsListed(p).length, 0, 'listed only while on the map');
    ui.editApply([{ x: 0, y: 0, index: ui.editAddStamp(p, { layer1: chrOf(moving) | (1 << 10), layer2: 0x0400, collision: 0 }) }]);
    assert.strictEqual(ui.editAnimsListed(p).length, 1);
    // Animation off, map-wide: every animated tile on frame 0.
    const idx = ui.editCellAt(p, 0, 0);
    assert.strictEqual(ui.editAnimShownFrame(p, idx), -1);
    ui.setAnimOff(true);
    assert.strictEqual(ui.editAnimShownFrame(p, idx), 0);
    ui.setAnimOff(false);
});

test('the Tile tab: an animation’s swatch places it at its family’s usual pattern; `frames` places a still tile', () => {
    const p = animPalette();
    ui.setPalette(p);
    ui.editReset(1).on = true;
    ui.editDraft().families = [];
    ui.setSheet(115, VENT_SHEET);
    ui.setFramesSplit(false);
    ui.editUseFamilyTile(2742, 115);
    const d = ui.editDraft();
    const top = (i) => { const w = ui.editStampWords(p, i); return w.layer1 === 0xa800 ? w.layer2 : w.layer1; };
    const e = ui.editAnimOfSlot(p, slotOfWord(top(d.brush)));
    assert.ok(e, 'anim view: animated');
    assert.deepStrictEqual(e.delays, [7, 7, 7, 7, 7, 4], 'this family runs pattern B most');
    assert.strictEqual(ui.editAnimLetter(e), 'B');
    assert.ok(ui.tileGroup(115).includes('rg-anim-mark" aria-hidden="true">B</b>'), 'the tile list says which pattern a pick places');
    ui.setFramesSplit(true);
    ui.editUseFamilyTile(2742, 115);
    assert.strictEqual(ui.editAnimOfSlot(p, slotOfWord(top(d.brush))), null, 'frames view: still');
    ui.setFramesSplit(false);
});

test('a ROM room lists every one of its channels as an animated tile, locked, with its own timing', () => {
    const p = tilePalette();
    p.tiles.count = 5;
    p.tiles.slots = [[0, 0, 0x422, 0], [1, 2, 0x423, 0], [2, 4, 2742, 1], [3, 6, 2747, 1], [4, 8, 2742, 1]];
    p.entries = [[0, 0xa800, 0x0400, 0, 3], [1, 0x0404, 0x0400, 0, 1], [2, 0x0406, 0x0400, 0, 1], [3, 0x0408, 0x0400, 0, 1]];
    p.count = 4;
    p.grid = [[1, 0, 3], [2, 0, 0]];
    p.channels = [[2, 0, [[2742, 5], [2743, 5]]], [3, 0, [[2747, 5], [2748, 5]]], [4, 2, [[2742, 3], [2743, 3]]]];
    ui.setPalette(p);
    ui.editReset(0x29).on = true;
    ui.editAnims(); // asked before the palette came: the room's channels still arrive
    ui.editSeedRoomAnims(p);
    const anims = ui.editAnims();
    assert.strictEqual(anims.length, 3);
    assert.ok(anims.every((e) => e.rom && e.vanilla && e.layer === 'canopy'));
    assert.deepStrictEqual(anims[2].delays, [3, 3]);
    assert.strictEqual(anims[2].init, 2);
    // (0,0) and (0,1) touch and both run 5 5 from 0: one row, two tiles. (2,0) runs 3 3.
    assert.deepStrictEqual(ui.editAnimsListed(p).map((x) => x.members.length), [2, 1]);
    // Vanilla's pattern table rides with the palette: a room's own channel always has its letter.
    p.cycles = { '2742,2743': [[[3, 3], 9], [[5, 5], 4]] };
    assert.strictEqual(ui.editAnimLetter(anims[0]), 'B');
    assert.strictEqual(ui.editAnimLetter(anims[2]), 'A');
    ui.editSeedRoomAnims(p);
    assert.strictEqual(ui.editAnims().length, 3, 'seeded once');
});

test('the pencil places a new animated tile as empty purple frames; it works once every frame is tiled', () => {
    const p = animPalette();
    ui.setPalette(p);
    ui.editReset(1).on = true;
    const d = ui.editDraft();
    d.tool = 'paint';
    ui.editAnimGesture(d, { x: 0, y: 0 }, 'down');
    ui.editAnimGesture(d, { x: 0, y: 0 }, 'up');
    const e = ui.editAnims()[0];
    e.pending.push('0,1'); // a copy of it, as Cmd/Ctrl+V puts one
    assert.deepStrictEqual(e.frames, [null, null]);
    assert.deepStrictEqual(e.pending, ['0,0', '0,1']);
    assert.strictEqual(ui.animSel(), e.uid);
    assert.ok(ui.animTabHtml().includes('0/2 tiled'));
    assert.strictEqual(ui.editAnimChannels(p).length, 0, 'unfinished: no channel');
    // Frame 0: graphic 0x423 as canopy, on one of its cells — both cells get it.
    d.brush = ui.editAddStamp(p, { layer1: 0x0402, layer2: 0xa800, collision: 0 });
    ui.setAnimSel(e.uid, 0);
    ui.editAnimGesture(d, { x: 0, y: 0 }, 'down');
    ui.editAnimGesture(d, { x: 0, y: 0 }, 'up');
    const e2 = ui.editAnims()[0];
    assert.ok(e2.slot >= 2, 'a slot of its own');
    assert.deepStrictEqual(e2.pending, []);
    const words = [[0, 0], [0, 1]].map(([x, y]) => ui.editStampWords(p, ui.editCellAt(p, x, y)).layer1);
    assert.ok(words.every((w) => slotOfWord(w) === e2.slot), 'both cells show it');
    assert.strictEqual(slotOfWord(ui.editStampWords(p, ui.editCellAt(p, 1, 0)).layer1), 1, 'the other canopy stays still on its own slot');
    assert.strictEqual(ui.editAnimChannels(p).length, 0, 'frame 1 is still empty');
    // Frame 1: graphic 0x422.
    d.brush = ui.editAddStamp(p, { layer1: 0x0400, layer2: 0xa800, collision: 0 });
    ui.setAnimSel(e2.uid, 1);
    ui.editAnimGesture(d, { x: 0, y: 1 }, 'down');
    ui.editAnimGesture(d, { x: 0, y: 1 }, 'up');
    assert.deepStrictEqual(ui.editAnimChannels(p).map((c) => c.frames), [[0x423, 0x422]]);
    assert.ok(ui.animTabHtml().includes('rg-anim-badge custom'), 'its own ticks: custom');
    // + Frame adds an empty one: unfinished again.
    ui.animClick({ dataset: { animAct: 'add-frame' } });
    assert.strictEqual(ui.editAnimChannels(p).length, 0);
    ui.editUndo(p);
    assert.strictEqual(ui.editAnimChannels(p).length, 1, '+ Frame was one step');
    // Away from its cells the pencil starts a new one — not another copy of the open tile.
    ui.setAnimSel(e2.uid, 0);
    ui.editAnimGesture(d, { x: 2, y: 1 }, 'down');
    ui.editAnimGesture(d, { x: 2, y: 1 }, 'up');
    assert.strictEqual(ui.editAnims().length, 2);
    assert.deepStrictEqual(ui.editAnims()[1].pending, ['2,1']);
    assert.strictEqual(ui.animSel(), ui.editAnims()[1].uid, 'and opens it');
    ui.editUndo(p);
    // Its row's `place` arms the pencil to place it, like a tile.
    ui.animClick({ dataset: { animAct: 'place', animUid: String(e2.uid) } });
    ui.editAnimGesture(d, { x: 2, y: 0 }, 'down');
    ui.editAnimGesture(d, { x: 2, y: 0 }, 'up');
    assert.strictEqual(slotOfWord(ui.editStampWords(p, ui.editCellAt(p, 2, 0)).layer1), ui.editAnims()[0].slot);
    assert.strictEqual(ui.editAnims().length, 1);
    ui.animClick({ dataset: { animAct: 'place', animUid: String(e2.uid) } });
    // The eraser takes it off a cell.
    d.tool = 'erase';
    ui.editAnimGesture(d, { x: 2, y: 0 }, 'down');
    ui.editAnimGesture(d, { x: 2, y: 0 }, 'up');
    assert.strictEqual(ui.editStampWords(p, ui.editCellAt(p, 2, 0)).layer1, 0xa800);
});

test('the Tile tab’s pencil on an unfinished animated tile tiles its frames, not the map beneath', () => {
    const p = animPalette();
    ui.setPalette(p);
    ui.editReset(1).on = true;
    const d = ui.editDraft();
    d.tool = 'paint';
    ui.editAnimGesture(d, { x: 0, y: 0 }, 'down');
    ui.editAnimGesture(d, { x: 0, y: 0 }, 'up');
    const e = ui.editAnims()[0];
    ui.setAnimSel(null);
    const before = ui.editCellAt(p, 0, 0);
    d.brush = ui.editAddStamp(p, { layer1: 0x0402, layer2: 0xa800, collision: 0 });
    // A drag over the cell tiles one frame: its first empty one.
    assert.ok(ui.editAnimTileStroke(d, { x: 0, y: 0 }, 'down'));
    ui.editAnimTileStroke(d, { x: 0, y: 0 }, 'move');
    assert.deepStrictEqual(ui.editAnims()[0].frames, [0x423, null]);
    assert.notStrictEqual(ui.editCellAt(p, 0, 0), before, 'the cell now shows frame 0');
    // Open on frame 1, the next stroke tiles frame 1; it is drawn over the cell.
    ui.setAnimSel(e.uid, 1);
    d.brush = ui.editAddStamp(p, { layer1: 0x0400, layer2: 0xa800, collision: 0 });
    ui.editAnimTileStroke(d, { x: 0, y: 0 }, 'down');
    assert.deepStrictEqual(ui.editAnims()[0].frames, [0x423, 0x422]);
    // Finished: the stroke is the map's again.
    assert.strictEqual(ui.editAnimTileStroke(d, { x: 0, y: 0 }, 'down'), false);
    // The marks: border and letter on, only what is unfinished off.
    ui.setAnimMarks(true);
    assert.ok(ui.editAnimSvg({ x: 0, y: 0 }).includes('rg-anim-lbl'));
    ui.setAnimMarks(false);
    assert.strictEqual(ui.editAnimSvg({ x: 0, y: 0 }), '');
    ui.setAnimMarks(true);
});

test('a custom map’s untouched cell takes an animated tile: tiling frame 0 keeps it on the map, frame 1 follows', () => {
    const p = animPalette();
    p.grid = [[0, 1, 0], [0, 0, null]];
    ui.setPalette(p);
    ui.editReset(1).on = true;
    const d = ui.editDraft();
    d.blank = {};
    d.tool = 'paint';
    ui.setTab('anim');
    ui.editBegin(); ui.editStroke({ x: 2, y: 1 }, 'down'); ui.editStroke({ x: 2, y: 1 }, 'up'); ui.editEnd();
    const e = ui.editAnims()[0];
    ui.setTab('tile');
    ui.setAnimSel(e.uid, 0);
    d.brush = ui.editAddStamp(p, { layer1: 0x0402, layer2: 0xa800, collision: 0 });
    ui.editBegin(); ui.editStroke({ x: 2, y: 1 }, 'down'); ui.editStroke({ x: 2, y: 1 }, 'up'); ui.editEnd();
    assert.deepStrictEqual(ui.editAnimsListed(p).map((x) => x.cells), [['2,1']], 'still on the map after frame 0');
    ui.setAnimSel(e.uid, 1);
    d.brush = ui.editAddStamp(p, { layer1: 0x0400, layer2: 0xa800, collision: 0 });
    ui.editBegin(); ui.editStroke({ x: 2, y: 1 }, 'down'); ui.editStroke({ x: 2, y: 1 }, 'up'); ui.editEnd();
    assert.deepStrictEqual(ui.editAnims()[0].frames, [0x423, 0x422]);
    assert.ok(ui.editAnimsListed(p)[0].cells.length === 1);
    // Erased off the empty cell: empty again, nothing left beneath.
    ui.setTab('anim'); d.tool = 'erase';
    ui.editBegin(); ui.editStroke({ x: 2, y: 1 }, 'down'); ui.editStroke({ x: 2, y: 1 }, 'up'); ui.editEnd();
    const w = ui.editStampWords(p, ui.editCellAt(p, 2, 1));
    assert.ok(w.layer1 === 0xa800 && w.layer2 === 0xa800, 'blank on both layers');
    d.tool = 'paint';
    ui.setTab('tile');
});

test('the tab lists every placement: one animated tile in two places is two rows', () => {
    const p = animPalette();
    ui.setPalette(p);
    ui.editReset(1).on = true;
    const d = ui.editDraft();
    const slot = ui.editAdoptAnimated(p, 2742, TORCH, null);
    const idx = ui.editAddStamp(p, { layer1: chrOf(slot) | (1 << 10), layer2: 0x0400, collision: 0 });
    ui.editApply([{ x: 0, y: 0, index: idx }, { x: 1, y: 0, index: idx }, { x: 2, y: 1, index: idx }]);
    const rows = ui.editAnimsListed(p);
    assert.deepStrictEqual(rows.map((r) => r.cells.length), [2, 1]);
    assert.ok(ui.animTabHtml().includes('2 of 2'));
    assert.strictEqual(ui.editAnimsListed(p), rows, 'asked again unchanged: the same list, not a new walk of the map');
    ui.editApply([{ x: 2, y: 0, index: idx }]);
    assert.deepStrictEqual(ui.editAnimsListed(p).map((r) => r.cells.length), [4], 'an edit walks it again: (2,0) joins both');
});

test('a dragged rectangle is a set: one animated tile per cell on one timing, listed as one row', () => {
    const p = animPalette();
    ui.setPalette(p);
    ui.editReset(1).on = true;
    const d = ui.editDraft();
    d.tool = 'paint';
    ui.editAnimGesture(d, { x: 0, y: 0 }, 'down');
    ui.editAnimGesture(d, { x: 1, y: 0 }, 'move');
    ui.editAnimGesture(d, { x: 1, y: 0 }, 'up');
    const [a, b] = ui.editAnims();
    assert.ok(a.set != null && a.set === b.set, 'one set');
    assert.deepStrictEqual([a.pending, b.pending], [['0,0'], ['1,0']]);
    assert.strictEqual(ui.editAnimsListed(p).length, 1, 'one row');
    // Each cell takes its own tile into the open frame.
    d.brush = ui.editAddStamp(p, { layer1: 0x0402, layer2: 0xa800, collision: 0 });
    ui.editAnimGesture(d, { x: 1, y: 0 }, 'down'); ui.editAnimGesture(d, { x: 1, y: 0 }, 'up');
    assert.deepStrictEqual([a.frames[0], ui.editAnims()[1].frames[0]], [null, 0x423]);
    // Ticks, a frame, the countdown: all of theirs.
    ui.animInputHandler({ type: 'change', target: { value: '20', dataset: { animDelay: '0' } } });
    ui.animClick({ dataset: { animAct: 'add-frame' } });
    assert.deepStrictEqual(ui.editAnims().map((m) => m.delays), [[20, 8, 8], [20, 8, 8]]);
    // Both cells tiled on frame 0: open and paused, both stop on the open frame — not only the clicked one.
    ui.setAnimSel(ui.editAnims()[1].uid, 0);
    ui.editAnimGesture(d, { x: 0, y: 0 }, 'down'); ui.editAnimGesture(d, { x: 0, y: 0 }, 'up');
    const shown = [[0, 0], [1, 0]].map(([x, y]) => ui.editAnimShownFrame(p, ui.editCellAt(p, x, y)));
    assert.deepStrictEqual(shown, [0, 0]);
    // The open row's frame chips show both tiles side by side.
    const html = ui.animTabHtml();
    assert.ok(/<svg class="rg-anim-sw" width="44" height="22"/.test(html), 'a 2×1 group frame');
    // ▶ Play with empty frames: played on the map, the empty ones purple.
    ui.animClick({ dataset: { animAct: 'play' } });
    const svg = ui.editAnimSvg({ x: 0, y: 0 });
    assert.ok(svg.includes('<animate attributeName="opacity"') && svg.includes('rg-anim-cell empty'));
    ui.animClick({ dataset: { animAct: 'play' } });
});

test('Cmd/Ctrl+C copies the open animated tile, Cmd/Ctrl+V puts a copy at the pointer', () => {
    const p = animPalette();
    ui.setPalette(p);
    ui.editReset(1).on = true;
    const d = ui.editDraft();
    d.tool = 'paint';
    ui.setTab('anim');
    ui.editAnimGesture(d, { x: 0, y: 0 }, 'down'); ui.editAnimGesture(d, { x: 0, y: 0 }, 'up');
    assert.ok(ui.animClipboardKey({ key: 'c' }, true));
    ui.setHover({ x: 2, y: 1 });
    assert.ok(ui.animClipboardKey({ key: 'v' }, true));
    assert.deepStrictEqual(ui.editAnims()[0].pending, ['0,0', '2,1']);
    assert.strictEqual(ui.editAnimsListed(p).length, 2, 'two placements, two rows');
    ui.setTab('tile');
});

test('the select tool drags an animated tile to a new place, in one step', () => {
    const p = animPalette();
    ui.setPalette(p);
    ui.editReset(1).on = true;
    const d = ui.editDraft();
    const slot = ui.editAdoptAnimated(p, 2742, TORCH, null);
    const idx = ui.editAddStamp(p, { layer1: chrOf(slot) | (1 << 10), layer2: 0x0400, collision: 0 });
    ui.editApply([{ x: 0, y: 0, index: idx }, { x: 1, y: 0, index: idx }]);
    d.tool = 'select';
    ui.editAnimGesture(d, { x: 0, y: 0 }, 'down');
    ui.editAnimGesture(d, { x: 0, y: 1 }, 'move');
    ui.editAnimGesture(d, { x: 0, y: 1 }, 'up');
    assert.deepStrictEqual(ui.editAnimsListed(p).map((r) => r.cells.slice().sort()), [['0,1', '1,1']]);
    assert.strictEqual(ui.editStampWords(p, ui.editCellAt(p, 0, 0)).layer1, 0xa800, 'the old cells are clear');
    ui.editUndo(p);
    assert.deepStrictEqual(ui.editAnimsListed(p).map((r) => r.cells.slice().sort()), [['0,0', '1,0']], 'one undo puts it back');
    d.tool = 'paint';
});

test('frames holding one graphic in a row read as one; a hold past 127 ticks is split as the ROM stores it', () => {
    const e = { frames: [5, 6, 6, 6, 7, null, null], delays: [10, 127, 127, 101, 10, 8, 8] };
    assert.deepStrictEqual(ui.editAnimRuns(e).map((r) => [r.start, r.count, r.graphic, r.ticks]),
        [[0, 1, 5, 10], [1, 3, 6, 355], [4, 1, 7, 10], [5, 1, null, 8], [6, 1, null, 8]], 'empty frames never merge');
    ui.editAnimSetRunTicks(e, 1, 300);
    assert.deepStrictEqual(e.frames, [5, 6, 6, 6, 7, null, null]);
    assert.deepStrictEqual(e.delays, [10, 127, 127, 46, 10, 8, 8]);
    ui.editAnimSetRunTicks(e, 1, 20);
    assert.deepStrictEqual(e.frames, [5, 6, 7, null, null]);
    assert.deepStrictEqual(e.delays, [10, 20, 10, 8, 8]);
});

test('vanilla’s patterns are lettered A, B…; the open row lists them, a locked tile needs disbanding to change its frames', () => {
    const p = animPalette();
    ui.setPalette(p);
    ui.editReset(1).on = true;
    ui.setSheet(115, VENT_SHEET);
    // Started at the second showing of 2744 (frame 5): the patterns turn with it.
    ui.editDraft().families = [115];
    const spec = { frames: [2744, 2742, 2743, 2744, 2745, 2746], delays: [3, 5, 5, 5, 5, 3] };
    const s = ui.editAdoptAnimated(p, 2744, spec, null);
    const e = ui.editAnimOfSlot(p, s);
    ui.editApply([{ x: 0, y: 0, index: ui.editAddStamp(p, { layer1: chrOf(s) | (1 << 10), layer2: 0x0400, collision: 0 }) }]);
    assert.deepStrictEqual(ui.editAnimPresets(e).map((t) => t.letter + ' ' + t.delays.join(' ')), ['A 3 5 5 5 5 3', 'B 4 7 7 7 7 7']);
    assert.strictEqual(ui.editAnimLetter(e), 'A');
    ui.setAnimSel(e.uid, 0);
    let html = ui.animTabHtml();
    assert.ok(html.includes('class="rg-anim-badge"') && html.includes('>A</span>'), 'closed row: its letter');
    assert.ok(/data-anim-preset="0"[^>]*title="[^"]*3 5 5 5 5 3[^"]*">A<\/button>/.test(html), 'chips are letters; the ticks are in the title');
    assert.ok(/data-anim-preset="1"[^>]*>B<\/button>/.test(html));
    assert.ok(html.includes('background-image:url(data:,)'), 'the preview draws from its family’s sheet, found off its cell');
    ui.animClick({ dataset: { animPreset: '1' } });
    assert.strictEqual(ui.editAnimLetter(e), 'B');
    e.delays = [1, 1, 1, 1, 1, 1];
    assert.strictEqual(ui.editAnimLetter(e), null, 'its own ticks: custom');
    // Locked: no + Frame, tiling refused; disband unlocks.
    html = ui.animTabHtml();
    assert.ok(!html.includes('data-anim-act="add-frame"') && html.includes('data-anim-act="disband"'));
    const d = ui.editDraft();
    d.brush = ui.editAddStamp(p, { layer1: 0x0400, layer2: 0xa800, collision: 0 });
    ui.setAnimSel(e.uid, 2);
    ui.animTile(e, 2);
    assert.strictEqual(e.frames[2], 2743, 'locked frames unchanged');
    ui.animClick({ dataset: { animAct: 'disband' } });
    ui.animTile(ui.editAnims()[0], 2);
    assert.strictEqual(ui.editAnims()[0].frames[2], 0x422);
});

test('a placed widget switches pattern on its own; the other copy keeps its ticks', () => {
    const p = animPalette();
    ui.setPalette(p);
    ui.editReset(1).on = true;
    ui.setSheet(115, VENT_SHEET);
    const d = ui.editDraft();
    const a = ui.editAdoptAnimated(p, 2742, TORCH, null);
    const word = chrOf(a) | (1 << 10);
    d.groups = [{ uid: 9, name: 'torch', x: 0, y: 0, w: 1, h: 1, level: 1, placed: [], cells: [{ dx: 0, dy: 0, layer1: word, layer2: null, collision: null }] },
        { uid: 10, name: 'torch', x: 2, y: 1, w: 1, h: 1, level: 1, placed: [], cells: [{ dx: 0, dy: 0, layer1: word, layer2: null, collision: null }] }];
    const html = ui.placedTimingHtml(d.groups[0]);
    assert.ok(html.includes('>A</button>') && html.includes('>B</button>') && /sel" data-anim-timing="0"/.test(html));
    ui.animClick({ dataset: { animTiming: '1', animGroup: '9' } });
    const moved = d.groups[0].cells[0].layer1;
    assert.deepStrictEqual(ui.editAnimOfSlot(p, slotOfWord(moved)).delays, [7, 7, 7, 7, 7, 4]);
    assert.strictEqual(moved & 0xfc00, word & 0xfc00, 'palette and flips kept');
    assert.deepStrictEqual(ui.editAnimOfSlot(p, slotOfWord(d.groups[1].cells[0].layer1)).delays, TORCH.delays);
});

test('a widget part keeps its animated tile, and stamping it brings that tile to the map', () => {
    const p = animPalette();
    ui.setPalette(p);
    ui.editReset(1).on = true;
    ui.editDraft().families = [115];
    const s = ui.editAdoptAnimated(p, 2742, TORCH, null);
    const part = ui.editPartFromWord(p, chrOf(s) | (1 << 10));
    assert.deepStrictEqual(part.anim, { frames: TORCH.frames, delays: TORCH.delays, init: 0, vanilla: true });
    assert.strictEqual(ui.editPartFromWord(p, chrOf(ui.editAdoptGraphic(p, 2742, null)) | (1 << 10)).anim, null, 'a still part says so');
    ui.editReset(1).on = true;
    ui.editDraft().families = [115];
    const back = ui.editWordFromPart(p, part);
    assert.deepStrictEqual(ui.editAnimOfSlot(p, slotOfWord(back.word)).frames, TORCH.frames);
});

console.log(`\n  ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);

