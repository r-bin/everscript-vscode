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
  ${read('map-editor-paint.js')}
  ${read('map-editor-ui.js')}
  ${read('map-editor-phases.js')}
  ${read('map-editor-constructs.js')}
  ${read('map-editor-families.js')}
  ${read('map-editor-chips.js')}
  ${read('map-editor-tiles.js')}
  ${read('tables-builder.js') /* buildEntityTablesHtml, for the Trigger tab */}
  ${read('map-editor-tabs.js')}
  ${read('map-editor-panels.js')}
  ${read('map-editor-gestures.js')}
  ${read('map-editor-input.js')}
  ${read('map-editor-actions.js')}
  ${read('map-editor-newroom.js')}
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
    setRelated: function (map) { _related = map; },
    strandedCells: editStrandedCells,
    setSel2: function (s) { _editSel = s; },
    compose: function () { return _editCompose; },
    setPalette: function (p) { _mtPalette = p; },
    setSelected: function (i) { _mtSelected = i; },
    setView: function (v, pal) { _mtView = v; if (pal) _mtBgPalette = pal; },
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

test('a room stroke replaces everything; a deco stroke keeps the floor', () => {
    const p = decoPalette();
    ui.setPalette(p);
    const d = ui.editReset(0x34);
    d.on = true;

    // Room phase: the brush wins outright, so the answer is just the brush.
    assert.strictEqual(ui.editResolve(p, 0, 1, 2, 'room', false), 2);
    assert.strictEqual(d.added.length, 0, 'and it invents nothing');

    // Deco phase at (0,1), which is floor 0 ($4C62). Painting stamp 2 there
    // must take stamp 2's canopy and collision but keep $4C62 underneath.
    const made = ui.editResolve(p, 0, 1, 2, 'deco', false);
    assert.strictEqual(made, p.count, 'a new stamp is needed');
    assert.deepStrictEqual(d.added[0], { layer1: 0xa800, layer2: 0x4c62, collision: 0x101f });
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
    const bare = ui.editResolve(p, 1, 0, -1, 'deco', true);
    assert.strictEqual(bare, 0, 'it resolves to the floor stamp the room already has');
    assert.strictEqual(d.added.length, 0, 'so nothing new is needed');

    // Erasing bare floor is a no-op rather than a pointless new stamp.
    assert.strictEqual(ui.editResolve(p, 0, 1, -1, 'deco', true), 0);
    assert.strictEqual(d.added.length, 0);

    // In room phase the eraser has no floor to fall back to and says so.
    assert.strictEqual(ui.editResolve(p, 1, 0, -1, 'room', true), -1);
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
test('a group is ordered by relationship first, placements second', () => {
    ui.editReset(0x34);
    ui.setPalette(tilePalette());
    ui.setSheet(58, {
        family: 58, count: 3, total: 74, roomCount: 3, columns: 16, cell: 16,
        slots: [[0, 0, 4191, 10, 0, 0], [1, 2, 4195, 5, 0, 0], [2, 4, 4200, 99, 0, 0]],
        imageUri: 'data:image/png;base64,ZmFt',
    });
    ui.setRelated({ 4191: 92, 4195: 3 });
    const order = [...ui.tileGroup(58).matchAll(/data-fam-tile="(\d+)"/g)].map((m) => m[1]);
    assert.deepStrictEqual(order, ['4191', '4195', '4200']);

    // With nothing placed there is nothing to be related to, so the ordering
    // falls back to how often vanilla places each tile. A real cold start,
    // not a bug.
    ui.setRelated({});
    const cold = [...ui.tileGroup(58).matchAll(/data-fam-tile="(\d+)"/g)].map((m) => m[1]);
    assert.deepStrictEqual(cold, ['4200', '4191', '4195']);
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

test('the toolbar offers both phases and marks erase as deco-only', () => {
    const d = ui.editReset(0x34);
    d.on = true;
    d.phase = 'room';
    const roomBar = ui.toolbar();
    assert.ok(/data-edit-phase="room"[^>]*class|class="[^"]*on[^"]*" data-edit-phase="room"/.test(roomBar)
        || roomBar.includes('rg-phase on" data-edit-phase="room"'), roomBar.slice(0, 300));
    assert.ok(roomBar.includes('switch to deco first'), 'erase explains itself in room phase');
    assert.ok(roomBar.includes('data-edit-act="new-room"'), 'and a new room can be drafted');

    d.phase = 'deco';
    assert.ok(!ui.toolbar().includes('switch to deco first'));
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
