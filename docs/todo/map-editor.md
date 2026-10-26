# Map Editor — Open Tasks & Backlog

> Domain: Map Editor (`src/games/evermore/rooms/webview/`, `src/games/evermore/maps/`, `src/games/evermore/rooms/rendering/`)
> Shipped features reference: [`docs/map-format/map-editor-features.md`](../map-format/map-editor-features.md)
> UI lessons from the upcoming Zelda 3 editor: [`docs/plans/map-editor-lessons-zelda3.md`](../plans/map-editor-lessons-zelda3.md)
> Status key: 🔴 bug · 🟡 feature gap · 🟢 designed, not yet built

---

## 1. Core Editing Tools & Affordances

### 1.1 Flood Fill Tool Missing
- **Status: 🟡 feature gap**
- **Goal:** Fill contiguous regions matching by **metatile id** (not visual appearance).
- **Implementation:** BFS from clicked cell collecting connected cells where `editCellAt(palette, x, y) === seed`. Apply brush to all cells as one undo step. Add bucket-fill icon in toolbar (`map-editor-toolbar.js`) and `'fill'` tool case in `map-editor-gestures.js`.

### 1.2 Dedicated Pan Tool (`H`) & Space-Hold Panning
- **Status: 🟡 polish / UX**
- While two-finger trackpad panning is implemented in `zoom-pan.js`, dedicated tools are open:
  - Add hand pan tool (`H`) to toolbar (`map-editor-toolbar.js`).
  - Space-hold gesture to temporarily switch cursor and interaction to pan mode without changing active tool.

### 1.3 Room Resize: All Four Directions
- **Status: 🟡 feature gap**
- Corner drag resize is currently implemented in `map-editor-newroom.js` (bottom-right handle).
- **Requirement:** Support expanding North and West, which shifts coordinate origins and metatile dictionary bases (`baseMetatile = width * height * 2`) across all cells, triggers, and objects in one atomic operation.

### 1.4 Cross-Map Tile References
- **Status: 🟡 feature gap**
- Host index (`index.graphicRooms` in `vanilla-index.ts`) maps every graphic to rooms where it appears.
- **Requirement:** Surface this data in the Tile tab UI as a "Used in rooms..." drawer showing room thumbnails and placement counts.

---

## 2. Persistence & Advanced Editing

### 2.1 Direct Save to ROM Slot for Edited Vanilla Rooms
- **Status: 🟢 designed, not built**
- `rom-export.ts` currently exports custom rooms into developer room `0x15` in an expanded 4MB ROM.
- **Requirement:** Direct in-place "Save to ROM" for existing vanilla room slots with blob relocation logic when reconstructed compressed payloads grow.

### 2.2 Object / Trigger Tabular Editor
- **Status: 🟢 designed, not built**
- Add visual spreadsheet/table editor for step-on and B-triggers allowing manual coordinate, script ID, and flag edits alongside canvas selection.

### 2.3 Tuning animations from vanilla presets
- **Status: 🟢 idea** (asked 2026-09-25)
- A placed animation plays vanilla's own cycle (`maps/vanilla-animation.ts`), one channel per placed graphic
  (`maps/custom-animation.ts`). Tuning would let a map pick another timing or phase vanilla attests for the
  same graphics: the same torch cycle at another phase, so neighbours flicker out of step.

### 2.4 Wading tiles
- **Status: 🟢 idea** (asked 2026-10-16)
- An unused tile setting (gate nibble 4, bit 12 clear) draws a character's legs behind the scenery and the
  upper body in front; 1145 of the 5128 sprites are already marked for it. Steps: prove it headless, a `split`
  answer in `spriteDepth`, a "Wading" special in the editor, the Mana conversion row
  ([../map-format/wading.md](../map-format/wading.md)).

### 2.5 Palette-Cycle Preview
- **Status: 🟡 feature gap**
- Room palette-cycle descriptors are read and shown as bytes, but the map preview remains static. Add a
  decoded inspector and a play/pause preview that cycles the affected palette colours without changing
  map geometry or tile-animation state. Trace exact tick timing, span/wrap semantics, and the colour-buffer
  to CGRAM mapping before claiming exact game parity. Details and examples:
  [palette-cycling-preview.md](palette-cycling-preview.md).
