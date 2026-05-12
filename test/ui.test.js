'use strict';
/**
 * test/ui.test.js — UI tests for the Scaling and Docs tabs.
 *
 * Run with: node test/ui.test.js
 */

const assert = require('assert');
const vm = require('vm');
const fs = require('fs');
const path = require('path');

// ── Mock vscode ─────────────────────────────────────────────────────────────
const Module = require('module');
const _origResolve = Module._resolveFilename;
Module._resolveFilename = function(req, ...rest) {
    if (req === 'vscode') return req;
    return _origResolve.call(this, req, ...rest);
};
if (!require.cache.vscode) {
    require.cache.vscode = {
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
            CompletionItem: class { constructor(label, kind){ this.label = label; this.kind = kind; } },
            Hover: class { constructor(contents){ this.contents = contents; } },
            MarkdownString: class { constructor(value){ this.value = value; } },
            CodeLens: class { constructor(range, command){ this.range = range; this.command = command; } },
            Range: class { constructor(start, end){ this.start = start; this.end = end; } },
            Position: class { constructor(line, character){ this.line = line; this.character = character; } },
            Selection: class { constructor(anchor, active){ this.anchor = anchor; this.active = active; } },
            DocumentSymbol: class { constructor(name, detail, kind, range, selectionRange){ this.name = name; this.detail = detail; this.kind = kind; this.range = range; this.selectionRange = selectionRange; this.children = []; } },
            SnippetString: class { constructor(value){ this.value = value; } },
            EventEmitter: class { constructor(){ this.event = ()=>{}; } fire(){} },
            WebviewPanel: class {},
        },
    };
}

// ── Extract renderRadarHtml from patched source ─────────────────────────────
const src = fs.readFileSync(path.join(__dirname, '..', 'extension.js'), 'utf8');
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

// ── Minimal inputs for renderRadarHtml ─────────────────────────────────────
const scope = { kind:'function', name:'test_fn', startLine:0, endLine:100 };
const refs = new Map();
const pools = [];
const argRefs = new Map();
const mapByAddr = new Map();
const roomTree = [];
const html = _renderRadarHtml(scope, refs, pools, argRefs, mapByAddr, roomTree, 'scaling', null);

function extractScript(renderedHtml) {
    const start = renderedHtml.lastIndexOf('<script>');
    const end = renderedHtml.lastIndexOf('<\/script>');
    if (start === -1 || end === -1) throw new Error('No <script> block found in HTML');
    return renderedHtml.slice(start + 8, end);
}

function injectScalingFixture(code) {
    return code
    .replace(/var SC_CHARS=\[[\s\S]*?\];/, 'var SC_CHARS=[{"id":0,"name":"<Boy>","attack":7,"defense":5,"evade":0,"hit_rate":38,"hp":30,"magicDefense":10},{"id":109,"name":"Wimpy Flower","attack":1,"defense":28,"evade":0,"hit_rate":0,"hp":18,"magicDefense":51}];')
        .replace(/var SC_HIT_LOOKUP=\{[\s\S]*?\};/, 'var SC_HIT_LOOKUP={38:{0:95}};');
}

const jsCode = injectScalingFixture(extractScript(html));

// ── Fake DOM that supports UI initialization and event handlers ─────────────
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
                add(...classes) { classes.forEach((value) => this._set.add(value)); },
                remove(...classes) { classes.forEach((value) => this._set.delete(value)); },
                toggle(name, force) {
                    if (force === undefined) {
                        this._set.has(name) ? this._set.delete(name) : this._set.add(name);
                    } else if (force) {
                        this._set.add(name);
                    } else {
                        this._set.delete(name);
                    }
                },
                contains(name) { return this._set.has(name); },
            },
            getAttribute: ()=>null,
            setAttribute: ()=>{},
            querySelectorAll: ()=>[],
            querySelector: ()=>null,
            closest: ()=>null,
            scrollIntoView: ()=>{},
            scrollTop: 0,
            scrollHeight: 0,
            clientHeight: 0,
            getBoundingClientRect: ()=>({ top:0, bottom:0, height:0, left:0, right:0, width:0 }),
            appendChild: ()=>{},
            removeEventListener: ()=>{},
            addEventListener(eventName, handler) {
                if (!handlers[eventName]) handlers[eventName] = [];
                handlers[eventName].push(handler);
            },
            _trigger(eventName, data) {
                (handlers[eventName] || []).forEach((handler) => handler.call(el, data || {}));
            },
            createSVGPoint: ()=>({ x:0, y:0, matrixTransform: ()=>({x:0, y:0}) }),
            getScreenCTM: ()=>({ inverse: ()=>({}) }),
        };
        elements[id] = el;
        return el;
    }

    return {
        body: makeEl('body'),
        getElementById: (id) => makeEl(id),
        querySelector: (sel) => makeEl('__qs_' + sel.replace(/[^\w]/g, '_')),
        querySelectorAll: ()=>[],
        addEventListener: ()=>{},
        createElement: (tag) => makeEl('__el_' + (createSeq++) + '_' + tag),
        createElementNS: (ns, tag) => makeEl('__ns_' + (createSeq++) + '_' + tag),
        _elements: elements,
    };
}

function runWithTrackingDoc(code) {
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
    vm.runInContext(code, sandbox, { timeout: 30000 });
    return doc._elements;
}

// ── Test runner ─────────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;
function test(name, fn) {
    try {
        fn();
        console.log('  \u2713', name);
        passed++;
    } catch (error) {
        console.error('  \u2717', name, '\n   ', error.message);
        failed++;
    }
}

console.log('\nScaling tab: HTML structure');

test('Scaling section contains #sc-mode-sel dropdown', () => {
    assert.ok(html.includes('id="sc-mode-sel"'), 'Missing <select id="sc-mode-sel"> in rendered HTML');
});

test('Scaling dropdown has Physical option', () => {
    assert.ok(html.includes('value="physical"'), 'Missing <option value="physical">');
    assert.ok(html.includes('>Physical<'), 'Missing "Physical" label text');
});

test('Scaling dropdown has Offensive Alchemy option', () => {
    assert.ok(html.includes('value="alchemy"'), 'Missing <option value="alchemy">');
    assert.ok(html.includes('>Offensive Alchemy<'), 'Missing "Offensive Alchemy" label text');
});

test('Scaling HTML contains the field ids required by updateLevelFields()', () => {
    ['sc-src-field', 'sc-charge-field', 'sc-scale-field', 'sc-atlas-field'].forEach((id) => {
        assert.ok(html.includes(`id="${id}"`), `Missing field id ${id}`);
    });
});

test('Scaling HTML still contains the physical control set', () => {
    ['id="sc-src-sel"', 'id="sc-tgt-sel"', 'id="sc-scale-toggle"', 'id="sc-atlas-toggle"', 'data-chg="100"'].forEach((needle) => {
        assert.ok(html.includes(needle), `Missing ${needle}`);
    });
});

console.log('\nDocs tab: HTML structure');

test('Docs subnav contains standalone alchemy button again', () => {
    assert.ok(html.includes('data-doc="alchemy"'), 'Missing standalone Docs alchemy subnav entry');
});

test('Docs no longer contains the mistaken damage-type dropdown', () => {
    assert.ok(!html.includes('id="doc-dmg-type"'), 'Found Docs damage-type dropdown; it belongs in Scaling');
});

test('Docs still contains both physical and alchemy calculators', () => {
    assert.ok(html.includes('id="doc-dmg-chart"'), 'Missing physical docs chart');
    assert.ok(html.includes('id="doc-al-chart"'), 'Missing alchemy docs chart');
});

console.log('\nScaling tab: JS behaviour');

let elements;

test('webview JS executes without throwing with scaling fixture data', () => {
    elements = runWithTrackingDoc(jsCode);
});

test('Scaling starts in physical mode', () => {
    assert.ok(elements, 'JS failed to run — skipping');
    assert.strictEqual(elements['sc-mode-sel'].value, 'physical', 'Expected physical mode by default');
});

test('Scaling renders chart content at init', () => {
    assert.ok(elements, 'JS failed to run — skipping');
    assert.ok(elements['sc-chart'] && elements['sc-chart'].innerHTML.length > 10, 'Scaling chart did not initialize');
});

test('Switching Scaling to alchemy hides physical-only controls', () => {
    assert.ok(elements, 'JS failed to run — skipping');
    const modeSel = elements['sc-mode-sel'];
    modeSel.value = 'alchemy';
    modeSel._trigger('change', {});
    ['sc-src-field', 'sc-charge-field', 'sc-scale-field', 'sc-atlas-field'].forEach((id) => {
        assert.strictEqual(elements[id].style.display, 'none', `${id} should be hidden in alchemy mode`);
    });
    assert.strictEqual(elements['sc-hit-chart'].style.display, 'none', 'Hit chart should hide in alchemy mode');
});

test('Switching Scaling back to physical restores physical-only controls', () => {
    assert.ok(elements, 'JS failed to run — skipping');
    const modeSel = elements['sc-mode-sel'];
    modeSel.value = 'physical';
    modeSel._trigger('change', {});
    ['sc-src-field', 'sc-charge-field', 'sc-scale-field', 'sc-atlas-field'].forEach((id) => {
        assert.strictEqual(elements[id].style.display, 'flex', `${id} should be restored in physical mode`);
    });
    assert.strictEqual(elements['sc-hit-chart'].style.display, 'block', 'Hit chart should show in physical mode');
});

test('Alchemy mode updates the Scaling note text', () => {
    assert.ok(elements, 'JS failed to run — skipping');
    const modeSel = elements['sc-mode-sel'];
    modeSel.value = 'alchemy';
    modeSel._trigger('change', {});
    assert.ok(
        elements['sc-note'].textContent.includes('Offensive alchemy currently uses the grounded level-0 model'),
        'Scaling note did not switch to the alchemy copy'
    );
});

test('Hard Ball L0 vs Wimpy Flower shows a 6–10 legend range in alchemy mode', () => {
    assert.ok(elements, 'JS failed to run — skipping');
    const modeSel = elements['sc-mode-sel'];
    modeSel.value = 'alchemy';
    modeSel._trigger('change', {});
    const legendHtml = elements['sc-legend'].innerHTML;
    assert.ok(legendHtml.includes('Hard Ball'), 'Hard Ball row missing from Scaling legend');
    assert.ok(
        legendHtml.includes('L0:6–10') || legendHtml.includes('L0:6-10'),
        `Expected Hard Ball legend range 6–10, got: ${legendHtml.match(/Hard Ball[\s\S]{0,120}/)?.[0] || legendHtml}`
    );
});

console.log('\nDocs tab: JS behaviour');

test('Docs calculators both initialize without throwing', () => {
    assert.ok(elements, 'JS failed to run — skipping');
    assert.ok(elements['doc-dmg-chart'] && elements['doc-dmg-chart'].innerHTML.length > 10, 'Physical docs chart did not initialize');
    assert.ok(elements['doc-al-chart'] && elements['doc-al-chart'].innerHTML.length > 10, 'Alchemy docs chart did not initialize');
});

console.log(`\n${passed + failed} run: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
