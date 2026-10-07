'use strict';

/**
 * Input recording / replay: the .evsmv format, the recording host, the webview
 * wiring (incl. the FPS meter), and the custom core's EVS_TAS parts: power-on
 * restart and the lag-frame flag.
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

test('pad text <-> word uses BYsSudlrAXLR0123 from bit 15', () => {
    assert.strictEqual(movie.padToText(0x8000), 'B...............');
    assert.strictEqual(movie.padToText(0x0080), '........A.......');
    assert.strictEqual(movie.textToPad('BYsSudlrAXLR0123'), 0xFFFF);
    assert.strictEqual(movie.textToPad('....u..r........'), (1 << 11) | (1 << 8));
    assert.strictEqual(movie.frameLine(0x8000), 'F|B...............');
});

test('evsmv round-trips header, frames and trailer; other files are rejected', () => {
    const text = movie.evsmvHeader({ rom: 'SoE.smc', romSha256: 'ab', started: '2026-10-07T00:00:00.000Z', source: 'x' })
        + movie.frameLine(0x8000) + '\n'
        + movie.frameLine(0x1000) + '\n'
        + movie.evsmvTrailer({ frames: 2, cheats: true });
    const m = movie.parseMovie(text, 'SoE_2026.evsmv');
    assert.strictEqual(m.title, 'SoE_2026');
    assert.strictEqual(m.count, 2);
    assert.deepStrictEqual(Array.from(m.pads), [0x8000, 0x1000]);
    assert.strictEqual(m.meta.source, 'x');
    assert.strictEqual(m.meta.romSha256, 'ab');
    assert.strictEqual(m.warnings.length, 1, 'cheats warning');
    assert.throws(() => movie.parseMovie('PK...', 'x.lsmv'));
});

test('host: recording kept only when a button was pressed by hand; pins; replay load', () => {
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
            assert.strictEqual(items.length, 1);
            assert.ok(items[0].recording, 'recording in progress listed');
            host.handle({ command: 'tasRecEnd' });
            const files = fs.readdirSync(dir).filter(n => n.endsWith('.evsmv'));
            assert.strictEqual(files.length, 1);
            assert.ok(/^Secret of Evermore_\d{4}-\d\d-\d\d_\d\d-\d\d-\d\d\.evsmv$/.test(files[0]), files[0]);
            const rec = movie.parseMovie(fs.readFileSync(path.join(dir, files[0]), 'utf8'), files[0]);
            assert.strictEqual(rec.count, 2);
            assert.strictEqual(rec.meta.source, 'tas');
            assert.strictEqual(rec.meta.romSha256, crypto.createHash('sha256').update(Buffer.alloc(1024, 1)).digest('hex'));

            host.handle({ command: 'tasPin', id: 'file:' + files[0], pinned: true });
            assert.ok(host.list().find(it => it.id === 'file:' + files[0]).pinned);
            host.handle({ command: 'tasLoad', id: 'file:' + files[0] });
            const loaded = posted.find(m => m.command === 'tasMovie');
            assert.strictEqual(loaded.count, 2);
            assert.deepStrictEqual(Array.from(new Uint16Array(new Uint8Array(Buffer.from(loaded.pads, 'base64')).buffer)), [0x8000, 0]);
            host.handle({ command: 'tasLoad', id: 'file:../../etc/passwd.evsmv' });
            assert.ok(posted.some(m => m.command === 'tasStatus' && /not found/.test(m.text)), 'path traversal rejected');
        });
    } finally {
        fs.rmSync(tmp, { recursive: true, force: true });
    }
});

test('webview: REPLAYS tab, inputs + FPS chips, frame loop routes joypads through tasApplyInput; script parses', () => {
    for (const [file, fn] of [['tas-view.js', 'getTasClientScript'], ['fps-meter.js', 'getFpsClientScript']]) {
        const src = fs.readFileSync(path.join(ROOT, 'src', 'emulator', file), 'utf8');
        assert.ok(!/[^\x09\x0A\x0D\x20-\x7E]/.test(src), file + ' must be ASCII');
        assert.ok(!src.slice(src.indexOf('function ' + fn)).includes('\\'), 'no backslashes in ' + fn);
    }
    const { buildHtml } = require('../../src/emulator/panel-webview');
    const html = buildHtml({ cspSource: '' }, 'core.js', 'core.wasm', 'core', 'core');
    assert.ok(html.includes('id="ss-tab-tas"') && html.includes('id="ss-view-tas"'));
    assert.ok(html.includes('id="screen-inputs-toggle"') && html.includes('id="tas-input-overlay"'));
    assert.ok(!/Module\._setJoypadInput\(keyInput\)/.test(html), 'joypads only set by tasApplyInput');
    assert.ok(html.includes('tasApplyInput(Module, keyInput);'));
    assert.ok(html.includes('if (m && !tasReplaying()) maintainCheats(m);'), 'no cheat writes during replay');
    assert.ok(html.includes('id="screen-fps"'), 'FPS chip');
    assert.strictEqual((html.match(/Module\._mainLoop\(\);\s*fpsCountFrame\(Module\);/g) || []).length, 2, 'every emulated frame counted');
    assert.ok(html.includes('fpsTick(timestamp, romLoaded && !paused);'), 'paused time is not measured');
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

test('custom core (EVS_TAS): restart is a power-on, so input replays identically; lag frames are flagged', async () => {
    const romPath = findRom();
    if (!romPath) { console.log('    (skipped: no SoE ROM; set EVS_ROM)'); return; }
    const M = await loadCore();
    assert.strictEqual(typeof M._takeInputPolled, 'function', 'takeInputPolled exported');
    const rom = fs.readFileSync(romPath);
    // Start / A / directions in a fixed pseudo-random pattern: gets through the intro screens.
    const pad = f => [0x1000, 0x0080, 0, 0x0800, 0x0100, 0][(f * 7 + (f >> 5)) % 6];
    const run = frames => {
        const p = M._my_malloc(rom.length);
        M.heap().set(rom, p);
        M._startWithRom(p, rom.length, 44100);
        M._my_free(p);
        let polled = 0;
        for (let f = 0; f < frames; f++) {
            M._setJoypadInput(pad(f));
            M._mainLoop();
            polled += M._takeInputPolled();
        }
        const s = M._saveState();
        return { polled, wram: crypto.createHash('sha1').update(M.heap().subarray(s + 0x10c14, s + 0x10c14 + 0x20000)).digest('hex') };
    };
    const first = run(3000);
    const again = run(3000);
    assert.strictEqual(again.wram, first.wram, 'WRAM after 3000 frames: fresh boot vs restart');
    assert.strictEqual(again.polled, first.polled);
    assert.ok(first.polled > 2000 && first.polled < 3000, 'some lag frames, mostly polled: ' + first.polled);
});

(async () => {
    for (const t of pending) await t();
    console.log(`\n${passed} passed, ${failed} failed`);
    if (failed) process.exit(1);
})();
