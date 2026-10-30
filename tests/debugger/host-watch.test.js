// TODO port to TS (docs/todo/port-to-ts.md)
// The emulator page when its extension host goes quiet (webview/page/05-host-watch.js, core/emulator/session-watch.ts):
// after 20 s without a message it pauses the game and says nothing is being saved; any message from the host ends it.
// Host alerts (a save that failed) show over the screen until cleared. Headless Chromium with a fake clock; no core.
// Run: node tests/debugger/host-watch.test.js
'use strict';
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

let passed = 0, failed = 0;
async function test(name, fn) {
    try { await fn(); console.log('  ✓ ' + name); passed++; }
    catch (e) { console.error('  ✗ ' + name + '\n    ' + (e.stack || e)); failed++; }
}

(async () => {
    await test('session marker: left by a dead host it is reported once and removed; ours is not', () => {
        const Module = require('module');
        const shown = [];
        const vscodeStub = { window: { showWarningMessage: (t) => { shown.push(t); return Promise.resolve(undefined); } }, commands: { executeCommand: () => {} } };
        const load = Module._load;
        Module._load = function (req, ...rest) { return req === 'vscode' ? vscodeStub : load.call(this, req, ...rest); };
        try {
            const watch = require('../../dist/core/emulator/session-watch');
            const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'evs-session-'));
            const context = { globalStorageUri: { fsPath: dir }, extensionPath: dir };
            const posted = [];
            watch.startSessionWatch(context, m => posted.push(m), 'everscript.openEmulator');
            const marker = path.join(dir, 'emulator-session.json');
            assert.ok(fs.existsSync(marker), 'a marker while the panel is open');
            watch.checkLastSession(context);
            assert.deepStrictEqual(shown, [], 'our own session is not reported');
            watch.stopSessionWatch();
            assert.ok(!fs.existsSync(marker), 'closing removes it');
            // A host that died: a pid that is not running.
            fs.writeFileSync(marker, JSON.stringify({ pid: 2147483646, opened: new Date().toISOString(), command: 'everscript.openEmulator' }));
            watch.checkLastSession(context);
            assert.strictEqual(shown.length, 1);
            assert.match(shown[0], /stopped without closing/);
            assert.ok(!fs.existsSync(marker), 'reported once');
        } finally {
            Module._load = load;
        }
    });

    await test('webview: silence pauses with an alert, the host coming back resumes; host alerts show and clear (headless Chromium)', async () => {
        let chromium;
        try { ({ chromium } = require('playwright')); } catch (_) { console.log('    (playwright not installed: skipped)'); return; }
        let browser;
        try { browser = await chromium.launch(); } catch (e) { console.log('    (no browser: skipped)'); return; }
        try {
            const { buildHtml } = require('../../dist/core/emulator/panel-webview');
            const html = buildHtml({ cspSource: '' }, 'core.js', 'core.wasm', 'core', 'core', null, { profile: 'recorder' })
                .replace('<head>', '<head><script>window.__sent=[];window.acquireVsCodeApi=()=>({postMessage:m=>window.__sent.push(m)});</script>');
            const p = await browser.newPage();
            const errors = [];
            p.on('pageerror', e => errors.push(e.message));
            await p.clock.install();
            await p.setContent(html, { waitUntil: 'load' });
            assert.deepStrictEqual(errors, []);
            // A running ROM on a stub core that can pause.
            await p.evaluate(() => {
                romLoaded = true;
                let paused = false;
                window.Module = Object.assign(window.Module || {}, {
                    _mainLoop() {}, isEmulationPaused: () => paused,
                    pauseEmulation() { paused = true; }, resumeEmulation() { paused = false; },
                });
            });
            const alert = () => p.evaluate(() => { const el = document.getElementById('emu-alert'); return el && !el.hidden ? el.textContent : ''; });

            await p.clock.runFor(15000);
            assert.strictEqual(await alert(), '', 'not yet after 15 s');
            await p.evaluate(() => window.postMessage({ command: 'hostAlive' }, '*'));
            await p.clock.runFor(15000);
            assert.strictEqual(await alert(), '', 'a heartbeat restarts the wait');
            await p.clock.runFor(10000);
            assert.match(await alert(), /nothing is being saved/);
            assert.strictEqual(await p.evaluate(() => isEmulatorPaused()), true, 'the game is paused');
            assert.ok(await p.evaluate(() => window.__sent.some(m => m.command === 'hostLost')), 'a busy host hears of it');

            await p.evaluate(() => window.postMessage({ command: 'hostAlive' }, '*'));
            await p.clock.runFor(100);
            assert.strictEqual(await alert(), '', 'the host is back');
            assert.strictEqual(await p.evaluate(() => isEmulatorPaused()), false, 'and the game goes on');

            await p.evaluate(() => window.postMessage({ command: 'emuAlert', key: 'cdl-save', text: 'CDL NOT SAVED: disk full' }, '*'));
            await p.clock.runFor(100);
            assert.match(await alert(), /CDL NOT SAVED: disk full/);
            await p.evaluate(() => window.postMessage({ command: 'emuAlert', key: 'cdl-save', text: '' }, '*'));
            await p.clock.runFor(100);
            assert.strictEqual(await alert(), '');

            // The pace line the host logs once a minute: 4x on a 144 Hz screen is 240 FPS, 144 refreshes a second.
            const pace = await p.evaluate(() => {
                setSpeedMultiplier(4);
                const m = { _takeInputPolled: () => 0 };
                fpsTick(0, true);
                for (let ms = 1000 / 144, t = ms, f = 0; t <= 60000 + ms; t += 1000 / 144) {
                    fpsRefresh();
                    fpsTick(t, true);
                    for (; f < t * 0.24; f++) fpsCountFrame(m);
                }
                return window.__sent.filter(x => x.command === 'emuPace').pop();
            });
            assert.ok(pace, 'emuPace sent');
            assert.strictEqual(pace.speed, 4);
            assert.ok(Math.abs(pace.fps - 240) <= 2 && pace.ratio === '4.00' && Math.abs(pace.hz - 144) <= 1, JSON.stringify(pace));

            // Paused by hand: the watch neither pauses nor resumes it.
            await p.evaluate(() => Module.pauseEmulation());
            await p.clock.runFor(25000);
            assert.match(await alert(), /nothing is being saved/);
            await p.evaluate(() => window.postMessage({ command: 'hostAlive' }, '*'));
            await p.clock.runFor(100);
            assert.strictEqual(await p.evaluate(() => isEmulatorPaused()), true, 'a pause the user made stays');
            assert.deepStrictEqual(errors, []);
        } finally {
            await browser.close();
        }
    });

    await test('webview: CDL not yet on disk is kept, parked in IndexedDB when the host goes quiet, handed over by the next page (headless Chromium)', async () => {
        let chromium;
        try { ({ chromium } = require('playwright')); } catch (_) { console.log('    (playwright not installed: skipped)'); return; }
        let browser;
        try { browser = await chromium.launch(); } catch (e) { console.log('    (no browser: skipped)'); return; }
        try {
            const { buildHtml } = require('../../dist/core/emulator/panel-webview');
            const html = buildHtml({ cspSource: '' }, 'core.js', 'core.wasm', 'core', 'core', null, { profile: 'full' })
                .replace('<head>', '<head><script>window.__sent=[];window.acquireVsCodeApi=()=>({postMessage:m=>window.__sent.push(m)});</script>');
            // A real origin (IndexedDB is per origin; a VS Code webview keeps one per extension view type).
            const context = await browser.newContext();
            await context.route('http://evs.test/**', route => (new URL(route.request().url()).pathname === '/'
                ? route.fulfill({ contentType: 'text/html', body: html })
                : route.fulfill({ status: 200, contentType: 'text/javascript', body: '' })));
            const open = async () => {
                const p = await context.newPage();
                const errors = [];
                p.on('pageerror', e => errors.push(e.message));
                await p.goto('http://evs.test/');
                return { p, errors };
            };
            const first = await open();
            await first.p.clock.install();
            const lib = { hash: 'ab'.repeat(20), romSize: 0x20000 };
            const session = await first.p.evaluate(l => {
                romLoaded = true;
                cdlRescueSetLib(l);
                for (let i = 0; i < 3; i++) cdlKeep({ romHits: 'AAAA' });
                cdlRescueSaved({ session: CDL_SESSION, seq: 1 });
                return CDL_SESSION;
            }, lib);
            await first.p.clock.runFor(25000);
            await first.p.waitForFunction(() => { const el = document.getElementById('emu-alert'); return el && /kept in this page/.test(el.textContent); });

            // The next page sends them as soon as its core is up, before any ROM (01-last-sampled-pre-state.js).
            const boot = fs.readFileSync(path.join(__dirname, '../../src/core/emulator/webview/page/01-last-sampled-pre-state.js'), 'utf8');
            assert.match(boot, /command: 'ready' \}\);[\s\S]{0,200}cdlRescueSend\(\)/, 'the page hands parked CDL over at ready');
            const second = await open();
            const sent = await second.p.evaluate(async () => {
                cdlRescueSend();
                for (let i = 0; i < 50 && !window.__sent.some(m => m.command === 'cdlRescue'); i++) await new Promise(r => setTimeout(r, 20));
                return window.__sent.filter(m => m.command === 'cdlRescue');
            });
            assert.strictEqual(sent.length, 1);
            assert.strictEqual(sent[0].session, session);
            assert.deepStrictEqual(sent[0].entries.map(e => e.seq), [2, 3], 'what the host had not written, numbered');
            assert.deepStrictEqual(sent[0].entries[0].lib, lib);
            await second.p.evaluate(s => cdlRescueDone({ session: s }), session);
            const third = await open();
            const again = await third.p.evaluate(async () => {
                cdlRescueSend();
                await new Promise(r => setTimeout(r, 300));
                return window.__sent.filter(m => m.command === 'cdlRescue').length;
            });
            assert.strictEqual(again, 0, 'written once, forgotten');
            assert.deepStrictEqual([...first.errors, ...second.errors, ...third.errors], []);
        } finally {
            await browser.close();
        }
    });

    console.log(`\n${passed} passed, ${failed} failed`);
    if (failed) process.exit(1);
})();
