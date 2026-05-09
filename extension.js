'use strict';

const vscode = require('vscode');
const path   = require('path');
const fs     = require('fs');
const { radarLifecycle, radarH, radarEsc, radarExtractEmoji, radarParseName, radarParseNotes, parseEvsNum } = require('./radar-utils');

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

    const md = new vscode.MarkdownString(undefined, true);
    md.isTrusted = true;
    md.appendCodeblock(lines.join('\n'), 'text');
    // Memory map lookup for WRAM addresses
    if (value >= 0 && value <= 0xFFFF) {
        const me = getRadarMap().get(value);
        if (me) {
            md.appendMarkdown('\n\n**' + me.name + '** `' + me.lifecycle + '`');
            if (me.type) md.appendMarkdown(' — ' + me.type.replace(/</g, '&lt;'));
            if (me.notes) md.appendMarkdown('\n\n' + me.notes.replace(/</g, '&lt;').replace(/>/g, '&gt;'));
            md.appendMarkdown('\n\n[$(list-selection) Open Memory Radar](command:everscript.openMemoryRadar)');
        }
    }
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
// Region boundaries (from compiler/ast_everscript.py + core/[group] 00_general_enums/02_ram.evs):
//   temp    0x2800–0x28FF  compiler type "28" — cleared on room load, scratch vars
//   session 0x2200–0x27FF  compiler type "22" — persistent across rooms
//   sram    varies         explicitly tagged [SRAM] in memory map
//   system  everything else (0x0000–0x21FF engine/HW, 0x2900+)

// Note: _loot_chest/_loot/loot/retained_object are dynamically allocated from the
// compiler memory pool — addresses cannot be statically inferred from call sites.

let _radarPanel        = null;   // active radar webview panel
let _radarPinned       = false;  // when true, radar ignores editor/scope changes
let _radarDoc          = null;   // document the radar was last rendered for
let _radarCurrentScope = null;   // scope the radar was last rendered for
let _radarMapCache     = null;   // cached parsed memory-map.md
let _radarUpdateTimer  = null;   // debounce timer for auto-update
let _radarRoomTree     = null;   // cached room tree (rebuilt when doc changes)
let _radarRoomDocPath  = null;   // fsPath the room tree was built for
let _radarActiveTab    = 'radar'; // preserved tab across re-renders

function getRadarMap() {
    if (_radarMapCache) return _radarMapCache;
    const wf = vscode.workspace.workspaceFolders?.[0];
    if (!wf) return new Map();
    _radarMapCache = radarReadMemoryMap(path.join(wf.uri.fsPath, '.github', 'memory-map.md'));
    return _radarMapCache;
}

function invalidateRadarMap() { _radarMapCache = null; }

function refreshRadar(editor) {
    if (!_radarPanel || _radarPinned) return;
    if (!editor || editor.document.languageId !== 'everscript') return;
    const doc   = editor.document;
    const line  = editor.selection?.active?.line ?? 0;
    const scope = radarDetectScope(doc, line);
    if (_radarCurrentScope && _radarDoc === doc &&
        scope.name === _radarCurrentScope.name && scope.kind === _radarCurrentScope.kind) return;
    _radarCurrentScope = scope;
    _radarDoc = doc;
    const { refs, pools } = radarAnalyzeScope(doc, scope.startLine, scope.endLine);
    const mapByAddr = getRadarMap();
    // Reuse cached room tree (same doc); it was built with webview URIs on panel open
    const roomTree = (_radarRoomDocPath === doc.uri.fsPath) ? (_radarRoomTree || []) : [];
    const selectedMap = scope.kind === 'map' ? scope.name : null;
    _radarPanel.webview.html = renderRadarHtml(scope, refs, pools, mapByAddr, roomTree, _radarActiveTab, selectedMap);
    _radarPanel.title = 'Radar: ' + scope.name;
}

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
    // refs: Map<addr, { reads: [{line,text}], writes: [{line,text}], sources: [] }>
    // pools: [{start, end, line, lc}] — declared <0xS>..<0xE> pool ranges
    const refs = new Map();
    const pools = [];

    const add = (addr, line, rawText, source, isWrite) => {
        if (!refs.has(addr)) refs.set(addr, { reads: [], writes: [], sources: [] });
        const r = refs.get(addr);
        const entry = { line, text: rawText.trim() };
        if (isWrite) { if (!r.writes.some(x => x.line === line)) r.writes.push(entry); }
        else         { if (!r.reads.some(x => x.line === line))  r.reads.push(entry); }
        if (!r.sources.includes(source)) r.sources.push(source);
    };
    const isWrite = (text, hexLit) => {
        const h = hexLit.replace(/^0x/i, '');
        return new RegExp('<\\s*0x' + h + '[^>]*>\\s*(?:[+\\-*\\/&|^]|<<|>>)?=(?!=)', 'i').test(text) ||
               new RegExp('memory\\s*\\(\\s*0x' + h + '[^)]*\\)\\s*(?:[+\\-*\\/&|^]|<<|>>)?=(?!=)', 'i').test(text);
    };

    // Pass 1: scan full document for pool declarations (not just the scope range)
    const seenPools = new Set();
    const addPool = (ps, pe, lineIdx) => {
        if (isNaN(ps) || isNaN(pe) || ps > pe) return;
        const key = ps + '-' + pe;
        if (seenPools.has(key)) return;
        seenPools.add(key);
        pools.push({ start: ps, end: pe, line: lineIdx, lc: radarLifecycle(ps, '', '') });
    };
    for (let i = 0; i < document.lineCount; i++) {
        const text = document.lineAt(i).text.replace(/\/\/.*$/, '');
        const poolM = text.match(/<\s*(0x[0-9a-fA-F]+)\s*>\s*\.\.\s*<\s*(0x[0-9a-fA-F]+)\s*>/);
        if (poolM) addPool(parseInt(poolM[1], 16), parseInt(poolM[2], 16), i);
    }
    // Also check main.evs in same folder (imports pool declarations from linker)
    const docDir = path.dirname(document.uri.fsPath);
    const mainEvsPath = path.join(docDir, 'main.evs');
    if (mainEvsPath !== document.uri.fsPath && fs.existsSync(mainEvsPath)) {
        const mainLines = fs.readFileSync(mainEvsPath, 'utf8').split(/\r?\n/);
        for (let i = 0; i < mainLines.length; i++) {
            const text = mainLines[i].replace(/\/\/.*$/, '');
            const poolM = text.match(/<\s*(0x[0-9a-fA-F]+)\s*>\s*\.\.\s*<\s*(0x[0-9a-fA-F]+)\s*>/);
            if (poolM) addPool(parseInt(poolM[1], 16), parseInt(poolM[2], 16), i);
        }
    }

    // Pass 2: scan scope for address references
    for (let i = startLine; i <= endLine; i++) {
        const rawText = document.lineAt(i).text;
        const text    = rawText.replace(/\/\/.*$/, '');

        // Skip pool declarations (already handled in pass 1)
        if (/<\s*0x[0-9a-fA-F]+\s*>\s*\.\.\s*</.test(text)) continue;

        for (const m of text.matchAll(/\bmemory\s*\(\s*(0x[0-9a-fA-F]+)/g)) {
            const a = parseInt(m[1], 16);
            if (!isNaN(a)) add(a, i, rawText, 'memory()', isWrite(text, m[1]));
        }
        for (const m of text.matchAll(/<\s*(0x[0-9a-fA-F]+)/g)) {
            const a = parseInt(m[1], 16);
            if (!isNaN(a)) add(a, i, rawText, '<deref>', isWrite(text, m[1]));
        }
    }
    return { refs, pools };
}

function radarReadMemoryMap(filePath) {
    const map = new Map();
    if (!fs.existsSync(filePath)) return map;
    for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
        if (!line.startsWith('|')) continue;
        const cells = line.split('|').map(c => c.trim()).filter(Boolean);
        if (cells.length < 3) continue;
        const m = cells[0].match(/0x([0-9a-fA-F]{4})(?:[^0-9a-fA-F]*0x([0-9a-fA-F]{4}))?/);
        if (!m) continue;
        const start = parseInt(m[1], 16), end = m[2] ? parseInt(m[2], 16) : start;
        if (start > end) continue; // skip backwards ranges (typos in memory-map.md)
        const rawName = cells[1] || '';
        const nameParts = radarParseName(rawName);
        const name = nameParts[0] || rawName.replace(/<[^>]+>/g, '').trim();
        if (/^\s*\(gap/i.test(name)) continue; // treat gap entries as undocumented addresses
        const notes = radarParseNotes(cells[3] || '');
        const typeStr = cells[2] || '';
        const isWord = /\bWord\b/i.test(typeStr);
        const effectiveEnd = (isWord && end === start) ? start + 1 : end;
        const entry = {
            name, nameParts, type: typeStr, notes,
            lifecycle: radarLifecycle(start, typeStr, notes),
            isWord, addrStart: start, addrEnd: effectiveEnd,
        };
        // Later-starting entries take priority at shared addresses (e.g. overlapping Word entries)
        for (let a = start; a <= effectiveEnd; a++) {
            const ex = map.get(a);
            if (!ex || ex.addrStart < start) map.set(a, entry);
        }
    }
    return map;
}

// radarLifecycle, radarH, radarEsc, radarExtractEmoji, radarParseName, radarParseNotes
// are pure helpers — see radar-utils.js (required at top of file).

// ── Room Browser ─────────────────────────────────────────────────────────────

/**
 * Locate a room image in the workspace.
 * Checks docs/rooms/images/{name}.{ext} and docs/rooms/{name}.{ext}.
 * @returns {string|null} Absolute filesystem path or null.
 */
function findRoomImage(wsRoot, mapName, vanillaId) {
    if (!wsRoot) return null;
    const baseDirs = [
        path.join(wsRoot, 'docs', 'rooms', 'images'),
        path.join(wsRoot, 'docs', 'rooms'),
    ];
    const names = [mapName, vanillaId].filter(Boolean);
    const exts  = ['.png', '.jpg', '.jpeg', '.webp'];
    for (const dir of baseDirs) {
        for (const name of names) {
            for (const ext of exts) {
                const p = path.join(dir, name + ext);
                if (fs.existsSync(p)) return p;
            }
        }
    }
    return null;
}

/**
 * Parse the content of a single map block from a file.
 * @param {string}  filePath  Absolute path to the .evs file.
 * @param {number}  startLine 0-based line of the opening `map NAME(...) {`.
 * @param {number}  endLine   0-based line of the closing `}`.
 * @returns {{initMap, entrances, enemies, objects, transitions}}
 */
function parseRoomContent(filePath, startLine, endLine) {
    let lines;
    try { lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/); }
    catch { return { initMap: null, entrances: [], enemies: [], objects: [], transitions: [] }; }

    const out = { initMap: null, entrances: [], enemies: [], objects: [], transitions: [] };
    const objSeen = new Set();
    const end = Math.min(endLine, lines.length - 1);

    for (let i = startLine; i <= end; i++) {
        const t = lines[i].replace(/\/\/.*$/, '').trim();

        // init_map(x1, y1, x2, y2)
        if (!out.initMap) {
            const m = t.match(/\binit_map\s*\(\s*([^,)]+),\s*([^,)]+),\s*([^,)]+),\s*([^,)]+)\)/);
            if (m) out.initMap = { x1: parseEvsNum(m[1]), y1: parseEvsNum(m[2]), x2: parseEvsNum(m[3]), y2: parseEvsNum(m[4]), line: i };
        }

        // NAME = entrance(x, y, DIR)
        const ent = t.match(/([A-Za-z_]\w*)\s*=\s*entrance\s*\(\s*([^,)]+),\s*([^,)]+),\s*([^,)]+)\)/);
        if (ent) out.entrances.push({ name: ent[1], x: parseEvsNum(ent[2]), y: parseEvsNum(ent[3]), dir: ent[4].trim(), line: i });

        // add_enemy(TYPE, x, y, ...)
        const ae = t.match(/\badd_enemy\s*\(\s*([^,)]+),\s*([^,)]+),\s*([^,)]+)/);
        if (ae && !isNaN(parseEvsNum(ae[2]))) out.enemies.push({ type: ae[1].trim(), x: parseEvsNum(ae[2]), y: parseEvsNum(ae[3]), dynamic: false, line: i });

        // add_basic_souls_enemy(TYPE, x, y) and similar add_*_enemy variants
        const abe = t.match(/\badd_\w*souls\w*_enemy\s*\(\s*([^,)]+),\s*([^,)]+),\s*([^,)]+)\)/);
        if (abe && !isNaN(parseEvsNum(abe[2]))) out.enemies.push({ type: abe[1].trim(), x: parseEvsNum(abe[2]), y: parseEvsNum(abe[3]), dynamic: true, line: i });

        // object[N]
        const obj = t.match(/\bobject\[(\w+)\]/);
        if (obj && !objSeen.has(obj[1])) { objSeen.add(obj[1]); out.objects.push({ index: obj[1], line: i }); }

        // map_transition(target, via, dir)
        const mt = t.match(/\bmap_transition\s*\(\s*([^,)]+),\s*([^,)]+),\s*([^,)]+)\)/);
        if (mt) out.transitions.push({ target: mt[1].trim(), via: mt[2].trim(), dir: mt[3].trim(), line: i });
    }
    return out;
}

/**
 * Walk a directory tree collecting map nodes.
 * [area] subdirs become area nodes; .evs files are scanned for `map` declarations.
 */
function collectRoomsFromDir(dir, wsRoot, depth) {
    if (depth > 8) return [];
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
    catch { return []; }

    const items = [];
    const subAreas = entries.filter(e => e.isDirectory() && e.name.startsWith('[area]')).sort((a, b) => a.name.localeCompare(b.name));
    const files    = entries.filter(e => !e.isDirectory() && e.name.endsWith('.evs') && !e.name.startsWith('_')).sort((a, b) => a.name.localeCompare(b.name));

    for (const sd of subAreas) {
        const areaName = sd.name.replace(/^\[area\]\s*/, '').replace(/^\d+_/, '');
        const children = collectRoomsFromDir(path.join(dir, sd.name), wsRoot, depth + 1);
        if (children.length) items.push({ name: areaName, kind: 'area', children });
    }

    for (const f of files) {
        const fp = path.join(dir, f.name);
        let text;
        try { text = fs.readFileSync(fp, 'utf8'); } catch { continue; }
        const lines  = text.split(/\r?\n/);
        const mapRe  = /^\s*map\s+([A-Za-z_][A-Za-z0-9_]*)\s*(?:\(\s*([^)]*?)\s*\))?\s*\{/;
        for (let i = 0; i < lines.length; i++) {
            const m = mapRe.exec(lines[i]);
            if (!m) continue;
            let d = 0, endLine = i;
            for (let j = i; j < lines.length; j++) {
                for (const c of lines[j]) {
                    if (c === '{') d++;
                    else if (c === '}') { d--; if (d === 0) { endLine = j; j = lines.length; break; } }
                }
            }
            const vid     = m[2] ? m[2].trim() : null;
            const content = parseRoomContent(fp, i, endLine);
            const imgPath = findRoomImage(wsRoot, m[1], vid);
            items.push({ name: m[1], vanillaId: vid, kind: 'map', filePath: fp, relPath: wsRoot ? path.relative(wsRoot, fp) : fp, startLine: i, endLine, content, imagePath: imgPath });
        }
    }
    return items;
}

/**
 * Build the room tree from the active document, scanning #import directories.
 * Maps from the active document appear first (grouped if imports also exist).
 */
function buildRoomTree(document, wsRoot) {
    const docPath = document.uri.fsPath;
    const docDir  = path.dirname(docPath);
    const mapRe   = /^\s*map\s+([A-Za-z_][A-Za-z0-9_]*)\s*(?:\(\s*([^)]*?)\s*\))?\s*\{/;

    // Parse maps declared directly in the active document
    const docMaps = [];
    for (let i = 0; i < document.lineCount; i++) {
        const m = mapRe.exec(document.lineAt(i).text);
        if (!m) continue;
        let d = 0, endLine = i;
        for (let j = i; j < document.lineCount; j++) {
            for (const c of document.lineAt(j).text) {
                if (c === '{') d++;
                else if (c === '}') { d--; if (d === 0) { endLine = j; j = document.lineCount; break; } }
            }
        }
        const vid     = m[2] ? m[2].trim() : null;
        const content = parseRoomContent(docPath, i, endLine);
        const imgPath = findRoomImage(wsRoot, m[1], vid);
        docMaps.push({ name: m[1], vanillaId: vid, kind: 'map', filePath: docPath, relPath: wsRoot ? path.relative(wsRoot, docPath) : docPath, startLine: i, endLine, content, imagePath: imgPath });
    }

    // Scan #import directories
    const importedAreas = [];
    for (let i = 0; i < document.lineCount; i++) {
        const imp = document.lineAt(i).text.match(/#import\s*\(\s*["']([^"']+)["']\s*\)/);
        if (!imp) continue;
        const impRel = imp[1].replace(/^\.\//, '');
        const candidates = [wsRoot ? path.join(wsRoot, impRel) : null, path.join(docDir, impRel)].filter(Boolean);
        for (const p of candidates) {
            if (!fs.existsSync(p)) continue;
            let stat;
            try { stat = fs.statSync(p); } catch { continue; }
            if (stat.isDirectory()) {
                const areaName = path.basename(p).replace(/^\[area\]\s*/, '').replace(/^\d+_/, '');
                const children = collectRoomsFromDir(p, wsRoot || docDir, 0);
                if (children.length) importedAreas.push({ name: areaName, kind: 'area', children });
            }
            break;
        }
    }

    const tree = [];
    if (docMaps.length) {
        if (importedAreas.length) {
            // Group the active-file maps under a named area node
            tree.push({ name: path.basename(docPath, '.evs'), kind: 'area', children: docMaps });
        } else {
            tree.push(...docMaps);
        }
    }
    tree.push(...importedAreas);
    return tree;
}

/** Server-side render of the collapsible room tree as HTML. */
function renderRoomsTree(nodes) {
    if (!nodes || !nodes.length) return '<div class="rm-empty">No rooms found in this file.</div>';
    let html = '<ul class="rt">';
    for (const n of nodes) {
        if (n.kind === 'area') {
            html += '<li class="rn-area"><span class="rn-area-label">' + radarEsc(n.name) + '</span>' + renderRoomsTree(n.children) + '</li>';
        } else {
            const vid = n.vanillaId ? '<span class="rv-id">' + radarEsc(n.vanillaId) + '</span>' : '';
            html += '<li class="rn-map" data-map="' + radarEsc(n.name) + '" data-line="' + n.startLine + '"><span class="rn-map-label">' + radarEsc(n.name) + vid + '</span></li>';
        }
    }
    return html + '</ul>';
}

/** Build ROOMS JSON data object for embedding in the webview. Expects imagePath already converted to imageUri. */
function buildRoomsJson(tree, activeTab, selectedMap) {
    const all = {};
    function walk(nodes) {
        for (const n of nodes) {
            if (n.kind === 'map') {
                all[n.name] = { name: n.name, vanillaId: n.vanillaId || null, relPath: n.relPath || '', startLine: n.startLine, endLine: n.endLine, content: n.content, imageUri: n.imageUri || null };
            } else if (n.children) { walk(n.children); }
        }
    }
    walk(tree);
    return 'var ROOMS=' + JSON.stringify(all).replace(/<\/script>/gi, '<\\/script>') +
        ';var ACTIVE_TAB=' + JSON.stringify(activeTab || 'radar') +
        ';var SELECTED_MAP=' + JSON.stringify(selectedMap || null) + ';';
}

/** Convert imagePath on every map node to a webview URI in-place. */
function setRoomImageUris(nodes, webview) {
    for (const n of nodes) {
        if (n.kind === 'map' && n.imagePath) {
            try { n.imageUri = webview.asWebviewUri(vscode.Uri.file(n.imagePath)).toString(); }
            catch { n.imageUri = null; }
        }
        if (n.children) setRoomImageUris(n.children, webview);
    }
}

function renderRadarHtml(scope, refs, pools, mapByAddr, roomTree = [], activeTab = 'radar', selectedMap = null) {
    const COLS = 16;
    const allAddrs = [...mapByAddr.keys(), ...refs.keys()];
    if (!allAddrs.length) { allAddrs.push(0x2200, 0x28FF); }
    const rowStart = Math.min(...allAddrs) & ~(COLS - 1);
    const rowEnd   = (Math.max(...allAddrs) | (COLS - 1)) + 1;

    const lcCount = (lc) => {
        const seen = new Set();
        for (const e of mapByAddr.values()) { if (e.lifecycle === lc && !seen.has(e)) seen.add(e); }
        return seen.size;
    };
    const lcUsed = (lc) => {
        const seen = new Set();
        for (const [addr, e] of mapByAddr) {
            if (e.lifecycle !== lc || !refs.has(addr) || seen.has(e)) continue;
            seen.add(e);
        }
        return seen.size;
    };

    const bar = (u, t, lc) => {
        const p = t ? Math.round(u / t * 100) : 0;
        const w = Math.max(p, u > 0 ? 2 : 0);
        return '<div class="bo"><div class="bi bi-' + lc + '" style="width:' + w + '%"></div></div>' +
               '<span class="bl">' + u + '/' + t + ' (' + p + '%)</span>';
    };

    // Build cell data (keyed by address number for JSON)
    const cellData = {};
    for (const [addr, me] of mapByAddr) {
        const usage = refs.get(addr);
        cellData[addr] = {
            addr: radarH(addr), name: me.name, type: me.type,
            lc: radarLifecycle(addr, me.type, me.notes), notes: me.notes,
            addrStart: me.addrStart, addrEnd: me.addrEnd,
            emoji: radarExtractEmoji(me.name + ' ' + me.notes),
            reads: usage ? usage.reads : [],
            writes: usage ? usage.writes : [],
        };
    }
    for (const [addr, usage] of refs) {
        if (!cellData[addr]) {
            const lc = radarLifecycle(addr, '', '');
            const inPool = pools.some(p => addr >= p.start && addr <= p.end);
            cellData[addr] = {
                addr: radarH(addr),
                name: inPool ? '(pool alloc)' : '(untracked)',
                type: inPool ? 'pool' : '?',
                lc, notes: '', addrStart: addr, addrEnd: addr, emoji: '',
                reads: usage.reads, writes: usage.writes,
                untracked: true, inPool,
            };
        }
    }

    // Mark pool addresses in cellData (addresses declared in pool ranges but not individually referenced)
    for (const pool of pools) {
        for (let a = pool.start; a <= pool.end; a++) {
            if (!cellData[a]) {
                cellData[a] = {
                    addr: radarH(a), name: '(pool)', type: 'pool',
                    lc: radarLifecycle(a, '', ''), notes: 'pool: ' + radarH(pool.start) + '\u2013' + radarH(pool.end),
                    addrStart: pool.start, addrEnd: pool.end, emoji: '',
                    reads: [], writes: [], isPool: true,
                };
            }
        }
    }

    // Grid HTML
    let gridHtml = '';
    for (let base = rowStart; base < rowEnd; base += COLS) {
        let cells = '', rowLcs = new Set(), allRest = true, rowHasUsed = false, rowHasDoc = false;
        for (let col = 0; col < COLS; col++) {
            const addr  = base + col;
            const me    = mapByAddr.get(addr);
            const usage = refs.get(addr);
            const lc    = radarLifecycle(addr, me ? me.type : '', me ? me.notes : '');
            const isUsed = !!usage;
            const isPool = !me && !usage && cellData[addr] && cellData[addr].isPool;
            const isRest = !me && !isUsed && !isPool;
            if (!isRest) { allRest = false; rowLcs.add(lc); }
            if (isUsed) rowHasUsed = true;
            if (me) rowHasDoc = true;
            let cls = 'cell lc-' + lc;
            if (isPool) cls += ' cp';
            if (isUsed) {
                cls += ' cu';
                if (usage.writes.length && !usage.reads.length) cls += ' cw';
                else if (usage.writes.length && usage.reads.length) cls += ' crw';
            }
            if (isRest) cls += ' cr';
            const cd = cellData[addr];
            const tip = radarEsc(radarH(addr) + (me ? ' ' + me.name : ''));
            const emoji = cd ? cd.emoji : '';
            const gsize = me ? (me.addrEnd - me.addrStart + 1) : 1;
            const grpAttrs = (gsize > 1)
                ? ' data-gid="' + me.addrStart + '" data-gend="' + me.addrEnd + '"'
                : '';
            cells += '<span class="' + cls + '" data-addr="' + addr + '"' +
                     ' title="' + tip + '"' + grpAttrs +
                     (emoji ? ' data-emoji="' + radarEsc(emoji) + '"' : '') +
                     '></span>';
        }
        gridHtml += '<div class="gr' + (allRest ? ' gar' : '') +
                    '" data-lcs="' + [...rowLcs].join(' ') + '"' +
                    ' data-used="' + (rowHasUsed ? '1' : '0') + '"' +
                    ' data-hasdoc="' + (rowHasDoc ? '1' : '0') + '">' +
                    '<span class="rl">' + radarH(base) + '</span>' + cells + '</div>';
    }

    // Detail table: unified list — all entries (known + untracked) sorted by address.
    // For bit-fielded entries (nameParts.length > 1) expand into sub-rows with rowspan.
    const mkLinks = (items, cls) => items.map(r =>
        '<a class="ll' + (cls ? ' ' + cls : '') + '" data-line="' + r.line + '" title="' + radarEsc(r.text) + '">:' + (r.line + 1) + '</a>'
    ).join('');

    const allEntries = [];
    const seenE = new Set();
    for (const [, e] of [...mapByAddr.entries()].sort((a, b) => a[0] - b[0])) {
        if (seenE.has(e)) continue;
        seenE.add(e);
        allEntries.push({ addr: e.addrStart, e, usage: refs.get(e.addrStart) || null });
    }
    const seenU = new Set();
    for (const [addr, usage] of refs) {
        if (mapByAddr.has(addr) || seenU.has(addr)) continue;
        seenU.add(addr);
        const cd = cellData[addr];
        const lc = radarLifecycle(addr, '', '');
        const label = cd && cd.inPool ? '(pool alloc)' : '(untracked)';
        allEntries.push({
            addr, usage,
            e: { name: label, nameParts: [label], type: cd && cd.inPool ? 'pool' : '?', notes: '',
                 lifecycle: lc, addrStart: addr, addrEnd: addr },
            untracked: true, inPool: cd && cd.inPool,
        });
    }
    allEntries.sort((a, b) => a.addr - b.addr);

    const detailRows = allEntries.map(({ addr, e, usage, untracked, inPool }) => {
        const lc = e.lifecycle;
        const em = radarExtractEmoji(e.name + ' ' + e.notes);
        const addrLabel = e.addrStart === e.addrEnd
            ? radarH(e.addrStart)
            : radarH(e.addrStart) + '\u2013' + radarH(e.addrEnd);
        const wLinks = usage ? mkLinks(usage.writes, 'lw') : '';
        const rLinks = usage ? mkLinks(usage.reads, '') : '';
        const linesCell = (rLinks || wLinks)
            ? (wLinks ? '<span class="rw-w">' + wLinks + '</span>' : '') +
              (rLinks ? '<span class="rw-r">' + rLinks + '</span>' : '')
            : '&ndash;';
        const badge = untracked
            ? (inPool ? '<span class="pool-badge">pool</span>' : '<span class="unk-badge">?</span>')
            : '';
        const emCell = em ? '<span class="te">' + em + '</span>' : '';
        const rowCls = 'dr lc-' + lc + (usage ? ' du' : '') + (untracked ? ' untracked' : '');
        const notesHtml = untracked
            ? '<span class="scope-only">scope usage only</span>'
            : (e.notes ? radarEsc(e.notes).replace(/\n/g, '<br>') : '&ndash;');

        const parts = e.nameParts && e.nameParts.length > 1 ? e.nameParts : null;
        const numBytes = e.addrEnd - e.addrStart + 1;
        const typeStr = radarEsc(e.type.replace(/\s*\[SRAM\]/gi, '').trim());
        const es = e.addrStart, ee = e.addrEnd;

        // Bit-field expansion: one row per named part; each sub-row gets own T, Notes, Lines
        if (parts) {
            // Distribute notes by <br> if count matches; else first row gets full notes, rest get —
            const notesBrParts = notesHtml !== '&ndash;' ? notesHtml.split(/<br\s*\/?>/gi) : null;
            const notesDistrib = (notesBrParts && notesBrParts.length === parts.length) ? notesBrParts : null;
            let html = '<tr id="dr-' + es + '" class="' + rowCls + '" data-addr="' + es + '" data-es="' + es + '" data-ee="' + ee + '">';
            html += '<td class="mo" rowspan="' + parts.length + '">' + badge + emCell + addrLabel + '</td>';
            html += '<td class="bf">' + radarEsc(parts[0]) + '</td>';
            html += '<td class="mt">' + typeStr + '</td>';
            html += '<td class="nt">' + (notesDistrib ? notesDistrib[0] : notesHtml) + '</td>';
            html += '<td class="rwc">' + linesCell + '</td></tr>';
            for (let i = 1; i < parts.length; i++) {
                html += '<tr id="dr-' + es + '-' + i + '" class="' + rowCls + ' bfc" data-addr="' + es + '" data-part="' + i + '" data-es="' + es + '" data-ee="' + ee + '">';
                html += '<td class="bf">' + radarEsc(parts[i]) + '</td>';
                html += '<td class="mt">' + typeStr + '</td>';
                html += '<td class="nt">' + (notesDistrib ? notesDistrib[i] : '&ndash;') + '</td>';
                html += '<td class="rwc">' + linesCell + '</td></tr>';
            }
            return html;
        }

        // Multi-byte expansion: each byte row stands alone (no rowspan); all show same name/T/notes/lines
        if (!untracked && numBytes > 1) {
            let html = '<tr id="dr-' + es + '" class="' + rowCls + '" data-addr="' + es + '" data-es="' + es + '" data-ee="' + ee + '">';
            html += '<td class="mo">' + badge + emCell + radarH(es) + '</td>';
            html += '<td>' + radarEsc(e.name) + '</td>';
            html += '<td class="mt">' + typeStr + '</td>';
            html += '<td class="nt">' + notesHtml + '</td>';
            html += '<td class="rwc">' + linesCell + '</td></tr>';
            for (let a = es + 1; a <= ee; a++) {
                html += '<tr id="dr-' + a + '" class="' + rowCls + ' bfc" data-addr="' + a + '" data-es="' + es + '" data-ee="' + ee + '">';
                html += '<td class="mo">' + radarH(a) + '</td>';
                html += '<td>' + radarEsc(e.name) + '</td>';
                html += '<td class="mt">' + typeStr + '</td>';
                html += '<td class="nt">' + notesHtml + '</td>';
                html += '<td class="rwc">' + linesCell + '</td></tr>';
            }
            return html;
        }

        const nameCls = untracked ? ' class="no-vanilla"' : '';
        return '<tr id="dr-' + addr + '" class="' + rowCls + '" data-addr="' + addr + '" data-es="' + es + '" data-ee="' + ee + '">' +
            '<td class="mo">' + badge + emCell + addrLabel + '</td>' +
            '<td' + nameCls + '>' + radarEsc(e.name) + '</td>' +
            '<td class="mt">' + typeStr + '</td>' +
            '<td class="nt">' + notesHtml + '</td>' +
            '<td class="rwc">' + linesCell + '</td></tr>';
    }).join('');

    // Pool declaration header rows (shown above the data rows)
    const poolRows = pools.map(p =>
        '<tr class="pool-row lc-' + p.lc + '">' +
        '<td class="mo"><span class="pool-badge">' + p.lc + '</span>' + radarH(p.start) + '\u2013' + radarH(p.end) + '</td>' +
        '<td colspan="2">declared pool &mdash; ' + (p.end - p.start + 1) + ' bytes at line ' + (p.line + 1) + '</td>' +
        '<td class="nt">' + p.lc + ' region</td><td>&ndash;</td></tr>'
    ).join('');

    const tempT = lcCount('temp'), sessT = lcCount('session'), sramT = lcCount('sram');
    const tempU = lcUsed('temp'),  sessU = lcUsed('session'),  sramU = lcUsed('sram');

    const jsData = 'var CELLS=' + JSON.stringify(cellData).replace(/<\/script>/gi, '<\\/script>') + ';';

    const css = `*{box-sizing:border-box;margin:0;padding:0}
html,body{height:100%;overflow:hidden}
body{font:11px/1.4 "SF Mono","Cascadia Code",monospace;background:var(--vscode-editor-background);color:var(--vscode-editor-foreground);padding:8px 10px 0;display:flex;flex-direction:column}
h2{font-size:9px;text-transform:uppercase;letter-spacing:.08em;opacity:.32;margin:8px 0 2px;font-weight:700}
.sh{font-size:13px;font-weight:700;margin-bottom:2px}.sm{opacity:.4;font-size:10px;margin-bottom:6px}
.head{flex-shrink:0;border-bottom:1px solid #1c1c1c;padding-bottom:6px;margin-bottom:6px}
.panels{display:flex;flex:1;overflow:hidden;gap:8px;min-height:0}
.left-panel{overflow-y:auto;flex-shrink:0;padding-right:4px;padding-bottom:8px}
.right-panel{overflow-y:auto;overflow-x:auto;flex:1;min-width:0;padding-bottom:8px}
.ph{font-size:9px;text-transform:uppercase;letter-spacing:.08em;opacity:.32;padding:3px 0 2px;font-weight:700;position:sticky;top:0;background:var(--vscode-editor-background);z-index:2;margin-bottom:2px}
.filters{display:flex;flex-wrap:wrap;gap:3px;margin-bottom:6px;align-items:center}
.fb{border:1px solid #333;border-radius:10px;padding:1px 7px;cursor:pointer;font-size:10px;background:transparent;color:inherit;opacity:.3}
.fb.on{opacity:1}
.fb.ft{border-color:#388bfd;color:#6cb6ff}.fb.fs{border-color:#ffa94d;color:#ffa94d}
.fb.fr2{border-color:#3fb950;color:#56d364}.fb.fy{border-color:#666;color:#999}
.fb.frest{border-color:#333;color:#555}.fb.fboring{border-color:#666;color:#888}
.fb.femoji{border-color:#888;color:#aaa}.fb.fgroup{border-color:#777;color:#aaa}
.fb.fpin{border-color:#ff9040;color:#ffb060}.fb.fpin.on{border-color:#ff9040}
.fb.falloc{border-color:#888;color:#aaa}
.fb.fglobal{border-color:#9977ff;color:#bb99ff}
.sep{width:1px;height:14px;background:#333;margin:0 2px}
.sr{display:flex;align-items:center;gap:5px;margin-bottom:2px;font-size:10px}
.sl{width:44px;opacity:.45;flex-shrink:0}
.bo{flex:1;height:4px;background:#181818;border-radius:2px;max-width:80px;overflow:hidden}
.bi{height:100%;border-radius:2px;min-width:1px}
.bi-temp{background:#388bfd}.bi-session{background:#ffa94d}.bi-sram{background:#3fb950}
.bl{font-size:9px;opacity:.38;white-space:nowrap}
.gw{margin:4px 0}
.gr{display:flex;align-items:center;margin-bottom:1px;flex-shrink:0}
.rl{font-size:7px;opacity:.2;width:36px;flex-shrink:0;user-select:none;letter-spacing:-.02em}
.cell{display:inline-block;width:9px;height:9px;border-radius:1px;background:#0a0a0a;flex-shrink:0;cursor:pointer;position:relative;overflow:hidden;vertical-align:top;font-size:0;line-height:0;margin-right:1px}
.cell:last-child{margin-right:0}
.cell.grj-r{margin-right:0;border-top-right-radius:0;border-bottom-right-radius:0}
.cell.grj-l{border-top-left-radius:0;border-bottom-left-radius:0}
.cell:hover{outline:1.5px solid rgba(255,255,255,.65);z-index:2}
.cell.chi{outline:1.5px solid rgba(255,255,255,.3)!important;filter:brightness(1.4)}
.cell.cursor{z-index:3}
.lc-temp{background:#152840}.lc-session{background:#2a1800}.lc-sram{background:#0a2010}.lc-system{background:#1a1a20}
.cu.lc-temp{background:#388bfd}.cu.lc-session{background:#ffa94d}.cu.lc-sram{background:#3fb950}.cu.lc-system{background:#7777cc}
.cw.cu{box-shadow:inset 0 0 0 1.5px #ff7b72}.crw.cu{box-shadow:inset 0 0 0 1.5px #f2cc60}
.cursor.cw.cu,.cursor.crw.cu{box-shadow:none}
.cr{background:#060606!important;opacity:.1}
body.ht .cell.lc-temp:not(.cursor){opacity:0;pointer-events:none}
body.hs .cell.lc-session:not(.cursor){opacity:0;pointer-events:none}
body.hr2 .cell.lc-sram:not(.cursor){opacity:0;pointer-events:none}
body.hsy .cell.lc-system:not(.cursor){opacity:0;pointer-events:none}
.gr.hrow{display:none!important}
body.emoji .cell[data-emoji]::before{content:attr(data-emoji);font-size:6px;line-height:9px;display:block;text-align:center;pointer-events:none}
table{width:100%;border-collapse:collapse;font-size:10px;margin-top:2px}
th,td{border:1px solid #1a1a1a;padding:2px 4px;vertical-align:top}
th{background:#101010;position:sticky;top:0;font-weight:600;text-align:left;font-size:8px}
tr.dr{cursor:pointer}tr.dr:hover td{background:rgba(255,255,255,.03)}
tr.pool-row td{background:rgba(56,139,253,.04);opacity:.65;font-style:italic}
.untracked td{background:rgba(255,100,50,.04)}
.du td{background:rgba(255,255,255,.01)}
.lc-temp td:first-child{border-left:2px solid #388bfd}
.lc-session.du td:first-child{border-left:2px solid #ffa94d}
.lc-sram.du td:first-child{border-left:2px solid #3fb950}
tr.sel td{background:rgba(255,200,50,.08)!important;outline:1px solid rgba(255,200,50,.15)}
.mo{font-size:9px;white-space:nowrap}.mt{opacity:.4;font-size:9px}
.nt{opacity:.38;font-size:9px;min-width:120px;white-space:pre-wrap;word-break:break-word}
.dt-wrap{}
.no-vanilla{opacity:.5;font-style:italic}.scope-only{color:#ff9f9f80;font-style:italic}
.rwc{white-space:nowrap;font-size:9px}.rw-w a{color:#ff9f9f}.rw-r a{color:#9fcfff}
.chip{border-radius:5px;padding:0 3px;font-size:8px;border:1px solid transparent}
.ch-temp{border-color:#388bfd;color:#6cb6ff}.ch-session{border-color:#ffa94d;color:#ffa94d}
.ch-sram{border-color:#3fb950;color:#56d364}.ch-system{border-color:#555;color:#888}
a.ll{color:#9fcfff;cursor:pointer;text-decoration:none}a.ll.lw{color:#ff9f9f}a.ll:hover{text-decoration:underline}
.te{margin-right:2px;font-size:9px}
.pool-badge,.unk-badge{font-size:7px;border-radius:3px;padding:0 2px;margin-right:3px;border:1px solid}
.pool-badge{border-color:#388bfd60;color:#388bfd;background:#152840}
.unk-badge{border-color:#666;color:#888;background:#1a1a1a}
.bf{font-size:9px}
.bfc td{border-top:none!important;padding-top:0}
.cell.cp{background:#0d1a0d;opacity:.55}
/* ── Tabs ── */
.tabs{display:flex;gap:0;flex-shrink:0;border-bottom:1px solid #1c1c1c;margin-bottom:4px}
.tab{background:none;border:none;border-bottom:2px solid transparent;color:inherit;cursor:pointer;font:inherit;font-size:10px;opacity:.4;padding:3px 12px;margin-bottom:-1px;transition:opacity .1s}
.tab:hover{opacity:.7}
.tab.tab-active{opacity:1;border-bottom-color:var(--vscode-focusBorder,#388bfd)}
.tab-pane{display:flex;flex-direction:column;flex:1;min-height:0;overflow:hidden}
/* ── Rooms panel ── */
.rm-panels{display:flex;flex:1;gap:0;min-height:0;overflow:hidden}
.rm-left{width:200px;flex-shrink:0;overflow-y:auto;border-right:1px solid #1c1c1c;padding:4px 6px 8px 0}
.rm-right{flex:1;overflow-y:auto;overflow-x:hidden;min-width:0;padding:8px 10px}
.rm-ph{font-size:9px;text-transform:uppercase;letter-spacing:.08em;opacity:.32;padding:3px 0 5px;font-weight:700}
.rm-empty{opacity:.25;font-size:10px;padding:6px 0}
/* ── Room tree ── */
.rt{list-style:none;padding:0;margin:0}.rt .rt{padding-left:12px}
.rn-area-label{cursor:pointer;display:block;padding:2px 2px;opacity:.42;font-size:9px;text-transform:uppercase;letter-spacing:.05em;user-select:none}
.rn-area-label:hover{opacity:.72}
.rn-area.collapsed>.rt{display:none}
.rn-map{cursor:pointer;padding:1px 4px;border-radius:3px;margin:1px 0;display:flex;align-items:baseline;gap:4px}
.rn-map:hover{background:rgba(255,255,255,.05)}
.rn-map.rsel{background:rgba(56,139,253,.18)}
.rn-map-label{font-size:10px;flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.rv-id{font-size:8px;opacity:.28;flex-shrink:0}
/* ── Room detail ── */
.rm-detail-placeholder{display:flex;align-items:center;justify-content:center;height:80px;opacity:.2;font-size:11px}
.rd-head{padding:0 0 7px;border-bottom:1px solid #1c1c1c;margin-bottom:8px}
.rd-name{font-size:12px;font-weight:700;margin-right:8px}
.rd-vid{font-size:9px;opacity:.35;margin-right:8px}
.rd-file{font-size:8px;opacity:.22;display:block;margin-top:2px}
.rd-head a{font-size:9px;color:var(--vscode-textLink-foreground,#4daafc);cursor:pointer;text-decoration:none;display:inline-block;margin-top:3px}
.rd-head a:hover{text-decoration:underline}
/* ── Room grid ── */
.rg-wrap{position:relative;overflow:hidden;background:white;border:1px solid #bbb;display:block;margin-bottom:8px}
.rg-svg{position:absolute;inset:0;display:block}
.room-img{display:block;width:100%;height:100%;object-fit:cover;opacity:.6}
.rg-placeholder{display:flex;align-items:center;justify-content:center;width:160px;height:80px;opacity:.15;border:1px solid #444;margin-bottom:8px;color:#888;font-size:10px}
/* ── Room sections ── */
.rs{margin-top:7px}
.rs-h{font-size:9px;text-transform:uppercase;letter-spacing:.05em;opacity:.38;margin-bottom:3px;font-weight:700}
.rs-list{list-style:none;padding:0;font-size:10px}
.rs-list li{padding:1px 0;opacity:.7}
.rs-list li:hover{opacity:1}
.badge-d{font-size:7px;opacity:.55;border:1px solid #ffa94d;border-radius:3px;padding:0 2px;color:#ffa94d}`;

    // ── Rooms tab data ──────────────────────────────────────────────────────
    const treeHtml  = renderRoomsTree(roomTree);
    const roomsData = buildRoomsJson(roomTree, activeTab, selectedMap);
    const roomsJs   = `
function escH(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}

// Tab switching (posts tabChange so host preserves active tab across re-renders)
document.querySelectorAll('.tab').forEach(function(btn){
  btn.addEventListener('click',function(){
    document.querySelectorAll('.tab').forEach(function(b){b.classList.remove('tab-active');});
    btn.classList.add('tab-active');
    var tab=btn.dataset.tab;
    document.querySelectorAll('.tab-pane').forEach(function(p){
      p.style.display=p.dataset.tab===tab?'flex':'none';
    });
    if(vs)vs.postMessage({command:'tabChange',tab:tab});
  });
});

// Area collapse / expand
document.querySelectorAll('.rn-area-label').forEach(function(lbl){
  lbl.addEventListener('click',function(){
    var li=lbl.closest('li.rn-area');
    if(li)li.classList.toggle('collapsed');
  });
});

// Map click → show detail
document.querySelectorAll('.rn-map').forEach(function(li){
  li.addEventListener('click',function(){
    document.querySelectorAll('.rn-map.rsel').forEach(function(x){x.classList.remove('rsel');});
    li.classList.add('rsel');
    var mapName=li.dataset.map;
    var room=ROOMS[mapName];
    if(!room)return;
    renderRoomDetail(room);
  });
});

function renderRoomDetail(room){
  var panel=document.getElementById('room-detail');
  if(!panel)return;
  panel.className='';
  var c=room.content||{};
  var im=c.initMap;
  var entrances=c.entrances||[];
  var enemies=c.enemies||[];
  var objs=c.objects||[];
  var trans=c.transitions||[];

  var html='<div class="rd-head">';
  html+='<span class="rd-name">'+escH(room.name)+'</span>';
  if(room.vanillaId)html+='<span class="rd-vid">'+escH(room.vanillaId)+'</span>';
  html+='<span class="rd-file">'+escH(room.relPath||'')+'</span>';
  html+='<a class="ll" data-line="'+room.startLine+'" href="#">go to code</a>';
  html+='</div>';

  // Map grid: image + SVG overlay
  var hasCoords=(im!=null)||(entrances.length>0)||(enemies.length>0);
  if(hasCoords||room.imageUri){
    var x1=im?im.x1:0,y1=im?im.y1:0;
    var x2=im?im.x2:256,y2=im?im.y2:256;
    if(!hasCoords&&room.imageUri){x1=0;y1=0;x2=256;y2=256;}
    var W=Math.max(x2-x1,16),H=Math.max(y2-y1,16);
    var scale=Math.min(600/W,360/H,8);
    var pxW=Math.round(W*scale),pxH=Math.round(H*scale);
    html+='<div class="rg-wrap" style="width:'+pxW+'px;height:'+pxH+'px">';
    if(room.imageUri){
      html+='<img class="room-img" src="'+room.imageUri+'" alt="">';
    }
    html+='<svg class="rg-svg" width="'+pxW+'" height="'+pxH+'" viewBox="0 0 '+W+' '+H+'">';
    var step=Math.max(8,Math.ceil(W/24));
    for(var gx=0;gx<=W;gx+=step)html+='<line x1="'+gx+'" y1="0" x2="'+gx+'" y2="'+H+'" stroke="rgba(0,0,0,0.1)" stroke-width="0.5"/>';
    for(var gy=0;gy<=H;gy+=step)html+='<line x1="0" y1="'+gy+'" x2="'+W+'" y2="'+gy+'" stroke="rgba(0,0,0,0.1)" stroke-width="0.5"/>';
    if(im)html+='<rect x="0" y="0" width="'+W+'" height="'+H+'" fill="none" stroke="#1a6" stroke-width="0.7" stroke-dasharray="3,2"/>';
    enemies.forEach(function(e){
      var ex=e.x-x1,ey=e.y-y1;
      var fill=e.dynamic?'#cc7700':'#cc0000';
      html+='<circle cx="'+ex+'" cy="'+ey+'" r="2" fill="'+fill+'" opacity="0.85"><title>'+escH(e.type)+' ('+e.x+','+e.y+')</title></circle>';
    });
    entrances.forEach(function(en){
      var ex=en.x-x1,ey=en.y-y1;
      html+='<circle cx="'+ex+'" cy="'+ey+'" r="3" fill="none" stroke="#005500" stroke-width="1"><title>'+escH(en.name)+' ('+en.dir+')</title></circle>';
      html+='<text x="'+(ex+4)+'" y="'+(ey+2)+'" fill="#005500" font-size="3" font-family="monospace">'+escH(en.name)+'</text>';
    });
    html+='</svg></div>';
  } else {
    html+='<div class="rg-placeholder"><span>No coordinate data</span></div>';
  }

  if(entrances.length){
    html+='<div class="rs"><div class="rs-h">Entrances</div><ul class="rs-list">';
    entrances.forEach(function(e){
      html+='<li><a class="ll" data-line="'+e.line+'" href="#">'+escH(e.name)+'</a> ('+e.x+','+e.y+') '+escH(e.dir)+'</li>';
    });
    html+='</ul></div>';
  }
  if(enemies.length){
    html+='<div class="rs"><div class="rs-h">Enemies</div><ul class="rs-list">';
    enemies.forEach(function(e){
      html+='<li><a class="ll" data-line="'+e.line+'" href="#">'+escH(e.type)+'</a> ('+e.x+','+e.y+')'+(e.dynamic?' <span class="badge-d">dynamic</span>':'')+'</li>';
    });
    html+='</ul></div>';
  }
  if(objs.length){
    html+='<div class="rs"><div class="rs-h">Objects</div><ul class="rs-list">';
    objs.forEach(function(o){
      html+='<li><a class="ll" data-line="'+o.line+'" href="#">object['+escH(o.index)+']</a></li>';
    });
    html+='</ul></div>';
  }
  if(trans.length){
    html+='<div class="rs"><div class="rs-h">Transitions</div><ul class="rs-list">';
    trans.forEach(function(t){
      html+='<li><a class="ll" data-line="'+t.line+'" href="#">'+escH(t.target)+'</a> via '+escH(t.via)+' '+escH(t.dir)+'</li>';
    });
    html+='</ul></div>';
  }

  panel.innerHTML=html;
  bindLinks(panel);
}
`;

    const js = `(function(){
var vs=typeof acquireVsCodeApi==='function'?acquireVsCodeApi():null;
${jsData}
var hidden=new Set(['rest']);
var hideBoring=false,hideAlloc=false,emojiMode=false,groupMode=false;
var BTN_LC={ft:'temp',fs:'session',fr2:'sram',fy:'system',frest:'rest'};
var BTN_BODY={ft:'ht',fs:'hs',fr2:'hr2',fy:'hsy'};
document.body.classList.add('hrest');
var COLS=16;

function recomputeRows(){
  document.querySelectorAll('.gr').forEach(function(row){
    var isGar=row.classList.contains('gar');
    if(isGar){row.classList.toggle('hrow',hidden.has('rest'));return;}
    var lcs=(row.dataset.lcs||'').split(' ').filter(Boolean);
    var allHidden=lcs.length>0&&lcs.every(function(lc){return hidden.has(lc);});
    var isUsed=row.dataset.used==='1';
    var hasDoc=row.dataset.hasdoc==='1';
    row.classList.toggle('hrow',allHidden||(hideBoring&&!isUsed)||(hideAlloc&&!hasDoc));
  });
}

document.querySelectorAll('.fb[data-cls]').forEach(function(b){
  var k=b.dataset.cls;
  if(!BTN_LC[k])return;
  b.addEventListener('click',function(){
    b.classList.toggle('on');
    var on=b.classList.contains('on');
    var lc=BTN_LC[k];
    if(on)hidden.delete(lc);else hidden.add(lc);
    if(BTN_BODY[k])document.body.classList.toggle(BTN_BODY[k],!on);
    recomputeRows();
  });
});

var restBtn=document.querySelector('.fb.frest');
if(restBtn)restBtn.addEventListener('click',function(){
  restBtn.classList.toggle('on');
  var on=restBtn.classList.contains('on');
  if(on)hidden.delete('rest');else hidden.add('rest');
  recomputeRows();
});

var boringBtn=document.getElementById('btn-boring');
if(boringBtn)boringBtn.addEventListener('click',function(){
  hideBoring=!hideBoring;
  boringBtn.classList.toggle('on',hideBoring);
  recomputeRows();
});

var allocBtn=document.getElementById('btn-alloc');
if(allocBtn)allocBtn.addEventListener('click',function(){
  hideAlloc=!hideAlloc;
  allocBtn.classList.toggle('on',hideAlloc);
  recomputeRows();
});

var emojiBtn=document.getElementById('btn-emoji');
if(emojiBtn)emojiBtn.addEventListener('click',function(){
  emojiMode=!emojiMode;
  emojiBtn.classList.toggle('on',emojiMode);
  document.body.classList.toggle('emoji',emojiMode);
});

var pinBtn=document.getElementById('btn-pin');
if(pinBtn)pinBtn.addEventListener('click',function(){
  var pinned=pinBtn.classList.toggle('on');
  if(vs)vs.postMessage({command:pinned?'pin':'unpin'});
});

var globalBtn=document.getElementById('btn-global');
if(globalBtn)globalBtn.addEventListener('click',function(){
  var on=globalBtn.classList.toggle('on');
  if(vs)vs.postMessage({command:on?'globalScope':'autoScope'});
});

// Group coloring toggle (default off)
var gPal=['#5599ff','#ff8833','#33cc77','#ff44bb','#ccff33','#33bbff','#ff9944','#9933ff','#ff3344','#33ffcc'];
var gColMap={},gIdx=0;
document.querySelectorAll('.cell[data-gid]').forEach(function(c){
  var gid=c.dataset.gid;
  if(gColMap[gid]===undefined)gColMap[gid]=gPal[gIdx++%gPal.length];
});
function applyGroupColors(){
  document.querySelectorAll('.cell[data-gid]').forEach(function(c){
    c.style.borderBottom=groupMode?'2px solid '+gColMap[c.dataset.gid]:'';
  });
}
var groupBtn=document.getElementById('btn-group');
if(groupBtn)groupBtn.addEventListener('click',function(){
  groupMode=!groupMode;
  groupBtn.classList.toggle('on',groupMode);
  applyGroupColors();
});

// Group join: collapse gap between adjacent cells in the same group
document.querySelectorAll('.cell[data-gid]').forEach(function(c){
  var addr=parseInt(c.dataset.addr);
  var gid=c.dataset.gid;
  var nextEl=document.querySelector('.cell[data-addr="'+(addr+1)+'"]');
  var prevEl=document.querySelector('.cell[data-addr="'+(addr-1)+'"]');
  if(nextEl&&nextEl.dataset.gid===gid)c.classList.add('grj-r');
  if(prevEl&&prevEl.dataset.gid===gid)c.classList.add('grj-l');
});

function goToLine(l){if(vs)vs.postMessage({command:'goToLine',line:l});}
function bindLinks(root){
  root.querySelectorAll('a.ll').forEach(function(a){
    a.addEventListener('click',function(e){e.preventDefault();e.stopPropagation();goToLine(parseInt(a.dataset.line));});
  });
}

// Polygon outline: per-cell edge box-shadows so selection looks like one outline
function applyPolygonOutline(cursored){
  var cc='rgba(255,255,255,0.88)';
  cursored.forEach(function(addr){
    var el=document.querySelector('.cell[data-addr="'+addr+'"]');
    if(!el)return;
    var col=addr&(COLS-1);
    var shadows=[];
    if(el.classList.contains('crw'))shadows.push('inset 0 0 0 1px rgba(242,204,96,0.35)');
    else if(el.classList.contains('cw'))shadows.push('inset 0 0 0 1px rgba(255,123,114,0.35)');
    if(col===0||!cursored.has(addr-1))      shadows.push('inset 2px 0 0 0 '+cc);
    if(col===COLS-1||!cursored.has(addr+1)) shadows.push('inset -2px 0 0 0 '+cc);
    if(!cursored.has(addr-COLS))            shadows.push('inset 0 2px 0 0 '+cc);
    if(!cursored.has(addr+COLS))            shadows.push('inset 0 -2px 0 0 '+cc);
    el.style.boxShadow=shadows.join(',');
    el.style.zIndex='3';
  });
}

function setCursorRange(start,end){
  document.querySelectorAll('.cursor').forEach(function(x){
    x.classList.remove('cursor');x.style.boxShadow='';x.style.zIndex='';
  });
  var cursored=new Set();
  for(var a=start;a<=end;a++){
    var c=document.querySelector('.cell[data-addr="'+a+'"]');
    if(c){c.classList.add('cursor');cursored.add(a);}
  }
  applyPolygonOutline(cursored);
  var first=document.querySelector('.cell[data-addr="'+start+'"]');
  if(first){
    var lp=document.querySelector('.left-panel');
    var ph=lp?lp.querySelector('.ph'):null;
    var phH=ph?ph.getBoundingClientRect().height:0;
    var lpRect=lp?lp.getBoundingClientRect():{top:0,bottom:9999,height:9999};
    var elRect=first.getBoundingClientRect();
    var t=elRect.top-lpRect.top-phH;
    if(t<0){lp.scrollTop+=t-4;}
    else if(elRect.bottom>lpRect.bottom){lp.scrollTop+=elRect.bottom-lpRect.bottom+4;}
  }
}

function setCursor(addr){
  var d=CELLS[addr];
  setCursorRange(d?d.addrStart:addr,d?d.addrEnd:addr);
}

function selectDetailRow(addr){
  document.querySelectorAll('tr.sel').forEach(function(r){r.classList.remove('sel');});
  // Find the row whose entry range covers addr with the highest entry-start (most specific)
  var best=null,bestEs=-1;
  document.querySelectorAll('tr.dr').forEach(function(row){
    var es=parseInt(row.dataset.es),ee=parseInt(row.dataset.ee);
    if(!isNaN(es)&&!isNaN(ee)&&es<=addr&&addr<=ee&&es>bestEs){bestEs=es;best=row;}
  });
  if(!best)best=document.getElementById('dr-'+addr);
  if(!best)return;
  var entryStart=parseInt(best.dataset.es||best.dataset.addr);
  document.querySelectorAll('tr.dr[data-es="'+entryStart+'"]').forEach(function(r){r.classList.add('sel');});
  var firstRow=document.getElementById('dr-'+entryStart)||best;
  var panel=document.querySelector('.right-panel');
  if(!panel)return;
  var thead=panel.querySelector('thead');
  var headerH=thead?thead.getBoundingClientRect().height:0;
  var panelRect=panel.getBoundingClientRect();
  var rowRect=firstRow.getBoundingClientRect();
  var availH=panelRect.height-headerH;
  var targetTop=rowRect.top-panelRect.top-headerH;
  if(targetTop<0){
    panel.scrollTop+=targetTop-4;
  }else if(rowRect.bottom>panelRect.bottom){
    if(rowRect.height<=availH){panel.scrollTop+=rowRect.bottom-panelRect.bottom+4;}
    else{panel.scrollTop+=targetTop-4;}
  }
}

// Grid cell: click → cursor + scroll right; hover → highlight group
document.querySelectorAll('.cell').forEach(function(c){
  var addr=parseInt(c.dataset.addr);
  c.addEventListener('click',function(){
    setCursor(addr);
    selectDetailRow(addr);
  });
  c.addEventListener('mouseover',function(){
    var d=CELLS[addr];
    if(!d||d.addrStart===undefined)return;
    var start=d.addrStart,end=d.addrEnd;
    if(start===end)return;
    for(var a=start;a<=end;a++){
      if(a===addr)continue;
      var nb=document.querySelector('.cell[data-addr="'+a+'"]');
      if(nb)nb.classList.add('chi');
    }
  });
  c.addEventListener('mouseout',function(){
    document.querySelectorAll('.chi').forEach(function(x){x.classList.remove('chi');});
  });
});

// Detail row: click → cursor + scroll left
document.querySelectorAll('tr.dr').forEach(function(row){
  row.addEventListener('click',function(e){
    if(e.target.classList.contains('ll'))return;
    var es=parseInt(row.dataset.es||row.dataset.addr);
    var ee=parseInt(row.dataset.ee||row.dataset.addr);
    setCursorRange(es,ee);
    // Scroll the detail panel to THIS row (for bit-field sub-rows)
    var partIdx=row.dataset.part?parseInt(row.dataset.part):-1;
    if(partIdx>=0){
      document.querySelectorAll('tr.sel').forEach(function(r){r.classList.remove('sel');});
      row.classList.add('sel');
      var panel=document.querySelector('.right-panel');
      if(panel){
        var thead=panel.querySelector('thead');
        var headerH=thead?thead.getBoundingClientRect().height:0;
        var panelRect=panel.getBoundingClientRect();
        var rowRect=row.getBoundingClientRect();
        var availH=panelRect.height-headerH;
        var targetTop=rowRect.top-panelRect.top-headerH;
        if(targetTop<0){panel.scrollTop+=targetTop-4;}
        else if(rowRect.bottom>panelRect.bottom){
          if(rowRect.height<=availH){panel.scrollTop+=rowRect.bottom-panelRect.bottom+4;}
          else{panel.scrollTop+=targetTop-4;}
        }
      }
    }else{
      selectDetailRow(es);
    }
  });
});

bindLinks(document.querySelector('.dt-wrap'));
recomputeRows();
${roomsData}
${roomsJs}
// Init active tab and selected map highlight
(function(){
  var t=ACTIVE_TAB||'radar';
  document.querySelectorAll('.tab').forEach(function(b){b.classList.remove('tab-active');});
  var at=document.querySelector('.tab[data-tab="'+t+'"]');
  if(at)at.classList.add('tab-active');
  document.querySelectorAll('.tab-pane').forEach(function(p){
    p.style.display=p.dataset.tab===t?'flex':'none';
  });
  if(SELECTED_MAP){
    var li=document.querySelector('.rn-map[data-map="'+SELECTED_MAP+'"]');
    if(li){
      li.classList.add('rsel');
      var room=ROOMS[SELECTED_MAP];
      if(room)renderRoomDetail(room);
    }
  }
})();
})();`;

    const btns =
        '<button class="fb ft on" data-cls="ft" title="temp 0x2834\u20130x28FF: cleared on room load">temp</button>' +
        '<button class="fb fs on" data-cls="fs" title="session 0x2200\u20130x27FF: persistent across rooms">session</button>' +
        '<button class="fb fr2 on" data-cls="fr2" title="sram: battery-backed, tagged [SRAM]">sram</button>' +
        '<button class="fb fy on" data-cls="fy" title="system: engine/HW registers">system</button>' +
        '<button class="fb frest" data-cls="frest" title="rest: undocumented addresses (hidden by default)">rest</button>' +
        '<span class="sep"></span>' +
        '<button class="fb fboring" id="btn-boring" title="Hide rows with no cells used in scope">boring</button>' +
        '<button class="fb falloc" id="btn-alloc" title="Show only documented (non-gap) rows">alloc</button>' +
        '<button class="fb femoji" id="btn-emoji" title="Show emoji in grid cells">emoji</button>' +
        '<button class="fb fgroup" id="btn-group" title="Group coloring: color-stripe cells in same multi-byte entry (off by default)">group</button>' +
        '<button class="fb fpin" id="btn-pin" title="Pin: lock to current scope, stop auto-update">pin</button>' +
        '<button class="fb fglobal" id="btn-global" title="Global scope: show whole file instead of current function">global</button>';

    return '<!doctype html><html><head><meta charset="utf-8"><style>' + css + '</style></head>' +
        '<body class="hrest">' +
        '<div class="tabs">' +
        '<button class="tab tab-active" data-tab="radar">\u26a1 Memory</button>' +
        '<button class="tab" data-tab="rooms">\ud83d\uddfa Rooms</button>' +
        '</div>' +
        '<div class="tab-pane" data-tab="radar">' +
        '<div class="head">' +
        '<div class="sh">&#9679; Memory Radar</div>' +
        '<div class="sm">Scope: <strong>' + radarEsc(scope.kind) + ' ' + radarEsc(scope.name) +
        '</strong> | Lines: ' + (scope.startLine + 1) + '\u2013' + (scope.endLine + 1) + '</div>' +
        '<div class="filters">' + btns + '</div>' +
        '<h2>Region Usage</h2>' +
        '<div class="sr"><span class="sl">temp</span>' + bar(tempU, tempT, 'temp') + '</div>' +
        '<div class="sr"><span class="sl">session</span>' + bar(sessU, sessT, 'session') + '</div>' +
        '<div class="sr"><span class="sl">sram</span>' + bar(sramU, sramT, 'sram') + '</div>' +
        '</div>' +
        '<div class="panels">' +
        '<div class="left-panel">' +
        '<div class="ph">WRAM ' + radarH(rowStart) + '\u2013' + radarH(rowEnd - 1) + '</div>' +
        '<div class="gw">' + gridHtml + '</div>' +
        '</div>' +
        '<div class="right-panel"><div class="dt-wrap">' +
        '<table><thead><tr><th>Addr</th><th>Name</th><th>T</th><th>Notes</th><th>Lines</th></tr></thead>' +
        '<tbody>' + (poolRows || '') + detailRows + '</tbody></table></div></div>' +
        '</div>' +
        '</div>' +
        '<div class="tab-pane" data-tab="rooms" style="display:none">' +
        '<div class="rm-panels">' +
        '<div class="rm-left"><div class="rm-ph">Rooms</div>' + treeHtml + '</div>' +
        '<div class="rm-right"><div id="room-detail" class="rm-detail-placeholder"><span>Select a room</span></div></div>' +
        '</div>' +
        '</div>' +
        '<script>' + js + '<\/script></body></html>';
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

    // Invalidate memory map cache when memory-map.md changes
    const mapWatcher = vscode.workspace.createFileSystemWatcher('**/.github/memory-map.md');
    mapWatcher.onDidChange(() => invalidateRadarMap());
    mapWatcher.onDidCreate(() => invalidateRadarMap());
    context.subscriptions.push(mapWatcher);

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
            const editor   = vscode.window.activeTextEditor;
            const document = (doc && typeof doc.lineCount === 'number') ? doc : editor?.document;
            if (!document) {
                vscode.window.showWarningMessage('No active Everscript file.');
                return;
            }
            const cursorLine   = typeof startLine === 'number' ? startLine : (editor?.selection.active.line ?? 0);
            _radarDoc          = document;
            const scope        = radarDetectScope(document, cursorLine);
            _radarCurrentScope = scope;
            const { refs, pools } = radarAnalyzeScope(document, scope.startLine, scope.endLine);
            const mapByAddr    = getRadarMap();
            const wsRoot       = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? null;
            const wsRootUri    = wsRoot ? vscode.Uri.file(wsRoot) : null;

            // Reuse existing panel if open; otherwise create a new one
            if (!_radarPanel) {
                _radarPanel = vscode.window.createWebviewPanel(
                    'everscriptRadar',
                    'Radar: ' + scope.name,
                    vscode.ViewColumn.Beside,
                    {
                        enableScripts: true,
                        retainContextWhenHidden: true,
                        localResourceRoots: wsRootUri ? [wsRootUri] : [],
                    },
                );
                _radarPanel.onDidDispose(() => {
                    _radarPanel = null;
                    _radarPinned = false;
                    _radarCurrentScope = null;
                    _radarRoomTree = null;
                    _radarRoomDocPath = null;
                    _radarActiveTab = 'radar';
                }, null, context.subscriptions);
            } else {
                _radarPanel.title = 'Radar: ' + scope.name;
                _radarPanel.reveal(vscode.ViewColumn.Beside, true);
            }

            // Build or reuse room tree (rebuild when document changes)
            if (_radarRoomDocPath !== document.uri.fsPath) {
                _radarRoomTree    = buildRoomTree(document, wsRoot);
                _radarRoomDocPath = document.uri.fsPath;
                setRoomImageUris(_radarRoomTree, _radarPanel.webview);
            }

            const selectedMap = scope.kind === 'map' ? scope.name : null;
            _radarPanel.webview.html = renderRadarHtml(scope, refs, pools, mapByAddr, _radarRoomTree, _radarActiveTab, selectedMap);

            // Handle messages from the webview
            _radarPanel.webview.onDidReceiveMessage(msg => {
                if (msg.command === 'goToLine') {
                    const line = Math.max(0, Math.min(Number(msg.line), document.lineCount - 1));
                    const pos  = new vscode.Position(line, 0);
                    const range = new vscode.Range(pos, pos);
                    const ed = vscode.window.visibleTextEditors.find(e => e.document === _radarDoc)
                            || vscode.window.activeTextEditor;
                    if (ed) {
                        ed.selection = new vscode.Selection(pos, pos);
                        ed.revealRange(range, vscode.TextEditorRevealType.InCenterIfOutsideViewport);
                        vscode.window.showTextDocument(ed.document, ed.viewColumn);
                    }
                } else if (msg.command === 'pin') {
                    _radarPinned = true;
                } else if (msg.command === 'unpin') {
                    _radarPinned = false;
                } else if (msg.command === 'tabChange') {
                    _radarActiveTab = msg.tab || 'radar';
                } else if (msg.command === 'globalScope') {
                    _radarPinned = true; // freeze auto-updates while in global view
                    if (_radarDoc) {
                        const gscope = { kind: 'global', name: _radarDoc.fileName.split(/[\/\\]/).pop(), startLine: 0, endLine: _radarDoc.lineCount - 1 };
                        const { refs, pools } = radarAnalyzeScope(_radarDoc, 0, _radarDoc.lineCount - 1);
                        _radarPanel.webview.html = renderRadarHtml(gscope, refs, pools, getRadarMap(), _radarRoomTree || [], _radarActiveTab, null);
                        _radarPanel.title = 'Radar: (global)';
                    }
                } else if (msg.command === 'autoScope') {
                    _radarPinned = false;
                    refreshRadar(vscode.window.activeTextEditor);
                }
            }, undefined, context.subscriptions);
        }),

        // Auto-update radar when active editor changes
        vscode.window.onDidChangeActiveTextEditor(ed => {
            clearTimeout(_radarUpdateTimer);
            _radarUpdateTimer = setTimeout(() => refreshRadar(ed), 400);
        }),

        // Auto-update radar when cursor moves to a different scope
        vscode.window.onDidChangeTextEditorSelection(e => {
            if (_radarPinned) return;
            clearTimeout(_radarUpdateTimer);
            _radarUpdateTimer = setTimeout(() => refreshRadar(e.textEditor), 600);
        }),

    );
}

function deactivate() {}

module.exports = { activate, deactivate };
