/**
 * core/emulator/panel.ts
 *
 * Minimal snes9x2005-wasm runner - no EmulatorJS wrapper.
 * The Emscripten-compiled core is loaded directly inside the VS Code webview.
 *
 * Core API (lrusso/snes9x2005-wasm):
 *   Module._startWithRom(ptr, size, audioFreq)   start emulation
 *   Module._mainLoop()                            advance one frame
 *   Module._getScreenBuffer()                     ptr -> 512x448 RGBA8888
 *   Module._getSoundBuffer()                      ptr -> 2048 L then 2048 R Float32 (webview/page/02a-audio-out.js)
 *   Module._setJoypadInput(bits)                  player-1 bitmask
 *   Module._setJoypadInput2(bits)                 player-2 bitmask
 *   Module._my_malloc(size) / Module._my_free(ptr)
 *   Module._saveState()                           ptr -> save-state bytes
 *   Module._getStateSaveSize()                    save-state byte count
 *   Module._loadState(ptr, size)
 *   HEAPU8                                        global Uint8Array (WASM memory)
 *
 * Custom debugger API (requires custom build - not in plain lrusso build):
 *   Module.getCPUState()  Module.readMemoryRange()  Module.pauseEmulation()
 *   Module.resumeEmulation()  Module.addExecBreakpoint()  Module.addWriteBreakpoint()
 *   Module.removeExecBreakpoint()  Module.removeWriteBreakpoint()
 *   Module.onBreakpointHit = fn({ type, address, pc })
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { CdlHost } from './cdl/host';
import { TasHost, recordingsDir } from './tas/host';
import { resolveCore, CORE_SUBDIR } from './core-path';
import { setBuildChannel, ensureBuildChannel as _ensureBuildChannel, log as _log, crashHistory as _crashHistory, launchHistory as _launchHistory, scriptTraceHistory as _scriptTraceHistory } from './emulator-log';
import { recordRomUsage, setRomDescriber } from './rom-history';
import { emu, _scriptDebug, _apu, _memory, CDL_WANTED_KEY, ALWAYS_RECORD_KEY, OPEN_MODE_KEY, _state, _saveState, _estimateDataUrlBytes, _clearReadyTimeout, _clearRomTimeout, _dispatchPendingRom, _resetPanelHtml, _sendRomFile, _playReplay } from './panel-state';
import { onWebviewMessage } from './panel-messages';
import { startSessionWatch, stopSessionWatch, checkLastSession } from './session-watch';
import type { EmuOptions } from './panel-state';
import type { ApuFrame } from './apu-stream';

/** A ROM handed to the panel to load. */
interface RomToOpen { dataUrl: string; name: string; filePath?: string; path?: string; kind?: string; draft?: unknown }

function configureEmulator(options?: Partial<EmuOptions> | null) {
  emu.options = Object.assign({}, emu.options, options || {});
  setRomDescriber(emu.options.game ? emu.options.game.describeRom : null);
}

/** Options when opening the emulator panel. */
interface OpenEmulatorOptions { profile?: 'full' | 'recorder'; title?: string; }

/**
 * Open (or reveal) the emulator panel.
 * @param {object} context   VS Code extension context.
 * @param {object} [rom]     Optional { dataUrl, name } to auto-load.
 * @param {object} [channel] Optional OutputChannel for build log.
 * @param {object} [options] Optional { profile, title } for this session.
 */
function openEmulatorPanel(context: vscode.ExtensionContext, rom?: RomToOpen | null, channel?: vscode.OutputChannel, options?: OpenEmulatorOptions) {
    emu.context = context;
    if (rom) {
      emu.pending = rom;
      if (rom.draft) emu.activeDraft = rom.draft;
      recordRomUsage({
        path: rom.filePath || rom.path,
        name: rom.name,
        kind: rom.kind || (rom.draft ? 'editor' : 'file'),
        dataUrl: rom.dataUrl,
      }, emu.context);
    }
    if (channel) setBuildChannel(channel);
  _ensureBuildChannel();
    emu.extensionPath = context.extensionPath;

  if (emu.pending) {
    const size = _estimateDataUrlBytes(emu.pending.dataUrl);
    _log(`ROM staged: ${emu.pending.name || 'game'} (${size} bytes)`);
    if (emu.pending.dataUrl) {
      try {
        const comma = emu.pending.dataUrl.indexOf(',');
        const b64 = comma >= 0 ? emu.pending.dataUrl.slice(comma + 1) : emu.pending.dataUrl;
        emu.currentRomBuffer = new Uint8Array(Buffer.from(b64, 'base64'));
      } catch (_) {}
    }
  }

    if (emu.panel) {
        emu.panel.reveal(vscode.ViewColumn.Beside, false);
      if (emu.pending && !_dispatchPendingRom()) _resetPanelHtml();
        return;
    }

    emu.sessionProfile = options?.profile || emu.options.profile;
    // The SNES CDL Recorder opens on the CDL preset.
    if (emu.sessionProfile === 'recorder') emu.sessionPreset = 'cdl';
    emu.sessionTitle = options?.title || (options?.profile === 'recorder' ? 'SNES CDL Recorder' : emu.options.title);

    const core    = resolveCore(emu.extensionPath);
    if (core.warning) {
      _log(core.warning, true);
        vscode.window.showWarningMessage(`Everscript Emulator: ${core.warning}`);
    }
    const coreDir = core.path
        ? path.dirname(core.path)
        : path.join(context.extensionPath, CORE_SUBDIR);

    emu.panel = vscode.window.createWebviewPanel(
        'everscriptEmulator',
        emu.sessionTitle || emu.options.title,
        vscode.ViewColumn.Beside,
        {
            enableScripts:          true,
            retainContextWhenHidden: true,
            localResourceRoots: [
                vscode.Uri.file(context.extensionPath),
                vscode.Uri.file(coreDir),
            ],
        },
    );

    const isRecorder = emu.sessionProfile === 'recorder' || emu.options.profile === 'recorder';
    emu.sessionAlwaysRecord = !!_state(ALWAYS_RECORD_KEY, true);
    emu.sessionOpenMode = _state(OPEN_MODE_KEY, 'new') === 'continue' ? 'continue' : 'new';
    emu.cdl = new CdlHost(
      context.globalStorageUri ? context.globalStorageUri.fsPath : path.join(context.extensionPath, '.storage'),
      _postToPage,
      _log,
      {
        tools: emu.options.cdlTools,
        wanted: {
          get: () => (emu.sessionAlwaysRecord !== false && (isRecorder ? true : !!_state(CDL_WANTED_KEY, true))),
          set: (on: boolean) => { if (!isRecorder) _saveState(CDL_WANTED_KEY, !!on); },
        },
      },
    );
    emu.tas = new TasHost(
      context.globalStorageUri ? context.globalStorageUri.fsPath : path.join(context.extensionPath, '.storage'),
      _postToPage,
      _log,
      () => resolveCore(emu.extensionPath).wasmPath,
    );

    emu.panel.webview.onDidReceiveMessage(onWebviewMessage, undefined, context.subscriptions);

    _resetPanelHtml();
    _log('Emulator panel opened');
    startSessionWatch(context, _postToPage,
      isRecorder ? 'everscript.cdlRecorder' : 'everscript.openEmulator');

    emu.panel.onDidDispose(() => {
      // First: what the closing hosts still send (a CDL save says "saved") must not reach the disposed
      // webview: that threw "Webview is disposed", cut this handler short and left emu.panel set, so the
      // next Open Emulator failed (v0.355.5).
      emu.panel = null;
      stopSessionWatch();
      if (emu.cdl) { emu.cdl.dispose(); emu.cdl = null; }
      if (emu.tas) { emu.tas.dispose(); emu.tas = null; }
      _scriptDebug.panelClosed();
      _memory.reset('The emulator was closed');
      _apu.reset('The emulator was closed');
      _clearReadyTimeout();
      _clearRomTimeout();
      emu.webviewReady = false;
      emu.panel = null;
      emu.pending = null;
      emu.currentRomBuffer = null;
      emu.currentRomName = '';
      emu.activeDraft = null;
      emu.reopenTried = false;
      if (emu.sessionProfile === 'recorder') emu.sessionPreset = null;
      emu.sessionProfile = null;
      emu.sessionTitle = null;
      emu.loadedCore = null;
      if (emu.options.game) emu.options.game.clearCaches();
    }, null, context.subscriptions);
}

/** A message to the page, if there is one; a panel being closed is not an error. */
function _postToPage(m: object) {
  try { if (emu.panel) emu.panel.webview.postMessage(m); } catch (_) { /* disposed */ }
}

function injectEverscript(code: string) {
  if (emu.panel && emu.panel.webview) {
    emu.panel.webview.postMessage({ command: 'injectEverscript', code: code });
    return true;
  }
  return false;
}

/** The VS Code script debugger's bridge to the emulator (see script-debug-host.ts). */
function getScriptDebugBridge() {
    return _scriptDebug;
}

/** Load a ROM file into the emulator, opening the panel when needed. */
function runRomFile(context: vscode.ExtensionContext, romPath: string) {
    const romData = fs.readFileSync(romPath);
    const dataUrl = 'data:application/octet-stream;base64,' + romData.toString('base64');
    openEmulatorPanel(context, { dataUrl, name: path.basename(romPath), filePath: romPath, kind: 'file' });
}

/** Play a recording (.evsmv text) in the panel, opening it when needed (the replay editor). */
function playReplay(context: vscode.ExtensionContext, name: string, text: string) {
    openEmulatorPanel(context);
    _playReplay(name, text);
}

/** Write what the CDL recorder holds in memory (before a bundle is zipped). */
function flushRecording() {
  if (emu.cdl) emu.cdl.flushNow();
}

/** The extension deactivates (VS Code closes): save what is in memory, close the session cleanly. */
function emergencySave() {
  if (emu.cdl) emu.cdl.flushNow();
  if (emu.tas) emu.tas.dispose();
  stopSessionWatch();
}

/** The CDL library changed on disk (bundle import): the open panel reads it again. */
function reloadRecording() {
  if (emu.cdl) emu.cdl.reload();
}

/** Where recordings live: the CDL library root and the replays folder. */
function recordingFolders(context: vscode.ExtensionContext) {
  const storage = context.globalStorageUri ? context.globalStorageUri.fsPath : path.join(context.extensionPath, '.storage');
  return { storage, cdlRoot: path.join(storage, 'cdl-library'), replayDir: recordingsDir(storage) };
}

/** The ROM running in the emulator, or null. */
function getCurrentRom() { return emu.panel ? emu.currentRomBuffer : null; }

/** Bytes at a 24-bit bus address of the running game (soe://ram/). */
function readMemory(addr: number, len: number) { return _memory.read(addr, len); }

/** `closed` / `open` / `running`, the ROM and whether it is paused (soe://ram/status.json). */
async function getStatus() {
  if (!emu.panel) return { emulator: 'closed', rom: null, paused: null };
  const rom = emu.currentRomBuffer ? { name: emu.currentRomName || null, size: emu.currentRomBuffer.length } : null;
  try {
    const s = await _memory.status();
    if (!s) return { emulator: 'open', rom, paused: null };
    return { emulator: s.romLoaded ? 'running' : 'open', rom, paused: s.romLoaded ? s.paused : null };
  } catch (_) {
    return { emulator: 'open', rom, paused: null };
  }
}

/** The sound chip for the radar's Music tab (apu-stream.js): frames while on, and full snapshots. */
const apuStream = {
  setListener: (fn: ((f: ApuFrame) => void) | null) => _apu.setListener(fn),
  setOnClose: (fn: (() => void) | null) => _apu.setOnClose(fn),
  setOnPause: (fn: ((paused: boolean) => void) | null) => _apu.setOnPause(fn),
  setNames: (fn: (() => unknown) | null) => _apu.setNames(fn),
  setOn: (on: boolean) => _apu.setOn(on),
  point: (entity: number, label?: string) => _apu.point(entity, label),
  snapshot: () => _apu.snapshot(),
  isOpen: () => !!emu.panel,
};

/** Recent emulator runtime logs (soe://logs/). */
function getLogHistory() {
  return {
    crashes: _crashHistory.slice(),
    launches: _launchHistory.slice(),
    scriptTrace: _scriptTraceHistory.slice(),
  };
}

export { configureEmulator, playReplay, flushRecording, emergencySave, checkLastSession, reloadRecording, recordingFolders, openEmulatorPanel, _sendRomFile as sendRomFile, injectEverscript, getScriptDebugBridge, runRomFile, getCurrentRom, readMemory, getStatus, apuStream, getLogHistory };
export type { OpenEmulatorOptions };
