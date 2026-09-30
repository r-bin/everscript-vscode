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
    'map-editor-anim.js', 'map-editor-ui.js', 'map-editor-phases.js', 'map-editor-constructs.js', 'map-editor-families.js',
    'map-editor-relations.js', 'map-editor-chips.js', 'map-editor-stranded.js',
    'map-editor-tiles.js', 'map-editor-tile-lazy.js', 'map-editor-tile-filters.js', 'map-editor-neighbours.js', 'map-editor-deco.js', 'map-editor-widgets.js', 'map-editor-widget-edit.js', 'map-editor-special.js',
    'map-editor-trigger-select.js', 'map-editor-trigger-panel.js', 'map-editor-trigger-order.js', 'map-editor-objects.js', 'map-editor-object-list.js',
    'map-editor-toolbar.js', 'map-editor-filterbar.js', 'rom-overlay.js',
    'map-editor-trigger-scripts.js', 'map-editor-tabs.js', 'map-editor-panels.js', 'map-editor-gestures.js',
    'map-editor-input.js', 'map-editor-actions.js', 'map-editor-newroom.js', 'map-editor-start.js', 'map-editor-custom.js',
    'map-editor-rom-export.js', 'map-editor-collision.js', 'map-editor-cutlayer.js', 'map-editor-drawable.js',
    'map-editor-levels.js', 'map-editor-groups.js', 'map-editor-custom-store.js',
    'map-editor-clipboard.js', 'map-editor-pick.js', 'map-editor-special-select.js', 'map-editor-romroom.js', 'map-editor-info.js'];

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
        <div class="rd-head"><span class="rd-name">test</span><span class="rd-head-acts" id="rg-head-acts"></span></div>
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
        </div></body></html>`);

    // Stubs for the few things the editor reaches for outside its own files.
    await page.addScriptTag({ content: `
        window.__sent = [];
        var vs = { postMessage: function (m) { window.__sent.push(m); } };
        function escH(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;'); }
        function roomVanillaIdNum(){ return 0x34; }
        // The room detail is detail-renderer.js's, not the editor's; a custom
        // map is opened through it (rooms-rail-dom.test.js drives the real one).
        function renderRoomDetail(room){ window.__rendered = room; }
        ${FILES.map(read).join('\n')}
    ` });

    await page.evaluate((palette) => {
        _mtPalette = palette;
        _mtRoomId = 0x34;
        // The saved-map list is in: this stub host never answers
        // requestCustomMaps, and New Map now waits for that answer.
        _customLoaded = 'yes';
        editReset(0x34);
        // First look (§8e): TILE FAMILIES and LIKELY NEIGHBORS closed.
        window.__firstLook = { families: _panelOpen.families, neighbours: _panelOpen.neighbours };
        // Most checks below are about the open cards, so the harness opens
        // them the way a remembered \`uiPrefs\` would.
        applyUiPrefs({ panelOpen: { families: true, neighbours: true } });
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
    check('on first look TILE FAMILIES and LIKELY NEIGHBORS are closed',
        await page.evaluate(() => window.__firstLook.families === false && window.__firstLook.neighbours === false));

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
    // `data-tip`, drawn by CSS: the native `title` tooltip never showed on
    // the pill (the menu's items, inside a dropdown, keep `title`).
    const pillButtons = await page.$$eval('#rg-edit-bar .rdf',
        (n) => n.map((e) => ({ title: e.getAttribute('data-tip') || e.getAttribute('title') || '', text: e.textContent.trim() })));
    check('every pill button has a tooltip, since the labels are icons now',
        pillButtons.length > 0 && pillButtons.every((b) => b.title.length > 0),
        JSON.stringify(pillButtons.filter((b) => !b.title)));
    check('the tool buttons are icons, not words',
        await page.$eval('[data-edit-tool="paint"] .rg-edit-icon', (n) => n.textContent.trim()) === '✎');
    // v0.71.0: levels 3..0 in a vertical bar at the card's left edge, 1 lit.
    const levels = await page.evaluate(() => ({
        order: Array.prototype.map.call(document.querySelectorAll('#rg-level-bar [data-edit-level]'), (b) => b.textContent).join(''),
        on: (document.querySelector('#rg-level-bar .rg-level-b.on') || {}).textContent,
        inCard: !!document.querySelector('#rg-canvas-card #rg-level-bar'),
        menu: ['export-map', 'delete-map'].every((a) => !!document.querySelector('#rg-tool-dropdown [data-edit-act="' + a + '"]')),
    }));
    check('a level bar offers levels 3..0 top to bottom, level 1 by default, on the canvas card',
        levels.order === '3210' && levels.on === '1' && levels.inCard, JSON.stringify(levels));
    check('the ⋯ menu offers Export map and Delete map', levels.menu, JSON.stringify(levels));
    await page.click('[data-edit-level="2"]');
    check('clicking a level makes it the one tiles are drawn on',
        await page.evaluate(() => editDraft().plane === 2 && document.querySelector('.rg-level-b.on').textContent === '2'));
    await page.evaluate(() => { editDraft().plane = 1; renderEditChrome(); });
    await page.hover('[data-edit-tool="erase"]');
    await page.waitForTimeout(600);
    const tipShown = await page.$eval('[data-edit-tool="erase"]', (n) => {
        const a = getComputedStyle(n, '::after');
        return { content: a.content, visibility: a.visibility };
    });
    check('hovering a tool shows its tooltip in the page, without a native title',
        /Erase what the open tab draws/.test(tipShown.content) && tipShown.visibility === 'visible', JSON.stringify(tipShown));
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

    // v0.90.0: the dock gets a resize handle between it and the map.
    check('a resize handle sits between the map and the dock',
        await page.evaluate(() => { const h = document.querySelector('.rg-edit-row > .rg-split[data-split="dock"]');
            return !!h && h.nextElementSibling && h.nextElementSibling.id === 'rg-dock'; }));

    // ── the tab shell ──────────────────────────────────────────────────────
    // Five tabs (Tile / Special / Trigger / Info / Widgets) file everything
    // that used to stack as one long column of collapsible panels
    // (docs/map-editor-redesign-plan.md).
    check('the dock opens on the Tile tab',
        await page.evaluate(() => document.querySelector('[data-edit-active-tab="tile"]').classList.contains('on')));
    check('with the tile-family panel on screen',
        !!(await page.$('[data-panel="families"]')));
    check('and the budget bar off screen until Info is picked',
        !(await page.$('.rg-cap')));

    await page.click('[data-edit-active-tab="info"]');
    check('switching to Info shows the capacity bars',
        !!(await page.$('.rg-cap-track')));
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
    // A sub-tab per kind since v0.73.0; the room's trigger is a step-on one.
    await page.click('[data-trigger-kind="step"]');
    const trigText = await page.evaluate(() => document.getElementById('rg-panels').textContent);
    // v0.78.0: the design mock's row — grip, where in the room, the tiles
    // covered, `#n · N tiles`, remove; the name and script in its tooltip.
    const trigRow = await page.evaluate(() => {
        const r = document.querySelector('.rg-trigger-row');
        return r && {
            title: r.getAttribute('title'), draggable: r.getAttribute('draggable'),
            grip: !!r.querySelector('.rg-trigger-grip'), label: r.querySelector('.rg-trigger-label').textContent,
            where: r.querySelectorAll('.rg-trigger-where use').length, box: !!r.querySelector('.rg-trigger-where-step'),
            tiles: r.querySelector('.rg-trigger-tiles') && r.querySelector('.rg-trigger-tiles').getAttribute('viewBox'),
            tileUses: Array.prototype.map.call(r.querySelectorAll('.rg-trigger-tiles use'), (u) => u.getAttribute('href')).join(),
        };
    });
    check("the Trigger tab lists the room's own step/B triggers, named from the source",
        /Step-on/.test(trigText) && trigRow && /test_step/.test(trigRow.title) && /0x1234/.test(trigRow.title),
        trigText.slice(0, 300));
    check('a trigger row is the mock\'s: grip, the room with its box lit, its own tiles, "#0 · 2×2 tiles"',
        trigRow && trigRow.draggable === 'true' && trigRow.grip && trigRow.label === '#0 · 2×2 tiles'
        && trigRow.where === 2 && trigRow.box && trigRow.tileUses === '#rg-img,#rg-edit-tiles'
        && trigRow.tiles === '0 0 4 4', JSON.stringify(trigRow));

    // Dragging rows: the order is the draft's, one undo step; onto the other
    // kind's tab converts it (map-editor-trigger-order.js).
    const reorder = await page.evaluate(() => {
        const d = editDraft();
        const a = editAddTrigger('step', { x1: 2, y1: 2, x2: 2, y2: 2 });
        const b = editAddTrigger('step', { x1: 3, y1: 3, x2: 4, y2: 3 });
        const ids = () => editTriggerList('step').map((t) => t.ref.id).join(' ');
        const start = ids();
        triggerReorder(b, 'step', { kind: 'step', id: 'base:0' });
        const moved = ids();
        editUndo();
        const undone = ids();
        editRedo();
        const base = triggerReorder({ kind: 'step', id: 'base:0' }, 'b', null);
        const out = { start, moved, undone, step: ids(), b: editTriggerList('b').map((t) => t.ref.id).join(' '),
            baseKept: editTriggerFind(base) && editTriggerFind(base).scriptId, a: a.id, bb: b.id };
        editUndo(); editUndo(); editUndo(); editUndo();
        d.triggerOrder = null;
        return out;
    });
    check('dragging a row reorders the list, and undo puts it back',
        reorder.start === 'base:0 ' + reorder.a + ' ' + reorder.bb
        && reorder.moved === reorder.bb + ' base:0 ' + reorder.a
        && reorder.undone === reorder.start, JSON.stringify(reorder));
    check('dropping a room trigger on the other tab makes it that kind, keeping its box and script',
        reorder.step === reorder.bb + ' ' + reorder.a && /^placed:/.test(reorder.b) && reorder.baseKept === 0x1234,
        JSON.stringify(reorder));

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
        var el = document.querySelector('#rg-edit-overlay .rg-special-glyph-gate');
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
    check('erasing removes the glyph from the canvas', !(await page.$('#rg-edit-overlay .rg-special-glyph')));
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
        'hide-trig-type', 'hide-trigger'].sort();
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
    // §8e: Triggers holds only what triggers show; everything else they
    // carried is in More. v0.73.0: Collision's caret picks outline or
    // tile-by-tile drawing. v0.91.0: Objects gets a menu again — its number
    // and its sub-frames — and Triggers their type letter and script id.
    check('five dropdowns, one mechanism',
        barKeys.ids.join() === 'rg-collision-dropdown,rg-more-dropdown,rg-object-dropdown,rg-special-dropdown,rg-trigger-dropdown',
        barKeys.ids.join());
    check('Triggers offers the two kinds, the type letter and the script id',
        await page.evaluate(() => [...document.querySelectorAll('#rg-trigger-dropdown [data-hide], #rg-trigger-dropdown [data-show]')]
            .map((b) => b.dataset.hide || b.dataset.show).join() === 'hide-step,hide-btrig,hide-trig-type,show-trig-id'));
    check('Objects offers the object number and its sub-frames, both off',
        await page.evaluate(() => [...document.querySelectorAll('#rg-object-dropdown [data-show]')]
            .map((b) => b.dataset.show + (b.classList.contains('on') ? '+' : '')).join() === 'show-obj-id,show-obj-frames'));
    check('NPCs, hitboxes, grass and the grids moved to More',
        await page.evaluate(() => ['hide-spawn', 'hide-hitbox', 'hide-grid8', 'hide-grid16']
            .every((k) => document.querySelector('#rg-more-dropdown [data-hide="' + k + '"]'))
            && !!document.querySelector('#rg-more-dropdown [data-ov="g"]')
            && !!document.querySelector('#rg-more-dropdown [data-ov="t"]')));
    check('everything starts on but collision',
        await page.evaluate(() => {
            const off = [...document.querySelectorAll('.rg-view-filters .rdf[data-hide], .rg-view-filters .rdf-ov')]
                .filter((b) => !b.classList.contains('on')).map((b) => b.dataset.hide || b.dataset.ov);
            return off.join() === 'c';
        }));

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
        /Step-on triggers\D*2/.test(infoText) && /B-triggers\D*0/.test(infoText) && /16-bit table/.test(infoText)
        && !/triggers\s*\d+\/\d/.test(infoText),
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
    await page.evaluate(() => { window.__sent.length = 0; window.__rendered = null; });
    await page.click('[data-edit-act="new-room-go"]');
    const made = await page.evaluate(() => ({
        room: window.__rendered,
        map: _customMaps[_customMaps.length - 1],
        saved: window.__sent.filter((m) => m.command === 'saveCustomMap').length,
    }));
    // A new custom map, not a draft laid over the room on screen: that room
    // only lends its graphics (map-editor-custom.js).
    check('create makes a custom map the size typed, borrowing this room\u2019s graphics',
        made.map && made.map.w === 20 && made.map.h === 9 && made.map.borrow === 0x34
        && made.room && made.room.custom === made.map.key && made.room.name === made.map.name
        && made.saved > 0, JSON.stringify(made));
    // And opening it asks for the blank grid once the dictionary is in.
    const req = await page.evaluate(() => {
        window.__sent.length = 0;
        editDraft().customKey = _customActive;
        _newMapWaiting = true;
        newMapPaletteReady();
        const r = window.__sent.find((m) => m.command === 'requestBlankRoom');
        editDraft().customKey = undefined;
        return r;
    });
    check('which asks the host for a blank grid that size',
        req && req.widthTiles === 20 && req.heightTiles === 9 && req.borrowFrom === 0x34, JSON.stringify(req));
    await page.evaluate(() => { _customActive = null; });

    // The donor room's scenery, as svg-builder would have drawn it.
    await page.evaluate(() => {
        document.getElementById('rg-svg').insertAdjacentHTML('beforeend',
            '<image class="svge-spawn" data-kind="spawn"/><g class="svge-arrival"></g>'
            + '<rect class="svge-step"/><rect class="svge-btrig"/>');
        _mtPalette.attachments = { bTrigger: [[1, 1, 2, 2, 7]], stepOn: [], objects: [] };
    });
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
    const donor = await page.evaluate(() => ({
        left: document.querySelectorAll('#rg-svg .svge-spawn, #rg-svg .svge-arrival, #rg-svg .svge-step, #rg-svg .svge-btrig').length,
        triggers: _mtPalette.attachments.bTrigger.length,
    }));
    check('the donor\u2019s NPCs, doors and triggers do not come with it — no Strongheart',
        donor.left === 0 && donor.triggers === 0, JSON.stringify(donor));
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

    // ── the Boy's start on a drafted map (map-editor-start.js) ────────────
    // "new maps should be empty, I don't want to see strongheart" — the
    // donor's NPCs were svg-builder's, left standing under the blank room.
    // And "the boy [on] the map as special tile … you cant remove it".
    const start = await page.evaluate(() => {
        const d = editDraft();
        const r = { placed: d.start && { x: d.start.x, y: d.start.y },
                    drawn: !!document.querySelector('#rg-edit .rg-start') };
        // Special tab offers the pick on a drafted map.
        r.offered = specialTabHtml().includes('data-edit-special="start"');
        // The pick is on the Special tab, which is what the pencil draws from.
        _editActiveTab = 'special';
        d.currentSpecialId = 'start'; d.tool = 'paint'; d.brush = -1;
        editStroke({ x: 2, y: 1 }, 'down');
        editStroke({ x: 4, y: 6 }, 'move');
        r.moved = { x: d.start.x, y: d.start.y };
        r.cells = Object.keys(d.cells).length;
        r.specials = Object.keys(d.specialCells).length;
        editUndo(_mtPalette);
        r.undone = { x: d.start.x, y: d.start.y };
        editRedo(_mtPalette);
        r.redone = { x: d.start.x, y: d.start.y };
        d.currentSpecialId = null; d.tool = 'erase';
        editStroke({ x: 4, y: 6 }, 'down');
        r.afterErase = !!d.start && d.start.x === 4 && d.start.y === 6;
        d.tool = 'paint';
        _editActiveTab = 'tile';
        return r;
    });
    check('a new map places exactly one Boy start, in the middle, and draws it',
        start.placed && start.placed.x === 10 && start.placed.y === 4 && start.drawn, JSON.stringify(start));
    check('the start pick moves him by click or drag, painting nothing',
        start.offered && start.moved.x === 4 && start.moved.y === 6 && start.cells === 0 && start.specials === 0,
        JSON.stringify(start));
    check('moving him is undoable on the one shared stack',
        start.undone.x === 2 && start.undone.y === 1 && start.redone.x === 4 && start.redone.y === 6,
        JSON.stringify(start));
    check('and the eraser cannot remove him', start.afterErase, JSON.stringify(start));

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
    check('a second new map re-centres the Boy rather than inheriting the last one\u2019s spot',
        await page.evaluate(() => editDraft().start.x === 1 && editDraft().start.y === 1));
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
        window.__sent.length = 0;
        renderEditPanels();
    });
    // §8e: "the tile list cannot be collapsed, we always show all available tiles".
    const listed = await page.evaluate(() => ({
        swatches: document.querySelectorAll('#rg-panels [data-fam-tile]').length,
        toggles: document.querySelectorAll('#rg-panels [data-tile-group], #rg-panels [data-tile-more]').length,
    }));
    check('a family\u2019s tiles are all shown, with no collapse or pager control',
        listed.swatches === 2 && listed.toggles === 0, JSON.stringify(listed));
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
        // The rect tool is gone (v0.73.0); its writes still backfill a move.
        editApply(editRectWrites(1, 0, 1, 1, d.brush, _mtPalette));
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

    // v0.74.0: a relationship arriving does not reorder the list ("the order
    // of the tile list still changes once you use one. it should not").
    const orderBefore = await page.$$eval('[data-fam-of="58"]', (n) => n.map((e) => e.dataset.famTile));
    await page.evaluate(() => applyRelatedTiles({
        related: [[4191, 92, 47], [4200, 3, 2]] }));
    const order = await page.$$eval('[data-fam-of="58"]', (n) => n.map((e) => e.dataset.famTile));
    check('related tiles keep their place: the list is in placement order, before and after',
        order.join() === orderBefore.join() && order[0] === '4200', JSON.stringify([orderBefore, order]));
    // ── LIKELY NEIGHBORS: the plus-shape (§8b) ─────────────────────────────
    // The mock's N/E/S/W grid around the armed brush. It is honest now
    // because the index counts each side separately (src/maps/vanilla-
    // adjacency.ts); before §8b it was a ranked list, since the only score
    // was undirected. 4191 is canopy-leaning (90/10), so it arms as front and
    // the card reads the canopy half of the answer.
    const NB = {
        graphic: 4191,
        canopy: {
            n: [],
            e: [[4195, 62, 31, [58], 2, 40], [4200, 20, 5, [58], 0, 0], [9001, 0, 1, [300], 5, 0]],
            s: [[4200, 40, 9, [58], 0, 0]],
            w: [[9001, 55, 12, [300], 5, 0]],
        },
        terrain: { n: [[4195, 12, 3, [58], 2, 40]], e: [], s: [], w: [] },
    };
    const sentNb = () => page.evaluate(() => window.__sent
        .filter((m) => m.command === 'requestNeighbours').map((m) => m.graphic));
    // Everything this block writes is module-level and shared with the checks
    // after it (webview-dom-safety §7c), so the draft and the brush state it
    // replaces are put back at the end.
    await page.evaluate(() => {
        window.__nbSaved = { edit: _edit, brushTile: _brushTile, chipSel: _chipSel,
            mtSlot: _mtSlot, sheets: Object.assign({}, _famSheets) };
        _layerForce = null; _brushFlip = { h: false, v: false }; _panelOpen.neighbours = true;
        editReset(0x34);
        const d = editDraft();
        d.on = true; d.tool = 'paint';
        d.families = [35, 187, 58, 165, 149, 59, 166];   // 7/7: family 300 cannot come in
        _chipSel = { 58: true };
        renderEditPanels();
    });
    // §8e: "prediction exists, but is … empty" — the card is always there,
    // so arming a tile does not push the list down; it has no plus yet.
    check('no armed tile: the card is there but empty — there is nothing to be beside',
        !!(await page.$('.rg-nb-card')) && !(await page.$('.rg-nb-plus')));
    const nbBefore = (await sentNb()).length;
    await page.click('[data-fam-tile="4191"]');
    check('arming a tile asks for its neighbours, by the brush alone',
        (await sentNb()).slice(nbBefore).join() === '4191', JSON.stringify(await sentNb()));
    check('and says it is reading until the answer arrives',
        /reading vanilla/.test(await page.$eval('.rg-nb-card', (e) => e.textContent)));
    await page.evaluate((nb) => applyNeighbourTiles(nb), NB);

    const plus = await page.evaluate(() => {
        const box = (sel) => {
            const e = document.querySelector(sel);
            if (!e) return null;
            const r = e.getBoundingClientRect();
            return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width),
                h: Math.round(r.height), display: getComputedStyle(e).display };
        };
        return { c: box('.rg-nb-centre'), n: box('.rg-nb-n'), e: box('.rg-nb-e'),
            s: box('.rg-nb-s'), w: box('.rg-nb-w'),
            layer: document.querySelector('.rg-nb-card .rg-sec-count').textContent };
    });
    const at = (a, dx, dy) => a && plus.c && a.x === plus.c.x + dx && a.y === plus.c.y + dy;
    check('the card is a plus: N above the centre, E right, S below, W left',
        at(plus.n, 0, -34) && at(plus.e, 34, 0) && at(plus.s, 0, 34) && at(plus.w, -34, 0),
        JSON.stringify(plus));
    check('every cell is a visible 34px square',
        ['c', 'n', 'e', 's', 'w'].every((k) => plus[k].w === 34 && plus[k].h === 34
            && plus[k].display !== 'none'), JSON.stringify(plus));
    check('it reads the layer the brush actually paints', plus.layer === 'front', plus.layer);

    const cell = (side) => page.evaluate((sd) => {
        const e = document.querySelector('.rg-nb-' + sd);
        const art = e.querySelector('.rg-nb-art');
        return {
            cls: e.className, text: e.textContent, tag: e.tagName,
            art: art ? art.getAttribute('style') || '' : null,
            artCls: art ? art.className : '',
            opacity: art ? getComputedStyle(art).opacity : null,
            badge: e.querySelector('.rg-nb-pct') ? e.querySelector('.rg-nb-pct').textContent : null,
        };
    }, side);
    const north = await cell('n');
    check('a side vanilla never fills is an empty cell — no art, no badge, not borrowed',
        /rg-nb-empty/.test(north.cls) && north.art === null && north.badge === null
        && north.text === '', JSON.stringify(north));
    const east = await cell('e');
    check('a side shows its best candidate, with its per-side score',
        east.badge === '62%' && /ZmFt/.test(east.art), JSON.stringify(east));
    check('as real tile art, cropped from the family sheet at 2x',
        // 4195 is slot 1 of family 58's one-row, 16-column sheet: x = 1 * 16 * 2.
        /background-position:\s*-32px -0px/.test(east.art) && /background-size:\s*512px 32px/.test(east.art),
        east.art);
    const west = await cell('w');
    check('a candidate from an unloaded family at 7/7 is dimmed, not skipped',
        /rg-nb-off/.test(west.cls) && west.badge === '55%' && Number(west.opacity) < 0.5,
        JSON.stringify(west));
    check('and the art for it is fetched, not guessed',
        (await page.evaluate(() => window.__sent.some((m) => m.command === 'requestFamilySheet' && m.family === 300))));

    // Click focuses, click again cycles, scroll cycles — both directions, wrapping.
    const detail = () => page.$eval('.rg-nb-detail', (e) => e.textContent);
    await page.click('.rg-nb-e');
    check('the first click on a side picks it without skipping vanilla’s best',
        /rg-nb-e.*\bon\b|\bon\b/.test((await cell('e')).cls) && /^E 1\/3/.test(await detail())
        && (await cell('e')).badge === '62%', await detail());
    await page.click('.rg-nb-e');
    check('clicking it again cycles to the next candidate',
        /^E 2\/3/.test(await detail()) && (await cell('e')).badge === '20%', await detail());
    const wheel = (dy) => page.evaluate((d) => document.querySelector('.rg-nb-e .rg-nb-pct')
        .dispatchEvent(new WheelEvent('wheel', { deltaY: d, bubbles: true, cancelable: true })), dy);
    // A second bind must not stack a second wheel listener (webview-dom-safety §1).
    await page.evaluate(() => bindEditControls(document.getElementById('room-detail'), {}));
    const notCancelled = await wheel(100);
    check('one scroll notch is one step, even after a second bind',
        /^E 3\/3/.test(await detail()), await detail());
    check('and the scroll is consumed, so the dock does not scroll with it', notCancelled === false);
    check('a weak but real neighbour reads <1%, not a false 0%', (await cell('e')).badge === '<1%');
    await wheel(100);
    check('scrolling past the last wraps to the first', /^E 1\/3/.test(await detail()), await detail());
    await wheel(-100);
    check('and scrolling up goes back', /^E 3\/3/.test(await detail()), await detail());
    await wheel(20); await wheel(20);
    check('small trackpad deltas accumulate instead of spinning the list',
        /^E 3\/3/.test(await detail()), await detail());
    await wheel(30);
    check('until they add up to a step', /^E 1\/3/.test(await detail()), await detail());

    await page.click('.rg-nb-w');
    check('an unusable candidate offers no use, and says why',
        await page.$eval('.rg-nb-use', (b) => b.disabled && /seven palette slots/.test(b.title)));

    // The centre: the mock's toggleDrawLayer. It flips the override to the
    // other layer and re-arms, so the brush and the auto|front|ground pill
    // both move with it — and the card switches to that layer's data.
    await page.click('.rg-nb-centre');
    const toGround = await page.evaluate(() => {
        const w = editStampWords(_mtPalette, editDraft().brush);
        return { force: _layerForce, groundArt: w.layer1 === editBlankCanopy(_mtPalette),
            layer: document.querySelector('.rg-nb-card .rg-sec-count').textContent,
            n: (document.querySelector('.rg-nb-n .rg-nb-pct') || {}).textContent,
            e: document.querySelector('.rg-nb-e').className,
            pill: document.querySelector('[data-layer-force].on').dataset.layerForce };
    });
    check('clicking the centre draws the brush as ground instead',
        toGround.force === 'terrain' && toGround.groundArt && toGround.pill === 'terrain',
        JSON.stringify(toGround));
    check('and the sides now show what vanilla draws beside it on the ground',
        toGround.layer === 'ground' && toGround.n === '12%' && /rg-nb-empty/.test(toGround.e),
        JSON.stringify(toGround));
    check('without asking the host again — both layers came in one answer',
        (await sentNb()).slice(nbBefore).join() === '4191', JSON.stringify(await sentNb()));
    await page.click('.rg-nb-centre');
    check('and clicking it again brings it back to the front',
        await page.evaluate(() => _layerForce === 'canopy'
            && document.querySelector('.rg-nb-card .rg-sec-count').textContent === 'front'));
    await page.evaluate(() => { _layerForce = null; renderEditPanels(); });

    // H mirrors the brush, so its east edge is the unmirrored west edge:
    // vanilla's [W][A] mirrored whole is [A'][W']. The sides swap and every
    // candidate is drawn mirrored too, so the picture is still a true pair.
    await page.click('[data-brush-flip="h"]');
    const mirrored = { e: await cell('e'), w: await cell('w'), centre: await page.$eval(
        '.rg-nb-centre .rg-nb-art', (a) => [a.className, getComputedStyle(a).transform]) };
    check('with H on, east shows what vanilla draws west of it, and vice versa',
        mirrored.e.badge === '55%' && mirrored.w.badge === '62%', JSON.stringify(mirrored));
    check('drawn mirrored, centre and candidates alike',
        /rg-flip-h/.test(mirrored.w.artCls) && /rg-flip-h/.test(mirrored.centre[0])
        && /^matrix\(-1/.test(mirrored.centre[1]), JSON.stringify(mirrored));
    check('while north and south, which H does not touch, stay put',
        /rg-nb-empty/.test((await cell('n')).cls) && (await cell('s')).badge === '40%');
    // `use` arms the candidate with the same mirror it was shown with.
    await page.click('.rg-nb-w');
    const nbSentBeforeUse = (await sentNb()).length;
    await page.click('.rg-nb-use');
    const used = await page.evaluate(() => {
        const w = editStampWords(_mtPalette, editDraft().brush);
        const art = w.layer1 !== editBlankCanopy(_mtPalette) ? w.layer1 : w.layer2;
        return { tile: _brushTile, mirrored: (art & 0x4000) !== 0 };
    });
    check('use arms the shown candidate as the brush, mirrored as shown',
        used.tile.graphic === 4195 && used.tile.family === 58 && used.mirrored, JSON.stringify(used));
    check('and the card re-centres on it', (await sentNb()).slice(nbSentBeforeUse).join() === '4195');
    await page.click('[data-brush-flip="h"]');

    // A slow answer for a brush that has since changed must not land.
    const stale = await page.evaluate((nb) => {
        const before = _nbAnswer;
        applyNeighbourTiles(nb);   // still for 4191; the brush is 4195 now
        return _nbAnswer === before;
    }, NB);
    check('a reply for an earlier brush is dropped', stale);

    // The card must not shove the dock sideways at the real width (§7b):
    // measured by position, at a panel just wide enough for canvas + dock.
    await page.setViewportSize({ width: 960, height: 720 });
    await page.click('[data-fam-tile="4191"]');
    await page.evaluate((nb) => applyNeighbourTiles(nb), NB);
    const nbLayout = () => page.evaluate(() => {
        const dock = document.getElementById('rg-dock').getBoundingClientRect();
        const panels = document.getElementById('rg-panels');
        const card = document.querySelector('.rg-nb-card').getBoundingClientRect();
        return { dockLeft: Math.round(dock.left), dockRight: Math.round(dock.right),
            dockW: Math.round(dock.width), cardRight: Math.round(card.right),
            overflow: panels.scrollWidth - panels.clientWidth, view: document.documentElement.clientWidth };
    });
    const nbL0 = await nbLayout();
    await page.click('.rg-nb-e'); await page.click('.rg-nb-e');
    await page.click('.rg-nb-centre');
    const nbL1 = await nbLayout();
    check('picking, cycling and switching layer leave the dock where it was',
        nbL1.dockLeft === nbL0.dockLeft && nbL1.dockW === nbL0.dockW, JSON.stringify([nbL0, nbL1]));
    check('with the card inside the dock and nothing scrolling sideways',
        nbL1.cardRight <= nbL1.dockRight && nbL1.overflow <= 0 && nbL1.dockRight <= nbL1.view,
        JSON.stringify(nbL1));
    await page.evaluate(() => { _layerForce = null; });
    await page.setViewportSize({ width: 1280, height: 720 });

    await page.evaluate(() => document.querySelector('[data-panel="neighbours"]').click());
    check('the card folds down to its own header',
        !(await page.$('.rg-nb-plus')) && !!(await page.$('.rg-nb-card')));
    await page.evaluate(() => document.querySelector('[data-panel="neighbours"]').click());
    await page.evaluate(() => {
        const saved = window.__nbSaved;
        _edit = saved.edit; _brushTile = saved.brushTile; _chipSel = saved.chipSel;
        _mtSlot = saved.mtSlot; _famSheets = saved.sheets;
        _layerForce = null; _brushFlip = { h: false, v: false };
        renderEditPanels();
    });

    // ── the segmented filter row ───────────────────────────────────────────
    // Two pills, which is what the mock draws — but not the mock's two: its
    // `Auto|All` is a scope toggle, which here is the "N more families" pager
    // (one host round-trip per family, so "all" is not a button). See §8a.
    const segs = await page.evaluate(() => Array.prototype.map.call(
        document.querySelectorAll('.rg-tile-seg'),
        (s) => Array.prototype.map.call(s.querySelectorAll('.rg-tile-seg-b'),
            (b) => b.textContent).join('|')));
    // A third, since v0.68.0: the `cuttable` filter, asked for "next to H/V";
    // `stairs` joined it in v0.70.0 — one list filter at a time.
    check('the filter row is five segmented pills, not loose chips',
        // v0.74.0: all|floor|edge|wall — what to build floors, walls and the filler with.
        // v0.75.0: anim|frames — an animation as one playing swatch, or each frame.
        segs.length === 5 && segs[0] === 'auto|front|ground' && segs[1] === 'H|V' && segs[2] === 'all|floor|edge|wall'
        && segs[3] === 'anim|frames' && segs[4] === 'cuttable|stairs|drift|deflect|interaction',
        JSON.stringify(segs));

    // v0.76.0: a placed animated stamp plays on the map — its frames stacked,
    // one visible at a time on the document clock — and the frames list
    // marks the first frame 1/n like the rest ("what does ▶6 mean in frames mode?").
    const anim = await page.evaluate(() => {
        const sheet = { imageUri: 'data:a', imageWidth: 32, imageHeight: 16, columns: 2, cell: 16, count: 2,
            anim: { columns: 16, cell: 16, entries: [[1, [8, 4, 8]]],
                sheets: [{ imageUri: 'data:b', imageWidth: 16, imageHeight: 16 }, { imageUri: 'data:c', imageWidth: 16, imageHeight: 16 }] } };
        const box = document.createElement('div');
        box.innerHTML = '<svg>' + editStampAnimSvg(sheet, 1, 'STILL', 'rg-edit-cell', 0, 0) + '</svg>';
        const anims = box.querySelectorAll('animate');
        const saved = _tileFramesSplit;
        _tileFramesSplit = true;
        const split = tileAnimMarkHtml({ animations: { 5: { frames: [5, 6, 7], delays: [1, 1, 1] } } }, [0, 0, 5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 5, 0]);
        _tileFramesSplit = false;
        const combined = tileAnimMarkHtml({ animations: { 5: { frames: [5, 6, 7], delays: [1, 1, 1] } } }, [0, 0, 5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 5, 0]);
        _tileFramesSplit = saved;
        return {
            still: editStampAnimSvg(sheet, 0, 'STILL', 'rg-edit-cell', 0, 0),
            ghost: editStampAnimSvg(sheet, 1, 'STILL', 'rg-edit-cell rg-paste-ghost', 0, 0),
            frames: box.querySelectorAll('svg svg').length,
            values: Array.prototype.map.call(anims, (a) => a.getAttribute('values')),
            keyTimes: anims[0] && anims[0].getAttribute('keyTimes'), dur: anims[0] && anims[0].getAttribute('dur'),
            split, combined,
        };
    });
    check('an animated stamp is drawn as its frames, each shown in its turn at vanilla timing',
        anim.frames === 3 && anim.values.join(' ') === '1;0;0 0;1;0 0;0;1'
        && anim.keyTimes === '0.0000;0.4000;0.6000' && anim.dur === '0.333s', JSON.stringify(anim));
    check('a stamp that does not animate, and the paste ghost, stay one still picture',
        anim.still === 'STILL' && anim.ghost === 'STILL', JSON.stringify(anim));
    check('frames mode marks the first frame 1/n; combined it is ▶n',
        anim.split.indexOf('>1/3<') > 0 && anim.combined.indexOf('>▶3<') > 0, anim.split + ' ' + anim.combined);

    // ── the cuttable filter ────────────────────────────────────────────────
    // "shows only tiles that are involved in cuttable tiles when turned on
    // (default off)". Slot row [10] is the graphic's grass flag; the
    // catalogue's `grass` count lets a family with none drop out unfetched.
    const grass = await page.evaluate(() => {
        const saved = { cat: _famCatalogue, sheets: _famSheets, fams: editDraft().families, sel: _chipSel };
        _chipSel = {};
        editDraft().families = [];
        _famCatalogue = [{ id: 51, tiles: 3, rooms: 1, areas: [], names: [], grass: 2 },
                         { id: 52, tiles: 2, rooms: 1, areas: [], names: [], grass: 0 }];
        const row = (g, flag) => [0, 0, g, 1, 0, 1, -1, 0, -1, 0, flag];
        _famSheets = { 51: { family: 51, count: 3, columns: 16, cell: 16, imageUri: 'data:,',
                            slots: [row(901, 1), row(902, 0), row(903, 2)] },
                       52: { family: 52, count: 2, columns: 16, cell: 16, imageUri: 'data:,',
                            slots: [row(904, 0), row(905, 0)] } };
        const shown = () => Array.prototype.map.call(
            document.querySelectorAll('[data-fam-tile]'), (t) => Number(t.dataset.famTile)).sort();
        renderEditPanels();
        const r = { off: shown(), offOn: !!document.querySelector('[data-tile-filter].on') };
        document.querySelector('[data-tile-filter="grass"]').click();
        r.on = shown();
        r.onOn = !!document.querySelector('[data-tile-filter].on');
        r.families = tileGroupFamilies();
        document.querySelector('[data-tile-filter="grass"]').click();
        r.back = shown();
        _famCatalogue = saved.cat; _famSheets = saved.sheets; editDraft().families = saved.fams; _chipSel = saved.sel;
        renderEditPanels();
        return r;
    });
    check('cuttable is off by default and every tile is listed',
        !grass.offOn && grass.off.join() === '901,902,903,904,905', JSON.stringify(grass));
    check('turned on, only tiles that are part of cuttable grass are listed, and families with none drop out',
        grass.onOn && grass.on.join() === '901,903' && grass.families.join() === '51', JSON.stringify(grass));
    check('and turned off again, everything is back', grass.back.join() === '901,902,903,904,905', JSON.stringify(grass));

    // ── the stairs filter ──────────────────────────────────────────────────
    // "we identify which tiles have the stairs flag active and add a filter
    // where they can be listed". Slot rows [11]/[12] are the direction a
    // graphic rises drawn unflipped (ground/front); the catalogue's `stairs`
    // count drops a family with none unfetched. The swatch shows the flag.
    const stairs = await page.evaluate(() => {
        const saved = { cat: _famCatalogue, sheets: _famSheets, fams: editDraft().families, sel: _chipSel, lf: _layerForce };
        _chipSel = {};
        editDraft().families = [];
        _layerForce = 'terrain';
        _famCatalogue = [{ id: 51, tiles: 3, rooms: 1, areas: [], names: [], grass: 0, stairs: 1 },
                         { id: 52, tiles: 1, rooms: 1, areas: [], names: [], grass: 0, stairs: 0 }];
        const row = (g, ground, front) => [0, 0, g, 1, 0, 1, 0, 90, -1, 0, 0, ground, front];
        _famSheets = { 51: { family: 51, count: 3, columns: 16, cell: 16, imageUri: 'data:,',
                            slots: [row(911, 1, 0), row(912, 0, 0), row(913, 0, 2)] },
                       52: { family: 52, count: 1, columns: 16, cell: 16, imageUri: 'data:,', slots: [row(914, 0, 0)] } };
        const shown = () => Array.prototype.map.call(
            document.querySelectorAll('[data-fam-tile]'), (t) => Number(t.dataset.famTile)).sort();
        renderEditPanels();
        document.querySelector('[data-tile-filter="stairs"]').click();
        const r = { on: shown(), families: tileGroupFamilies(),
            onBtn: document.querySelector('[data-tile-filter="stairs"]').classList.contains('on'),
            grassOff: !document.querySelector('[data-tile-filter="grass"]').classList.contains('on'),
            mark: (document.querySelector('[data-fam-tile="911"] .rg-stairs-mark') || {}).textContent || '',
            title: document.querySelector('[data-fam-tile="911"]').getAttribute('title'),
            flipped: tileSuggestedCollision(row(911, 1, 0), 'terrain', 0x4000),
            plain: tileSuggestedCollision(row(911, 1, 0), 'terrain', 0),
            notStairs: tileSuggestedCollision(row(912, 0, 0), 'terrain', 0) };
        document.querySelector('[data-tile-filter="grass"]').click();
        r.switched = document.querySelector('[data-tile-filter="grass"]').classList.contains('on')
            && !document.querySelector('[data-tile-filter="stairs"]').classList.contains('on');
        document.querySelector('[data-tile-filter="grass"]').click();
        _famCatalogue = saved.cat; _famSheets = saved.sheets; editDraft().families = saved.fams;
        _chipSel = saved.sel; _layerForce = saved.lf;
        renderEditPanels();
        return r;
    });
    check('stairs lists only stair tiles — as ground or as front — and drops families with none',
        stairs.onBtn && stairs.on.join() === '911,913' && stairs.families.join() === '51', JSON.stringify(stairs));
    check('a stair tile carries the flag on its swatch and in its tooltip',
        stairs.mark === '◢' && /stairs: rises to the right/.test(stairs.title), JSON.stringify(stairs));
    check('painting it writes the stairs flag, mirrored by H; other tiles keep their shape',
        stairs.plain === 0x2001 && stairs.flipped === 0x2002 && stairs.notStairs === 0, JSON.stringify(stairs));
    check('the two filters are one choice: picking cuttable turns stairs off', stairs.grassOff && stairs.switched,
        JSON.stringify(stairs));

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
        // The banner leads the Tile tab's fixed head (v0.72.0: the head stays, the tiles scroll).
        first: (document.querySelector('#rg-tab-body .rg-tile-head') || document.getElementById('rg-tab-body'))
            .firstElementChild.className,
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
        // v0.79.0: the generated vanilla library is behind the `vanilla` toggle.
        _widgets = [];
        _widgetsVanilla = true;
        applyDecoLibrary({ deco: deco });
        applyDecoPreviews({ previews: { ids: [0, 1, 2], columns: 6, cell: 48,
            imageUri: 'data:image/png;base64,ZGVjbw==', imageWidth: 288, imageHeight: 48 } });
    }, DECO);
    check('the Widgets tab renders the deco library as thumbnails', (await page.$$('.rg-deco[data-deco]')).length === 3);
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
        armedDeco.tool === 'paint' && armedDeco.constructs === 1 && armedDeco.pick === 0,
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
        // A stamped group is kept apart from the map: the map's own cells are
        // untouched, and what it shows is baked on the fly.
        const baked = editBakedCells(_mtPalette);
        return { cells: d.groups[0].cells.length, mapCells: Object.keys(d.cells).length,
                 shown: Object.keys(baked).length, added: d.added.length,
                 graphics: d.addedGraphics.slice(), placed: d.placed.slice(),
                 words: d.added.map((a) => [a.layer1, a.layer2]) };
    });
    check('stamping it keeps its cells over the map, not in it',
        stamped.cells === 2 && stamped.mapCells === 0 && stamped.shown === 2 && stamped.added === 2,
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
        (await page.$$eval('.rg-deco[data-deco]', (n) => n.map((e) => e.dataset.deco))).join() === '2');
    await page.fill('#rg-deco-filter', 'gothica');
    check('so does an act', (await page.$$eval('.rg-deco[data-deco]', (n) => n.length)) === 1);
    await page.fill('#rg-deco-filter', 'ebon keep');
    check('and every word has to match, so two narrow further',
        (await page.$$eval('.rg-deco[data-deco]', (n) => n.map((e) => e.dataset.deco))).join() === '2');
    await page.fill('#rg-deco-filter', '');

    // ── the four questions, as buttons ─────────────────────────────────────
    // "A working, foreground gourd out of my own families" is the ask; it
    // is 27 of the 532 in room 0x34, and unfindable without these.
    // Sorted rather than DOM order: the Widgets tab groups cards by category
    // (Foreground before Background before Misc), so a filter's *result
    // set* is what these assert, not the on-screen ordering — that ordering
    // has its own dedicated check above ("cards are grouped under
    // Foreground/Background headings").
    const onScreen = () => page.$$eval('.rg-deco[data-deco]',
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
    // v0.80.0: the pencil, which stamps it on the Widgets tab only — the old
    // Stamp tool kept stamping on the Object tab too.
    check('arming a widget selects the pencil',
        await page.evaluate(() => editDraft().tool) === 'paint');
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
        svg.setAttribute('viewBox', '0 0 8 8');
        const img = document.getElementById('rg-img');
        ['x', 'y'].forEach((a) => img.setAttribute(a, 0)); img.setAttribute('width', 8); img.setAttribute('height', 8);
        setupEditGestures();
        // v0.94.0: the grip sits on the map's own corner, shown only on a drafted map.
        editPlaceResizeGrip();
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
    check('and it says which cells the shrink would hide — kept, not dropped',
        /hides 1 cell \(kept\)/.test(live.label), live.label);
    check('the drag is not also a paint stroke', live.painted === 2, String(live.painted));

    await page.mouse.up();
    const resized = await page.evaluate(
        () => window.__sent.filter((m) => m.command === 'requestBlankRoom').pop());
    check('releasing asks the host for a map that size',
        resized && resized.widthTiles === 2 && resized.heightTiles === 2, JSON.stringify(resized));

    // A resize keeps every cell — past the new edge they are hidden, not
    // encoded, and back if the map grows (v0.94.0); a new room keeps none.
    await page.evaluate(() => applyBlankRoom({ room: {
        widthTiles: 2, heightTiles: 2, borrowedFrom: 0x34, baseMetatile: 8,
        imageUri: 'data:image/png;base64,cg==', tileFamilies: [35], problems: [],
        budget: _mtPalette.budget } }));
    const kept = await page.evaluate(() => ({ cells: Object.keys(editDraft().cells).sort(),
        exported: editExport(_mtPalette).cells.map((c) => c.x + ',' + c.y) }));
    check('a shrink keeps every cell in the draft', kept.cells.join() === '0,0,3,3', JSON.stringify(kept));
    check('but only the ones inside the map are exported', kept.exported.join() === '0,0', JSON.stringify(kept));
    const pulledIn = await page.evaluate(() => editDraft().start);
    check('and the Boy is pulled back inside, never off the map',
        pulledIn && pulledIn.x <= 1 && pulledIn.y <= 1, JSON.stringify(pulledIn));

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
    // The `edit` button this used to click is gone (every map opens in the
    // editor); the Interact chip is routed through the same handler.
    await page.evaluate(() => {
        // One more bind, for the second render of the same panel. Without
        // the guard that makes two handlers, and two is the dead case.
        bindEditControls(document.getElementById('room-detail'), {});
    });
    const wasOn = await page.evaluate(() => interactOverlayOn());
    // Interact lives in the Special menu since v0.92.0, so a closed popup hides it.
    await page.$eval('#room-detail .rdf-interact', (b) => b.click());
    const nowOn = await page.evaluate(() => interactOverlayOn());
    check('binding the panel again does not double every click', nowOn === !wasOn,
        `the Interact overlay went ${wasOn} -> ${nowOn} after one click, with the panel bound twice`);
    await page.$eval('#room-detail .rdf-interact', (b) => b.click());
    check('and the next click toggles it straight back',
        await page.evaluate(() => interactOverlayOn()) === wasOn);

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
    // Free one slot on an unlocked map and every candidate comes back —
    // adopting one is something that can happen. A locked map (a vanilla
    // room opens locked) cannot adopt, so it lists only its own.
    const shownWithRoom = await page.evaluate(() => {
        editClearFamily(3);
        renderEditPanels();
        const r = { families: tileGroupFamilies().length, free: editFreeFamilySlot(),
                    pager: !!document.querySelector('[data-tile-more]') };
        editDraft().locked = true;
        r.locked = tileGroupFamilies().length;
        editDraft().locked = false;
        renderEditPanels();
        return r;
    });
    // §8e: all of them, lazily, never a page at a time behind a button.
    check('freeing a slot brings back every candidate, with no pager',
        shownWithRoom.free >= 0 && shownWithRoom.families === 6 + 20 && shownWithRoom.pager === false,
        JSON.stringify(shownWithRoom));
    check('but a locked map lists only its own families',
        shownWithRoom.locked === 6, JSON.stringify(shownWithRoom));
    const lazy = await page.evaluate(() => ({
        placeholders: document.querySelectorAll('#rg-tab-body [data-lazy-fam]').length,
        asked: window.__sent.filter((m) => m.command === 'requestFamilySheet'
            && m.family >= 9000).map((m) => m.family),
    }));
    check('candidates wait as placeholders, and only the ones near the view are fetched',
        lazy.placeholders > 0 && lazy.asked.length < 20, JSON.stringify(lazy));
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

    // ── v0.65.1: families follow the map, the empty word names none ───────
    // "clicking on a tile should not add it to the tile families, only if a
    // tile of the family is on the map we add the family".
    const fam = await page.evaluate(() => {
        const d = editReset(0x34);
        d.on = true; d.tool = 'paint'; d.families = [];
        d.blank = { widthTiles: 2, heightTiles: 2, floor: { layer1: 0xa800, layer2: 0xa800, collision: 0 } };
        _mtPalette.grid = [[null, null], [null, null]];
        _brushTile = null; _layerForce = null;
        editUseFamilyTile(0x0999, 40);
        const r = { picked: editFamilies().filter((f) => f !== undefined).length,
                    preview: editPreviewFamilies() };
        editStroke({ x: 1, y: 1 }, 'down');
        r.painted = editFamilies().slice();
        r.stranded = editStrandedCells().length;
        editUndo(_mtPalette);
        r.undone = editFamilies().filter((f) => f !== undefined).length;
        editRedo(_mtPalette);
        r.redone = editFamilies().slice();
        d.cells = {}; d.brush = -1; _brushTile = null;
        return r;
    });
    check('picking a tile plans its family but does not load it', fam.picked === 0
        && fam.preview.length === 1 && fam.preview[0] === 40, JSON.stringify(fam));
    check('painting one of its tiles loads it, into the slot the brush names',
        fam.painted[0] === 40, JSON.stringify(fam));
    check('the empty word ($A800, palette field 2) does not strand the painted cell',
        fam.stranded === 0, JSON.stringify(fam));
    check('undoing the only tile unloads the family, redo brings it back',
        fam.undone === 0 && fam.redone[0] === 40, JSON.stringify(fam));

    // "when drawing tiles with collision it is added to the meta tile list
    // with collision": a picked tile's stamp carries vanilla's shape for it.
    const coll = await page.evaluate(() => {
        const d = editReset(0x34);
        d.on = true; d.tool = 'paint'; d.families = [];
        _brushTile = null; _layerForce = null;
        _famSheets[41] = { family: 41, slots: [[0, 0, 0x0998, 5, 0, 5, 0x0f, 99, 0x00, 80]] };
        editUseFamilyTile(0x0998, 41);
        const ground = editStampWords(_mtPalette, d.brush).collision;
        _layerForce = 'canopy';
        editUseFamilyTile(0x0998, 41);
        const front = editStampWords(_mtPalette, d.brush).collision;
        _layerForce = null; _brushTile = null; d.brush = -1;
        return { ground, front };
    });
    check('a picked tile’s stamp gets vanilla’s collision shape for the layer it is painted on',
        coll.ground === 0x0f && coll.front === 0x00, JSON.stringify(coll));

    // ── the cuttable layer (map-editor-cutlayer.js) ────────────────────────
    // "the cuttable layer behaves like a regular tile … default off; when
    // the button is active we draw on the cuttable layer instead".
    const cut = await page.evaluate(() => {
        const d = editReset(0x34);
        d.on = true; d.tool = 'paint';
        d.blank = { widthTiles: 2, heightTiles: 2, floor: { layer1: 0xa800, layer2: 0xa800, collision: 0 } };
        _mtPalette.grid = [[null, null], [null, null]];
        document.getElementById('rg-outer').insertAdjacentHTML('beforeend',
            '<span class="rg-seg" id="t-cutseg">' + cutLayerButtonHtml() + '</span>');
        const r = { off: !editCutLayerOn() && !document.querySelector('.rdf-cut.on') };
        d.brush = 0;
        editStroke({ x: 0, y: 0 }, 'down');                          // the map
        document.querySelector('[data-edit-act="cut-layer"]').click();
        r.on = editCutLayerOn() && !!document.querySelector('.rdf-cut.on');
        d.brush = editAddStamp(_mtPalette, { layer1: 0xa800, layer2: 0x0c02, collision: 0x0f });
        editStroke({ x: 0, y: 0 }, 'down');                          // cuttable, over it
        r.cells = JSON.stringify(d.cells); r.cut = JSON.stringify(d.cut);
        r.marks = document.querySelectorAll('#rg-edit .rg-cut-mark').length;
        r.payload = romExportPayload({}).cut;
        editUndo(_mtPalette); r.undone = Object.keys(d.cut).length; editRedo(_mtPalette);
        d.tool = 'erase'; editStroke({ x: 0, y: 0 }, 'down');
        r.erased = { cut: Object.keys(d.cut).length, cells: Object.keys(d.cells).length };
        document.querySelector('[data-edit-act="cut-layer"]').click();
        document.getElementById('t-cutseg').remove();
        d.tool = 'paint'; d.brush = -1; d.cells = {}; d.cut = {}; d.blank = null;
        return r;
    });
    check('Cuttable is off by default, and its button turns it on', cut.off && cut.on, JSON.stringify(cut));
    check('with it on, painting writes the cuttable layer and leaves the map beneath alone',
        cut.cells === '{"0,0":0}' && Object.keys(JSON.parse(cut.cut)).length === 1 && cut.marks === 1, JSON.stringify(cut));
    check('Export ROM gets the cuttable tile\u2019s words; undo takes it off the layer',
        // 0x1f: the shape, on level 1 — every tile lands on the chosen level (v0.71.0).
        cut.payload.length === 1 && cut.payload[0][3] === 0x0c02 && cut.payload[0][4] === 0x1f && cut.undone === 0,
        JSON.stringify(cut));
    check('erasing on the cuttable layer removes the cuttable tile, not the map',
        cut.erased.cut === 0 && cut.erased.cells === 1, JSON.stringify(cut));

    // ── v0.69.2: order-independent stamps, erase by layer, lazy swap ──────
    const ord = await page.evaluate(() => {
        const d = editReset(0x34);
        d.on = true; d.tool = 'paint';
        d.blank = { widthTiles: 2, heightTiles: 2, floor: { layer1: 0xa800, layer2: 0xa800, collision: 0 } };
        _mtPalette.grid = [[null, null], [null, null]];
        const front = editAddStamp(_mtPalette, { layer1: 0x2c66, layer2: 0xa800, collision: 0x1f });
        const ground = editAddStamp(_mtPalette, { layer1: 0xa800, layer2: 0x4c62, collision: 0x10 });
        const words = (x, y) => editStampWords(_mtPalette, d.cells[x + ',' + y]);
        d.brush = front; editStroke({ x: 0, y: 0 }, 'down'); d.brush = ground; editStroke({ x: 0, y: 0 }, 'down');
        d.brush = ground; editStroke({ x: 1, y: 0 }, 'down'); d.brush = front; editStroke({ x: 1, y: 0 }, 'down');
        const r = { a: words(0, 0), b: words(1, 0) };
        // Erase by layer, on a front-over-ground cell.
        const erase = (layer) => {
            d.cells['1,1'] = d.cells['0,0'];
            _currentLayer = layer; d.tool = 'erase'; editStroke({ x: 1, y: 1 }, 'down');
            const w = d.cells['1,1'] === undefined ? null : editStampWords(_mtPalette, d.cells['1,1']);
            return w && [w.layer1, w.layer2];
        };
        r.fgOnly = erase('layer1');
        r.bgOnly = erase('layer2');
        r.both = erase('composite');
        d.cells['1,1'] = ground; _currentLayer = 'composite'; editStroke({ x: 1, y: 1 }, 'down');
        r.bothBare = d.cells['1,1'] === undefined;
        d.tool = 'paint'; d.brush = -1; d.cells = {}; d.blank = null;
        return r;
    });
    check('front-then-ground and ground-then-front make the same stamp',
        ord.a && ord.b && ord.a.layer1 === 0x2c66 && ord.a.layer2 === 0x4c62
        && ord.b.layer1 === 0x2c66 && ord.b.layer2 === 0x4c62 && ord.a.collision === ord.b.collision,
        JSON.stringify(ord));
    check('erase follows the selected layer: Foreground takes the front art, Background the ground',
        ord.fgOnly && ord.fgOnly[0] === 0xa800 && ord.fgOnly[1] === 0x4c62
        && ord.bgOnly && ord.bgOnly[0] === 0x2c66 && ord.bgOnly[1] === 0xa800, JSON.stringify(ord));
    check('with both, the front art goes first, then the painted tile itself',
        ord.both && ord.both[0] === 0xa800 && ord.bothBare, JSON.stringify(ord));

    const swap = await page.evaluate(() => {
        editDraft().families = [];
        _chipSel = {};
        _famCatalogue = [{ id: 61, tiles: 1, rooms: 1, areas: [], names: [], grass: 0 },
                         { id: 62, tiles: 1, rooms: 1, areas: [], names: [], grass: 0 }];
        _famSheets = {};
        _editActiveTab = 'tile';
        renderEditPanels();
        const other = document.querySelector('.rg-tile-group[data-group-fam="62"]');
        applyFamilySheet({ sheet: { family: 61, count: 1, columns: 16, cell: 16, imageUri: 'data:,',
            slots: [[0, 0, 911, 1, 0, 1, -1, 0, -1, 0, 0]] } });
        const r = { swapped: !!document.querySelector('[data-fam-tile="911"]'),
                    untouched: document.querySelector('.rg-tile-group[data-group-fam="62"]') === other };
        _famCatalogue = null; _famSheets = {};
        renderEditPanels();
        return r;
    });
    check('a sheet that arrives is swapped into its own group; the rest of the list is left alone',
        swap.swapped && swap.untouched, JSON.stringify(swap));

    // The saved list can land after a new map exists (the host posts `newMap`
    // first). Replacing the list orphaned it — no row, no blank room, no Boy.
    const merged = await page.evaluate(() => {
        _customMaps = [];
        customNew(16, 14);
        const key = _customActive;
        customLoadMaps({ maps: [{ key: 'custom-old', name: 'New map 1', borrow: 0x34, w: 16, h: 14 }] });
        const m = customFind(key);
        const r = { kept: !!m, name: m && m.name, rows: _customMaps.length };
        window.__sent.length = 0;
        editDraft().customKey = key;
        _newMapWaiting = true;
        newMapPaletteReady();
        r.asked = window.__sent.some((x) => x.command === 'requestBlankRoom');
        _customActive = null; _customMaps = [];
        return r;
    });
    check('the saved list arriving after a new map keeps it (renumbered) and it still gets its blank room',
        merged.kept && merged.rows === 2 && merged.name === 'New map 2' && merged.asked, JSON.stringify(merged));

    // v0.71.0: New Map reopens an untouched map; a drawn one gets a sibling.
    const reuse = await page.evaluate(() => {
        _customMaps = []; _customActive = null;
        editReset(0x34);                     // no draft left bound to an earlier map
        const loaded = _customLoaded;
        _customLoaded = 'yes'; // the host's list is in (this stub host never answers)
        const a = customNew(16, 14);
        const again = customNew(16, 14);
        const r = { same: again && again.key === a.key, rows: _customMaps.length };
        editReset(0x34).customKey = a.key;   // renderRoomDetail is stubbed here; bind by hand
        editDraft().cells['0,0'] = 0;
        editDraft().undo.push({ cells: [], special: [], placed: 0, dropped: [] });
        const b = customNew(16, 14);
        r.second = b && b.key !== a.key && _customMaps.length === 2;
        r.otherSize = customNew(20, 9).key !== b.key;
        _customActive = null; _customMaps = []; _customLoaded = loaded;
        return r;
    });
    check('New Map on an untouched map reopens it; once drawn on, the next is a new map',
        reuse.same && reuse.rows === 1 && reuse.second && reuse.otherSize, JSON.stringify(reuse));

    // ── v0.79.0: the Widgets tab — yours first, vanilla behind a toggle ────
    const wtab = await page.evaluate(() => {
        editReset(0x34); editDraft().on = true;
        _editActiveTab = 'widgets'; _widgets = []; _widgetsVanilla = false;
        renderEditPanels();
        const r = { vanillaCards: document.querySelectorAll('.rg-deco[data-deco]').length,
            add: !!document.querySelector('[data-widget-act="new"]'),
            pages: document.querySelectorAll('[data-deco-page]').length };
        window.__sent.length = 0;
        document.querySelector('[data-widget-act="vanilla"]').click();
        r.after = document.querySelectorAll('.rg-deco[data-deco]').length;
        r.pref = window.__sent.some((m) => m.command === 'saveUiPref' && m.key === 'widgetsVanilla' && m.value === true);
        r.previews = window.__sent.filter((m) => m.command === 'requestDeco' && m.previews).map((m) => m.previews.length);
        return r;
    });
    check('Widgets shows your own first; the generated vanilla ones only with the toggle, remembered',
        wtab.vanillaCards === 0 && wtab.add && wtab.after === 3 && wtab.pref, JSON.stringify(wtab));
    check('the vanilla list scrolls instead of paging', wtab.pages === 0, JSON.stringify(wtab));

    const keptW = await page.evaluate(() => {
        window.__sent.length = 0;
        widgetSaveFromDeco({ id: 1, w: 2, h: 1, states: 2, room: 0x25,
            trigger: { dx: 0, dy: 0, w: 3, h: 2, scriptId: 0xd74 },
            cells: [{ dx: 0, dy: 0, canopy: { graphic: 0x0422, family: 58, flags: 0 }, terrain: null, collision: 0x001f }] },
            '2×1 from Fire Eyes');
        const sent = window.__sent.filter((m) => m.command === 'saveWidget').pop();
        renderEditPanels();
        const id = _widgets[0].id;
        document.querySelector('[data-widget="' + id + '"]').click();
        const d = editDraft();
        return { n: _widgets.length, sent: !!sent, trig: sent && sent.widget.attachments.bTrigger.length,
            obj: sent && sent.widget.attachments.objects[0].states, card: !!document.querySelector('[data-widget-edit="' + id + '"]'),
            armed: _editConstruct >= 0 && d.constructs[_editConstruct].widget === id };
    });
    check('☆ keeps a vanilla one as your widget — trigger and object included — and a click arms it',
        keptW.n === 1 && keptW.sent && keptW.trig === 1 && keptW.obj === 2 && keptW.card && keptW.armed, JSON.stringify(keptW));

    // "stamp a gourd with B-trigger, collision and object … regardless of the elevation"
    const gourd = await page.evaluate(() => {
        const d = editReset(0x34); d.on = true; d.plane = 1;
        const high = editAddStamp(_mtPalette, { layer1: 0xa800, layer2: 0x05c6, collision: 0x0020 });
        d.cells['0,0'] = high; d.cells['1,0'] = high; // _mtPalette is the 2×2 blank room by now
        const c = { name: 'gourd', w: 2, h: 1,
            cells: [{ dx: 0, dy: 0, canopy: { word: 0x1422 }, terrain: null, collision: 0x001f },
                    { dx: 1, dy: 0, canopy: { word: 0x1423 }, terrain: null, collision: 0x001f }],
            attachments: { bTrigger: [{ dx: 0, dy: 0, w: 2, h: 2, scriptId: 0xd74 }], stepOn: [],
                objects: [{ dx: 0, dy: 0, w: 2, h: 1, states: 2 }] } };
        const got = editStampGroup(_mtPalette, c, 0, 0);
        const w = editStampWords(_mtPalette, editCellAt(_mtPalette, 0, 0));
        const r = { level: got.level, plane: (w.collision >> 4) & 3, shape: w.collision & 0x0f,
            trig: d.placed.filter((p) => p.kind === 'bTrigger').length, obj: d.placed.filter((p) => p.kind === 'object').length,
            groups: d.groups.length };
        editUndo();
        const open = editStampGroup(_mtPalette, c, 0, 1);
        r.openLevel = open.level; r.dims = [_mtPalette.widthTiles, _mtPalette.heightTiles];
        return r;
    });
    check('a stamped gourd brings its collision, B-trigger and object, on the level of the floor it lands on',
        gourd.level === 2 && gourd.plane === 2 && gourd.shape === 0x0f && gourd.trig === 1 && gourd.obj === 1
        && gourd.groups === 1, JSON.stringify(gourd));
    check('on open ground it takes the level from the bar', gourd.openLevel === 1, JSON.stringify(gourd));

    // Widget Editor Mode saves the canvas back into the widget: the blank
    // floor's own words become null ("keep the floor"), triggers come along.
    const session = await page.evaluate(() => {
        const w = { id: 'w-test', name: 'Widget 9', w: 2, h: 2, cells: [], attachments: { bTrigger: [], stepOn: [], objects: [] } };
        _widgets = [w];
        const d = editReset(0x34); d.on = true;
        _widgetEdit = { key: 'widget-test', widget: 'w-test', name: 'Pot', w: 2, h: 2, borrow: 0x34 };
        d.customKey = 'widget-test';
        d.blank = { floor: { layer1: 0xa800, layer2: 0x05c6, collision: 0 } };
        d.cells['1,0'] = editAddStamp(_mtPalette, { layer1: 0x1422, layer2: 0x05c6, collision: 0x001f });
        d.placed.push({ kind: 'bTrigger', x: 1, y: 0, w: 1, h: 2, scriptId: 7, uid: 99 });
        window.__sent.length = 0;
        widgetFromSession(_widgetEdit);
        const sent = window.__sent.filter((m) => m.command === 'saveWidget').pop();
        const found = customFind('widget-test') === _widgetEdit;
        _widgetEdit = null;
        return { found, sent: sent && sent.widget };
    });
    check('a widget being edited is a custom map the rail never lists, found by its key', session.found);
    check('editing saves the canvas into the widget: its name, cells (floor left null) and triggers',
        session.sent && session.sent.name === 'Pot' && session.sent.cells.length === 1
        && session.sent.cells[0].dx === 1 && session.sent.cells[0].terrain === null
        && session.sent.attachments.bTrigger[0].scriptId === 7, JSON.stringify(session.sent));

    // ── v0.80.0 ─────────────────────────────────────────────────────────────
    const v80 = await page.evaluate(() => {
        const r = {};
        // Draft stamps draw from the host's composed sheet; this page has no host.
        const composed = _editComposed;
        _editComposed = { imageUri: 'data:image/png;base64,eA==', count: 256, columns: 16, cell: 16, imageWidth: 256, imageHeight: 256 };
        // A family picked and never painted keeps no slot from the next one.
        let d = editReset(0x34); d.on = true; d.families = [];
        r.first = editPlanFamilyFor(115).slot;
        r.second = editPlanFamilyFor(53).slot;
        // Triggers toggle on a custom map too, B and step-on apart.
        const bar = buildViewFilterBarHtml({ romId: 0x34, hasTriggers: false });
        r.triggers = /data-hide="hide-trigger"/.test(bar) && /data-hide="hide-step"/.test(bar) && /data-hide="hide-btrig"/.test(bar);
        // Cuttable off: the map shows the tile beneath, not the cuttable one.
        d = editReset(0x34); d.on = true;
        d.cut = { '0,0': editAddStamp(_mtPalette, { layer1: 0xa800, layer2: 0x0c02, collision: 0x0f }) };
        r.cutOff = editCutSvg(_mtPalette, _editComposed, _editOrigin) === '';
        _editCutLayer = true;
        r.cutOn = editCutSvg(_mtPalette, _editComposed, _editOrigin).indexOf('rg-edit-cut') >= 0;
        _editCutLayer = false; d.cut = {};
        // The Object tab, after Trigger.
        r.tabs = Array.prototype.map.call(document.querySelectorAll('#rg-tabstrip .rg-tab'), (b) => b.dataset.editActiveTab).join();
        _editActiveTab = 'object'; d.tool = 'paint';
        // Use a 2×2 blank grid so object-area painting writes base room cells.
        _mtPalette.grid = [[null, null], [null, null]];
        d.brush = editAddStamp(_mtPalette, { layer1: 0xa800, layer2: 0xa800, collision: 0 });
        editBegin(); editStroke({ x: 0, y: 0 }, 'down'); editStroke({ x: 1, y: 1 }, 'up'); editEnd();
        const o = editObjects()[0];
        r.area = o && [o.x, o.y, o.w, o.h].join();
        r.sel = _objectSel === (o && o.uid);
        objectAddFrame(o.uid);
        d.brush = editAddStamp(_mtPalette, { layer1: 0x1422, layer2: 0x05c6, collision: 0x001f });
        editBegin(); editStroke({ x: 1, y: 0 }, 'down'); editStroke({ x: 1, y: 1 }, 'move'); editStroke({ x: 1, y: 1 }, 'up'); editEnd();
        r.layer = Object.keys(editObjects()[0].layer || {}).sort().join(' ');
        r.drawnOpen = editObjectSvg(_mtPalette, _editComposed, _editOrigin).split('rg-obj-cell').length - 1;
        _editActiveTab = 'tile';
        r.drawnClosed = editObjectSvg(_mtPalette, _editComposed, _editOrigin).split('rg-obj-cell').length - 1;
        r.mapUntouched = Object.keys(d.cells).length === 0;
        // Undo the Frame 1 delta paint: object layer should clear but object stays.
        editUndo();
        r.undone = Object.keys(editObjects()[0] && editObjects()[0].layer || {}).length;
        // Undo the object-area stroke and the add-frame step: object should be removed.
        editUndo(); editUndo();
        r.gone = editObjects().length;
        // A stamped vanilla object brings its changed look.
        _editActiveTab = 'tile';
        const c = { name: 'gourd', w: 1, h: 1, cells: [{ dx: 0, dy: 0, canopy: { word: 0x1422 }, terrain: null, collision: 0x1f }],
            attachments: { bTrigger: [], stepOn: [], objects: [{ dx: 0, dy: 0, w: 1, h: 1, states: 1,
                cells: [{ dx: 0, dy: 0, canopy: { word: 0x1423 }, terrain: { word: 0x05c6 }, collision: 0x1f }] }] } };
        editStampGroup(_mtPalette, c, 0, 0);
        const so = editObjects()[0];
        // It shows state 0 (the map's own cells) until a state is picked.
        r.stamped = !!(so && so.uid && so.activeFrame === 0 && !Object.keys(so.layer).length
            && editStampWords(_mtPalette, so.frames[0]['0,0']).layer1 === 0x1423);

        // Object cluster, frames, automatic delta bounds and solid blue frame
        editRemoveObject(so.uid);
        d.cells = {}; d.placed = d.placed.filter((p) => p.kind !== 'object');
        _objectSel = null; _objectOpen = {}; _objectActiveFrame = 0;
        _editActiveTab = 'object';
        editBegin(); editStroke({ x: 0, y: 0 }, 'down'); editStroke({ x: 1, y: 1 }, 'up'); editEnd();
        let obj2 = editObjects()[0];
        r.objCluster = editObjectSvg(_mtPalette, _editComposed, _editOrigin).includes('rg-obj-cluster');

        // New object starts in State 0: its delta layer is empty.
        r.baseStateEmpty = Object.keys(obj2.layer).length === 0;

        // Add Frame 1 explicitly, then paint delta tiles at 0,0 and 1,0 (2x1 delta box)
        objectAddFrame(obj2.uid);
        obj2 = editObjects()[0];
        r.frame1Added = _objectActiveFrame === 1 && obj2.frames.length === 1;
        d.brush = editAddStamp(_mtPalette, { layer1: 0x1422, layer2: 0x05c6, collision: 0x001f });
        editBegin(); editStroke({ x: 0, y: 0 }, 'down'); editStroke({ x: 1, y: 0 }, 'move'); editStroke({ x: 1, y: 0 }, 'up'); editEnd();
        obj2 = editObjects()[0];
        r.frame1Layer = Object.keys(obj2.layer).sort().join(' ');
        const svgFrame = editObjectSvg(_mtPalette, _editComposed, _editOrigin);
        r.solidFrame = svgFrame.includes('rg-obj-frame');
        r.solidFrameW2H1 = svgFrame.includes('width="4"') && svgFrame.includes('height="2"');

        // Add Frame 2:
        objectAddFrame(obj2.uid);
        r.framesCount = obj2.frames.length;
        r.activeFrame2 = _objectActiveFrame === 2;
        editBegin(); editStroke({ x: 1, y: 1 }, 'down'); editStroke({ x: 1, y: 1 }, 'up'); editEnd();
        r.f2Layer = Object.keys(obj2.frames[1]).join();

        // Tab HTML contains ro-chips with State 0, Frame 1, Frame 2, and add-frame button
        const tabHtml = objectTabHtml();
        r.tabHasChips = tabHtml.includes('ro-chip') && tabHtml.includes('ro-chip-add');
        r.tabHasFrames = tabHtml.includes('Frame 1') && tabHtml.includes('Frame 2') && tabHtml.includes('State 0');

        // Frame isolation: State 0 shows the base room, Frame 2 keeps its own tile.
        objectSelectFrame(0);
        r.frame0LayerEmpty = Object.keys(obj2.layer).length === 0;
        r.frame0Cells = Object.keys(d.cells).length;
        objectSelectFrame(2);
        r.frame2Layer = Object.keys(obj2.layer).sort().join();
        r.frame2HasItsTile = r.frame2Layer.includes('1,1') && !Object.keys(obj2.frames[0]).includes('1,1');

        // Reorder Frame 2 to position 1 (move left):
        objectMoveFrame(obj2.uid, -1);
        r.reorderedActive = _objectActiveFrame === 1;
        r.reorderedF1Layer = Object.keys(obj2.frames[0]).sort().join();

        // Remove frame:
        objectRemoveFrame(obj2.uid, 1);
        r.framesAfterRemove = obj2.frames.length;

        _editComposed = composed;
        return r;
    });
    check('a family picked but never painted leaves its slot to the next one (slot 1 is used first)',
        v80.first === 0 && v80.second === 0, JSON.stringify(v80));
    check('the bottom bar has Triggers with B and step-on apart, on a custom map too', v80.triggers, JSON.stringify(v80));
    check('with Cuttable off the map shows the tile beneath; on, the cuttable one', v80.cutOff && v80.cutOn, JSON.stringify(v80));
    check('there is an Object tab, after Trigger', /trigger,object,widgets/.test(v80.tabs), v80.tabs);
    check('on the Object tab the pencil drags out an area, selected', v80.area === '0,0,2,2' && v80.sel, JSON.stringify(v80));
    check('and draws its tiles over the map, not into it — previewed on tile tab as well',
        v80.layer === '1,0 1,1' && v80.drawnOpen === 2 && v80.drawnClosed === 2 && v80.mapUntouched, JSON.stringify(v80));
    // This test's first paint stroke now lands in State 0 and writes the base room,
    // not the object's delta layer; the Frame 1 delta-paint workflow is asserted below.
    check('each is one undo step', v80.undone === 0 && v80.gone === 0, JSON.stringify(v80));
    check('a stamped vanilla object brings the look it changes to', v80.stamped, JSON.stringify(v80));
    check('object cluster has dotted outline and active frame has solid blue frame with auto delta bounds',
        v80.objCluster && v80.solidFrame && v80.solidFrameW2H1, JSON.stringify(v80));
    check('a new object starts in State 0 with an empty delta layer',
        v80.baseStateEmpty, JSON.stringify(v80));
    check('Frame 1 is created with + and receives the delta paint',
        v80.frame1Added && v80.frame1Layer === '0,0 1,0', JSON.stringify(v80));
    check('object expands to show state chips and frames can be added, reordered and removed',
        v80.framesCount === 2 && v80.activeFrame2 && v80.tabHasChips && v80.tabHasFrames
        && v80.reorderedActive && v80.reorderedF1Layer === '0,0,1,0,1,1' && v80.framesAfterRemove === 1, JSON.stringify(v80));
    check('State 0 shows the base room and does not hold object delta tiles',
        v80.frame0LayerEmpty, JSON.stringify(v80));
    check('Frame 2 clones frame 1 on +, adds its own tile, and does not pollute frame 1',
        v80.frame2HasItsTile, JSON.stringify(v80));

    // ── real pointer gestures, the way the panel actually drives them ──────
    // The checks above call the gesture functions directly; this block drives
    // the same flow through #rg-wrap's capture-phase mousedown/mousemove/
    // mouseup handlers and real clicks on the Object tab chips, so the
    // editBegin/editEnd wrapping the real UI adds is exercised too.
    const gest = await page.evaluate(() => {
        const r = {};
        // Draft stamps draw from the host's composed sheet; this page has no host.
        const composed = _editComposed;
        _editComposed = { imageUri: 'data:image/png;base64,eA==', count: 256, columns: 16, cell: 16, imageWidth: 256, imageHeight: 256 };
        const d = editReset(0x34); d.on = true; d.tool = 'paint';
        _editActiveTab = 'object';
        _objectSel = null; _objectOpen = {}; _objectActiveFrame = 0;
        _mtPalette.grid = [[null, null], [null, null]];
        renderEditChrome();
        const svg = document.getElementById('rg-svg');
        const wrap = document.getElementById('rg-wrap');
        if (!svg || !svg.getScreenCTM || !wrap) { r.skip = 'no svg/wrap'; return r; }
        const ctm = svg.getScreenCTM();
        if (!ctm) { r.skip = 'no ctm'; return r; }
        const mouse = (type, tx, ty) => {
            const pt = svg.createSVGPoint();
            pt.x = _editOrigin.x + (tx + 0.5) * EDIT_UNITS;
            pt.y = _editOrigin.y + (ty + 0.5) * EDIT_UNITS;
            const s = pt.matrixTransform(ctm);
            wrap.dispatchEvent(new MouseEvent(type, { clientX: s.x, clientY: s.y, button: 0, bubbles: true }));
        };
        // 1. Drag out an object with real mouse events.
        mouse('mousedown', 0, 0); mouse('mousemove', 1, 1); mouse('mouseup', 1, 1);
        const o = editObjects()[0];
        r.created = !!o && o.w === 2 && o.h === 2;
        r.framesAtBirth = o && o.frames.length;
        r.activeAtBirth = _objectActiveFrame;
        r.chipsAtBirth = document.querySelectorAll('#rg-panels .ro-chip:not(.ro-chip-add)').length;
        // 2. Painting in State 0 with real events is refused, not leaked anywhere.
        d.brush = editAddStamp(_mtPalette, { layer1: 0x1422, layer2: 0x05c6, collision: 0x001f });
        mouse('mousedown', 0, 0); mouse('mouseup', 0, 0);
        r.state0LayerStillEmpty = Object.keys(o.layer).length === 0;
        r.state0CellsUntouched = Object.keys(d.cells).length === 0;
        // 3. A real click on + creates Frame 1.
        const addBtn = document.querySelector('[data-object-add-frame]');
        r.addBtnFound = !!addBtn;
        if (addBtn) addBtn.click();
        r.frameAfterPlus = o.frames.length;
        r.activeAfterPlus = _objectActiveFrame;
        // 4. A real paint drag lands only in Frame 1.
        mouse('mousedown', 0, 0); mouse('mousemove', 1, 0); mouse('mouseup', 1, 0);
        r.frame1Keys = Object.keys(o.frames[0] || {}).sort().join(' ');
        r.cellsStillUntouched = Object.keys(d.cells).length === 0;
        // 5. Real chip clicks toggle the preview: State 0 hides the delta, Frame 1 shows it.
        // Chips are re-queried after every click: each click re-renders the tab
        // body, so a chip captured before the click is detached and dead.
        const chip0 = document.querySelector('[data-object-frame="0"]');
        r.chipsFound = !!chip0 && !!document.querySelector('[data-object-frame="1"]');
        if (chip0) chip0.click();
        r.state0Layer = Object.keys(o.layer).length;
        r.state0Drawn = editObjectSvg(_mtPalette, _editComposed, _editOrigin).split('rg-obj-cell').length - 1;
        const chip1 = document.querySelector('[data-object-frame="1"]');
        r.chip1Requery = !!chip1 && !!chip1.isConnected;
        if (chip1) chip1.click();
        r.frame1Layer = Object.keys(o.layer).sort().join(' ');
        r.frame1Drawn = editObjectSvg(_mtPalette, _editComposed, _editOrigin).split('rg-obj-cell').length - 1;

        // 6. Old saved shapes collapse: an object saved with the pre-0.82.2
        //    implicit empty Frame 1 restores as State-0-only, and a State-0-only
        //    object stamped from a widget gets no phantom Frame 1.
        d.placed.push({ kind: 'object', uid: 991, x: 0, y: 0, w: 1, h: 1, states: 1, frames: [{}], layer: {} });
        customRestore(d, { placed: d.placed });
        const migrated = editObjects().filter((p) => p.uid === 991)[0];
        r.migratedFrames = migrated && migrated.frames.length;
        r.migratedStates = migrated && migrated.states;
        editStampGroup(_mtPalette, { name: 'bare', w: 1, h: 1,
            cells: [{ dx: 0, dy: 0, canopy: { word: 0x1422 }, terrain: null, collision: 0x1f }],
            attachments: { bTrigger: [], stepOn: [], objects: [{ dx: 0, dy: 0, w: 1, h: 1, states: 1, frames: [] }] } }, 0, 0);
        const stampedObj = editObjects()[editObjects().length - 1];
        r.stampedFrames = stampedObj && stampedObj.frames.length;
        r.stampedStates = stampedObj && stampedObj.states;
        _editComposed = composed;
        return r;
    });
    if (gest.skip) {
        console.log('  (real-pointer object gesture checks skipped: ' + gest.skip + ')');
    } else {
        check('a real mouse drag creates one object with only State 0',
            gest.created && gest.framesAtBirth === 0 && gest.activeAtBirth === 0 && gest.chipsAtBirth === 1,
            JSON.stringify(gest));
        check('painting in State 0 is refused and leaks nowhere', 
            gest.state0LayerStillEmpty && gest.state0CellsUntouched, JSON.stringify(gest));
        check('a real click on + creates Frame 1 and selects it',
            gest.addBtnFound && gest.frameAfterPlus === 1 && gest.activeAfterPlus === 1, JSON.stringify(gest));
        check('a real paint drag lands only in Frame 1, never in the base room',
            gest.frame1Keys === '0,0 1,0' && gest.cellsStillUntouched, JSON.stringify(gest));
        check('real chip clicks toggle between State 0 (base) and Frame 1 (delta)',
            gest.chipsFound && gest.state0Layer === 0 && gest.state0Drawn === 0
            && gest.frame1Layer === '0,0 1,0' && gest.frame1Drawn === 2, JSON.stringify(gest));
        check('an object saved with an empty implicit Frame 1 restores as State 0 only',
            gest.migratedFrames === 0 && gest.migratedStates === 1, JSON.stringify(gest));
        check('a State-0-only widget object stamps with no phantom Frame 1',
            gest.stampedFrames === 0 && gest.stampedStates === 1, JSON.stringify(gest));
    }

    // 7. The reported flow, end to end with real mouse events: floor painted
    //    on the Tile tab first, then object, +Frame 1, grass — and the State 0
    //    thumbnail must show the floor, not the grass. The thumbnail is
    //    `<use href="#rg-img"/><use href="#rg-edit-tiles"/>`, so the only way
    //    grass appears in it is grass living in `d.cells`.
    const flow = await page.evaluate(() => {
            const r = {};
            const composed = _editComposed;
            _editComposed = { imageUri: 'data:image/png;base64,eA==', count: 256, columns: 16, cell: 16, imageWidth: 256, imageHeight: 256 };
            const d = editReset(0x34); d.on = true; d.tool = 'paint';
            _editActiveTab = 'tile';
            _objectSel = null; _objectOpen = {}; _objectActiveFrame = 0;
            _mtPalette.grid = [[null, null, null, null], [null, null, null, null], [null, null, null, null], [null, null, null, null]];
            _mtPalette.widthTiles = 4; _mtPalette.heightTiles = 4;
            renderEditChrome();
            const svg = document.getElementById('rg-svg');
            const wrap = document.getElementById('rg-wrap');
            const ctm = svg && svg.getScreenCTM();
            if (!svg || !wrap || !ctm) { r.skip = 'no svg'; return r; }
            const mouse = (type, tx, ty) => {
                const pt = svg.createSVGPoint();
                pt.x = _editOrigin.x + (tx + 0.5) * EDIT_UNITS;
                pt.y = _editOrigin.y + (ty + 0.5) * EDIT_UNITS;
                const s = pt.matrixTransform(ctm);
                wrap.dispatchEvent(new MouseEvent(type, { clientX: s.x, clientY: s.y, button: 0, bubbles: true }));
            };
            const strokeCells = (cells) => {
                cells.forEach(([x, y], i) => {
                    if (i === 0) mouse('mousedown', x, y);
                    else mouse('mousemove', x, y);
                });
                const last = cells[cells.length - 1];
                mouse('mouseup', last[0], last[1]);
            };
            const fill = (x1, y1, x2, y2) => {
                const cells = [];
                for (let y = y1; y <= y2; y++) for (let x = x1; x <= x2; x++) cells.push([x, y]);
                return cells;
            };
            // 1. A real new map starts with empty d.cells and brown tiles in #rg-img.
            r.startCells = Object.keys(d.cells).length;
            // 2. Object tab: drag a 2×2 area, add Frame 1.
            _editActiveTab = 'object'; d.tool = 'paint'; renderEditChrome();
            mouse('mousedown', 1, 1); mouse('mousemove', 2, 2); mouse('mouseup', 2, 2);
            const o = editObjects()[0];
            r.created = !!o && o.w === 2 && o.h === 2;
            r.framesAtBirth = o && o.frames.length;
            document.querySelector('[data-object-add-frame]').click();
            r.activeAfterPlus = _objectActiveFrame;
            // 3. User goes to Tile tab to pick grass tile:
            const grass = editAddStamp(_mtPalette, { layer1: 0x1422, layer2: 0x05c6, collision: 0x001f });
            _editActiveTab = 'tile';
            d.brush = grass;
            renderEditChrome();

            // What if user paints grass directly on the 2x2 area now (without switching to Object tab)?
            // Or what if user switches back to Object tab? Let's check both or check what happens!
            r.tabBeforePaint = _editActiveTab;
            // What if user does NOT switch back to Object tab before painting?
            // const objTabBtn = document.querySelector('[data-edit-active-tab="object"]');
            // if (objTabBtn) objTabBtn.click();
            r.tabAfterSwitch = _editActiveTab;
            // Paint grass on 1,1 to 2,2:
            strokeCells(fill(1, 1, 2, 2));
            r.frame1Keys = Object.keys(o.frames[0] || {}).sort().join(' ');
            r.cellsAfterGrass = Object.keys(d.cells).length;

            // Now switch to Object tab to see what happened:
            const objTabBtn = document.querySelector('[data-edit-active-tab="object"]');
            if (objTabBtn) objTabBtn.click();

            // Check State 0 thumbnail in DOM:
            const thumb0El = document.querySelector('[data-object-frame="0"]');
            r.thumb0Html = thumb0El ? thumb0El.innerHTML : '';
            const thumb1El = document.querySelector('[data-object-frame="1"]');
            r.thumb1Html = thumb1El ? thumb1El.innerHTML : '';

            // Click State 0 chip:
            if (thumb0El) thumb0El.click();
            r.activeAfterClick0 = _objectActiveFrame;
            r.svgAfterClick0 = document.getElementById('rg-edit-overlay').innerHTML;

            // Click Frame 1 chip:
            const thumb1Requery = document.querySelector('[data-object-frame="1"]');
            if (thumb1Requery) thumb1Requery.click();
            r.activeAfterClick1 = _objectActiveFrame;
            r.svgAfterClick1 = document.getElementById('rg-edit-overlay').innerHTML;

            // Test 1: Showing grass on tile tab when Frame 1 is active
            _objectActiveFrame = 1;
            _editActiveTab = 'tile';
            renderEditLayer(_mtPalette, _editComposed, _editOrigin);
            r.svgOnTileTabWithFrame1 = document.getElementById('rg-edit-overlay').innerHTML;

            // Picking tile does not jump to object tab
            editOnStampPicked(1);
            r.tabAfterStampPick = _editActiveTab;

            // Test 2: Drawing special F0 in Frame 1 does not apply to State 0
            _objectActiveFrame = 1;
            _editActiveTab = 'special';
            d.currentSpecialId = 'interact-force-0';
            editSpecialStroke(d, { x: 1, y: 1 }, false, 'up');
            r.hasSpecialF0InFrame1 = (editSpecialsAt(1, 1) || []).includes('interact-force-0');

            // Switch to State 0: does not have F0
            _objectActiveFrame = 0;
            r.hasSpecialF0InState0 = (editSpecialsAt(1, 1) || []).includes('interact-force-0');

            // Test 3: Pressing '+' copies the currently selected frame, not State 0
            _objectActiveFrame = 1;
            objectAddFrame(o.uid);
            r.frame2TileCount = Object.keys(o.frames[1] || {}).length;
            r.frame1TileCount = Object.keys(o.frames[0] || {}).length;

            // Test 4: Objects overlay off hides blue boxes
            const panel = document.getElementById('room-detail') || document.getElementById('rg-outer');
            panel.classList.add('hide-obj');
            r.objectsVisibleWhenHidden = editObjectsVisible();
            panel.classList.remove('hide-obj');

            _editComposed = composed;
            return r;
        });
    if (flow.skip) {
        console.log('  (floor-then-object flow skipped: ' + flow.skip + ')');
    } else {
        check('drawing grass on an object with active Frame 1 writes only to object frame, never base cells',
            flow.startCells === 0 && flow.cellsAfterGrass === 0 && flow.frame1Keys === '0,0 0,1 1,0 1,1',
            JSON.stringify(flow));
        check('State 0 preview thumbnail shows base dirt while Frame 1 preview shows grass delta',
            flow.thumb0Html.includes('<use href="#rg-img"') && !flow.thumb0Html.includes('rg-edit-cell')
            && flow.thumb1Html.includes('rg-edit-cell'),
            JSON.stringify(flow));
        check('clicking State 0 chip shows dirt on map; clicking Frame 1 chip shows grass delta on map',
            flow.activeAfterClick0 === 0 && !flow.svgAfterClick0.includes('rg-obj-cell')
            && flow.activeAfterClick1 === 1 && flow.svgAfterClick1.includes('rg-obj-cell'),
            JSON.stringify(flow));
        check('selecting 1 and going to Tile tab still shows grass delta',
            flow.svgOnTileTabWithFrame1.includes('rg-obj-cell'), JSON.stringify(flow));
        check('picking a stamp on the tile tab does not switch tab to object',
            flow.tabAfterStampPick === 'tile', JSON.stringify(flow));
        check('drawing special F0 into Frame 1 does not apply to State 0',
            flow.hasSpecialF0InFrame1 === true && flow.hasSpecialF0InState0 === false, JSON.stringify(flow));
        check('pressing + copies the currently selected frame, not empty State 0',
            flow.frame2TileCount === flow.frame1TileCount && flow.frame2TileCount > 0, JSON.stringify(flow));
        check('editObjectsVisible returns false when hide-obj class is present',
            flow.objectsVisibleWhenHidden === false, JSON.stringify(flow));
    }

    check('no uncaught errors in any of it', pageErrors.length === 0, pageErrors.join('; '));

    await browser.close();
    console.log(`\n  ${passed} passed, ${failed} failed`);
    if (failed) process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });
