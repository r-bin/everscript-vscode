// TODO port to TS (docs/todo/port-to-ts.md)
// What the user does in the emulator's menu and panels goes to the Emulator log with the replay frame
// (core/emulator/webview/page/07-ui-log.js -> panel-messages.ts uiLog). Headless Chromium, the full page without
// a core. Run: node tests/debugger/ui-log.test.js
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '../..');

(async () => {
    let chromium;
    try { ({ chromium } = require('playwright')); } catch (_) { console.log('  (playwright not installed: skipped)'); return; }
    let browser;
    try { browser = await chromium.launch(); } catch (_) { console.log('  (no browser: skipped)'); return; }
    let failed = false;
    try {
        const { buildHtml } = require('../../dist/core/emulator/panel-webview');
        const host = require('../../dist/games/evermore/emulator/host');
        const dataUri = (file, type) => `data:${type};base64,` + fs.readFileSync(path.join(ROOT, 'src/core/emulator/webview', file)).toString('base64');
        const html = buildHtml({ cspSource: '' }, 'core.js', 'core.wasm', 'core', 'core', null, {
            profile: 'full', gameView: host.webview(),
            styles: [dataUri('emulator-profile.css', 'text/css'), dataUri('emulator-panels.css', 'text/css')],
            scripts: host.webviewFiles().map(f => 'data:text/javascript;base64,' + fs.readFileSync(f).toString('base64'))
                .concat([dataUri('emulator-profile.js', 'text/javascript'), dataUri('emulator-panels.js', 'text/javascript'), dataUri('replays-list.js', 'text/javascript')]),
        }).replace('<head>', '<head><script>window.__sent=[];window.acquireVsCodeApi=()=>({postMessage:m=>window.__sent.push(m)});</script>');
        const p = await browser.newPage();
        const errors = [];
        p.on('pageerror', e => errors.push(e.message));
        await p.clock.install();
        await p.setContent(html, { waitUntil: 'load' });
        await p.evaluate(() => {
            romLoaded = true;
            tasSessionFrame = 1234;
            openEmulatorMenu();
            selectMenuTab(5);
            menuSelectedRow = 0; changeMenuValue(1);       // Emulation Speed 1x -> 2x
            menuSelectedRow = 5; activateMenuRow();        // Right-click walks there -> ON
            closeEmulatorMenu();
            const b = document.createElement('button'); b.id = 'some-panel-btn'; b.textContent = 'Export'; document.body.appendChild(b); b.click();
        });
        await p.clock.runFor(1100);
        const lines = await p.evaluate(() => window.__sent.filter(m => m.command === 'uiLog').flatMap(m => m.lines));
        const want = [
            'f=1234 menu open',
            'f=1234 menu tab EMULATION',
            'f=1234 speed 2x',
            'f=1234 menu EMULATION > Emulation Speed (+1) = 2x',
            'f=1234 menu EMULATION > Right-click walks there (B) = ON',
            'f=1234 menu close',
            'f=1234 click #some-panel-btn Export',
        ];
        for (const w of want) assert.ok(lines.includes(w), 'missing: ' + w + '\n    got: ' + JSON.stringify(lines));
        assert.deepStrictEqual(errors, []);
        console.log('  ✓ menu steps and presses, open / close / tab, game-changing calls and outside clicks are logged with the frame');
    } catch (e) {
        failed = true;
        console.error('  ✗ ' + (e.stack || e));
    } finally {
        await browser.close();
    }
    console.log(failed ? '\n0 passed, 1 failed' : '\n1 passed, 0 failed');
    if (failed) process.exit(1);
})();
