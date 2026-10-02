# State Flow Map — Everscript VS Code Extension

> Authoritative reference for state ownership and data flow.
> When you're unsure who owns a piece of state — check here first.

---

## 1. State Ownership Table

| State | Owner File | Type | Notes |
|---|---|---|---|
| `_radarPanel` | `extension.js` | VS Code WebviewPanel | Single singleton |
| `_radarPinned` | `extension.js` | bool | Panel pin state |
| `_radarDoc` | `extension.js` | VS Code TextDocument | Last rendered doc |
| `_radarCurrentScope` | `extension.js` | string | Last scope name |
| `_radarMapCache` | `extension.js` | object | Parsed `.github/memory-map.md` |
| `_radarEnumCache` | `extension.js` | Map | addr → [{cls,name}] |
| `_radarUpdateTimer` | `extension.js` | timer | Debounce (400/600ms) |
| `_radarRoomTree` | `extension.js` | array | Built per-document |
| `_radarActiveTab` | `extension.js` | string | 'radar'/'rooms'/etc. |
| `_scalingChars` | `extension.js` | array | 142 character stat entries |
| `_hitLookup` | `extension.js` | object | Precomputed hit% table |
| `_scaleActive` | `extension.js` | bool | scale_enemies in workspace |
| `_ingrBaseUri` | `extension.js` | string | Webview URI for ingredient images |
| `_radarByteScriptFocus` | `extension.js` | string | Emulator→Radar focus |
| zoom/pan | `detail-renderer.js` (webview) | local | Per-render, not persisted |
| selection | `interactions.js` (webview) | local | Per-render, not persisted |
| filter toggles | `interactions.js` (webview) | local | DOM class toggles |
| room rail search | `rooms-rail.js` (webview) | `_railQuery` | Client-side only. Replaced `tab-init.js`'s `_vanillaMode` in Phase 7b: the rail is one list with two collapsible groups now, not two trees swapped by a mode button, so "which tree" is no longer state — a row says which it came from (`data-vid` vs `data-map`). Group/area expansion is not mirrored into JS either: it lives in the DOM (`[hidden]` on a group body, `.collapsed` on an area), and a search never writes it — `.rm-searching` force-reveals through CSS for the duration instead, so clearing the field restores what the user had open |
| byte script focus | `bootstrap.js` (webview) | `_currentByteScriptFocus` | Updated via message |
| emulator ROM state | `debugger/emulator/panel.js` | local | Per-panel |
| map editor active tab | `map-editor-tabs.js` (webview) | `_editActiveTab` | `'tile'\|'special'\|'trigger'\|'object'\|'widgets'\|'info'` (the design mock's own order, plus Object after Trigger since v0.80.0); gates what `map-editor-panels.js`'s `renderEditPanels()` builds into `#rg-panels` (Object routes to `map-editor-object-list.js`'s `objectTabHtml`, Widgets to `map-editor-widgets.js`'s `widgetsTabHtml`). It also decides what the pencil draws (`editDrawKind`, below). The rest of the map-editor's dock/gesture/palette state (`_panelOpen`, `_editOrigin`, `_editCompose`, `_mtPalette`, …) predated this table until Phase 6 — see the backfill block below the ownership table |
| Widgets tab "Ready only" toggle | `map-editor-deco.js` (webview) | `_decoFlags.works` | Not new state — the Widgets tab's toggle and the picker's own "works" filter chip read/write the same boolean (`d.scriptId !== null`) through the same `data-deco-flag="works"` click key, so the two controls cannot disagree. Category grouping (Foreground/Background/Misc) reads `d.front`/`d.back`, computed server-side by `deco-catalogue.js`'s `decoIndex` — no client state of its own |
| `_edit.currentSpecialId` | `map-editor.js` (webview), field on `_edit` | string\|null | The Special tab's armed pick (e.g. `'gate-dog'`); set directly by `map-editor-special.js`'s click handler in `map-editor-input.js`, the same way `_edit.tool`/`_edit.brush` already are |
| `_edit.specialCells` | `map-editor.js` (webview), field on `_edit` | `{"x,y": specialId}` | The Special tab's glyph overlay, written only through `editApply()`'s `specialWrites` param so it shares `_edit.undo`/`_edit.redo` with the tile grid — see `map-editor-special.js`. Gate/drift's *real* collision effect is not stored here: it lands in `_edit.cells` as an ordinary (possibly newly composed) stamp, exactly like a tile paint. This field is UI-only and is never read by `editExport()` |
| `_edit.start` | `map-editor.js` (webview), field on `_edit` | `{x, y}`\|null | The Boy's start on a drafted map (null on a ROM room). Placed by `map-editor-start.js`'s `editStartPlace` when a blank room arrives (centred on a new map, clamped inside on a resize), moved only by `editMoveStart`, which pushes a `start` step onto the shared undo stack. Not a cell or a special, so erase cannot remove it. Not exported |
| `_customMaps` | `map-editor-custom.js` (webview) | `[{key,name,borrow,w,h,saved,history}]` | The custom maps under the rail's Custom rooms group. `saved` is the draft's data (`CUSTOM_DRAFT_FIELDS`) and `history` its undo/redo stacks. Folded back from the live `_edit` by `customStash` when you leave the map and by a debounced save (`customSaveSoon`), then written by the host as a folder per map under `<globalStorage>/custom-maps/` (`rooms/data/custom-store.js`, docs/map-format/custom-map-files.md). Loaded with `requestCustomMaps` once `uiPrefs` arrive; maps still in the old `uiPrefs.customMaps` are migrated |
| `_customLoaded` | `map-editor-custom-store.js` (webview) | `'no'\|'asking'\|'yes'` | Whether the host's map list is in; `customNew` waits for it so `+ New Map` can reopen an untouched map |
| `_customActive` | `map-editor-custom.js` (webview) | string\|null | Key of the custom map on screen; null on a ROM/.evs room |
| `_edit.customKey` | `map-editor.js` (webview), field on `_edit` | string\|undefined | Set on a custom map's draft by `customBindDraft`. Distinguishes it from the donor room's own draft, since both carry the donor's `roomId` |
| `_startSprite` | `map-editor-start.js` (webview) | `{uri,w,h,ox,oy}`\|null | The Boy's south-facing sprite, from the host's blank-room reply (`room-draft.js`'s `boySprite`, character record 0) |
| `_panelOpen` | `map-editor-panels.js` (webview) | `{families, neighbours, errors}` | Which dock sections are open. TILE FAMILIES and LIKELY NEIGHBORS start closed; toggles are saved with `saveUiPref` (key `panelOpen`) into `globalState['everscript.roomsUi']` and reloaded by `applyUiPrefs` |
| `_tileAnchorFam` | `map-editor-panels.js` (webview) | number\|null | The family whose group a tile click landed in; `renderEditPanels` keeps that group at the same screen offset across the redraw, then clears it |
| `_tileOrder` / `_tileOrderFor` | `map-editor-tiles.js` (webview) | `number[]` / draft | The order the Tile tab last listed family groups in, per draft. A group keeps its place (adopting its family does not move it); only new families are placed by the adopted-first rule |
| `_tileObserver` | `map-editor-tiles.js` (webview) | IntersectionObserver\|null | Fetches a family sheet when its placeholder nears the visible list; rebuilt on every Tile-tab render |
| `_edit.selectedTriggerRef` | `map-editor.js` (webview), field on `_edit` | `{kind: 'step'\|'b', id: string}\|null` | Which trigger the Select tool has selected — `id` is `'base:'+i` (into `_mtPalette.attachments`) or `'placed:'+uid` (into `_edit.placed`). Set only by `map-editor-trigger-select.js`'s `triggerSelect()` (also the only place that flips `_editActiveTab` to `'trigger'` as a side effect of selecting); cleared when the tool changes away from `'select'` (`map-editor-input.js`'s `data-edit-tool` handler) and self-heals to `null` after an `editUndo`/`editRedo` that removed the thing it pointed at (`editDropStaleTriggerSelection()` in `map-editor.js`) |
| `_edit.removedTriggers` | `map-editor.js` (webview), field on `_edit` | `[{kind, index}]` | Base-room triggers (from `_mtPalette.attachments`, read-only) this draft has hidden — deleted outright, or hidden by a move that added the new position to `_edit.placed` instead. Never touches `_mtPalette.attachments` itself. Written only by `map-editor-trigger-select.js`, through `editApplyTriggerOp()`'s before/after snapshot so it shares the undo stack |
| `_edit.placed[].uid` | `map-editor.js`'s `editNextPlacedUid()` (webview) | number | Stable identity for a `_edit.placed` entry across re-renders, so a `selectedTriggerRef` of `'placed:'+uid` keeps pointing at the same trigger even as others are added/removed. Assigned once, at creation, by `editStampedConstruct()` (map-editor-constructs.js, for a stamped gourd's trigger) or by `map-editor-trigger-select.js` (a paste, or a base-trigger move) |
| `_triggerDrag` | `map-editor-trigger-select.js` (webview), module-local | `{ref, w, h, grabDx, grabDy, x, y}\|null` | The Select tool's in-progress drag, live-updated by pointer move and read by `map-editor-paint.js`'s `renderEditLayer` for the preview outline. Not part of `_edit`: a drag that never commits is not a draft change, so it is not in the undo history |
| `_triggerClipboard` | `map-editor-trigger-select.js` (webview), module-local | `{kind, x1, y1, w, h, scriptId}\|null` | The last copied trigger. An instance field, not reactive state and not part of `_edit` — Cmd/Ctrl+V still works after Escape clears the selection that filled it, and neither copy nor its later paste is itself undoable (only the paste's resulting `_edit.placed` mutation is, via `editApplyTriggerOp`) |

**Map-editor state that predates this table (Phase 6 backfill — see `src/rooms/README.md`'s client-side file list for the fuller narrative each of these files carries):**

| State | Owner File | Type | Notes |
|---|---|---|---|
| `_edit` | `map-editor.js` (webview) | object\|null | The draft for the room on screen — cells, added stamps, undo/redo, tool/brush. Only this file assigns to it; every other map-editor file reads/writes fields through `editDraft()`. No `phase` field as of §8a.2 (docs/map-editor-redesign-plan.md) — `editResolve` (map-editor-phases.js) derives decoration-vs-ground from the brush's own composed words when painting and from the cell's own words when erasing, instead of a separately settable `'room'`/`'deco'` toggle |
| `_editOrigin` | `map-editor-ui.js` (webview) | `{x,y}` | The map's own top-left in viewBox units, set once per render from `buildRoomSvgSection`'s result |
| `_editCompose` | `map-editor-ui.js` (webview) | `{layer1,layer2,collision,pick,armed?}` | The hand-composer's in-progress stamp and which of its three slots the next click fills |
| `_editComposed` | `map-editor-ui.js` (webview) | object\|null | The host's rendered preview of `_editCompose`, once requested |
| `_editConstruct` | `map-editor-ui.js` (webview) | number | Which construct in `_edit.constructs` the Widgets tab's pencil stamps (a vanilla entry or one of the user's widgets, armed by a click); `-1` when none is armed |
| `_editSel` | `map-editor-paint.js` (webview) | `{x1,y1,x2,y2}`\|null | The box-select tool's in-progress or committed rectangle |
| `_editClip` | `map-editor-paint.js` (webview) | object\|null | The box-select tool's own copied region — distinct from `_triggerClipboard`, the Select tool's |
| `_chipSel` | `map-editor-chips.js` (webview) | `{[familyId]: true}` | Which family chips are toggled on, narrowing the tile browser |
| `_chipFilter` | `map-editor-chips.js` (webview) | string | The chip search box's text |
| `_chipPreviews` | `map-editor-chips.js` (webview) | object\|null | Host-rendered chip art, keyed by family id |
| `_related` | `map-editor-relations.js` (webview) | `{[graphic]: 0..100}` | Relationship score against what the draft has **placed** (never the armed brush — §8a.1), sorting every family's tile grid. **Undirected** — `relatedTiles` scores "drawn beside, any side", so it must never be drawn as a compass direction or used to fill one |
| `_nbAnswer` | `map-editor-relations.js` (webview) | `{graphic, canopy:{n,e,s,w}, terrain:{n,e,s,w}}`\|null | The host's **directional** answer (`neighbourTiles`) for the armed brush only — the LIKELY NEIGHBORS plus-shape (§8b). Both layers in one reply; a side vanilla never fills is an empty list and stays empty. Replies for a graphic other than `_nbKey` are dropped as stale |
| `_nbKey` / `_nbView` / `_nbCycle` / `_nbFocus` | `map-editor-relations.js` (webview) | graphic / string / `{n,e,s,w}` / side\|null | What `_nbAnswer` was asked for; the `graphic\|layer\|H\|V` view the cycle positions belong to (reset when it changes); which candidate each *displayed* side shows; the side `use` arms. Displayed sides map to data sides through `nbSourceSide` (H swaps e/w, V swaps n/s) |
| `_layerForce` | `map-editor-tiles.js` (webview) | `null\|'canopy'\|'terrain'` | The `auto\|front\|ground` segment: override which layer a picked tile lands on, or `null` to follow what vanilla does with that graphic. Moved here from `map-editor-chips.js` in §8a so it lives with the control that renders it |
| `_brushFlip` | `map-editor-tiles.js` (webview) | `{h: bool, v: bool}` | The `H\|V` segment: mirror bits (`0x4000`/`0x8000`) OR-ed into the next picked tile's word. Geometry, not identity — a mirrored word costs a dictionary entry but **no** graphics slot, since `editAdoptGraphic` keys on the graphic id, which a flip does not change |
| `_famCatalogue` | `map-editor-families.js` (webview) | object\|null | The full family catalogue (tile/room counts, areas, names), fetched once |
| `_famSheets` | `map-editor-families.js` (webview) | `{[familyId]: sheet}` | Per-family tile sheets, fetched as a family is adopted or browsed |
| `_brushTile` | `map-editor-families.js` (webview) | number\|null | The room's own sheet's selection ring, cleared when a family-tile brush is armed instead |
| `_deco` | `map-editor-deco.js` (webview) | array\|null | The deco/widget catalogue, fetched once |
| `_decoFilter` | `map-editor-deco.js` (webview) | string | The Widgets tab's search box text |
| `_decoArt` / `_decoAsked` | `map-editor-deco.js` (webview) | `{[id]: {uri,x,y}}` / `{[id]: true}` | Where each vanilla thumbnail sits in the sheet it arrived in, and which are on their way. The list scrolls (no pages since v0.79.0); `decoLazyObserve` asks for a card's thumbnail, 24 at a time, as it nears the view |
| `_decoSaveWanted` | `map-editor-deco.js` (webview) | number | The vanilla entry whose cells are being fetched to be kept as the user's own widget (☆); `-1` when none |
| `_decoPick` | `map-editor-deco.js` (webview) | number | The entry whose cells are being requested from the host; `-1` when none |
| `_decoFlags` | `map-editor-deco.js` (webview) | `{fits,works,front,open}` | The Widgets tab's filter chips — `works` is also the "Ready only" toggle's own boolean (one owner, see the row above) |
| `_widgets` | `map-editor-widgets.js` (webview) | `[widget]`\|null | The user's own widgets, shared by every map. The host keeps them in `<globalStorage>/widgets.json` (`rooms/data/widget-store.js`); `widgetStore` updates the list and posts `saveWidget`. Format: docs/map-format/custom-map-files.md §6 |
| `_widgetArt` | `map-editor-widgets.js` (webview) | `{[id]: {uri,x,y}}` | Thumbnails of the user's widgets (`buildWidgetPreviews`); dropped for a widget when it is saved |
| `_widgetsVanilla` | `map-editor-widgets.js` (webview) | bool | Whether the Widgets tab also lists the generated vanilla library. Off by default; saved with `saveUiPref` (key `widgetsVanilla`) |
| `_widgetEdit` / `_widgetBack` | `map-editor-widget-edit.js` (webview) | session\|null / `{custom}\|{room}`\|null | Widget Editor Mode: the widget being edited, shaped like a `_customMaps` entry plus `widget: id` (so `customFind`/`customOpen` treat it as a map the rail never lists; `customSave` writes it back into the widget), and where "← Back to map" goes. Ended by `customStash` when its canvas is left |
| `_objectSel` / `_objectDraw` / `_objectPainting` | `map-editor-objects.js` (webview) | uid\|null / box\|null / bool | The Object tab's selected object, an area being dragged out, and a stroke drawing the selected object's tiles |
| `_edit.collDraw` | `map-editor.js` (written by `map-editor-collision-tab.js`) | `{"x,y": quarters \| 16·stop}` | The Collision tab's 8px pen drawing, started from the cell's collision now and kept as drawn (0 = carved open); a cell's override is derived from it only while it matches a tile |
| `_collPick` / `_edit.coll` | `map-editor-collision-tab.js` / `map-editor.js` (webview) | code 0..15 or -1 / `{"x,y": code}` | The Collision tab's armed shape, and the shapes set by hand: a layer over the cells (written through editApply `layer: 'coll'`, one undo stack), never baked into a stamp — applied in romExportPayload and handed over as editExport's `collisionOverrides` |
| `_previewCell` / `_ghostArt` / `_ghostAsked` | `map-editor-preview.js` (webview) | `{x,y}`\|null / `{key: {imageUri,width,height}}` / `{key: true}` | The cell under the pointer with no button down, and armed widgets' 1:1 pictures (host `decoGhost`) for the hover ghost. Read-only over the draft: a preview never makes a stamp or adopts a family |
| `_widgetsView` / `_placedDragRow` | `map-editor-widgets.js` / `map-editor-placed-list.js` (webview) | `'library'\|'placed'` / uid\|null | Which half of the Widgets tab shows (what you can stamp, or what you stamped), and the Placed row being dragged. The Placed list's order is `_edit.groups`' order, which is the draw order |
| `_edit.anims` / `_animSel` / `_animFrame` | `map-editor-animations.js` (webview) | `[{uid, delays, init, channels: {slot: [graphic…]}, auto?, rom?}]` / uid\|null / frame | Which tile slots animate and at what timing — a slot moves exactly while a group lists it (frame 0 = the slot's graphic). On the undo history through `editFamiliesSnapshot`. The Animation tab's open group and the frame its pencil paints. Sent as `channels` to the composed preview (canvas) and the ROM export |
| `_objectOpen` / `_objectDragRow` | `map-editor-object-list.js` (webview) | {uid: bool} / uid\|null | The caret's explicit open/closed per object (default: open unless every state looks alike, or selected), and the row being dragged |
| `_edit.placed[kind='object'].layer` | `map-editor.js` (webview), field on `_edit` | `{"dx,dy": stamp}` | An object's changed look — drawn over the map while the Object tab is open, like the cuttable layer. Replaced, never mutated, because trigger snapshots copy `placed` entries shallowly. Counted by stamp pruning and the family sync (`editObjectStamps`) |
| `_edit.plane` | `map-editor.js` (webview), field on `_edit` | 0..3 | The level new tiles land on (left bar, `map-editor-levels.js`). A stamped construct takes the level of the floor under it instead (`editFloorLevel`), the bar's only on open ground |
| `_edit.groups` / `_groupSel` / `_groupDrag` | `map-editor.js` / `map-editor-groups.js` (webview) | `[group]` / uid / drag | Stamped constructs kept as one object: moved and deleted whole, restoring what they covered |
| `_edit.triggerOrder` / `_triggerDragRow` | `map-editor.js` / `map-editor-trigger-order.js` (webview) | `{b:[id],step:[id]}`\|null / string\|null | The Trigger tab's list order (part of the trigger snapshot, so one undo step; saved with the map) and the row being dragged |
| `_edit.plannedOnly` | `map-editor.js` (webview), field on `_edit` | `{slot: true}` | Family slots a tile pick reserved (`autoFamilies`) that nothing has painted with yet; the next pick of another family takes them back |
| `_editDrawTab` / `_editTriggerKind` / `_triggerDraw` | `map-editor-drawable.js` (webview) | tab / `'b'\|'step'` / box\|null | What the pencil draws: the open tab's pick (Info keeps the last), the Trigger tab's kind, a trigger box being dragged out |
| `_regionClip` / `_pasteFloat` | `map-editor-clipboard.js` (webview) | construct\|null / `{x,y}`\|null | Cmd/Ctrl+C's copied region or group, and the copy riding on the pointer until a click puts it down |
| `_specialSel` / `_startSel` | `map-editor-special-select.js` / `map-editor-start.js` (webview) | `{x,y}`\|null / bool | The Select tool's selected specials (Special tab) and the Boy |
| `_collisionMode` | `rom-overlay.js` (webview) | `'outline'\|'tiles'` | How collision is drawn (the Collision chip's ▾); saved in `uiPrefs.collisionMode` |
| `_tileFilter` / `_tileShape` / `_tileFramesSplit` | `map-editor-tile-filters.js` (webview) | `null\|'grass'\|'stairs'` / `null\|'floor'\|'edge'\|'wall'` / bool | The Tile tab's list filters, and whether an animation is one playing swatch or each frame |
| `_editCutLayer` | `map-editor-cutlayer.js` (webview) | bool | Whether the cuttable layer is shown and drawn on. Off, the map shows the tiles beneath |
| `_mtPalette` | `metatile-palette.js` (webview) | object\|null | The room's own decoded palette (dictionary atlas, grid, budget, attachments) — read-only room data every map-editor file reads through |
| `_mtLayer` | `metatile-palette.js` (webview) | string | Which layer the Tile palette section renders (`'composite'`/`'layer1'`/`'layer2'`/`'collision'`) |
| `_triggerOpen` / `_triggerEnterView` | `map-editor-trigger-scripts.js` (webview) | {"<map>:<kind>:<id>": bool} / bool | Which trigger rows show their script (all start collapsed), and whether the Trigger tab shows the enter script |
| `_layoutWidths` | `rooms-layout.js` (webview) | {rail, dock} px | The resizable rail and dock widths; CSS vars on the page root, saved as the `layoutWidths` UI pref |
| `_mtSelected` | `metatile-palette.js` (webview) | number | The selected stamp index in the browsing (non-edit) Tile palette |
| `_editDrag` | `map-editor-gestures.js` (webview) | `{x1,y1}`\|null | The box-select tool's in-progress pointer drag — distinct from the Select tool's own `_triggerDrag` |
| `_newRoomOpen` | `map-editor-newroom.js` (webview) | bool | Whether the "new room" inline form is open |
| `_resizing` | `map-editor-newroom.js` (webview) | `{x,y,w0,h0,w,h}`\|null | The canvas resize grip's in-progress drag, in tiles |
| `_resizeKeep` | `map-editor-newroom.js` (webview) | bool | Whether the next blank-room reply should keep the cells that still fit — set only by a resize, not a fresh "new room" |
| `_editPendingNote` | `map-editor-input.js` (webview) | string | The last explanatory message written to the status slot, overwritten by the next render's summary |
| `_currentLayer` | `rom-overlay.js` (webview) | `'composite'\|'layer1'\|'layer2'` | Which render the host bakes. **One owner, two views**: the filter bar's `Background`/`Foreground` segments are `romLayerVis('bg'/'fg')` derived from it (`composite` = both on), and the `More ▾` drawer's `composite` chip is a third. Nothing mirrors it into a `layerVis` object — the host renders one layer choice per request, so a pair of independent booleans would have no state to map onto (Phase 7a) |
| `_currentOverlay` | `rom-overlay.js` (webview) | flag string | Which baked feature overlays are on (`c` collision, `d` drift, …). The filter bar's `Collision` segment is the `c` flag; the rest sit in the `Triggers`/`Objects`/`More` dropdowns. Rebuilt from `ALL_OVERLAY_FLAGS`'s canonical order on every toggle so the host's cache key does not depend on click order |
| `_editPanelRoom` | `map-editor-input.js` (webview) | object\|null | The room the delegated panel click handler currently acts on, re-pointed every render since the handler's closure is bound once |

---

## 2. Radar Tab — State Flow

```
VS Code editor cursor moves
  ↓ (debounced 400ms)
extension.js::refreshRadar(editor)
  ↓
radarDetectScope(doc, pos) → scope string
radarAnalyzeScope(doc, scopeStr) → { refs, pools, argRefs }
radarReadMemoryMap(wsRoot) → mapByAddr [cached _radarMapCache]
radarReadEnums(wsRoot) → enumMap [cached _radarEnumCache]
buildRoomTree(doc, wsRoot, extCfg) → roomTree [cached _radarRoomTree]
  ↓
renderRadarHtml(...)               [memory_radar/render-radar.js]
  ↓
buildMemoryTabHtml(...)            [memory_radar/render-memory-tab.js]
buildDocsTabHtml()                 [memory_radar/render-docs-tab.js]
buildRngTabHtml()                  [memory_radar/render-docs-tab.js]
  → large HTML string
  ↓
_radarPanel.webview.html = html
  ↓ (webview renders)
webview JS → DOM built → tab shows
```

**Cache invalidation:**
- `_radarMapCache` → FileSystemWatcher on `**/.github/memory-map.md`
- `_radarEnumCache` → FileSystemWatcher on `**/in/core/**/*.evs`
- `_radarRoomTree` → rebuilt when active document path changes

---

## 3. Rooms Tab — State Flow

```
User clicks room in tree (webview)
  ↓ (client-side)
renderRoomDetail(room)            [detail-renderer.js]
  ↓
buildRoomSvgSection(opts)         [svg-builder.js]
  ↓
panel.innerHTML = header + editor (nothing under it since v0.90.0 —
                  scripts: Trigger tab; parked sections: sandbox/room-data/)
  ↓
setupZoomPan(...)                 [zoom-pan.js]
setupMouseEvents(...)             [interactions.js]
setupHoverHighlights(...)         [interactions.js]
setupClickHandlers(...)           [interactions.js]
```

**Server-side data flow (when radar re-renders):**
```
extension.js::renderRadarHtml
  ↓
buildRoomTree(doc, wsRoot, extCfg) [room-tree.js → rooms/index.js]
  → collectRoomsFromDir(...)       [rooms/parsing/file-scanner.js]
  → parseRoomContent(...)         [rooms/parsing/content-parser.js]
  → readScriptAllTriggers(...)    [rooms/data/lua-watchers.js]
  → readRomMapHeader(...)         [memory_radar/rom-readers.js]
  ↓
renderRoomsTree(tree)             [rooms/rendering/tree-renderer.js]
renderVanillaTree(VANILLA_ROOMS)  [rooms/rendering/tree-renderer.js]
  ↓
buildRoomRailHtml(live, vanilla)  [rooms/rendering/tree-renderer.js]
  the rail shell: search, the two collapsible groups, the + New Map footer
  ↓
buildRoomsJson(tree)              [rooms/rendering/tree-renderer.js]
  ↓
injected into webview as ROOMS, VANILLA_ROOM_DETAILS JS globals
```

**Map editor ↔ host (on demand, one request → one reply):**
```
requestRoomMetatiles     → roomMetatiles    palette atlas + animated stamps' frames (`anim`)
requestComposedPreview   → composedPreview  the draft's added stamps, + their frames
requestBlankRoom         → blankRoom        a custom map's canvas (also a widget's)
requestFamilySheet/Catalogue/Previews       the Tile tab's families
requestDraftCollision    → draftCollision   a custom map's collision layer
requestDeco {previews|cells|widgets}        vanilla library, thumbnails, cells; own-widget thumbnails
requestCustomMaps / saveCustomMap / setCustomActive / deleteCustomMap / exportCustomMap
                                            [rooms/custom-host.js → data/custom-store.js]
requestWidgets / saveWidget / deleteWidget  [rooms/custom-host.js → data/widget-store.js]
mapExportRom / mapPlayRom → mapExportRomDone   [rendering/rom-export.js → maps/custom-room.ts]
saveUiPref {key, value}                     panelOpen, collisionMode, widgetsVanilla
```
Custom maps live in `<globalStorage>/custom-maps/<key>/` and widgets in
`<globalStorage>/widgets.json`. See docs/map-format/custom-map-files.md.

---

## 4. Memory (Radar Grid) Tab — State Flow

```
extension.js::refreshRadar
  ↓
radarReadMemoryMap(wsRoot)        → Map<addr, entry>
radarAnalyzeScope(doc, scope)     → { refs, pools, argRefs }
radarReadEnums(wsRoot)            → Map<addr, [{cls,name}]>
  ↓
buildMemoryTabHtml(...)           [render-memory-tab.js]
  → { html, cellData }
  ↓
injected into webview via render-radar.js orchestrator
  ↓
Client JS: cell clicks, filter buttons (body class toggles), tooltip hover
  → all client-side only, no IPC for grid interactions
```

**IPC for grid:**
- Cell line links → `{command: 'goToLine', line: N}` → extension.js reveals editor position
- Pin button → `{command: 'pin'/'unpin'}` → `_radarPinned = true/false`

---

## 5. Emulator / Debugger Flow

```
User launches debugger (F5)
  ↓
debugger/adapter.js (DAP adapter)
  ↓
debugger/mock-runtime.js (script execution orchestrator)
  ↓
debugger/emulator/panel.js (webview panel lifecycle + IPC bridge)
  ↓  (postMessage to webview)
emulator webview JS
  ↓  (loads WASM)
snes9x2005-wasm core
  ↓  (breakpoint hit)
debugger/adapter.js → DAP stopped event → VS Code UI
```

**State owned by debugger/emulator/panel.js:**
- Webview panel reference
- Current ROM path
- Core selection (vanilla / custom)
- WASM module reference
- `radarByteScriptFocus` dispatch (sends to `extension.js` which relays to radar panel)

**Cross-subsystem IPC (debugger → radar):**
```
emulator webview → {command:'byteScriptFocus', address:'0x94E5FB'}
  ↓
panel.js → extension.js._radarByteScriptFocus = address
  ↓
extension.js → radarPanel.webview.postMessage({command:'byteScriptFocus', address})
  ↓
radar webview bootstrap.js → _currentByteScriptFocus = address
  ↓
_applyByteScriptFocus() → highlights matching instruction rows
```

---

## 6. Language Providers Flow

```
VS Code hover event
  ↓
code_highlighter/language-providers.js::provideHover(doc, pos)  [facade]
  ↓
hover-provider.js::provideHover(doc, pos, idx, radarMap)
  ↓
workspace-index.js::getIndex() / getWorkspaceIndex()  [cached]
  → scans *.evs for function defs, memory() calls, enum defs
  ↓
provideHover returns MarkdownString
  ↓ (hex literal hover)
radarReadMemoryMap(wsRoot)    [calls into memory_radar/radar-utils.js]
  → returns entry with name + lifecycle
```

**State owned by code_highlighter/workspace-index.js:**
- `_index` (static JSON from `data/index.json`)
- `_workspaceIndex` (Map of workspace declarations)

**Decomposed modules (v0.5.0):**
- `workspace-index.js` — index state + load/build
- `hover-provider.js` — all hover tooltip logic
- `completion-provider.js` — completion items
- `symbol-provider.js` — document symbols
- `dead-branch.js` — dead code decorations
- `definition-provider.js` — go-to-definition + find-references
- `language-providers.js` — 39-line facade (backward compat)

---

## 7. ROM Readers — Data Flow

```
rom-readers.js (memory_radar/)
  ↓ (reads bytes from ROM file path)
readRomMapHeader(wsRoot, mapId)   → 13-byte header + derived geometry
readRomTriggerOffsets(wsRoot, mapId) → {offX, offY}
readRomMapHeader → used by: rooms/data/vanilla-data.js, rooms/data/lua-watchers.js
readRomCharacters → used by: extension.js (scaling tab)
readRomHitLookup → used by: extension.js (scaling tab)
readPngDimensions → used by: rooms/parsing/file-scanner.js
```

**ROM readers have ZERO VS Code dependencies.**
**ROM readers are pure I/O: take path, return data.**

---

## 8. Subsystem Communication Summary

```
extension.js
  ├── reads: radar-utils.js (pure)
  ├── reads: room-data.js / room-tree.js (shims → rooms/)
  ├── reads: rom-readers.js
  ├── reads: language-providers.js (registers providers)
  ├── reads: settings-model.js
  └── creates: debugger/emulator/panel.js (on demand)
           └── reads: rooms/data/room-scripts.js → script/ (ported decoder)

debugger/
  ├── adapter.js → mock-runtime.js
  └── emulator/panel.js → snes-rom-header-model.js

memory_radar/
  ├── radar-utils.js (pure — no upward deps)
  ├── rom-readers.js (pure I/O — no upward deps)
  ├── rooms/ → rom-readers.js, radar-utils.js
  └── webview/ → concatenated JS assets (no Node deps)

code_highlighter/
  └── language-providers.js → radar-utils.js (memory map parsing)
```

---

## 9. Forbidden Dependency Directions

| From | To | Why |
|---|---|---|
| `rom-readers.js` | `extension.js` | ROM is pure I/O |
| `rom-readers.js` | `vscode` | ROM has no VS Code dep |
| `radar/webview` JS | `require()` anything | Webview is concatenated globals |
| `language-providers.js` | `debugger/` | Separate subsystems |
| `debugger/` | `memory_radar/` rendering | Separate subsystems |
