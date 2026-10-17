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
const { buildHtml } = require('./panel-webview');
const { CdlHost } = require('./cdl/host');
const { TasHost, recordingsDir } = require('./tas/host');
const { ScriptDebugHost } = require('./script-debug-host');
const { MemoryBridge } = require('./memory-bridge');
const { ApuStream } = require('./apu-stream');
const {
  getRomOfferData,
  recordRomUsage,
  getVanillaRom,
  setRomDescriber,
  clearRecentRoms,
  getStorageDir,
} = require('./rom-history');

const CORE_SUBDIR        = path.join('src', 'emulator', 'core', 'snes9x2005-wasm-vanilla');
const CUSTOM_CORE_SUBDIR = path.join('src', 'emulator', 'core', 'snes9x2005-wasm');
const CORE_JS     = 'snes9x_2005.js';
const CORE_WASM   = 'snes9x_2005.wasm';
const LEGACY_CUSTOM_CORE_DIRS = [
  path.join('debugger', 'core', 'snes9x2005-wasm'),
  path.join('debugger', 'core', 'snes9x'),
  path.join('src', 'emulator', 'core', 'snes9x2005-wasm'),
  path.join('src', 'emulator', 'core', 'snes9x'),
];

let _context       = null;   // VS Code extension context
let _panel         = null;   // active WebviewPanel
let _pending       = null;   // { dataUrl, name } waiting to load
let _currentRomBuffer = null; // raw ROM buffer for bytecode disassembly
let _currentRomName = '';     // name of the ROM the game started from
let _activeDraft   = null;   // custom draft object for trigger/address lookup
let _extensionPath = '';
let _buildChannel  = null;   // output channel for build log
let _emulatorChannel = null; // output channel for emulator runtime and crash log
let _readyTimeout  = null;
let _romTimeout    = null;
let _webviewReady  = false;
const _crashHistory = [];       // recent crash reports (capped at 50)
const _launchHistory = [];      // recent ROM launches (capped at 50)
const _scriptTraceHistory = []; // recent formatted script trace entries (capped at 2000)
let _cdl           = null;   // CdlHost: per-ROM code/data log library
let _tas           = null;   // TasHost: input recordings and replays
// VS Code script debugger hook: outlives the panel (a session can attach first).
const _scriptDebug = new ScriptDebugHost(m => { if (_panel) _panel.webview.postMessage(m); }, line => _log(line),
  () => _keepFocusAfterBreak());
// soe://ram/ reads: request/reply with the webview, which owns the core.
const _apu = new ApuStream(m => !!(_panel && _webviewReady && _panel.webview.postMessage(m) !== undefined));
const _memory = new MemoryBridge(m => !!(_panel && _webviewReady && _panel.webview.postMessage(m) !== undefined));
// KEEP FOCUS (pause menu, EMULATION): Tab stays in the emulator and a debugger stop
// leaves the focus on it (globalState).
const KEEP_FOCUS_KEY = 'everscript.emulator.keepFocusOnBreak';
const KEEP_FOCUS_MS = 2000;
// The webview's settings (overlays, mute, keybinds): saved by the page, sent back on open.
const SETTINGS_KEY = 'everscript.emulator.settings';
// Whether CDL recording was on when last switched.
const CDL_WANTED_KEY = 'everscript.emulator.cdlWanted';

/**
 * What the extension that hosts the panel wants (configureEmulator):
 *   profile        'full' (Everscript) or 'recorder' (SNES CDL Recorder: CDL and REPLAYS only)
 *   title          the panel's title
 *   cdlTools       exports and lookups for the CDL tab (games/evermore/cdl/tools.js); none in the recorder
 *   game           the game half of the host side: room pictures, idle sprites, icons, script trace
 *                  (games/evermore/emulator/host.js); none in the recorder
 *   onExportBundle the CDL tab's "export bundle" button (recorder)
 *   reopenLastRom  a panel opened without a ROM loads the most recent one that still exists (recorder)
 */
let _options = { profile: 'full', title: 'Everscript Emulator', cdlTools: null, game: null, onExportBundle: null, reopenLastRom: false };
let _reopenTried = false;   // per panel: the last ROM is reopened once, on the first ready

function configureEmulator(options) {
  _options = Object.assign({}, _options, options || {});
  setRomDescriber(_options.game ? _options.game.describeRom : null);
}

function _state(key, fallback) {
  return _context && _context.globalState ? _context.globalState.get(key, fallback) : fallback;
}

function _saveState(key, value) {
  if (_context && _context.globalState) _context.globalState.update(key, value);
}

function _keepFocusSetting() {
  return !!(_context && _context.globalState && _context.globalState.get(KEEP_FOCUS_KEY, false));
}

/**
 * VS Code focuses the stopped line's editor a moment after the stop: take the
 * focus back then, and whenever the active editor changes shortly after.
 */
function _keepFocusAfterBreak() {
  if (!_panel || !_keepFocusSetting()) return;
  const until = Date.now() + KEEP_FOCUS_MS;
  const refocus = () => {
    if (!_panel || Date.now() > until) return;
    _panel.reveal(_panel.viewColumn, false);
    _panel.webview.postMessage({ command: 'focusScreen' });
  };
  setTimeout(refocus, 150);
  const watch = vscode.window.onDidChangeActiveTextEditor(() => setTimeout(refocus, 0));
  setTimeout(() => watch.dispose(), KEEP_FOCUS_MS);
}

function _describeFile(filePath) {
  try {
    const st = fs.statSync(filePath);
    return `${filePath} (${st.size} bytes)`;
  } catch (_) {
    return `${filePath} (missing)`;
  }
}

function _notifyWebviewStatus(level, text) {
  if (!_panel) return;
  try {
    _panel.webview.postMessage({ command: 'hostStatus', level, text });
  } catch (_) {
    // Best-effort status propagation only.
  }
}

function _ensureBuildChannel() {
  if (!_buildChannel) _buildChannel = vscode.window.createOutputChannel('Everscript Build');
  return _buildChannel;
}

function _ensureEmulatorChannel() {
  if (!_emulatorChannel) _emulatorChannel = vscode.window.createOutputChannel('Everscript Emulator');
  return _emulatorChannel;
}

function _log(line, show) {
  const emuCh = _ensureEmulatorChannel();
  const time = new Date().toLocaleTimeString();
  emuCh.appendLine(`[${time}] ${line}`);
  if (_buildChannel && _buildChannel !== emuCh) {
    _buildChannel.appendLine('[Everscript] ' + line);
  }
  if (show) emuCh.show(true);
}

function _logCrash(crash) {
  const ch = _ensureEmulatorChannel();
  const time = new Date().toISOString();
  const border = '================================================================================';
  ch.appendLine(border);
  ch.appendLine(`[EMULATOR CRASH REPORT] ${time}`);
  ch.appendLine(`Error: ${crash.message || crash.error || 'Unknown emulator error'}`);
  if (crash.type) ch.appendLine(`Type: ${crash.type}`);
  if (crash.source) ch.appendLine(`Source: ${crash.source}${crash.line ? ':' + crash.line : ''}${crash.col ? ':' + crash.col : ''}`);
  ch.appendLine(`ROM: ${_currentRomName || 'unknown'}${crash.frame !== undefined ? ` | Frame: ${crash.frame}` : ''}${crash.mapId !== undefined && crash.mapId >= 0 ? ` | Map ID: 0x${crash.mapId.toString(16).toUpperCase()} (${crash.mapId})` : ''}`);
  if (crash.camX !== undefined || crash.camY !== undefined) {
    ch.appendLine(`Camera: X=${crash.camX ?? 0}, Y=${crash.camY ?? 0}`);
  }

  if (crash.cpu) {
    const c = crash.cpu;
    const h = (v, len) => (typeof v === 'number' ? (v >>> 0).toString(16).toUpperCase().padStart(len, '0') : '????');
    ch.appendLine('');
    ch.appendLine('SNES CPU State:');
    ch.appendLine(`  PC: $${h(c.pc, 6)} (PB: $${h(c.pb, 2)})   A: $${h(c.a, 4)}   X: $${h(c.x, 4)}   Y: $${h(c.y, 4)}`);
    ch.appendLine(`  SP: $${h(c.sp, 4)}   DB: $${h(c.db, 2)}   P: $${h(c.p, 2)}`);
  }

  if (crash.stack) {
    ch.appendLine('');
    ch.appendLine('Stack Trace:');
    ch.appendLine(crash.stack);
  }

  if (Array.isArray(crash.scriptSlots) && crash.scriptSlots.length > 0) {
    ch.appendLine('');
    ch.appendLine('Active Script Slots:');
    for (const slot of crash.scriptSlots) {
      const locHex = slot.loc !== undefined ? (slot.loc >>> 0).toString(16).toUpperCase().padStart(6, '0') : '000000';
      ch.appendLine(`  Slot ${slot.slot}: state=${slot.state} loc=$${locHex} entity=${slot.entity !== undefined ? slot.entity : '-'}`);
    }
  }

  ch.appendLine(border);
  ch.show(true);

  _crashHistory.push({
    timestamp: time,
    error: crash.message || crash.error || 'Unknown emulator error',
    type: crash.type || null,
    source: crash.source ? `${crash.source}${crash.line ? ':' + crash.line : ''}${crash.col ? ':' + crash.col : ''}` : null,
    rom: _currentRomName || 'unknown',
    frame: crash.frame !== undefined ? crash.frame : null,
    mapId: crash.mapId !== undefined && crash.mapId >= 0 ? crash.mapId : null,
    camX: crash.camX ?? null,
    camY: crash.camY ?? null,
    cpu: crash.cpu ? {
      pc: crash.cpu.pc,
      pb: crash.cpu.pb,
      a: crash.cpu.a,
      x: crash.cpu.x,
      y: crash.cpu.y,
      sp: crash.cpu.sp,
      db: crash.cpu.db,
      p: crash.cpu.p,
    } : null,
    stack: crash.stack || null,
    scriptSlots: Array.isArray(crash.scriptSlots) ? crash.scriptSlots : [],
  });
  if (_crashHistory.length > 50) _crashHistory.shift();
}

function _estimateDataUrlBytes(dataUrl) {
  if (typeof dataUrl !== 'string') return 0;
  const comma = dataUrl.indexOf(',');
  const b64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
  return Math.floor((b64.length * 3) / 4);
}

function _clearReadyTimeout() {
  if (_readyTimeout) {
    clearTimeout(_readyTimeout);
    _readyTimeout = null;
  }
}

function _clearRomTimeout() {
  if (_romTimeout) {
    clearTimeout(_romTimeout);
    _romTimeout = null;
  }
}

function _armReadyTimeout() {
  _clearReadyTimeout();
  _readyTimeout = setTimeout(() => {
    const pending = _pending ? ` (pending ROM: ${_pending.name || 'game'})` : '';
    const msg = 'Timeout waiting for webview ready message' + pending;
    _log(msg, true);
    _notifyWebviewStatus('error', msg + '. Open Webview Developer Tools to inspect script/wasm load errors.');
  }, 30000);
}

function _armRomTimeout(romName) {
  _clearRomTimeout();
  _romTimeout = setTimeout(() => {
    const msg = `Timeout waiting for ROM launch result: ${romName}`;
    _log(msg, true);
    _notifyWebviewStatus('error', msg);
  }, 15000);
}

function _dispatchPendingRom() {
  if (!_pending || !_panel) return false;
  if (!_webviewReady) return true;
  const romName = _pending.name || 'game';
  _log(`Sending ROM to webview: ${romName}`);
  _armRomTimeout(romName);
  const alchemyIcons = _options.game ? _options.game.alchemyIcons(_currentRomBuffer) : null;
  _panel.webview.postMessage({
    command: 'loadRom',
    dataUrl: _pending.dataUrl,
    name: _pending.name,
    alchemyIcons: alchemyIcons,
    scriptDebug: _scriptDebug.beforeRomLoad(),
  });
  return true;
}

/** A missing core under a pre-v0.6.0 folder of any checkout (or of this install) -> the bundled custom core. */
function _remapLegacyCorePath(rawPath) {
  const normalized = path.normalize(rawPath);
  if (fs.existsSync(normalized)) return rawPath;
  for (const legacyDir of LEGACY_CUSTOM_CORE_DIRS) {
    const legacySuffix = path.sep + path.normalize(path.join(legacyDir, CORE_JS));
    if (!normalized.endsWith(legacySuffix)) continue;
    const migrated = path.join(_extensionPath, 'src', 'emulator', 'core', 'snes9x2005-wasm', CORE_JS);
    if (fs.existsSync(migrated)) return migrated;
  }
  return rawPath;
}

/**
 * Resolve the snes9x core to use.
 * everscript.snesCorePath (if set) must point to a snes9x2005-wasm .js file.
 * Otherwise - and whenever the configured one is missing or unusable - the
 * bundled src/emulator/core/snes9x2005-wasm-vanilla/snes9x_2005.js is used.
 * Returns { path, wasmPath, label, source?, warning? }.
 *
 * A bad setting used to return no core at all, which left the panel blank
 * with only an output-channel line to say why. The setting is typically a
 * leftover `debugger/core/...` path from before the src/ refactor, pointing
 * into a checkout rather than the extension, so the legacy remap cannot
 * catch it. Falling back keeps the emulator working and still says so.
 */
function _resolveCore() {
    const bundled = _bundledCore();
    const raw = vscode.workspace.getConfiguration('everscript').get('snesCorePath', '').trim();
    if (!raw) return bundled;
    const custom = _customCore(raw);
    if (custom.path) return custom;
    if (!bundled.path) return { ...bundled, warning: custom.warning + '; ' + bundled.warning };
    return { ...bundled, warning: custom.warning + ' - using the bundled core instead' };
}

function _customCore(raw) {
    const configured = path.isAbsolute(raw) ? raw : path.resolve(raw);
    const resolved = _remapLegacyCorePath(configured);
    if (!fs.existsSync(resolved))
        return { path: '', wasmPath: '', label: '', warning: `snesCorePath "${raw}" does not exist` };
    if (!resolved.toLowerCase().endsWith('.js'))
        return { path: '', wasmPath: '', label: '', warning: `snesCorePath must point to a snes9x2005-wasm .js build, got "${path.extname(resolved)}"` };
    const wasmPath = path.join(path.dirname(resolved), CORE_WASM);
    if (!fs.existsSync(wasmPath))
        return { path: '', wasmPath: '', label: '', warning: `Custom core JS found but WASM missing: ${wasmPath}` };
    return { path: resolved, wasmPath, label: path.basename(resolved), source: 'custom' };
}

function _bundledCore() {
    const customJs   = path.join(_extensionPath, CUSTOM_CORE_SUBDIR, CORE_JS);
    const customWasm = path.join(_extensionPath, CUSTOM_CORE_SUBDIR, CORE_WASM);
    if (fs.existsSync(customJs) && fs.existsSync(customWasm)) {
      return { path: customJs, wasmPath: customWasm, label: CORE_JS + ' (debugger core)', source: 'custom-bundled' };
    }
    const jsPath   = path.join(_extensionPath, CORE_SUBDIR, CORE_JS);
    const wasmPath = path.join(_extensionPath, CORE_SUBDIR, CORE_WASM);
    if (!fs.existsSync(jsPath)) {
      return { path: '', wasmPath: '', label: '', warning: `Bundled core JS missing: ${jsPath}` };
    }
    if (!fs.existsSync(wasmPath)) {
      return { path: '', wasmPath: '', label: '', warning: `Bundled core WASM missing: ${wasmPath}` };
    }
    return { path: jsPath, wasmPath, label: CORE_JS + ' (bundled)', source: 'bundled' };
}

function _resetPanelHtml() {
    if (!_panel || !_extensionPath) return;
  _webviewReady = false;
    const core = _resolveCore();
    if (!core.path) {
    if (core.warning) _log(core.warning, true);
    if (core.warning) _notifyWebviewStatus('error', core.warning);
        return;
    }
    _log(`Core selected (${core.source || 'unknown'}): JS ${_describeFile(core.path)}; WASM ${_describeFile(core.wasmPath)}`);
    const coreJsUri   = _panel.webview.asWebviewUri(vscode.Uri.file(core.path)).toString();
    const coreWasmUri = _panel.webview.asWebviewUri(vscode.Uri.file(core.wasmPath)).toString();
    _log(`Core webview URIs: js=${coreJsUri} wasm=${coreWasmUri}`);
    const wsRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? null;
    // The vanilla ROM comes from the ROM library (src/core/roms).
    const romOfferData = getRomOfferData(_context, wsRoot, '');
    const file = name => _panel.webview.asWebviewUri(vscode.Uri.file(path.join(_extensionPath, 'src', 'emulator', 'webview', name))).toString();
    const html = buildHtml(_panel.webview, coreJsUri, coreWasmUri, core.label, core.path, romOfferData, {
      profile: _options.profile,
      gameView: _options.game && _options.game.webview ? _options.game.webview() : null,
      styles: [file('emulator-profile.css'), file('emulator-panels.css')],
      scripts: [file('rom-game.js'), file('emulator-profile.js'), file('emulator-panels.js'), file('replays-list.js')],
    });
    // Log a snippet to help diagnose CSP / script-load issues.
    _log('HTML head snippet: ' + html.substring(0, 220).replace(/\s+/g, ' '));
    _panel.webview.html = html;
  _armReadyTimeout();
}

function _broadcastRomOffer() {
  if (!_panel) return;
  try {
    const wsRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? null;
    // The vanilla ROM comes from the ROM library (src/core/roms).
    const romOfferData = getRomOfferData(_context, wsRoot, '');
    _panel.webview.postMessage({ command: 'romOfferInfo', data: romOfferData });
  } catch (_) {}
}

/**
 * Open (or reveal) the emulator panel.
 * @param {object} context   VS Code extension context.
 * @param {object} [rom]     Optional { dataUrl, name } to auto-load.
 * @param {object} [channel] Optional OutputChannel for build log.
 */
function openEmulatorPanel(context, rom, channel) {
    _context = context;
    if (rom) {
      _pending = rom;
      if (rom.draft) _activeDraft = rom.draft;
      recordRomUsage({
        path: rom.filePath || rom.path,
        name: rom.name,
        kind: rom.kind || (rom.draft ? 'editor' : 'file'),
        dataUrl: rom.dataUrl,
      }, _context);
    }
    if (channel) _buildChannel = channel;
  _ensureBuildChannel();
    _extensionPath = context.extensionPath;

  if (_pending) {
    const size = _estimateDataUrlBytes(_pending.dataUrl);
    _log(`ROM staged: ${_pending.name || 'game'} (${size} bytes)`);
    if (_pending.dataUrl) {
      try {
        const comma = _pending.dataUrl.indexOf(',');
        const b64 = comma >= 0 ? _pending.dataUrl.slice(comma + 1) : _pending.dataUrl;
        _currentRomBuffer = new Uint8Array(Buffer.from(b64, 'base64'));
      } catch (_) {}
    }
  }

    if (_panel) {
        _panel.reveal(vscode.ViewColumn.Beside, false);
      if (_pending && !_dispatchPendingRom()) _resetPanelHtml();
        return;
    }

    const core    = _resolveCore();
    if (core.warning) {
      _log(core.warning, true);
        vscode.window.showWarningMessage(`Everscript Emulator: ${core.warning}`);
    }
    const coreDir = core.path
        ? path.dirname(core.path)
        : path.join(context.extensionPath, CORE_SUBDIR);

    _panel = vscode.window.createWebviewPanel(
        'everscriptEmulator',
        _options.title,
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

    _cdl = new CdlHost(
      context.globalStorageUri ? context.globalStorageUri.fsPath : path.join(context.extensionPath, '.storage'),
      m => { if (_panel) _panel.webview.postMessage(m); },
      _log,
      {
        tools: _options.cdlTools,
        wanted: { get: () => !!_state(CDL_WANTED_KEY, _options.profile === 'recorder'), set: on => _saveState(CDL_WANTED_KEY, !!on) },
      },
    );
    _tas = new TasHost(
      context.globalStorageUri ? context.globalStorageUri.fsPath : path.join(context.extensionPath, '.storage'),
      m => { if (_panel) _panel.webview.postMessage(m); },
      _log,
      () => _resolveCore().wasmPath,
    );

    _panel.webview.onDidReceiveMessage(msg => {
        if (_cdl && typeof msg.command === 'string' && msg.command.startsWith('cdl') && _cdl.handle(msg)) return;
        if (_tas && typeof msg.command === 'string' && msg.command.startsWith('tas') && _tas.handle(msg)) return;
        if (typeof msg.command === 'string' && msg.command.startsWith('scriptDebug') && _scriptDebug.handle(msg)) return;
        if (_memory.handle(msg)) return;
        if (_apu.handle(msg)) return;
        switch (msg.command) {
            case 'ready':
            _webviewReady = true;
            _apu.pageReady();
            _panel.webview.postMessage({ command: 'keepFocusOnBreak', on: _keepFocusSetting() });
            _panel.webview.postMessage({ command: 'emuSettings', settings: _state(SETTINGS_KEY, null) });
            _clearReadyTimeout();
            _log('Webview runtime ready');
            _notifyWebviewStatus('ok', 'Core runtime ready');
            _broadcastRomOffer();
            _dispatchPendingRom();
            _reopenLastRom();
                break;

            case 'loadVanillaRom': {
                const wsRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? null;
                // The vanilla ROM comes from the ROM library (src/core/roms).
                const v = getVanillaRom(wsRoot, '');
                if (v && v.available && v.path) {
                    recordRomUsage({ path: v.path, name: v.name, kind: 'vanilla' }, _context);
                    _sendRomFile(v.path);
                } else {
                    const platform = require('../../dist/platform');
                    const game = platform.selectedRom()?.game;
                    vscode.window.showErrorMessage(game ? platform.missingRomText(game) : 'No ROM in the ROM library. Add your own with Everscript: Switch ROM.');
                }
                break;
            }

            case 'loadRecentRom': {
                if (msg.path && fs.existsSync(msg.path)) {
                    recordRomUsage({ path: msg.path, name: msg.name, kind: msg.kind || 'file' }, _context);
                    _sendRomFile(msg.path);
                } else {
                    vscode.window.showErrorMessage(`ROM file not found: ${msg.path || msg.name || 'unknown'}`);
                    _broadcastRomOffer();
                }
                break;
            }

            case 'romDropped': {
                _log(`Dropped ROM: ${msg.name}`);
                recordRomUsage({
                    path: msg.path || '',
                    name: msg.name,
                    dataUrl: msg.dataUrl,
                    kind: 'dropped',
                    size: msg.size,
                }, _context);
                _broadcastRomOffer();
                break;
            }

            case 'clearRecentRoms': {
                clearRecentRoms(getStorageDir(_context));
                _broadcastRomOffer();
                break;
            }

            case 'webviewBoot':
              _log('Webview bootstrap running');
              break;

            case 'pickRom':
                vscode.window.showOpenDialog({
                    canSelectMany: false,
                    openLabel:     'Load ROM',
                    filters:       { 'SNES ROM': ['smc', 'sfc', 'fig', 'bin'] },
                }).then(uris => {
                    if (!uris || !uris.length) return;
                    _sendRomFile(uris[0].fsPath);
                });
                break;

            case 'gameStarted':
                _clearReadyTimeout();
                _clearRomTimeout();
              _log(`Emulator started: ${msg.name}`);
              _currentRomName = msg.name || '';
              _launchHistory.push({
                timestamp: new Date().toISOString(),
                name: msg.name || 'unknown',
                size: _currentRomBuffer ? _currentRomBuffer.length : null,
              });
              if (_launchHistory.length > 50) _launchHistory.shift();
              _notifyWebviewStatus('ok', `ROM started: ${msg.name}`);
                if (_pending) _pending = null;
                if (_cdl && _currentRomBuffer) _cdl.romStarted(_currentRomBuffer);
                if (_tas) _tas.romStarted(_currentRomBuffer);
                vscode.window.setStatusBarMessage(`$(check) Emulator: ${msg.name} running`, 5000);
                break;

            case 'emulatorCrash':
              _webviewReady = false;
              _clearReadyTimeout();
              _clearRomTimeout();
              _notifyWebviewStatus('error', `Emulator crash: ${msg.message || msg.error}`);
              _logCrash(msg);
              vscode.window.showErrorMessage(`Emulator crash: ${msg.message || msg.error}`, 'Show Crash Log').then(choice => {
                if (choice === 'Show Crash Log') {
                  const ch = _ensureEmulatorChannel();
                  if (ch) ch.show(true);
                }
              });
              break;

            case 'emulatorStderr':
              _log(`[core stderr] ${msg.text}`);
              break;

            case 'ejsError':
              _webviewReady = false;
              _clearReadyTimeout();
              _clearRomTimeout();
              _notifyWebviewStatus('error', `Emulator error: ${msg.error}`);
              _logCrash(msg);
              break;

            case 'romLoadLog':
              _log(`ROM load stage: ${msg.text}`);
              break;

            case 'debugApiStatus':
              _log(msg.text);
                break;

            case 'debugBreakpointHit':
                _log(`Breakpoint hit: ${msg.type} @ ${msg.address} pc=${msg.pc}`);
                break;

            case 'debugHookStatus':
              _log(msg.text);
              break;

            case 'debugHookObserved':
              _log(msg.text);
              break;

            case 'debugHookBreak':
              _log(msg.text);
              break;

            case 'scriptFocus':
              vscode.commands.executeCommand('everscript._scriptFocus', {
                address: msg.address || '',
                slot: typeof msg.slot === 'number' ? msg.slot : null,
                state: msg.state || '',
              });
              break;

            case 'byteScriptBreakpointHit':
              _log(`Byte-script breakpoint hit @ ${msg.address} slot=${msg.slot}`);
              vscode.commands.executeCommand('everscript._scriptFocus', {
                address: msg.address || '',
                slot: typeof msg.slot === 'number' ? msg.slot : null,
                state: 'breakpoint',
              });
              break;

            case 'setKeepFocusOnBreak':
              _saveState(KEEP_FOCUS_KEY, !!msg.on);
              break;

            case 'saveEmuSettings':
              if (msg.settings && typeof msg.settings === 'object') _saveState(SETTINGS_KEY, msg.settings);
              break;

            case 'exportBundle':
              if (_options.onExportBundle) _options.onExportBundle();
              break;

            case 'connectDebugger':
              // Attach a VS Code debug session to the running ROM (debugger/inline-adapter.js).
              Promise.resolve(vscode.commands.executeCommand('everscript.attachDebugger')).then(ok => {
                const text = ok ? 'VS Code debugger attached' : 'VS Code debugger not started';
                _log(text);
                if (_panel) _panel.webview.postMessage({ command: 'debuggerConnectionStatus', ok: !!ok, text });
              });
              break;

            case 'requestRoomMap':
              _handleRoomMapRequest(msg.mapId, msg.objectStates, msg.cutGrassTiles, msg.layered === true);
              break;

            case 'requestIdleSprites':
              if (_panel && _options.game) {
                const sprites = _options.game.idleSprites(_currentRomBuffer, msg.keys);
                if (sprites) _panel.webview.postMessage({ command: 'idleSprites', sprites });
              }
              break;

            case 'requestAlchemyIcons': {
              if (_currentRomBuffer && _panel && _options.game) {
                _panel.webview.postMessage({ command: 'alchemyIconsLoaded', alchemy: _options.game.alchemyIcons(_currentRomBuffer) || {} });
              }
              break;
            }

            case 'scriptTraceBatch': {
              const wsRoot = vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders[0]
                ? vscode.workspace.workspaceFolders[0].uri.fsPath
                : null;
              const formatted = _options.game ? _options.game.traceScripts(msg.items, _currentRomBuffer, wsRoot, _activeDraft) : [];
              if (_panel && formatted.length) {
                _panel.webview.postMessage({ command: 'scriptTraceLogged', entries: formatted });
              }
              for (const entry of formatted) {
                _scriptTraceHistory.push({
                  timestamp: new Date().toISOString(),
                  timeStr: entry.timeStr || '',
                  frame: entry.frame,
                  slot: entry.slot,
                  entity: entry.entity,
                  event: entry.event,
                  locHex: entry.locHex,
                  summary: entry.summary,
                  line: entry.line,
                  tag: entry.lookup ? entry.lookup.shortTag : '',
                });
                if (entry.lookup && entry.lookup.room !== undefined && entry.lookup.kind && (entry.event === 'start' || entry.event === 'exec')) {
                  vscode.commands.executeCommand('everscript._triggerExecuted', entry.lookup);
                }
              }
              while (_scriptTraceHistory.length > 2000) _scriptTraceHistory.shift();
              break;
            }
        }
    }, undefined, context.subscriptions);

    _resetPanelHtml();
    _log('Emulator panel opened');

    _panel.onDidDispose(() => {
      if (_cdl) { _cdl.dispose(); _cdl = null; }
      if (_tas) { _tas.dispose(); _tas = null; }
      _scriptDebug.panelClosed();
      _memory.reset('The emulator was closed');
      _apu.reset('The emulator was closed');
      _clearReadyTimeout();
      _clearRomTimeout();
      _webviewReady = false;
      _panel = null;
      _pending = null;
      _currentRomBuffer = null;
      _currentRomName = '';
      _activeDraft = null;
      _reopenTried = false;
      if (_options.game) _options.game.clearCaches();
    }, null, context.subscriptions);
}

/** reopenLastRom: the newest recent ROM file that still exists, once per panel. */
function _reopenLastRom() {
  if (!_options.reopenLastRom || _reopenTried || _pending || _currentRomBuffer) return;
  _reopenTried = true;
  try {
    const offer = getRomOfferData(_context, null, '');
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
        _currentRomBuffer = new Uint8Array(romData);
        const dataUrl = 'data:application/octet-stream;base64,' + romData.toString('base64');
        _pending = { dataUrl, name: romName };
        recordRomUsage({ path: romPath, name: romName, kind: 'file' }, _context);
        _broadcastRomOffer();
    if (!_dispatchPendingRom()) _resetPanelHtml();
    } catch (e) {
    _log('Failed to read ROM: ' + e.message, true);
        vscode.window.showErrorMessage('Failed to read ROM: ' + e.message);
    }
}

/** The map view asks for the room under the running game; the game adapter draws it. */
function _handleRoomMapRequest(mapId, objectStates, cutGrassTiles, layered) {
  if (!_panel || !_options.game) return;
  if (!_currentRomBuffer && _pending && typeof _pending.dataUrl === 'string') {
    const comma = _pending.dataUrl.indexOf(',');
    const b64 = comma >= 0 ? _pending.dataUrl.slice(comma + 1) : _pending.dataUrl;
    _currentRomBuffer = new Uint8Array(Buffer.from(b64, 'base64'));
  }
  const data = _options.game.roomMap(_currentRomBuffer, mapId, objectStates, cutGrassTiles, layered, _log);
  if (data) _panel.webview.postMessage(Object.assign({ command: 'roomMapRendered' }, data));
}

function injectEverscript(code) {
  if (_panel && _panel.webview) {
    _panel.webview.postMessage({ command: 'injectEverscript', code: code });
    return true;
  }
  return false;
}

/** The VS Code script debugger's bridge to the emulator (see script-debug-host.js). */
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
  if (_cdl) _cdl.flushNow();
}

/** The CDL library changed on disk (bundle import): the open panel reads it again. */
function reloadRecording() {
  if (_cdl) _cdl.reload();
}

/** Where recordings live: the CDL library root and the replays folder. */
function recordingFolders(context) {
  const storage = context.globalStorageUri ? context.globalStorageUri.fsPath : path.join(context.extensionPath, '.storage');
  return { storage, cdlRoot: path.join(storage, 'cdl-library'), replayDir: recordingsDir(storage) };
}

/** The ROM running in the emulator, or null. */
function getCurrentRom() { return _panel ? _currentRomBuffer : null; }

/** Bytes at a 24-bit bus address of the running game (soe://ram/). */
function readMemory(addr, len) { return _memory.read(addr, len); }

/** `closed` / `open` / `running`, the ROM and whether it is paused (soe://ram/status.json). */
async function getStatus() {
  if (!_panel) return { emulator: 'closed', rom: null, paused: null };
  const rom = _currentRomBuffer ? { name: _currentRomName || null, size: _currentRomBuffer.length } : null;
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
  isOpen: () => !!_panel,
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
