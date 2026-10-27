// TODO port to TS (docs/todo/port-to-ts.md)
// Open the emulator, close it, open it again (core/emulator/panel.ts). v0.355.5: closing saved the CDL, the save
// posted "saved" to the page, the disposed webview threw "Webview is disposed" inside onDidDispose, emu.panel stayed
// set, and the next Open Emulator Panel failed with that error. A fake VS Code whose webview throws once disposed.
// Run: node tests/debugger/emulator-reopen.test.js
'use strict';
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Mod = require('module');

const ROOT = path.join(__dirname, '../..');
const DIST = path.join(ROOT, 'dist/core/emulator');
let passed = 0, failed = 0;
function test(name, fn) {
    try { fn(); console.log('  ✓ ' + name); passed++; }
    catch (e) { console.error('  ✗ ' + name + '\n    ' + (e.stack || e)); failed++; }
}

function fakePanel() {
    let disposed = false, onDispose = null;
    const guard = () => { if (disposed) throw new Error('Webview is disposed'); };
    const panel = {
        webview: {
            set html(_) { guard(); }, get html() { return ''; },
            postMessage() { guard(); return Promise.resolve(true); },
            asWebviewUri: u => u, cspSource: '',
            onDidReceiveMessage() { return { dispose() {} }; },
        },
        reveal() { guard(); },
        onDidDispose(cb) { onDispose = cb; return { dispose() {} }; },
        close() { disposed = true; onDispose(); },
    };
    return panel;
}

test('open, close while a host still sends, open again: a new panel, no error', () => {
    const panels = [];
    const vscodeMock = {
        window: {
            createWebviewPanel() { const p = fakePanel(); panels.push(p); return p; },
            visibleTextEditors: [], activeTextEditor: null,
            createOutputChannel() { return { appendLine() {}, show() {} }; },
            setStatusBarMessage() { return { dispose() {} }; },
            showErrorMessage() {}, showWarningMessage() { return Promise.resolve(undefined); }, showInformationMessage() {},
        },
        ViewColumn: { Beside: 2, Active: 1 },
        Uri: { file(p) { return { fsPath: p, toString() { return 'file://' + p; } }; } },
        workspace: { getConfiguration() { return { get(_k, d) { return d !== undefined ? d : ''; } }; }, workspaceFolders: [] },
        debug: { activeDebugSession: null, startDebugging: async () => false },
        commands: { executeCommand() {} },
    };
    const load = Mod._load;
    Mod._load = (req, parent, isMain) => (req === 'vscode' ? vscodeMock : load(req, parent, isMain));
    try {
        const { openEmulatorPanel } = require(path.join(DIST, 'panel'));
        const { emu } = require(path.join(DIST, 'panel-state'));
        const storage = fs.mkdtempSync(path.join(os.tmpdir(), 'evs-reopen-'));
        const context = { extensionPath: ROOT, subscriptions: [], globalStorageUri: { fsPath: storage },
            globalState: { get: (_k, d) => d, update: async () => {} } };
        openEmulatorPanel(context, null, null);
        assert.strictEqual(panels.length, 1);
        // A host that says something while the panel closes (the CDL save's "saved" / cdlSaved).
        const cdl = emu.cdl;
        cdl.dispose = () => cdl.post({ command: 'cdlStatus', text: 'saved' });
        panels[0].close();
        assert.strictEqual(emu.panel, null, 'the closed panel is forgotten');
        openEmulatorPanel(context, null, null);
        assert.strictEqual(panels.length, 2, 'a new panel, not a reveal of the dead one');
        panels[1].close();
    } finally {
        Mod._load = load;
    }
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
