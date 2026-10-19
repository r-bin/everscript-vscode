# Map Editor — Feature Guide & Implementation Details

> Reference documentation for the Map Editor subsystem in `src/games/evermore/rooms/webview/`.
> For format details and binary specifications, see `docs/map-format/README.md`.

---

## 1. Collision Editing (`src/games/evermore/rooms/webview/map-editor-collision-tab.js`)

The **Collision tab** provides cell-level manual collision authoring:

- **16-Code Geometry Picker:** Displays all 16 valid geometry codes (`COLL_CODES` `0x0`–`0xF`), including diagonal corners (NW/NE/SW/SE), sliding/stopping twin variants, and half-tile barriers.
- **8px Precision Drawing Pen:** Arms an 8px sub-tile pen allowing fine-grained carving into cell collision quarters (TL, TR, BL, BR). Quarters that match standard 16px geometry are automatically converted to corresponding shape codes.
- **Layer Architecture:** Stored in `_edit.coll` (and `_edit.collDraw`) without destroying underlying stamp estimates; erasing the override restores the vanilla tile's default collision estimate.

---

## 2. Special Levels & Bitfields (`src/games/evermore/rooms/webview/map-editor-special.js`)

The **Special tab** writes specific collision-word bitflags:

- **Plane-Transparent (Bit 6, "See-through"):** Written with `SPECIAL_TRANSPARENT = 0x0040`. Allows walking between elevations (bridges over tunnels).
- **Stairs & Conveyor Drift (Bit 13 + Low Nibble):** Diagonal L/R stairs (`nibbles 0x1, 0x2`) and cardinal/diagonal drifts (`0x8, 0x9, 0xA, 0xB, 0xC, 0xD, 0xE, 0xF`).
- **Entity Gate Filters (Bit 8):** Entity gates for Boy (`0x7`), Dog (`0x5`), and slash deflection.
- **Start Marker:** Boy start marker (`_edit.start`) placed on drafted maps.

---

## 3. Placed Widgets & Group Management (`src/games/evermore/rooms/webview/map-editor-groups.js`)

- **Atomic Groups:** Stamped widgets are maintained in `_edit.groups` apart from the raw cell grid (`_edit.cells`).
- **Independent Manipulation:** The Select tool can select, drag (`editGroupMove`), and delete entire widgets without corrupting or overwriting underlying floor metatiles.
- **Disbanding:** The "Disband" action converts an atomic widget into permanent base cells when freehand editing is desired.
- **Property Preservation:** Special-tab properties (`specialCells`) painted inside widget editing sessions are serialized into `w.specialCells` and restored cleanly (`map-editor-widget-edit.js`).

---

## 4. Zoom & Panning System (`src/games/evermore/rooms/webview/zoom-pan.js`)

- **Zoom Levels:** Zoom chip displays exact ratio (`100%` = one ROM pixel per screen pixel; 8 ROM px per SVG viewBox unit). Supports in/out/fit buttons.
- **Trackpad Pinch-Zoom:** Proportional exponential zoom anchored to mouse cursor coordinates.
- **Two-Finger Scroll Panning:** Captures native `wheel` events without modifier keys to smoothly pan the SVG canvas without breaking paint strokes.

---

## 5. Header Effects & PPU Configuration (`src/games/evermore/rooms/webview/map-editor-info.js`)

The **Info tab (Header sub-tab)** exposes editable PPU registers:
- **Presets (`INFO_EFFECTS`):** Includes Lantern darkness mask (room `0x4B` cave, layer follows player), additive blend, subtract, and water wave ripple.
- **Direct Register Overrides:** Configures Subscreen layers (`$212D` TS), Blend mode (`$2131` CGADSUB), Color window (`$2130` CGWSEL), and effect variant byte 8.

---

## 6. Procedural Neighbour Suggestions (`src/games/evermore/rooms/webview/map-editor-neighbours.js`)

- **Adjacency Intelligence:** Ranks tiles by vanilla placement frequency across four cardinal directions.
- **Procedural Fill Mode (`data-nb-mode="fill"`):** Generates 3×3 and 4×4 procedural combination patches matching boundary constraints for rapid natural terrain building.

---

## 7. Section 2 Animated Tiles (`src/games/evermore/rooms/webview/map-editor-anim-tab.js`)

- **Channels & Timings:** Supports dynamic animated tile sets with custom tick delays.
- **Phase Staggering:** Supports `init` countdown phase shifts to stagger torch flickering across adjacent cells.

---

## 8. Playable ROM Export (`src/games/evermore/rooms/rendering/rom-export.ts`)

- Extends vanilla 3MB ROM to 4MB (`0x300000..0x3FFFFF`).
- Repoints developer room `0x15` (Brian's Test Ground) pointer table to custom map payload.
- Rewrites intro jump (`$92E0CA`) to `load_map(0x15, x, y)` and injects Laser Lance for grass cutting.

