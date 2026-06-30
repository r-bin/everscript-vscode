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

const CORE_SUBDIR = path.join('src', 'emulator', 'core', 'snes9x2005-wasm-vanilla');
const CORE_JS     = 'snes9x_2005.js';
const CORE_WASM   = 'snes9x_2005.wasm';
const LEGACY_CUSTOM_CORE_DIRS = [
  path.join('debugger', 'core', 'snes9x2005-wasm'),
  path.join('debugger', 'core', 'snes9x'),
  path.join('src', 'emulator', 'core', 'snes9x2005-wasm'),
  path.join('src', 'emulator', 'core', 'snes9x'),
];

let _panel         = null;   // active WebviewPanel
let _pending       = null;   // { dataUrl, name } waiting to load
let _extensionPath = '';
let _buildChannel  = null;   // output channel for build log
let _readyTimeout  = null;
let _romTimeout    = null;
let _webviewReady  = false;

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
  _panel.webview.postMessage({
    command: 'loadRom',
    dataUrl: _pending.dataUrl,
    name: _pending.name,
  });
  return true;
}

function _findDebuggableEditor() {
  const seen = new Set();
  const editors = [vscode.window.activeTextEditor].concat(vscode.window.visibleTextEditors || []);
  for (const editor of editors) {
    if (!editor || !editor.document || editor.document.languageId !== 'everscript') continue;
    const key = editor.document.uri.toString();
    if (seen.has(key)) continue;
    seen.add(key);
    return editor;
  }
  return null;
}

function _findEnclosingFunction(document, lineIndex) {
  for (let line = Math.min(lineIndex, document.lineCount - 1); line >= 0; line--) {
    const text = document.lineAt(line).text.trimStart();
    const match = text.match(/^(?:@\w+\([^)]*\)\s*)*(?:fun|map)\s+(\w+)\s*\(/);
    if (match) return match[1];
  }
  return 'trigger_enter';
}

function _captureDebuggerLocation() {
  const editor = _findDebuggableEditor();
  if (!editor) return null;
  const line = editor.selection.active.line + 1;
  return {
    file: editor.document.uri.fsPath,
    line,
    name: _findEnclosingFunction(editor.document, line - 1),
  };
}

async function _ensureDebuggerSession() {
  if (vscode.debug.activeDebugSession && vscode.debug.activeDebugSession.type === 'everscript') {
    return vscode.debug.activeDebugSession;
  }
  const location = _captureDebuggerLocation();
  if (!location) return null;
  const started = await vscode.debug.startDebugging(undefined, {
    type: 'everscript',
    request: 'launch',
    name: 'Everscript Emulator Bridge',
    program: location.file,
    entryFunction: location.name || 'trigger_enter',
  });
  if (!started) return null;
  return vscode.debug.activeDebugSession && vscode.debug.activeDebugSession.type === 'everscript'
    ? vscode.debug.activeDebugSession
    : null;
}

async function _syncDebuggerFromEmulator(payload) {
  const session = await _ensureDebuggerSession();
  if (!session) return { ok: false, text: 'VS Code debugger not connected (open an .evs editor first)' };
  const location = _captureDebuggerLocation();
  if (!location) return { ok: false, text: 'No active .evs editor to anchor debugger location' };
  try {
    await session.customRequest('syncFromEmulator', {
      file: location.file,
      line: location.line,
      name: location.name,
      reason: payload.reason || 'breakpoint',
      details: payload.details || '',
    });
    return { ok: true, text: 'VS Code debugger synced to ' + path.basename(location.file) + ':' + location.line };
  } catch (err) {
    return { ok: false, text: 'Debugger sync failed: ' + err.message };
  }
}

function _remapLegacyCorePath(rawPath) {
  const normalized = path.normalize(rawPath);
  for (const legacyDir of LEGACY_CUSTOM_CORE_DIRS) {
    const legacyJs = path.normalize(path.join(_extensionPath, legacyDir, CORE_JS));
    if (normalized !== legacyJs) continue;
    const migrated = path.join(_extensionPath, 'src', 'emulator', 'core', 'snes9x2005-wasm', CORE_JS);
    if (fs.existsSync(migrated)) return migrated;
  }
  return rawPath;
}

/**
 * Resolve the snes9x core to use.
 * everscript.snesCorePath (if set) must point to a snes9x2005-wasm .js file.
 * Falls back to the bundled debugger/core/snes9x2005-wasm-vanilla/snes9x_2005.js.
 * Returns { path, wasmPath, label, warning? }.
 */
function _resolveCore() {
    const raw = vscode.workspace.getConfiguration('everscript').get('snesCorePath', '').trim();
    if (raw) {
    const configured = path.isAbsolute(raw) ? raw : path.resolve(raw);
    const resolved = _remapLegacyCorePath(configured);
        if (!fs.existsSync(resolved))
            return { path: '', wasmPath: '', label: '', warning: `snesCorePath "${raw}" does not exist` };
        if (!resolved.toLowerCase().endsWith('.js'))
            return { path: '', wasmPath: '', label: '', warning: `snesCorePath must point to a snes9x2005-wasm .js build, got "${path.extname(resolved)}"` };
        const wasmPath = path.join(path.dirname(resolved), CORE_WASM);
        if (!fs.existsSync(wasmPath)) {
          return { path: '', wasmPath: '', label: '', warning: `Custom core JS found but WASM missing: ${wasmPath}` };
        }
        return { path: resolved, wasmPath, label: path.basename(resolved), source: 'custom' };
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
    const html = buildHtml(_panel.webview, coreJsUri, coreWasmUri, core.label, core.path);
    // Log a snippet to help diagnose CSP / script-load issues.
    _log('HTML head snippet: ' + html.substring(0, 220).replace(/\s+/g, ' '));
    _panel.webview.html = html;
  _armReadyTimeout();
}

/**
 * Open (or reveal) the emulator panel.
 * @param {object} context   VS Code extension context.
 * @param {object} [rom]     Optional { dataUrl, name } to auto-load.
 * @param {object} [channel] Optional OutputChannel for build log.
 */
function openEmulatorPanel(context, rom, channel) {
    if (rom)     _pending      = rom;
    if (channel) _buildChannel = channel;
  _ensureBuildChannel();
    _extensionPath = context.extensionPath;

  if (_pending) {
    const size = _estimateDataUrlBytes(_pending.dataUrl);
    _log(`ROM staged: ${_pending.name || 'game'} (${size} bytes)`);
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

    _panel.webview.onDidReceiveMessage(msg => {
        switch (msg.command) {
            case 'ready':
            _webviewReady = true;
            _clearReadyTimeout();
            _log('Webview runtime ready');
            _notifyWebviewStatus('ok', 'Core runtime ready');
            _dispatchPendingRom();
                break;

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
              _notifyWebviewStatus('ok', `ROM started: ${msg.name}`);
                if (_pending) _pending = null;
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
              _syncDebuggerFromEmulator({
                reason: 'breakpoint',
                details: `${msg.type} @ ${msg.address} pc=${msg.pc}`,
              }).then(result => {
                _log(result.text);
                if (_panel) _panel.webview.postMessage({ command: 'debuggerConnectionStatus', ok: result.ok, text: result.text });
              });
                break;

            case 'debugHookStatus':
              _log(msg.text);
              break;

            case 'debugHookObserved':
              _log(msg.text);
              break;

            case 'debugHookBreak':
              _log(msg.text);
              _syncDebuggerFromEmulator({
                reason: 'breakpoint',
                details: msg.text,
              }).then(result => {
                _log(result.text);
                if (_panel) _panel.webview.postMessage({ command: 'debuggerConnectionStatus', ok: result.ok, text: result.text });
              });
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

            case 'connectDebugger':
              _ensureDebuggerSession().then(session => {
                const ok = !!session;
                const text = ok ? 'VS Code debugger connected' : 'Failed to connect VS Code debugger';
                _log(text);
                if (_panel) _panel.webview.postMessage({ command: 'debuggerConnectionStatus', ok, text });
              });
              break;
        }
    }, undefined, context.subscriptions);

    _resetPanelHtml();
    _log('Emulator panel opened');

    _panel.onDidDispose(() => {
      _clearReadyTimeout();
      _clearRomTimeout();
      _webviewReady = false;
      _panel = null;
      _pending = null;
    }, null, context.subscriptions);
}

/** Read a ROM file from disk and send it to the open webview. */
function _sendRomFile(romPath) {
    const romName = path.basename(romPath);
    try {
        const romData = fs.readFileSync(romPath);
        const dataUrl = 'data:application/octet-stream;base64,' + romData.toString('base64');
        _pending = { dataUrl, name: romName };
    _log(`Manual ROM selected: ${romName} (${romData.length} bytes)`);
    if (!_dispatchPendingRom()) _resetPanelHtml();
    } catch (e) {
    _log('Failed to read ROM: ' + e.message, true);
        vscode.window.showErrorMessage('Failed to read ROM: ' + e.message);
    }
}


module.exports = { openEmulatorPanel, sendRomFile: _sendRomFile };
