// TODO port to TS (docs/todo/port-to-ts.md)
'use strict';
// Data tab (src/games/evermore/data-tab): the models against the ROM, the host, and the page in a
// browser answered by that same host. ROM-dependent checks skip without the Evermore ROM in the
// ROM library; browser checks skip without playwright. DATA_TAB_SHOT=<dir> saves a screenshot per view.

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { renderRadarHtml } = require('../../dist/games/evermore/memory/render-radar');
const { buildDataTabHtml, handleDataMessage } = require('../../dist/games/evermore/data-tab');

const ROM = require('../../dist/games').romPath('evermore');

let passed = 0, failed = 0;
async function test(name, fn) {
    try { await fn(); console.log('  ✓ ' + name); passed++; }
    catch (e) { console.error('  ✗ ' + name + '\n    ' + (e && e.stack || e)); failed++; }
}

function hostDeps(rom, posted) {
    const { readAllCharacters } = require('../../dist/games/evermore/sprites/character-model');
    const { characterThumbs } = require('../../dist/games/evermore/sprites/thumbnails');
    let chars = null;
    const characters = (r) => chars || (chars = readAllCharacters(r).map((c) => Object.assign(c, { thumbs: characterThumbs(r, c) })));
    return { post: (m) => posted.push(m), loadRom: () => rom, characters };
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
    await test('tables: XP per level, character stats, sine, boomerang orbit — decoded ones only', () => {
        assert.deepStrictEqual(ix.tables.map((t) => t.id), [
            'xp', 'stats', 'sine', 'boomerang', 'formula-costs', 'dog-forms', 'weapon-levels',
            'alchemy-growth', 'weapons', 'call-beads', 'font-widths', 'animate-records',
            'projectiles', 'formula-targets', 'armor', 'enemy-index', 'consumables',
            'formula-blocks', 'bazooka-ammo', 'formula-descriptions', 'projectile-routines',
            'formula-learned', 'rooms-table', 'contact-handlers', 'ai-behaviours',
            'animation-vm', 'formula-powers', 'script-opcodes-table', 'songs-table',
            'ring-item-icons', 'dte-digraphs', 'dog-growth', 'room-enter-scripts',
            'cast-spells', 'ingredients-table', 'dialogue-phrases', 'dialogue-mte-words',
            'sfx-script-table', 'sfx-attenuation'
        ]);
        const boy = ix.tables[1].rows[2];
        assert.strictEqual(boy[1], 'Boy');
        const xp = ix.tables[0];
        assert.deepStrictEqual(xp.rows.slice(0, 4).map((r) => [r[1], r[2]]), [[0, 0], [20, 35], [70, 115], [175, 271]]);
        assert.strictEqual(xp.rows[99][1], '$FFFFFF (cap)');
        const sine = ix.tables[2].chart.series[0].points;
        assert.deepStrictEqual([sine[0][1], sine[64][1], sine[128][1], sine[192][1], sine[256][1]], [0, 256, 0, -255, 0]);
        const orbit = ix.tables[3].chart.series[0].points;
        assert.deepStrictEqual(orbit[0], [128, 0]);
        assert.deepStrictEqual(orbit[64], [0, 64]);
        assert.strictEqual(ix.tables[4].rows.length, 35);
        assert.strictEqual(ix.tables[5].rows.length, 4);
        assert.strictEqual(ix.tables[6].rows.length, 16);
        assert.strictEqual(ix.tables[7].rows.length, 10);
        assert.strictEqual(ix.tables[8].rows.length, 15);
        assert.strictEqual(ix.tables[9].rows.length, 16);
        assert.strictEqual(ix.tables[10].rows.length, 95);
        assert.strictEqual(ix.tables[11].rows.length, 212);
        assert.strictEqual(ix.tables[12].rows.length, 21);
        assert.strictEqual(ix.tables[13].rows.length, 35);
        assert.strictEqual(ix.tables[14].rows.length, 40);
        assert.strictEqual(ix.tables[14].rows[0][1], 'Grass Vest');
        assert.strictEqual(ix.tables[14].rows[39][1], "Spot's Collar");
        assert.strictEqual(ix.tables[15].rows.length, 143);
        assert.strictEqual(ix.tables[16].rows.length, 8);
        assert.strictEqual(ix.tables[16].rows[0][1], 'Petal');
        assert.strictEqual(ix.tables[16].rows[0][2], 40);
        assert.strictEqual(ix.tables[17].rows.length, 35);
        assert.strictEqual(ix.tables[17].rows[0][1], 'Acid Rain');
        assert.strictEqual(ix.tables[17].rows[0][3], '$91:86F0');
        assert.strictEqual(ix.tables[18].rows.length, 3);
        assert.strictEqual(ix.tables[18].rows[0][1], 'Thunder Ball');
        assert.strictEqual(ix.tables[18].rows[0][2], '$C4:3A96');
        assert.strictEqual(ix.tables[19].rows.length, 35);
        assert.strictEqual(ix.tables[19].rows[0][1], 'Acid Rain');
        assert.strictEqual(ix.tables[19].rows[0][3], 'Showers enemies with acid');
        assert.strictEqual(ix.tables[20].rows.length, 10);
        assert.strictEqual(ix.tables[20].rows[0][1], 'Custom Trajectory');
        assert.strictEqual(ix.tables[21].rows.length, 35);
        assert.strictEqual(ix.tables[21].rows[0][1], 'Acid Rain');
        assert.strictEqual(ix.tables[21].rows[0][2], '$7E:2258');
        assert.strictEqual(ix.tables[22].rows.length, 127);
        assert.strictEqual(ix.tables[23].rows.length, 15);
        assert.strictEqual(ix.tables[23].rows[0][3], 'Plain Melee');
        assert.strictEqual(ix.tables[24].rows.length, 15);
        assert.strictEqual(ix.tables[24].rows[0][3], 'CHASE');
        assert.strictEqual(ix.tables[25].rows.length, 103);
        assert.strictEqual(ix.tables[25].rows[0][3], 'nop');
        assert.strictEqual(ix.tables[26].rows.length, 35);
        assert.strictEqual(ix.tables[26].rows[0][1], 'Acid Rain');
        assert.strictEqual(ix.tables[26].rows[0][2], 17);
        assert.strictEqual(ix.tables[27].rows.length, 195);
        assert.strictEqual(ix.tables[27].rows[0][1], '$00');
        assert.strictEqual(ix.tables[28].rows.length, 71);
        assert.strictEqual(ix.tables[28].rows[0][2], 'Main Title');
        assert.strictEqual(ix.tables[29].rows.length, 162);
        assert.strictEqual(ix.tables[30].rows.length, 64);
        assert.strictEqual(ix.tables[30].rows[0][4], 'e ');
        assert.strictEqual(ix.tables[31].rows.length, 99);
        assert.strictEqual(ix.tables[31].rows[0][0], 1);
        assert.strictEqual(ix.tables[32].rows.length, 127);
        assert.strictEqual(ix.tables[33].rows.length, 23);
        assert.strictEqual(ix.tables[33].rows[0][2], 'Acid Rain');
        assert.strictEqual(ix.tables[34].rows.length, 22);
        assert.strictEqual(ix.tables[34].rows[0][2], 'Wax');
        assert.strictEqual(ix.tables[35].rows.length, 256);
        assert.strictEqual(ix.tables[35].rows[0][2], 'about');
        assert.strictEqual(ix.tables[36].rows.length, 63);
        assert.strictEqual(ix.tables[36].rows[0][2], 'alchemy');
        assert.strictEqual(ix.tables[37].rows.length, 112);
        assert.strictEqual(ix.tables[38].rows.length, 181);
        assert.strictEqual(ix.tables[38].rows[0][1], 255);
    });
    await test('enums: only lists read from the ROM or a knowledge entry', () => {
        assert.deepStrictEqual(ix.enums.map((e) => e.id), [
            'blobs', 'fields', 'contact', 'ai', 'formulas', 'cast', 'ingredients', 'rooms',
            'wram-states', 'directions', 'collision', 'status-effects', 'weapon-classes',
            'ring-icons', 'music', 'sounds', 'opcodes', 'call-beads-enum', 'targeting-modes',
            'armor-items', 'currencies', 'consumables-enum', 'stamina-tiers', 'charms-enum',
            'bazooka-ammo-enum', 'companion-ai-states', 'projectile-routines-enum',
            'projectile-behaviors', 'formula-learned-flags', 'anim-opcodes', 'formula-powers-enum',
            'camera-scroll-modes', 'window-states', 'audio-fade-states', 'room-load-states',
            'choice-box-states', 'apu-seq-status', 'dialogue-control-codes', 'apu-ipc-commands'
        ]);
        const e = (id) => ix.enums.find((x) => x.id === id);
        assert.ok(e('blobs').entries.some((x) => x.cells[0] === 'WRAM' && x.cells[2] === '$7E0A26'));
        assert.ok(!e('blobs').entries.some((x) => /ENTITY_/.test(x.cells[1])), 'no unverified entity slots');
        assert.strictEqual(e('blobs').entries.filter((x) => x.cells[0] === 'ROM').length, 142);
        assert.strictEqual(e('contact').entries.length, 15);
        assert.strictEqual(e('contact').entries[0].cells[3], '127 records');
        assert.strictEqual(e('formulas').entries[0].cells[1], 'Acid Rain');
        assert.strictEqual(e('formulas').entries[34].cells[1], 'Super Heal');
        assert.strictEqual(e('formulas').entries[0].detail[0][1], 'Showers enemies with acid');
        assert.deepStrictEqual(e('cast').entries.slice(0, 2).map((x) => x.cells[1]), ['Acid Rain', 'Flash']);
        assert.strictEqual(e('cast').entries.length, 23);
        assert.deepStrictEqual([e('ingredients').entries[0].cells[1], e('ingredients').entries[21].cells[1]], ['Wax', 'Acorn']);
        assert.strictEqual(e('rooms').entries[0x38].cells[3], '$DE8000');
        assert.ok(e('fields').entries.some((x) => x.cells[0] === '+$30'));
        assert.strictEqual(e('call-beads-enum').entries.length, 16);
        assert.strictEqual(e('targeting-modes').entries.length, 11);
        assert.strictEqual(e('armor-items').entries.length, 40);
        assert.strictEqual(e('currencies').entries.length, 4);
        assert.strictEqual(e('consumables-enum').entries.length, 8);
        assert.strictEqual(e('stamina-tiers').entries.length, 5);
        assert.strictEqual(e('charms-enum').entries.length, 14);
        assert.strictEqual(e('charms-enum').entries[0].cells[1], 'Armor Polish');
        assert.strictEqual(e('bazooka-ammo-enum').entries.length, 3);
        assert.strictEqual(e('bazooka-ammo-enum').entries[0].cells[1], 'Thunder Ball');
        assert.strictEqual(e('companion-ai-states').entries.length, 15);
        assert.strictEqual(e('companion-ai-states').entries[0].cells[2], 'Follow');
        assert.strictEqual(e('projectile-routines-enum').entries.length, 10);
        assert.strictEqual(e('projectile-behaviors').entries.length, 4);
        assert.strictEqual(e('formula-learned-flags').entries.length, 35);
        assert.strictEqual(e('anim-opcodes').entries.length, 103);
        assert.strictEqual(e('anim-opcodes').entries[0].cells[2], 'nop');
        assert.strictEqual(e('formula-powers-enum').entries.length, 35);
        assert.strictEqual(e('formula-powers-enum').entries[0].cells[1], 'Acid Rain');
        assert.strictEqual(e('formula-powers-enum').entries[0].cells[2], '17');
        assert.strictEqual(e('camera-scroll-modes').entries.length, 3);
        assert.strictEqual(e('window-states').entries.length, 4);
        assert.strictEqual(e('audio-fade-states').entries.length, 3);
        assert.strictEqual(e('room-load-states').entries.length, 4);
    });
    await test('palettes: the sprite palettes in bank $90 with their users, the map tile families', () => {
        const sprites = ix.palettes.filter((p) => p.id.startsWith('s:'));
        assert.ok(sprites.length > 100);
        assert.ok(sprites.every((p) => p.colors.length === 16));
        assert.ok(sprites.some((p) => p.users.some((u) => /Boy Name/.test(u.name))));
        assert.ok(ix.palettes.filter((p) => p.id.startsWith('m:')).every((p) => p.users.length > 0));
        const posted = [];
        handleDataMessage({ command: 'dataPaletteSamples', family: 0xe2 }, hostDeps(rom, posted));
        assert.deepStrictEqual(posted[0].samples.map((x) => [x.room, x.slot]), [[0x44, 0], [0x44, 4]]);
        assert.ok(posted[0].samples.every((x) => x.images.length > 0));
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
        for (const m of asked) if (String(m.command).startsWith('data')) handleDataMessage(m, deps);
        for (const m of out.splice(0)) await page.evaluate((x) => window.postMessage(x, '*'), m);
        await page.waitForTimeout(50);
        return asked;
    };
    const shot = async (name) => { if (process.env.DATA_TAB_SHOT) await page.screenshot({ path: path.join(process.env.DATA_TAB_SHOT, 'data-' + name + '.png') }); };
    await test('opening the tab loads every list; XP is drawn with both series', async () => {
        await page.click('.tab[data-tab="data"]');
        await pump();
        assert.strictEqual(await page.locator('#dat-rail [data-dat-pick]').count(), 39);
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
    await test('enums: rooms list every room; an entry opens on the right', async () => {
        await page.click('[data-dat-view="enums"]');
        await page.click('[data-dat-pick="rooms"]');
        assert.strictEqual(await page.locator('#dat-mid tr[data-dat-row]').count(), 127);
        await page.click('#dat-mid tr[data-dat-row="56"]');
        assert.ok((await page.textContent('#dat-side')).includes('$DE8000'));
        await page.click('#dat-side [data-dat-vfs]');
        assert.deepStrictEqual(await page.evaluate(() => window.__posted.pop()), { command: 'openVfs', uri: 'soe://bus/de8000' });
        await page.fill('#dat-search', 'Super Heal');
        assert.ok((await page.textContent('#dat-rail')).includes('Formulas'));
        await page.fill('#dat-search', '');
        await page.click('[data-dat-pick="cast"]');
        await shot('enums');
    });
    await test('palettes: 16 equal swatches; users as cards with a sprite or the room\'s tiles', async () => {
        await page.click('[data-dat-view="palettes"]');
        assert.strictEqual(await page.locator('#dat-mid .dat-sw').count(), 16);
        const sizes = await page.$$eval('#dat-mid .dat-sw i', (l) => [...new Set(l.map((i) => i.offsetWidth + 'x' + i.offsetHeight))]);
        assert.strictEqual(sizes.length, 1, 'one box size: ' + sizes);
        await page.click('[data-dat-pick="s:44299"]');
        assert.ok(await page.locator('#dat-side .dat-user img').count() > 0, 'the Boy\'s sprite');
        await shot('palettes');
        await page.click('[data-dat-pick="m:226"]');
        await pump();
        await page.waitForSelector('#dat-side .dat-tiles img');
        await shot('palettes-map');
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
