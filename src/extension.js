'use strict';

const vscode = require('vscode');
const path   = require('path');
const fs     = require('fs');
const { radarLifecycle, radarH, radarEsc, radarExtractEmoji, radarParseName, radarParseNotes, parseEvsNum, parseEnumsFromContent, parseEvsEnumValues } = require('./shared/radar-utils');
const radarWebview = require('./memory/webview');
const { readRoomScriptModel } = require('./emulator/room-script-model');
const { resolveExtConfig, getRepoAutofillUpdates } = require('./shared/config');



const lp = require('./language/language-providers');


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
let _radarUpdateTimer  = null;   // debounce timer for auto-update
let _radarRoomTree     = null;   // cached room tree (rebuilt when doc changes)
let _radarRoomDocPath  = null;   // fsPath the room tree was built for
let _radarActiveTab    = 'radar'; // preserved tab across re-renders
let _scalingChars      = null;   // cached character stat array (142 entries from ROM)
let _hitLookup         = null;   // precomputed hit% table {hit_rate:{evade:pct}} from ROM
let _scaleActive       = false;  // whether scale_enemies is active in workspace
let _ingrBaseUri       = '';     // webview URI base for ingredient images (set on panel creation)
let _radarByteScriptFocus = '';  // currently focused byte-script address from emulator panel

function getRadarMap() {
    if (_radarMapCache) return _radarMapCache;
    const wf = vscode.workspace.workspaceFolders?.[0];
    if (!wf) return new Map();
    _radarMapCache = radarReadMemoryMap(path.join(wf.uri.fsPath, '.github', 'memory-map.md'));
    return _radarMapCache;
}

function invalidateRadarMap() { _radarMapCache = null; }

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

function invalidateRoomCaches() {
    _radarRoomTree = null;
    _radarRoomDocPath = null;
    invalidateRoomDataCaches();
}

/**
 * Read extension settings with workspace-based defaults.
 * All values are mocked / defaulted for now; will be user-configurable at release.
 */
function getExtConfig() {
    const cfg    = vscode.workspace.getConfiguration('everscript');
    const wsRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? null;
    const resolved = resolveExtConfig({
        repoPath: cfg.get('repoPath'),
        inDirectory: cfg.get('inDirectory'),
        patchesDirectory: cfg.get('patchesDirectory'),
        patchesPath: cfg.get('patchesPath'),
        romPath: cfg.get('romPath'),
        assetsPath: cfg.get('assetsPath'),
        compilerPath: cfg.get('compilerPath'),
        pythonPath: cfg.get('pythonPath'),
        snesCorePath: cfg.get('snesCorePath'),
    }, wsRoot);
    return {
        inDir: resolved.inDirectory || null,
        patchesDir: resolved.patchesDirectory || null,
        romPath: resolved.romPath || null,
        assetsPath: resolved.assetsPath,
        repoPath: resolved.repoPath || null,
        compilerPath: resolved.compilerPath || null,
        pythonPath: resolved.pythonPath || null,
        snesCorePath: resolved.snesCorePath || null,
    };
}

const roomData = require('./rooms');
const { VANILLA_ROOMS, getMapEnum, readLuaWatchers, readScriptAllTriggers, buildVanillaRoomContent, buildVanillaRoomDetails, invalidateRoomDataCaches } = roomData;
const roomTree = require('./rooms');
const { findRoomImage, parseRoomContent, collectRoomsFromDir, buildRoomTree, renderVanillaTree, renderRoomsTree, buildRoomsJson, setRoomImageUris } = roomTree;

const romReaders = require('./shared/rom-readers');
const { readPngDimensions, readRomTriggerOffsets, readRomMapHeader, readRomCharacters, readRomHitLookup, detectScaleEnemies } = romReaders;

const { renderRadarHtml } = require('./memory/render-radar');

// ── Activation ────────────────────────────────────────────────────────────────

async function syncDerivedSettingsFromRepoPath() {
    const wsRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? null;
    const cfg = vscode.workspace.getConfiguration('everscript');
    if (!cfg || typeof cfg.update !== 'function') return;
    const updates = getRepoAutofillUpdates({
        repoPath: cfg.get('repoPath'),
        inDirectory: cfg.get('inDirectory'),
        patchesDirectory: cfg.get('patchesDirectory'),
        patchesPath: cfg.get('patchesPath'),
        romPath: cfg.get('romPath'),
        compilerPath: cfg.get('compilerPath'),
        pythonPath: cfg.get('pythonPath'),
    }, wsRoot);
    const hasWorkspace = !!(vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length);
    const target = hasWorkspace && vscode.ConfigurationTarget
        ? vscode.ConfigurationTarget.Workspace
        : (vscode.ConfigurationTarget ? vscode.ConfigurationTarget.Global : undefined);
    for (const [key, value] of Object.entries(updates)) {
        if (!value) continue;
        if ((cfg.get(key, '') || '').trim() === value) continue;
        await cfg.update(key, value, target);
    }
}

// ── Radar scope/analysis functions ───────────────────────────────────────────

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
        if (start > end) continue;
        const rawName = cells[1] || '';
        const nameParts = radarParseName(rawName);
        const name = nameParts[0] || rawName.replace(/<[^>]+>/g, '').trim();
        if (/^\s*\(gap/i.test(name)) continue;
        const notes = radarParseNotes(cells[3] || '');
        const typeStr = cells[2] || '';
        const isWord = /\bWord\b/i.test(typeStr);
        const effectiveEnd = (isWord && end === start) ? start + 1 : end;
        const entry = {
            name, nameParts, type: typeStr, notes,
            lifecycle: radarLifecycle(start, typeStr, notes),
            isWord, addrStart: start, addrEnd: effectiveEnd,
        };
        for (let a = start; a <= effectiveEnd; a++) {
            const ex = map.get(a);
            if (!ex || ex.addrStart < start) map.set(a, entry);
        }
    }
    return map;
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

function radarAnalyzeScope(document, startLine, endLine) {
    const refs = new Map();
    const pools = [];
    const argRefs = new Map();

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

    for (let i = startLine; i <= endLine; i++) {
        const rawText = document.lineAt(i).text;
        const text    = rawText.replace(/\/\/.*$/, '');
        if (/<\s*0x[0-9a-fA-F]+\s*>\s*\.\.\s*</.test(text)) continue;
        for (const m of text.matchAll(/\bmemory\s*\(\s*(0x[0-9a-fA-F]+)/g)) {
            const a = parseInt(m[1], 16);
            if (!isNaN(a)) add(a, i, rawText, 'memory()', isWrite(text, m[1]));
        }
        for (const m of text.matchAll(/<\s*(0x[0-9a-fA-F]+)/g)) {
            const a = parseInt(m[1], 16);
            if (!isNaN(a)) add(a, i, rawText, '<deref>', isWrite(text, m[1]));
        }
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
    const wsRoot2 = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? null;
    if (_radarRoomDocPath !== doc.uri.fsPath) {
        _radarRoomTree    = buildRoomTree(doc, wsRoot2, getExtConfig());
        _radarRoomDocPath = doc.uri.fsPath;
        if (_radarPanel) setRoomImageUris(_radarRoomTree, p => _radarPanel.webview.asWebviewUri(vscode.Uri.file(p)).toString());
    }
    _scaleActive = detectScaleEnemies(wsRoot2, doc.uri.fsPath);
    const selectedMap = scope.kind === 'map' ? scope.name : null;
    const _extCfg1 = getExtConfig();
    const _wsRoot1 = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? null;
    const _vrd1 = buildVanillaRoomDetails(_wsRoot1, _extCfg1.romPath || '');
    _radarPanel.webview.html = renderRadarHtml(scope, refs, pools, argRefs, mapByAddr, _radarRoomTree || [], _radarActiveTab, selectedMap, _scalingChars || [], _scaleActive, _ingrBaseUri, _hitLookup, getRadarEnums(), _vrd1, _radarByteScriptFocus);
    _radarPanel.title = 'Radar: ' + scope.name;
}

// ── Radar CodeLens provider ───────────────────────────────────────────────────
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

function activate(context) {
    const idx = lp.loadIndex(context.extensionPath);

    // Build workspace index on activation; keep it fresh on file changes
    lp.buildWorkspaceIndex();
    const watcher = vscode.workspace.createFileSystemWatcher('**/*.evs');
    watcher.onDidChange(() => lp.buildWorkspaceIndex());
    watcher.onDidCreate(() => lp.buildWorkspaceIndex());
    watcher.onDidDelete(() => lp.buildWorkspaceIndex());
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
    const applyDeadBranches = (editor) => lp.updateDeadBranchDecorations(editor, idx);
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
            provideHover: (doc, pos) => lp.provideHover(doc, pos, idx, getRadarMap()),
        }),

        vscode.languages.registerDocumentSymbolProvider('everscript', {
            provideDocumentSymbols: lp.provideDocumentSymbols,
        }),

        vscode.languages.registerCompletionItemProvider(
            'everscript',
            { provideCompletionItems: (doc, pos) => lp.provideCompletionItems(doc, pos, idx) },
            '.', '@',
        ),

        vscode.languages.registerDefinitionProvider('everscript', {
            provideDefinition: (doc, pos) => lp.provideDefinition(doc, pos),
        }),

        vscode.languages.registerReferenceProvider('everscript', {
            provideReferences: (doc, pos) => lp.provideReferences(doc, pos),
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
                    _radarByteScriptFocus = '';
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
                _radarRoomTree    = buildRoomTree(document, wsRoot, getExtConfig());
                _radarRoomDocPath = document.uri.fsPath;
                setRoomImageUris(_radarRoomTree, p => _radarPanel.webview.asWebviewUri(vscode.Uri.file(p)).toString());
            }

            const selectedMap = scope.kind === 'map' ? scope.name : null;
            const _extCfg2 = getExtConfig();
            const _wsRoot2b = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? null;
            const _vrd2 = buildVanillaRoomDetails(_wsRoot2b, _extCfg2.romPath || '');
            _radarPanel.webview.html = renderRadarHtml(scope, refs, pools, argRefs, mapByAddr, _radarRoomTree, _radarActiveTab, selectedMap, _scalingChars || [], _scaleActive, _ingrBaseUri, _hitLookup, getRadarEnums(), _vrd2, _radarByteScriptFocus);

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
                        const _extCfg3 = getExtConfig();
                        const _wsRoot3 = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? null;
                        const _vrd3 = buildVanillaRoomDetails(_wsRoot3, _extCfg3.romPath || '');
                        _radarPanel.webview.html = renderRadarHtml(gscope, refs, pools, argRefs, getRadarMap(), _radarRoomTree || [], _radarActiveTab, null, _scalingChars || [], _scaleActive, _ingrBaseUri, _hitLookup, getRadarEnums(), _vrd3, _radarByteScriptFocus);
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
                        if (_radarPanel) setRoomImageUris(_radarRoomTree, p => _radarPanel.webview.asWebviewUri(vscode.Uri.file(p)).toString());
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
        vscode.commands.registerCommand('everscript._scriptFocus', (payload) => {
            _radarByteScriptFocus = String(payload?.address || '').toUpperCase();
            if (_radarPanel) {
                _radarPanel.webview.postMessage({
                    command: 'byteScriptFocus',
                    address: _radarByteScriptFocus,
                    slot: typeof payload?.slot === 'number' ? payload.slot : null,
                    state: payload?.state || '',
                });
            }
        }),
        vscode.commands.registerCommand('everscript.openSettings', () => {
            syncDerivedSettingsFromRepoPath().catch(() => {});
            vscode.commands.executeCommand('workbench.action.openSettings', 'everscript');
        }),
    );

    context.subscriptions.push(vscode.workspace.onDidChangeConfiguration((event) => {
        if (!event.affectsConfiguration('everscript')) return;
        invalidateRoomCaches();
        invalidateRadarMap();
        if (event.affectsConfiguration('everscript.repoPath')) syncDerivedSettingsFromRepoPath().catch(() => {});
    }));

    // ── Build-and-Run (F5 in .evs files) ─────────────────────────────────────
    context.subscriptions.push(
        vscode.commands.registerCommand('everscript.buildAndRun', async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor || editor.document.languageId !== 'everscript') {
                vscode.window.showWarningMessage('Everscript: no .evs file is active.');
                return;
            }

            const cfg       = vscode.workspace.getConfiguration('everscript');
            const nodePath  = require('path');
            const nodeFs    = require('fs');
            const nodeOs    = require('os');
            const cp        = require('child_process');
            const extCfg    = getExtConfig();

            // ── 1. Resolve compiler and project root ───────────────────────
            let repoPath    = extCfg.repoPath || '';
            let patchesPath = extCfg.patchesDir || '';
            let romPath     = extCfg.romPath || ''; // full path to vanilla ROM
            let compilerBin = extCfg.compilerPath || ''; // manual override
            let projectRoot = repoPath;
            let useScript   = false;

            // Prefer everscript.py in the repo root (Python-based compiler).
            if (repoPath && nodeFs.existsSync(nodePath.join(repoPath, 'everscript.py'))) {
                useScript = true;
                if (!compilerBin) compilerBin = nodePath.join(repoPath, 'everscript.py');
            }

            if (!compilerBin) {
                // Auto-detect by walking up from the active .evs file.
                let dir = nodePath.dirname(editor.document.uri.fsPath);
                for (let depth = 0; depth < 8 && !compilerBin; depth++) {
                    const pyCandidate = nodePath.join(dir, 'everscript.py');
                    if (nodeFs.existsSync(pyCandidate)) {
                        useScript   = true;
                        compilerBin = pyCandidate;
                        if (!projectRoot) projectRoot = dir;
                        break;
                    }
                    for (const bin of ['everscript_mac', 'everscript', 'everscript.exe']) {
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
                    'Everscript: compiler not found. Open the Emulator panel \u2192 Settings tab and set the repo path.'
                );
                return;
            }

            if (!projectRoot) {
                projectRoot = useScript
                    ? nodePath.dirname(compilerBin)
                    : nodePath.dirname(nodePath.dirname(compilerBin)); // parent of dist/
            }

            // ── 2. Resolve ROM ─────────────────────────────────────────────
            let romName = '';
            if (romPath) {
                romName = nodePath.basename(romPath);
            } else {
                try {
                    const files = nodeFs.readdirSync(projectRoot);
                    const found = files.find(f => /\.(smc|sfc)$/i.test(f));
                    if (found) romName = found;
                } catch (_) {}
            }

            if (!romName) {
                vscode.window.showErrorMessage(
                    'Everscript: no ROM found. Set the Vanilla ROM in the Emulator panel \u2192 Settings tab.'
                );
                return;
            }

            // ── 3. Resolve patches folder ──────────────────────────────────
            let patchesArg = patchesPath;
            if (!patchesArg && projectRoot) {
                const defaultPatches = nodePath.join(projectRoot, 'patches');
                if (nodeFs.existsSync(defaultPatches)) patchesArg = defaultPatches;
            }

            // ── 4. Build spawn args ────────────────────────────────────────
            const inputEvs  = editor.document.uri.fsPath;
            const outputRom = nodePath.join(projectRoot, 'out', romName);

            // Detect Python: prefer project venv so packages like 'injector' are available
            let pythonBin = extCfg.pythonPath || '';
            if (!pythonBin && projectRoot) {
                for (const rel of ['.venv/bin/python3', '.venv/bin/python', 'venv/bin/python3', 'venv/bin/python']) {
                    const c = nodePath.join(projectRoot, rel);
                    if (nodeFs.existsSync(c)) { pythonBin = c; break; }
                }
            }
            if (!pythonBin) pythonBin = 'python3';

            // Use relative paths (matches: python everscript.py --rom ... --patches ./patches in/...)
            const _sep = nodePath.sep;
            const inputArg = inputEvs.startsWith(projectRoot + _sep)
                ? nodePath.relative(projectRoot, inputEvs)
                : inputEvs;
            const patchesArgRel = patchesArg && patchesArg.startsWith(projectRoot)
                ? nodePath.relative(projectRoot, patchesArg)
                : patchesArg;

            let spawnBin, spawnArgs;
            if (useScript) {
                spawnBin  = pythonBin;
                spawnArgs = [compilerBin, '--rom', romName];
                if (patchesArgRel) spawnArgs.push('--patches', patchesArgRel);
                spawnArgs.push(inputArg);
            } else {
                spawnBin  = compilerBin;
                spawnArgs = ['--rom', romName, inputArg];
            }

            function buildSpawnEnv() {
                const env = { ...process.env };
                const pathKey = Object.keys(env).find((key) => key.toUpperCase() === 'PATH') || 'PATH';
                const pathEntries = [];
                const seen = new Set();
                function addPathEntry(entry) {
                    if (!entry || seen.has(entry)) return;
                    seen.add(entry);
                    pathEntries.push(entry);
                }

                if (projectRoot) {
                    for (const rel of ['.venv/bin', 'venv/bin']) {
                        const candidate = nodePath.join(projectRoot, rel);
                        if (nodeFs.existsSync(candidate)) addPathEntry(candidate);
                    }
                }
                if (pythonBin) addPathEntry(nodePath.dirname(pythonBin));

                const shellBin = env.SHELL || '/bin/zsh';
                try {
                    const shellResult = cp.spawnSync(shellBin, ['-lic', 'printf %s "$PATH"'], {
                        cwd: projectRoot,
                        encoding: 'utf8',
                        env,
                        timeout: 5000,
                    });
                    if (shellResult.status === 0 && shellResult.stdout) {
                        for (const entry of shellResult.stdout.split(nodePath.delimiter)) addPathEntry(entry);
                    }
                } catch (_) {}

                for (const entry of String(env[pathKey] || '').split(nodePath.delimiter)) addPathEntry(entry);
                for (const entry of [
                    '/opt/homebrew/bin',
                    '/usr/local/bin',
                    '/usr/bin',
                    '/bin',
                    nodePath.join(nodeOs.homedir(), 'Documents', 'GitHub', 'asar', 'asar', 'bin'),
                    nodePath.join(nodeOs.homedir(), 'GitHub', 'asar', 'asar', 'bin'),
                ]) {
                    if (nodeFs.existsSync(entry)) addPathEntry(entry);
                }

                env[pathKey] = pathEntries.join(nodePath.delimiter);
                return env;
            }

            const channel = vscode.window.createOutputChannel('Everscript Build');
            channel.clear();
            channel.show(true);
            channel.appendLine(`[Everscript] Compiling: ${nodePath.basename(inputEvs)}`);
            channel.appendLine(`[Everscript] CWD:       ${projectRoot}`);
            function _qArg(a) { return /[ ()\[\]\\!'"<>]/.test(a) ? '"' + a.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"' : a; }
            channel.appendLine(`[Everscript] Command:   ${[spawnBin, ...spawnArgs.map(_qArg)].join(' ')}`);
            channel.appendLine('');

            const statusItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
            statusItem.text = '$(sync~spin) Everscript: building...';
            statusItem.show();

            const exitCode = await new Promise(resolve => {
                const proc = cp.spawn(spawnBin, spawnArgs, { cwd: projectRoot, shell: false, env: buildSpawnEnv() });
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
                    'Everscript build failed (exit ' + exitCode + '). See Output > Everscript Build.'
                );
                return;
            }

            channel.appendLine('[Everscript] Build succeeded.');

            // ── 5. Load output ROM into the emulator ───────────────────────
            let romData;
            try {
                romData = nodeFs.readFileSync(outputRom);
            } catch (e) {
                channel.appendLine(`[Everscript] Output ROM not found: ${outputRom}`);
                channel.appendLine(`[Everscript] Error: ${e.message}`);
                vscode.window.showErrorMessage('Everscript: build succeeded but output ROM not found: ' + e.message);
                openEmulatorPanel(context, undefined, channel);
                return;
            }
            channel.appendLine(`[Everscript] Output ROM:  ${outputRom}`);
            channel.appendLine(`[Everscript] ROM size:    ${(romData.length / 1024 / 1024).toFixed(2)} MB`);
            const dataUrl = 'data:application/octet-stream;base64,' + romData.toString('base64');
            openEmulatorPanel(context, { dataUrl, name: nodePath.basename(outputRom) }, channel);
        }),
    );
}

function deactivate() {}

module.exports = { activate, deactivate };
