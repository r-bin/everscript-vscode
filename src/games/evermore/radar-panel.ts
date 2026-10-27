// Ownership: the Memory Radar's state (its panel, what it last showed, the ROM reads it caches) and the
// helpers around it — the memory map and enum caches, the sprites bundle, the configuration, the
// converted Mana rooms, the CodeLens and the debounced refresh. extension.js wires them; opening the
// panel and answering its messages is radar-open.js.

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { parseEnumsFromContent } from './radar-utils';
import { resolveExtConfig } from './language/config';
import { buildVanillaRoomDetails, buildItemIcons, invalidateRoomDataCaches, buildRoomTree, setRoomImageUris } from './rooms';
import * as romReaders from './rom-readers';
import * as platform from '../../platform';
import { detectScaleEnemies, readRomCharacters } from './rom-readers';
import { renderRadarHtml } from './memory/render-radar';
import { readAllCharacters, buildAnimationCatalog, characterThumbs, behaviourNames, attackProcNames } from './sprites';
import { radarReadMemoryMap, radarDetectScope, radarAnalyzeScope } from './memory/scope-analysis';
import type { createManaRooms } from './imports/mana';

type RadarMap = ReturnType<typeof radarReadMemoryMap>;
type RadarEnums = Parameters<typeof renderRadarHtml>[12];
type RadarScope = ReturnType<typeof radarDetectScope>;
type RoomTree = ReturnType<typeof buildRoomTree>;
type RomBuf = Uint8Array | null;
/** The Characters tab's data: every character with its thumbnails, the animation catalogue, the stat names. */
interface SpritesBundle {
    characters: (ReturnType<typeof readAllCharacters>[number] & { thumbs: ReturnType<typeof characterThumbs> })[];
    animations: ReturnType<typeof buildAnimationCatalog>;
    statNames: { behaviour: ReturnType<typeof behaviourNames>; attackProc: ReturnType<typeof attackProcNames> };
}

// ── Memory Radar ─────────────────────────────────────────────────────────────
// RAM lifecycles (temp / session / sram / system): radar-utils.ts radarLifecycle, from the
// compiler-region knowledge entries.

// Note: _loot_chest/_loot/loot/retained_object are dynamically allocated from the
// compiler memory pool — addresses cannot be statically inferred from call sites.

/** The Memory Radar's state: its panel, what it last showed, and the ROM reads it caches. */
interface RadarState {
    context: vscode.ExtensionContext | null;
    panel: (vscode.WebviewPanel & { __radarMessages?: vscode.Disposable }) | null;
    pinned: boolean;
    doc: vscode.TextDocument | null;
    currentScope: RadarScope | null;
    mapCache: RadarMap | null;
    enumCache: RadarEnums | null;
    updateTimer: ReturnType<typeof setTimeout> | null;
    roomTree: RoomTree | null;
    roomDocPath: string | null;
    activeTab: string;
    column: vscode.ViewColumn;
    pendingNewMap: boolean;
    scalingChars: ReturnType<typeof readRomCharacters> | null;
    hitLookup: object | null;
    scaleActive: boolean;
    byteScriptFocus: string;
    spritesBundle: SpritesBundle | null;
    mapExportChannel: vscode.OutputChannel | null;
    manaRooms: ReturnType<typeof createManaRooms> | null;
}

const radar: RadarState = {
    context: null,          // the extension context (set in activate)
    panel: null,            // active radar webview panel
    pinned: false,          // when true, radar ignores editor/scope changes
    doc: null,              // document the radar was last rendered for
    currentScope: null,     // scope the radar was last rendered for
    mapCache: null,         // cached parsed memory-map.md
    enumCache: null,        // cached enum cross-reference (addr→[{cls,name}])
    updateTimer: null,      // debounce timer for auto-update
    roomTree: null,         // cached room tree (rebuilt when doc changes)
    roomDocPath: null,      // fsPath the room tree was built for
    activeTab: 'radar',     // preserved tab across re-renders
    // Which editor column the panel opens in. `Beside` is right for a radar you
    // read next to the code; the map editor is a workspace of its own and asks
    // for `Active`, which gives it the whole editor area.
    column: vscode.ViewColumn.Beside,
    pendingNewMap: false,   // draft a blank room as soon as the webview is up
    scalingChars: null,     // cached character stat array (142 entries from ROM)
    hitLookup: null,        // precomputed hit% table {hit_rate:{evade:pct}} from ROM
    scaleActive: false,     // whether scale_enemies is active in workspace
    byteScriptFocus: '',    // currently focused byte-script address from emulator panel
    spritesBundle: null,    // cached sprites bundle {characters, animations, statNames}
    mapExportChannel: null, // output channel for ROM build and compilation logs
    // Secret of Mana maps as Evermore rooms (imports/mana): the Rooms tab lists them under the vanilla
    // rooms when a Mana ROM is found beside the Evermore one. Set in activate(), where the Mana ROM
    // accessor is made.
    manaRooms: null,
};

function getMapExportChannel() {
    if (!radar.mapExportChannel) {
        radar.mapExportChannel = vscode.window.createOutputChannel('Everscript ROM Builder', 'everscript-trace');
    }
    return radar.mapExportChannel;
}

function getRadarMap() {
    if (radar.mapCache) return radar.mapCache;
    const wf = vscode.workspace.workspaceFolders?.[0];
    if (!wf) return new Map();
    radar.mapCache = radarReadMemoryMap(path.join(wf.uri.fsPath, '.github', 'memory-map.md'));
    return radar.mapCache;
}

function invalidateRadarMap() { radar.mapCache = null; }

/** Parse core evs files for enum entries mapping <0xNNNN> addresses to enum names.
 *  Returns Map<addr, [{cls, name}]> — cls is the enum class name, name is the member. */
function radarReadEnums(wsFolder: string): RadarEnums {
    const cache: RadarEnums = new Map();
    const coreDir = path.join(wsFolder, 'in', 'core');
    if (!fs.existsSync(coreDir)) return cache;
    const scanContent = (content: string): void => {
        for (const [addr, entries] of parseEnumsFromContent(content)) {
            if (!cache.has(addr)) cache.set(addr, []);
            for (const e of entries) cache.get(addr)!.push(e);
        }
    };
    const scanDir = (dir: string): void => {
        let entries: string[];
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
    if (radar.enumCache) return radar.enumCache;
    const wf = vscode.workspace.workspaceFolders?.[0];
    if (!wf) return new Map();
    radar.enumCache = radarReadEnums(wf.uri.fsPath);
    return radar.enumCache;
}

function invalidateRadarEnums() { radar.enumCache = null; }

function invalidateRoomCaches() {
    radar.roomTree = null;
    radar.roomDocPath = null;
    radar.spritesBundle = null;
    invalidateRoomDataCaches();
}

function getSpritesBundle(rom: RomBuf): SpritesBundle {
    if (radar.spritesBundle) return radar.spritesBundle;
    if (!rom) return { characters: [], animations: [], statNames: { behaviour: behaviourNames(), attackProc: attackProcNames() } };
    const characters = readAllCharacters(rom).map(c => ({ ...c, thumbs: characterThumbs(rom, c) }));
    radar.spritesBundle = {
        characters,
        animations: buildAnimationCatalog(rom, characters),
        statNames: { behaviour: behaviourNames(), attackProc: attackProcNames() },
    };
    return radar.spritesBundle;
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

/** The ring menu's item icons from the configured ROM, for the radar page (rooms/data/item-icons.ts). */
function radarItemIcons() {
    const ws = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? null;
    return buildItemIcons(romReaders.loadRomBuffer(ws, ''));
}

function refreshRadar(editor: vscode.TextEditor | undefined): void {
    if (!radar.panel || radar.pinned) return;
    if (!editor || editor.document.languageId !== 'everscript') return;
    const doc   = editor.document;
    const line  = editor.selection?.active?.line ?? 0;
    const scope = radarDetectScope(doc, line);
    if (radar.currentScope && radar.doc === doc &&
        scope.name === radar.currentScope.name && scope.kind === radar.currentScope.kind) return;
    radar.currentScope = scope;
    radar.doc = doc;
    const { refs, pools, argRefs } = radarAnalyzeScope(doc, scope.startLine, scope.endLine);
    const mapByAddr = getRadarMap();
    const wsRoot2 = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? null;
    if (radar.roomDocPath !== doc.uri.fsPath) {
        radar.roomTree    = buildRoomTree(doc, wsRoot2, getExtConfig());
        radar.roomDocPath = doc.uri.fsPath;
        if (radar.panel) setRoomImageUris(radar.roomTree, (p: string) => radar.panel!.webview.asWebviewUri(vscode.Uri.file(p)).toString());
    }
    radar.scaleActive = detectScaleEnemies(wsRoot2, doc.uri.fsPath);
    const selectedMap = scope.kind === 'map' ? scope.name : null;
    const _extCfg1 = getExtConfig();
    const _wsRoot1 = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? null;
    const _vrd1 = buildVanillaRoomDetails(_wsRoot1, '');
    const _romBuf1 = romReaders.loadRomBuffer(_wsRoot1, '');
    const _spBundle1 = getSpritesBundle(_romBuf1);
    radar.panel.webview.html = renderRadarHtml(scope, refs, pools, argRefs, mapByAddr, radar.roomTree || [], radar.activeTab, selectedMap, radar.scalingChars || [], radar.scaleActive, radarItemIcons(), radar.hitLookup, getRadarEnums(), _vrd1, radar.byteScriptFocus, _spBundle1, radarImportedRooms());
    radar.panel.title = 'Radar: ' + scope.name;
}

// ── Radar CodeLens provider ───────────────────────────────────────────────────
class RadarCodeLensProvider {
    provideCodeLenses(document: vscode.TextDocument): vscode.CodeLens[] {
        if (document.languageId !== 'everscript') return [];
        const declRe = /^\s*(fun|map|area|group)\s+([A-Za-z_][A-Za-z0-9_]*)\b/;
        const lenses: vscode.CodeLens[] = [];
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

/** The rail groups of converted rooms, [] when there are none. */
function radarImportedRooms() {
    try {
        const areas = radar.manaRooms ? radar.manaRooms.railGroups() : [];
        return areas.length ? [{ key: 'mana', label: 'Secret of Mana', areas,
            title: 'Secret of Mana maps converted to Evermore rooms: tiles, families, collision, step-on events' }] : [];
    } catch { return []; }
}

/**
 * The ROM and room id that answer a Rooms-tab request about `roomId`: the Evermore
 * ROM for a ROM room (0..0x7E), a converted room's own image otherwise. Null when
 * neither applies (`error` says why).
 */
function radarRoomRom(roomId: unknown) {
    const id = Number(roomId);
    if (Number.isInteger(id) && id >= 0 && id <= 0x7e) {
        const ws = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? null;
        const romBuf = romReaders.loadRomBuffer(ws, '');
        return romBuf ? { romBuf, roomId: id } : { error: platform.missingRomText('evermore') };
    }
    const hit = radar.manaRooms && radar.manaRooms.resolveRoom(id);
    return hit ? { romBuf: hit.rom, roomId: hit.roomId } : { error: 'invalid room id' };
}

export type { SpritesBundle };
export { radar, getMapExportChannel, getRadarMap, invalidateRadarMap, getRadarEnums, invalidateRadarEnums, invalidateRoomCaches, getSpritesBundle, getExtConfig, radarItemIcons, refreshRadar, RadarCodeLensProvider, ROOMS_UI_PREFS_KEY, radarImportedRooms, radarRoomRom };
