'use strict';
// The editor's chrome, driven in a real browser.
//
// map-editor.test.js covers the DOM-free logic. This covers what only a
// real DOM can answer, and it exists because two bugs got through the
// logic tests untouched:
//
//   - clicking a panel's caret did nothing, because `e.target` is the
//     deepest node under the pointer — the `<span>`, not the header that
//     carries `data-panel`.
//   - "new room" did nothing, because `window.prompt` does not exist in a
//     VS Code webview and calling it is silently inert.
//
// Neither is visible without dispatching a real click at a real element.
//
// Skips cleanly when no browser is installed, so a fresh clone still runs
// the suite.

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const WEBVIEW = path.join(__dirname, '..', '..', 'src', 'rooms', 'webview');
const read = (f) => fs.readFileSync(path.join(WEBVIEW, f), 'utf8');

/** The editor's files, in the order the bundle concatenates them. */
const FILES = ['metatile-palette.js', 'map-editor.js', 'map-editor-stamps.js', 'map-editor-paint.js',
    'map-editor-ui.js', 'map-editor-phases.js', 'map-editor-constructs.js', 'map-editor-families.js',
    'map-editor-chips.js', 'map-editor-tiles.js', 'map-editor-deco.js', 'map-editor-special.js',
    'map-editor-trigger-select.js', 'map-editor-trigger-panel.js',
    'tables-builder.js', 'map-editor-tabs.js', 'map-editor-panels.js', 'map-editor-gestures.js',
    'map-editor-input.js', 'map-editor-actions.js', 'map-editor-newroom.js'];

/** A palette shaped like the host's reply, small enough to read. */
const PALETTE = {
    count: 1, baseMetatile: 8, entries: [[0, 0xa800, 0x4c62, 0x0010, 4]],
    grid: [[0, 0], [0, 0]], widthTiles: 2, heightTiles: 2,
    tileFamilies: [35, 187, 58, 165, 149, 59, 166],
    budget: {
        graphics: { used: 92, max: 264, vanilla: 255 },
        families: { used: 7, max: 7, vanilla: 7 },
        stamps: { used: 1, max: null, vanilla: 2131 },
        wram: { used: 40, max: 32768, vanilla: 32680 },
        attested: 157,
    },
    vanilla: [[58, 100, 1, 0x101f, 94]],
    graphicGroups: [{ rooms: [0x34], slots: [0] }],
    tiles: {
        count: 1, columns: 16, cell: 16, palette: 1, paletteCount: 7,
        slots: [[0, 0, 0x0422, 0]], imageUri: 'data:image/png;base64,iVBORw0KGgo=',
    },
    attachments: { bTrigger: [], stepOn: [], objects: [] },
};

let passed = 0;
let failed = 0;
const check = (name, cond, detail) => {
    if (cond) { console.log('  ✓ ' + name); passed += 1; }
    else { console.error('  ✗ ' + name + (detail ? '\n    ' + detail : '')); failed += 1; }
};

async function main() {
    let chromium;
    try { ({ chromium } = require('playwright')); }
    catch { console.log('\nmap editor DOM: playwright not installed — skipped'); return; }

    let browser;
    try { browser = await chromium.launch(); }
    catch (e) {
        console.log('\nmap editor DOM: no browser available — skipped (' + String(e.message).split('\n')[0] + ')');
        return;
    }

    console.log('\nmap editor DOM:');
    const page = await browser.newPage();
    const pageErrors = [];
    page.on('pageerror', (e) => pageErrors.push(e.message));

    const CSS = fs.readFileSync(
        path.join(__dirname, '..', '..', 'src', 'shared', 'shared.css'), 'utf8')
        + '\n' + fs.readFileSync(
        path.join(__dirname, '..', '..', 'src', 'rooms', 'webview', 'map-editor-theme.css'), 'utf8');
    // The real stylesheets: without them every swatch is 0x0, so nothing is
    // clickable and no size assertion means anything. `.rg-theme` matches the
    // class renderRoomDetail puts on the real #room-detail (detail-renderer.js).
    await page.setContent(`<!doctype html><html><head><style>${CSS}</style></head>
        <body style="display:block;height:auto;overflow:auto"><div id="room-detail" class="rg-theme">
        <div class="rg-outer rs-map" id="rg-outer"><div class="rg-wrap" id="rg-wrap"
        style="width:400px;height:300px">
        <svg class="rg-svg" id="rg-svg" viewBox="0 0 4 4"><image id="rg-img"/>
        <path class="rg-grid-fine" d="M0 0V99"/><path class="rg-grid-coarse" d="M0 0V99"/>
        </svg></div></div>
        <div class="rs rs-mt-sec" id="rs-mt"><div class="rs-mt-body" id="rs-mt-body"></div></div>
        </div></body></html>`);

    // Stubs for the few things the editor reaches for outside its own files.
    await page.addScriptTag({ content: `
        window.__sent = [];
        var vs = { postMessage: function (m) { window.__sent.push(m); } };
        function escH(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;'); }
        function roomVanillaIdNum(){ return 0x34; }
        function renderMetatilePalette(){}
        ${FILES.map(read).join('\n')}
    ` });

    await page.evaluate((palette) => {
        _mtPalette = palette;
        _mtRoomId = 0x34;
        editReset(0x34);
        bindEditControls(document.getElementById('room-detail'), {});
        editToggle({}, null);
    }, PALETTE);

    check('edit mode builds the panel column', !!(await page.$('#rg-panels')));

    // Two tile pickers on screen at once — the panels and the pre-rebuild
    // palette section — was "the first time you click it you get an old
    // version of the editor".
    check('and hides the browsing palette while it is open',
        await page.evaluate(() => document.getElementById('rs-mt').classList.contains('rs-mt-hidden')));

    // ── the tab shell ──────────────────────────────────────────────────────
    // Four tabs (Tile / Special / Trigger / Info) file everything that used
    // to stack as one long column of collapsible panels. Widgets does not
    // exist yet (Phase 5 — see docs/map-editor-redesign-plan.md).
    check('the dock opens on the Tile tab',
        await page.evaluate(() => document.querySelector('[data-edit-active-tab="tile"]').classList.contains('on')));
    check('with the tile-family panel on screen',
        !!(await page.$('[data-panel="families"]')));
    check('and the budget bar off screen until Info is picked',
        !(await page.$('.rs-mt-budget')));

    await page.click('[data-edit-active-tab="info"]');
    check('switching to Info shows the budget bars',
        !!(await page.$('.rs-mt-budget')));
    check("and the Tile tab's panels are gone, not just hidden",
        !(await page.$('[data-panel="families"]')));

    // The Trigger tab reads the room's own base triggers off `_mtPalette.attachments`
    // (the same tuples map-editor-constructs.js already uses), not the read-only
    // entity tables — see map-editor-trigger-panel.js.
    await page.evaluate((room) => {
        _mtPalette.attachments = { bTrigger: [], stepOn: [[0, 0, 1, 1, 0x1234]], objects: [] };
        bindEditControls(document.getElementById('room-detail'), room);
    }, {
        content: {
            triggers: { stepOn: [{ x1: 0, y1: 0, x2: 1, y2: 1 }], bTrigger: [] },
            triggerNames: { stepOn: ['test_step'], bTrigger: [] },
        },
    });
    await page.click('[data-edit-active-tab="trigger"]');
    const trigText = await page.evaluate(() => document.getElementById('rg-panels').textContent);
    check("the Trigger tab lists the room's own step/B triggers, named from the source",
        /Step-on triggers/.test(trigText) && /test_step/.test(trigText) && /0x1234/.test(trigText),
        trigText.slice(0, 300));

    // ── the Special tab ────────────────────────────────────────────────────
    await page.click('[data-edit-active-tab="special"]');
    check('the Special tab shows its three groups',
        !!(await page.$('[data-edit-special="gate-dog"]'))
        && !!(await page.$('[data-edit-special="drift-n"]'))
        && !!(await page.$('[data-edit-special="entrance-default"]')));

    await page.click('[data-edit-special="gate-dog"]');
    check('picking a chip arms it',
        (await page.evaluate(() => editDraft().currentSpecialId)) === 'gate-dog');
    check('and highlights the chip itself',
        await page.$eval('[data-edit-special="gate-dog"]', (n) => n.classList.contains('on')));

    await page.click('[data-edit-special="gate-dog"]');
    check('clicking the same chip again clears it',
        (await page.evaluate(() => editDraft().currentSpecialId)) === null);

    // Paint with a real gate pick armed: the click goes through editStroke,
    // exactly the path a mouse gesture takes (map-editor-gestures.js).
    await page.evaluate(() => {
        editReset(0x34);
        editDraft().on = true;
        editDraft().brush = 0;
        editDraft().tool = 'paint';
        editDraft().currentSpecialId = 'gate-dog';
        editStroke({ x: 0, y: 0 }, 'down');
    });
    const gateGlyph = await page.evaluate(() => {
        var el = document.querySelector('#rg-edit .rg-special-glyph-gate');
        return el ? el.textContent : null;
    });
    check('painting with a special armed draws its glyph on the canvas', gateGlyph === 'D', 'glyph=' + gateGlyph);
    check('and records it in specialCells', (await page.evaluate(() => editSpecialAt(0, 0))) === 'gate-dog');
    check('and the gate bits actually landed on the stamp, not just the glyph',
        (await page.evaluate(() => editDraft().cells['0,0'])) !== 0);

    await page.evaluate(() => {
        editDraft().tool = 'erase';
        editDraft().phase = 'deco';
        editStroke({ x: 0, y: 0 }, 'down');
    });
    check('erasing removes the glyph from the canvas', !(await page.$('#rg-edit .rg-special-glyph')));
    check('and clears specialCells', (await page.evaluate(() => editSpecialAt(0, 0))) === null);
    check('and the stamp goes back to the room’s own, not a leftover gated one',
        (await page.evaluate(() => editDraft().cells['0,0'])) === 0);

    // ── the filter bar's Special chip + dropdown ────────────────────────────
    // The harness never loads interactions.js (setupClickHandlers), so the
    // dropdown's own three data-hide sub-toggles are not exercised by a real
    // click here — every other filter chip in this bar has the same gap in
    // this suite. Only the caret's open/close, wired through
    // bindEditControls (map-editor-input.js), is this phase's own code.
    await page.evaluate(() => {
        document.getElementById('room-detail').insertAdjacentHTML('beforeend', buildSpecialFilterChipHtml());
    });
    check('the special filter dropdown starts closed',
        await page.$eval('#rg-special-dropdown', (n) => n.hidden));
    await page.click('[data-edit-special-menu]');
    check('the caret opens it', !(await page.$eval('#rg-special-dropdown', (n) => n.hidden)));
    await page.click('[data-edit-active-tab="tile"]');
    check('and a click elsewhere in the panel closes it again',
        await page.$eval('#rg-special-dropdown', (n) => n.hidden));

    check('switching back to Tile restores its panels',
        !!(await page.$('[data-panel="families"]')));

    // ── the Select tool: real base + placed triggers, driven end to end ────
    // An 8x8 room: one base step trigger at (1,1)-(2,2), one base B-trigger
    // tucked out of the way at (7,0)-(7,1) so it never collides with where
    // the step trigger's moves/drags land below.
    await page.evaluate(() => {
        editReset(0x34);
        editDraft().on = true;
        _mtPalette = Object.assign({}, _mtPalette, {
            widthTiles: 8, heightTiles: 8,
            attachments: { bTrigger: [[7, 0, 7, 1, 0x2222]], stepOn: [[1, 1, 2, 2, 0x1111]], objects: [] },
        });
        _editActiveTab = 'tile';
        editDraft().tool = 'select';
    });

    const picked = await page.evaluate(() => {
        editStroke({ x: 1, y: 1 }, 'down');
        return { ref: editDraft().selectedTriggerRef, tab: _editActiveTab };
    });
    check('clicking a base trigger selects it',
        picked.ref && picked.ref.kind === 'step' && picked.ref.id === 'base:0', JSON.stringify(picked));
    check('and switches the dock to the Trigger tab', picked.tab === 'trigger', picked.tab);
    check('the outline for the selected trigger is drawn on the canvas',
        !!(await page.$('.rg-trigger-sel-step')));

    await page.evaluate(() => editStroke({ x: 7, y: 7 }, 'down'));
    check('clicking empty ground deselects it',
        (await page.evaluate(() => editDraft().selectedTriggerRef)) === null);

    // Drag the base step trigger (grabbed at its own top-left, so the drop
    // cell becomes the new top-left) from (1,1) to (4,4).
    await page.evaluate(() => editStroke({ x: 1, y: 1 }, 'down'));   // reselect it
    const dragged = await page.evaluate(() => {
        editStroke({ x: 1, y: 1 }, 'down');   // mousedown on the selection's own cell starts a drag
        editStroke({ x: 4, y: 4 }, 'move');
        const live = !!document.querySelector('.rg-trigger-drag-step');
        editStroke({ x: 4, y: 4 }, 'up');
        return {
            livePreview: live, ref: editDraft().selectedTriggerRef, undoLen: editDraft().undo.length,
            box: editTriggerFind(editDraft().selectedTriggerRef),
            baseGone: editTriggerList('step').filter((t) => t.origin === 'base').length,
        };
    });
    check('dragging shows a live preview outline', dragged.livePreview);
    check('and commits as a new placed trigger, since a base one cannot move in place',
        dragged.ref && dragged.ref.kind === 'step' && dragged.ref.id === 'placed:1', JSON.stringify(dragged));
    check('landing exactly where it was dropped', dragged.box.x1 === 4 && dragged.box.y1 === 4, JSON.stringify(dragged.box));
    check('the move is one undo step', dragged.undoLen === 1, String(dragged.undoLen));
    check('and the base trigger it came from no longer appears in the live list',
        dragged.baseGone === 0, String(dragged.baseGone));

    // Copy/paste while there is still headroom (4,4) to see the +1/+1 offset
    // land somewhere new, before the corner-clamp test below eats that room.
    const pasted = await page.evaluate(() => {
        const before = editTriggerFind(editDraft().selectedTriggerRef);
        triggerCopySelected();
        triggerPasteClipboard();
        return { before: before, ref: editDraft().selectedTriggerRef, box: editTriggerFind(editDraft().selectedTriggerRef) };
    });
    check('pasting creates a new trigger offset by +1 row, +1 col from the copy',
        pasted.box.x1 === pasted.before.x1 + 1 && pasted.box.y1 === pasted.before.y1 + 1,
        JSON.stringify(pasted));
    check('and selects the new one, distinct from the copied one',
        pasted.ref.id !== pasted.before.ref.id && pasted.ref.id === 'placed:2', JSON.stringify(pasted));

    // Reselect the original (uid 1, still at (4,4)) — click its own top-left,
    // which the pasted copy (at (5,5)) does not cover.
    await page.evaluate(() => editStroke({ x: 4, y: 4 }, 'down'));
    check('clicking the original again re-selects it, not the overlapping paste',
        (await page.evaluate(() => editDraft().selectedTriggerRef.id)) === 'placed:1');

    // Clamp: drag it toward the bottom-right corner — (7,7) is the last cell
    // in bounds (`editStroke` itself refuses any cell outside the room, the
    // same guard every tool shares), and it is still enough to push a 2-wide
    // box on an 8-wide room past where it fits, so it must stop at (6,6).
    const clampedDrag = await page.evaluate(() => {
        editStroke({ x: 4, y: 4 }, 'down');
        editStroke({ x: 7, y: 7 }, 'move');
        editStroke({ x: 7, y: 7 }, 'up');
        return editTriggerFind(editDraft().selectedTriggerRef);
    });
    check('a drag past the edge clamps to the last position that fits',
        clampedDrag.x1 === 6 && clampedDrag.y1 === 6 && clampedDrag.x2 === 7 && clampedDrag.y2 === 7,
        JSON.stringify(clampedDrag));

    const undoneClamp = await page.evaluate(() => {
        editUndo(_mtPalette);
        return editTriggerFind(editDraft().selectedTriggerRef);
    });
    check('undo restores the pre-clamp position', undoneClamp.x1 === 4 && undoneClamp.y1 === 4, JSON.stringify(undoneClamp));
    const redoneClamp = await page.evaluate(() => {
        editRedo(_mtPalette);
        return editTriggerFind(editDraft().selectedTriggerRef);
    });
    check('redo puts the clamped move back', redoneClamp.x1 === 6 && redoneClamp.y1 === 6, JSON.stringify(redoneClamp));

    // Delete a base trigger: the B-trigger tucked at (7,0)-(7,1).
    const bPicked = await page.evaluate(() => {
        editStroke({ x: 7, y: 0 }, 'down');
        return editDraft().selectedTriggerRef;
    });
    check('selecting the base B-trigger', bPicked && bPicked.kind === 'b' && bPicked.id === 'base:0', JSON.stringify(bPicked));
    const bDeleted = await page.evaluate(() => {
        triggerDeleteSelected();
        return {
            selected: editDraft().selectedTriggerRef,
            count: editTriggerList('b').length,
            removed: editDraft().removedTriggers.slice(),
        };
    });
    check('deleting a base trigger clears the selection and hides it from the list',
        bDeleted.selected === null && bDeleted.count === 0, JSON.stringify(bDeleted));
    check('by marking it removed, not by mutating the room’s own attachments array',
        bDeleted.removed.some((r) => r.kind === 'b' && r.index === 0), JSON.stringify(bDeleted.removed));
    await page.evaluate(() => editUndo(_mtPalette));
    check('undo brings the base trigger back', (await page.evaluate(() => editTriggerList('b').length)) === 1);
    await page.evaluate(() => editRedo(_mtPalette));

    // Capacity counts on the Info tab: base (minus removed) + placed. At this
    // point step has the two placed triggers (uid 1 at (6,6), uid 2 at
    // (5,5)) and the base one is hidden; B has none (deleted just above).
    await page.click('[data-edit-active-tab="info"]');
    const infoText = await page.evaluate(() => document.getElementById('rg-panels').textContent);
    check('the Info tab shows the trigger counts with no fabricated ceiling',
        /step triggers\D*2/.test(infoText) && /B-triggers\D*0/.test(infoText) && /no confirmed limit/.test(infoText),
        infoText.slice(0, 400));

    // ── keyboard shortcuts: text-input guard, then the real thing ──────────
    await page.click('[data-edit-active-tab="tile"]');
    await page.evaluate(() => { setupEditKeys(); editStroke({ x: 5, y: 5 }, 'down'); });   // select uid 2, at (5,5)
    const guarded = await page.evaluate(() => {
        const before = editDraft().undo.length;
        const input = document.createElement('input');
        document.body.appendChild(input);
        input.focus();
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true }));
        input.remove();
        return { blockedByInput: editDraft().undo.length === before, hasSelection: !!editDraft().selectedTriggerRef };
    });
    check('Delete is inert while a text input has focus, per webview-dom-safety',
        guarded.blockedByInput && guarded.hasSelection, JSON.stringify(guarded));

    const deletedByKey = await page.evaluate(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete' }));
        return editDraft().selectedTriggerRef;
    });
    check('Delete with real focus removes the selected trigger', deletedByKey === null);

    // Selecting a trigger (above) switched the dock to the Trigger tab, same
    // as every other select in this block — back to Tile for the rest of
    // this suite, which assumes the Tile tab's own panels are on screen.
    await page.click('[data-edit-active-tab="tile"]');

    // The composer starts collapsed — clicking a tile is the main path now,
    // and hand-composing is the fallback. Opening it must put it in the
    // panel column, not back in the section that is hidden while editing.
    check('the composer is collapsed until asked for',
        !(await page.$('#rg-compose')));
    await page.evaluate(() => document.querySelector('[data-panel="compose"]').click());
    check('and opens inside the panel column, not the hidden section',
        await page.evaluate(() => {
            var c = document.getElementById('rg-compose');
            return !!c && !!c.closest('#rg-panels');
        }));
    await page.evaluate(() => document.querySelector('[data-panel="compose"]').click());

    // ── the caret ──────────────────────────────────────────────────────────
    const before = await page.evaluate(() => _panelOpen.families);
    await page.evaluate(() => document.querySelector('[data-panel="families"] .rg-panel-caret').click());
    const after = await page.evaluate(() => _panelOpen.families);
    check('clicking a panel caret toggles that panel', before !== after,
        `families went ${before} -> ${after}; the click must walk up to the header`);
    await page.evaluate(() => document.querySelector('[data-panel="families"]').click());

    // ── families ───────────────────────────────────────────────────────────
    const eager = await page.evaluate(
        () => window.__sent.filter((m) => m.command === 'requestFamilySheet').map((m) => m.family));
    check('every chosen family is previewed up front', eager.length === 7 && eager.includes(35),
        'asked for: ' + JSON.stringify(eager));

    // ── family chips ───────────────────────────────────────────────────────
    // A family id is not a name, so a chip leads with its two most-placed
    // tiles and the act it belongs to. The old picker made you choose an id
    // out of a paged list of 329 before it would show you anything.
    await page.evaluate(() => applyFamilyCatalogue({ families: [
        { id: 32, tiles: 210, rooms: 13, areas: ['Antiqua', 'Prehistoria'], names: ["Fire Eyes' Village"] },
        { id: 220, tiles: 201, rooms: 13, areas: ['Omnitopia'], names: ['Reactor room'] },
        { id: 58, tiles: 74, rooms: 3, areas: ['Prehistoria'], names: ["Strong Heart's Hut"] },
        { id: 5, tiles: 9, rooms: 1, areas: ['Gothica'], names: ['Ebon Keep'] },
    ] }));

    const chipAsk = await page.evaluate(
        () => window.__sent.filter((m) => m.command === 'requestFamilyPreviews').pop());
    check('chip art is asked for two tiles at a time, for every family',
        chipAsk && chipAsk.tiles === 2 && chipAsk.families.length === 4, JSON.stringify(chipAsk));

    await page.evaluate(() => applyChipPreviews({ previews: {
        families: [32, 220, 58, 5], columns: 2, cell: 16,
        imageUri: 'data:image/png;base64,Y2hpcA==', imageWidth: 32, imageHeight: 64 } }));

    const chip58 = await page.$eval('[data-chip="58"]', (n) => ({
        art: n.querySelector('.rg-chip-art').getAttribute('style') || '', text: n.textContent }));
    check('a chip carries its own art, not a number alone',
        chip58.art.includes('base64,Y2hpcA==') && /58/.test(chip58.text), JSON.stringify(chip58));
    check('and the act it belongs to', /Prehistoria/.test(chip58.text), chip58.text);

    // An adopted family shows a real ×; the old one opened the picker.
    const before58 = await page.evaluate(() => editFamilies().slice());
    await page.click('.rg-chip.adopted [data-chip-drop]');
    const after58 = await page.evaluate(() => editFamilies().slice());
    check('the × on a chip frees its slot',
        before58.filter((f) => f !== undefined).length - 1
        === after58.filter((f) => f !== undefined).length,
        JSON.stringify(before58) + ' -> ' + JSON.stringify(after58));
    check('and the checks panel says what that stranded',
        await page.evaluate(() => typeof editStrandedCells === 'function'));

    // A chip filters the tile list; clearing shows everything again.
    await page.evaluate(() => { _chipSel = {}; renderEditPanels(); });
    const allGroups = await page.$$eval('.rg-tile-group', (n) => n.length);
    await page.click('[data-chip="220"]');
    const oneGroup = await page.$$eval('.rg-tile-group', (n) => n.map((e) => e.textContent));
    check('selecting a chip filters the tiles to that family',
        oneGroup.length === 1 && /220/.test(oneGroup[0]), JSON.stringify(oneGroup.length));
    await page.click('[data-chip="220"]');
    check('and clearing it shows everything again',
        (await page.$$eval('.rg-tile-group', (n) => n.length)) === allGroups);

    await page.fill('#rg-chip-filter', 'omni');
    const chips = await page.$$eval('[data-chip]', (n) => n.map((e) => e.dataset.chip));
    check('the chip filter narrows by act', chips.includes('220') && !chips.includes('5'),
        JSON.stringify(chips));
    await page.fill('#rg-chip-filter', '');

    await page.evaluate(() => {
        for (var i = 0; i < 7; i++) if (editFamilies()[i] === undefined) editFamilies()[i] = 700 + i;
        editFamilies()[3] = undefined;
        renderEditPanels();
    });
    const adopted = await page.evaluate(() => editAdoptFamilyFor(999));
    check('clicking a foreign tile adopts its family',
        adopted.ok && adopted.added && adopted.slot === 3, JSON.stringify(adopted));

    await page.evaluate(() => {
        for (var i = 0; i < 7; i++) if (editFamilies()[i] === undefined) editFamilies()[i] = 900 + i;
    });
    const full = await page.evaluate(() => editAdoptFamilyFor(1234));
    check('with all seven taken it refuses and says why',
        !full.ok && /clear one/.test(full.why), JSON.stringify(full));

    // ── the new room ───────────────────────────────────────────────────────
    check('nothing calls window.prompt', !FILES.map(read).join('').includes('prompt('),
        'a VS Code webview has no window.prompt; use the inline form');

    await page.click('[data-edit-act="new-room"]');
    check('new room opens a form', !!(await page.$('#rg-newroom')));
    await page.fill('#rg-nr-w', '20');
    await page.fill('#rg-nr-h', '9');
    await page.evaluate(() => { window.__sent.length = 0; });
    await page.click('[data-edit-act="new-room-go"]');
    const req = await page.evaluate(() => window.__sent.find((m) => m.command === 'requestBlankRoom'));
    check('create asks the host for the size typed',
        req && req.widthTiles === 20 && req.heightTiles === 9, JSON.stringify(req));

    await page.evaluate(() => applyBlankRoom({
        room: {
            widthTiles: 20, heightTiles: 9, borrowedFrom: 0x34, baseMetatile: 360,
            imageUri: 'data:image/png;base64,iVBORw0KGgo=', imageWidth: 320, imageHeight: 144,
            tileFamilies: [35], problems: [], budget: _mtPalette.budget,
            floor: { layer1: 0xa800, layer2: 0x4c62, collision: 0x0010 },
        },
    }));
    const applied = await page.evaluate(() => ({
        viewBox: document.getElementById('rg-svg').getAttribute('viewBox'),
        imgW: document.getElementById('rg-img').getAttribute('width'),
        w: _mtPalette.grid[0].length,
        h: _mtPalette.grid.length,
        formClosed: !document.getElementById('rg-newroom'),
        // A metatile is two of the map's 8px units.
        inBounds: editInBounds(_mtPalette, 19, 8),
        outOfBounds: !editInBounds(_mtPalette, 20, 9),
    }));
    check('the map becomes the blank room and can be painted',
        applied.viewBox === '0 0 40 18' && applied.w === 20 && applied.h === 9
        && applied.formClosed && applied.inBounds && applied.outOfBounds,
        JSON.stringify(applied));
    // The image lives in viewBox units of 8px, not pixels. Giving it 320
    // made a room eight times too big — the "very weird grid".
    check('the map image is sized in viewBox units, not pixels', applied.imgW === '40',
        'width=' + applied.imgW + ', expected 40 units (320px / 8)');

    // A 2x2 room is 4 units, under svg-builder's 8-unit floor.
    await page.evaluate(() => applyBlankRoom({ room: {
        widthTiles: 2, heightTiles: 2, borrowedFrom: 0x34, baseMetatile: 8,
        imageUri: 'data:image/png;base64,iVBORw0KGgo=', imageWidth: 32, imageHeight: 32,
        tileFamilies: [35], problems: [], budget: _mtPalette.budget,
        floor: { layer1: 0xa800, layer2: 0x4c62, collision: 0x0010 } } }));
    const tiny = await page.evaluate(() => ({
        viewBox: document.getElementById('rg-svg').getAttribute('viewBox'),
        imgW: document.getElementById('rg-img').getAttribute('width'),
        fine: document.querySelector('.rg-grid-fine').getAttribute('d'),
        coarse: document.querySelector('.rg-grid-coarse').getAttribute('d'),
    }));
    // The viewBox is the room exactly. svg-builder's 8-unit floor drew grid
    // lines past the edge, so a 2x2 room looked like a 4x4 one with twelve
    // empty cells — "2x2 shows 4x4 tiles".
    check('a 2x2 room gets a viewBox of exactly its own size',
        tiny.viewBox === '0 0 4 4' && tiny.imgW === '4', JSON.stringify(tiny));
    // And the grid is redrawn: svg-builder bakes it from the room it
    // rendered, so the previous room's lines survive a swap otherwise.
    check('and a grid that stops at its edge',
        tiny.fine === 'M0 0V4M1 0V4M2 0V4M3 0V4M4 0V4M0 0H4M0 1H4M0 2H4M0 3H4M0 4H4',
        tiny.fine);
    check('with the coarse line every metatile, not every tile',
        tiny.coarse === 'M0 0V4M2 0V4M4 0V4M0 0H4M0 2H4M0 4H4', tiny.coarse);

    // ── a tile is a brush ──────────────────────────────────────────────────
    // "click on a grass tile and it allows you to stamp it on the canvas,
    // which internally creates a metatile" — with the other two words empty.
    await page.evaluate(() => { editReset(0x34); editDraft().on = true; _mtPalette.count = 1; });
    const asGround = await page.evaluate(() => {
        editDraft().phase = 'room';
        var i = editOnTilePicked(0x0c02);
        var d = editDraft();
        return { made: i, brush: d.brush, added: d.added.slice() };
    });
    check('clicking a tile in room phase makes it the ground of a new stamp',
        asGround.added.length === 1 && asGround.added[0].layer2 === 0x0c02
        && asGround.added[0].collision === 0, JSON.stringify(asGround));
    check('with nothing drawn over it and no collision yet',
        asGround.added[0].layer1 === 0xa800 && asGround.added[0].collision === 0);
    check('and it becomes the brush straight away', asGround.brush === 1);

    const asDeco = await page.evaluate(() => {
        editDraft().phase = 'deco';
        editOnTilePicked(0x0c04);
        return editDraft().added.slice(-1)[0];
    });
    check('in deco phase the same click makes it the thing drawn over',
        asDeco.layer1 === 0x0c04 && asDeco.collision === 0, JSON.stringify(asDeco));

    // A graphic the room never loaded costs a Block 1 slot, and the word
    // has to name that new slot.
    const pulled = await page.evaluate(() => {
        editReset(0x34); editDraft().on = true; editDraft().phase = 'room';
        editFamilies()[0] = 58;
        editUseFamilyTile(4191, 58);
        var d = editDraft();
        return { graphics: d.addedGraphics.slice(), added: d.added.slice(), brush: d.brush };
    });
    check('picking a tile the room never loaded adopts the graphic',
        pulled.graphics.length === 1 && pulled.graphics[0] === 4191, JSON.stringify(pulled));
    check('and names it with a word for its new slot, in that family',
        // slot 1 (the room's sheet holds 1) -> chr 2; family 58 is in slot 1.
        pulled.added.length === 1 && pulled.added[0].layer2 === (2 | (1 << 10)),
        JSON.stringify(pulled.added));

    const sent = await page.evaluate(
        () => window.__sent.filter((m) => m.command === 'requestComposedPreview').slice(-1)[0]);
    check('and the preview is told about the graphic, or it would draw the wrong tile',
        sent && sent.extra && sent.extra.graphics.indexOf(4191) >= 0, JSON.stringify(sent && sent.extra));

    // ── a family tile is a brush, visibly ──────────────────────────────────
    // The whole click path, through the real handler: the dead branch that
    // never called editUseFamilyTile left the brush at -1, so the map could
    // not be painted and the checks still said "no brush selected".
    await page.evaluate(() => {
        editReset(0x34);
        editDraft().on = true;
        editFamilies()[2] = 58;
        _chipSel = { 58: true };
        _famSheets[58] = { family: 58, count: 2, total: 74, roomCount: 3, columns: 16, cell: 16,
            slots: [[0, 0, 4186, 9], [1, 2, 4191, 4]], imageUri: 'data:image/png;base64,ZmFt' };
        _panelOpen.tiles = true;
        renderEditPanels();
    });
    await page.click('[data-fam-tile]');
    const armed = await page.evaluate(() => ({
        brush: editDraft().brush,
        added: editDraft().added.length,
        note: document.getElementById('rg-edit-count').textContent,
        rings: document.querySelectorAll('#rg-panels .rs-mt-cell.sel').length,
        blocking: editErrors(_mtPalette).filter((e) => /no brush/.test(e[1])).length,
    }));
    check('clicking a family tile arms a brush', armed.brush >= 0 && armed.added === 1,
        JSON.stringify(armed));
    check('and says so, instead of being overwritten by the summary',
        /brush: graphic 4186/.test(armed.note), armed.note);
    check('and marks the swatch itself', armed.rings === 1, 'rings=' + armed.rings);
    check('so the checks stop asking for a brush', armed.blocking === 0);

    const painted = await page.evaluate(() => {
        editStroke({ x: 1, y: 1 }, 'down');
        return { cells: Object.keys(editDraft().cells).length,
                 note: document.getElementById('rg-edit-count').textContent };
    });
    check('and the map can actually be painted with it', painted.cells === 1,
        JSON.stringify(painted));
    check('after which the status goes back to the live summary',
        /1 cell/.test(painted.note), painted.note);

    // Pixel art at 16px cannot be told apart; the strips keep the palette's
    // integer 2x scale.
    const cellBox = await page.$eval('[data-fam-tile]',
        (e) => { const r = e.getBoundingClientRect(); return { w: r.width, h: r.height }; });
    check('tile swatches are 32px, not 16', cellBox.w === 32 && cellBox.h === 32,
        JSON.stringify(cellBox));

    // ── tiles in their own family, ranked by relationship ──────────────────
    await page.evaluate(() => applyFamilySheet({
        sheet: {
            family: 58, count: 3, total: 74, roomCount: 3, columns: 16, cell: 16,
            // [slot, chr, graphic, placements, canopyUses, terrainUses]
            slots: [[0, 0, 4191, 10, 90, 10], [1, 2, 4195, 5, 2, 40], [2, 4, 4200, 99, 0, 0]],
            imageUri: 'data:image/png;base64,ZmFt',
        },
    }));
    await page.evaluate(() => { _chipSel = { 58: true }; _panelOpen.tiles = true; renderEditPanels(); });
    const strip = await page.evaluate(() => document.getElementById('rg-panels').innerHTML);
    check('a family’s tiles are drawn in that family, not the room’s palette',
        strip.includes('base64,ZmFt') && strip.includes('data-fam-of="58"'));
    // Everything the host sent is shown. "showing 16" hid two of eighteen
    // for no reason; the host's own 128-graphic cap is the only real one.
    const swatches58 = await page.$$eval('[data-fam-of="58"]', (n) => n.length);
    check('every tile the host sent is shown, with no arbitrary cut', swatches58 === 3,
        String(swatches58));

    // Vanilla decides the layer where it is one-sided enough, and the badge
    // has to say which — 4822 of 5628 graphics are ≥90% one-sided.
    const badges = await page.$$eval('[data-fam-of="58"]',
        (n) => n.map((e) => [e.dataset.famTile, e.className]));
    check('a mostly-canopy tile is badged for the foreground',
        /rg-lay-front/.test(badges.find((b) => b[0] === '4191')[1]), JSON.stringify(badges));
    check('and a mostly-terrain one for the ground',
        /rg-lay-ground/.test(badges.find((b) => b[0] === '4195')[1]), JSON.stringify(badges));
    check('while a tile vanilla is undecided about gets neither',
        !/rg-lay-/.test(badges.find((b) => b[0] === '4200')[1]), JSON.stringify(badges));

    // Any tile can be forced onto either layer — a tilemap word does not
    // care which of the two slots it is written into.
    await page.click('[data-layer-force="canopy"]');
    check('forcing the foreground overrides vanilla for every tile',
        await page.$$eval('[data-fam-of="58"]',
            (n) => n.every((e) => /rg-lay-front/.test(e.className))));
    await page.click('[data-layer-force="auto"]');

    // Relationship ordering: with 4195 placed, its neighbours come first
    // even though 4200 has ten times the placements.
    await page.evaluate(() => applyRelatedTiles({
        related: [[4191, 92, 47], [4200, 3, 2]] }));
    const order = await page.$$eval('[data-fam-of="58"]', (n) => n.map((e) => e.dataset.famTile));
    check('the strongest relationship sorts to the front, not the biggest count',
        order[0] === '4191', JSON.stringify(order));
    const strip2 = await page.evaluate(() => document.getElementById('rg-panels').textContent);
    check('and the neighbours are offered as their own strip',
        /Drawn next to what you have placed/.test(strip2) && /92%/.test(strip2));

    // ── the deco library ───────────────────────────────────────────────────
    // Section 3 objects are vanilla's own deco widgets — gourds, pots, fire
    // pits — so the library is read out of the ROM rather than invented.
    const DECO = [
        // `families` is the ids, not a count: whether an entry is usable
        // depends on the seven the draft already holds, which only the
        // editor knows. PALETTE has 35, 187, 58, 165, 149, 59, 166.
        { id: 0, area: 'Prehistoria', roomName: "Strong Heart's Hut", room: 0x34, w: 2, h: 2,
          states: 1, count: 3, families: [58], graphics: 3, cells: 4, front: false, scriptId: null },
        { id: 1, area: 'Prehistoria', roomName: "Fire Eyes' Village", room: 0x25, w: 4, h: 3,
          states: 2, count: 4, families: [35], graphics: 2, cells: 2, front: true, scriptId: 0xd74 },
        { id: 2, area: 'Gothica', roomName: 'Ebon Keep', room: 0x60, w: 6, h: 6,
          states: 1, count: 1, families: [220, 5], graphics: 9, cells: 30, front: true, scriptId: null },
    ];
    await page.evaluate((deco) => {
        editReset(0x34);
        editDraft().on = true;
        _panelOpen = { families: false, tiles: false, deco: true, needed: false, errors: true, compose: false };
        applyDecoLibrary({ deco: deco });
        applyDecoPreviews({ previews: { ids: [0, 1, 2], columns: 6, cell: 48,
            imageUri: 'data:image/png;base64,ZGVjbw==', imageWidth: 288, imageHeight: 48 } });
    }, DECO);
    check('the deco library renders as thumbnails', (await page.$$('.rg-deco')).length === 3);
    check('each one carries its size and where it came from',
        /Fire Eyes/.test(await page.$eval('[data-deco="1"]', (n) => n.getAttribute('title'))));

    await page.click('[data-deco="1"]');
    const askedFor = await page.evaluate(
        () => window.__sent.filter((m) => m.command === 'requestDeco' && m.cells !== undefined).pop());
    check('clicking one asks the host for its cells', askedFor && askedFor.cells === 1,
        JSON.stringify(askedFor));

    // Cells are `{graphic, family, flags}` per layer, not raw words: a word
    // is room-relative and replaying one elsewhere names a different
    // picture in different colours. A `null` layer keeps what is there,
    // which is how an entry stays agnostic of the floor it was cut from.
    const ENTRY = {
        id: 1, w: 2, h: 1, states: 2, room: 0x25, roomName: "Fire Eyes' Village",
        families: [58], graphics: [0x0422, 9999],
        trigger: { dx: 0, dy: 0, w: 3, h: 2, scriptId: 0xd74 },
        cells: [
            { dx: 0, dy: 0, canopy: { graphic: 0x0422, family: 58, flags: 0 }, terrain: null, collision: 0x001f },
            { dx: 1, dy: 0, canopy: { graphic: 9999, family: 58, flags: 0 }, terrain: null, collision: 0x001f },
        ],
    };
    await page.evaluate((entry) => applyDecoCells({ entry: entry }), ENTRY);
    const armedDeco = await page.evaluate(() => {
        const d = editDraft();
        return { tool: d.tool, constructs: d.constructs.length, pick: _editConstruct,
                 name: d.constructs[0].name, note: document.getElementById('rg-edit-count').textContent };
    });
    check('and it becomes an armed construct',
        armedDeco.tool === 'stamp' && armedDeco.constructs === 1 && armedDeco.pick === 0,
        JSON.stringify(armedDeco));
    check('named for where it came from, since the ROM has no names',
        /Fire Eyes/.test(armedDeco.name), armedDeco.name);
    // A gourd is art plus an object record plus a B-trigger on a script;
    // the arming note has to say which script, because two copies of the
    // same entry share its flag.
    check('an entry that comes with a script says so before it is placed',
        /0xd74/.test(armedDeco.note), armedDeco.note);

    const stamped = await page.evaluate(() => {
        editStroke({ x: 0, y: 0 }, 'down');
        const d = editDraft();
        return { cells: Object.keys(d.cells).length, added: d.added.length,
                 graphics: d.addedGraphics.slice(), placed: d.placed.slice(),
                 words: d.added.map((a) => [a.layer1, a.layer2]) };
    });
    check('stamping it writes its cells', stamped.cells === 2 && stamped.added === 2,
        JSON.stringify(stamped));
    // Family 58 already sits in palette slot 3, so the word is rebuilt as
    // pal 3 pointing at whichever Block 1 slot the graphic landed in.
    check('each word is rebuilt for this room, not copied',
        stamped.words[0][0] === 0x0c00 && stamped.words[1][0] === 0x0c02,
        JSON.stringify(stamped.words));
    check('a graphic the room never loaded is adopted, and costs a slot',
        stamped.graphics.length === 1 && stamped.graphics[0] === 9999,
        JSON.stringify(stamped.graphics));
    // `terrain: null` means "keep the floor that is already here" — the
    // whole of being agnostic of the background.
    check('a null layer keeps the floor already in the cell',
        stamped.words.every((w) => w[1] === 0x4c62), JSON.stringify(stamped.words));
    check('and the object record and its B-trigger come along',
        stamped.placed.length === 2
        && stamped.placed.some((p) => p.kind === 'object')
        && stamped.placed.some((p) => p.kind === 'bTrigger' && p.scriptId === 0xd74),
        JSON.stringify(stamped.placed));

    // ── undo takes the metatiles with it ───────────────────────────────────
    const undone = await page.evaluate(() => {
        editUndo(_mtPalette);
        const d = editDraft();
        return { cells: Object.keys(d.cells).length, added: d.added.length,
                 graphics: d.addedGraphics.length, placed: d.placed.length };
    });
    check('undo reverts the cells and the metatiles they needed',
        undone.cells === 0 && undone.added === 0 && undone.graphics === 0,
        'a dictionary that only grows makes the budget a lie: ' + JSON.stringify(undone));
    check('and the object and trigger it attached', undone.placed === 0, JSON.stringify(undone));
    const redone = await page.evaluate(() => {
        editRedo(_mtPalette);
        return editDraft().placed.length;
    });
    check('redo puts them back', redone === 2, String(redone));
    await page.evaluate(() => editUndo(_mtPalette));

    // Only the tail is pruned — an index is a position, so removing from the
    // middle would silently repoint every cell above it.
    const tailOnly = await page.evaluate(() => {
        editReset(0x34);
        const d = editDraft();
        d.on = true;
        editAddStamp(_mtPalette, { layer1: 1, layer2: 2, collision: 3 });
        editApply([{ x: 0, y: 0, index: _mtPalette.count }]);
        editAddStamp(_mtPalette, { layer1: 4, layer2: 5, collision: 6 });
        editApply([{ x: 1, y: 0, index: _mtPalette.count + 1 }]);
        editUndo(_mtPalette);           // drops the second cell and its stamp
        return { added: d.added.length, first: d.cells['0,0'] };
    });
    check('and keeps the stamps still in use, at their original index',
        tailOnly.added === 1 && tailOnly.first === (await page.evaluate(() => _mtPalette.count)),
        JSON.stringify(tailOnly));

    // ── the deco filter ────────────────────────────────────────────────────
    await page.fill('#rg-deco-filter', '6x6');
    check('a size filter narrows the library',
        (await page.$$eval('.rg-deco', (n) => n.map((e) => e.dataset.deco))).join() === '2');
    await page.fill('#rg-deco-filter', 'gothica');
    check('so does an act', (await page.$$eval('.rg-deco', (n) => n.length)) === 1);
    await page.fill('#rg-deco-filter', 'ebon keep');
    check('and every word has to match, so two narrow further',
        (await page.$$eval('.rg-deco', (n) => n.map((e) => e.dataset.deco))).join() === '2');
    await page.fill('#rg-deco-filter', '');

    // ── the four questions, as buttons ─────────────────────────────────────
    // "A working, foreground gourd out of my own families" is the ask; it
    // is 27 of the 532 in room 0x34, and unfindable without these.
    const onScreen = () => page.$$eval('.rg-deco', (n) => n.map((e) => e.dataset.deco).join());
    check('an entry that needs families you lack is marked with its cost',
        await page.$eval('[data-deco="2"]', (n) => n.classList.contains('rg-deco-costly')
            && n.querySelector('.rg-deco-cost').textContent === '+2'));
    check('and one your families already draw is not',
        await page.$eval('[data-deco="1"]', (n) => !n.classList.contains('rg-deco-costly')));

    await page.click('[data-deco-flag="fits"]');
    check('"fits" keeps only what your seven families already draw', await onScreen() === '0,1');
    await page.click('[data-deco-flag="works"]');
    check('and "works" narrows that to the ones with a script', await onScreen() === '1');
    await page.click('[data-deco-flag="front"]');
    check('and "front" to foreground-only — the gourd you asked for',
        await onScreen() === '1');
    const panelText = await page.$eval('#rg-panels', (n) => n.textContent);
    check('the count says how much of the library survived',
        /1 of 3\s+objects/.test(panelText), panelText.slice(0, 300));
    await page.click('[data-deco-flag="fits"]');
    await page.click('[data-deco-flag="works"]');
    await page.click('[data-deco-flag="front"]');
    check('and turning them off brings the library back', await onScreen() === '0,1,2');

    // ── picking a tile is choosing to paint ────────────────────────────────
    // The stamp tool places the armed construct and ignores the brush, so
    // arming a widget and then clicking a tile sent the click to the
    // widget: "I'm not allowed to stamp a gourd tile".
    await page.click('[data-deco="1"]');
    await page.evaluate((entry) => applyDecoCells({ entry: entry }), ENTRY);
    check('arming a widget selects the stamp tool',
        await page.evaluate(() => editDraft().tool) === 'stamp');
    await page.evaluate(() => { _panelOpen.tiles = true; renderEditPanels(); });
    await page.click('[data-fam-tile="4191"]');
    const armedTile = await page.evaluate(
        () => ({ tool: editDraft().tool, construct: _editConstruct, brush: editDraft().brush }));
    check('and then picking a tile hands the clicks back to the brush',
        armedTile.tool === 'paint' && armedTile.construct === -1 && armedTile.brush >= 0,
        JSON.stringify(armedTile));

    // ── resizing the canvas ────────────────────────────────────────────────
    // The grip lives inside #rg-wrap, whose capture-phase handlers would
    // otherwise read the drag as a paint stroke in the corner cell.
    await page.evaluate(() => {
        editReset(0x34);
        const d = editDraft();
        d.on = true;
        d.blank = { widthTiles: 4, heightTiles: 4, borrowedFrom: 0x34, problems: [] };
        _mtPalette = Object.assign({}, _mtPalette, { widthTiles: 4, heightTiles: 4 });
        d.cells['3,3'] = 0;
        d.cells['0,0'] = 0;
        const wrap = document.getElementById('rg-wrap');
        if (!document.getElementById('rg-resize')) {
            wrap.insertAdjacentHTML('beforeend', buildResizeHandleHtml());
        }
        const svg = document.getElementById('rg-svg');
        svg.setAttribute('width', 400); svg.setAttribute('height', 400);
        svg.style.width = '400px'; svg.style.height = '400px';
        wrap.style.width = '400px'; wrap.style.height = '400px';
        setupEditGestures();
    });
    const grip = await page.$('#rg-resize');
    const gb = await grip.boundingBox();
    await page.mouse.move(gb.x + 6, gb.y + 6);
    await page.mouse.down();
    // 400px over four tiles is 100px each; two tiles smaller each way.
    await page.mouse.move(gb.x + 6 - 200, gb.y + 6 - 200, { steps: 4 });
    const live = await page.evaluate(() => ({
        size: _resizing && [_resizing.w, _resizing.h],
        label: document.getElementById('rg-resize-label').textContent,
        shown: document.getElementById('rg-resize-label').style.display,
        painted: Object.keys(editDraft().cells).length,
    }));
    check('dragging the grip tracks a size in tiles',
        live.size && live.size[0] === 2 && live.size[1] === 2, JSON.stringify(live));
    check('and says what it costs before the mouse comes up',
        /2×2/.test(live.label) && /bytes/.test(live.label) && live.shown === 'block', live.label);
    // The grid and the dictionary share one 32768-byte window: 2*2*2 for the
    // grid, plus 8 for the room's one stamp.
    check('the cost is the grid plus the dictionary', /16\/32768 bytes/.test(live.label), live.label);
    check('and it warns which cells the shrink would drop',
        /drops 1 cell/.test(live.label), live.label);
    check('the drag is not also a paint stroke', live.painted === 2, String(live.painted));

    await page.mouse.up();
    const resized = await page.evaluate(
        () => window.__sent.filter((m) => m.command === 'requestBlankRoom').pop());
    check('releasing asks the host for a map that size',
        resized && resized.widthTiles === 2 && resized.heightTiles === 2, JSON.stringify(resized));

    // A resize keeps what still fits; a new room does not.
    await page.evaluate(() => applyBlankRoom({ room: {
        widthTiles: 2, heightTiles: 2, borrowedFrom: 0x34, baseMetatile: 8,
        imageUri: 'data:image/png;base64,cg==', tileFamilies: [35], problems: [],
        budget: _mtPalette.budget } }));
    const kept = await page.evaluate(() => Object.keys(editDraft().cells));
    check('the cells that still fit survive the resize', kept.join() === '0,0', JSON.stringify(kept));

    // A ROM room cannot resize: baseMetatile is w*h*2, so it would renumber
    // every metatile id in the room.
    const refused = await page.evaluate(() => {
        editDraft().blank = null;
        _resizing = { w0: 4, h0: 4, w: 6, h: 6 };
        resizeEnd();
        return document.getElementById('rg-edit-count').textContent;
    });
    check('a ROM room refuses, and says why', /renumbers every metatile/.test(refused), refused);

    // ── binding the panel twice must not double every click ────────────────
    // #room-detail survives a room re-render — only its innerHTML is
    // replaced — so a second bind stacked a second handler and every
    // toggle cancelled itself out. That was "the edit and new map button
    // work every now and then": alive after an odd number of renders.
    await page.evaluate(() => {
        document.getElementById('room-detail').insertAdjacentHTML('afterbegin', buildEditButtonHtml());
        // One more bind, for the second render of the same panel. Without
        // the guard that makes two handlers, and two is the dead case.
        bindEditControls(document.getElementById('room-detail'), {});
    });
    const wasOn = await page.evaluate(() => !!editDraft().on);
    await page.click('#rg-edit-btn');
    const nowOn = await page.evaluate(() => !!editDraft().on);
    check('binding the panel again does not double every click', nowOn === !wasOn,
        `edit mode went ${wasOn} -> ${nowOn} after one click, with the panel bound twice`);
    await page.click('#rg-edit-btn');
    check('and the next click toggles it straight back',
        await page.evaluate(() => !!editDraft().on) === wasOn);

    check('no uncaught errors in any of it', pageErrors.length === 0, pageErrors.join('; '));

    await browser.close();
    console.log(`\n  ${passed} passed, ${failed} failed`);
    if (failed) process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });
