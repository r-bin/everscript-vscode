'use strict';
// Ownership: the everscript.openMemoryRadar command — the radar for the scope at the cursor: build or
// reuse the panel, render it, and route every message the page sends to the feature that owns it.
// State and helpers: radar-panel.js.

const vscode = require('vscode');
const path   = require('path');
const fs     = require('fs');
const { VANILLA_ROOMS, buildVanillaRoomDetails, buildRoomTree, setRoomImageUris, handlesCustomMapMessage, handleCustomMapMessage } = require('./rooms');
const { handlesRomMessage, handleRomMessage } = require('./rom');
const { handlesMusicMessage, handleMusicMessage } = require('./music');
const { handlesScriptsMessage, handleScriptsMessage } = require('../../../dist/games/evermore/scripts-tab');
const { handlesEditorMessage, handleEditorMessage } = require('./rooms/editor-host');
const { handlesSpritesMessage, handleSpritesMessage } = require('../../../dist/games/evermore/sprites/radar-host');
const romReaders = require('../../../dist/games/evermore/rom-readers');
const gameViews = require('../../../dist/core/game-views');
const { readRomCharacters, readRomHitLookup, detectScaleEnemies } = require('../../../dist/games/evermore/rom-readers');
const { renderRadarHtml } = require('./memory/render-radar');
const { renderAnimation } = require('../../../dist/games/evermore/sprites');
const { radarDetectScope, radarAnalyzeScope } = require('../../../dist/games/evermore/memory/scope-analysis');
const { radar, getMapExportChannel, getRadarMap, getRadarEnums, getSpritesBundle, getExtConfig, radarItemIcons, refreshRadar, ROOMS_UI_PREFS_KEY, radarImportedRooms, radarRoomRom } = require('./radar-panel');

/** The Memory Radar for the scope at the cursor (or doc/startLine from a CodeLens): builds or reuses the panel and answers its messages. */
async function openMemoryRadar(doc, startLine) {
    const context = radar.context;
    // Another game's ROM opens that game's view (multi-game.md §6: one command, any game).
    if (gameViews.openSelectedGameView(undefined, 'evermore')) return;
    const editor   = vscode.window.activeTextEditor;
    const document = (doc && typeof doc.lineCount === 'number') ? doc : editor?.document;
    if (!document) {
        vscode.window.showWarningMessage('No active Everscript file.');
        return;
    }
    const cursorLine   = typeof startLine === 'number' ? startLine : (editor?.selection.active.line ?? 0);
    radar.doc          = document;
    const scope        = radarDetectScope(document, cursorLine);
    radar.currentScope = scope;
    const { refs, pools, argRefs } = radarAnalyzeScope(document, scope.startLine, scope.endLine);
    const mapByAddr    = getRadarMap();
    const wsRoot       = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? null;
    const wsRootUri    = wsRoot ? vscode.Uri.file(wsRoot) : null;

    // Load character data for Scaling tab (ROM read is cached; scale detection is per-document)
    if (!radar.scalingChars) {
        radar.scalingChars = readRomCharacters(wsRoot);
        radar.hitLookup    = readRomHitLookup(wsRoot, radar.scalingChars);
    }
    radar.scaleActive = detectScaleEnemies(wsRoot, document.uri.fsPath);

    // Reuse existing panel if open; otherwise create a new one
    if (!radar.panel) {
        radar.panel = vscode.window.createWebviewPanel(
            'everscriptRadar',
            'Radar: ' + scope.name,
            radar.column,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [wsRootUri].filter(Boolean),
            },
        );
        radar.panel.onDidDispose(() => {
            require('../../core/emulator/panel').apuStream.setOn(false);
            radar.panel = null;
            radar.pinned = false;
            radar.currentScope = null;
            radar.roomTree = null;
            radar.roomDocPath = null;
            radar.activeTab = 'radar';
            radar.byteScriptFocus = '';
        }, null, context.subscriptions);
    } else {
        radar.panel.title = 'Radar: ' + scope.name;
        radar.panel.reveal(radar.column, true);
    }

    // Build or reuse room tree (rebuild when document changes)
    if (radar.roomDocPath !== document.uri.fsPath) {
        radar.roomTree    = buildRoomTree(document, wsRoot, getExtConfig());
        radar.roomDocPath = document.uri.fsPath;
        setRoomImageUris(radar.roomTree, p => radar.panel.webview.asWebviewUri(vscode.Uri.file(p)).toString());
    }

    const selectedMap = scope.kind === 'map' ? scope.name : null;
    const _extCfg2 = getExtConfig();
    const _wsRoot2b = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? null;
    const _vrd2 = buildVanillaRoomDetails(_wsRoot2b, '');
    const _romBuf2 = romReaders.loadRomBuffer(_wsRoot2b, '');
    const _spBundle2 = getSpritesBundle(_romBuf2);
    radar.panel.webview.html = renderRadarHtml(scope, refs, pools, argRefs, mapByAddr, radar.roomTree, radar.activeTab, selectedMap, radar.scalingChars || [], radar.scaleActive, radarItemIcons(), radar.hitLookup, getRadarEnums(), _vrd2, radar.byteScriptFocus, _spBundle2, radarImportedRooms());

    // `everscript.newMap` asked for a blank room. The webview has just
    // been rebuilt, so this is the first moment it can be told.
    if (radar.pendingNewMap) {
        radar.pendingNewMap = false;
        radar.panel.webview.postMessage({ command: 'newMap' });
    }

    // Webview UI state that should outlive the panel — which tile
    // families are expanded, for one. The webview's own storage is
    // not it: its origin is new every time the panel is built.
    radar.panel.webview.postMessage({
        command: 'uiPrefs', prefs: context.globalState.get(ROOMS_UI_PREFS_KEY, {}),
    });

    // Handle messages from the webview. This block runs on every panel
    // refresh, and each registration used to stay alive — so after N
    // refreshes every request was answered N times (N blank rooms, N
    // save dialogs for Export ROM). One subscription per panel: the
    // previous one is disposed first. Kept on the panel it belongs to,
    // not in a module variable.
    if (radar.panel.__radarMessages) radar.panel.__radarMessages.dispose();
    radar.panel.__radarMessages = radar.panel.webview.onDidReceiveMessage(msg => {
        if (msg.command === 'goToLine') {
            const line = Math.max(0, Math.min(Number(msg.line), document.lineCount - 1));
            const pos  = new vscode.Position(line, 0);
            const range = new vscode.Range(pos, pos);
            const ed = vscode.window.visibleTextEditors.find(e => e.document === radar.doc)
                    || vscode.window.activeTextEditor;
            if (ed) {
                ed.selection = new vscode.Selection(pos, pos);
                ed.revealRange(range, vscode.TextEditorRevealType.InCenterIfOutsideViewport);
                vscode.window.showTextDocument(ed.document, ed.viewColumn);
            }
        } else if (msg.command === 'pin') {
            radar.pinned = true;
        } else if (msg.command === 'unpin') {
            radar.pinned = false;
        } else if (msg.command === 'tabChange') {
            radar.activeTab = msg.tab || 'radar';
        } else if (msg.command === 'saveUiPref' && typeof msg.key === 'string') {
            const prefs = { ...context.globalState.get(ROOMS_UI_PREFS_KEY, {}) };
            prefs[msg.key] = msg.value;
            context.globalState.update(ROOMS_UI_PREFS_KEY, prefs);
        } else if (handlesEditorMessage(msg.command)) {
            // The map editor (rooms/editor-host.js).
            handleEditorMessage(msg, {
                post: (m) => radar.panel?.webview.postMessage(m),
                roomRom: radarRoomRom,
                manaRooms: radar.manaRooms,
                exportChannel: getMapExportChannel,
                openEmulator: (rom) => require('../../core/emulator/panel').openEmulatorPanel(context, rom),
                context,
            });
        } else if (handlesCustomMapMessage(msg.command)) {
            // Custom maps on disk: list, save, delete, export
            // (rooms/custom-host.js, docs/map-format/custom-map-files.md).
            handleCustomMapMessage(msg, {
                vscode,
                root: path.join(context.globalStorageUri.fsPath, 'custom-maps'),
                widgetsFile: path.join(context.globalStorageUri.fsPath, 'widgets.json'),
                post: (m) => radar.panel?.webview.postMessage(m),
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
                post: (m) => radar.panel?.webview.postMessage(m),
                loadRom: () => romReaders.loadRomBuffer(_ws, ''),
                apu: require('../../core/emulator/panel').apuStream,
                describeSource: (rom, src) => require('../../../dist/games/evermore/resources/sound-source').describeSoundSource(rom, src),
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
                post: (m) => radar.panel?.webview.postMessage(m),
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
                post: (m) => radar.panel?.webview.postMessage(m),
                loadRom: () => romReaders.loadRomBuffer(_ws, ''),
                loadCdl: (rom) => {
                    const { CdlLibrary, romHash } = require('../../../dist/platform/cdl/library');
                    const root = path.join(context.globalStorageUri.fsPath, 'cdl-library');
                    return fs.existsSync(path.join(root, romHash(rom))) ? new CdlLibrary(root, rom) : null;
                },
                rooms: () => new Map(VANILLA_ROOMS.flatMap(a => a.rooms.map(r => [parseInt(r.id, 16), { name: r.name, area: a.area }]))),
            });
        } else if (msg.command === 'globalScope') {
            radar.pinned = true; // freeze auto-updates while in global view
            if (radar.doc) {
                const gscope = { kind: 'global', name: radar.doc.fileName.split(/[\/\\]/).pop(), startLine: 0, endLine: radar.doc.lineCount - 1 };
                const { refs, pools, argRefs } = radarAnalyzeScope(radar.doc, 0, radar.doc.lineCount - 1);
                radar.scaleActive = detectScaleEnemies(wsRoot, radar.doc.uri?.fsPath ?? null);
                const _extCfg3 = getExtConfig();
                const _wsRoot3 = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? null;
                const _vrd3 = buildVanillaRoomDetails(_wsRoot3, '');
                const _romBuf3 = romReaders.loadRomBuffer(_wsRoot3, '');
                const _spBundle3 = getSpritesBundle(_romBuf3);
                radar.panel.webview.html = renderRadarHtml(gscope, refs, pools, argRefs, getRadarMap(), radar.roomTree || [], radar.activeTab, null, radar.scalingChars || [], radar.scaleActive, radarItemIcons(), radar.hitLookup, getRadarEnums(), _vrd3, radar.byteScriptFocus, _spBundle3, radarImportedRooms());
                radar.panel.title = 'Radar: (global)';
            }
        } else if (msg.command === 'autoScope') {
            radar.pinned = false;
            refreshRadar(vscode.window.activeTextEditor);
        } else if (msg.command === 'moveEntity') {
            if (!radar.doc || typeof msg.line !== 'number' || msg.line < 0) return;
            const lineIdx = Math.min(Math.max(0, msg.line), radar.doc.lineCount - 1);
            const lineText = radar.doc.lineAt(lineIdx).text;
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
                edit.replace(radar.doc.uri, radar.doc.lineAt(lineIdx).range, newText);
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
                patchNode(radar.roomTree);
                if (radar.panel) setRoomImageUris(radar.roomTree, p => radar.panel.webview.asWebviewUri(vscode.Uri.file(p)).toString());
                refreshRadar(vscode.window.activeTextEditor);
            });
        } else if (handlesSpritesMessage(msg.command)) {
            // The Characters tab (sprites/radar-host.ts).
            handleSpritesMessage(msg, {
                post: (m) => radar.panel?.webview.postMessage(m),
                spritesBundle: getSpritesBundle,
            });
        }
    }, undefined, context.subscriptions);
}

module.exports = { openMemoryRadar };
