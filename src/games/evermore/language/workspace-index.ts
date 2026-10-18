// Owner: games/evermore/language/workspace-index.ts
// Owns the static JSON index and the live workspace declaration index.
// All other providers receive idx/workspaceIndex as parameters or via getters.

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

/** One member of an enum in the static index: `value` as written in the source (a number, True/False, another member). */
interface EnumMember { name: string; value: string; comment: string }

/** The static language index (data/index.json): what hovers, completion and checks know about. */
interface LanguageIndex {
    functions: Record<string, string[]>;
    native: string[];
    enums: Record<string, EnumMember[]>;
    specials: Record<string, string>;
    annotations: string[];
}

/** A declaration found in a workspace .evs file. */
interface Declaration { uri: vscode.Uri; line: number; kind: string; name: string }

let _index: LanguageIndex | null = null;

function loadIndex(extensionPath: string): LanguageIndex {
    if (_index) return _index;
    const p = path.join(extensionPath, 'src', 'games', 'evermore', 'language', 'data', 'index.json');
    const index: LanguageIndex = JSON.parse(fs.readFileSync(p, 'utf-8'));
    _index = index;
    return index;
}

function getIndex(): LanguageIndex | null { return _index; }

// ── Workspace declaration index ───────────────────────────────────────────────
// Maps declaration names → [{uri, line, kind}] across all .evs files.

let _workspaceIndex: Map<string, Declaration[]> = new Map();

async function indexDocument(uri: vscode.Uri): Promise<Declaration[]> {
    const entries: Declaration[] = [];
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
    const next = new Map<string, Declaration[]>();
    for (const uri of files) {
        for (const entry of await indexDocument(uri)) {
            const list = next.get(entry.name);
            if (list) list.push(entry); else next.set(entry.name, [entry]);
        }
    }
    _workspaceIndex = next;
}

function getWorkspaceIndex() { return _workspaceIndex; }

export type { LanguageIndex, EnumMember, Declaration };
export { loadIndex, getIndex, indexDocument, buildWorkspaceIndex, getWorkspaceIndex };
