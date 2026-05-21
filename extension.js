'use strict';

const vscode = require('vscode');
const path   = require('path');
const fs     = require('fs');
const { radarLifecycle, radarH, radarEsc, radarExtractEmoji, radarParseName, radarParseNotes, parseEvsNum, parseEnumsFromContent, parseEvsEnumValues } = require('./memory_radar/radar-utils');
const radarWebview = require('./memory_radar/webview');


// ── Data loading ──────────────────────────────────────────────────────────────

let _index = null;

function loadIndex(context) {
    if (_index) return _index;
    const p = path.join(context.extensionPath, 'code_highlighter', 'data', 'index.json');
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
        return [...getFunctionCompletions(idx), ...getWorkspaceFunctionCompletions(), ...getEnumNameCompletions(idx), '<pre class="doc-code">atk_underflow = (boy_atk - subtract) mod 65536\nw = ~((def\u00f74 - atk_underflow) - 1) &amp; 0xFFFF\nseed = hi16((w+1)\u00d7rng16)\na = (seed + w) mod 65536\ndmg = ((((a \u226a 1) mod 65536) + w + carry(a \u226a 1)) mod 65536) \u00bb 2\nshown = min(999, dmg)</pre>'];
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
let _radarEnumCache    = null;   // cached enum cross-reference (addr→[{cls,name}])
let _radarMapEnumCache = null;   // cached MAP enum (enumName→numericId)
let _radarScriptAllCache = null; // cached stripped script_all text
let _radarUpdateTimer  = null;   // debounce timer for auto-update
let _radarRoomTree     = null;   // cached room tree (rebuilt when doc changes)
let _radarRoomDocPath  = null;   // fsPath the room tree was built for
let _radarActiveTab    = 'radar'; // preserved tab across re-renders
let _scalingChars      = null;   // cached character stat array (142 entries from ROM)
let _hitLookup         = null;   // precomputed hit% table {hit_rate:{evade:pct}} from ROM
let _scaleActive       = false;  // whether scale_enemies is active in workspace
let _ingrBaseUri       = '';     // webview URI base for ingredient images (set on panel creation)

function getRadarMap() {
    if (_radarMapCache) return _radarMapCache;
    const wf = vscode.workspace.workspaceFolders?.[0];
    if (!wf) return new Map();
    _radarMapCache = radarReadMemoryMap(path.join(wf.uri.fsPath, '.github', 'memory-map.md'));
    return _radarMapCache;
}

function getRadarMap() {
    if (_radarMapCache) return _radarMapCache;
    const wf = vscode.workspace.workspaceFolders?.[0];
    if (!wf) return new Map();
    _radarMapCache = radarReadMemoryMap(path.join(wf.uri.fsPath, '.github', 'memory-map.md'));
    return _radarMapCache;
}

function invalidateRadarMap() { _radarMapCache = null; }

/**
 * Read extension settings with workspace-based defaults.
 * All values are mocked / defaulted for now; will be user-configurable at release.
 */
function getExtConfig() {
    const cfg    = vscode.workspace.getConfiguration('everscript');
    const wsRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? null;
    return {
        inDir:       cfg.get('inDirectory')      || (wsRoot ? path.join(wsRoot, 'in')       : null),
        patchesDir:  cfg.get('patchesDirectory') || (wsRoot ? path.join(wsRoot, 'patches')  : null),
        romPath:     cfg.get('romPath')          || (wsRoot ? path.join(wsRoot, 'Secret of Evermore (U) [!].smc') : null),
        // NOTE: assetsPath will move to extension-bundled assets before release (see docs/release-checklist.md)
        assetsPath:  cfg.get('assetsPath')       || '/Users/v/Documents/assets',
    };
}

/** Static vanilla room list extracted from SoETilesViewer/SoEScriptDumper/data.h */
const VANILLA_ROOMS = [
    { area: 'Prehistoria', rooms: [
        { id: '0x38', name: 'South jungle / Start' },
        { id: '0x33', name: "Strong Heart's Exterior" },
        { id: '0x34', name: "Strong Heart's Hut" },
        { id: '0x5c', name: 'Raptors' },
        { id: '0x25', name: "Fire Eyes' Village" },
        { id: '0x51', name: "Village Huts and Blimp's Hut" },
        { id: '0x26', name: 'West area with Defend' },
        { id: '0x5b', name: 'East jungle' },
        { id: '0x59', name: 'Quick sand desert' },
        { id: '0x67', name: 'Bugmuck exterior' },
        { id: '0x16', name: 'BBM' },
        { id: '0x17', name: 'Bug room 2' },
        { id: '0x18', name: "Thraxx' room" },
        { id: '0x5a', name: 'Acid rain guy' },
        { id: '0x41', name: 'North jungle' },
        { id: '0x27', name: 'Mammoth Graveyard' },
        { id: '0x69', name: 'Volcano path' },
        { id: '0x52', name: 'Top of Volcano' },
        { id: '0x50', name: 'Sky above Volcano' },
        { id: '0x66', name: 'West of swamp' },
        { id: '0x65', name: 'Swamp (main area)' },
        { id: '0x01', name: "Exterior of Blimp's Hut" },
        { id: '0x3c', name: 'Volcano Room 1' },
        { id: '0x3b', name: 'Volcano Room 2' },
        { id: '0x3d', name: 'Pipe maze' },
        { id: '0x3e', name: 'Side rooms of pipe maze' },
        { id: '0x3f', name: 'Volcano Boss Room' },
        { id: '0x36', name: 'Both fire pits (one room)' },
    ]},
    { area: 'Antiqua', rooms: [
        { id: '0x53', name: 'Act 2 Start Cutscene' },
        { id: '0x6a', name: 'Act 2 Start Cutscene - waterfall' },
        { id: '0x0a', name: 'Nobilia, Market' },
        { id: '0x08', name: 'Nobilia, Square' },
        { id: '0x09', name: 'Nobilia, Square during Aegis fight' },
        { id: '0x1e', name: 'Nobilia, Arena Holding Room' },
        { id: '0x1d', name: 'Nobilia, Arena (Vigor Fight)' },
        { id: '0x4c', name: 'Nobilia, Fountain and snake statues' },
        { id: '0x0b', name: 'Nobilia, Palace grounds' },
        { id: '0x4d', name: 'Nobilia, Inside palace (Horace cutscene)' },
        { id: '0x3a', name: 'Nobilia, Fire pit' },
        { id: '0x0c', name: 'Nobilia, Inn' },
        { id: '0x1c', name: 'Nobilia, North of Market' },
        { id: '0x1b', name: 'Desert of Doom' },
        { id: '0x6b', name: 'Waterfall' },
        { id: '0x05', name: "Between 'mids and halls" },
        { id: '0x07', name: 'West of Crustacia' },
        { id: '0x4f', name: 'East of Crustacia' },
        { id: '0x2e', name: "Blimp's Cave" },
        { id: '0x68', name: 'Crustacia exterior' },
        { id: '0x30', name: 'Crustacia inside pirate ship' },
        { id: '0x04', name: 'Crustacia fire pit' },
        { id: '0x2f', name: "Horace's camp" },
        { id: '0x06', name: "Outside of 'mids" },
        { id: '0x64', name: "Cave entrance under 'mids" },
        { id: '0x55', name: "'mids bottom level (Dog start)" },
        { id: '0x56', name: "'mids top level (Boy start)" },
        { id: '0x57', name: "'mids basement level (Tiny)" },
        { id: '0x58', name: "'mids boss room (Rimsala)" },
        { id: '0x2b', name: 'Outside of halls' },
        { id: '0x29', name: 'Halls main room' },
        { id: '0x23', name: 'Halls SW' },
        { id: '0x24', name: 'Halls NW' },
        { id: '0x2c', name: 'Halls SE' },
        { id: '0x2d', name: 'Halls NE' },
        { id: '0x28', name: 'Halls Collapsing Bridge' },
        { id: '0x2a', name: 'Halls Boss Room' },
        { id: '0x4b', name: 'Oglin cave' },
        { id: '0x6d', name: 'Aquagoth Room' },
        { id: '0x35', name: 'Quicksand/Bugmuck/Volcano caves + West Alchemy Cave' },
    ]},
    { area: 'Gothica', rooms: [
        { id: '0x12', name: 'Ebon Keep sewers' },
        { id: '0x13', name: 'Between Ebon Keep sewers, Dark Forest and Swamp' },
        { id: '0x40', name: "Swamp south of Gomi's Tower" },
        { id: '0x37', name: "Gomi's Tower" },
        { id: '0x20', name: 'Timberdrake room in forest' },
        { id: '0x1f', name: 'Doubles room in forest' },
        { id: '0x22', name: 'Dark Forest' },
        { id: '0x21', name: 'Dark Forest entrance (save point)' },
        { id: '0x6c', name: 'SE of Ivor Tower (Well)' },
        { id: '0x76', name: 'South of Ivor Tower (Gate)' },
        { id: '0x7b', name: 'Ebon Keep and Ivor Tower Exterior Bottom Half' },
        { id: '0x7c', name: 'Ebon Keep and Ivor Tower Exterior Top Half' },
        { id: '0x7d', name: 'Ebon Keep and Ivor Tower Interior' },
        { id: '0x4e', name: 'Ivor Tower, west alley (market)' },
        { id: '0x62', name: 'Ivor Tower, west square (trailers)' },
        { id: '0x63', name: 'Ivor Tower, inside trailers' },
        { id: '0x19', name: 'Chessboard' },
        { id: '0x1a', name: 'Below chessboard' },
        { id: '0x74', name: 'Ebon Keep and Ivor Tower dungeon + pipe room' },
        { id: '0x0d', name: 'Ebon Keep Hall (Stairs, behind Verm)' },
        { id: '0x0f', name: 'Ebon Keep West Room (Naris)' },
        { id: '0x11', name: "Ebon Keep Queen's Room" },
        { id: '0x10', name: 'Ebon Keep Stained Glass Hallway' },
        { id: '0x14', name: "Ebon Keep Tinker's Room" },
        { id: '0x39', name: 'Ebon Keep Fire pit' },
        { id: '0x0e', name: 'Ebon Keep Dining Room' },
        { id: '0x5d', name: 'Ebon Keep Courtyard (South of Verm)' },
        { id: '0x5e', name: 'Ebon Keep Front Room (Verm)' },
        { id: '0x5f', name: 'Ebon Keep Verm side rooms' },
        { id: '0x60', name: 'Ebon Keep Storage Room' },
        { id: '0x6e', name: 'Ivor Tower Hall' },
        { id: '0x6f', name: 'Ivor Tower Dining Room' },
        { id: '0x70', name: 'Ivor Tower Exterior Bridges and Balconies' },
        { id: '0x71', name: 'Ivor Tower East Room + Kitchen' },
        { id: '0x72', name: 'Ivor Tower East Upper Floor' },
        { id: '0x73', name: 'Ivor Tower Dog Maze Underground' },
        { id: '0x75', name: 'Ivor Tower Stairwell to dungeon' },
        { id: '0x79', name: 'Ivor Tower Sewers' },
        { id: '0x7a', name: 'Ivor Tower Sewers Exterior (landing spot)' },
        { id: '0x78', name: "Ivor Tower Queen's Room" },
        { id: '0x77', name: 'Ivor Tower Puppet Show / Mungola' },
    ]},
    { area: 'Omnitopia', rooms: [
        { id: '0x46', name: "Professor's lab and ship area" },
        { id: '0x48', name: 'Metroplex tunnels (rimsalas, spheres)' },
        { id: '0x44', name: 'Greenhouse' },
        { id: '0x00', name: 'Alarm room' },
        { id: '0x43', name: 'Control room' },
        { id: '0x45', name: 'Secret boss room' },
        { id: '0x47', name: 'Storage room' },
        { id: '0x42', name: 'Reactor room and Reactor control' },
        { id: '0x54', name: 'Shops' },
        { id: '0x7e', name: 'Jail' },
        { id: '0x49', name: 'Junkyard (Landing spot)' },
        { id: '0x4a', name: 'Final Boss Room' },
    ]},
    { area: 'Intro / Misc', rooms: [
        { id: '0x61', name: 'Opening - Scrolling over Machine' },
        { id: '0x31', name: 'Intro - Podunk 1965' },
        { id: '0x02', name: 'Intro - Mansion Exterior 1965' },
        { id: '0x32', name: 'Intro - Podunk 1995' },
        { id: '0x03', name: 'Intro - Mansion Exterior 1995' },
    ]},
];


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
    const { refs, pools, argRefs } = radarAnalyzeScope(doc, scope.startLine, scope.endLine);
    const mapByAddr = getRadarMap();
    // Rebuild room tree if doc changed (refreshRadar may fire before openMemoryRadar)
    const wsRoot2 = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? null;
    if (_radarRoomDocPath !== doc.uri.fsPath) {
        _radarRoomTree    = buildRoomTree(doc, wsRoot2);
        _radarRoomDocPath = doc.uri.fsPath;
        if (_radarPanel) setRoomImageUris(_radarRoomTree, _radarPanel.webview);
    }
    _scaleActive = detectScaleEnemies(wsRoot2, doc.uri.fsPath);
    const selectedMap = scope.kind === 'map' ? scope.name : null;
    _radarPanel.webview.html = renderRadarHtml(scope, refs, pools, argRefs, mapByAddr, _radarRoomTree || [], _radarActiveTab, selectedMap, _scalingChars || [], _scaleActive, _ingrBaseUri, _hitLookup);
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
    const argRefs = new Map(); // arg slot index → {reads, writes}

    const add = (addr, line, rawText, source, isWrite) => {
        if (!refs.has(addr)) refs.set(addr, { reads: [], writes: [], sources: [] });
        const r = refs.get(addr);
        const entry = { line, text: rawText.trim() };
        if (isWrite) { if (!r.writes.some(x => x.line === line)) r.writes.push(entry); }
        else         { if (!r.reads.some(x => x.line === line))  r.reads.push(entry); }
        if (!r.sources.includes(source)) r.sources.push(source);
    };
    const addArg = (idx, line, rawText, isWrite) => {
        if (!argRefs.has(idx)) argRefs.set(idx, { reads: [], writes: [] });
        const r = argRefs.get(idx);
        const entry = { line, text: rawText.trim() };
        if (isWrite) { if (!r.writes.some(x => x.line === line)) r.writes.push(entry); }
        else         { if (!r.reads.some(x => x.line === line))  r.reads.push(entry); }
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
        // arg[N] references (VM-local; not a fixed WRAM address)
        for (const m of text.matchAll(/\barg\s*\[\s*(0x[0-9a-fA-F]+|\d+)\s*\]/g)) {
            const raw = m[1];
            const idx = raw.startsWith('0x') || raw.startsWith('0X') ? parseInt(raw, 16) : parseInt(raw, 10);
            if (!isNaN(idx)) {
                const argIsWrite = /\barg\s*\[\s*[^\]]+\]\s*(?:[+\-*\/&|^]|<<|>>)?=(?!=)/.test(text);
                addArg(idx, i, rawText, argIsWrite);
            }
        }
    }
    return { refs, pools, argRefs };
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

/** Parse core evs files for enum entries mapping <0xNNNN> addresses to enum names.
 *  Returns Map<addr, [{cls, name}]> — cls is the enum class name, name is the member. */
function radarReadEnums(wsFolder) {
    const cache = new Map();
    const coreDir = path.join(wsFolder, 'in', 'core');
    if (!fs.existsSync(coreDir)) return cache;
    const scanContent = (content) => {
        for (const [addr, entries] of parseEnumsFromContent(content)) {
            if (!cache.has(addr)) cache.set(addr, []);
            for (const e of entries) cache.get(addr).push(e);
        }
    };
    const scanDir = (dir) => {
        let entries;
        try { entries = fs.readdirSync(dir); } catch { return; }
        for (const f of entries) {
            const fp = path.join(dir, f);
            try {
                const st = fs.statSync(fp);
                if (st.isDirectory()) scanDir(fp);
                else if (f.endsWith('.evs')) scanContent(fs.readFileSync(fp, 'utf8'));
            } catch { /* skip unreadable files */ }
        }
    };
    scanDir(coreDir);
    return cache;
}

function getRadarEnums() {
    if (_radarEnumCache) return _radarEnumCache;
    const wf = vscode.workspace.workspaceFolders?.[0];
    if (!wf) return new Map();
    _radarEnumCache = radarReadEnums(wf.uri.fsPath);
    return _radarEnumCache;
}

function invalidateRadarEnums() { _radarEnumCache = null; }

/** Return cached MAP enum: Map<enumName, numericId>. Reads core.evs MAP enum. */
function getMapEnum(wsRoot) {
    if (_radarMapEnumCache) return _radarMapEnumCache;
    _radarMapEnumCache = new Map();
    if (!wsRoot) return _radarMapEnumCache;
    const coreDir = path.join(wsRoot, 'in', 'core');
    const scan = (dir) => {
        let entries; try { entries = fs.readdirSync(dir); } catch { return; }
        for (const f of entries) {
            const fp = path.join(dir, f);
            try {
                const st = fs.statSync(fp);
                if (st.isDirectory()) scan(fp);
                else if (f.endsWith('.evs')) {
                    const txt = fs.readFileSync(fp, 'utf8');
                    if (!/\benum\s+MAP\b/.test(txt)) continue;
                    for (const [k, v] of parseEvsEnumValues(txt, 'MAP')) _radarMapEnumCache.set(k, v);
                }
            } catch { /* skip */ }
        }
    };
    scan(coreDir);
    return _radarMapEnumCache;
}

/** Strip ANSI escape codes from a string. */
function stripAnsi(s) { return s.replace(/\x1b\[[0-9;]*m/g, ''); }

/** Return the first descriptive label from a trigger's script lines.
 *  Looks for: CALL "...", CHANGE MAP = ... "...", etc. */
function triggerLabel(scriptLines) {
    for (const l of scriptLines) {
        let m = l.match(/CALL\s+"([^"]+)"/);
        if (m) return m[1];
        m = l.match(/CHANGE MAP.*"([^"]+)"/);
        if (m) return m[1];
    }
    return '';
}

/** Read and cache the stripped script_all text. Returns '' if not found. */
function getScriptAllText(wsRoot) {
    if (_radarScriptAllCache !== null) return _radarScriptAllCache;
    const p = path.join(wsRoot, 'script_all');
    try { _radarScriptAllCache = stripAnsi(fs.readFileSync(p, 'utf8')); }
    catch { _radarScriptAllCache = ''; }
    return _radarScriptAllCache;
}

let _luaWatcherCache = null;
/**
 * Parse gameDrawPoint/gameDrawBox calls from soestuff.lua per-room watcher blocks.
 * Returns Map<roomId_hex_string, [{x, y, label}]> where x/y are in 8-px tile units.
 * Searches sibling directories of wsRoot for the Lua file.
 */
function readLuaWatchers(wsRoot) {
    if (_luaWatcherCache !== null) return _luaWatcherCache;
    _luaWatcherCache = new Map();

    // Try common paths for soestuff.lua
    const candidates = [
        path.join(wsRoot, '..', 'snes-scripts', 'Secret of Evermore', 'soestuff.lua'),
        path.join(wsRoot, '..', '..', 'snes-scripts', 'Secret of Evermore', 'soestuff.lua'),
        path.join(path.dirname(wsRoot), 'snes-scripts', 'Secret of Evermore', 'soestuff.lua'),
    ];
    let luaText = '';
    for (const c of candidates) {
        try { luaText = fs.readFileSync(c, 'utf8'); break; } catch { /* try next */ }
    }
    if (!luaText) return _luaWatcherCache;

    // Split on watcher map entry headers like `[0x5c] = {`
    const blockRe = /\[0x([0-9a-f]+)\]\s*=\s*\{/gi;
    let m, blocks = [];
    while ((m = blockRe.exec(luaText)) !== null) blocks.push({ id: m[1], start: m.index });

    for (let bi = 0; bi < blocks.length; bi++) {
        const { id, start } = blocks[bi];
        const end = bi + 1 < blocks.length ? blocks[bi + 1].start : luaText.length;
        const body = luaText.slice(start, end);

        // Extract gameDrawPoint(x_lit, y_lit, ...) calls — literal hex/decimal only
        const ptRe = /gameDrawPoint\s*\(\s*(0x[0-9a-fA-F]+|\d+)\s*,\s*(0x[0-9a-fA-F]+|\d+)/g;
        let pm, pts = [];
        while ((pm = ptRe.exec(body)) !== null) {
            const px = parseInt(pm[1], pm[1].startsWith('0x') ? 16 : 10);
            const py = parseInt(pm[2], pm[2].startsWith('0x') ? 16 : 10);
            // Coordinates are in SNES game pixels; divide by 8 for 8-px tile units
            pts.push({ x: px / 8, y: py / 8 });
        }
        if (pts.length) _luaWatcherCache.set(id.toLowerCase().replace(/^0+/, '') || '0', pts);
    }
    return _luaWatcherCache;
}

/**
 * Parse step-on and b-trigger entries for a room from script_all.
 * vanillaEnumName: the enum member name like "BRIAN", or a numeric string "0x15".
 * Returns { stepOn: [{x1,y1,x2,y2,label,scriptLines}], bTrigger: [...] }
 */
function readScriptAllTriggers(wsRoot, vanillaEnumName) {
    const out = { stepOn: [], bTrigger: [] };
    if (!wsRoot || !vanillaEnumName) return out;

    // Resolve enum name to numeric room ID
    let roomId = NaN;
    if (/^0x/i.test(vanillaEnumName)) {
        roomId = parseInt(vanillaEnumName, 16);
    } else {
        const mapEnum = getMapEnum(wsRoot);
        roomId = mapEnum.get(vanillaEnumName) ?? NaN;
        // Try numeric fallback
        if (isNaN(roomId)) roomId = parseInt(vanillaEnumName, 10);
    }
    if (isNaN(roomId)) return out;

    const text = getScriptAllText(wsRoot);
    if (!text) return out;

    // Find room header: `[0xNN] ...` at start of line
    const hexId = '0x' + roomId.toString(16).padStart(2, '0').toLowerCase();
    const headerPrefix = '[' + hexId + ']';
    const headerIdx = text.indexOf('\n' + headerPrefix);
    if (headerIdx === -1) return out;

    // Find start of next room section (to bound our search)
    const afterHeader = text.indexOf('\n', headerIdx + 1);
    const nextRoomIdx = text.search(new RegExp('\n\\[0x[0-9a-f]+\\]', ''));
    // Find the *next* room header after our own
    let sectionEnd = text.length;
    const nextAfter = text.indexOf('\n[0x', afterHeader + 1);
    if (nextAfter !== -1) sectionEnd = nextAfter;
    const section = text.slice(headerIdx + 1, sectionEnd);

    // Parse a trigger section ("step-on scripts" or "B trigger scripts")
    const parseTriggerSection = (sectionText, type, result) => {
        // Match the section header
        const headerRe = type === 'stepOn'
            ? /step-on scripts at [^\n]+\n/
            : /B trigger scripts at [^\n]+\n/;
        const hm = headerRe.exec(sectionText);
        if (!hm) return;
        let body = sectionText.slice(hm.index + hm[0].length);
        // Bound step-on body: stop before the B trigger section (same [x,y:x,y]= format leaks through)
        if (type === 'stepOn') {
            const bIdx = body.search(/\n  B trigger scripts at /);
            if (bIdx !== -1) body = body.slice(0, bIdx);
        }

        // Each entry starts with `    [x1,y1:x2,y2] = ...`
        const entryRe = /\[([0-9a-f]+),([0-9a-f]+):([0-9a-f]+),([0-9a-f]+)\]\s*=/g;
        let em;
        const entryPositions = [];
        while ((em = entryRe.exec(body)) !== null) entryPositions.push(em.index);

        for (let i = 0; i < entryPositions.length; i++) {
            const chunk = body.slice(entryPositions[i], i + 1 < entryPositions.length ? entryPositions[i + 1] : undefined);
            const coordM = chunk.match(/\[([0-9a-f]+),([0-9a-f]+):([0-9a-f]+),([0-9a-f]+)\]/);
            if (!coordM) continue;
            const x1 = parseInt(coordM[1], 16), y1 = parseInt(coordM[2], 16);
            const x2 = parseInt(coordM[3], 16), y2 = parseInt(coordM[4], 16);
            // Script lines: lines starting with whitespace+[0x...] 
            const scriptLines = chunk.split('\n')
                .filter(l => /\s+\[0x[0-9a-f]+\]/.test(l))
                .map(l => l.trim());
            const label = triggerLabel(scriptLines);
            result.push({ x1, y1, x2, y2, label, scriptLines });
        }
    };

    parseTriggerSection(section, 'stepOn', out.stepOn);
    parseTriggerSection(section, 'bTrigger', out.bTrigger);
    return out;
}



/** Read width/height from a PNG file header. Returns {w,h} or null. */
function readPngDimensions(filePath) {
    try {
        const buf = Buffer.alloc(24);
        const fd = fs.openSync(filePath, 'r');
        fs.readSync(fd, buf, 0, 24, 0);
        fs.closeSync(fd);
        // PNG: 8-byte sig, then IHDR chunk (4 len + 4 "IHDR" + 4 width + 4 height)
        if (buf.readUInt32BE(0) === 0x89504e47 && buf.readUInt32BE(4) === 0x0d0a1a0a) {
            return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
        }
    } catch {}
    return null;
}

/**
 * Read trig_off_x / trig_off_y from the ROM data block for a map.
 * Bytes 0 and 1 of the data block are the trigger coordinate origin.
 * SVG formula: svg_x = (x1 - offX) * 2,  svg_y = (y1 - offY) * 2
 * (1 trigger-tile = 16px = 2 × 8px SVG tiles)
 * @param {string} wsRoot  Workspace root
 * @param {number} mapId   Numeric map ID (e.g. 0x5c)
 * @returns {{offX:number, offY:number}|null}
 */
function readRomTriggerOffsets(wsRoot, mapId) {
    const h = readRomMapHeader(wsRoot, mapId);
    return h ? { offX: h.offX, offY: h.offY } : null;
}

/**
 * Read the full 13-byte ROM map header plus trigger table lengths and payload tile-set list.
 * Header layout (from traced data):
 *   [0]  trig_off_x        → 7E0F86  trigger rect origin X in 16px-tile units
 *   [1]  trig_off_y        → 7E0F88  trigger rect origin Y in 16px-tile units
 *   [2]  map_w_tiles       → 7E08EE  map width  in 16px tiles (× 16 = pixels)
 *   [3]  map_h_tiles       → 7E08F0  map height in 16px tiles (× 16 = pixels)
 *   [4]  room_render_preset→ 7E0F80 → TM $212C   display layer enables
 *   [5]  room_subscreen    → 7E0F81 → TS $212D   subscreen layer enables
 *   [6]  room_effect_family→ 7E0F82 → CGADSUB $2131  color math add/sub
 *   [7]  room_effect_enable→ 7E0F83 → CGWSEL $2130   color window/math master
 *   [8]  room_effect_variant→7E241F  per-room modifier within effect family
 *   [9-10] unknown_word    → 7E0F84  16-bit field; purpose not decoded
 *   [11] unknown_b11       (skipped by loader)
 *   [12] unknown_b12       (skipped by loader)
 * After header: step_len uint16, step-on table (6 bytes/entry), b_len uint16, B-trigger table.
 * Payload starts after trigger tables; first byte = tile-family count, then count×uint16 IDs.
 * @param {string} wsRoot
 * @param {number} mapId
 * @returns {object|null}
 */
function readRomMapHeader(wsRoot, mapId) {
    if (!wsRoot || mapId == null) return null;
    try {
        const romNames = ['Secret of Evermore (U) [!].smc', 'Secret of Evermore.smc'];
        let romBuf = null;
        for (const name of romNames) {
            const p = path.join(wsRoot, name);
            if (fs.existsSync(p)) { romBuf = fs.readFileSync(p); break; }
        }
        if (!romBuf) return null;
        // Map pointer table at SNES 0x9ffde7 = ROM 0x1ffde7 (HiROM no header)
        const mapTableRom = 0x1ffde7;
        const ptrAddr = mapTableRom + mapId * 4;
        if (ptrAddr + 3 >= romBuf.length) return null;
        const dataSnes = romBuf[ptrAddr] | (romBuf[ptrAddr + 1] << 8) | (romBuf[ptrAddr + 2] << 16);
        const dataRom  = ((dataSnes >> 16) & 0x3f) * 0x10000 + (dataSnes & 0xffff);
        if (dataRom + 20 >= romBuf.length) return null;
        const h   = (off) => romBuf[dataRom + off];
        const h16 = (off) => romBuf[dataRom + off] | (romBuf[dataRom + off + 1] << 8);
        const offX = h(0), offY = h(1);
        const mapW = h(2), mapH = h(3);
        const b4 = h(4), b5 = h(5), b6 = h(6), b7 = h(7), b8 = h(8);
        const unknownWord = h16(9);
        const b11 = h(11), b12 = h(12);
        // Derived geometry (1 tile = 16px; screen = 256×224)
        const mapWpx = mapW * 16, mapHpx = mapH * 16;
        const scrollW = Math.max(0, mapWpx - 256);
        const scrollH = Math.max(0, mapHpx - 224);
        // Render preset lookup (5-byte signature of bytes 4..8)
        const sig = [b4, b5, b6, b7, b8].map(v => v.toString(16).padStart(2, '0')).join(' ');
        const PRESETS = {
            '17 00 00 02 00': 'default outdoor / neutral',
            '17 11 02 02 00': 'indoor / interior',
            '17 01 42 02 00': 'cave / transition-heavy',
            '17 01 02 02 00': 'alternate special-area',
            '17 11 42 02 00': 'interior + cave/sewer hybrid',
            '17 00 00 02 02': 'parallax / layered-background',
            '16 01 92 02 01': 'darkness-style (Oglin cave)',
            '17 01 92 02 04': 'effect-heavy arena',
            '17 01 02 02 05': 'volcano variant',
            '17 05 42 02 00': 'boss / special-room',
            '17 12 41 02 00': 'cutscene / palace',
        };
        const renderPreset = PRESETS[sig] || null;
        // Trigger table lengths
        if (dataRom + 15 >= romBuf.length) return { offX, offY, mapW, mapH, mapWpx, mapHpx, scrollW, scrollH, b4, b5, b6, b7, b8, sig, renderPreset, unknownWord, b11, b12, stepLen: null, stepCount: null, bLen: null, bCount: null, payloadOffset: null, payloadTileCount: null, payloadTileIds: null };
        const stepLen   = h16(13);
        const stepCount = Math.floor(stepLen / 6);
        const bLenOff   = 15 + stepLen;
        if (dataRom + bLenOff + 2 >= romBuf.length) return { offX, offY, mapW, mapH, mapWpx, mapHpx, scrollW, scrollH, b4, b5, b6, b7, b8, sig, renderPreset, unknownWord, b11, b12, stepLen, stepCount, bLen: null, bCount: null, payloadOffset: null, payloadTileCount: null, payloadTileIds: null };
        const bLen       = h16(bLenOff);
        const bCount     = Math.floor(bLen / 6);
        const payloadOff = bLenOff + 2 + bLen;
        // Payload tile-set list: 1-byte count + count × uint16 tile-family IDs
        let payloadTileCount = null, payloadTileIds = null;
        if (dataRom + payloadOff < romBuf.length) {
            const tileCount = romBuf[dataRom + payloadOff];
            const tileEnd   = dataRom + payloadOff + 1 + tileCount * 2;
            if (tileCount <= 32 && tileEnd <= romBuf.length) {
                payloadTileCount = tileCount;
                payloadTileIds   = [];
                for (let i = 0; i < tileCount; i++) payloadTileIds.push(h16(payloadOff + 1 + i * 2));
            }
        }
        return { offX, offY, mapW, mapH, mapWpx, mapHpx, scrollW, scrollH, b4, b5, b6, b7, b8, sig, renderPreset, unknownWord, b11, b12, stepLen, stepCount, bLen, bCount, payloadOffset: payloadOff, payloadTileCount, payloadTileIds };
    } catch { return null; }
}

/**
 * Decode a map blob's payload: tile families, position table, and tilemap.
 * @param {Buffer} romBuf - ROM data
 * @param {number} dataRom - ROM offset of map blob base
 * @param {number} mapW - Map width in tiles
 * @param {number} mapH - Map height in tiles
 * @returns {{tileFamilies: number[], positionTable: number[], tilemap: number[][], compressedSize: number} | null}
 */
function decodeMapPayload(_romBuf, _dataRom, _mapW, _mapH) {
    return null; // map-data-model moved to tmp/
}

// SoETilesViewer map palettes (16 SNES colors each).
const MAP_TILE_PALETTES = [
  { name: 'Podunk 1', snes: [0x0000, 0x1464, 0x1485, 0x18a7, 0x24e8, 0x312a, 0x3d6c, 0x2d6d, 0x31af, 0x3a12, 0x3e55, 0x4297, 0x4b3b, 0x57ff, 0x000a, 0x0005] },
  { name: '1965 Tiles 1', snes: [0x0000, 0x0c82, 0x10a3, 0x14e5, 0x1907, 0x1d48, 0x258a, 0x29ac, 0x2ded, 0x320f, 0x3a51, 0x3e92, 0x42b4, 0x5bdd, 0x0000, 0x0000] },
  { name: 'Omnitopia 1', snes: [0x0000, 0x6358, 0x5ef5, 0x4ed4, 0x4251, 0x39ed, 0x31ab, 0x298b, 0x2949, 0x2108, 0x2106, 0x18e6, 0x14a5, 0x0c83, 0x0442, 0x0000] },
  { name: 'Omnit. Tree', snes: [0x0000, 0x0843, 0x0c65, 0x1087, 0x14a9, 0x01ed, 0x0967, 0x04c3, 0x0040, 0x14a5, 0x18c7, 0x1ce8, 0x1d09, 0x254a, 0x2d8c, 0x31ce] },
  { name: 'Jungle 1', snes: [0x0000, 0x19ef, 0x15ac, 0x116a, 0x1127, 0x0ce5, 0x08a3, 0x0481, 0x0040, 0x08a8, 0x0485, 0x0064, 0x0022, 0x10a6, 0x0864, 0x0443] },
  { name: 'Hut Int. 1', snes: [0x0000, 0x0c43, 0x10a5, 0x1507, 0x1d6a, 0x0020, 0x0c61, 0x18c4, 0x3168, 0x1024, 0x1066, 0x14c8, 0x190a, 0x214c, 0x25ae, 0x0461] },
  { name: 'Hut Ext. 1', snes: [0x0000, 0x0843, 0x0c66, 0x14c6, 0x1908, 0x0c63, 0x14e8, 0x1d8a, 0x262d, 0x0866, 0x112b, 0x1a11, 0x22d6, 0x4926, 0x3189, 0x0423] },
  { name: 'Thraxx Body', snes: [0x0000, 0x0090, 0x006e, 0x044b, 0x0829, 0x0c27, 0x0405, 0x0803, 0x0801, 0x0d5c, 0x04f6, 0x639d, 0x367d, 0x03e0, 0x03e0, 0x0000] },
  { name: 'Thraxx Eyes', snes: [0x0000, 0x7bff, 0x73bd, 0x677b, 0x5b19, 0x4ed7, 0x4295, 0x3a33, 0x2df1, 0x35ae, 0x2d6c, 0x252a, 0x20c8, 0x1886, 0x1044, 0x0402] },
  { name: 'Title Text', snes: [0x0000, 0x0400, 0x0442, 0x0464, 0x04a7, 0x04c9, 0x050b, 0x052d, 0x056f, 0x0591, 0x05d4, 0x05f6, 0x0638, 0x065a, 0x0a9c, 0x0abe] },
  { name: 'Title Sky', snes: [0x0000, 0x4587, 0x4166, 0x3d46, 0x3925, 0x3125, 0x2d04, 0x28e4, 0x24c3, 0x20a3, 0x1c82, 0x1482, 0x1061, 0x0c41, 0x0820, 0x0400] },
  { name: 'Title Machine', snes: [0x0000, 0x0885, 0x0463, 0x0442, 0x0021, 0x0000, 0x0000, 0x0443, 0x0022, 0x0001, 0x0000, 0x18ee, 0x10aa, 0x0c67, 0x0423, 0x0000] },
  { name: 'Title Pipes', snes: [0x0000, 0x0863, 0x0442, 0x0442, 0x0421, 0x0421, 0x0021, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000] },
  { name: 'Title Grill', snes: [0x0000, 0x0044, 0x0023, 0x0023, 0x0022, 0x0022, 0x0001, 0x0001, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0067] },
];

const _mapTileDecodeCache = new Map();

function roomsRenderLog() {
  try {
    const args = Array.prototype.slice.call(arguments);
    console.log.apply(console, ['[RoomsRender]'].concat(args));
  } catch {}
}

function snesMapToRom(addr) {
  return addr & ~(0xc00000);
}

function snes5To8(v) {
  return Math.round((v & 0x1f) * 255 / 31);
}

function snesColorToRgba(snes) {
  return [
    snes5To8(snes),
    snes5To8(snes >>> 5),
    snes5To8(snes >>> 10),
    255,
  ];
}

function romRead8BySnes(romBuf, snesAddr) {
  const off = snesMapToRom(snesAddr);
  if (off < 0 || off >= romBuf.length) return 0;
  return romBuf[off];
}

function romRead24BySnes(romBuf, snesAddr) {
  const off = snesMapToRom(snesAddr);
  if (off < 0 || off + 2 >= romBuf.length) return 0;
  return romBuf[off] | (romBuf[off + 1] << 8) | (romBuf[off + 2] << 16);
}

function decodeMapTile16(romBuf, tileId) {
  if (_mapTileDecodeCache.has(tileId)) return _mapTileDecodeCache.get(tileId);

  const ptrAddr = 0xee0000 + tileId * 3;
  const dataAddr = romRead24BySnes(romBuf, ptrAddr);
  if (!dataAddr) return null;

  const tileInfo = romRead8BySnes(romBuf, dataAddr);
  const compressed = !!(tileInfo & 0x80);
  const uncompressedSize = 128; // 16x16 at SNES 4bpp planar format
  const dec = new Uint8Array(uncompressedSize);

  if (!compressed) {
    let wordCount = (tileInfo & 0x7f) + 1;
    if (wordCount > 64) wordCount = 64;
    const byteCount = wordCount * 2;
    let dataPtr = dataAddr + 1;
    for (let i = 0; i < byteCount; i++) dec[i] = romRead8BySnes(romBuf, dataPtr + i);
    for (let i = byteCount; i < uncompressedSize; i += 2) {
      dec[i] = dec[Math.max(0, i - 2)];
      dec[i + 1] = dec[Math.max(1, i - 1)];
    }
  } else {
    let dataPtr = dataAddr + (tileInfo & 0x7f);
    let cmdPtr = dataAddr + 1;
    let cmdSecondHalf = false;
    let outPos = 0;

    const read4cmdBits = () => {
      const v = romRead8BySnes(romBuf, cmdPtr);
      let res;
      if (cmdSecondHalf) {
        res = v & 0x0f;
        cmdPtr++;
      } else {
        res = v >>> 4;
      }
      cmdSecondHalf = !cmdSecondHalf;
      return res;
    };

    while (outPos < uncompressedSize) {
      let indicators = romRead8BySnes(romBuf, dataPtr++);
      for (let bit = 0; bit < 8 && outPos < uncompressedSize; bit++) {
        if ((indicators & 0x80) === 0) {
          dec[outPos++] = romRead8BySnes(romBuf, dataPtr++);
          dec[outPos++] = romRead8BySnes(romBuf, dataPtr++);
        } else {
          const mode = read4cmdBits();
          switch (mode) {
            case 0: dec[outPos++] = 0x00; dec[outPos++] = 0x00; break;
            case 1: dec[outPos++] = 0xff; dec[outPos++] = 0x00; break;
            case 2: dec[outPos++] = 0x00; dec[outPos++] = 0xff; break;
            case 3: dec[outPos++] = 0xff; dec[outPos++] = 0xff; break;
            case 4: dec[outPos++] = romRead8BySnes(romBuf, dataPtr++); dec[outPos++] = 0x00; break;
            case 5: dec[outPos++] = romRead8BySnes(romBuf, dataPtr++); dec[outPos++] = 0xff; break;
            case 6: dec[outPos++] = 0x00; dec[outPos++] = romRead8BySnes(romBuf, dataPtr++); break;
            case 7: dec[outPos++] = 0xff; dec[outPos++] = romRead8BySnes(romBuf, dataPtr++); break;
            case 8: {
              const v = romRead8BySnes(romBuf, dataPtr++);
              dec[outPos++] = v;
              dec[outPos++] = v;
              break;
            }
            case 9:
            case 10:
            case 11:
            case 12: {
              const n = (mode - 9 + 1) + (mode === 12 ? read4cmdBits() : 0);
              for (let j = 0; j < n && outPos < uncompressedSize; j++) {
                if (outPos < 2) {
                  dec[outPos++] = 0;
                  dec[outPos++] = 0;
                } else {
                  dec[outPos] = dec[outPos - 2]; outPos++;
                  dec[outPos] = dec[outPos - 2]; outPos++;
                }
              }
              break;
            }
            case 13: {
              if (outPos < 2) dec[outPos++] = 0;
              else { dec[outPos] = dec[outPos - 2]; outPos++; }
              dec[outPos++] = romRead8BySnes(romBuf, dataPtr++);
              break;
            }
            case 14: {
              dec[outPos++] = romRead8BySnes(romBuf, dataPtr++);
              if (outPos < 2) dec[outPos++] = 0;
              else { dec[outPos] = dec[outPos - 2]; outPos++; }
              break;
            }
            case 15: {
              const v = romRead8BySnes(romBuf, dataPtr++);
              dec[outPos++] = v;
              dec[outPos++] = v ^ 0xff;
              break;
            }
          }
        }
        indicators <<= 1;
      }
    }
  }

  // Convert SNES 4bpp planar bytes into 16x16 palette indices (0..15).
  const pix = new Uint8Array(16 * 16);
  let n = 0;
  for (let l = 0; l < 2; l++) {
    for (let k = 0; k < 8; k++) {
      for (let j = 0; j < 2; j++) {
        for (let i = 7; i >= 0; i--) {
          let p = 0;
          const base = (j + 2 * l) * 32 + k * 2;
          if (dec[base + 0] & (1 << i)) p |= 1;
          if (dec[base + 1] & (1 << i)) p |= 2;
          if (dec[base + 16] & (1 << i)) p |= 4;
          if (dec[base + 17] & (1 << i)) p |= 8;
          pix[n++] = p;
        }
      }
    }
  }

  const out = Array.from(pix);
  _mapTileDecodeCache.set(tileId, out);
  return out;
}

function chooseDefaultMapPaletteIndex(mapId) {
  // Known mappings verified from current map investigations.
  if (mapId === 0x34) return 5; // Hut Int. 1
  if (mapId === 0x51) return 6; // Hut Ext. 1
  if (mapId === 0x33 || mapId === 0x38 || mapId === 0x5c) return 4; // Jungle 1
  return 4; // Jungle 1 as conservative default for outdoor previews.
}

function buildRoomRenderData(romBuf, mapId, payload, mapW, mapH) {
  if (!payload || !payload.tileFamilies || !payload.tilemap) return null;
  const familyTiles = [];
  for (const fam of payload.tileFamilies) {
    const pix = decodeMapTile16(romBuf, fam);
    familyTiles.push(pix || null);
  }

  let unresolvedTiles = 0;
  let totalRefs = 0;
  for (let y = 0; y < payload.tilemap.length; y++) {
    const row = payload.tilemap[y] || [];
    for (let x = 0; x < row.length; x++) {
      totalRefs++;
      const idx = row[x] | 0;
      if (idx < 0 || idx >= familyTiles.length || !familyTiles[idx]) unresolvedTiles++;
    }
  }

  const defaultPaletteIndex = chooseDefaultMapPaletteIndex(mapId);
  const palettes = MAP_TILE_PALETTES.map((p) => ({
    name: p.name,
    rgba: p.snes.map(snesColorToRgba),
  }));

  return {
    widthPx: mapW * 16,
    heightPx: mapH * 16,
    defaultPaletteIndex,
    palettes,
    familyTiles,
    unresolvedTiles,
    totalRefs,
    unresolvedRatio: totalRefs ? (unresolvedTiles / totalRefs) : 0,
  };
}

/**
 * Decode map payload and attach to content object.
 * @param {string} wsRoot - Workspace root
 * @param {number} mapId - Map ID
 * @param {object} content - Room content object to attach payloadData to
 * @param {object} header - Result from readRomMapHeader
 */
function decodeAndSetPayload(wsRoot, mapId, content, header) {
    if (!wsRoot || !header || !content) return;
    try {
        const romNames = ['Secret of Evermore (U) [!].smc', 'Secret of Evermore.smc'];
        let romBuf = null;
        for (const name of romNames) {
            const p = path.join(wsRoot, name);
            if (fs.existsSync(p)) { romBuf = fs.readFileSync(p); break; }
        }
        if (!romBuf) {
          roomsRenderLog('decodeAndSetPayload: ROM not found in workspace root', { wsRoot, mapId });
          return;
        }
        
        const mapTableRom = 0x1ffde7;
        const ptrAddr = mapTableRom + mapId * 4;
        if (ptrAddr + 3 >= romBuf.length) return;
        
        const dataSnes = romBuf[ptrAddr] | (romBuf[ptrAddr + 1] << 8) | (romBuf[ptrAddr + 2] << 16);
        const dataRom  = ((dataSnes >> 16) & 0x3f) * 0x10000 + (dataSnes & 0xffff);
        if (dataRom + 20 >= romBuf.length) return;
        
        const payload = decodeMapPayload(romBuf, dataRom, header.mapW, header.mapH);
        if (payload) {
          payload.render = buildRoomRenderData(romBuf, mapId, payload, header.mapW, header.mapH);
            content.payloadData = payload;
          content.mapId = mapId;
          roomsRenderLog('decodeAndSetPayload: payload decoded', {
            mapId,
            mapW: header.mapW,
            mapH: header.mapH,
            families: payload.tileFamilies ? payload.tileFamilies.length : 0,
            unresolvedTiles: payload.render ? payload.render.unresolvedTiles : null,
            unresolvedRatio: payload.render ? payload.render.unresolvedRatio : null,
          });
          if (payload.render && payload.render.unresolvedRatio > 0.25) {
            roomsRenderLog('decodeAndSetPayload: suspicious decode quality', {
              mapId,
              unresolvedTiles: payload.render.unresolvedTiles,
              totalRefs: payload.render.totalRefs,
              unresolvedRatio: payload.render.unresolvedRatio,
            });
          }
        } else {
          roomsRenderLog('decodeAndSetPayload: payload decode unavailable', { mapId, mapW: header.mapW, mapH: header.mapH });
        }
    } catch (_) {
        roomsRenderLog('decodeAndSetPayload: exception', { mapId, error: String(_) });
    }
}

/**
 * Read all 142 character records from the ROM (HiROM, no header).
 * Base address: SNES 0x8eB678 → ROM 0x0EB678. Size: 0x4a bytes each.
 * @param {string} wsRoot
 * @returns {Array<{id,name,hp,attack,defense,magic_defense,evade,hit_rate}>}
 */
function readRomCharacters(wsRoot) {
    if (!wsRoot) return [];
    const CHAR_BASE = 0x0EB678;
    const CHAR_SIZE = 0x4a;
    const CHAR_COUNT = 142;
    const BOY_NAME_PTR = 0x7e2210;
    const DOG_NAME_PTR = 0x7e2234;
    try {
        const romNames = ['Secret of Evermore (U) [!].smc', 'Secret of Evermore.smc'];
        let romBuf = null;
        for (const name of romNames) {
            const p = path.join(wsRoot, name);
            if (fs.existsSync(p)) { romBuf = fs.readFileSync(p); break; }
        }
        if (!romBuf) return [];
        const chars = [];
        for (let i = 0; i < CHAR_COUNT; i++) {
            const base = CHAR_BASE + i * CHAR_SIZE;
            if (base + CHAR_SIZE > romBuf.length) break;
            // 3-byte name pointer (LE)
            const namePtr = romBuf[base] | (romBuf[base + 1] << 8) | (romBuf[base + 2] << 16);
            let name = '';
            if (namePtr === BOY_NAME_PTR) {
                name = '<Boy>';
            } else if (namePtr === DOG_NAME_PTR) {
                name = '<Dog>';
            } else if (namePtr >= 0x800000 && namePtr < 0xd00000) {
                const nameRom = ((namePtr >> 16) & 0x3f) * 0x10000 + (namePtr & 0xffff);
                if (nameRom < romBuf.length) {
                    for (let j = nameRom; j < romBuf.length && j < nameRom + 32 && romBuf[j] !== 0; j++) {
                        name += String.fromCharCode(romBuf[j]);
                    }
                }
            }
            chars.push({
                id: i,
                name: name || ('#' + i),
                hp:            romBuf.readUInt16LE(base + 0x0f),
                attack:        romBuf.readUInt16LE(base + 0x19),
                defense:       romBuf.readUInt16LE(base + 0x1b),
              magic_defense: romBuf.readUInt16LE(base + 0x1d),
              evade:         romBuf.readUInt16LE(base + 0x1f),
                hit_rate:      romBuf.readUInt16LE(base + 0x21),
            });
        }
        return chars;
    } catch { return []; }
}

/**
 * Compute hit% lookup table from the two-level ROM table described in soestuff.lua.
 * Returns { hit_rate: { evade: pct } } for all unique (hit_rate, evade) pairs in chars.
 * Addresses: $8FBAAF (evasion pointer table), $8F0000 (hit value table) — HiROM, no header.
 */
function readRomHitLookup(wsRoot, chars) {
    if (!wsRoot || !chars || !chars.length) return {};
    try {
        const romNames = ['Secret of Evermore (U) [!].smc', 'Secret of Evermore.smc'];
        let romBuf = null;
        for (const name of romNames) {
            const p = path.join(wsRoot, name);
            if (fs.existsSync(p)) { romBuf = fs.readFileSync(p); break; }
        }
        if (!romBuf) return {};
        // HiROM: ROM offset = (bank & 0x3F) * 0x10000 + addr16
        // 0x8FBAAF → 0x0F0000 + 0xBAAF = 0x0FBAAF
        // 0x8F0000 → 0x0F0000 + 0x0000 = 0x0F0000
        const PTR_BASE  = 0x0FBAAF;
        const HIT_BASE  = 0x0F0000;
        const calcHit = (hit_rate, evade) => {
            const sprite_off = Math.floor((evade + 1) / 2) & 0xFFFE;
            const ptr_addr   = PTR_BASE + sprite_off;
            if (ptr_addr + 2 > romBuf.length) return null;
            const evasion_ptr = romBuf.readUInt16LE(ptr_addr);
            const hit_off    = ((hit_rate + 1) & 0xFFFC) >> 1;
            const final_addr = HIT_BASE + hit_off + evasion_ptr;
            if (final_addr + 2 > romBuf.length) return null;
            const raw = romBuf.readUInt16LE(final_addr);
            return Math.min(100, raw / 0x7FFF * 100);
        };
        const hitRates = new Set([38, 50]);
        // Pre-compute all hit_rates Boy and Dog could have across L1–L37 (hitRateG=1)
        for (let hr = 1; hr <= 127; hr++) hitRates.add(hr);
        const evades   = new Set([0]);
        for (const c of chars) {
            if (c.hit_rate !== undefined) hitRates.add(c.hit_rate);
            if (c.evade    !== undefined) evades.add(c.evade);
        }
        const lookup = {};
        for (const hr of hitRates) {
            const row = {};
            for (const ev of evades) {
                const pct = calcHit(hr, ev);
                if (pct !== null) row[ev] = Math.round(pct * 10) / 10;
            }
            if (Object.keys(row).length) lookup[hr] = row;
        }
        return lookup;
    } catch { return {}; }
}

/**
 * Check if scale_enemies is active (non-commented) in any main.evs in the workspace.
 * @param {string} wsRoot
 * @returns {boolean}
 */
function detectScaleEnemies(wsRoot, docPath) {
    if (!wsRoot) return false;
    try {
        // Walk up from docPath to find the nearest main.evs in its directory tree.
        // This scopes the warning to the build context of the current document.
        if (docPath) {
            let dir = path.dirname(docPath);
            while (dir.length >= wsRoot.length && dir.startsWith(wsRoot)) {
                const candidate = path.join(dir, 'main.evs');
                if (fs.existsSync(candidate)) {
                    const lines = fs.readFileSync(candidate, 'utf8').split('\n');
                    for (const line of lines) {
                        const trimmed = line.replace(/^\s+/, '');
                        if (trimmed.startsWith('//')) continue;
                        if (/scale_enemies\s*\(/.test(trimmed)) return true;
                    }
                    return false; // found main.evs but scale_enemies not active
                }
                const parent = path.dirname(dir);
                if (parent === dir) break;
                dir = parent;
            }
        }
        return false;
    } catch { return false; }
}

/**
 * Locate a room image in the workspace.
 * Checks docs/rooms/images/{name}.{ext} and docs/rooms/{name}.{ext}.
 * @returns {string|null} Absolute filesystem path or null.
 */
function findRoomImage(wsRoot, mapName, vanillaId, filePath) {
    const names = [mapName, vanillaId].filter(Boolean);
    const exts  = ['.png', '.jpg', '.jpeg', '.webp'];
    const baseDirs = [];
    // Sibling of the .evs file first
    if (filePath) baseDirs.push(path.dirname(filePath));
    if (wsRoot) {
        baseDirs.push(
            path.join(wsRoot, 'docs', 'rooms', 'images'),
            path.join(wsRoot, 'docs', 'rooms'),
        );
    }
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

    const out = { initMap: null, entrances: [], enemies: [], objects: [], transitions: [], triggerNames: { stepOn: [], bTrigger: [] } };
    const objSeen = new Set();
    // objDesc: Map<index-string, description> from commented object lines
    const objDesc = new Map();
    // enum stepon_trigger / b_trigger member name tracking
    let inStepOnEnum = false, inBTrigEnum = false, enumDepth = 0;
    const end = Math.min(endLine, lines.length - 1);

    for (let i = startLine; i <= end; i++) {
        const raw = lines[i];
        // Extract inline comment before stripping
        const inlineCommentM = raw.match(/\/\/(.*)$/);
        const comment = inlineCommentM ? inlineCommentM[1].trim() : '';
        const t = raw.replace(/\/\/.*$/, '').trim();

        // Enum member name tracking for stepon_trigger / b_trigger
        if (!inStepOnEnum && !inBTrigEnum) {
            const em = t.match(/\benum\s+(stepon_trigger|b_trigger)\b/);
            if (em) { inStepOnEnum = em[1] === 'stepon_trigger'; inBTrigEnum = !inStepOnEnum; enumDepth = 0; }
        }
        if (inStepOnEnum || inBTrigEnum) {
            const prevD = enumDepth;
            for (const c of t) { if (c === '{') enumDepth++; else if (c === '}') enumDepth--; }
            if (prevD === 1) { // at member level before entering @install block
                const mm = t.match(/^\s*([A-Za-z_]\w*)\s*=/);
                if (mm) {
                    if (inStepOnEnum) out.triggerNames.stepOn.push(mm[1]);
                    else              out.triggerNames.bTrigger.push(mm[1]);
                }
            }
            if (enumDepth <= 0) { inStepOnEnum = inBTrigEnum = false; enumDepth = 0; }
        }

        // Commented object lines: // object[N] = val; // description
        const commentedObjM = comment.match(/\bobject\[(\w+)\]\s*=\s*[^;]+;?\s*(?:\/\/\s*(.+))?/);
        if (commentedObjM) {
            const idx = commentedObjM[1];
            const desc = commentedObjM[2] ? commentedObjM[2].trim() : '';
            if (!objDesc.has(idx) && desc) objDesc.set(idx, desc);
        }

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

        // object[N] = val; (live code) — description from inline comment
        const obj = t.match(/\bobject\[(\w+)\]/);
        if (obj && !objSeen.has(obj[1])) {
            objSeen.add(obj[1]);
            const desc = comment.replace(/^\/\/\s*/, '').replace(/object\[.*?\]\s*=\s*[^;]+;?\s*/, '').trim()
                        || objDesc.get(obj[1]) || '';
            out.objects.push({ index: obj[1], line: i, desc });
        }

        // map_transition(target, via, dir)
        const mt = t.match(/\bmap_transition\s*\(\s*([^,)]+),\s*([^,)]+),\s*([^,)]+)\)/);
        if (mt) out.transitions.push({ target: mt[1].trim(), via: mt[2].trim(), dir: mt[3].trim(), line: i });
    }
    // Fill in descriptions from commented lines for objects found in live code
    for (const o of out.objects) {
        if (!o.desc && objDesc.has(o.index)) o.desc = objDesc.get(o.index);
    }
    // Fill object index gaps: object[0x05] implies 0x00..0x04 exist too
    if (out.objects.length > 0) {
        const parseIdx = s => parseInt(s, (s.startsWith('0x') || s.startsWith('0X')) ? 16 : 10);
        const maxIdx = Math.max(...out.objects.map(o => parseIdx(o.index)));
        const seenIdxs = new Set(out.objects.map(o => parseIdx(o.index)));
        for (let i = 0; i <= maxIdx; i++) {
            if (!seenIdxs.has(i))
                out.objects.push({ index: '0x' + i.toString(16).padStart(2, '0'), line: -1, desc: '' });
        }
        out.objects.sort((a, b) => parseIdx(a.index) - parseIdx(b.index));
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
            const imgPath = findRoomImage(wsRoot, m[1], vid, fp);
            if (wsRoot && vid) {
                content.triggers = readScriptAllTriggers(wsRoot, vid);
                // Attach Lua POI and trigger origin offset if available
                const luaPoi = readLuaWatchers(wsRoot);
                const roomNumStr = getMapEnum(wsRoot).get(vid);
                if (roomNumStr !== undefined) {
                    const hexKey = roomNumStr.toString(16).replace(/^0+/, '') || '0';
                    content.poi = luaPoi.get(hexKey) || null;
                    const _rh = readRomMapHeader(wsRoot, roomNumStr);
                    if (_rh) { content.trigOffset = { offX: _rh.offX, offY: _rh.offY }; content.romHeader = _rh; decodeAndSetPayload(wsRoot, roomNumStr, content, _rh); }
                }
            }
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
        const imgPath = findRoomImage(wsRoot, m[1], vid, docPath);
        if (wsRoot && vid) {
            content.triggers = readScriptAllTriggers(wsRoot, vid);
            const mapNum = getMapEnum(wsRoot).get(vid);
            if (mapNum !== undefined) { const _rh = readRomMapHeader(wsRoot, mapNum); if (_rh) { content.trigOffset = { offX: _rh.offX, offY: _rh.offY }; content.romHeader = _rh; decodeAndSetPayload(wsRoot, mapNum, content, _rh); } }
        }
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

/** Server-side render of the static vanilla room list grouped by act. */
function renderVanillaTree() {
    let html = '<ul class="rt">';
    for (const grp of VANILLA_ROOMS) {
        html += '<li class="rn-area"><span class="rn-area-label">' + radarEsc(grp.area) + '</span><ul class="rt">';
        for (const r of grp.rooms) {
            html += '<li class="rn-map vn-map" data-vid="' + radarEsc(r.id)
                  + '"><span class="rn-label">' + radarEsc(r.name)
                  + '</span><span class="rn-vid-tag">' + radarEsc(r.id) + '</span></li>';
        }
        html += '</ul></li>';
    }
    return html + '</ul>';
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
    // Strip scriptLines from triggers — they are huge and not needed in the webview.
    function sanitizeTriggers(triggers) {
        if (!triggers) return null;
        const clean = (arr) => (arr || []).map(({ x1, y1, x2, y2, label }) => ({ x1, y1, x2, y2, label }));
        return { stepOn: clean(triggers.stepOn), bTrigger: clean(triggers.bTrigger) };
    }
    function sanitizeContent(c) {
        if (!c) return null;
        return { ...c, triggers: sanitizeTriggers(c.triggers) };
    }
    function walk(nodes) {
        for (const n of nodes) {
            if (n.kind === 'map') {
                all[n.name] = { name: n.name, vanillaId: n.vanillaId || null, relPath: n.relPath || '',
                    startLine: n.startLine, endLine: n.endLine,
                    content: sanitizeContent(n.content),
                    imageUri: n.imageUri || null,
                    imageDims: n.imageDims || null };
            } else if (n.children) { walk(n.children); }
        }
    }
    walk(tree);
    return 'var ROOMS=' + JSON.stringify(all).replace(/<\/script>/gi, '<\\/script>') +
        ';var ACTIVE_TAB=' + JSON.stringify(activeTab || 'radar') +
        ';var SELECTED_MAP=' + JSON.stringify(selectedMap || null) + ';';
}

/** Convert imagePath on every map node to a webview URI in-place. Also reads PNG dimensions. */
function setRoomImageUris(nodes, webview) {
    for (const n of nodes) {
        if (n.kind === 'map' && n.imagePath) {
            try {
                n.imageUri = webview.asWebviewUri(vscode.Uri.file(n.imagePath)).toString();
                if (n.imagePath.match(/\.png$/i)) n.imageDims = readPngDimensions(n.imagePath);
            } catch { n.imageUri = null; }
        }
        if (n.children) setRoomImageUris(n.children, webview);
    }
}

function renderRadarHtml(scope, refs, pools, argRefs, mapByAddr, roomTree = [], activeTab = 'radar', selectedMap = null, chars = [], scaleActive = false, ingrBaseUri = '', hitLookup = null) {
    const COLS = 16;
    const allAddrs = [...mapByAddr.keys(), ...refs.keys()];
    if (!allAddrs.length) { allAddrs.push(0x2200, 0x28FF); }
    const rowStart = Math.min(...allAddrs) & ~(COLS - 1);
    const rowEnd   = (Math.max(...allAddrs) | (COLS - 1)) + 1;
    const enumByAddr = getRadarEnums();

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

        const hdoc = untracked ? 0 : 1;

        // Enum cross-reference: show ENUM.NAME tags for the entry's start address
        const enumEntries = !untracked ? (enumByAddr.get(e.addrStart) || []) : [];
        const enumHtml = enumEntries.length
            ? '<br>' + enumEntries.map(ev => '<span class="enum-tag">' + radarEsc(ev.cls + '.' + ev.name) + '</span>').join(' ')
            : '';

        const parts = e.nameParts && e.nameParts.length > 1 ? e.nameParts : null;
        const numBytes = e.addrEnd - e.addrStart + 1;
        const typeStr = radarEsc(e.type.replace(/\s*\[SRAM\]/gi, '').trim());
        const es = e.addrStart, ee = e.addrEnd;

        // Bit-field expansion: one row per named part; each sub-row gets own T, Notes, Lines
        if (parts) {
            // Distribute notes by <br> if count matches; else first row gets full notes, rest get —
            const notesBrParts = notesHtml !== '&ndash;' ? notesHtml.split(/<br\s*\/?>/gi) : null;
            const notesDistrib = (notesBrParts && notesBrParts.length === parts.length) ? notesBrParts : null;
            let html = '<tr id="dr-' + es + '" class="' + rowCls + '" data-addr="' + es + '" data-es="' + es + '" data-ee="' + ee + '" data-hasdoc="' + hdoc + '">';
            html += '<td class="mo" rowspan="' + parts.length + '">' + badge + addrLabel + '</td>';
            html += '<td class="bf">' + radarEsc(parts[0]) + '</td>';
            html += '<td class="mt">' + typeStr + '</td>';
            html += '<td class="nt">' + (notesDistrib ? notesDistrib[0] : notesHtml) + enumHtml + '</td>';
            html += '<td class="rwc">' + linesCell + '</td></tr>';
            for (let i = 1; i < parts.length; i++) {
                html += '<tr id="dr-' + es + '-' + i + '" class="' + rowCls + ' bfc" data-addr="' + es + '" data-part="' + i + '" data-es="' + es + '" data-ee="' + ee + '" data-hasdoc="' + hdoc + '">';
                html += '<td class="bf">' + radarEsc(parts[i]) + '</td>';
                html += '<td class="mt">' + typeStr + '</td>';
                html += '<td class="nt">' + (notesDistrib ? notesDistrib[i] : '&ndash;') + '</td>';
                html += '<td class="rwc">' + linesCell + '</td></tr>';
            }
            return html;
        }

        // Multi-byte (Word etc.): single row, address range in addr cell
        if (!untracked && numBytes > 1) {
            return '<tr id="dr-' + es + '" class="' + rowCls + '" data-addr="' + es + '" data-es="' + es + '" data-ee="' + ee + '" data-hasdoc="' + hdoc + '">' +
                '<td class="mo">' + badge + addrLabel + '</td>' +
                '<td>' + radarEsc(e.name) + '</td>' +
                '<td class="mt">' + typeStr + '</td>' +
                '<td class="nt">' + notesHtml + enumHtml + '</td>' +
                '<td class="rwc">' + linesCell + '</td></tr>';
        }

        const nameCls = untracked ? ' class="no-vanilla"' : '';
        return '<tr id="dr-' + addr + '" class="' + rowCls + '" data-addr="' + addr + '" data-es="' + es + '" data-ee="' + ee + '" data-hasdoc="' + hdoc + '">' +
            '<td class="mo">' + badge + addrLabel + '</td>' +
            '<td' + nameCls + '>' + radarEsc(e.name) + '</td>' +
            '<td class="mt">' + typeStr + '</td>' +
            '<td class="nt">' + notesHtml + enumHtml + '</td>' +
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

    // Arg grid: show as word-sized slots, 8 per row (each slot = 1 arg = default word)
    let argHtml = '';
    const showArgGrid = argRefs.size > 0 || scope.kind === 'fun';
    if (showArgGrid) {
        const ARG_COLS = 8;
        const MIN_ARG_ROWS = scope.kind === 'fun' ? 2 : 1;
        const maxArgIdx = argRefs.size > 0 ? Math.max(...argRefs.keys()) : -1;
        const argRowEnd = Math.max((maxArgIdx | (ARG_COLS - 1)) + 1, ARG_COLS * MIN_ARG_ROWS);
        for (let base = 0; base < argRowEnd; base += ARG_COLS) {
            let cells = '', rowHasUsed = false;
            for (let col = 0; col < ARG_COLS; col++) {
                const idx = base + col;
                const usage = argRefs.get(idx);
                const isUsed = !!usage;
                if (isUsed) rowHasUsed = true;
                let cls = 'cell lc-temp arg-word';
                if (isUsed) {
                    cls += ' cu';
                    if (usage.writes.length && !usage.reads.length) cls += ' cw';
                    else if (usage.writes.length && usage.reads.length) cls += ' crw';
                }
                const rw = isUsed ? (usage.writes.length && usage.reads.length ? ' rw' : usage.writes.length ? ' write' : ' read') : '';
                cells += '<span class="' + cls + '" data-arg-idx="' + idx + '" title="arg[' + radarH(idx) + '] Word' + rw + '"></span>';
            }
            argHtml += '<div class="gr arg-row' + (rowHasUsed ? '' : ' arg-row-empty') + '">' +
                '<span class="rl">' + radarH(base) + '</span>' + cells + '</div>';
        }
    }

    const jsData = 'var CELLS=' + JSON.stringify(cellData).replace(/<\/script>/gi, '<\\/script>') + ';';

    const css = radarWebview.css;

    // ── Rooms tab data ──────────────────────────────────────────────────────
    const treeHtml       = renderRoomsTree(roomTree);
    const vanillaTreeHtml = renderVanillaTree();
    const roomsData      = buildRoomsJson(roomTree, activeTab, selectedMap)
        + '\nvar INGR_BASE=' + JSON.stringify(ingrBaseUri) + ';'
        + '\nvar VANILLA_ROOMS_DATA=' + JSON.stringify(VANILLA_ROOMS) + ';';

    // ── Scaling tab data ────────────────────────────────────────────────────
    const scalingData = 'var SC_CHARS=' + JSON.stringify(chars) + ';'
        + 'var SC_HIT_LOOKUP=' + JSON.stringify(hitLookup || {}) + ';'
        + 'var SC_SCALE_ACTIVE=' + (scaleActive ? 'true' : 'false') + ';'
        + 'var SC_BOY={atk1:7,def1:5,hp1:30,atkG:2,defG:1,hpG:9,hitRate1:38,hitRateG:1};'
        + 'var SC_DOG={atk1:17,def1:10,hp1:36,atkG:4,defG:6,hpG:9,hitRate1:50,hitRateG:1};'
        + 'var SC_SCALABLE={0:SC_BOY,1:SC_DOG};'
        + 'var SC_WEAPONS=['
        + '{id:"sw1",label:"Sword I",type:"sword",bonus:10},'
        + '{id:"sw2",label:"Sword II",type:"sword",bonus:20},'
        + '{id:"sw3",label:"Sword III",type:"sword",bonus:30},'
        + '{id:"sw4",label:"Sword IV",type:"sword",bonus:50},'
        + '{id:"ax1",label:"Axe I",type:"axe",bonus:15},'
        + '{id:"ax2",label:"Axe II",type:"axe",bonus:25},'
        + '{id:"ax3",label:"Axe III",type:"axe",bonus:35},'
        + '{id:"ax4",label:"Axe IV",type:"axe",bonus:50},'
        + '{id:"sp1",label:"Spear I",type:"spear",bonus:20},'
        + '{id:"sp2",label:"Spear II",type:"spear",bonus:30},'
        + '{id:"sp3",label:"Spear III",type:"spear",bonus:40},'
        + '{id:"sp4",label:"Spear IV",type:"spear",bonus:50}'
        + '];'
        + 'var SC_SPELLS=['
        + '{id:"acid",label:"Acid Rain",type:"alchemy",might:17,color:"#4b9f67"},'
        + '{id:"corrosion",label:"Corrosion",type:"alchemy",might:25,color:"#5ab08c"},'
        + '{id:"drain",label:"Drain",type:"alchemy",might:25,color:"#8e8bc7"},'
        + '{id:"flash",label:"Flash",type:"alchemy",might:27,color:"#d6a34a"},'
        + '{id:"hardball",label:"Hard Ball",type:"alchemy",might:21,color:"#4c86d9"},'
        + '{id:"doubledrain",label:"Double Drain",type:"alchemy",might:50,color:"#8f6bd1"},'
        + '{id:"lance",label:"Lance",type:"alchemy",might:50,color:"#46a9a1"},'
        + '{id:"crush",label:"Crush",type:"alchemy",might:62,color:"#c07845"},'
        + '{id:"fireball",label:"Fireball",type:"alchemy",might:62,color:"#db7049"},'
        + '{id:"sting",label:"Sting",type:"alchemy",might:75,color:"#d2b247"},'
        + '{id:"explosion",label:"Explosion",type:"alchemy",might:87,color:"#df5d3c"},'
        + '{id:"storm",label:"Lightning Storm",type:"alchemy",might:87,color:"#6797df"},'
        + '{id:"firepower",label:"Fire Power",type:"alchemy",might:112,color:"#e0582e"},'
        + '{id:"nitro",label:"Nitro",type:"alchemy",might:112,color:"#ef4343"}'
        + '];'
        + 'var SC_COLORS={sword:"#4488ff",axe:"#ff8844",spear:"#44bb66",dog:"#cc88ff"};'
        + 'var SC_TIER_OPAC=[0.18,0.32,0.50,0.75];'
        + 'var SC_MAX_LEVEL=37;';
    const scalingJs = radarWebview.scalingJs;
    const roomsJs = radarWebview.roomsJs;
    const docsJs = radarWebview.docsJs;
    const routeJs = radarWebview.routeJs;
    const rngJs = radarWebview.rngJs;
    const js = radarWebview.buildMainJs({ jsData, roomsData, scalingData, roomsJs, scalingJs, docsJs, routeJs, rngJs });

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
        '<button class="fb fhideargs on" id="btn-hideargs" title="Hide arg slots with no usage in scope">hide unused args</button>' +
        '<button class="fb fpin" id="btn-pin" title="Pin: lock to current scope, stop auto-update">pin</button>' +
        '<button class="fb fglobal" id="btn-global" title="Global scope: show whole file instead of current function">global</button>';

    return '<!doctype html><html><head><meta charset="utf-8"><style>' + css + '</style></head>' +
        '<body class="hrest">' +
        '<div class="tabs">' +
        '<button class="tab tab-active" data-tab="radar">\u26a1 Memory</button>' +
        '<button class="tab" data-tab="rooms">\ud83d\uddfa Rooms</button>' +
        '<button class="tab" data-tab="scaling">\u2694\ufe0f Scaling</button>' +
        '<button class="tab" data-tab="route">\ud83e\udded Route</button>' +
        '<button class="tab" data-tab="docs">\ud83d\udcda Docs</button>' +
        '<button class="tab" data-tab="rng">\ud83c\udfb2 RNG</button>' +
        '</div>' +
        '<div class="tab-pane" data-tab="radar">' +
        '<div class="head">' +
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
        (argHtml ? '<div class="ph">Args <span class="ph-sub">word</span></div><div class="gw arg-gw">' + argHtml + '</div>' : '') +
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
        '<div class="rm-left">' +
        '<div class="rm-ph"><span>Rooms</span><div class="rm-mode"><button class="rmm active" id="rmm-live" title="Show rooms from the active .evs file">Live</button><button class="rmm" id="rmm-vanilla" title="Show all vanilla rooms">Vanilla</button></div></div>' +
        '<div id="rm-live-tree">' + treeHtml + '</div>' +
        '<div id="rm-vanilla-tree" style="display:none">' + vanillaTreeHtml + '</div>' +
        '</div>' +
        '<div class="rm-right"><div id="room-detail" class="rm-detail-placeholder"><span>Select a room</span></div></div>' +
        '</div>' +
        '</div>' +
        '<div class="tab-pane" data-tab="scaling" style="display:none">' +
        '<div class="sc-wrap">' +
        (scaleActive ? '<div class="sc-banner">\u26a0 scale_enemies active \u2014 enemy stats may differ at runtime.</div>' : '') +
        '<div class="sc-note" id="sc-note">★ = scalable (level grows). Scaling uses one physical damage helper for all cases: stamina first adjusts attack, Atlas optionally subtracts 480 before damage, then the same RNG-based physical formula computes min/max/999-cap odds.</div>' +
        '<div class="sc-field" id="sc-mode-field"><span class="sc-label">Damage type</span><select class="sc-sel" id="sc-mode-sel"><option value="physical">Physical</option><option value="alchemy">Offensive Alchemy</option></select></div>' +
        '<div class="sc-field" id="sc-src-field"><span class="sc-label">Source</span><select class="sc-sel" id="sc-src-sel"></select></div>' +
        '<div class="sc-field" id="sc-src-lv-field" style="display:none"><span class="sc-label">Source level</span><select class="sc-sel" style="min-width:80px" id="sc-src-lv"><option value="0">auto</option></select></div>' +
        '<div class="sc-field"><span class="sc-label">Target</span><select class="sc-sel" id="sc-tgt-sel"></select></div>' +
        '<div class="sc-field" id="sc-tgt-lv-field" style="display:none"><span class="sc-label">Target level</span><select class="sc-sel" style="min-width:80px" id="sc-tgt-lv"><option value="0">auto</option></select></div>' +
        '<div class="sc-field" id="sc-al-spell-lv-field" style="display:none"><span class="sc-label">Spell level</span><label class="sc-slider-wrap"><input class="sc-slider" id="sc-al-spell-lv" type="range" min="0" max="9" value="0"><span class="sc-slider-num" id="sc-al-spell-lv-num">0</span></label></div>' +
        '<div class="sc-field" id="sc-al-tgt-lv-field" style="display:none"><span class="sc-label">Target level</span><label class="sc-slider-wrap"><input class="sc-slider" id="sc-al-tgt-lv" type="range" min="1" max="37" value="1"><span class="sc-slider-num" id="sc-al-tgt-lv-num">1</span></label></div>' +
        '<div class="sc-field" id="sc-charge-field"><span class="sc-label">Charge</span><div class="sc-toggle-group"><button class="sc-toggle-btn" data-chg="25">25%</button><button class="sc-toggle-btn" data-chg="50">50%</button><button class="sc-toggle-btn sc-active" data-chg="100">100%</button></div></div>' +
        '<div class="sc-field" id="sc-scale-field"><span class="sc-label">Enemy scale</span><button class="sc-toggle-btn" id="sc-scale-toggle">OFF</button></div>' +
        '<div class="sc-field" id="sc-atlas-field"><span class="sc-label">Atlas</span><button class="sc-toggle-btn" id="sc-atlas-toggle">OFF</button></div>' +
        '</div>' +
        '<div class="sc-chart-layout"><div class="sc-chart-wrap"><div id="sc-chart"></div><div class="sc-hit-chart" id="sc-hit-chart"></div></div><div class="sc-legend" id="sc-legend"></div></div>' +
        '<div id="sc-xinfo" class="sc-xinfo"></div>' +
        '<div class="sc-stats" id="sc-stats"></div>' +
        '<div class="sc-note">\u2605 = scalable (level grows). Scaling uses one physical damage helper for all cases: stamina first adjusts attack, Atlas optionally subtracts 480 before damage, then the same RNG-based physical formula computes min/max/999-cap odds.</div>' +
        '</div>' +
        '</div>' +
        '<div class="tab-pane" data-tab="docs" style="display:none">' +
        '<div class="doc-wrap">' +
        '<div class="doc-subnav">' +
        '<button class="doc-btn doc-btn-active" data-doc="damage">Damage</button>' +
        '<button class="doc-btn" data-doc="alchemy">Offensive Alchemy</button>' +
        '<button class="doc-btn" data-doc="hit">Hit%</button>' +
        '<button class="doc-btn" data-doc="atlas">Atlas Glitch</button>' +
        '<button class="doc-btn" data-doc="mapload">Map Loading</button>' +
        '<button class="doc-btn" data-doc="script">Script</button>' +
        '<button class="doc-btn" data-doc="evs">Everscript</button>' +
        '<button class="doc-btn" data-doc="plugin">Plugin</button>' +
        '</div>' +
        '<div class="doc-content">' +
        '<div class="doc-sec" data-doc="damage">' +
        '<h3 class="doc-h">Physical Damage</h3>' +
        '<div class="doc-fact">Formula from soestuff.lua. The 8-bit RNG seed varies each attack, producing a range of outcomes.</div>' +
        '<pre class="doc-code">w = ~((def\u00f74 - atk) - 1) &amp; 0xFFFF\nif w &lt; 1 or w \u2265 0x8000: w = 1\nseed = hi16((w+1)\u00d7rng16)\na = (seed + w) mod 65536\ndmg = ((((a \u226a 1) mod 65536) + w + carry(a)) mod 65536) \u00bb 2\nshown = min(999, dmg)</pre>' +
        '<div class="doc-sliders"><label>atk <input id="doc-atk" type="range" min="0" max="255" value="45"><span id="doc-atk-num">45</span></label>' +
        '<label>def <input id="doc-def" type="range" min="0" max="255" value="28"><span id="doc-def-num">28</span></label></div>' +
        '<div id="doc-dmg-chart"></div>' +
        '</div>' +
        '<div class="doc-sec" data-doc="alchemy" style="display:none">' +
        '<h3 class="doc-h">Offensive Alchemy</h3>' +
        '<div class="doc-fact">Grounded today: offensive alchemy uses the traced projectile path. Cast-side spell power comes from the ROM level table and hit damage multiplies that projectile power by <code>(0x40 - magic_defense) / 0x40</code>. Research notes also point at a projectile-slot <code>POWER</code> field for projectile alchemy.</div>' +
        '<pre class="doc-code">base_might = ROM16[0x45E6B + spell_id*2]\nlevel_scale = [2,4,7,11,15,20,26,32,39,46][spell_level]\nspell_power_at_level = ceil(base_might * level_scale / 4)\nspell_bonus_base = floor(base_might * level_scale / 4)\nprojectile_power = spell_power_at_level + floor(spell_bonus_base * rng16 / 65536)\nshown = floor(projectile_power * (0x40 - magic_defense) / 0x40)</pre>' +
        '<div class="doc-sliders"><label>spell <select id="doc-al-spell" class="sc-sel"></select></label>' +
        '<label>spell level <input id="doc-al-spell-lv" type="range" min="0" max="9" value="0"><span id="doc-al-spell-lv-num">0</span></label>' +
        '<label>magic_defense <input id="doc-al-mdef" type="range" min="0" max="64" value="51"><span id="doc-al-mdef-num">51</span></label></div>' +
        '<div class="doc-fact">Projectile alchemy research note: active alchemy attack slots start at <code>7E3564</code>, each slot is <code>0x76</code> bytes, and the projectile struct field at <code>+0x2A/+0x2B</code> is labeled <code>POWER</code> or damage in outside notes. Full throw+hit traces are the right place to trace how spell, level, and source stats feed that field.</div>' +
        '<div id="doc-al-chart"></div>' +
        '</div>' +
        '<div class="doc-sec" data-doc="hit" style="display:none">' +
        '<h3 class="doc-h">Hit Chance</h3>' +
        '<div class="doc-fact">Two-level ROM table lookup. The in-game <em>hit_rate</em> display value is NOT the actual chance to hit.</div>' +
        '<pre class="doc-code">off_a   = \u230a(evade + 1) / 2\u230b &amp; ~1\nev_ptr  = ROM16[$8FBAAF + off_a]\noff_b   = ((hit_rate + 1) &amp; ~3) / 2\nhit%    = ROM16[$8F0000 + off_b + ev_ptr] / 0x7FFF \u00d7 100</pre>' +
        '<div id="doc-hit-table"></div>' +
        '</div>' +
        '<div class="doc-sec" data-doc="atlas" style="display:none">' +
        '<h3 class="doc-h">Atlas Glitch \u2014 Boy Attack Underflow</h3>' +
        '<ul class="doc-bullets">' +
        '<li>This is not the Atlas Amulet item.</li>' +
        '<li>The glitch subtracts a value from the boy\'s attack; when the subtraction exceeds the current attack, the 16-bit stat underflows into the range 65056\u201365535.</li>' +
        '<li>That wrapped attack feeds the normal physical-damage routine, but atlas-underflow cases take the high-word multiply path in the RNG helper. That is why the result is usually 999, but not always 999.</li>' +
        '<li>This panel is a <b>manual post-subtraction preview</b>. It does not yet compute the subtraction from stamina or from the exact setup used in real runs.</li>' +
        '<li>The RNG slider below picks one concrete 16-bit RNG state. The bar summarizes all 65536 states for the same boy-atk / manual subtract / def inputs.</li>' +
        '</ul>' +
        '<pre class="doc-code">atk_underflow = (boy_atk - subtract) mod 65536\nw = ~((def\u00f74 - atk_underflow) - 1) &amp; 0xFFFF\nseed = hi16((w+1)\u00d7rng16)\na = (seed + w) mod 65536\ndmg = ((((a \u226a 1) mod 65536) + w + carry(a \u226a 1)) mod 65536) \u00bb 2\nshown = min(999, dmg)</pre>' +
        '<div class="doc-sliders"><label>boy atk <input id="doc-at-atk" type="range" min="0" max="255" value="81"><span id="doc-at-atk-num">81</span></label>' +
        '<label>manual subtract <input id="doc-at-sub" type="range" min="0" max="480" value="480"><span id="doc-at-sub-num">480</span></label>' +
        '<label>def <input id="doc-at-def" type="range" min="0" max="255" value="160"><span id="doc-at-def-num">160</span></label>' +
        '<label>rng16 <input id="doc-at-rng" type="range" min="0" max="65535" value="0"><span id="doc-at-rng-num">0</span></label></div>' +
        '<div id="doc-at-chart"></div>' +
        '</div>' +
        '<div class="doc-sec" data-doc="mapload" style="display:none">' +
        '<h3 class="doc-h">Map Loading</h3>' +
        '<div class="doc-fact">Current status: the exact room-payload codec is still not fully decoded. This section records the grounded loader model from room metadata, trigger-table parsing, breakpoint tracing, and truncation tests.</div>' +
        '<pre class="doc-code">map[33 / "Prehistoria - Strong Heart\'s Exterior"]\ndata     = 0xADB50C\nsize     = 0x0455 (confirmed)\nstep_len = ROM16[0xADB519] = 0x000C = 2 entries\nb_len    = ROM16[0xADB527] = 0x0000\npayload  = 0xADB529 .. 0xADB960</pre>' +
        '<ul class="doc-bullets">' +
        '<li>Each room points at one variable-size blob. For room <b>0x33</b>, the blob begins at <b>0xADB50C</b> and ends at <b>0xADB960</b> because the next room starts immediately after it.</li>' +
        '<li>The first <b>13 bytes</b> are room metadata. Only bytes <b>0</b> and <b>1</b> are currently named with confidence: they behave like <code>trig_off_x</code> and <code>trig_off_y</code>. Bytes <b>2..12</b> are still unknown header fields.</li>' +
        '<li>At offset <b>0x0D</b> the blob switches to trigger tables: <code>step_len</code>, then 6-byte step-on entries; after that comes <code>b_len</code> and the B-trigger entries.</li>' +
        '<li>For room <b>0x33</b> that means: metadata at <b>0xADB50C..0xADB518</b>, step-on table at <b>0xADB519..0xADB526</b>, B-table length at <b>0xADB527..0xADB528</b>, then the room payload from <b>0xADB529</b> onward.</li>' +
        '</ul>' +
        '<div class="doc-val"><b>Working loader model</b></div>' +
        '<ul class="doc-bullets">' +
        '<li>1. Resolve the room\'s <code>data</code> pointer from the map table and hand it to the loader.</li>' +
        '<li>2. The breakpoint at <b>0x908F80</b> (<code>LDA [$8B],Y</code>) shows the routine streaming bytes from the current room blob through the indirect pointer in <code>$8B</code>.</li>' +
        '<li>3. The loader consumes metadata and trigger-table lengths first, then continues into the remaining room payload.</li>' +
        '<li>4. Truncation tests show the payload tail controls collision and hitbox first: deleting bytes from the end removes collision before visible tiles.</li>' +
        '<li>5. Deleting more bytes erases the room from the bottom-right upward, which strongly suggests the decoded output fills later map addresses last.</li>' +
        '<li>6. When the visual payload is mostly gone, the room can still load as a walkable black square: room state and bounds remain valid even though tile and collision data are missing.</li>' +
        '</ul>' +
        '<pre class="doc-code">908F80  B7 8B          LDA [$8B],Y\n$8B = current room blob pointer\nY   = current byte offset inside that blob</pre>' +
        '<div class="doc-val"><b>How that becomes the hut picture</b></div>' +
        '<ul class="doc-bullets">' +
        '<li>The Strong Heart exterior picture is not stored as one flat bitmap. The room payload after the trigger tables is decoded into the room\'s visual and collision buffers.</li>' +
        '<li>The two step-on records only describe the doorway transitions. They do not describe the hut image itself.</li>' +
        '<li>Because the image disappears from bottom-right first when the payload tail is cut, later payload bytes correspond to later-placed tiles in the final room image.</li>' +
        '<li>The black walkable square is the same room after payload loss: enter logic and room origin still exist, but the art and collision payload are no longer complete.</li>' +
        '<li>The current 6-byte trigger-record model matches the in-repo parser notes, but the external SoE tiles viewer C++ source was not re-verified inside this workspace.</li>' +
        '<li>Still open: header bytes 2..12, the exact codec commands, whether graphics and collision are interleaved or split, and the precise buffer layout used before the picture is shown.</li>' +
        '</ul>' +
        '</div>' +
        '<div class="doc-sec" data-doc="script" style="display:none">' +
        '<h3 class="doc-h">Script Opcodes</h3>' +
        '<div class="doc-fact">SoE scripts are event-driven. Each room has up to 4 trigger types: <b>enter</b> (room load), <b>step-on</b> (tile), <b>B-button</b> (interact), <b>global</b>.</div>' +
        '<div class="doc-fact">Opcodes are 1-byte commands followed by 0\u2013N 16-bit word arguments. The Rooms tab shows decoded triggers per room.</div>' +
        '<div style="opacity:.3;margin-top:12px;font-size:10px">Full opcode reference \u2014 coming soon.</div>' +
        '</div>' +
        '<div class="doc-sec" data-doc="evs" style="display:none">' +
        '<h3 class="doc-h">Everscript</h3>' +
        '<div class="doc-fact">High-level scripting language that compiles to SoE opcodes. Supports maps, triggers, if/else, function calls, persistence flags, and inline memory references.</div>' +
        '<div class="doc-fact">Source lives in <code>in/</code>. Entry point is typically <code>in/kaizo/main.evs</code>. Compile: <code>python everscript.py &lt;input&gt;</code>.</div>' +
        '<div style="opacity:.3;margin-top:12px;font-size:10px">Language reference \u2014 coming soon.</div>' +
        '</div>' +
        '<div class="doc-sec" data-doc="plugin" style="display:none">' +
        '<h3 class="doc-h">Radar Plugin</h3>' +
        '<div class="doc-fact"><b>Memory:</b> WRAM usage map for the current function scope. Cells show lifecycle (temp / session / sram / system). Click a cell for details and source lines.</div>' +
        '<div class="doc-fact"><b>Rooms:</b> per-room trigger breakdown \u2014 entrances, step-on, B-triggers, sniff spots. Live mode shows rooms from .evs; Vanilla mode lists all 120 vanilla rooms.</div>' +
        '<div class="doc-fact"><b>Scaling:</b> physical damage calculator plus a level-0 offensive alchemy preview using spell might and enemy magic defense.</div>' +
        '<div class="doc-fact"><b>Docs:</b> this page \u2014 hard facts about game mechanics and tools.</div>' +
        '</div>' +
        '</div></div>' +
        '</div>' +
        '<div class="tab-pane" data-tab="route" style="display:none">' +
        '<div class="rp-wrap">' +
        '<div class="rp-banner">Mock UI only. Physical hit expectations, route-grade spell scaling / 8-cast modeling, XP tables, and route simulation are still missing. This tab is a scaffold for the route-planner workflow.</div>' +
        '<div class="rp-grid">' +
        '<div class="rp-side">' +
        '<div class="rp-h">Add Step</div>' +
        '<div class="rp-templates">' +
        '<div class="rp-tpl"><div><div class="rp-tpl-name">Thraxx\'s Heart</div><div class="rp-tpl-sub">Alchemy 8-cast boss kill</div></div><button class="rp-btn" data-rp-add="heart8">add</button></div>' +
        '<div class="rp-tpl"><div><div class="rp-tpl-name">Skelesnail</div><div class="rp-tpl-sub">Alchemy 8-cast spell leveling</div></div><button class="rp-btn" data-rp-add="skelesnail8">add</button></div>' +
        '<div class="rp-tpl"><div><div class="rp-tpl-name">Magmar</div><div class="rp-tpl-sub">Alchemy any% Act 1 route step</div></div><button class="rp-btn" data-rp-add="magmar8">add</button></div>' +
        '<div class="rp-tpl"><div><div class="rp-tpl-name">Sterling</div><div class="rp-tpl-sub">Physical / atlas overflow example</div></div><button class="rp-btn" data-rp-add="sterlingPhys">add</button></div>' +
        '</div>' +
        '<div class="rp-link-note">Draft spec: docs/route-planner.md</div>' +
        '</div>' +
        '<div class="rp-main">' +
        '<div class="rp-toolbar"><div class="rp-h" style="margin:0">Route</div><div><button class="rp-btn" id="rp-sim-btn">simulate route</button></div></div>' +
        '<div class="rp-toolbar-note">A route is a list of enemies killed by physical or alchemy methods. Dog participation is intentionally ignored in this mock.</div>' +
        '<div id="rp-list"></div>' +
        '<div class="rp-sim"><div class="rp-h">Simulation Output</div><div id="rp-sim-out"></div></div>' +
        '</div>' +
        '</div>' +
        '</div>' +
        '</div>' +
        '<div class="tab-pane" data-tab="rng" style="display:none">' +
        '<div class="rng-wrap">' +
        '<div class="rng-section">' +
        '<div class="rng-h">Naris \u2014 Super Heal</div>' +
        '<div class="rng-desc">Coin flip: the winning value is bit 0 of the game timer when the dialogue opens. 10,000-unit cooldown between attempts. Already owning Super Heal skips to the equip menu.</div>' +
        '<div class="rng-stats">' +
        '<div class="rng-stat"><div class="rng-stat-label">Chance / try</div><div class="rng-stat-val">50%</div></div>' +
        '<div class="rng-stat"><div class="rng-stat-label">Avg attempts</div><div class="rng-stat-val">2</div></div>' +
        '</div>' +
        '<div class="rng-sim-row"><button class="rng-sim-btn" id="rng-naris-btn">Simulate 10,000\xd7</button><div class="rng-sim-out" id="rng-naris-out"></div></div>' +
        '<div class="rng-hist" id="rng-naris-hist"></div>' +
        '</div>' +
        '<div class="rng-section">' +
        '<div class="rng-h">Prophet \u2014 Bronze Armor</div>' +
        '<div class="rng-desc">3-arc state machine (prophecy 0\u20135, meta 6\u20138, chaos 9+). Reach state\u00a08 (VIDEO_GAME) for Bronze Armor. State\u00a05 is a permanent tilt lock. Chaos recovers to state\u00a06 with 1/8 probability per round (or always when interaction count\u00a0>\u00a029).</div>' +
        '<table class="rng-tbl">' +
        '<thead><tr><th>#</th><th>Codename</th><th>Reach 8</th><th>Reach 5</th><th>Next states (odds)</th></tr></thead>' +
        '<tbody>' +
        '<tr class="rng-arc-proph"><td>0</td><td class="codename">DOOM</td><td>~22%</td><td>~17%</td><td>1=28/32, 6=2/32, 9+=2/32</td></tr>' +
        '<tr class="rng-arc-proph"><td>1</td><td class="codename">CATACLYSM</td><td>~24%</td><td>~19%</td><td>2=28/32, 6=2/32, 9+=2/32</td></tr>' +
        '<tr class="rng-arc-proph"><td>2</td><td class="codename">EVIL_LEADER</td><td>~27%</td><td>~22%</td><td>3=28/32, 6=2/32, 9+=2/32</td></tr>' +
        '<tr class="rng-arc-proph"><td>3</td><td class="codename">DIAMOND_EYES</td><td>~34%</td><td>25%</td><td>4=16/32, 6=9/32, 9+=7/32</td></tr>' +
        '<tr class="rng-arc-proph"><td>4</td><td class="codename">STATUE_CORE</td><td>~46%</td><td>50%</td><td>5=16/32, 6=9/32, 9+=7/32</td></tr>' +
        '<tr class="rng-arc-tilt"><td>5</td><td class="codename">I_HAVE_SPOKEN</td><td>0%</td><td>100%</td><td>locked until reset</td></tr>' +
        '<tr class="rng-st-divert rng-arc-meta"><td>6</td><td class="codename">CONTROLLED_BY_OVERLORD</td><td>~66%</td><td>~0.5%</td><td>7=26/32, 0\u20133=3/32, 9+=3/32</td></tr>' +
        '<tr class="rng-arc-meta"><td>7</td><td class="codename">SPRITES</td><td>~81%</td><td>~0.2%</td><td>8=26/32, 0\u20133=3/32, 9+=3/32</td></tr>' +
        '<tr class="rng-st-target rng-arc-meta"><td>8</td><td class="codename">VIDEO_GAME</td><td>100%</td><td>0%</td><td>\u2605 reward</td></tr>' +
        '<tr class="rng-arc-chaos"><td>9</td><td class="codename">GOAT_WARNING</td><td rowspan="11">~18%</td><td rowspan="11">~3%</td><td rowspan="11">chaos=7/8, 6=1/8</td></tr>' +
        '<tr class="rng-arc-chaos"><td>10</td><td class="codename">CHICKEN_RAISE</td></tr>' +
        '<tr class="rng-arc-chaos"><td>11</td><td class="codename">WHITE_ZONE</td></tr>' +
        '<tr class="rng-arc-chaos"><td>12</td><td class="codename">NOODLES</td></tr>' +
        '<tr class="rng-arc-chaos"><td>13</td><td class="codename">GOAT_SNEEZE</td></tr>' +
        '<tr class="rng-arc-chaos"><td>14</td><td class="codename">HOKEY_POKEY</td></tr>' +
        '<tr class="rng-arc-chaos"><td>15</td><td class="codename">FORTUNE_COOKIES</td></tr>' +
        '<tr class="rng-arc-chaos"><td>16</td><td class="codename">SECOND_GOAT_SECRET</td></tr>' +
        '<tr class="rng-arc-chaos"><td>17</td><td class="codename">PENGUINS</td></tr>' +
        '<tr class="rng-arc-chaos"><td>18</td><td class="codename">I_AM_A_FISH</td></tr>' +
        '<tr class="rng-arc-chaos"><td>19</td><td class="codename">FUSELAGE</td></tr>' +
        '</tbody></table>' +
        '<div class="rng-strat-row">' +
        '<label class="rng-pot-lbl">Profile: <select id="rng-prophet-strat" class="rng-sel">' +
        '<option value="mash">Just mash (might tilt)</option>' +
        '<option value="reset4chaos">Reset at 4 + chaos</option>' +
        '<option value="reset4" selected>Reset at 4 only</option>' +
        '<option value="metaonly">Meta arc only (6\u20138)</option>' +
        '</select></label>' +
        '<div class="rng-strat-desc" id="rng-prophet-strat-desc"></div>' +
        '</div>' +
        '<div class="rng-sim-row"><button class="rng-sim-btn" id="rng-prophet-btn">Simulate 10,000\xd7</button><div class="rng-sim-out" id="rng-prophet-out"></div></div>' +
        '<div class="rng-hist" id="rng-prophet-hist"></div>' +
        '</div>' +
        '<div class="rng-section">' +
        '<div class="rng-h">Egg \u2014 Chocobo Egg</div>' +
        '<div class="rng-desc">Hidden reward inside ceramic pots at the Nobilia market. Buying 5 pots triggers reward check at 3/8; buying 10 pots is worse at 3/16. After a triggered reward, 1/16 chance for the Chocobo Egg (otherwise jewels). Buying 1 pot never triggers a reward.</div>' +
        '<div class="rng-stats">' +
        '<div class="rng-stat"><div class="rng-stat-label">5-pot chance</div><div class="rng-stat-val">2.34%</div></div>' +
        '<div class="rng-stat"><div class="rng-stat-label">Avg (5 pots)</div><div class="rng-stat-val">~43</div></div>' +
        '<div class="rng-stat"><div class="rng-stat-label">10-pot chance</div><div class="rng-stat-val">1.17%</div></div>' +
        '<div class="rng-stat"><div class="rng-stat-label">Avg (10 pots)</div><div class="rng-stat-val">~85</div></div>' +
        '</div>' +
        '<div class="rng-sim-row">' +
        '<label class="rng-pot-lbl">Buy: <select id="rng-pot-sel" class="rng-sel"><option value="5" selected>5 pots (optimal)</option><option value="10">10 pots</option></select></label>' +
        '<button class="rng-sim-btn" id="rng-egg-btn">Simulate 10,000\xd7</button>' +
        '<div class="rng-sim-out" id="rng-egg-out"></div>' +
        '</div>' +
        '<div class="rng-hist" id="rng-egg-hist"></div>' +
        '</div>' +
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

    // Invalidate enum cache when core evs files change
    const enumWatcher = vscode.workspace.createFileSystemWatcher('**/in/core/**/*.evs');
    enumWatcher.onDidChange(() => invalidateRadarEnums());
    enumWatcher.onDidCreate(() => invalidateRadarEnums());
    enumWatcher.onDidDelete(() => invalidateRadarEnums());
    context.subscriptions.push(enumWatcher);

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
            const { refs, pools, argRefs } = radarAnalyzeScope(document, scope.startLine, scope.endLine);
            const mapByAddr    = getRadarMap();
            const wsRoot       = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? null;
            const wsRootUri    = wsRoot ? vscode.Uri.file(wsRoot) : null;

            // Load character data for Scaling tab (ROM read is cached; scale detection is per-document)
            if (!_scalingChars) {
                _scalingChars = readRomCharacters(wsRoot);
                _hitLookup    = readRomHitLookup(wsRoot, _scalingChars);
            }
            _scaleActive = detectScaleEnemies(wsRoot, document.uri.fsPath);

            // Reuse existing panel if open; otherwise create a new one
            if (!_radarPanel) {
                _radarPanel = vscode.window.createWebviewPanel(
                    'everscriptRadar',
                    'Radar: ' + scope.name,
                    vscode.ViewColumn.Beside,
                    {
                        enableScripts: true,
                        retainContextWhenHidden: true,
                        localResourceRoots: [wsRootUri, vscode.Uri.file(getExtConfig().assetsPath)].filter(Boolean),
                    },
                );
                _radarPanel.onDidDispose(() => {
                    _radarPanel = null;
                    _radarPinned = false;
                    _radarCurrentScope = null;
                    _radarRoomTree = null;
                    _radarRoomDocPath = null;
                    _radarActiveTab = 'radar';
                    _ingrBaseUri = '';
                }, null, context.subscriptions);
            } else {
                _radarPanel.title = 'Radar: ' + scope.name;
                _radarPanel.reveal(vscode.ViewColumn.Beside, true);
            }

            // Compute ingredient image base URI (once per panel lifetime)
            if (!_ingrBaseUri) {
                try {
                    const ingrDir = path.join(getExtConfig().assetsPath, 'ingredients');
                    _ingrBaseUri = _radarPanel.webview.asWebviewUri(vscode.Uri.file(ingrDir)).toString() + '/';
                } catch { _ingrBaseUri = ''; }
            }

            // Build or reuse room tree (rebuild when document changes)
            if (_radarRoomDocPath !== document.uri.fsPath) {
                _radarRoomTree    = buildRoomTree(document, wsRoot);
                _radarRoomDocPath = document.uri.fsPath;
                setRoomImageUris(_radarRoomTree, _radarPanel.webview);
            }

            const selectedMap = scope.kind === 'map' ? scope.name : null;
            _radarPanel.webview.html = renderRadarHtml(scope, refs, pools, argRefs, mapByAddr, _radarRoomTree, _radarActiveTab, selectedMap, _scalingChars || [], _scaleActive, _ingrBaseUri, _hitLookup);

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
                        const { refs, pools, argRefs } = radarAnalyzeScope(_radarDoc, 0, _radarDoc.lineCount - 1);
                        _scaleActive = detectScaleEnemies(wsRoot, _radarDoc.uri?.fsPath ?? null);
                        _radarPanel.webview.html = renderRadarHtml(gscope, refs, pools, argRefs, getRadarMap(), _radarRoomTree || [], _radarActiveTab, null, _scalingChars || [], _scaleActive, _ingrBaseUri, _hitLookup);
                        _radarPanel.title = 'Radar: (global)';
                    }
                } else if (msg.command === 'autoScope') {
                    _radarPinned = false;
                    refreshRadar(vscode.window.activeTextEditor);
                } else if (msg.command === 'moveEntity') {
                    if (!_radarDoc || typeof msg.line !== 'number' || msg.line < 0) return;
                    const lineIdx = Math.min(Math.max(0, msg.line), _radarDoc.lineCount - 1);
                    const lineText = _radarDoc.lineAt(lineIdx).text;
                    const fmt = (n) => '0x' + n.toString(16).padStart(2, '0');
                    let newText;
                    if (msg.kind === 'entrance') {
                        newText = lineText.replace(
                            /entrance\s*\(\s*[0-9a-fA-Fx]+\s*,\s*[0-9a-fA-Fx]+\s*,/,
                            `entrance(${fmt(msg.newX)}, ${fmt(msg.newY)},`
                        );
                    } else if (msg.kind === 'enemy') {
                        newText = lineText.replace(
                            /(add_\w*_?enemy\s*\(\s*[^,)]+\s*,\s*)([0-9a-fA-Fx]+)(\s*,\s*)([0-9a-fA-Fx]+)/,
                            (_, pre, _x, sep) => pre + fmt(msg.newX) + sep + fmt(msg.newY)
                        );
                    }
                    if (newText && newText !== lineText) {
                        const edit = new vscode.WorkspaceEdit();
                        edit.replace(_radarDoc.uri, _radarDoc.lineAt(lineIdx).range, newText);
                        vscode.workspace.applyEdit(edit);
                    }
                } else if (msg.command === 'pickRoomImage') {
                    // Let user pick an image file and assign it to this room
                    vscode.window.showOpenDialog({ filters: { Images: ['png', 'jpg', 'jpeg', 'webp'] }, canSelectMany: false }).then(uris => {
                        if (!uris || !uris.length) return;
                        const chosen = uris[0].fsPath;
                        // Find the node in the room tree and update imagePath
                        function patchNode(nodes) {
                            for (const n of nodes || []) {
                                if (n.kind === 'map' && n.name === msg.mapName) { n.imagePath = chosen; return true; }
                                if (n.children && patchNode(n.children)) return true;
                            }
                            return false;
                        }
                        patchNode(_radarRoomTree);
                        if (_radarPanel) setRoomImageUris(_radarRoomTree, _radarPanel.webview);
                        refreshRadar(vscode.window.activeTextEditor);
                    });
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

    // ── Debugger: DebugConfigurationProvider ────────────────────────────────
    // Handles two cases:
    //   1. F5 with no launch.json → fills in defaults using the active .evs file
    //   2. A launch.json entry with program:"${file}" that VS Code did not expand
    context.subscriptions.push(
        vscode.debug.registerDebugConfigurationProvider('everscript', {
            provideDebugConfigurations(folder) {
                const editor  = vscode.window.activeTextEditor;
                const program = (editor && editor.document.languageId === 'everscript')
                    ? editor.document.uri.fsPath
                    : '${file}';
                return [{
                    type:          'everscript',
                    request:       'launch',
                    name:          'Debug current .evs file',
                    program,
                    entryFunction: 'trigger_enter',
                }];
            },
            resolveDebugConfiguration(folder, config) {
                // F5 with no launch.json → empty config, fill it in
                if (!config.type && !config.request && !config.name) {
                    const editor = vscode.window.activeTextEditor;
                    if (editor && editor.document.languageId === 'everscript') {
                        config.type          = 'everscript';
                        config.request       = 'launch';
                        config.name          = 'Debug .evs file';
                        config.program       = editor.document.uri.fsPath;
                        config.entryFunction = 'trigger_enter';
                    }
                }
                // Resolve unexpanded ${file} (shouldn't happen, safety net)
                if (config.program === '${file}') {
                    const editor = vscode.window.activeTextEditor;
                    if (editor) config.program = editor.document.uri.fsPath;
                }
                return config;
            },
        }),
    );

    // ── Emulator Panel ───────────────────────────────────────────────────────
    const { openEmulatorPanel } = require('./emulator/panel');
    context.subscriptions.push(
        vscode.commands.registerCommand('everscript.openEmulator', () => {
            openEmulatorPanel(context);
        }),
    );

    // ── Build-and-Run (F5 in .evs files) ─────────────────────────────────────
    context.subscriptions.push(
        vscode.commands.registerCommand('everscript.buildAndRun', async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor || editor.document.languageId !== 'everscript') {
                vscode.window.showWarningMessage('Everscript: no .evs file is active.');
                return;
            }

            const cfg       = vscode.workspace.getConfiguration('everscript');
            const wsRoot    = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? '';
            const nodePath  = require('path');
            const nodeFs    = require('fs');
            const cp        = require('child_process');

            // ── 1. Resolve compiler binary ─────────────────────────────────
            let compilerBin  = cfg.get('compilerPath', '').trim();
            let projectRoot  = cfg.get('projectRoot', '').trim();

            if (!compilerBin) {
                // Walk up from the active .evs file looking for dist/everscript_mac
                const binaryNames = ['everscript_mac', 'everscript', 'everscript.exe'];
                let dir = nodePath.dirname(editor.document.uri.fsPath);
                for (let depth = 0; depth < 8 && !compilerBin; depth++) {
                    for (const bin of binaryNames) {
                        const candidate = nodePath.join(dir, 'dist', bin);
                        if (nodeFs.existsSync(candidate)) {
                            compilerBin = candidate;
                            if (!projectRoot) projectRoot = dir;
                            break;
                        }
                    }
                    const parent = nodePath.dirname(dir);
                    if (parent === dir) break;
                    dir = parent;
                }
            }

            if (!compilerBin) {
                vscode.window.showErrorMessage(
                    'Everscript: compiler not found. Set "everscript.compilerPath" in settings ' +
                    'or place the compiled binary at dist/everscript_mac in your project root.'
                );
                return;
            }

            if (!projectRoot) {
                projectRoot = nodePath.dirname(nodePath.dirname(compilerBin)); // parent of dist/
            }

            // ── 2. Resolve ROM name ────────────────────────────────────────
            // Look for the base ROM in the project root (the one the compiler patches).
            let romName = '';
            try {
                const files = nodeFs.readdirSync(projectRoot);
                const smc = files.find(f => /\.smc$/i.test(f) && !/[/\\]out[/\\]/.test(f));
                if (smc) romName = smc;
            } catch (_) {}

            if (!romName) {
                vscode.window.showErrorMessage(
                    'Everscript: no .smc ROM found in project root "' + projectRoot + '". ' +
                    'Ensure the base ROM is present alongside the compiler.'
                );
                return;
            }

            // ── 3. Run the compiler ────────────────────────────────────────
            const inputEvs  = editor.document.uri.fsPath;
            const outputRom = nodePath.join(projectRoot, 'out', romName);

            const channel = vscode.window.createOutputChannel('Everscript Build');
            channel.clear();
            channel.show(true);
            channel.appendLine(`[Everscript] Compiling: ${nodePath.basename(inputEvs)}`);
            channel.appendLine(`[Everscript] Compiler:  ${compilerBin}`);
            channel.appendLine(`[Everscript] CWD:       ${projectRoot}`);
            channel.appendLine(`[Everscript] ROM:       ${romName}`);
            channel.appendLine('');

            const statusItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
            statusItem.text = '$(sync~spin) Everscript: building…';
            statusItem.show();

            const exitCode = await new Promise(resolve => {
                const proc = cp.spawn(
                    compilerBin,
                    ['--rom', romName, inputEvs],
                    { cwd: projectRoot, shell: false }
                );
                proc.stdout.on('data', d => channel.append(d.toString()));
                proc.stderr.on('data', d => channel.append(d.toString()));
                proc.on('close', code => resolve(code));
                proc.on('error', err => {
                    channel.appendLine('[Everscript] Error: ' + err.message);
                    resolve(1);
                });
            });

            statusItem.dispose();

            if (exitCode !== 0) {
                vscode.window.showErrorMessage(
                    'Everscript build failed (exit ' + exitCode + '). See Output → Everscript Build.'
                );
                return;
            }

            channel.appendLine('[Everscript] Build succeeded.');

            // ── 4. Load the output ROM in the emulator ─────────────────────
            let romData;
            try {
                romData = nodeFs.readFileSync(outputRom);
            } catch (e) {
                vscode.window.showErrorMessage('Everscript: build succeeded but output ROM not found: ' + e.message);
                openEmulatorPanel(context);
                return;
            }
            const dataUrl = 'data:application/octet-stream;base64,' + romData.toString('base64');
            openEmulatorPanel(context, { dataUrl, name: nodePath.basename(outputRom) });
        }),
    );
}

function deactivate() {}

module.exports = { activate, deactivate };
