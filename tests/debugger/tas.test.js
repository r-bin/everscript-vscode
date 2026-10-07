'use strict';

/**
 * TAS support: movie formats (lsmv / evsmv), the recording host, the webview
 * wiring, and the custom core's power-on restart + 4-pad input.
 *
 * The core test needs the vanilla SoE ROM: $EVS_ROM, or ../everscript/ next to
 * this repo; it is skipped when absent.
 */

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');
const Module = require('module');

const ROOT = path.resolve(__dirname, '..', '..');
const movie = require('../../src/emulator/tas/movie');
const BUNDLED = path.join(ROOT, 'src', 'emulator', 'tas', 'movies', 'rbin-secretofevermore-gameend.lsmv');

let passed = 0;
let failed = 0;
const pending = [];

function test(name, fn) {
    pending.push(async () => {
        try {
            await fn();
            console.log(`  [PASS] ${name}`);
            passed++;
        } catch (e) {
            console.error(`  [FAIL] ${name}`);
            console.error(`    ${e.stack || e.message}`);
            failed++;
        }
    });
}

function withVscodeStub(config, fn) {
    const origLoad = Module._load;
    Module._load = function (req, ...rest) {
        if (req === 'vscode') {
            return {
                workspace: { getConfiguration: () => ({ get: (k, d) => (k in config ? config[k] : d) }) },
                window: { showWarningMessage: async () => 'Delete', showErrorMessage: () => {} },
                commands: { executeCommand: () => {} },
                Uri: { file: p => ({ fsPath: p }) },
            };
        }
        return origLoad.call(this, req, ...rest);
    };
    try {
        delete require.cache[require.resolve('../../src/emulator/tas/host')];
        return fn(require('../../src/emulator/tas/host'));
    } finally {
        Module._load = origLoad;
    }
}

console.log('TAS Tests:');

test('pad text <-> word uses lsnes order BYsSudlrAXLR0123 from bit 15', () => {
    assert.strictEqual(movie.padToText(0x8000), 'B...............');
    assert.strictEqual(movie.padToText(0x0080), '........A.......');
    assert.strictEqual(movie.padToText(0x0001), '...............3');
    assert.strictEqual(movie.textToPad('BYsSudlrAXLR0123'), 0xFFFF);
    assert.strictEqual(movie.textToPad('....u..r........'), (1 << 11) | (1 << 8));
    assert.strictEqual(movie.frameLine(0x8000, 0, 0, 0), 'F|B...............');
    assert.strictEqual(movie.frameLine(0, 1, 0, 0), 'F|................|...............3|................|................');
});

test('bundled any% TAS parses: 23402 frames, Y-cable pads, ROM hash', () => {
    const m = movie.parseMovie(fs.readFileSync(BUNDLED), path.basename(BUNDLED));
    assert.strictEqual(m.format, 'lsmv');
    assert.strictEqual(m.count, 23402);
    assert.strictEqual(m.ycable, true);
    assert.strictEqual(m.meta.romSha256, '17c864a76d498feb6479eee8e7d6807b951c66225033228622bb66754baab1db');
    assert.strictEqual(m.meta.authors, 'r.bin');
    // last frame: "BYsS...rA...01.3|..s.u.l.A.L.0..3|.Y.S..lrA...01.3|..." in the four pads' slots
    const last = Array.from(m.pads.subarray((m.count - 1) * 4));
    assert.strictEqual(movie.padToText(last[0]), '.Y.S..lrA...01.3');
    assert.strictEqual(movie.padToText(last[1]), 'BYs.u.l.AXL.0.2.');
    assert.deepStrictEqual(m.warnings, []);
});

test('evsmv round-trips header, frames and trailer', () => {
    const text = movie.evsmvHeader({ rom: 'SoE.smc', romSha256: 'ab', started: '2026-10-07T00:00:00.000Z', source: 'x', ycable: true })
        + movie.frameLine(0x8000, 0, 0, 0) + '\n'
        + movie.frameLine(0x1000, 0x0001, 0, 0x0080) + '\n'
        + movie.evsmvTrailer({ frames: 2, cheats: false });
    const m = movie.parseMovie(Buffer.from(text), 'SoE_2026.evsmv');
    assert.strictEqual(m.title, 'SoE_2026');
    assert.strictEqual(m.count, 2);
    assert.strictEqual(m.ycable, true);
    assert.deepStrictEqual(Array.from(m.pads), [0x8000, 0, 0, 0, 0x1000, 1, 0, 0x80]);
    assert.strictEqual(m.meta.source, 'x');
    assert.strictEqual(m.meta.romSha256, 'ab');
});

test('host: recording kept only when a button was pressed by hand; list pins the bundled TAS first', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'evs-tas-'));
    try {
        withVscodeStub({}, ({ TasHost }) => {
            const posted = [];
            const host = new TasHost(tmp, m => posted.push(m), () => {});
            host.romStarted(Buffer.alloc(1024, 1));
            assert.strictEqual(posted[0].command, 'tasConfig');
            assert.strictEqual(posted[0].autoRecord, true);
            const dir = path.join(tmp, 'tas-recordings');

            // idle boot: no live input -> discarded
            host.handle({ command: 'tasRecStart', name: 'Secret of Evermore.smc' });
            host.handle({ command: 'tasRecFrames', text: 'F|................\n', frames: 1, live: false });
            host.handle({ command: 'tasRecEnd' });
            assert.deepStrictEqual(fs.readdirSync(dir).filter(n => n.endsWith('.evsmv')), []);

            host.handle({ command: 'tasRecStart', name: 'Secret of Evermore.smc', source: 'tas' });
            host.handle({ command: 'tasRecFrames', text: 'F|B...............\nF|................\n', frames: 2, live: true });
            const items = host.list();
            assert.ok(items[0].builtin && items[0].pinned, 'bundled movie first, pinned');
            assert.ok(items.some(it => it.recording), 'recording in progress listed');
            host.handle({ command: 'tasRecEnd' });
            const files = fs.readdirSync(dir).filter(n => n.endsWith('.evsmv'));
            assert.strictEqual(files.length, 1);
            assert.ok(/^Secret of Evermore_\d{4}-\d\d-\d\d_\d\d-\d\d-\d\d\.evsmv$/.test(files[0]), files[0]);
            const rec = movie.parseMovie(fs.readFileSync(path.join(dir, files[0])), files[0]);
            assert.strictEqual(rec.count, 2);
            assert.strictEqual(rec.meta.source, 'tas');
            assert.strictEqual(rec.meta.romSha256, crypto.createHash('sha256').update(Buffer.alloc(1024, 1)).digest('hex'));

            host.handle({ command: 'tasPin', id: 'file:' + files[0], pinned: true });
            assert.ok(host.list().find(it => it.id === 'file:' + files[0]).pinned);
            host.handle({ command: 'tasLoad', id: 'builtin:rbin-secretofevermore-gameend.lsmv' });
            const loaded = posted.find(m => m.command === 'tasMovie');
            assert.strictEqual(loaded.count, 23402);
            assert.strictEqual(Buffer.from(loaded.pads, 'base64').length, 23402 * 8);
            host.handle({ command: 'tasLoad', id: 'file:../../etc/passwd.lsmv' });
            assert.ok(posted.some(m => m.command === 'tasStatus' && /not found/.test(m.text)), 'path traversal rejected');
        });
    } finally {
        fs.rmSync(tmp, { recursive: true, force: true });
    }
});

test('webview: REPLAYS tab, inputs chip, frame loop routes joypads through tasApplyInput; script parses', () => {
    const src = fs.readFileSync(path.join(ROOT, 'src', 'emulator', 'tas-view.js'), 'utf8');
    assert.ok(!/[^\x09\x0A\x0D\x20-\x7E]/.test(src), 'tas-view.js must be ASCII');
    const client = src.slice(src.indexOf('function getTasClientScript'));
    assert.ok(!client.includes('\\'), 'no backslashes in the client script');
    const { buildHtml } = require('../../src/emulator/panel-webview');
    const html = buildHtml({ cspSource: '' }, 'core.js', 'core.wasm', 'core', 'core');
    assert.ok(html.includes('id="ss-tab-tas"') && html.includes('id="ss-view-tas"'));
    assert.ok(html.includes('id="screen-inputs-toggle"') && html.includes('id="tas-input-overlay"'));
    assert.ok(!/Module\._setJoypadInput\(keyInput\)/.test(html), 'joypads only set by tasApplyInput');
    assert.ok(html.includes('tasApplyInput(Module, keyInput);'));
    assert.ok(html.includes('if (m && !tasReplaying()) maintainCheats(m);'), 'no cheat writes during replay');
    for (const m of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) new Function(m[1]);
});

function findRom() {
    const candidates = [process.env.EVS_ROM, path.join(ROOT, '..', 'everscript', 'Secret of Evermore (U) [!].smc')];
    return candidates.find(p => p && fs.existsSync(p)) || null;
}

function loadCore() {
    const dir = path.join(ROOT, 'src', 'emulator', 'core', 'snes9x2005-wasm');
    return new Promise(resolve => {
        const Mod = { locateFile: f => path.join(dir, f), onRuntimeInitialized: () => resolve(Mod), print() {}, printErr() {} };
        const ctx = vm.createContext({ Module: Mod, require, __dirname: dir, __filename: path.join(dir, 'snes9x_2005.js'), console, process, Buffer, URL, WebAssembly, TextDecoder, setTimeout, clearTimeout, performance });
        ctx.globalThis = ctx;
        vm.runInContext(fs.readFileSync(path.join(dir, 'snes9x_2005.js'), 'utf8'), ctx);
        Mod.heap = () => ctx.HEAPU8;
    });
}

test('custom core: restarting a ROM is a power-on, and the TAS plays identically after it', async () => {
    const romPath = findRom();
    if (!romPath) { console.log('    (skipped: no SoE ROM; set EVS_ROM)'); return; }
    const M = await loadCore();
    assert.strictEqual(typeof M._setJoypadInputs, 'function', 'setJoypadInputs exported');
    const rom = fs.readFileSync(romPath);
    const tas = movie.parseMovie(fs.readFileSync(BUNDLED), 'tas');
    const run = frames => {
        const p = M._my_malloc(rom.length);
        M.heap().set(rom, p);
        M._startWithRom(p, rom.length, 44100);
        M._my_free(p);
        for (let f = 0; f < frames; f++) {
            const o = f * 4;
            M._setJoypadInputs(tas.pads[o], tas.pads[o + 1], tas.pads[o + 2], tas.pads[o + 3]);
            M._mainLoop();
        }
        const s = M._saveState();
        return crypto.createHash('sha1').update(M.heap().subarray(s + 0x10c14, s + 0x10c14 + 0x20000)).digest('hex');
    };
    const first = run(3000);
    const again = run(3000);
    assert.strictEqual(again, first, 'WRAM after 3000 movie frames: fresh boot vs restart');
});

(async () => {
    for (const t of pending) await t();
    console.log(`\n${passed} passed, ${failed} failed`);
    if (failed) process.exit(1);
})();
