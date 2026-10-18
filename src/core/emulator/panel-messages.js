'use strict';
// Ownership: everything the emulator page sends the host: readiness, ROM load stages, crashes and stderr,
// CDL / REPLAYS / script debugger traffic, the game's requests (room maps, sprites, traces), settings.
// State and helpers: panel-state.js.

const vscode = require('vscode');
const fs     = require('fs');
const { ensureEmulatorChannel: _ensureEmulatorChannel, log: _log, logCrash, launchHistory: _launchHistory, scriptTraceHistory: _scriptTraceHistory } = require('../../../dist/core/emulator/emulator-log');
const { recordRomUsage, getVanillaRom, clearRecentRoms, getStorageDir } = require('../../../dist/core/emulator/rom-history');
const { emu, _scriptDebug, _apu, _memory, KEEP_FOCUS_KEY, SETTINGS_KEY, _state, _saveState, _keepFocusSetting, _notifyWebviewStatus, _clearReadyTimeout, _clearRomTimeout, _dispatchPendingRom, _broadcastRomOffer, _reopenLastRom, _sendRomFile, _handleRoomMapRequest } = require('./panel-state');

/** Everything the page sends: readiness, ROM load stages, crashes, CDL / REPLAYS / debugger traffic, the game's requests. */
function onWebviewMessage(msg) {
    if (emu.cdl && typeof msg.command === 'string' && msg.command.startsWith('cdl') && emu.cdl.handle(msg)) return;
    if (emu.tas && typeof msg.command === 'string' && msg.command.startsWith('tas') && emu.tas.handle(msg)) return;
    if (typeof msg.command === 'string' && msg.command.startsWith('scriptDebug') && _scriptDebug.handle(msg)) return;
    if (_memory.handle(msg)) return;
    if (_apu.handle(msg)) return;
    switch (msg.command) {
        case 'ready':
        emu.webviewReady = true;
        _apu.pageReady();
        emu.panel.webview.postMessage({ command: 'keepFocusOnBreak', on: _keepFocusSetting() });
        emu.panel.webview.postMessage({ command: 'emuSettings', settings: _state(SETTINGS_KEY, null) });
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
                recordRomUsage({ path: v.path, name: v.name, kind: 'vanilla' }, emu.context);
                _sendRomFile(v.path);
            } else {
                const platform = require('../../../dist/platform');
                const game = platform.selectedRom()?.game;
                vscode.window.showErrorMessage(game ? platform.missingRomText(game) : 'No ROM in the ROM library. Add your own with Everscript: Switch ROM.');
            }
            break;
        }

        case 'loadRecentRom': {
            if (msg.path && fs.existsSync(msg.path)) {
                recordRomUsage({ path: msg.path, name: msg.name, kind: msg.kind || 'file' }, emu.context);
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
            }, emu.context);
            _broadcastRomOffer();
            break;
        }

        case 'clearRecentRoms': {
            clearRecentRoms(getStorageDir(emu.context));
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
          emu.currentRomName = msg.name || '';
          _launchHistory.push({
            timestamp: new Date().toISOString(),
            name: msg.name || 'unknown',
            size: emu.currentRomBuffer ? emu.currentRomBuffer.length : null,
          });
          if (_launchHistory.length > 50) _launchHistory.shift();
          _notifyWebviewStatus('ok', `ROM started: ${msg.name}`);
            if (emu.pending) emu.pending = null;
            if (emu.cdl && emu.currentRomBuffer) emu.cdl.romStarted(emu.currentRomBuffer);
            if (emu.tas) emu.tas.romStarted(emu.currentRomBuffer);
            vscode.window.setStatusBarMessage(`$(check) Emulator: ${msg.name} running`, 5000);
            break;

        case 'emulatorCrash':
          emu.webviewReady = false;
          _clearReadyTimeout();
          _clearRomTimeout();
          _notifyWebviewStatus('error', `Emulator crash: ${msg.message || msg.error}`);
          logCrash(msg, emu.currentRomName);
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
          emu.webviewReady = false;
          _clearReadyTimeout();
          _clearRomTimeout();
          _notifyWebviewStatus('error', `Emulator error: ${msg.error}`);
          logCrash(msg, emu.currentRomName);
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
          if (emu.options.onExportBundle) emu.options.onExportBundle();
          break;

        case 'connectDebugger':
          // Attach a VS Code debug session to the running ROM (debugger/inline-adapter.js).
          Promise.resolve(vscode.commands.executeCommand('everscript.attachDebugger')).then(ok => {
            const text = ok ? 'VS Code debugger attached' : 'VS Code debugger not started';
            _log(text);
            if (emu.panel) emu.panel.webview.postMessage({ command: 'debuggerConnectionStatus', ok: !!ok, text });
          });
          break;

        case 'requestRoomMap':
          _handleRoomMapRequest(msg.mapId, msg.objectStates, msg.cutGrassTiles, msg.layered === true);
          break;

        case 'requestIdleSprites':
          if (emu.panel && emu.options.game) {
            const sprites = emu.options.game.idleSprites(emu.currentRomBuffer, msg.keys);
            if (sprites) emu.panel.webview.postMessage({ command: 'idleSprites', sprites });
          }
          break;

        case 'requestGameRomData': {
          if (emu.currentRomBuffer && emu.panel && emu.options.game && emu.options.game.romData) {
            emu.panel.webview.postMessage({ command: 'gameRomData', data: emu.options.game.romData(emu.currentRomBuffer) || {} });
          }
          break;
        }

        case 'scriptTraceBatch': {
          const wsRoot = vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders[0]
            ? vscode.workspace.workspaceFolders[0].uri.fsPath
            : null;
          const formatted = emu.options.game ? emu.options.game.traceScripts(msg.items, emu.currentRomBuffer, wsRoot, emu.activeDraft) : [];
          if (emu.panel && formatted.length) {
            emu.panel.webview.postMessage({ command: 'scriptTraceLogged', entries: formatted });
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
}

module.exports = { onWebviewMessage };
