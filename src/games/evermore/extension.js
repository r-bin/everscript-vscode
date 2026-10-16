'use strict';

const vscode = require('vscode');
const path   = require('path');
const fs     = require('fs');
const { parseEnumsFromContent } = require('./radar-utils');
const { resolveExtConfig, getRepoAutofillUpdates } = require('./language/config');



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
// Which editor column the panel opens in. `Beside` is right for a radar you
// read next to the code; the map editor is a workspace of its own and asks
// for `Active`, which gives it the whole editor area.
let _radarColumn       = vscode.ViewColumn.Beside;
let _radarPendingNewMap = false; // draft a blank room as soon as the webview is up
let _scalingChars      = null;   // cached character stat array (142 entries from ROM)
let _hitLookup         = null;   // precomputed hit% table {hit_rate:{evade:pct}} from ROM
let _scaleActive       = false;  // whether scale_enemies is active in workspace
let _radarByteScriptFocus = '';  // currently focused byte-script address from emulator panel
let _spritesBundle     = null;   // cached sprites bundle {characters, rawIndex}
let _mapExportChannel  = null;   // output channel for ROM build and compilation logs

function getMapExportChannel() {
    if (!_mapExportChannel) {
        _mapExportChannel = vscode.window.createOutputChannel('Everscript ROM Builder', 'everscript-trace');
    }
    return _mapExportChannel;
}

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
    _spritesBundle = null;
    invalidateRoomDataCaches();
}

function getSpritesBundle(rom) {
    if (_spritesBundle) return _spritesBundle;
    if (!rom) return { characters: [], rawIndex: [], animations: [] };
    const characters = readAllCharacters(rom);
    for (const c of characters) c.thumbs = characterThumbs(rom, c);
    _spritesBundle = {
        characters,
        rawIndex: getRawSpriteIndex(rom),
        animations: buildAnimationCatalog(rom, characters),
    };
    return _spritesBundle;
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
        compilerPath: cfg.get('compilerPath'),
        pythonPath: cfg.get('pythonPath'),
        snesCorePath: cfg.get('snesCorePath'),
    }, wsRoot);
    return {
        inDir: resolved.inDirectory || null,
        patchesDir: resolved.patchesDirectory || null,
        repoPath: resolved.repoPath || null,
        compilerPath: resolved.compilerPath || null,
        pythonPath: resolved.pythonPath || null,
        snesCorePath: resolved.snesCorePath || null,
    };
}

const roomData = require('./rooms');
const { VANILLA_ROOMS, buildVanillaRoomDetails, buildItemIcons, invalidateRoomDataCaches } = roomData;

/** The ring menu's item icons from the configured ROM, for the radar page (rooms/data/item-icons.js). */
function radarItemIcons() {
    const ws = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? null;
    return buildItemIcons(romReaders.loadRomBuffer(ws, ''));
}
const roomTree = require('./rooms');
const { handlesRomMessage, handleRomMessage } = require('./rom');
const { handlesMusicMessage, handleMusicMessage } = require('./music');
const { handlesScriptsMessage, handleScriptsMessage } = require('./scripts-tab');
const { handlesEditorMessage, handleEditorMessage } = require('./rooms/editor-host');
const { handlesSpritesMessage, handleSpritesMessage } = require('./sprites/radar-host');
const { buildRoomTree, renderRoomsTree, buildRoomsJson, setRoomImageUris, handlesCustomMapMessage, handleCustomMapMessage } = roomTree;

const romReaders = require('./rom-readers');
const roms = require('../../core/roms/host');
const gameViews = require('../../core/game-views');
const platform = require('../../../dist/platform');
const { readRomCharacters, readRomHitLookup, detectScaleEnemies } = romReaders;

const { renderRadarHtml } = require('./memory/render-radar');
const { readAllCharacters, getRawSpriteIndex, renderAnimation, buildAnimationCatalog, characterThumbs } = require('./sprites');

// ── Activation ────────────────────────────────────────────────────────────────

async function syncDerivedSettingsFromRepoPath() {
    const wsRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? null;
    const cfg = vscode.workspace.getConfiguration('everscript');
    if (!cfg || typeof cfg.update !== 'function') return;
    const updates = getRepoAutofillUpdates({
        repoPath: cfg.get('repoPath'),
        inDirectory: cfg.get('inDirectory'),
        patchesDirectory: cfg.get('patchesDirectory'),
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

const { radarReadMemoryMap, radarDetectScope, radarAnalyzeScope } = require('./memory/scope-analysis');

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
    const _vrd1 = buildVanillaRoomDetails(_wsRoot1, '');
    const _romBuf1 = romReaders.loadRomBuffer(_wsRoot1, '');
    const _spBundle1 = getSpritesBundle(_romBuf1);
    _radarPanel.webview.html = renderRadarHtml(scope, refs, pools, argRefs, mapByAddr, _radarRoomTree || [], _radarActiveTab, selectedMap, _scalingChars || [], _scaleActive, radarItemIcons(), _hitLookup, getRadarEnums(), _vrd1, _radarByteScriptFocus, _spBundle1, radarImportedRooms());
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

/** globalState key for the Rooms webview's remembered UI state. */
const ROOMS_UI_PREFS_KEY = 'everscript.roomsUi';


/**
 * Secret of Mana maps as Evermore rooms (src/games/evermore/imports/mana): the Rooms tab lists
 * them under the vanilla rooms when a Mana ROM is found beside the Evermore one.
 * Set in activate(), where the Mana ROM accessor is made.
 */
let _manaRooms = null;

/** The rail groups of converted rooms, [] when there are none. */
function radarImportedRooms() {
    try {
        const areas = _manaRooms ? _manaRooms.railGroups() : [];
        return areas.length ? [{ key: 'mana', label: 'Secret of Mana', areas,
            title: 'Secret of Mana maps converted to Evermore rooms: tiles, families, collision, step-on events' }] : [];
    } catch { return []; }
}

/**
 * The ROM and room id that answer a Rooms-tab request about `roomId`: the Evermore
 * ROM for a ROM room (0..0x7E), a converted room's own image otherwise. Null when
 * neither applies (`error` says why).
 */
function radarRoomRom(roomId) {
    const id = Number(roomId);
    if (Number.isInteger(id) && id >= 0 && id <= 0x7e) {
        const ws = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? null;
        const romBuf = romReaders.loadRomBuffer(ws, '');
        return romBuf ? { romBuf, roomId: id } : { error: 'ROM not found — use Everscript: Switch ROM' };
    }
    const hit = _manaRooms && _manaRooms.resolveRoom(id);
    return hit ? { romBuf: hit.rom, roomId: hit.roomId } : { error: 'invalid room id' };
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
            // Another game's ROM opens that game's view (multi-game.md §6: one command, any game).
            if (gameViews.openSelectedGameView(undefined, 'evermore')) return;
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
                    _radarColumn,
                    {
                        enableScripts: true,
                        retainContextWhenHidden: true,
                        localResourceRoots: [wsRootUri].filter(Boolean),
                    },
                );
                _radarPanel.onDidDispose(() => {
                    require('../../emulator/panel').apuStream.setOn(false);
                    _radarPanel = null;
                    _radarPinned = false;
                    _radarCurrentScope = null;
                    _radarRoomTree = null;
                    _radarRoomDocPath = null;
                    _radarActiveTab = 'radar';
                    _radarByteScriptFocus = '';
                }, null, context.subscriptions);
            } else {
                _radarPanel.title = 'Radar: ' + scope.name;
                _radarPanel.reveal(_radarColumn, true);
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
            const _vrd2 = buildVanillaRoomDetails(_wsRoot2b, '');
            const _romBuf2 = romReaders.loadRomBuffer(_wsRoot2b, '');
            const _spBundle2 = getSpritesBundle(_romBuf2);
            _radarPanel.webview.html = renderRadarHtml(scope, refs, pools, argRefs, mapByAddr, _radarRoomTree, _radarActiveTab, selectedMap, _scalingChars || [], _scaleActive, radarItemIcons(), _hitLookup, getRadarEnums(), _vrd2, _radarByteScriptFocus, _spBundle2, radarImportedRooms());

            // `everscript.newMap` asked for a blank room. The webview has just
            // been rebuilt, so this is the first moment it can be told.
            if (_radarPendingNewMap) {
                _radarPendingNewMap = false;
                _radarPanel.webview.postMessage({ command: 'newMap' });
            }

            // Webview UI state that should outlive the panel — which tile
            // families are expanded, for one. The webview's own storage is
            // not it: its origin is new every time the panel is built.
            _radarPanel.webview.postMessage({
                command: 'uiPrefs', prefs: context.globalState.get(ROOMS_UI_PREFS_KEY, {}),
            });

            // Handle messages from the webview. This block runs on every panel
            // refresh, and each registration used to stay alive — so after N
            // refreshes every request was answered N times (N blank rooms, N
            // save dialogs for Export ROM). One subscription per panel: the
            // previous one is disposed first. Kept on the panel it belongs to,
            // not in a module variable.
            if (_radarPanel.__radarMessages) _radarPanel.__radarMessages.dispose();
            _radarPanel.__radarMessages = _radarPanel.webview.onDidReceiveMessage(msg => {
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
                } else if (msg.command === 'saveUiPref' && typeof msg.key === 'string') {
                    const prefs = { ...context.globalState.get(ROOMS_UI_PREFS_KEY, {}) };
                    prefs[msg.key] = msg.value;
                    context.globalState.update(ROOMS_UI_PREFS_KEY, prefs);
                } else if (handlesEditorMessage(msg.command)) {
                    // The map editor (rooms/editor-host.js).
                    handleEditorMessage(msg, {
                        post: (m) => _radarPanel?.webview.postMessage(m),
                        roomRom: radarRoomRom,
                        manaRooms: _manaRooms,
                        exportChannel: getMapExportChannel,
                        openEmulator: (rom) => require('../../emulator/panel').openEmulatorPanel(context, rom),
                        context,
                    });
                } else if (handlesCustomMapMessage(msg.command)) {
                    // Custom maps on disk: list, save, delete, export
                    // (rooms/custom-host.js, docs/map-format/custom-map-files.md).
                    handleCustomMapMessage(msg, {
                        vscode,
                        root: path.join(context.globalStorageUri.fsPath, 'custom-maps'),
                        widgetsFile: path.join(context.globalStorageUri.fsPath, 'widgets.json'),
                        post: (m) => _radarPanel?.webview.postMessage(m),
                        prefs: () => context.globalState.get(ROOMS_UI_PREFS_KEY, {}),
                        setPrefs: (v) => context.globalState.update(ROOMS_UI_PREFS_KEY, v),
                        loadRom: () => {
                            const _cfg = getExtConfig();
                            const _ws  = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? null;
                            return {
                                romPath: romReaders.resolveRomPath(_ws, ''),
                                romBuf: romReaders.loadRomBuffer(_ws, ''),
                            };
                        },
                    });
                } else if (handlesMusicMessage(msg.command)) {
                    // The Music tab (src/games/evermore/music/README.md). The emulator's sound
                    // chip is injected so the music domain never imports it.
                    const _ws = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? null;
                    handleMusicMessage(msg, {
                        post: (m) => _radarPanel?.webview.postMessage(m),
                        loadRom: () => romReaders.loadRomBuffer(_ws, ''),
                        apu: require('../../emulator/panel').apuStream,
                        describeSource: (rom, src) => require('./resources/sound-source').describeSoundSource(rom, src),
                        open: (uri) => vscode.commands.executeCommand('vscode.open', vscode.Uri.parse(uri)),
                    });
                } else if (handlesScriptsMessage(msg.command)) {
                    // The Scripts tab (src/games/evermore/scripts-tab/README.md). The animation
                    // renderer and the silent music player belong to the
                    // Characters and Music tabs; they are injected here so the
                    // scripts-tab domain never imports another feature.
                    const _ws = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? null;
                    const music = require('./music');
                    handleScriptsMessage(msg, {
                        post: (m) => _radarPanel?.webview.postMessage(m),
                        loadRom: () => romReaders.loadRomBuffer(_ws, ''),
                        animations: (rom) => getSpritesBundle(rom).animations,
                        renderAnimation,
                        music: {
                            list: (rom) => { const m = music.buildMusicModel(rom); return m.error ? [] : m.music; },
                            sequence: music.trackSequence,
                            timeline: music.trackTimeline,
                        },
                    });
                } else if (handlesRomMessage(msg.command)) {
                    // The ROM tab: map of every bank, CDL coverage, readers
                    // (src/games/evermore/rom/README.md). The CDL library is the emulator's,
                    // read here so the rom domain never imports the emulator.
                    const _ws = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? null;
                    handleRomMessage(msg, {
                        post: (m) => _radarPanel?.webview.postMessage(m),
                        loadRom: () => romReaders.loadRomBuffer(_ws, ''),
                        loadCdl: (rom) => {
                            const { CdlLibrary, romHash } = require('../../platform/cdl/library');
                            const root = path.join(context.globalStorageUri.fsPath, 'cdl-library');
                            return fs.existsSync(path.join(root, romHash(rom))) ? new CdlLibrary(root, rom) : null;
                        },
                        readWiki: () => {
                            const candidates = [
                                _ws && path.join(_ws, 'wiki', 'rom', 'Rom-Map.md'),
                                _ws && path.join(_ws, '.github', 'rom-map.md'),
                                path.join(context.extensionPath, 'wiki', 'rom', 'Rom-Map.md'),
                            ];
                            const hit = candidates.find(p => p && fs.existsSync(p));
                            return hit ? fs.readFileSync(hit, 'utf8') : '';
                        },
                        rooms: () => new Map(VANILLA_ROOMS.flatMap(a => a.rooms.map(r => [parseInt(r.id, 16), { name: r.name, area: a.area }]))),
                    });
                } else if (msg.command === 'globalScope') {
                    _radarPinned = true; // freeze auto-updates while in global view
                    if (_radarDoc) {
                        const gscope = { kind: 'global', name: _radarDoc.fileName.split(/[\/\\]/).pop(), startLine: 0, endLine: _radarDoc.lineCount - 1 };
                        const { refs, pools, argRefs } = radarAnalyzeScope(_radarDoc, 0, _radarDoc.lineCount - 1);
                        _scaleActive = detectScaleEnemies(wsRoot, _radarDoc.uri?.fsPath ?? null);
                        const _extCfg3 = getExtConfig();
                        const _wsRoot3 = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? null;
                        const _vrd3 = buildVanillaRoomDetails(_wsRoot3, '');
                        const _romBuf3 = romReaders.loadRomBuffer(_wsRoot3, '');
                        const _spBundle3 = getSpritesBundle(_romBuf3);
                        _radarPanel.webview.html = renderRadarHtml(gscope, refs, pools, argRefs, getRadarMap(), _radarRoomTree || [], _radarActiveTab, null, _scalingChars || [], _scaleActive, radarItemIcons(), _hitLookup, getRadarEnums(), _vrd3, _radarByteScriptFocus, _spBundle3, radarImportedRooms());
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
                } else if (handlesSpritesMessage(msg.command)) {
                    // The Characters tab (sprites/radar-host.js).
                    handleSpritesMessage(msg, {
                        post: (m) => _radarPanel?.webview.postMessage(m),
                        spritesBundle: getSpritesBundle,
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

    // ── Debugger: .evs scripts in the emulator (src/games/evermore/debugger/README.md) ────
    const emulatorPanel = require('../../emulator/panel');
    require('./debugger/inline-adapter').registerDebugger(context, {
        bridge: emulatorPanel.getScriptDebugBridge(),
        runRom: romPath => emulatorPanel.runRomFile(context, romPath),
    }, () => getExtConfig().repoPath || '', name => {
        // Fallback names for source maps without symbols: the bundled language index.
        const [enumName, member] = name.split('.');
        const entry = (idx.enums[enumName] || []).find(m => m.name === member);
        return entry ? entry.value : null;
    });

    // ── soe:// resources (src/games/evermore/resources/README.md) ──────────────────────────
    require('./resources').registerSoeResources(context, {
        // The first on-disk folder: a mounted ROM (soe://rom/?rom=…) can be listed first.
        vanillaRom: () => romReaders.loadRomBuffer(vscode.workspace.workspaceFolders?.find(f => f.uri.scheme === 'file')?.uri.fsPath ?? null, ''),
        emulatorRom: () => emulatorPanel.getCurrentRom(),
        romFile: romPath => romReaders.loadRomFile(romPath),
        readMemory: (addr, len) => emulatorPanel.readMemory(addr, len),
        emulatorStatus: () => emulatorPanel.getStatus(),
        getLogs: () => emulatorPanel.getLogHistory(),
    });
    // Converted Secret of Mana rooms (games/evermore/imports/mana) read the Mana ROM from the ROM library.
    _manaRooms = require('./imports/mana').createManaRooms({
        soeRom: () => romReaders.loadRomBuffer(vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? null, ''),
        manaRom: () => {
            const entry = platform.romFor('mana');
            const file = entry && platform.readRomFile(entry.path);
            return file ? platform.stripCopierHeader(file) : null;
        },
    });

    /** Re-render the open radar for the current document (Switch ROM to another Evermore ROM). */
    function refreshRadarForRom() {
        if (!_radarPanel || !_radarDoc) return;
        try {
            const wsRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? null;
            const scope = radarDetectScope(_radarDoc, 0);
            const { refs, pools, argRefs } = radarAnalyzeScope(_radarDoc, scope.startLine, scope.endLine);
            const mapByAddr = getRadarMap();
            _radarRoomTree = buildRoomTree(_radarDoc, wsRoot, getExtConfig());
            _radarRoomDocPath = _radarDoc.uri.fsPath;
            setRoomImageUris(_radarRoomTree, p => _radarPanel.webview.asWebviewUri(vscode.Uri.file(p)).toString());
            const vrd = buildVanillaRoomDetails(wsRoot, '');
            const romBuf = romReaders.loadRomBuffer(wsRoot, '');
            const spBundle = getSpritesBundle(romBuf);
            _radarPanel.webview.html = renderRadarHtml(scope, refs, pools, argRefs, mapByAddr, _radarRoomTree, _radarActiveTab, null, _scalingChars || [], _scaleActive, radarItemIcons(), _hitLookup, getRadarEnums(), vrd, _radarByteScriptFocus, spBundle, radarImportedRooms());
        } catch (_) {}
    }

    context.subscriptions.push(
        roms.onDidChangeRoms(() => {
            romReaders.invalidateRomBuffer();
            _manaRooms.clear();
            _scalingChars = null;
            _hitLookup = null;
            _radarRoomTree = null;
            _radarRoomDocPath = null;
        }),
        // The Memory Radar is Evermore's main view (core/game-views.js swaps it on Switch ROM).
        gameViews.registerGameView('evermore', {
            open: () => vscode.commands.executeCommand('everscript.openMemoryRadar'),
            panel: () => _radarPanel,
            refresh: refreshRadarForRom,
        }),
    );

    // ── Emulator Panel ───────────────────────────────────────────────────────
    const { openEmulatorPanel } = require('../../emulator/panel');
    // The full profile: every tab, and the CDL tab's exports and lookups.
    require('../../emulator/panel').configureEmulator({ profile: 'full', cdlTools: require('./cdl/tools'), game: require('./emulator/host') });
    // The emulator's sound chip, frame by frame, to the radar's Music tab.
    require('../../emulator/panel').apuStream.setListener(f => {
        if (_radarPanel) _radarPanel.webview.postMessage({ command: 'musicFrame', view: f.view, pkg: f.pkg, starts: f.starts, drv: f.drv, src: f.src, frame: f.frame, paused: !!f.paused });
    });

    // Sound-effect names for the emulator's marks (the Music model's, by driver id).
    require('../../emulator/panel').apuStream.setNames(() => {
        const _ws = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? null;
        return require('./music').sfxNames(() => romReaders.loadRomBuffer(_ws, ''));
    });
    require('../../emulator/panel').apuStream.setOnPause(paused => {
        if (_radarPanel) _radarPanel.webview.postMessage({ command: 'musicPaused', paused });
    });
    require('../../emulator/panel').apuStream.setOnClose(() => {
        if (_radarPanel) _radarPanel.webview.postMessage({ command: 'musicEmulator', open: false });
    });
    context.subscriptions.push(
        vscode.commands.registerCommand('everscript.openEmulator', () => {
            openEmulatorPanel(context);
        }),
        // A SNES CDL Recorder's zip (CDL library + replays) merged into this install's.
        vscode.commands.registerCommand('everscript.importRecordingBundle', () =>
            require('../../emulator/bundle-commands').importRecordingBundle(context)
                .catch(err => vscode.window.showErrorMessage('Import failed: ' + err.message))),
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
        vscode.commands.registerCommand('everscript._triggerExecuted', (lookup) => {
            if (_radarPanel && lookup) {
                _radarPanel.webview.postMessage({
                    command: 'highlightExecutedTrigger',
                    lookup,
                });
            }
        }),
        vscode.commands.registerCommand('everscript.openSettings', () => {
            syncDerivedSettingsFromRepoPath().catch(() => {});
            vscode.commands.executeCommand('workbench.action.openSettings', 'everscript');
        }),
        vscode.commands.registerCommand('everscript.exportRoomMaps', () => require('./rooms/export-maps').exportRoomMaps(getExtConfig)),

        // A map editor is a workspace, not a read-out: it opens in the active
        // column with the whole editor area, on the Rooms tab, already in edit
        // mode with a blank room drafted. The panel itself is the radar's, so
        // this sets the three things that differ and delegates.
        //
        // The radar needs a document to detect a scope from. A new map does
        // not care which one — its content comes from the ROM — so an empty
        // in-memory document stands in when nothing is open, rather than
        // refusing to open the editor because no .evs file happens to be up.
        vscode.commands.registerCommand('everscript.newMap', async () => {
            _radarColumn = vscode.ViewColumn.Active;
            _radarActiveTab = 'rooms';
            _radarPendingNewMap = true;
            let doc = vscode.window.activeTextEditor?.document;
            if (!doc) {
                try {
                    doc = await vscode.workspace.openTextDocument({ content: '', language: 'everscript' });
                } catch {
                    vscode.window.showWarningMessage('Could not open a scratch document for the map editor.');
                    return;
                }
            }
            await vscode.commands.executeCommand('everscript.openMemoryRadar', doc, 0);
        }),
    );

    context.subscriptions.push(vscode.workspace.onDidChangeConfiguration((event) => {
        if (!event.affectsConfiguration('everscript')) return;
        invalidateRoomCaches();
        invalidateRadarMap();
        if (event.affectsConfiguration('everscript.repoPath')) syncDerivedSettingsFromRepoPath().catch(() => {});
    }));

    require('./language/build-and-run').registerBuildAndRun(context, { getExtConfig, openEmulatorPanel });
}


module.exports = { activate };
