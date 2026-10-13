# Map Editor — Open Tasks & Backlog

> Domain: Map Editor (`src/rooms/webview/`, `src/maps/`, `src/rooms/rendering/`)
> Status key: 🔴 bug / regression · 🟡 feature gap · 🟢 designed, not yet built · ✅ completed

---

## 1. Verified Completed Features (Removed from Open Backlog)

The following items from earlier todo lists are **fully implemented** in the current codebase:

- ✅ **Collision Shape Picker & 8px Pen** (formerly Task 2.1):
  - *Implemented in:* [`src/rooms/webview/map-editor-collision-tab.js`](file:///Users/v/Documents/GitHub/everscript-vscode/src/rooms/webview/map-editor-collision-tab.js)
  - Features: full 16-shape picker (`COLL_CODES` 0x0..0xF), 8px drawing pen, right-click carving, and `_edit.coll` layer.
- ✅ **Plane-Transparent (PT / Bit 6) Paintable** (formerly Task 2.2):
  - *Implemented in:* [`src/rooms/webview/map-editor-special.js`](file:///Users/v/Documents/GitHub/everscript-vscode/src/rooms/webview/map-editor-special.js)
  - Added to Special tab under "Level" as `plane-transparent` (label "See-through", glyph `T`, bit mask `SPECIAL_TRANSPARENT = 0x0040`).
- ✅ **Widget Special-Tile Properties Preserved** (formerly Task 1.3):
  - *Implemented in:* [`src/rooms/webview/map-editor-widget-edit.js:100`](file:///Users/v/Documents/GitHub/everscript-vscode/src/rooms/webview/map-editor-widget-edit.js#L100)
  - `widgetExtractCanvasCells` preserves `specialCells` entries in `cRec.special` during widget save/export.
- ✅ **Atomic Placed Widgets & Move/Delete** (formerly Tasks 1.4 & 2.3):
  - *Implemented in:* [`src/rooms/webview/map-editor-groups.js`](file:///Users/v/Documents/GitHub/everscript-vscode/src/rooms/webview/map-editor-groups.js)
  - Stamped constructs are stored in `_edit.groups` apart from raw cells, allowing atomic selection, dragging (`editGroupMove`), disbanding (`editGroupDisband`), and deletion without corrupting floor metatiles.
- ✅ **Two-Finger Scroll Panning** (formerly Task 2.5a):
  - *Implemented in:* [`src/rooms/webview/zoom-pan.js:108`](file:///Users/v/Documents/GitHub/everscript-vscode/src/rooms/webview/zoom-pan.js#L108)
  - Native wheel listener inspects `deltaX`/`deltaY` without modifier keys and pans SVG viewport.
- ✅ **Header Effects Presets & Blend Registers** (formerly Task 3.1):
  - *Implemented in:* [`src/rooms/webview/map-editor-info.js:155`](file:///Users/v/Documents/GitHub/everscript-vscode/src/rooms/webview/map-editor-info.js#L155)
  - `INFO_EFFECTS` dropdown catalogues lantern cave mask, additive blend, subscreen layers (`$212D`), blend mode (`$2131`), color window (`$2130`), and effect byte 8.
- ✅ **Procedural Tile Fill in Neighbours Card** (formerly Task 3.2a):
  - *Implemented in:* [`src/rooms/webview/map-editor-neighbours.js`](file:///Users/v/Documents/GitHub/everscript-vscode/src/rooms/webview/map-editor-neighbours.js)
  - `data-nb-mode="fill"` offers 3×3 and 4×4 procedural combination patches based on vanilla adjacency rankings.
- ✅ **Animation Phase Variants & Timing Stagger** (formerly Task 3.3):
  - *Implemented in:* [`src/rooms/webview/map-editor-anim-tab.js`](file:///Users/v/Documents/GitHub/everscript-vscode/src/rooms/webview/map-editor-anim-tab.js) and [`map-editor-animations.js`](file:///Users/v/Documents/GitHub/everscript-vscode/src/rooms/webview/map-editor-animations.js)
  - Placed animated tiles support phase shifts (`init` countdown) and customizable tick delay patterns matching vanilla torch cycles.
- ✅ **Copy Room as Widget & Play in Emulator** (formerly Task 4.3):
  - *Implemented in:* [`src/rooms/rendering/rom-export.js`](file:///Users/v/Documents/GitHub/everscript-vscode/src/rooms/rendering/rom-export.js) and [`src/rooms/webview/map-editor-toolbar.js`](file:///Users/v/Documents/GitHub/everscript-vscode/src/rooms/webview/map-editor-toolbar.js)
  - "Copy map" added to More menu; "Save as widget" available in toolbar; ROM export creates 4MB test image booting into room `0x15`.

---

## 2. Active Open Tasks

### 2.1 Flood Fill Tool Missing
- **Status: 🟡 feature gap**
- **Goal:** Fill contiguous regions matching by **metatile id** (not visual appearance).
- **Implementation:** BFS from clicked cell collecting connected cells where `editCellAt(palette, x, y) === seed`. Apply brush to all cells as one undo step. Add bucket-fill icon in toolbar (`map-editor-toolbar.js`) and `'fill'` tool case in `map-editor-gestures.js`.

### 2.2 Pan Tool (`H`) & Space-Hold Panning
- **Status: 🟡 polish / UX**
- While two-finger scroll panning is shipped in `zoom-pan.js`, dedicated tools are open:
  - Add hand pan tool (`H`) to toolbar (`map-editor-toolbar.js`).
  - Space-hold gesture to temporarily switch cursor and interaction to pan mode without changing active tool.

### 2.3 Room Resize: All Four Directions
- **Status: 🟡 feature gap**
- Corner drag resize is currently implemented in `map-editor-newroom.js` (bottom-right handle).
- **Requirement:** Support expanding North and West, which shifts coordinate origins and metatile dictionary bases (`baseMetatile = width * height * 2`) across all cells, triggers, and objects in one atomic operation.

### 2.4 Cross-Map Tile References
- **Status: 🟡 feature gap**
- Host index (`index.graphicRooms` in `vanilla-index.js`) maps every graphic to rooms where it appears.
- **Requirement:** Surface this data in the Tile tab UI as a "Used in rooms..." drawer showing room thumbnails and placement counts.

### 2.5 Direct Save to ROM Slot for Edited Vanilla Rooms
- **Status: 🟢 designed, not built**
- `rom-export.js` currently exports custom rooms into developer room `0x15` in an expanded 4MB ROM.
- **Requirement:** Direct in-place "Save to ROM" for existing vanilla room slots with blob relocation logic when reconstructed compressed payloads grow.

### 2.6 Object / Trigger Tabular Editor
- **Status: 🟢 designed, not built**
- Add visual spreadsheet/table editor for step-on and B-triggers allowing manual coordinate, script ID, and flag edits alongside canvas selection.
