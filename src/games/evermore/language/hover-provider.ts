// Owner: games/evermore/language/hover-provider.ts
// Provides hover tooltips: functions, enum names/members, number literals.
// idx (static index) and radarMap are injected at call time — no module state.

import * as vscode from 'vscode';
import type { LanguageIndex, EnumMember } from './workspace-index';

/** What the Memory Radar knows about a WRAM address (the hover adds it to a hex literal). */
interface RadarEntry { name: string; lifecycle: string; type?: string; notes?: string }
type RadarMap = Map<number, RadarEntry>;

// ── Shared text utilities (hover + completion use these) ──────────────────────

/** Return the word (identifier) under the cursor, or null. */
function wordAt(document: vscode.TextDocument, position: vscode.Position) {
    const range = document.getWordRangeAtPosition(position, /[a-zA-Z_][a-zA-Z0-9_]*/);
    return range ? { word: document.getText(range), range } : null;
}

/** Return the UPPER_CASE enum name immediately before a dot on the same line, or null. */
function enumNameBeforeDot(document: vscode.TextDocument, position: vscode.Position, wordRange: vscode.Range): string | null {
    const line   = document.lineAt(position.line).text;
    const before = line.substring(0, wordRange.start.character);
    const m      = before.match(/([A-Z_][A-Z0-9_]*)\.$/);
    return m ? m[1] : null;
}

// ── Hover helpers ─────────────────────────────────────────────────────────────

function makeHoverForFunction(name: string, idx: LanguageIndex) {
    const sigs = idx.functions[name];
    if (!sigs || sigs.length === 0) return null;
    const isNative = idx.native.includes(name);
    const md = new vscode.MarkdownString();
    sigs.forEach(sig => md.appendCodeblock(sig, 'everscript'));
    md.appendMarkdown(`\n\n*${isNative ? 'native (compiler built-in)' : 'core library'}*`);
    return new vscode.Hover(md);
}

function makeHoverForEnum(name: string, idx: LanguageIndex) {
    const members = idx.enums[name];
    if (!members || members.length === 0) return null;
    const shown = members.slice(0, 30);
    const rest  = members.length - shown.length;
    const lines = shown.map(m => `  ${m.name} = ${m.value}${m.comment ? '  // ' + m.comment : ''}`);
    if (rest > 0) lines.push(`  // ... and ${rest} more`);
    const md = new vscode.MarkdownString();
    md.appendCodeblock(`enum ${name} {\n${lines.join('\n')}\n}`, 'everscript');
    return new vscode.Hover(md);
}

function makeHoverForMember(word: string, enumName: string, idx: LanguageIndex) {
    const members = idx.enums[enumName];
    if (!members) return null;
    const member = members.find(m => m.name === word);
    if (!member) return null;
    const md = new vscode.MarkdownString();
    md.appendCodeblock(`${enumName}.${member.name} = ${member.value}`, 'everscript');
    if (member.comment) md.appendMarkdown(`\n\n${member.comment}`);
    return new vscode.Hover(md);
}

function makeHoverForSpecial(word: string, idx: LanguageIndex) {
    const desc = idx.specials[word];
    if (!desc) return null;
    return new vscode.Hover(new vscode.MarkdownString(desc));
}

// ── Number literal hover ──────────────────────────────────────────────────────

function numberAt(document: vscode.TextDocument, position: vscode.Position) {
    const range = document.getWordRangeAtPosition(
        position, /0[xX][0-9a-fA-F]+|0[dD]\d+|0[bB][01]+/
    );
    if (!range) return null;
    return { text: document.getText(range), range };
}

/** `radarMap`: optional WRAM address map for memory annotation. */
function makeHoverForNumber(text: string, radarMap: RadarMap | null = null) {
    let value: number, base: number, rawDigits: string;
    if (/^0[xX]/.test(text)) {
        rawDigits = text.slice(2); value = parseInt(rawDigits, 16); base = 16;
    } else if (/^0[dD]/.test(text)) {
        rawDigits = text.slice(2); value = parseInt(rawDigits, 10); base = 10;
    } else if (/^0[bB]/.test(text)) {
        rawDigits = text.slice(2); value = parseInt(rawDigits, 2);  base = 2;
    } else {
        return null;
    }
    if (isNaN(value)) return null;

    const byteCount = base === 16
        ? Math.max(1, Math.ceil(rawDigits.length / 2))
        : value < 0x100 ? 1 : value < 0x10000 ? 2 : value < 0x1000000 ? 3 : 4;
    const byteLabel = byteCount === 1 ? '1 byte' : `${byteCount} bytes`;
    const hexStr    = value.toString(16).toUpperCase().padStart(byteCount * 2, '0');
    const binStr    = value.toString(2).padStart(byteCount * 8, '0');

    const lines: string[] = [];
    if (base !== 16) lines.push(`hex:     0x${hexStr}`);
    if (base !== 10) lines.push(`decimal: ${value}`);
    if (base !== 2)  lines.push(`binary:  0b${binStr}`);
    lines.push(`size:    ${byteLabel}`);

    const md = new vscode.MarkdownString(undefined, true);
    md.isTrusted = true;
    md.appendCodeblock(lines.join('\n'), 'text');

    if (radarMap && value >= 0 && value <= 0xFFFF) {
        const me = radarMap.get(value);
        if (me) {
            md.appendMarkdown('\n\n**' + me.name + '** `' + me.lifecycle + '`');
            if (me.type) md.appendMarkdown(' \u2014 ' + me.type.replace(/</g, '&lt;'));
            if (me.notes) md.appendMarkdown('\n\n' + me.notes.replace(/</g, '&lt;').replace(/>/g, '&gt;'));
            md.appendMarkdown('\n\n[$(list-selection) Open Memory Radar](command:everscript.openMemoryRadar)');
        }
    }
    return new vscode.Hover(md);
}

// ── Reverse enum member lookup ────────────────────────────────────────────────

type ReverseMember = { enumName: string; value: string; comment: string };
let _reverseMemberMap: Map<string, ReverseMember[]> | null = null;

function buildReverseMemberMap(idx: LanguageIndex): Map<string, ReverseMember[]> {
    if (_reverseMemberMap) return _reverseMemberMap;
    const map = new Map<string, ReverseMember[]>();
    for (const [enumName, members] of Object.entries(idx.enums)) {
        for (const m of members as EnumMember[]) {
            const list = map.get(m.name) ?? [];
            list.push({ enumName, value: m.value, comment: m.comment });
            map.set(m.name, list);
        }
    }
    _reverseMemberMap = map;
    return map;
}

function makeHoverForUnqualifiedMember(word: string, idx: LanguageIndex) {
    const map     = buildReverseMemberMap(idx);
    const matches = map.get(word);
    if (!matches || matches.length === 0) return null;
    const md = new vscode.MarkdownString();
    for (const { enumName, value, comment } of matches) {
        md.appendCodeblock(
            `${enumName}.${word} = ${value}${comment ? '  // ' + comment : ''}`,
            'everscript'
        );
    }
    if (matches.length === 1) {
        const { enumName } = matches[0];
        const allMembers   = idx.enums[enumName] || [];
        const lines = allMembers.slice(0, 24).map(m =>
            `  ${m.name === word ? '> ' : '  '}${m.name} = ${m.value}${m.comment ? '  // ' + m.comment : ''}`
        );
        if (allMembers.length > 24) lines.push('  // ...');
        md.appendCodeblock(`enum ${enumName} {\n${lines.join('\n')}\n}`, 'everscript');
    }
    return new vscode.Hover(md);
}

// ── Hover provider ────────────────────────────────────────────────────────────

/** `idx`: the static index (workspace-index.ts); `radarMap`: optional WRAM map for hex literal annotations. */
function provideHover(document: vscode.TextDocument, position: vscode.Position, idx: LanguageIndex, radarMap: RadarMap | null = null) {
    const numHit = numberAt(document, position);
    if (numHit) return makeHoverForNumber(numHit.text, radarMap);

    const hit = wordAt(document, position);
    if (!hit) return null;
    const { word, range } = hit;

    const lineText  = document.lineAt(position.line).text.trimStart();
    const declMatch = lineText.match(/^(fun|enum|map|area|group|val)\s+(\w+)/);
    if (declMatch && declMatch[2] === word) return null;

    const charAfterWord = document.getText(
        new vscode.Range(range.end, range.end.translate(0, 1))
    );
    const isAccessor = charAfterWord === '[';

    const enumName = enumNameBeforeDot(document, position, range);
    if (enumName) {
        return makeHoverForMember(word, enumName, idx)
            || makeHoverForUnqualifiedMember(word, idx)
            || makeHoverForSpecial(word, idx);
    }

    if (!isAccessor) {
        const enumHover = makeHoverForEnum(word, idx);
        if (enumHover) return enumHover;
    }

    if (!isAccessor) {
        const fnHover = makeHoverForFunction(word, idx);
        if (fnHover) return fnHover;
    }

    const specialHover = makeHoverForSpecial(word, idx);
    if (specialHover) return specialHover;

    if (/^[A-Z_][A-Z0-9_]*$/.test(word)) {
        return makeHoverForUnqualifiedMember(word, idx);
    }

    return null;
}

export type { RadarEntry, RadarMap };
export { wordAt, enumNameBeforeDot, provideHover };
