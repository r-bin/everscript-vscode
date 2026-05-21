'use strict';

/**
 * emulator/panel.js
 *
 * VS Code webview panel for the embedded SNES emulator.
 * Uses EmulatorJS (snes9x libretro core) to run SNES ROMs inside VS Code.
 *
 * Vendor files live in emulator/vendor/emulatorjs/ (bundled with the extension).
 * ROMs are read from disk by the host and sent as base64 data URLs so that
 * arbitrary file-system paths don't need to be added to localResourceRoots.
 */

const vscode = require('vscode');
const path   = require('path');
const fs     = require('fs');

let _panel   = null;
let _pending = null; // { dataUrl, name } to send once the webview signals ready

/**
 * Open (or reveal) the emulator panel.
 *
 * @param {object} context   VS Code extension context.
 * @param {object} [rom]     Optional { dataUrl, name } to auto-load on open.
 */
function openEmulatorPanel(context, rom) {
    if (rom) _pending = rom;

    if (_panel) {
        _panel.reveal(vscode.ViewColumn.Beside, true);
        // If the panel is already open and we have a ROM, send it immediately.
        if (_pending) {
            _panel.webview.postMessage({ command: 'loadRom', dataUrl: _pending.dataUrl, name: _pending.name });
            _pending = null;
        }
        return;
    }

    const vendorBase = path.join(context.extensionPath, 'emulator', 'vendor', 'emulatorjs');

    _panel = vscode.window.createWebviewPanel(
        'everscriptEmulator',
        'Everscript Emulator',
        vscode.ViewColumn.Beside,
        {
            enableScripts: true,
            retainContextWhenHidden: true,
            localResourceRoots: [vscode.Uri.file(context.extensionPath)],
        },
    );

    _panel.webview.html = _buildHtml(_panel.webview, vendorBase);

    _panel.webview.onDidReceiveMessage(msg => {
        switch (msg.command) {
            case 'ready': {
                // Send current settings so the Settings tab can populate its fields.
                const cfg = vscode.workspace.getConfiguration('everscript');
                _panel.webview.postMessage({
                    command: 'initSettings',
                    settings: {
                        repoPath:     cfg.get('repoPath',     ''),
                        patchesPath:  cfg.get('patchesPath',  ''),
                        compilerPath: cfg.get('compilerPath', ''),
                        romPath:      cfg.get('romPath',      ''),
                    },
                });
                if (_pending) {
                    _panel.webview.postMessage({ command: 'loadRom', dataUrl: _pending.dataUrl, name: _pending.name });
                    _pending = null;
                }
                break;
            }

            case 'pickRom': {
                vscode.window.showOpenDialog({
                    canSelectMany: false,
                    openLabel:     'Load ROM',
                    filters:       { 'SNES ROM': ['smc', 'sfc', 'fig', 'bin'] },
                }).then(uris => {
                    if (!uris || !uris.length) return;
                    _sendRomFile(uris[0].fsPath);
                });
                break;
            }

            case 'wramDelta':
                // Forward WRAM deltas to the Memory Radar live mode (future).
                break;

            case 'probeRepo': {
                // Scan the given repo path and return discovered paths.
                const repoPath = msg.repoPath || '';
                const result = {};
                try {
                    const pyCandidate = path.join(repoPath, 'everscript.py');
                    if (fs.existsSync(pyCandidate)) {
                        result.compilerPath = pyCandidate;
                    } else {
                        for (const bin of ['everscript_mac', 'everscript', 'everscript.exe']) {
                            const p = path.join(repoPath, 'dist', bin);
                            if (fs.existsSync(p)) { result.compilerPath = p; break; }
                        }
                    }
                    result.patchesPath = path.join(repoPath, 'patches');
                    const files = fs.readdirSync(repoPath);
                    const rom = files.find(f => /\.(smc|sfc)$/i.test(f));
                    if (rom) result.romPath = path.join(repoPath, rom);
                } catch (_) {}
                _panel.webview.postMessage({ command: 'repoProbeResult', ...result });
                break;
            }

            case 'saveSettings': {
                const { settings } = msg;
                const cfg = vscode.workspace.getConfiguration('everscript');
                for (const [k, v] of [
                    ['repoPath',     settings.repoPath     || ''],
                    ['patchesPath',  settings.patchesPath  || ''],
                    ['compilerPath', settings.compilerPath || ''],
                    ['romPath',      settings.romPath      || ''],
                ]) {
                    cfg.update(k, v, vscode.ConfigurationTarget.Global);
                }
                break;
            }
        }
    }, undefined, context.subscriptions);

    _panel.onDidDispose(() => { _panel = null; _pending = null; }, null, context.subscriptions);
}

/** Read a ROM file from disk and send it to the webview. */
function _sendRomFile(romPath) {
    const romName = path.basename(romPath);
    try {
        const romData = fs.readFileSync(romPath);
        const dataUrl = 'data:application/octet-stream;base64,' + romData.toString('base64');
        _panel.webview.postMessage({ command: 'loadRom', dataUrl, name: romName });
    } catch (e) {
        vscode.window.showErrorMessage('Failed to read ROM: ' + e.message);
    }
}

function _buildHtml(webview, vendorBase) {
    const nonce = _nonce();

    const loaderUri = webview.asWebviewUri(vscode.Uri.file(path.join(vendorBase, 'loader.js')));
    const vendorUri = webview.asWebviewUri(vscode.Uri.file(vendorBase));

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="
    default-src 'none';
    script-src * blob: data: 'unsafe-eval' 'unsafe-inline' 'wasm-unsafe-eval';
    style-src * 'unsafe-inline' blob: data:;
    img-src * blob: data:;
    media-src * blob: data:;
    connect-src * blob: data:;
    worker-src blob: data:;
    font-src * blob: data:;
  ">
  <title>Everscript Emulator</title>
  <style nonce="${nonce}">
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { width: 100%; height: 100%; background: #000; overflow: hidden; display: flex; flex-direction: column; }
    /* Tab bar */
    #tab-bar { flex: 0 0 28px; display: flex; align-items: stretch; background: #1a1a1a; border-bottom: 1px solid #333; }
    .tab { padding: 0 18px; background: none; border: none; border-bottom: 2px solid transparent; color: #888; cursor: pointer; font-size: 12px; letter-spacing: 0.04em; }
    .tab:hover { color: #bbb; }
    .tab.active { color: #eee; border-bottom-color: #4af; }
    /* Tab panes */
    .tab-pane { display: none; flex: 1; min-height: 0; flex-direction: column; }
    .tab-pane.active { display: flex; }
    /* Emulator pane */
    #pane-emu { position: relative; overflow: hidden; }
    #ejs-container { flex: 1; min-height: 0; overflow: hidden; }
    #overlay {
      position: absolute; inset: 0;
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      background: #111; color: #ccc;
      font-family: monospace; gap: 16px; z-index: 100;
    }
    #overlay h2 { color: #eee; font-size: 18px; }
    #pickBtn { padding: 10px 24px; background: #1a6; color: #fff; border: none; border-radius: 4px; cursor: pointer; font-size: 14px; }
    #pickBtn:hover { background: #0c5; }
    #status { font-size: 12px; color: #888; max-width: 400px; text-align: center; }
    /* Script stack */
    #script-stack {
      height: 180px; min-height: 140px; max-height: 220px;
      background: #0d0d0d; border-top: 1px solid #333;
      overflow-y: auto; font-family: monospace; font-size: 11px;
      display: none;
    }
    #script-stack.visible { display: block; }
    #ss-header {
      position: sticky; top: 0;
      background: #1a1a1a; padding: 3px 8px;
      color: #aaa; font-size: 10px; letter-spacing: 0.05em;
      display: flex; justify-content: space-between; align-items: center;
      border-bottom: 1px solid #333;
    }
    #ss-header span { color: #555; }
    #ss-table { width: 100%; border-collapse: collapse; }
    #ss-table th {
      text-align: left; padding: 2px 6px;
      color: #666; font-weight: normal; font-size: 10px;
      position: sticky; top: 24px; background: #111; border-bottom: 1px solid #222;
    }
    #ss-table td { padding: 1px 6px; color: #ccc; }
    #ss-table tr.exec td { color: #6f6; }
    #ss-table tr.wait td { color: #ff6; }
    #ss-table tr.dead td { color: #633; }
    /* Settings pane */
    #pane-settings { background: #111; overflow-y: auto; }
    #settings-wrap { max-width: 520px; padding: 20px 24px; font-family: var(--vscode-font-family, monospace); font-size: 13px; color: #ccc; }
    .sg { margin-bottom: 24px; }
    .sg-title { font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase; color: #4af; margin-bottom: 12px; padding-bottom: 4px; border-bottom: 1px solid #333; }
    .sl { display: block; font-size: 11px; color: #999; margin-top: 10px; margin-bottom: 4px; }
    .si { width: 100%; padding: 5px 8px; background: #1e1e1e; border: 1px solid #444; border-radius: 3px; color: #ddd; font-size: 12px; font-family: monospace; outline: none; }
    .si:focus { border-color: #4af; }
    select.si { cursor: pointer; }
    .srow { display: flex; gap: 6px; }
    .srow .si { flex: 1; }
    .shint { font-size: 11px; color: #666; margin-top: 4px; }
    .sbtn { padding: 5px 14px; background: #2a3a4a; border: 1px solid #4af; color: #4af; border-radius: 3px; cursor: pointer; font-size: 12px; white-space: nowrap; }
    .sbtn:hover { background: #1a6; border-color: #1a6; color: #fff; }
    .sbtn.primary { background: #1a6; border-color: #1a6; color: #fff; }
    .sbtn.primary:hover { background: #0c5; border-color: #0c5; }
    .sfoot { margin-top: 20px; display: flex; align-items: center; gap: 12px; padding-top: 16px; border-top: 1px solid #333; }
    #save-msg { font-size: 11px; color: #6f6; }
  </style>
</head>
<body>
  <div id="tab-bar">
    <button class="tab active" data-tab="emu">Emulator</button>
    <button class="tab" data-tab="settings">Settings</button>
  </div>

  <div id="pane-emu" class="tab-pane active">
    <div id="overlay">
      <h2>Everscript Emulator</h2>
      <button id="pickBtn">Load ROM...</button>
      <div id="status">Select a SNES ROM (.smc / .sfc) to begin.</div>
    </div>
    <div id="ejs-container"></div>
    <div id="script-stack">
      <div id="ss-header">
        <b>SCRIPT STACK</b>
        <span id="ss-count">waiting...</span>
      </div>
      <table id="ss-table">
        <thead><tr><th>#</th><th>PC</th><th>state</th><th>entity</th><th>timer</th></tr></thead>
        <tbody id="ss-tbody"></tbody>
      </table>
    </div>
  </div>

  <div id="pane-settings" class="tab-pane">
    <div id="settings-wrap">
      <div class="sg">
        <div class="sg-title">Build</div>
        <label class="sl" for="cfg-repo">Everscript repo path</label>
        <div class="srow">
          <input id="cfg-repo" class="si" type="text" placeholder="/path/to/everscript" spellcheck="false" autocomplete="off">
          <button id="btn-autofill" class="sbtn">Auto-fill</button>
        </div>
        <div class="shint">Root of the everscript repo. Auto-fills the fields below and sets the build working directory.</div>
        <label class="sl" for="cfg-patches">patches/ folder</label>
        <input id="cfg-patches" class="si" type="text" placeholder="&lt;repo&gt;/patches" spellcheck="false" autocomplete="off">
        <label class="sl" for="cfg-compiler">Compiler binary or script</label>
        <input id="cfg-compiler" class="si" type="text" placeholder="auto-detected (everscript.py or dist/everscript_mac)" spellcheck="false" autocomplete="off">
        <label class="sl" for="cfg-rom">Vanilla ROM</label>
        <input id="cfg-rom" class="si" type="text" placeholder="auto-detected (.smc / .sfc in repo root)" spellcheck="false" autocomplete="off">
      </div>
      <div class="sg">
        <div class="sg-title">Emulator</div>
        <label class="sl" for="cfg-core">SNES core</label>
        <select id="cfg-core" class="si"><option value="snes9x">snes9x (bundled)</option></select>
      </div>
      <div class="sfoot">
        <button id="btn-save" class="sbtn primary">Save</button>
        <span id="save-msg"></span>
      </div>
    </div>
  </div>

  <script nonce="${nonce}">
    const vscodeApi = acquireVsCodeApi();

    // ── Tab switching ──────────────────────────────────────────────────
    document.querySelectorAll('.tab').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById('pane-' + btn.dataset.tab).classList.add('active');
      });
    });

    window.addEventListener('DOMContentLoaded', () => {
      vscodeApi.postMessage({ command: 'ready' });
    });

    document.getElementById('pickBtn').addEventListener('click', () => {
      vscodeApi.postMessage({ command: 'pickRom' });
      document.getElementById('status').textContent = 'Waiting for file picker...';
    });

    // ── Settings form ─────────────────────────────────────────────────
    function setField(id, val) {
      const el = document.getElementById(id);
      if (el && val) el.value = val;
    }
    document.getElementById('btn-autofill').addEventListener('click', () => {
      const repoPath = document.getElementById('cfg-repo').value.trim();
      if (repoPath) vscodeApi.postMessage({ command: 'probeRepo', repoPath });
    });
    document.getElementById('cfg-repo').addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        const repoPath = e.target.value.trim();
        if (repoPath) vscodeApi.postMessage({ command: 'probeRepo', repoPath });
      }
    });
    document.getElementById('btn-save').addEventListener('click', () => {
      vscodeApi.postMessage({ command: 'saveSettings', settings: {
        repoPath:     document.getElementById('cfg-repo').value.trim(),
        patchesPath:  document.getElementById('cfg-patches').value.trim(),
        compilerPath: document.getElementById('cfg-compiler').value.trim(),
        romPath:      document.getElementById('cfg-rom').value.trim(),
      }});
      const msgEl = document.getElementById('save-msg');
      msgEl.textContent = 'Saved.';
      setTimeout(() => { msgEl.textContent = ''; }, 2000);
    });

    // ── Host -> Webview messages ───────────────────────────────────────
    window.addEventListener('message', evt => {
      const msg = evt.data;
      switch (msg.command) {
        case 'loadRom': startEjs(msg.dataUrl, msg.name); break;
        case 'initSettings':
          setField('cfg-repo',     msg.settings.repoPath);
          setField('cfg-patches',  msg.settings.patchesPath);
          setField('cfg-compiler', msg.settings.compilerPath);
          setField('cfg-rom',      msg.settings.romPath);
          break;
        case 'repoProbeResult':
          if (msg.compilerPath) setField('cfg-compiler', msg.compilerPath);
          if (msg.romPath)      setField('cfg-rom',      msg.romPath);
          if (msg.patchesPath)  setField('cfg-patches',  msg.patchesPath);
          break;
      }
    });

    // ── WRAM / Script stack ────────────────────────────────────────────────

    const SCRIPT_BASE  = 0x28FC;
    const SLOT_SIZE    = 0x4F;
    const SLOT_COUNT   = 20;
    const RAM_TAG      = [82, 65, 77, 32]; // "RAM "
    const WRAM_SIZE    = 0x20000;

    function readU16(w, off) { return (w[off] | (w[off + 1] << 8)) >>> 0; }
    function readU24(w, off) { return (w[off] | (w[off + 1] << 8) | (w[off + 2] << 16)) >>> 0; }

    /** Scan a snes9x save-state blob for the 128 KB RAM block. */
    function parseWramFromState(raw) {
      const d = (raw instanceof Uint8Array) ? raw : new Uint8Array(raw);
      const limit = d.length - 8 - WRAM_SIZE;
      for (let i = 0; i < limit; i++) {
        if (d[i] === RAM_TAG[0] && d[i+1] === RAM_TAG[1] &&
            d[i+2] === RAM_TAG[2] && d[i+3] === RAM_TAG[3]) {
          const sizeBE = ((d[i+4] << 24) | (d[i+5] << 16) | (d[i+6] << 8) | d[i+7]) >>> 0;
          const sizeLE = (d[i+4] | (d[i+5] << 8) | (d[i+6] << 16) | (d[i+7] << 24)) >>> 0;
          if (sizeBE === WRAM_SIZE || sizeLE === WRAM_SIZE) {
            return d.subarray(i + 8, i + 8 + WRAM_SIZE);
          }
        }
      }
      return null;
    }

    /** Render 20-slot script stack from raw WRAM bytes. */
    function updateScriptStack(wram) {
      const tbody = document.getElementById('ss-tbody');
      if (!tbody) return;
      let rows = '';
      let active = 0;
      for (let i = 0; i < SLOT_COUNT; i++) {
        const base = SCRIPT_BASE + i * SLOT_SIZE;
        if (base + SLOT_SIZE > wram.length) break;
        const loc = readU24(wram, base + 0x00);
        if (loc === 0) continue; // inactive slot
        active++;
        const state  = readU16(wram, base + 0x03);
        const timer1 = readU16(wram, base + 0x05);
        const entity = readU16(wram, base + 0x0D);
        const cls    = state === 2 ? 'exec' : state === 4 ? 'wait' : 'dead';
        const sname  = state === 2 ? 'exec' : state === 4 ? 'wait' : state === 0 ? 'dead' : '0x' + state.toString(16);
        rows += '<tr class="' + cls + '">' +
          '<td>' + i + '</td>' +
          '<td>' + loc.toString(16).toUpperCase().padStart(6, '0') + '</td>' +
          '<td>' + sname + '</td>' +
          '<td>' + entity.toString(16).toUpperCase().padStart(4, '0') + '</td>' +
          '<td>' + timer1 + '</td>' +
          '</tr>';
      }
      if (rows === '') {
        rows = '<tr><td colspan="5" style="color:#555;text-align:center;padding:6px">no active scripts</td></tr>';
      }
      tbody.innerHTML = rows;
      document.getElementById('ss-count').textContent = active + ' active';
    }

    /** Start the WRAM polling loop after game loads. */
    function startWramPolling() {
      const el = document.getElementById('script-stack');
      if (el) el.classList.add('visible');

      document.getElementById('ss-count').textContent = 'connecting...';

      function attempt() {
        try {
          const gm = window.EJS_emulator && window.EJS_emulator.gameManager;
          if (!gm || !gm.Module) { setTimeout(attempt, 1000); return; }

          // Inject EmulatorJSGetState if the build doesn't provide it.
          if (typeof gm.Module.EmulatorJSGetState !== 'function') {
            gm.Module.EmulatorJSGetState = function() {
              try {
                gm.Module._cmd_save_state();
                return gm.Module.FS.readFile('/game.state');
              } catch (e) { return null; }
            };
          }

          function poll() {
            try {
              const raw = gm.getState();
              if (raw) {
                const wram = parseWramFromState(raw);
                if (wram) {
                  updateScriptStack(wram);
                  // Post a small WRAM window to the host for Memory Radar live mode.
                  const start = SCRIPT_BASE;
                  const end   = Math.min(wram.length, SCRIPT_BASE + SLOT_COUNT * SLOT_SIZE + 1);
                  vscodeApi.postMessage({ command: 'wramDelta', offset: start, data: Array.from(wram.subarray(start, end)) });
                }
              }
            } catch (_) { /* silently skip on error */ }
            setTimeout(poll, 500);
          }
          poll();
        } catch (_) {
          setTimeout(attempt, 2000);
        }
      }
      attempt();
    }

    // ── EmulatorJS bootstrap ───────────────────────────────────────────────

    function startEjs(dataUrl, name) {
      document.getElementById('overlay').style.display = 'none';

      window.EJS_player        = '#ejs-container';
      window.EJS_core          = 'snes9x';
      window.EJS_gameUrl       = dataUrl;
      window.EJS_gameName      = name || 'game';
      window.EJS_pathtodata    = '${vendorUri}/';
      window.EJS_startOnLoaded = true;
      window.EJS_threads       = false;
      window.EJS_onGameStart   = function() {
        vscodeApi.postMessage({ command: 'gameStarted', name: window.EJS_gameName });
        setTimeout(startWramPolling, 1500); // slight delay to let emulator settle
      };

      const s = document.createElement('script');
      s.src = '${loaderUri}';
      document.head.appendChild(s);
    }
  </script>
</body>
</html>`;
}

function _nonce() {
    let n = '';
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) n += chars[Math.floor(Math.random() * chars.length)];
    return n;
}

module.exports = { openEmulatorPanel, sendRomFile: _sendRomFile };
