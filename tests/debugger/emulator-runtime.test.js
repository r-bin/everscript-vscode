'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '../..');
const PANEL_JS = path.join(ROOT, 'src', 'emulator', 'panel.js');
const BUNDLED_CORE_JS = path.join(ROOT, 'src', 'emulator', 'core', 'snes9x2005-wasm-vanilla', 'snes9x_2005.js');
const DEBUGGER_CORE_DIR = path.join(ROOT, 'src', 'emulator', 'core', 'snes9x2005-wasm');
const DEBUGGER_CORE_JS = path.join(DEBUGGER_CORE_DIR, 'snes9x_2005.js');

const BASE_API = [
  '_mainLoop',
  '_startWithRom',
  '_getScreenBuffer',
  '_getSoundBuffer',
  '_setJoypadInput',
  '_my_malloc',
  '_my_free',
  '_saveState',
  '_getStateSaveSize',
];

const DEBUG_API = [
  'getCPUState',
  'readMemoryRange',
  'pauseEmulation',
  'resumeEmulation',
  'addExecBreakpoint',
  'addWriteBreakpoint',
  'removeExecBreakpoint',
  'removeWriteBreakpoint',
];

let chromium;
try {
  ({ chromium } = require('playwright'));
} catch (err) {
  console.error('Playwright is required for debugger/tests/emulator-runtime.test.js');
  console.error('Install with /opt/homebrew/bin/npm install --save-dev playwright and then run npx playwright install chromium');
  throw err;
}

function normalizePath(input) {
  if (!input) return '';
  let value = String(input).trim();
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }
  if (value.startsWith('~/')) value = path.join(os.homedir(), value.slice(2));
  return value;
}

function resolveRomPath() {
  const candidates = [
    process.env.EVERSCRIPT_TEST_ROM,
    process.env.ROM,
    path.join(os.homedir(), 'Documents', 'evermore', 'roms', 'Secret of Evermore (U) [!].smc'),
  ].map(normalizePath).filter(Boolean);
  for (const romPath of candidates) {
    if (fs.existsSync(romPath)) return romPath;
  }
  throw new Error('Emulator runtime test ROM not found. Set EVERSCRIPT_TEST_ROM or ROM, or place the ROM at ~/Documents/evermore/roms/Secret of Evermore (U) [!].smc');
}

function parseArgs(argv) {
  const options = { panelCommit: '', expectFailure: false };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--panel-commit') options.panelCommit = argv[++i] || '';
    else if (argv[i] === '--expect-failure') options.expectFailure = true;
  }
  return options;
}

function ensureDebuggerCoreBuilt() {
  if (!fs.existsSync(DEBUGGER_CORE_JS)) {
    throw new Error(`Modified core build did not produce ${DEBUGGER_CORE_JS}`);
  }
}

function loadPanelSourceFromCommit(commit) {
  return execSync(`git show ${commit}:emulator/panel.js`, { cwd: ROOT, encoding: 'utf8' });
}

function createTempPanel(panelSource) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'evs-panel-'));
  const panelPath = path.join(tempDir, 'panel.js');
  fs.writeFileSync(panelPath, panelSource, 'utf8');
  return { tempDir, panelPath };
}

function mimeType(filePath) {
  if (filePath.endsWith('.js')) return 'text/javascript; charset=utf-8';
  if (filePath.endsWith('.wasm')) return 'application/wasm';
  return 'application/octet-stream';
}

function requirePanelModule(panelPath, origin, coreJsPath) {
  const ModuleBuiltin = require('module');
  const originalLoad = ModuleBuiltin._load.bind(ModuleBuiltin);
  let html = '';
  const mockWebview = {
    get html() { return html; },
    set html(value) { html = value; },
    postMessage() {},
    onDidReceiveMessage() { return { dispose() {} }; },
    asWebviewUri(uri) {
      return { toString() { return origin + '/fs/' + encodeURIComponent(uri.fsPath); } };
    },
    cspSource: origin,
  };
  const mockPane = {
    webview: mockWebview,
    reveal() {},
    onDidDispose() { return { dispose() {} }; },
  };
  const mockVscode = {
    window: {
      createWebviewPanel() { return mockPane; },
      visibleTextEditors: [],
      activeTextEditor: null,
      createOutputChannel() { return { appendLine() {}, show() {} }; },
      setStatusBarMessage() { return { dispose() {} }; },
      showErrorMessage() {},
      showWarningMessage() {},
    },
    ViewColumn: { Beside: 2, Active: 1 },
    Uri: {
      file(filePath) {
        return { fsPath: filePath, toString() { return 'file://' + filePath; } };
      },
    },
    workspace: {
      getConfiguration() {
        return {
          get(key, defaultValue) {
            if (key === 'snesCorePath') return coreJsPath === BUNDLED_CORE_JS ? '' : coreJsPath;
            return defaultValue !== undefined ? defaultValue : '';
          },
        };
      },
      workspaceFolders: [],
    },
    debug: {
      activeDebugSession: null,
      startDebugging: async () => false,
    },
  };
  ModuleBuiltin._load = function(request, parent, isMain) {
    if (request === 'vscode') return mockVscode;
    return originalLoad(request, parent, isMain);
  };
  delete require.cache[require.resolve(panelPath)];
  try {
    const mod = require(panelPath);
    mod.openEmulatorPanel({ extensionPath: ROOT, subscriptions: [] }, null, null);
    return html;
  } finally {
    ModuleBuiltin._load = originalLoad;
  }
}

async function withServer(fn) {
  let panelHtml = '';
  const server = http.createServer((req, res) => {
    try {
      const url = new URL(req.url, 'http://127.0.0.1');
      if (url.pathname === '/panel') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(panelHtml);
        return;
      }
      if (url.pathname.startsWith('/fs/')) {
        const filePath = decodeURIComponent(url.pathname.slice(4));
        if (!fs.existsSync(filePath)) {
          res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end('not found');
          return;
        }
        res.writeHead(200, { 'Content-Type': mimeType(filePath) });
        fs.createReadStream(filePath).pipe(res);
        return;
      }
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('not found');
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(String(err && err.stack || err));
    }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const origin = `http://127.0.0.1:${address.port}`;
  try {
    return await fn({
      origin,
      setPanelHtml(value) { panelHtml = value; },
    });
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

async function installHostStub(page) {
  await page.addInitScript(() => {
    window.__evsHostMessages = [];
    window.acquireVsCodeApi = function() {
      return {
        postMessage(message) {
          window.__evsHostMessages.push(message);
        },
      };
    };
  });
}

async function drainMessages(page) {
  return page.evaluate(() => {
    const out = window.__evsHostMessages.slice();
    window.__evsHostMessages.length = 0;
    return out;
  });
}

async function waitForMessage(page, command, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  const seen = [];
  while (Date.now() < deadline) {
    const batch = await drainMessages(page);
    for (const message of batch) {
      seen.push(message.command);
      if (message.command === 'ejsError') {
        throw new Error(`webview reported ejsError before ${command}: ${message.error}`);
      }
      if (message.command === command) return message;
    }
    await page.waitForTimeout(50);
  }
  throw new Error(`timed out waiting for ${command}; seen: ${seen.join(', ')}`);
}

async function postHostMessage(page, payload) {
  await page.evaluate((message) => {
    window.dispatchEvent(new MessageEvent('message', { data: message }));
  }, payload);
}

async function inspectApi(page) {
  return page.evaluate(({ baseApi, debugApi }) => {
    const moduleRef = window.Module || {};
    const api = {};
    for (const name of baseApi.concat(debugApi)) api[name] = typeof moduleRef[name] === 'function';
    return api;
  }, { baseApi: BASE_API, debugApi: DEBUG_API });
}

async function measureScreenLayout(page) {
  return page.evaluate(() => {
    const canvas = document.getElementById('screen');
    const wrap = document.getElementById('screen-wrap');
    const overlay = document.getElementById('overlay');
    const canvasBox = canvas.getBoundingClientRect();
    const wrapBox = wrap.getBoundingClientRect();
    return {
      canvasWidth: canvasBox.width,
      canvasHeight: canvasBox.height,
      wrapWidth: wrapBox.width,
      wrapHeight: wrapBox.height,
      overlayHidden: window.getComputedStyle(overlay).display === 'none',
    };
  });
}

function assertScaledLayout(label, layout) {
  assert.ok(layout.overlayHidden, `${label}: overlay should be hidden after ROM start`);
  assert.ok(layout.canvasWidth > 900, `${label}: canvas width should scale beyond native size, got ${layout.canvasWidth}`);
  assert.ok(layout.canvasHeight > 780, `${label}: canvas height should scale beyond native size, got ${layout.canvasHeight}`);
  assert.ok(layout.canvasWidth <= layout.wrapWidth + 1, `${label}: canvas width should fit inside wrapper`);
  assert.ok(layout.canvasHeight <= layout.wrapHeight + 1, `${label}: canvas height should fit inside wrapper`);
}

async function waitForDebuggerControls(page, label) {
  await page.waitForFunction(() => {
    const pauseBtn = document.getElementById('ss-pause-btn');
    const resumeBtn = document.getElementById('ss-resume-btn');
    const hookBtn = document.getElementById('ss-hook-btn');
    const hookAllBtn = document.getElementById('ss-hook-all-btn');
    return pauseBtn && resumeBtn && hookBtn && hookAllBtn &&
      !pauseBtn.disabled && !resumeBtn.disabled && !hookBtn.disabled && !hookAllBtn.disabled;
  }, null, { timeout: 10000 });

  const state = await page.evaluate(() => ({
    pauseText: document.getElementById('ss-pause-state').textContent,
    breakText: document.getElementById('ss-break-status').textContent,
  }));
  assert.ok(/running/i.test(state.pauseText), `${label}: pause state should report running after startup`);
  assert.ok(/hook:/i.test(state.breakText), `${label}: break status should be visible after startup`);
}

async function exerciseDebuggerControls(page, label) {
  await waitForDebuggerControls(page, label);

  await page.click('#ss-pause-btn');
  await page.waitForFunction(() => /paused/i.test(document.getElementById('ss-pause-state').textContent));

  await page.click('#ss-resume-btn');
  await page.waitForFunction(() => /running/i.test(document.getElementById('ss-pause-state').textContent));

  await page.click('#ss-hook-btn');
  await page.waitForFunction(() => /disarm stack hook/i.test(document.getElementById('ss-hook-btn').textContent));
  await page.waitForFunction(() => /armed/i.test(document.getElementById('ss-break-status').textContent));

  await page.click('#ss-hook-all-btn');
  await page.waitForFunction(() => /ignore hook writes/i.test(document.getElementById('ss-hook-all-btn').textContent));
  await page.waitForFunction(() => /break on all observed writes/i.test(document.getElementById('ss-break-status').textContent));

  await page.click('#ss-hook-all-btn');
  await page.waitForFunction(() => /break all hooks/i.test(document.getElementById('ss-hook-all-btn').textContent));

  await page.click('#ss-hook-btn');
  await page.waitForFunction(() => /arm stack hook/i.test(document.getElementById('ss-hook-btn').textContent));
}

async function assertScriptDetailPanel(page, label) {
  await page.waitForFunction(() => {
    const detail = document.getElementById('ss-detail');
    return detail && /exec slots:|current active:|args\[0x0F\.\.0x2E\] words:/i.test(detail.textContent);
  }, null, { timeout: 10000 });

  const detailText = await page.evaluate(() => document.getElementById('ss-detail').textContent);
  assert.ok(/scheduler chain:/i.test(detailText), `${label}: script detail panel should show scheduler chain`);
  assert.ok(/args\[0x0F\.\.0x2E\] bytes:/i.test(detailText), `${label}: script detail panel should show argument bytes`);
}

async function exerciseCore(page) {
  return page.evaluate(() => {
    const moduleRef = window.Module;
    moduleRef._setJoypadInput(0);
    for (let i = 0; i < 3; i++) moduleRef._mainLoop();
    const screenPtr = moduleRef._getScreenBuffer();
    const soundPtr = moduleRef._getSoundBuffer();
    const stateSize = moduleRef._getStateSaveSize();
    const statePtr = moduleRef._saveState();
    if (statePtr && typeof moduleRef._my_free === 'function') moduleRef._my_free(statePtr);
    return { screenPtr, soundPtr, stateSize };
  });
}

function printApi(label, api) {
  const presentBase = BASE_API.filter((name) => api[name]);
  const presentDebug = DEBUG_API.filter((name) => api[name]);
  console.log(`  ${label} base API: ${presentBase.join(', ')}`);
  console.log(`  ${label} debug API: ${presentDebug.length ? presentDebug.join(', ') : '(none)'}`);
}

async function runRuntimeCase(browser, options) {
  const romName = path.basename(options.romPath);
  const romDataUrl = 'data:application/octet-stream;base64,' + fs.readFileSync(options.romPath).toString('base64');
  const consoleLines = [];
  const pageErrors = [];
  await withServer(async ({ origin, setPanelHtml }) => {
    let temp = null;
    try {
      const panelPath = options.panelSource ? (temp = createTempPanel(options.panelSource)).panelPath : PANEL_JS;
      setPanelHtml(requirePanelModule(panelPath, origin, options.coreJsPath));
      const page = await browser.newPage();
      page.setDefaultTimeout(60000);
      await page.setViewportSize({ width: 1400, height: 1100 });
      await installHostStub(page);
      page.on('console', (msg) => consoleLines.push(`${msg.type()}: ${msg.text()}`));
      page.on('pageerror', (err) => pageErrors.push(String(err && err.stack || err)));
      await page.goto(origin + '/panel', { waitUntil: 'domcontentloaded' });
      await waitForMessage(page, 'webviewBoot', 30000);
      await waitForMessage(page, 'ready', 30000);
      const api = await inspectApi(page);
      for (const name of BASE_API) {
        assert.ok(api[name], `${options.label}: missing core API ${name}`);
      }
      if (options.manualLoad) {
        await page.click('#pickBtn');
        await waitForMessage(page, 'pickRom', 5000);
      }
      await postHostMessage(page, { command: 'loadRom', dataUrl: romDataUrl, name: romName });
      await waitForMessage(page, 'gameStarted', 60000);
      const layout = await measureScreenLayout(page);
      assertScaledLayout(options.label, layout);
      if (options.reloadAfterStart) {
        await postHostMessage(page, { command: 'loadRom', dataUrl: romDataUrl, name: romName + ' reload' });
        await waitForMessage(page, 'gameStarted', 60000);
      }
      if (options.exerciseDebuggerControls) {
        await exerciseDebuggerControls(page, options.label);
      }
      if (options.expectScriptDetail) {
        await assertScriptDetailPanel(page, options.label);
      }
      const result = await exerciseCore(page);
      assert.ok(result.screenPtr > 0, `${options.label}: invalid screen pointer`);
      assert.ok(result.soundPtr > 0, `${options.label}: invalid sound pointer`);
      assert.ok(result.stateSize > 0, `${options.label}: invalid save-state size`);
      printApi(options.label, api);
      await page.close();
    } finally {
      if (temp) fs.rmSync(temp.tempDir, { recursive: true, force: true });
    }
  }).catch((err) => {
    err.consoleLines = consoleLines;
    err.pageErrors = pageErrors;
    throw err;
  });
}

async function main() {
  const args = parseArgs(process.argv);
  const romPath = resolveRomPath();
  const browser = await chromium.launch({ headless: true });
  try {
    if (args.panelCommit) {
      try {
        await runRuntimeCase(browser, {
          label: `historical ${args.panelCommit}`,
          panelSource: loadPanelSourceFromCommit(args.panelCommit),
          coreJsPath: BUNDLED_CORE_JS,
          romPath,
          manualLoad: false,
        });
        if (args.expectFailure) throw new Error(`historical ${args.panelCommit} unexpectedly passed`);
      } catch (err) {
        if (!args.expectFailure) throw err;
        console.log(`historical ${args.panelCommit} failed as expected: ${err.message}`);
        return;
      }
      return;
    }

    console.log('\nStandalone emulator runtime: bundled core auto-load');
    await runRuntimeCase(browser, {
      label: 'bundled core auto-load',
      panelSource: '',
      coreJsPath: BUNDLED_CORE_JS,
      romPath,
      manualLoad: false,
      reloadAfterStart: true,
    });

    console.log('\nStandalone emulator runtime: bundled core manual-load');
    await runRuntimeCase(browser, {
      label: 'bundled core manual-load',
      panelSource: '',
      coreJsPath: BUNDLED_CORE_JS,
      romPath,
      manualLoad: true,
    });
    ensureDebuggerCoreBuilt();
    console.log('\nStandalone emulator runtime: custom core auto-load');
    await runRuntimeCase(browser, {
      label: 'custom core auto-load',
      panelSource: '',
      coreJsPath: DEBUGGER_CORE_JS,
      romPath,
      manualLoad: false,
      exerciseDebuggerControls: true,
      expectScriptDetail: true,
    });
  } catch (err) {
    console.error(err.message);
    if (err.consoleLines && err.consoleLines.length) {
      console.error('Console output:');
      for (const line of err.consoleLines) console.error('  ' + line);
    }
    if (err.pageErrors && err.pageErrors.length) {
      console.error('Page errors:');
      for (const line of err.pageErrors) console.error('  ' + line);
    }
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err && err.stack || err);
  process.exit(1);
});