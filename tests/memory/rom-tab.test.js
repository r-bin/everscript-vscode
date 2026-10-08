'use strict';
// The ROM tab (src/rom): the model against the vanilla ROM, the reader lookup
// on synthetic xrefs, and the real panel page driven in a browser.
// ROM-dependent checks skip without the ROM; browser checks skip without playwright.

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const { buildRomModel } = require('../../src/rom');
const { readersOf } = require('../../src/rom/model/readers');
const { parseWikiPoints, mergePoints } = require('../../src/rom/model/wiki-overlay');
const { renderRadarHtml } = require('../../src/memory/render-radar');

let passed = 0, failed = 0;
const check = (name, fn) => {
    try { fn(); console.log('  ✓ ' + name); passed++; }
    catch (e) { console.error('  ✗ ' + name + '\n    ' + (e.stack || e.message)); failed++; }
};

const romPath = path.join(__dirname, '..', '..', 'script_parser', 'dependencies', 'Secret of Evermore (U) [!].smc');
const rom = fs.existsSync(romPath) ? fs.readFileSync(romPath) : null;

console.log('ROM tab model:');

check('wiki §4 point rows are parsed; built-in names win on the same address', () => {
    const md = '| $8C:805B | — | 🧠 Wiki name | | n |\n| $90:1234 | — | 📋 New table | 🦖 Prehistoria | from the wiki |\n| $90:1234 | 12 | 📋 Sized | | x |';
    const wiki = parseWikiPoints(md);
    assert.strictEqual(wiki.length, 2);
    assert.deepStrictEqual(wiki[1], { bus: 0x901234, cat: '📋', name: 'New table', notes: 'from the wiki' });
    const merged = mergePoints([{ bus: 0x8C805B, cat: '🧠', name: 'Built in', notes: '' }], wiki);
    assert.deepStrictEqual(merged.map(p => p.name), ['Built in', 'New table']);
});

check('readers: exact ROM xrefs grouped by PC, bulk ranges included, other spaces ignored', () => {
    const key = (pc, space, addr) => pc * 0x4000000 + ((space << 24) | addr);
    const xrefs = new Map([[key(0x8CC898, 1, 0x2E0003), 1], [key(0x8CC898, 1, 0x2E0004), 1], [key(0x80A000, 1, 0x2E0010), 0x21], [key(0x80A000, 0, 0x2E0010), 1]]);
    const stats = new Map([[(1 << 24) | 0x90AAAA, { count: 500, lo: 0x2E0000, hi: 0x2E4FFF, flags: 1 }],
        [(1 << 24) | 0x8CC9C0, { count: 9000, lo: 0x000000, hi: 0x2FFFFF, flags: 1 }]]);
    const { readers: r, wide } = readersOf(xrefs, stats, 0x2E0000, 0x2E0020, [{ s: 0x0CC88C, name: 'Load map graphic' }]);
    assert.deepStrictEqual(r.map(x => x.pc), ['$8C:C898', '$80:A000', '$90:AAAA'], 'exact first, then ranges inside the half');
    assert.strictEqual(wide, 1, 'the ROM-wide range is counted, not listed');
    const load = r.find(x => x.pc === '$8C:C898');
    assert.strictEqual(load.bytes, 2);
    assert.strictEqual(load.where, 'Load map graphic +$0C');
    assert.ok(r.find(x => x.pc === '$80:A000').dma);
    assert.ok(r.find(x => x.pc === '$90:AAAA').bulk);
});

check('a non-Evermore ROM still gets halves, header and gaps', () => {
    const fake = new Uint8Array(0x20000).fill(0x42);
    const m = buildRomModel(fake);
    assert.strictEqual(m.evermore, false);
    assert.strictEqual(m.halves.length, 4);
    assert.ok(m.halves[1].rows.some(r => r.name === 'Interrupt vectors'));
});

let model = null;
if (!rom) console.log('  - vanilla ROM not found, ROM checks skipped');
else {
    const rooms = new Map([[0x48, { name: 'Metroplex tunnels', area: 'Omnitopia' }]]);
    model = buildRomModel(rom, { rooms, cdl: null });
    const rows = model.halves.flatMap(h => h.rows);
    check('vanilla: 96 halves, no errors, ~92% claimed', () => {
        assert.strictEqual(model.halves.length, 96);
        assert.deepStrictEqual(model.errors, []);
        assert.ok(model.totals.mapped / model.size > 0.9, String(model.totals.mapped));
    });
    check('vanilla: all 127 rooms, none overlapping another region', () => {
        const roomRows = rows.filter(r => /^ROOM_/.test(r.name));
        assert.strictEqual(new Set(roomRows.map(r => r.room)).size, 127);
        assert.ok(!rows.some(r => r.warn), rows.filter(r => r.warn).map(r => r.addr + ' ' + r.name).join(', '));
    });
    check('vanilla: room 0x48 sits at $9F:D4E3 with its world', () => {
        const r = rows.find(x => x.room === 0x48);
        assert.strictEqual(r.addr, '$9F:D4E3');
        assert.strictEqual(r.area, '🚀 Omnitopia');
    });
    check('vanilla: slot 0x7F is the start of map graphic 1317', () => {
        assert.ok(rows.find(x => x.addr === '$9F:FFE3').notes.includes('map graphic 1317'));
    });
    check('vanilla: no row crosses a 32 KB half', () => {
        for (const h of model.halves) for (const r of h.rows) if (r.n) assert.ok(r.a >= h.lo && r.a + r.n <= h.lo + 0x8000, r.addr);
    });
    check('vanilla: every half accounts for all 32 KB', () => {
        for (const h of model.halves) assert.strictEqual(h.rows.reduce((s, r) => s + (r.n || 0), 0), 0x8000);
    });
    check('vanilla: audio fills $82..$89 upper halves completely', () => {
        for (let b = 2; b <= 9; b++) assert.strictEqual(model.halves[b * 2 + 1].mapped, 0x8000, 'bank ' + b);
    });
    check('vanilla with a CDL: gaps that executed become unnamed code', () => {
        const cdl = new Uint8Array(rom.length);
        cdl.fill(1, 0x00BC00, 0x00BD00);
        const m = buildRomModel(rom, { cdl });
        const gap = m.halves[1].rows.find(r => r.a <= 0x00BC00 && r.a + r.n > 0x00BC00);
        assert.strictEqual(gap.gap, 'code');
        assert.strictEqual(gap.cdl.code, 0x100);
        assert.ok(m.hasCdl && m.halves[1].cdlStrip.length > 1);
    });
}

async function dom() {
    let chromium;
    try { ({ chromium } = require('playwright')); } catch { console.log('\nROM tab DOM: playwright not installed — skipped'); return; }
    let browser;
    try { browser = await chromium.launch(); } catch (e) { console.log('\nROM tab DOM: no browser — skipped'); return; }
    console.log('\nROM tab DOM:');
    const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    // The VS Code API stub goes into the page itself: setContent runs no init scripts.
    const stub = '<script>window.__posted=[];window.acquireVsCodeApi=function(){return{postMessage:function(m){window.__posted.push(m)},getState:function(){return null},setState:function(){}}};<\/script>';
    const html = renderRadarHtml({ kind: 'function', name: 'f', startLine: 0, endLine: 1 }, new Map(), [], new Map(), new Map(), [], 'radar', null);
    await page.setContent(html.replace('<head>', '<head>' + stub));
    const step = async (name, fn) => {
        try { await fn(); console.log('  ✓ ' + name); passed++; }
        catch (e) { console.error('  ✗ ' + name + '\n    ' + (e.stack || e.message)); failed++; }
    };
    await step('the ROM tab exists and asks the host once when first shown', async () => {
        await page.click('.tab[data-tab="rom"]');
        await page.click('.tab[data-tab="rom"]');
        const asks = await page.evaluate(() => window.__posted.filter(m => m.command === 'romMapRequest').length);
        assert.strictEqual(asks, 1);
        assert.strictEqual(await page.evaluate(() => getComputedStyle(document.querySelector('.rom-pane')).display), 'flex');
    });
    const m = model || buildRomModel(new Uint8Array(0x20000).fill(0x42));
    await page.evaluate(mm => window.postMessage({ command: 'romMap', model: mm, hasXrefs: false }, '*'), m);
    await page.waitForSelector('.rom-half');
    await step('one strip per half, the first one selected', async () => {
        assert.strictEqual(await page.locator('.rom-half[data-rom-half]').count(), m.halves.length);
        assert.strictEqual(await page.locator('.rom-half.rom-sel').getAttribute('data-rom-half'), '0');
    });
    await step('the CDL layer is disabled without a CDL library', async () => {
        assert.ok(await page.locator('[data-rom-layer="cdl"]').isDisabled());
    });
    if (model) {
        await step('clicking a strip shows that half (inner segment click walks up)', async () => {
            await page.click('.rom-half[data-rom-half="63"] i');
            assert.match(await page.textContent('.rom-h2'), /\$9F:8000/);
            assert.ok(await page.locator('.rom-tr', { hasText: 'ROOM_48' }).count() === 1);
        });
        await step('an address search selects the half and opens the row', async () => {
            await page.click('.rom-half[data-rom-half="0"]');
            await page.fill('#rom-search', '$9F:D600');
            assert.match(await page.textContent('.rom-h2'), /\$9F:8000/);
            assert.ok(await page.locator('.rom-tr.rom-open', { hasText: 'ROOM_48' }).count() === 1);
            assert.ok(await page.locator('[data-rom-goto-room="72"]').count() === 1);
        });
        await step('a text search lists matches across the ROM; a click jumps there', async () => {
            await page.fill('#rom-search', 'Character table');
            await page.click('[data-rom-jump]');
            assert.match(await page.textContent('.rom-h2'), /\$8E:8000/);
        });
    }
    await step('no page errors', async () => assert.deepStrictEqual(errors, []));
    await browser.close();
}

dom().then(() => {
    console.log(`\n${passed} passed, ${failed} failed`);
    if (failed) process.exit(1);
});
