# Copy a Vanilla Room as a Custom Map — Bug Tracker

> Use case: copy Strongheart's Hut (`0x34`) as an empty base stamp,
> then create variants by removing the NPC/objects.
> Status key: 🔴 bug · 🟡 feature gap

---

## 1. Box-select gets stuck under object/group tiles

**Status: ✅ fixed**

When the Copy tool is active and you drag a box-select over a map that
contains placed widget groups or object rectangles, the rubber-band rect
stops tracking mid-drag. The effect is: you cannot drag past a group tile —
the selection snaps to the edge of the first group it hits and refuses to
grow further.

**Root cause:** The SVG paint layer renders group outlines
(`rg-group-sheet`) and object area rects (`rg-obj-area`, `rg-obj-cluster`)
as SVG `<rect>` elements with default `pointer-events="all"`. When the
pointer moves over one of them during a drag, the SVG `mousemove` event is
captured by that element instead of bubbling to the parent `<g>` that drives
`_editDrag`. The drag's `pointermove` is effectively eaten.

Additionally, `map-editor-gestures.js` uses `pointerdown`/`pointermove` on
the SVG root — but the group and object rects that sit above the canvas in
DOM order receive the event first and call `stopPropagation` in some paths
(map-editor-paint.js `L68` explicitly sets `pointer-events: none` on the
glyph `<g>`, but NOT on the outer `rg-group-sheet` and `rg-obj-area` rects).

**Fix direction:**

In `svg-builder.js` and `map-editor-paint.js`, set
`pointer-events="none"` on every SVG overlay element that is purely visual
during a paint stroke — specifically:

- `rg-group-sheet` rect (the group's cyan outline box)
- `rg-obj-area` / `rg-obj-cluster` rects
- `rg-edit-sel` rect (the paste-clipboard outline)

These overlays are feedback only; the `pointerdown` + `pointermove` capture
on the SVG root should be the only hit-tester during an active drag. A
copy-tool drag sets `_editDrag` on `pointerdown`; any `pointermove` that
follows should read the cell coordinate regardless of what SVG element the
pointer is physically over.

Concretely: in `map-editor-paint.js` where each group and object SVG rect is
emitted, add `pointer-events="none"` to those elements (or wrap them in a
`<g pointer-events="none">`).

---

## 2. "Copy map" entry missing from the ⋯ More menu

**Status: ✅ fixed**

The toolbar's **⋯** button opens `rg-more-dropdown`
(`map-editor-filterbar.js` `moreFilterGroupHtml`). Its current entries are
view toggles (grids, ingredient icons, arrivals, ROM header) and the ROM
export button. There is no way to duplicate the current map as a new custom
map from the UI.

The underlying data path exists: `customDuplicate` (or an equivalent that
copies `_mtPalette` + `editDraft()` into a new `_customMaps` entry) would
work the same way `customNew` does but pre-seeded with the current room's
metatile grid, stamp dictionary, families, and triggers.

**What "Copy map" should do:**

1. Read the current palette (`_mtPalette`) and draft (or vanilla room data
   if no draft exists yet).
2. Create a new `_customMaps` entry with a generated name
   (e.g. `"Copy of Strongheart's Hut"`), copying the full stamp table,
   cells grid, families list, Section 2 animations, and trigger/object lists.
3. Open the new map immediately (`customOpen(newKey)`).
4. The copy is immediately editable and saveable as any other custom map.

**Add to `moreFilterGroupHtml`:**

```js
if (ctx.romId || ctx.hasMap) subs.push(copyMapButtonHtml());
```

Where `copyMapButtonHtml` emits a button with `data-edit-act="copy-map"`,
handled in `map-editor-input.js`'s delegated click handler.

**Scope note:** Copying a vanilla room should import its full decoded state
(metatile grid + collision words) into the draft stamp table — the same
priming operation that task 1 in `map-editor-todo.md` requires for vanilla
room sidebar wiring. These two tasks share a prerequisite.

---

## 3. "From selection" on the Widgets tab does nothing

**Status: ✅ fixed**

Clicking **⬚ From selection** on the Widgets tab (`data-widget-act="selection"`)
calls `widgetSaveFromSelection()` (`map-editor-widgets.js` `L112`). That
function checks for either a group selection (`_groupSel`) or a copy-tool
rectangle selection (`_editSel`). If neither is set it logs
"select a region with the copy tool, or a stamped object, first."

The bug: **after drawing a box with the Copy tool the selection `_editSel`
is set, but switching to the Widgets tab clears it.** In
`map-editor-input.js`, changing the active tab calls `renderEditPanels()`
which rebuilds the sidebar HTML — and at least one code path resets
`_editSel` (the tab-change gesture handler calls `editDeselectAll()` for
tool changes; an implicit tool change may be triggered when the tab switches
from Copy to Widgets).

Additionally, `widgetHasSelection()` (`L128`) gates the button's `disabled`
attribute: if `_editSel` is null when the Widgets tab renders, the button is
disabled and the click never fires.

**Secondary issue:** Even when `_editSel` is live, `editBuildConstruct`
(`map-editor-constructs.js` `L79`) only captures `layer1` / `layer2` / 
`collision` words — it does not capture `specialCells` entries for cells in
the selection. Drift, gate, and interact bits are therefore dropped from the
saved widget (same as task 3 in `map-editor-todo.md`).

**Fix direction:**

- Do not clear `_editSel` on a tab switch alone. Only clear it on an
  explicit tool change (the existing `if (d.tool !== fromTool) editDeselectAll()`
  in the tool-button handler) or on Escape.
- Keep `widgetHasSelection()` checking against the persistent `_editSel`.
- As a fast path: add a **"Save as widget"** button directly to the Copy
  tool's pill UI (next to Paste), so the user never has to navigate away from
  the active selection to save it. One click, no tab switch, no state loss.

---

## Workflow: copying Strongheart's Hut

The intended end-to-end flow once all three bugs are fixed:

1. Open room `0x34` (Strongheart's Hut) in the Rooms tab.
2. Click **edit** to enter edit mode.
3. Click **⋯ → Copy map** → a new custom map "Copy of Strongheart's Hut"
   opens.
4. Select the Copy tool, drag a box around the whole hut interior
   (the hut walls + floor, excluding the NPC and the two vase objects).
5. Switch to Widgets tab → click **⬚ From selection** → widget saved as
   "Strongheart's Hut (empty)".
6. Stamp it onto any new custom map to quickly add a hut variant.

Steps 4 and 5 are blocked by bugs 1 and 3. Step 3 is blocked by gap 2.
