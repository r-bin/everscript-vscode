// TODO port to TS (docs/todo/port-to-ts.md)
'use strict';
// The Secret of Mana editor's filter chips and the tabs that edit what a cell is (Tile › Collision, Special,
// Trigger), in headless Chromium on the synthetic map b1 (a cuttable bush, a strike cell, an exit, stairs):
// every chip switches its overlay, a tab keeps its chip on, collision is drawn as shapes and 8 px squares
// and solved into metatiles. No ROM needed; skips without playwright.
// Run: node tests/mana/mana-editor-cells-dom.test.js

const { writePage, url } = require('./panel-page');
const { INIT, hostFile, somDir } = require('./synthetic-map');

let passed = 0, failed = 0;
const check = (name, cond, detail) => {
    if (cond) { console.log('  ✓ ' + name); passed++; }
    else { console.error('  ✗ ' + name + (detail ? '\n    ' + detail : '')); failed++; }
};

async function main() {
    let chromium;
    try { ({ chromium } = require('playwright')); } catch { console.log('\nMana editor cells: playwright not installed — skipped'); return; }
    let browser;
    try { browser = await chromium.launch({ args: ['--allow-file-access-from-files'] }); } catch { console.log('\nMana editor cells: no browser — skipped'); return; }
    console.log('\nSecret of Mana editor — chips, collision, specials, triggers:');
    const { page } = writePage(INIT, url(somDir()) + '/');
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
    await p.click('li.rn-map[data-map="177"]');
    await p.waitForSelector('#rg-svg');
    await p.waitForTimeout(400);

    // A point in cell (x, y): its centre, or the middle of quarter q (1 TL, 2 TR, 4 BL, 8 BR).
    const pt = async (x, y, q) => p.evaluate(([cx, cy, qq]) => {
        const r = document.getElementById('rg-svg').getBoundingClientRect(), k = r.width / 96;
        const dx = !qq ? 8 : qq & 10 ? 12 : 4, dy = !qq ? 8 : qq & 12 ? 12 : 4;
        return [r.left + (cx * 16 + dx) * k, r.top + (cy * 16 + dy) * k];
    }, [x, y, q || 0]);
    const click = async (x, y, q, button) => { const [mx, my] = await pt(x, y, q); await p.mouse.move(mx, my); await p.mouse.down({ button }); await p.mouse.up({ button }); };
    const n = sel => p.locator(sel).count();
    const chip = k => p.click('.rg-view-filters [data-toggle="' + k + '"]');
    const tab = t => p.click('#rg-tabstrip [data-mana-tab="' + t + '"]');
    const body = () => p.textContent('#rg-tab-body');
    const chipState = k => p.evaluate(key => { const b = document.querySelector('.rg-view-filters [data-toggle="' + key + '"]'); return (b.classList.contains('on') ? 'on' : 'off') + (b.classList.contains('forced') ? ' forced' : ''); }, k);

    // Cuttable: on outlines the bush, off draws it cut.
    check('Cuttable on: the bush is outlined, with the weapons that cut it', await n('#rg-over .mc-cut') === 1
        && /weapon type 1 → metatile \$06/.test(await p.textContent('#rg-over .mc-cut title')));
    await chip('cut');
    check('Cuttable off: no outline, the cell is drawn as metatile 6 (cut)', await n('#rg-over .mc-cut') === 0 && await n('#rg-over .mm-cut [data-cell="3,1"]') === 1);
    await chip('cut');

    // Triggers: the step event (walk into: solid), the exit, the strike cell.
    check('Triggers on: walk-into step event, exit and on-hit cell are drawn', await n('#rg-over .ed-trig.into') === 1 && await n('#rg-over .ed-exit') === 1 && await n('#rg-over .ed-hit') === 1);
    await chip('triggers');
    check('Triggers off hides all of them', await n('#rg-over .ed-triggers') === 0);
    await tab('trigger');
    check('the Trigger tab keeps the Triggers chip on and locked, and shows them', await chipState('triggers') === 'on forced' && await n('#rg-over .ed-triggers') === 1);
    await chip('triggers');
    check('a click on the locked chip changes nothing', await chipState('triggers') === 'on forced' && await n('#rg-over .ed-triggers') === 1);
    const subs = () => p.evaluate(() => [...document.querySelectorAll('#rg-tab-body [data-trig-sub]')].map(b => b.dataset.trigSub + ':' + b.textContent.trim().replace(/\s+/g, ' ')));
    check('the Trigger tab always shows its kinds with their counts, as the Evermore one does',
        (await subs()).join('|') === 'on:S Step on 0|into:W Walk into 1|cells:X Exits · hit 2|enter:E Enter', (await subs()).join('|'));
    check('a kind with nothing in it still lists none', /none yet/.test(await body()));
    await p.click('[data-trig-sub="cells"]');
    const tb = await body();
    check('Exits · hit lists the exit and the on-hit cell', /exit: back to the previous map/.test(tb) && /on hit · event \$6F8/.test(tb), tb);
    await p.click('[data-trig-sub="enter"]');
    check('Enter shows the map’s own event and the kinds stay', (await subs()).length === 4 && /on entry|no event of its own/.test(await body()));
    await p.click('[data-trig-sub="into"]');
    await p.click('[data-row-step="0"]');
    await p.click('[data-fires="on"]');
    check('Step on turns the walk-into trigger into a step-on one (c1 bit 6, through a metatile copy)',
        /#0 · event \$123/.test(await body()) && await n('#rg-over .ed-trig.into') === 0 && /on:S Step on 1/.test((await subs()).join('|')), await body());
    await p.keyboard.press('Control+z');
    check('undo makes it walk into again', await n('#rg-over .ed-trig.into') === 1 && /into:W Walk into 1/.test((await subs()).join('|')));

    // Specials: stairs on the picked layer; the Special tab paints a push.
    await tab('tile');
    check('leaving the Trigger tab lets the chip go back to off', await chipState('triggers') === 'off' && await n('#rg-over .ed-triggers') === 0);
    await chip('specials');
    check('Specials on draws the stairs', (await p.locator('#rg-over .mm-specials .mp-label').allTextContents()).join() === '≡');
    await chip('specials');
    check('Specials off hides them', await n('#rg-over .mm-specials') === 0);
    await tab('special');
    check('the Special tab keeps the Specials chip on', await chipState('specials') === 'on forced');
    await p.click('[data-special="' + 'eff:' + 0x32 + '"]');
    await click(2, 0);
    check('the pencil paints a push (left, 1 px a frame) on the cell', (await p.locator('#rg-over .mm-specials .mp-label').allTextContents()).sort().join() === '←1,≡');
    await p.click('[data-edit-tool="erase"]');
    await click(2, 0);
    check('erase gives the cell its metatile’s own back', (await p.locator('#rg-over .mm-specials .mp-label').allTextContents()).join() === '≡');

    // Collision: the sub-tab keeps the chip on; shapes, the 8 px pen, carving, "?".
    await tab('tile');
    await p.click('[data-tile-sub="collision"]');
    check('Tile › Collision keeps the Collision chip on', await chipState('collision') === 'on forced' && await n('#rg-over .mm-collision') === 1);
    check('the shapes are the Evermore Collision tab’s swatch cards: the pen, open, solid, four half walls',
        await n('#rg-tab-body .rg-coll-grid .rg-coll-chip .rg-coll-swatch') === 7 && await n('#rg-tab-body .rg-coll-pen.rg-armed') === 1 && await n('#rg-tab-body .rg-coll-keys kbd') === 3);
    const walls = () => p.evaluate(() => { const e = document.querySelector('#rg-over .mm-collision .mc-wall'); return e ? e.getAttribute('d').split('M').length - 1 : 0; });
    const diags = () => p.evaluate(() => { const e = document.querySelector('#rg-over .mm-collision .mc-diag'); return e ? e.getAttribute('d').split('M').length - 1 : 0; });
    await p.click('[data-coll="wall"]');
    await click(1, 0);
    check('a picked Wall makes the cell a wall (the tool switched to the pencil)', await walls() === 1);
    check('the layer count names the copy it took', /1 metatile copies/.test(await body()), await body());
    await p.click('[data-coll="pen"]');
    await click(1, 0, 1, 'right');
    check('the 8 px pen’s right button carves a quarter: three left is a half wall', await walls() === 0 && await diags() === 1);
    await click(4, 0, 1);
    await click(4, 0, 2);
    check('two squares side by side are no Mana shape: the cell is marked “?” and keeps its own', await n('#rg-over .mw-unfit') === 1 && await n('#rg-over .mw-quarters') === 1);
    await click(4, 0, 4);
    check('a third square makes an L: a half wall, the mark goes', await n('#rg-over .mw-unfit') === 0 && await diags() === 2);
    await p.click('[data-tile-sub="tiles"]');
    check('back on Tile › Tiles the Collision chip is off again', await chipState('collision') === 'off' && await n('#rg-over .mm-collision') === 0);

    // The rest of the chips.
    const before = await n('#rg-marks .rg-obj-area');
    await chip('objects');
    check('Objects off hides the map objects’ marks', before === 1 && await n('#rg-marks .rg-obj-area') === 0);
    await chip('characters');
    check('Characters on draws the rings', await n('#rg-over .mo-ring') === 2);
    await chip('grid');
    check('Grid on draws the 16 px grid', await n('#rg-grid path') === 1);
    await chip('grid');
    check('Grid off removes it', await n('#rg-grid path') === 0);
    // Opening a second map: the filter bar still answers every click once (a handler left on #room-detail by
    // the first map flipped each chip twice, so the bar looked dead).
    await p.click('li.rn-map[data-map="176"]');
    await p.waitForSelector('#rg-svg');
    await p.waitForTimeout(300);
    await chip('grid');
    check('on the next map a chip still switches with one click', await chipState('grid') === 'on' && await n('#rg-grid path') === 1);
    await chip('grid');
    check('no page errors', !errors.length, errors.join('; '));
    await browser.close();
}

main().then(() => {
    console.log(`\n${passed} passed, ${failed} failed`);
    if (failed) process.exit(1);
}).catch(e => { console.error(e); process.exit(1); });
