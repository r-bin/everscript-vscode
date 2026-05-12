'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Module = require('module');
const { alchemyEffectiveMdef, alchemyRangeLevel0 } = require('../alchemy-model');

let passed = 0;
let failed = 0;
function test(name, fn) {
    try {
        fn();
        console.log('  ✓ ' + name);
        passed++;
    } catch (e) {
        console.error('  ✗ ' + name + '\n    ' + e.message);
        failed++;
    }
}

// Mock vscode before requiring extension.js
const _origResolve = Module._resolveFilename;
Module._resolveFilename = function(req, ...rest) {
    if (req === 'vscode') return req;
    return _origResolve.call(this, req, ...rest);
};
require.cache.vscode = {
    id: 'vscode', filename: 'vscode', loaded: true,
    exports: {
        workspace: { workspaceFolders: null, onDidOpenTextDocument: ()=>({dispose:()=>{}}), onDidCloseTextDocument: ()=>({dispose:()=>{}}), onDidChangeTextDocument: ()=>({dispose:()=>{}}), createFileSystemWatcher: ()=>({onDidChange:()=>({dispose:()=>{}}), onDidCreate:()=>({dispose:()=>{}}), onDidDelete:()=>({dispose:()=>{}}), dispose:()=>{}}) },
        window: { createWebviewPanel: ()=>{}, onDidChangeActiveTextEditor: ()=>({dispose:()=>{}}), activeTextEditor: null, showInformationMessage: ()=>{}, showWarningMessage: ()=>{} },
        commands: { registerCommand: ()=>({dispose:()=>{}}) },
        languages: { registerHoverProvider: ()=>({dispose:()=>{}}), registerCompletionItemProvider: ()=>({dispose:()=>{}}), registerDefinitionProvider: ()=>({dispose:()=>{}}), registerCodeLensProvider: ()=>({dispose:()=>{}}), registerReferenceProvider: ()=>({dispose:()=>{}}) },
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

const extensionSrc = fs.readFileSync(path.join(__dirname, '..', 'extension.js'), 'utf8');
const patchedSrc = extensionSrc.replace(
    /module\.exports\s*=\s*\{[^}]+\};?\s*$/,
    'module.exports = { activate, deactivate, _readRomCharacters: readRomCharacters };'
);
const tmpPath = path.join(__dirname, '..', '_scaling_rom_tmp.js');
fs.writeFileSync(tmpPath, patchedSrc);
let readRomCharacters;
try {
    delete require.cache[require.resolve(tmpPath)];
    readRomCharacters = require(tmpPath)._readRomCharacters;
} finally {
    fs.unlinkSync(tmpPath);
}

console.log('\nscaling rom parsing:');

test('Hard Ball L0 vs Purple Flower uses parsed magic_defense=32 and yields 6–10', () => {
    const CHAR_BASE = 0x0EB678;
    const CHAR_SIZE = 0x4a;
    const targetId = 109;
    const romSize = CHAR_BASE + CHAR_SIZE * 142 + 0x100;
    const romBuf = Buffer.alloc(romSize);
    const base = CHAR_BASE + targetId * CHAR_SIZE;

    // Basic target stats for #109 Wimpy/Purple Flower.
    romBuf.writeUInt16LE(18, base + 0x0f); // hp
    romBuf.writeUInt16LE(1,  base + 0x19); // attack
    romBuf.writeUInt16LE(28, base + 0x1b); // defense
    romBuf.writeUInt16LE(32, base + 0x1d); // magic_defense
    romBuf.writeUInt16LE(0,  base + 0x1f); // evade
    romBuf.writeUInt16LE(0,  base + 0x21); // hit_rate

    const fakeRoot = '/fake/workspace';
    const romPath = path.join(fakeRoot, 'Secret of Evermore (U) [!].smc');
    const origExistsSync = fs.existsSync;
    const origReadFileSync = fs.readFileSync;
    try {
        fs.existsSync = (p) => p === romPath;
        fs.readFileSync = (p) => {
            if (p === romPath) return romBuf;
            return origReadFileSync(p);
        };

        const chars = readRomCharacters(fakeRoot);
        const flower = chars.find((c) => c.id === targetId);
        assert.ok(flower, 'failed to parse target character record');
        assert.strictEqual(flower.hp, 18);
        assert.strictEqual(flower.defense, 28);
        assert.strictEqual(flower.magic_defense, 32);
        assert.strictEqual(flower.evade, 0);

        const r = alchemyRangeLevel0(21, flower.magic_defense);
        assert.deepStrictEqual({ w: r.w, resist: r.resist, min: r.min, max: r.max }, { w: 8, resist: 13, min: 6, max: 10 });
        assert.strictEqual(alchemyEffectiveMdef(60), 20);
    } finally {
        fs.existsSync = origExistsSync;
        fs.readFileSync = origReadFileSync;
    }
});

console.log('\n' + passed + ' passed, ' + failed + ' failed\n');
if (failed) process.exit(1);