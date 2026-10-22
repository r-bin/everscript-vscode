// TODO port to TS (docs/todo/port-to-ts.md)
'use strict';
// Data tab (src/games/evermore/data-tab): the models against the ROM, the host, and the page in a
// browser answered by that same host. ROM-dependent checks skip without the Evermore ROM in the
// ROM library; browser checks skip without playwright. DATA_TAB_SHOT=<dir> saves a screenshot per view.

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { renderRadarHtml } = require('../../src/games/evermore/memory/render-radar');
const { buildDataTabHtml, handleDataMessage } = require('../../dist/games/evermore/data-tab');

const ROM = require('../../dist/games').romPath('evermore');

let passed = 0, failed = 0;
async function test(name, fn) {
    try { await fn(); console.log('  ✓ ' + name); passed++; }
    catch (e) { console.error('  ✗ ' + name + '\n    ' + (e && e.stack || e)); failed++; }
}

function hostDeps(rom, posted) {
    const { readAllCharacters } = require('../../dist/games/evermore/sprites/character-model');
    return { post: (m) => posted.push(m), loadRom: () => rom, characters: (r) => readAllCharacters(r) };
}

async function unit() {
    console.log('\nData tab — unit');
    await test('scaffold has the three views and the three columns', () => {
        const html = buildDataTabHtml();
        for (const v of ['tables', 'enums', 'palettes']) assert.ok(html.includes('data-dat-view="' + v + '"'), v);
        for (const id of ['dat-rail', 'dat-mid', 'dat-side']) assert.ok(html.includes('id="' + id + '"'), id);
    });
    await test('the radar page carries the tab and its bundle', () => {
        const html = renderRadarHtml({ kind: 'function', name: 'f', startLine: 0, endLine: 1 }, new Map(), [], new Map(), new Map(), [], 'radar', null);
        assert.ok(html.includes('data-tab="data"'));
        assert.ok(html.includes('DataTab.setupDataTab('));
        assert.ok(!html.includes('__DATA_JS__'));
    });
    await test('without a ROM the host answers an error', () => {
        const posted = [];
        handleDataMessage({ command: 'dataInit' }, { post: (m) => posted.push(m), loadRom: () => null, characters: () => [] });
        assert.ok(posted[0].error);
    });
}

async function romChecks(rom) {
    console.log('\nData tab — ROM');
    const posted = [];
    handleDataMessage({ command: 'dataInit' }, hostDeps(rom, posted));
    const ix = posted[0];
    await test('tables: XP per level, sine, boomerang orbit, then the knowledge tables', () => {
        assert.deepStrictEqual(ix.tables.slice(0, 3).map((t) => t.id), ['xp', 'sine', 'boomerang']);
        const xp = ix.tables[0];
        assert.deepStrictEqual(xp.rows.slice(0, 4).map((r) => [r[1], r[2]]), [[0, 0], [20, 35], [70, 115], [175, 271]]);
        assert.strictEqual(xp.rows[99][1], '$FFFFFF (cap)');
        const sine = ix.tables[1].chart.series[0].points;
        assert.deepStrictEqual([sine[0][1], sine[64][1], sine[128][1], sine[192][1], sine[256][1]], [0, 256, 0, -255, 0]);
        const orbit = ix.tables[2].chart.series[0].points;
        assert.deepStrictEqual(orbit[0], [128, 0]);
        assert.deepStrictEqual(orbit[64], [0, 64]);
        assert.ok(ix.tables.length > 10 && !ix.tables.some((t) => t.id === 'k:ORBIT_TABLE_X'));
    });
    await test('enums: character and map blobs, then every core enum by kind', () => {
        assert.deepStrictEqual(ix.enums.slice(0, 2).map((e) => e.id), ['characters', 'maps']);
        assert.strictEqual(ix.enums[1].entries.length, 127);
        assert.strictEqual(ix.enums[1].entries[0x38].value, '$DE8000');
        const chars = ix.enums[0].entries;
        assert.ok(chars.some((e) => e.name === 'WRAM · BOY' && e.value === '$7E4E89'));
        assert.ok(chars.some((e) => e.value === '$8EB678'));
        const group = (id) => ix.enums.find((e) => e.id === 'e:' + id).group;
        assert.strictEqual(group('ADDRESS'), 'ROM addresses');
        assert.strictEqual(group('MEMORY'), 'WRAM addresses');
        assert.strictEqual(group('ANIMATION'), 'Values');
        assert.strictEqual(group('MAP'), 'Values');
    });
    await test('palettes: the sprite palettes in bank $90 with their users, the map tile families', () => {
        const sprites = ix.palettes.filter((p) => p.id.startsWith('s:'));
        assert.ok(sprites.length > 100);
        assert.ok(sprites.every((p) => p.colors.length === 16));
        assert.ok(sprites.some((p) => p.users.some((u) => /Boy Name/.test(u))));
        assert.ok(ix.palettes.filter((p) => p.id.startsWith('m:')).every((p) => p.users.length > 0));
    });
    return ix;
}

async function dom(rom) {
    let chromium;
    try { ({ chromium } = require('playwright')); } catch { console.log('\nData tab DOM: playwright not installed — skipped'); return; }
    let browser;
    try { browser = await chromium.launch(); } catch (e) { console.log('\nData tab DOM: no browser — skipped'); return; }
    console.log('\nData tab — DOM');
    const page = await browser.newPage({ viewport: { width: 1500, height: 900 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    const stub = '<script>window.__posted=[];window.acquireVsCodeApi=function(){return{postMessage:function(m){window.__posted.push(m)},getState:function(){return null},setState:function(){}}};<\/script>';
    const html = renderRadarHtml({ kind: 'function', name: 'f', startLine: 0, endLine: 1 }, new Map(), [], new Map(), new Map(), [], 'radar', null);
    await page.setContent(html.replace('<head>', '<head>' + stub));
    const out = [];
    const deps = hostDeps(rom, out);
    const pump = async () => {
        const asked = await page.evaluate(() => window.__posted.splice(0));
        for (const m of asked) if (m.command === 'dataInit') handleDataMessage(m, deps);
        for (const m of out.splice(0)) await page.evaluate((x) => window.postMessage(x, '*'), m);
        await page.waitForTimeout(50);
        return asked;
    };
    const shot = async (name) => { if (process.env.DATA_TAB_SHOT) await page.screenshot({ path: path.join(process.env.DATA_TAB_SHOT, 'data-' + name + '.png') }); };
    await test('opening the tab loads every list; XP is drawn with both series', async () => {
        await page.click('.tab[data-tab="data"]');
        await pump();
        assert.ok(await page.locator('#dat-rail [data-dat-pick]').count() > 10);
        assert.strictEqual(await page.locator('#dat-side svg polyline').count(), 2);
        const svg = await page.locator('#dat-side svg').boundingBox();
        await page.mouse.move(svg.x + svg.width * 0.5, svg.y + svg.height * 0.5);
        assert.ok(/Boy: [\d,]+/.test(await page.textContent('.dat-tip')));
        await shot('tables');
    });
    await test('the boomerang orbit is a closed path', async () => {
        await page.click('[data-dat-pick="boomerang"]');
        assert.strictEqual(await page.locator('#dat-side svg polyline').count(), 1);
        await shot('boomerang');
    });
    await test('enums: map blobs list every room; an entry opens on the right', async () => {
        await page.click('[data-dat-view="enums"]');
        await page.click('[data-dat-pick="maps"]');
        assert.strictEqual(await page.locator('#dat-mid tr[data-dat-row]').count(), 127);
        await page.click('#dat-mid tr[data-dat-row="56"]');
        assert.ok((await page.textContent('#dat-side')).includes('$DE8000'));
        await page.click('#dat-side [data-dat-vfs]');
        assert.deepStrictEqual(await page.evaluate(() => window.__posted.pop()), { command: 'openVfs', uri: 'soe://bus/de8000' });
        await page.fill('#dat-search', 'BOY_LEVEL');
        assert.ok((await page.textContent('#dat-rail')).includes('MEMORY'));
        await page.fill('#dat-search', '');
        await shot('enums');
    });
    await test('palettes: 16 swatches and who uses them', async () => {
        await page.click('[data-dat-view="palettes"]');
        assert.strictEqual(await page.locator('#dat-mid .dat-sw').count(), 16);
        assert.ok((await page.textContent('#dat-side')).includes('Used by'));
        await shot('palettes');
    });
    await test('no page errors', () => assert.deepStrictEqual(errors, []));
    await browser.close();
}

(async () => {
    await unit();
    if (!fs.existsSync(ROM)) console.log('\nData tab — ROM: no ROM, skipped');
    else {
        const rom = fs.readFileSync(ROM);
        await romChecks(rom);
        await dom(rom);
    }
    console.log(`\n${passed} passed, ${failed} failed`);
    process.exit(failed ? 1 : 0);
})();
