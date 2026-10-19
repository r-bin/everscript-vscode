// TODO port to TS (docs/todo/port-to-ts.md)
'use strict';
// Ownership: the emulator panel's state (the panel, the ROM it runs, its timers, the CDL / REPLAYS / script
// debugger / APU / memory hosts) and the helpers that act on it: saved settings, status to the page,
// load timeouts, sending a ROM, rebuilding the page, the ROM offer. panel.js opens the panel and is the API;
// panel-messages.js answers the page.

const vscode = require('vscode');
const path   = require('path');
const fs     = require('fs');
const { buildHtml } = require('./panel-webview');
const { ScriptDebugHost } = require('../../../dist/core/emulator/script-debug-host');
const { resolveCore } = require('../../../dist/core/emulator/core-path');
const { describeFile: _describeFile, log: _log } = require('../../../dist/core/emulator/emulator-log');
const { MemoryBridge } = require('../../../dist/core/emulator/memory-bridge');
const { ApuStream } = require('../../../dist/core/emulator/apu-stream');
const { getRomOfferData, recordRomUsage } = require('../../../dist/core/emulator/rom-history');

/** The panel's state: the panel itself, the ROM it runs, the timers and hosts that live with it. */
const emu = {
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
    /**
     * What the extension that hosts the panel wants (configureEmulator):
     *   profile        'full' (Everscript) or 'recorder' (SNES CDL Recorder: CDL and REPLAYS only)
     *   title          the panel's title
     *   cdlTools       exports and lookups for the CDL tab (games/evermore/cdl/tools.ts); none in the recorder
     *   game           the game half of the host side: room pictures, idle sprites, icons, script trace
     *                  (games/evermore/emulator/host.js); none in the recorder
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

function _state(key, fallback) {
  return emu.context && emu.context.globalState ? emu.context.globalState.get(key, fallback) : fallback;
}

function _saveState(key, value) {
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

function _notifyWebviewStatus(level, text) {
  if (!emu.panel) return;
  try {
    emu.panel.webview.postMessage({ command: 'hostStatus', level, text });
  } catch (_) {
    // Best-effort status propagation only.
  }
}

function _estimateDataUrlBytes(dataUrl) {
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

function _armRomTimeout(romName) {
  _clearRomTimeout();
  emu.romTimeout = setTimeout(() => {
    const msg = `Timeout waiting for ROM launch result: ${romName}`;
    _log(msg, true);
    _notifyWebviewStatus('error', msg);
  }, 15000);
}

function _dispatchPendingRom() {
  if (!emu.pending || !emu.panel) return false;
  if (!emu.webviewReady) return true;
  const romName = emu.pending.name || 'game';
  _log(`Sending ROM to webview: ${romName}`);
  _armRomTimeout(romName);
  const gameData = emu.options.game && emu.options.game.romData ? emu.options.game.romData(emu.currentRomBuffer) : null;
  emu.panel.webview.postMessage({
    command: 'loadRom',
    dataUrl: emu.pending.dataUrl,
    name: emu.pending.name,
    gameData,
    scriptDebug: _scriptDebug.beforeRomLoad(),
  });
  return true;
}

function _resetPanelHtml() {
    if (!emu.panel || !emu.extensionPath) return;
  emu.webviewReady = false;
    const core = resolveCore(emu.extensionPath);
    if (!core.path) {
    if (core.warning) _log(core.warning, true);
    if (core.warning) _notifyWebviewStatus('error', core.warning);
        return;
    }
    _log(`Core selected (${core.source || 'unknown'}): JS ${_describeFile(core.path)}; WASM ${_describeFile(core.wasmPath)}`);
    const coreJsUri   = emu.panel.webview.asWebviewUri(vscode.Uri.file(core.path)).toString();
    const coreWasmUri = emu.panel.webview.asWebviewUri(vscode.Uri.file(core.wasmPath)).toString();
    _log(`Core webview URIs: js=${coreJsUri} wasm=${coreWasmUri}`);
    const wsRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? null;
    // The vanilla ROM comes from the ROM library (src/core/roms).
    const romOfferData = getRomOfferData(emu.context, wsRoot, '');
    const file = name => emu.panel.webview.asWebviewUri(vscode.Uri.file(path.join(emu.extensionPath, 'src', 'core', 'emulator', 'webview', name))).toString();
    const html = buildHtml(emu.panel.webview, coreJsUri, coreWasmUri, core.label, core.path, romOfferData, {
      profile: emu.options.profile,
      gameView: emu.options.game && emu.options.game.webview ? emu.options.game.webview() : null,
      styles: [file('emulator-profile.css'), file('emulator-panels.css')],
      // The game's page files first (Evermore: its ROM detector), then the emulator's.
      scripts: (emu.options.game && emu.options.game.webviewFiles ? emu.options.game.webviewFiles() : []).map(f => emu.panel.webview.asWebviewUri(vscode.Uri.file(f)).toString())
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
    // The vanilla ROM comes from the ROM library (src/core/roms).
    const romOfferData = getRomOfferData(emu.context, wsRoot, '');
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
    _log('Could not reopen the last ROM: ' + err.message);
  }
}

/** Read a ROM file from disk and send it to the open webview. */
function _sendRomFile(romPath) {
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
    _log('Failed to read ROM: ' + e.message, true);
        vscode.window.showErrorMessage('Failed to read ROM: ' + e.message);
    }
}

/** The map view asks for the room under the running game; the game adapter draws it. */
function _handleRoomMapRequest(mapId, objectStates, cutGrassTiles, layered) {
  if (!emu.panel || !emu.options.game) return;
  if (!emu.currentRomBuffer && emu.pending && typeof emu.pending.dataUrl === 'string') {
    const comma = emu.pending.dataUrl.indexOf(',');
    const b64 = comma >= 0 ? emu.pending.dataUrl.slice(comma + 1) : emu.pending.dataUrl;
    emu.currentRomBuffer = new Uint8Array(Buffer.from(b64, 'base64'));
  }
  const data = emu.options.game.roomMap(emu.currentRomBuffer, mapId, objectStates, cutGrassTiles, layered, _log);
  if (data) emu.panel.webview.postMessage(Object.assign({ command: 'roomMapRendered' }, data));
}

module.exports = { emu, _scriptDebug, _apu, _memory, KEEP_FOCUS_KEY, SETTINGS_KEY, CDL_WANTED_KEY, _state, _saveState, _keepFocusSetting, _notifyWebviewStatus, _estimateDataUrlBytes, _clearReadyTimeout, _clearRomTimeout, _dispatchPendingRom, _resetPanelHtml, _broadcastRomOffer, _reopenLastRom, _sendRomFile, _handleRoomMapRequest };
