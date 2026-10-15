'use strict';
// The Secret of Mana Maps page in headless Chromium: the real webview files and the
// shared map-view pieces, a synthetic catalogue, and a stub host answering som://
// reads. No ROM needed; skips without playwright. Run: node tests/mana/mana-panel-dom.test.js

const fs = require('fs');
const path = require('path');

const { writePage, url } = require('./panel-page');

let passed = 0, failed = 0;
const check = (name, cond, detail) => {
    if (cond) { console.log('  ✓ ' + name); passed++; }
    else { console.error('  ✗ ' + name + (detail ? '\n    ' + detail : '')); failed++; }
};

// One wide map (the shape VS Code's `img { max-width:100% }` used to squash), 6x2 cells.
const INIT = {
    title: 'Test', somBase: 'file:///nowhere/',
    maps: [{ id: 176, hex: 'b0', w: 6, h: 2, area: 'Wide' }],
    areas: [{ name: 'Wide', slug: 'wide', maps: [176], pictures: [[176]] }],
};
const FILES = {
    'maps/b0.collision.json': { w: 6, h: 2, floor: '333222' + '102000', diagonal: '000000' + '000400', switches: [[5, 1]], specials: [{ x: 1, y: 1, kind: 0x87 }] },
    'maps/b0.objects.json': { objects: [{ x: 2, y: 1, kind: 0xC001 }] },
    'maps/b0.anim.json': { length: 60, images: ['data:image/png;base64,AA==', 'data:image/png;base64,AQ=='],
        kinds: [{ cells: [[0, 0], [1, 0], [2, 0]], starts: [0, 30], frames: [0, 1] }] },
};

async function main() {
    let chromium;
    try { ({ chromium } = require('playwright')); } catch { console.log('\nMana maps page: playwright not installed — skipped'); return; }
    let browser;
    try { browser = await chromium.launch(); } catch (e) { console.log('\nMana maps page: no browser — skipped'); return; }
    console.log('\nSecret of Mana Maps page:');
    const { dir: tmp, page } = writePage(INIT, INIT.somBase);
    // VS Code's own default webview stylesheet caps images like this.
    fs.writeFileSync(path.join(tmp, 'vscode.css'), 'img,video{max-width:100%;max-height:100%}');

    const p = await browser.newPage({ viewport: { width: 500, height: 600 } });
    const errors = [];
    p.on('pageerror', e => errors.push(e.message));
    await p.exposeFunction('hostRead', f => (FILES[f] ? JSON.stringify(FILES[f]) : null));
    await p.addInitScript(() => {
        let st = { zoom: 4 };
        window.acquireVsCodeApi = () => ({
            getState: () => st, setState: s => { st = s; },
            postMessage: async m => { if (m.command === 'read') window.postMessage({ command: 'file', path: m.path, text: await window.hostRead(m.path) }, '*'); },
        });
    });
    await p.goto(url(page));
    await p.addStyleTag({ url: url(path.join(tmp, 'vscode.css')) });
    await p.waitForTimeout(300);

    const box = await p.evaluate(() => { const r = document.querySelector('svg.mm-map').getBoundingClientRect(); return [r.width, r.height]; });
    check('a map wider than the view keeps its shape (384x128 at 4x, not squashed)', box[0] === 384 && box[1] === 128, JSON.stringify(box));
    const chips = await p.evaluate(() => [...document.querySelectorAll('#filters .rg-seg .rdf')].map(b => b.textContent));
    check('the filter bar is the shared segmented pill: BG1 | BG2 | Collision', chips.join('|') === 'BG1|BG2|Collision', chips.join('|'));
    const anim = await p.evaluate(() => ({ uses: document.querySelectorAll('svg.mm-map use').length, defs: document.querySelectorAll('svg.mm-map defs image').length }));
    check('animated cells of one kind share one image (3 <use>, 1 defs image)', anim.uses === 3 && anim.defs === 1, JSON.stringify(anim));

    await p.click('#filters [data-toggle="collision"]');
    await p.click('#filters [data-toggle="specials"]');
    await p.click('#filters [data-toggle="objects"]');
    await p.waitForTimeout(200);
    const ov = await p.evaluate(() => ({
        classes: [...document.querySelectorAll('.mm-collision path')].map(e => e.getAttribute('class')).sort(),
        switches: document.querySelectorAll('.mc-switch').length - document.querySelectorAll('.legend .mc-switch').length,
        label: (document.querySelector('.ms-label') || {}).textContent,
        legend: !document.getElementById('legend').hidden,
    }));
    check('collision draws walls, diagonal halves, level-1 and shared floors', ov.classes.join(',') === 'mc-diag,mc-l0,mc-l1,mc-wall', ov.classes.join(','));
    check('level switches and special cells are marked and labelled', ov.switches === 1 && ov.label === '87', JSON.stringify(ov));
    check('the collision legend shows with the overlay', ov.legend);
    const obj = await p.evaluate(() => [document.querySelectorAll('.mo-ring').length, (document.querySelector('.mo-label') || {}).textContent]);
    check('objects are ringed and labelled with their kind', obj[0] === 1 && obj[1] === 'C001', JSON.stringify(obj));

    await p.click('#filters [data-toggle="a"]');
    await p.waitForTimeout(200);
    const href = await p.evaluate(() => document.querySelector('.mm-picture').getAttribute('href'));
    check('BG1 off shows layer B alone (maps/b0.b.png), and stops the animation',
        href.endsWith('maps/b0.b.png') && !(await p.evaluate(() => document.querySelectorAll('svg.mm-map use').length)), href);
    check('no page errors', !errors.length, errors.join('; '));
    await browser.close();
    fs.rmSync(tmp, { recursive: true, force: true });
}

main().catch(e => { console.error(e); failed++; }).finally(() => {
    console.log(`\n${passed} passed, ${failed} failed`);
    process.exit(failed > 0 ? 1 : 0);
});
