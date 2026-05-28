'use strict';

const fs = require('fs');
const path = require('path');

const assetDir = path.join(__dirname, 'assets');
const assetCache = new Map();

function loadAsset(name) {
  if (!assetCache.has(name)) {
    assetCache.set(name, fs.readFileSync(path.join(assetDir, name), 'utf8'));
  }
  return assetCache.get(name);
}

function buildMainJs({ jsData, roomsData, scalingData, roomsJs, scalingJs, docsJs, routeJs, rngJs }) {
  return loadAsset('shared.js')
    .replace('__JS_DATA__', jsData)
    .replace('__ROOMS_DATA__', roomsData)
    .replace('__SCALING_DATA__', scalingData)
    .replace('__ROOMS_JS__', roomsJs)
    .replace('__SCALING_JS__', scalingJs)
    .replace('__DOCS_JS__', docsJs)
    .replace('__ROUTE_JS__', routeJs)
    .replace('__RNG_JS__', rngJs);
}

// Load rooms tab JS from split modules in assets/rooms/ (concatenated in dependency order).
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
    .map(function(f) { return fs.readFileSync(path.join(assetDir, 'rooms', f), 'utf8'); })
    .join('\n');
}

module.exports = {
  css: loadAsset('shared.css'),
  scalingJs: loadAsset('scaling-tab.js'),
  get roomsJs() { return loadRoomsJs(); },
  docsJs: loadAsset('docs-tab.js'),
  routeJs: loadAsset('route-tab.js'),
  rngJs: loadAsset('rng-tab.js'),
  buildMainJs,
};
