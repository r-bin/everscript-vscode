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
    'map-editor-constructs.js', 'map-editor-families.js', 'map-editor-panels.js', 'map-editor-input.js',
    'map-editor-actions.js', 'map-editor-newroom.js'];

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

    await page.setContent(`<!doctype html><html><body><div id="room-detail">
        <div class="rg-outer rs-map" id="rg-outer"><div id="rg-wrap">
        <svg id="rg-svg" viewBox="0 0 4 4"><image id="rg-img"/></svg></div></div>
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
    }));
    check('a 2x2 room keeps the 8-unit minimum viewBox and a 4-unit image',
        tiny.viewBox === '0 0 8 8' && tiny.imgW === '4', JSON.stringify(tiny));

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

    // ── tiles in their own family ──────────────────────────────────────────
    await page.evaluate(() => applyFamilySheet({
        sheet: {
            family: 58, count: 2, total: 74, roomCount: 3, columns: 16, cell: 16,
            slots: [[0, 0, 4191, 10], [1, 2, 4195, 5]], imageUri: 'data:image/png;base64,ZmFt',
        },
    }));
    await page.click('[data-tile-source="families"]');
    const strip = await page.evaluate(() => document.getElementById('rg-panels').innerHTML);
    check('a family’s tiles are drawn in that family, not the room’s palette',
        strip.includes('base64,ZmFt') && strip.includes('data-fam-of="58"'));

    check('no uncaught errors in any of it', pageErrors.length === 0, pageErrors.join('; '));

    await browser.close();
    console.log(`\n  ${passed} passed, ${failed} failed`);
    if (failed) process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });
