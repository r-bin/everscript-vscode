// Owner: games/evermore/language/dead-branch.ts
// Detects statically dead if-branches and applies faded decorations.

import * as vscode from 'vscode';
import type { LanguageIndex } from './workspace-index';

let _deadDecorationType: vscode.TextEditorDecorationType | null = null;

function getDeadDecorationType(): vscode.TextEditorDecorationType {
    if (!_deadDecorationType) {
        _deadDecorationType = vscode.window.createTextEditorDecorationType({
            opacity: '0.35',
        });
    }
    return _deadDecorationType;
}

/**
 * Return true if the if-condition is statically dead.
 * Handles: False/True literals, 0/1, ENUM.MEMBER value lookups.
 */
function isStaticallyDead(condition: string, negated: boolean, idx: LanguageIndex): boolean {
    const cond = condition.trim();
    if (!negated && (cond === 'False' || cond === '0')) return true;
    if ( negated && (cond === 'True'  || cond === '1')) return true;
    const m = cond.match(/^([A-Z_][A-Z0-9_]*)\.([A-Z_][A-Z0-9_]*)$/);
    if (m) {
        const members = idx.enums[m[1]] || [];
        const member  = members.find(e => e.name === m[2]);
        if (member) {
            const val    = Number(member.value);
            const isZero = val === 0;
            return negated ? !isZero : isZero;
        }
    }
    return false;
}

/**
 * Find the inner range of a { } block starting at or after fromLine.
 * Simple brace-counting; ignores line comments.
 */
function findBlockRange(document: vscode.TextDocument, fromLine: number): vscode.Range | null {
    let depth      = 0;
    let blockStart: vscode.Position | null = null;
    for (let i = fromLine; i < document.lineCount && i < fromLine + 300; i++) {
        const text       = document.lineAt(i).text;
        const commentIdx = text.indexOf('//');
        const safeLen    = commentIdx >= 0 ? commentIdx : text.length;
        for (let c = 0; c < safeLen; c++) {
            if (text[c] === '{') {
                if (depth === 0) blockStart = new vscode.Position(i, c + 1);
                depth++;
            } else if (text[c] === '}') {
                depth--;
                if (depth === 0 && blockStart) {
                    return new vscode.Range(blockStart, new vscode.Position(i, c));
                }
            }
        }
    }
    return null;
}

const IF_DEAD_RE = /^\s*if(!?)\s*\(([^)]+)\)/;

function updateDeadBranchDecorations(editor: vscode.TextEditor | undefined, idx: LanguageIndex): void {
    if (!editor || editor.document.languageId !== 'everscript') return;
    const doc    = editor.document;
    const ranges: vscode.Range[] = [];
    for (let i = 0; i < doc.lineCount; i++) {
        const m = IF_DEAD_RE.exec(doc.lineAt(i).text);
        if (!m) continue;
        if (!isStaticallyDead(m[2], m[1] === '!', idx)) continue;
        const block = findBlockRange(doc, i);
        if (block) ranges.push(block);
    }
    editor.setDecorations(getDeadDecorationType(), ranges);
}

export { getDeadDecorationType, isStaticallyDead, findBlockRange, updateDeadBranchDecorations };
