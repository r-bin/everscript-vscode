'use strict';
// The Secret of Mana map editor (editor.js on the shared core) in headless Chromium: the real
// webview files, a synthetic 6x2 map with a hand-made metatile sheet, a stub host. No ROM needed;
// skips without playwright. Run: node tests/mana/mana-map-editor-dom.test.js

const fs = require('fs');
const path = require('path');
const { writePage, url } = require('./panel-page');
const { encodePng } = require('../../src/mana-resources/png');

let passed = 0, failed = 0;
const check = (name, cond, detail) => {
    if (cond) { console.log('  ✓ ' + name); passed++; }
    else { console.error('  ✗ ' + name + (detail ? '\n    ' + detail : '')); failed++; }
};

// Metatile n of the sheet is a solid colour (n=0 is clear), so a painted cell is easy to recognise.
const tileColour = n => [(n * 23) % 256, 40 + n, 200 - n];
function sheetPng() {
    const w = 256, h = 192, rgba = new Uint8Array(w * h * 4);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const n = (y >> 4) * 16 + (x >> 4), i = (y * w + x) * 4;
        if (!n) continue;
        const c = tileColour(n);
        rgba[i] = c[0]; rgba[i + 1] = c[1]; rgba[i + 2] = c[2]; rgba[i + 3] = 255;
    }
    return encodePng({ width: w, height: h, rgba });
}

const collision = new Array(192 * 4).fill(0);
collision[1 * 4] = 2; collision[2 * 4] = 2;       // metatiles 1, 2: level-2 floor
collision[3 * 4] = 3;                             // metatile 3: wall
collision[4 * 4 + 1] = 0x87;                      // metatile 4: a special cell
const EDIT = {
    id: 176, w: 6, h: 2, sizeB: null,
    a: [1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2], b: [],
    collision: { a: collision, b: new Array(768).fill(0) },
    backdrop: [10, 20, 30], lead: 0, ownEvent: false,
    events: { onEnter: null, steps: [{ x: 1, y: 0, event: 0x123 }] },
    objects: [{ index: 0, x: 2, y: 1, flags: 0, kind: 0xC001, bytes: [0, 0, 2, 1, 0, 0, 1, 0xC0] }],
};
const INIT = {
    title: 'Test',
    maps: [{ id: 176, hex: 'b0', w: 6, h: 2, area: 'Wide' }],
    areas: [{ name: 'Wide', slug: 'wide', maps: [176], pictures: [[176]] }],
};

async function main() {
    let chromium;
    try { ({ chromium } = require('playwright')); } catch { console.log('\nMana map editor page: playwright not installed — skipped'); return; }
    let browser;
    // file:// images would taint the canvas the test reads back; the real webview never reads it.
    try { browser = await chromium.launch({ args: ['--allow-file-access-from-files'] }); } catch { console.log('\nMana map editor page: no browser — skipped'); return; }
    console.log('\nSecret of Mana map editor page:');

    const dir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'mana-ed-'));
    fs.mkdirSync(path.join(dir, 'maps'));
    fs.writeFileSync(path.join(dir, 'maps', 'b0.tiles.a.png'), sheetPng());
    const { dir: tmp, page } = writePage(INIT, url(dir) + '/');

    const p = await browser.newPage({ viewport: { width: 1300, height: 800 } });
    const errors = [];
    p.on('pageerror', e => errors.push(e.message));
    await p.exposeFunction('hostRead', f => (f === 'maps/b0.edit.json' ? JSON.stringify(EDIT) : null));
    await p.addInitScript(() => {
        let st = {};
        window.acquireVsCodeApi = () => ({
            getState: () => st, setState: s => { st = s; },
            postMessage: async m => { if (m.command === 'read') window.postMessage({ command: 'file', path: m.path, text: await window.hostRead(m.path) }, '*'); },
        });
    });
    await p.goto(url(page));
    await p.waitForTimeout(300);

    // Open the editor from the area view.
    check('the area view offers an Edit button per map', await p.locator('.edit-btn[data-edit="176"]').count() === 1);
    await p.click('.edit-btn[data-edit="176"]');
    await p.waitForSelector('.ed-over');
    await p.waitForTimeout(300);
    const tools = await p.evaluate(() => [...document.querySelectorAll('#ed-tools [data-edit-tool]')].map(b => b.textContent));
    check('the tool strip offers Paint, Erase, Pick, Objects, Triggers', tools.join(',') === 'Paint,Erase,Pick,Objects,Triggers', tools.join(','));
    check('no "not saved" notice before a change', await p.locator('.ed-notsaved').count() === 0);
    check('Undo and Redo start disabled', await p.evaluate(() => [...document.querySelectorAll('[data-edit-act="undo"],[data-edit-act="redo"]')].every(b => b.disabled)));

    // Geometry: the stage at the default 2x zoom is 6x2 cells of 32 px.
    const stage = await p.evaluate(() => { const r = document.querySelector('.ed-over').getBoundingClientRect(); return { l: r.left, t: r.top, w: r.width, h: r.height }; });
    check('the stage is the map at 2x (192x64), not scaled by CSS', stage.w === 192 && stage.h === 64, JSON.stringify(stage));
    // Measured at the time: the notice above the stage shows and hides.
    let at = stage;
    const cell = (x, y) => [at.l + x * 32 + 16, at.t + y * 32 + 16];
    const measure = async () => { at = await p.evaluate(() => { const r = document.querySelector('.ed-over').getBoundingClientRect(); return { l: r.left, t: r.top }; }); };
    const pixel = (x, y) => p.evaluate(([cx, cy]) => {
        const c = document.querySelector('canvas.ed-edits');
        return [...c.getContext('2d').getImageData(cx * 32 + 16, cy * 32 + 16, 1, 1).data];
    }, [x, y]);
    const click = async (x, y) => { await measure(); const [mx, my] = cell(x, y); await p.mouse.move(mx, my); await p.mouse.down(); await p.mouse.up(); };

    // Pick metatile 3 (a wall) in the sheet and paint a cell with it.
    const pk = await p.evaluate(() => { const r = document.getElementById('ed-picker').getBoundingClientRect(); return { l: r.left, t: r.top, k: r.width / 256 }; });
    await p.mouse.click(pk.l + (3 * 16 + 8) * pk.k, pk.t + 8 * pk.k);
    check('the info line names the picked metatile and its collision', /metatile \$03 .* wall/.test(await p.textContent('#ed-info')), await p.textContent('#ed-info'));
    await p.click('#ed-view [data-toggle="collision"]');
    const walls = () => p.evaluate(() => (document.querySelector('.mm-collision .mc-wall') || { getAttribute: () => '' }).getAttribute('d').split('M').length - 1);
    check('collision shows no wall before painting', await walls() === 0);
    await click(0, 0);
    const c3 = tileColour(3);
    const px = await pixel(0, 0);
    check('painting redraws the cell from the sheet', px[0] === c3[0] && px[1] === c3[1] && px[2] === c3[2] && px[3] === 255, JSON.stringify(px));
    check('an unpainted cell stays the map’s own picture (canvas clear)', (await pixel(1, 0))[3] === 0);
    check('collision followed the metatile: one wall cell', await walls() === 1, String(await walls()));
    check('the "not saved" notice appears', await p.locator('.ed-notsaved').count() === 1);
    check('Undo is enabled', await p.evaluate(() => !document.querySelector('[data-edit-act="undo"]').disabled));

    // A drag is one undo step.
    await measure();
    const [x0, y0] = cell(1, 1), [x1] = cell(3, 1);
    await p.mouse.move(x0, y0); await p.mouse.down(); await p.mouse.move(x1, y0, { steps: 6 }); await p.mouse.up();
    check('dragging paints every cell it crosses', (await pixel(1, 1))[3] === 255 && (await pixel(2, 1))[3] === 255 && (await pixel(3, 1))[3] === 255);
    await p.keyboard.press('Control+z');
    check('Ctrl+Z undoes the whole drag at once, and not the first stroke', (await pixel(2, 1))[3] === 0 && (await pixel(0, 0))[3] === 255);
    await p.keyboard.press('Control+Shift+z');
    check('Ctrl+Shift+Z redoes it', (await pixel(2, 1))[3] === 255);
    await p.click('[data-edit-act="undo"]');
    await p.click('[data-edit-act="undo"]');
    check('Undo twice is back to the map as it opened: no notice, no wall, canvas clear',
        await p.locator('.ed-notsaved').count() === 0 && await walls() === 0 && (await pixel(0, 0))[3] === 0);
    await p.click('[data-edit-act="redo"]');
    await p.click('[data-edit-act="redo"]');

    // Erase writes metatile 0, which draws nothing from the sheet (a backdrop-coloured cell).
    await p.keyboard.press('e');
    await click(4, 0);
    const er = await pixel(4, 0);
    check('Erase sets the cell to metatile 0: backdrop colour, no tile', er[0] === 10 && er[1] === 20 && er[2] === 30, JSON.stringify(er));
    await p.keyboard.press('i');
    await click(0, 0);
    check('Pick takes the metatile under the pointer', /metatile \$03/.test(await p.textContent('#ed-info')));

    // Objects: place by clicking an empty cell, edit the kind, delete, undo.
    await p.keyboard.press('o');
    const rings = () => p.locator('.ed-objects .mo-ring').count();
    check('the map’s object is ringed', await rings() === 1);
    await click(4, 1);
    check('clicking an empty cell places an object', await rings() === 2);
    check('it copies the selected object’s kind ($C001)', (await p.locator('.ed-objects .mo-label').last().textContent()) === 'C001');
    await p.fill('#ed-inspector [data-f="kind"]', 'c123');
    await p.dispatchEvent('#ed-inspector [data-f="kind"]', 'change');
    check('the kind field changes the label', (await p.locator('.ed-objects .mo-label').last().textContent()) === 'C123');
    await p.click('#ed-inspector [data-edit-act="delete"]');
    check('Delete removes the object', await rings() === 1);
    await p.keyboard.press('Control+z');
    check('Undo brings it back, with its edited kind', await rings() === 2 && (await p.locator('.ed-objects .mo-label').last().textContent()) === 'C123');

    // Triggers: the map's step event, move one by dragging.
    await p.keyboard.press('t');
    check('the step event is drawn with its number', (await p.locator('.ed-triggers .ms-label').first().textContent()) === '123');
    await measure();
    const [sx, sy] = cell(1, 0), [tx] = cell(5, 0);
    await p.mouse.move(sx, sy); await p.mouse.down(); await p.mouse.move(tx, sy, { steps: 5 }); await p.mouse.up();
    check('dragging a step event moves it', await p.evaluate(() => +document.querySelector('.ed-triggers .ed-trig').getAttribute('x')) === 5 * 16 + 1);
    await click(2, 0);
    check('clicking an empty cell adds a step event with the selected one’s number', await p.locator('.ed-triggers .ed-trig').count() === 2);

    // Edits survive leaving the editor and coming back (the session), but are page-lifetime only.
    await p.click('[data-edit-act="back"]');
    await p.waitForSelector('.edit-btn');
    await p.click('.edit-btn[data-edit="176"]');
    await p.waitForSelector('.ed-over');
    await p.waitForTimeout(300);
    check('going back and reopening keeps the edits and the notice',
        (await pixel(0, 0))[3] === 255 && await p.locator('.ed-notsaved').count() === 1 && await p.locator('.ed-triggers .ed-trig').count() === 2);
    check('the notice says nothing is saved', /not saved/.test(await p.textContent('.ed-notsaved')));

    check('no page errors', !errors.length, errors.join('; '));
    await browser.close();
    fs.rmSync(tmp, { recursive: true, force: true });
    fs.rmSync(dir, { recursive: true, force: true });
}

main().catch(e => { console.error(e); failed++; }).finally(() => {
    console.log(`\n${passed} passed, ${failed} failed`);
    process.exit(failed > 0 ? 1 : 0);
});
