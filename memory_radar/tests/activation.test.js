'use strict';
/**
 * Activation smoke test — verifies extension.js loads without errors and
 * activate() registers all expected commands.
 *
 * WHY THIS TEST EXISTS:
 * Top-level require() calls in extension.js run before activate().
 * A module-load failure silently prevents ALL commands from being registered,
 * producing "command not found" errors in VS Code with no visible stack trace.
 * This test catches that class of bug by mocking vscode, loading extension.js,
 * and verifying every expected command is registered after activate().
 *
 * Run with: node memory_radar/tests/activation.test.js
 */

const assert = require('assert');
const path   = require('path');

// ── Patch module resolution to intercept vscode ──────────────────────────────
// Must happen before any require that transitively loads vscode.
const Module = require('module');
const _orig  = Module._resolveFilename;
Module._resolveFilename = function (req, ...rest) {
    if (req === 'vscode') return req;
    return _orig.call(this, req, ...rest);
};

// ── vscode mock ───────────────────────────────────────────────────────────────
// Track every command registered via vscode.commands.registerCommand.
const registeredCommands = [];

const vscodeMock = {
    workspace: {
        workspaceFolders: null,
        getConfiguration: () => ({ get: () => null }),
        findFiles: () => Promise.resolve([]),
        onDidOpenTextDocument:    () => ({ dispose() {} }),
        onDidCloseTextDocument:   () => ({ dispose() {} }),
        onDidChangeTextDocument:  () => ({ dispose() {} }),
        createFileSystemWatcher: () => ({
            onDidChange: () => ({ dispose() {} }),
            onDidCreate: () => ({ dispose() {} }),
            onDidDelete: () => ({ dispose() {} }),
            dispose() {},
        }),
        onDidChangeConfiguration: () => ({ dispose() {} }),
    },
    window: {
        activeTextEditor: null,
        visibleTextEditors: [],
        onDidChangeActiveTextEditor:    () => ({ dispose() {} }),
        onDidChangeTextEditorSelection: () => ({ dispose() {} }),
        showInformationMessage: () => {},
        showWarningMessage:     () => {},
        showErrorMessage:       () => {},
        showOpenDialog:         () => Promise.resolve(undefined),
        showTextDocument:       () => Promise.resolve(),
        createStatusBarItem:    () => ({ show() {}, hide() {}, dispose() {} }),
        createOutputChannel:    () => ({ appendLine() {}, show() {} }),
        createTextEditorDecorationType: () => ({ dispose() {} }),
        createWebviewPanel: () => ({
            webview: { html: '', onDidReceiveMessage: () => ({ dispose() {} }), asWebviewUri: (u) => u },
            onDidDispose: () => ({ dispose() {} }),
            onDidChangeViewState: () => ({ dispose() {} }),
            dispose() {},
        }),
    },
    commands: {
        registerCommand(id) {
            registeredCommands.push(id);
            return { dispose() {} };
        },
        registerTextEditorCommand(id) {
            registeredCommands.push(id);
            return { dispose() {} };
        },
    },
    languages: {
        registerHoverProvider:            () => ({ dispose() {} }),
        registerCompletionItemProvider:   () => ({ dispose() {} }),
        registerDocumentSymbolProvider:   () => ({ dispose() {} }),
        registerDefinitionProvider:       () => ({ dispose() {} }),
        registerReferenceProvider:        () => ({ dispose() {} }),
        registerCodeLensProvider:         () => ({ dispose() {} }),
        createDiagnosticCollection:       () => ({ dispose() {} }),
    },
    debug: {
        registerDebugAdapterDescriptorFactory:  () => ({ dispose() {} }),
        registerDebugConfigurationProvider:      () => ({ dispose() {} }),
    },
    Uri: {
        file: (p) => ({ fsPath: p, toString: () => `file://${p}` }),
        joinPath: (a) => a,
    },
    ViewColumn:          { Two: 2, Beside: 3 },
    SymbolKind:          { Function: 11, Module: 1, Package: 3, Enum: 9, Constant: 13 },
    CompletionItemKind:  { Variable: 5, Keyword: 13, EnumMember: 19, Function: 2, Enum: 12 },
    TextEditorRevealType: { InCenterIfOutsideViewport: 2 },
    StatusBarAlignment:  { Right: 2 },
    EventEmitter:        class { constructor() { this.event = () => {}; } fire() {} },
    Disposable:          class { dispose() {} },
    CodeLens:            class { constructor(r, c) { this.range = r; this.command = c; } },
    Range:               class { constructor(s, e) { this.start = s; this.end = e; } },
    Position:            class { constructor(l, c) { this.line = l; this.character = c; } },
    Selection:           class { constructor(a, b) { this.anchor = a; this.active = b; } },
    DocumentSymbol:      class { constructor(n, d, k, r, sr) { this.name = n; this.detail = d; this.kind = k; this.range = r; this.selectionRange = sr; this.children = []; } },
    CompletionItem:      class { constructor(l, k) { this.label = l; this.kind = k; } },
    SnippetString:       class { constructor(v) { this.value = v; } },
    Hover:               class { constructor(c) { this.contents = c; } },
    MarkdownString:      class { constructor(v) { this.value = v; } },
    TreeItem:            class {},
    TreeItemCollapsibleState: { None: 0, Collapsed: 1, Expanded: 2 },
    WebviewPanel:        class {},
    ExtensionContext:    class {},
};

require.cache['vscode'] = {
    id: 'vscode', filename: 'vscode', loaded: true,
    exports: vscodeMock, paths: [],
};

// ── Mock context ──────────────────────────────────────────────────────────────
const mockContext = {
    extensionPath: path.join(__dirname, '..', '..'),
    subscriptions: [],
    globalState:   { get: () => undefined, update: () => {} },
    workspaceState: { get: () => undefined, update: () => {} },
};

// ── Test runner ───────────────────────────────────────────────────────────────
let passed = 0, failed = 0;
function test(name, fn) {
    try { fn(); console.log('  \u2713 ' + name); passed++; }
    catch (e) { console.error('  \u2717 ' + name + '\n    ' + e.message); failed++; }
}

// ── Tests ─────────────────────────────────────────────────────────────────────
console.log('\nActivation: extension loading');

let ext;
test('extension.js loads without throwing', () => {
    ext = require('../../extension.js');
});

test('extension exports activate and deactivate', () => {
    assert.strictEqual(typeof ext.activate,   'function', 'activate must be a function');
    assert.strictEqual(typeof ext.deactivate, 'function', 'deactivate must be a function');
});

test('activate() runs to completion without throwing', () => {
    ext.activate(mockContext);
});

// ── Command registration ──────────────────────────────────────────────────────
console.log('\nActivation: command registration');

const EXPECTED_COMMANDS = [
    'everscript.openMemoryRadar',
    'everscript.openEmulator',
    'everscript.openSettings',
    'everscript.buildAndRun',
    'everscript._scriptFocus',
];

for (const cmd of EXPECTED_COMMANDS) {
    test(`registers command: ${cmd}`, () => {
        assert.ok(
            registeredCommands.includes(cmd),
            `"${cmd}" was not registered — did activate() throw before reaching this registerCommand call?`,
        );
    });
}

// ── Module exports ────────────────────────────────────────────────────────────
console.log('\nActivation: module exports');

const EXPECTED_EXPORTS = {
    './memory_radar/room-data': [
        'VANILLA_ROOMS', 'getMapEnum', 'readLuaWatchers', 'readScriptAllTriggers',
        'buildVanillaRoomContent', 'buildVanillaRoomDetails', 'invalidateRoomDataCaches',
    ],
    './memory_radar/room-tree': [
        'findRoomImage', 'parseRoomContent', 'collectRoomsFromDir', 'buildRoomTree',
        'renderVanillaTree', 'renderRoomsTree', 'buildRoomsJson', 'setRoomImageUris',
    ],
    './memory_radar/rom-readers': [
        'readPngDimensions', 'readRomTriggerOffsets', 'readRomMapHeader',
        'readRomCharacters', 'readRomHitLookup', 'detectScaleEnemies',
    ],
    './code_highlighter/language-providers': [
        'loadIndex', 'buildWorkspaceIndex', 'indexDocument',
        'provideHover', 'provideDocumentSymbols',
        'getDeadDecorationType', 'updateDeadBranchDecorations',
        'provideCompletionItems', 'provideDefinition', 'provideReferences',
    ],
};

for (const [modPath, names] of Object.entries(EXPECTED_EXPORTS)) {
    const absPath = path.join(__dirname, '..', '..', modPath.replace(/^\.\//, ''));
    const mod = require(absPath);
    for (const name of names) {
        test(`${modPath.split('/').pop()} exports: ${name}`, () => {
            assert.ok(
                name in mod,
                `Expected export "${name}" in ${modPath} — if you renamed or removed it, update the call sites in extension.js`,
            );
        });
    }
}

// ── Summary ───────────────────────────────────────────────────────────────────
console.log(`\n${passed + failed} run: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
