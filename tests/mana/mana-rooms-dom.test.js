// TODO port to TS (docs/todo/port-to-ts.md)
'use strict';
// Converted Secret of Mana rooms in the Rooms tab's rail, on the real radar page in
// headless Chromium: their group sits under the vanilla rooms, a row asks the host for
// the room, the answer opens it like a ROM room (its id past the ROM rooms), and its
// families show their m<n> labels. Synthetic data, no ROM; skips without playwright.
// Run: node tests/mana/mana-rooms-dom.test.js

const path = require('path');
const { renderRadarHtml } = require(path.join(__dirname, '..', '..', 'src', 'games', 'evermore', 'memory', 'render-radar'));

let passed = 0, failed = 0;
const check = (name, cond, detail) => {
    if (cond) { console.log('  ✓ ' + name); passed++; }
    else { console.error('  ✗ ' + name + (detail ? '\n    ' + detail : '')); failed++; }
};

const IMPORTED = [{ key: 'mana', label: 'Secret of Mana', title: 'converted',
    areas: [{ area: 'Potos Falls', rooms: [{ id: 'som-80', name: 'Potos Falls 1', tag: 'som 80' }] }] }];

const ROOM = {
    name: 'Potos Falls 1', vanillaId: 'som 80', romRoomId: 0x1080, imported: 'mana',
    relPath: 'Secret of Mana map 80, converted', startLine: -1, endLine: -1, imageUri: null, imageDims: null,
    familyPreviews: { families: [41500], columns: 2, cell: 16, imageUri: 'data:image/png;base64,AA==' },
    families: [{ id: 41500, label: 'm53', tiles: 0, rooms: 1, areas: ['Secret of Mana'], names: ['palette set 6, palette 6'] }],
    content: {
        initMap: { x1: 0, y1: 0, x2: 32, y2: 28 }, entrances: [], enemies: [], objects: [], transitions: [],
        triggerNames: { stepOn: ['Mana event 847'], bTrigger: [] },
        triggers: { enter: null, stepOn: [{ x1: 3, y1: 2, x2: 4, y2: 4, label: 'Mana event 847' }], bTrigger: [], meta: null },
        roomError: null, mapId: 0x1080, trigOffset: { offX: 0, offY: 0 },
        romHeader: { offX: 0, offY: 0, mapW: 16, mapH: 14, mapWpx: 256, mapHpx: 224 },
    },
};

/** The family labels, from the webview files themselves (their scope is one script on the page). */
function labelChecks() {
    const vm = require('vm'), fs = require('fs');
    const dir = path.join(__dirname, '..', '..', 'src', 'games', 'evermore', 'rooms', 'webview');
    const ctx = vm.createContext({ document: { getElementById: () => null }, escH: (x) => String(x), _famCatalogue: [{ id: 12, tiles: 3, areas: ['Fire Eyes'], names: [] }] });
    for (const f of ['rooms-imported.js', 'map-editor-chips.js']) vm.runInContext(fs.readFileSync(path.join(dir, f), 'utf8'), ctx, { filename: f });
    vm.runInContext('_importedWaiting = "som-80"; renderRoomDetail = function () {};', ctx);
    ctx.applyImportedRoom({ id: 'som-80', room: ROOM });
    check('a converted family is named by its label (m53), a ROM family by its id',
        ctx.familyName(41500) === 'm53' && ctx.familyName(12) === '12');
    const art = ctx.chipArtStyle(41500);
    check('a converted family\'s chip art is its room\'s own preview strip', /data:image\/png;base64,AA/.test(art), art);
    const title = ctx.chipTitle(41500, 0);
    check('the family card says "Family m53" and where it is from', /^Family m53/.test(title) && /Secret of Mana/.test(title), title);
}

async function main() {
    labelChecks();
    let chromium;
    try { ({ chromium } = require('playwright')); } catch { console.log('\nMana rooms DOM: playwright not installed — skipped'); return; }
    let browser;
    try { browser = await chromium.launch(); } catch { console.log('\nMana rooms DOM: no browser — skipped'); return; }
    console.log('\nSecret of Mana rooms in the Rooms tab:');
    const page = await browser.newPage({ viewport: { width: 1100, height: 700 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.addInitScript(() => {
        window.__sent = [];
        window.acquireVsCodeApi = () => ({ getState: () => null, setState: () => {}, postMessage: (m) => window.__sent.push(m) });
    });
    const html = renderRadarHtml({ kind: 'function', name: 'f', startLine: 0, endLine: 10 },
        new Map(), [], new Map(), new Map(), [], 'rooms', null,
        [], false, null, null, new Map(), {}, '', null, IMPORTED);
    const file = path.join(require('os').tmpdir(), 'mana-rooms-dom-' + process.pid + '.html');
    require('fs').writeFileSync(file, html);
    await page.goto('file://' + file);
    require('fs').unlinkSync(file);

    const order = await page.evaluate(() => [...document.querySelectorAll('.rm-grp')].map((g) => g.id));
    check('the Secret of Mana group sits right under the vanilla rooms',
        order.indexOf('rm-grp-mana') === order.indexOf('rm-grp-vanilla') + 1, order.join(','));

    await page.click('[data-rail-grp="mana"]');
    await page.click('li[data-import="som-80"]');
    const asked = await page.evaluate(() => window.__sent.filter((m) => m.command === 'requestImportedRoom'));
    check('opening a row asks the host for that room', asked.length === 1 && asked[0].id === 'som-80', JSON.stringify(asked));

    await page.evaluate((room) => window.postMessage({ command: 'importedRoom', id: 'som-80', room }, '*'), ROOM);
    await page.waitForTimeout(200);
    const shown = await page.evaluate(() => ({
        name: (document.querySelector('.rd-name') || {}).textContent,
        tiles: window.__sent.filter((m) => m.command === 'requestRoomTiles').map((m) => m.roomId),
        step: document.querySelectorAll('.svge-step').length,
    }));
    check('the answer opens the room by its converted id (0x1080)', shown.name === 'Potos Falls 1' && shown.tiles[0] === 0x1080, JSON.stringify(shown));
    check('its step-on events are drawn as step-on boxes', shown.step === 1, JSON.stringify(shown));
    await page.click('li[data-import="som-80"]');
    const again = await page.evaluate(() => window.__sent.filter((m) => m.command === 'requestImportedRoom').length);
    check('a room already received opens without asking again', again === 1, String(again));
    check('no page errors', !errors.length, errors.join('; '));
    await browser.close();
}

main().catch((e) => { console.error(e); failed++; }).finally(() => {
    console.log(`\n${passed} passed, ${failed} failed`);
    process.exit(failed ? 1 : 0);
});
