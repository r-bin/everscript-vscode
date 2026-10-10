'use strict';

const fs = require('fs');
const path = require('path');

// Domain asset directories (resolved from src/ tree)
const sharedDir  = path.join(__dirname, '../../shared');
const scalingDir = path.join(__dirname, '../../scaling/webview');
const roomsDir   = path.join(__dirname, '../../rooms/webview');
const spritesDir = path.join(__dirname, '../../sprites/webview');
const docsDir    = path.join(__dirname, '../../docs');
const routesDir  = path.join(__dirname, '../../routes');
const romDir     = path.join(__dirname, '../../rom/webview');
const musicDir   = path.join(__dirname, '../../music/webview');

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

function buildMainJs({ jsData, roomsData, scalingData, spritesData, roomsJs, scalingJs, spritesJs, docsJs, routeJs, rngJs, romJs, musicJs }) {
  let out = loadFile(path.join(sharedDir, 'shared.js'));
  for (const [placeholder, content] of [
    ['__JS_DATA__', jsData],
    ['__ROOMS_DATA__', roomsData],
    ['__SCALING_DATA__', scalingData],
    ['__SPRITES_DATA__', spritesData || ''],
    ['__ROOMS_JS__', roomsJs],
    ['__SCALING_JS__', scalingJs],
    ['__SPRITES_JS__', spritesJs || ''],
    ['__DOCS_JS__', docsJs],
    ['__ROUTE_JS__', routeJs],
    ['__RNG_JS__', rngJs],
    ['__ROM_JS__', romJs || ''],
    ['__MUSIC_JS__', musicJs || ''],
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
  'utils.js',            // escH, hexNum, normScriptAddr, tsvg, item icon helpers (ITEM_ICONS)
  'svg-spawns.js',       // buildSpawnLayers (the NPC layers svg-builder places)
  'svg-builder.js',      // buildRoomSvgSection
  'rooms-layout.js',     // the rail and dock resize handles (_layoutWidths)
  'zoom-pan.js',         // setupZoomPan: scale, pan offset, pinch and two-finger panning
  'interactions.js',     // setupByteScriptFocus, setupMouseEvents, setupHoverHighlights, setupClickHandlers
  'animation.js',        // Section 2 tile animation overlay + rAF playback
  'metatile-palette.js', // the room's metatile dictionary from the host (_mtPalette/_mtLayer)
  'map-editor.js',       // the edit draft and undo stack (_edit)
  'map-editor-history.js', // undo steps' family slots and resize (stateless)
  'map-editor-stamps.js',// the stamp dictionary: composing/adopting stamps and graphics
  'map-editor-paint.js', // drawing the draft on the map (_editSel/_editClip)
  'map-editor-anim.js', // animated stamps on the map (stateless)
  'map-editor-ui.js',    // tool bar, docked sidebar, composer, constructs
  'map-editor-phases.js',// what a stroke writes in each phase, and the eraser
  'map-editor-constructs.js',// saved regions, with their triggers and objects
  'map-editor-families.js',// the seven families, and picking a tile out of one
  'map-editor-relations.js',// what vanilla draws beside what (undirected + per side)
  'map-editor-chips.js', // the TILE FAMILIES section: the palette's seven + candidates
  'map-editor-stranded.js',// the invalid-family banner and its two actions
  'map-editor-tiles.js', // the tile browser: grouped by family, ranked by relationship
  'map-editor-tile-lazy.js', // lazy loading of the Tile tab's family groups
  'map-editor-tile-filters.js', // the Tile tab's filter row: layer, mirror, cuttable/stairs, floor/edge/wall
  'map-editor-neighbours.js',// the LIKELY NEIGHBORS plus-shape: the brush and its four sides
  'map-editor-deco.js',  // the deco library: vanilla's own objects, to stamp
  'map-editor-widgets.js', // the user's own widgets and the Widgets tab (_widgets/_widgetArt/_widgetsVanilla)
  'map-editor-widget-colours.js', // a widget's stored shape and derived colourings (_widgetFamilies)
  'map-editor-widget-edit.js', // editing a widget on its own canvas (_widgetEdit/_widgetBack)
  'map-editor-preview.js', // hover ghosts of what a stroke/stamp/erase would do, and the resize outline
  'map-editor-special.js',// the Special tab: stairs/drift, gate, entrance + their filter chip
  'map-editor-flag-overlays.js', // bits 15 and 14 (Interact, Step-on): overlays, per-cell state (_interactOverlayOn/_stepOnOverlayOn)
  'map-editor-trigger-select.js',// unifies base + placed triggers: select/move/delete/copy-paste
  'map-editor-trigger-panel.js',// the Trigger tab's list UI
  'map-editor-trigger-scripts.js', // the scripts in the Trigger tab's rows, and its Enter tab (_triggerOpen/_triggerEnterView)
  'map-editor-trigger-order.js', // dragging trigger rows: order and kind (_triggerDragRow)
  'map-editor-animations.js', // which slots animate, and the groups the Animation tab lists (_animSel/_animFrame)
  'map-editor-anim-tab.js', // the Animation tab: rows, timing editor, its pencil (_animDraw/_animPainting)
  'map-editor-anim-sets.js', // sets of animated tiles on one timing, runs, the tab's placements, copy/paste (_animClip)
  'map-editor-anim-map.js', // animated tiles on the map: purple marks, unfinished frames, the Animation chip (_animMarks)
  'map-editor-anim-placed.js', // a placed widget's timing chips (A/B/C) and switching them
  'map-editor-objects.js', // the Object tab: areas and their tiles (_objectSel/_objectDraw)
  'map-editor-object-list.js', // the Object tab's rows: open/closed, drag to reorder (_objectOpen/_objectDragRow)
  'map-editor-family-sets.js', // the Header sub-tab's palette sets: previewing MAP_PALETTE (_familySetView)
  'map-editor-object-holds.js', // the Object tab's timing: how long each state is held, and Play (_objectPlay)
  'map-editor-placed-list.js', // the Widgets tab's Placed rows: draw order, disband, remove (_placedDragRow)
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
  'map-editor-collision-tab.js', // the Collision tab: shapes set by hand over the estimate (_collPick)
  'map-editor-cutlayer.js', // the cuttable layer: tiles the player cuts away, and its toggle
  'map-editor-drawable.js', // what the pencil draws: the open tab's pick; drawing triggers
  'map-editor-levels.js', // levels (elevation planes 0..3) and the bar that picks one
  'map-editor-groups.js', // stamped objects kept as one thing: select, move, delete
  'map-editor-clipboard.js', // copy/paste of regions and objects (Cmd/Ctrl+C/V)
  'map-editor-pick.js', // the smart eyedropper: picks up what is there, with its tab and tool
  'map-editor-special-select.js', // the Select tool on the Special tab: select and drag a cell's specials
  'map-editor-romroom.js', // a vanilla room in the editor: its palette check, objects, triggers and specials
  'map-editor-info.js',  // the Info tab: capacity, the map's measured facts, the room header, checks
  'rom-overlay.js',      // ROM view top bar (_currentLayer/_currentOverlay)
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
    + loadFile(path.join(roomsDir, 'rooms-rail.css')) + '\n'
    + loadFile(path.join(roomsDir, 'rooms-layout.css')) + '\n'
    + loadFile(path.join(spritesDir, 'sprites-layout.css')) + '\n'
    + loadFile(path.join(romDir, 'rom-tab.css')) + '\n'
    + loadFile(path.join(musicDir, 'music-tab.css')),
  get scalingJs() { return loadScalingJs(); },
  get roomsJs() { return loadRoomsJs(); },
  get spritesJs() { return loadFile(path.join(spritesDir, 'sprites-lazy.js')) + '\n' + loadFile(path.join(spritesDir, 'sprites-script.js')) + '\n' + loadFile(path.join(spritesDir, 'sprites-motion.js')) + '\n' + loadFile(path.join(spritesDir, 'sprites-view.js')); },
  docsJs: loadFile(path.join(docsDir, 'docs-tab.js')),
  routeJs: loadFile(path.join(routesDir, 'route-tab.js')),
  rngJs: loadFile(path.join(docsDir, 'rng-tab.js')),
  // Order matters: rom-tab.js declares _rom, rom-init.js binds and runs last.
  romJs: ['rom-tab.js', 'rom-bus-map.js', 'rom-bus-view.js', 'rom-compare.js', 'rom-init.js']
    .map(function(f) { return loadFile(path.join(romDir, f)); }).join('\n'),
  // The sound engine first (createSpcEngine), music-init.js binds and runs last.
  musicJs: [path.join(musicDir, '..', 'engine', 'spc-engine.js')]
    .concat(['music-view.js', 'music-engine.js', 'music-audio.js', 'music-tab.js', 'music-timeline.js', 'music-forecast.js', 'music-lists.js', 'music-init.js'].map(function(f) { return path.join(musicDir, f); }))
    .map(loadFile).join('\n'),
  buildMainJs,
};
