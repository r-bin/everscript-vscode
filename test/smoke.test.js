'use strict';
/**
 * Smoke test: render the full webview HTML and execute the embedded JS
 * using Node's `vm` module to catch runtime errors without a browser.
 */
const assert = require('assert');
const vm     = require('vm');

// ── Mock vscode before requiring extension ───────────────────────────────────
const Module = require('module');
const _orig  = Module._resolveFilename;
Module._resolveFilename = function(req, ...rest) {
    if (req === 'vscode') return req;
    return _orig.call(this, req, ...rest);
};
require.cache['vscode'] = {
    id: 'vscode', filename: 'vscode', loaded: true,
    exports: {
        workspace: { workspaceFolders: null, onDidOpenTextDocument: ()=>({dispose:()=>{}}), onDidCloseTextDocument: ()=>({dispose:()=>{}}), onDidChangeTextDocument: ()=>({dispose:()=>{}}), createFileSystemWatcher: ()=>({onDidChange:()=>({dispose:()=>{}}),dispose:()=>{}}) },
        window: { createWebviewPanel: ()=>{}, onDidChangeActiveTextEditor: ()=>({dispose:()=>{}}), activeTextEditor: null, showInformationMessage: ()=>{} },
        commands: { registerCommand: ()=>({dispose:()=>{}}) },
        languages: { registerHoverProvider: ()=>({dispose:()=>{}}), registerCompletionItemProvider: ()=>({dispose:()=>{}}), registerDefinitionProvider: ()=>({dispose:()=>{}}), registerCodeLensProvider: ()=>({dispose:()=>{}}) },
        Uri: { file: (p)=>({fsPath:p, toString:()=>`file://${p}`}) },
        ViewColumn: { Two: 2, Beside: 3 },
        SymbolKind: { Function:11, Module:1, Package:3, Enum:9, Constant:13 },
        CompletionItemKind: { Variable:5, Keyword:13, EnumMember:19, Function:2, Enum:12 },
        TextEditorRevealType: { InCenterIfOutsideViewport: 2 },
        ExtensionContext: class {},
        HoverProvider: class {},
        CompletionItemProvider: class {},
        CompletionItem: class { constructor(l,k){ this.label=l; this.kind=k; } },
        Hover: class { constructor(c){ this.contents=c; } },
        MarkdownString: class { constructor(v){ this.value=v; } },
        CodeLens: class { constructor(r,c){ this.range=r; this.command=c; } },
        Range: class { constructor(s,e){ this.start=s; this.end=e; } },
        Position: class { constructor(l,c){ this.line=l; this.character=c; } },
        Selection: class { constructor(a,b){ this.anchor=a; this.active=b; } },
        DocumentSymbol: class { constructor(n,d,k,r,sr){ this.name=n; this.detail=d; this.kind=k; this.range=r; this.selectionRange=sr; this.children=[]; } },
        SnippetString: class { constructor(v){ this.value=v; } },
        EventEmitter: class { constructor(){ this.event=()=>{}; } fire(){} },
        WebviewPanel: class {},
    }
};

const ext = require('../extension.js');

// Pull out renderRadarHtml for testing (it's not exported, so we extract from module source)
// Instead, test via a helper that reconstructs minimal inputs.
// We also need buildRoomsJson, renderRoomsTree — test them via a thin wrapper.

const { radarH } = require('../radar-utils');

// ── Helpers ───────────────────────────────────────────────────────────────────
let passed = 0, failed = 0;
function test(name, fn) {
    try { fn(); console.log('  \u2713', name); passed++; }
    catch(e) { console.error('  \u2717', name, '\n   ', e.message); failed++; }
}

// Execute JS string in a vm sandbox and return the sandbox.
// acquireVsCodeApi is mocked to a no-op.
function runWebviewJs(jsCode) {
    const sandbox = {
        acquireVsCodeApi: () => ({ postMessage: () => {} }),
        document: makeFakeDocument(),
        console: { log: ()=>{}, warn: ()=>{}, error: ()=>{} },
        setTimeout: ()=>{},
        clearTimeout: ()=>{},
        parseInt,
        isNaN,
        Math,
        JSON,
        String,
        Array,
        Set,
        Map,
        Error,
    };
    vm.createContext(sandbox);
    vm.runInContext(jsCode, sandbox, { timeout: 5000 });
    return sandbox;
}

// Minimal fake DOM — enough for the webview JS to not crash.
function makeFakeDocument() {
    const elements = {};
    function makeEl(id) {
        const classList = new FakeClassList();
        const children = [];
        const el = {
            _id: id,
            classList,
            dataset: {},
            style: {},
            children,
            innerHTML: '',
            querySelectorAll: (sel) => [],
            querySelector: (sel) => null,
            closest: (sel) => null,
            addEventListener: () => {},
            scrollTop: 0,
            scrollHeight: 0,
            clientHeight: 0,
            getBoundingClientRect: () => ({ top:0, bottom:0, height:0 }),
        };
        return el;
    }
    class FakeClassList {
        constructor() { this._set = new Set(); }
        add(...c)    { c.forEach(x=>this._set.add(x)); }
        remove(...c) { c.forEach(x=>this._set.delete(x)); }
        toggle(c, force) {
            if (force === undefined) { this._set.has(c)?this._set.delete(c):this._set.add(c); }
            else { force ? this._set.add(c) : this._set.delete(c); }
        }
        contains(c)  { return this._set.has(c); }
    }
    const body = makeEl('body');
    return {
        body,
        querySelector: (sel) => {
            if (sel === 'body') return body;
            // Return a dummy element for everything else
            return makeEl(sel);
        },
        querySelectorAll: (sel) => [],
        getElementById: (id) => makeEl(id),
        addEventListener: () => {},
    };
}

// ── Extract the JS+data block from a rendered HTML page ──────────────────────
function extractScript(html) {
    // Grab content between last <script> and </script>
    const start = html.lastIndexOf('<script>');
    const end   = html.lastIndexOf('<\/script>');
    if (start === -1 || end === -1) throw new Error('No <script> block found in HTML');
    return html.slice(start + 8, end);
}

// ── Build minimal inputs for renderRadarHtml ──────────────────────────────────
// We need to call renderRadarHtml. It's not exported, so we call activate with
// mocked context then trigger a render. Instead, we reach into the module via a
// small trick: wrap renderRadarHtml call inside the extension by patching
// module.exports temporarily. Since we can't do that easily, we extract it from
// the source and eval it with mocked deps.

// Simpler: just invoke the extension's renderRadarHtml by adding it to exports
// temporarily in a test-only re-require with the function exposed.
// We'll do this by reading the source, appending an export, and eval'ing it.

const fs   = require('fs');
const path = require('path');
const src  = fs.readFileSync(path.join(__dirname, '..', 'extension.js'), 'utf8');

// Patch: replace `module.exports = { activate, deactivate };` with extended export
const patchedSrc = src.replace(
    /module\.exports\s*=\s*\{[^}]+\};?\s*$/,
    'module.exports = { activate, deactivate, _renderRadarHtml: renderRadarHtml, _buildRoomsJson: buildRoomsJson, _renderRoomsTree: renderRoomsTree };'
);

// Write to tmp in the same dir as extension.js so relative requires resolve
const tmpPath = path.join(__dirname, '..', '_smoke_tmp.js');
fs.writeFileSync(tmpPath, patchedSrc);
let extFull;
try {
    // Clear any cached version
    delete require.cache[require.resolve(tmpPath)];
    extFull = require(tmpPath);
} finally {
    fs.unlinkSync(tmpPath);
}

const { _renderRadarHtml, _buildRoomsJson, _renderRoomsTree } = extFull;

// ── Tests ─────────────────────────────────────────────────────────────────────

console.log('\nSmoke: renderRoomsTree');
test('empty tree returns rm-empty div', () => {
    const html = _renderRoomsTree([]);
    assert.ok(html.includes('rm-empty'), 'Expected rm-empty');
});
test('area node renders rn-area', () => {
    const html = _renderRoomsTree([{ kind:'area', name:'TestArea', children:[] }]);
    assert.ok(html.includes('rn-area'), html);
});
test('map node renders rn-map', () => {
    const html = _renderRoomsTree([{ kind:'map', name:'my_room', vanillaId:'BRIAN', startLine:1 }]);
    assert.ok(html.includes('rn-map'), html);
    assert.ok(html.includes('my_room'), html);
});

console.log('\nSmoke: buildRoomsJson');
test('serializes map node without scriptLines', () => {
    const tree = [{
        kind:'map', name:'test_room', vanillaId:'FOO', relPath:'in/test.evs',
        startLine:0, endLine:10, imageUri:null, imageDims:null,
        content:{
            initMap:null, entrances:[], enemies:[], objects:[], transitions:[],
            triggers:{ stepOn:[{x1:0,y1:0,x2:5,y2:5,label:'go',scriptLines:['line1','line2']}], bTrigger:[] }
        }
    }];
    const js = _buildRoomsJson(tree, 'radar', null);
    assert.ok(!js.includes('scriptLines'), 'scriptLines must be stripped from JSON');
    assert.ok(js.includes('"label":"go"'), 'label should remain');
    assert.ok(js.includes('ROOMS'), 'Must contain ROOMS var');
});
test('ROOMS JSON is valid JS (eval)', () => {
    const tree = [{ kind:'map', name:'r', vanillaId:'X', relPath:'', startLine:0, endLine:0, imageUri:null, imageDims:null, content:{ initMap:{x1:0,y1:0,x2:32,y2:24}, entrances:[], enemies:[], objects:[], transitions:[], triggers:{stepOn:[],bTrigger:[]} } }];
    const js = _buildRoomsJson(tree, 'rooms', 'r');
    let sandbox = {}; vm.createContext(sandbox); vm.runInContext(js, sandbox);
    assert.ok(sandbox.ROOMS.r, 'ROOMS.r should exist');
    assert.strictEqual(sandbox.ACTIVE_TAB, 'rooms');
    assert.strictEqual(sandbox.SELECTED_MAP, 'r');
});

console.log('\nSmoke: renderRadarHtml (full HTML + JS execution)');

const scope    = { kind:'function', name:'test_fn', startLine:0, endLine:100 };
const refs     = new Map();
const pools    = [];
const argRefs  = new Map([[0x00, {reads:[1],writes:[2]}],[0x01,{reads:[],writes:[3]}]]);
const mapByAddr= new Map();
const roomTree = [{ kind:'map', name:'my_room', vanillaId:'BRIAN', relPath:'', startLine:0, endLine:5, imageUri:null, imageDims:null, content:{ initMap:{x1:0,y1:0,x2:32,y2:24}, entrances:[{name:'SOUTH_ENT',x:16,y:23,dir:'NORTH',line:3}], enemies:[{type:'RAT',x:10,y:10,dynamic:false,line:4}], objects:[], transitions:[], triggers:{stepOn:[{x1:4,y1:4,x2:8,y2:8,label:'enter cave'}],bTrigger:[{x1:14,y1:14,x2:18,y2:18,label:''}]} } }];

test('renderRadarHtml produces HTML string', () => {
    const html = _renderRadarHtml(scope, refs, pools, argRefs, mapByAddr, roomTree, 'radar', null);
    assert.ok(typeof html === 'string' && html.startsWith('<!doctype'), 'Expected HTML');
    assert.ok(html.includes('<script>'), 'Must contain <script>');
    assert.ok(html.includes('ROOMS'), 'Must contain ROOMS');
    assert.ok(!html.includes('scriptLines'), 'scriptLines must not appear in output');
});

test('webview JS executes without throwing (radar tab)', () => {
    const html = _renderRadarHtml(scope, refs, pools, argRefs, mapByAddr, roomTree, 'radar', null);
    const js = extractScript(html);
    // Must not throw
    runWebviewJs(js);
});

test('webview JS executes without throwing (rooms tab)', () => {
    const html = _renderRadarHtml(scope, refs, pools, argRefs, mapByAddr, roomTree, 'rooms', 'my_room');
    const js = extractScript(html);
    runWebviewJs(js);
});

test('ROOMS var populated in webview JS', () => {
    const html = _renderRadarHtml(scope, refs, pools, argRefs, mapByAddr, roomTree, 'rooms', 'my_room');
    // ROOMS is declared inside the IIFE, not on sandbox; verify it appears in the script source
    const js = extractScript(html);
    assert.ok(js.includes('"my_room"'), 'ROOMS JSON should contain my_room key');
    assert.ok(js.includes('ACTIVE_TAB'), 'ACTIVE_TAB should be set');
    // Smoke-execute to confirm no runtime errors
    runWebviewJs(js);
});

test('args section appears above WRAM in HTML', () => {
    const html = _renderRadarHtml(scope, refs, pools, argRefs, mapByAddr, roomTree, 'radar', null);
    const argsPos = html.indexOf('Args');
    const wramPos = html.indexOf('WRAM');
    assert.ok(argsPos < wramPos, `Args (${argsPos}) should appear before WRAM (${wramPos})`);
});

test('scriptLines absent even with triggers present', () => {
    const html = _renderRadarHtml(scope, refs, pools, argRefs, mapByAddr, roomTree, 'rooms', null);
    assert.ok(!html.includes('"scriptLines"'), 'scriptLines key must not appear in ROOMS JSON');
});

// ── Summary ───────────────────────────────────────────────────────────────────
console.log(`\n${passed + failed} run: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
