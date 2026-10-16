'use strict';
// Scripts tab (src/games/evermore/scripts-tab): the models against the ROM, the host with the
// injected sprites/music capabilities, and the page in a browser answered by
// that same host. ROM-dependent checks skip without the Evermore ROM in the ROM
// library; browser checks skip without playwright.

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { renderRadarHtml } = require('../../src/memory/render-radar');
const { buildScriptsTabHtml } = require('../../src/games/evermore/scripts-tab');

const ROM = require('../../dist/games').romPath('evermore');

let passed = 0, failed = 0;
async function test(name, fn) {
    try { await fn(); console.log('  ✓ ' + name); passed++; }
    catch (e) { console.error('  ✗ ' + name + '\n    ' + (e && e.stack || e)); failed++; }
}

function hostDeps(rom, posted) {
    const sprites = require('../../src/games/evermore/sprites');
    const music = require('../../src/games/evermore/music');
    let bundle = null;
    return {
        post: (m) => posted.push(m),
        loadRom: () => rom,
        animations: (r) => (bundle || (bundle = sprites.buildAnimationCatalog(r, sprites.readAllCharacters(r)))),
        renderAnimation: sprites.renderAnimation,
        music: {
            list: (r) => music.buildMusicModel(r).music,
            sequence: music.trackSequence,
            timeline: music.trackTimeline,
        },
    };
}

async function unit() {
    console.log('\nScripts tab — unit');
    await test('scaffold has the four views and the three columns', () => {
        const html = buildScriptsTabHtml();
        for (const v of ['room', 'anim', 'alchemy', 'music']) assert.ok(html.includes('data-scr-view="' + v + '"'), v);
        for (const id of ['scr-rail', 'scr-mid', 'scr-side']) assert.ok(html.includes('id="' + id + '"'), id);
    });
    await test('the radar page carries the tab and its script', () => {
        const html = renderRadarHtml({ kind: 'function', name: 'f', startLine: 0, endLine: 1 }, new Map(), [], new Map(), new Map(), [], 'radar', null);
        assert.ok(html.includes('data-tab="scripts"'));
        assert.ok(html.includes('function setupScriptsTab'));
        assert.ok(!html.includes('__SCRIPTS_JS__'));
    });
}

async function romChecks(rom) {
    console.log('\nScripts tab — ROM');
    const rooms = require('../../src/games/evermore/scripts-tab/model/rooms');
    const { alchemyModel } = require('../../src/games/evermore/scripts-tab/model/alchemy');
    const music = require('../../src/games/evermore/music');

    await test('every room decodes its scripts', () => {
        for (const r of rooms.roomList()) assert.ok(!rooms.roomScripts(rom, r.id).error, 'room ' + r.idHex);
    });
    await test("Fire Eyes' Village: 34 scripts, a step-on box in picture pixels", () => {
        const r = rooms.roomScripts(rom, 0x25);
        assert.strictEqual(r.scripts.length, 34);
        const s0 = r.scripts.find((s) => s.key === 'step:0');
        assert.strictEqual(s0.addrHex, '$94BEEA');
        assert.ok(s0.box.w > 0 && s0.box.h > 0 && s0.box.x >= 0 && s0.box.y >= 0);
        const p = rooms.roomPicture(rom, 0x25);
        assert.ok(p.uri.startsWith('data:image/png'));
        assert.ok(s0.box.x + s0.box.w <= p.width && s0.box.y + s0.box.h <= p.height);
    });
    await test('alchemy: 35 formulas, Acid Rain and Laser share $91:86F0, which names $583E', () => {
        const m = alchemyModel(rom);
        assert.strictEqual(m.formulas.length, 35);
        const acid = m.formulas.find((f) => f.name === 'Acid Rain');
        const laser = m.formulas.find((f) => f.name === 'Laser');
        assert.strictEqual(acid.blockHex, '$91:86F0');
        assert.strictEqual(laser.block, acid.block);
        assert.deepStrictEqual(acid.records.map((r) => r.recHex), ['$583E']);
        assert.ok(acid.records[0].effect);
        assert.strictEqual(m.effects.length, 33);
    });
    await test('music: every track has a sequence; Main Title has 8 tracks at $C231', () => {
        const list = music.buildMusicModel(rom).music;
        for (const t of list) assert.ok(music.trackSequence(rom, t.id), 'music ' + t.id);
        const s = music.trackSequence(rom, 0);
        assert.strictEqual(s.start, 0xC231);
        assert.strictEqual(s.tracks.length, 8);
        assert.deepStrictEqual(s.tracks.map((t) => t.aram), [0xC242, 0xC269, 0xC2A7, 0xC2E6, 0xC2FC, 0xC319, 0xC349, 0xC373]);
    });
    await test('music: Main Title plays silently on several voices', async () => {
        const tl = await music.trackTimeline(rom, 0, 10);
        assert.strictEqual(tl.frames, 600);
        assert.ok(new Set(tl.notes.map((n) => n.v)).size >= 5);
        assert.ok(tl.notes.every((n) => n.f1 > n.f0));
    });
    await test('host: index, room, animation and simulation answers', async () => {
        const { handleScriptsMessage } = require('../../src/games/evermore/scripts-tab');
        const posted = [];
        const deps = hostDeps(rom, posted);
        handleScriptsMessage({ command: 'scriptsInit' }, deps);
        const ix = posted.pop();
        assert.strictEqual(ix.command, 'scriptsIndex');
        assert.strictEqual(ix.animations.length, 783);
        assert.strictEqual(ix.formulas.length, 35);
        assert.strictEqual(ix.music.length, 70);
        handleScriptsMessage({ command: 'scriptsAnim', key: 'k', record: 0x583E, facing: 8 }, deps);
        const a = posted.pop();
        assert.ok(a.anim && a.anim.frames.length > 0 && a.anim.frames[0].png.startsWith('data:image/png'));
        handleScriptsMessage({ command: 'scriptsSim', room: 0x25, key: 'step:0' }, deps);
        const sim = posted.pop();
        assert.ok(/fun step_on_0\(\)/.test(sim.everscript.text));
        assert.deepStrictEqual(sim.clusters.map((c) => c.kind), ['loot', 'transition', 'dialog']);
    });
}

async function dom(rom) {
    let chromium;
    try { ({ chromium } = require('playwright')); } catch { console.log('\nScripts tab DOM: playwright not installed — skipped'); return; }
    let browser;
    try { browser = await chromium.launch(); } catch (e) { console.log('\nScripts tab DOM: no browser — skipped'); return; }
    console.log('\nScripts tab — DOM');
    const { handleScriptsMessage } = require('../../src/games/evermore/scripts-tab');
    const page = await browser.newPage({ viewport: { width: 1500, height: 900 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    const stub = '<script>window.__posted=[];window.acquireVsCodeApi=function(){return{postMessage:function(m){window.__posted.push(m)},getState:function(){return null},setState:function(){}}};<\/script>';
    const html = renderRadarHtml({ kind: 'function', name: 'f', startLine: 0, endLine: 1 }, new Map(), [], new Map(), new Map(), [], 'radar', null);
    await page.setContent(html.replace('<head>', '<head>' + stub));
    const out = [];
    const deps = hostDeps(rom, out);
    // Answers what the page asked, as extension.js would.
    const pump = async () => {
        for (let round = 0; round < 20; round++) {
            const asked = await page.evaluate(() => window.__posted.splice(0).filter((m) => String(m.command).startsWith('scripts')));
            for (const m of asked) handleScriptsMessage(m, deps);
            await new Promise((r) => setTimeout(r, 30));
            const answers = out.splice(0);
            for (const m of answers) await page.evaluate((x) => window.postMessage(x, '*'), m);
            if (!asked.length && !answers.length) return;
        }
    };
    // SCRIPTS_TAB_SHOT=<dir> keeps a screenshot of each view there.
    const shot = async (name) => { if (process.env.SCRIPTS_TAB_SHOT) await page.screenshot({ path: path.join(process.env.SCRIPTS_TAB_SHOT, 'scripts-' + name + '.png') }); };
    await test('opening the tab loads the index', async () => {
        await page.click('.tab[data-tab="scripts"]');
        await pump();
        assert.ok(await page.locator('[data-scr-pick^="room:"]').count() > 100);
    });
    await test('a room shows its listing and its trigger boxes on the map', async () => {
        await page.click('[data-scr-pick="room:37"]');
        await pump();
        assert.strictEqual(await page.locator('.scr-map rect.scr-box').count(), 33);
        await page.click('.scr-map rect[data-scr-script="step:0"]');
        assert.ok((await page.textContent('#scr-mid')).includes('$94BEEA'));
    });
    await test('the Everscript toggle shows the simulation, Clusters groups the triggers', async () => {
        await page.check('[data-scr-toggle="everscript"]');
        await pump();
        assert.ok((await page.textContent('.scr-evs')).includes('fun step_on_0()'));
        await page.check('[data-scr-toggle="clusters"]');
        await pump();
        assert.ok((await page.textContent('.scr-chips')).includes('20 pickups'));
        await shot('everscript');
    });
    await test('an animation record plays on the right', async () => {
        await page.click('[data-scr-view="anim"]');
        await page.fill('#scr-search', '583E');
        await page.click('[data-scr-pick="record:22590"]');
        await pump();
        await page.waitForFunction(() => { const i = document.getElementById('scr-anim-img'); return i && i.src.startsWith('data:image/png'); });
        assert.ok(await page.locator('.scr-anim-rows tr.scr-lit').count() > 0);
        await shot('animation');
    });
    await test('an alchemy formula shows its block and plays the record it names', async () => {
        await page.fill('#scr-search', '');
        await page.click('[data-scr-view="alchemy"]');
        await page.click('[data-scr-pick="formula:0"]');
        await pump();
        assert.ok((await page.textContent('#scr-mid')).includes('$91:86F0'));
        assert.strictEqual(await page.locator('.scr-word.scr-rec').count(), 1);
        await page.waitForFunction(() => { const i = document.getElementById('scr-anim-img'); return i && i.src.startsWith('data:image/png'); });
        await shot('alchemy');
    });
    await test('a music track shows its sequence and the silent player', async () => {
        await page.click('[data-scr-view="music"]');
        await page.click('[data-scr-pick="track:0"]');
        await pump();
        await page.waitForSelector('#scr-lanes');
        assert.strictEqual(await page.locator('.scr-track').count(), 8);
        await page.click('[data-scr-mplay]');
        await page.waitForTimeout(400);
        const t = parseFloat(await page.textContent('#scr-mtime'));
        assert.ok(t > 0.1, 'playhead moved: ' + t);
        await shot('music');
    });
    await test('no page errors', () => assert.deepStrictEqual(errors, []));
    await browser.close();
}

(async () => {
    await unit();
    if (!fs.existsSync(ROM)) console.log('\nScripts tab — ROM: no ROM, skipped');
    else {
        const rom = fs.readFileSync(ROM);
        await romChecks(rom);
        await dom(rom);
    }
    console.log(`\n${passed} passed, ${failed} failed`);
    process.exit(failed ? 1 : 0);
})();
