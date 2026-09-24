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

test('rooms detail shows every ROM feature toggle, all on by default', () => {
    const roomTreeData = [{
        kind:'map', name:'toggle_room', vanillaId:'0x33', romRoomId:0x33, relPath:'vanilla (rom)', startLine:0, endLine:2,
        imageUri:null, imageDims:null,
        content:{
            initMap:{x1:0,y1:0,x2:20,y2:16}, entrances:[], enemies:[], objects:[], transitions:[],
            triggers:{ stepOn:[], bTrigger:[] }
        }
    }];
    const html = _renderRadarHtml(scope, refs, pools, argRefs, mapByAddr, roomTreeData, 'rooms', 'toggle_room');
    const { sandbox } = runWebviewJs(extractScript(html));
    const detail = sandbox.document.getElementById('room-detail').innerHTML || '';

    // The flag set is the contract with rooms/rendering/tile-overlay.js. A
    // feature added there without a button here would be unreachable.
    const { ALL_OVERLAY_FLAGS } = require('../../src/rooms/rendering/tile-overlay');
    const rendered = (detail.match(/data-ov="(.)"/g) || []).map((m) => m.charAt(m.length - 2));
    assert.deepStrictEqual(rendered.slice().sort().join(''), ALL_OVERLAY_FLAGS.split('').sort().join(''),
        'Expected one toggle per overlay flag the host understands');

    // Default is the full view: the point of the tab is to show what is in the
    // room, and the bar is how you narrow it down. Collision shipping off by
    // default is the bug this guards.
    ALL_OVERLAY_FLAGS.split('').forEach((flag) => {
        assert.ok(new RegExp('class="rdf rdf-ov on" data-ov="' + flag + '"').test(detail),
            'Expected overlay flag ' + flag + ' to default on');
    });
});

test('map image is sized in viewBox units, not stretched to the viewBox', () => {
    // A trigger past the map edge widens the viewBox beyond the map. The image
    // used to be a CSS-stretched <img> filling the canvas, so it was scaled to
    // the widened box and the grid drifted off the tile boundaries — 1-3% on
    // 54 of the 127 vanilla rooms. It is now an SVG <image> placed in the same
    // coordinate system as the grid, at the map's own extent.
    const roomTreeData = [{
        kind:'map', name:'overhang_room', vanillaId:'0x33', romRoomId:0x33, relPath:'vanilla (rom)', startLine:0, endLine:2,
        imageUri:null, imageDims:null,
        content:{
            initMap:{x1:0,y1:0,x2:40,y2:32},
            entrances:[], enemies:[], objects:[], transitions:[],
            romHeader:{ mapW:20, mapH:16, offX:0, offY:0, mapWpx:320, mapHpx:256, scrollW:64, scrollH:32, b4:0x17, b5:0x00, b6:0x00, b7:0x02, b8:0x00, sig:'17 00 00 02 00' },
            trigOffset:{offX:0,offY:0},
            // Sits at the right edge, so x2 grows past the map's 40 units.
            triggers:{ stepOn:[{x1:19,y1:2,x2:20,y2:3,scriptId:0x100}], bTrigger:[] }
        }
    }];
    const html = _renderRadarHtml(scope, refs, pools, argRefs, mapByAddr, roomTreeData, 'rooms', 'overhang_room');
    const { sandbox } = runWebviewJs(extractScript(html));
    const detail = sandbox.document.getElementById('room-detail').innerHTML || '';

    const vb = /viewBox="(-?[\d.]+) (-?[\d.]+) ([\d.]+) ([\d.]+)"/.exec(detail);
    assert.ok(vb, 'Expected a viewBox on the map SVG');
    assert.ok(Number(vb[3]) > 40, 'Expected the edge trigger to widen the viewBox past the map');

    const img = /<image[^>]*id="rg-img"[^>]*>/.exec(detail);
    assert.ok(img, 'Expected the map image to be an SVG <image>, not a CSS-stretched <img>');
    assert.ok(/width="40"/.test(img[0]) && /height="32"/.test(img[0]),
        'Expected the image sized to the map (320x256px = 40x32 units), not to the widened viewBox: ' + img[0]);
    assert.ok(/x="0"/.test(img[0]) && /y="0"/.test(img[0]), 'Expected the image at the map origin');
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
    // Assert the behaviour (a message listener that handles byteScriptFocus)
    // rather than one exact source spelling, so the handler can grow more
    // message types without this test going red.
    assert.ok(js.includes("addEventListener('message'"), 'Expected Rooms webview to register a message listener');
    assert.ok(js.includes("'byteScriptFocus'"), 'Expected Rooms webview to handle byteScriptFocus messages');
    assert.ok(js.includes("'roomTiles'"), 'Expected Rooms webview to handle roomTiles overlay responses');
    assert.ok(js.includes("command:'requestRoomTiles'"), 'Expected Rooms webview to request ROM tile overlays');

    // Pan regression: setupMouseEvents gets a hand-built object, so a helper
    // added to the zoom/pan module is silently undefined there unless it is
    // explicitly forwarded. Omitting _getPan made every drag base itself at
    // 0,0 and snap the map to the top-left corner.
    assert.ok(js.includes('_getPan:zp._getPan'), 'Expected _getPan to be forwarded into setupMouseEvents');
    assert.ok(js.includes('_applyPan:zp._applyPan'), 'Expected _applyPan to be forwarded into setupMouseEvents');
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

// ── Vanilla loot icons ────────────────────────────────────────────────────────
// A vanilla room has no trigger names, so before the ROM decoder could read
// the reward there was nothing to draw an icon from. These pin the bridge
// between the decoded loot and the icon renderer the live path already used.

function loadRoomsUtils(extraGlobals) {
    const roomsDir = path.join(__dirname, '..', '..', 'src', 'rooms', 'webview');
    const code = fs.readFileSync(path.join(roomsDir, 'utils.js'), 'utf8');
    const sandbox = Object.assign({ INGR_BASE: '', INGR_FILES: [], Math, JSON, String, Array }, extraGlobals || {});
    vm.createContext(sandbox);
    vm.runInContext(code, sandbox, { timeout: 5000 });
    return sandbox;
}

test('a vanilla trigger takes its icon name from the decoded loot', () => {
    const s = loadRoomsUtils();
    const trigger = { loot: [{ itemName: 'WAX', amount: 1 }] };
    // No source name at all — the live path's only input — so this used to
    // resolve to nothing and the box stayed empty.
    assert.strictEqual(s.trigIngrName(trigger, ''), 'WAX');
    assert.ok(s.getIngrIcon(s.trigIngrName(trigger, '')), 'expected an icon for WAX');
    // A name the author wrote still wins over the derived one.
    assert.strictEqual(s.trigIngrName(trigger, 'sniff_oil_3'), 'sniff_oil_3');
});

test('plural and compound reward names still resolve to an icon', () => {
    const s = loadRoomsUtils();
    for (const name of ['ROOTS', 'ACORNS', 'MUD_PEPPER', 'DRY_ICE', 'ATLAS_MEDALLION']) {
        assert.ok(s.getIngrIcon(s.trigIngrName({ loot: [{ itemName: name }] }, '')), 'no icon for ' + name);
    }
    // Rewards that are not ingredients have no icon, and must not borrow one.
    assert.strictEqual(s.trigIngrName({ loot: [{ itemName: 'CALL_BEADS' }] }, ''), '');
});

test('an icon with no asset file falls back to its emoji instead of an empty box', () => {
    // INGR_MAP names more ingredients than the assets folder ships.
    const s = loadRoomsUtils({ INGR_BASE: 'https://example/', INGR_FILES: ['Wax.webp'] });
    assert.ok(s.ingrSvgImg('WAX', 0, 0, 2), 'Wax.webp is present, so an <image> is right');
    assert.strictEqual(s.ingrSvgImg('NECTAR', 0, 0, 2), null, 'Nectar.webp is absent');
    assert.ok(s.getIngrIcon('NECTAR'), 'but it still has an emoji to fall back to');
});

test('the trigger tooltip names the reward, the object and the flag', () => {
    const s = loadRoomsUtils();
    const tip = s.lootTip({ loot: [
        { itemName: 'WAX', amount: 2, objectId: 0x02, checkFlag: { addr: 0x22c8, bit: 1 }, next: 4 },
    ] });
    for (const part of ['WAX', '\u00d72', 'object 0x2', '$22c8', 'bit 0x2', 'next pickup +4']) {
        assert.ok(tip.includes(part), 'tooltip missing ' + part + ': ' + tip);
    }
    assert.strictEqual(s.lootLabel({ loot: [{ itemName: 'WAX', amount: 1 }] }), 'WAX');
});

test('webview source is pasted into the bundle literally, not as a replacement pattern', () => {
    // `$'` in a String.replace replacement means "everything after the
    // match", so one dollar-quote in the webview source used to swallow the
    // rest of the bundle and leave an unterminated string.
    const rw = require('../../src/memory/webview');
    const bundle = rw.buildMainJs({
        jsData: '', roomsData: '', scalingData: '',
        roomsJs: "var probe='flag $'+1;", scalingJs: '', docsJs: '', routeJs: '', rngJs: '',
    });
    assert.ok(bundle.includes("var probe='flag $'+1;"), 'injected source was rewritten');
    assert.doesNotThrow(() => new vm.Script(bundle), 'bundle no longer parses');
});

// ── Exits ─────────────────────────────────────────────────────────────────────

test('a door trigger renders its destination as a link to that room', () => {
    const roomsDir = path.join(__dirname, '..', '..', 'src', 'rooms', 'webview');
    const code = ['utils.js', 'tables-builder.js']
        .map((f) => fs.readFileSync(path.join(roomsDir, f), 'utf8')).join('\n');
    const sandbox = { INGR_BASE: '', INGR_FILES: [], Math, JSON, String, Array };
    vm.createContext(sandbox);
    vm.runInContext(code, sandbox, { timeout: 5000 });

    const trigger = { instructions: [], transitions: [{
        mapId: 0x48, mapName: 'Omnitopia - Metroplex tunnels', x: 0x78, y: 0x88,
        prepares: [{ id: 0, name: 'Fade-out / stop music' }], music: null,
        writes: [{ addr: 0x24fd, name: '$24fd', value: 5 }],
    }] };
    const html = sandbox.renderScriptCard('Step-on #0', '', trigger, 'step', 0);
    assert.ok(html.includes('data-goto-map="0x48"'), 'destination is not a link: ' + html);
    assert.ok(html.includes('Omnitopia - Metroplex tunnels'), 'destination is not named');
    assert.ok(/title="[^"]*Fade-out/.test(html), 'preparation should be in the tooltip');

    assert.ok(sandbox.exitLabel(trigger).includes('Omnitopia'), 'map label should name the destination');
    assert.ok(sandbox.exitTip(trigger).includes('0x48'), 'map tooltip should carry the id');
    assert.strictEqual(sandbox.exitLabel({ transitions: [] }), '', 'a non-door trigger gets no exit label');
});

test('following an exit reuses the tree\'s own room selection', () => {
    // Moved from tab-init.js to rooms-rail.js in Phase 7b: the exit link
    // navigates the rail, so it belongs with the rail's own selection logic.
    const src = fs.readFileSync(
        path.join(__dirname, '..', '..', 'src', 'rooms', 'webview', 'rooms-rail.js'), 'utf8');
    assert.ok(/function gotoVanillaRoom/.test(src), 'expected a gotoVanillaRoom helper');
    assert.ok(/data-goto-map/.test(src), 'expected a delegated handler for exit links');
    // Navigating by clicking the tree entry keeps selection and rendering
    // owned by one place instead of duplicating them here.
    assert.ok(/found\.click\(\)/.test(src), 'expected navigation to go through the tree entry');
    // Pre-7b this pressed the `Vanilla` mode button; with one combined list
    // the row can be hidden by a collapsed group or an active search filter,
    // and a click on a `display:none` row renders nothing.
    assert.ok(/railClearSearch\(\)/.test(src), 'expected the search filter to be cleared first');
    assert.ok(/railSetGroup\('vanilla', true\)/.test(src), 'expected the Vanilla group to be opened');
});

test('clicking the map selects without jumping; cmd-click jumps', () => {
    const src = fs.readFileSync(
        path.join(__dirname, '..', '..', 'src', 'rooms', 'webview', 'interactions.js'), 'utf8');
    assert.ok(/selectAt\(Math\.floor\(pt\.x\),Math\.floor\(pt\.y\),e\.metaKey\|\|e\.ctrlKey\)/.test(src),
        'map clicks should pass the modifier through as the jump flag');
    assert.ok(/if\(jump&&r\.scrollIntoView\)/.test(src),
        'row scrolling should be behind the jump flag');
    assert.ok(/if\(jump&&card\.scrollIntoView\)/.test(src),
        'card scrolling should be behind the jump flag');
});

// ── Summary ───────────────────────────────────────────────────────────────────
console.log(`\n${passed + failed} run: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
