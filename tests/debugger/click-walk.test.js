// TODO port to TS (docs/todo/port-to-ts.md)
// EMULATION > "Right-click walks there" (core/emulator/webview/menu/01-default-key-map.js, page/03b-render-loop.js):
// off by default, a right-click then injects nothing; switched on, it walks the player there and the setting is saved.
// Headless Chromium, the full page without a core. Run: node tests/debugger/click-walk.test.js
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
        const r = await p.evaluate(() => {
            const injected = [];
            window.injectEverscript = code => { injected.push(code); return true; };
            startRenderLoop();   // registers the right-click handler (the core would start it)
            romLoaded = true;
            lastLayout = { camX: 100, camY: 50, emuX: 0, emuY: 0, scaleSnes: 2 };
            const click = () => document.getElementById('screen-wrap').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 40, clientY: 20 }));
            renderMenuTab(5);
            const pillOff = document.getElementById('menu-val-click-walk').textContent;
            click();
            const whileOff = injected.length;
            menuActiveTab = 5; menuSelectedRow = 5; activateMenuRow();
            click();
            return { pillOff, whileOff, pillOn: document.getElementById('menu-val-click-walk').textContent, injected, saved: emuCollectSettings().clickToWalk };
        });
        assert.strictEqual(r.pillOff, 'OFF', 'off by default');
        assert.strictEqual(r.whileOff, 0, 'off: a right-click walks nowhere');
        assert.strictEqual(r.pillOn, 'ON');
        assert.deepStrictEqual(r.injected, ['walk(ACTIVE, COORDINATE_ABSOLUTE, 120, 60, ACTIVE, ACTIVE)'], 'on: walks to the clicked spot');
        assert.strictEqual(r.saved, true, 'the setting is saved');
        assert.deepStrictEqual(errors, []);
        console.log('  ✓ right-click walks only when switched on (EMULATION tab, off by default)');
    } catch (e) {
        failed = true;
        console.error('  ✗ ' + (e.stack || e));
    } finally {
        await browser.close();
    }
    console.log(failed ? '\n0 passed, 1 failed' : '\n1 passed, 0 failed');
    if (failed) process.exit(1);
})();
