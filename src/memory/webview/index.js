'use strict';

const fs = require('fs');
const path = require('path');

// Domain asset directories (resolved from src/ tree)
const sharedDir  = path.join(__dirname, '../../shared');
const scalingDir = path.join(__dirname, '../../scaling/webview');
const roomsDir   = path.join(__dirname, '../../rooms/webview');
const docsDir    = path.join(__dirname, '../../docs');
const routesDir  = path.join(__dirname, '../../routes');

const fileCache = new Map();

function loadFile(filePath) {
  if (!fileCache.has(filePath)) {
    fileCache.set(filePath, fs.readFileSync(filePath, 'utf8'));
  }
  return fileCache.get(filePath);
}

function buildMainJs({ jsData, roomsData, scalingData, roomsJs, scalingJs, docsJs, routeJs, rngJs }) {
  return loadFile(path.join(sharedDir, 'shared.js'))
    .replace('__JS_DATA__', jsData)
    .replace('__ROOMS_DATA__', roomsData)
    .replace('__SCALING_DATA__', scalingData)
    .replace('__ROOMS_JS__', roomsJs)
    .replace('__SCALING_JS__', scalingJs)
    .replace('__DOCS_JS__', docsJs)
    .replace('__ROUTE_JS__', routeJs)
    .replace('__RNG_JS__', rngJs);
}

// Load scaling tab JS from split modules in src/scaling/webview/ (concatenated in dependency order).
// alchemy-math.js runs in outer IIFE scope; state.js opens the inner IIFE; tab-init.js closes it.
const SCALING_JS_FILES = [
  'alchemy-math.js',  // pure alchemy math — outer scope, accessible to docs-tab too
  'state.js',         // inner IIFE opener + state vars + DOM refs + char select init
  'helpers.js',       // isScalable, getWeapons, target helpers, slider helpers
  'events.js',        // srcSel/tgtSel/modeSel/button event listeners
  'damage-math.js',   // dmgCache + fmtPct + atlasSeed + dmgRange + srcAtkAtLv etc.
  'chart.js',         // _CW constants + renderTrendChart + attachSvgEvents
  'redraw.js',        // redraw function
  'tab-init.js',      // init calls + inner IIFE close
];

function loadScalingJs() {
  return SCALING_JS_FILES
    .map(function(f) { return loadFile(path.join(scalingDir, f)); })
    .join('\n');
}

// Load rooms tab JS from split modules in src/rooms/webview/ (concatenated in dependency order).
const ROOMS_JS_FILES = [
  'bootstrap.js',        // globals: _currentByteScriptFocus, _applyByteScriptFocus, message listener
  'utils.js',            // escH, hexNum, normScriptAddr, tsvg, INGR_MAP/EMOJI helpers
  'svg-builder.js',      // buildRoomSvgSection
  'tables-builder.js',   // renderScriptTable/Card, buildEntityTablesHtml, buildRomScriptsHtml
  'rom-header.js',       // buildRomHeaderHtml
  'interactions.js',     // setupByteScriptFocusBinding, setupZoomPan, setupMouseEvents, setupHoverHighlights, setupClickHandlers
  'detail-renderer.js',  // renderRoomDetail (orchestrator)
  'tab-init.js',         // tab switching, area collapse, mode toggle, room click handlers
];

function loadRoomsJs() {
  return ROOMS_JS_FILES
    .map(function(f) { return loadFile(path.join(roomsDir, f)); })
    .join('\n');
}

module.exports = {
  css: loadFile(path.join(sharedDir, 'shared.css')),
  get scalingJs() { return loadScalingJs(); },
  get roomsJs() { return loadRoomsJs(); },
  docsJs: loadFile(path.join(docsDir, 'docs-tab.js')),
  routeJs: loadFile(path.join(routesDir, 'route-tab.js')),
  rngJs: loadFile(path.join(docsDir, 'rng-tab.js')),
  buildMainJs,
};
