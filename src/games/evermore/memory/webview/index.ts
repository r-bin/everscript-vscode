import * as fs from 'fs';
import * as path from 'path';
import { sourceDir } from '../../../../platform/source-dir';
import { pageBundle } from '../../../../core/webview/page-bundle';

// The page files stay in src/; this module runs from dist/.
const HERE = sourceDir(__dirname);

// Domain asset directories (resolved from src/ tree)
const coreWebviewDir = path.join(HERE, '../../../../core/webview');
const scalingDir = path.join(HERE, '../../scaling/webview');
const roomsDir   = path.join(HERE, '..', '..', 'rooms', 'webview');
const spritesDir = path.join(HERE, '../../sprites/webview');
const docsDir    = path.join(HERE, '../../docs-tab');
const romDir     = path.join(HERE, '../../rom/webview');
const musicDir   = path.join(HERE, '../../music/webview');
const scriptsDir = path.join(HERE, '../../scripts-tab/webview');
const dataDir    = path.join(HERE, '../../data-tab/webview');
const routesDir  = path.join(HERE, '../../routes/webview');

const fileCache = new Map<string, string>();

function loadFile(filePath: string) {
  if (!fileCache.has(filePath)) {
    fileCache.set(filePath, fs.readFileSync(filePath, 'utf8'));
  }
  return fileCache.get(filePath)!;
}

/** sprites-view/: the Sprites tab's script as parts in name order, inside the one IIFE they share. */
function spritesViewJs() {
  const dir = path.join(spritesDir, 'sprites-view');
  const parts = fs.readdirSync(dir).filter((f) => f.endsWith('.js')).sort().map((f) => loadFile(path.join(dir, f)));
  return '(function() {\n' + parts.join('') + '})();\n';
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
function inject(text: string, placeholder: string, content: string) {
  return text.replace(placeholder, () => content);
}

/** The page script's parts, each already read; `spritesData`, `romJs`, `musicJs`, `scriptsJs`, `dataJs` and `wramJs` may be absent. */
interface MainJsParts {
  jsData: string; roomsData: string; scalingData: string; spritesData?: string; roomsJs: string; scalingJs: string; spritesJs?: string;
  docsJs: string; rngJs: string; romJs?: string; musicJs?: string; scriptsJs?: string; dataJs?: string; routesJs?: string; wramJs?: string;
}

function buildMainJs({ jsData, roomsData, scalingData, spritesData, roomsJs, scalingJs, spritesJs, docsJs, rngJs, romJs, musicJs, scriptsJs, dataJs, routesJs, wramJs }: MainJsParts) {
  let out = loadFile(path.join(HERE, 'shared.js'));
  for (const [placeholder, content] of [
    ['__JS_DATA__', jsData],
    ['__ROOMS_DATA__', roomsData],
    ['__SCALING_DATA__', scalingData],
    ['__SPRITES_DATA__', spritesData || ''],
    ['__ROOMS_JS__', roomsJs],
    ['__SCALING_JS__', scalingJs],
    ['__SPRITES_JS__', spritesJs || ''],
    ['__DOCS_JS__', docsJs],
    ['__RNG_JS__', rngJs],
    ['__ROM_JS__', romJs || ''],
    ['__MUSIC_JS__', musicJs || ''],
    ['__SCRIPTS_JS__', scriptsJs || ''],
    ['__DATA_JS__', dataJs || ''],
    ['__ROUTES_JS__', routesJs || ''],
    ['__WRAM_JS__', wramJs || ''],
  ]) {
    out = inject(out, placeholder, content);
  }
  return out;
}

// Load scaling tab JS from split modules in src/games/evermore/scaling/webview/ (concatenated in dependency order).
// alchemy-math.js runs in outer IIFE scope; state.js opens the inner IIFE; tab-init.js closes it.
const SCALING_JS_FILES = [
  'alchemy-math.js',  // pure alchemy math — outer scope, accessible to docs-tab too
  'state.js',         // inner IIFE opener + state vars + DOM refs + char select init
  'helpers.js',       // isScalable, getWeapons, target helpers, slider helpers
  'events.js',        // srcSel/tgtSel/modeSel/button event listeners
  'damage-math.js',   // dmgCache + fmtPct + dmgRange + srcAtkAtLv etc.
  'chart.js',         // _CW constants + renderTrendChart + attachSvgEvents
  'redraw.js',        // redraw function
  'tab-init.js',      // init calls + inner IIFE close
];

function loadScalingJs() {
  return SCALING_JS_FILES
    .map(function(f) { return loadFile(path.join(scalingDir, f)); })
    .join('\n');
}

// Load rooms tab JS from split modules in src/games/evermore/rooms/webview/ (concatenated in dependency order).
const ROOMS_JS_FILES = [
  'bootstrap.js',        // globals: _currentByteScriptFocus, _applyByteScriptFocus, message listener
  'utils.js',            // escH, hexNum, normScriptAddr, tsvg, item icon helpers (ITEM_ICONS)
  'svg-spawns.js',       // buildSpawnLayers (the NPC layers svg-builder places)
  'room-variants.js',    // the room's variants above the canvas: who stands in it per story state (_roomVariants/_variantPick)
  'svg-builder.js',      // buildRoomSvgSection
  'rooms-imported.js',   // rooms converted from another game: opening them, family labels
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
  'map-editor-anim-palette.js', // the Palette Animation tab: cycling palettes, cards, states, placing
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

// Map-view pieces shared with the Secret of Mana Maps panel (src/core/map-editor/view/).
const MAP_EDITOR_DIR = path.join(HERE, '../../../../core/map-editor');
const MAP_VIEW_DIR = path.join(MAP_EDITOR_DIR, 'view');
const MAP_VIEW_JS_FILES = ['tile-animation.js', 'view-chips.js'];
// The game-neutral editor core (src/core/map-editor/core/): the Rooms editor uses its
// "not saved" notice, so both games' editors word and draw it the same way.
const EDITOR_CORE_DIR = path.join(MAP_EDITOR_DIR, 'core');
const EDITOR_CORE_JS_FILES = ['edit-session.js'];
// The shared editor shell (src/core/map-editor/shell/): layout, zoom/pan, rail, tabs, pill, status bar.
const EDITOR_SHELL_DIR = path.join(MAP_EDITOR_DIR, 'shell');
const EDITOR_SHELL_JS_FILES = [
  'frame-dock.js', // mounting the dock beside the canvas (the markup builders are the shell-frame page bundle, loaded before)
  'layout.js',    // the rail and dock resize handles, collapsed and compact states (_layoutWidths)
  'zoom-pan.js',  // setupZoomPan: scale, pan offset, pinch and two-finger panning
  'pan.js',       // dragging the map to pan it
  'rail.js',      // group/area collapse, search filter, click binding (_railQuery)
  'status.js',    // the pointer's cell in the status bar
];

function loadRoomsJs() {
  return MAP_VIEW_JS_FILES.map(function(f) { return loadFile(path.join(MAP_VIEW_DIR, f)); })
    .concat(EDITOR_CORE_JS_FILES.map(function(f) { return loadFile(path.join(EDITOR_CORE_DIR, f)); }))
    .concat([pageBundle('shell-frame')])   // markup: page frame, rail, header, canvas column, pill, status bar, tab strip (core/map-editor/shell/frame.ts)
    .concat(EDITOR_SHELL_JS_FILES.map(function(f) { return loadFile(path.join(EDITOR_SHELL_DIR, f)); }))
    .concat(ROOMS_JS_FILES.map(function(f) { return loadFile(path.join(roomsDir, f)); }))
    .join('\n');
}

export const css = loadFile(path.join(coreWebviewDir, 'shared.css')) + '\n'
    + loadFile(path.join(coreWebviewDir, 'shared-map-editor.css')) + '\n'
    + loadFile(path.join(coreWebviewDir, 'shared-tabs.css')) + '\n'
    + loadFile(path.join(roomsDir, 'map-editor-theme.css')) + '\n'
    + loadFile(path.join(EDITOR_SHELL_DIR, 'shell-tabs.css')) + '\n'
    + loadFile(path.join(EDITOR_SHELL_DIR, 'shell-canvas.css')) + '\n'
    + loadFile(path.join(roomsDir, 'map-editor-canvas.css')) + '\n'
    + loadFile(path.join(MAP_VIEW_DIR, 'map-view.css')) + '\n'
    + loadFile(path.join(EDITOR_CORE_DIR, 'map-editor-core.css')) + '\n'
    + loadFile(path.join(roomsDir, 'map-editor-tile-tab.css')) + '\n'
    + loadFile(path.join(EDITOR_SHELL_DIR, 'shell-rail.css')) + '\n'
    + loadFile(path.join(EDITOR_SHELL_DIR, 'shell-layout.css')) + '\n'
    + loadFile(path.join(roomsDir, 'rooms-layout.css')) + '\n'
    + loadFile(path.join(spritesDir, 'sprites-layout.css')) + '\n'
    + loadFile(path.join(spritesDir, 'sprites-stage.css')) + '\n'
    + loadFile(path.join(spritesDir, 'sprites-views.css')) + '\n'
    + loadFile(path.join(romDir, 'rom-tab.css')) + '\n'
    + loadFile(path.join(musicDir, 'music-tab.css')) + '\n'
    + loadFile(path.join(scriptsDir, 'scripts-tab.css')) + '\n'
    + loadFile(path.join(dataDir, 'data-tab.css')) + '\n'
    + loadFile(path.join(routesDir, 'routes-tab.css')) + '\n'
    + loadFile(path.join(HERE, 'ppu-views.css'));
export function scalingJs() { return loadScalingJs(); }
export function roomsJs() { return loadRoomsJs(); }
export function spritesJs() { return loadFile(path.join(spritesDir, 'sprites-lazy.js')) + '\n' + loadFile(path.join(spritesDir, 'sprites-script.js')) + '\n' + loadFile(path.join(spritesDir, 'sprites-motion.js')) + '\n' + spritesViewJs(); }
export const docsJs = loadFile(path.join(docsDir, 'docs-tab.js'));
export const rngJs = loadFile(path.join(docsDir, 'rng-tab.js'));
export const romJs = ['rom-tab.js', 'rom-bus-map.js', 'rom-bus-view.js', 'rom-compare.js', 'rom-init.js']
    .map(function(f) { return loadFile(path.join(romDir, f)); }).join('\n');
export const musicJs = [loadFile(path.join(musicDir, '..', 'engine', 'spc-engine.js')), pageBundle('music-view'), pageBundle('music-engine')]
    .concat(['music-audio.js', 'music-tab.js', 'music-timeline.js', 'music-hover.js', 'music-forecast.js', 'music-lists.js', 'music-init.js'].map(function(f) { return loadFile(path.join(musicDir, f)); }))
    .join('\n');
// The Maps view's builders are TypeScript (scripts-maps.dom.ts): its bundle declares `ScriptsMaps` inside the page's IIFE.
export const scriptsJs = [pageBundle('scripts-maps')].concat(['scripts-tab.js', 'scripts-room.js', 'scripts-anim.js', 'scripts-music.js', 'scripts-init.js']
    .map(function(f) { return loadFile(path.join(scriptsDir, f)); })).join('\n');
// The Data tab is TypeScript (data-tab.dom.ts): its bundle declares `DataTab` inside the page's IIFE, which hands it `vs`.
export const dataJs = pageBundle('data-tab') + '\nDataTab.setupDataTab(function (m) { if (vs) vs.postMessage(m); }, typeof ACTIVE_TAB !== \'undefined\' ? ACTIVE_TAB : \'\');';
// The Routes tab is TypeScript (routes-tab.dom.ts): its bundle declares `RoutesTab`; the page hands it `vs` and the Maps tab's room opener.
export const routesJs = pageBundle('routes-tab') + '\nRoutesTab.setupRoutesTab(function (m) { if (vs) vs.postMessage(m); }, typeof ACTIVE_TAB !== \'undefined\' ? ACTIVE_TAB : \'\',' +
  ' typeof gotoVanillaRoom === \'function\' ? gotoVanillaRoom : null);';
// The Memory tab's sub-bar and WRAM coverage are TypeScript (wram-view.dom.ts): its bundle declares `WramView` inside the
// page's IIFE; `memShowView` is declared there for rom-init.js, and the page hands it the row filter and the ROM views' switch.
export const wramJs = pageBundle('wram-view') + '\nvar memShowView = WramView.memShowView;\n' +
  'WramView.setupWramView(function (m) { if (vs) vs.postMessage(m); }, typeof ACTIVE_TAB !== \'undefined\' ? ACTIVE_TAB : \'\',' +
  ' { recomputeRows: recomputeRows, romShow: typeof romShow === \'function\' ? romShow : null });';
export { buildMainJs };
