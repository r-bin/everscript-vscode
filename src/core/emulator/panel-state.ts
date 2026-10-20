// Ownership: the emulator panel's state (the panel, the ROM it runs, its timers, the CDL / REPLAYS / script
// debugger / APU / memory hosts) and the helpers that act on it: saved settings, status to the page,
// load timeouts, sending a ROM, rebuilding the page, the ROM offer. panel.js opens the panel and is the API;
// panel-messages.js answers the page.

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { buildHtml } from './panel-webview';
import { ScriptDebugHost } from './script-debug-host';
import { resolveCore } from './core-path';
import { describeFile as _describeFile, log as _log } from './emulator-log';
import { MemoryBridge } from './memory-bridge';
import { ApuStream } from './apu-stream';
import { getRomOfferData, recordRomUsage, loadPersistentSram, getStorageDir } from './rom-history';
import * as platform from '../../platform';
import type { CdlHost, CdlTools } from './cdl/host';
import type { TasHost } from './tas/host';

/** One formatted script-trace line (the game decides the rest of the fields). */
interface TraceEntry {
    timeStr?: string; frame?: unknown; slot?: unknown; entity?: unknown; event?: string; locHex?: unknown; summary?: unknown; line?: unknown;
    lookup?: { shortTag?: string; room?: unknown; kind?: unknown } | null; [key: string]: unknown;
}

/** The game half of the host side (games/evermore/emulator/host.ts); the panel does not know which game it is. */
interface GameHost {
    romData?(rom: Uint8Array | null | undefined): unknown;
    webview?(): Record<string, string>;
    webviewFiles?(): string[];
    roomMap(rom: Uint8Array | null | undefined, mapId: unknown, objectStates: unknown, cutGrassTiles: unknown, layered: unknown, log: (line: string) => void): object | null | undefined;
    idleSprites(rom: Uint8Array | null | undefined, keys: unknown): unknown;
    traceScripts(items: any, rom: Uint8Array | null | undefined, wsRoot: string | null, draft: any): TraceEntry[];
    describeRom: any;
    clearCaches(): void;
}
/** What the hosting extension configures (see the field notes on `emu.options`). */
interface EmuOptions {
    profile: string; title: string; cdlTools: CdlTools | null; game: GameHost | null; onExportBundle: (() => void) | null; reopenLastRom: boolean;
}
interface EmuState {
    context: vscode.ExtensionContext | null; panel: vscode.WebviewPanel | null; pending: { dataUrl: string; name: string } | null;
    currentRomBuffer: Uint8Array | null; currentRomName: string; activeDraft: unknown; extensionPath: string;
    readyTimeout: ReturnType<typeof setTimeout> | null; romTimeout: ReturnType<typeof setTimeout> | null; webviewReady: boolean;
    cdl: CdlHost | null; tas: TasHost | null; options: EmuOptions; reopenTried: boolean;
    sessionProfile: string | null; sessionTitle: string | null;
    sessionCore: 'fork' | 'vanilla' | null; sessionPreset: string | null; sessionSramMode: 'default' | 'individual'; sessionIsolatedSram: boolean;
    sessionAlwaysRecord: boolean;
    loadedCore: 'fork' | 'vanilla' | null;
}

/** The panel's state: the panel itself, the ROM it runs, the timers and hosts that live with it. */
const emu: EmuState = {
    context: null,          // VS Code extension context
    panel: null,            // active WebviewPanel
    pending: null,          // { dataUrl, name } waiting to load
    currentRomBuffer: null, // raw ROM buffer for bytecode disassembly
    currentRomName: '',     // name of the ROM the game started from
    activeDraft: null,      // custom draft object for trigger/address lookup
    extensionPath: '',
    readyTimeout: null,
    romTimeout: null,
    webviewReady: false,
    cdl: null,              // CdlHost: per-ROM code/data log library
    tas: null,              // TasHost: input recordings and replays
    sessionProfile: null,   // profile override for the current open panel
    sessionTitle: null,     // title override for the current open panel
    sessionCore: null,      // in-session core selection ('fork' | 'vanilla')
    sessionPreset: null,    // in-session preset ('default' | 'everscript' | 'cdl' | 'clean')
    sessionSramMode: 'default', // in-session SRAM mode ('default' | 'individual')
    sessionIsolatedSram: false, // in-session isolated SRAM toggle (legacy)
    sessionAlwaysRecord: true,  // in-session always record toggle (default on)
    loadedCore: null,       // the core build currently loaded in the webview
    /**
     * What the extension that hosts the panel wants (configureEmulator):
     *   profile        'full' (Everscript) or 'recorder' (SNES CDL Recorder: CDL and REPLAYS only)
     *   title          the panel's title
     *   cdlTools       exports and lookups for the CDL tab (games/evermore/cdl/tools.ts); none in the recorder
     *   game           the game half of the host side: room pictures, idle sprites, icons, script trace
     *                  (games/evermore/emulator/host.ts); none in the recorder
     *   onExportBundle the CDL tab's "export bundle" button (recorder)
     *   reopenLastRom  a panel opened without a ROM loads the most recent one that still exists (recorder)
     */
    options: { profile: 'full', title: 'Everscript Emulator', cdlTools: null, game: null, onExportBundle: null, reopenLastRom: false },
    reopenTried: false,     // per panel: the last ROM is reopened once, on the first ready
};
// VS Code script debugger hook: outlives the panel (a session can attach first).
const _scriptDebug = new ScriptDebugHost(m => { if (emu.panel) emu.panel.webview.postMessage(m); }, line => _log(line),
  () => _keepFocusAfterBreak());
// soe://ram/ reads: request/reply with the webview, which owns the core.
const _apu = new ApuStream(m => !!(emu.panel && emu.webviewReady && emu.panel.webview.postMessage(m) !== undefined));
const _memory = new MemoryBridge(m => !!(emu.panel && emu.webviewReady && emu.panel.webview.postMessage(m) !== undefined));
// KEEP FOCUS (pause menu, EMULATION): Tab stays in the emulator and a debugger stop
// leaves the focus on it (globalState).
const KEEP_FOCUS_KEY = 'everscript.emulator.keepFocusOnBreak';
const KEEP_FOCUS_MS = 2000;
// The webview's settings (overlays, mute, keybinds): saved by the page, sent back on open.
const SETTINGS_KEY = 'everscript.emulator.settings';
// Whether CDL recording was on when last switched.
const CDL_WANTED_KEY = 'everscript.emulator.cdlWanted';
const ALWAYS_RECORD_KEY = 'everscript.emulator.alwaysRecord';

function _state(key: string, fallback: unknown) {
  return emu.context && emu.context.globalState ? emu.context.globalState.get(key, fallback) : fallback;
}

function _saveState(key: string, value: unknown) {
  if (emu.context && emu.context.globalState) emu.context.globalState.update(key, value);
}

function _keepFocusSetting() {
  return !!(emu.context && emu.context.globalState && emu.context.globalState.get(KEEP_FOCUS_KEY, false));
}

/**
 * VS Code focuses the stopped line's editor a moment after the stop: take the
 * focus back then, and whenever the active editor changes shortly after.
 */
function _keepFocusAfterBreak() {
  if (!emu.panel || !_keepFocusSetting()) return;
  const until = Date.now() + KEEP_FOCUS_MS;
  const refocus = () => {
    if (!emu.panel || Date.now() > until) return;
    emu.panel.reveal(emu.panel.viewColumn, false);
    emu.panel.webview.postMessage({ command: 'focusScreen' });
  };
  setTimeout(refocus, 150);
  const watch = vscode.window.onDidChangeActiveTextEditor(() => setTimeout(refocus, 0));
  setTimeout(() => watch.dispose(), KEEP_FOCUS_MS);
}

function _notifyWebviewStatus(level: string, text: string) {
  if (!emu.panel) return;
  try {
    emu.panel.webview.postMessage({ command: 'hostStatus', level, text });
  } catch (_) {
    // Best-effort status propagation only.
  }
}

function _estimateDataUrlBytes(dataUrl: unknown) {
  if (typeof dataUrl !== 'string') return 0;
  const comma = dataUrl.indexOf(',');
  const b64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
  return Math.floor((b64.length * 3) / 4);
}

function _clearReadyTimeout() {
  if (emu.readyTimeout) {
    clearTimeout(emu.readyTimeout);
    emu.readyTimeout = null;
  }
}

function _clearRomTimeout() {
  if (emu.romTimeout) {
    clearTimeout(emu.romTimeout);
    emu.romTimeout = null;
  }
}

function _armReadyTimeout() {
  _clearReadyTimeout();
  emu.readyTimeout = setTimeout(() => {
    const pending = emu.pending ? ` (pending ROM: ${emu.pending.name || 'game'})` : '';
    const msg = 'Timeout waiting for webview ready message' + pending;
    _log(msg, true);
    _notifyWebviewStatus('error', msg + '. Open Webview Developer Tools to inspect script/wasm load errors.');
  }, 30000);
}

function _armRomTimeout(romName: string) {
  _clearRomTimeout();
  emu.romTimeout = setTimeout(() => {
    const msg = `Timeout waiting for ROM launch result: ${romName}`;
    _log(msg, true);
    _notifyWebviewStatus('error', msg);
  }, 15000);
}

function _dispatchPendingRom() {
  if (!emu.pending || !emu.panel) return false;
  const desiredCore: 'fork' | 'vanilla' = emu.sessionCore === 'vanilla' ? 'vanilla' : 'fork';
  if (emu.loadedCore && emu.loadedCore !== desiredCore) {
    _resetPanelHtml();
    return true;
  }
  if (!emu.webviewReady) return true;
  const romName = emu.pending.name || 'game';
  _log(`Sending ROM to webview: ${romName}`);
  _armRomTimeout(romName);
  const gameData = emu.options.game && emu.options.game.romData ? emu.options.game.romData(emu.currentRomBuffer) : null;

  let sramData: string | null = null;
  let romSha1 = '';
  if (emu.currentRomBuffer) {
    const clean = (emu.currentRomBuffer.length % 1024 === 512) ? emu.currentRomBuffer.subarray(512) : emu.currentRomBuffer;
    romSha1 = require('crypto').createHash('sha1').update(clean).digest('hex').toLowerCase();
    const isCdl = emu.sessionPreset === 'cdl';
    const effectiveSramMode = isCdl ? 'individual' : (emu.sessionSramMode || (emu.sessionIsolatedSram ? 'individual' : 'default'));
    if (effectiveSramMode === 'default') {
      const storageDir = getStorageDir(emu.context);
      sramData = loadPersistentSram(storageDir, romSha1);
    }
  }

  const isCdlLaunch = emu.sessionPreset === 'cdl';
  const effectiveSramMode = isCdlLaunch ? 'individual' : (emu.sessionSramMode || (emu.sessionIsolatedSram ? 'individual' : 'default'));

  emu.panel.webview.postMessage({
    command: 'loadRom',
    dataUrl: emu.pending.dataUrl,
    name: emu.pending.name,
    gameData,
    scriptDebug: _scriptDebug.beforeRomLoad(),
    romSha1,
    sramData,
    sramMode: effectiveSramMode,
    isolatedSram: effectiveSramMode === 'individual',
    alwaysRecord: isCdlLaunch ? true : emu.sessionAlwaysRecord !== false,
    preset: emu.sessionPreset || 'default',
  });
  return true;
}

function _resetPanelHtml() {
    if (!emu.panel || !emu.extensionPath) return;
  emu.webviewReady = false;
    const core = resolveCore(emu.extensionPath, emu.sessionCore);
    if (!core.path) {
    if (core.warning) _log(core.warning, true);
    if (core.warning) _notifyWebviewStatus('error', core.warning);
        return;
    }
    emu.loadedCore = (emu.sessionCore === 'vanilla' ? 'vanilla' : 'fork');
    _log(`Core selected (${core.source || 'unknown'}): JS ${_describeFile(core.path)}; WASM ${_describeFile(core.wasmPath)}`);
    const coreJsUri   = emu.panel.webview.asWebviewUri(vscode.Uri.file(core.path)).toString();
    const coreWasmUri = emu.panel.webview.asWebviewUri(vscode.Uri.file(core.wasmPath)).toString();
    _log(`Core webview URIs: js=${coreJsUri} wasm=${coreWasmUri}`);
    const wsRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? null;
    const activeGame = emu.options.game ? (platform.selectedRom()?.game || 'evermore') : null;
    // The vanilla ROM comes from the ROM library (src/core/roms).
    const romOfferData = getRomOfferData(emu.context, wsRoot, '', activeGame);
    const panel = emu.panel;
    const file = (name: string) => panel.webview.asWebviewUri(vscode.Uri.file(path.join(emu.extensionPath, 'src', 'core', 'emulator', 'webview', name))).toString();
    const isRecorder = (emu.sessionProfile || emu.options.profile) === 'recorder';
    const html = buildHtml(emu.panel.webview, coreJsUri, coreWasmUri, core.label, core.path, romOfferData, {
      profile: isRecorder ? 'recorder' : 'full',
      gameView: emu.options.game && emu.options.game.webview ? emu.options.game.webview() : null,
      styles: [file('emulator-profile.css'), file('emulator-panels.css')],
      // The game's page files first (Evermore: its ROM detector), then the emulator's.
      scripts: (emu.options.game && emu.options.game.webviewFiles ? emu.options.game.webviewFiles() : [])
        .map((f) => panel.webview.asWebviewUri(vscode.Uri.file(f)).toString())
        .concat([file('emulator-profile.js'), file('emulator-panels.js'), file('replays-list.js')]),
    });
    // Log a snippet to help diagnose CSP / script-load issues.
    _log('HTML head snippet: ' + html.substring(0, 220).replace(/\s+/g, ' '));
    emu.panel.webview.html = html;
  _armReadyTimeout();
}

function _broadcastRomOffer() {
  if (!emu.panel) return;
  try {
    const wsRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? null;
    const activeGame = emu.options.game ? (platform.selectedRom()?.game || 'evermore') : null;
    // The vanilla ROM comes from the ROM library (src/core/roms).
    const romOfferData: any = getRomOfferData(emu.context, wsRoot, '', activeGame);
    if (romOfferData) {
      const isCdl = emu.sessionPreset === 'cdl';
      const effectiveSramMode = isCdl ? 'individual' : (emu.sessionSramMode || (emu.sessionIsolatedSram ? 'individual' : 'default'));
      romOfferData.sessionSettings = {
        core: emu.sessionCore || 'fork',
        preset: emu.sessionPreset || 'default',
        sramMode: effectiveSramMode,
        isolatedSram: effectiveSramMode === 'individual',
        alwaysRecord: isCdl ? true : emu.sessionAlwaysRecord !== false,
      };
    }
    emu.panel.webview.postMessage({ command: 'romOfferInfo', data: romOfferData });
  } catch (_) {}
}

/** reopenLastRom: the newest recent ROM file that still exists, once per panel. */
function _reopenLastRom() {
  if (!emu.options.reopenLastRom || emu.reopenTried || emu.pending || emu.currentRomBuffer) return;
  emu.reopenTried = true;
  try {
    const offer = getRomOfferData(emu.context, null, '');
    const last = (offer.recent || []).find(r => r.exists && r.path && !r.isCustomMap);
    if (last) {
      _log(`Reopening the last ROM: ${last.path}`);
      _sendRomFile(last.path);
    }
  } catch (err) {
    _log('Could not reopen the last ROM: ' + (err instanceof Error ? err.message : err));
  }
}

/** Read a ROM file from disk and send it to the open webview. */
function _sendRomFile(romPath: string) {
    const romName = path.basename(romPath);
    try {
        const romData = fs.readFileSync(romPath);
        emu.currentRomBuffer = new Uint8Array(romData);
        const dataUrl = 'data:application/octet-stream;base64,' + romData.toString('base64');
        emu.pending = { dataUrl, name: romName };
        recordRomUsage({ path: romPath, name: romName, kind: 'file' }, emu.context);
        _broadcastRomOffer();
    if (!_dispatchPendingRom()) _resetPanelHtml();
    } catch (e) {
    const why = e instanceof Error ? e.message : String(e);
    _log('Failed to read ROM: ' + why, true);
        vscode.window.showErrorMessage('Failed to read ROM: ' + why);
    }
}

/** The map view asks for the room under the running game; the game adapter draws it. */
function _handleRoomMapRequest(mapId: unknown, objectStates: unknown, cutGrassTiles: unknown, layered: unknown) {
  if (!emu.panel || !emu.options.game) return;
  if (!emu.currentRomBuffer && emu.pending && typeof emu.pending.dataUrl === 'string') {
    const comma = emu.pending.dataUrl.indexOf(',');
    const b64 = comma >= 0 ? emu.pending.dataUrl.slice(comma + 1) : emu.pending.dataUrl;
    emu.currentRomBuffer = new Uint8Array(Buffer.from(b64, 'base64'));
  }
  const data = emu.options.game.roomMap(emu.currentRomBuffer, mapId, objectStates, cutGrassTiles, layered, _log);
  if (data) emu.panel.webview.postMessage(Object.assign({ command: 'roomMapRendered' }, data));
}

export type { EmuState, EmuOptions, GameHost, TraceEntry };
export { emu, _scriptDebug, _apu, _memory, KEEP_FOCUS_KEY, SETTINGS_KEY, CDL_WANTED_KEY, ALWAYS_RECORD_KEY, _state, _saveState, _keepFocusSetting, _notifyWebviewStatus, _estimateDataUrlBytes, _clearReadyTimeout, _clearRomTimeout, _dispatchPendingRom, _resetPanelHtml, _broadcastRomOffer, _reopenLastRom, _sendRomFile, _handleRoomMapRequest };
