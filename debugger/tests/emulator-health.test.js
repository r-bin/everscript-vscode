'use strict';
/**
 * debugger/tests/emulator-health.test.js
 *
 * Validates the snes9x2005-wasm core assets bundled with the extension.
 * The EmulatorJS wrapper has been removed (v0.2.67+); we now load the
 * Emscripten-compiled core directly inside the VS Code webview.
 *
 * Checks:
 *   A) Core files exist at emulator/core/
 *   B) WASM binary has correct magic bytes
 *   C) Core JS contains all required Emscripten exports
 *   D) Core JS does NOT define EJS_Runtime (it is NOT a libretro wrapper)
 *   E) panel.js does not reference the old EmulatorJS vendor paths
 */

const assert = require('assert');
const fs     = require('fs');
const path   = require('path');

const ROOT      = path.resolve(__dirname, '../..');
const CORE_DIR  = path.join(ROOT, 'emulator', 'core');
const CORE_JS   = path.join(CORE_DIR, 'snes9x_2005.js');
const CORE_WASM = path.join(CORE_DIR, 'snes9x_2005.wasm');
const PANEL_JS  = path.join(ROOT, 'emulator', 'panel.js');

// WebAssembly binary magic: \0asm  (00 61 73 6D)
const WASM_MAGIC = Buffer.from([0x00, 0x61, 0x73, 0x6d]);

let passed = 0;
let failed = 0;
const xfails = [];

function test(name, fn) {
    try {
        fn();
        console.log(`  \u2713 ${name}`);
        passed++;
    } catch (e) {
        console.error(`  \u2717 ${name}`);
        console.error(`    ${e.message}`);
        failed++;
    }
}

function xtest(name, reason, fn) {
    try {
        fn();
        console.log(`  ~ xfail [passed \u2014 may be fixed] ${name}`);
        xfails.push({ name, reason: 'UNEXPECTEDLY PASSED \u2014 verify fix: ' + reason });
    } catch (e) {
        console.log(`  ~ xfail [expected]  ${name}`);
        xfails.push({ name, reason: e.message });
    }
}

// ── A. Core files ─────────────────────────────────────────────────────────────
console.log('\nA. Core files (emulator/core/):');

test('snes9x_2005.js exists', () => {
    assert.ok(fs.existsSync(CORE_JS), `snes9x_2005.js not found at ${CORE_JS}`);
});

test('snes9x_2005.wasm exists', () => {
    assert.ok(fs.existsSync(CORE_WASM), `snes9x_2005.wasm not found at ${CORE_WASM}`);
});

// ── B. WASM binary validation ─────────────────────────────────────────────────
console.log('\nB. WASM binary:');

test('snes9x_2005.wasm has correct magic bytes (\\0asm)', () => {
    const fd  = fs.openSync(CORE_WASM, 'r');
    const buf = Buffer.alloc(4);
    fs.readSync(fd, buf, 0, 4, 0);
    fs.closeSync(fd);
    assert.ok(WASM_MAGIC.equals(buf),
        `wrong magic bytes: ${buf.toString('hex')} (expected 0061736d)`);
});

// ── C. Required Emscripten exports ────────────────────────────────────────────
console.log('\nC. Required exports in snes9x_2005.js:');

let coreJsContent = null;
try { coreJsContent = fs.readFileSync(CORE_JS, 'utf8'); } catch (_) {}

const REQUIRED_EXPORTS = [
    '_mainLoop',
    '_startWithRom',
    '_getScreenBuffer',
    '_getSoundBuffer',
    '_setJoypadInput',
    '_my_malloc',
    '_my_free',
    '_saveState',
    '_getStateSaveSize',
];

for (const exp of REQUIRED_EXPORTS) {
    test(`core JS exports ${exp}`, () => {
        if (!coreJsContent) { assert.fail('snes9x_2005.js could not be read'); return; }
        assert.ok(coreJsContent.includes(exp),
            `"${exp}" not found in snes9x_2005.js`);
    });
}

// ── D. EJS_Runtime check ──────────────────────────────────────────────────────
// snes9x_2005.js is a standalone Emscripten build, NOT a libretro wrapper.
// It must NOT define EJS_Runtime. If it does, we accidentally bundled the wrong core.
console.log('\nD. EJS_Runtime (must be absent \u2014 we run the core directly, not via EmulatorJS):');

test('core JS does NOT define EJS_Runtime', () => {
    if (!coreJsContent) { assert.fail('snes9x_2005.js could not be read'); return; }
    assert.ok(!coreJsContent.includes('EJS_Runtime'),
        'snes9x_2005.js unexpectedly defines EJS_Runtime \u2014 wrong core bundled (should be lrusso standalone build)');
});

// ── E. panel.js sanity ────────────────────────────────────────────────────────
console.log('\nE. panel.js:');

let panelContent = null;
try { panelContent = fs.readFileSync(PANEL_JS, 'utf8'); } catch (_) {}

test('panel.js exists', () => {
    assert.ok(fs.existsSync(PANEL_JS), 'emulator/panel.js not found');
});

test('panel.js references emulator/core not emulator/vendor', () => {
    if (!panelContent) { assert.fail('panel.js could not be read'); return; }
    assert.ok(!panelContent.includes('emulator/vendor'),
        'panel.js still references emulator/vendor — remove EmulatorJS dependency');
});

test('panel.js references CORE_JS constant', () => {
    if (!panelContent) { assert.fail('panel.js could not be read'); return; }
    assert.ok(panelContent.includes('snes9x_2005.js'),
        'panel.js does not reference snes9x_2005.js');
});

test('panel.js exports openEmulatorPanel', () => {
    if (!panelContent) { assert.fail('panel.js could not be read'); return; }
    assert.ok(panelContent.includes('module.exports') && panelContent.includes('openEmulatorPanel'),
        'panel.js does not export openEmulatorPanel');
});

test('panel.js arms write breakpoints with WRAM offsets', () => {
    if (!panelContent) { assert.fail('panel.js could not be read'); return; }
    assert.ok(panelContent.includes('SCRIPT_BASE + slot * SLOT_SIZE'),
        'script stack hook does not appear to use WRAM offsets required by addWriteBreakpoint()');
});

test('panel.js resumes AudioContext after user interaction', () => {
    if (!panelContent) { assert.fail('panel.js could not be read'); return; }
    assert.ok(panelContent.includes('audioCtx.resume()'),
        'panel.js does not resume AudioContext; webview audio may stay suspended');
});

test('panel.js reads Float32 planar audio blocks from the core', () => {
    if (!panelContent) { assert.fail('panel.js could not be read'); return; }
    assert.ok(panelContent.includes('new Float32Array(HEAPF32.buffer, ptr, AUDIO_BLOCK_SIZE * 2)'),
        'panel.js does not appear to read the core audio buffer as Float32 planar samples');
});

test('panel.js applies transform-based canvas scaling', () => {
    if (!panelContent) { assert.fail('panel.js could not be read'); return; }
    assert.ok(panelContent.includes("canvas.style.transform = 'scale('"),
        'panel.js does not apply deterministic transform-based scaling to the screen canvas');
});

test('panel.js logs script hook arm and observed-write status', () => {
    if (!panelContent) { assert.fail('panel.js could not be read'); return; }
    assert.ok(panelContent.includes('debugHookStatus') && panelContent.includes('debugHookObserved'),
        'panel.js does not emit explicit hook lifecycle or observed-write log messages');
});

test('panel.js exposes break-all-hooks and debugger-connect controls', () => {
    if (!panelContent) { assert.fail('panel.js could not be read'); return; }
    assert.ok(panelContent.includes('ss-hook-all-btn') && panelContent.includes('connectDebugger'),
        'panel.js does not expose the break-all-hooks or debugger connect controls');
});

// ── F. ROM dispatch correctness ───────────────────────────────────────────────
console.log('\nF. ROM dispatch correctness:');

test('panel.js sends ROM once from ready handler', () => {
    if (!panelContent) { assert.fail('panel.js could not be read'); return; }
    const readyIdx = panelContent.indexOf("case 'ready'");
    const nextCase = panelContent.indexOf("case '", readyIdx + 1);
    const block = panelContent.slice(readyIdx, nextCase);
    assert.ok(block.includes('Sending ROM to webview once'),
        'ready handler does not log single-shot ROM send');
    assert.ok(block.includes('_armRomTimeout('),
        'ready handler does not arm ROM timeout before sending');
    assert.ok(block.includes("command: 'loadRom'"),
        'ready handler does not send loadRom');
});

test('panel.js does not use dispatch retry protocol', () => {
    if (!panelContent) { assert.fail('panel.js could not be read'); return; }
    assert.ok(!panelContent.includes('_beginPendingDispatchLoop'),
        'panel.js still contains _beginPendingDispatchLoop');
    assert.ok(!panelContent.includes('_clearDispatchTimer'),
        'panel.js still contains _clearDispatchTimer');
    assert.ok(!panelContent.includes('_dispatchTimer'),
        'panel.js still contains _dispatchTimer state');
    assert.ok(!panelContent.includes('_dispatchStopAt'),
        'panel.js still contains _dispatchStopAt state');
    assert.ok(!panelContent.includes('_dispatchLogged'),
        'panel.js still contains _dispatchLogged state');
});

test('panel.js does not use romLoadAccepted/romLoadFailed handlers', () => {
    if (!panelContent) { assert.fail('panel.js could not be read'); return; }
    assert.ok(!panelContent.includes("case 'romLoadAccepted'"),
        'panel.js still contains romLoadAccepted handler');
    assert.ok(!panelContent.includes("case 'romLoadFailed'"),
        'panel.js still contains romLoadFailed handler');
});

test('webview loadRom handler has no romLaunchRequested guard', () => {
    if (!panelContent) { assert.fail('panel.js could not be read'); return; }
    assert.ok(!panelContent.includes('let romLaunchRequested'),
        'webview still defines romLaunchRequested');
    assert.ok(!panelContent.includes('loadRom ignored: launch already in progress'),
        'webview still ignores loadRom while startup is in progress');
});

test('startWithRom does not emit ack protocol messages', () => {
    if (!panelContent) { assert.fail('panel.js could not be read'); return; }
    const startWithRomIdx = panelContent.indexOf('function startWithRom');
    const nextFnIdx = panelContent.indexOf('\n    function ', startWithRomIdx + 1);
    const startWithRomBody = panelContent.slice(startWithRomIdx, nextFnIdx);
    assert.ok(!startWithRomBody.includes("command: 'romLoadAccepted'"),
        'startWithRom still sends romLoadAccepted');
    assert.ok(!startWithRomBody.includes("command: 'romLoadFailed'"),
        'startWithRom still sends romLoadFailed');
});

test('startWithRom failure path does not reset retry guard state', () => {
    if (!panelContent) { assert.fail('panel.js could not be read'); return; }
    const startWithRomIdx = panelContent.indexOf('function startWithRom');
    const nextFnIdx = panelContent.indexOf('\n    function ', startWithRomIdx + 1);
    const catchBody = panelContent.slice(panelContent.indexOf('} catch (', startWithRomIdx), nextFnIdx);
    assert.ok(!catchBody.includes('romLaunchRequested = false'),
        'startWithRom catch block still resets removed retry state');
});

test('panel.js logs selected core file paths and webview URIs', () => {
    if (!panelContent) { assert.fail('panel.js could not be read'); return; }
    assert.ok(panelContent.includes('Core selected ('),
        'panel.js does not log which core files were selected');
    assert.ok(panelContent.includes('Core webview URIs:'),
        'panel.js does not log webview core JS/WASM URIs');
});

test('webview locateFile maps any .wasm filename to coreWasmUri', () => {
    if (!panelContent) { assert.fail('panel.js could not be read'); return; }
    assert.ok(panelContent.includes("filename.endsWith('.wasm')"),
        'Module.locateFile is not robust against alternate wasm filenames');
});

test('panel.js forwards host status messages to webview load-status', () => {
    if (!panelContent) { assert.fail('panel.js could not be read'); return; }
    assert.ok(panelContent.includes("command: 'hostStatus'"),
        'panel.js does not post hostStatus updates to the webview');
    assert.ok(panelContent.includes("evt.data.command === 'hostStatus'"),
        'webview does not handle hostStatus updates for visible error reporting');
});

test('panel.js is ASCII-only to avoid webview parser/encoding issues', () => {
    if (!panelContent) { assert.fail('panel.js could not be read'); return; }
    assert.ok(!/[^\x09\x0A\x0D\x20-\x7E]/.test(panelContent),
        'panel.js contains non-ASCII characters that may break webview document parsing');
});

test('debug adapter supports emulator sync request', () => {
    const adapterPath = path.join(ROOT, 'debugger', 'adapter.js');
    const adapterContent = fs.readFileSync(adapterPath, 'utf8');
    assert.ok(adapterContent.includes('handlers.syncFromEmulator'),
        'debugger/adapter.js does not handle syncFromEmulator requests');
});

// ── G. ROM load simulation ────────────────────────────────────────────────────
console.log('\nG. ROM load simulation:');

// Static structure: verify unsafe-inline CSP replaces nonce
test('panel.js uses wildcard script-src with unsafe-inline (no nonce on script tag)', () => {
    if (!panelContent) { assert.fail('panel.js could not be read'); return; }
    // Must have 'unsafe-inline' for inline script execution
    assert.ok(panelContent.includes("'unsafe-inline'"),
        "panel.js webview CSP does not include 'unsafe-inline'");
    // Must use wildcard source so the core JS loads regardless of vscode-cdn subdomain depth
    assert.ok(panelContent.includes("script-src * blob: data:"),
        "panel.js CSP script-src must use wildcard (*) to allow coreJs URI and inline scripts");
    // No nonce-based restriction (nonce in CSP suppresses 'unsafe-inline' per CSP spec)
    assert.ok(!panelContent.includes("nonce-${nonce}"),
        "panel.js CSP still uses 'nonce-\${nonce}' — this suppresses 'unsafe-inline' and blocks the boot script");
    assert.ok(!panelContent.includes('<script nonce='),
        'panel.js <script> tag still carries a nonce attribute');
});

// Static structure: error handlers must precede acquireVsCodeApi
test('panel.js registers onerror before calling acquireVsCodeApi', () => {
    if (!panelContent) { assert.fail('panel.js could not be read'); return; }
    const scriptStart = panelContent.indexOf('<script>');
    assert.ok(scriptStart > 0, 'no bare <script> tag found in webview HTML');
    const oerrIdx = panelContent.indexOf('window.onerror', scriptStart);
    const acqIdx  = panelContent.indexOf('acquireVsCodeApi()', scriptStart);
    assert.ok(oerrIdx > 0, 'window.onerror not found inside webview script');
    assert.ok(acqIdx  > 0, 'acquireVsCodeApi() not found inside webview script');
    assert.ok(oerrIdx < acqIdx,
        'window.onerror must be registered BEFORE acquireVsCodeApi() to catch init errors');
});

// Static structure: webviewBoot follows acquireVsCodeApi
test('webview sends webviewBoot after acquiring vscodeApi', () => {
    if (!panelContent) { assert.fail('panel.js could not be read'); return; }
    const acqIdx  = panelContent.indexOf('acquireVsCodeApi()');
    const bootIdx = panelContent.indexOf("{ command: 'webviewBoot' }", acqIdx);
    assert.ok(bootIdx > acqIdx, 'webviewBoot not sent after acquireVsCodeApi()');
});

// Static structure: gameStarted is sent from startWithRom success path
test('webview sends gameStarted after startWithRom success', () => {
    if (!panelContent) { assert.fail('panel.js could not be read'); return; }
    const startIdx = panelContent.indexOf('function startWithRom');
    const endIdx   = panelContent.indexOf('\n    // -- Render loop', startIdx);
    const body     = panelContent.slice(startIdx, endIdx > startIdx ? endIdx : startIdx + 2000);
    assert.ok(body.includes("command: 'gameStarted'"),
        'startWithRom does not send gameStarted on success');
});

// Mock-based protocol flow: open panel → ready → loadRom → gameStarted
(function() {
    var OrigMod  = require('module');
    var origLoad = OrigMod._load.bind(OrigMod);
    var _html = '', _sent = [], _recv = null;

    var mockWebview = {
        get html()  { return _html; },
        set html(v) { _html = v; },
        postMessage: function(m) { _sent.push(m); },
        onDidReceiveMessage: function(h) { _recv = h; return { dispose: function() {} }; },
        asWebviewUri: function(u) {
            return { toString: function() { return 'https://x/' + (u.fsPath || ''); } };
        },
        cspSource: 'https://x'
    };
    var mockPane = {
        webview: mockWebview,
        reveal: function() {},
        onDidDispose: function() { return { dispose: function() {} }; }
    };
    var mockVscode = {
        window: {
            createWebviewPanel: function() { return mockPane; },
            visibleTextEditors:  [],
            createOutputChannel: function() { return { appendLine: function() {}, show: function() {} }; },
            setStatusBarMessage: function() { return { dispose: function() {} }; },
            showErrorMessage: function() {}
        },
        ViewColumn: { Beside: 2, Active: 1 },
        Uri: { file: function(p) { return { fsPath: p, toString: function() { return 'file://' + p; } }; } },
        workspace: {
            getConfiguration: function() { return { get: function(_k, d) { return d !== undefined ? d : ''; } }; },
            workspaceFolders: []
        },
        debug: { activeDebugSession: null }
    };

    OrigMod._load = function(req, parent, isMain) {
        if (req === 'vscode') return mockVscode;
        return origLoad(req, parent, isMain);
    };
    delete require.cache[require.resolve(PANEL_JS)];
    var pmod = null;
    try { pmod = require(PANEL_JS); } catch(e) { /* load error handled in test */ }
    OrigMod._load = origLoad;

    test('mock: panel module loads and exports openEmulatorPanel', function() {
        assert.ok(pmod, 'panel.js failed to load with mocked vscode');
        assert.ok(typeof pmod.openEmulatorPanel === 'function',
            'openEmulatorPanel not exported');
    });

    if (!pmod) return;

    var mockCtx = { extensionPath: ROOT, subscriptions: [] };
    var mockRom = { dataUrl: 'data:application/octet-stream;base64,AAAA', name: 'test.smc' };

    test('mock: openEmulatorPanel sets webview HTML with expected content', function() {
        pmod.openEmulatorPanel(mockCtx, mockRom, null);
        assert.ok(_html.length > 200, 'webview HTML was not set (got ' + _html.length + ' chars)');
        assert.ok(_html.includes('Everscript Emulator'), 'HTML missing title');
        assert.ok(_html.includes('<script'), 'HTML has no script tag');
    });

    test('mock: ready message triggers loadRom dispatch to webview', function() {
        assert.ok(typeof _recv === 'function', 'panel did not register onDidReceiveMessage');
        _sent = [];
        _recv({ command: 'ready' });
        var lr = _sent.find(function(m) { return m.command === 'loadRom'; });
        assert.ok(lr,
            'host did not send loadRom after ready; messages: ' + _sent.map(function(m) { return m.command; }).join(', '));
        assert.strictEqual(lr.name, 'test.smc', 'loadRom has wrong name');
        assert.ok(typeof lr.dataUrl === 'string' && lr.dataUrl.startsWith('data:'),
            'loadRom missing dataUrl');
    });

    test('mock: gameStarted message confirms core is playing ROM', function() {
        _sent = [];
        _recv({ command: 'gameStarted', name: 'test.smc' });
        var errs = _sent.filter(function(m) { return m.command === 'ejsError'; });
        assert.strictEqual(errs.length, 0,
            'gameStarted handler caused ejsError: ' + JSON.stringify(errs));
    });
})();


console.log('');
if (xfails.length) {
    console.log('  Known issues (xfail):');
    for (const x of xfails) {
        console.log(`    ~ ${x.name}`);
        console.log(`      ${x.reason}`);
    }
    console.log('');
}
console.log(`  ${passed} passed, ${failed} failed, ${xfails.length} xfail`);
console.log('');

if (failed > 0) process.exit(1);
