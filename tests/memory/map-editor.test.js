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
         editSpecialsAt, editCellSymbols, editSpecialGlyphSvg, interactOverlaySvg,
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
  ${read('map-editor-custom.js') /* custom maps: their rail rows and drafts */}
  ${read('map-editor-drawable.js') /* what the pencil draws: the open tab's pick */}
  ${read('map-editor-levels.js')}
  ${read('map-editor-groups.js')}
  ${read('map-editor-custom-store.js')}
  ${read('map-editor-clipboard.js')}
  ${read('map-editor-pick.js')}
  ${read('map-editor-objects.js')}
  ${read('map-editor-widgets.js')}
  ${read('map-editor-widget-edit.js')}
  ${read('map-editor-special-select.js')}
  ${read('map-editor-romroom.js') /* a vanilla room in the editor (map-editor-rules §7) */}
  ${read('map-editor-info.js') /* the Info tab */}
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
    setCatalogue: function (c) { _famCatalogue = c; },
    sheetHeight: tileSheetHeight,
    setRelated: function (map) { _related = map; },
    strandedCells: editStrandedCells,
    setSel2: function (s) { _editSel = s; },
    compose: function () { return _editCompose; },
    setPalette: function (p) { _mtPalette = p; },
    setSelected: function (i) { _mtSelected = i; },
    setView: function (v, pal) { _mtView = v; if (pal) _mtBgPalette = pal; },
    specialTab: specialTabHtml, specialFilterChip: buildSpecialFilterChipHtml,
    editStroke: editStroke, editSpecialAt: editSpecialAt, editStampWords: editStampWords,
    setTab: function (t) { _editActiveTab = t; },
    editBegin: editBegin, editEnd: editEnd, editUndo: editUndo, editRedo: editRedo, editApply: editApply,
    editStampGroup: editStampGroup, editGroupMove: editGroupMove, editGroupDelete: editGroupDelete,
    editGroupAt: editGroupAt, editPruneAdded: editPruneAdded, editLevelPick: editLevelPick,
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
    mtPaletteFits: mtPaletteFits, editSeedRoomObjects: editSeedRoomObjects, editObjects: editObjects,
    editWordSpecialIds: editWordSpecialIds, editOnRomRoom: editOnRomRoom, editTriggerSvg: editTriggerSvg,
    editRoomSpecialsSvg: editRoomSpecialsSvg, editExport: editExport, infoTabHtml: infoTabHtml, infoMeasure: infoMeasure,
    editHeaderSet: editHeaderSet, infoHeaderBit: infoHeaderBit, infoHeader: infoHeader,
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
    const html = ui.infoTabHtml(p);
    assert.ok(html.includes('6/7 · 86%'), 'families are the draft\'s, as on the Tile tab');
    assert.ok(html.includes('92/264'));
    assert.strictEqual((html.match(/rg-cap-fill( full| over)?"/g) || []).length, 3, 'ceiling bars for families, graphics and WRAM only');
    assert.ok(!/\/128|\/16\b/.test(html), 'no placeholder ceilings from the mock');
    assert.ok(html.includes('Nothing blocking'), 'an empty check list says so');
    assert.ok(!html.includes('no brush selected'), 'the brush hint is not a check');
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
    const html = ui.infoTabHtml(p);
    assert.ok(html.includes('rg-cap-fill measured'), 'measured shares are bars in their own colour');
    assert.ok(html.includes('5/6 · 83%'), 'solid: five of six drawn cells');
    d.on = true;
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
    assert.ok(html.indexOf('rg-info-header') < html.indexOf('Capacity'), 'the header comes first');
    assert.ok(html.includes('Front · Ground · HUD · Sprites'), 'TM $17 in words');
    assert.ok(html.includes('Add on Ground'), 'CGADSUB $02 in words');
    assert.ok(html.includes('sub screen, everywhere'), 'CGWSEL $02 in words');
    d.locked = true;
    const locked = ui.infoTabHtml(p);
    assert.ok(!locked.includes('data-header-bit') && locked.includes('Front · Ground · HUD · Sprites'),
        'locked: the values stay as text, the controls go');
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

test('a group moves whole: what it covered comes back, its trigger follows, one step', () => {
    const { p, d } = fresh();
    ui.editApply([{ x: 0, y: 1, index: 1 }]);      // something under the gourd
    ui.editStampGroup(p, GOURD, 0, 1);
    const uid = d.groups[0].uid;
    const stamped = d.cells['0,1'];
    const steps = d.undo.length;
    assert.ok(ui.editGroupMove(p, uid, 1, 0));
    assert.strictEqual(d.undo.length, steps + 1, 'a move is one step');
    assert.strictEqual(d.cells['0,1'], 1, 'the cell it covered is back');
    assert.ok(!('1,1' in d.cells), 'and the one that was unpainted is unpainted again');
    assert.strictEqual(d.cells['1,0'], stamped, 'the gourd is at its new place');
    const trig = d.placed.find((x) => x.kind === 'bTrigger');
    assert.deepStrictEqual([trig.x, trig.y], [1, 0], 'its trigger moved with it');
    assert.ok(!ui.editGroupMove(p, uid, 5, 0), 'it will not move off the map');
    ui.editUndo(p);
    assert.strictEqual(d.cells['0,1'], stamped, 'undo puts it back where it was');
    assert.deepStrictEqual([d.groups[0].x, d.groups[0].y], [0, 1]);
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

test('a stamped or pasted object lands on the level of the floor under it', () => {
    const { p, d } = fresh();
    ui.editLevelPick(2);
    // v0.79.0: the room's floor here is level 1, so the gourd is too, whatever
    // the bar says — on open ground the bar decides (map-editor-dom.test.js).
    const got = ui.editStampGroup(p, GOURD, 0, 0);
    assert.strictEqual(got.level, 1);
    assert.strictEqual(ui.editStampWords(p, d.cells['0,0']).collision & 0x30, 0x10);
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

console.log(`\n  ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
