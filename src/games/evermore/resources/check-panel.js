'use strict';
// Ownership: the "Check soe:// Resources" panel — the feature's acceptance
// test, run in a real webview:
//   1. <img src="soe://rom/assets/ingredients/wax/icon.png">  (host rewrite)
//   2. the same kind of <img> added by script, with ?rom=vanilla (page rewrite)
//   3. fetch soe://ram/0adb.json                       (emulator connection)
//   4. fetch soe://tags/check.json                     (tag graph: load errors, broken links)
// The command resolves with each result, so a test can run it too.

const vscode = require('vscode');
const { soeResourceRoots, rewriteSoeUrls, soeClientScript } = require('./webview');

const TIMEOUT_MS = 8000;
let _panel = null;

function nonce() {
    return Array.from({ length: 32 }, () => 'abcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(Math.random() * 36)]).join('');
}

/** @returns {Promise<{ benchmark: object, dynamic: object, ram: object, tags: object }>} */
function checkSoeResources() {
    if (_panel) _panel.dispose();
    const panel = vscode.window.createWebviewPanel('everscriptSoeCheck', 'soe:// Check', vscode.ViewColumn.Active, {
        enableScripts: true,
        localResourceRoots: soeResourceRoots(),
    });
    _panel = panel;
    panel.onDidDispose(() => { if (_panel === panel) _panel = null; });

    const result = new Promise(resolve => {
        const timer = setTimeout(() => resolve({ error: 'The check page did not report back' }), TIMEOUT_MS + 2000);
        panel.webview.onDidReceiveMessage(msg => {
            if (!msg || msg.command !== 'soeCheckDone') return;
            clearTimeout(timer);
            resolve(msg.results);
        });
    });
    panel.webview.html = rewriteSoeUrls(buildHtml(panel.webview, nonce()), panel.webview);
    return result.then(results => {
        const ok = r => r && r.ok;
        const line = ['benchmark', 'dynamic', 'ram', 'tags'].map(k => `${k} ${ok(results[k]) ? '✓' : '✗'}`).join(' · ');
        vscode.window.setStatusBarMessage(`soe:// check: ${line}`, 10000);
        return results;
    });
}

function buildHtml(webview, n) {
    return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource}; connect-src ${webview.cspSource}; style-src 'unsafe-inline'; script-src 'nonce-${n}';">
<style>
  body { font-family: var(--vscode-font-family); color: var(--vscode-foreground); background: var(--vscode-editor-background); padding: 16px; }
  table { border-collapse: collapse; } td { padding: 8px 12px; border-bottom: 1px solid var(--vscode-panel-border); vertical-align: middle; }
  img { width: 64px; height: 64px; image-rendering: pixelated; }
  code, pre { font-family: var(--vscode-editor-font-family); margin: 0; }
  .ok { color: var(--vscode-testing-iconPassed); } .bad { color: var(--vscode-testing-iconFailed); }
</style></head><body>
<h2>soe:// check</h2>
<table>
  <tr><td>Benchmark<br><code>soe:&#47;/rom/assets/ingredients/wax/icon.png</code></td>
      <td><img id="bench" src="soe://rom/assets/ingredients/wax/icon.png" alt=""></td><td id="bench-status">…</td></tr>
  <tr><td>Added by script, vanilla ROM<br><code>soe:&#47;/rom/assets/alchemy/acid_rain/icon.png?rom=vanilla</code></td>
      <td id="dyn-cell"></td><td id="dyn-status">…</td></tr>
  <tr><td>Emulator connection<br><code>soe:&#47;/ram/0adb.json</code></td>
      <td><pre id="ram"></pre></td><td id="ram-status">…</td></tr>
  <tr><td>Tags<br><code>soe:&#47;/tags/check.json</code></td>
      <td><pre id="tags"></pre></td><td id="tags-status">…</td></tr>
</table>
<script nonce="${n}">${soeClientScript(webview)}</script>
<script nonce="${n}">
(function () {
  var vscode = acquireVsCodeApi();
  var results = {};
  function report(key, ok, detail) {
    results[key] = { ok: ok, detail: detail };
    var el = document.getElementById(key === 'benchmark' ? 'bench-status' : key === 'dynamic' ? 'dyn-status' : key + '-status');
    el.textContent = (ok ? '✓ ' : '✗ ') + detail;
    el.className = ok ? 'ok' : 'bad';
    if (results.benchmark && results.dynamic && results.ram && results.tags) vscode.postMessage({ command: 'soeCheckDone', results: results });
  }
  function watchImage(img, key) {
    var done = false;
    function finish(ok, detail) { if (!done) { done = true; report(key, ok, detail); } }
    img.addEventListener('load', function () { finish(img.naturalWidth > 0, img.naturalWidth + '×' + img.naturalHeight + ' px'); });
    img.addEventListener('error', function () { finish(false, 'did not load: ' + img.src); });
    if (img.complete && img.naturalWidth) finish(true, img.naturalWidth + '×' + img.naturalHeight + ' px');
    setTimeout(function () { finish(false, 'timed out: ' + img.src); }, ${TIMEOUT_MS});
  }
  watchImage(document.getElementById('bench'), 'benchmark');

  var dyn = document.createElement('img');
  watchImage(dyn, 'dynamic');
  dyn.setAttribute('src', 'soe:' + '//rom/assets/alchemy/acid_rain/icon.png?rom=vanilla');
  document.getElementById('dyn-cell').appendChild(dyn);

  fetch(window.soeUrl('soe:' + '//ram/0adb.json')).then(function (r) {
    if (!r.ok) throw new Error('HTTP ' + r.status + ' (is a game running in the emulator?)');
    return r.json();
  }).then(function (v) {
    document.getElementById('ram').textContent = JSON.stringify(v, null, 2);
    report('ram', true, 'current room $' + v.byte.toString(16));
  }).catch(function (e) { report('ram', false, String(e && e.message || e)); });

  fetch(window.soeUrl('soe:' + '//tags/check.json')).then(function (r) {
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  }).then(function (c) {
    var problems = c.errors.concat(c.links.broken.map(function (b) { return b.tag + ': ' + b.uri; }));
    document.getElementById('tags').textContent = problems.slice(0, 20).join('\n');
    report('tags', c.ok, c.tags + ' tags, ' + c.links.ok + ' links ok, ' + c.links.broken.length + ' broken, '
      + c.errors.length + ' load errors' + (c.links.unchecked ? ', ' + c.links.unchecked + ' unchecked (no ROM)' : ''));
  }).catch(function (e) { report('tags', false, String(e && e.message || e)); });
})();
</script>
</body></html>`;
}

module.exports = { checkSoeResources };
