// TODO port to TS (docs/todo/port-to-ts.md)
'use strict';
// The Rooms tab's variant bar (the side bar at the map's right edge), driven in a real browser against the real page and the real ROM.
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
    const { buildVanillaRoomContent, roomVariantsFor, buildRoomMetatilePalette, buildRoomTileOverlay } = require(path.join(DIST, 'games', 'evermore', 'rooms'));
    const { mergedEnterScript } = require(path.join(DIST, 'games', 'evermore', 'script-model'));
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
            check('  with a spinner on the bar, not a lone button', await page.$$eval('#rv-bar .rg-side-spin', (e) => e.length) === 1
                && await page.$$eval('#rv-bar button', (e) => e.length) === 0);
            // The editor's tile palette, as the host answers it: it brings the room's objects into the draft.
            const asks = await page.evaluate(() => window.__posted.filter((m) => m.command === 'requestRoomMetatiles'));
            // And the room picture, so a screenshot shows the map under the objects.
            const tiles = await page.evaluate(() => window.__posted.filter((m) => m.command === 'requestRoomTiles'));
            for (const m of tiles.filter((x) => x.roomId === id).slice(-1)) {
                const overlay = buildRoomTileOverlay(rom, id, Number(m.originX) || 0, Number(m.originY) || 0, m.layer, m.overlay, m.objectStates, false, m.header);
                await page.evaluate((msg) => window.postMessage(msg, '*'), { command: 'roomTiles', mapName: m.mapName, roomId: id, overlay: { ...overlay, roomId: id } });
            }
            for (const m of asks.filter((x) => x.roomId === id).slice(-1)) {
                const palette = { ...buildRoomMetatilePalette(rom, id, m.layer, m.bgPalette, m.header), roomId: id };
                await page.evaluate((msg) => window.postMessage(msg, '*'), { command: 'roomMetatiles', mapName: m.mapName, roomId: id, palette });
            }
            const variants = await roomVariantsFor(rom, id);
            await page.evaluate((msg) => window.postMessage(msg, '*'), { command: 'roomEnterScript', roomId: id, merged: mergedEnterScript(rom, id) });
            await page.evaluate((msg) => window.postMessage(msg, '*'), { command: 'roomVariants', roomId: id, variants });
            await page.waitForFunction(() => document.querySelectorAll('#rv-bar button[data-variant]').length > 1, null, { timeout: 5000 });
            return variants;
        };
        const chips = () => page.$$eval('#rv-bar button[data-variant]', (els) => els.map((e) => e.textContent.trim()));
        const tips = () => page.$$eval('#rv-bar button[data-variant]', (els) => els.map((e) => e.dataset.tip));
        const pick = (i) => page.click(`#rv-bar button[data-variant="${i}"]`);
        const headName = () => page.$eval('#rv-name', (e) => e.textContent);
        const shoot = async (name) => { if (shots) await page.screenshot({ path: path.join(shots, name + '.png') }); };

        // ── the jungle where the game starts ──────────────────────────────
        const jungle = await open(0x38);
        const place = await page.evaluate(() => {
            const bar = document.getElementById('rv-bar').getBoundingClientRect();
            const card = document.getElementById('rg-canvas-card').getBoundingClientRect();
            return { display: getComputedStyle(document.getElementById('rv-bar')).display, right: card.right - bar.right, mid: bar.left - (card.left + card.width / 2) };
        });
        check('the bar is visible at the map\'s right edge', place.display === 'flex' && place.right >= 0 && place.right < 40 && place.mid > 0, JSON.stringify(place));
        const names = await chips();
        const tipText = await tips();
        check('it lists the default with its enemies and the outro by number, no "All"', names.join() === '1,2'
            && /^Default\ndefault — Mosquito, Wimpy Flower/.test(tipText[0]) && /^INSIDE_OUTRO=True\nInside outro\?/.test(tipText[1]), JSON.stringify([names, tipText]));
        check('the default is chosen when the answer arrives',
            await page.$eval('#rv-bar button.on', (e) => e.dataset.variant) === '0');
        check('  and its name is in the header', /^1 · Default$/.test(await headName()), await headName());
        check('and every one of its 21 spawns is on the map', (await shownSprites(page)).length === jungle[0].spawns.length
            && jungle[0].spawns.length === 21);
        await shoot('jungle-default');
        await pick(1);
        check('the outro shows nobody', (await shownSprites(page)).length === 0);
        check('  and the header names it', /^2 · INSIDE_OUTRO=True$/.test(await headName()), await headName());
        await shoot('jungle-outro');
        await pick(0);
        check('the default brings its 21 back', (await shownSprites(page)).length === 21);

        // ── Thraxx's chamber ──────────────────────────────────────────────
        const thraxx = await open(0x18);
        check('Thraxx\'s chamber has its three states, named by what selects them',
            thraxx.map((v) => v.title).join(' | ') === 'Default | THRAXX_DEAD=True, WINDWALKER_UNLOCKED=True | THRAXX_DEAD=True', thraxx.map((v) => v.title).join(' | '));
        check('  the maggots come later, in the fight: on Thraxx, not a state of their own',
            thraxx[0].spawns.some((s) => s.name === 'Maggot' && s.later) && !thraxx.slice(1).some((v) => v.spawns.some((s) => s.name === 'Maggot')));
        const hex = (v) => v.toString(16);
        // What stands there on entry; the maggots come later and are not a sprite the map draws.
        const def = { ...thraxx[0], spawns: thraxx[0].spawns.filter((s) => !s.later) };
        check('the default is Thraxx alive', /^default — .*Thraxx's heart/.test(def.name), def.name);
        const shown = await shownSprites(page);
        check('  and the map shows exactly its spawns', shown.length === def.spawns.length
            && def.spawns.every((s) => shown.includes(hex(s.at))), JSON.stringify(shown));
        await shoot('thraxx-default');
        const objectCells = () => page.$$eval('#rg-svg .rg-obj-cell', (els) => els.length);
        check('  the room as Thraxx: every object at state 0', await objectCells() === 0, String(await objectCells()));
        await pick(2);
        check('  Empty: the objects the script sets put the chamber without Thraxx on the map', await objectCells() > 0
            && JSON.stringify(thraxx[2].objects) === '[[0,2],[1,2],[2,1],[3,1]]', String(await objectCells()));
        await shoot('thraxx-empty');
        await pick(0);
        check('  back to Thraxx: the objects go back to state 0', await objectCells() === 0);
        const cole = thraxx.findIndex((v) => v.only.includes("Coleoptera's heart"));
        check('Coleoptera is a variant of its own', cole > 0, thraxx.map((v) => v.name).join(' | '));
        if (cole > 0) {
            await pick(cole);
            const now = await shownSprites(page);
            check('  and choosing it swaps Thraxx for Coleoptera on the map',
                now.length === thraxx[cole].spawns.length && thraxx[cole].spawns.every((s) => now.includes(hex(s.at)))
                && !def.spawns.some((s) => /heart/.test(s.name) && now.includes(hex(s.at))), JSON.stringify(now));
            await shoot('thraxx-coleoptera');
            // Coleoptera's script sets MAP_PALETTE = 7: the map is asked for in that palette set.
            const lastHeader = () => page.evaluate(() => {
                const asks = window.__posted.filter((m) => m.command === 'requestRoomTiles' || m.command === 'requestRoomMetatiles');
                const last = asks[asks.length - 1];
                return last && last.header ? last.header.mapPalette || 0 : 0;
            });
            check('  and shows the room in palette set 7, as its script sets it', thraxx[cole].palette === 7 && await lastHeader() === 7,
                thraxx[cole].palette + ' / ' + await lastHeader());
            await pick(0);
            check('  back to Thraxx: the set the room loads with', await lastHeader() === 0);
            await pick(cole);
        }

        // ── the Enter tab: the merged script, greyed per variant ─────────
        await pick(0);
        await page.evaluate(() => document.querySelector('[data-edit-active-tab="trigger"]').click());
        await page.evaluate(() => document.querySelector('[data-trigger-enter]').click());
        const lineClass = (addr) => page.$eval(`.rg-enter-body [data-script-addr="${addr}"]`, (e) => e.className).catch(() => null);
        // $93D2A0 places Thraxx's heart, $93D2FD Coleoptera's, $93D247 starts the layout after Thraxx.
        check('the Enter tab lists the merged script', await page.$$eval('.rg-script-merged .rg-script-line', (els) => els.length) > 100);
        check('  coloured, and indented by its ifs', await page.$$eval('.rg-script-merged .sx-kw', (els) => els.length) > 10
            && await page.$eval('.rg-enter-body [data-script-addr="93D2A0"]', (e) => parseInt(e.style.marginLeft, 10)) > 0);
        check('  Thraxx: his heart is live, Coleoptera\'s and the empty room\'s lines are greyed',
            !/rg-script-(off|dead)/.test(await lineClass('93D2A0')) && /rg-script-off/.test(await lineClass('93D2FD'))
            && /rg-script-off/.test(await lineClass('93D247')), [await lineClass('93D2A0'), await lineClass('93D2FD'), await lineClass('93D247')].join(' | '));
        await shoot('thraxx-enter');
        // A goto's target is a link: $93:D235 `if! (DEBUG) goto $93:d23b;` (an empty if) jumps to the line at $93:D23B.
        await page.evaluate(() => document.querySelector('.rg-enter-body [data-script-addr="93D235"] [data-goto="93D23B"]').click());
        check('  a goto target jumps to its line', await page.$eval('.rg-enter-body [data-script-addr="93D23B"]', (e) => e.classList.contains('sx-flash')));
        check('  and the script reads as structured code', await page.$eval('.rg-enter-body [data-script-addr="93D23B"]', (e) => e.textContent.trim())
            === 'if (THRAXX_DEAD && !WINDWALKER_UNLOCKED) {', await page.$eval('.rg-enter-body [data-script-addr="93D23B"]', (e) => e.textContent.trim()));
        await page.evaluate(() => document.querySelector('[data-enter-structured]').click());
        check('  Structured off: the instruction as printed, flat', (await page.$eval('.rg-enter-body [data-script-addr="93D23B"]', (e) => e.textContent.trim())).startsWith('if! (')
            && await page.$eval('.rg-enter-body [data-script-addr="93D2A0"]', (e) => parseInt(e.style.marginLeft, 10)) === 0);
        await shoot('thraxx-enter-flat');
        await page.evaluate(() => document.querySelector('[data-enter-structured]').click());
        await pick(cole);
        check('  choosing Coleoptera swaps which lines are greyed',
            /rg-script-off/.test(await lineClass('93D2A0')) && !/rg-script-(off|dead)/.test(await lineClass('93D2FD')),
            [await lineClass('93D2A0'), await lineClass('93D2FD')].join(' | '));
        const folds = () => page.$$eval('.rg-script-merged .rg-script-line', (els) => els.length);
        const before = await folds();
        const shut = await page.$('.rg-script-fold[aria-expanded="false"]');
        check('  a shared helper starts folded', !!shut);
        if (shut) {
            await shut.click();
            check('  and opening it shows its lines', (await folds()) > before, before + ' → ' + await folds());
        }
        check('the page threw nothing', errors.length === 0, errors.join('\n'));
    } finally {
        await browser.close();
    }
    console.log(`\n${passed} passed, ${failed} failed`);
    if (failed) process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });
