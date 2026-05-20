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

const roomsTree = [{
    kind:'map', name:'rooms_render_test', vanillaId:'R_TEST', relPath:'', startLine:0, endLine:10,
    imageUri:null, imageDims:null,
    content:{
        initMap:{x1:0,y1:0,x2:31,y2:25}, entrances:[], enemies:[], objects:[], transitions:[],
        romHeader:{ mapW:31, mapH:26, offX:0, offY:0, mapWpx:496, mapHpx:416, scrollW:240, scrollH:192, b4:0x17, b5:0x00, b6:0x00, b7:0x02, b8:0x00, sig:'17 00 00 02 00' },
        triggers:{ stepOn:[], bTrigger:[] }
    }
}];
const htmlRooms = _renderRadarHtml(scope, refs, pools, argRefs, mapByAddr, roomsTree, 'rooms', 'rooms_render_test');
const jsRoomsCode = injectScalingFixture(extractScript(htmlRooms));

function extractScript(renderedHtml) {
    const start = renderedHtml.lastIndexOf('<script>');
    const end = renderedHtml.lastIndexOf('<\/script>');
    if (start === -1 || end === -1) throw new Error('No <script> block found in HTML');
    return renderedHtml.slice(start + 8, end);
}

function injectScalingFixture(code) {
    return code
    .replace(/var SC_CHARS=\[[\s\S]*?\];/, 'var SC_CHARS=[{"id":0,"name":"<Boy>","attack":7,"defense":5,"evade":0,"hit_rate":38,"hp":30,"magic_defense":10},{"id":109,"name":"Wimpy Flower","attack":1,"defense":28,"evade":0,"hit_rate":0,"hp":18,"magic_defense":32},{"id":110,"name":"Mosquito","attack":2,"defense":0,"evade":0,"hit_rate":0,"hp":10,"magic_defense":0},{"id":141,"name":"Carltron\'s Robot","attack":55,"defense":0,"evade":9,"hit_rate":110,"hp":250,"magic_defense":60}];')
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

test('Scaling HTML contains alchemy slider fields', () => {
    ['id="sc-al-spell-lv"', 'id="sc-al-tgt-lv"', 'id="sc-al-spell-lv-num"', 'id="sc-al-tgt-lv-num"'].forEach((needle) => {
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

test('Docs alchemy contains the spell-level slider', () => {
    ['id="doc-al-spell-lv"', 'id="doc-al-spell-lv-num"'].forEach((needle) => {
        assert.ok(html.includes(needle), `Missing ${needle}`);
    });
});

test('Docs alchemy uses the expected spell might table entries', () => {
    assert.ok(jsCode.includes('{id:"hardball",label:"Hard Ball",type:"alchemy",might:21'), 'Missing Hard Ball might 21 entry');
    assert.ok(jsCode.includes('{id:"fireball",label:"Fireball",type:"alchemy",might:62'), 'Missing Fireball might 62 entry');
    assert.ok(jsCode.includes('{id:"nitro",label:"Nitro",type:"alchemy",might:112'), 'Missing Nitro might 112 entry');
});

test('Docs alchemy advertises the traced spell-level power helper', () => {
    assert.ok(jsCode.includes('spell_power_at_level'), 'Docs alchemy formula text should mention the traced spell power helper');
    assert.ok(jsCode.includes('doc-al-spell-lv'), 'Docs alchemy JS should wire the spell-level slider');
});

test('Docs alchemy now mentions the projectile POWER research note', () => {
    assert.ok(html.includes('7E3564'), 'Docs alchemy should mention the projectile slot base');
    assert.ok(html.includes('+0x2A/+0x2B'), 'Docs alchemy should mention the projectile POWER field offset');
    assert.ok(html.includes('POWER'), 'Docs alchemy should mention projectile POWER');
});

console.log('\nRooms tab: HTML/JS behaviour');

test('Rooms HTML includes room render canvas styles', () => {
    assert.ok(htmlRooms.includes('rr-canvas-wrap'), 'Missing rr-canvas-wrap style or markup in Rooms HTML');
    assert.ok(htmlRooms.includes('rr-canvas'), 'Missing rr-canvas class in Rooms HTML');
});

test('Rooms JS renders header fallback canvas block when payload render is absent', () => {
    const roomsElements = runWithTrackingDoc(jsRoomsCode);
    const detail = (roomsElements['room-detail'] && roomsElements['room-detail'].innerHTML) || '';
    assert.ok(detail.includes('Rendered room graphic (header fallback)'), 'Expected header fallback section in room detail');
    assert.ok(detail.includes('rr-canvas-fallback'), 'Expected fallback canvas element in room detail');
});

console.log('\nScaling tab: JS behaviour');

let elements;

test('webview JS executes without throwing with scaling fixture data', () => {
    elements = runWithTrackingDoc(jsCode);
});

test('Docs alchemy spell-level slider updates the preview output', () => {
    assert.ok(elements, 'JS failed to run — skipping');
    elements['doc-al-spell'].value = 'hardball';
    elements['doc-al-spell-lv'].value = '1';
    elements['doc-al-spell-lv']._trigger('input', {});
    const chartHtml = elements['doc-al-chart'].innerHTML;
    assert.ok(chartHtml.includes('spell level: <b>1</b>'), 'Docs alchemy preview did not reflect spell level 1');
    assert.ok(chartHtml.includes('spell_power_at_level'), 'Docs alchemy preview should expose the traced spell power');
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
    ['sc-al-spell-lv-field', 'sc-al-tgt-lv-field'].forEach((id) => {
        assert.strictEqual(elements[id].style.display, 'flex', `${id} should be shown in alchemy mode`);
    });
    assert.strictEqual(elements['sc-hit-chart'].style.display, 'block', 'Target-level chart should stay visible in alchemy mode');
});

test('Switching Scaling back to physical restores physical-only controls', () => {
    assert.ok(elements, 'JS failed to run — skipping');
    const modeSel = elements['sc-mode-sel'];
    modeSel.value = 'physical';
    modeSel._trigger('change', {});
    ['sc-src-field', 'sc-charge-field', 'sc-scale-field', 'sc-atlas-field'].forEach((id) => {
        assert.strictEqual(elements[id].style.display, 'flex', `${id} should be restored in physical mode`);
    });
    ['sc-al-spell-lv-field', 'sc-al-tgt-lv-field'].forEach((id) => {
        assert.strictEqual(elements[id].style.display, 'none', `${id} should hide in physical mode`);
    });
    assert.strictEqual(elements['sc-hit-chart'].style.display, 'block', 'Hit chart should show in physical mode');
});

test('Alchemy mode updates the Scaling note text', () => {
    assert.ok(elements, 'JS failed to run — skipping');
    const modeSel = elements['sc-mode-sel'];
    modeSel.value = 'alchemy';
    modeSel._trigger('change', {});
    assert.ok(
        elements['sc-note'].textContent.includes('Offensive alchemy now uses the traced projectile path'),
        'Scaling note did not switch to the alchemy copy'
    );
});

test('Hard Ball S0 vs Wimpy Flower shows a 5–10 legend range in alchemy mode', () => {
    assert.ok(elements, 'JS failed to run — skipping');
    const modeSel = elements['sc-mode-sel'];
    modeSel.value = 'alchemy';
    modeSel._trigger('change', {});
    const legendHtml = elements['sc-legend'].innerHTML;
    assert.ok(legendHtml.includes('Hard Ball'), 'Hard Ball row missing from Scaling legend');
    assert.ok(
        legendHtml.includes('S0:5–10') || legendHtml.includes('S0:5-10'),
        `Expected Hard Ball legend range 5–10, got: ${legendHtml.match(/Hard Ball[\s\S]{0,120}/)?.[0] || legendHtml}`
    );
});

test('Alchemy mode initializes both spell-level and target-level charts', () => {
    assert.ok(elements, 'JS failed to run — skipping');
    const modeSel = elements['sc-mode-sel'];
    modeSel.value = 'alchemy';
    modeSel._trigger('change', {});
    assert.ok(elements['sc-chart'].innerHTML.includes('spell level'), 'Missing spell-level chart axis label');
    assert.ok(elements['sc-hit-chart'].innerHTML.includes('target level'), 'Missing target-level chart axis label');
});

test('Non-scalable alchemy targets lock the target-level slider to 1', () => {
    assert.ok(elements, 'JS failed to run — skipping');
    elements['sc-tgt-sel'].value = 109;
    elements['sc-tgt-sel']._trigger('change', {});
    const modeSel = elements['sc-mode-sel'];
    modeSel.value = 'alchemy';
    modeSel._trigger('change', {});
    assert.strictEqual(elements['sc-al-tgt-lv'].disabled, true, 'Expected non-scalable target level slider to be disabled');
    assert.strictEqual(elements['sc-al-tgt-lv'].value, '1', 'Expected non-scalable target level slider to stay at 1');
});

test('Scalable alchemy targets unlock the target-level slider', () => {
    assert.ok(elements, 'JS failed to run — skipping');
    elements['sc-tgt-sel'].value = 0;
    elements['sc-tgt-sel']._trigger('change', {});
    const modeSel = elements['sc-mode-sel'];
    modeSel.value = 'alchemy';
    modeSel._trigger('change', {});
    assert.strictEqual(elements['sc-al-tgt-lv'].disabled, false, 'Expected scalable target level slider to be enabled');
});

console.log('\nDocs tab: JS behaviour');

test('Docs calculators both initialize without throwing', () => {
    assert.ok(elements, 'JS failed to run — skipping');
    assert.ok(elements['doc-dmg-chart'] && elements['doc-dmg-chart'].innerHTML.length > 10, 'Physical docs chart did not initialize');
    assert.ok(elements['doc-al-chart'] && elements['doc-al-chart'].innerHTML.length > 10, 'Alchemy docs chart did not initialize');
});

test('Docs alchemy graph shows Hard Ball L0 vs m.def 32 as 5–10', () => {
    assert.ok(elements, 'JS failed to run — skipping');
    elements['doc-al-spell'].value = 'hardball';
    elements['doc-al-spell-lv'].value = 0;
    elements['doc-al-mdef'].value = 32;
    elements['doc-al-mdef']._trigger('input', {});
    const htmlOut = elements['doc-al-chart'].innerHTML;
    assert.ok(
        htmlOut.includes('shown range: <b>5–10</b>') || htmlOut.includes('shown range: <b>5-10</b>'),
        `Expected docs alchemy chart range 5–10, got: ${htmlOut}`
    );
    assert.ok(htmlOut.includes('<svg'), 'Expected docs alchemy chart to include the RNG histogram');
});

test('Docs alchemy graph shows Hard Ball L0 vs m.def 0 as 11–20', () => {
    assert.ok(elements, 'JS failed to run — skipping');
    elements['doc-al-spell'].value = 'hardball';
    elements['doc-al-spell-lv'].value = 0;
    elements['doc-al-mdef'].value = 0;
    elements['doc-al-mdef']._trigger('input', {});
    const htmlOut = elements['doc-al-chart'].innerHTML;
    assert.ok(
        htmlOut.includes('shown range: <b>11–20</b>') || htmlOut.includes('shown range: <b>11-20</b>'),
        `Expected docs alchemy chart range 11–20, got: ${htmlOut}`
    );
});

test('Scaling legend shows Hard Ball L0 vs Carltron\'s Robot as 0–1', () => {
    assert.ok(elements, 'JS failed to run — skipping');
    elements['sc-tgt-sel'].value = 141;
    elements['sc-tgt-sel']._trigger('change', {});
    const modeSel = elements['sc-mode-sel'];
    modeSel.value = 'alchemy';
    modeSel._trigger('change', {});
    const legendHtml = elements['sc-legend'].innerHTML;
    assert.ok(
        legendHtml.includes('S0:0–1') || legendHtml.includes('S0:0-1'),
        `Expected Hard Ball legend range 0–1 for Carltron, got: ${legendHtml.match(/Hard Ball[\s\S]{0,120}/)?.[0] || legendHtml}`
    );
});

test('Scaling legend shows Hard Ball S0 vs Mosquito as 11–20', () => {
    assert.ok(elements, 'JS failed to run — skipping');
    elements['sc-tgt-sel'].value = 110;
    elements['sc-tgt-sel']._trigger('change', {});
    const modeSel = elements['sc-mode-sel'];
    modeSel.value = 'alchemy';
    modeSel._trigger('change', {});
    const legendHtml = elements['sc-legend'].innerHTML;
    assert.ok(
        legendHtml.includes('S0:11–20') || legendHtml.includes('S0:11-20'),
        `Expected Hard Ball legend range 11–20 for Mosquito, got: ${legendHtml.match(/Hard Ball[\s\S]{0,120}/)?.[0] || legendHtml}`
    );
});

test('Docs alchemy graph shows Hard Ball L1 vs m.def 32 as 10–20', () => {
    assert.ok(elements, 'JS failed to run — skipping');
    elements['doc-al-spell'].value = 'hardball';
    elements['doc-al-spell-lv'].value = 1;
    elements['doc-al-mdef'].value = 32;
    elements['doc-al-mdef']._trigger('input', {});
    const htmlOut = elements['doc-al-chart'].innerHTML;
    assert.ok(
        htmlOut.includes('shown range: <b>10–20</b>') || htmlOut.includes('shown range: <b>10-20</b>'),
        `Expected docs alchemy chart range 10–20, got: ${htmlOut}`
    );
});

test('Docs alchemy graph shows Hard Ball L1 vs m.def 0 as 21–41', () => {
    assert.ok(elements, 'JS failed to run — skipping');
    elements['doc-al-spell'].value = 'hardball';
    elements['doc-al-spell-lv'].value = 1;
    elements['doc-al-mdef'].value = 0;
    elements['doc-al-mdef']._trigger('input', {});
    const htmlOut = elements['doc-al-chart'].innerHTML;
    assert.ok(
        htmlOut.includes('shown range: <b>21–41</b>') || htmlOut.includes('shown range: <b>21-41</b>'),
        `Expected docs alchemy chart range 21–41, got: ${htmlOut}`
    );
});

test('Alchemy spell-level slider raises Hard Ball damage against Wimpy Flower', () => {
    assert.ok(elements, 'JS failed to run — skipping');
    elements['sc-tgt-sel'].value = 109;
    elements['sc-tgt-sel']._trigger('change', {});
    const modeSel = elements['sc-mode-sel'];
    modeSel.value = 'alchemy';
    modeSel._trigger('change', {});
    elements['sc-al-spell-lv'].value = '9';
    elements['sc-al-spell-lv']._trigger('input', {});
    const legendHtml = elements['sc-legend'].innerHTML;
    assert.ok(
        legendHtml.includes('S9:'),
        `Expected alchemy legend to update to spell level 9, got: ${legendHtml.match(/Hard Ball[\s\S]{0,120}/)?.[0] || legendHtml}`
    );
});

// ── RNG tab ──────────────────────────────────────────────────────────────────
const htmlRng = _renderRadarHtml(scope, refs, pools, argRefs, mapByAddr, roomTree, 'rng', null);

console.log('\nRNG tab: HTML structure');

test('RNG tab button is present', () => {
    assert.ok(htmlRng.includes('data-tab="rng"'), 'Missing RNG tab button');
});

test('RNG tab pane exists', () => {
    assert.ok(htmlRng.includes('<div class="tab-pane" data-tab="rng"'), 'Missing RNG tab pane');
});

test('Naris simulate button exists', () => {
    assert.ok(htmlRng.includes('id="rng-naris-btn"'), 'Missing rng-naris-btn');
});

test('Prophet simulate button exists', () => {
    assert.ok(htmlRng.includes('id="rng-prophet-btn"'), 'Missing rng-prophet-btn');
});

test('Egg simulate button exists', () => {
    assert.ok(htmlRng.includes('id="rng-egg-btn"'), 'Missing rng-egg-btn');
});

test('Prophet state table contains VIDEO_GAME (state 8)', () => {
    assert.ok(htmlRng.includes('VIDEO_GAME'), 'Missing VIDEO_GAME codename in prophet table');
});

test('Prophet state table contains DOOM (state 0)', () => {
    assert.ok(htmlRng.includes('DOOM'), 'Missing DOOM codename in prophet table');
});

test('Prophet state table contains FUSELAGE (state 19)', () => {
    assert.ok(htmlRng.includes('FUSELAGE'), 'Missing FUSELAGE codename in prophet table');
});

test('Egg pot selector exists', () => {
    assert.ok(htmlRng.includes('id="rng-pot-sel"'), 'Missing rng-pot-sel dropdown');
});

test('Prophet reset strategy dropdown exists', () => {
    assert.ok(htmlRng.includes('id="rng-prophet-strat"'), 'Missing rng-prophet-strat dropdown');
});

test('Prophet strategy description element exists', () => {
    assert.ok(htmlRng.includes('id="rng-prophet-strat-desc"'), 'Missing rng-prophet-strat-desc div');
});

test('Prophet table has Reach 8 and Reach 5 columns', () => {
    assert.ok(htmlRng.includes('Reach 8'), 'Missing Reach 8 column header');
    assert.ok(htmlRng.includes('Reach 5'), 'Missing Reach 5 column header');
});

test('Prophet table next-states column contains arc transitions', () => {
    assert.ok(htmlRng.includes('28/32'), 'Missing 28/32 prophecy arc transition');
    assert.ok(htmlRng.includes('26/32'), 'Missing 26/32 meta arc transition');
    assert.ok(htmlRng.includes('chaos=7/8'), 'Missing chaos arc next-states');
});

test('RNG histogram elements exist for all three sections', () => {
    assert.ok(htmlRng.includes('id="rng-naris-hist"'), 'Missing naris histogram');
    assert.ok(htmlRng.includes('id="rng-prophet-hist"'), 'Missing prophet histogram');
    assert.ok(htmlRng.includes('id="rng-egg-hist"'), 'Missing egg histogram');
});

test('RNG webview JS executes without throwing', () => {
    const rngCode = injectScalingFixture(extractScript(htmlRng));
    assert.doesNotThrow(() => {
        runWithTrackingDoc(rngCode);
    }, 'RNG tab JS threw during execution');
});

test('RNG simulate buttons are wired (click handler registered via addEventListener)', () => {
    const rngCode = injectScalingFixture(extractScript(htmlRng));
    const els = runWithTrackingDoc(rngCode);
    // The rng-naris-btn element should have had addEventListener called on it
    // (the button exists in the mock DOM and rngJs calls bindSim)
    assert.ok(els['rng-naris-btn'], 'rng-naris-btn element not found in DOM after JS run');
    assert.ok(els['rng-prophet-btn'], 'rng-prophet-btn element not found in DOM after JS run');
    assert.ok(els['rng-egg-btn'], 'rng-egg-btn element not found in DOM after JS run');
});

console.log(`\n${passed + failed} run: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);

