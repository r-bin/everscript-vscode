# Map Editor — Open Tasks & Backlog

> Domain: Map Editor (`src/rooms/webview/`, `src/maps/`, `src/rooms/rendering/`)
> Status key: 🔴 bug / regression · 🟡 feature gap · 🟢 designed, not yet built · ✅ verified resolved

---

## 1. High Priority: Bugs & Wiring

### 1.1 Vanilla room: right sidebar not properly wired to editor
- **Status: 🔴 bug / partial wiring**
- **Symptom:** When a vanilla ROM room is open (not a custom map) and edit mode is toggled on, the right dock renders tabs (Tile, Special, Trigger, Object, Widgets, Info), but panels still operate on `_editPanelRoom` (raw room last seen) rather than on the live draft created by edit mode.
  - **Trigger tab:** Shows room's vanilla triggers as read-only list ("none yet — drag a box on the map") even though vanilla B-triggers and step-on triggers exist.
  - **Info tab:** Tile-budget bar does not update when cells are painted (driven by ROM room decoded data instead of draft stamp table).
  - Selecting a vanilla room from rail while edit mode is on leaves dock showing previous room data until forced re-render.
- **Root cause:** `editToggle` (`map-editor-input.js:334`) creates draft and toggles `.rg-editing`, but `renderEditPanels` (`detail-renderer.js`) still falls through to vanilla room data for subpanels checking `_editPanelRoom` first.
- **Fix direction:** On toggle-on, prime the draft from vanilla room's decoded triggers and objects (`room.triggers`, `room.objects`). Make Trigger and Object panels use `editTriggerList` / `editObjects()` exclusively when a draft is live. Tile-budget bar reads `_mtPalette` instead of ROM metatile count.

### 1.2 Vanilla room: bottom filter-bar not properly wired
- **Status: 🔴 bug / partial wiring**
- **Symptom:** Chips behave differently on vanilla rooms vs custom maps:
  - **Collision toggle:** Re-renders from ROM pixel data rather than live stamp table. Painting a cell and toggling collision shows old vanilla collision.
  - **Cuttable toggle:** Calls `editCutLayerOn()`, which guards on `editDraft() && editDraft().blank`. The `blank` flag is only set on scratch maps; toggle is silently ignored on vanilla rooms.
  - **Interact overlay:** Reads draft's `specialCells`, but vanilla base collision words are not merged into stamp table, so untouched cells show `0` instead of ROM value.
- **Fix direction:** When `editToggle` primes vanilla room into draft (task 1.1), import ROM room's collision words into draft stamp table as initial state so bottom-bar overlays read draft unconditionally. Guard Cuttable toggle on `editDraft()` alone (not `.blank`).

### 1.3 Widget special-tile properties lost on close/reopen
- **Status: 🔴 bug**
- **Symptom:** Special-tab properties painted inside widget editor (Drift, Gate, Interact bit 15, Stairs glyphs) are stored in draft's `specialCells` map. When user clicks **← Back to map**, `widgetFromSession` (`map-editor-widget-edit.js:94`) saves `cells` and `attachments` into widget object but drops `specialCells`. Overlay annotations disappear on reopen.
- **Fix direction:** Serialize `d.specialCells` filtered to widget bounds into `w.specialCells` in `widgetFromSession`. Restore it in `widgetEditBlank` after initial stamp.

### 1.4 Select cursor cannot properly move or delete a placed widget
- **Status: 🔴 bug**
- **Move bug:** A widget with background-agnostic cells (null terrain) resolves against the donor room's floor at stamp time. When `editGroupMove` lifts and replays stamp indices at new position, donor floor is written at destination position.
  - *Fix:* Store original portable construct (`{graphic, family, flags}` from `map-editor-constructs.js`) in group record. `editGroupMove` calls `editConstructWrites` at new position instead of replaying stale indices.
- **Delete bug:** Pressing `Delete`/`Backspace` with group selected falls through to cell-erase, deleting background tiles one-by-one and leaving ghost group record (`d.groups`) with dangling trigger UIDs.
  - *Fix:* Wire `Delete`/`Backspace` in `keydown` (`map-editor-gestures.js`) to call `editGroupDelete(_groupSel)` when `_groupSel` is non-null and tool is Select.

### 1.5 Object / widget frame editing keeps regressing
- **Status: 🔴 regression risk** (see `docs/todo/object-frame-widget-rot.md` history)
- **Symptom:** Objects on a map (and inside widgets) support multiple states (State 0 = base room look, Frame 1..N = delta tiles). Frame chips must switch `_objectActiveFrame`, and brush must write into only the active frame.
- **Failure modes observed:**
  1. *Clicks on frame chips swallowed:* Delegated event listener in `bindEditControls` walks up `e.target` searching for attributes in `EDIT_CLICK_KEYS`. Any missing data attribute (`data-object-frame`, `data-object-add-frame`) skips past and gets silently dropped. Needs comprehensive automated test or generic data attribute pattern.
  2. *Tiles leak into wrong frame:* `objectLayerWrite` writes into `frames[_objectActiveFrame - 1]`. If active frame click was swallowed, paint writes to previous frame. Widget save previously serialized only active frame `o.layer` instead of all `o.frames`.
  3. *Dock listener DOM nesting & duplicate events:* `#rg-dock` is inserted as sibling of `#rg-outer`, outside `#room-detail`. Multiple listeners attached to `#room-detail` and `#rg-dock` cause bubbling/stop-propagation fragility.

---

## 2. Core Editing Affordances & Tools

### 2.1 Collision editor — overwrite any cell's geometry by hand
- **Status: 🟡 feature gap** (collision-suggestions.md)
- **Goal:** Allow painting arbitrary geometry shapes (solid NW corner, half-tile top barrier, etc.) onto a cell with existing art.
- **Implementation:** Collision shape picker in Special or dedicated Collision tab displaying all 16 geometry codes (`0x0`–`0xF`) as visual diagonal/half-barrier tiles (`geometryMask` from `map-editor-collision.js`), plus plane-transparent (`bit 6`). Clicking arms a special write modifying only bits 3..0 (`0x000F`), leaving plane, gate, and sprite bits intact.

### 2.2 Plane-transparent (PT / bit 6) not paintable
- **Status: 🟡 feature gap**
- **Context:** PT collision bit is detected and shown in overlay (purple wash, "PLANE-TRANSPARENT (BIT 6)"), and used in 23 vanilla rooms for bridges, overpasses, and multi-level tunnels. No Special tab item currently writes it.
- **Implementation:** Add item in `EDIT_SPECIAL_GROUPS` (`map-editor-special.js`):
  ```js
  { id: 'plane-transparent', label: 'Plane-transparent', glyph: 'PT', pt: 1 }
  ```
  Set `SPECIAL_PT_MASK = 0x0040`. Handle `def.pt != null` in `editSpecialAppliedIndex`. Add `hide-special-pt` sub-toggle in filter dropdown. Extend `editSpecialClearWord` mask to include `0x0040`.

### 2.3 Widgets should be locked after stamping
- **Status: 🟡 feature gap**
- **Goal:** Stamped widget groups should be atomic. Individual B-triggers or cells within the group must not be independently deleted or painted over.
- **Implementation:**
  - Before deleting a trigger, check if any group's placed UIDs contain it. If so, refuse: "part of widget X — delete whole widget to remove".
  - In `editApplyStroke`, verify if coordinate falls inside an active group's bounding box. Skip cell or prompt user.
  - Distinct "locked" group outline style (`groupSvg`) when cursor is not hovering with Select tool.

### 2.4 Flood fill tool missing
- **Status: 🟡 feature gap**
- **Goal:** Fill contiguous regions matching by **metatile id** (not visual appearance).
- **Implementation:** BFS from clicked cell collecting connected cells where `editCellAt(palette, x, y) === seed`. Apply brush to all cells as one undo step. Add bucket-fill icon in toolbar (`map-editor-toolbar.js`) and `'fill'` tool case in `map-editor-gestures.js`.

### 2.5 Pan while editing
- **Status: 🟡 feature gap / UX**
- **Problem:** In edit mode, two-finger trackpad scroll and SVG pan are captured by gesture handler before reaching viewport transform. Cannot pan zoomed map without leaving edit mode.
- **Tasks:**
  - *2.5a Two-finger scroll:* In `map-editor-gestures.js`, let `wheel` events without `ctrlKey` pass through to SVG scroll container instead of being consumed by stroke handler.
  - *2.5b Pan tool (`H`):* Add hand cursor tool to toolbar (`map-editor-toolbar.js`) delegating drag to `svg-builder.js` pan logic.
  - *2.5c Space-hold:* Temporary pan tool while Space is held (Photoshop/Figma convention).

### 2.6 Room resize: all four directions
- **Status: 🟡 feature gap**
- **Context:** Resizing renumbers metatile ids (`baseMetatile = width * height * 2`). Expanding North or West shifts every existing cell coordinate.
- **Requirements:** Corner + edge handles or 4-field dialog. Coordinate shift, metatile base renumbering, and entity/trigger clamping must occur as a single atomic undo step.

### 2.7 Info tab cleanup
- **Status: 🟡 polish / UX**
- Replace "no field limit" / "no confirmed limit" on triggers with empirical vanilla ceilings ("≤ 65 step-on", "≤ 58 B-triggers"). Amber when exceeding vanilla max; red at binary limit.
- Move "attested 161 in these families" to family chip tooltip on Tile tab; remove from Info tab.
- Split WRAM budget bar: `grid Xb · dict Yb / 32768`.
- Collapse "CHECKS CLEAR" by default; inline "Nothing blocking" as single status line.

---

## 3. Advanced Visuals & Mechanics

### 3.1 Header effects — full catalogue and editor support
- **Status: 🟡 research + feature gap** (decoded in `docs/map-format/building-a-room-from-scratch.md §3`)
- **PPU presets catalogue:**
  - *Lantern / darkness:* `visibleLayers=22`, `blendLayers=1`, `blendMode=146`, `roomEffect=1` (Canopy soft dark disc follows camera, e.g. room `0x4b` Oglin tunnel).
  - *Additive blend:* `blendLayers=17`, `blendMode=2` (Subscreen terrain adds to main, 32 rooms).
  - *Half-add glow:* `blendLayers!=0`, `blendMode=66` (Water shimmer, volcanic haze, 23 rooms).
  - *Subtract:* `blendMode=146` (Darkens terrain where subscreen is bright, rooms `0x1d`, `0x4b`).
  - *Depth-sort exterior:* `roomEffect=2` (Sprites sorted by focus point distance, 6 open-world rooms).
  - *BG wave / water ripple:* `roomEffect=5` (Per-line horizontal scroll HDMA, room `0x52`).
  - *Parallax layer:* `roomEffect=1` (Canopy scrolls independently at fixed offset).
- **Editor needs:** Preset dropdown in new-room dialog and room header inspector; note on Info tab when non-zero `roomEffect` is active.
- **Unresolved:** `roomEffect` routines 6 and 7 (unused in vanilla); `cameraFlags` bit 14 (`0x4000`, tight vertical follow).

### 3.2 Tile suggestions: procedural fill and cross-map references
- **Status: 🟡 feature gap**
- *3.2a Procedural fill by adjacency:* "Fill region" button in neighbour card (`map-editor-neighbours.js`). BFS-fills selection from boundary, picking highest-ranked neighbour from `rankByRelationship` (`vanilla-related.ts`) matching shape constraint.
- *3.2b Cross-map tile references:* "Where else in ROM is this graphic used?" Expandable panel listing rooms with thumbnail and placement count using `index.graphicRooms` (`room-draft.js`).

### 3.3 Animation phase variants (torch stagger)
- **Status: 🟡 feature gap**
- Placed animated tiles start at frame 0. Vanilla staggers torches on same cycle by placing frame 1 or 2 on different channels. Phase picker in Tile tab's `frames` mode to arm brush at desired phase offset.

---

## 4. Persistence, Widgets & ROM Export

### 4.1 Write edited vanilla room back to ROM slot
- **Status: 🟢 designed, not built**
- TypeScript encoder (`src/maps/encode.ts`) is verified port of `tools/encode_room.py`.
- **Missing pieces:**
  - "Save to ROM" button in panel with confirmation and automatic backup prompt.
  - ROM free-space map for blob relocation when rebuilt room blob grows.

### 4.2 Object / trigger add-remove-reorder UI table
- **Status: 🟢 designed, not built**
- Encoder already writes trigger and object arrays. UI affordance for editing tabular step-on / B-trigger records with row addition, deletion, and parameter editing is needed.

### 4.3 Copy vanilla room as stampable widget
- **Status: ✅ Foundation shipped; follow-ups:**
  - Box-select over group tiles fixed (pointer-events).
  - "Copy map" added to More menu.
  - "Save as widget" from selection: ensure persistent `_editSel` across tab switches.
  - Export/Import widgets library (`widgets.json`) to share across projects.
