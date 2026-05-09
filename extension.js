'use strict';

const vscode = require('vscode');
const path   = require('path');
const fs     = require('fs');

// ── Data loading ──────────────────────────────────────────────────────────────

let _index = null;

function loadIndex(context) {
    if (_index) return _index;
    const p = path.join(context.extensionPath, 'data', 'index.json');
    _index = JSON.parse(fs.readFileSync(p, 'utf-8'));
    return _index;
}

// ── Workspace index ───────────────────────────────────────────────────────────
// Maps declaration names to {uri, line, kind} across all .evs files.

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

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Return the word (identifier) under the cursor, or null. */
function wordAt(document, position) {
    const range = document.getWordRangeAtPosition(position, /[a-zA-Z_][a-zA-Z0-9_]*/);
    return range ? { word: document.getText(range), range } : null;
}

/** Return the UPPER_CASE enum name immediately before a dot on the same line, or null. */
function enumNameBeforeDot(document, position, wordRange) {
    const line = document.lineAt(position.line).text;
    const before = line.substring(0, wordRange.start.character);
    const m = before.match(/([A-Z_][A-Z0-9_]*)\.$/);
    return m ? m[1] : null;
}

function escapeRegex(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Convert a core function signature to a VS Code snippet string.
 * "transition(map:MAP, x, y)" -> "transition(${1:map}, ${2:x}, ${3:y})$0"
 */
function sigToSnippet(sig) {
    const m = sig.match(/^(\w+)\(([^)]*)\)$/);
    if (!m) return sig + '($0)';
    const [, name, rawParams] = m;
    if (!rawParams.trim()) return `${name}($0)`;
    const params = rawParams.split(',').map(p =>
        p.trim()
         .split(':')[0]     // strip :TYPE annotation
         .replace(/\?$/, '') // strip optional marker
         .trim()
    );
    const snippetParams = params.map((p, i) => `\${${i + 1}:${p}}`).join(', ');
    return `${name}(${snippetParams})$0`;
}

// ── Hover provider ────────────────────────────────────────────────────────────

function makeHoverForFunction(name, idx) {
    const sigs = idx.functions[name];
    if (!sigs || sigs.length === 0) return null;

    const isNative = idx.native.includes(name);
    const md = new vscode.MarkdownString();
    sigs.forEach(sig => md.appendCodeblock(sig, 'everscript'));
    md.appendMarkdown(`\n\n*${isNative ? 'native (compiler built-in)' : 'core library'}*`);
    return new vscode.Hover(md);
}

function makeHoverForEnum(name, idx) {
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

function makeHoverForMember(word, enumName, idx) {
    const members = idx.enums[enumName];
    if (!members) return null;
    const member = members.find(m => m.name === word);
    if (!member) return null;

    const md = new vscode.MarkdownString();
    md.appendCodeblock(`${enumName}.${member.name} = ${member.value}`, 'everscript');
    if (member.comment) md.appendMarkdown(`\n\n${member.comment}`);
    return new vscode.Hover(md);
}

function makeHoverForSpecial(word, idx) {
    const desc = idx.specials[word];
    if (!desc) return null;
    return new vscode.Hover(new vscode.MarkdownString(desc));
}

// ── Number literal hover ──────────────────────────────────────────────────────

function numberAt(document, position) {
    const range = document.getWordRangeAtPosition(
        position,
        /0[xX][0-9a-fA-F]+|0[dD]\d+|0[bB][01]+/
    );
    if (!range) return null;
    return { text: document.getText(range), range };
}

function makeHoverForNumber(text) {
    let value, base, rawDigits;
    if (/^0[xX]/.test(text)) {
        rawDigits = text.slice(2);
        value = parseInt(rawDigits, 16);
        base = 16;
    } else if (/^0[dD]/.test(text)) {
        rawDigits = text.slice(2);
        value = parseInt(rawDigits, 10);
        base = 10;
    } else if (/^0[bB]/.test(text)) {
        rawDigits = text.slice(2);
        value = parseInt(rawDigits, 2);
        base = 2;
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

    const lines = [];
    if (base !== 16) lines.push(`hex:     0x${hexStr}`);
    if (base !== 10) lines.push(`decimal: ${value}`);
    if (base !== 2)  lines.push(`binary:  0b${binStr}`);
    lines.push(`size:    ${byteLabel}`);

    const md = new vscode.MarkdownString();
    md.appendCodeblock(lines.join('\n'), 'text');
    return new vscode.Hover(md);
}

// ── Reverse enum member lookup ────────────────────────────────────────────────

let _reverseMemberMap = null;

function buildReverseMemberMap(idx) {
    if (_reverseMemberMap) return _reverseMemberMap;
    _reverseMemberMap = new Map();
    for (const [enumName, members] of Object.entries(idx.enums)) {
        for (const m of members) {
            if (!_reverseMemberMap.has(m.name)) _reverseMemberMap.set(m.name, []);
            _reverseMemberMap.get(m.name).push({ enumName, value: m.value, comment: m.comment });
        }
    }
    return _reverseMemberMap;
}

function makeHoverForUnqualifiedMember(word, idx) {
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
    // Show full parent enum when unambiguous
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

function provideHover(document, position, idx) {
    // 0. Number literal — check before word-based hover
    const numHit = numberAt(document, position);
    if (numHit) return makeHoverForNumber(numHit.text);

    const hit = wordAt(document, position);
    if (!hit) return null;
    const { word, range } = hit;

    // 1. Suppress hover when cursor is on the declaration name itself
    //    e.g. "fun entrance(...)" or "enum entrance {" — don't show function tooltip
    const lineText  = document.lineAt(position.line).text.trimStart();
    const declMatch = lineText.match(/^(fun|enum|map|area|group|val)\s+(\w+)/);
    if (declMatch && declMatch[2] === word) return null;

    // 2. Suppress function/enum hover when word is a memory accessor: object[...]
    const charAfterWord = document.getText(
        new vscode.Range(range.end, range.end.translate(0, 1))
    );
    const isAccessor = charAfterWord === '[';

    // 3. Qualified enum member access: ENUM.MEMBER
    const enumName = enumNameBeforeDot(document, position, range);
    if (enumName) {
        return makeHoverForMember(word, enumName, idx)
            || makeHoverForUnqualifiedMember(word, idx)
            || makeHoverForSpecial(word, idx);
    }

    // 4. Enum name (not when used as accessor)
    if (!isAccessor) {
        const enumHover = makeHoverForEnum(word, idx);
        if (enumHover) return enumHover;
    }

    // 5. Function name (not when used as accessor)
    if (!isAccessor) {
        const fnHover = makeHoverForFunction(word, idx);
        if (fnHover) return fnHover;
    }

    // 6. Special identifier (BOY, LAST_ENTITY, True, …)
    const specialHover = makeHoverForSpecial(word, idx);
    if (specialHover) return specialHover;

    // 7. Unqualified enum member (SOUTH, ACT4_DOOR_OPENING, etc.)
    if (/^[A-Z_][A-Z0-9_]*$/.test(word)) {
        return makeHoverForUnqualifiedMember(word, idx);
    }

    return null;
}

// ── Document symbol provider ──────────────────────────────────────────────────

const SYMBOL_RULES = [
    { re: /^fun\s+(\w+)\s*\(([^)]*)\)/,  kind: vscode.SymbolKind.Function },
    { re: /^map\s+(\w+)\s*\(/,            kind: vscode.SymbolKind.Module   },
    { re: /^area\s+(\w+)\s*\(/,           kind: vscode.SymbolKind.Module   },
    { re: /^group\s+(\w+)\s*\(/,          kind: vscode.SymbolKind.Package  },
    { re: /^enum\s+(\w+)\s*\{/,           kind: vscode.SymbolKind.Enum     },
    { re: /^val\s+(\w+)\s*=/,             kind: vscode.SymbolKind.Constant },
];

function provideDocumentSymbols(document) {
    const symbols = [];

    for (let i = 0; i < document.lineCount; i++) {
        const line = document.lineAt(i);
        const text = line.text.trimStart();

        for (const { re, kind } of SYMBOL_RULES) {
            const m = re.exec(text);
            if (!m) continue;

            const name   = m[1];
            const detail = m[2] !== undefined ? `(${m[2]})` : '';
            symbols.push(new vscode.DocumentSymbol(name, detail, kind, line.range, line.range));
            break;
        }
    }

    return symbols;
}

// ── Dead branch detection ────────────────────────────────────────────────────

let _deadDecorationType = null;

function getDeadDecorationType() {
    if (!_deadDecorationType) {
        _deadDecorationType = vscode.window.createTextEditorDecorationType({
            opacity: '0.35',
        });
    }
    return _deadDecorationType;
}

/**
 * Return true if the if-condition is statically dead (the then-block will
 * never execute).  Handles: False/True literals, 0/1, and ENUM.MEMBER lookups.
 */
function isStaticallyDead(condition, negated, idx) {
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
 * Find the inner range of a { } block starting at or after `fromLine`.
 * Simple brace-counting; skips line comments.
 */
function findBlockRange(document, fromLine) {
    let depth      = 0;
    let blockStart = null;
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

function updateDeadBranchDecorations(editor, idx) {
    if (!editor || editor.document.languageId !== 'everscript') return;
    const doc    = editor.document;
    const ranges = [];
    for (let i = 0; i < doc.lineCount; i++) {
        const m = IF_DEAD_RE.exec(doc.lineAt(i).text);
        if (!m) continue;
        if (!isStaticallyDead(m[2], m[1] === '!', idx)) continue;
        const block = findBlockRange(doc, i);
        if (block) ranges.push(block);
    }
    editor.setDecorations(getDeadDecorationType(), ranges);
}

// ── Completion provider ───────────────────────────────────────────────────────

function provideCompletionItems(document, position, idx) {
    const line   = document.lineAt(position).text;
    const prefix = line.substring(0, position.character);

    // @annotation — suggest annotation names
    const atMatch = prefix.match(/@(\w*)$/);
    if (atMatch) {
        return idx.annotations.map(name => {
            const item = new vscode.CompletionItem(name, vscode.CompletionItemKind.Keyword);
            item.insertText = new vscode.SnippetString(`${name}($0)`);
            item.detail = `@${name} annotation`;
            return item;
        });
    }

    // ENUM.member — suggest members of the enum
    const dotMatch = prefix.match(/([A-Z_][A-Z0-9_]*)\.(\w*)$/);
    if (dotMatch) {
        const enumName = dotMatch[1];
        const members  = idx.enums[enumName];
        if (!members || members.length === 0) return [];

        return members.map(m => {
            const item = new vscode.CompletionItem(m.name, vscode.CompletionItemKind.EnumMember);
            item.detail      = `${enumName}.${m.name} = ${m.value}`;
            item.filterText  = m.name;
            if (m.comment) {
                item.documentation = new vscode.MarkdownString(m.comment);
            }
            return item;
        });
    }

    // Bare identifier — offer function + enum name completions
    if (/[a-zA-Z_]\w*$/.test(prefix)) {
        return [...getFunctionCompletions(idx), ...getWorkspaceFunctionCompletions(), ...getEnumNameCompletions(idx)];
    }

    return [];
}

/** Build function completion items from static index (cached). */
let _fnCompletions = null;
function getFunctionCompletions(idx) {
    if (_fnCompletions) return _fnCompletions;
    _fnCompletions = Object.entries(idx.functions).map(([name, sigs]) => {
        const sig  = sigs[0] || name;
        const item = new vscode.CompletionItem(name, vscode.CompletionItemKind.Function);
        item.insertText    = new vscode.SnippetString(sigToSnippet(sig));
        item.detail        = sig;
        item.documentation = new vscode.MarkdownString(
            idx.native.includes(name) ? '*native (compiler built-in)*' : '*core library*'
        );
        item.sortText = '~' + name;
        return item;
    });
    return _fnCompletions;
}

/** Workspace-defined functions (rebuilt from live index each time). */
function getWorkspaceFunctionCompletions() {
    const items = [];
    for (const [name, entries] of _workspaceIndex.entries()) {
        const funs = entries.filter(e => e.kind === 'fun');
        if (funs.length === 0) continue;
        const item = new vscode.CompletionItem(name, vscode.CompletionItemKind.Function);
        item.detail   = funs.map(e => vscode.workspace.asRelativePath(e.uri)).join(', ');
        item.sortText = '~' + name;
        items.push(item);
    }
    return items;
}

/** Enum name completions (cached). */
let _enumCompletions = null;
function getEnumNameCompletions(idx) {
    if (_enumCompletions) return _enumCompletions;
    _enumCompletions = Object.keys(idx.enums).map(name => {
        const item = new vscode.CompletionItem(name, vscode.CompletionItemKind.Enum);
        item.detail   = `enum ${name}`;
        item.sortText = '~~' + name;
        return item;
    });
    return _enumCompletions;
}

// ── Definition provider ───────────────────────────────────────────────────────

async function provideDefinition(document, position) {
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

    const entries = _workspaceIndex.get(hit.word);
    if (!entries || entries.length === 0) return null;

    return entries.map(e => new vscode.Location(e.uri, new vscode.Position(e.line, 0)));
}

// ── Reference provider ────────────────────────────────────────────────────────

async function provideReferences(document, position) {
    const hit = wordAt(document, position);
    if (!hit) return null;
    const { word } = hit;

    // Only search lowercase/mixed names (function and variable calls, not enum types)
    if (!/[a-z]/.test(word)) return null;

    const files    = await vscode.workspace.findFiles('**/*.evs', '**/node_modules/**');
    const re       = new RegExp(`\\b${escapeRegex(word)}\\b`, 'g');
    const locations = [];

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

// ── Memory Radar ─────────────────────────────────────────────────────────────

const RADAR_BIT_ALLOC_FUNCS = new Set(['_loot_chest', '_loot', 'loot', 'retained_object']);

class RadarCodeLensProvider {
    provideCodeLenses(document) {
        if (document.languageId !== 'everscript') return [];
        const declRe = /^\s*(fun|map|area|group)\s+([A-Za-z_][A-Za-z0-9_]*)\b/;
        const lenses = [];
        for (let i = 0; i < document.lineCount; i++) {
            if (!declRe.test(document.lineAt(i).text)) continue;
            lenses.push(new vscode.CodeLens(document.lineAt(i).range, {
                title: '◉ Memory Radar',
                command: 'everscript.openMemoryRadar',
                arguments: [document, i],
            }));
        }
        return lenses;
    }
}

function radarDetectScope(document, cursorLine) {
    const declRe = /^\s*(fun|map|area|group)\s+([A-Za-z_][A-Za-z0-9_]*)\b/;
    for (let line = cursorLine; line >= 0; line--) {
        const m = declRe.exec(document.lineAt(line).text);
        if (!m) continue;
        const ob = radarFindOpenBrace(document, line);
        if (ob === -1) return { kind: m[1], name: m[2], startLine: line, endLine: line };
        const cb = radarFindCloseBrace(document, ob);
        return { kind: m[1], name: m[2], startLine: line, endLine: cb === -1 ? document.lineCount - 1 : cb };
    }
    return { kind: 'global', name: 'global', startLine: 0, endLine: document.lineCount - 1 };
}

function radarFindOpenBrace(document, fromLine) {
    for (let l = fromLine; l < Math.min(fromLine + 10, document.lineCount); l++) {
        if (document.lineAt(l).text.includes('{')) return l;
    }
    return -1;
}

function radarFindCloseBrace(document, ob) {
    let depth = 0;
    for (let l = ob; l < document.lineCount; l++) {
        for (const ch of document.lineAt(l).text.replace(/\/\/.*$/, '')) {
            if (ch === '{') depth++;
            else if (ch === '}') { depth--; if (depth === 0) return l; }
        }
    }
    return -1;
}

function radarAnalyzeScope(document, startLine, endLine) {
    // Map<addr, { lines: number[], sources: string[] }>
    const refs = new Map();
    const add = (addr, line, source) => {
        if (!refs.has(addr)) refs.set(addr, { lines: [], sources: [] });
        const r = refs.get(addr);
        if (!r.lines.includes(line)) r.lines.push(line);
        if (!r.sources.includes(source)) r.sources.push(source);
    };
    for (let i = startLine; i <= endLine; i++) {
        const text = document.lineAt(i).text;
        // memory(0xADDR, ...) — absolute WRAM address
        for (const m of text.matchAll(/\bmemory\s*\(\s*(0x[0-9a-fA-F]+)/g)) {
            const a = parseInt(m[1], 16);
            if (!isNaN(a)) add(a, i, 'memory()');
        }
        // <0xADDR> or <0xADDR, 0xMASK> raw dereference
        for (const m of text.matchAll(/<\s*(0x[0-9a-fA-F]+)/g)) {
            const a = parseInt(m[1], 16);
            if (!isNaN(a)) add(a, i, '<deref>');
        }
        // Known bit-allocator helpers: _loot_chest(0xADDR, 0xBIT)
        for (const m of text.matchAll(/\b([A-Za-z_][A-Za-z0-9_]*)\s*\(([^)]*)\)/g)) {
            if (!RADAR_BIT_ALLOC_FUNCS.has(m[1])) continue;
            const xs = [...m[2].matchAll(/0x[0-9a-fA-F]+/g)];
            if (xs.length) { const a = parseInt(xs[0][0], 16); if (!isNaN(a)) add(a, i, m[1]); }
        }
    }
    return refs;
}

function radarReadMemoryMap(filePath) {
    const map = new Map();
    if (!fs.existsSync(filePath)) return map;
    for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
        if (!line.startsWith('|')) continue;
        const cells = line.split('|').map(c => c.trim()).filter(Boolean);
        if (cells.length < 3) continue;
        // Match: 0xADDR or 0xSTART…0xEND
        const m = cells[0].match(/0x([0-9a-fA-F]{4})(?:[^0-9a-fA-F]*0x([0-9a-fA-F]{4}))?/);
        if (!m) continue;
        const start = parseInt(m[1], 16), end = m[2] ? parseInt(m[2], 16) : start;
        const entry = { name: cells[1], type: cells[2] || '', notes: cells[3] || '', lifecycle: '' };
        entry.lifecycle = radarLifecycle(start, entry.type, entry.notes);
        for (let a = start; a <= end; a++) if (!map.has(a)) map.set(a, entry);
    }
    return map;
}

function radarLifecycle(addr, type, notes) {
    if ((type + ' ' + notes).toLowerCase().includes('sram')) return 'sram';
    return addr < 0x2000 ? 'temp' : 'session';
}

function radarEsc(s) {
    return String(s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function radarH(n) { return '0x' + n.toString(16).toUpperCase().padStart(4, '0'); }

function renderRadarHtml(scope, refs, mapByAddr) {
    const COLS = 16;
    const allAddrs = [...mapByAddr.keys(), ...refs.keys()];
    const rowStart = allAddrs.length ? (Math.min(...allAddrs) & ~(COLS - 1)) : 0;
    const rowEnd   = allAddrs.length ? ((Math.max(...allAddrs) | (COLS - 1)) + 1) : COLS;

    const count = (lc) => [...mapByAddr.values()].filter(e => e.lifecycle === lc).length;
    const used  = (lc) => [...refs.keys()].filter(a => mapByAddr.get(a)?.lifecycle === lc).length;
    const tempT = count('temp'), sessT = count('session'), sramT = count('sram');
    const tempU = used('temp'),  sessU = used('session'),  sramU = used('sram');

    const bar = (u, t, lc) => {
        const p = t ? Math.round(u / t * 100) : 0;
        const w = Math.max(p, u > 0 ? 1 : 0);
        return '<div class="bo"><div class="bi bi-' + lc + '" style="width:' + w + '%"></div></div>' +
               '<span class="bl">' + u + '/' + t + ' (' + p + '%)</span>';
    };

    // Build grid
    let gridHtml = '';
    for (let base = rowStart; base < rowEnd; base += COLS) {
        let cells = '', allRest = true;
        for (let col = 0; col < COLS; col++) {
            const addr = base + col;
            const me = mapByAddr.get(addr);
            const usage = refs.get(addr);
            const lc = me ? me.lifecycle : radarLifecycle(addr, '', '');
            const isUsed = !!usage;
            const isRest = !me && !isUsed;
            if (!isRest) allRest = false;
            let tt = radarH(addr);
            if (me) {
                tt += ': ' + me.name + ' [' + me.type + ']';
                if (me.notes) tt += '&#10;' + radarEsc(me.notes);
            }
            if (usage) tt += '&#10;Lines: ' + usage.lines.map(l => l + 1).join(', ');
            cells += '<span class="cell lc-' + lc + (isUsed ? ' cu' : '') + (isRest ? ' cr' : '') +
                     '" data-addr="' + addr + '" title="' + tt + '"></span>';
        }
        gridHtml += '<div class="gr' + (allRest ? ' gar' : '') + '">' +
                    '<span class="rl">' + radarH(base) + '</span>' + cells + '</div>';
    }

    // Build detail table (one row per unique memory-map entry)
    const seen = new Set();
    const detailRows = [...mapByAddr.entries()]
        .sort((a, b) => a[0] - b[0])
        .filter(([, e]) => { if (seen.has(e)) return false; seen.add(e); return true; })
        .map(([addr, e]) => {
            const usage = refs.get(addr);
            const links = usage
                ? usage.lines.map(l => '<a class="ll" data-line="' + l + '">' + (l + 1) + '</a>').join(' ')
                : '&ndash;';
            return '<tr id="dr-' + addr + '" class="lc-' + e.lifecycle + (usage ? ' du' : '') + '">' +
                   '<td class="mo">' + radarH(addr) + '</td>' +
                   '<td>' + radarEsc(e.name) + '</td>' +
                   '<td>' + radarEsc(e.type) + '</td>' +
                   '<td><span class="chip ch-' + e.lifecycle + '">' + e.lifecycle + '</span></td>' +
                   '<td>' + links + '</td>' +
                   '<td class="nt">' + radarEsc(e.notes) + '</td></tr>';
        }).join('');

    const css = [
        '*{box-sizing:border-box;margin:0;padding:0}',
        'body{font:11px/1.4 "SF Mono","Cascadia Code",monospace;',
        'background:var(--vscode-editor-background);color:var(--vscode-editor-foreground);',
        'padding:8px 10px;min-width:200px}',
        'h2{font-size:10px;text-transform:uppercase;letter-spacing:.08em;opacity:.4;margin:10px 0 3px;font-weight:600}',
        '.sh{font-size:13px;font-weight:600;margin-bottom:3px}',
        '.sm{opacity:.5;font-size:10px;margin-bottom:8px}',
        /* filters */
        '.filters{display:flex;flex-wrap:wrap;gap:4px;margin-bottom:8px}',
        '.fb{border:1px solid #444;border-radius:10px;padding:1px 8px;cursor:pointer;',
        'font-size:10px;background:transparent;color:inherit;opacity:.45}',
        '.fb.on{opacity:1}',
        '.fb.ft{color:#6cb6ff}.fb.fs{color:#ffa94d}.fb.fr2{color:#56d364}.fb.fr{color:#666}',
        /* usage bars */
        '.sr{display:flex;align-items:center;gap:6px;margin-bottom:3px;font-size:10px}',
        '.sl{width:46px;opacity:.55;flex-shrink:0}',
        '.bo{flex:1;height:5px;background:#222;border-radius:3px;max-width:90px;overflow:hidden}',
        '.bi{height:100%;border-radius:3px;min-width:1px}',
        '.bi-temp{background:#388bfd}.bi-session{background:#ffa94d}.bi-sram{background:#3fb950}',
        '.bl{font-size:10px;opacity:.5;white-space:nowrap}',
        /* grid */
        '.gw{margin:4px 0;overflow-x:auto}',
        '.gr{display:flex;align-items:center;gap:1px;margin-bottom:1px}',
        '.rl{font-size:8px;opacity:.28;width:36px;flex-shrink:0;user-select:none;letter-spacing:-.02em}',
        '.cell{display:inline-block;width:9px;height:9px;border-radius:1px;background:#111;flex-shrink:0;cursor:pointer}',
        '.cell:hover{outline:1px solid rgba(255,255,255,.55);position:relative;z-index:1}',
        '.lc-temp{background:#1a3a5c}.lc-session{background:#3a2500}.lc-sram{background:#0d2d0d}',
        '.cu.lc-temp{background:#388bfd}.cu.lc-session{background:#ffa94d}.cu.lc-sram{background:#3fb950}',
        '.cr{background:#111!important;opacity:.15}',
        /* lifecycle filter states */
        'body.ht .cell.lc-temp{background:#0d0d0d;opacity:.08}',
        'body.hs .cell.lc-session{background:#0d0d0d;opacity:.08}',
        'body.hr2 .cell.lc-sram{background:#0d0d0d;opacity:.08}',
        'body.hr .gar{display:none}',
        /* detail table */
        'table{width:100%;border-collapse:collapse;font-size:10px;margin-top:3px}',
        'th,td{border:1px solid #222;padding:2px 5px;vertical-align:top}',
        'th{background:#161616;position:sticky;top:0;font-weight:600;text-align:left}',
        'tr:hover td{background:rgba(255,255,255,.03)}',
        '.lc-temp td:first-child{border-left:2px solid #388bfd}',
        '.lc-session.du td:first-child{border-left:2px solid #ffa94d}',
        '.lc-sram.du td:first-child{border-left:2px solid #3fb950}',
        '.mo{font-family:inherit}.nt{max-width:150px;word-break:break-word;opacity:.45;font-size:9px}',
        '.chip{border-radius:7px;padding:0 4px;font-size:9px;border:1px solid transparent}',
        '.ch-temp{border-color:#388bfd;color:#6cb6ff}',
        '.ch-session{border-color:#ffa94d;color:#ffa94d}',
        '.ch-sram{border-color:#3fb950;color:#56d364}',
        'a.ll{color:#6cb6ff;cursor:pointer;text-decoration:none;margin:0 1px}',
        'a.ll:hover{text-decoration:underline}',
        '.hl td{background:rgba(255,200,50,.09)!important}',
    ].join('');

    const js = [
        '(function(){',
        'var vscode=typeof acquireVsCodeApi==="function"?acquireVsCodeApi():null;',
        // filter buttons
        'document.querySelectorAll(".fb").forEach(function(b){',
        '  b.addEventListener("click",function(){',
        '    b.classList.toggle("on");',
        '    var on=b.classList.contains("on");',
        '    document.body.classList.toggle(b.dataset.cls,!on);',
        '  });',
        '});',
        // cell click → scroll to detail row
        'document.querySelectorAll(".cell").forEach(function(c){',
        '  c.addEventListener("click",function(){',
        '    var row=document.getElementById("dr-"+c.dataset.addr);',
        '    if(!row)return;',
        '    document.querySelectorAll(".hl").forEach(function(r){r.classList.remove("hl")});',
        '    row.classList.add("hl");',
        '    row.scrollIntoView({behavior:"smooth",block:"center"});',
        '    setTimeout(function(){row.classList.remove("hl")},2500);',
        '  });',
        '});',
        // line links → navigate in editor
        'document.querySelectorAll(".ll").forEach(function(a){',
        '  a.addEventListener("click",function(e){',
        '    e.preventDefault();',
        '    if(vscode)vscode.postMessage({command:"goToLine",line:parseInt(a.dataset.line)});',
        '  });',
        '});',
        '})();',
    ].join('');

    return '<!doctype html><html><head><meta charset="utf-8"><style>' + css + '</style></head>' +
        '<body class="hr">' +
        '<div class="sh">&#9679; Memory Radar</div>' +
        '<div class="sm">Scope: <strong>' + radarEsc(scope.kind) + ' ' + radarEsc(scope.name) +
        '</strong> | Lines: ' + (scope.startLine + 1) + '&ndash;' + (scope.endLine + 1) + '</div>' +
        '<div class="filters">' +
        '<button class="fb ft on" data-cls="ht">temp</button>' +
        '<button class="fb fs on" data-cls="hs">session</button>' +
        '<button class="fb fr2 on" data-cls="hr2">sram</button>' +
        '<button class="fb fr" data-cls="hr">rest</button>' +
        '</div>' +
        '<h2>Region Usage</h2>' +
        '<div class="sr"><span class="sl">temp</span>' + bar(tempU, tempT, 'temp') + '</div>' +
        '<div class="sr"><span class="sl">session</span>' + bar(sessU, sessT, 'session') + '</div>' +
        '<div class="sr"><span class="sl">sram</span>' + bar(sramU, sramT, 'sram') + '</div>' +
        '<h2>WRAM ' + radarH(rowStart) + '&ndash;' + radarH(rowEnd - 1) + '</h2>' +
        '<div class="gw">' + gridHtml + '</div>' +
        '<h2>Known Addresses</h2>' +
        '<table><thead><tr><th>Addr</th><th>Name</th><th>Type</th><th>Region</th><th>Lines</th><th>Notes</th></tr></thead>' +
        '<tbody>' + detailRows + '</tbody></table>' +
        '<script>' + js + '<\/script>' +
        '</body></html>';
}

// ── Activation ────────────────────────────────────────────────────────────────

function activate(context) {
    const idx = loadIndex(context);

    // Build workspace index on activation; keep it fresh on file changes
    buildWorkspaceIndex();
    const watcher = vscode.workspace.createFileSystemWatcher('**/*.evs');
    watcher.onDidChange(() => buildWorkspaceIndex());
    watcher.onDidCreate(() => buildWorkspaceIndex());
    watcher.onDidDelete(() => buildWorkspaceIndex());
    context.subscriptions.push(watcher);

    // Dead branch decorations
    const applyDeadBranches = (editor) => updateDeadBranchDecorations(editor, idx);
    applyDeadBranches(vscode.window.activeTextEditor);
    context.subscriptions.push(
        vscode.window.onDidChangeActiveTextEditor(applyDeadBranches),
        vscode.workspace.onDidChangeTextDocument(e => {
            const ed = vscode.window.activeTextEditor;
            if (ed && e.document === ed.document) applyDeadBranches(ed);
        }),
    );

    context.subscriptions.push(

        vscode.languages.registerHoverProvider('everscript', {
            provideHover: (doc, pos) => provideHover(doc, pos, idx),
        }),

        vscode.languages.registerDocumentSymbolProvider('everscript', {
            provideDocumentSymbols,
        }),

        vscode.languages.registerCompletionItemProvider(
            'everscript',
            { provideCompletionItems: (doc, pos) => provideCompletionItems(doc, pos, idx) },
            '.', '@',
        ),

        vscode.languages.registerDefinitionProvider('everscript', {
            provideDefinition: (doc, pos) => provideDefinition(doc, pos),
        }),

        vscode.languages.registerReferenceProvider('everscript', {
            provideReferences: (doc, pos) => provideReferences(doc, pos),
        }),

        vscode.languages.registerCodeLensProvider(
            { language: 'everscript' },
            new RadarCodeLensProvider(),
        ),

        // Memory Radar command — opens a scope-aware WRAM visualizer beside the editor.
        // Triggered via: right-click → "Open Memory Radar", or the ◉ CodeLens above fun/map/area/group.
        vscode.commands.registerCommand('everscript.openMemoryRadar', async (doc, startLine) => {
            const editor  = vscode.window.activeTextEditor;
            const document = (doc && typeof doc.lineCount === 'number') ? doc : editor?.document;
            if (!document) {
                vscode.window.showWarningMessage('No active Everscript file.');
                return;
            }
            const cursorLine = typeof startLine === 'number' ? startLine : (editor?.selection.active.line ?? 0);
            const wf = vscode.workspace.getWorkspaceFolder(document.uri);

            const scope      = radarDetectScope(document, cursorLine);
            const refs       = radarAnalyzeScope(document, scope.startLine, scope.endLine);
            const mapPath    = wf ? path.join(wf.uri.fsPath, '.github', 'memory-map.md') : '';
            const mapByAddr  = radarReadMemoryMap(mapPath);

            const panel = vscode.window.createWebviewPanel(
                'everscriptRadar',
                'Radar: ' + scope.name,
                vscode.ViewColumn.Beside,
                { enableScripts: true, retainContextWhenHidden: true },
            );

            panel.webview.html = renderRadarHtml(scope, refs, mapByAddr);

            // Handle "go to line" messages from the webview
            panel.webview.onDidReceiveMessage(msg => {
                if (msg.command !== 'goToLine') return;
                const line = Math.max(0, Math.min(Number(msg.line), document.lineCount - 1));
                const pos  = new vscode.Position(line, 0);
                const range = new vscode.Range(pos, pos);
                const ed = vscode.window.visibleTextEditors.find(e => e.document === document)
                        || vscode.window.activeTextEditor;
                if (ed) {
                    ed.selection = new vscode.Selection(pos, pos);
                    ed.revealRange(range, vscode.TextEditorRevealType.InCenterIfOutsideViewport);
                    vscode.window.showTextDocument(ed.document, ed.viewColumn);
                }
            }, undefined, context.subscriptions);
        }),

    );
}

function deactivate() {}

module.exports = { activate, deactivate };
