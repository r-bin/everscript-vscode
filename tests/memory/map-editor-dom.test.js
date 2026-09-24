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
    'map-editor-relations.js', 'map-editor-chips.js', 'map-editor-stranded.js',
    'map-editor-tiles.js', 'map-editor-deco.js', 'map-editor-special.js',
    'map-editor-trigger-select.js', 'map-editor-trigger-panel.js',
    'map-editor-toolbar.js', 'map-editor-filterbar.js', 'rom-overlay.js',
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

    const CSS = ['shared/shared.css', 'rooms/webview/map-editor-theme.css',
        'rooms/webview/map-editor-canvas.css', 'rooms/webview/map-editor-tile-tab.css']
        .map((f) => fs.readFileSync(path.join(__dirname, '..', '..', 'src', ...f.split('/')), 'utf8'))
        .join('\n');
    // The real stylesheets: without them every swatch is 0x0, so nothing is
    // clickable and no size assertion means anything. `.rg-theme` matches the
    // class renderRoomDetail puts on the real #room-detail (detail-renderer.js).
    //
    // The canvas zone / card wrappers are svg-builder.js's own structure as of
    // Phase 7a: the card is what the tool pill positions against and what
    // editToggle inserts it into, so a harness without it would test a
    // different DOM shape than the one that ships.
    await page.setContent(`<!doctype html><html><head><style>${CSS}</style></head>
        <body style="display:block;height:auto;overflow:auto"><div id="room-detail" class="rg-theme">
        <div class="rg-outer rs-map" id="rg-outer">
        <div class="rg-canvas-zone" id="rg-canvas-zone">
        <div class="rg-canvas-card" id="rg-canvas-card"><div class="rg-wrap" id="rg-wrap"
        style="width:400px;height:300px">
        <svg class="rg-svg" id="rg-svg" viewBox="0 0 4 4"><image id="rg-img"/>
        <path class="rg-grid-fine" d="M0 0V99"/><path class="rg-grid-coarse" d="M0 0V99"/>
        </svg></div>
        <div class="rg-zoom" id="rg-zoom"><button id="rg-zout">-</button>
        <span class="rg-zoom-level" id="rg-zoom-level">—</span>
        <button id="rg-zin">+</button><button id="rg-zfit">fit</button></div>
        </div></div></div>
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
        // The two docked bars svg-builder.js appends under the canvas card.
        // The status bar is where `#rg-edit-count` lives as of Phase 7a, so
        // without it every status-line assertion below would read a null.
        document.getElementById('rg-outer').insertAdjacentHTML('beforeend',
            buildViewFilterBarHtml({ romId: true, hasMap: true, hasTriggers: true, hasScripts: true,
                hasObjects: true, hasEntrances: true, hasEnemies: true, hasPoi: true, hasIngr: true,
                hasSpawns: true, hasHitbox: true, hasArrivals: true, hasHeader: true })
            + buildStatusBarHtml({ widthTiles: 2, heightTiles: 2 }));
        bindEditControls(document.getElementById('room-detail'), {});
        setupStatusBar();
        editToggle({}, null);
    }, PALETTE);

    check('edit mode builds the panel column', !!(await page.$('#rg-panels')));

    // ── the canvas column: the tool pill lives inside the card ─────────────
    // It is absolutely positioned against the card's top edge, so a pill
    // inserted anywhere else would float against the wrong box — and
    // `editToggle`'s host lookup is the only thing that decides which.
    check('the tool pill is inserted inside the canvas card, not above it',
        await page.evaluate(() => {
            const bar = document.getElementById('rg-edit-bar');
            return !!bar && !!bar.closest('#rg-canvas-card');
        }));
    check('and floats over the card rather than pushing the grid down',
        await page.evaluate(() => getComputedStyle(document.getElementById('rg-edit-bar')).position) === 'absolute');
    // Icon-only, one row: the words are gone, so every button must carry a
    // tooltip or the pill is unreadable.
    const pillButtons = await page.$$eval('#rg-edit-bar .rdf',
        (n) => n.map((e) => ({ title: e.getAttribute('title') || '', text: e.textContent.trim() })));
    check('every pill button has a tooltip, since the labels are icons now',
        pillButtons.length > 0 && pillButtons.every((b) => b.title.length > 0),
        JSON.stringify(pillButtons.filter((b) => !b.title)));
    check('the tool buttons are icons, not words',
        await page.$eval('[data-edit-tool="paint"]', (n) => n.textContent.trim()) === '✎');
    // §8a.2 removed the room/deco pair: layer targeting is the Tile tab's
    // auto|front|ground row, and editResolve reads decoration-vs-ground off
    // the brush's own words, so the pill has nothing to offer here.
    check('and the room/deco phase pair is gone from the pill',
        await page.evaluate(() => !document.querySelector('[data-edit-phase]')));
    // discard / copy draft / new room moved behind the ⋯ overflow. They must
    // still be reachable — that is this phase's whole constraint.
    check('discard, copy draft and new room moved into the ⋯ overflow menu',
        await page.evaluate(() => ['clear', 'export', 'new-room'].every((a) => {
            const btn = document.querySelector('[data-edit-act="' + a + '"]');
            return !!btn && !!btn.closest('#rg-tool-dropdown');
        })));
    const toolMenuHidden = () => page.$eval('#rg-tool-dropdown',
        (n) => n.hidden && getComputedStyle(n).display === 'none');
    check('the overflow menu starts closed, in computed style as well as .hidden',
        await toolMenuHidden());
    await page.click('[data-edit-tool-menu]');
    check('the ⋯ button opens it',
        await page.$eval('#rg-tool-dropdown', (n) => !n.hidden && getComputedStyle(n).display !== 'none'));
    // Geometry, not the `bottom` declaration: Chromium resolves `bottom:auto`
    // to a used pixel value, so only the boxes say which way it actually went.
    check('and it opens downward, since the pill hangs off the card’s top edge',
        await page.evaluate(() => {
            const caret = document.querySelector('[data-edit-tool-menu]').getBoundingClientRect();
            const pop = document.getElementById('rg-tool-dropdown').getBoundingClientRect();
            return pop.top >= caret.bottom - 1;
        }));
    await page.click('[data-edit-active-tab="tile"]');
    check('a click elsewhere closes it again', await toolMenuHidden());

    // ── the zoom chip ──────────────────────────────────────────────────────
    check('the zoom chip sits inside the card, not in a row above it',
        await page.evaluate(() => {
            const z = document.getElementById('rg-zoom');
            const s = getComputedStyle(z);
            return !!z.closest('#rg-canvas-card') && s.position === 'absolute';
        }));
    check('and the + / − / fit controls are still there',
        !!(await page.$('#rg-zin')) && !!(await page.$('#rg-zout')) && !!(await page.$('#rg-zfit')));

    // ── the status bar ─────────────────────────────────────────────────────
    check('the status line moved out of the pill into the status bar',
        await page.evaluate(() => {
            const c = document.getElementById('rg-edit-count');
            return !!c && !!c.closest('#rg-statusbar') && !c.closest('#rg-edit-bar');
        }));
    check('and reports the room size beside it',
        await page.$eval('#rg-status-size', (n) => n.textContent) === '2 × 2');

    // Two tile pickers on screen at once — the panels and the pre-rebuild
    // palette section — was "the first time you click it you get an old
    // version of the editor".
    check('and hides the browsing palette while it is open',
        await page.evaluate(() => document.getElementById('rs-mt').classList.contains('rs-mt-hidden')));

    // ── the tab shell ──────────────────────────────────────────────────────
    // Five tabs (Tile / Special / Trigger / Info / Widgets) file everything
    // that used to stack as one long column of collapsible panels
    // (docs/map-editor-redesign-plan.md).
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
        // No phase to set first as of §8a.2 — erase reads the cell itself.
        editStroke({ x: 0, y: 0 }, 'down');
    });
    check('erasing removes the glyph from the canvas', !(await page.$('#rg-edit .rg-special-glyph')));
    check('and clears specialCells', (await page.evaluate(() => editSpecialAt(0, 0))) === null);
    check('and the stamp goes back to the room’s own, not a leftover gated one',
        (await page.evaluate(() => editDraft().cells['0,0'])) === 0);

    // ── the filter bar: six controls, ~25 toggles, all still reachable ─────
    // The harness never loads interactions.js (setupClickHandlers), so the
    // `data-hide` sub-toggles are not exercised by a real click here — every
    // filter chip in this bar has always had that gap in this suite. What is
    // asserted is the Phase 7a regrouping: that nothing was dropped on the
    // way into the dropdowns, and that each caret still opens exactly one.
    const barKeys = await page.evaluate(() => {
        const bar = document.querySelector('.rg-view-filters');
        return {
            hide: [...bar.querySelectorAll('[data-hide]')].map((n) => n.dataset.hide).sort(),
            ov: [...bar.querySelectorAll('[data-ov]')].map((n) => n.dataset.ov).sort(),
            layer: [...bar.querySelectorAll('[data-layer]')].map((n) => n.dataset.layer).sort(),
            vis: [...bar.querySelectorAll('[data-vis-layer]')].map((n) => n.dataset.visLayer).sort(),
            ids: [...bar.querySelectorAll('.rg-filter-popup')].map((n) => n.id).sort(),
            // The primary row: the segmented pill, four chip groups, the
            // divider and the two action buttons — not 25 loose chips.
            topLevel: bar.children.length,
        };
    });
    // Every pre-existing data-hide key from before the regroup. Dropping one
    // would be silent: it is a whole overlay the user can no longer turn off.
    const WANT_HIDE = ['hide-arrival', 'hide-btrig', 'hide-enem', 'hide-ent', 'hide-fg',
        'hide-grid16', 'hide-grid8', 'hide-header', 'hide-hitbox', 'hide-ingr', 'hide-map',
        'hide-obj', 'hide-poi', 'hide-scripts', 'hide-spawn', 'hide-special',
        'hide-special-entrance', 'hide-special-gate', 'hide-special-stairs', 'hide-step',
        'hide-trigger'].sort();
    check('every view toggle survived the regroup into dropdowns',
        barKeys.hide.join() === WANT_HIDE.join(),
        'missing: ' + WANT_HIDE.filter((k) => !barKeys.hide.includes(k)).join()
        + ' | unexpected: ' + barKeys.hide.filter((k) => !WANT_HIDE.includes(k)).join());
    check('and every ROM feature flag, including the nine in the overflow drawer',
        barKeys.ov.sort().join() === 'c,d,e,g,l,n,o,p,t');
    check('with the composite layer pick reachable in that drawer',
        barKeys.layer.join() === 'composite');
    check('and Background/Foreground as two segments over the one layer choice',
        barKeys.vis.join() === 'bg,fg');
    check('the bar is six controls plus the two actions, not a wall of chips',
        barKeys.topLevel <= 8, 'top-level children: ' + barKeys.topLevel);
    check('four dropdowns, one mechanism',
        barKeys.ids.join() === 'rg-more-dropdown,rg-objects-dropdown,rg-special-dropdown,rg-trigger-dropdown',
        barKeys.ids.join());

    // Checks computed `display`, not just the `.hidden` IDL property — a
    // real CSS bug (`.rg-filter-popup{display:flex}`, an author rule, silently
    // beat the UA stylesheet's `[hidden]{display:none}` regardless of
    // selector specificity) left the popup visually open at all times while
    // `.hidden` still read true, and a `.hidden`-only check never caught it.
    // `rg-more-dropdown` is a `display:grid` popup, so it needs its own
    // `[hidden]` override and its own version of this check.
    const popupHidden = (id) => page.$eval('#' + id,
        (n) => n.hidden && getComputedStyle(n).display === 'none');
    const popupShown = (id) => page.$eval('#' + id,
        (n) => !n.hidden && getComputedStyle(n).display !== 'none');
    for (const [attr, id] of [['edit-special-menu', 'rg-special-dropdown'],
        ['edit-trigger-menu', 'rg-trigger-dropdown'],
        ['edit-objects-menu', 'rg-objects-dropdown'],
        ['edit-more-menu', 'rg-more-dropdown']]) {
        check(id + ' starts closed', await popupHidden(id));
        await page.click(`[data-${attr}]`);
        check('its caret opens it', await popupShown(id));
        await page.click('[data-edit-active-tab="tile"]');
        check('and a click elsewhere in the panel closes it again', await popupHidden(id));
    }

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

    // §8a.2 removed both the hand-composer and the "new metatiles" read-out
    // from the Tile tab: "the meta tile list and editor are not needed for
    // now, they are calculated dynamically/implicitly". The machinery stays
    // — editAddStamp still invents a stamp the moment a stroke needs one —
    // only the panels that surfaced it by hand are gone.
    check('the hand-composer panel is gone from the Tile tab',
        await page.evaluate(() => !document.querySelector('[data-panel="compose"]')
            && !document.getElementById('rg-compose')));
    check('and so is the "new metatiles" read-out',
        await page.evaluate(() => !document.querySelector('[data-panel="needed"]')));
    check('but a stroke still invents the stamp it needs',
        await page.evaluate(() => {
            var before = editDraft().added.length;
            editAddStamp(_mtPalette, { layer1: 0x1234, layer2: 0x5678, collision: 0 });
            return editDraft().added.length === before + 1;
        }));

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

    // ── the TILE FAMILIES section ──────────────────────────────────────────
    // A family id is not a name, so a card leads with its two most-placed
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
    check('a family card carries its own art, not a number alone',
        chip58.art.includes('base64,Y2hpcA==') && /58/.test(chip58.text), JSON.stringify(chip58));
    check('and the act it belongs to', /Prehistoria/.test(chip58.text), chip58.text);

    // §8a: the palette's seven and the ~320 candidates are two groups, never
    // one interleaved list — mixing two different actions (× and +) into one
    // strip is most of why this panel read as noise.
    const groups0 = await page.evaluate(() => ({
        cards: document.querySelectorAll('.rg-fam-card').length,
        drops: document.querySelectorAll('[data-chip-drop]').length,
        adopts: document.querySelectorAll('[data-chip-adopt]').length,
        filter: !!document.getElementById('rg-chip-filter'),
    }));
    check('the palette’s own seven are the section, one card each, all removable',
        groups0.cards === 7 && groups0.drops === 7, JSON.stringify(groups0));
    // §8a.2 removed the add-a-family disclosure outright: "add family is
    // obsolete (especially if there are already 7 families loaded)".
    // Adoption still happens — clicking any tile from an unadopted family
    // pulls that family in behind it — which is exactly why the explicit
    // browse-by-id control was redundant.
    check('the add-a-family disclosure is gone, and its filter with it',
        groups0.adopts === 0 && !groups0.filter
        && await page.evaluate(() => !document.querySelector('[data-fam-add]')),
        JSON.stringify(groups0));

    // Collapsed is not empty — the mock's compact strip of seven slots. The
    // `.hidden` IDL property would not catch a rule that paints anyway
    // (Phase 6's bug), so this asserts computed display.
    await page.evaluate(() => document.querySelector('[data-panel="families"]').click());
    const shut = await page.evaluate(() => ({
        cards: document.querySelectorAll('.rg-fam-card').length,
        slots: document.querySelectorAll('.rg-fam-slot').length,
        display: getComputedStyle(document.querySelector('.rg-fam-strip')).display,
    }));
    check('collapsing the section leaves the seven slots as a strip',
        shut.cards === 0 && shut.slots === 7 && shut.display === 'flex', JSON.stringify(shut));
    await page.evaluate(() => document.querySelector('[data-panel="families"]').click());

    // An adopted family shows a real ×; the old one opened the picker.
    const before58 = await page.evaluate(() => editFamilies().slice());
    await page.click('.rg-fam-card.adopted [data-chip-drop]');
    const after58 = await page.evaluate(() => editFamilies().slice());
    check('the × on a card frees its slot',
        before58.filter((f) => f !== undefined).length - 1
        === after58.filter((f) => f !== undefined).length,
        JSON.stringify(before58) + ' -> ' + JSON.stringify(after58));

    // A family filters the tile list; the clear button shows everything again.
    await page.evaluate(() => { _chipSel = {}; renderEditPanels(); });
    const allGroups = await page.$$eval('.rg-tile-group', (n) => n.length);
    await page.click('[data-chip="58"]');
    const oneGroup = await page.$$eval('.rg-tile-group', (n) => n.map((e) => e.textContent));
    check('selecting a family filters the tiles to it',
        oneGroup.length === 1 && /58/.test(oneGroup[0]), JSON.stringify(oneGroup.length));
    await page.click('.rg-fam-clear');
    check('and the clear control shows everything again',
        (await page.$$eval('.rg-tile-group', (n) => n.length)) === allGroups);

    // The prose both panels used to open with is gone — every fact it carried
    // is a count, a badge or a tooltip now (§8a).
    const prose = await page.evaluate(() => document.getElementById('rg-tab-body').textContent);
    check('no explanatory sentence is left in the tab body',
        !/of 7 slots used/.test(prose) && !/Clicking a tile makes a metatile/.test(prose),
        prose.slice(0, 200));

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

    // Reached through the ⋯ overflow now, not a permanent pill slot — §7b
    // moves it to the rail's "+ New Map" footer, where the mock puts it.
    await page.click('[data-edit-tool-menu]');
    await page.click('[data-edit-act="new-room"]');
    check('new room opens a form', !!(await page.$('#rg-newroom')));
    check('and the form lands inside the canvas card, under the pill that opened it',
        await page.evaluate(() => !!document.getElementById('rg-newroom').closest('#rg-canvas-card')));
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

    // "new maps are completely empty" (§8a.3). The host fills the grid with
    // its own empty stamp, which is not the donor's dictionary entry 0, so
    // the client must not claim the cells hold entry 0 — that made a front
    // tile painted on a new map compose over the donor's terrain.
    const emptyMap = await page.evaluate(() => {
        editDraft().on = true;
        const under = editCellAt(_mtPalette, 3, 3);
        const blank = editBlankCanopy(_mtPalette);
        const idx = editBrushFromTile(_mtPalette, 0x0c02, 'canopy');
        editDraft().tool = 'paint';
        editStroke({ x: 3, y: 3 }, 'down');
        const w = editStampWords(_mtPalette, editDraft().cells['3,3']);
        const erased = editResolve(_mtPalette, 5, 5, -1, true);
        const r = { under, idx, layer1: w && w.layer1, layer2: w && w.layer2, blank, erased,
                    note: document.getElementById('rg-edit-count').textContent };
        editDraft().cells = {}; editDraft().brush = -1; editDraft().tool = 'paint';
        return r;
    });
    check('a drafted room\u2019s cells hold nothing the donor\u2019s dictionary can name',
        emptyMap.under === -1, JSON.stringify(emptyMap));
    check('so a front tile painted on it keeps its art and no donor terrain appears under it',
        emptyMap.layer1 === 0x0c02 && emptyMap.layer2 === emptyMap.blank, JSON.stringify(emptyMap));
    check('and the eraser finds nothing to erase on an untouched cell', emptyMap.erased === -1,
        JSON.stringify(emptyMap));

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
        _layerForce = 'terrain';
        var i = editOnTilePicked(0x0c02);
        var d = editDraft();
        return { made: i, brush: d.brush, added: d.added.slice() };
    });
    check('clicking a tile with ground forced makes it the ground of a new stamp',
        asGround.added.length === 1 && asGround.added[0].layer2 === 0x0c02
        && asGround.added[0].collision === 0, JSON.stringify(asGround));
    check('with nothing drawn over it and no collision yet',
        asGround.added[0].layer1 === 0xa800 && asGround.added[0].collision === 0);
    check('and it becomes the brush straight away', asGround.brush === 1);


    // A graphic the room never loaded costs a Block 1 slot, and the word
    // has to name that new slot.
    const pulled = await page.evaluate(() => {
        editReset(0x34); editDraft().on = true; _layerForce = 'terrain';
        editFamilies()[0] = 58;
        // reset below — _layerForce is module-level and tileLayerBadge reads
        // it before the per-graphic hint, so leaving it set would force every
        // later badge assertion to agree with it.
        editUseFamilyTile(4191, 58);
        var d = editDraft();
        return { graphics: d.addedGraphics.slice(), added: d.added.slice(), brush: d.brush };
    });
    check('picking a tile the room never loaded adopts the graphic',
        pulled.graphics.length === 1 && pulled.graphics[0] === 4191, JSON.stringify(pulled));
    await page.evaluate(() => { _layerForce = null; });
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

    // "drawing a tile that is marked as FG should not draw it to the BG" —
    // the badge and the brush must not disagree. On `auto`, a front-badged
    // graphic has to land in layer1 (the canopy), leaving layer2 blank.
    const frontPick = await page.evaluate(() => {
        _layerForce = null;
        editReset(0x34); editDraft().on = true;
        editFamilies()[0] = 58;
        editUseFamilyTile(4191, 58);
        return editDraft().added.slice(-1)[0];
    });
    check('a front-badged tile picked on auto lands in the canopy, not the ground',
        frontPick && frontPick.layer1 !== 0xa800 && frontPick.layer2 === 0xa800,
        JSON.stringify(frontPick));
    const groundPick = await page.evaluate(() => {
        editReset(0x34); editDraft().on = true;
        editFamilies()[0] = 58;
        editUseFamilyTile(4195, 58);
        return editDraft().added.slice(-1)[0];
    });
    check('and a ground-badged one lands in the terrain, canopy left blank',
        groundPick && groundPick.layer1 === 0xa800 && groundPick.layer2 !== 0xa800,
        JSON.stringify(groundPick));

    // The rect tool wrote the brush raw, bypassing editResolve: a front brush
    // is {art, blank}, so a dragged rectangle laid the art down *and blanked
    // the terrain under it* — the only tool that did not honour front vs
    // ground (§8a.3). Painted and rect-filled cells must now agree.
    const rectFront = await page.evaluate(() => {
        _layerForce = null;
        editReset(0x34); editDraft().on = true;
        editFamilies()[0] = 58;
        editUseFamilyTile(4191, 58);
        // A floor to keep: PALETTE's entry 0 everywhere (an earlier check left
        // an empty drafted room on screen, whose cells hold nothing).
        _mtPalette.grid = _mtPalette.grid.map((row) => row.map(() => 0));
        const d = editDraft();
        d.tool = 'paint';
        editStroke({ x: 0, y: 0 }, 'down');
        const painted = editStampWords(_mtPalette, d.cells['0,0']);
        d.tool = 'rect';
        editStroke({ x: 1, y: 0 }, 'down'); editStroke({ x: 1, y: 1 }, 'up');
        const rect = editStampWords(_mtPalette, d.cells['1,1']);
        return { painted, rect, under: editStampWords(_mtPalette, 0) };
    });
    check('a rect of a front tile keeps the terrain under it, like painting does',
        rectFront.rect && rectFront.rect.layer2 === rectFront.under.layer2
        && rectFront.rect.layer1 === rectFront.painted.layer1
        && rectFront.rect.layer2 === rectFront.painted.layer2,
        JSON.stringify(rectFront));
    // `front` forced on the room's own raw-graphic path (editOnTilePicked),
    // which used to pass no preference at all and so always landed as ground.
    const rawFront = await page.evaluate(() => {
        editReset(0x34); editDraft().on = true;
        _layerForce = 'canopy';
        editOnTilePicked(0x0c00, 0x0422);
        const forced = editStampWords(_mtPalette, editDraft().brush);
        _layerForce = null;
        _famLayerHint[0x0422] = [95, 5];
        editOnTilePicked(0x0c00, 0x0422);
        const hinted = editStampWords(_mtPalette, editDraft().brush);
        delete _famLayerHint[0x0422];
        return { forced, hinted, blank: editBlankCanopy(_mtPalette) };
    });
    check('a raw graphic picked with front forced lands in the canopy',
        rawFront.forced.layer1 === 0x0c00 && rawFront.forced.layer2 === rawFront.blank,
        JSON.stringify(rawFront));
    check('and so does one vanilla draws in front, on auto',
        rawFront.hinted.layer1 === 0x0c00 && rawFront.hinted.layer2 === rawFront.blank,
        JSON.stringify(rawFront));

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
    // ── LIKELY NEIGHBORS ───────────────────────────────────────────────────
    // The mock draws a plus-shaped N/E/S/W grid. relatedTiles() (vanilla-index
    // .js) returns one **undirected** score per candidate, so four compass
    // slots would be a measurement this repo does not make — §8a. The card
    // treatment was adopted; the ranked list under it is the real model.
    const nb = await page.evaluate(() => ({
        head: (document.querySelector('.rg-nb-card .rg-sec-name') || {}).textContent,
        count: document.querySelectorAll('.rg-nb').length,
        text: (document.querySelector('.rg-nb-card') || {}).textContent,
    }));
    check('the neighbours are their own collapsible card, not a loose strip',
        /likely neighbors/.test(nb.head) && nb.count === 2 && /92%/.test(nb.text),
        JSON.stringify(nb));
    await page.evaluate(() => document.querySelector('[data-panel="neighbours"]').click());
    check('and it folds down to its own header',
        (await page.$$('.rg-nb')).length === 0 && !!(await page.$('.rg-nb-card')));
    await page.evaluate(() => document.querySelector('[data-panel="neighbours"]').click());

    // ── the segmented filter row ───────────────────────────────────────────
    // Two pills, which is what the mock draws — but not the mock's two: its
    // `Auto|All` is a scope toggle, which here is the "N more families" pager
    // (one host round-trip per family, so "all" is not a button). See §8a.
    const segs = await page.evaluate(() => Array.prototype.map.call(
        document.querySelectorAll('.rg-tile-seg'),
        (s) => Array.prototype.map.call(s.querySelectorAll('.rg-tile-seg-b'),
            (b) => b.textContent).join('|')));
    check('the filter row is two segmented pills, not five loose chips',
        segs.length === 2 && segs[0] === 'auto|front|ground' && segs[1] === 'H|V',
        JSON.stringify(segs));

    // ── H / V mirror ───────────────────────────────────────────────────────
    // Bit 14 is the horizontal flip and bit 15 the vertical one
    // (docs/map-format/map_rendering_pipeline.md §3); src/maps/render.ts's
    // renderVramLayer reads exactly those two back out per word and applies
    // them to the whole 16x16 graphic, so nothing else has to know. The cost
    // is one dictionary entry and **no** graphics slot, which is the whole
    // argument for offering it.
    const brushWord = () => page.evaluate(() => {
        var w = editStampWords(_mtPalette, editDraft().brush);
        var blank = editBlankCanopy(_mtPalette);
        return { word: w.layer1 !== blank ? w.layer1 : w.layer2, brush: editDraft().brush,
            added: editDraft().added.length, graphics: editDraft().addedGraphics.length };
    });
    await page.evaluate(() => { _brushFlip = { h: false, v: false }; renderEditPanels(); });
    await page.click('[data-fam-tile="4191"]');
    const plain = await brushWord();
    await page.click('[data-brush-flip="h"]');
    const flipH = await brushWord();
    check('H sets bit 14 of the armed brush’s word and changes nothing else',
        flipH.word === (plain.word | 0x4000), JSON.stringify([plain.word, flipH.word]));
    check('at the cost of one dictionary entry and no graphics slot',
        flipH.added === plain.added + 1 && flipH.graphics === plain.graphics,
        JSON.stringify([plain, flipH]));
    await page.click('[data-brush-flip="v"]');
    const flipHV = await brushWord();
    check('and V sets bit 15 on top of it',
        flipHV.word === (plain.word | 0xc000), JSON.stringify(flipHV.word));
    await page.click('[data-brush-flip="h"]');
    await page.click('[data-brush-flip="v"]');
    const unflipped = await brushWord();
    check('turning both off re-arms the entry it started with, not a fourth one',
        unflipped.word === plain.word && unflipped.brush === plain.brush,
        JSON.stringify([plain, unflipped]));
    check('and the pill says which way the brush is mirrored',
        (await page.$$eval('[data-brush-flip]', (n) => n.filter(
            (e) => e.classList.contains('on')).length)) === 0);

    // ── H / V must not move the dock (§8a.3) ───────────────────────────────
    // Reported twice, and unreproducible at a roomy viewport. The dock never
    // changed width: it *moved*. #rg-outer is a flex item whose default
    // min-width is its min-content width, which included the status bar's
    // nowrap note — and a flip re-arms the brush, writing the longest note
    // the editor has. At a panel just wide enough for canvas + dock, that
    // ratcheted the canvas column wider and shoved the dock off the right
    // edge, clipping the H|V pill. So: a narrow panel, and geometry.
    await page.setViewportSize({ width: 960, height: 720 });
    await page.evaluate(() => { editNote('short'); renderEditPanels(); });
    const layout = () => page.evaluate(() => {
        const row = document.querySelector('.rg-edit-row');
        const panels = document.getElementById('rg-panels');
        const seg = document.querySelector('.rg-tile-seg-row');
        return {
            dockLeft: Math.round(document.getElementById('rg-dock').getBoundingClientRect().left),
            dockRight: Math.round(document.getElementById('rg-dock').getBoundingClientRect().right),
            rowOverflow: row.scrollWidth - row.clientWidth,
            panelsOverflow: panels.scrollWidth - panels.clientWidth,
            segOverflow: seg ? seg.scrollWidth - seg.clientWidth : 0,
            view: document.documentElement.clientWidth,
            note: document.getElementById('rg-edit-count').textContent,
        };
    });
    const beforeFlip = await layout();
    await page.click('[data-brush-flip="h"]');
    const afterFlip = await layout();
    check('clicking H leaves the dock exactly where it was',
        afterFlip.dockLeft === beforeFlip.dockLeft && /mirrored H/.test(afterFlip.note),
        JSON.stringify([beforeFlip, afterFlip]));
    check('and the dock stays inside the panel, so H|V is not clipped',
        afterFlip.dockRight <= afterFlip.view && afterFlip.rowOverflow <= 0, JSON.stringify(afterFlip));
    check('#rg-panels never scrolls sideways with the Tile tab rendered',
        afterFlip.panelsOverflow <= 0 && afterFlip.segOverflow <= 0, JSON.stringify(afterFlip));
    await page.click('[data-brush-flip="h"]');
    await page.setViewportSize({ width: 1280, height: 720 });

    // ── the invalid-family banner ──────────────────────────────────────────
    // editStrandedCells has always known this; before §8a it surfaced only as
    // one line in the Info tab's checks panel. "Add family back" puts the
    // family in the **slot the cells name** — adopting into the first free
    // slot instead would load the art and leave them just as stranded.
    await page.evaluate(() => {
        editReset(0x34);
        var d = editDraft();
        d.on = true;
        d.tool = 'paint';
        d.families = [35, 187, 58, undefined, undefined, undefined, undefined];
        _brushFlip = { h: false, v: false };
        _chipSel = {};
        renderEditPanels();
    });
    await page.click('[data-fam-tile="4191"]');
    const dropped = await page.evaluate(() => {
        editStroke({ x: 0, y: 0 }, 'down');
        editStroke({ x: 1, y: 0 }, 'down');
        chipDrop(2);
        return { stranded: editStrandedCells().length, groups: editStrandedGroups() };
    });
    check('freeing a slot strands the cells drawn in it, grouped by that slot',
        dropped.stranded === 2 && dropped.groups.length === 1 && dropped.groups[0].slot === 2
        && dropped.groups[0].family === 58, JSON.stringify(dropped));

    const banner = await page.evaluate(() => ({
        text: document.querySelector('.rg-banner-t').textContent,
        acts: Array.prototype.map.call(document.querySelectorAll('.rg-banner-b'), (b) => b.textContent),
        first: document.getElementById('rg-tab-body').firstElementChild.className,
    }));
    check('and the Tile tab leads with a banner about it',
        /family 58/.test(banner.text) && /rg-banner/.test(banner.first), JSON.stringify(banner));
    check('offering both of the mock’s actions',
        banner.acts.join('|') === 'Add family back|Remove tiles', JSON.stringify(banner.acts));

    await page.click('[data-stranded-fix]');
    const fixed = await page.evaluate(() => ({
        fams: editFamilies().slice(), stranded: editStrandedCells().length,
        banner: !!document.querySelector('.rg-banner'),
    }));
    check('“Add family back” restores the very slot the cells name',
        fixed.fams[2] === 58 && fixed.stranded === 0 && !fixed.banner, JSON.stringify(fixed));

    const removed = await page.evaluate(() => {
        chipDrop(2);
        var before = Object.keys(editDraft().cells).length;
        strandedDrop(2);
        var after = Object.keys(editDraft().cells).length;
        var left = editStrandedCells().length;
        editUndo(_mtPalette);
        return { before: before, after: after, left: left,
            undone: Object.keys(editDraft().cells).length };
    });
    check('“Remove tiles” clears them back to the room’s own tiles',
        removed.after === removed.before - 2 && removed.left === 0, JSON.stringify(removed));
    check('as one undo step on the existing stack',
        removed.undone === removed.before, JSON.stringify(removed));

    // ── the Widgets tab / deco library ──────────────────────────────────────
    // Section 3 objects are vanilla's own deco widgets — gourds, pots, fire
    // pits — so the library is read out of the ROM rather than invented.
    // `front`/`back` are the server-computed category split (deco-catalogue
    // .js's decoIndex) the Widgets tab groups cards by.
    const DECO = [
        // `families` is the ids, not a count: whether an entry is usable
        // depends on the seven the draft already holds, which only the
        // editor knows. PALETTE has 35, 187, 58, 165, 149, 59, 166.
        { id: 0, area: 'Prehistoria', roomName: "Strong Heart's Hut", room: 0x34, w: 2, h: 2,
          states: 1, count: 3, families: [58], graphics: 3, cells: 4, front: false, back: true, scriptId: null },
        { id: 1, area: 'Prehistoria', roomName: "Fire Eyes' Village", room: 0x25, w: 4, h: 3,
          states: 2, count: 4, families: [35], graphics: 2, cells: 2, front: true, back: false, scriptId: 0xd74 },
        { id: 2, area: 'Gothica', roomName: 'Ebon Keep', room: 0x60, w: 6, h: 6,
          states: 1, count: 1, families: [220, 5], graphics: 9, cells: 30, front: true, back: false, scriptId: null },
    ];
    await page.evaluate((deco) => {
        editReset(0x34);
        editDraft().on = true;
        _editActiveTab = 'widgets';
        applyDecoLibrary({ deco: deco });
        applyDecoPreviews({ previews: { ids: [0, 1, 2], columns: 6, cell: 48,
            imageUri: 'data:image/png;base64,ZGVjbw==', imageWidth: 288, imageHeight: 48 } });
    }, DECO);
    check('the Widgets tab renders the deco library as thumbnails', (await page.$$('.rg-deco')).length === 3);
    check('each one carries its size and where it came from',
        /Fire Eyes/.test(await page.$eval('[data-deco="1"]', (n) => n.getAttribute('title'))));
    check('cards are grouped under Foreground/Background headings',
        (await page.evaluate(() => document.getElementById('rg-panels').textContent))
            .includes('Foreground') && (await page.evaluate(
                () => document.getElementById('rg-panels').textContent)).includes('Background'));
    // PALETTE's seven families are 35, 187, 58, 165, 149, 59, 166 — entry 0
    // (family 58, no script) needs nothing new and has no trigger, so it is
    // the "neither" case; entry 1 (family 35, scripted) has a trigger only;
    // entry 2 (families 220 and 5, neither loaded) has a family cost only.
    check('an entry that needs nothing new and has no script shows no warning badge at all',
        (await page.$$('[data-deco="0"] .rg-deco-warn')).length === 0);
    check('an entry with a script shows the B-trigger line as visible text, not just a tooltip',
        await page.$eval('[data-deco="1"] .rg-deco-warn', (n) => n.textContent) === '1 B-trigger added',
        await page.$eval('[data-deco="1"] .rg-deco-warn', (n) => n.textContent));
    check('an entry that needs two new families says so as visible text',
        await page.$eval('[data-deco="2"] .rg-deco-warn', (n) => n.textContent) === '+2 families needed',
        await page.$eval('[data-deco="2"] .rg-deco-warn', (n) => n.textContent));

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
        // A room *with* a floor: every cell is PALETTE's entry 0 (terrain
        // $4C62). Earlier checks left an empty drafted room on screen, whose
        // cells hold nothing — "keep the floor" needs a floor to keep.
        _mtPalette.grid = _mtPalette.grid.map((row) => row.map(() => 0));
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
    // Sorted rather than DOM order: the Widgets tab groups cards by category
    // (Foreground before Background before Misc), so a filter's *result
    // set* is what these assert, not the on-screen ordering — that ordering
    // has its own dedicated check above ("cards are grouped under
    // Foreground/Background headings").
    const onScreen = () => page.$$eval('.rg-deco',
        (n) => n.map((e) => Number(e.dataset.deco)).sort((a, b) => a - b).join());
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

    // ── the "Ready only" toggle ─────────────────────────────────────────────
    // Mapped to the same `works` flag (d.scriptId !== null — "comes with a
    // script that does something on placement"), not a second boolean: the
    // two controls read and write one piece of state, so they can never
    // disagree with each other.
    check('"Ready only" starts off, same as the "works" flag chip',
        !(await page.$eval('.rg-deco-ready', (n) => n.classList.contains('on'))));
    await page.click('.rg-deco-ready');
    check('clicking it filters to scripted entries only, same as "works" would',
        await onScreen() === '1');
    check('and the "works" flag chip shows the same "on" state back',
        await page.$eval('[data-deco-flag="works"]', (n) => n.classList.contains('on')));
    await page.click('[data-deco-flag="works"]');
    check('clicking the flag chip instead clears the toggle too — one owner, not two',
        !(await page.$eval('.rg-deco-ready', (n) => n.classList.contains('on'))));
    check('and the library is back', await onScreen() === '0,1,2');

    // ── picking a tile is choosing to paint ────────────────────────────────
    // The stamp tool places the armed construct and ignores the brush, so
    // arming a widget and then clicking a tile sent the click to the
    // widget: "I'm not allowed to stamp a gourd tile".
    await page.click('[data-deco="1"]');
    await page.evaluate((entry) => applyDecoCells({ entry: entry }), ENTRY);
    check('arming a widget selects the stamp tool',
        await page.evaluate(() => editDraft().tool) === 'stamp');
    await page.click('[data-edit-active-tab="tile"]');
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
        // `#rg-edit-btn` already exists — the filter bar built above carries
        // it (map-editor-filterbar.js's own action pair), so no second copy
        // is inserted here; two nodes with one id would make which one this
        // clicks a coin toss.
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

    // ── the Tile tab: a full palette shows only its own seven ──────────────
    // "if the tile family list is full (7/7) we don't show tiles from
    // families outside that list!!!!" — seven is a hard ceiling, so with no
    // free slot a candidate's tiles cannot be drawn with at all and offering
    // them is noise. These two checks replace the pair added in §8a.1, which
    // asserted the opposite rule from a misread of an earlier report; see
    // docs/map-editor-redesign-plan.md §8a.3.
    await page.evaluate(() => {
        editReset(0x34);
        editDraft().on = true;
        _chipSel = {};
        _tileGroupPage = 6;
        applyFamilyCatalogue({ families: Array.from({ length: 20 }, (_, i) => (
            { id: 9000 + i, tiles: 20 - i, rooms: 1, areas: ['Test'], names: [] })) });
        _editActiveTab = 'tile';
        renderEditPanels();
    });
    const shownAtFull = await page.evaluate(() => ({
        families: tileGroupFamilies().length,
        free: editFreeFamilySlot(),
        pager: !!document.querySelector('[data-tile-more]'),
    }));
    check('a full seven-slot palette shows no families outside it',
        shownAtFull.families === 7 && shownAtFull.free < 0, JSON.stringify(shownAtFull));
    check('and drops the "N more families" pager, which would page through nothing',
        shownAtFull.pager === false);
    // Free one slot and the candidates come back — because now adopting one
    // is something that can actually happen.
    const shownWithRoom = await page.evaluate(() => {
        editClearFamily(3);
        renderEditPanels();
        return { families: tileGroupFamilies().length, free: editFreeFamilySlot(),
                 pager: !!document.querySelector('[data-tile-more]') };
    });
    check('freeing a slot brings the candidates back, since one can be adopted again',
        shownWithRoom.free >= 0 && shownWithRoom.families > 6 + 1, JSON.stringify(shownWithRoom));
    check('and the pager with them', shownWithRoom.pager === true);
    await page.evaluate(() => { editReset(0x34); editDraft().on = true; renderEditPanels(); });

    // ── the Tile tab: arming a brush must not reorder its own family ───────
    // `editPlacedGraphics()` used to seed the relationship lookup with the
    // just-armed brush tile. A seed graphic scores 0 in its own results
    // (relatedTiles cannot recommend a graphic to itself), so clicking any
    // tile sank it to the bottom of its own family's grid on every click —
    // "when clicking on a tile the order should not change".
    await page.evaluate(() => { editDraft().cells = {}; _brushTile = null; });
    const sentBefore = await page.evaluate(() => window.__sent.filter((m) => m.command === 'requestRelated').length);
    await page.evaluate(() => { _brushTile = { graphic: 701, family: 35 }; renderEditPanels(); });
    const sentAfterArm = await page.evaluate(() => window.__sent.filter((m) => m.command === 'requestRelated').length);
    check('arming a brush with nothing painted does not ask for related tiles',
        sentAfterArm === sentBefore, `requestRelated sent ${sentAfterArm - sentBefore} time(s) just from arming`);
    await page.evaluate(() => {
        // PALETTE's own entry 0 has a blank layer1 and a layer2 whose chr
        // falls outside `_mtPalette.tiles.slots` (there is only one slot),
        // so it resolves to no graphic at all — useless as a seed. Compose
        // a stamp whose layer2 chr (1) lands on that one slot (graphic 700).
        var idx = editAddStamp(_mtPalette, { layer1: 0xa800, layer2: 1, collision: 0 });
        editDraft().cells['0,0'] = idx;
        renderEditPanels();
    });
    const sentAfterPaint = await page.evaluate(() => window.__sent.filter((m) => m.command === 'requestRelated').length);
    check('but actually placing a cell still asks — the feature still works once something is built',
        sentAfterPaint > sentAfterArm, `requestRelated sent ${sentAfterPaint - sentAfterArm} time(s) after a real placement`);

    check('no uncaught errors in any of it', pageErrors.length === 0, pageErrors.join('; '));

    await browser.close();
    console.log(`\n  ${passed} passed, ${failed} failed`);
    if (failed) process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });
