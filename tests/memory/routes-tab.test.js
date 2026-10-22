// TODO port to TS (docs/todo/port-to-ts.md)
'use strict';
// Routes tab (src/games/evermore/routes): the model, the host, the checks against the room
// scripts, and the page in a browser answered by that same host. ROM-dependent checks skip
// without the Evermore ROM in the ROM library; browser checks skip without playwright.
// ROUTES_TAB_SHOT=<dir> saves a screenshot per view.

const assert = require('assert');
const path = require('path');
const { renderRadarHtml } = require('../../src/games/evermore/memory/render-radar');
const { buildRoutesTabHtml, handleRoutesMessage } = require('../../dist/games/evermore/routes');
const { parseRoute, checkStep, routeViews } = require('../../dist/games/evermore/routes/model/route');

const ROM = require('../../dist/games').romPath('evermore');

let passed = 0, failed = 0;
async function test(name, fn) {
    try { await fn(); console.log('  ✓ ' + name); passed++; }
    catch (e) { console.error('  ✗ ' + name + '\n    ' + (e && e.stack || e)); failed++; }
}

const deps = (rom, posted) => ({ post: (m) => posted.push(m), loadRom: () => rom, workspace: () => null, open: () => {} });
const names = { name: (r) => 'room ' + r.toString(16), area: () => 'area' };

async function unit() {
    console.log('\nRoutes tab — unit');
    await test('scaffold and radar page carry the tab and its bundle', () => {
        assert.ok(buildRoutesTabHtml().includes('id="rte-mid"'));
        const html = renderRadarHtml({ kind: 'function', name: 'f', startLine: 0, endLine: 1 }, new Map(), [], new Map(), new Map(), [], 'radar', null);
        assert.ok(html.includes('data-tab="routes"'));
        assert.ok(html.includes('RoutesTab.setupRoutesTab('));
        assert.ok(!html.includes('__ROUTES_JS__'));
    });
    await test('a route file is validated, problems listed', () => {
        assert.strictEqual(parseRoute([], 'x').route, null);
        const { route, problems } = parseRoute({ id: 'r', title: 'R', start: { room: '0x38' }, steps: [
            { room: '0x38', kind: 'exit', action: 'go' }, { room: 'zz', kind: 'wait', action: 'w' }, { room: 56, kind: 'loot', action: 'take', loot: 'petal', talons: 3 },
        ] }, 'x');
        assert.deepStrictEqual(route.steps.map((s) => s.kind), ['exit', 'loot']);
        assert.strictEqual(route.steps[1].loot, 'PETAL');
        assert.strictEqual(problems.length, 2);
    });
    await test('checks: exits and loot against room facts', () => {
        const facts = { loot: [{ trigger: 'B #1', kind: 'gourd', item: 'PETAL', amount: 1 }, { trigger: 'B #0', kind: 'gourd', item: 'MONEY', amount: 15 }], exits: [{ trigger: 'step-on #0', to: 0x5c }] };
        assert.strictEqual(checkStep({ room: 0x38, kind: 'exit', action: '', to: 0x5c }, facts).state, 'ok');
        assert.strictEqual(checkStep({ room: 0x38, kind: 'exit', action: '', to: 0x51 }, facts).state, 'missing');
        assert.strictEqual(checkStep({ room: 0x38, kind: 'loot', action: '', loot: 'PETAL' }, facts).state, 'ok');
        assert.strictEqual(checkStep({ room: 0x38, kind: 'loot', action: '', loot: 'PETAL', talons: 10 }, facts).state, 'differs');
        assert.strictEqual(checkStep({ room: 0x38, kind: 'loot', action: '', loot: 'MONEY', talons: 15 }, facts).state, 'ok');
        assert.strictEqual(checkStep({ room: 0x38, kind: 'fight', action: '' }, facts).state, 'none');
        assert.strictEqual(checkStep({ room: 0x38, kind: 'exit', action: '', to: 0x5c }, null).state, 'none');
    });
    await test('views: runs per room, Talons carried, a variant shares the prefix', () => {
        const { route } = parseRoute({ id: 'r', title: 'R', start: { room: 1 }, steps: [
            { room: 1, kind: 'loot', action: 'a', talons: 5 }, { room: 1, kind: 'exit', action: 'b', to: 2 }, { room: 2, kind: 'fight', action: 'c', talons: 2 },
        ], variants: [{ id: 'v', title: 'V', after: 2, steps: [{ room: 2, kind: 'wait', action: 'd' }] }, { id: 'w', title: 'W' }] }, 'x');
        const [base, v, w] = routeViews(route, names, () => null);
        assert.deepStrictEqual(base.runs.map((r) => r.steps.length), [2, 1]);
        assert.deepStrictEqual(base.runs[1].steps.map((s) => s.tally), [7]);
        assert.strictEqual(base.totals.talons, 7);
        assert.deepStrictEqual(v.runs.flatMap((r) => r.steps.map((s) => [s.action, s.inherited])), [['a', true], ['b', true], ['d', false]]);
        assert.strictEqual(w.totals.steps, 3);
        assert.strictEqual(v.id, 'r/v');
    });
    await test('without a ROM the bundled draft loads unchecked', () => {
        const posted = [];
        handleRoutesMessage({ command: 'routesInit' }, deps(null, posted));
        const ix = posted[0];
        assert.strictEqual(ix.rom, false);
        assert.deepStrictEqual(ix.problems, []);
        assert.deepStrictEqual(ix.routes.map((r) => r.id), ['any-percent', 'any-percent/16-hbs']);
        assert.strictEqual(ix.routes[0].totals.talons, 112);
        assert.ok(ix.routes[0].runs.every((r) => r.steps.every((s) => s.rom.state === 'none')));
    });
}

async function romChecks(rom) {
    console.log('\nRoutes tab — ROM');
    const posted = [];
    handleRoutesMessage({ command: 'routesInit' }, deps(rom, posted));
    const r = posted[0].routes[0];
    const step = (n) => r.runs.flatMap((x) => x.steps).find((s) => s.n === n);
    await test('the Any% draft against the room scripts', () => {
        assert.deepStrictEqual(r.runs.map((x) => x.hex), ['0x38', '0x5C', '0x51', '0x25']);
        assert.strictEqual(step(5).rom.state, 'ok', '0x38 leads north to the raptors');
        assert.strictEqual(step(2).rom.state, 'differs', 'the Petal gourds give a Petal, not Talons');
        assert.ok(/15 Talons/.test(step(2).rom.text));
        assert.strictEqual(step(7).rom.state, 'differs', 'the Nectar gourd gives Nectar');
        assert.strictEqual(step(8).rom.state, 'ok', 'the huts lead back to the village');
        assert.deepStrictEqual([r.totals.ok, r.totals.differs, r.totals.missing], [2, 2, 0]);
    });
    return posted[0];
}

async function dom(rom) {
    let chromium;
    try { ({ chromium } = require('playwright')); } catch { console.log('\nRoutes tab DOM: playwright not installed — skipped'); return; }
    let browser;
    try { browser = await chromium.launch(); } catch { console.log('\nRoutes tab DOM: no browser — skipped'); return; }
    console.log('\nRoutes tab — DOM');
    const page = await browser.newPage({ viewport: { width: 1500, height: 900 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    const stub = '<script>window.__posted=[];window.acquireVsCodeApi=function(){return{postMessage:function(m){window.__posted.push(m)},getState:function(){return null},setState:function(){}}};<\/script>';
    const html = renderRadarHtml({ kind: 'function', name: 'f', startLine: 0, endLine: 1 }, new Map(), [], new Map(), new Map(), [], 'radar', null);
    await page.setContent(html.replace('<head>', '<head>' + stub));
    const out = [];
    const pump = async () => {
        const asked = await page.evaluate(() => window.__posted.splice(0));
        for (const m of asked) if (String(m.command).startsWith('routes')) handleRoutesMessage(m, deps(rom, out));
        for (const m of out.splice(0)) await page.evaluate((x) => window.postMessage(x, '*'), m);
        await page.waitForTimeout(50);
        return asked;
    };
    const shot = async (name) => { if (process.env.ROUTES_TAB_SHOT) await page.screenshot({ path: path.join(process.env.ROUTES_TAB_SHOT, 'routes-' + name + '.png') }); };
    await test('opening the tab draws the route: runs per room, checks marked', async () => {
        await page.click('.tab[data-tab="routes"]');
        await pump();
        assert.strictEqual(await page.locator('#rte-rail [data-rte-pick]').count(), 2);
        assert.strictEqual(await page.locator('#rte-mid .rte-run').count(), 4);
        assert.strictEqual(await page.locator('#rte-mid tr[data-rte-step]').count(), 9);
        if (rom) assert.strictEqual(await page.locator('#rte-mid td.rte-differs').count(), 2);
        assert.ok((await page.textContent('#rte-side')).includes('Open questions'));
        await shot('route');
    });
    await test('a step opens on the right; Map opens the Maps tab', async () => {
        await page.click('#rte-mid tr[data-rte-step="2"]');
        const side = await page.textContent('#rte-side');
        assert.ok(side.includes('Step 2'));
        if (rom) assert.ok(side.includes('15 Talons'));
        await shot('step');
        await page.click('#rte-side [data-rte-room]');
        assert.ok(await page.locator('.tab[data-tab="rooms"].tab-active').count() === 1);
        await page.click('.tab[data-tab="routes"]');
    });
    await test('filter and variant', async () => {
        await page.fill('#rte-search', 'gourd');
        assert.strictEqual(await page.locator('#rte-mid tr[data-rte-step]').count(), 2);
        await page.fill('#rte-search', '');
        await page.click('[data-rte-pick="any-percent/16-hbs"]');
        assert.ok((await page.textContent('#rte-mid')).includes('variant of Any%'));
        await page.click('#rte-side [data-rte-open]');
        assert.deepStrictEqual(await page.evaluate(() => window.__posted.pop()), { command: 'routesOpen', file: 'src/games/evermore/routes/data/any-percent.route.json' });
    });
    await test('no page errors', () => assert.deepStrictEqual(errors, []));
    await browser.close();
}

(async () => {
    await unit();
    const fs = require('fs');
    let rom = null;
    if (ROM && fs.existsSync(ROM)) { rom = fs.readFileSync(ROM); await romChecks(rom); } else console.log('\nRoutes tab ROM: no Evermore ROM — skipped');
    await dom(rom);
    console.log('\n' + passed + ' passed, ' + failed + ' failed');
    process.exit(failed ? 1 : 0);
})();
