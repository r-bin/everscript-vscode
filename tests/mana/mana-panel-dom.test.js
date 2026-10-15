'use strict';
// The Secret of Mana Maps page in headless Chromium: the real page (src/mana-maps/page.js), built from the shared
// editor shell, with a synthetic map and a stub host answering som:// reads. Checks the page is the shell the Evermore
// Rooms tab runs on (frame, rail, canvas card, pill, filter bar, status bar, dock) and the view features.
// No ROM needed; skips without playwright. Run: node tests/mana/mana-panel-dom.test.js

const fs = require('fs');
const { writePage, url } = require('./panel-page');
const { INIT, hostFile, somDir } = require('./synthetic-map');

let passed = 0, failed = 0;
const check = (name, cond, detail) => {
    if (cond) { console.log('  ✓ ' + name); passed++; }
    else { console.error('  ✗ ' + name + (detail ? '\n    ' + detail : '')); failed++; }
};

async function main() {
    let chromium;
    try { ({ chromium } = require('playwright')); } catch { console.log('\nMana maps page: playwright not installed — skipped'); return; }
    let browser;
    try { browser = await chromium.launch({ args: ['--allow-file-access-from-files'] }); } catch (e) { console.log('\nMana maps page: no browser — skipped'); return; }
    console.log('\nSecret of Mana Maps page (the shared editor shell):');
    const dir = somDir();
    const { dir: tmp, page } = writePage(INIT, url(dir) + '/');

    const p = await browser.newPage({ viewport: { width: 1500, height: 800 } });
    const errors = [];
    p.on('pageerror', e => errors.push(e.message));
    await p.exposeFunction('hostRead', f => hostFile(f));
    await p.addInitScript(() => {
        let st = {};
        window.acquireVsCodeApi = () => ({
            getState: () => st, setState: s => { st = s; },
            postMessage: async m => { if (m.command === 'read') window.postMessage({ command: 'file', path: m.path, text: await window.hostRead(m.path) }, '*'); },
        });
    });
    await p.goto(url(page));
    await p.waitForTimeout(300);

    // The frame is the Evermore Rooms tab's: rail | splitter | detail.
    const frame = await p.evaluate(() => ({
        panels: !!document.querySelector('.rm-panels > .rm-rail + .rm-split[data-split="rail"] + .rm-right > #room-detail'),
        railDisplay: getComputedStyle(document.querySelector('.rm-rail')).display,
        groups: [...document.querySelectorAll('.rm-grp-h')].map(h => h.textContent.trim()),
        rows: [...document.querySelectorAll('li.rn-map')].map(li => li.textContent.trim()),
        areaLabel: (document.querySelector('.rn-area-label') || {}).textContent,
    }));
    check('the page is the shell\'s frame (rail, splitter, detail), the rail a flex column', frame.panels && frame.railDisplay === 'flex', JSON.stringify(frame));
    check('the rail lists the area and its maps, as a group of rows like the Rooms tab\'s', frame.groups.join() === '▾Secret of Mana' && frame.areaLabel === 'Wide' && frame.rows.length === 2 && /Wide 1/.test(frame.rows[0]), JSON.stringify(frame));

    await p.fill('#rm-rail-q', 'wide 2');
    check('the rail search filters its rows (the shell\'s rail.js)', await p.locator('li.rn-map:not(.rm-off)').count() === 1);
    await p.fill('#rm-rail-q', '');

    await p.click('li.rn-map[data-map="176"]');
    await p.waitForSelector('#rg-svg');
    await p.waitForTimeout(400);
    const shell = await p.evaluate(() => ({
        head: (document.querySelector('.rd-head .rd-name') || {}).textContent,
        pill: [...document.querySelectorAll('#rg-edit-bar [data-edit-tool]')].map(b => b.getAttribute('aria-label')),
        zoom: !!document.getElementById('rg-zoom-level') && document.getElementById('rg-zoom-level').textContent,
        statusbar: !!document.querySelector('.rg-statusbar #rg-status-xy'),
        tabs: [...document.querySelectorAll('#rg-tabstrip .rg-tab')].map(b => b.textContent),
        dock: !!document.querySelector('.rg-edit-row > #rg-dock'),
        cardPill: !!document.querySelector('#rg-canvas-card > #rg-edit-chrome > #rg-edit-bar.rg-edit-bar'),
        filters: [...document.querySelectorAll('.rg-view-filters .rdf')].map(b => b.textContent),
    }));
    check('opening a map builds the shell\'s page: name line, canvas card with the pill, zoom chip, filter bar, status bar, dock',
        shell.head === 'Wide 1' && shell.zoom && shell.statusbar && shell.dock && shell.cardPill, JSON.stringify(shell));
    check('the pill is the Evermore editor\'s: select, pencil, erase, pick', shell.pill.join() === 'select,pencil,erase,pick', shell.pill.join());
    check('the dock\'s tab strip is the shell\'s: Tile | Object | Trigger | Info', shell.tabs.join() === 'Tile,Object,Trigger,Info', shell.tabs.join());
    check('the filter bar is the shared segmented pill: BG1 | BG2 | Collision, then the chips', shell.filters.join() === 'BG1,BG2,Collision,Animate,Specials,Objects,Characters,Triggers,Grid', shell.filters.join());

    const fit = await p.evaluate(() => { const w = document.getElementById('rg-wrap').getBoundingClientRect(), s = document.getElementById('rg-svg').getBoundingClientRect(); return { ww: w.width, sw: s.width, sh: s.height }; });
    check('the map fits its viewport and keeps its shape (6x2 cells -> 3:1)', Math.abs(fit.sw / fit.sh - 3) < 0.05 && fit.sw <= fit.ww + 1, JSON.stringify(fit));
    const anim = await p.evaluate(() => ({ uses: document.querySelectorAll('#rg-svg use').length, defs: document.querySelectorAll('#rg-svg defs image').length }));
    check('animated cells of one kind share one image (3 <use>, 1 defs image)', anim.uses === 3 && anim.defs === 1, JSON.stringify(anim));

    await p.click('.rg-view-filters [data-toggle="collision"]');
    await p.click('.rg-view-filters [data-toggle="specials"]');
    await p.click('.rg-view-filters [data-toggle="characters"]');
    await p.waitForTimeout(200);
    const ov = await p.evaluate(() => ({
        classes: [...document.querySelectorAll('#rg-over .mm-collision path')].map(e => e.getAttribute('class')).sort(),
        label: (document.querySelector('#rg-over .ms-label') || {}).textContent,
        ring: document.querySelectorAll('#rg-over .ed-objects .mo-ring').length,
        labels: [...document.querySelectorAll('#rg-over .ed-objects .mo-label')].map(e => e.textContent).sort(),
        marks: document.querySelectorAll('#rg-marks .rg-obj-area').length,
    }));
    check('the collision overlay is drawn from the metatiles\' collision: level-2 floor (all of this map) is the plain ground', ov.classes.length === 0 && await p.locator('#rg-over .mm-collision').count() === 1, ov.classes.join());
    check('only characters are circles: records on one cell are one ring with a count (3 records, 2 cells)', ov.ring === 2 && ov.labels.join() === 'C001,×2', JSON.stringify(ov));
    check('the map\'s changing area is drawn as Evermore draws an object: a dashed box (rg-obj-area), not a circle', ov.marks === 1, JSON.stringify(ov));
    const box = await p.evaluate(() => { const r = document.querySelector('#rg-marks .rg-obj-area'); return ['x', 'y', 'width', 'height'].map(a => +r.getAttribute(a)); });
    check('its box is the piece\'s area in the Evermore units (2 per cell): 2,0 4x2', box.join() === '2,0,4,2', box.join());
    check('the variant bar lists the maps that draw the same picture, this one lit', await p.locator('#rg-variant-bar .rg-level-b').count() === 2 && await p.locator('#rg-variant-bar .rg-level-b.on').textContent() === '1');
    await p.click('#rg-variant-bar .rg-level-b:not(.on)');
    await p.waitForSelector('#rg-svg');
    await p.waitForTimeout(300);
    check('a click on a variant opens that map in the same editor', (await p.textContent('.rd-head .rd-name')) === 'Wide 2' && await p.locator('#rg-variant-bar .rg-level-b.on').textContent() === '2');
    await p.click('li.rn-map[data-map="176"]');
    await p.waitForSelector('#rg-svg');
    await p.waitForTimeout(300);

    await p.click('.rg-view-filters [data-toggle="a"]');
    await p.waitForTimeout(200);
    const href = await p.evaluate(() => document.getElementById('rg-img').getAttribute('href'));
    check('BG1 off shows layer B alone (maps/b0.b.png), and stops the animation',
        href.endsWith('maps/b0.b.png') && !(await p.evaluate(() => document.querySelectorAll('#rg-svg use').length)), href);

    await p.click('[data-edit-act="toggle-dock"]');
    check('the shell\'s dock toggle hides the dock', await p.evaluate(() => getComputedStyle(document.getElementById('rg-dock')).display) === 'none');
    await p.click('[data-edit-act="toggle-dock"]');
    check('and shows it again', await p.evaluate(() => getComputedStyle(document.getElementById('rg-dock')).display) !== 'none');
    check('no page errors', !errors.length, errors.join('; '));
    await browser.close();
    fs.rmSync(tmp, { recursive: true, force: true });
    fs.rmSync(dir, { recursive: true, force: true });
}

main().catch(e => { console.error(e); failed++; }).finally(() => {
    console.log(`\n${passed} passed, ${failed} failed`);
    process.exit(failed > 0 ? 1 : 0);
});
