'use strict';

const vscode = require('vscode');
const path   = require('path');
const fs     = require('fs');
const { radarLifecycle, radarH, radarEsc, radarExtractEmoji, radarParseName, radarParseNotes, parseEvsNum, parseEnumsFromContent, parseEvsEnumValues } = require('./radar-utils');
const { alchemyEffectiveMdef, alchemyRangeAtLevel, alchemySpellPowerAtLevel, alchemySpellBonusBaseAtLevel, alchemyDamageFromPower, alchemyDamageSamples, alchemyMagicDefenseAtLevel, alchemyTargetHpAtLevel, alchemyProjectedRange } = require('./alchemy-model');

const alchemyWebviewEffectiveMdef = alchemyEffectiveMdef.toString().replace(/function alchemyEffectiveMdef/, 'function effectiveMdef');
const alchemyWebviewBonusBase = alchemySpellBonusBaseAtLevel.toString();
const alchemyWebviewDamageFromPower = alchemyDamageFromPower.toString();
const alchemyWebviewDamageSamples = alchemyDamageSamples
    .toString()
  .replace(/alchemySpellPowerAtLevel/g, 'alchemySpellPowerAtLevel')
  .replace(/alchemySpellBonusBaseAtLevel/g, 'alchemySpellBonusBaseAtLevel')
  .replace(/alchemyDamageFromPower/g, 'alchemyDamageFromPower');
const alchemyWebviewRange = alchemyRangeAtLevel
  .toString()
  .replace(/alchemySpellPowerAtLevel/g, 'alchemySpellPowerAtLevel')
  .replace(/alchemySpellBonusBaseAtLevel/g, 'alchemySpellBonusBaseAtLevel')
  .replace(/alchemyDamageFromPower/g, 'alchemyDamageFromPower');
const alchemyWebviewSpellPower = alchemySpellPowerAtLevel.toString();
const alchemyWebviewMagicDefenseAtLevel = alchemyMagicDefenseAtLevel.toString();
const alchemyWebviewTargetHpAtLevel = alchemyTargetHpAtLevel.toString();
const alchemyWebviewProjectedRange = alchemyProjectedRange
  .toString()
  .replace(/alchemySpellPowerAtLevel/g, 'alchemySpellPowerAtLevel')
  .replace(/alchemyRangeAtLevel/g, 'alchemyRangeAtLevel')
  .replace(/alchemyMagicDefenseAtLevel/g, 'alchemyMagicDefenseAtLevel')
  .replace(/alchemyRangeLevel0/g, 'alchemyRangeAtLevel');

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
                    if (_rh) { content.trigOffset = { offX: _rh.offX, offY: _rh.offY }; content.romHeader = _rh; }
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
            if (mapNum !== undefined) { const _rh = readRomMapHeader(wsRoot, mapNum); if (_rh) { content.trigOffset = { offX: _rh.offX, offY: _rh.offY }; content.romHeader = _rh; } }
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

    const css = `*{box-sizing:border-box;margin:0;padding:0}
html,body{height:100%;overflow:hidden}
body{font:11px/1.4 "SF Mono","Cascadia Code",monospace;background:var(--vscode-editor-background);color:var(--vscode-editor-foreground);padding:8px 10px 0;display:flex;flex-direction:column}
h2{font-size:9px;text-transform:uppercase;letter-spacing:.08em;opacity:.32;margin:8px 0 2px;font-weight:700}
.sm{opacity:.4;font-size:10px;margin-bottom:6px}
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
.fb.fhideargs{border-color:#559988;color:#77bbaa}
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
tr.dr.hrow{display:none!important}
.arg-row-empty{opacity:.25}
body.hideargs .arg-row-empty{display:none!important}
.arg-word{width:14px!important}
.ph-sub{font-weight:400;opacity:.5;text-transform:none;letter-spacing:0;margin-left:3px;font-size:9px}
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
.enum-tag{font-size:8px;border-radius:3px;padding:0 3px;background:#1a1a2a;border:1px solid #444;color:#aaaacc;font-family:inherit}
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
.rm-ph{font-size:9px;text-transform:uppercase;letter-spacing:.08em;opacity:.32;padding:3px 0 5px;font-weight:700;display:flex;justify-content:space-between;align-items:center}
.rm-mode{display:flex;gap:2px;opacity:1}
.rmm{font-size:8px;padding:1px 5px;border-radius:3px;border:1px solid #333;background:#1a1a1a;color:#888;cursor:pointer;line-height:14px}
.rmm.active{background:#2a4a6a;color:#7ab8ff;border-color:#3a6a9a}
.rm-empty{opacity:.25;font-size:10px;padding:6px 0}
/* ── Room tree ── */
.rt{list-style:none;padding:0;margin:0}.rt .rt{padding-left:12px}
.vn-map{cursor:pointer;padding:1px 0 1px 4px;display:flex;align-items:center;gap:4px;border-radius:2px}
.vn-map:hover{background:#1e2a1e}.vn-map.rsel{background:#1a2a3a}
.rn-vid-tag{font-size:8px;opacity:.35;font-family:monospace;flex-shrink:0}
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
.rd-filters{display:flex;gap:3px;flex-wrap:wrap;margin-top:4px}
.rdf{border:1px solid #444;border-radius:8px;padding:1px 6px;cursor:pointer;font-size:9px;background:transparent;color:#aaa;opacity:.35}
.rdf.on{opacity:1}
.hide-ent .svge-entrance,.hide-ent .rs-entrance{display:none!important}
.hide-enem .svge-enemy,.hide-enem .rs-enemies{display:none!important}
.hide-obj .rs-objects{display:none!important}
.hide-trans .rs-transitions{display:none!important}
.hide-step .svge-step,.hide-step .rs-step{display:none!important}
.hide-btrig .svge-btrig,.hide-btrig .rs-btrig{display:none!important}
.trig-coord{font-size:9px;font-family:monospace;color:#888;margin-right:4px}
.obj-desc{font-size:9px;color:#aaa;font-style:italic}
.trig-step em{color:#ff69b4;font-style:normal}.trig-b em{color:#ddaa00;font-style:normal}
/* ── Room grid ── */
.rg-outer{position:relative;margin-bottom:8px}
.rg-zoom{display:flex;gap:3px;align-items:center;margin-bottom:4px}
.rg-zoom button{border:1px solid #444;background:transparent;color:#aaa;cursor:pointer;font-size:12px;line-height:1;padding:1px 6px;border-radius:4px}
.rg-zoom button:hover{color:#ddd;border-color:#888}
.rg-wrap{position:relative;overflow:hidden;background:#1a1a1a;border:1px solid #333;display:block;margin-bottom:0;cursor:default}
.rg-svg{position:absolute;inset:0;display:block}
.room-img{display:block;width:100%;height:100%;object-fit:fill;opacity:.55;image-rendering:pixelated}
.rg-placeholder{display:flex;flex-direction:column;align-items:center;justify-content:center;width:100%;height:80px;opacity:.25;border:1px solid #444;margin-bottom:8px;color:#888;font-size:10px;gap:6px}
.rg-pick-btn{font-size:9px;border:1px solid #555;background:transparent;color:#aaa;cursor:pointer;border-radius:4px;padding:2px 8px}
.rg-pick-btn:hover{border-color:#888;color:#ddd}
/* entity labels: only visible on hover via .rg-svg.hov class */
.rg-svg .ent-label{opacity:0;pointer-events:none;transition:opacity .1s}
.rg-svg.show-labels .ent-label{opacity:1}
/* hover highlight in SVG */
.svge-step,.svge-btrig,.svge-enemy,.svge-entrance{cursor:pointer}
.svge-step.hi,.svge-btrig.hi,.svge-enemy.hi,.svge-entrance.hi{filter:brightness(1.8)}
.svge-step.svge-sel,.svge-btrig.svge-sel,.svge-enemy.svge-sel,.svge-entrance.svge-sel{stroke:orange!important;stroke-width:0.5!important}
.svge-mv{cursor:grab}.svge-mv:active{cursor:grabbing}
.rg-locked .svge-mv{cursor:not-allowed}
.hide-ingr .svge-ingr{display:none}
.rs-tbl tr.sel-row{opacity:1;background:rgba(255,165,0,0.12)!important}
.rg-wrap{cursor:grab}.rg-wrap.rg-panning{cursor:grabbing}
/* ── Room sections / tables ── */
.rs{margin-top:8px}
.rs-h{font-size:9px;text-transform:uppercase;letter-spacing:.05em;opacity:.38;margin-bottom:3px;font-weight:700}
.rs-tbl{width:100%;border-collapse:collapse;font-size:10px}
.rs-tbl td,.rs-tbl th{padding:1px 4px;text-align:left;vertical-align:top}
.rs-tbl th{font-size:8px;text-transform:uppercase;opacity:.35;font-weight:700;padding-bottom:3px}
.rs-tbl tr{opacity:.7}
.rs-tbl tr:hover{opacity:1;background:rgba(255,255,255,.04)}
.rs-tbl tr.hi-row{opacity:1;background:rgba(255,255,255,.1)!important}
.badge-d{font-size:7px;opacity:.55;border:1px solid #ffa94d;border-radius:3px;padding:0 2px;color:#ffa94d}
/* ── ROM header section ── */
.rs-romhdr .rsh-toggle{cursor:pointer;user-select:none}.rs-romhdr .rsh-toggle:hover{opacity:.7}
.rsh-body.rsh-collapsed{display:none}
.rsh-tbl td:first-child{font-family:monospace;font-size:9px;opacity:.55;width:54px;white-space:nowrap}
.rsh-tbl td:nth-child(2){font-family:monospace;font-size:10px;font-weight:700;width:42px;color:#c5e3ff}
.rsh-tbl td:nth-child(3){font-size:9px;width:160px}
.rsh-tbl td:nth-child(3) code{font-size:8.5px;color:#b5d3ff;background:#0d1a28;padding:0 3px;border-radius:2px}
.rsh-tbl td:nth-child(4){font-family:monospace;font-size:8px;opacity:.55;width:110px}
.rsh-tbl td:nth-child(5){font-size:9px;opacity:.65;max-width:220px}
.rsh-conf-h{opacity:1}.rsh-conf-m{opacity:.8;color:#ffd580}.rsh-conf-l{opacity:.45;font-style:italic}
.rsh-derived{font-size:10px;margin:4px 0;opacity:.8;line-height:1.8;font-family:monospace}
.rsh-preset{display:inline-block;font-size:9px;border:1px solid #3a6a9a;border-radius:10px;padding:1px 8px;background:#0e1e2e;color:#7ab8ff}
.rsh-preset.rsh-unknown{color:#666;border-color:#333;background:#1a1a1a}
.rsh-sig{font-family:monospace;font-size:8px;opacity:.35;margin-left:8px}
.rsh-tiles{display:flex;flex-wrap:wrap;gap:3px;margin:4px 0}
.rsh-tile{font-family:monospace;font-size:9px;padding:1px 5px;background:#0d1a28;border:1px solid #2a3a4a;border-radius:3px;color:#99bbdd}
.rsh-section-lbl{font-size:8px;text-transform:uppercase;letter-spacing:.06em;opacity:.3;margin:7px 0 2px;font-weight:700}
.rsh-trig-info{font-size:10px;opacity:.7;line-height:1.8;font-family:monospace}
.rsh-payload-note{font-size:8px;opacity:.3;margin-top:3px}
/* ── Scaling tab ── */
.sc-wrap{display:flex;flex-direction:column;flex:1;min-height:0;padding:8px;gap:8px;overflow:auto}
.sc-banner{font-size:10px;padding:3px 8px;background:rgba(255,200,0,0.12);border:1px solid rgba(255,200,0,0.3);border-radius:4px;color:#ffd700}
.sc-controls{display:flex;flex-wrap:wrap;gap:6px;align-items:flex-end}
.sc-field{display:flex;flex-direction:column;gap:2px}
.sc-label{font-size:9px;text-transform:uppercase;letter-spacing:.05em;opacity:.45;font-weight:700}
.sc-sel,.sc-num{background:#1e1e1e;border:1px solid #444;color:#ddd;font-size:10px;padding:2px 4px;border-radius:3px}
.sc-sel{min-width:160px;max-width:220px}
.sc-num{width:62px}
.sc-chart-wrap{border:1px solid #2a2a2a;border-radius:4px;background:#161616;padding:4px}
.sc-chart-wrap svg text{font-family:monospace;fill:#888}
.sc-fill{fill:rgba(100,160,255,0.15)}
.sc-line-min{fill:none;stroke:#4488ff;stroke-width:1}
.sc-line-max{fill:none;stroke:#4488ff;stroke-width:1.5}
.sc-fill-b{fill:rgba(255,100,100,0.12)}
.sc-line-min-b{fill:none;stroke:#ff6644;stroke-width:1}
.sc-line-max-b{fill:none;stroke:#ff6644;stroke-width:1.5}
.sc-marker{stroke:#ffd700;stroke-width:1;stroke-dasharray:3,2}
.sc-note{font-size:9px;opacity:.4;font-style:italic}
.sc-xinfo{font-size:9px;padding:2px 0;min-height:16px;color:#aaa}
.sc-stats{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:4px}
.sc-stat-box{border:1px solid #2a2a2a;border-radius:4px;padding:4px 6px;font-size:10px}
.sc-stat-box .sc-stat-name{font-size:9px;opacity:.5;margin-bottom:2px}
.sc-stat-row{display:flex;justify-content:space-between;font-size:10px;line-height:1.5}
.sc-stat-val{font-family:monospace;color:#ddd}
.sc-toggle-group{display:flex;gap:2px}
.sc-toggle-btn{background:#2a2a2a;border:1px solid #444;color:#888;font-size:9px;padding:2px 7px;border-radius:3px;cursor:pointer;font-family:inherit;transition:none}
.sc-toggle-btn.sc-active{background:#2e3248;border-color:#556acc;color:#88aaff}
.sc-slider-wrap{display:flex;align-items:center;gap:8px;min-width:180px}
.sc-slider{width:140px}
.sc-slider-num{font-size:10px;color:#bfbfbf;min-width:16px;text-align:right}
.sc-chart-layout{display:flex;gap:8px;align-items:flex-start;flex-wrap:wrap}
.sc-hit-chart{margin-top:2px}
.sc-hit-lbl{font-size:8px;opacity:.38;margin-top:1px;text-align:right;font-family:monospace}
.sc-legend{display:flex;flex-direction:column;gap:1px;overflow-y:auto;max-height:204px;min-width:140px}
.sc-leg-row{display:flex;align-items:center;gap:4px;padding:2px 5px;border-radius:3px;cursor:pointer;font-size:9px;white-space:nowrap}
.sc-leg-row:hover{background:rgba(255,255,255,.06)}
.sc-leg-sel{background:rgba(255,255,255,.1)!important}
.sc-leg-dim{opacity:.28}
.sc-leg-dot{display:inline-block;width:8px;height:8px;border-radius:50%;flex-shrink:0}
.sc-leg-name{min-width:58px;font-weight:600}
.sc-leg-range{opacity:.5;font-size:8px}
/* ── Docs tab ── */
.doc-wrap{display:flex;flex-direction:column;flex:1;min-height:0;overflow:hidden}
.doc-subnav{display:flex;gap:2px;padding:4px 8px;border-bottom:1px solid #222;flex-shrink:0;flex-wrap:wrap}
.doc-btn{font-size:9px;padding:2px 8px;border-radius:3px;border:1px solid #333;background:#1a1a1a;color:#888;cursor:pointer;line-height:14px}
.doc-btn.doc-btn-active{background:#1e3a1e;color:#88cc88;border-color:#336633}
.doc-content{flex:1;overflow-y:auto;padding:10px 12px}
.doc-sec{}
.doc-h{font-size:13px;font-weight:600;margin:0 0 6px;color:#ccc}
.doc-fact{font-size:10px;color:#aaa;margin:4px 0;line-height:1.5}
.doc-bullets{margin:6px 0 8px 16px;padding:0;color:#aaa;font-size:10px;line-height:1.55}
.doc-bullets li{margin:3px 0}
.doc-code{font-size:10px;background:#0f0f0f;border:1px solid #222;padding:6px 8px;border-radius:3px;margin:4px 0 8px;color:#88cc88;overflow-x:auto;white-space:pre;display:block}
.doc-sliders{display:flex;flex-direction:column;gap:4px;margin:6px 0;font-size:10px;color:#aaa}
.doc-sliders label{display:flex;align-items:center;gap:6px}
.doc-sliders input[type=range]{width:160px}
.doc-sliders span{min-width:24px;font-family:monospace}
.doc-val{font-size:11px;color:#ccc;margin:2px 0}
.doc-cap{color:#ff9966;font-size:10px;margin-left:8px}
.doc-hr-name{opacity:.55;font-size:9px;margin-right:2px}
.doc-htable{border-collapse:collapse;font-size:9px;margin-top:6px;max-width:100%}
.doc-htable th,.doc-htable td{padding:2px 6px;border:1px solid #1e1e1e;text-align:right;white-space:nowrap}
.doc-htable th{background:#111;color:#666;font-weight:normal}
.doc-htable td:first-child{text-align:left;color:#666}
.doc-dist{margin-top:8px}
.doc-dist-cap{font-size:9px;opacity:.52;margin-top:2px}
/* ── Route planner mock ── */
.rp-wrap{display:flex;flex-direction:column;flex:1;min-height:0;padding:8px;gap:8px;overflow:auto}
.rp-banner{font-size:10px;padding:6px 8px;border:1px solid #34524a;background:rgba(52,82,74,.18);border-radius:4px;color:#9ed0bf}
.rp-grid{display:grid;grid-template-columns:minmax(220px,280px) minmax(0,1fr);gap:8px;min-height:0}
.rp-side,.rp-main{border:1px solid #2a2a2a;border-radius:4px;background:#161616;padding:8px;min-width:0}
.rp-h{font-size:10px;text-transform:uppercase;letter-spacing:.06em;opacity:.46;margin:0 0 6px;font-weight:700}
.rp-templates{display:flex;flex-direction:column;gap:6px}
.rp-tpl{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:6px 8px;border:1px solid #2b2b2b;border-radius:4px;background:#121212}
.rp-tpl-name{font-size:10px;color:#ddd;font-weight:600}
.rp-tpl-sub{font-size:9px;color:#888}
.rp-btn,.rp-btn-ghost{border:1px solid #444;border-radius:4px;background:#232323;color:#ccc;padding:4px 8px;font-size:9px;cursor:pointer}
.rp-btn:hover,.rp-btn-ghost:hover{border-color:#777;color:#eee}
.rp-btn:disabled,.rp-btn-ghost:disabled{opacity:.45;cursor:default}
.rp-toolbar{display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:8px}
.rp-toolbar-note{font-size:9px;color:#888}
.rp-table{width:100%;border-collapse:collapse;font-size:10px}
.rp-table th,.rp-table td{padding:4px 6px;border-bottom:1px solid #222;text-align:left;vertical-align:top}
.rp-table th{font-size:8px;text-transform:uppercase;letter-spacing:.05em;opacity:.4}
.rp-empty{padding:10px 8px;border:1px dashed #333;border-radius:4px;color:#777;font-size:10px}
.rp-tag{display:inline-block;font-size:8px;padding:1px 5px;border-radius:999px;border:1px solid #444;color:#aaa;background:#1d1d1d}
.rp-sim{margin-top:8px;border-top:1px solid #222;padding-top:8px}
.rp-sim ul{margin:6px 0 0 16px;padding:0;font-size:10px;color:#aaa;line-height:1.5}
.rp-link-note{font-size:9px;color:#777;margin-top:6px}
@media (max-width: 900px){.rp-grid{grid-template-columns:1fr}}
`;

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
    const scalingJs = `
(function(){
  ${alchemyWebviewEffectiveMdef}
  ${alchemyWebviewBonusBase}
  ${alchemyWebviewDamageFromPower}
  ${alchemyWebviewDamageSamples}
  ${alchemyWebviewRange}
  ${alchemyWebviewSpellPower}
  ${alchemyWebviewMagicDefenseAtLevel}
  ${alchemyWebviewTargetHpAtLevel}
  ${alchemyWebviewProjectedRange}
  if(!SC_CHARS.length){
    var ce=document.getElementById('sc-chart');
    if(ce)ce.innerHTML='<div style="padding:16px;opacity:.4;font-size:11px">ROM not found \u2014 place the .smc in workspace root.</div>';
    return;
  }
  var srcId=0,srcLv=0,charge=100;
  var attackMode='physical';
  var selWid=null;
  var crosshairLv=null;
  var scaleEnemies=false,atlasMode=false;
  var alSpellLevel=0,alTargetLevel=1;

  var srcSel=document.getElementById('sc-src-sel');
  var tgtSel=document.getElementById('sc-tgt-sel');
  var modeSel=document.getElementById('sc-mode-sel');
  SC_CHARS.forEach(function(c){
    var scalable=SC_SCALABLE.hasOwnProperty(c.id);
    var label='#'+String(c.id).padStart(3,'0')+' '+c.name+(scalable?' \u2605':'');
    [srcSel,tgtSel].forEach(function(sel){
      var o=document.createElement('option');o.value=c.id;o.textContent=label;sel.appendChild(o);
    });
  });
  srcSel.value=0;
  tgtSel.value=SC_CHARS.some(function(c){return c.id===109;})?109:0;
  if(modeSel)modeSel.value=attackMode;

  ['sc-src-lv','sc-tgt-lv'].forEach(function(id){
    var sel=document.getElementById(id);
    for(var lv=1;lv<=SC_MAX_LEVEL;lv++){var o=document.createElement('option');o.value=lv;o.textContent='L'+lv;sel.appendChild(o);}
  });

  function isScalable(id){return SC_SCALABLE.hasOwnProperty(+id);}
  function getWeapons(){
    if(+srcId===1)return[{id:'paws',label:'Dog Claws',type:'dog',bonus:0}];
    if(!isScalable(srcId))return[{id:'raw',label:'Raw atk',type:'dog',bonus:0}];
    return SC_WEAPONS;
  }
  function getAttackItems(){
    return attackMode==='alchemy'?SC_SPELLS:getWeapons();
  }
  function targetMagicDefense(target){
    if(!target)return 0;
    if(typeof target.magic_defense==='number')return target.magic_defense;
    if(typeof target.magicDefense==='number')return target.magicDefense;
    return 0;
  }
  function targetGrowth(target){return target&&SC_SCALABLE[+target.id]?SC_SCALABLE[+target.id]:null;}
  function targetHpAtLevel(target,level){
    var growth=targetGrowth(target);
    return growth?alchemyTargetHpAtLevel(target.hp,growth.hpG,level):((target&&target.hp)||1);
  }
  function targetMagicDefenseAtLevel(target,level){
    var growth=targetGrowth(target);
    return growth?alchemyMagicDefenseAtLevel(targetMagicDefense(target),growth.defG,level):targetMagicDefense(target);
  }
  function updateAlchemySliderLabels(){
    var spellNum=document.getElementById('sc-al-spell-lv-num');
    if(spellNum)spellNum.textContent=String(alSpellLevel);
    var targetNum=document.getElementById('sc-al-tgt-lv-num');
    if(targetNum)targetNum.textContent=String(alTargetLevel);
  }
  function syncAlchemyTargetSlider(){
    var tgt=SC_CHARS.find(function(c){return c.id===+tgtSel.value;})||SC_CHARS[0];
    var slider=document.getElementById('sc-al-tgt-lv');
    if(!slider)return;
    if(!isScalable(tgt&&tgt.id)){
      alTargetLevel=1;
      slider.value='1';
      slider.disabled=true;
    }else{
      slider.disabled=false;
      slider.value=String(alTargetLevel);
    }
    updateAlchemySliderLabels();
  }
  function updateLevelFields(){
    var isAlchemy=attackMode==='alchemy';
    document.getElementById('sc-src-field').style.display=isAlchemy?'none':'flex';
    document.getElementById('sc-charge-field').style.display=isAlchemy?'none':'flex';
    document.getElementById('sc-atlas-field').style.display=isAlchemy?'none':'flex';
    document.getElementById('sc-scale-field').style.display=isAlchemy?'none':'flex';
    document.getElementById('sc-src-lv-field').style.display=(!isAlchemy&&isScalable(srcId))?'flex':'none';
    document.getElementById('sc-tgt-lv-field').style.display=(!isAlchemy&&scaleEnemies&&isScalable(+tgtSel.value))?'flex':'none';
    document.getElementById('sc-al-spell-lv-field').style.display=isAlchemy?'flex':'none';
    document.getElementById('sc-al-tgt-lv-field').style.display=isAlchemy?'flex':'none';
    document.getElementById('sc-hit-chart').style.display='block';
    if(isAlchemy)syncAlchemyTargetSlider();
    var noteEl=document.getElementById('sc-note');
    if(noteEl){
      noteEl.textContent=isAlchemy
        ? 'Offensive alchemy now uses the traced projectile path: cast-side spell power scales by the ROM level table, then hit damage is multiplied by (0x40 - magic_defense) / 0x40. Target-level preview still reuses defense growth because no separate magic-defense growth table is wired yet.'
        : '★ = scalable (level grows). Scaling uses one physical damage helper for all cases: stamina first adjusts attack, Atlas optionally subtracts 480 before damage, then the same RNG-based physical formula computes min/max/999-cap odds.';
    }
  }

  srcSel.addEventListener('change',function(){
    srcId=+srcSel.value;
    var items=getAttackItems();selWid=items.length?items[0].id:null;
    updateLevelFields();redraw();
  });
  tgtSel.addEventListener('change',function(){syncAlchemyTargetSlider();updateLevelFields();redraw();});
  if(modeSel)modeSel.addEventListener('change',function(){
    attackMode=modeSel.value||'physical';
    atlasMode=false;
    var atBtnReset=document.getElementById('sc-atlas-toggle');
    atBtnReset.textContent='OFF';
    atBtnReset.classList.remove('sc-active');
    var items=getAttackItems();selWid=items.length?items[0].id:null;
    updateLevelFields();redraw();
  });
  document.getElementById('sc-src-lv').addEventListener('change',function(){srcLv=+this.value||0;redraw();});
  document.getElementById('sc-tgt-lv').addEventListener('change',function(){redraw();});
  document.getElementById('sc-al-spell-lv').addEventListener('input',function(){alSpellLevel=+this.value||0;updateAlchemySliderLabels();redraw();});
  document.getElementById('sc-al-tgt-lv').addEventListener('input',function(){alTargetLevel=Math.max(1,+this.value||1);updateAlchemySliderLabels();redraw();});
  document.querySelectorAll('[data-chg]').forEach(function(btn){
    btn.addEventListener('click',function(){
      charge=+btn.dataset.chg;
      document.querySelectorAll('[data-chg]').forEach(function(b){b.classList.remove('sc-active');});
      btn.classList.add('sc-active');redraw();
    });
  });

  var scBtn=document.getElementById('sc-scale-toggle');
  scBtn.addEventListener('click',function(){
    scaleEnemies=!scaleEnemies;
    scBtn.textContent=scaleEnemies?'ON':'OFF';
    scBtn.classList.toggle('sc-active',scaleEnemies);
    updateLevelFields();redraw();
  });

  var atBtn=document.getElementById('sc-atlas-toggle');
  atBtn.addEventListener('click',function(){
    atlasMode=!atlasMode;
    atBtn.textContent=atlasMode?'ON':'OFF';
    atBtn.classList.toggle('sc-active',atlasMode);
    _dmgCache={};redraw();
  });

  var _dmgCache={};
  function fmtPct(pct){
    if(pct===0||pct===100)return String(pct.toFixed(0));
    var digits=pct<0.01?6:3;
    return pct.toFixed(digits).replace(/0+$/,'').replace(/\.$/,'');
  }
  function atlasSeed(w2,rng16){
    return Math.floor(w2*rng16/0x10000)&0xffff;
  }
  function atlasRawDamage(w,rng16){
    var seed=atlasSeed((w+1)&0xffff,rng16);
    var sum1=(seed+w)&0xffff;
    var carry=(sum1&0x8000)?1:0;
    var sum2=(sum1<<1)&0xffff;
    var sum3=(sum2+w+carry)&0xffff;
    return sum3>>>2;
  }
  function dmgRangeFull(w){
    if(_dmgCache[w]!==undefined)return _dmgCache[w];
    var mn=Infinity,mx=0,cnt999=0;
    for(var i=0;i<=0xffff;i++){
      var d=atlasRawDamage(w,i);
      if(d<mn)mn=d; if(d>mx)mx=d;
      if(d>=999)cnt999++;
    }
    return(_dmgCache[w]={min:Math.min(999,mn),max:Math.min(999,mx),pct999:cnt999/65536*100,count999:cnt999});
  }
  function atlasSubtractApplies(){return atlasMode;}
  function atlasOverflowBypassesClamp(){return atlasMode&&charge<100;}
  function chargedPhysicalAttack(atk){if(charge<=25)return atk>>2;if(charge<=50)return atk>>1;return atk;}
  function dmgRange(atk,def){
    var chargedAtk=chargedPhysicalAttack(atk);
    var atkEff=atlasSubtractApplies()?((chargedAtk-480)&0xffff):chargedAtk;
    var inner=(((def>>2)-atkEff)&0xffff);
    var w=(~((inner-1)&0xffff))&0xffff;
    if(w<1||(!atlasOverflowBypassesClamp()&&w>=0x8000))w=1;
    return dmgRangeFull(w);
  }
  function fmtDmgRange(min,max,pct999,htmlPct){
    if(pct999>0){
      var pctText='['+fmtPct(pct999)+'%]';
      if(htmlPct)pctText='<span style="color:#ff9966">'+pctText+'</span>';
      return (pct999>=100?'999':(min+'\u2013999'))+' '+pctText;
    }
    return min+'\u2013'+max;
  }
  function srcAtkAtLv(id,lv,bonus){
    var s=SC_SCALABLE[id];
    var base=s?(s.atk1+(lv-1)*s.atkG):((SC_CHARS.find(function(c){return c.id===+id;})||{attack:0}).attack);
    return base+bonus;
  }
  function srcHitRateAtLv(id,lv){
    var s=SC_SCALABLE[id];
    if(s)return s.hitRate1+(lv-1)*s.hitRateG;
    return(SC_CHARS.find(function(c){return c.id===+id;})||{hit_rate:0}).hit_rate;
  }

  var _CW=400,_CH=200,_ml=40,_mt=12,_mr=8,_mb=28;
  function renderTrendChart(containerId, series, xValues, xLabel){
    var W=_CW,H=_CH,ml=_ml,mt=_mt,mr=_mr,mb=_mb,pw=W-ml-mr,ph=H-mt-mb;
    function xp(index){return xValues.length<=1?ml+pw/2:ml+(index/(xValues.length-1))*pw;}
    var yMax=0;
    series.forEach(function(s){s.maxs.forEach(function(v){if(v>yMax)yMax=v;});});
    yMax=Math.max(10,Math.ceil(yMax*1.1/10)*10);
    function yp(v){return mt+ph-Math.min(v,yMax)/yMax*ph;}
    function linePts(arr){return arr.map(function(v,i){return xp(i).toFixed(1)+' '+yp(v).toFixed(1);}).join(' L ');}
    function bandPath(mins,maxs){
      var fwd=maxs.map(function(v,i){return xp(i).toFixed(1)+' '+yp(v).toFixed(1);}).join(' L ');
      var rev=mins.slice().reverse().map(function(v,i,a){var idx=a.length-1-i;return xp(idx).toFixed(1)+' '+yp(a[i]).toFixed(1);}).join(' L ');
      return 'M '+fwd+' L '+rev+' Z';
    }
    var grid='';
    var xstep=Math.max(1,Math.round(xValues.length/9));
    for(var xi=0;xi<xValues.length;xi+=xstep){grid+='<line x1="'+xp(xi).toFixed(1)+'" y1="'+mt+'" x2="'+xp(xi).toFixed(1)+'" y2="'+(mt+ph)+'" stroke="#1c1c1c"/>';}
    if((xValues.length-1)%xstep!==0)grid+='<line x1="'+xp(xValues.length-1).toFixed(1)+'" y1="'+mt+'" x2="'+xp(xValues.length-1).toFixed(1)+'" y2="'+(mt+ph)+'" stroke="#1c1c1c"/>';
    var ystep=Math.max(5,Math.ceil(yMax/6/5)*5);
    for(var yi=0;yi<=yMax;yi+=ystep){grid+='<line x1="'+ml+'" y1="'+yp(yi).toFixed(1)+'" x2="'+(ml+pw)+'" y2="'+yp(yi).toFixed(1)+'" stroke="#1c1c1c"/>';}
    var axes='';
    for(var xi2=0;xi2<xValues.length;xi2+=xstep){
      axes+='<line x1="'+xp(xi2).toFixed(1)+'" y1="'+(mt+ph)+'" x2="'+xp(xi2).toFixed(1)+'" y2="'+(mt+ph+4)+'" stroke="#444"/>';
      axes+='<text x="'+xp(xi2).toFixed(1)+'" y="'+(mt+ph+14)+'" text-anchor="middle" font-size="9">'+xValues[xi2]+'</text>';
    }
    if((xValues.length-1)%xstep!==0){axes+='<line x1="'+xp(xValues.length-1).toFixed(1)+'" y1="'+(mt+ph)+'" x2="'+xp(xValues.length-1).toFixed(1)+'" y2="'+(mt+ph+4)+'" stroke="#444"/><text x="'+xp(xValues.length-1).toFixed(1)+'" y="'+(mt+ph+14)+'" text-anchor="middle" font-size="9">'+xValues[xValues.length-1]+'</text>';}
    for(var yi2=0;yi2<=yMax;yi2+=ystep){
      axes+='<line x1="'+(ml-4)+'" y1="'+yp(yi2).toFixed(1)+'" x2="'+ml+'" y2="'+yp(yi2).toFixed(1)+'" stroke="#444"/>';
      axes+='<text x="'+(ml-6)+'" y="'+(yp(yi2)+3).toFixed(1)+'" text-anchor="end" font-size="9">'+yi2+'</text>';
    }
    var bands='';
    series.forEach(function(wd,wi){
      var col=wd.color||SC_COLORS[wd.type]||'#888';
      var opac=SC_TIER_OPAC[wi%4];
      var isAct=selWid===wd.id,isOther=!!(selWid&&!isAct);
      bands+='<g class="sc-band" data-wid="'+wd.id+'" style="cursor:pointer">'
        +'<path d="'+bandPath(wd.mins,wd.maxs)+'" fill="'+col+'" fill-opacity="'+(isOther?(opac*0.1).toFixed(2):opac.toFixed(2))+'" stroke="none"/>'
        +'<path d="M '+linePts(wd.maxs)+'" fill="none" stroke="'+col+'" stroke-opacity="'+(isOther?'0.12':(isAct?'1.0':'0.55'))+'" stroke-width="'+(isAct?2:1)+'"/>'
        +'</g>';
    });
    var svg='<svg width="'+W+'" height="'+H+'" viewBox="0 0 '+W+' '+H+'" style="display:block">'
      +'<rect x="'+ml+'" y="'+mt+'" width="'+pw+'" height="'+ph+'" fill="#111"/>'
      +grid+bands+axes
      +'<text x="'+(ml+pw/2)+'" y="'+(H-2)+'" text-anchor="middle" font-size="9" fill="#555">'+xLabel+'</text>'
      +'<text x="10" y="'+(mt+ph/2)+'" text-anchor="middle" font-size="9" fill="#555" transform="rotate(-90,10,'+(mt+ph/2)+')">dmg</text>'
      +'</svg>';
    var root=document.getElementById(containerId);
    if(root)root.innerHTML=svg;
    document.querySelectorAll('#'+containerId+' .sc-band').forEach(function(el){
      var wid=el.dataset.wid;
      el.addEventListener('click',function(e){selWid=(selWid===wid)?null:wid;e.stopPropagation();redraw();});
    });
  }
  function attachSvgEvents(svgEl){
    var pw=_CW-_ml-_mr;
    function lvFromX(clientX){
      var r=svgEl.getBoundingClientRect();
      var t=(clientX-r.left-_ml)/pw*(SC_MAX_LEVEL-1)+1;
      return Math.max(1,Math.min(SC_MAX_LEVEL,Math.round(t)));
    }
    function onMove(e){crosshairLv=lvFromX(e.clientX);redraw();}
    function onUp(){document.removeEventListener('mousemove',onMove);document.removeEventListener('mouseup',onUp);}
    svgEl.addEventListener('mousedown',function(e){
      if(e.target.closest&&e.target.closest('[data-wid]'))return;
      e.preventDefault();
      crosshairLv=lvFromX(e.clientX);
      redraw();
      document.addEventListener('mousemove',onMove);
      document.addEventListener('mouseup',onUp);
    });
  }

  function redraw(){
    var tgtId=+tgtSel.value;
    var tgt=SC_CHARS.find(function(c){return c.id===tgtId;})||SC_CHARS[0];if(!tgt)return;
    var def=scaleEnemies?Math.max(1,tgt.defense*2):tgt.defense;
    var attacks=getAttackItems();
    if(attackMode==='alchemy'){
      crosshairLv=null;
      var growth=targetGrowth(tgt);
      var spellLevels=[];
      for(var sl=0;sl<=9;sl++)spellLevels.push(sl);
      var spellSeries=attacks.map(function(w){
        var mins=[],maxs=[],p999s=[];
        spellLevels.forEach(function(level){
          var ad=alchemyProjectedRange(w.might,level,targetMagicDefense(tgt),growth?growth.defG:0,alTargetLevel);
          mins.push(ad.min);maxs.push(ad.max);p999s.push(ad.pct999||0);
        });
        return{id:w.id,label:w.label,type:w.type,color:w.color,might:w.might,mins:mins,maxs:maxs,p999s:p999s};
      });
      renderTrendChart('sc-chart',spellSeries,spellLevels,'spell level');

      var targetLevels=[];
      for(var tl=1;tl<=SC_MAX_LEVEL;tl++)targetLevels.push(tl);
      var targetSeries=attacks.map(function(w){
        var mins=[],maxs=[],p999s=[];
        targetLevels.forEach(function(level){
          var usedLevel=growth?level:1;
          var ad=alchemyProjectedRange(w.might,alSpellLevel,targetMagicDefense(tgt),growth?growth.defG:0,usedLevel);
          mins.push(ad.min);maxs.push(ad.max);p999s.push(ad.pct999||0);
        });
        return{id:w.id,label:w.label,type:w.type,color:w.color,might:w.might,mins:mins,maxs:maxs,p999s:p999s};
      });
      renderTrendChart('sc-hit-chart',targetSeries,targetLevels,'target level');

      document.getElementById('sc-xinfo').innerHTML='';
      var leg='';
      attacks.forEach(function(wd){
        var col=wd.color||SC_COLORS[wd.type]||'#888';
        var isAct=selWid===wd.id,isOther=!!(selWid&&!isAct);
        var d1=alchemyProjectedRange(wd.might,alSpellLevel,targetMagicDefense(tgt),growth?growth.defG:0,alTargetLevel);
        var d9=alchemyProjectedRange(wd.might,9,targetMagicDefense(tgt),growth?growth.defG:0,growth?SC_MAX_LEVEL:1);
        var r1=fmtDmgRange(d1.min,d1.max,d1.pct999,false);
        var r9=fmtDmgRange(d9.min,d9.max,d9.pct999,false);
        leg+='<div class="sc-leg-row'+(isAct?' sc-leg-sel':'')+(isOther?' sc-leg-dim':'')+'" data-wid="'+wd.id+'">'
          +'<span class="sc-leg-dot" style="background:'+col+'"></span>'
          +'<span class="sc-leg-name">'+wd.label+'</span>'
          +'<span class="sc-leg-range">S'+alSpellLevel+':'+r1+' \u2192 S9/T'+(growth?SC_MAX_LEVEL:1)+':'+r9+'</span>'
          +'</div>';
      });
      document.getElementById('sc-legend').innerHTML=leg;
      document.querySelectorAll('#sc-legend .sc-leg-row').forEach(function(el){
        var wid=el.dataset.wid;
        el.addEventListener('click',function(){selWid=(selWid===wid)?null:wid;redraw();});
      });

      var rawMdef=targetMagicDefenseAtLevel(tgt,alTargetLevel);
      var stats='<div class="sc-stat-box"><div class="sc-stat-name">Offensive Alchemy</div>'
        +'<div class="sc-stat-row"><span>spell level</span><span class="sc-stat-val">'+alSpellLevel+'</span></div>'
        +'<div class="sc-stat-row"><span>target level</span><span class="sc-stat-val">'+alTargetLevel+(growth?'':' (locked)')+'</span></div>'
        +'</div>'
        +'<div class="sc-stat-box"><div class="sc-stat-name">'+tgt.name+'</div>'
        +'<div class="sc-stat-row"><span>hp</span><span class="sc-stat-val">'+targetHpAtLevel(tgt,alTargetLevel)+'</span></div>'
        +'<div class="sc-stat-row"><span>mdef raw</span><span class="sc-stat-val">'+rawMdef+'</span></div>'
        +'<div class="sc-stat-row"><span>effective</span><span class="sc-stat-val">'+effectiveMdef(rawMdef)+'</span></div>'
        +'</div>';
      if(selWid){
        var aw=attacks.find(function(w){return w.id===selWid;});
        if(aw){
          var current=alchemyProjectedRange(aw.might,alSpellLevel,targetMagicDefense(tgt),growth?growth.defG:0,alTargetLevel);
          var targetHp=targetHpAtLevel(tgt,alTargetLevel);
          stats+='<div class="sc-stat-box"><div class="sc-stat-name">'+aw.label+' vs '+tgt.name+'</div>'
            +'<div class="sc-stat-row"><span>might</span><span class="sc-stat-val">'+aw.might+'</span></div>'
            +'<div class="sc-stat-row"><span>spell power</span><span class="sc-stat-val">'+current.spellPower+'</span></div>'
            +'<div class="sc-stat-row"><span>dmg@S'+alSpellLevel+'</span><span class="sc-stat-val">'+fmtDmgRange(current.min,current.max,current.pct999,false)+'</span></div>'
            +'<div class="sc-stat-row"><span>htk</span><span class="sc-stat-val">'+(current.max>0?Math.ceil(targetHp/current.max):'?')+'\u2013'+(current.min>0?Math.ceil(targetHp/current.min):'?')+'</span></div>'
            +'</div>';
        }
      }
      document.getElementById('sc-stats').innerHTML=stats;
      return;
    }
    var wdata=attacks.map(function(w){
      var mins=[],maxs=[],p999s=[];
      for(var lv=1;lv<=SC_MAX_LEVEL;lv++){
        var d=dmgRange(srcAtkAtLv(srcId,lv,w.bonus),def);
        mins.push(d.min);maxs.push(d.max);p999s.push(d.pct999||0);
      }
      return{id:w.id,label:w.label,type:w.type,bonus:w.bonus,mins:mins,maxs:maxs,p999s:p999s};
    });

    var yMax=0;
    wdata.forEach(function(wd){wd.maxs.forEach(function(v){if(v>yMax)yMax=v;});});
    yMax=Math.max(10,Math.ceil(yMax*1.1/10)*10);
    var W=_CW,H=_CH,ml=_ml,mt=_mt,mr=_mr,mb=_mb,pw=W-ml-mr,ph=H-mt-mb;
    function xp(lv){return ml+(lv-1)/(SC_MAX_LEVEL-1)*pw;}
    function yp(v){return mt+ph-Math.min(v,yMax)/yMax*ph;}
    function linePts(arr){return arr.map(function(v,i){return xp(i+1).toFixed(1)+' '+yp(v).toFixed(1);}).join(' L ');}
    function bandPath(mins,maxs){
      var fwd=maxs.map(function(v,i){return xp(i+1).toFixed(1)+' '+yp(v).toFixed(1);}).join(' L ');
      var rev=mins.slice().reverse().map(function(v,i,a){var idx=a.length-1-i;return xp(idx+1).toFixed(1)+' '+yp(a[i]).toFixed(1);}).join(' L ');
      return 'M '+fwd+' L '+rev+' Z';
    }
    var g='';
    var xstep=Math.max(1,Math.round(SC_MAX_LEVEL/9));
    for(var lv=1;lv<=SC_MAX_LEVEL;lv+=xstep){g+='<line x1="'+xp(lv).toFixed(1)+'" y1="'+mt+'" x2="'+xp(lv).toFixed(1)+'" y2="'+(mt+ph)+'" stroke="#1c1c1c"/>';}
    var ystep=Math.max(5,Math.ceil(yMax/6/5)*5);
    for(var yi=0;yi<=yMax;yi+=ystep){g+='<line x1="'+ml+'" y1="'+yp(yi).toFixed(1)+'" x2="'+(ml+pw)+'" y2="'+yp(yi).toFixed(1)+'" stroke="#1c1c1c"/>';}
    var ax='';
    for(var lv2=1;lv2<=SC_MAX_LEVEL;lv2+=xstep){
      ax+='<line x1="'+xp(lv2).toFixed(1)+'" y1="'+(mt+ph)+'" x2="'+xp(lv2).toFixed(1)+'" y2="'+(mt+ph+4)+'" stroke="#444"/>';
      ax+='<text x="'+xp(lv2).toFixed(1)+'" y="'+(mt+ph+14)+'" text-anchor="middle" font-size="9">'+lv2+'</text>';
    }
    for(var yi2=0;yi2<=yMax;yi2+=ystep){
      ax+='<line x1="'+(ml-4)+'" y1="'+yp(yi2).toFixed(1)+'" x2="'+ml+'" y2="'+yp(yi2).toFixed(1)+'" stroke="#444"/>';
      ax+='<text x="'+(ml-6)+'" y="'+(yp(yi2)+3).toFixed(1)+'" text-anchor="end" font-size="9">'+yi2+'</text>';
    }
    var bands='';
    wdata.forEach(function(wd,wi){
      var col=wd.color||SC_COLORS[wd.type]||'#888';
      var opac=SC_TIER_OPAC[wi%4];
      var isAct=selWid===wd.id,isOther=!!(selWid&&!isAct);
      bands+='<g class="sc-band" data-wid="'+wd.id+'" style="cursor:pointer">'
        +'<path d="'+bandPath(wd.mins,wd.maxs)+'" fill="'+col+'" fill-opacity="'+(isOther?(opac*0.1).toFixed(2):opac.toFixed(2))+'" stroke="none"/>'
        +'<path d="M '+linePts(wd.maxs)+'" fill="none" stroke="'+col+'" stroke-opacity="'+(isOther?'0.12':(isAct?'1.0':'0.55'))+'" stroke-width="'+(isAct?2:1)+'"/>'
        +'</g>';
    });
    var xhair='';
    if(crosshairLv!==null){
      var cx=xp(crosshairLv).toFixed(1);
      xhair='<line x1="'+cx+'" y1="'+mt+'" x2="'+cx+'" y2="'+(mt+ph)+'" stroke="#ffd700" stroke-width="1.5" stroke-dasharray="4,3" pointer-events="none"/>'
        +'<circle cx="'+cx+'" cy="'+(mt+ph/2).toFixed(1)+'" r="2.5" fill="#ffd700" pointer-events="none"/>';
    }
    var hl=srcLv>0?srcLv:0;
    var lvMark='';
    if(attackMode!=='alchemy'&&hl>0&&crosshairLv===null){
      var lmx=xp(hl);
      lvMark='<line x1="'+lmx.toFixed(1)+'" y1="'+mt+'" x2="'+lmx.toFixed(1)+'" y2="'+(mt+ph)+'" stroke="#ffd700" stroke-width="1.5" stroke-dasharray="3,2" opacity="0.5" pointer-events="none"/>';
    }
    var svg='<svg id="sc-svg" width="'+W+'" height="'+H+'" viewBox="0 0 '+W+' '+H+'" style="display:block;cursor:crosshair">'
      +'<rect x="'+ml+'" y="'+mt+'" width="'+pw+'" height="'+ph+'" fill="#111"/>'
      +g+bands+xhair+lvMark+ax
      +'<text x="'+(ml+pw/2)+'" y="'+(H-2)+'" text-anchor="middle" font-size="9" fill="#555">'+(attackMode==='alchemy'?'flat preview':'level')+'</text>'
      +'<text x="10" y="'+(mt+ph/2)+'" text-anchor="middle" font-size="9" fill="#555" transform="rotate(-90,10,'+(mt+ph/2)+')">dmg</text>'
      +'</svg>';
    document.getElementById('sc-chart').innerHTML=svg;
    document.querySelectorAll('#sc-chart .sc-band').forEach(function(el){
      var wid=el.dataset.wid;
      el.addEventListener('click',function(e){selWid=(selWid===wid)?null:wid;e.stopPropagation();redraw();});
    });
    var svgEl=document.getElementById('sc-svg');
    if(svgEl)attachSvgEvents(svgEl);

    var xinfo='';
    if(crosshairLv!==null){
      var showW=selWid?wdata.filter(function(wd){return wd.id===selWid;}):wdata;
      xinfo='<span style="color:#ffd700">'+(attackMode==='alchemy'?'L0':'L'+crosshairLv)+'</span>';
      showW.forEach(function(wd){
        var col=wd.color||SC_COLORS[wd.type]||'#888';
        var mn=wd.mins[crosshairLv-1],mx=wd.maxs[crosshairLv-1];
        var p999=wd.p999s&&wd.p999s[crosshairLv-1]||0;
        var htkHi=mx>0?Math.ceil((tgt.hp||1)/mx):'?',htkLo=mn>0?Math.ceil((tgt.hp||1)/mn):'?';
        var dmgStr=fmtDmgRange(mn,mx,p999,true);
        xinfo+=' \u00a0 <span style="color:'+col+'">'+wd.label+':</span> '+dmgStr
          +' <span style="opacity:.55">(htk '+htkHi+'\u2013'+htkLo+')</span>';
      });
      if(attackMode!=='alchemy'){
        var hitRate=srcHitRateAtLv(srcId,crosshairLv);
        var evadeVal=tgt.evade||0;
        var hitRow=SC_HIT_LOOKUP&&SC_HIT_LOOKUP[hitRate];
        var hitPct=hitRow&&hitRow[evadeVal]!==undefined?hitRow[evadeVal].toFixed(1):Math.max(0,hitRate-evadeVal);
        xinfo+=' \u00a0 <span style="opacity:.4">hit='+hitPct+'%</span>';
      }
    }
    document.getElementById('sc-xinfo').innerHTML=xinfo;

    var leg='';
    var hlv=crosshairLv||(hl>0?hl:1);
    wdata.forEach(function(wd){
      var col=wd.color||SC_COLORS[wd.type]||'#888';
      var isAct=selWid===wd.id,isOther=!!(selWid&&!isAct);
      var d1=attackMode==='alchemy'?alchemyRange(wd.might,targetMagicDefense(tgt)):dmgRange(srcAtkAtLv(srcId,hlv,wd.bonus),def);
      var d37=attackMode==='alchemy'?d1:dmgRange(srcAtkAtLv(srcId,SC_MAX_LEVEL,wd.bonus),def);
      var r1=fmtDmgRange(d1.min,d1.max,d1.pct999,false);
      var r37=fmtDmgRange(d37.min,d37.max,d37.pct999,false);
      leg+='<div class="sc-leg-row'+(isAct?' sc-leg-sel':'')+(isOther?' sc-leg-dim':'')+'" data-wid="'+wd.id+'">'
        +'<span class="sc-leg-dot" style="background:'+col+'"></span>'
        +'<span class="sc-leg-name">'+wd.label+'</span>'
        +'<span class="sc-leg-range">'+(attackMode==='alchemy'?('L0:'+r1+' \u2192 fixed:'+r37):('L'+hlv+':'+r1+' \u2192 L37:'+r37))+'</span>'
        +'</div>';
    });
    document.getElementById('sc-legend').innerHTML=leg;
    document.querySelectorAll('#sc-legend .sc-leg-row').forEach(function(el){
      var wid=el.dataset.wid;
      el.addEventListener('click',function(){selWid=(selWid===wid)?null:wid;redraw();});
    });

    var srcChar=SC_CHARS.find(function(c){return c.id===+srcId;})||{name:'?'};
    var sc=SC_SCALABLE[srcId];
    var hlv2=crosshairLv||(hl>0?hl:1);
    var stats='';
    if(attackMode==='alchemy'){
      var rawMdef=targetMagicDefense(tgt);
      stats='<div class="sc-stat-box"><div class="sc-stat-name">Offensive Alchemy</div>'
        +'<div class="sc-stat-row"><span>model</span><span class="sc-stat-val">level 0</span></div>'
        +'<div class="sc-stat-row"><span>spell scale</span><span class="sc-stat-val">TODO</span></div>'
        +'</div>'
        +'<div class="sc-stat-box"><div class="sc-stat-name">'+tgt.name+'</div>'
        +'<div class="sc-stat-row"><span>hp</span><span class="sc-stat-val">'+tgt.hp+'</span></div>'
        +'<div class="sc-stat-row"><span>mdef raw</span><span class="sc-stat-val">'+rawMdef+'</span></div>'
        +'<div class="sc-stat-row"><span>effective</span><span class="sc-stat-val">'+effectiveMdef(rawMdef)+'</span></div>'
        +'</div>';
    }else{
      stats='<div class="sc-stat-box"><div class="sc-stat-name">'+srcChar.name+(sc?' \u2605':'')+'</div>'
        +(sc?('<div class="sc-stat-row"><span>atk L'+hlv2+'</span><span class="sc-stat-val">'+srcAtkAtLv(srcId,hlv2,0)+'</span></div>'
            +'<div class="sc-stat-row"><span>atk L37</span><span class="sc-stat-val">'+srcAtkAtLv(srcId,SC_MAX_LEVEL,0)+'</span></div>')
          :('<div class="sc-stat-row"><span>atk</span><span class="sc-stat-val">'+(srcChar.attack||0)+'</span></div>'))
        +'</div>'
        +'<div class="sc-stat-box"><div class="sc-stat-name">'+tgt.name+(scaleEnemies?' (scaled)':'')+'</div>'
        +'<div class="sc-stat-row"><span>hp</span><span class="sc-stat-val">'+tgt.hp+'</span></div>'
        +'<div class="sc-stat-row"><span>def</span><span class="sc-stat-val">'+def+'</span></div>'
        +'<div class="sc-stat-row"><span>def\u00f74</span><span class="sc-stat-val">'+(def>>2)+'</span></div>'
        +'</div>';
    }
    if(selWid){
      var aw=attacks.find(function(w){return w.id===selWid;});
      var awd=wdata.find(function(wd){return wd.id===selWid;});
      if(aw&&awd){
        var lvidx=Math.max(0,hlv2-1);
        var amn=awd.mins[lvidx],amx=awd.maxs[lvidx];
        var ap=awd.p999s&&awd.p999s[lvidx]||0;
        var amn37=awd.mins[36],amx37=awd.maxs[36],ap37=awd.p999s&&awd.p999s[36]||0;
        if(attackMode==='alchemy'){
          stats+='<div class="sc-stat-box"><div class="sc-stat-name">'+aw.label+' vs '+tgt.name+'</div>'
            +'<div class="sc-stat-row"><span>might</span><span class="sc-stat-val">'+aw.might+'</span></div>'
            +'<div class="sc-stat-row"><span>dmg@L0</span><span class="sc-stat-val">'+fmtDmgRange(amn,amx,ap,false)+'</span></div>'
            +'<div class="sc-stat-row"><span>htk</span><span class="sc-stat-val">'+(amx>0?Math.ceil(tgt.hp/amx):'?')+'\u2013'+(amn>0?Math.ceil(tgt.hp/amn):'?')+'</span></div>'
            +'</div>';
        }else{
          stats+='<div class="sc-stat-box"><div class="sc-stat-name">'+aw.label+' vs '+tgt.name+'</div>'
            +'<div class="sc-stat-row"><span>dmg@L'+hlv2+'</span><span class="sc-stat-val">'+fmtDmgRange(amn,amx,ap,false)+'</span></div>'
            +'<div class="sc-stat-row"><span>htk@L'+hlv2+'</span><span class="sc-stat-val">'+(amx>0?Math.ceil(tgt.hp/amx):'?')+'\u2013'+(amn>0?Math.ceil(tgt.hp/amn):'?')+'</span></div>'
            +'<div class="sc-stat-row"><span>dmg@L37</span><span class="sc-stat-val">'+fmtDmgRange(amn37,amx37,ap37,false)+'</span></div>'
            +'</div>';
        }
      }
    }
    document.getElementById('sc-stats').innerHTML=stats;

    (function(){
      var hc=document.getElementById('sc-hit-chart');if(!hc)return;
      if(attackMode==='alchemy'){hc.innerHTML='';return;}
      if(!SC_HIT_LOOKUP||!Object.keys(SC_HIT_LOOKUP).length){hc.innerHTML='';return;}
      var evadeVal=tgt.evade||0;
      var W=_CW,H=_CH,ml=_ml,mr=_mr,mt=_mt,mb=_mb,pw=W-ml-mr,ph=H-mt-mb;
      function xp2(lv){return ml+(lv-1)/(SC_MAX_LEVEL-1)*pw;}
      var pts='',prevOk=false;
      for(var lv=1;lv<=SC_MAX_LEVEL;lv++){
        var hr=srcHitRateAtLv(srcId,lv);
        var row=SC_HIT_LOOKUP[hr];
        var pct=row&&row[evadeVal]!==undefined?row[evadeVal]:null;
        if(pct===null){prevOk=false;continue;}
        var x=xp2(lv).toFixed(1),y=(mt+ph-pct/100*ph).toFixed(1);
        pts+=prevOk?'L'+x+' '+y:'M'+x+' '+y;
        prevOk=true;
      }
      var xhairLine='';
      if(crosshairLv!==null){var cx2=xp2(crosshairLv).toFixed(1);xhairLine='<line x1="'+cx2+'" y1="'+mt+'" x2="'+cx2+'" y2="'+(mt+ph)+'" stroke="#ffd700" stroke-width="1" stroke-dasharray="3,2" opacity="0.7"/>';}
      var axLabels='';
      for(var yi=0;yi<=100;yi+=25){axLabels+='<text x="'+(ml-4)+'" y="'+(mt+ph-yi/100*ph+3).toFixed(1)+'" text-anchor="end" font-size="8" fill="#444">'+yi+'</text>';}
      var svg='<svg width="'+W+'" height="'+H+'" viewBox="0 0 '+W+' '+H+'" style="display:block">'
        +'<rect x="'+ml+'" y="'+mt+'" width="'+pw+'" height="'+ph+'" fill="#0d1a0d"/>'
        +'<line x1="'+ml+'" y1="'+mt+'" x2="'+ml+'" y2="'+(mt+ph)+'" stroke="#222"/>'
        +(pts?'<path d="'+pts+'" fill="none" stroke="#44cc44" stroke-width="1.5"/>':'')
        +xhairLine+axLabels
        +'<text x="'+(ml+pw/2)+'" y="'+(H-1)+'" text-anchor="middle" font-size="8" fill="#444">hit% vs level</text>'
        +'</svg>';
      hc.innerHTML=svg;
    })();
  }
  updateLevelFields();
  updateAlchemySliderLabels();
  syncAlchemyTargetSlider();
  var initW=getAttackItems();if(initW.length)selWid=initW[0].id;
  redraw();
})();
`;
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

// Live/Vanilla mode toggle
var _vanillaMode = false;
(function(){
  var btnLive    = document.getElementById('rmm-live');
  var btnVanilla = document.getElementById('rmm-vanilla');
  var liveTree   = document.getElementById('rm-live-tree');
  var vanTree    = document.getElementById('rm-vanilla-tree');
  function setMode(vanilla){
    _vanillaMode = vanilla;
    btnLive.classList.toggle('active', !vanilla);
    btnVanilla.classList.toggle('active', vanilla);
    liveTree.style.display  = vanilla ? 'none' : '';
    vanTree.style.display   = vanilla ? ''     : 'none';
    document.getElementById('room-detail').className='rm-detail-placeholder';
    document.getElementById('room-detail').innerHTML='<span>Select a room</span>';
  }
  if(btnLive)   btnLive.addEventListener('click',   function(){ setMode(false); });
  if(btnVanilla)btnVanilla.addEventListener('click', function(){ setMode(true);  });
  // Vanilla room click → show stub detail
  document.querySelectorAll('.vn-map').forEach(function(li){
    li.addEventListener('click',function(){
      document.querySelectorAll('.rn-map.rsel,.vn-map.rsel').forEach(function(x){x.classList.remove('rsel');});
      li.classList.add('rsel');
      var vid = li.dataset.vid;
      var area='', name=li.querySelector('.rn-label')?.textContent||'';
      for(var a of VANILLA_ROOMS_DATA){for(var r of a.rooms){if(r.id===vid){area=a.area;name=r.name;}}}
      var detail = document.getElementById('room-detail');
      detail.className='';
      detail.innerHTML='<div class="rd-head"><span class="rd-name">'+name+'</span>'
        +'<span class="rd-vid">'+vid+'</span>'
        +'<span class="rd-file">vanilla</span>'
        +'</div>'
        +'<div style="padding:8px 4px;opacity:.4;font-size:10px">No live data in Vanilla mode. Static ROM data only.</div>';
    });
  });
})();

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
  var trig=c.triggers||{stepOn:[],bTrigger:[]};
  var stepOn=trig.stepOn||[];
  var bTrigger=trig.bTrigger||[];
  var trigNames=c.triggerNames||{stepOn:[],bTrigger:[]};
  var stepOnNames=trigNames.stepOn||[];
  var bTrigNames=trigNames.bTrigger||[];
  var poi=c.poi||[];
  // Trigger coordinate origin (from ROM meta bytes). Converts 16px-tile coords to 8px-tile SVG space.
  var trigOff=c.trigOffset||null;
  function tsvg(t){
    if(!trigOff)return{sx:t.x1,sy:t.y1,sw:Math.max(0.5,t.x2-t.x1),sh:Math.max(0.5,t.y2-t.y1)};
    return{sx:(t.x1-trigOff.offX)*2,sy:(t.y1-trigOff.offY)*2,
           sw:Math.max(1,(t.x2-t.x1)*2),sh:Math.max(1,(t.y2-t.y1)*2)};
  }
  // Ingredient icon mapping: keyword in trigger name → filename (webp in INGR_BASE)
  // Falls back to emoji when INGR_BASE is not configured.
  var INGR_MAP={wax:'Wax',vinegar:'Vinegar',oil:'Oil',mud:'Mud_Pepper',pepper:'Mud_Pepper',
    limestone:'Limestone',dry_ice:'Dry_Ice',crystal:'Crystal',clay:'Clay',brimstone:'Brimstone',
    ash:'Ash',water:'Water',root:'Root',nectar:'Nectar',petal:'Petal',honey:'Honey',
    vine:'Root',bone:'Bone',feather:'Feather',mercury:'Mercury',
    acorn:'Acorn',ethanol:'Ethanol',grease:'Grease',gunpowder:'Gunpowder',iron:'Iron',
    meteorite:'Meteorite',mushroom:'Mushroom',wax_residue:'Wax',atlas:'Atlas_Amulet'};
  var INGR_EMOJI={wax:'\uD83D\uDD6F',vinegar:'\uD83E\uDDEA',oil:'\uD83E\uDEBB',mud:'\uD83C\uDF36',
    pepper:'\uD83C\uDF36',limestone:'\uD83E\uDEA8',dry_ice:'\uD83E\uDDCA',crystal:'\uD83D\uDC8E',
    clay:'\uD83C\uDFBA',brimstone:'\uD83D\uDD25',ash:'\u26AB',water:'\uD83D\uDCA7',
    root:'\uD83C\uDF3F',nectar:'\uD83C\uDF3A',petal:'\uD83C\uDF38',bone:'\uD83E\uDDB4',feather:'\uD83E\uDEB6'};
  function getIngrKey(nm){if(!nm)return null;var low=nm.toLowerCase();for(var k in INGR_MAP){if(low.indexOf(k)!==-1)return k;}return null;}
  function getIngrIcon(nm){var k=getIngrKey(nm);return k?INGR_EMOJI[k]||'\uD83C\uDF3F':null;}
  // Returns an <image> SVG element or null for use inside SVG
  function ingrSvgImg(nm,x,y,sz){
    var k=getIngrKey(nm); if(!k)return null;
    if(!INGR_BASE)return null;
    var fn=INGR_MAP[k]+'.webp';
    return '<image href="'+INGR_BASE+fn+'" x="'+(x-sz/2).toFixed(2)+'" y="'+(y-sz/2).toFixed(2)+'" width="'+sz+'" height="'+sz+'" style="image-rendering:pixelated" pointer-events="none"/>';
  }

  var html='<div class="rd-head">';
  html+='<span class="rd-name">'+escH(room.name)+'</span>';
  if(room.vanillaId)html+='<span class="rd-vid">'+escH(room.vanillaId)+'</span>';
  html+='<span class="rd-file">'+escH(room.relPath||'')+'</span>';
  html+='<a class="ll" data-line="'+room.startLine+'" href="#">go to code</a>';
  html+='<div class="rd-filters">';
  if(entrances.length)html+='<button class="rdf on" data-hide="hide-ent" title="Toggle entrances">ent</button>';
  if(objs.length)html+='<button class="rdf on" data-hide="hide-obj" title="Toggle objects">obj</button>';
  if(stepOn.length)html+='<button class="rdf on" data-hide="hide-step" title="Toggle step-on triggers">step-on</button>';
  if(bTrigger.length)html+='<button class="rdf on" data-hide="hide-btrig" title="Toggle B-triggers">B-trig</button>';
  if(poi.length)html+='<button class="rdf on" data-hide="hide-poi" title="Toggle points of interest">POI</button>';
  var hasIngr=bTrigger.some(function(t,i){return !!getIngrIcon(bTrigNames[i]||t.label||'');});
  if(hasIngr)html+='<button class="rdf on" data-hide="hide-ingr" title="Toggle sniff spot ingredient icons">🌿</button>';
  html+='<button class="rdf" id="rg-lock-btn" title="Lock map (prevent element dragging)">🔓</button>';
  html+='</div></div>';

  var hasCoords=(im!=null)||(entrances.length>0)||(enemies.length>0)||(stepOn.length>0)||(bTrigger.length>0)||(poi.length>0);

  // Determine grid bounds in tile units (1 tile = 8 px in source image)
  var TILE=8;
  var x1=0,y1=0,x2=32,y2=32;
  if(im){x1=im.x1;y1=im.y1;x2=im.x2;y2=im.y2;}
  if(room.imageDims){
    var imgCols=Math.round(room.imageDims.w/TILE);
    var imgRows=Math.round(room.imageDims.h/TILE);
    x2=x1+imgCols; y2=y1+imgRows;
  }
  // Clamp out-of-bounds entities by expanding bounds
  entrances.concat(enemies).forEach(function(e){
    if(e.x<x1)x1=Math.floor(e.x)-1;
    if(e.y<y1)y1=Math.floor(e.y)-1;
    if(e.x+2>x2)x2=Math.ceil(e.x)+2;
    if(e.y+2>y2)y2=Math.ceil(e.y)+2;
  });
  stepOn.concat(bTrigger).forEach(function(t){
    var sv=tsvg(t);
    if(sv.sx<x1)x1=sv.sx-1; if(sv.sy<y1)y1=sv.sy-1;
    if(sv.sx+sv.sw+1>x2)x2=sv.sx+sv.sw+1; if(sv.sy+sv.sh+1>y2)y2=sv.sy+sv.sh+1;
  });
  var W=Math.max(x2-x1,8),H=Math.max(y2-y1,8);

  // Display size: keep width fixed, compute height to preserve aspect ratio
  var dispW=520;
  var dispH=room.imageDims ? Math.min(600,Math.round(dispW*room.imageDims.h/room.imageDims.w)) : Math.round(dispW*H/W);
  // Current zoom (tiles per display pixel), starts at auto-fit
  var zoomState={scale:0}; // 0 = auto
  function getScale(s){
    if(s===0)return Math.min(dispW/W,dispH/H,20);
    return s;
  }

  if(hasCoords||room.imageUri||room.name){
    html+='<div class="rg-outer" id="rg-outer">';
    html+='<div class="rg-zoom"><button id="rg-zin">+</button><button id="rg-zout">-</button><button id="rg-zfit">fit</button></div>';
    html+='<div class="rg-wrap" id="rg-wrap" style="width:'+dispW+'px;height:'+dispH+'px">';
    html+='<div id="rg-canvas" style="position:absolute;width:'+dispW+'px;height:'+dispH+'px;transform-origin:0 0;will-change:transform">';
    if(room.imageUri) html+='<img class="room-img" id="rg-img" src="'+room.imageUri+'" alt="">';
    html+='<svg class="rg-svg" id="rg-svg" width="'+dispW+'" height="'+dispH+'" viewBox="'+x1+' '+y1+' '+W+' '+H+'">';

    // 8×8-tile grid (fine grid for entrances/enemies)
    var tileStep=1;
    if(W>64||H>64)tileStep=2;
    if(W>128||H>128)tileStep=4;
    for(var gx=x1;gx<=x2;gx+=tileStep)html+='<line x1="'+gx+'" y1="'+y1+'" x2="'+gx+'" y2="'+y2+'" stroke="rgba(255,255,255,0.11)" stroke-width="0.07"/>';
    for(var gy=y1;gy<=y2;gy+=tileStep)html+='<line x1="'+x1+'" y1="'+gy+'" x2="'+x2+'" y2="'+gy+'" stroke="rgba(255,255,255,0.11)" stroke-width="0.07"/>';
    // 16×16-tile grid (coarse grid for step-on / B-trigger coordinates)
    var trigStep=tileStep*2;
    var tgx0=x1-((x1%trigStep+trigStep)%trigStep);
    var tgy0=y1-((y1%trigStep+trigStep)%trigStep);
    for(var gx=tgx0;gx<=x2;gx+=trigStep)html+='<line x1="'+gx+'" y1="'+y1+'" x2="'+gx+'" y2="'+y2+'" stroke="rgba(160,140,80,0.42)" stroke-width="0.18"/>';
    for(var gy=tgy0;gy<=y2;gy+=trigStep)html+='<line x1="'+x1+'" y1="'+gy+'" x2="'+x2+'" y2="'+gy+'" stroke="rgba(160,140,80,0.42)" stroke-width="0.18"/>';
    if((x2-tgx0)%trigStep!==0)html+='<line x1="'+x2+'" y1="'+y1+'" x2="'+x2+'" y2="'+y2+'" stroke="rgba(160,140,80,0.42)" stroke-width="0.18"/>';
    if((y2-tgy0)%trigStep!==0)html+='<line x1="'+x1+'" y1="'+y2+'" x2="'+x2+'" y2="'+y2+'" stroke="rgba(160,140,80,0.42)" stroke-width="0.18"/>';
    // Room border
    if(im)html+='<rect x="'+x1+'" y="'+y1+'" width="'+W+'" height="'+H+'" fill="none" stroke="rgba(50,200,100,0.3)" stroke-width="0.25" stroke-dasharray="2,1"/>';

    // Step-on rects (pink) — coords in 16px-tile space, converted via tsvg()
    stepOn.forEach(function(t,i){
      var nm=stepOnNames[i]||'';
      var sv=tsvg(t);
      var tip='step-on'+(nm?' '+escH(nm):'')+(t.label?' — '+escH(t.label):'');
      html+='<rect class="svge-step" data-idx="'+i+'" data-kind="step" data-label="'+escH(nm||t.label||'')+' ['+t.x1+','+t.y1+':'+t.x2+','+t.y2+']" x="'+sv.sx+'" y="'+sv.sy+'" width="'+sv.sw+'" height="'+sv.sh+'" fill="rgba(255,100,180,0.18)" stroke="#ff69b4" stroke-width="0.3"><title>'+tip+'</title></rect>';
    });
    // B-trigger rects (yellow) — coords in 16px-tile space, converted via tsvg()
    bTrigger.forEach(function(t,i){
      var nm=bTrigNames[i]||'';
      var sv=tsvg(t);
      var tip='B-trig'+(nm?' '+escH(nm):'')+(t.label?' — '+escH(t.label):'');
      var ingrEmoji=getIngrIcon(nm||t.label||'');
      var blabel=escH(nm||t.label||'')+(ingrEmoji?' '+ingrEmoji:'')+' ['+t.x1+','+t.y1+':'+t.x2+','+t.y2+']';
      html+='<rect class="svge-btrig" data-idx="'+i+'" data-kind="btrig" data-label="'+blabel+'" x="'+sv.sx+'" y="'+sv.sy+'" width="'+sv.sw+'" height="'+sv.sh+'" fill="rgba(255,210,0,0.13)" stroke="#ffcc00" stroke-width="0.3"><title>'+(ingrEmoji?ingrEmoji+' ':'')+tip+'</title></rect>';
      if(ingrEmoji){
        var ifs=Math.max(1.5,Math.min(sv.sw,sv.sh,2.8));
        var imgHtml=ingrSvgImg(nm||t.label||'',sv.sx+sv.sw/2,sv.sy+sv.sh/2,ifs*1.2);
        if(imgHtml){
          html+='<g class="svge-btrig svge-ingr">'+imgHtml+'</g>';
        } else {
          html+='<text class="svge-btrig svge-ingr" x="'+(sv.sx+sv.sw/2)+'" y="'+(sv.sy+sv.sh/2+ifs*0.4)+'" text-anchor="middle" font-size="'+ifs+'" pointer-events="none" style="user-select:none">'+ingrEmoji+'</text>';
        }
      }
    });
    // Lua POI markers (cyan cross)
    poi.forEach(function(p,i){
      var pr=0.6;
      html+='<line class="svge-poi hide-poi" x1="'+(p.x-pr)+'" y1="'+p.y+'" x2="'+(p.x+pr)+'" y2="'+p.y+'" stroke="#00e5ff" stroke-width="0.25"/>';
      html+='<line class="svge-poi hide-poi" x1="'+p.x+'" y1="'+(p.y-pr)+'" x2="'+p.x+'" y2="'+(p.y+pr)+'" stroke="#00e5ff" stroke-width="0.25"/>';
    });
    // Box-select overlay rect (hidden by default)
    html+='<rect id="rg-sel" x="0" y="0" width="0" height="0" fill="rgba(100,200,255,0.10)" stroke="#64c8ff" stroke-width="0.3" stroke-dasharray="1,0.5" display="none"/>';
    // Enemies (red=normal, orange=dynamic) — 1×1 tile square
    enemies.forEach(function(e,i){
      var ex=Math.round(e.x),ey=Math.round(e.y);
      var fill=e.dynamic?'#cc7700':'#cc3333';
      html+='<rect class="svge-enemy sv-ll svge-mv" data-line="'+e.line+'" data-idx="'+i+'" data-kind="enemy" data-label="'+escH(e.type)+' ('+e.x+','+e.y+')" x="'+ex+'" y="'+ey+'" width="1" height="1" fill="'+fill+'" opacity="0.85" rx="0.2"><title>'+escH(e.type)+' ('+e.x+','+e.y+')\\ncmd+click</title></rect>';
    });
    // Entrances — 1-tile square with inset directional arrow
    entrances.forEach(function(en,i){
      var ex=Math.round(en.x),ey=Math.round(en.y);
      var d=en.dir?en.dir.toUpperCase():'';
      // Square background
      html+='<rect class="svge-entrance sv-ll svge-mv" data-line="'+en.line+'" data-idx="'+i+'" data-kind="entrance" data-label="'+escH(en.name)+' ('+en.x+','+en.y+') '+escH(en.dir)+'" x="'+ex+'" y="'+ey+'" width="1" height="1" fill="rgba(34,187,85,0.2)" stroke="#22bb55" stroke-width="0.2"><title>'+escH(en.name)+'\\ncmd+click</title></rect>';
      // Arrow inside the tile pointing in entrance direction (center at cx,cy)
      var cx=ex+0.5,cy=ey+0.5;
      var ap='';
      if(d==='NORTH'||d==='N') ap=cx+','+(cy-0.45)+' '+(cx-0.35)+','+(cy+0.3)+' '+(cx+0.35)+','+(cy+0.3);
      else if(d==='SOUTH'||d==='S') ap=cx+','+(cy+0.45)+' '+(cx-0.35)+','+(cy-0.3)+' '+(cx+0.35)+','+(cy-0.3);
      else if(d==='EAST'||d==='E') ap=(cx+0.45)+','+cy+' '+(cx-0.3)+','+(cy-0.35)+' '+(cx-0.3)+','+(cy+0.35);
      else if(d==='WEST'||d==='W') ap=(cx-0.45)+','+cy+' '+(cx+0.3)+','+(cy-0.35)+' '+(cx+0.3)+','+(cy+0.35);
      if(ap)html+='<polygon class="svge-entrance" data-idx="'+i+'" data-kind="entrance" points="'+ap+'" fill="#22bb55" fill-opacity="0.85" pointer-events="none"/>';
    });
    html+='</svg>';
    html+='</div>'; // close rg-canvas
    html+='</div>'; // close rg-wrap
    // Hover status bar — outside the scrollable canvas
    html+='<div id="rg-tip" style="font-size:11px;color:#aaa;min-height:16px;padding:2px 4px;font-family:monospace;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;"></div>';
    html+='</div>'; // close rg-outer
  } else {
    html+='<div class="rg-outer"><div class="rg-placeholder"><span>No coordinate data</span>';
    html+='<button class="rg-pick-btn" id="rg-pick-btn" data-map="'+escH(room.name)+'">assign image…</button></div></div>';
  }

  // ── Tables ──
  if(entrances.length){
    html+='<div class="rs rs-entrance"><div class="rs-h">Entrances</div>';
    html+='<table class="rs-tbl"><thead><tr><th>#</th><th>Name</th><th>Coord</th><th>Dir</th><th>Line</th></tr></thead><tbody>';
    entrances.forEach(function(e,i){
      html+='<tr data-kind="entrance" data-idx="'+i+'"><td>'+i+'</td><td><a class="ll" data-line="'+e.line+'" href="#">'+escH(e.name)+'</a></td><td>('+e.x+','+e.y+')</td><td>'+escH(e.dir)+'</td><td>'+e.line+'</td></tr>';
    });
    html+='</tbody></table></div>';
  }
  if(enemies.length){
    html+='<div class="rs rs-enemies"><div class="rs-h">Enemies</div>';
    html+='<table class="rs-tbl"><thead><tr><th>#</th><th>Type</th><th>Coord</th><th>Line</th></tr></thead><tbody>';
    enemies.forEach(function(e,i){
      html+='<tr data-kind="enemy" data-idx="'+i+'"><td>'+i+'</td><td><a class="ll" data-line="'+e.line+'" href="#">'+escH(e.type)+'</a></td><td>('+e.x+','+e.y+')</td><td>'+e.line+(e.dynamic?' <span class="badge-d">dyn</span>':'')+'</td></tr>';
    });
    html+='</tbody></table></div>';
  }
  if(objs.length){
    html+='<div class="rs rs-objects"><div class="rs-h">Objects</div>';
    html+='<table class="rs-tbl"><thead><tr><th>Index</th><th>Description</th><th>Line</th></tr></thead><tbody>';
    objs.forEach(function(o,i){
      var lineStr=o.line>=0?('<a class="ll" data-line="'+o.line+'" href="#">'+o.line+'</a>'):'&ndash;';
      html+='<tr data-kind="obj" data-idx="'+i+'"><td>object['+escH(o.index)+']</td><td>'+(o.desc?escH(o.desc):'&ndash;')+'</td><td>'+lineStr+'</td></tr>';
    });
    html+='</tbody></table></div>';
  }
  if(trans.length){
    html+='<div class="rs rs-transitions"><div class="rs-h">Transitions</div>';
    html+='<table class="rs-tbl"><thead><tr><th>Target</th><th>Via</th><th>Dir</th><th>Line</th></tr></thead><tbody>';
    trans.forEach(function(t){
      html+='<tr><td><a class="ll" data-line="'+t.line+'" href="#">'+escH(t.target)+'</a></td><td>'+escH(t.via)+'</td><td>'+escH(t.dir)+'</td><td>'+t.line+'</td></tr>';
    });
    html+='</tbody></table></div>';
  }
  if(stepOn.length){
    html+='<div class="rs rs-step"><div class="rs-h">Step-on triggers</div>';
    html+='<table class="rs-tbl"><thead><tr><th>Name</th><th>Coords</th><th>Script label</th></tr></thead><tbody>';
    stepOn.forEach(function(t,i){
      var nm=stepOnNames[i]||('#'+i);
      html+='<tr class="trig-step" data-kind="step" data-idx="'+i+'"><td><code>'+escH(nm)+'</code></td><td class="trig-coord">['+t.x1+','+t.y1+':'+t.x2+','+t.y2+']</td><td>'+(t.label?'<em>'+escH(t.label)+'</em>':'&ndash;')+'</td></tr>';
    });
    html+='</tbody></table></div>';
  }
  if(bTrigger.length){
    html+='<div class="rs rs-btrig"><div class="rs-h">B-triggers</div>';
    html+='<table class="rs-tbl"><thead><tr><th>Name</th><th>Coords</th><th>Script label</th></tr></thead><tbody>';
    bTrigger.forEach(function(t,i){
      var nm=bTrigNames[i]||('#'+i);
      html+='<tr class="trig-b" data-kind="btrig" data-idx="'+i+'"><td><code>'+escH(nm)+'</code></td><td class="trig-coord">['+t.x1+','+t.y1+':'+t.x2+','+t.y2+']</td><td>'+(t.label?'<em>'+escH(t.label)+'</em>':'&ndash;')+'</td></tr>';
    });
    html+='</tbody></table></div>';
  }

  // ── ROM Map Data section ──────────────────────────────────────────────────
  var rh=c.romHeader||null;
  if(rh){
    html+='<div class="rs rs-romhdr">';
    html+='<div class="rs-h rsh-toggle" id="rsh-toggle">ROM Map Data &#9660;</div>';
    html+='<div class="rsh-body" id="rsh-body">';
    // 13-byte header table
    html+='<div class="rsh-section-lbl">13-byte ROM header</div>';
    html+='<table class="rs-tbl rsh-tbl"><thead><tr><th>Offset</th><th>Value</th><th>Field name</th><th>WRAM / IO register</th><th>Description</th></tr></thead><tbody>';
    var HMETA=[
      {off:'0x00',val:rh.offX,       name:'trig_off_x',            wram:'7E0F86',              desc:'Trigger rect origin X (16px-tile units)',conf:'h'},
      {off:'0x01',val:rh.offY,       name:'trig_off_y',            wram:'7E0F88',              desc:'Trigger rect origin Y (16px-tile units)',conf:'h'},
      {off:'0x02',val:rh.mapW,       name:'map_w_tiles',           wram:'7E08EE → 7E08F2, 7E08F6', desc:'Map width in 16px tiles; loader derives pixel size and horizontal scroll capacity',conf:'h'},
      {off:'0x03',val:rh.mapH,       name:'map_h_tiles',           wram:'7E08F0 → 7E08F4, 7E08F8', desc:'Map height in 16px tiles; loader derives pixel size and vertical scroll capacity',conf:'h'},
      {off:'0x04',val:rh.b4,         name:'room_render_preset',    wram:'7E0F80 → TM $212C',      desc:'Main-screen layer enables; 0x17 = default (all layers), 0x16 = Oglin cave variant',conf:'m'},
      {off:'0x05',val:rh.b5,         name:'room_subscreen_preset', wram:'7E0F81 → TS $212D',      desc:'Subscreen / color-math target layers; 0x00=outdoor, 0x11=interior, 0x01=cave/special',conf:'m'},
      {off:'0x06',val:rh.b6,         name:'room_effect_family',    wram:'7E0F82 → CGADSUB $2131', desc:'Color math add/sub select; high nibble 0x9_ selects rare effect family (darkness, arena)',conf:'m'},
      {off:'0x07',val:rh.b7,         name:'room_effect_enable',    wram:'7E0F83 → CGWSEL $2130',  desc:'Color window / math master enable; always 0x02 in all known maps',conf:'m'},
      {off:'0x08',val:rh.b8,         name:'room_effect_variant',   wram:'7E241F',              desc:'Per-room modifier within effect family: 0x00=default, 0x02=parallax/jungle, 0x01=Oglin, 0x04=arena, 0x05=volcano',conf:'l'},
      {off:'0x09–0x0A',val:rh.unknownWord,name:'unknown_word',wram:'7E0F84',              desc:'16-bit field; copied verbatim; purpose not yet decoded from traces',conf:'l'},
      {off:'0x0B',val:rh.b11,        name:'unknown_b11',           wram:'—',                  desc:'Skipped by loader (INY at 90904D); no observed destination write',conf:'l'},
      {off:'0x0C',val:rh.b12,        name:'unknown_b12',           wram:'—',                  desc:'Skipped by loader (INY at 90904E); step_len follows immediately after',conf:'l'},
    ];
    HMETA.forEach(function(row){
      var cc=row.conf==='h'?'rsh-conf-h':row.conf==='m'?'rsh-conf-m':'rsh-conf-l';
      var hexVal;
      if(row.off==='0x09–0x0A') hexVal='0x'+(row.val!=null?row.val.toString(16).toUpperCase().padStart(4,'0'):'????');
      else hexVal='0x'+(row.val!=null?row.val.toString(16).toUpperCase().padStart(2,'0'):'??');
      html+='<tr class="'+cc+'"><td>'+escH(row.off)+'</td><td>'+hexVal+'</td><td><code>'+escH(row.name)+'</code></td><td>'+escH(row.wram)+'</td><td>'+escH(row.desc)+'</td></tr>';
    });
    html+='</tbody></table>';
    // Derived geometry
    html+='<div class="rsh-section-lbl">Derived geometry</div>';
    html+='<div class="rsh-derived">';
    html+='Width:&nbsp;&nbsp;<b>'+rh.mapW+'</b> tiles = <b>'+rh.mapWpx+'</b>&thinsp;px &nbsp; horizontal scroll capacity: <b>'+rh.scrollW+'</b>&thinsp;px<br>';
    html+='Height: <b>'+rh.mapH+'</b> tiles = <b>'+rh.mapHpx+'</b>&thinsp;px &nbsp; vertical scroll capacity: <b>'+rh.scrollH+'</b>&thinsp;px';
    html+='</div>';
    // Render preset
    html+='<div class="rsh-section-lbl">Render preset (bytes 4–8 signature)</div>';
    var preClass=rh.renderPreset?'rsh-preset':'rsh-preset rsh-unknown';
    html+='<span class="'+preClass+'">'+(rh.renderPreset?escH(rh.renderPreset):'unknown')+'</span>';
    html+='<span class="rsh-sig">'+escH(rh.sig)+'</span>';
    // Trigger table layout
    if(rh.stepLen!=null){
      html+='<div class="rsh-section-lbl">Trigger table layout</div>';
      html+='<div class="rsh-trig-info">';
      html+='step_len = 0x'+rh.stepLen.toString(16).padStart(4,'0').toUpperCase()+' &#8594; '+rh.stepCount+' step-on entr'+(rh.stepCount===1?'y':'ies')+' (6 bytes each)<br>';
      if(rh.bLen!=null) html+='b_len&nbsp;&nbsp;&nbsp;&nbsp;= 0x'+rh.bLen.toString(16).padStart(4,'0').toUpperCase()+' &#8594; '+rh.bCount+' B-trigger entr'+(rh.bCount===1?'y':'ies')+' (6 bytes each)<br>';
      if(rh.payloadOffset!=null) html+='payload starts at blob offset 0x'+rh.payloadOffset.toString(16).padStart(4,'0').toUpperCase();
      html+='</div>';
    }
    // Payload tile-set list
    if(rh.payloadTileCount!=null){
      html+='<div class="rsh-section-lbl">Payload opcode 0: tile families ('+rh.payloadTileCount+')</div>';
      html+='<div class="rsh-tiles">';
      (rh.payloadTileIds||[]).forEach(function(id,i){
        html+='<span class="rsh-tile" title="family #'+i+'">0x'+id.toString(16).toUpperCase().padStart(2,'0')+'</span>';
      });
      html+='</div>';
      html+='<div class="rsh-payload-note">Count byte + each family as a 16-bit word. Shared art lives in the tile family (CHR/VRAM), not in the room blob. The compressed opcode stream that follows encodes tile placement by family reference, not raw bitmaps.</div>';
    }
    html+='</div>'; // close rsh-body
    html+='</div>'; // close rs-romhdr
  }

  panel.innerHTML=html;
  bindLinks(panel);

  // ROM header toggle
  var rshToggle=panel.querySelector('#rsh-toggle');
  var rshBody=panel.querySelector('#rsh-body');
  if(rshToggle&&rshBody){
    rshToggle.addEventListener('click',function(){
      var col=rshBody.classList.toggle('rsh-collapsed');
      rshToggle.textContent='ROM Map Data '+(col?'\u25B4':'\u25BE');
    });
  }

  var svg=document.getElementById('rg-svg');
  var wrap=document.getElementById('rg-wrap');
  var canvas=document.getElementById('rg-canvas');
  var img=document.getElementById('rg-img');
  var locked=false;
  var panX=0,panY=0;
  function applyPan(px,py){
    panX=px;panY=py;
    if(canvas)canvas.style.transform='translate('+panX+'px,'+panY+'px)';
  }

  // Zoom controls
  var zinBtn=document.getElementById('rg-zin');
  var zoutBtn=document.getElementById('rg-zout');
  var zfitBtn=document.getElementById('rg-zfit');
  function applyZoom(s){
    if(!svg||!canvas)return;
    var pxW=Math.round(W*s),pxH=Math.round(H*s);
    canvas.style.width=pxW+'px';
    canvas.style.height=pxH+'px';
    svg.setAttribute('width',pxW);
    svg.setAttribute('height',pxH);
    var wW=wrap?wrap.clientWidth:dispW,wH=wrap?wrap.clientHeight:dispH;
    panX=pxW<=wW?0:Math.min(0,Math.max(wW-pxW,panX));
    panY=pxH<=wH?0:Math.min(0,Math.max(wH-pxH,panY));
    applyPan(panX,panY);
  }
  if(zinBtn)zinBtn.addEventListener('click',function(){
    var cur=zoomState.scale||getScale(0);
    zoomState.scale=Math.min(cur*1.4,60);
    applyZoom(zoomState.scale);
  });
  if(zoutBtn)zoutBtn.addEventListener('click',function(){
    var cur=zoomState.scale||getScale(0);
    zoomState.scale=Math.max(cur/1.4,1);
    applyZoom(zoomState.scale);
  });
  if(zfitBtn)zfitBtn.addEventListener('click',function(){
    zoomState.scale=0;panX=0;panY=0;
    applyZoom(getScale(0));
  });
  // Apply initial auto-fit
  if(svg&&canvas) applyZoom(getScale(0));

  // ── Interaction: pan / shift-box-select / entity drag / click-select ──
  var selRect=svg?svg.querySelector('#rg-sel'):null;
  var selActive=false,selSx=0,selSy=0;
  var panActive=false,panCX=0,panCY=0,panBX=0,panBY=0;
  var dragEnt=null; // {kind,idx,line,origX,origY,ghostEl,curX,curY}
  function svgPt(e){
    if(!svg)return{x:0,y:0};
    var pt=svg.createSVGPoint();
    pt.x=e.clientX;pt.y=e.clientY;
    return pt.matrixTransform(svg.getScreenCTM().inverse());
  }
  function applyBoxFilter(sx,sy,ex,ey){
    var rx1=Math.min(sx,ex),rx2=Math.max(sx,ex),ry1=Math.min(sy,ey),ry2=Math.max(sy,ey);
    if(rx2-rx1<1&&ry2-ry1<1){clearBoxFilter();return;}
    panel.querySelectorAll('tr[data-kind][data-idx]').forEach(function(row){
      var kind=row.dataset.kind,idx=parseInt(row.dataset.idx);
      var ok=false;
      if(kind==='entrance'){var en=entrances[idx];if(en)ok=(en.x>=rx1&&en.x<=rx2&&en.y>=ry1&&en.y<=ry2);}
      else if(kind==='step'){var t=stepOn[idx];if(t){var sv=tsvg(t);ok=(sv.sx+sv.sw>=rx1&&sv.sx<=rx2&&sv.sy+sv.sh>=ry1&&sv.sy<=ry2);}}
      else if(kind==='btrig'){var t=bTrigger[idx];if(t){var sv=tsvg(t);ok=(sv.sx+sv.sw>=rx1&&sv.sx<=rx2&&sv.sy+sv.sh>=ry1&&sv.sy<=ry2);}}
      else if(kind==='enemy'){var en=enemies[idx];if(en)ok=(en.x>=rx1&&en.x<=rx2&&en.y>=ry1&&en.y<=ry2);}
      else ok=true;
      row.classList.toggle('hrow',!ok);
    });
  }
  function clearBoxFilter(){
    panel.querySelectorAll('tr.hrow').forEach(function(r){r.classList.remove('hrow');});
    if(selRect){selRect.setAttribute('display','none');selRect.setAttribute('width','0');selRect.setAttribute('height','0');}
  }
  function clearSelection(){
    if(svg)svg.querySelectorAll('.svge-sel').forEach(function(el){el.classList.remove('svge-sel');});
    panel.querySelectorAll('tr.sel-row').forEach(function(r){r.classList.remove('sel-row');});
  }
  function selectAt(tx,ty){
    clearSelection();
    function hi(kind,i){if(svg)svg.querySelectorAll('[data-kind="'+kind+'"][data-idx="'+i+'"]').forEach(function(el){el.classList.add('svge-sel');});panel.querySelectorAll('tr[data-kind="'+kind+'"][data-idx="'+i+'"]').forEach(function(r){r.classList.add('sel-row');r.scrollIntoView({block:'nearest'});});}
    stepOn.forEach(function(t,i){var sv=tsvg(t);if(tx>=sv.sx&&tx<sv.sx+sv.sw&&ty>=sv.sy&&ty<sv.sy+sv.sh)hi('step',i);});
    bTrigger.forEach(function(t,i){var sv=tsvg(t);if(tx>=sv.sx&&tx<sv.sx+sv.sw&&ty>=sv.sy&&ty<sv.sy+sv.sh)hi('btrig',i);});
    entrances.forEach(function(en,i){if(tx>=en.x&&tx<en.x+1&&ty>=en.y&&ty<en.y+1)hi('entrance',i);});
    enemies.forEach(function(en,i){if(tx>=en.x&&tx<en.x+1&&ty>=en.y&&ty<en.y+1)hi('enemy',i);});
  }
  if(svg){
    // Entity drag: mousedown on moveable element (entrance/enemy)
    svg.querySelectorAll('.svge-mv').forEach(function(el){
      el.addEventListener('mousedown',function(e){
        if(e.button!==0||locked)return;
        e.stopPropagation();
        var kind=el.dataset.kind,idx=parseInt(el.dataset.idx),line=parseInt(el.dataset.line);
        var ox,oy;
        if(kind==='entrance'&&entrances[idx]){ox=entrances[idx].x;oy=entrances[idx].y;}
        else if(kind==='enemy'&&enemies[idx]){ox=enemies[idx].x;oy=enemies[idx].y;}
        else return;
        var ghost=document.createElementNS('http://www.w3.org/2000/svg','rect');
        ghost.setAttribute('x',ox);ghost.setAttribute('y',oy);
        ghost.setAttribute('width',1);ghost.setAttribute('height',1);
        ghost.setAttribute('fill',kind==='entrance'?'rgba(34,187,85,0.5)':'rgba(204,51,51,0.5)');
        ghost.setAttribute('stroke',kind==='entrance'?'#22bb55':'#cc3333');
        ghost.setAttribute('stroke-width','0.15');ghost.setAttribute('stroke-dasharray','0.3,0.2');
        ghost.setAttribute('pointer-events','none');
        svg.appendChild(ghost);
        dragEnt={kind:kind,idx:idx,line:line,origX:ox,origY:oy,ghostEl:ghost,curX:ox,curY:oy};
        e.preventDefault();
      });
    });
    svg.addEventListener('mousedown',function(e){
      if(e.button!==0||dragEnt)return;
      if(e.metaKey||e.ctrlKey)return;
      var p=svgPt(e);
      if(e.shiftKey){
        selSx=p.x;selSy=p.y;selActive=true;
        if(selRect)selRect.setAttribute('display','');
      } else {
        panActive=true;panCX=e.clientX;panCY=e.clientY;panBX=panX;panBY=panY;
        if(wrap)wrap.classList.add('rg-panning');
      }
      e.preventDefault();
    });
    svg.addEventListener('mousemove',function(e){
      if(dragEnt){
        var p=svgPt(e);var tx=Math.floor(p.x),ty=Math.floor(p.y);
        dragEnt.curX=tx;dragEnt.curY=ty;
        dragEnt.ghostEl.setAttribute('x',tx);dragEnt.ghostEl.setAttribute('y',ty);
        return;
      }
      if(selActive){
        var p=svgPt(e);
        var rx=Math.min(selSx,p.x),ry=Math.min(selSy,p.y),rw=Math.abs(p.x-selSx),rh=Math.abs(p.y-selSy);
        if(selRect){selRect.setAttribute('x',rx);selRect.setAttribute('y',ry);selRect.setAttribute('width',rw);selRect.setAttribute('height',rh);}
        return;
      }
      if(panActive){
        var s=zoomState.scale||getScale(0);
        var pxW=Math.round(W*s),pxH=Math.round(H*s);
        var wW=wrap?wrap.clientWidth:dispW,wH=wrap?wrap.clientHeight:dispH;
        var nx=pxW<=wW?0:Math.min(0,Math.max(wW-pxW,panBX+(e.clientX-panCX)));
        var ny=pxH<=wH?0:Math.min(0,Math.max(wH-pxH,panBY+(e.clientY-panCY)));
        applyPan(nx,ny);
      }
    });
    svg.addEventListener('mouseup',function(e){
      if(dragEnt){
        var moved=(dragEnt.curX!==dragEnt.origX||dragEnt.curY!==dragEnt.origY);
        if(moved&&vs)vs.postMessage({command:'moveEntity',kind:dragEnt.kind,line:dragEnt.line,newX:dragEnt.curX,newY:dragEnt.curY});
        if(dragEnt.ghostEl&&dragEnt.ghostEl.parentNode)dragEnt.ghostEl.parentNode.removeChild(dragEnt.ghostEl);
        dragEnt=null;return;
      }
      if(selActive){selActive=false;var p=svgPt(e);applyBoxFilter(selSx,selSy,p.x,p.y);return;}
      if(panActive){panActive=false;if(wrap)wrap.classList.remove('rg-panning');}
    });
    svg.addEventListener('mouseleave',function(){
      if(panActive){panActive=false;if(wrap)wrap.classList.remove('rg-panning');}
      if(dragEnt){if(dragEnt.ghostEl&&dragEnt.ghostEl.parentNode)dragEnt.ghostEl.parentNode.removeChild(dragEnt.ghostEl);dragEnt=null;}
    });
    // Click: select element + highlight all overlapping triggers
    svg.addEventListener('click',function(e){
      if(e.shiftKey||dragEnt)return;
      var p=svgPt(e);selectAt(Math.floor(p.x),Math.floor(p.y));
    });
    svg.addEventListener('dblclick',function(){clearBoxFilter();clearSelection();});
  }

  // Hover status bar: show name of hovered SVG element
  var tipDiv=document.getElementById('rg-tip');
  if(svg&&tipDiv){
    svg.querySelectorAll('[data-kind][data-idx]').forEach(function(el){
      el.addEventListener('mouseenter',function(){tipDiv.textContent=el.dataset.label||'';});
      el.addEventListener('mouseleave',function(){tipDiv.textContent='';});
    });
  }

  // Bidirectional hover highlight: SVG ↔ table rows
  function setHi(kind,idx,on){
    // SVG elements
    if(svg){
      svg.querySelectorAll('[data-kind="'+kind+'"][data-idx="'+idx+'"]').forEach(function(el){
        el.classList.toggle('hi',on);
      });
    }
    // Table rows
    panel.querySelectorAll('tr[data-kind="'+kind+'"][data-idx="'+idx+'"]').forEach(function(row){
      row.classList.toggle('hi-row',on);
    });
  }
  // SVG elements → highlight table
  if(svg){
    svg.querySelectorAll('[data-kind][data-idx]').forEach(function(el){
      el.addEventListener('mouseenter',function(){setHi(el.dataset.kind,el.dataset.idx,true);});
      el.addEventListener('mouseleave',function(){setHi(el.dataset.kind,el.dataset.idx,false);});
    });
  }
  // Table rows → highlight SVG
  panel.querySelectorAll('tr[data-kind][data-idx]').forEach(function(row){
    row.addEventListener('mouseenter',function(){setHi(row.dataset.kind,row.dataset.idx,true);});
    row.addEventListener('mouseleave',function(){setHi(row.dataset.kind,row.dataset.idx,false);});
  });

  // Cmd/Ctrl+click on SVG code-linked elements
  if(svg){
    svg.querySelectorAll('.sv-ll').forEach(function(el){
      el.style.cursor='pointer';
      el.addEventListener('click',function(e){
        if(e.metaKey||e.ctrlKey){e.stopPropagation();goToLine(parseInt(el.dataset.line));}
      });
    });
  }
  // Entity filter buttons (only those with data-hide attribute)
  panel.querySelectorAll('.rdf[data-hide]').forEach(function(btn){
    btn.addEventListener('click',function(){
      btn.classList.toggle('on');
      panel.classList.toggle(btn.dataset.hide,!btn.classList.contains('on'));
    });
  });
  // Lock toggle
  var lockBtn=document.getElementById('rg-lock-btn');
  if(lockBtn){
    lockBtn.classList.add('on');
    lockBtn.addEventListener('click',function(){
      locked=!locked;
      lockBtn.textContent=locked?'\uD83D\uDD12':'\uD83D\uDD13';
      lockBtn.classList.toggle('on',!locked);
      lockBtn.title=locked?'Unlock map':'Lock map (prevent element dragging)';
      if(svg)svg.querySelectorAll('.svge-mv').forEach(function(el){el.style.cursor=locked?'default':'grab';});
    });
  }
  // Assign image button (rooms without images)
  var pickBtn=document.getElementById('rg-pick-btn');
  if(pickBtn){
    pickBtn.addEventListener('click',function(){
      if(vs)vs.postMessage({command:'pickRoomImage',mapName:pickBtn.dataset.map});
    });
  }
}
`;

    const docsJs = `(function(){
  ${alchemyWebviewEffectiveMdef}
  ${alchemyWebviewBonusBase}
  ${alchemyWebviewDamageFromPower}
  ${alchemyWebviewDamageSamples}
  ${alchemyWebviewRange}
  ${alchemyWebviewSpellPower}
  // Sub-tab navigation
  document.querySelectorAll('.doc-btn').forEach(function(btn){
    btn.addEventListener('click',function(){
      var sec=btn.dataset.doc;
      document.querySelectorAll('.doc-btn').forEach(function(b){b.classList.remove('doc-btn-active');});
      btn.classList.add('doc-btn-active');
      document.querySelectorAll('.doc-sec').forEach(function(s){s.style.display=s.dataset.doc===sec?'':'none';});
    });
  });
  // Shared formula helpers
  function docFmtPct(pct){
    if(pct===0||pct===100)return String(pct.toFixed(0));
    var digits=pct<0.01?6:4;
    return pct.toFixed(digits).replace(/0+$/,'').replace(/\.$/,'');
  }
  function docW(atk,def){var inner=(((def>>2)-atk)&0xffff);var w=(~((inner-1)&0xffff))&0xffff;if(w<1||w>=0x8000)w=1;return w;}
  function docSeedRaw(w,s){return Math.floor((((w+1)&0xffff)*s)/0x10000)&0xffff;}
  function docDamageRaw(w,s){var a=(docSeedRaw(w,s)+w)&0xffff,b=(a<<1)&0xffff,c=(b+w+((a&0x8000)?1:0))&0xffff;return c>>2;}
  function docSeeds(w){var r=[];for(var s=0;s<=0xffff;s++)r.push(docDamageRaw(w,s));return r;}
  function docRangeStats(w){
    var raw=docSeeds(w);
    var capped=raw.map(function(d){return Math.min(999,d);});
    var mn=capped.reduce(function(a,b){return Math.min(a,b);},999);
    var mx=capped.reduce(function(a,b){return Math.max(a,b);},0);
    var cnt999=raw.filter(function(d){return d>=999;}).length;
    return {min:mn,max:mx,count999:cnt999,pct999:cnt999/65536*100};
  }
  // ── Damage section ──────────────────────────────────────────────────────
  function renderDmgChart(atk,def){
    var w=docW(atk,def);
    var raw=docSeeds(w);
    var capped=raw.map(function(d){return Math.min(999,d);});
    var mn=capped.reduce(function(a,b){return Math.min(a,b);},999);
    var mx=capped.reduce(function(a,b){return Math.max(a,b);},0);
    var cnt999=raw.filter(function(d){return d>=999;}).length;
    var N=32,buckets=new Array(N).fill(0),range=mx-mn||1;
    capped.forEach(function(d){var bi=Math.min(N-1,Math.floor((d-mn)/range*N));buckets[bi]++;});
    var bMax=buckets.reduce(function(a,b){return Math.max(a,b);},1);
    var W=320,H=56,bw=W/N,bars='';
    for(var i=0;i<N;i++){
      var bh=buckets[i]/bMax*H;
      var bv=mn+i/N*range;
      bars+='<rect x="'+(i*bw).toFixed(1)+'" y="'+(H-bh).toFixed(1)+'" width="'+(bw-0.5).toFixed(1)+'" height="'+bh.toFixed(1)+'" fill="'+(bv>=999?'#ff7755':'#4488ff')+'"/>';
    }
    var html='<div class="doc-val">w=<b>'+w+'</b>  def\u00f74=<b>'+(def>>2)+'</b></div>';
    html+='<div class="doc-val">range: <b>'+mn+'\u2013'+mx+'</b>';
    if(cnt999>0)html+='<span class="doc-cap">999-cap: '+cnt999+'/65536 ('+docFmtPct(cnt999/65536*100)+'%)</span>';
    html+='</div>';
    html+='<svg width="'+W+'" height="'+H+'" style="display:block;margin:4px 0">'+bars+'</svg>';
    html+='<div style="width:'+W+'px;display:flex;justify-content:space-between;font-size:9px;opacity:.4"><span>'+mn+'</span><span>'+mx+'</span></div>';
    document.getElementById('doc-dmg-chart').innerHTML=html;
  }
  var dmgAtk=document.getElementById('doc-atk'),dmgDef=document.getElementById('doc-def');
  if(dmgAtk&&dmgDef){
    function udDmg(){document.getElementById('doc-atk-num').textContent=dmgAtk.value;document.getElementById('doc-def-num').textContent=dmgDef.value;renderDmgChart(+dmgAtk.value,+dmgDef.value);}
    dmgAtk.addEventListener('input',udDmg);dmgDef.addEventListener('input',udDmg);udDmg();
  }
  // ── Offensive alchemy section ───────────────────────────────────────────
  var alSpell=document.getElementById('doc-al-spell'),alSpellLevel=document.getElementById('doc-al-spell-lv'),alMdef=document.getElementById('doc-al-mdef');
  if(alSpell&&alSpellLevel&&alMdef){
    SC_SPELLS.forEach(function(sp){
      var o=document.createElement('option');o.value=sp.id;o.textContent=sp.label+' ('+sp.might+')';alSpell.appendChild(o);
    });
    alSpell.value='hardball';
    function renderAlchemy(){
      var spell=SC_SPELLS.find(function(sp){return sp.id===alSpell.value;})||SC_SPELLS[0];
      var spellLevel=+alSpellLevel.value;
      var rawMdef=+alMdef.value;
      var stats=alchemyRangeAtLevel(spell.might,spellLevel,rawMdef);
      var spellPower=stats.spellPower;
      var raw=alchemyDamageSamples(spell.might,spellLevel,rawMdef);
      var capped=raw.map(function(d){return Math.min(999,d);});
      var N=32,buckets=new Array(N).fill(0),range=stats.max-stats.min||1;
      capped.forEach(function(d){var bi=Math.min(N-1,Math.floor((d-stats.min)/range*N));buckets[bi]++;});
      var bMax=buckets.reduce(function(a,b){return Math.max(a,b);},1);
      var W=320,H=56,bw=W/N,bars='';
      for(var i=0;i<N;i++){
        var bh=buckets[i]/bMax*H;
        var bv=stats.min+i/N*range;
        bars+='<rect x="'+(i*bw).toFixed(1)+'" y="'+(H-bh).toFixed(1)+'" width="'+(bw-0.5).toFixed(1)+'" height="'+bh.toFixed(1)+'" fill="'+(bv>=999?'#ff7755':'#4c86d9')+'"/>';
      }
      document.getElementById('doc-al-spell-lv-num').textContent=spellLevel;
      document.getElementById('doc-al-mdef-num').textContent=rawMdef;
      var html='<div class="doc-val">spell: <b>'+spell.label+'</b>  base might: <b>'+spell.might+'</b>  spell level: <b>'+spellLevel+'</b></div>';
      html+='<div class="doc-val">spell_power_at_level: <b>'+spellPower+'</b>  bonus_base: <b>'+stats.bonusBase+'</b>  raw magic_defense: <b>'+rawMdef+'</b>  defense_factor: <b>'+stats.defenseFactor+'/64</b></div>';
      html+='<div class="doc-val">shown range: <b>'+stats.min+'\u2013'+stats.max+'</b>'+(stats.count999?'<span class="doc-cap">999-cap: '+stats.count999+'/65536 ('+docFmtPct(stats.pct999)+'%)</span>':'')+'</div>';
      html+='<svg width="'+W+'" height="'+H+'" style="display:block;margin:4px 0">'+bars+'</svg>';
      html+='<div style="width:'+W+'px;display:flex;justify-content:space-between;font-size:9px;opacity:.4"><span>'+stats.min+'</span><span>'+stats.max+'</span></div>';
      html+='<ul class="doc-bullets">'
        +'<li>Grounded inputs only: <b>base might</b> from ROM offset <b>0x45E6B</b> and enemy <b>magic_defense</b>.</li>'
        +'<li>The <b>spell level</b> slider uses the traced cast-side helper <code>spell_power_at_level = ceil(base_might * [2,4,7,11,15,20,26,32,39,46][level] / 4)</code> with a RNG bonus based on <code>floor(base_might * scale / 4)</code>.</li>'
        +'<li>Hit damage then applies the traced target-side multiplier <code>floor(projectile_power * (0x40 - magic_defense) / 0x40)</code>.</li>'
        +'<li>Target-level growth and 8-cast route modeling are still open.</li>'
        +'</ul>';
      if(spell.id==='hardball'&&spellLevel===0&&rawMdef===32){
        html+='<div class="doc-fact">Example check: Hard Ball L0 with raw magic_defense 32 produces <b>5\u201310</b>.</div>';
      }
      document.getElementById('doc-al-chart').innerHTML=html;
    }
    alSpell.addEventListener('change',renderAlchemy);
    alSpellLevel.addEventListener('input',renderAlchemy);
    alMdef.addEventListener('input',renderAlchemy);
    renderAlchemy();
  }
  // ── Hit% section ────────────────────────────────────────────────────────
  var hitTbl=document.getElementById('doc-hit-table');
  if(hitTbl){
    if(!SC_HIT_LOOKUP||!Object.keys(SC_HIT_LOOKUP).length){
      hitTbl.innerHTML='<div style="opacity:.35;padding:8px;font-size:10px">ROM not found \u2014 place the .smc in workspace root.</div>';
    }else{
      var hrs=Object.keys(SC_HIT_LOOKUP).map(Number).sort(function(a,b){return a-b;});
      var evSet={};hrs.forEach(function(hr){Object.keys(SC_HIT_LOOKUP[hr]).forEach(function(ev){evSet[ev]=1;});});
      var evs=Object.keys(evSet).map(Number).sort(function(a,b){return a-b;});
      var html='<table class="doc-htable"><thead><tr><th>hit_rate</th>';
      evs.forEach(function(ev){html+='<th>ev='+ev+'</th>';});
      html+='</tr></thead><tbody>';
      hrs.forEach(function(hr){
        var nm='';
        if(hr===38)nm='Boy';else if(hr===50)nm='Dog';
        else{var ch=SC_CHARS.find(function(c){return c.hit_rate===hr;});if(ch)nm=ch.name.replace(/[<>]/g,'');}
        html+='<tr><td>'+(nm?'<span class="doc-hr-name">'+escH(nm)+'</span>':'')+hr+'</td>';
        evs.forEach(function(ev){
          var row=SC_HIT_LOOKUP[hr],pct=row&&row[ev]!==undefined?row[ev]:null;
          var bg=pct===null?'':pct>=95?'#226622':pct>=75?'#554422':'#552222';
          html+='<td'+(bg?' style="background:'+bg+'"':'')+'>'+(pct!==null?pct.toFixed(1)+'%':'—')+'</td>';
        });
        html+='</tr>';
      });
      hitTbl.innerHTML=html+'</tbody></table>';
    }
  }
  // ── Atlas glitch section ────────────────────────────────────────────────
  var _docAtlasCache={};
  function docAtlasAttack(atk,sub){return(atk-sub)&0xffff;}
  function docAtlasUnderflows(atk,sub){return sub>atk;}
  function docAtlasW(atk,sub,def){
    var atkEff=docAtlasAttack(atk,sub);
    if(!docAtlasUnderflows(atk,sub))return docW(atkEff,def);
    var inner=(((def>>2)-atkEff)&0xffff);
    return(~((inner-1)&0xffff))&0xffff;
  }
  function docAtlasStats(w){
    if(_docAtlasCache[w])return _docAtlasCache[w];
    var mn=Infinity,mx=0,cnt999=0,counts=new Array(1000).fill(0);
    for(var s=0;s<=0xffff;s++){
      var d=docDamageRaw(w,s);
      var shown=Math.min(999,d);
      if(d<mn)mn=d;
      if(d>mx)mx=d;
      if(d>=999)cnt999++;
      counts[shown]++;
    }
    var minShown=Math.min(999,mn),maxShown=Math.min(999,mx),span=Math.max(1,maxShown-minShown+1);
    var bandSize=Math.max(1,Math.ceil(span/32)),bands=[],maxBand=0;
    for(var from=minShown;from<=maxShown;from+=bandSize){
      var to=Math.min(maxShown,from+bandSize-1),count=0;
      for(var v=from;v<=to;v++)count+=counts[v]||0;
      maxBand=Math.max(maxBand,count);
      bands.push({from:from,to:to,count:count,pct:count/65536*100});
    }
    var top=[];
    counts.forEach(function(count,dmg){if(count>0)top.push({dmg:dmg,count:count,pct:count/65536*100});});
    top.sort(function(a,b){return b.count-a.count||b.dmg-a.dmg;});
    top=top.slice(0,8);
    return(_docAtlasCache[w]={min:minShown,max:maxShown,count999:cnt999,pct999:cnt999/65536*100,counts:counts,bands:bands,maxBand:maxBand,top:top});
  }
  var atAtk=document.getElementById('doc-at-atk'),atSub=document.getElementById('doc-at-sub'),atDef=document.getElementById('doc-at-def'),atRng=document.getElementById('doc-at-rng');
  if(atAtk&&atSub&&atDef&&atRng){
    function udAt(){
      var atk=+atAtk.value,sub=+atSub.value,def=+atDef.value,rng=+atRng.value;
      document.getElementById('doc-at-atk-num').textContent=atk;
      document.getElementById('doc-at-sub-num').textContent=sub;
      document.getElementById('doc-at-def-num').textContent=def;
      document.getElementById('doc-at-rng-num').textContent=rng;
      var atkEff=docAtlasAttack(atk,sub);
      var underflow=docAtlasUnderflows(atk,sub);
      var w=docAtlasW(atk,sub,def);
      var stats=docAtlasStats(w);
      var seed=docSeedRaw(w,rng);
      var uncapped=docDamageRaw(w,rng);
      var capped=Math.min(999,uncapped);
      if(!underflow){
        var info='';
        info+='<ul class="doc-bullets">';
        info+='<li>Base atk: <b>'+atk+'</b>; manual subtract: <b>'+sub+'</b>; effective atk: <b>'+atkEff+'</b>.</li>';
        info+='<li>No underflow occurred, so the atlas glitch is <b>inactive</b>.</li>';
        info+='<li>Target def: <b>'+def+'</b>; def\u00f74: <b>'+(def>>2)+'</b>; regular signed-clamp w: <b>'+w+'</b>.</li>';
        info+='<li>Expected regular shown damage: <b>'+stats.min+'\u2013'+stats.max+'</b>.</li>';
        info+='<li>This preview does <b>not</b> derive subtract from stamina or setup state yet. It only answers: "if this subtraction has already happened, what damage follows?"</li>';
        info+='<li>Selected rng16: <b>'+rng+'</b>; seed: <b>'+seed+'</b>; uncapped dmg: <b>'+uncapped+'</b>; shown dmg: <b>'+capped+'</b>.</li>';
        info+='</ul>';
        document.getElementById('doc-at-chart').innerHTML=info;
        return;
      }
      var pct=stats.pct999;
      var below=100-pct;
      var W=300,H=18,distW=300,distH=92;
      var bar='<rect x="0" y="0" width="'+W+'" height="'+H+'" fill="#111" rx="3"/>';
      bar+='<rect x="0" y="0" width="'+(pct/100*W).toFixed(1)+'" height="'+H+'" fill="'+(pct>0?'#cc4422':'#1a1a1a')+'" rx="3"/>';
      var dist='';
      stats.bands.forEach(function(band,idx){
        var bw=distW/stats.bands.length;
        var bh=stats.maxBand?band.count/stats.maxBand*(distH-12):0;
        var x=(idx*bw).toFixed(1),y=(distH-bh-10).toFixed(1);
        var fill=band.to>=999?'#ff7755':(band.pct<0.05?'#3d4e6a':'#4f8ee8');
        dist+='<rect x="'+x+'" y="'+y+'" width="'+Math.max(1,bw-1).toFixed(1)+'" height="'+bh.toFixed(1)+'" fill="'+fill+'" rx="1"/>';
      });
      dist+='<line x1="0" y1="'+(distH-10)+'" x2="'+distW+'" y2="'+(distH-10)+'" stroke="#444"/>';
      dist+='<text x="0" y="'+(distH-1)+'" font-size="8" fill="#666">'+stats.min+'</text>';
      dist+='<text x="'+(distW-22)+'" y="'+(distH-1)+'" font-size="8" fill="#666">'+stats.max+'</text>';
      var topList=stats.top.map(function(row){return '<li>shown dmg <b>'+row.dmg+'</b>: <b>'+row.count+'/65536</b> = <b>'+docFmtPct(row.pct)+'%</b></li>';}).join('');
      var info='';
      info+='<ul class="doc-bullets">';
      info+='<li>Base atk: <b>'+atk+'</b>; manual subtract: <b>'+sub+'</b>; underflowed atk: <b>'+atkEff+'</b>.</li>';
      info+='<li>Underflow occurred, so the wrapped atlas-glitch damage helper is active.</li>';
      info+='<li>This preview does <b>not</b> derive subtract from stamina or setup state yet. It only answers: "if this subtraction has already happened, what damage follows?"</li>';
      info+='<li>Target def: <b>'+def+'</b>; def\u00f74: <b>'+(def>>2)+'</b>; computed w: <b>'+w+'</b>.</li>';
      info+='<li>All shown damage rolls: <b>'+stats.min+'\u2013'+stats.max+'</b>.</li>';
      info+='<li>999-cap: <b>'+stats.count999+'/65536</b> = <b>'+docFmtPct(pct)+'%</b>.</li>';
      info+='<li>&lt;999 damage: <b>'+(65536-stats.count999)+'/65536</b> = <b>'+docFmtPct(below)+'%</b>.</li>';
      info+='<li>Selected rng16: <b>'+rng+'</b>; seed: <b>'+seed+'</b>; uncapped dmg: <b>'+uncapped+'</b>; shown dmg: <b>'+capped+'</b>'+(uncapped>=999?' <span class="doc-cap">caps to 999</span>':'')+'.</li>';
      info+='</ul>';
      info+='<svg width="'+W+'" height="'+H+'" style="display:block;margin:4px 0 2px">'+bar+'</svg>';
      info+='<div class="doc-dist-cap">999 band: '+docFmtPct(pct)+'%  |  below 999: '+docFmtPct(below)+'%</div>';
      info+='<div class="doc-dist"><div class="doc-val">Expected shown-damage distribution (binned when many infrequent rolls exist)</div><svg width="'+distW+'" height="'+distH+'" style="display:block">'+dist+'</svg></div>';
      info+='<div class="doc-val">Most frequent shown values</div><ul class="doc-bullets">'+topList+'</ul>';
      document.getElementById('doc-at-chart').innerHTML=info;
    }
    atAtk.addEventListener('input',udAt);
    atSub.addEventListener('input',udAt);
    atDef.addEventListener('input',udAt);
    atRng.addEventListener('input',udAt);
    udAt();
  }
  // ── Route planner mock ─────────────────────────────────────────────────
  (function(){
    var listEl=document.getElementById('rp-list');
    if(!listEl)return;
    var outEl=document.getElementById('rp-sim-out');
    var rows=[];
    var seq=1;
    var templates={
      heart8:{enemy:"Thraxx's Heart",method:'Alchemy 8-cast',qty:1,expected:'TODO',xp:'boss xp',alchemy:'spell xp',notes:'Act 1 heart burst'},
      skelesnail8:{enemy:'Skelesnail',method:'Alchemy 8-cast',qty:1,expected:'TODO',xp:'enemy xp',alchemy:'spell xp',notes:'Alchemy leveling route step'},
      magmar8:{enemy:'Magmar',method:'Alchemy 8-cast',qty:1,expected:'TODO',xp:'enemy xp',alchemy:'spell xp',notes:'Common any% Act 1 route'},
      sterlingPhys:{enemy:'Sterling',method:'Physical / atlas check',qty:1,expected:'atlas-driven',xp:'boss xp',alchemy:'0',notes:'Depends on miss rate and overflow odds'}
    };
    function renderRoute(){
      if(!rows.length){
        listEl.innerHTML='<div class="rp-empty">No route steps yet. Add a sample kill from the left. This is a mock UI only.</div>';
        outEl.innerHTML='<ul><li>Simulation engine is not implemented yet.</li><li>Physical expected hits need live damage bands and hit% integration.</li><li>Alchemy expected hits still need spell-level scaling, 8-cast modeling, and route-grade batch logic.</li></ul>';
        return;
      }
      var html='<table class="rp-table"><thead><tr><th>#</th><th>Enemy</th><th>Method</th><th>Qty</th><th>Expected hits</th><th>XP</th><th>Alchemy XP</th><th>Notes</th><th></th></tr></thead><tbody>';
      rows.forEach(function(row,idx){
        html+='<tr><td>'+(idx+1)+'</td><td>'+escH(row.enemy)+'</td><td><span class="rp-tag">'+escH(row.method)+'</span></td><td>'+row.qty+'</td><td>'+escH(row.expected)+'</td><td>'+escH(row.xp)+'</td><td>'+escH(row.alchemy)+'</td><td>'+escH(row.notes)+'</td><td><button class="rp-btn-ghost" data-rp-del="'+row.id+'">remove</button></td></tr>';
      });
      html+='</tbody></table>';
      listEl.innerHTML=html;
      listEl.querySelectorAll('[data-rp-del]').forEach(function(btn){
        btn.addEventListener('click',function(){
          rows=rows.filter(function(r){return String(r.id)!==btn.dataset.rpDel;});
          renderRoute();
        });
      });
      outEl.innerHTML='<ul>'
        +'<li>Mock only: simulation is not wired yet, but the future output should report hits, misses, atlas overflow outcomes, and the kill order.</li>'
        +'<li>Level routing assumption: you level immediately after each XP gain, then continue with post-level stats. Max 1 level per XP event.</li>'
        +'<li>Alchemy routing assumption: level-0 per-cast previews exist in Scaling, but 8-casts and spell-XP growth are still placeholders.</li>'
        +'<li>Current route length: <b>'+rows.length+'</b> steps.</li>'
        +'</ul>';
    }
    document.querySelectorAll('[data-rp-add]').forEach(function(btn){
      btn.addEventListener('click',function(){
        var tpl=templates[btn.dataset.rpAdd];
        if(!tpl)return;
        rows.push({id:seq++,enemy:tpl.enemy,method:tpl.method,qty:tpl.qty,expected:tpl.expected,xp:tpl.xp,alchemy:tpl.alchemy,notes:tpl.notes});
        renderRoute();
      });
    });
    var simBtn=document.getElementById('rp-sim-btn');
    if(simBtn)simBtn.addEventListener('click',function(){renderRoute();});
    renderRoute();
  })();
})();
`;

    const routeJs = `
(function(){
  // Route mock uses the shared tab script bundle; logic lives in docsJs for now.
})();
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
  document.querySelectorAll('tr.dr').forEach(function(row){
    var hasDoc=row.dataset.hasdoc==='1';
    row.classList.toggle('hrow',hideAlloc&&!hasDoc);
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

var hideUnusedArgs=true;
document.body.classList.add('hideargs');
var hideArgsBtn=document.getElementById('btn-hideargs');
if(hideArgsBtn)hideArgsBtn.addEventListener('click',function(){
  hideUnusedArgs=!hideUnusedArgs;
  hideArgsBtn.classList.toggle('on',hideUnusedArgs);
  document.body.classList.toggle('hideargs',hideUnusedArgs);
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

function goToLine(l){if(l<0||isNaN(l))return;if(vs)vs.postMessage({command:'goToLine',line:l});}
function bindLinks(root){
  if(!root)return;
  root.querySelectorAll('a.ll').forEach(function(a){
    a.addEventListener('click',function(e){e.preventDefault();e.stopPropagation();var l=parseInt(a.dataset.line);if(l>=0&&!isNaN(l))goToLine(l);});
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
${scalingData}
${roomsJs}
${scalingJs}
${docsJs}
${routeJs}
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
}

function deactivate() {}

module.exports = { activate, deactivate };
