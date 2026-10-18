// Owner: games/evermore/language/definition-provider.ts
// Go-to-definition and find-references for .evs files.

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { getWorkspaceIndex } from './workspace-index';

function escapeRegex(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function wordAt(document: vscode.TextDocument, position: vscode.Position) {
    const range = document.getWordRangeAtPosition(position, /[a-zA-Z_][a-zA-Z0-9_]*/);
    return range ? { word: document.getText(range), range } : null;
}

async function provideDefinition(document: vscode.TextDocument, position: vscode.Position): Promise<vscode.Location[] | null> {
    const lineText = document.lineAt(position.line).text;

    // #include("path") — open the included file
    const includeMatch = lineText.match(/#include\(\s*["']?([^"')]+)["']?\s*\)/);
    if (includeMatch) {
        const resolved = path.resolve(path.dirname(document.uri.fsPath), includeMatch[1]);
        if (fs.existsSync(resolved)) {
            return [new vscode.Location(vscode.Uri.file(resolved), new vscode.Position(0, 0))];
        }
        return null;
    }

    const hit = wordAt(document, position);
    if (!hit) return null;

    const entries = getWorkspaceIndex().get(hit.word);
    if (!entries || entries.length === 0) return null;

    return entries.map(e => new vscode.Location(e.uri, new vscode.Position(e.line, 0)));
}

async function provideReferences(document: vscode.TextDocument, position: vscode.Position): Promise<vscode.Location[] | null> {
    const hit = wordAt(document, position);
    if (!hit) return null;
    const { word } = hit;

    // Only search lowercase/mixed names (not enum type names)
    if (!/[a-z]/.test(word)) return null;

    const files     = await vscode.workspace.findFiles('**/*.evs', '**/node_modules/**');
    const re        = new RegExp(`\\b${escapeRegex(word)}\\b`, 'g');
    const locations: vscode.Location[] = [];

    for (const fileUri of files) {
        try {
            const doc = await vscode.workspace.openTextDocument(fileUri);
            for (let i = 0; i < doc.lineCount; i++) {
                const text = doc.lineAt(i).text;
                let match;
                re.lastIndex = 0;
                while ((match = re.exec(text)) !== null) {
                    locations.push(new vscode.Location(fileUri, new vscode.Position(i, match.index)));
                }
            }
        } catch (_) {}
    }

    return locations;
}

export { provideDefinition, provideReferences };
