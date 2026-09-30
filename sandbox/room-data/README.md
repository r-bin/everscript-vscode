# sandbox/room-data — what used to sit under the map

Until v0.90.0 the Rooms tab drew a long column of data sections under the map
editor. Since every room now opens in the editor, and the editor's own tabs
show most of it, the column is gone: the editor fills the tab.

Everything that was there was sorted three ways: **moved** into the editor,
**removed** because it was redundant or wrong, or **parked** here because it
is real information the editor has no place for yet. Parked code is not part
of the extension build (`.vscodeignore`, `knip.json`) and may not import from
`src/` (`.depcruise.js`); it is kept as the starting point for bringing a
section back.

## Moved into the editor

| Was | Now |
|---|---|
| Step-on / B-trigger script cards (the full byte table per trigger) | The Trigger tab's rows. Collapsed, a row says what its script does (loot, the room it leads to, NPCs it places); opened, one summary line per instruction. `map-editor-trigger-scripts.js` |
| The enter-script card | The Trigger tab's **Enter** tab — shown, not drawn (it has no box) |
| The emulator's current-instruction highlight in the script tables | Lands on the same lines in the Trigger tab (`data-script-addr`, `interactions.js setupByteScriptFocus`) |

## Removed

| Section | Why |
|---|---|
| Tile palette (the metatile sheet under the map, with its stamps/tiles views and budget bar) | Redundant: the editor's Tile tab is the picker, the Info tab has the budgets. Its request/reply plumbing stays in `metatile-palette.js` |
| Step-on / B-trigger tables (name, coords, label) | Redundant: the Trigger tab lists both, with the room's names in the tooltips |
| ROM scripts meta row (enter pointer, table lengths, counts) | Redundant: the Info tab counts triggers and their bytes |
| Objects (source `.evs` objects table) and the object-state browser (thumbnails per state, "hide boring") | Redundant: the Object tab shows every object with its states as frames |
| ROM header table ("ROM Map Data": the 13 bytes, derived geometry, render preset, trigger layout, payload families) | Redundant — the Info tab's Header section shows and edits the same bytes, the Tile tab the families — and partly **wrong**: it called TM `$16` "the Oglin cave variant" (it is BG1 — the front layer — turned off), labelled byte 5 by room type ("0x00=outdoor, 0x11=interior") and byte 8 "0x02=parallax/jungle", guesses the ROM does not support (effect 2 does no differential scrolling; see `docs/map-foreground-and-parallax.md`) |
| The ROM data summary strip | Redundant: the Info tab's Map section measures the same map |

## Parked here

| File | What it drew | Input it needs |
|---|---|---|
| `sprite-palettes.js` | The room's sprite-palette budget: distinct palettes used of the four safe slots, with the fifth (the one alchemy steals) flagged. `docs/script-format/palettes.md` | `room.content.triggers.palettes` — still computed by the host |
| `source-tables.js` | For a room defined in `.evs` source: its entrances, enemies, objects and transitions, each row a link to its source line | `room.content.entrances/enemies/objects/transitions` |
| `rom-map-features.js` | The overlay legend and a per-feature count table: collision tiles by plane, drift by direction, entity gates by what they block, plane-transparent tiles, elevation changes, cuttable-grass table warnings | The host's `roomTiles` overlay reply (`rendering/tile-overlay.js`) |

The feature table's counts overlap the Info tab's Map section; what it has
that Info does not is the per-direction drift, the per-gate breakdown,
plane-transparent and elevation-change counts, and the cuttable table's
well-formedness warnings. The sprite-palette budget is the strongest candidate
to come back — as a Capacity row in the Info tab.

Each file is the old code as it was, with globals the webview bundle provided
(`escH`, `hexNum`). To bring one back, move it into `src/rooms/webview/`,
list it in `src/memory/webview/index.js`, and give its output a place in a
tab rather than under the map.
