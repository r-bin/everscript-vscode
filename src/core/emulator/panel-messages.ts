// Ownership: everything the emulator page sends the host: readiness, ROM load stages, crashes and stderr,
// CDL / REPLAYS / script debugger traffic, the game's requests (room maps, sprites, traces), settings.
// State and helpers: panel-state.ts.

import * as vscode from 'vscode';
import * as fs from 'fs';
import { ensureEmulatorChannel as _ensureEmulatorChannel, log as _log, logCrash, launchHistory as _launchHistory, scriptTraceHistory as _scriptTraceHistory } from './emulator-log';
import type { CrashReport } from './emulator-log';
import { recordRomUsage, getVanillaRom, clearRecentRoms, getStorageDir, savePersistentSram } from './rom-history';
import { emu, _scriptDebug, _apu, _memory, KEEP_FOCUS_KEY, SETTINGS_KEY, ALWAYS_RECORD_KEY, OPEN_MODE_KEY, _state, _saveState, _keepFocusSetting, _notifyWebviewStatus, _clearReadyTimeout, _clearRomTimeout, _dispatchPendingRom, _broadcastRomOffer, _reopenLastRom, _sendRomFile, _playReplay, _handleRoomMapRequest, _resetPanelHtml } from './panel-state';

/** Everything the page sends: readiness, ROM load stages, crashes, CDL / REPLAYS / debugger traffic, the game's requests. */
/** A message from the page: the command and its fields (the wire format is the page's, see webview/page/). */
interface PageMessage { command: string; [key: string]: any }

function onWebviewMessage(msg: PageMessage) {
    if (emu.cdl && typeof msg.command === 'string' && msg.command.startsWith('cdl') && emu.cdl.handle(msg)) return;
    if (emu.tas && typeof msg.command === 'string' && msg.command.startsWith('tas') && emu.tas.handle(msg)) return;
    if (typeof msg.command === 'string' && msg.command.startsWith('scriptDebug') && _scriptDebug.handle(msg)) return;
    if (_memory.handle(msg)) return;
    if (_apu.handle(msg)) return;
    switch (msg.command) {
        // The page heard nothing from this host for a while and paused the game (session-watch.ts):
        // the host was busy, or it is the page another host left.
        case 'hostLost':
            _log(`The page heard nothing from the extension host for ${Math.round((msg.silentMs || 0) / 1000)} s and paused the game`, true);
            break;

        // Once a minute while a ROM runs (webview/fps.js): how fast it really ran, for reports of a wrong speed.
        case 'emuPace':
            _log(`Pace: ${msg.fps} FPS at speed ${msg.speed}x (${msg.ratio}x real), screen ~${msg.hz} Hz, sound ${msg.soundMs} ms behind`);
            break;

        case 'ready':
        emu.webviewReady = true;
        _apu.pageReady();
        emu.panel?.webview.postMessage({ command: 'keepFocusOnBreak', on: _keepFocusSetting() });
        emu.panel?.webview.postMessage({ command: 'emuSettings', settings: _state(SETTINGS_KEY, null) });
        _clearReadyTimeout();
        _log('Webview runtime ready');
        _notifyWebviewStatus('ok', 'Core runtime ready');
        _broadcastRomOffer();
        _dispatchPendingRom();
        _reopenLastRom();
            break;

        case 'setSessionSettings': {
            if (msg.core) emu.sessionCore = msg.core;
            if (msg.preset) emu.sessionPreset = msg.preset;
            if (msg.sramMode === 'default' || msg.sramMode === 'individual') {
                emu.sessionSramMode = msg.sramMode;
                emu.sessionIsolatedSram = (msg.sramMode === 'individual');
            } else if (typeof msg.isolatedSram === 'boolean') {
                emu.sessionIsolatedSram = msg.isolatedSram;
                emu.sessionSramMode = msg.isolatedSram ? 'individual' : 'default';
            }
            if (typeof msg.alwaysRecord === 'boolean') {
                emu.sessionAlwaysRecord = msg.alwaysRecord;
                _saveState(ALWAYS_RECORD_KEY, msg.alwaysRecord);
            }
            if (msg.openMode === 'new' || msg.openMode === 'continue') {
                emu.sessionOpenMode = msg.openMode;
                _saveState(OPEN_MODE_KEY, msg.openMode);
            }
            break;
        }

        case 'saveSram': {
            const isCdl = emu.sessionPreset === 'cdl';
            const effectiveSramMode = isCdl ? 'individual' : (emu.sessionSramMode || (emu.sessionIsolatedSram ? 'individual' : 'default'));
            if (effectiveSramMode === 'default' && msg.hash && msg.data) {
                savePersistentSram(getStorageDir(emu.context), msg.hash, msg.data);
            }
            break;
        }

        case 'loadVanillaRom': {
            if (msg.core) emu.sessionCore = msg.core;
            if (msg.preset) emu.sessionPreset = msg.preset;
            if (msg.sramMode === 'default' || msg.sramMode === 'individual') {
                emu.sessionSramMode = msg.sramMode;
                emu.sessionIsolatedSram = (msg.sramMode === 'individual');
            } else if (typeof msg.isolatedSram === 'boolean') {
                emu.sessionIsolatedSram = msg.isolatedSram;
                emu.sessionSramMode = msg.isolatedSram ? 'individual' : 'default';
            }
            if (typeof msg.alwaysRecord === 'boolean') {
                emu.sessionAlwaysRecord = msg.alwaysRecord;
                _saveState(ALWAYS_RECORD_KEY, msg.alwaysRecord);
            }
            const wsRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? null;
            // The vanilla ROM comes from the ROM library (src/core/roms).
            const v = getVanillaRom(wsRoot, '');
            if (v && v.available && v.path) {
                // The ROM picker may ask to continue one of its sessions once it has booted.
                emu.pendingResume = typeof msg.resume === 'string' && msg.resume ? msg.resume : null;
                recordRomUsage({ path: v.path, name: v.name, kind: 'vanilla' }, emu.context);
                _sendRomFile(v.path);
            } else {
                const platform = require('../../platform');
                const game = platform.selectedRom()?.game;
                vscode.window.showErrorMessage(game ? platform.missingRomText(game) : 'No ROM in the ROM library. Add your own with Everscript: Switch ROM.');
            }
            break;
        }

        case 'loadRecentRom': {
            if (msg.core) emu.sessionCore = msg.core;
            if (msg.preset) emu.sessionPreset = msg.preset;
            if (msg.sramMode === 'default' || msg.sramMode === 'individual') {
                emu.sessionSramMode = msg.sramMode;
                emu.sessionIsolatedSram = (msg.sramMode === 'individual');
            } else if (typeof msg.isolatedSram === 'boolean') {
                emu.sessionIsolatedSram = msg.isolatedSram;
                emu.sessionSramMode = msg.isolatedSram ? 'individual' : 'default';
            }
            if (typeof msg.alwaysRecord === 'boolean') {
                emu.sessionAlwaysRecord = msg.alwaysRecord;
                _saveState(ALWAYS_RECORD_KEY, msg.alwaysRecord);
            }
            if (msg.path && fs.existsSync(msg.path)) {
                emu.pendingResume = typeof msg.resume === 'string' && msg.resume ? msg.resume : null;
                recordRomUsage({ path: msg.path, name: msg.name, kind: msg.kind || 'file' }, emu.context);
                _sendRomFile(msg.path);
            } else {
                vscode.window.showErrorMessage(`ROM file not found: ${msg.path || msg.name || 'unknown'}`);
                _broadcastRomOffer();
            }
            break;
        }

        case 'romDropped': {
            if (msg.core) emu.sessionCore = msg.core;
            if (msg.preset) emu.sessionPreset = msg.preset;
            if (msg.sramMode === 'default' || msg.sramMode === 'individual') {
                emu.sessionSramMode = msg.sramMode;
                emu.sessionIsolatedSram = (msg.sramMode === 'individual');
            } else if (typeof msg.isolatedSram === 'boolean') {
                emu.sessionIsolatedSram = msg.isolatedSram;
                emu.sessionSramMode = msg.isolatedSram ? 'individual' : 'default';
            }
            if (typeof msg.alwaysRecord === 'boolean') {
                emu.sessionAlwaysRecord = msg.alwaysRecord;
                _saveState(ALWAYS_RECORD_KEY, msg.alwaysRecord);
            }
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

        case 'replayDropped':
            _playReplay(String(msg.name || ''), msg.text);
            break;

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
            if (emu.tas && emu.pendingResume) emu.tas.resume(emu.pendingResume);
            emu.pendingResume = null;
            if (emu.tas && emu.pendingReplay) emu.tas.play(emu.pendingReplay);
            emu.pendingReplay = null;
            vscode.window.setStatusBarMessage(`$(check) Emulator: ${msg.name} running`, 5000);
            break;

        case 'emulatorCrash':
          emu.webviewReady = false;
          _clearReadyTimeout();
          _clearRomTimeout();
          _notifyWebviewStatus('error', `Emulator crash: ${msg.message || msg.error}`);
          logCrash(msg as CrashReport, emu.currentRomName);
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
          logCrash(msg as CrashReport, emu.currentRomName);
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
          // Attach a VS Code debug session to the running ROM (debugger/inline-adapter.ts).
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

export { onWebviewMessage };
