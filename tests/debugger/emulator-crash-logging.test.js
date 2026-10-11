'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const PANEL_JS = path.join(ROOT, 'src', 'emulator', 'panel.js');
const PANEL_WEBVIEW_JS = path.join(ROOT, 'src', 'emulator', 'panel-webview.js');
const MENU_VIEW_JS = path.join(ROOT, 'src', 'emulator', 'menu', 'menu-view.js');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  [PASS] ${name}`);
    passed++;
  } catch (e) {
    console.error(`  [FAIL] ${name}: ${e.message}`);
    failed++;
  }
}

console.log('Emulator Crash Logging & Fixes Tests:');

const panelCode = fs.readFileSync(PANEL_JS, 'utf8');
const webviewCode = fs.readFileSync(PANEL_WEBVIEW_JS, 'utf8');
const menuCode = fs.readFileSync(MENU_VIEW_JS, 'utf8');

// 1. Output Channel & Crash Reporting in panel.js
test('panel.js defines dedicated Everscript Emulator output channel', () => {
  assert.ok(panelCode.includes("_ensureEmulatorChannel"), 'missing _ensureEmulatorChannel helper');
  assert.ok(panelCode.includes("createOutputChannel('Everscript Emulator')"), 'missing Everscript Emulator output channel creation');
});

test('panel.js handles emulatorCrash and emulatorStderr messages', () => {
  assert.ok(panelCode.includes("case 'emulatorCrash':"), 'missing case emulatorCrash in panel.js');
  assert.ok(panelCode.includes("case 'emulatorStderr':"), 'missing case emulatorStderr in panel.js');
  assert.ok(panelCode.includes("_logCrash(msg)"), 'missing _logCrash call on emulatorCrash');
});

test('panel.js formats comprehensive crash report with CPU state and script slots', () => {
  assert.ok(panelCode.includes('[EMULATOR CRASH REPORT]'), 'missing crash report header');
  assert.ok(panelCode.includes('SNES CPU State:'), 'missing CPU state section in crash report');
  assert.ok(panelCode.includes('Stack Trace:'), 'missing Stack Trace section in crash report');
  assert.ok(panelCode.includes('Active Script Slots:'), 'missing Active Script Slots section in crash report');
  assert.ok(panelCode.includes('Show Crash Log'), 'missing action button to reveal crash log');
});

// 2. Webview crash hooks in panel-webview.js
test('panel-webview.js defines collectCrashContext and reportEmulatorCrash', () => {
  assert.ok(webviewCode.includes('function collectCrashContext('), 'missing collectCrashContext');
  assert.ok(webviewCode.includes('function reportEmulatorCrash('), 'missing reportEmulatorCrash');
  assert.ok(webviewCode.includes("command: 'emulatorCrash'"), 'missing emulatorCrash postMessage');
});

test('panel-webview.js captures errors from window.onerror, unhandledrejection, onAbort, and printErr', () => {
  assert.ok(webviewCode.includes("reportEmulatorCrash('window_onerror'"), 'onerror not wired to reportEmulatorCrash');
  assert.ok(webviewCode.includes("reportEmulatorCrash('unhandledrejection'"), 'unhandledrejection not wired to reportEmulatorCrash');
  assert.ok(webviewCode.includes("reportEmulatorCrash('core_abort'"), 'onAbort not wired to reportEmulatorCrash');
  assert.ok(webviewCode.includes("printErr: function(text)"), 'printErr hook missing on Module');
});

test('panel-webview.js wraps frame execution in try-catch to report runtime errors', () => {
  assert.ok(webviewCode.includes("reportEmulatorCrash('frame_loop_error'"), 'frame() lacks try-catch with crash reporting');
});

test('panel-webview.js reads full 160 object states without truncating object 64', () => {
  assert.ok(webviewCode.includes('m.readMemoryRange(0x7E10CE, 160)'), 'objStateBuf still truncated before 160 bytes');
});

test('panel-webview.js uses applyCanvasLayersFilter for hardware-accelerated rendering', () => {
  assert.ok(webviewCode.includes('function applyCanvasLayersFilter('), 'missing applyCanvasLayersFilter');
  assert.ok(!webviewCode.includes('extMapCtx.filter = mapFilter'), 'extMapCtx still sets slow CPU filter');
  assert.ok(!webviewCode.includes('extFgCtx.filter = mapFilter'), 'extFgCtx still sets slow CPU filter');
});

// 3. Opcode 0x5C injection fixes in menu-view.js
test('menu-view.js uses proper Everscript expression encoding (0x82) for opcode 0x5C', () => {
  assert.ok(menuCode.includes("'5c 82 ' + hexObj + ' 82 ' + hexVal"), 'opcode 0x5C not using 0x82 sub-instruction prefix in stepObjectState');
  assert.ok(menuCode.includes("'5c 82 ' + loot.objectId.toString(16)"), 'opcode 0x5C not using 0x82 sub-instruction prefix in lootables');
});

console.log(`\nResults: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
