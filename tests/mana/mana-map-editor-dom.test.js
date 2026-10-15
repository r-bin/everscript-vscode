'use strict';
// The Secret of Mana map editor (editor-*.js on the shared shell and core) in headless Chromium: the real page, a
// synthetic map with a hand-made metatile sheet, a stub host. Drives the pill, the dock tabs and the map with real
// mouse strokes. No ROM needed; skips without playwright. Run: node tests/mana/mana-map-editor-dom.test.js

const fs = require('fs');
const { writePage, url } = require('./panel-page');
const { INIT, tileColour, hostFile, somDir } = require('./synthetic-map');

let passed = 0, failed = 0;
const check = (name, cond, detail) => {
    if (cond) { console.log('  ✓ ' + name); passed++; }
    else { console.error('  ✗ ' + name + (detail ? '\n    ' + detail : '')); failed++; }
};

async function main() {
    let chromium;
    try { ({ chromium } = require('playwright')); } catch { console.log('\nMana map editor page: playwright not installed — skipped'); return; }
    let browser;
    try { browser = await chromium.launch({ args: ['--allow-file-access-from-files'] }); } catch { console.log('\nMana map editor page: no browser — skipped'); return; }
    console.log('\nSecret of Mana map editor page:');
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
    await p.click('li.rn-map[data-map="176"]');
    await p.waitForSelector('#rg-svg');
    await p.waitForTimeout(500);

    // Cell centres from the live geometry (the shell zooms the svg to fit; the notice and layout can move it).
    const cellPt = async (x, y) => p.evaluate(([cx, cy]) => {
        const r = document.getElementById('rg-svg').getBoundingClientRect(), k = r.width / 96;
        return [r.left + (cx + 0.5) * 16 * k, r.top + (cy + 0.5) * 16 * k];
    }, [x, y]);
    const click = async (x, y) => { const [mx, my] = await cellPt(x, y); await p.mouse.move(mx, my); await p.mouse.down(); await p.mouse.up(); };
    const changed = () => p.locator('#rg-edit-tiles [data-cell]').count();
    const info = () => p.textContent('#rg-tab-body');
    const tileTab = async () => { await p.click('#rg-tabstrip [data-mana-tab="tile"]'); };

    check('no "not saved" notice, and undo/redo are disabled, before a change',
        await p.locator('.rg-notsaved').count() === 0 && await p.evaluate(() => [...document.querySelectorAll('[data-edit-act="undo"],[data-edit-act="redo"]')].every(b => b.disabled)));

    // Pick metatile 3 (a wall) in the Tile tab's sheet and paint with it.
    const pk = await p.evaluate(() => { const r = document.getElementById('mana-picker').getBoundingClientRect(); return { l: r.left, t: r.top, k: r.width / 256 }; });
    await p.mouse.click(pk.l + (3 * 16 + 8) * pk.k, pk.t + 8 * pk.k);
    check('the Tile tab names the picked metatile and its collision', /metatile \$03 .* wall/.test(await info()), await info());
    await p.click('.rg-view-filters [data-toggle="collision"]');
    const walls = () => p.evaluate(() => { const e = document.querySelector('#rg-over .mm-collision .mc-wall'); return e ? e.getAttribute('d').split('M').length - 1 : 0; });
    check('collision shows no wall before painting', await walls() === 0);
    await click(0, 0);
    const px = await p.evaluate(() => { const g = document.querySelector('#rg-edit-tiles [data-cell="0,0"]'); return g ? g.querySelectorAll('svg').length : -1; });
    check('painting redraws the cell from the sheet (one tile of layer A over the backdrop)', px === 1, String(px));
    check('only the painted cell is redrawn: the rest is the map\'s own picture', await changed() === 1);
    check('collision followed the metatile: one wall cell', await walls() === 1, String(await walls()));
    check('the "not saved" notice appears, in the pill\'s wrapper', await p.locator('#rg-edit-chrome .rg-notsaved').count() === 1);
    check('the status line counts what changed', /1 cell changed/.test(await p.textContent('#rg-edit-count')), await p.textContent('#rg-edit-count'));

    // A drag is one undo step.
    const [x0, y0] = await cellPt(1, 1), [x1] = await cellPt(3, 1);
    await p.mouse.move(x0, y0); await p.mouse.down(); await p.mouse.move(x1, y0, { steps: 8 }); await p.mouse.up();
    check('dragging paints every cell it crosses', await changed() === 4, String(await changed()));
    await p.keyboard.press('Control+z');
    check('Ctrl+Z undoes the whole drag at once, not the first stroke', await changed() === 1);
    await p.keyboard.press('Control+Shift+z');
    check('Ctrl+Shift+Z redoes it', await changed() === 4);
    await p.click('[data-edit-act="undo"]');
    await p.click('[data-edit-act="undo"]');
    check('undoing everything is back to the map as it opened: no notice, nothing changed, no wall',
        await p.locator('.rg-notsaved').count() === 0 && await changed() === 0 && await walls() === 0);
    await p.click('[data-edit-act="redo"]');
    await p.click('[data-edit-act="redo"]');

    // Erase sets metatile 0 (a real metatile of the set, drawn from the sheet like any other).
    await p.click('[data-edit-tool="erase"]');
    await click(4, 0);
    const erased = await p.evaluate(() => { const g = document.querySelector('#rg-edit-tiles [data-cell="4,0"]'); return g ? [g.querySelector('svg').getAttribute('viewBox'), g.querySelector('rect').getAttribute('fill')] : null; });
    check('Erase sets the cell to metatile 0: the sheet\'s first tile over the backdrop colour', erased && erased[0] === '0 0 16 16' && erased[1] === 'rgb(10,20,30)', JSON.stringify(erased));
    await p.keyboard.press('i');
    await click(0, 0);
    check('Pick takes the metatile under the pointer', /metatile \$03/.test(await info()), await info());

    // Characters: the open tab decides what the pencil draws; records on one cell are one ring with a count.
    await p.click('#rg-tabstrip [data-mana-tab="object"]');
    const rings = () => p.locator('#rg-over .ed-objects .mo-ring').count();
    const rows = () => p.locator('[data-row-obj]').count();
    check('the Object tab has two sub-tabs: Characters and Map changes', (await p.locator('.rg-subtab').allTextContents()).map(t => t.replace(/\s+\d+$/, '')).join() === 'Characters,Map changes');
    check('Characters lists the three records; the map rings two cells (two records share one)', await rows() === 3 && await rings() === 2);
    check('the two records on one cell are marked in the list and drawn as one ring with ×2',
        /1\/2 on this cell/.test(await info()) && (await p.locator('#rg-over .ed-objects .mo-label').allTextContents()).includes('×2'));
    await p.click('[data-edit-tool="select"]');
    await click(0, 1);
    const picked = () => p.evaluate(() => (document.querySelector('.rg-trigger-row.on') || {}).dataset && document.querySelector('.rg-trigger-row.on').dataset.rowObj);
    const first = await picked();
    await click(0, 1);
    check('Select takes one of the stacked records, and a second click on the cell takes the next', first !== undefined && (await picked()) !== first, first + ' -> ' + await picked());
    await p.click('[data-edit-tool="paint"]');
    await click(4, 1);
    check('with the pencil, a click on an empty cell places a record', await rings() === 3 && await rows() === 4);
    check('it copies the selected record\'s kind', /kind \$420[CD]/.test(await info()));
    await p.fill('#rg-tab-body [data-f="kind"]', 'c123');
    await p.dispatchEvent('#rg-tab-body [data-f="kind"]', 'change');
    check('the kind field changes the row and the label', /kind \$C123/.test(await info()) && (await p.locator('#rg-over .ed-objects .mo-label').allTextContents()).includes('C123'));
    await p.click('[data-del-obj="3"]');
    check('the row\'s × removes the record', await rings() === 2 && await rows() === 3);
    await p.keyboard.press('Control+z');
    check('Undo brings it back, with its edited kind', await rings() === 3 && /kind \$C123/.test(await info()));
    await p.click('[data-edit-tool="erase"]');
    await click(4, 1);
    check('the eraser removes the record under the pointer on this tab', await rings() === 2);

    // Map changes: the event-flag pieces, as the Evermore Object tab draws objects.
    await p.click('[data-obj-sub="changes"]');
    check('Map changes shows a card for the piece, with its states as chips (0 and 1)', await p.locator('.rg-object-card').count() === 1 && await p.locator('.ro-chip').count() === 2);
    check('the map outlines it like an Evermore object: the dashed area and its state\'s sub-frame, no circles',
        await p.locator('#rg-marks .rg-obj-area').count() === 1 && await p.locator('#rg-marks .rg-obj-subframe').count() === 1 && await rings() === 0);
    const before = await changed();
    await p.click('[data-piece-state="0:1"]');
    check('state 1 redraws the map with that state\'s cells (2 cells), without counting as an edit',
        await changed() === before + 2 && await p.locator('.rg-notsaved').count() === 1 && /5 cells changed/.test(await p.textContent('#rg-edit-count')), String(await changed()));
    check('the open state\'s frame is outlined and the card says which state and flag',
        await p.locator('#rg-marks .rg-obj-frame').count() === 1 && /flag \$10 = 6/.test(await info()), await info());
    await p.click('[data-edit-tool="paint"]');
    await click(4, 1);
    check('map changes are read-only: the pencil does nothing here', await changed() === before + 2);
    await p.click('[data-piece-state="0:0"]');
    check('state 0 puts the map back', await changed() === before);

    // Triggers: the map's step event; drag it with Select.
    await p.click('#rg-tabstrip [data-mana-tab="trigger"]');
    check('the Trigger tab lists the step event with its number', /event \$123/.test(await info()) && (await p.locator('#rg-over .ed-triggers .ms-label').first().textContent()) === '123');
    await p.click('[data-edit-tool="select"]');
    const [sx, sy] = await cellPt(1, 0), [tx] = await cellPt(5, 0);
    await p.mouse.move(sx, sy); await p.mouse.down(); await p.mouse.move(tx, sy, { steps: 6 }); await p.mouse.up();
    check('Select drags a step event to another cell', await p.evaluate(() => +document.querySelector('#rg-over .ed-trig').getAttribute('x')) === 5 * 16 + 1);
    await p.click('[data-edit-tool="paint"]');
    await click(2, 0);
    check('with the pencil, a click adds a step event with the selected one\'s number', await p.locator('[data-row-step]').count() === 2 && /#1 · event \$123/.test(await info()));

    // The session survives opening another map and coming back.
    await p.click('li.rn-map[data-map="177"]');
    await p.waitForTimeout(400);
    check('another map starts clean', await p.locator('.rg-notsaved').count() === 0 && await changed() === 0);
    await p.click('li.rn-map[data-map="176"]');
    await p.waitForTimeout(400);
    check('going back keeps the edits and the notice',
        await changed() === 5 && await p.locator('.rg-notsaved').count() === 1, String(await changed()));
    check('the notice says nothing is saved', /not saved/.test(await p.textContent('.rg-notsaved')));
    await tileTab();
    check('no page errors', !errors.length, errors.join('; '));
    await browser.close();
    fs.rmSync(tmp, { recursive: true, force: true });
    fs.rmSync(dir, { recursive: true, force: true });
}

main().catch(e => { console.error(e); failed++; }).finally(() => {
    console.log(`\n${passed} passed, ${failed} failed`);
    process.exit(failed > 0 ? 1 : 0);
});
