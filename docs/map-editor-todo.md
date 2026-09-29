# Map Editor — Open Tasks

> Last updated: 2026-09-28.
> Status key: 🔴 bug / broken · 🟡 feature gap · 🟢 documented design, not yet built

---

## 1. Vanilla room: right sidebar not properly wired to the editor

**Status: 🔴 bug / partial wiring**

When a vanilla ROM room is open (not a custom map) and edit mode is
toggled on, the right-side dock renders correctly (Tile / Special / Trigger /
Object / Widgets / Info tabs), **but the sidebar's panels still operate on
`_editPanelRoom`** — the raw room object last seen by the panel — rather than
on the live draft that edit mode created.

Specific symptoms observed:
- The **Trigger tab** shows the room's vanilla triggers as a read-only list
  rather than the editable pencil-drawer. Clicking the tab shows
  "none yet — drag a box on the map with the pencil" even though vanilla
  B-triggers and step-on triggers exist.
- The **Info tab** and tile-budget bar do not update when cells are painted,
  because they are driven by the ROM room's decoded data rather than the
  draft's live stamp table.
- Selecting a vanilla room from the rail while edit mode is already on leaves
  the dock showing the *previous* room's data until a re-render is forced.

**Root cause:** `editToggle` (map-editor-input.js `L334`) creates the draft
and toggles `.rg-editing` on `#room-detail`, but the panel render path
(`renderEditPanels`, detail-renderer.js) still falls through to the vanilla
room's data for several subpanels that check `_editPanelRoom` first and do
not consult the draft.

**Fix direction:** On toggle-on, prime the draft from the vanilla room's
decoded triggers and objects (already in `room.triggers` and `room.objects`),
then make the Trigger and Object panels use `editTriggerList` /
`editObjects()` exclusively when a draft is live — regardless of whether the
draft came from a vanilla room or a blank map. The tile-budget bar can
read `_mtPalette` (which *is* set on vanilla rooms in edit mode) instead of
the ROM room's metatile count.

---

## 2. Vanilla room: bottom filter-bar not properly wired

**Status: 🔴 bug / partial wiring**

When editing a vanilla room the bottom bar's chips (**Background / Collision /
Interact / Cuttable / Triggers ▾ / Objects / Special ▾**) behave differently
from a custom map:

- **Collision toggle** re-renders from the ROM room's pixel data rather than
  from the draft's live stamp table. Net effect: painting a cell and toggling
  Collision shows the *old* vanilla collision until the room is
  force-re-rendered.
- **Cuttable toggle** calls `editCutLayerOn()` which guards on
  `editDraft() && editDraft().blank` — the `blank` flag is only set on maps
  created from scratch, so the toggle is silently ignored on vanilla rooms.
- **Interact overlay** reads the draft's `specialCells` but the vanilla room's
  base collision words are not merged into the draft's stamp table, so cells
  the user has not touched show `0` instead of the ROM value.

**Fix direction:** When `editToggle` primes a vanilla room into a draft
(see task 1), import the ROM room's existing collision words into the draft's
stamp table as the initial state, so all bottom-bar overlays can read from
the draft unconditionally. The Cuttable toggle guard should check
`editDraft()` alone (not `.blank`).

---

## 3. Widget special-tile properties lost on close/reopen

**Status: 🔴 bug**

Special-tab properties painted inside a widget editor (Drift, Gate, Interact
bit 15, Stairs glyphs) are stored in the draft's `specialCells` map. When the
user clicks **← Back to map**, `widgetFromSession` (map-editor-widget-edit.js
`L94`) saves `cells` and `attachments` back into the widget object but
**does not save `specialCells`**. On the next edit open, the overlay
annotation — the dashed glyph, the stair direction marker — is gone.

Note: the collision *word* itself (including the drift nibble) is preserved in
`words.collision` because `editSpecialAppliedIndex` writes a new stamp at
paint time. The data loss is in the *overlay state*, not the binary payload.
But on re-stamp the Special write path is not re-invoked, so any glyph is
missing.

**Fix direction:** Serialize `d.specialCells` filtered to cells within the
widget bounds into `w.specialCells` in `widgetFromSession`. Restore it in
`widgetEditBlank` after the initial stamp.

---

## 4. Select cursor cannot properly move or delete a placed widget

**Status: 🔴 bug**

**Move bug:** A widget whose cells are background-agnostic (all-null terrain —
"keep whatever the widget lands on") has its `cells` array resolved against
the *donor room's* blank floor metatile at stamp time. When `editGroupMove`
calls `editGroupLift` and then replays those stamp indices at the new position,
the donor floor metatile is written there instead of the destination room's
own floor, leaving **donor floor tiles at the new position**.

The correct behaviour: a widget with no terrain should land transparently on
the destination's existing floor, exactly as it does when first stamped. The
group record needs to carry the portable construct representation (the
`{graphic, family, flags}` form from `map-editor-constructs.js`) rather than
resolved stamp indices, and re-apply `editConstructWrites` at the new
position on move.

**Delete bug:** Pressing `Delete`/`Backspace` with a group selected falls
through to the cell-erase path, which deletes background tiles one-by-one and
leaves the group record (`d.groups`) as a ghost with dangling trigger UIDs.

**Fix direction (move):** Store the original portable construct in the group
record. `editGroupMove` calls `editConstructWrites(palette, construct, newX, newY)`
rather than replaying stale indices.

**Fix direction (delete):** Wire `Delete`/`Backspace` in `keydown`
(map-editor-gestures.js) to call `editGroupDelete(_groupSel)` when
`_groupSel` is non-null and the tool is Select.

---

## 5. Collision editor — overwrite any cell's geometry by hand

**Status: 🟡 feature gap** (mentioned in collision-suggestions.md §"Not done yet")

The map editor auto-suggests collision from the vanilla index when a tile is
painted, and the Special tab can paint gate / drift / stairs / interact bits.
But there is **no way to paint an arbitrary geometry shape** (solid NW corner,
half-tile top barrier, etc.) onto a cell that already has art.

**Proposed implementation:** Add a collision shape picker — either a new
sub-section in the Special tab or a dedicated Collision sub-tab — that shows
all 16 geometry codes (0x0–0xF) as small visual tiles (the same diagonal /
half-barrier shapes `geometryMask` already draws in map-editor-collision.js),
plus the plane-transparent (bit 6) tile. Clicking one arms a special write
that rewrites only bits 3..0 of the collision word (equivalent to
`editSpecialGateWord` but masking `0x000F`), leaving plane, gate and sprite
bits intact.

This is also the natural home for the plane-transparent pick (task 6) and
the stairs picks currently duplicated across Special and the Tile filter.

---

## 6. Plane-transparent (PT / bit 6) not paintable

**Status: 🟡 feature gap**

The PT collision bit is detected and shown in the overlay (purple wash, label
"PLANE-TRANSPARENT (BIT 6)"), and the Levels bar tooltip names it, but there
is no Special tab item that *writes* it. Vanilla uses PT in 23 rooms for
bridges, overpasses and multi-level tunnels — the "yellow ladder-y" style
tile.

**Implementation:** One new item in `EDIT_SPECIAL_GROUPS`
(map-editor-special.js):

```js
{ id: 'plane-transparent', label: 'Plane-transparent', glyph: 'PT', pt: 1 }
```

Add `SPECIAL_PT_MASK = 0x0040` and handle `def.pt != null` in
`editSpecialAppliedIndex`. Add a `hide-special-pt` sub-toggle to the filter
dropdown. Clearing PT should be covered by `editSpecialClearWord` (extend the
clear mask to include `0x0040`).

---

## 7. Widgets should be locked after stamping

**Status: 🟡 feature gap / design**

After a widget is stamped as a group on the map, the user can:
- Open the Trigger tab and delete one of the widget's B-triggers independently
  of the group — orphaning the trigger from its object.
- Paint over one of the widget's cells with a plain tile tool, silently
  breaking the group.

The intended behaviour: **a placed widget is atomic**. Its triggers and
objects cannot be removed individually; only `editGroupDelete` removes them
all together and restores the `under` floor.

**Implementation:**
- Before deleting a trigger in the Trigger panel, check whether any group's
  `placed` UIDs include the trigger's UID. If so, refuse with a note:
  "part of widget X — delete the whole widget to remove it."
- In `editApplyStroke`, before writing a cell, check whether it falls inside
  any active group's bounding box (same logic as `editGroupFind` but by
  coordinate). Skip it when a group owns that cell, or prompt the user.
- Render the group outline in a visually distinct "locked" style
  (`groupSvg`, map-editor-groups.js `L189`) when the cursor is not the Select
  tool hovering it, so users can see the region is protected.

---

## 8. Flood fill tool missing

**Status: 🟡 feature gap** (noted in map_editor_ui.md §4.3)

The five shipped tools are paint, rect, pick, copy, move. Flood fill is
absent. Fill must match by **metatile id**, not visual appearance (two ids
can look identical and behave differently).

**Implementation:** on click, BFS from the clicked cell collecting all
connected cells where `editCellAt(palette, x, y) === seed`; apply the brush
to all of them as one undo step. Add a bucket-fill icon to the toolbar
(map-editor-toolbar.js) and a `'fill'` tool case in map-editor-gestures.js.

---

## 9. Animation phase variants (torch stagger)

**Status: 🟡 feature gap** (noted in future-features.md §16)

Placed animated tiles always start at frame 0. Vanilla staggers torches on
the same cycle by placing frame 1 or frame 2 of the cycle on different
channels so they flicker out of step. The tile tab's `frames` mode already
lists every frame; `custom-room.ts` writes Section 2 per placed graphic. A
phase picker — clicking a later-frame swatch arms the brush at that phase —
would expose the full stagger capability.

---

## 10. Write edited vanilla room back to its ROM slot

**Status: 🟢 designed, not built** (map_editor_ui.md §1, §6)

The TypeScript encoder (`src/maps/encode.ts`) is a complete, verified port of
`tools/encode_room.py`. The draft JSON is the handover format. Still missing:

- "Save to ROM" button in the panel (with confirmation + backup prompt).
- Free-space map of the ROM for blob relocation when the rebuilt blob grows.
- Decision on whether the write path runs in TypeScript or shells out to
  Python.

---

## 11. Object / trigger add-remove-reorder not built

**Status: 🟢 designed, not built** (map_editor_ui.md §4.5)

The encoder already writes trigger and object arrays from lists. The UI
affordance — an editable table of step-on and B-trigger records with
add/remove/reorder rows — is not built. Currently triggers are
viewed-only on vanilla rooms (see task 1) and added only indirectly by
stamping a widget.

---

## 12. Room resize

**Status: 🟢 designed, not built** (map_editor_ui.md §4.6, §5)

Resizing renumbers every metatile id (`baseMetatile = width * height * 2`).
Must be one atomic operation. Not yet designed as a UI affordance.

---

## 13. Info tab cleanup

**Status: 🟡 polish / UX**

The Info tab shows the right data but has UX rough edges (see screenshot):

- **"no field limit" / "no confirmed limit"** on stamps, step triggers and
  B-triggers. Replace with empirical vanilla ceilings ("≤ 65 step-on in
  vanilla", "≤ 58 B-triggers") and colour amber when the draft exceeds the
  vanilla max, red only at a hard binary limit.
- **"attested 161 in these families"** is not actionable from the Info tab.
  Move to the family chip tooltip on the Tile tab and remove from Info.
- **WRAM bar** shows total bytes used; add a split: `grid Xb · dict Yb /
  32768` so it is clear what each part costs.
- **CHECKS CLEAR** panel is open by default but duplicates the bar above it.
  Collapse by default; inline "Nothing blocking" as a single status line
  below the bars.
- When editing a vanilla room (task 1), the bar shows ROM numbers rather
  than the draft's live state. Shared fix with task 1.

**Owners:** `map-editor-panels.js` — `infoTabHtml`, `budgetBar`,
`triggerCapacityHtml`.

---

## 14. Pan while editing

**Status: 🟡 feature gap**

Once edit mode is on, two-finger trackpad scroll and the SVG pan are eaten
by the gesture handler before they reach the viewport transform. On a
MacBook you cannot pan a zoomed-in map without leaving edit mode.

**14a. Two-finger scroll should always pan.** In
`map-editor-gestures.js`, let `wheel` events with no `ctrlKey` (pure
scroll, not pinch-zoom) fall through to the SVG scroll container
unchanged instead of being captured by the stroke handler.

**14b. A Pan tool** (hand cursor, `H` shortcut). A `'pan'` entry in the
toolbar (`map-editor-toolbar.js`) that makes every pointer gesture a
viewport drag, bypassing `editStroke` entirely and delegating to the
SVG pan logic in `svg-builder.js`.

**14c. Space-hold** as a temporary pan (releases back to the previous
tool) — the Photoshop/Figma convention. Add a `keydown`/`keyup` handler
in `map-editor-gestures.js` that swaps the tool while Space is held.

---

## 15. Room resize: all four directions

**Status: 🟡 enhancement to task 12**

When resize is built (task 12), it must work in all four directions.
Expanding north or west shifts every cell coordinate and rebuilds
`baseMetatile = newWidth * newHeight * 2`. The UI could be corner + edge
handles or a four-field dialog. All four directions must be one atomic
undo step.

---

## 16. Header effects — full catalogue and editor support

**Status: 🟡 research + feature gap**

The 13-byte room header's five PPU fields produce unique visual effects.
They are exposed as raw hex fields today. A named-preset picker and live
preview would make them accessible without reading the spec.

**Known effects** (fully decoded in
`docs/map-format/building-a-room-from-scratch.md §3`):

| Preset name | Field values | What it does | Room(s) |
|---|---|---|---|
| Lantern / darkness | `visibleLayers=22`, `blendLayers=1`, `blendMode=146`, `roomEffect=1` | Canopy is a soft dark disc; subtracts from terrain; `roomEffect=1` offsets the layer from camera so the lit circle follows the player | `0x4b` (Oglin tunnel) |
| Additive blend | `blendLayers=17`, `blendMode=2` | Subscreen terrain adds to main | 32 rooms |
| Half-add glow | `blendLayers≠0`, `blendMode=66` | Soft additive at half intensity — water shimmer, volcanic haze | 23 rooms |
| Subtract | `blendMode=146` | Darkens terrain where subscreen is bright | `0x1d`, `0x4b` |
| Depth-sort exterior | `roomEffect=2` | Sprites sorted by distance from a focus point — used for open-world rooms | 6 rooms |
| BG wave / water ripple | `roomEffect=5` | Per-line BG1+BG2 horizontal scroll from a table (HDMA-style) | `0x52` |
| Parallax layer | `roomEffect=1` | Canopy scrolls independently of camera at fixed offset | `0x4b` |

**Still unresolved:**
- `roomEffect` entries 6 and 7 — in the jump table but unused by vanilla.
- Whether HDMA (per-scanline effects) is driven by `roomEffect` routines or
  a separate engine path.
- `cameraFlags` bit 14 (`0x4000`) — tight vertical follow, legal but never
  used in vanilla.

**Editor needs:**
- Header presets dropdown in the new-room dialog and the room header
  inspector, setting all related fields together.
- Info-tab note when the draft uses a non-zero `roomEffect` (the static
  render cannot show the animated result).

---

## 17. Tile suggestion: procedural fill and cross-map references

**Status: 🟡 feature gap — extends existing "Likely Neighbors" card**

**17a. Procedural fill by adjacency.** A "Fill region" button in the
neighbour card (`map-editor-neighbours.js`): BFS-fills the selected region
starting from its boundary tiles, at each step picking the
highest-ranked neighbour from `rankByRelationship` (vanilla-related.ts)
that matches the open cell's shape constraint. The adjacency data already
drives the neighbour card; this turns it into an action.

**17b. Cross-map tile references.** "Where else in the ROM is this
graphic used?" — `index.graphicRooms` already maps every graphic to its
room list. An expandable panel on the Tile tab could list those rooms with
a thumbnail and placement count; clicking one opens it in the Rooms viewer.
The data is in the host-side catalogue (`graphicRooms` field from
`room-draft.js`); the webview just needs a render path.
