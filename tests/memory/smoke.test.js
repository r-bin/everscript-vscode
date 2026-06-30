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
        workspace: { workspaceFolders: null, getConfiguration: ()=>({ get: ()=>'' }), onDidOpenTextDocument: ()=>({dispose:()=>{}}), onDidCloseTextDocument: ()=>({dispose:()=>{}}), onDidChangeTextDocument: ()=>({dispose:()=>{}}), createFileSystemWatcher: ()=>({onDidChange:()=>({dispose:()=>{}}),dispose:()=>{}}) },
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

const ext = require('../../src/extension.js');

// Pull out renderRadarHtml for testing (it's not exported, so we extract from module source)
// Instead, test via a helper that reconstructs minimal inputs.
// We also need buildRoomsJson, renderRoomsTree — test them via a thin wrapper.

const { radarH } = require('../../src/shared/radar-utils');

// ── Helpers ───────────────────────────────────────────────────────────────────
let passed = 0, failed = 0;
function test(name, fn) {
    try { fn(); console.log('  \u2713', name); passed++; }
    catch(e) { console.error('  \u2717', name, '\n   ', e.message); failed++; }
}

// Execute JS string in a vm sandbox and return the sandbox.
// acquireVsCodeApi is mocked to a no-op.
function runWebviewJs(jsCode) {
    const logs = [];
    const sandbox = {
        acquireVsCodeApi: () => ({ postMessage: () => {} }),
        document: makeFakeDocument(),
        console: {
            log: (...args) => logs.push(['log'].concat(args)),
            warn: (...args) => logs.push(['warn'].concat(args)),
            error: (...args) => logs.push(['error'].concat(args)),
        },
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
    return { sandbox, logs };
}

function makeFakeCanvasContext() {
    const ctx = {
        fillStyle: '#000000',
        strokeStyle: '#000000',
        _lastImageData: null,
        _putCount: 0,
        _fillOps: [],
        _strokeOps: [],
        createImageData: (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }),
        putImageData: (img) => {
            ctx._lastImageData = img;
            ctx._putCount++;
        },
        fillRect: (x, y, w, h) => { ctx._fillOps.push({ x, y, w, h, fillStyle: ctx.fillStyle }); },
        strokeRect: (x, y, w, h) => { ctx._strokeOps.push({ x, y, w, h, strokeStyle: ctx.strokeStyle }); },
    };
    return ctx;
}

// Minimal fake DOM — enough for the webview JS to not crash.
function makeFakeDocument() {
    const elements = {};
    let seq = 0;
    function registerCanvasesFromHtml(html) {
        let m;
        const re = /<canvas[^>]*id="([^"]+)"[^>]*>/g;
        while ((m = re.exec(html)) !== null) {
            const tag = m[0];
            const id = m[1];
            const widthM = tag.match(/\bwidth="(\d+)"/);
            const heightM = tag.match(/\bheight="(\d+)"/);
            const el = makeEl(id);
            if (widthM) el.width = parseInt(widthM[1], 10);
            if (heightM) el.height = parseInt(heightM[1], 10);
        }
    }
    function makeEl(id) {
        if (elements[id]) return elements[id];
        const classList = new FakeClassList();
        const children = [];
        let _innerHTML = '';
        let _ctx2d = null;
        const el = {
            _id: id,
            classList,
            dataset: {},
            style: {},
            children,
            textContent: '',
            value: '',
            querySelectorAll: (sel) => [],
            querySelector: (sel) => {
                const idMatch = /^#([A-Za-z0-9_-]+)$/.exec(sel);
                if (idMatch) return makeEl(idMatch[1]);
                return makeEl('__qs_' + sel.replace(/[^\w]/g,'_'));
            },
            closest: (sel) => null,
            addEventListener: () => {},
            removeEventListener: () => {},
            appendChild: () => {},
            scrollTop: 0,
            scrollHeight: 0,
            clientHeight: 0,
            width: 0,
            height: 0,
            getContext: (kind) => {
                if (kind !== '2d') return null;
                if (!_ctx2d) _ctx2d = makeFakeCanvasContext();
                return _ctx2d;
            },
            getBoundingClientRect: () => ({ top:0, bottom:0, height:0, left:0, right:0, width:0 }),
            setAttribute: () => {},
            getAttribute: () => null,
            createSVGPoint: () => ({ x:0, y:0, matrixTransform: ()=>({x:0,y:0}) }),
            getScreenCTM: () => ({ inverse: ()=>({}) }),
        };
        Object.defineProperty(el, 'innerHTML', {
            get: () => _innerHTML,
            set: (v) => {
                _innerHTML = String(v || '');
                registerCanvasesFromHtml(_innerHTML);
            },
        });
        elements[id] = el;
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
            const idMatch = /^#([A-Za-z0-9_-]+)$/.exec(sel);
            if (idMatch) return makeEl(idMatch[1]);
            return makeEl('__qs_' + sel.replace(/[^\w]/g,'_'));
        },
        querySelectorAll: (sel) => [],
        getElementById: (id) => makeEl(id),
        addEventListener: () => {},
        createElement: (tag) => makeEl('__el_' + (seq++) + '_' + tag),
        createElementNS: (ns, tag) => makeEl('__ns_' + (seq++) + '_' + tag),
        _elements: elements,
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
const src  = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'extension.js'), 'utf8');

// Patch: replace `module.exports = { activate, deactivate };` with extended export
const patchedSrc = src.replace(
    /module\.exports\s*=\s*\{[^}]+\};?\s*$/,
    'module.exports = { activate, deactivate, _renderRadarHtml: renderRadarHtml, _buildRoomsJson: buildRoomsJson, _renderRoomsTree: renderRoomsTree };'
);

// Write to tmp in the same dir as extension.js so relative requires resolve
const tmpPath = path.join(__dirname, '..', '..', 'src', '_smoke_tmp.js');
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

test('rooms detail emits render log messages in rooms tab path', () => {
    const roomTreeFallback = [{
        kind:'map', name:'fallback_room', vanillaId:'R_TEST', relPath:'', startLine:0, endLine:2,
        imageUri:null, imageDims:null,
        content:{
            initMap:{x1:0,y1:0,x2:31,y2:25}, entrances:[], enemies:[], objects:[], transitions:[],
            romHeader:{ mapW:31, mapH:26, offX:0, offY:0, mapWpx:496, mapHpx:416, scrollW:240, scrollH:192, b4:0x17, b5:0x00, b6:0x00, b7:0x02, b8:0x00, sig:'17 00 00 02 00' },
            triggers:{ stepOn:[], bTrigger:[] }
        }
    }];
    const html = _renderRadarHtml(scope, refs, pools, argRefs, mapByAddr, roomTreeFallback, 'rooms', 'fallback_room');
    const js = extractScript(html);
    const { logs } = runWebviewJs(js);
    const joined = logs.map((entry) => entry.slice(1).map(String).join(' ')).join('\n');
    assert.ok(joined.includes('[RoomsRender] renderRoomDetail:start'), 'Expected room render start log');
});

test('rooms detail renders ROM header and decoded script tables without bottom render canvas', () => {
    const roomTreeData = [{
        kind:'map', name:'script_room', vanillaId:'0x33', relPath:'vanilla (rom)', startLine:0, endLine:2,
        imageUri:null, imageDims:null,
        content:{
            initMap:{x1:0,y1:0,x2:40,y2:32}, entrances:[], enemies:[], objects:[], transitions:[],
            romHeader:{ mapW:20, mapH:16, offX:0, offY:0, mapWpx:320, mapHpx:256, scrollW:64, scrollH:32, b4:0x17, b5:0x00, b6:0x00, b7:0x02, b8:0x00, sig:'17 00 00 02 00', stepLen:12, stepCount:2, bLen:0, bCount:0, payloadTileCount:3, payloadTileIds:[0x12,0x34,0x56] },
            trigOffset:{offX:0,offY:0},
            triggers:{
                meta:{enterPointerSnes:0x92811A,stepLength:12,stepCount:2,bLength:0,bCount:0},
                enter:{scriptPointerSnes:0x92811A,scriptAddressSnes:0x94E5FB,terminated:true,stopReason:'terminated',instructions:[{addressSnes:0x94E5FB,opcodeHex:'0x18',size:4,bytesHex:'18 43 24 02',summary:'WRITE CHANGE DOGGO ($2443) = 0x02',terminal:false},{addressSnes:0x94E5FF,opcodeHex:'0x00',size:1,bytesHex:'00',summary:'END',terminal:true}]},
                stepOn:[{x1:0x27,y1:0x0f,x2:0x28,y2:0x10,scriptId:0x0735,scriptAddressSnes:0x94E5E7,terminated:true,stopReason:'terminated',instructions:[{addressSnes:0x94E5E7,opcodeHex:'0xA3',size:2,bytesHex:'A3 00',summary:'CALL "Fade-out / stop music" (0x00)',terminal:false},{addressSnes:0x94E5E9,opcodeHex:'0x22',size:5,bytesHex:'22 12 23 34 00',summary:'CHANGE MAP = 0x34 @ [ 0x0090 | 0x0118 ]',terminal:false},{addressSnes:0x94E5EE,opcodeHex:'0x00',size:1,bytesHex:'00',summary:'END',terminal:true}]}],
                bTrigger:[]
            }
        }
    }];
    const html = _renderRadarHtml(scope, refs, pools, argRefs, mapByAddr, roomTreeData, 'rooms', 'script_room');
    const js = extractScript(html);
    const { sandbox } = runWebviewJs(js);
    const detail = sandbox.document.getElementById('room-detail').innerHTML || '';
    assert.ok(detail.includes('ROM Map Data'), 'Expected ROM header section');
    assert.ok(detail.includes('ROM scripts'), 'Expected ROM scripts section');
    assert.ok(detail.includes('Step-on #0'), 'Expected step-on script card');
    assert.ok(detail.includes('CHANGE MAP = 0x34'), 'Expected decoded CHANGE MAP summary');
    assert.ok(!detail.includes('rr-canvas'), 'Did not expect bottom ROM render canvas');
});

test('rooms detail uses ROM header dimensions for the map viewBox extent', () => {
    const roomTreeData = [{
        kind:'map', name:'header_extent_room', vanillaId:'0x33', relPath:'vanilla (rom)', startLine:0, endLine:2,
        imageUri:null, imageDims:null,
        content:{
            initMap:{x1:0,y1:0,x2:31,y2:25}, entrances:[], enemies:[], objects:[], transitions:[],
            romHeader:{ mapW:31, mapH:26, offX:0, offY:0, mapWpx:496, mapHpx:416, scrollW:240, scrollH:192, b4:0x17, b5:0x00, b6:0x00, b7:0x02, b8:0x00, sig:'17 00 00 02 00' },
            triggers:{ stepOn:[], bTrigger:[] }
        }
    }];
    const html = _renderRadarHtml(scope, refs, pools, argRefs, mapByAddr, roomTreeData, 'rooms', 'header_extent_room');
    const js = extractScript(html);
    const { sandbox } = runWebviewJs(js);
    const detail = sandbox.document.getElementById('room-detail').innerHTML || '';
    assert.ok(detail.includes('viewBox="0 0 62 52"'), 'Expected map viewBox extent to match ROM header width/height in 8px overlay units');
});

test('rooms detail script rows support live byte-script focus highlighting', () => {
    const roomTreeData = [{
        kind:'map', name:'focus_room', vanillaId:'0x33', relPath:'vanilla (rom)', startLine:0, endLine:2,
        imageUri:null, imageDims:null,
        content:{
            initMap:{x1:0,y1:0,x2:40,y2:32}, entrances:[], enemies:[], objects:[], transitions:[],
            romHeader:{ mapW:20, mapH:16, offX:0, offY:0, mapWpx:320, mapHpx:256, scrollW:64, scrollH:32, b4:0x17, b5:0x00, b6:0x00, b7:0x02, b8:0x00, sig:'17 00 00 02 00' },
            triggers:{
                meta:{enterPointerSnes:0x92811A,stepLength:0,stepCount:0,bLength:0,bCount:0},
                enter:{scriptPointerSnes:0x92811A,scriptAddressSnes:0x94E5FB,terminated:true,stopReason:'terminated',instructions:[{addressSnes:0x94E5FB,opcodeHex:'0x18',size:4,bytesHex:'18 43 24 02',summary:'WRITE CHANGE DOGGO ($2443) = 0x02',terminal:false},{addressSnes:0x94E5FF,opcodeHex:'0x00',size:1,bytesHex:'00',summary:'END',terminal:true}]},
                stepOn:[], bTrigger:[]
            }
        }
    }];
    const html = _renderRadarHtml(scope, refs, pools, argRefs, mapByAddr, roomTreeData, 'rooms', 'focus_room');
    const js = extractScript(html);
    assert.ok(js.includes('data-script-addr='), 'Expected script rows to carry data-script-addr for focus highlighting');
    assert.ok(js.includes("command!=='byteScriptFocus'"), 'Expected Rooms webview to listen for byteScriptFocus messages');
});

test('rooms detail surfaces explicit room errors and avoids the stale vanilla placeholder text', () => {
    const roomTreeError = [{
        kind:'map', name:'missing_rom_room', vanillaId:'0x33', relPath:'vanilla (rom)', startLine:-1, endLine:-1,
        imageUri:null, imageDims:null,
        content:{
            initMap:null,
            entrances:[], enemies:[], objects:[], transitions:[],
            triggerNames:{stepOn:[],bTrigger:[]},
            triggers:{enter:null,stepOn:[],bTrigger:[],meta:null},
            roomError:{message:'No ROM configured. Set Everscript: Vanilla ROM or choose a repo path.'}
        }
    }];
    const html = _renderRadarHtml(scope, refs, pools, argRefs, mapByAddr, roomTreeError, 'rooms', 'missing_rom_room');
    const js = extractScript(html);
    const { sandbox } = runWebviewJs(js);
    const detail = sandbox.document.getElementById('room-detail').innerHTML || '';
    assert.ok(detail.includes('No ROM configured'), 'Expected explicit missing-ROM message');
    assert.ok(!detail.includes('No live data in Vanilla mode. Static ROM data only.'), 'Did not expect the stale vanilla placeholder text');
});

// ── Summary ───────────────────────────────────────────────────────────────────
console.log(`\n${passed + failed} run: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
