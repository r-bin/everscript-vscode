'use strict';

/**
 * debugger/emulator/panel.js
 *
 * Minimal snes9x2005-wasm runner - no EmulatorJS wrapper.
 * The Emscripten-compiled core is loaded directly inside the VS Code webview.
 *
 * Core API (lrusso/snes9x2005-wasm):
 *   Module._startWithRom(ptr, size, audioFreq)   start emulation
 *   Module._mainLoop()                            advance one frame
 *   Module._getScreenBuffer()                     ptr -> 512x448 RGBA8888
 *   Module._getSoundBuffer()                      ptr -> stereo Int16 PCM
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

const vscode = require('vscode');
const path   = require('path');
const fs     = require('fs');
const { CdlHost } = require('../../../dist/core/emulator/cdl/host');
const { TasHost, recordingsDir } = require('../../../dist/core/emulator/tas/host');
const { resolveCore, CORE_SUBDIR } = require('../../../dist/core/emulator/core-path');
const { setBuildChannel, ensureBuildChannel: _ensureBuildChannel, log: _log, crashHistory: _crashHistory, launchHistory: _launchHistory, scriptTraceHistory: _scriptTraceHistory } = require('../../../dist/core/emulator/emulator-log');
const { recordRomUsage, setRomDescriber } = require('../../../dist/core/emulator/rom-history');
const { emu, _scriptDebug, _apu, _memory, CDL_WANTED_KEY, _state, _saveState, _estimateDataUrlBytes, _clearReadyTimeout, _clearRomTimeout, _dispatchPendingRom, _resetPanelHtml, _sendRomFile } = require('./panel-state');
const { onWebviewMessage } = require('./panel-messages');

function configureEmulator(options) {
  emu.options = Object.assign({}, emu.options, options || {});
  setRomDescriber(emu.options.game ? emu.options.game.describeRom : null);
}

/**
 * Open (or reveal) the emulator panel.
 * @param {object} context   VS Code extension context.
 * @param {object} [rom]     Optional { dataUrl, name } to auto-load.
 * @param {object} [channel] Optional OutputChannel for build log.
 */
function openEmulatorPanel(context, rom, channel) {
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
        emu.options.title,
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

    emu.cdl = new CdlHost(
      context.globalStorageUri ? context.globalStorageUri.fsPath : path.join(context.extensionPath, '.storage'),
      m => { if (emu.panel) emu.panel.webview.postMessage(m); },
      _log,
      {
        tools: emu.options.cdlTools,
        wanted: { get: () => !!_state(CDL_WANTED_KEY, emu.options.profile === 'recorder'), set: on => _saveState(CDL_WANTED_KEY, !!on) },
      },
    );
    emu.tas = new TasHost(
      context.globalStorageUri ? context.globalStorageUri.fsPath : path.join(context.extensionPath, '.storage'),
      m => { if (emu.panel) emu.panel.webview.postMessage(m); },
      _log,
      () => resolveCore(emu.extensionPath).wasmPath,
    );

    emu.panel.webview.onDidReceiveMessage(onWebviewMessage, undefined, context.subscriptions);

    _resetPanelHtml();
    _log('Emulator panel opened');

    emu.panel.onDidDispose(() => {
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
      if (emu.options.game) emu.options.game.clearCaches();
    }, null, context.subscriptions);
}

function injectEverscript(code) {
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
function runRomFile(context, romPath) {
    const romData = fs.readFileSync(romPath);
    const dataUrl = 'data:application/octet-stream;base64,' + romData.toString('base64');
    openEmulatorPanel(context, { dataUrl, name: path.basename(romPath), filePath: romPath, kind: 'file' });
}

/** Write what the CDL recorder holds in memory (before a bundle is zipped). */
function flushRecording() {
  if (emu.cdl) emu.cdl.flushNow();
}

/** The CDL library changed on disk (bundle import): the open panel reads it again. */
function reloadRecording() {
  if (emu.cdl) emu.cdl.reload();
}

/** Where recordings live: the CDL library root and the replays folder. */
function recordingFolders(context) {
  const storage = context.globalStorageUri ? context.globalStorageUri.fsPath : path.join(context.extensionPath, '.storage');
  return { storage, cdlRoot: path.join(storage, 'cdl-library'), replayDir: recordingsDir(storage) };
}

/** The ROM running in the emulator, or null. */
function getCurrentRom() { return emu.panel ? emu.currentRomBuffer : null; }

/** Bytes at a 24-bit bus address of the running game (soe://ram/). */
function readMemory(addr, len) { return _memory.read(addr, len); }

/** `closed` / `open` / `running`, the ROM and whether it is paused (soe://ram/status.json). */
async function getStatus() {
  if (!emu.panel) return { emulator: 'closed', rom: null, paused: null };
  const rom = emu.currentRomBuffer ? { name: emu.currentRomName || null, size: emu.currentRomBuffer.length } : null;
  try {
    const s = await _memory.status();
    return { emulator: s.romLoaded ? 'running' : 'open', rom, paused: s.romLoaded ? s.paused : null };
  } catch (_) {
    return { emulator: 'open', rom, paused: null };
  }
}

/** The sound chip for the radar's Music tab (apu-stream.js): frames while on, and full snapshots. */
const apuStream = {
  setListener: fn => _apu.setListener(fn),
  setOnClose: fn => _apu.setOnClose(fn),
  setOnPause: fn => _apu.setOnPause(fn),
  setNames: fn => _apu.setNames(fn),
  setOn: on => _apu.setOn(on),
  point: (entity, label) => _apu.point(entity, label),
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

module.exports = { configureEmulator, flushRecording, reloadRecording, recordingFolders, openEmulatorPanel, sendRomFile: _sendRomFile, injectEverscript, getScriptDebugBridge, runRomFile, getCurrentRom, readMemory, getStatus, apuStream, getLogHistory };
