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
const { parseRoute, routeViews } = require('../../dist/games/evermore/routes/model/route');

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
            { room: '0x38', kind: 'exit', action: 'go' }, { room: 'zz', kind: 'wait', action: 'w' }, { room: 56, kind: 'loot', action: 'take', at: 'b1', talons: 3 }, { room: 56, kind: 'loot', action: 't', at: 'x9' },
        ] }, 'x');
        assert.deepStrictEqual(route.steps.map((s) => s.kind), ['exit', 'loot', 'loot']);
        assert.strictEqual(route.steps[1].at, 'b1');
        assert.strictEqual(problems.length, 3);
    });
    await test('views: the state carried; a variant shares the prefix', () => {
        const { route } = parseRoute({ id: 'r', title: 'R', start: { room: 1 }, steps: [
            { room: 1, kind: 'fight', action: 'a', talons: 5 }, { room: 1, kind: 'wait', action: 'b' }, { room: 1, kind: 'fight', action: 'c', talons: 2 },
        ], variants: [{ id: 'v', title: 'V', after: 2, steps: [{ room: 1, kind: 'wait', action: 'd' }] }, { id: 'w', title: 'W' }] }, 'x');
        const [base, v, w] = routeViews(route, names, () => undefined);
        assert.deepStrictEqual(base.steps.map((s) => s.after.talons), [5, 5, 7]);
        assert.strictEqual(base.totals.talons, 7);
        assert.deepStrictEqual(v.steps.map((s) => [s.action, s.inherited]), [['a', true], ['b', true], ['d', false]]);
        assert.strictEqual(w.totals.steps, 3);
        assert.strictEqual(v.id, 'r/v');
    });
    await test('without a ROM the bundled draft loads, scripts not run', () => {
        const posted = [];
        handleRoutesMessage({ command: 'routesInit' }, deps(null, posted));
        const ix = posted[0];
        assert.strictEqual(ix.rom, false);
        assert.deepStrictEqual(ix.problems, []);
        assert.deepStrictEqual(ix.routes.map((r) => r.id), ['any-percent', 'any-percent/16-hbs']);
        assert.ok(ix.routes[0].steps.filter((s) => s.at).every((s) => s.verdict === 'none'));
    });
}

async function romChecks(rom) {
    console.log('\nRoutes tab — ROM');
    const posted = [];
    handleRoutesMessage({ command: 'routesInit' }, deps(rom, posted));
    const ix = posted[0], r = ix.routes[0];
    const step = (n) => r.steps[n - 1];
    await test('the Any% draft played against the room scripts', () => {
        assert.deepStrictEqual(r.steps.map((s) => s.verdict), ['none', 'differs', 'none', 'none', 'ok', 'none', 'differs', 'ok', 'none']);
        assert.deepStrictEqual(step(2).after.items, { PETAL: 1 }, 'the Petal gourd gives a Petal');
        assert.deepStrictEqual(step(2).after.opened, { 0x38: [0] });
        assert.strictEqual(step(5).after.room, 0x5c, 'the north exit, raptors not fought yet');
        assert.ok(/moved 0x5C → 0x51/.test(step(7).effects[0]), 'no script moves the party into the huts');
        assert.deepStrictEqual(step(9).after.items, { PETAL: 1, NECTAR: 1 });
        assert.strictEqual(step(9).after.talons, 2, 'only the drafted flower drop');
        assert.strictEqual(step(9).after.room, 0x25);
    });
    await test('room overlays: trigger boxes and spawns; a picture with the gourd opened', () => {
        const o = ix.rooms[0x38];
        assert.ok(o.triggers.some((t) => t.key === 'b1'));
        assert.strictEqual(o.spawns[7].name, 'Wimpy Flower');
        const out = [];
        handleRoutesMessage({ command: 'routesPicture', room: 0x38, opened: [] }, deps(rom, out));
        handleRoutesMessage({ command: 'routesPicture', room: 0x38, opened: [0] }, deps(rom, out));
        assert.strictEqual(out[0].width, 1328);
        assert.notStrictEqual(out[0].uri, out[1].uri, 'the opened gourd changes the picture');
    });
    await test('fight inputs from the ROM: the Wimpy Flower, the Bone Crusher, the Act 1 Dog', () => {
        const { fightFor } = require('../../dist/games/evermore/simulation/combat');
        const party = ix.routes[0].route.start.party;
        const { setup, inputs } = fightFor(rom.length % 0x8000 === 0x200 ? rom.subarray(0x200) : rom, party, { kind: 'fight', who: 'Both' }, 109, 'Wimpy Flower');
        const e = setup.enemy;
        assert.deepStrictEqual([e.hp, e.atk, e.def, e.evade, e.hitRate, e.chargeSpeed, e.chance], [18, 9, 28, 0, 40, 15, 5]);
        assert.deepStrictEqual(e.swing, { ticks: 34, strikeAt: 6 });
        assert.deepStrictEqual(e.knockback, { ticks: 1, random: { base: 40, range: 40 } }, 'sleep_random(40, 40)');
        assert.deepStrictEqual(setup.party.map((p) => p.f.swing), [{ ticks: 24, strikeAt: 5 }, { ticks: 33, strikeAt: 12 }]);
        assert.deepStrictEqual(setup.party[0].f.knockback, { ticks: 54, random: { base: 8, range: 40 } });
        const hit = Object.fromEntries(inputs.pairs.map((p) => [p.from + '>' + p.to, Math.round(p.hit * 1000) / 10]));
        assert.deepStrictEqual(hit, { 'Boy>Wimpy Flower': 100, 'Wimpy Flower>Boy': 58.8, 'Dog>Wimpy Flower': 100, 'Wimpy Flower>Dog': 54.3 });
    });
    await test('step 3 and step 4 simulated', () => {
        const out = [];
        handleRoutesMessage({ command: 'routesFight', route: 'any-percent', n: 3 }, deps(rom, out));
        handleRoutesMessage({ command: 'routesFight', route: 'any-percent', n: 4 }, deps(rom, out));
        const [kill, death] = out;
        assert.strictEqual(kill.report.seconds.best, 13 / 60);
        assert.ok(kill.report.hits.find((h) => h[0] === 2)[1] / kill.report.runs > 0.7, 'two hits kill most of the time');
        assert.deepStrictEqual(death.report.hits.map((h) => h[0]), [3, 4, 5]);
        assert.ok(death.report.seconds.stats.median > 5 && death.report.seconds.stats.median < 40);
    });
    return ix;
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
    const waitPicture = async () => { for (let i = 0; i < 20 && !(await page.locator('#rte-map img').count()); i++) await pump(); };
    await test('opening the tab: state, steps, the room drawn with its triggers', async () => {
        await page.click('.tab[data-tab="routes"]');
        await pump();
        assert.strictEqual(await page.locator('#rte-rail [data-rte-pick]').count(), 2);
        assert.strictEqual(await page.locator('#rte-mid tr[data-rte-step]').count(), 9);
        assert.ok((await page.textContent('.rte-state')).includes('After step 1 of 9'));
        if (!rom) return;
        await waitPicture();
        assert.ok(await page.locator('#rte-map rect[data-rte-key="b1"]').count() === 1);
        await shot('step1');
    });
    await test('next: the Petal gourd looted, its box lit, the gourd drawn opened', async () => {
        await page.click('[data-rte-go="1"]');
        await pump();
        await waitPicture();
        const state = await page.textContent('.rte-state');
        assert.ok(state.includes('After step 2'));
        if (!rom) return;
        assert.ok(/Petal\s*1/.test(state));
        assert.ok(state.includes('Gourd in south Jungle'));
        assert.ok(await page.locator('#rte-map rect.rte-lit[data-rte-key="b1"]').count() === 1);
        await shot('step2');
    });
    await test('keys step through; hover outlines another step\'s target', async () => {
        await page.keyboard.press('ArrowRight');
        assert.ok((await page.textContent('.rte-state')).includes('After step 3'));
        if (rom) {
            await pump(); await waitPicture();
            assert.ok(await page.locator('#rte-map circle.rte-lit[data-rte-enemy="7"]').count() === 1);
            await page.hover('#rte-mid tr[data-rte-step="5"]');
            assert.ok(await page.locator('#rte-map rect.rte-hov[data-rte-key="step0"]').count() === 1);
            await shot('step3-hover5');
        }
        await page.keyboard.press('ArrowLeft');
        assert.ok((await page.textContent('.rte-state')).includes('After step 2'));
    });
    await test('simulate: the fight panel replaces the map, Map ↩ brings it back', async () => {
        if (!rom) return;
        await page.click('#rte-mid [data-rte-sim="3"]');
        await pump(); await pump();
        assert.ok(await page.locator('#rte-side .rte-fchart rect.rte-fbar').count() > 0);
        assert.ok((await page.textContent('#rte-side')).includes('fastest of'));
        await shot('sim-kill');
        await page.keyboard.press('ArrowRight');
        await pump(); await pump();
        assert.ok((await page.textContent('#rte-side')).includes('Time until it dies'));
        await shot('sim-death');
        await page.click('#rte-side [data-rte-sim="0"]');
        await pump(); await waitPicture();
        assert.ok(await page.locator('#rte-map img').count() === 1);
    });
    await test('Maps ↗ opens the Maps tab; filter; variant; notes link', async () => {
        await page.click('#rte-side [data-rte-room]');
        assert.ok(await page.locator('.tab[data-tab="rooms"].tab-active').count() === 1);
        await page.click('.tab[data-tab="routes"]');
        await page.fill('#rte-search', 'flower');
        assert.strictEqual(await page.locator('#rte-mid tr[data-rte-step]').count(), 2);
        await page.fill('#rte-search', '');
        await page.click('[data-rte-pick="any-percent/16-hbs"]');
        assert.ok((await page.textContent('#rte-mid')).includes('variant of Any%'));
        await page.click('.rte-notes summary');
        await page.click('.rte-notes [data-rte-open]');
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
