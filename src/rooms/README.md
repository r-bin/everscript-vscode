# rooms/ — Rooms Tab Subsystem README

## Ownership

Owns: all rooms tab server-side logic — room tree building, room content parsing, vanilla data, lua-watcher POIs, server-side HTML/JSON rendering.

Does NOT own: client-side room interactions, SVG rendering (those live in `webview/`), ROM map decoding (that is `../maps/`, a pure model), emulator state, memory-map state.

---

## Directory Map

```
rooms/
  index.js                    — Public API + backwards-compat adapters
  custom-host.js              — custom maps: the webview's list/save/delete/export messages (VS Code API injected)
  parsing/
    content-parser.js         — parseRoomContent(filePath, startLine, endLine) → room data object
    file-scanner.js           — buildRoomTree, collectRoomsFromDir, findRoomImage, setRoomImageUris
  rendering/
    tree-renderer.js          — renderVanillaTree(rooms), renderRoomsTree(nodes), buildRoomRailHtml(live, vanilla), buildRoomsJson(tree)
    tile-overlay.js           — buildRoomTileOverlay: the map raster, the canopy, and the canopy overlay
    object-previews.js        — Section 3 objects: states, thumbnails, the selection wire form
    rom-fingerprint.js        — romFingerprint(rom): the cache key every render cache shares
    metatile-palette.js       — buildRoomMetatilePalette: the dictionary atlas + one packed row per stamp
    stamp-animation.js        — animated stamps' later frames (`anim`), so a placed torch flickers on the canvas
    vanilla-index.js          — the vanilla index + room budget, cached per ROM, packaged for the tab
    room-draft.js             — blank rooms, family sheets, the family catalogue and its preview strips
    deco-catalogue.js         — the deco library: vanilla's Section 3 objects as portable, floor-free entries
    deco-preview.js           — one entry rendered on nothing, so the thumbnail is the thing not the place
    rom-export.js             — Export ROM: a custom map in room 0x15, the intro jumping there
    custom-export.js          — Export map: the .zip (blob, map.json, sample .evs, stamps.json, README)
  data/
    widget-store.js           — the user's own widgets: <globalStorage>/widgets.json (list, save, delete)
    vanilla-data.js           — VANILLA_ROOMS catalogue + buildVanillaRoomContent/Details + ROM backing
    lua-watchers.js           — getMapEnum, readLuaWatchers, readScriptAllTriggers + caches
    custom-store.js           — custom maps on disk: one folder per map (map.json + history.json)
```

---

## Public API (via index.js)

Always import rooms functionality through `rooms/index.js`, never bypass to internal files.

```js
const {
  parseRoomContent,
  findRoomImage,
  collectRoomsFromDir,
  buildRoomTree,        // adapted: injects deps automatically
  setRoomImageUris,
  renderVanillaTree,    // adapted: injects VANILLA_ROOMS automatically
  renderRoomsTree,
  buildRoomsJson,
  VANILLA_ROOMS,
  getMapEnum,
  readLuaWatchers,
  readScriptAllTriggers,
  buildVanillaRoomContent,
  buildVanillaRoomDetails,
  invalidateRoomDataCaches
} = require('./rooms');
```

---

## State Owned (module-local)

| State | File | Notes |
|---|---|---|
| Lua watcher POI cache | `lua-watchers.js` | Invalidated by `invalidateLuaWatcherCaches()` |
| Vanilla data cache | `vanilla-data.js` | Invalidated by `invalidateVanillaDataCaches()` |
| Room tree cache | `extension.js._radarRoomTree` | Rooms module is STATELESS; cache owned by caller |

---

## Dependency Rules

```
content-parser.js  → fs, parseEvsNum (radar-utils)
file-scanner.js    → fs, path, readPngDimensions (rom-readers), content-parser.js
                    receives deps: {getMapEnum, readScriptAllTriggers, readLuaWatchers, readRomMapHeader}
tree-renderer.js   → radarEsc (radar-utils), buildRoomsJson pure transform
lua-watchers.js    → fs, path, rom-readers.js
vanilla-data.js    → fs, path, rom-readers.js
index.js           → all of above + injects deps
```

**Forbidden:**
- `rooms/` → `extension.js` (no upward call)
- `rooms/` → `debugger/`
- `rooms/` → `code_highlighter/`
- `rooms/` → `vscode` (pure server-side logic)

---

## Data Flow

```
buildRoomTree(doc, wsRoot, extCfg, deps)
  ↓ collectRoomsFromDir(dir, wsRoot, depth)
      → parseRoomContent(filePath, startLine, endLine)  [per .evs file]
      → readRomMapHeader(wsRoot, mapId)                 [per map]
      → readScriptAllTriggers(wsRoot, mapName)          [per map]
      → readLuaWatchers(wsRoot, mapName)                [per map]
  ↓ setRoomImageUris(nodes, webview)                    [after panel created]
  ↓ renderRoomsTree(nodes)                              → HTML string
  ↓ buildRoomsJson(tree)                                → JSON object
```

---

## Key Invariants

1. `content-parser.js` is pure: takes file path + line range, returns data — no side effects.
2. `file-scanner.js` uses explicit deps injection — no direct requires of rom-readers/lua-watchers.
3. `buildRoomsJson` flattens the tree to `{ mapName: { content, romHeader, ... } }`.
4. `renderVanillaTree` and `renderRoomsTree` return HTML strings — no DOM operations.
5. `index.js` bridges old no-arg API (used by `extension.js`) to new dep-injected API.

---

## Client-Side Counterpart

The client-side room interactions live in `webview/`, concatenated into one
script by `memory/webview/index.js` (`ROOMS_JS_FILES` fixes the order):
- `bootstrap.js` — message listener, byte-script focus
- `utils.js` — escH, hexNum, tsvg, helpers
- `svg-spawns.js` — `buildSpawnLayers()` → `{behind, front, marks}`: the NPCs
  a room can place, split by whether the game draws them over the foreground
- `svg-builder.js` — `buildRoomSvgSection()` → `{html, zoomState, ...}`; stacks
  map → spawns behind → canopy → spawns in front → canopy overlay → annotation
- `metatile-palette.js` — the Tile palette section; owns `_mtPalette` / `_mtLayer` /
  `_mtSelected` and the `requestRoomMetatiles` cycle
- `map-editor.js` — the edit draft, undo stack and export shape; owns `_edit`.
  Deliberately DOM-free, which is what makes `tests/memory/map-editor.test.js`
  possible
- `map-editor-stamps.js` — the stamp dictionary: composing/deduplicating
  drafted metatile combinations and adopting graphics into Block 1. Split out
  of `map-editor.js` once Phase 4's trigger-selection undo support pushed it
  toward 400 lines; still DOM-free, still reads/writes `_edit` through
  `editDraft()` rather than owning it
- `map-editor-phases.js` — what a paint stroke and the eraser each write; no
  state of its own. Through v0.58.1 this held the `room`/`deco` phase toggle;
  §8a.2 dropped it — `editResolve` now derives "is this a decoration?" from
  the *brush's* own composed words when painting (blank canopy = ground,
  replace outright; real canopy = decoration, preserve the terrain) and
  "is there anything to erase?" from the *cell's* own words when erasing
  (unconditionally now, not gated on a phase — a real usability fix, not
  just a simplification)
- `map-editor-constructs.js` — saving and stamping a rectangle, in the portable
  `{graphic, family, flags}` form a word cannot travel in; no state of its own
- `map-editor-families.js` — the seven palette slots, the family catalogue and
  picking a tile out of one; owns `_famCatalogue` / `_famSheets` / `_brushTile`
- `map-editor-chips.js` — the family cards, split into the seven adopted
  slots and the candidates you can adopt (§8a: they used to be one
  interleaved list, which is most of what made the tab read as noise);
  owns `_chipSel` / `_chipPreviews` / `_chipFilter` / `_chipPage` /
  `_famAddOpen`
- `map-editor-relations.js` — what vanilla draws beside what, split out of
  `map-editor-chips.js` in §8a so the model is not tangled with the cards
  that read it; owns `_related` / `_relatedKey` (undirected, seeded from
  placed cells, sorts the tile grids) and `_nbAnswer` / `_nbKey` / `_nbView`
  / `_nbCycle` / `_nbFocus` (directional, seeded from the armed brush alone,
  feeds only the plus-shape — §8b). Two seeds, never mixed
- `map-editor-neighbours.js` — the LIKELY NEIGHBORS plus-shape: the brush in
  the centre, `neighbourTiles`' per-side candidates around it; click to
  focus/cycle, scroll to cycle (one wheel listener, bound in
  `bindEditControls`), centre toggles front/ground (`brushLayerToggle`, in
  `map-editor-tiles.js` beside the `_layerForce` it writes). Owns `_nbWheel`
- `map-editor-stranded.js` — the invalid-family banner and its two actions
  (re-adopt the family, or clear the cells that need it). Owns nothing:
  both actions go through existing owners, and the clear is one undoable
  `editApply` step
- `map-editor-tiles.js` — the tile browser: grouped by family, ranked by what
  vanilla draws beside what, badged with the layer it belongs on. Lists every
  family's full art with no pager, lazily (`_tileObserver` fetches a sheet as
  its fixed-height placeholder nears the view), and keeps each group's place
  in the list (`_tileOrder`); owns those and `_layerForce` / `_brushFlip` (the last two are the
  segmented row's two brush modifiers, so they live with the control that
  renders them)
- `map-editor-deco.js` — the generated vanilla library, the Widgets tab's
  second section (`decoLibraryHtml`, shown with the `vanilla` toggle; the tab
  itself is `map-editor-widgets.js`). One scrolling list, with thumbnails
  loaded lazily; owns `_deco` / `_decoFilter` / `_decoArt` / `_decoPick` /
  `_decoSaveWanted`. Cards are grouped into Foreground/Background/Misc by
  `front`/`back`, two booleans `deco-catalogue.js`'s `decoIndex` derives
  from the same per-cell canopy/terrain split the `front` filter flag
  already used — there is no ROM-native category. The tab's "Ready only"
  toggle is not new state: it reads/writes the same `_decoFlags.works`
  boolean the "works" filter chip already owned (`d.scriptId !== null` —
  "comes with a script that does something on placement"), through the same
  `data-deco-flag="works"` click key, so the two controls cannot disagree.
  Widget Editor Mode (authoring a *custom* widget, mock screen 7) was
  scoped out of Phase 5 — see docs/map-editor-redesign-plan.md §5.3
- `map-editor-special.js` — the Special tab (Stairs & Drift / Gate /
  Entrance): the catalog, the collision-word bit math for gate and drift
  (docs/map-format/map_collision_mechanics.md §4, §6 — stairs and entrance
  are UI-only, see that file's header), the tab's markup, and the filter
  bar's "special" chip + dropdown. State (`currentSpecialId`,
  `specialCells`) lives in map-editor.js's `_edit`; this file only reads and
  writes it through `editDraft()`/`editApply()`
- `map-editor-trigger-select.js` — unifies the room's own ROM-sourced
  triggers (`_mtPalette.attachments`, read-only) with this draft's own
  (`_edit.placed`) into one selectable/movable/deletable/copy-pasteable
  concept for the Select tool: hit-testing, drag math, and the
  delete/move/copy/paste verbs, each going through `editApplyTriggerOp()`
  (map-editor.js) so they share the tile grid's own undo stack. Owns
  `_triggerDrag` (the in-progress drag) and `_triggerClipboard` (an instance
  field, not undoable); writes `_edit.selectedTriggerRef` / `.removedTriggers`
  without owning `_edit` itself — see docs/map-editor-redesign-plan.md Phase 4
- `map-editor-trigger-panel.js` — the Trigger tab's list UI (mini position
  crop, click-to-select, remove button) and the Info tab's trigger counts;
  renders what map-editor-trigger-select.js's model reports, the same split
  as map-editor-special.js (model) vs. its own tab markup. The filter bar's
  Triggers chip used to live here too — Phase 7a moved it to
  `map-editor-filterbar.js` with the rest of the bar's arrangement, since it
  grew sub-toggles (the ROM trigger overlay, the two grids) this file has no
  business knowing about and it carried no model of its own
- `map-editor-trigger-order.js` — dragging trigger rows: the list's order
  (`_edit.triggerOrder`) and changing a trigger's kind; owns `_triggerDragRow`
- `map-editor-objects.js` — the Object tab: object areas and the tiles drawn over them
- `map-editor-object-list.js` — the Object tab's rows (drawn like the trigger rows), open/closed, drag to reorder
- `map-editor-placed-list.js` — the Widgets tab's Placed rows: stamped widgets in draw order, drag to reorder, disband, remove
  (their changed look); owns `_objectSel` / `_objectDraw`
- `map-editor-widgets.js` — the user's own widgets and the Widgets tab (yours first,
  vanilla behind a toggle); owns `_widgets` / `_widgetArt` / `_widgetsVanilla`
- `map-editor-widget-edit.js` — Widget Editor Mode: a widget on its own canvas, a
  custom map the rail never lists, down to 1×1; while open, the room's name line is
  the widget's app bar (back, name, size, Delete); owns `_widgetEdit` / `_widgetBack`
- `map-editor-widget-colours.js` — a widget's stored shape (cells, each part with its
  `anim`) and its colourings, derived from the families the host sends; owns `_widgetFamilies`
- `map-editor-animations.js` — which tile slots a Section 2 channel drives, and the
  animation groups (`_edit.anims`): still vs animated adoption, a ROM room's channels
  grouped, timing letters, the channels the preview and export get; owns `_animSel` / `_animFrame`
- `map-editor-anim-tab.js` — the Animation tab: rows, the timing editor (ticks per
  frame, initial countdown), its pencil (a rectangle becomes a group; frame painting),
  the map outlines; owns `_animDraw` / `_animPainting`
- `map-editor-collision-tab.js` — the Collision tab: a cell's geometry set by hand on
  its own layer (`_edit.coll`), over the tile's estimate, applied only where a word
  leaves the editor (romExportPayload, editExport); owns `_collPick`
- `map-editor-history.js` — the undo-step parts beyond cells/triggers/groups/header:
  the seven family slots with the animations on the same snapshot, and a resize's size; stateless
- `map-editor-preview.js` — hover ghosts of what a pencil/stamp/eraser click would
  do, and the outline of a resize drag's new size; never writes (no stamp, no
  adoption — a widget's ghost is host-rendered, `requestDeco {ghost}`); owns
  `_previewCell` / `_ghostArt` / `_ghostAsked`
- `map-editor-actions.js` — the toolbar's verbs, split out of the input handler
- `map-editor-paint.js` — drawing the draft on the map from the palette atlas,
  the region maths, and the Select tool's outline/drag-preview rectangles;
  owns `_editSel` / `_editClip`
- `map-editor-anim.js` — an animated stamp drawn as its frames, one shown at a
  time on the document clock (stateless)
- `map-editor-ui.js` — the docked sidebar, the metatile composer, the construct
  library and `renderEditChrome`; owns `_editOrigin` / `_editComposed` /
  `_editCompose` / `_editConstruct`. The tool bar left in Phase 7a — see
  `map-editor-toolbar.js`
- `map-editor-toolbar.js` — the floating tool pill above the canvas card:
  `EDIT_TOOLS` / their icons, and the `⋯` overflow (`EDIT_OVERFLOW_ACTS`:
  discard, copy draft, new room — which **stays** here: Phase 7b found it is
  a different action from the rail's `+ New Map`, borrowing the open room's
  graphics behind an inline w/h form rather than being the project-level,
  works-with-nothing-open entry point). Icon-only, one row, grouped by
  dividers. The `room`/`deco` phase pair that used to sit here is gone as of
  §8a.2 — layer targeting is the Tile tab's own `auto|front|ground` row
  (`_layerForce`), not a second control the pill needs. Owns no state and
  binds no listener: clicks reach `editAction` through map-editor-input.js's
  one delegated handler. The mock's `S`/`B`/`◆` pill buttons are
  **deliberately absent** — no trigger-draft or collision-brush tool exists
  here, and a dead control is worse than an honest gap
- `map-editor-filterbar.js` — the canvas column's two docked bars: the view
  filter bar (`buildViewFilterBarHtml`) and the status bar
  (`buildStatusBarHtml` + `setupStatusBar`). Owns the *arrangement* the design
  mock asks for — a segmented `Background|Foreground|Collision` pill plus
  `Triggers ▾`/`Objects ▾`/`Special ▾`/`More ▾` and the `edit`/`locked`
  actions — over ~25 pre-existing toggles that all kept their own
  `data-hide`/`data-ov`/`data-layer` keys. Owns no state: every chip renders
  the one owner of what it shows (rom-overlay.js for the ROM views,
  map-editor-special.js for the Special chip, shared.css's hide-classes for
  the rest). `detail-renderer.js` still decides *which* toggles apply to a
  given room; this file decides where they sit
- `map-editor-tabs.js` — which of the dock's six tabs (Tile / Special /
  Trigger / Object / Widgets / Info — the mock's own order, plus Object)
  is showing, and the tab strip that switches
  between them; owns `_editActiveTab`. Renders nothing but the strip itself
  — see `map-editor-panels.js` for what the Tile/Info/Trigger tabs hold
  (Special's own content is `map-editor-special.js`'s `specialTabHtml`;
  Object's is `map-editor-object-list.js`'s `objectTabHtml`; Widgets' is
  `map-editor-widgets.js`'s `widgetsTabHtml`)
- `map-editor-panels.js` — the metrics, the checks, the needed-metatile
  read-out, and the panel column itself, filed under the active tab
  (`tileTabHtml`/`infoTabHtml`/`triggerTabHtml`); owns `_panelOpen`. The
  Trigger tab is the dock's own authoritative trigger list as of Phase 4
  (map-editor-trigger-panel.js's `triggerTabPanelHtml`), no longer a mirror
  of the read-only entity tables. The Tile tab no longer includes the deco
  picker as of Phase 5 — it moved to its own Widgets tab
  (map-editor-deco.js's `widgetsTabHtml`)
- `map-editor-gestures.js` — capture-phase pointer and key gestures on the map,
  so nothing is intercepted while edit mode is off; owns `_editDrag`. Also
  owns the Select tool's own gesture wiring (drag start/move/commit,
  Backspace/Delete, Cmd/Ctrl+C/V) and their text-input focus guard, though the
  model those call into is map-editor-trigger-select.js's
- `map-editor-input.js` — clicks on the *chrome*, routed to what they mean, plus
  the status line and the edit toggle; owns `_editPendingNote` / `_editPanelRoom`.
  Bound **once per panel node**: `#room-detail` outlives a re-render, and a second
  handler made every toggle fire twice and cancel itself out. Also owns
  `EDIT_FILTER_MENUS`, the one list every dropdown in the editor's chrome
  registers into — the filter bar's four (Triggers, Objects, Special, More)
  and the tool pill's `⋯` — which drives both their open/close toggle and the
  close-on-outside-click sweep, so a new dropdown needs one list entry plus
  one `EDIT_CLICK_KEYS` key rather than a second mechanism
- `map-editor-custom.js` — custom maps: `+ New Map` / the `new map` command /
  the inline "new room" form each make one, as a row under Custom rooms with its
  own name and draft (`_edit.customKey`). Opens it through `renderRoomDetail`
  with a synthetic room (`custom`, `romRoomId` = the donor), then fetches the
  donor's dictionary and a blank grid. Persists the list through `uiPrefs`.
  Owns `_customMaps` / `_customActive` / `_newMapWaiting`
- `map-editor-start.js` — the Boy's start marker on a drafted map: placed when
  the blank room arrives, drawn from the ROM's own Boy sprite, moved by the
  Special tab's `start` pick, never removable; also strips the donor room's
  NPCs/doors/triggers off the canvas (`editClearDonorScenery`). Owns `_startSprite`
- `map-editor-newroom.js` — the blank-room round trip, `> everscript new map`,
  and the canvas resize grip; owns `_newRoomOpen` / `_resizing` / `_resizeKeep`.
  The grip's own visual chrome (`.rg-resize`/`.rg-resize-label`) is themed in
  map-editor-canvas.css; this file owns only its drag math
- `map-editor-trigger-scripts.js` — the scripts in the Trigger tab's rows
  (collapsed: what the script does; open: one summary line per instruction)
  and the Enter tab; owns `_triggerOpen` / `_triggerEnterView`
- `rooms-layout.js` / `rooms-layout.css` — the tab fills the screen with
  nothing under the editor; the rail and dock resize handles (`_layoutWidths`,
  saved as the `layoutWidths` UI pref)
- Nothing is drawn under the editor since v0.90.0: the entity tables, script
  cards, ROM header, sprite palettes, ROM data section and object-state
  browser were removed or parked in `sandbox/room-data/` (its README says
  which and why)
- `interactions.js` — zoom/pan, mouse events, click handlers. Also writes the
  zoom chip's `%` read-out from its own `applyZoom`, since it is the single
  owner of the scale (100% = one ROM pixel per screen pixel: a viewBox unit
  is an 8 px tile, so the scale is divided by 8)
- `rom-overlay.js` — the ROM view controls; owns `_currentLayer` /
  `_currentOverlay`.
  Exports one builder per control (`romLayerButtonHtml`,
  `romOverlayButtonHtml`, `romVisSegmentHtml`, …) rather than one pre-baked
  row, because map-editor-filterbar.js arranges them into six slots.
  `romLayerVis('bg'|'fg')` derives the filter bar's two independently
  toggleable Background/Foreground segments from the single layer choice the
  host actually bakes — one owner, two views, no mirrored booleans
- `detail-renderer.js` — `renderRoomDetail(room)` orchestrator; owns
  `_pendingTileRoom` / `_pendingTileOrigin` and the roomTiles request cycle.
  Decides *which* view toggles apply to this room (it has the header's own
  data — `hasCoordData`, `roomVanillaIdNum`, `hasIngr`) and hands that as a
  context object to `map-editor-filterbar.js`, which decides where they sit;
  the resulting bar and status bar go to `buildRoomSvgSection`
  (`svg-builder.js`) to place below the canvas card, rather than being
  rendered here under `.rd-head`
- `rooms-rail.js` — the left rail: the two collapsible top-level groups
  (`Vanilla rooms` / `Custom rooms`), area collapse, the client-side search
  filter, which row is selected, the `+ New Map` footer, and
  `gotoVanillaRoom` (the exit-link target — see §Exits). Owns `_railQuery`
  and `_railExitBound`. There is **no `_vanillaMode`** any more: the pre-7b
  mode toggle swapped two trees in and out, and the rail now shows both at
  once, so "which tree am I looking at" is not state — a row says which it
  came from itself (`data-vid` = ROM catalogue, `data-map` + `data-line` = a
  room declared in the active `.evs` file). One delegated click listener on
  `#rm-rail-scroll`, guarded by a dataset flag, walking up from `e.target`
  in three branches (group header / area label / room row)
- `tab-init.js` — the radar panel's top-level tab strip, and nothing else
  since Phase 7b moved the rail out
- `map-editor-theme.css` — the map editor's design tokens (oklch palette
  ported from `docs/map-editor-redesign-plan.md`'s design mock) plus the
  chrome for everything that is *not* the canvas column: the panel column's
  tab strip (`#rg-tabstrip` / `.rg-tab`), the Special / Widgets / Trigger tab
  bodies, and the two canvas overlays those tabs own (`.rg-special-glyph`,
  `.rg-trigger-sel`). Scoped entirely under `.rg-theme`, the class
  `renderRoomDetail` puts on `#room-detail` — never touches `shared.css`, so
  the memory/scaling/docs/route tabs render unchanged, and never touches
  plain `.rd-filters`/`.rdf` rows elsewhere (family/tile/deco filters, the
  composer) — those keep the pre-redesign flat look on purpose
- `map-editor-canvas.css` — the canvas column's own chrome, split out of
  map-editor-theme.css in Phase 7a: the centred canvas card
  (`.rg-canvas-zone`/`.rg-canvas-card`), the floating tool pill
  (`#rg-edit-bar`), the zoom chip (`.rg-zoom`), the docked filter bar
  (`.rg-view-filters`) with its segmented group (`.rg-seg`) and the shared
  dropdown chrome (`.rg-filter-group`/`.rg-filter-caret`/`.rg-filter-popup`
  plus the `-grid`/`-down` variants — one chrome for all five dropdowns; only
  each popup's own id is dropdown-specific), the status bar (`.rg-statusbar`)
  and the resize grip. Consumes theme.css's tokens, so it must be
  concatenated after it — both are appended to `shared.css` in
  `src/memory/webview/index.js`'s `css` export, not part of the
  `ROOMS_JS_FILES` bundle (they are CSS, not JS). Every `display` rule on a
  popup needs a matching `[hidden]` override: an author rule beats the UA
  stylesheet's `[hidden]{display:none}` regardless of specificity, which is
  how a dropdown once stayed visually open for four phases
- `map-editor-tile-tab.css` — the Tile tab's own chrome (§8a), in its own
  file for the same size reason `rooms-rail.css` is: the family cards and
  their collapsed swatch strip, the `+ add a family` control, the invalid-
  family banner, the segmented brush-modifier row (`auto|front|ground` and
  `H|V`), the LIKELY NEIGHBORS card, and the family group headers
- `rooms-rail.css` — the left rail's own chrome (Phase 7b), in its own file
  because `map-editor-canvas.css` was one rule from the size limit and
  `shared.css` is shared by every radar tab. The rail is a **sibling** of
  `#room-detail`, so `.rg-theme` cannot reach it: it carries its own hook,
  `.rg-rail`, which theme.css's token selector also lists (`.rg-theme,
  .rg-rail`) — one declaration of the palette, two scopes. That hook is also
  what switches the rail, and only the rail, off shared.css's monospace body
  font; ids inside it stay mono. Rules here outrank shared.css's flat
  pre-redesign tree rules on **specificity** (`.rg-rail li.rn-map` beats
  `.rn-map`), never on source order, so the result does not depend on how
  the bundle is concatenated

Because the files share one scope, a global belongs to exactly one of them.
`rom-overlay.js` owns the view state; `detail-renderer.js` owns the request
state. Do not mirror either into the other.

## Loot icons

A B-trigger shows the ring menu's own icon for what it hands over —
ingredients, consumables and armour — decoded from the user's ROM, never a
bundled image. `data/item-icons.js` encodes them once per ROM buffer and the
page receives them as `ITEM_ICONS.loot`, a PNG data URI per `LOOT_REWARD` name
(the Scaling tab reads `ITEM_ICONS.alchemy` from the same global). The format
is [docs/item-icons.md](../../docs/item-icons.md).

Live rooms name their triggers in the source; vanilla rooms have no names, so
the name comes from the reward `src/script/` read out of the ROM script.
`trigItemName()` in `webview/utils.js` owns that choice — source name first,
decoded reward second — so both paths go through one renderer. Keywords
(`sniff_wax_2` → `WAX`) apply only to a name an author wrote; a decoded reward
is matched exactly, or `LIMESTONE_TABLET` would draw as Limestone.

An icon is drawn 2×2 viewBox units — 16px against an 8px tile, the size the
game draws it. Without a ROM, `itemEmoji()` stands in. Money, trade goods and
charms have no ring icon and get nothing.

## Exits

`src/script/` reads a script's `CHANGE MAP` destinations, so a door trigger
shows where it leads. The link navigates by clicking that room's own tree
entry (`gotoVanillaRoom`, rooms-rail.js) rather than duplicating the
selection logic — one place owns highlight and render. Since Phase 7b it
first clears the search filter and opens the `Vanilla rooms` group, because
a `display:none` row cannot be clicked into view; before 7b the equivalent
step was pressing the `Vanilla` mode button. All 605 exits in the ROM land
on a room the catalogue lists, so no link is dead.

## Clicking the map

A plain left click selects: it highlights the shape and the matching row.
**Cmd/ctrl-click also jumps** — scrolls that row or script card into view.
Browser rules, and it keeps the panel from lurching every time you point at
something. Cmd-click on a live entity with a source line still goes to the
code; that handler stops propagation, so the two never both fire.
