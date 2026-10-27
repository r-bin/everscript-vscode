// TODO port to TS (docs/todo/port-to-ts.md)
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
const movie = require('../../dist/platform/tas/movie');

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
        delete require.cache[require.resolve('../../dist/core/emulator/tas/host')];
        return fn(require('../../dist/core/emulator/tas/host'));
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
    assert.strictEqual(m.warnings.length, 0, 'version 2 replays the cheat writes, so cheats are no warning');
    assert.strictEqual(movie.parseMovie('# Everscript movie 1\n# cheats: yes\nF|....\n', 'old').warnings.length, 1, 'a version 1 recording cannot replay cheats');
    assert.throws(() => movie.parseMovie('PK...', 'x.lsmv'));

    const sramB64 = Buffer.from([1, 2, 3, 4]).toString('base64');
    const textWithSram = movie.evsmvHeader({ rom: 'SoE.smc', romSha256: 'ab', started: '2026-10-07T00:00:00.000Z', source: 'x', sram: sramB64 })
        + movie.frameLine(0x8000) + '\n'
        + movie.evsmvTrailer({ frames: 1 });
    const mSram = movie.parseMovie(textWithSram, 'SoE_Sram.evsmv');
    assert.strictEqual(mSram.meta.sram, sramB64);
    assert.ok(textWithSram.includes('# start: power-on, initial SRAM'));
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
            assert.strictEqual(posted[0].minSeconds, 10, 'sessions under 10 s are deleted by default');
            host.handle({ command: 'tasPrefs', minSeconds: 0 });   // these sessions are frames long: keep them
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

            // What a replay showed goes into the recording; a desync stays, the file's date does not move.
            const file = path.join(dir, files[0]);
            const mtime = fs.statSync(file).mtimeMs;
            const id = 'file:' + files[0];
            host.handle({ command: 'tasReplayed', id, frames: 2 });
            assert.ok(host.list().find(it => it.id === id).meta.synced, 'synced');
            host.handle({ command: 'tasDesync', id, fair: false, frame: 60, expected: 'A', got: 'B' });
            assert.ok(!host.list().find(it => it.id === id).meta.desync, 'an unfair replay (other core / ROM) marks nothing');
            host.handle({ command: 'tasDesync', id, fair: true, frame: 60, expected: 'A', got: 'B' });
            host.handle({ command: 'tasDesync', id, fair: true, frame: 120, expected: 'C', got: 'D' });
            const marked = host.list().find(it => it.id === id);
            assert.strictEqual(marked.meta.desync, '60 expected A, got B', 'only the first desync is kept');
            assert.strictEqual(movie.parseMovie(fs.readFileSync(file, 'utf8'), files[0]).count, 2, 'the frames are untouched');
            assert.strictEqual(Math.round(fs.statSync(file).mtimeMs), Math.round(mtime), 'the list order is kept');
            host.handle({ command: 'tasDelete', id, confirmed: true });
            assert.ok(!fs.existsSync(file), 'a delete confirmed in the pause menu asks nothing more');
        });
    } finally {
        fs.rmSync(tmp, { recursive: true, force: true });
    }
});

test('host: a dropped .evsmv is kept once, named its ROM, and plays; the page and panel route it', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'evs-tas-'));
    try {
        withVscodeStub({}, ({ TasHost }) => {
            const posted = [];
            const host = new TasHost(tmp, m => posted.push(m), () => {});
            const romSha = 'ab'.repeat(32);
            const text = movie.evsmvHeader({ rom: 'x.sfc', romSha256: romSha, started: '2026-10-25T11:37:03.325Z' }) + 'F|B...............\nF|................\n';
            const a = host.addDropped('tester/../x Secret of Evermore_2026.evsmv', text);
            assert.strictEqual(a.romSha256, romSha);
            assert.ok(/^file:[^/]+\.evsmv$/.test(a.id), a.id);
            assert.deepStrictEqual(host.addDropped('again.evsmv', text), a, 'same content: kept once, same id');
            assert.throws(() => host.addDropped('bad.evsmv', 'hello'), /not an Everscript recording/);
            host.play(a.id);
            assert.strictEqual(posted.find(m => m.command === 'tasMovie').count, 2);
        });
    } finally {
        fs.rmSync(tmp, { recursive: true, force: true });
    }
    const page = fs.readFileSync(path.join(ROOT, 'src/core/emulator/webview/page/02-activate-overlay-focused.js'), 'utf8');
    assert.ok(/\\\.evsmv\$\/i\.test\(fileName\)[\s\S]*command: 'replayDropped'/.test(page), 'the page sends a dropped replay as text');
    const messages = fs.readFileSync(path.join(ROOT, 'src/core/emulator/panel-messages.ts'), 'utf8');
    assert.ok(/case 'replayDropped':\s*_playReplay\(/.test(messages), 'a drop on the page plays');
    const state = fs.readFileSync(path.join(ROOT, 'src/core/emulator/panel-state.ts'), 'utf8');
    assert.ok(/function _playReplay[\s\S]*romBySha256[\s\S]*emu\.pendingReplay = id/.test(state), 'the panel boots the ROM the replay names');
    // VS Code opens files dropped on a webview itself (without Shift): .evsmv opens in the replay editor, which plays it.
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
    assert.ok(pkg.contributes.customEditors.some(e => e.viewType === 'everscript.replay' && e.selector.some(s => s.filenamePattern === '*.evsmv')));
    assert.ok(pkg.activationEvents.includes('onCustomEditor:everscript.replay'));
    const ext = fs.readFileSync(path.join(ROOT, 'src/games/evermore/extension.ts'), 'utf8');
    assert.ok(/registerReplayEditor\(context,[\s\S]*playReplay\(context, name, text\)/.test(ext), 'the extension registers the replay editor');
});

test('REPLAYS rows: when, length and sync, no file name; play and delete ask first', () => {
    const list = require('../../src/core/emulator/webview/replays-list');
    const items = [
        { id: 'file:a.evsmv', name: 'a', frames: 60 * 60.0988 * 3 + 2, romMatch: true, meta: { started: '2026-10-16T15:39:37Z', synced: '2026-10-16' } },
        { id: 'file:b.evsmv', name: 'b', frames: 600, romMatch: true, meta: { started: '2026-10-16T10:39:29Z', desync: '3606 expected A, got B' } },
        { id: 'file:c.evsmv', name: 'c', frames: 10, romMatch: true, recording: true, meta: {} },
        { id: 'file:d.evsmv', name: 'd', frames: 10, romMatch: false, meta: {} },
    ];
    const html = list.replaysListHtml(items, null);
    assert.ok(html.includes('>3:00<') && html.includes('synced') && html.includes('desync at 1:00') && html.includes('recording now'));
    assert.ok(!/>a<|>b</.test(html), 'the file name is only a tooltip');
    assert.ok(html.includes('1 recording of other ROMs not listed'));
    assert.ok(!html.includes('data-kind="takeover"') && list.replaysListHtml(items, 'file:a.evsmv').includes('data-kind="takeover"'), 'take over only while replaying');
    assert.strictEqual(list.replayLength(3 * 3600 * 60.0988), '3:00:00');
    assert.deepStrictEqual(list.replaySync({ meta: {} }), { cls: 'dim', text: 'not replayed yet' });
});

test('webview: REPLAYS tab, inputs + FPS chips, frame loop routes joypads through tasApplyInput; script parses', () => {
    for (const file of ['tas', 'fps.js']) {
        const src = require('../../dist/core/webview/page-file').pageFiles(path.join(ROOT, 'src', 'core', 'emulator', 'webview'))(file);
        assert.ok(!/[^\x09\x0A\x0D\x20-\x7E]/.test(src), file + ' must be ASCII');
        assert.ok(!src.includes('\\'), 'no backslashes in ' + file);
    }
    const { buildHtml } = require('../../dist/core/emulator/panel-webview');
    const html = buildHtml({ cspSource: '' }, 'core.js', 'core.wasm', 'core', 'core');
    assert.ok(!html.includes('id="ss-tab-tas"') && html.includes('id="ss-view-tas"') && html.includes('id="emu-slot-tas"'), 'REPLAYS is a pause-menu tab only');
    assert.ok(html.includes('id="tas-rec-badge"'), 'the replay status chip is on the screen');
    assert.ok(html.includes('id="screen-inputs-toggle"') && html.includes('id="tas-input-overlay"'));
    assert.ok(!/Module\._setJoypadInput\(keyInput\)/.test(html), 'joypads only set by tasApplyInput');
    assert.ok(html.includes('if (m && gameActive && !tasReplaying() && typeof maintainCheats === \'function\') maintainCheats(m);'), 'no cheat writes during replay');
    assert.strictEqual((html.match(/Module\._mainLoop\(\);\s*fpsCountFrame\(Module\);/g) || []).length, 2, 'every emulated frame counted');
    assert.ok(html.includes('fpsTick(timestamp, romLoaded && !paused);'), 'paused time is not measured');
    for (const m of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) new Function(m[1]);
});

function findRom() {
    const candidates = [require('../../dist/games').romPath('evermore')];
    return candidates.find(p => p && fs.existsSync(p)) || null;
}

function loadCore() {
    const dir = path.join(ROOT, 'src', 'core', 'emulator', 'core', 'snes9x2005-wasm');
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
