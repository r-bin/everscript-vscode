'use strict';
/**
 * test/ui.test.js — UI tests for the Docs tab (damage-type dropdown, element visibility).
 *
 * Tests are intentionally structured so that they run RED on a broken fake DOM
 * and GREEN once the fake DOM supports document.createElement correctly.
 *
 * Run with: node test/ui.test.js
 */

const assert = require('assert');
const vm     = require('vm');
const fs     = require('fs');
const path   = require('path');

// ── Mock vscode ───────────────────────────────────────────────────────────────
const Module = require('module');
const _origResolve = Module._resolveFilename;
Module._resolveFilename = function(req, ...rest) {
    if (req === 'vscode') return req;
    return _origResolve.call(this, req, ...rest);
};
if (!require.cache['vscode']) {
    require.cache['vscode'] = {
        id: 'vscode', filename: 'vscode', loaded: true,
        exports: {
            workspace: { workspaceFolders: null,
                onDidOpenTextDocument: ()=>({dispose:()=>{}}),
                onDidCloseTextDocument: ()=>({dispose:()=>{}}),
                onDidChangeTextDocument: ()=>({dispose:()=>{}}),
                createFileSystemWatcher: ()=>({onDidChange:()=>({dispose:()=>{}}), onDidCreate:()=>({dispose:()=>{}}), onDidDelete:()=>({dispose:()=>{}}), dispose:()=>{}}) },
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
        },
    };
}

// ── Extract renderRadarHtml from patched source ───────────────────────────────
const src        = fs.readFileSync(path.join(__dirname, '..', 'extension.js'), 'utf8');
const patchedSrc = src.replace(
    /module\.exports\s*=\s*\{[^}]+\};?\s*$/,
    'module.exports = { activate, deactivate, _renderRadarHtml: renderRadarHtml };'
);
const tmpPath = path.join(__dirname, '..', '_ui_tmp.js');
fs.writeFileSync(tmpPath, patchedSrc);
let _renderRadarHtml;
try {
    delete require.cache[require.resolve(tmpPath)];
    _renderRadarHtml = require(tmpPath)._renderRadarHtml;
} finally {
    fs.unlinkSync(tmpPath);
}

// ── Minimal inputs for renderRadarHtml ───────────────────────────────────────
const scope    = { kind:'function', name:'test_fn', startLine:0, endLine:100 };
const refs     = new Map();
const pools    = [];
const argRefs  = new Map();
const mapByAddr= new Map();
const roomTree = [];
const html     = _renderRadarHtml(scope, refs, pools, argRefs, mapByAddr, roomTree, 'docs', null);

function extractScript(h) {
    const start = h.lastIndexOf('<script>');
    const end   = h.lastIndexOf('<\/script>');
    if (start === -1 || end === -1) throw new Error('No <script> block found in HTML');
    return h.slice(start + 8, end);
}
const jsCode = extractScript(html);

// ── Fake DOM that supports document.createElement and tracks element state ────
//
// IMPORTANT: this fake DOM must support createElement because the alchemy init
// code calls document.createElement('option') for each spell in SC_SPELLS.
// Without it the whole docsJs IIFE throws before registering the dropdown handler.
//
function makeTrackingDocument() {
    const elements = {};
    let createSeq = 0;

    function makeEl(id) {
        if (elements[id]) return elements[id];
        const handlers = {};
        const el = {
            _id: id,
            style: {},
            value: '',
            textContent: '',
            innerHTML: '',
            dataset: {},
            classList: {
                _set: new Set(),
                add(...c)    { c.forEach(x => this._set.add(x)); },
                remove(...c) { c.forEach(x => this._set.delete(x)); },
                toggle(c, force) {
                    if (force === undefined) { this._set.has(c) ? this._set.delete(c) : this._set.add(c); }
                    else { force ? this._set.add(c) : this._set.delete(c); }
                },
                contains(c) { return this._set.has(c); },
            },
            getAttribute: ()=>null,
            setAttribute: ()=>{},
            querySelectorAll: ()=>[],
            querySelector: ()=>null,
            closest: ()=>null,
            scrollIntoView: ()=>{},
            scrollTop: 0, scrollHeight: 0, clientHeight: 0,
            getBoundingClientRect: ()=>({ top:0, bottom:0, height:0, left:0, right:0, width:0 }),
            appendChild: ()=>{},
            removeEventListener: ()=>{},
            addEventListener(evt, fn) {
                if (!handlers[evt]) handlers[evt] = [];
                handlers[evt].push(fn);
            },
            _trigger(evt, data) {
                (handlers[evt] || []).forEach(fn => fn.call(el, data || {}));
            },
            createSVGPoint: ()=>({ x:0, y:0, matrixTransform: ()=>({x:0,y:0}) }),
            getScreenCTM: ()=>({ inverse: ()=>({}) }),
        };
        elements[id] = el;
        return el;
    }

    const doc = {
        body: makeEl('body'),
        getElementById: (id) => makeEl(id),
        querySelector: (sel) => {
            // Never return null — avoids bindLinks(null).querySelectorAll crash
            return makeEl('__qs_' + sel.replace(/[^\w]/g, '_'));
        },
        querySelectorAll: ()=>[],
        addEventListener: ()=>{},
        createElement: (tag) => makeEl('__el_' + (createSeq++) + '_' + tag),
        createElementNS: (ns, tag) => makeEl('__ns_' + (createSeq++) + '_' + tag),
        _elements: elements,
    };
    return doc;
}

function runWithTrackingDoc(jsCode) {
    const doc = makeTrackingDocument();
    const sandbox = {
        acquireVsCodeApi: ()=>({ postMessage: ()=>{} }),
        document: doc,
        console: { log:()=>{}, warn:()=>{}, error:()=>{} },
        setTimeout: ()=>{},
        clearTimeout: ()=>{},
        parseInt, isNaN, Math, JSON, String, Array, Set, Map, Error, Infinity,
    };
    vm.createContext(sandbox);
    vm.runInContext(jsCode, sandbox, { timeout: 30000 });
    return doc._elements;
}

// ── Test runner ───────────────────────────────────────────────────────────────
let passed = 0, failed = 0;
function test(name, fn) {
    try   { fn(); console.log('  \u2713', name); passed++; }
    catch (e) { console.error('  \u2717', name, '\n   ', e.message); failed++; }
}

// ─────────────────────────────────────────────────────────────────────────────
console.log('\nDocs tab: HTML structure');

test('Damage section contains #doc-dmg-type dropdown', () => {
    assert.ok(html.includes('id="doc-dmg-type"'),
        'Missing <select id="doc-dmg-type"> in rendered HTML');
});

test('Dropdown has Physical option (value="physical", default)', () => {
    assert.ok(html.includes('value="physical"'), 'Missing <option value="physical">');
    assert.ok(html.includes('>Physical<'),        'Missing "Physical" label text');
});

test('Dropdown has Offensive Alchemy option (value="alchemy")', () => {
    assert.ok(html.includes('value="alchemy"'),       'Missing <option value="alchemy">');
    assert.ok(html.includes('>Offensive Alchemy<'),   'Missing "Offensive Alchemy" label text');
});

test('#doc-phys-content div exists in HTML', () => {
    assert.ok(html.includes('id="doc-phys-content"'),
        'Missing <div id="doc-phys-content">');
});

test('#doc-al-content div exists in HTML', () => {
    assert.ok(html.includes('id="doc-al-content"'),
        'Missing <div id="doc-al-content">');
});

test('#doc-al-content starts hidden (display:none in HTML)', () => {
    const idx      = html.indexOf('id="doc-al-content"');
    assert.ok(idx !== -1, 'id="doc-al-content" not found');
    const tagStart = html.lastIndexOf('<', idx);
    const tagEnd   = html.indexOf('>',  idx);
    const openTag  = html.slice(tagStart, tagEnd + 1);
    assert.ok(
        openTag.includes('display:none') || openTag.includes('display: none'),
        `#doc-al-content opening tag should contain display:none.\n  Got: ${openTag}`
    );
});

test('#doc-phys-content is visible by default (no display:none in opening tag)', () => {
    const idx      = html.indexOf('id="doc-phys-content"');
    assert.ok(idx !== -1, 'id="doc-phys-content" not found');
    const tagStart = html.lastIndexOf('<', idx);
    const tagEnd   = html.indexOf('>',  idx);
    const openTag  = html.slice(tagStart, tagEnd + 1);
    assert.ok(
        !openTag.includes('display:none') && !openTag.includes('display: none'),
        `#doc-phys-content should NOT have display:none.\n  Got: ${openTag}`
    );
});

test('No standalone data-doc="alchemy" button in subnav', () => {
    assert.ok(
        !html.includes('data-doc="alchemy"'),
        'Found data-doc="alchemy" button — it should be removed in favour of the dropdown'
    );
});

test('#doc-atk slider appears inside #doc-phys-content section', () => {
    const physIdx = html.indexOf('id="doc-phys-content"');
    const alIdx   = html.indexOf('id="doc-al-content"');
    const atkIdx  = html.indexOf('id="doc-atk"');
    assert.ok(atkIdx > physIdx && atkIdx < alIdx,
        '#doc-atk should appear between doc-phys-content and doc-al-content in the HTML');
});

test('#doc-al-spell select appears inside #doc-al-content section', () => {
    const alStart = html.indexOf('id="doc-al-content"');
    const spellIdx = html.indexOf('id="doc-al-spell"');
    assert.ok(spellIdx > alStart,
        '#doc-al-spell should appear after doc-al-content starts');
});

test('#doc-al-mdef slider appears inside #doc-al-content section', () => {
    const alStart  = html.indexOf('id="doc-al-content"');
    const mdefIdx  = html.indexOf('id="doc-al-mdef"');
    assert.ok(mdefIdx > alStart,
        '#doc-al-mdef should appear after doc-al-content starts');
});

// ─────────────────────────────────────────────────────────────────────────────
console.log('\nDocs tab: JS behaviour (document.createElement required)');

// Run all JS behaviour tests sharing a single execution so state persists
// across dropdown-change assertions.
let elements;

test('webview JS executes without throwing (needs document.createElement)', () => {
    // This fails on a fake DOM that lacks document.createElement because the
    // alchemy init calls it for each of the 14 SC_SPELLS entries.
    elements = runWithTrackingDoc(jsCode);
});

test('after init: #doc-phys-content not hidden by JS (display !== "none")', () => {
    assert.ok(elements, 'JS failed to run — skipping');
    const el = elements['doc-phys-content'];
    assert.notStrictEqual(el && el.style.display, 'none',
        '#doc-phys-content.style.display should not be "none" after init');
});

test('after init: #doc-al-content not forced visible by JS', () => {
    // HTML hides it; JS must not override that to visible during init.
    // (The change handler must be the only thing that shows it.)
    assert.ok(elements, 'JS failed to run — skipping');
    const el = elements['doc-al-content'];
    // The element starts hidden via HTML; the JS init must not set display to ''
    // We can only check it's not been explicitly set to 'block' or 'flex'
    const d = el && el.style.display;
    assert.ok(d !== 'block' && d !== 'flex' && d !== 'inline',
        `#doc-al-content.style.display should not be made visible during init, got: "${d}"`);
});

test('dropdown change to "alchemy": alchemy section shown, physical hidden', () => {
    assert.ok(elements, 'JS failed to run — skipping');
    const sel  = elements['doc-dmg-type'];
    assert.ok(sel, '#doc-dmg-type was not accessed during JS execution');
    sel.value = 'alchemy';
    sel._trigger('change', {});
    const alEl   = elements['doc-al-content'];
    const physEl = elements['doc-phys-content'];
    assert.strictEqual(alEl && alEl.style.display, '',
        `#doc-al-content.style.display should be "" (visible) after selecting alchemy, got: "${alEl && alEl.style.display}"`);
    assert.strictEqual(physEl && physEl.style.display, 'none',
        `#doc-phys-content.style.display should be "none" after selecting alchemy, got: "${physEl && physEl.style.display}"`);
});

test('dropdown change back to "physical": physical shown, alchemy hidden', () => {
    assert.ok(elements, 'JS failed to run — skipping');
    const sel = elements['doc-dmg-type'];
    sel.value = 'physical';
    sel._trigger('change', {});
    const alEl   = elements['doc-al-content'];
    const physEl = elements['doc-phys-content'];
    assert.strictEqual(physEl && physEl.style.display, '',
        `#doc-phys-content.style.display should be "" (visible) after reverting to physical, got: "${physEl && physEl.style.display}"`);
    assert.strictEqual(alEl && alEl.style.display, 'none',
        `#doc-al-content.style.display should be "none" after reverting to physical, got: "${alEl && alEl.style.display}"`);
});

test('#doc-dmg-chart populated at init (physical chart renders on page load)', () => {
    assert.ok(elements, 'JS failed to run — skipping');
    const el = elements['doc-dmg-chart'];
    assert.ok(el && el.innerHTML.length > 10,
        `#doc-dmg-chart.innerHTML should be populated at init, got: "${el && el.innerHTML.slice(0,40)}"`);
});

test('#doc-al-chart populated at init (alchemy chart renders even while hidden)', () => {
    assert.ok(elements, 'JS failed to run — skipping');
    const el = elements['doc-al-chart'];
    assert.ok(el && el.innerHTML.length > 10,
        `#doc-al-chart.innerHTML should be populated at init (hidden parent is fine), got: "${el && el.innerHTML.slice(0,40)}"`);
});

// ─────────────────────────────────────────────────────────────────────────────
console.log(`\n${passed + failed} run: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
