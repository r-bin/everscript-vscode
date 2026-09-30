# Custom map files

How the map editor stores a custom map, the export archive it produces, and
how edit history and levels are recorded in them.

Code:
- Host storage: `src/rooms/custom-store.js`.
- Export archive: `src/rooms/rendering/custom-export.js`, using
  `src/shared/zip.js`.
- Webview side: `src/rooms/webview/map-editor-custom.js` and
  `map-editor-custom-store.js`.
- Tests: `tests/memory/custom-maps.test.js`.

## 1. Where a map lives

Each custom map is one folder in the extension's global storage (VS Code's
`globalStorageUri`), outside any workspace:

```
<globalStorage>/custom-maps/
  index.json               which map was open last, and the list order
  <key>/
    map.json               the map: the editor document (§2)
    history.json           every edit, undo and redo stacks (§3)
```

`<key>` is the map's id, e.g. `custom-mxk3f9a2-1`. It never changes, even
when the map is renamed.

Saving happens on its own, a moment after each edit. There is no save
button. When the Rooms tab is rebuilt (it is rebuilt whenever the active
document changes), the map that was open is reopened, in the state it was
left in.

**New Map** reuses a map nothing was ever done to: no history and nothing
drawn, at the same size and with the same donor. The open map is checked
first, then the newest. Pressing it again on an empty map reopens that map.

**Migration.** Before v0.71.0, maps were stored in the extension's UI
preferences (`customMaps`). On first load, each one is written to its own
folder, and the preference is removed.

## 2. `map.json`, the editor document

```jsonc
{
  "format": "everscript-custom-map",
  "version": 1,
  "key": "custom-mxk3f9a2-1",
  "name": "New map 1",
  "created": "2026-09-25T10:00:00.000Z",
  "modified": "2026-09-25T10:42:00.000Z",
  "borrow": 52,            // donor room: whose graphics list and palettes it draws with
  "width": 16,             // metatiles (16 px); one SNES screen is 16×14
  "height": 14,
  "draft": {
    "cells":        { "x,y": 12 },   // stamp index per painted cell (§2.1)
    "cut":          { "x,y": 14 },   // the cuttable layer over those cells
    "added":        [ { "layer1": 43008, "layer2": 17506, "collision": 16 } ],
    "addedGraphics": [ 677 ],        // graphics adopted beyond the donor's list
    "families":     [ 32, null, 58 ],// the seven palette slots (null = free)
    "autoFamilies": [ 32 ],          // slots filled by painting, not by hand
    "specialCells": { "x,y": "gate-dog" }, // Special tab glyphs (§2.3)
    "placed":       [ ... ],         // triggers and objects (§2.4)
    "placedSeq":    3,
    "groups":       [ ... ],         // stamped objects (§2.5)
    "groupSeq":     1,
    "constructs":   [ ... ],         // saved regions and widgets, ready to stamp
    "start":        { "x": 8, "y": 7 }, // the Boy's start, in metatiles
    "plane":        1                // the level new tiles are drawn on (§2.2)
  }
}
```

A reader that doesn't know a field must keep it. A reader that finds
`version` higher than it knows must refuse to write the file.

### 2.1 Stamps

A stamp is one metatile: `{layer1, layer2, collision}`. The two layers are
tilemap words (front art and ground), and `collision` is a collision word
([map_collision_mechanics.md](map_collision_mechanics.md)).

`cells` and `cut` hold stamp **indices**:
- An index below the donor's dictionary size (`count`) is one of the donor's
  own stamps.
- Index `count + n` is `added[n]`.

This is the order the stamps are appended to Block 3 on export. Stamps are
reused when identical, and trailing ones nobody uses are dropped.

Cells not listed in `cells` are the blank floor.

### 2.2 Levels

A **level** is an elevation plane: bits 5..4 of the collision word, 0..3.
The engine treats a tile on another level as solid unless it is
plane-transparent (bit 6). That is how a bridge and the tunnel under it
share cells.

`plane` is the level the editor draws on, 1 by default (red on the
collision overlay; 104 of 127 vanilla rooms use only level 1). Every tile
written by the pencil, the rectangle or the cuttable layer gets that level
in its collision word. The rest of the word is kept.

### 2.3 Specials

`specialCells` holds only glyphs. Gate, drift and diagonal-stairs picks
have already changed the cell's stamp, and that is what gets exported.

### 2.4 Triggers and objects

`placed` entries:
- **Trigger:** `{kind: "bTrigger" | "stepOn", x, y, w, h, scriptId, uid}`.
  A trigger drawn with the pencil has `scriptId: null`.
- **Object:** `{kind: "object", uid, x, y, w, h, states, layer}`. `layer`
  is `{"dx,dy": stamp}`, what the area turns into when a script changes the
  object's state (a gourd breaks, a chest opens). It is drawn over the map
  like the cuttable layer, and only while the Object tab is open
  (`map-editor-objects.js`). A vanilla object brings its first change, read
  from vanilla's XOR descriptor. `states` is how many changes vanilla has;
  the editor shows the first.
- **Planned family slots** (`plannedOnly`, `{slot: true}`) are slots a tile
  pick reserved and nothing has painted with yet. The next pick of another
  family takes them back.
- A deleted entry stays in the list, flagged `removed: true`, so each
  `uid` stays unique.

### 2.5 Groups: stamped objects

Stamping a construct or a widget (a gourd, a fire pit) makes a **group**.
A group is stored **apart from `cells`** and sits over the map: it is never
written into `cells`, so the map under it is untouched and can be moved,
deleted or painted under without disturbing it:

```jsonc
{
  "uid": 1,
  "name": "gourd",
  "x": 4, "y": 6, "w": 2, "h": 2,
  "level": 1,                                   // the floor's level when stamped
  "cells":  [ { "dx": 0, "dy": 0,               // its own words; null = the map's
                "layer1": 13706, "layer2": null, "collision": 31 } ],
  "placed": [ 2, 3 ]                            // uids of its triggers/objects
}
```

- **What a cell shows** is the map's cell with every group there over it,
  in list order, each over what is under it (a gourd stamped on a pasted
  floor is on that floor): a null layer, and a blank terrain, is what is
  under it; `collision` (null: the one under it) goes on the level of what
  is under it (`level` where there is nothing). The objects a group brought sit on the floor the same way —
  a blank terrain in one of their states is the floor under it.
- **Moving** a group changes `x, y`; its triggers and objects move by the
  same offset. **Deleting** it removes it and them. The map is never
  written either way.
- **Exporting** (Export ROM, and the JSON handoff) bakes every group into
  the grid: that is the only place the two meet.
- Files written before v0.95.0 hold groups that were written into `cells`,
  with `cells: [{dx, dy, index}]` and `under` (what they covered). The
  editor lifts them out on load, all together: `cells` gets back what the
  *first* group there covered, each group keeps only what it stamped that
  differs from what it covered, and a cell that changed nothing is dropped.
  (v0.95.0 lifted stacked groups one by one and garbled their overlaps;
  v0.95.1 lifts them together.)

## 3. `history.json`, the edit history

```jsonc
{
  "format": "everscript-custom-map-history",
  "version": 1,
  "undo": [ step, ... ],   // oldest first
  "redo": [ step, ... ]
}
```

The history is kept for as long as the map exists, not only for one session.
Undo works the same after a restart as before it.

A **step** is one user action, whatever its size:
- a click;
- a drag with the pencil or eraser, however many cells it crossed;
- a rectangle;
- a paste;
- stamping, moving or deleting a group;
- adding, moving or deleting a trigger;
- moving the Boy.

Each step stores what it overwrote, so undo can put it back:

```jsonc
{
  "cells":   [ { "x": 3, "y": 4, "index": null, "layer": "cut" } ], // previous values; null = was unpainted
  "special": [ { "x": 3, "y": 4, "id": null } ],
  "placed":  5,              // placed.length before the step (tail undo)
  "dropped": [],             // redo only: the placed entries undo removed
  "triggers": { "before": {...}, "after": {...} }, // when triggers changed
  "groups":   { "before": [...], "after": [...] },  // when groups changed
  "start":    { "x": 8, "y": 7 }                    // when the Boy moved
}
```

A redo step has the same shape, holding the values to write back. A stamp
referenced by the redo stack is kept even if nothing on the map uses it
any more. Otherwise redo would write an index that no longer exists.

## 4. The export archive

**Export map…** in the `⋯` menu writes one `.zip`:

```
<slug>.zip
  <slug>/
    <slug>.bin        the room blob, as Export ROM writes it into room 0x15
    <slug>.map.json   the editor document, exactly as in §2
    <slug>.evs        a sample everscript file that installs the map (§4.1)
    stamps.json       every stamp the map uses (§4.2)
    README.md         what each file is, and the map's numbers
```

`<slug>` is the map's name in lower case, with runs of anything other than
`a-z0-9` replaced by `_` (`New map 1` → `new_map_1`).

The blob is built the same way Export ROM builds it. It is written into a
scratch ROM and decoded again before the archive is written. A map that
does not survive that round trip is not exported, and the error is shown.

The history is not part of the archive. It records how the map was made,
and the archive is the finished map.

### 4.1 The sample `.evs`

The file uses the same pattern as the everscript repo's
`in/test_noinclude.evs`:
- The intro skips straight into the map (`load_map(MAP.BRIAN, x, y)` at
  `ADDRESS.INTRO_FIRST_CODE_EXECUTED`).
- The map's enter script gives the Boy a spear (so grass can be cut) and
  fades in.
- The Boy's start becomes an `entrance`.
- Each trigger drawn in the editor is listed with its box, as a comment,
  since it has no script yet.

It is a starting point to edit, not a build input. The blob still has to be
placed into the ROM, which Export ROM does.

### 4.2 `stamps.json`

```jsonc
{
  "format": "everscript-custom-map-stamps",
  "version": 1,
  "borrow": 52,
  "stamps": [
    { "index": 12, "layer1": 43008, "layer2": 17506, "collision": 16,
      "level": 1, "cells": 40, "cut": 0 }
  ]
}
```

Every distinct stamp on the map or the cuttable layer, with how many cells
use it, its level (collision bits 5..4) and its three words. It is what an
external tool needs to know without decoding the blob.

## 5. Deleting a map

**Delete map…** in the `⋯` menu asks for confirmation (a modal dialog on the
host), then removes the map's folder, history included. There is no undo.

## 6. Your own widgets: `widgets.json`

Widgets are not part of any one map. They live in one file every map shares:

```
<globalStorage>/widgets.json
{ "format": "everscript-widgets", "version": 1, "widgets": [
  { "id": "w-muimq9areswg", "name": "Hut gourd", "w": 2, "h": 2,
    "cells": [ { "dx": 0, "dy": 0, "canopy": { "graphic": 1058, "family": 58, "flags": 0 },
                 "terrain": null, "collision": 31 } ],
    "attachments": { "bTrigger": [ { "dx": 0, "dy": 0, "w": 3, "h": 3, "scriptId": 3444 } ],
                     "stepOn": [], "objects": [ { "dx": 0, "dy": 0, "w": 2, "h": 2, "states": 1 } ] },
    "source": { "deco": 326, "room": 81 }, "created": "…", "modified": "…" } ] }
```

- **Cells are portable.** Each layer is `{graphic, family, flags}` and is
  rebuilt in whichever map the widget is stamped into, adopting the graphic
  and family it needs. A `null` layer means "keep whatever is there", so a
  gourd keeps the floor it lands on. A layer no room could explain is kept
  as `{word}`.
- **Attachments** are the triggers and objects that come with it, relative
  to its top-left. An object carries `cells`, its changed look, as portable
  cells. Scripts are vanilla's ids: two copies of one gourd run one
  script and share its flag.
- **Level.** Collision is stored as it was drawn. Stamping re-levels it to
  the floor it lands on: the level most of the covered cells already have,
  or the level bar's on open ground (`map-editor-levels.js`
  `editFloorLevel`).
- **Where widgets come from:**
  - "+ New widget";
  - "+ From selection", the copy tool's region or a stamped object;
  - ☆ on a vanilla card. The vanilla library is generated automatically
    from vanilla rooms, so it is behind the Widgets tab's `vanilla` toggle.
- **Editing** (✎) opens the widget on its own canvas, a custom map the rail
  never lists. Every save writes back into `widgets.json`, and nothing goes
  to `custom-maps/`. The Boy has no start there. Delete asks first, like a
  map. Maps a widget was stamped into keep their copy.
