'use strict';
// The package leaves out the JS the host bundle holds (tools/bundle.mts -> bundle/drop.json). This
// test builds every page and loads every table the way the extension does, records each package file
// read from disk, and fails when one of them is left out of the package: a page would then break only
// when opened. Run after tests/memory/bundle.test.js (it builds bundle/).

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Module = require('module');
const { spawnSync, execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..', '..');
let failed = 0;
function test(name, fn) {
    try { fn(); console.log(`  ✓ ${name}`); } catch (e) { failed++; console.error(`  ✗ ${name}\n    ${e.message}`); }
}

console.log('package files:');

if (!fs.existsSync(path.join(ROOT, 'bundle', 'drop.json'))) {
    const r = spawnSync(process.execPath, [path.join(ROOT, 'tools', 'bundle.mts')], { cwd: ROOT, encoding: 'utf8' });
    assert.strictEqual(r.status, 0, r.stderr);
}
const drop = new Set(JSON.parse(fs.readFileSync(path.join(ROOT, 'bundle', 'drop.json'), 'utf8')));

// Record every file under the repo that the code reads, stat's or lists (not node's own loading of
// required modules: the bundle holds those).
const reads = new Set();
const rel = (p) => { const r = path.relative(ROOT, path.resolve(String(p))); return r.startsWith('..') ? null : r.split(path.sep).join('/'); };
const byLoader = () => { const caller = (new Error().stack || '').split('\n')[3] || ''; return caller.includes('node:internal/modules'); };
for (const fn of ['readFileSync', 'existsSync', 'statSync', 'readdirSync', 'readFile']) {
    const orig = fs[fn];
    fs[fn] = function (p, ...rest) { const r = typeof p === 'string' ? rel(p) : null; if (r && !byLoader()) reads.add(r); return orig.call(this, p, ...rest); };
}

// A vscode stub for modules that require it at load (nothing here calls into it).
const _resolve = Module._resolveFilename;
Module._resolveFilename = function (req, ...rest) { return req === 'vscode' ? req : _resolve.call(this, req, ...rest); };
require.cache.vscode = { id: 'vscode', filename: 'vscode', loaded: true, exports: new Proxy({}, { get: () => new Proxy(function () {}, { get: () => () => ({}) }) }) };

const req = (p) => require(path.join(ROOT, p));
const pages = [
    ['the radar page (Memory, Rooms, Characters, Docs, Scaling, ROM, Music, Scripts)', () => req('src/games/evermore/memory/webview/index.js')],
    ['the Docs and RNG tabs', () => { const d = req('src/games/evermore/docs-tab/render-docs-tab.js'); d.buildDocsTabHtml(); d.buildRngTabHtml(); }],
    ['the emulator page with Evermore\'s part', () => {
        const host = req('src/games/evermore/emulator/host.js');
        for (const f of host.webviewFiles()) fs.readFileSync(f);
        req('src/core/emulator/panel-webview.js').buildHtml({ cspSource: '', asWebviewUri: (u) => u }, 'c.js', 'c.wasm', 'c', 'c', null, { gameView: host.webview() });
    }],
    ['the emulator page files (panel.js file())', () => {
        for (const f of fs.readdirSync(path.join(ROOT, 'src/core/emulator/webview'))) fs.statSync(path.join(ROOT, 'src/core/emulator/webview', f));
    }],
    ['the ROM panel page files', () => {
        for (const f of fs.readdirSync(path.join(ROOT, 'src/core/roms/webview'))) fs.statSync(path.join(ROOT, 'src/core/roms/webview', f));
    }],
    ['the Mana Maps page', () => { const p = req('src/games/mana/maps/page.js'); for (const f of [...Object.values(p.CSS || {}), ...(p.SCRIPTS || [])].flat()) if (typeof f === 'string') fs.readFileSync(f); }],
    ['the knowledge entries', () => { const k = req('src/games/evermore/localizations/knowledge.js'); k.entries('ram'); k.entries('rom'); }],
    ['the known script names (address lookup)', () => new (req('src/games/evermore/emulator/address-lookup.js').RomAddressLookup)(null)],
    ['the language index', () => req('dist/games/evermore/language/workspace-index.js').loadIndex(ROOT)],
    ['the music engine', () => req('src/games/evermore/music/engine/spc-engine.js')],
];
for (const [name, run] of pages) {
    test(`reads nothing the package leaves out: ${name}`, () => {
        const before = new Set(reads);
        try { run(); } catch (e) { if (!/vscode|is not a (function|constructor)/.test(e.message)) throw e; }
        const bad = [...reads].filter((r) => !before.has(r) && drop.has(r));
        assert.deepStrictEqual(bad, [], 'read from disk but left out of the package');
    });
}

test('the recorder sees the reads (controls)', () => {
    assert.ok([...reads].some((r) => r.startsWith('src/games/evermore/localizations/knowledge/rom/')), 'knowledge entries read');
    assert.ok([...reads].some((r) => r.startsWith('src/games/evermore/rooms/webview/')), 'radar page files read');
    const dropped = [...drop][0];
    fs.readFileSync(path.join(ROOT, dropped));
    assert.ok(reads.has(dropped), 'a direct read of a left-out file is recorded');
    reads.delete(dropped);
});

test('every package file read above ships (vsce ls with bundle/.vscodeignore)', () => {
    let listed;
    try {
        listed = new Set(execFileSync('vsce', ['ls', '--ignoreFile', 'bundle/.vscodeignore'], { cwd: ROOT, encoding: 'utf8' }).split('\n'));
    } catch (_) { console.log('    (vsce not on PATH: skipped)'); return; }
    const missing = [...reads].filter((r) => /^(src|dist)\//.test(r) && fs.existsSync(path.join(ROOT, r)) && fs.statSync(path.join(ROOT, r)).isFile() && !listed.has(r));
    assert.deepStrictEqual(missing, []);
    assert.ok(listed.has('bundle/extension.js'), 'the bundle ships');
    // The root holds only the manifest, its pages and the runtime folders: no repo tooling, configs
    // or submodule folders (they have shipped before: knip.json, dependencies/, script_parser/).
    const ROOT_ALLOWED = /^(package\.json|README\.md|LICENSE|bundle\/extension\.js|resources\/|src\/|dist\/)/;
    assert.deepStrictEqual([...listed].filter((f) => f && !ROOT_ALLOWED.test(f)), [], 'tooling in the package');
    assert.deepStrictEqual([...listed].filter((f) => /(^|\/)(AGENTS|STATE)\.md$|\/README\.md$|\.gitignore$|test\.html$/.test(f)), [], 'developer docs in the package');
});

if (failed) process.exit(1);
