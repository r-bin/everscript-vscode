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
    const refs      = radarAnalyzeScope(doc, scope.startLine, scope.endLine);
    const mapByAddr = getRadarMap();
    _radarPanel.webview.html = renderRadarHtml(scope, refs, mapByAddr);
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
    // Map<addr, { reads: number[], writes: number[], sources: string[] }>
    const refs = new Map();
    const add = (addr, line, source, isWrite) => {
        if (!refs.has(addr)) refs.set(addr, { reads: [], writes: [], sources: [] });
        const r = refs.get(addr);
        if (isWrite) { if (!r.writes.includes(line)) r.writes.push(line); }
        else         { if (!r.reads.includes(line))  r.reads.push(line); }
        if (!r.sources.includes(source)) r.sources.push(source);
    };
    // Detect write: <0xADDR...> = or memory(0xADDR...) =  (not ==, !=, <=, >=)
    const isWrite = (text, hexLit) => {
        const h = hexLit.replace(/^0x/i, '');
        return new RegExp('<\\s*0x' + h + '[^>]*>\\s*(?:[+\\-*\\/&|^]|<<|>>)?=(?!=)', 'i').test(text) ||
               new RegExp('memory\\s*\\(\\s*0x' + h + '[^)]*\\)\\s*(?:[+\\-*\\/&|^]|<<|>>)?=(?!=)', 'i').test(text);
    };
    for (let i = startLine; i <= endLine; i++) {
        const text = document.lineAt(i).text.replace(/\/\/.*$/, '');
        for (const m of text.matchAll(/\bmemory\s*\(\s*(0x[0-9a-fA-F]+)/g)) {
            const a = parseInt(m[1], 16);
            if (!isNaN(a)) add(a, i, 'memory()', isWrite(text, m[1]));
        }
        for (const m of text.matchAll(/<\s*(0x[0-9a-fA-F]+)/g)) {
            const a = parseInt(m[1], 16);
            if (!isNaN(a)) add(a, i, '<deref>', isWrite(text, m[1]));
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
        const m = cells[0].match(/0x([0-9a-fA-F]{4})(?:[^0-9a-fA-F]*0x([0-9a-fA-F]{4}))?/);
        if (!m) continue;
        const start = parseInt(m[1], 16), end = m[2] ? parseInt(m[2], 16) : start;
        // Strip HTML tags from notes (memory-map.md uses <br>, etc.)
        const notes = (cells[3] || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        const typeStr = cells[2] || '';
        const isWord = /\bWord\b/i.test(typeStr);
        // Extend Word entries to cover both bytes when only a single address is given
        const effectiveEnd = (isWord && end === start) ? start + 1 : end;
        const entry = {
            name: cells[1], type: typeStr, notes,
            lifecycle: radarLifecycle(start, typeStr, notes),
            isWord, addrStart: start, addrEnd: effectiveEnd,
        };
        for (let a = start; a <= effectiveEnd; a++) if (!map.has(a)) map.set(a, entry);
    }
    return map;
}

function radarLifecycle(addr, type, notes) {
    // Regions as defined in the linker (main.evs):
    //   temp    0x2834–0x28FF  compiler TEMP RAM — cleared on room load
    //   session 0x2200–0x27FF  SRAM/session range — persistent across rooms
    //   sram    [SRAM]-tagged  battery-backed saves (checked by tag)
    //   system  everything else
    if (addr >= 0x2834 && addr <= 0x28FF) return 'temp';
    if (addr >= 0x2200 && addr <= 0x27FF) return 'session';
    const hay = (type + ' ' + notes).toLowerCase();
    if (hay.includes('sram')) return 'sram';
    return 'system';
}

function radarExtractEmoji(str) {
    const m = str.match(/\p{Extended_Pictographic}/u);
    return m ? m[0] : '';
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
            lc: me.lifecycle, notes: me.notes,
            addrStart: me.addrStart, addrEnd: me.addrEnd,
            emoji: radarExtractEmoji(me.name + ' ' + me.notes),
            reads: usage ? usage.reads : [],
            writes: usage ? usage.writes : [],
        };
    }
    for (const [addr, usage] of refs) {
        if (!cellData[addr]) {
            const lc = radarLifecycle(addr, '', '');
            cellData[addr] = {
                addr: radarH(addr), name: '(unknown)', type: '?',
                lc, notes: '', addrStart: addr, addrEnd: addr, emoji: '',
                reads: usage.reads, writes: usage.writes,
            };
        }
    }

    // Grid HTML
    let gridHtml = '';
    for (let base = rowStart; base < rowEnd; base += COLS) {
        let cells = '', rowLcs = new Set(), allRest = true, rowHasUsed = false;
        for (let col = 0; col < COLS; col++) {
            const addr  = base + col;
            const me    = mapByAddr.get(addr);
            const usage = refs.get(addr);
            const lc    = me ? me.lifecycle : radarLifecycle(addr, '', '');
            const isUsed = !!usage;
            const isRest = !me && !isUsed;
            if (!isRest) { allRest = false; rowLcs.add(lc); }
            if (isUsed) rowHasUsed = true;
            let cls = 'cell lc-' + lc;
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
                    ' data-used="' + (rowHasUsed ? '1' : '0') + '">' +
                    '<span class="rl">' + radarH(base) + '</span>' + cells + '</div>';
    }

    // Detail table — one row per unique entry
    const seenE = new Set();
    const detailRows = [...mapByAddr.entries()]
        .sort((a, b) => a[0] - b[0])
        .filter(([, e]) => { if (seenE.has(e)) return false; seenE.add(e); return true; })
        .map(([addr, e]) => {
            const usage  = refs.get(addr);
            const rLinks = usage ? usage.reads.map(l =>
                '<a class="ll" data-line="' + l + '" title="Jump to line ' + (l+1) + '">:' + (l+1) + '</a>').join('') : '';
            const wLinks = usage ? usage.writes.map(l =>
                '<a class="ll lw" data-line="' + l + '" title="Jump to line ' + (l+1) + '">:' + (l+1) + '</a>').join('') : '';
            const linesCell = (rLinks || wLinks)
                ? (wLinks ? '<span class="rw-w">' + wLinks + '</span>' : '') +
                  (rLinks ? '<span class="rw-r">' + rLinks + '</span>' : '')
                : '&ndash;';
            const em = radarExtractEmoji(e.name + ' ' + e.notes);
            return '<tr id="dr-' + addr + '" class="dr lc-' + e.lifecycle + (usage ? ' du' : '') + '"' +
                   ' data-addr="' + addr + '">' +
                   '<td class="mo">' + (em ? '<span class="te">' + em + '</span>' : '') + radarH(addr) + '</td>' +
                   '<td>' + radarEsc(e.name) + '</td>' +
                   '<td class="mt">' + radarEsc(e.type) + '</td>' +
                   '<td><span class="chip ch-' + e.lifecycle + '">' + e.lifecycle + '</span></td>' +
                   '<td class="nt">' + radarEsc(e.notes) + '</td>' +
                   '<td class="rwc">' + linesCell + '</td></tr>';
        }).join('');

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
.right-panel{overflow-y:auto;flex:1;min-width:0;padding-bottom:8px}
.ph{font-size:9px;text-transform:uppercase;letter-spacing:.08em;opacity:.32;padding:3px 0 2px;font-weight:700;position:sticky;top:0;background:var(--vscode-editor-background);z-index:2;margin-bottom:2px}
.filters{display:flex;flex-wrap:wrap;gap:3px;margin-bottom:6px;align-items:center}
.fb{border:1px solid #333;border-radius:10px;padding:1px 7px;cursor:pointer;font-size:10px;background:transparent;color:inherit;opacity:.3}
.fb.on{opacity:1}
.fb.ft{border-color:#388bfd;color:#6cb6ff}.fb.fs{border-color:#ffa94d;color:#ffa94d}
.fb.fr2{border-color:#3fb950;color:#56d364}.fb.fy{border-color:#666;color:#999}
.fb.frest{border-color:#333;color:#555}.fb.fboring{border-color:#666;color:#888}
.fb.femoji{border-color:#888;color:#aaa}.fb.ffollow{border-color:#a060ff;color:#c090ff}
.fb.fpin{border-color:#ff9040;color:#ffb060}.fb.fpin.on{border-color:#ff9040}
.sep{width:1px;height:14px;background:#333;margin:0 2px}
.sr{display:flex;align-items:center;gap:5px;margin-bottom:2px;font-size:10px}
.sl{width:44px;opacity:.45;flex-shrink:0}
.bo{flex:1;height:4px;background:#181818;border-radius:2px;max-width:80px;overflow:hidden}
.bi{height:100%;border-radius:2px;min-width:1px}
.bi-temp{background:#388bfd}.bi-session{background:#ffa94d}.bi-sram{background:#3fb950}
.bl{font-size:9px;opacity:.38;white-space:nowrap}
.gw{margin:4px 0}
.gr{display:flex;align-items:center;gap:1px;margin-bottom:1px;flex-shrink:0}
.rl{font-size:7px;opacity:.2;width:36px;flex-shrink:0;user-select:none;letter-spacing:-.02em}
.cell{display:inline-block;width:9px;height:9px;border-radius:1px;background:#0a0a0a;flex-shrink:0;cursor:pointer;position:relative;overflow:hidden;vertical-align:top;font-size:0;line-height:0}
.cell:hover{outline:1.5px solid rgba(255,255,255,.65);z-index:2}
.cell.chi{outline:1.5px solid rgba(255,255,255,.3)!important;filter:brightness(1.4)}
.cell.cursor{outline:2px solid rgba(255,255,255,.9)!important;z-index:3}
.lc-temp{background:#152840}.lc-session{background:#2a1800}.lc-sram{background:#0a2010}.lc-system{background:#1a1a20}
.cu.lc-temp{background:#388bfd}.cu.lc-session{background:#ffa94d}.cu.lc-sram{background:#3fb950}.cu.lc-system{background:#7777cc}
.cw.cu{box-shadow:inset 0 0 0 1.5px #ff7b72}.crw.cu{box-shadow:inset 0 0 0 1.5px #f2cc60}
.cr{background:#060606!important;opacity:.1}
body.ht .cell.lc-temp:not(.cursor){opacity:0;pointer-events:none}
body.hs .cell.lc-session:not(.cursor){opacity:0;pointer-events:none}
body.hr2 .cell.lc-sram:not(.cursor){opacity:0;pointer-events:none}
body.hsy .cell.lc-system:not(.cursor){opacity:0;pointer-events:none}
.gr.hrow{display:none!important}
body.emoji .cell[data-emoji]::before{content:attr(data-emoji);font-size:6px;line-height:9px;display:block;text-align:center;pointer-events:none}
#popup{display:none;position:fixed;top:8px;right:8px;width:220px;max-height:72vh;overflow-y:auto;
  background:#1c1c1c;border:1px solid #333;border-radius:6px;padding:8px;font-size:10px;z-index:100;box-shadow:0 4px 24px rgba(0,0,0,.7)}
#popup.vis{display:block}
.px{float:right;cursor:pointer;opacity:.35;font-size:12px;margin-left:4px}.px:hover{opacity:.9}
.pa{font-weight:700;font-size:11px;margin-bottom:1px}.pn{opacity:.75;margin-bottom:1px}.pt{opacity:.4;font-size:9px}
#popup h3{font-size:8px;text-transform:uppercase;letter-spacing:.08em;opacity:.35;margin:7px 0 2px;border-top:1px solid #222;padding-top:5px}
#popup h3:first-of-type{margin-top:4px}.pw{color:#ff9f9f}.pr{color:#9fcfff}
table{width:100%;border-collapse:collapse;font-size:10px;margin-top:2px}
th,td{border:1px solid #1a1a1a;padding:2px 4px;vertical-align:top}
th{background:#101010;position:sticky;top:0;font-weight:600;text-align:left;font-size:8px}
tr.dr{cursor:pointer}tr.dr:hover td{background:rgba(255,255,255,.03)}
.du td{background:rgba(255,255,255,.01)}
.lc-temp td:first-child{border-left:2px solid #388bfd}
.lc-session.du td:first-child{border-left:2px solid #ffa94d}
.lc-sram.du td:first-child{border-left:2px solid #3fb950}
tr.sel td{background:rgba(255,200,50,.08)!important;outline:1px solid rgba(255,200,50,.15)}
.mo{font-size:9px;white-space:nowrap}.mt{opacity:.4;font-size:9px}
.nt{opacity:.38;font-size:9px;max-width:80px;word-break:break-word}
.rwc{white-space:nowrap;font-size:9px}.rw-w a{color:#ff9f9f}.rw-r a{color:#9fcfff}
.chip{border-radius:5px;padding:0 3px;font-size:8px;border:1px solid transparent}
.ch-temp{border-color:#388bfd;color:#6cb6ff}.ch-session{border-color:#ffa94d;color:#ffa94d}
.ch-sram{border-color:#3fb950;color:#56d364}.ch-system{border-color:#555;color:#888}
a.ll{color:#9fcfff;cursor:pointer;text-decoration:none}a.ll.lw{color:#ff9f9f}a.ll:hover{text-decoration:underline}
.te{margin-right:2px;font-size:9px}`;

    const js = `(function(){
var vs=typeof acquireVsCodeApi==='function'?acquireVsCodeApi():null;
${jsData}
var hidden=new Set(['rest']);
var hideBoring=false,followMode=false,emojiMode=false;
var BTN_LC={ft:'temp',fs:'session',fr2:'sram',fy:'system',frest:'rest'};
var BTN_BODY={ft:'ht',fs:'hs',fr2:'hr2',fy:'hsy'};
// Initialize: rest hidden by default
document.body.classList.add('hrest');
function recomputeRows(){
  document.querySelectorAll('.gr').forEach(function(row){
    var isGar=row.classList.contains('gar');
    if(isGar){row.classList.toggle('hrow',hidden.has('rest'));return;}
    var lcs=(row.dataset.lcs||'').split(' ').filter(Boolean);
    var allHidden=lcs.length>0&&lcs.every(function(lc){return hidden.has(lc);});
    var isUsed=row.dataset.used==='1';
    row.classList.toggle('hrow',allHidden||(hideBoring&&!isUsed));
  });
}
// Region filter buttons
document.querySelectorAll('.fb[data-cls]').forEach(function(b){
  var k=b.dataset.cls;
  if(!BTN_LC[k])return;
  b.addEventListener('click',function(){
    b.classList.toggle('on');
    var on=b.classList.contains('on');
    var lc=BTN_LC[k];
    if(on)hidden.delete(lc);else hidden.add(lc);
    // Region filters use body class for cell visibility (cells remain in DOM but hidden)
    if(BTN_BODY[k])document.body.classList.toggle(BTN_BODY[k],!on);
    recomputeRows();
  });
});
// rest button (gar rows only, no body class needed — hrow handles it)
var restBtn=document.querySelector('.fb.frest');
if(restBtn)restBtn.addEventListener('click',function(){
  restBtn.classList.toggle('on');
  var on=restBtn.classList.contains('on');
  if(on)hidden.delete('rest');else hidden.add('rest');
  recomputeRows();
});
// Boring filter
var boringBtn=document.getElementById('btn-boring');
if(boringBtn)boringBtn.addEventListener('click',function(){
  hideBoring=!hideBoring;
  boringBtn.classList.toggle('on',hideBoring);
  recomputeRows();
});
// Emoji toggle
var emojiBtn=document.getElementById('btn-emoji');
if(emojiBtn)emojiBtn.addEventListener('click',function(){
  emojiMode=!emojiMode;
  emojiBtn.classList.toggle('on',emojiMode);
  document.body.classList.toggle('emoji',emojiMode);
});
// Follow toggle (auto-scroll detail table on grid cell click)
var followBtn=document.getElementById('btn-follow');
if(followBtn)followBtn.addEventListener('click',function(){
  followMode=!followMode;
  followBtn.classList.toggle('on',followMode);
});
// Pin toggle (stop auto-update from editor)
var pinBtn=document.getElementById('btn-pin');
if(pinBtn)pinBtn.addEventListener('click',function(){
  var pinned=pinBtn.classList.toggle('on');
  if(vs)vs.postMessage({command:pinned?'pin':'unpin'});
});
// Popup
var popup=document.getElementById('popup');
function closePopup(){popup.classList.remove('vis');}
document.getElementById('px').addEventListener('click',closePopup);
function goToLine(l){if(vs)vs.postMessage({command:'goToLine',line:l});}
function bindLinks(root){
  root.querySelectorAll('a.ll').forEach(function(a){
    a.addEventListener('click',function(e){e.preventDefault();e.stopPropagation();goToLine(parseInt(a.dataset.line));});
  });
}
function showPopup(d){
  var wLinks=d.writes.map(function(l){return '<a class="ll pw" data-line="'+l+'">line '+(l+1)+'</a>';}).join(' ');
  var rLinks=d.reads.map(function(l){return '<a class="ll pr" data-line="'+l+'">line '+(l+1)+'</a>';}).join(' ');
  var html='<span class="px" id="px2">&#x2715;</span>'+
    '<div class="pa">'+(d.emoji?d.emoji+' ':'')+d.addr+'</div>'+
    '<div class="pn">'+d.name+'</div>'+
    '<div class="pt">'+d.type+' &bull; '+d.lc+'</div>';
  if(d.notes)html+='<h3>Vanilla notes</h3><div class="pt">'+d.notes+'</div>';
  if(wLinks)html+='<h3>Writes (destructive)</h3><div class="pw">'+wLinks+'</div>';
  if(rLinks)html+='<h3>Reads (non-destructive)</h3><div class="pr">'+rLinks+'</div>';
  if(!wLinks&&!rLinks)html+='<h3>Not used in scope</h3>';
  popup.innerHTML=html;
  popup.classList.add('vis');
  bindLinks(popup);
  popup.querySelector('#px2').addEventListener('click',closePopup);
}
// Cursor: highlight ALL cells in the entry's address range
function setCursor(addr){
  document.querySelectorAll('.cursor').forEach(function(x){x.classList.remove('cursor');});
  var d=CELLS[addr];
  var start=d?d.addrStart:addr,end=d?d.addrEnd:addr;
  for(var a=start;a<=end;a++){
    var c=document.querySelector('.cell[data-addr="'+a+'"]');
    if(c)c.classList.add('cursor');
  }
  var first=document.querySelector('.cell[data-addr="'+start+'"]');
  if(first)first.scrollIntoView({behavior:'smooth',block:'nearest'});
}
// Detail row selection
function selectDetailRow(addr){
  document.querySelectorAll('tr.sel').forEach(function(r){r.classList.remove('sel');});
  var d=CELLS[addr];
  var start=d?d.addrStart:addr, end=d?d.addrEnd:addr;
  for(var a=start;a<=end;a++){
    var row=document.getElementById('dr-'+a);
    if(row)row.classList.add('sel');
  }
  if(followMode){
    var firstRow=document.getElementById('dr-'+start);
    if(firstRow)firstRow.scrollIntoView({behavior:'smooth',block:'center'});
  }
}
// Grid cell interactions
document.querySelectorAll('.cell').forEach(function(c){
  var addr=parseInt(c.dataset.addr);
  c.addEventListener('click',function(){
    setCursor(addr);
    selectDetailRow(addr);
    var d=CELLS[addr];
    if(d)showPopup(d);
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
// Detail row click → highlight grid cell
document.querySelectorAll('tr.dr').forEach(function(row){
  row.addEventListener('click',function(e){
    if(e.target.classList.contains('ll'))return;
    var addr=parseInt(row.dataset.addr);
    setCursor(addr);
    selectDetailRow(addr);
    var d=CELLS[addr];
    if(d)showPopup(d);
  });
});
bindLinks(document.querySelector('.dt-wrap'));
// Group coloring: assign a colored bottom-border stripe to multi-byte entries
(function(){
  var gPal=['#5599ff','#ff8833','#33cc77','#ff44bb','#ccff33','#33bbff','#ff9944','#9933ff','#ff3344','#33ffcc'];
  var gCol={},gIdx=0;
  document.querySelectorAll('.cell[data-gid]').forEach(function(c){
    var gid=c.dataset.gid;
    if(!gCol[gid])gCol[gid]=gPal[gIdx++%gPal.length];
    c.style.borderBottom='2px solid '+gCol[gid];
  });
})();
recomputeRows();
})();`;

    const btns =
        '<button class="fb ft on" data-cls="ft" title="temp 0x2800\u20130x28FF: cleared on room load">temp</button>' +
        '<button class="fb fs on" data-cls="fs" title="session 0x2200\u20130x27FF: persistent across rooms">session</button>' +
        '<button class="fb fr2 on" data-cls="fr2" title="sram: battery-backed, tagged [SRAM]">sram</button>' +
        '<button class="fb fy on" data-cls="fy" title="system: engine/HW registers">system</button>' +
        '<button class="fb frest" data-cls="frest" title="rest: undocumented addresses (hidden by default)">rest</button>' +
        '<span class="sep"></span>' +
        '<button class="fb fboring" id="btn-boring" title="Hide boring: rows with no cells used in scope">boring</button>' +
        '<button class="fb femoji" id="btn-emoji" title="Show emoji in grid cells">emoji</button>' +
        '<button class="fb ffollow" id="btn-follow" title="Follow: auto-scroll detail table to selection">follow</button>' +
        '<button class="fb fpin" id="btn-pin" title="Pin: lock to current scope, stop auto-update">pin</button>';

    return '<!doctype html><html><head><meta charset="utf-8"><style>' + css + '</style></head>' +
        '<body class="hrest">' +
        '<div id="popup"><span class="px" id="px">&#x2715;</span></div>' +
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
        '<table><thead><tr><th>Addr</th><th>Name</th><th>T</th><th>Rgn</th><th>Notes</th><th>Lines</th></tr></thead>' +
        '<tbody>' + detailRows + '</tbody></table></div></div>' +
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
            const refs         = radarAnalyzeScope(document, scope.startLine, scope.endLine);
            const mapByAddr    = getRadarMap();

            // Reuse existing panel if open; otherwise create a new one
            if (!_radarPanel) {
                _radarPanel = vscode.window.createWebviewPanel(
                    'everscriptRadar',
                    'Radar: ' + scope.name,
                    vscode.ViewColumn.Beside,
                    { enableScripts: true, retainContextWhenHidden: true },
                );
                _radarPanel.onDidDispose(() => {
                    _radarPanel = null;
                    _radarPinned = false;
                    _radarCurrentScope = null;
                }, null, context.subscriptions);
            } else {
                _radarPanel.title = 'Radar: ' + scope.name;
                _radarPanel.reveal(vscode.ViewColumn.Beside, true);
            }

            _radarPanel.webview.html = renderRadarHtml(scope, refs, mapByAddr);

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
