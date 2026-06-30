'use strict';
// Owner: code_highlighter/workspace-index.js
// Owns the static JSON index and the live workspace declaration index.
// All other providers receive idx/workspaceIndex as parameters or via getters.

const vscode = require('vscode');
const path   = require('path');
const fs     = require('fs');

let _index = null;

function loadIndex(extensionPath) {
    if (_index) return _index;
    const p = path.join(extensionPath, 'src', 'language', 'data', 'index.json');
    _index = JSON.parse(fs.readFileSync(p, 'utf-8'));
    return _index;
}

function getIndex() { return _index; }

// ── Workspace declaration index ───────────────────────────────────────────────
// Maps declaration names → [{uri, line, kind}] across all .evs files.

/** @type {Map<string, Array<{uri: vscode.Uri, line: number, kind: string}>>} */
let _workspaceIndex = new Map();

async function indexDocument(uri) {
    const entries = [];
    try {
        const doc = await vscode.workspace.openTextDocument(uri);
        for (let i = 0; i < doc.lineCount; i++) {
            const text = doc.lineAt(i).text.trimStart();
            const m = text.match(/^(fun|map|area|group|enum|val)\s+(\w+)/);
            if (m) entries.push({ uri, line: i, kind: m[1], name: m[2] });
        }
    } catch (_) {}
    return entries;
}

async function buildWorkspaceIndex() {
    const files = await vscode.workspace.findFiles('**/*.evs', '**/node_modules/**');
    const next  = new Map();
    for (const uri of files) {
        for (const entry of await indexDocument(uri)) {
            if (!next.has(entry.name)) next.set(entry.name, []);
            next.get(entry.name).push(entry);
        }
    }
    _workspaceIndex = next;
}

function getWorkspaceIndex() { return _workspaceIndex; }

module.exports = { loadIndex, getIndex, indexDocument, buildWorkspaceIndex, getWorkspaceIndex };
