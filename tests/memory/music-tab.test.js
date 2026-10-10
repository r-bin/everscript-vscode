'use strict';
// The Music tab (src/music): the ROM model, the tab's own sound engine driving
// the ROM's driver, the emulator core's sound-chip stream (real core, real page
// script, real host class) and the panel page in a browser.
// ROM-dependent checks skip without the ROM; browser checks skip without playwright.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const ROOT = path.join(__dirname, '..', '..');
const { buildMusicModel, packageData } = require('../../src/music/model/catalog');
const { handlesMusicMessage, handleMusicMessage } = require('../../src/music');
const createSpcEngine = require('../../src/music/engine/spc-engine.js');
const { MusicSpc } = require('../../src/music/webview/music-engine.js');
const V = require('../../src/music/webview/music-view.js');
const { ApuStream } = require('../../src/emulator/apu-stream');
const { getApuStreamClientScript } = require('../../src/emulator/apu-stream-view');
const { renderRadarHtml } = require('../../src/memory/render-radar');

let passed = 0, failed = 0;
const step = async (name, fn) => {
    try { await fn(); console.log('  ✓ ' + name); passed++; }
    catch (e) { console.error('  ✗ ' + name + '\n    ' + (e.stack || e.message)); failed++; }
};

const romPath = path.join(ROOT, 'script_parser', 'dependencies', 'Secret of Evermore (U) [!].smc');
const rom = fs.existsSync(romPath) ? fs.readFileSync(romPath) : null;

/** Peak and RMS of `secs` seconds of the engine's output. */
function listen(spc, secs) {
    let peak = 0, sum = 0, n = 0;
    for (let i = 0; i < secs * 1000 / 16; i++) for (const x of spc.run(512 * 32)) { peak = Math.max(peak, Math.abs(x)); sum += x * x; n++; }
    return { peak, rms: Math.sqrt(sum / n), n };
}

async function freshTrack(model, music) {
    const spc = new MusicSpc(await createSpcEngine());
    spc.boot(model.driver, packageData(rom, 0));
    spc.playMusic(music, packageData(rom, model.music[music].package));
    return spc;
}

async function modelAndEngine() {
    console.log('Music tab model and engine:');
    await step('the host only takes music* messages and needs a ROM', async () => {
        assert.ok(handlesMusicMessage('musicInit') && !handlesMusicMessage('romMapRequest'));
        const sent = [];
        handleMusicMessage({ command: 'musicInit' }, { post: m => sent.push(m), loadRom: () => null, apu: { isOpen: () => false } });
        assert.match(sent[0].model.error, /ROM not found/);
        assert.deepStrictEqual(sent[1], { command: 'musicEmulator', open: false });
    });
    if (!rom) { console.log('  (ROM not found — ROM checks skipped)'); return null; }
    const model = buildMusicModel(rom);
    await step('model: 70 tracks, 90 driver sound effects, 71 packages, the driver at $0700', async () => {
        assert.strictEqual(model.music.length, 70);
        assert.strictEqual(model.sfx.length, 90);
        assert.strictEqual(model.packages.length, 71);
        assert.strictEqual(model.driver.entry, 0x0700);
        assert.strictEqual(model.driver.blocks[0].bytes.length, 0x17E0);
        assert.ok(model.music.every(m => m.package === m.id + 1), 'music M uses package M+1');
        assert.strictEqual(model.sfx.filter(s => !s.package).length, 62);
    });
    await step('model: sound effects carry their package and the sound() ids that reach them', async () => {
        const { animations, ...explosion } = model.sfx[0x42];
        assert.deepStrictEqual(explosion, { id: 0x42, package: 0x43, scripts: [0x64], name: 'Explosion' });
        assert.deepStrictEqual(animations, []);
        assert.deepStrictEqual(model.sfx[0x56].scripts, [0x6E]);
        assert.notStrictEqual(model.sfx[0x03].name, 'None', 'script id 0 names no effect');
    });
    await step('engine: boots the ROM driver and plays Main Title (all voices of the song)', async () => {
        const spc = await freshTrack(model, 0);
        const out = listen(spc, 4);
        assert.strictEqual(out.n, 4 * 64000, 'exactly 32 kHz stereo');
        assert.ok(out.rms > 1000, 'rms ' + out.rms);
        assert.strictEqual(spc.view()[32 + 0x5D], 0x02, 'the driver sets DIR = $02');
        assert.ok(V.muVoices(spc.view()).some(v => v.keyed && v.envx > 0));
    });
    await step('engine: music volume 0 mutes the song, a sound effect still sounds', async () => {
        const spc = await freshTrack(model, 0x05);
        listen(spc, 2);
        spc.setMusicVolume(0);
        listen(spc, 1);
        assert.ok(listen(spc, 1).peak < 64, 'muted');
        spc.playSfx(0x01);
        assert.ok(listen(spc, 1).peak > 1000, 'sound effect');
    });
    await step('engine: a chip snapshot (view + ARAM) continues the song in a second chip', async () => {
        const a = await freshTrack(model, 0x3A);
        listen(a, 2);
        const b = new MusicSpc(await createSpcEngine());
        b.loadView(a.view(), Uint8Array.from(a.ram()));
        assert.ok(listen(b, 2).rms > 500);
        b.playSfx(0x01);
    });
    await step('model: animations name who plays an effect; the Boy\'s weapon swing is an attack', async () => {
        const swing = model.sfx[0x07];
        assert.ok(swing.animations.some(a => a.who === 'Bone Crusher' && a.attack), 'Bone Crusher swings with $07');
        assert.ok(swing.animations.some(a => a.who === 'Horn Spear' && a.attack), 'spears too');
        assert.strictEqual(V.muSfxCategory(swing), 'attack');
        assert.strictEqual(V.muSfxCategory(model.sfx[0x01]), 'sfx', 'the ring menu is not an animation');
        assert.match(V.muSfxSource(swing), /^Bone Crusher, Gladiator Sword \+\d+$/);
    });
    await step('driver state: who owns each voice, which effect, and every queued command', async () => {
        const spc = await freshTrack(model, 0x05);
        listen(spc, 1);
        let drv = V.muDriverBytes(spc.ram());
        assert.strictEqual(drv.length, 89);
        let q = V.muDriverCommands(drv, -1);
        assert.ok(V.muDriverOwners(drv).some(o => o.kind === 'mus'), 'music tracks own voices');
        spc.playSfx(0x07); spc.playSfx(0x10);
        spc.run(17067);
        drv = V.muDriverBytes(spc.ram());
        const fired = V.muDriverCommands(drv, q.at).cmds;
        assert.deepStrictEqual(fired.map(c => [c.cmd, c.param & 0xFF]), [[0x04, 0x07], [0x04, 0x10]], 'both effects of one frame');
        const owners = V.muDriverOwners(drv);
        assert.deepStrictEqual([...new Set(owners.filter(o => o.kind === 'sfx').map(o => o.sfx))].sort((x, y) => x - y), [0x07, 0x10]);
        // The driver, not a fixed table, picks the voice: on this song $07 lands where the priority allows.
        // Dog Bark's voice stays $80 after it ends (until music takes it back); its countdown has wrapped.
        listen(spc, 3);
        assert.ok(V.muDriverOwners(V.muDriverBytes(spc.ram()), V.muVoices(spc.view())).every(o => o.kind !== 'sfx'), 'effects end');
    });
    await step('view helpers: instruments and ARAM owners of Regal Castle', async () => {
        const spc = await freshTrack(model, 0x3A);
        listen(spc, 1);
        const insts = V.muInstruments(Uint8Array.from(spc.ram()), model.packages[0], model.packages[0x3B]);
        assert.strictEqual(insts.filter(i => i.from === 'base').length, 13);
        assert.strictEqual(insts.filter(i => i.from === 'song').length, 6);
        const own = V.muOwners(model.driver, model.packages[0], model.packages[0x3B], V.muEcho(spc.view()));
        const free = own.reduce((n, o) => n + (o < 0), 0);
        assert.ok(free > 8000 && free < 10000, 'free ' + free);
    });
    return model;
}

/** The custom core under node, the page's stream script against it, the host class. */
async function coreStream(model) {
    console.log('\nEmulator sound-chip stream:');
    const dir = path.join(ROOT, 'src', 'emulator', 'core', 'snes9x2005-wasm');
    if (!rom || !fs.existsSync(path.join(dir, 'snes9x_2005.wasm'))) { console.log('  (ROM or custom core missing — skipped)'); return; }
    await new Promise(resolve => {
        global.require = require; global.__dirname = dir; global.__filename = path.join(dir, 'snes9x_2005.js');
        global.Module = { locateFile: f => path.join(dir, f), onRuntimeInitialized: resolve, print() {}, printErr() {} };
        vm.runInThisContext(fs.readFileSync(path.join(dir, 'snes9x_2005.js'), 'utf8'));
    });
    const M = global.Module;
    const p = M._my_malloc(rom.length); global.HEAPU8.set(rom, p); M._startWithRom(p, rom.length, 32040); M._setJoypadInput(0);
    for (let f = 0; f < 700; f++) { M._mainLoop(); M._getSoundBuffer(); }

    // The page script, as the emulator webview embeds it.
    const sent = [], listeners = [];
    const page = { HEAPU8: global.HEAPU8, romLoaded: true, getModule: () => M, vscodeApi: { postMessage: m => sent.push(m) },
        window: { addEventListener: (t, fn) => listeners.push(fn) } };
    vm.createContext(page);
    vm.runInContext(getApuStreamClientScript() + ';this.apuStreamTick = apuStreamTick;', page);
    const host = new ApuStream(m => { listeners.forEach(fn => fn({ data: m })); return true; });
    const frames = [];
    host.setListener(f => frames.push(f));

    await step('the core shows its sound chip: the ROM driver at $0700, DIR $02, keyed voices', async () => {
        const v = M._getApuView(), H = global.HEAPU8;
        const ram = H[v] | H[v + 1] << 8 | H[v + 2] << 16 | H[v + 3] << 24;
        assert.deepStrictEqual(Buffer.from(H.subarray(ram + 0x700, ram + 0x700 + 0x40)), rom.subarray(0x180E0, 0x18120));
        assert.strictEqual(H[v + 32 + 0x5D], 0x02);
        assert.ok(H[v + 25] !== 0, 'keyed voices');
    });
    await step('frames flow only while switched on; they carry the package and each voice’s sample', async () => {
        page.apuStreamTick(M);
        assert.strictEqual(sent.length, 0);
        host.setOn(true);
        M._mainLoop(); page.apuStreamTick(M);
        sent.forEach(m => host.handle(m));
        assert.strictEqual(frames.length, 1);
        assert.strictEqual(frames[0].pkg, 0x01, 'Main Title is loaded on the title screen');
        assert.strictEqual(frames[0].view.length, 224);
        assert.strictEqual(frames[0].starts.length, 8);
        assert.strictEqual(frames[0].drv.length, 89, 'the driver bytes');
        const owners = V.muDriverOwners(frames[0].drv);
        assert.ok(owners.some(o => o.kind === 'mus'), 'Main Title owns voices: ' + JSON.stringify(owners));
        host.setOn(false);
    });
    await step('a snapshot carries all of ARAM; the tab finds Main Title’s instruments in it', async () => {
        const got = host.snapshot();
        sent.splice(0).forEach(m => host.handle(m));
        const s = await got;
        assert.strictEqual(s.ram.length, 65536);
        assert.strictEqual(typeof s.frame, 'number', 'the frame it was taken after');
        const insts = V.muInstruments(Uint8Array.from(s.ram), model.packages[0], model.packages[s.pkg]);
        assert.deepStrictEqual(insts.filter(i => i.from === 'song').map(i => i.index), [0x0E, 0x0F, 0x10, 0x11, 0x12]);
        const playing = frames[0].starts.filter(a => insts.some(i => i.start === a));
        assert.ok(playing.length > 0, 'voice samples are instruments');
    });
}

async function dom(model) {
    let chromium;
    try { ({ chromium } = require('playwright')); } catch { console.log('\nMusic tab DOM: playwright not installed — skipped'); return; }
    let browser;
    try { browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] }); } catch (e) { console.log('\nMusic tab DOM: no browser — skipped'); return; }
    console.log('\nMusic tab DOM:');
    const page = await browser.newPage({ viewport: { width: 1000, height: 640 } });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    const stub = '<script>window.__posted=[];window.acquireVsCodeApi=function(){return{postMessage:function(m){window.__posted.push(m)},getState:function(){return null},setState:function(){}}};<\/script>';
    const html = renderRadarHtml({ kind: 'function', name: 'f', startLine: 0, endLine: 1 }, new Map(), [], new Map(), new Map(), [], 'radar', null);
    await page.setContent(html.replace('<head>', '<head>' + stub));
    const posted = cmd => page.evaluate(c => window.__posted.filter(m => m.command === c), cmd);
    await step('the tab asks for its model once and switches the emulator stream on and off', async () => {
        await page.click('.tab[data-tab="music"]');
        await page.click('.tab[data-tab="rom"]');
        await page.click('.tab[data-tab="music"]');
        assert.strictEqual((await posted('musicInit')).length, 1);
        assert.deepStrictEqual((await posted('musicStream')).map(m => m.on), [true, false, true]);
    });
    if (!model) { await browser.close(); return; }
    const spc = await freshTrack(model, 0x3A);
    listen(spc, 1);
    const view = Array.from(spc.view()), ram = Array.from(spc.ram());
    const d = view[32 + 0x5D] * 256;
    const starts = [...Array(8)].map((_, v) => { const e = (d + view[32 + v * 16 + 4] * 4) & 0xFFFF; return ram[e] | ram[e + 1] << 8; });
    const drv = V.muDriverBytes(spc.ram());
    await page.evaluate(m => window.postMessage({ command: 'musicModel', model: m }, '*'), model);
    await page.evaluate(f => window.postMessage({ command: 'musicFrame', view: f.view, pkg: 0x3B, starts: f.starts, drv: f.drv, frame: 1 }, '*'), { view, starts, drv });
    await page.waitForTimeout(150);
    await step('a live frame asks for ARAM; with it, voices, instruments, effects and ARAM fill in', async () => {
        const snap = (await posted('musicSnapshot')).pop();
        assert.ok(snap, 'snapshot requested');
        await page.evaluate(a => window.postMessage({ command: 'musicSnapshotData', id: a.id, view: a.view, ram: a.ram, pkg: 0x3B }, '*'), { id: snap.id, view, ram });
        await page.evaluate(f => window.postMessage({ command: 'musicFrame', view: f.view, pkg: 0x3B, starts: f.starts, drv: f.drv, frame: 2 }, '*'), { view, starts, drv });
        await page.waitForTimeout(150);
        assert.match(await page.textContent('#mu-status'), /package \$3B · Regal Castle/);
        assert.ok(await page.locator('.mu-voice.mu-on').count() > 0);
        assert.strictEqual(await page.locator('#mu-inst .mu-row').count(), 19);
        assert.strictEqual(await page.locator('#mu-sfx-scroll .mu-sfx-item:not([disabled])').count(), 62, 'base bank effects playable');
        assert.match(await page.textContent('#mu-legend'), /Free [0-9.]+ KB/);
    });
    await step('the channel column shows the driver\'s owner of each voice', async () => {
        const owners = await page.$$eval('.mu-tl-ch .mu-ch-own', els => els.map(e => e.textContent));
        assert.strictEqual(owners.length, 8);
        assert.ok(owners.some(t => /^♪ T\d$/.test(t)), owners.join(' '));
    });
    await step('a sound effect the game sends draws one box for as long as the driver gives it the voice', async () => {
        const a = await freshTrack(model, 0x3A);
        listen(a, 1);
        const frame = (n) => { a.run(17067); const r = a.ram(), w = Array.from(a.view()); return { view: w, starts: V.muVoiceStarts(w, r), drv: V.muDriverBytes(r), frame: n }; };
        const seq = [frame(10)];
        a.playSfx(0x07); a.playSfx(0x10);
        for (let i = 11; i < 40; i++) seq.push(frame(i));
        await page.evaluate(fs => fs.forEach(f => window.postMessage(Object.assign({ command: 'musicFrame', pkg: 0x3B }, f), '*')), seq);
        await page.waitForTimeout(150);
        const got = await page.evaluate(() => {
            const runs = {}, _music = window.__music.state;
            _music.history.forEach(h => h.voices.forEach((V, v) => { if (V.own === 'sfx') (runs[v + ':' + V.sfx + ':' + V.gen] = (runs[v + ':' + V.sfx + ':' + V.gen] || 0) + 1); }));
            return { runs, recent: Object.keys(_music.recentSfx).map(Number).sort((x, y) => x - y) };
        });
        assert.deepStrictEqual(got.recent, [0x07, 0x10], 'both effects in Recent');
        const runs = Object.keys(got.runs);
        assert.ok(runs.some(k => k.split(':')[1] === '7') && runs.some(k => k.split(':')[1] === '16'), JSON.stringify(got.runs));
        // One run per voice and effect: no flicker into several boxes.
        const perVoice = {};
        runs.forEach(k => { const [v, sfx] = k.split(':'); perVoice[v + ':' + sfx] = (perVoice[v + ':' + sfx] || 0) + 1; });
        assert.ok(Object.values(perVoice).every(n => n === 1), JSON.stringify(got.runs));
        await page.click('[data-sfx-filter="recent"]');
        await page.waitForTimeout(100);
        assert.strictEqual(await page.locator('#mu-sfx-scroll .mu-sfx-item').count(), 2);
        await page.click('[data-sfx-filter="all"]');
    });
    await step('the sidebar resizes and hides; both survive in the webview state', async () => {
        const grip = await page.locator('#mu-sb-resize').boundingBox();
        await page.mouse.move(grip.x + 4, grip.y + 50);
        await page.mouse.down();
        await page.mouse.move(grip.x - 80, grip.y + 50);
        await page.mouse.up();
        const w = await page.evaluate(() => document.getElementById('mu-sfx-sidebar').getBoundingClientRect().width);
        assert.ok(Math.abs(w - 324) <= 2, 'width ' + w);
        await page.click('#mu-sb-close');
        assert.strictEqual(await page.locator('#mu-sfx-sidebar').isVisible(), false);
        await page.click('#mu-sfx-toggle');
        assert.strictEqual(await page.locator('#mu-sfx-sidebar').isVisible(), true);
    });
    await step('one screen: the page never scrolls', async () => {
        const [sh, ih] = await page.evaluate(() => [document.scrollingElement.scrollHeight, innerHeight]);
        assert.ok(sh <= ih, sh + ' > ' + ih);
    });
    // A track plays through a ScriptProcessor; without an audio output its callback never runs.
    const audio = await page.evaluate(() => new Promise(r => {
        const c = new AudioContext({ sampleRate: 32000 }), n = c.createScriptProcessor(2048, 0, 2);
        let k = 0; n.onaudioprocess = () => k++; n.connect(c.destination);
        setTimeout(() => { n.disconnect(); c.close(); r(k); }, 600);
    }));
    if (!audio) { console.log('  (no audio output in this browser — track playback checks skipped)'); await step('no page errors', async () => assert.deepStrictEqual(errors, [])); await browser.close(); return; }
    await step('a track plays in the tab: packages asked, the stream switched off, voices sound', async () => {
        await page.selectOption('#mu-source', '0');
        await page.click('#mu-play');
        await page.waitForTimeout(50);
        for (const m of await posted('musicPackage')) {
            await page.evaluate(a => window.postMessage({ command: 'musicPackageData', id: a.id, records: a.records }, '*'), { id: m.id, records: packageData(rom, m.id) });
        }
        await page.waitForFunction(() => document.getElementById('mu-play').textContent.indexOf('Stop') >= 0, null, { timeout: 5000 });
        await page.waitForTimeout(500);
        assert.strictEqual((await posted('musicStream')).pop().on, false);
        assert.ok(await page.locator('.mu-voice.mu-on').count() > 0);
        assert.match(await page.textContent('#mu-inst-sub'), /5 from package \$01/);
    });
    await step('a track in the tab: the timeline records its frames and reads ahead of the playhead', async () => {
        const st = await page.evaluate(() => { const m = window.__music; return { hist: m.state.history.length, ahead: m.forecast.frames.length, now: m.now(), t: m.forecast.t }; });
        assert.ok(st.hist > 5, 'history ' + st.hist);
        assert.ok(st.ahead > 30 && st.t > st.now + 1000, JSON.stringify(st));
    });
    await step('no page errors', async () => assert.deepStrictEqual(errors, []));
    await browser.close();
}

(async () => {
    const model = await modelAndEngine();
    await coreStream(model);
    await dom(model);
    console.log(`\n${passed} passed, ${failed} failed`);
    process.exit(failed ? 1 : 0);
})();
