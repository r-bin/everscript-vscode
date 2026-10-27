// TODO port to TS (docs/todo/port-to-ts.md)
'use strict';
// The Rooms tab's variant bar, driven in a real browser against the real page and the real ROM.
//
// Two rooms the bar exists for: the jungle where the game starts (its enemies, or the outro with
// nobody), and Thraxx's chamber (Thraxx alive, or Coleoptera after he died). The page is
// renderRadarHtml's own; the answer to its `requestRoomVariants` is the host's own
// (rooms/data/room-variants.ts, the worker thread), handed back as the host would post it.
//
// Every visibility check reads computed `display` (webview-dom-safety).
// Skips without a browser or an Evermore ROM in the ROM library.
//   SHOT_DIR=<dir>  also saves a screenshot per state, to look at.

const fs = require('fs');
const path = require('path');

const DIST = path.join(__dirname, '..', '..', 'dist');
const ROM = require(path.join(DIST, 'games')).romPath('evermore');

let passed = 0;
let failed = 0;
const check = (name, cond, detail) => {
    if (cond) { console.log('  ✓ ' + name); passed += 1; }
    else { console.error('  ✗ ' + name + (detail ? '\n    ' + detail : '')); failed += 1; }
};

/** The `data-at` (hex) of every spawn sprite the map shows. */
const shownSprites = (page) => page.$$eval('#rg-svg image.svge-spawn[data-at]', (els) => els
    .filter((e) => getComputedStyle(e).display !== 'none').map((e) => e.getAttribute('data-at')));

async function main() {
    if (!ROM || !fs.existsSync(ROM)) { console.log('\nroom variants DOM: no Evermore ROM — skipped'); return; }
    let chromium;
    try { ({ chromium } = require('playwright')); }
    catch { console.log('\nroom variants DOM: playwright not installed — skipped'); return; }
    let browser;
    try { browser = await chromium.launch(); }
    catch (e) { console.log('\nroom variants DOM: no browser available — skipped (' + String(e.message).split('\n')[0] + ')'); return; }

    const rom = new Uint8Array(fs.readFileSync(ROM));
    const { renderRadarHtml } = require(path.join(DIST, 'games', 'evermore', 'memory', 'render-radar'));
    const { buildVanillaRoomContent, roomVariantsFor } = require(path.join(DIST, 'games', 'evermore', 'rooms'));
    const details = {};
    for (const id of ['0x38', '0x18']) {
        details[id] = { name: 'room ' + id, vanillaId: id, romRoomId: parseInt(id, 16), relPath: 'vanilla (rom)',
            startLine: -1, endLine: -1, content: buildVanillaRoomContent(path.join(__dirname, '..', '..'), id, ROM), imageUri: null, imageDims: null };
    }

    console.log('\nroom variants DOM:');
    const shots = process.env.SHOT_DIR;
    try {
        const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
        const errors = [];
        page.on('pageerror', (e) => errors.push(e.message));
        const stub = '<script>window.__posted=[];window.acquireVsCodeApi=function(){return{postMessage:function(m){window.__posted.push(m)},getState:function(){return null},setState:function(){}}};</script>';
        const html = renderRadarHtml({ kind: 'function', name: 'f', startLine: 0, endLine: 1 }, new Map(), [], new Map(), new Map(),
            [], 'rooms', null, [], false, null, null, new Map(), details);
        await page.setContent(html.replace('<head>', '<head>' + stub));

        /** Open a room, answer its request as the host does, and return the variants. */
        const open = async (id) => {
            // The rail row's own click (the page's code is closed in its own scope).
            await page.evaluate((vid) => document.querySelector(`li.vn-map[data-vid="${vid}"]`).click(), '0x' + id.toString(16));
            const asked = await page.evaluate((n) => window.__posted.some((m) => m.command === 'requestRoomVariants' && m.roomId === n), id);
            check(`room 0x${id.toString(16)} asks the host for its variants`, asked);
            const before = await shownSprites(page);
            check('  and shows every candidate spawn while it waits', before.length > 0, String(before.length));
            const variants = await roomVariantsFor(rom, id);
            await page.evaluate((msg) => window.postMessage(msg, '*'), { command: 'roomVariants', roomId: id, variants });
            await page.waitForFunction(() => document.querySelectorAll('#rv-bar .rv-chip').length > 1, null, { timeout: 5000 });
            return variants;
        };
        const chips = () => page.$$eval('#rv-bar .rv-chip', (els) => els.map((e) => e.textContent.trim()));
        const pick = (i) => page.click(`#rv-bar .rv-chip[data-variant="${i}"] .rv-count`);   // the inner span: target walk-up
        const shoot = async (name) => { if (shots) await page.screenshot({ path: path.join(shots, name + '.png') }); };

        // ── the jungle where the game starts ──────────────────────────────
        const jungle = await open(0x38);
        check('the bar is visible above the canvas', await page.$eval('#rv-bar', (e) => getComputedStyle(e).display) === 'flex');
        const names = await chips();
        check('it lists All, the default with its enemies, and the outro', names[0] === 'All'
            && /^default — Mosquito, Wimpy Flower/.test(names[1]) && /^Inside outro\?/.test(names[2]), JSON.stringify(names));
        check('the default is chosen when the answer arrives',
            await page.$eval('#rv-bar .rv-chip.on', (e) => e.dataset.variant) === '0');
        check('and every one of its 21 spawns is on the map', (await shownSprites(page)).length === jungle[0].spawns.length
            && jungle[0].spawns.length === 21);
        await shoot('jungle-default');
        await pick(1);
        check('the outro shows nobody', (await shownSprites(page)).length === 0);
        await shoot('jungle-outro');
        await page.click('#rv-bar .rv-chip[data-variant="-1"]');
        check('All brings every candidate back', (await shownSprites(page)).length === 21);

        // ── Thraxx's chamber ──────────────────────────────────────────────
        const thraxx = await open(0x18);
        const hex = (v) => v.toString(16);
        const def = thraxx[0];
        check('the default is Thraxx alive', /^default — .*Thraxx's heart/.test(def.name), def.name);
        const shown = await shownSprites(page);
        check('  and the map shows exactly its spawns', shown.length === def.spawns.length
            && def.spawns.every((s) => shown.includes(hex(s.at))), JSON.stringify(shown));
        await shoot('thraxx-default');
        const cole = thraxx.findIndex((v) => v.only.includes("Coleoptera's heart"));
        check('Coleoptera is a variant of its own', cole > 0, thraxx.map((v) => v.name).join(' | '));
        if (cole > 0) {
            await pick(cole);
            const now = await shownSprites(page);
            check('  and choosing it swaps Thraxx for Coleoptera on the map',
                now.length === thraxx[cole].spawns.length && thraxx[cole].spawns.every((s) => now.includes(hex(s.at)))
                && !def.spawns.some((s) => /heart/.test(s.name) && now.includes(hex(s.at))), JSON.stringify(now));
            await shoot('thraxx-coleoptera');
        }
        check('the page threw nothing', errors.length === 0, errors.join('\n'));
    } finally {
        await browser.close();
    }
    console.log(`\n${passed} passed, ${failed} failed`);
    if (failed) process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });
