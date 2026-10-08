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
const { processScriptTraceBatch } = require('./script-trace');
const { CdlHost } = require('./cdl/host');
const { TasHost } = require('./tas/host');
const { ScriptDebugHost } = require('./script-debug-host');
const { MemoryBridge } = require('./memory-bridge');
const {
  getRomOfferData,
  recordRomUsage,
  getVanillaRom,
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
let _hideInactiveTrace = false; // filter inactive/end script events
let _extensionPath = '';
let _buildChannel  = null;   // output channel for build log
let _readyTimeout  = null;
let _romTimeout    = null;
let _webviewReady  = false;
const _roomMapCache = new Map();
let _cdl           = null;   // CdlHost: per-ROM code/data log library
let _tas           = null;   // TasHost: input recordings and replays
// VS Code script debugger hook: outlives the panel (a session can attach first).
const _scriptDebug = new ScriptDebugHost(m => { if (_panel) _panel.webview.postMessage(m); }, line => _log(line),
  () => _keepFocusAfterBreak());
// soe://ram/ reads: request/reply with the webview, which owns the core.
const _memory = new MemoryBridge(m => !!(_panel && _webviewReady && _panel.webview.postMessage(m) !== undefined));
// "BREAK: stay" chip: a debugger stop leaves the focus on the emulator (globalState).
const KEEP_FOCUS_KEY = 'everscript.emulator.keepFocusOnBreak';
const KEEP_FOCUS_MS = 2000;

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

function _log(line, show) {
  const ch = _ensureBuildChannel();
  ch.appendLine('[Everscript] ' + line);
  if (show) ch.show(true);
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
  if (!_pending || !_panel || !_webviewReady) return false;
  const romName = _pending.name || 'game';
  _log(`Sending ROM to webview: ${romName}`);
  _armRomTimeout(romName);
  let alchemyIcons = null;
  if (_currentRomBuffer) {
    try {
      const { buildItemIcons } = require('../rooms/data/item-icons');
      const icons = buildItemIcons(_currentRomBuffer);
      alchemyIcons = icons ? icons.alchemy : null;
    } catch (_) {}
  }
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
    let cfgRomPath = '';
    try { cfgRomPath = vscode.workspace.getConfiguration('everscript').get('romPath') || ''; } catch (_) {}
    const romOfferData = getRomOfferData(_context, wsRoot, cfgRomPath);
    const html = buildHtml(_panel.webview, coreJsUri, coreWasmUri, core.label, core.path, romOfferData);
    // Log a snippet to help diagnose CSP / script-load issues.
    _log('HTML head snippet: ' + html.substring(0, 220).replace(/\s+/g, ' '));
    _panel.webview.html = html;
  _armReadyTimeout();
}

function _broadcastRomOffer() {
  if (!_panel) return;
  try {
    const wsRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? null;
    let cfgRomPath = '';
    try { cfgRomPath = vscode.workspace.getConfiguration('everscript').get('romPath') || ''; } catch (_) {}
    const romOfferData = getRomOfferData(_context, wsRoot, cfgRomPath);
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
        _panel.reveal(vscode.ViewColumn.Beside, true);
    _log('Emulator panel reused');
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
        'Everscript Emulator',
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
    );
    _tas = new TasHost(
      context.globalStorageUri ? context.globalStorageUri.fsPath : path.join(context.extensionPath, '.storage'),
      m => { if (_panel) _panel.webview.postMessage(m); },
      _log,
    );

    _panel.webview.onDidReceiveMessage(msg => {
        if (_cdl && typeof msg.command === 'string' && msg.command.startsWith('cdl') && _cdl.handle(msg)) return;
        if (_tas && typeof msg.command === 'string' && msg.command.startsWith('tas') && _tas.handle(msg)) return;
        if (typeof msg.command === 'string' && msg.command.startsWith('scriptDebug') && _scriptDebug.handle(msg)) return;
        if (_memory.handle(msg)) return;
        switch (msg.command) {
            case 'ready':
            _webviewReady = true;
            _panel.webview.postMessage({ command: 'keepFocusOnBreak', on: _keepFocusSetting() });
            _clearReadyTimeout();
            _log('Webview runtime ready');
            _notifyWebviewStatus('ok', 'Core runtime ready');
            _broadcastRomOffer();
            _dispatchPendingRom();
                break;

            case 'getRomOfferInfo':
                _broadcastRomOffer();
                break;

            case 'loadVanillaRom': {
                const wsRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? null;
                let cfgRomPath = '';
                try { cfgRomPath = vscode.workspace.getConfiguration('everscript').get('romPath') || ''; } catch (_) {}
                const v = getVanillaRom(wsRoot, cfgRomPath);
                if (v && v.available && v.path) {
                    recordRomUsage({ path: v.path, name: v.name, kind: 'vanilla' }, _context);
                    _sendRomFile(v.path);
                } else {
                    vscode.window.showErrorMessage('Vanilla Secret of Evermore ROM not found. Please set everscript.romPath in settings.');
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

            case 'wramDelta':
                // Reserved - forward to Memory Radar live mode.
                break;

            case 'gameStarted':
                _clearReadyTimeout();
                _clearRomTimeout();
              _log(`Emulator started: ${msg.name}`);
              _currentRomName = msg.name || '';
              _notifyWebviewStatus('ok', `ROM started: ${msg.name}`);
                if (_pending) _pending = null;
                if (_cdl && _currentRomBuffer) _cdl.romStarted(_currentRomBuffer);
                if (_tas) _tas.romStarted(_currentRomBuffer);
                vscode.window.setStatusBarMessage(`$(check) Emulator: ${msg.name} running`, 5000);
                break;

            case 'ejsError':
              _webviewReady = false;
              _clearReadyTimeout();
              _clearRomTimeout();
              _log(`Emulator error: ${msg.error}`, true);
              _notifyWebviewStatus('error', `Emulator error: ${msg.error}`);
              vscode.window.showErrorMessage(`Everscript Emulator: ${msg.error}`);
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
              if (_context && _context.globalState) _context.globalState.update(KEEP_FOCUS_KEY, !!msg.on);
              break;

            case 'connectDebugger':
              // Attach a VS Code debug session to the running ROM (debugger/inline-adapter.js).
              Promise.resolve(vscode.commands.executeCommand('everscript.attachDebugger')).then(ok => {
                const text = ok ? 'VS Code debugger attached' : 'VS Code debugger not started';
                _log(text);
                if (_panel) _panel.webview.postMessage({ command: 'debuggerConnectionStatus', ok: !!ok, text });
              });
              break;

            case 'setHideInactiveTrace':
              _hideInactiveTrace = !!msg.hideInactive;
              break;

            case 'requestRoomMap':
              _handleRoomMapRequest(msg.mapId, msg.objectStates, msg.cutGrassTiles, msg.layered === true);
              break;

            case 'requestIdleSprites':
              _handleIdleSprites(msg.keys);
              break;

            case 'requestAlchemyIcons': {
              if (_currentRomBuffer && _panel) {
                try {
                  const { buildItemIcons } = require('../rooms/data/item-icons');
                  const icons = buildItemIcons(_currentRomBuffer);
                  _panel.webview.postMessage({ command: 'alchemyIconsLoaded', alchemy: icons ? icons.alchemy : {} });
                } catch (_) {}
              }
              break;
            }

            case 'scriptTraceBatch': {
              const wsRoot = vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders[0]
                ? vscode.workspace.workspaceFolders[0].uri.fsPath
                : null;
              const formatted = processScriptTraceBatch(msg.items, _currentRomBuffer, wsRoot, _activeDraft, {
                hideInactive: _hideInactiveTrace,
              });
              if (_panel && formatted.length) {
                _panel.webview.postMessage({ command: 'scriptTraceLogged', entries: formatted });
              }
              for (const entry of formatted) {
                if (entry.lookup && entry.lookup.room !== undefined && entry.lookup.kind && (entry.event === 'start' || entry.event === 'exec')) {
                  vscode.commands.executeCommand('everscript._triggerExecuted', entry.lookup);
                }
              }
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
      _clearReadyTimeout();
      _clearRomTimeout();
      _webviewReady = false;
      _panel = null;
      _pending = null;
      _currentRomBuffer = null;
      _currentRomName = '';
      _activeDraft = null;
      _roomMapCache.clear();
    }, null, context.subscriptions);
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
    _log(`Manual ROM selected: ${romName} (${romData.length} bytes)`);
    if (!_dispatchPendingRom()) _resetPanelHtml();
    } catch (e) {
    _log('Failed to read ROM: ' + e.message, true);
        vscode.window.showErrorMessage('Failed to read ROM: ' + e.message);
    }
}

function _applyCutGrass(room, cutTiles) {
    if (!room || !room.cuttableGrass || !room.cuttableGrass.table || !room.cuttableGrass.table.swaps) return room;
    const swaps = room.cuttableGrass.table.swaps;
    if (!swaps.size || !cutTiles || !cutTiles.length) return room;

    const wTiles = room.header.widthTiles;
    const hTiles = room.header.heightTiles;
    const meta = room.layer1MetatileIds.map(r => r.slice());
    let touched = false;

    for (let i = 0; i < cutTiles.length; i++) {
        const t = cutTiles[i];
        let tx = 0, ty = 0;
        if (typeof t === 'string') {
            const parts = t.split(',');
            tx = parseInt(parts[0], 10);
            ty = parseInt(parts[1], 10);
        } else if (Array.isArray(t)) {
            tx = t[0];
            ty = t[1];
        } else if (t && typeof t.x === 'number') {
            tx = t.x;
            ty = t.y;
        }
        if (isNaN(tx) || isNaN(ty) || tx < 0 || tx >= wTiles || ty < 0 || ty >= hTiles) continue;
        const curMeta = meta[ty][tx];
        const newMeta = swaps.get(curMeta);
        if (newMeta !== undefined && newMeta !== curMeta) {
            meta[ty][tx] = newMeta;
            touched = true;
        }
    }
    if (!touched) return room;

    const s = room.metatileSlices;
    function resolve(metaId) {
        const idx = Math.floor((metaId - room.baseMetatile) / 8);
        if (idx < 0 || idx >= room.metatileCount) return { l1: 0, l2: 0, coll: 0 };
        return { l1: s.layer1[idx] != null ? s.layer1[idx] : 0, l2: s.layer2[idx] != null ? s.layer2[idx] : 0, coll: s.collision[idx] != null ? s.collision[idx] : 0 };
    }

    const l1 = room.layer1VramWords.map(r => r.slice());
    const l2 = room.layer2VramWords.map(r => r.slice());
    const coll = room.collisionWords.map(r => r.slice());
    for (let y = 0; y < hTiles; y++) {
        for (let x = 0; x < wTiles; x++) {
            if (meta[y][x] === room.layer1MetatileIds[y][x]) continue;
            const r = resolve(meta[y][x]);
            l1[y][x] = r.l1;
            l2[y][x] = r.l2;
            coll[y][x] = r.coll;
        }
    }

    return Object.assign({}, room, {
        layer1MetatileIds: meta,
        layer1VramWords: l1,
        layer2VramWords: l2,
        collisionWords: coll,
    });
}

function _scale2x(pb) {
    if (!pb || !pb.data) return pb;
    const w = pb.width;
    const h = pb.height;
    const src = pb.data;
    const dst = new Uint8Array(w * 2 * h * 2 * 4);
    const dstStride = w * 2 * 4;
    for (let y = 0; y < h; y++) {
        const srcRow = y * w * 4;
        const dstRow0 = (y * 2) * dstStride;
        const dstRow1 = (y * 2 + 1) * dstStride;
        for (let x = 0; x < w; x++) {
            const si = srcRow + x * 4;
            const r = src[si];
            const g = src[si + 1];
            const b = src[si + 2];
            const a = src[si + 3];

            const di0 = dstRow0 + (x * 2) * 4;
            dst[di0] = r; dst[di0 + 1] = g; dst[di0 + 2] = b; dst[di0 + 3] = a;
            dst[di0 + 4] = r; dst[di0 + 5] = g; dst[di0 + 6] = b; dst[di0 + 7] = a;

            const di1 = dstRow1 + (x * 2) * 4;
            dst[di1] = r; dst[di1 + 1] = g; dst[di1 + 2] = b; dst[di1 + 3] = a;
            dst[di1 + 4] = r; dst[di1 + 5] = g; dst[di1 + 6] = b; dst[di1 + 7] = a;
        }
    }
    return { width: w * 2, height: h * 2, data: dst };
}

function _alignPixelsToSnes(pb) {
    if (!pb || !pb.data) return pb;
    const d = pb.data;
    for (let i = 0; i < d.length; i += 4) {
        d[i]     &= 0xf8;
        d[i + 1] &= 0xfc;
        d[i + 2] &= 0xf8;
    }
    return pb;
}

function _hasOpaquePixel(pb) {
    const d = pb.data;
    for (let i = 3; i < d.length; i += 4) if (d[i]) return true;
    return false;
}

// `layered`: the webview has seen BG1 scroll apart from the camera in this
// room (parallax), so it also needs each layer on its own - see renderRoomLayers.
function _handleRoomMapRequest(mapId, objectStates, cutGrassTiles, layered) {
    if (!_panel || typeof mapId !== 'number') return;
    const objKey = objectStates ? JSON.stringify(objectStates) : '';
    const grassKey = cutGrassTiles && cutGrassTiles.length ? JSON.stringify(cutGrassTiles) : '';
    const cacheKey = mapId + ':' + objKey + ':' + grassKey + (layered ? ':layered' : '');

    if (_roomMapCache.has(cacheKey)) {
        const cached = _roomMapCache.get(cacheKey);
        _panel.webview.postMessage(Object.assign({ command: 'roomMapRendered' }, cached));
        return;
    }
    if (!_currentRomBuffer && _pending && typeof _pending.dataUrl === 'string') {
        const comma = _pending.dataUrl.indexOf(',');
        const b64 = comma >= 0 ? _pending.dataUrl.slice(comma + 1) : _pending.dataUrl;
        _currentRomBuffer = new Uint8Array(Buffer.from(b64, 'base64'));
    }
    if (!_currentRomBuffer) return;
    try {
        const maps = require('../maps');
        const rom = (_currentRomBuffer.length % 1024 === 512) ? _currentRomBuffer.subarray(512) : _currentRomBuffer;
        const room = maps.decodeRoom(rom, mapId);
        if (!room) return;

        let staged = room;
        if (objectStates && typeof maps.applyObjectStates === 'function') {
            staged = maps.applyObjectStates(rom, staged, objectStates);
        }
        if (cutGrassTiles && cutGrassTiles.length) {
            staged = _applyCutGrass(staged, cutGrassTiles);
        }

        const composite = maps.renderRoomComposite(rom, staged);
        if (!composite) return;
        _alignPixelsToSnes(composite);
        const comp2x = _scale2x(composite);
        const imageUri = maps.encodePngDataUri(comp2x);

        let foregroundUri = null;
        try {
            let fg = maps.renderRoomForeground(rom, staged);
            if (fg) {
                if (room.animation && room.animation.length) {
                    fg = maps.clearAnimatedCells(fg, staged);
                }
                _alignPixelsToSnes(fg);
                const fg2x = _scale2x(fg);
                foregroundUri = maps.encodePngDataUri(fg2x);
            }
        } catch (_) {}

        let collisionUri = null;
        try {
            const wTiles = room.header.widthTiles;
            const hTiles = room.header.heightTiles;
            const collImg = maps.overlayLayer(wTiles * 16, hTiles * 16, img => {
                maps.drawCollisionOverlay(img, staged, {
                    contours: true,
                    tiles: false,
                    drift: false,
                    transparent: false,
                    elevation: false,
                    gates: false,
                    grass: false,
                    objects: false,
                    triggers: false,
                    labels: false,
                });
            });
            if (collImg && _hasOpaquePixel(collImg)) {
                _alignPixelsToSnes(collImg);
                const coll2x = _scale2x(collImg);
                collisionUri = maps.encodePngDataUri(coll2x);
            }
        } catch (_) {}

        let animGroups = [];
        try {
            const encodeFrame = f => {
                _alignPixelsToSnes(f);
                return maps.encodePngDataUri(_scale2x(f));
            };
            const rawGroups = maps.buildAnimationGroups(rom, staged);
            // The same cells, priority half only: the webview lays these over
            // the characters, so a full composite frame there would paint the
            // terrain over every sprite standing on an animated tile.
            // Grouping walks the same cells in the same order, so group i of
            // one list is group i of the other.
            const fgGroups = maps.buildAnimationGroups(rom, staged, { layer: 'foreground' });
            const fgAligned = fgGroups.length === rawGroups.length;
            animGroups = rawGroups.map((g, i) => {
                const fg = fgAligned ? fgGroups[i] : null;
                const fgUsed = fg && fg.frames.some(f => _hasOpaquePixel(f));
                return {
                    x: g.x * 16,
                    y: g.y * 16,
                    w: g.w * 16,
                    h: g.h * 16,
                    delays: g.delaysMs,
                    // The webview steps each group from the engine's own
                    // per-channel frame index ($7E4FE6 + channel).
                    channels: g.channels,
                    chanLens: g.channels.map(c => staged.animation[c].frames.length),
                    frames: g.frames.map(encodeFrame),
                    fgFrames: fgUsed ? fg.frames.map(encodeFrame) : null,
                };
            });
        } catch (_) {}

        let layers = null;
        if (layered) {
            try {
                const encodeLayer = img => {
                    if (!_hasOpaquePixel(img)) return null;
                    _alignPixelsToSnes(img);
                    return maps.encodePngDataUri(_scale2x(img));
                };
                const split = maps.renderRoomLayers(rom, staged);
                layers = {
                    bg1Low: encodeLayer(split.bg1.low),
                    bg1High: encodeLayer(split.bg1.high),
                    bg2Low: encodeLayer(split.bg2.low),
                    bg2High: encodeLayer(split.bg2.high),
                };
            } catch (_) {}
        }

        // The room's own BG colours as 15-bit CGRAM words (0..127). The webview
        // compares the engine's CGRAM mirror against these to follow palette
        // dimming (ring menu) on the extended layers.
        let bgPalette = null;
        try {
            bgPalette = [];
            for (const pal of maps.buildRoomCgramPalettes(rom, staged.tileFamilies)) {
                for (const c of pal) bgPalette.push((c[0] >> 3) | ((c[1] >> 3) << 5) | ((c[2] >> 3) << 10));
            }
        } catch (_) { bgPalette = null; }

        const roomObjects = [];
        try {
            if (room.objects && room.objects.length) {
                for (let i = 0; i < room.objects.length; i++) {
                    const obj = room.objects[i];
                    const box = maps.objectBounds(rom, room, obj);
                    if (!box || box.w <= 0 || box.h <= 0) continue;
                    const states = [];
                    for (let s = 0; s < obj.states.length; s++) {
                        const st = obj.states[s];
                        const stamp = maps.parseObjectStamp(rom, room.objectArea, st.metatileId);
                        states.push({
                            state: st.state,
                            hold: st.hold,
                            x: st.tileX * 16,
                            y: st.tileY * 16,
                            w: (stamp.valid ? stamp.tw : st.targetWidth) * 16,
                            h: (stamp.valid ? stamp.th : st.targetHeight) * 16,
                        });
                    }
                    roomObjects.push({
                        index: obj.objectIndex,
                        x: box.x * 16,
                        y: box.y * 16,
                        w: box.w * 16,
                        h: box.h * 16,
                        states: states,
                    });
                }
            }
        } catch (_) {}

        const animTileClusters = [];
        try {
            if (room.animation && room.animation.length) {
                const wTiles = room.header.widthTiles;
                const hTiles = room.header.heightTiles;
                const cellMap = new Map();
                for (let y = 0; y < hTiles; y++) {
                    for (let x = 0; x < wTiles; x++) {
                        const chans = maps.cellChannels(room, x, y, 'composite');
                        if (chans && chans.length) {
                            cellMap.set(x + ',' + y, chans[0]);
                        }
                    }
                }
                const unvisited = new Set(cellMap.keys());
                for (const key of cellMap.keys()) {
                    if (!unvisited.has(key)) continue;
                    const chan = cellMap.get(key);
                    const clusterKeys = [];
                    const queue = [key];
                    unvisited.delete(key);
                    while (queue.length > 0) {
                        const cur = queue.pop();
                        clusterKeys.push(cur);
                        const [cx, cy] = cur.split(',').map(Number);
                        const neighbors = [
                            cx + ',' + (cy - 1),
                            cx + ',' + (cy + 1),
                            (cx - 1) + ',' + cy,
                            (cx + 1) + ',' + cy,
                        ];
                        for (const n of neighbors) {
                            if (unvisited.has(n) && cellMap.get(n) === chan) {
                                unvisited.delete(n);
                                queue.push(n);
                            }
                        }
                    }
                    const parsedCells = clusterKeys.map(k => {
                        const [cx, cy] = k.split(',').map(Number);
                        return { x: cx, y: cy };
                    });
                    parsedCells.sort((a, b) => a.y !== b.y ? a.y - b.y : a.x - b.x);

                    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
                    for (const c of parsedCells) {
                        if (c.x < minX) minX = c.x;
                        if (c.x > maxX) maxX = c.x;
                        if (c.y < minY) minY = c.y;
                        if (c.y > maxY) maxY = c.y;
                    }
                    const isRect = parsedCells.length === (maxX - minX + 1) * (maxY - minY + 1);
                    const letter = String.fromCharCode(65 + (chan % 26));

                    animTileClusters.push({
                        channel: chan,
                        letter: letter,
                        cells: parsedCells.map(c => ({ x: c.x * 16, y: c.y * 16 })),
                        cellCoords: parsedCells,
                        bbox: {
                            x: minX * 16,
                            y: minY * 16,
                            w: (maxX - minX + 1) * 16,
                            h: (maxY - minY + 1) * 16,
                        },
                        isRect: isRect,
                        first: { x: parsedCells[0].x * 16, y: parsedCells[0].y * 16 },
                    });
                }
            }
        } catch (_) {}

        const data = {
            mapId: mapId,
            imageUri: imageUri,
            foregroundUri: foregroundUri,
            collisionUri: collisionUri,
            layers: layers,
            bgPalette: bgPalette,
            animGroups: animGroups,
            width: composite.width,
            height: composite.height,
            offX: room.header.originX,
            offY: room.header.originY,
            objects: roomObjects,
            animTiles: animTileClusters,
        };
        _roomMapCache.set(cacheKey, data);
        _panel.webview.postMessage(Object.assign({ command: 'roomMapRendered' }, data));
    } catch (err) {
        _log('Room map render unavailable for map ' + mapId + ': ' + (err.message || err));
    }
}

// An entity the engine has spawned but not activated yet (it waits in the
// inactive list, $3DE1, until the camera comes near) has no sprite: its
// animation has never run. The webview asks for its standing sprite instead,
// keyed "type:facing" (type = entity +0x60, the character record address).
const CHARACTER_TABLE = 0x8eb678;
const CHARACTER_STRIDE = 74;
function _handleIdleSprites(keys) {
    if (!_panel || !_currentRomBuffer || !Array.isArray(keys)) return;
    const maps = require('../maps');
    const rom = (_currentRomBuffer.length % 1024 === 512) ? _currentRomBuffer.subarray(512) : _currentRomBuffer;
    const sprites = {};
    for (const key of keys.slice(0, 64)) {
        const [type, facing] = String(key).split(':').map(Number);
        const offset = (0x8e0000 | type) - CHARACTER_TABLE;
        let entry = null;
        if (offset >= 0 && offset % CHARACTER_STRIDE === 0) {
            const character = offset / CHARACTER_STRIDE;
            try {
                const sprite = maps.resolveCharacterSprite(rom, character, facing & 0x0e) || maps.resolveCharacterSprite(rom, character);
                if (sprite) entry = { sprite, palette: maps.characterPaletteAddress(rom, character) };
            } catch (_) { entry = null; }
        }
        sprites[key] = entry;
    }
    _panel.webview.postMessage({ command: 'idleSprites', sprites });
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

module.exports = { openEmulatorPanel, sendRomFile: _sendRomFile, injectEverscript, getScriptDebugBridge, runRomFile, getCurrentRom, readMemory, getStatus };
