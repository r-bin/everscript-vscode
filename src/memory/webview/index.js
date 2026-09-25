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
  'map-editor-stamps.js',// the stamp dictionary: composing/adopting stamps and graphics
  'map-editor-paint.js', // drawing the draft on the map (_editSel/_editClip)
  'map-editor-ui.js',    // tool bar, docked sidebar, composer, constructs
  'map-editor-phases.js',// what a stroke writes in each phase, and the eraser
  'map-editor-constructs.js',// saved regions, with their triggers and objects
  'map-editor-families.js',// the seven families, and picking a tile out of one
  'map-editor-relations.js',// what vanilla draws beside what (undirected + per side)
  'map-editor-chips.js', // the TILE FAMILIES section: the palette's seven + candidates
  'map-editor-stranded.js',// the invalid-family banner and its two actions
  'map-editor-tiles.js', // the tile browser: grouped by family, ranked by relationship
  'map-editor-tile-lazy.js', // lazy loading of the Tile tab's family groups
  'map-editor-neighbours.js',// the LIKELY NEIGHBORS plus-shape: the brush and its four sides
  'map-editor-deco.js',  // the deco library: vanilla's own objects, to stamp
  'map-editor-special.js',// the Special tab: stairs/drift, gate, entrance + their filter chip
  'map-editor-trigger-select.js',// unifies base + placed triggers: select/move/delete/copy-paste
  'map-editor-trigger-panel.js',// the Trigger tab's list UI + the Info tab's trigger counts
  'map-editor-toolbar.js',// the floating tool pill: tools, phases, icons, the ⋯ overflow
  'map-editor-filterbar.js',// the canvas column's docked filter bar + status bar
  'map-editor-tabs.js',  // which of the dock's five tabs is showing (_editActiveTab)
  'map-editor-panels.js',// tab content: tile list, needed metatiles, checks, trigger lists
  'map-editor-gestures.js',// pointer/key gestures on the map -> edits
  'map-editor-input.js', // clicks on the chrome -> actions
  'map-editor-actions.js',// toolbar actions (undo, compose, constructs, export)
  'map-editor-newroom.js',// drafting a room that is not in the ROM
  'map-editor-start.js',  // the Boy's start marker on a drafted map
  'map-editor-custom.js', // custom maps: their own rail rows and drafts
  'map-editor-custom-store.js', // custom maps on the host: load, save with history, export, delete
  'map-editor-rom-export.js', // Export ROM: a custom map into Brian's room, intro jumps there
  'map-editor-collision.js', // suggested collision on tiles, a drafted map's collision layer
  'map-editor-cutlayer.js', // the cuttable layer: tiles the player cuts away, and its toggle
  'map-editor-drawable.js', // what the pencil draws: the open tab's pick; drawing triggers
  'map-editor-levels.js', // levels (elevation planes 0..3) and the bar that picks one
  'map-editor-groups.js', // stamped objects kept as one thing: select, move, delete
  'rom-overlay.js',      // ROM view top bar (_currentLayer/_currentOverlay) + renderRomDataSections
  'detail-renderer.js',  // renderRoomDetail (orchestrator)
  'rooms-rail.js',       // the left rail: groups, area collapse, search, selection, + New Map
  'tab-init.js',         // the top-level tab strip
];

function loadRoomsJs() {
  return ROOMS_JS_FILES
    .map(function(f) { return loadFile(path.join(roomsDir, f)); })
    .join('\n');
}

module.exports = {
  // shared.css stays the flat baseline every tab renders with; the map
  // editor's own tokens/chrome live in rooms-owned files so restyling it can
  // never bleed into the memory/scaling/docs/route tabs. theme.css declares
  // the tokens and must come before canvas.css and rooms-rail.css, which
  // both only consume them.
  css: loadFile(path.join(sharedDir, 'shared.css')) + '\n'
    + loadFile(path.join(roomsDir, 'map-editor-theme.css')) + '\n'
    + loadFile(path.join(roomsDir, 'map-editor-canvas.css')) + '\n'
    + loadFile(path.join(roomsDir, 'map-editor-tile-tab.css')) + '\n'
    + loadFile(path.join(roomsDir, 'rooms-rail.css')),
  get scalingJs() { return loadScalingJs(); },
  get roomsJs() { return loadRoomsJs(); },
  docsJs: loadFile(path.join(docsDir, 'docs-tab.js')),
  routeJs: loadFile(path.join(routesDir, 'route-tab.js')),
  rngJs: loadFile(path.join(docsDir, 'rng-tab.js')),
  buildMainJs,
};
