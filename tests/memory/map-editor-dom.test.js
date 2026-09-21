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
const FILES = ['metatile-palette.js', 'map-editor.js', 'map-editor-paint.js', 'map-editor-ui.js',
    'map-editor-phases.js', 'map-editor-constructs.js', 'map-editor-families.js', 'map-editor-deco.js',
    'map-editor-panels.js', 'map-editor-gestures.js', 'map-editor-input.js', 'map-editor-actions.js', 'map-editor-newroom.js'];

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
        path.join(__dirname, '..', '..', 'src', 'shared', 'shared.css'), 'utf8');
    // The real stylesheet: without it every swatch is 0x0, so nothing is
    // clickable and no size assertion means anything.
    await page.setContent(`<!doctype html><html><head><style>${CSS}</style></head>
        <body style="display:block;height:auto;overflow:auto"><div id="room-detail">
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

    await page.click('[data-fam-add="0"]');
    await page.evaluate(() => applyFamilyCatalogue({ families: [
        { id: 32, tiles: 210, rooms: 13, areas: ['Antiqua', 'Prehistoria'], names: ["Fire Eyes' Village"] },
        { id: 220, tiles: 201, rooms: 13, areas: ['Omnitopia'], names: ['Reactor room'] },
        { id: 58, tiles: 74, rooms: 3, areas: ['Prehistoria'], names: ["Strong Heart's Hut"] },
        { id: 5, tiles: 9, rooms: 1, areas: ['Gothica'], names: ['Ebon Keep'] },
    ] }));

    // What makes a family choosable: its art and where the game uses it.
    const firstRow = await page.$eval('.rg-fam-row', (n) => n.textContent);
    check('a family row names its act, not just its id',
        /Antiqua|Prehistoria/.test(firstRow) && /32/.test(firstRow), firstRow);
    check('and the room it comes from', /Fire Eyes/.test(firstRow), firstRow);

    const asked = await page.evaluate(
        () => (window.__sent.find((m) => m.command === 'requestFamilyPreviews') || {}).families);
    check('art is requested for the whole visible page before anything is picked',
        Array.isArray(asked) && asked.length === 4 && asked[0] === 32, JSON.stringify(asked));

    await page.evaluate(() => applyFamilyPreviews({ previews: {
        families: [32, 220, 58, 5], columns: 8, cell: 16,
        imageUri: 'data:image/png;base64,cHJldg==', imageWidth: 128, imageHeight: 64 } }));
    const art = await page.$eval('.rg-fam-row .rg-fam-art', (n) => n.getAttribute('style') || '');
    check('each row shows that family\u2019s own strip', art.includes('base64,cHJldg=='), art);

    let shown = await page.$$eval('[data-fam-pick]', (n) => n.map((e) => e.dataset.famPick));
    await page.fill('#rg-fam-filter', 'omni');
    shown = await page.$$eval('.rg-fam-row', (n) => n.map((e) => e.dataset.famPick));
    check('filtering by act finds the family', shown.length === 1 && shown[0] === '220',
        'showed ' + JSON.stringify(shown));

    await page.fill('#rg-fam-filter', 'strong');
    shown = await page.$$eval('.rg-fam-row', (n) => n.map((e) => e.dataset.famPick));
    check('filtering by room name works too', shown.length === 1 && shown[0] === '58',
        'showed ' + JSON.stringify(shown));

    await page.fill('#rg-fam-filter', '>200');
    shown = await page.$$eval('.rg-fam-row', (n) => n.map((e) => e.dataset.famPick));
    check('">200" keeps only the big families',
        shown.includes('32') && shown.includes('220') && !shown.includes('58'),
        'showed ' + JSON.stringify(shown));

    await page.fill('#rg-fam-filter', '58');
    shown = await page.$$eval('.rg-fam-row', (n) => n.map((e) => e.dataset.famPick));
    check('an id filter still narrows to that id',
        shown.length === 1 && shown[0] === '58', 'showed ' + JSON.stringify(shown));

    await page.fill('#rg-fam-filter', '');
    await page.click('.rg-fam-row[data-fam-pick="58"]');
    check('picking a family fills the slot', await page.evaluate(() => editFamilies()[0] === 58));

    await page.evaluate(() => { editFamilies()[3] = undefined; renderEditPanels(); });
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
        _famOpen = 2;
        _famSheets[58] = { family: 58, count: 2, total: 74, roomCount: 3, columns: 16, cell: 16,
            slots: [[0, 0, 4186, 9], [1, 2, 4191, 4]], imageUri: 'data:image/png;base64,ZmFt' };
        _panelOpen.tiles = false;
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

    // ── tiles in their own family ──────────────────────────────────────────
    await page.evaluate(() => applyFamilySheet({
        sheet: {
            family: 58, count: 2, total: 74, roomCount: 3, columns: 16, cell: 16,
            slots: [[0, 0, 4191, 10], [1, 2, 4195, 5]], imageUri: 'data:image/png;base64,ZmFt',
        },
    }));
    await page.evaluate(() => { _panelOpen.tiles = true; renderEditPanels(); });
    await page.click('[data-tile-source="families"]');
    const strip = await page.evaluate(() => document.getElementById('rg-panels').innerHTML);
    check('a family’s tiles are drawn in that family, not the room’s palette',
        strip.includes('base64,ZmFt') && strip.includes('data-fam-of="58"'));
    // "showing 16" hid two of eighteen for no reason. Everything the host
    // sent is shown; the only thing worth saying is that it capped at 128.
    const notes58 = await page.$$eval('#rg-panels .rs-note',
        (n) => n.map((e) => e.textContent).filter((t) => /^family 58/.test(t)));
    const stripNote = notes58[0] || '';
    const swatches58 = await page.$$eval('[data-fam-of="58"]', (n) => n.length);
    check('every tile the host sent is shown, with no arbitrary cut',
        notes58.length > 0 && swatches58 === 2 * notes58.length && !/showing/.test(stripNote),
        `${notes58.length} strip(s), ${swatches58} swatches — ${stripNote}`);
    check('and the cap the host did apply is named', /the 2 most-used shown/.test(stripNote), stripNote);

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
