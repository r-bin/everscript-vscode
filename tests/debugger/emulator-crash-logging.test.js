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
const webviewCode = fs.readFileSync(PANEL_WEBVIEW_JS, 'utf8')
  // Evermore's screen layer is spliced into the page (games/evermore/emulator/overlays-view.js).
  + fs.readFileSync(path.join(ROOT, 'src', 'games', 'evermore', 'emulator', 'overlays-view.js'), 'utf8');
const menuCode = fs.readFileSync(MENU_VIEW_JS, 'utf8')
  // Evermore's tabs 1-4 live in the game's part of the page (handed in through host.js webview()).
  + fs.readFileSync(path.join(ROOT, 'src', 'games', 'evermore', 'emulator', 'menu-tabs.js'), 'utf8');

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

// 4. Menu State Persistence and In-place Stepper Updates
test('menu-view.js maintains per-tab row selections and scroll offsets across open/close and tab changes', () => {
  assert.ok(menuCode.includes('tabSelectedRows = new Array(MENU_TAB_COUNT).fill(0)'), 'missing tabSelectedRows tracking');
  assert.ok(menuCode.includes('tabScrollTops = new Array(MENU_TAB_COUNT).fill(0)'), 'missing tabScrollTops tracking');
  assert.ok(menuCode.includes('function selectMenuTab(targetTab)'), 'missing unified selectMenuTab function');
  assert.ok(menuCode.includes('menuSelectedRow = tabSelectedRows[menuActiveTab] || 0'), 'openEmulatorMenu does not restore previous tab/row');
  assert.ok(menuCode.includes('tabSelectedRows[menuActiveTab] = menuSelectedRow'), 'closeEmulatorMenu does not save tab/row');
});

test('menu-view.js updates object state pill immediately in-place without resetting scroll or reading stale paused WRAM', () => {
  assert.ok(menuCode.includes('function updateObjectRowDisplay(objIndex, newState, maxState)'), 'missing updateObjectRowDisplay');
  assert.ok(menuCode.includes('const menuLocalObjStates = new Map()'), 'missing menuLocalObjStates cache');
  assert.ok(menuCode.includes('function getEffectiveObjState(objIndex)'), 'missing getEffectiveObjState helper');
  assert.ok(!menuCode.includes('m.writeMemory(0x7E107E + objIndex, newState)'), 'direct WRAM write breaks engine difference check $90A390');
  assert.ok(menuCode.includes("'5c 82 ' + hexObj + ' 82 ' + hexVal"), 'stepObjectState must use opcode 0x5C for engine metatile updates');
});

// 5. Start button closing from all tabs & live vector overlays without baked image hijacking
test('menu-view.js closes menu on Start, B, or Escape from any tab', () => {
  assert.ok(menuCode.includes('e.key === startKey || (startKey === \'Enter\' && e.key === \'Enter\')'), 'Start key must close menu before row activation');
  assert.ok(menuCode.includes('closeEmulatorMenu()'), 'missing closeEmulatorMenu');
});

test('panel-webview.js renders live vector overlays without static overlayImg hijacking', () => {
  assert.ok(!webviewCode.includes('activeRoomMap.overlayImg'), 'static overlayImg must not hijack live vector overlays');
  assert.ok(webviewCode.includes('renderCollisionOverlay(overlayCtx, layout, preState, activeRoomMap, cachedCollisionImg, cachedMapId)'), 'missing live renderCollisionOverlay');
  assert.ok(webviewCode.includes('renderObjectsOverlay('), 'missing live renderObjectsOverlay');
});

test('menu-view.js links objects to live WRAM and clears local pause cache on open/close', () => {
  assert.ok(menuCode.includes('function openEmulatorMenu() {\n      if (isMenuOpen) return;\n      isMenuOpen = true;\n      keyInput = 0;\n      if (typeof gameMenuOpened === \'function\') gameMenuOpened();'), 'openEmulatorMenu must let the game clear its pause cache so live WRAM is read');
  assert.ok(menuCode.includes('function closeEmulatorMenu() {\n      if (!isMenuOpen) return;\n      if (menuListeningBtn) cancelKeybindListen();\n      const menuBody = document.getElementById(\'menu-body\');\n      if (menuBody) tabScrollTops[menuActiveTab] = menuBody.scrollTop;\n      tabSelectedRows[menuActiveTab] = menuSelectedRow;\n      if (typeof gameMenuClosed === \'function\') gameMenuClosed();'), 'closeEmulatorMenu must let the game clear its pause cache once emulation resumes');
  assert.ok(menuCode.includes('function gameMenuOpened() { menuLocalObjStates.clear(); }') && menuCode.includes('function gameMenuClosed() { menuLocalObjStates.clear(); }'), 'Evermore clears menuLocalObjStates on open and close');
  assert.ok(menuCode.includes('for (let o = 0; o < 160; o++) {\n            const val = (o === objIndex) ? newState : (m.readMemory(0x7E10CE + o) || 0);'), 'stepObjectState must preserve full 160 WRAM object states in requestRoomMap');
});

test('panel-webview.js starts with every overlay off (the saved settings turn them on)', () => {
  assert.ok(webviewCode.includes('let extendMapEnabled = false;'), 'extendMapEnabled must default to false');
  assert.ok(webviewCode.includes('let triggersOverlayEnabled = false;'), 'triggersOverlayEnabled must default to false');
  assert.ok(webviewCode.includes('let objectsOverlayEnabled = false;'), 'objectsOverlayEnabled must default to false');
  assert.ok(webviewCode.includes('let animTilesOverlayEnabled = false;'), 'animTilesOverlayEnabled must default to false');
  assert.ok(webviewCode.includes('let collisionOverlayEnabled = false;'), 'collisionOverlayEnabled must default to false');
});

test('menu-view.js gates Start button only on opening screen and name entry', () => {
  assert.ok(menuCode.includes('const curMap = m.readMemory(0x7E0ADB);'), 'missing curMap check');
  assert.ok(menuCode.includes('if (curMap === 0x00 || curMap === 0xFF) return false;'), 'curMap 0x00 must pass Start to game');
  assert.ok(menuCode.includes('const boyMaxHp = m.readMemory(0x7E0A35) | (m.readMemory(0x7E0A36) << 8);'), 'missing boyMaxHp check');
  assert.ok(menuCode.includes('if (boyMaxHp === 0) return false;'), 'uninitialized boyMaxHp must pass Start to name entry');
});

test('the Evermore emulator host caches static room metadata; the panel clears it on disposal', () => {
  const hostCode = fs.readFileSync(path.join(__dirname, '../../src/games/evermore/emulator/host.js'), 'utf8');
  assert.ok(hostCode.includes('const _roomMetaCache = new Map();'), 'the host must define _roomMetaCache');
  assert.ok(hostCode.includes('_getRoomMeta(rom, mapId)'), 'the host must use _getRoomMeta to avoid re-encoding animation groups on every frame');
  assert.ok(hostCode.includes('_roomMetaCache.clear();'), 'clearCaches must clear _roomMetaCache');
  assert.ok(panelCode.includes('_options.game.clearCaches()'), 'panel.js must clear the game caches on disposal');
});

test('panel-webview.js synchronizes background and foreground image activation and immediate redraw', () => {
  assert.ok(webviewCode.includes('let imgLoaded = false;'), 'missing imgLoaded flag');
  assert.ok(webviewCode.includes('let fgLoaded = !data.foregroundUri;'), 'missing fgLoaded flag');
  assert.ok(webviewCode.includes('function tryActivate() {'), 'missing tryActivate dual-image sync');
  assert.ok(webviewCode.includes('function redrawExtendedLayersNow() {'), 'missing redrawExtendedLayersNow for synchronous layer updates');
  assert.ok(webviewCode.includes('redrawExtendedLayersNow();'), 'toggles must invoke redrawExtendedLayersNow');
});

test('menu-view.js provides CHEATS tab with noclip, invincibility, and full heal', () => {
  assert.ok(menuCode.includes('id="menu-tab-btn-4" class="menu-tab-btn" data-needs="evermore" type="button" data-tab="4">CHEATS</button>'), 'missing CHEATS tab button');
  assert.ok(menuCode.includes('id="menu-panel-4" class="menu-tab-panel" data-needs="evermore"'), 'missing CHEATS panel');
  assert.ok(menuCode.includes('toggle-cheat-noclip'), 'missing toggle-cheat-noclip row');
  assert.ok(menuCode.includes('toggle-cheat-invincible'), 'missing toggle-cheat-invincible row');
  assert.ok(menuCode.includes('action-cheat-heal'), 'missing action-cheat-heal row');
  assert.ok(menuCode.includes('MENU_TAB_COUNT = 14;'), 'MENU_TAB_COUNT must be 14 (7 menu tabs, REPLAYS, 6 panels)');
});

console.log(`\nResults: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);

