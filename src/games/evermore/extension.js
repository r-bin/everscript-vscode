'use strict';

const vscode = require('vscode');
const { getRepoAutofillUpdates } = require('../../../dist/games/evermore/language/config');
const lp = require('./language/language-providers');
const { buildVanillaRoomDetails, buildRoomTree, setRoomImageUris } = require('./rooms');
const romReaders = require('../../../dist/games/evermore/rom-readers');
const roms = require('../../../dist/core/roms/host');
const gameViews = require('../../../dist/core/game-views');
const platform = require('../../../dist/platform');
const { renderRadarHtml } = require('./memory/render-radar');
const { radarDetectScope, radarAnalyzeScope } = require('./memory/scope-analysis');
const { radar, getRadarMap, invalidateRadarMap, getRadarEnums, invalidateRadarEnums, invalidateRoomCaches, getSpritesBundle, getExtConfig, radarItemIcons, refreshRadar, RadarCodeLensProvider, radarImportedRooms } = require('./radar-panel');
const { openMemoryRadar } = require('./radar-open');

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

function activate(context) {
    radar.context = context;
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
        vscode.commands.registerCommand('everscript.openMemoryRadar', openMemoryRadar),

        // Auto-update radar when active editor changes
        vscode.window.onDidChangeActiveTextEditor(ed => {
            clearTimeout(radar.updateTimer);
            radar.updateTimer = setTimeout(() => refreshRadar(ed), 400);
        }),

        // Auto-update radar when cursor moves to a different scope
        vscode.window.onDidChangeTextEditorSelection(e => {
            if (radar.pinned) return;
            clearTimeout(radar.updateTimer);
            radar.updateTimer = setTimeout(() => refreshRadar(e.textEditor), 600);
        }),

    );

    // ── Debugger: .evs scripts in the emulator (src/games/evermore/debugger/README.md) ────
    const emulatorPanel = require('../../core/emulator/panel');
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
    radar.manaRooms = require('./imports/mana').createManaRooms({
        soeRom: () => romReaders.loadRomBuffer(vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? null, ''),
        manaRom: () => {
            const entry = platform.romFor('mana');
            const file = entry && platform.readRomFile(entry.path);
            return file ? platform.stripCopierHeader(file) : null;
        },
    });

    /** Re-render the open radar for the current document (Switch ROM to another Evermore ROM). */
    function refreshRadarForRom() {
        if (!radar.panel || !radar.doc) return;
        try {
            const wsRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? null;
            const scope = radarDetectScope(radar.doc, 0);
            const { refs, pools, argRefs } = radarAnalyzeScope(radar.doc, scope.startLine, scope.endLine);
            const mapByAddr = getRadarMap();
            radar.roomTree = buildRoomTree(radar.doc, wsRoot, getExtConfig());
            radar.roomDocPath = radar.doc.uri.fsPath;
            setRoomImageUris(radar.roomTree, p => radar.panel.webview.asWebviewUri(vscode.Uri.file(p)).toString());
            const vrd = buildVanillaRoomDetails(wsRoot, '');
            const romBuf = romReaders.loadRomBuffer(wsRoot, '');
            const spBundle = getSpritesBundle(romBuf);
            radar.panel.webview.html = renderRadarHtml(scope, refs, pools, argRefs, mapByAddr, radar.roomTree, radar.activeTab, null, radar.scalingChars || [], radar.scaleActive, radarItemIcons(), radar.hitLookup, getRadarEnums(), vrd, radar.byteScriptFocus, spBundle, radarImportedRooms());
        } catch (_) {}
    }

    context.subscriptions.push(
        roms.onDidChangeRoms(() => {
            romReaders.invalidateRomBuffer();
            radar.manaRooms.clear();
            radar.scalingChars = null;
            radar.hitLookup = null;
            radar.roomTree = null;
            radar.roomDocPath = null;
        }),
        // The Memory Radar is Evermore's main view (core/game-views.ts swaps it on Switch ROM).
        gameViews.registerGameView('evermore', {
            open: () => vscode.commands.executeCommand('everscript.openMemoryRadar'),
            panel: () => radar.panel,
            refresh: refreshRadarForRom,
        }),
    );

    // ── Emulator Panel ───────────────────────────────────────────────────────
    const { openEmulatorPanel } = require('../../core/emulator/panel');
    // The full profile: every tab, and the CDL tab's exports and lookups.
    require('../../core/emulator/panel').configureEmulator({ profile: 'full', cdlTools: require('./cdl/tools'), game: require('./emulator/host') });
    // The emulator's sound chip, frame by frame, to the radar's Music tab.
    require('../../core/emulator/panel').apuStream.setListener(f => {
        if (radar.panel) radar.panel.webview.postMessage({ command: 'musicFrame', view: f.view, pkg: f.pkg, starts: f.starts, drv: f.drv, src: f.src, frame: f.frame, paused: !!f.paused });
    });

    // Sound-effect names for the emulator's marks (the Music model's, by driver id).
    require('../../core/emulator/panel').apuStream.setNames(() => {
        const _ws = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? null;
        return require('./music').sfxNames(() => romReaders.loadRomBuffer(_ws, ''));
    });
    require('../../core/emulator/panel').apuStream.setOnPause(paused => {
        if (radar.panel) radar.panel.webview.postMessage({ command: 'musicPaused', paused });
    });
    require('../../core/emulator/panel').apuStream.setOnClose(() => {
        if (radar.panel) radar.panel.webview.postMessage({ command: 'musicEmulator', open: false });
    });
    context.subscriptions.push(
        vscode.commands.registerCommand('everscript.openEmulator', () => {
            openEmulatorPanel(context);
        }),
        // A SNES CDL Recorder's zip (CDL library + replays) merged into this install's.
        vscode.commands.registerCommand('everscript.importRecordingBundle', () =>
            require('../../core/emulator/bundle-commands').importRecordingBundle(context)
                .catch(err => vscode.window.showErrorMessage('Import failed: ' + err.message))),
        vscode.commands.registerCommand('everscript._scriptFocus', (payload) => {
            radar.byteScriptFocus = String(payload?.address || '').toUpperCase();
            if (radar.panel) {
                radar.panel.webview.postMessage({
                    command: 'byteScriptFocus',
                    address: radar.byteScriptFocus,
                    slot: typeof payload?.slot === 'number' ? payload.slot : null,
                    state: payload?.state || '',
                });
            }
        }),
        vscode.commands.registerCommand('everscript._triggerExecuted', (lookup) => {
            if (radar.panel && lookup) {
                radar.panel.webview.postMessage({
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
            radar.column = vscode.ViewColumn.Active;
            radar.activeTab = 'rooms';
            radar.pendingNewMap = true;
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
