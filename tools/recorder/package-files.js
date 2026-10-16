'use strict';

/**
 * tools/recorder/package-files.js
 *
 * The files the SNES CDL Recorder ships: everything its entry points reach
 * through require() (resolved the way node resolves it, literal specifiers only,
 * also inside functions), plus the files loaded by path (ASSETS). Nothing else
 * of the repository goes into its .vsix. Entry points: the extension, and the
 * headless replay check the recordings are verified with (tas/verify.js spawns it).
 *
 *   node tools/recorder/package-files.js          prints the list (repo-relative)
 *   require(...).recorderFiles()                  { files, unresolved, dynamic }
 */

const fs = require('fs');
const path = require('path');
const Module = require('module');

const ROOT = path.resolve(__dirname, '..', '..');
const ENTRIES = ['src/recorder/extension.js', 'tools/cdl/replay.js'];
// Loaded by path, not by require: the cores (panel.js _bundledCore) and the
// webview's own files (panel.js _resetPanelHtml).
const ASSETS = [
    'src/emulator/core/snes9x2005-wasm/snes9x_2005.js',
    'src/emulator/core/snes9x2005-wasm/snes9x_2005.wasm',
    'src/emulator/core/snes9x2005-wasm-vanilla/snes9x_2005.js',
    'src/emulator/core/snes9x2005-wasm-vanilla/snes9x_2005.wasm',
    // The Snes9x licence: every copy of the core binaries comes with its copyright file.
    'src/emulator/core/snes9x2005-wasm/copyright',
    'src/emulator/core/snes9x2005-wasm-vanilla/copyright',
    'src/emulator/webview/rom-game.js',
    'src/emulator/webview/emulator-profile.js',
    'src/emulator/webview/emulator-profile.css',
    'src/emulator/known-scripts.json',   // address-lookup.js
];

const REQUIRE = /\brequire\(\s*(['"])([^'"]+)\1\s*\)/g;
const DYNAMIC = /\brequire\(\s*[^'"\s)]/g;

function stripComments(src) {
    return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"\\])\/\/.*$/gm, '$1');
}

/** @returns {{ files: string[], unresolved: string[], dynamic: string[] }} */
function recorderFiles() {
    const seen = new Set();
    const unresolved = [];
    const dynamic = [];
    const queue = ENTRIES.map(e => path.join(ROOT, e));
    while (queue.length) {
        const file = queue.pop();
        if (seen.has(file)) continue;
        seen.add(file);
        if (!/\.js$/.test(file)) continue;
        const src = stripComments(fs.readFileSync(file, 'utf8'));
        if (DYNAMIC.test(src)) dynamic.push(path.relative(ROOT, file));
        DYNAMIC.lastIndex = 0;
        for (const m of src.matchAll(REQUIRE)) {
            const spec = m[2];
            if (spec === 'vscode' || Module.isBuiltin(spec) || spec.startsWith('node:')) continue;
            try {
                queue.push(require.resolve(spec, { paths: [path.dirname(file)] }));
            } catch (_) {
                unresolved.push(path.relative(ROOT, file) + ': ' + spec);
            }
        }
    }
    for (const a of ASSETS) seen.add(path.join(ROOT, a));
    const files = [...seen].map(f => path.relative(ROOT, f).split(path.sep).join('/')).sort();
    return { files, unresolved, dynamic };
}

if (require.main === module) {
    const r = recorderFiles();
    for (const f of r.files) console.log(f);
    if (r.unresolved.length) console.error('unresolved:\n  ' + r.unresolved.join('\n  '));
    if (r.dynamic.length) console.error('non-literal require() in (check by hand):\n  ' + r.dynamic.join('\n  '));
}

module.exports = { recorderFiles, ASSETS, ENTRIES, ROOT };
