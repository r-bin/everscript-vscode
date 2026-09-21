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

/**
 * Substitute a placeholder with literal text.
 *
 * The replacement goes through a function, not a string. A plain
 * `.replace(a, b)` re-reads `b` for `$&`, `$'` and friends, so a single
 * `'flag $'` inside the webview source silently swallowed the rest of the
 * bundle and left an unterminated string literal. Every file pasted in here
 * is code, not a pattern.
 */
function inject(text, placeholder, content) {
  return text.replace(placeholder, () => content);
}

function buildMainJs({ jsData, roomsData, scalingData, roomsJs, scalingJs, docsJs, routeJs, rngJs }) {
  let out = loadFile(path.join(sharedDir, 'shared.js'));
  for (const [placeholder, content] of [
    ['__JS_DATA__', jsData],
    ['__ROOMS_DATA__', roomsData],
    ['__SCALING_DATA__', scalingData],
    ['__ROOMS_JS__', roomsJs],
    ['__SCALING_JS__', scalingJs],
    ['__DOCS_JS__', docsJs],
    ['__ROUTE_JS__', routeJs],
    ['__RNG_JS__', rngJs],
  ]) {
    out = inject(out, placeholder, content);
  }
  return out;
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
  'svg-spawns.js',       // buildSpawnLayers (the NPC layers svg-builder places)
  'svg-builder.js',      // buildRoomSvgSection
  'tables-builder.js',   // renderScriptTable/Card, buildEntityTablesHtml, buildRomScriptsHtml
  'rom-header.js',       // buildRomHeaderHtml
  'interactions.js',     // setupByteScriptFocusBinding, setupZoomPan, setupMouseEvents, setupHoverHighlights, setupClickHandlers
  'animation.js',        // Section 2 tile animation overlay + rAF playback
  'object-states.js',    // Section 3 object browser (_objectStates) + state pickers
  'metatile-palette.js', // the room's placement palette (_mtPalette/_mtLayer/_mtFilter)
  'map-editor.js',       // the edit draft and undo stack (_edit)
  'map-editor-paint.js', // drawing the draft on the map (_editSel/_editClip)
  'map-editor-ui.js',    // tool bar, docked sidebar, composer, constructs
  'map-editor-constructs.js',// saved regions, with their triggers and objects
  'map-editor-families.js',// choosing the seven families and browsing their art
  'map-editor-panels.js',// tile list, needed metatiles, checks
  'map-editor-input.js', // pointer/key gestures -> edits
  'map-editor-actions.js',// toolbar actions (undo, compose, constructs, export)
  'map-editor-newroom.js',// drafting a room that is not in the ROM
  'rom-overlay.js',      // ROM view top bar (_currentLayer/_currentOverlay) + renderRomDataSections
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
