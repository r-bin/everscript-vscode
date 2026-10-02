# Editor concepts: what the map editor adds on top of the data

The room blob (`room-reference.md`) is what the game reads. The editor works with
a richer model so a person can draw: stamps instead of dictionary indices, layers
instead of words, widgets instead of raw rectangles. This page lists every such
concept, says which bytes it finally becomes (or that it becomes none), and points
at the code. The rules the editor must obey are the `map-editor-rules` skill
(`.github/instructions/map-editor-rules.instructions.md`). This page is the map
of what exists.

Code lives in `src/rooms/webview/map-editor-*.js` (the webview, plain scripts
sharing one global scope, loaded in the order listed in
`src/memory/webview/index.js`) and `src/rooms/rendering/` (the host side). The
draft is one object, `_edit` (`map-editor.js`).

---

## 1. Concepts that become room bytes

| Concept | What it is | Becomes | Code |
|---|---|---|---|
| **Stamp** | one `{canopy word, terrain word, collision word}` combination: a dictionary entry. Created implicitly by painting; identical ones are reused (`editAddStamp` find-or-create) | a Block 3 entry; the grid cell's id | `map-editor-stamps.js` |
| **Front / ground pick** | whether a picked graphic lands in the canopy (front) or the terrain (ground). Tile tab `auto \| front \| ground` (`_layerForce`); auto = what vanilla does with that graphic (≥60% one-sided) | which word of the stamp gets the graphic | `map-editor-paint.js`, `map-editor-tiles.js` |
| **Blank canopy** | "no decoration": the room's most-placed canopy word (`$A800` in every room measured), derived, never hardcoded | canopy word | `editBlankCanopy` |
| **Family slot** | one of the **7** palettes loaded at once. Picking a tile from an unloaded family adopts it into a free slot; freeing a slot strands every cell that names it | the family list; the word's palette field | `map-editor-families.js`, `-chips.js`, `-stranded.js` |
| **Adopted graphic** | a graphic the room did not load, pulled into Block 1 so a word can name it (264-slot ceiling) | Block 1 | `map-editor-stamps.js` |
| **Level** | the elevation plane new tiles are drawn on (left bar, default 1). A stamped widget takes the level of the floor it lands on | collision bits 5..4 | `map-editor-levels.js` |
| **Special** | a collision-word property painted per cell from the Special tab: Stairs & Drift (bit 13 + nibble), See-through (bit 6), Gate & Deflect (bits 11..8), Interact (bit 15), Step-on (bit 14). Shown as glyphs; Interact and Step-on also as overlays (Special menu) | bits of the cell's collision word | `map-editor-special.js`, `-flag-overlays.js` |
| **Collision shape** | a geometry code set by hand over the tile's suggested one (`_edit.coll`), drawn with the 8px pen or picked whole. Never baked into the stamp; erasing it brings the estimate back | bits 3..0 at export (`collisionOverrides`) | `map-editor-collision-tab.js`, `-collision.js` |
| **Cuttable layer** | stamps drawn over the map that a slash removes, revealing the cell beneath (`_edit.cut`) | Section 4 sources + records | `map-editor-cutlayer.js` |
| **Animated tile** | one Section 2 channel: a graphic slot whose graphic changes over time. Pattern letters (A, B, C…) name vanilla's timings; a rectangle drawn at once is a *set* sharing one timing | Section 2 | `map-editor-animations.js`, `-anim-*.js` |
| **Object** | an area with states drawn as **frames** (each frame = how the area looks in that state) and a **hold** per in-between state | Section 3 + object area (frames become XOR deltas, state to state) | `map-editor-objects.js`, `-object-list.js`, `-object-holds.js` |
| **Trigger** | a step-on or B box with its script | trigger tables (vanilla room drafts only; custom-map export writes none yet). Step-on boxes need collision bit 14 under them | `map-editor-trigger-*.js` |
| **Header overrides** | TM/TS/colour math/effect/camera flags set on the Info tab (`_edit.header`) | header bytes 4–10 | `map-editor-info.js` |

## 2. Concepts that never become bytes

| Concept | What it is | Why it is not data | Code |
|---|---|---|---|
| **Widget** | a portable construct in the library every map shares (`<globalStorage>/widgets.json`). Cells are `{graphic, family, flags, anim}` per layer, or `null` for "keep the floor", because a raw word is room-relative (its `chr` and palette mean something only in the room it came from). Colourings are derived from every family vanilla draws its graphics in, never stored | an editing convenience; stamping one writes ordinary stamps | `map-editor-widgets.js`, `-widget-edit.js`, `-widget-colours.js`; `src/rooms/data/widget-store.js` |
| **Construct** | a saved rectangle of map with the triggers and objects inside it, in the same portable form | same | `map-editor-constructs.js` |
| **Deco library** | vanilla's own Section 3 objects (655 distinct) offered as floor-free widgets | same | `map-editor-deco.js`; host `deco-catalogue.js`, `deco-preview.js` |
| **Group** (placed widget) | a stamped widget/construct kept as **one movable thing over the map**, stored apart from `_edit.cells` (`_edit.groups`). What a cell shows = the map + every group over it (`editCellAt`); drawing and export bake it (`editBakedCells`). Its triggers and objects are locked to it until **disbanded** | baked into cells at export | `map-editor-groups.js`, `-placed-list.js` |
| **Entrance** | where the player arrives. Not in the room: it is a `CHANGE MAP` in another room's script, indexed by `src/script/arrivals.ts` and drawn as an arrow marker. The Special tab's Entrance glyphs are visual notes only (not exported) | the game has no such field | `arrivals.ts`; `map-editor-special.js` |
| **Boy start** | a custom map's one start marker (`_edit.start`), always inside the map. Export ROM turns it into the intro's `load_map(0x15, x, y)` | becomes a script operand, not room data | `map-editor-start.js`; `rom-export.md` |
| **Donor room** | a custom map borrows room `0x34`'s graphics list and families (a room with no Block 1 renders black) and nothing else | its Block 1 and families are copied | `map-editor-custom.js`, `custom-room.ts` |
| **Locked** | a vanilla room opens read-only; unlocking lets its draft change | view state | `editLocked` |
| **Palette set preview** | the Info tab's Header sub-tab shows the map with another MAP_PALETTE value (rooms with 8–14 families) | a view: the host renders with `mapPalette` in the header overrides | `map-editor-family-sets.js`, host `family-sets.js`, `header-overrides.js` |
| **Undo history** | one stack for everything, one step per gesture, saved with the map (`history.json`) | — | `map-editor.js`, `-history.js` |
| **Vanilla index** | adjacency, layer preference, suggested collision, animation patterns, stairs, measured over all 127 rooms and every object state and animation frame | advice, never data (map-construction skill) | `src/maps/vanilla-*.ts`, host `vanilla-index.js` |

---

## 3. Custom maps

A custom map is its own room under **Custom rooms**, saved as
`<globalStorage>/custom-maps/<key>/map.json` + `history.json`
(`custom-map-files.md`). It starts as one SNES screen (16×14 cells), resizes from
2 to 128 cells a side without deleting cells, and has exactly one Boy.

Two write paths:

| Path | What it writes | Doc |
|---|---|---|
| **Export ROM** / **Play in emulator** | a 4 MB ROM with the map in room `0x15`'s slot at `$BD8000` and the intro jumping there. Writes the grid, dictionary, Block 1, families, Section 4, Section 2, objects with their holds, the header overrides. **No triggers or scripts yet** | `rom-export.md`, `custom-room.ts` |
| **Export map** | a `.zip`: the blob, `map.json`, a sample `.evs`, `stamps.json`, a README | `custom-map-files.md` §4 |

A vanilla room's draft has only `editExport()`, a handoff shape for the sibling
repo's encoder.

---

## 4. The Info tab

Three sub-tabs (`_editInfoSub`, map-editor-tabs.js):

| Sub-tab | Shows |
|---|---|
| **Header** | the header bytes in words, each with its controls beneath it (unlocked), and the palette sets |
| **Budget** | the ceilings and counts below |
| **Map** | shares measured off the map (walkable, solid, canopy, levels, cuttable, drift, stairs, gated, interact, step-on) and the checks: what would stop the draft encoding, and step-on boxes that can never fire |

### Budgets

Only attested ceilings get a bar: **7 families, 264 graphics, the 32 KB WRAM
window** (`src/maps/budget.ts`). Stamps, triggers, objects and channels are
counts, compared against vanilla's maximum (`room-reference.md` §3). Sprite
palettes (4 safe slots per room) are a separate budget on the Rooms tab
(`docs/script-format/entities-reference.md` §4).

---

## 5. Known gaps (as of v0.118.0)

- **Alternate family sets** (families past the 7th, switched by `MAP_PALETTE`)
  can be previewed but not edited; a vanilla room's draft keeps the first 7.
- **Collision bit 14** is set by hand (Special tab → Step-on). Nothing sets it
  automatically under a new or moved step-on trigger; the Map checks warn instead.
- **CHR descriptors** are not shown; custom maps copy the donor's.
- **Widgets** made from vanilla objects carry no holds: their states take the
  default of 1 tick.
- Custom-map export writes **no triggers or scripts**.
- Open design questions and history: `docs/map-editor-redesign-plan.md`,
  `docs/map-editor-todo.md`, `docs/animation-tab-plan.md`.
