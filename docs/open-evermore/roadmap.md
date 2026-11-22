# Open Evermore: the road to 10/10

Status: **rule set and plan (owner, 2026-11-22); step 1 (rooms) built in v0.457.0.** What makes the tree a product
a romhacker uses rather than a lab, the rules every kind follows, what still breaks them (counted in a fresh tree),
and the order to fix it in. The kinds themselves: [resources.md](resources.md); the state of each: [progress.md](progress.md).

## 1. The bar (owner, 2026-11-22)

- **Easy to read, understand and extend**: a file says one thing, in words; adding a file adds content.
- **Every resource can move and grow**: nothing points at a place, only at a name ([README.md](README.md) §1, the hard rule).
- **100 % of the information at one look, the ROM changed with one click**: the editor shows every file of a
  resource together and builds the ROM from them (§5).
- **One code base**: the lessons of the map editor, and later its code (`src/core/map-editor/`), serve the tree.

## 2. The rules

| # | Rule | Why |
|---|---|---|
| R1 | **One kind per folder; a resource references other kinds, it never holds them.** A room names its scripts (`scripts.json`), it does not contain them. | A resource moves, is shared or replaced without dragging another kind's files along |
| R2 | **Every reference is a typed name**, never an address: a script `door_01`, a string, a palette, a tile, a WRAM cell (§3) | The hard rule; and a reader knows what kind of thing a value is |
| R3 | **Every entry a reader may point at has a name**, by what it does: `door_01`, `sniff_02`, `loot_03`, `scene_01`, `unknown_01` | Entries are found, linked and moved by name; one name ties a trigger, its script and its object |
| R4 | **An editable file holds only what implode reads.** Derived views (a rendered room, a dump of animation frames) are optional (`--previews`) or not written | A field implode ignores is a lie to whoever edits it |
| R5 | **One concern per file**: map.json the look, scripts.json what runs, animations.json what moves, grass.json what is cut | Short files; a diff says what changed |
| R6 | **Every table is generated**: a kind grows past vanilla's count, implode moves the table and its readers | Extending, not only repurposing |

## 3. Reference types

| Reference | Written | Resolves to | State |
|---|---|---|---|
| script | `"<map>/door_01"`, `@door_01` in a script | `scripts/` | built (v0.446.0; full names in scripts.json v0.457.0) |
| room object | `sniff_03` in a room's script | the room's `objects.json` | built (v0.457.0) |
| tile, background palette | `"tile_0d7b"`, `"palette_020"` (also in each layer word) | `maps/tiles/`, `maps/palettes/` | built (palettes named in layer words v0.458.0) |
| collision | `"solid_plane1_in_front"` | `maps/collisions/`, else the name as it spells | built (v0.458.0) |
| string | `string_0afb` | `strings/` (dialogue) | built for dialogue; **names and UI text (`$C4`) are pointers** (§4) |
| sprite palette | `palette_<name>` | a kind of its own | **missing**: sprite and icon palettes (`$90`, `$D0`) are addresses |
| animation | `dog_act2_leap` | `characters/animations/` | built for ids; **records and frames are addresses** (S7d) |
| WRAM | `FORMULA_XP_ACID_RAIN`, `temp[n]` | knowledge entries (`soe://ram/`) | built in scripts; **unnamed cells stay `$7E:xxxx`** ([wram.md](wram.md)) |
| flag | `WEAPONS_OWNED_FLAGS_0+1` and its bit | knowledge entries, compiler FLAG enum | the word by name; **the bit is a number** |
| routine | `script_op_5c_set_object_state` | `soe://rom/code/` | built (handlers) |

## 4. What still breaks the rules (fresh US tree, v0.457.0)

Raw addresses in editable JSON, by folder (`"$…"` values; `maps/rooms` is at 0 since v0.457.0):

| Folder | Files | Addresses | Fields | Fix |
|---|---:|---:|---|---|
| `characters/records` | 284 | 17,905 | `sprite` 12,748, `script` 3,025, `record` 1,704 (animations.json), `name`, `palette`, `palette2` | animations.json is a derived dump (R4): explode S7d (animation records, scripts, sprite infos) or drop the dump to `--previews`; `name` → string, `palette` → palette |
| `characters/animations` | 212 | 1,690 | `sprite`, `script`, `record` | S7d |
| `music/packages` | 70 | 3,347 | `to` | ARAM (the sound CPU's RAM), not ROM: legitimate; later named ARAM regions |
| `menus/ring_items` | 162 | 324 | `icon`, `palette` | an icons kind, palettes kind |
| `equipment/*`, `alchemy/formulas` | 51 | 298 | `palette`, animation slots, flag `bit`, `target`, `level` (`$7E:2F98`) | palettes, S7d, flag bits by name, target flags by enum, WRAM names |
| `characters/projectiles` | 16 | 64 | `animation`, `palette`, `unknown_04`, `unknown_06` | S7d, palettes, research the two words |
| `menus/rings` | 18 | 18 | `flags` | flag names (null when 0) |

Other gaps against R2/R3, found on the way:

- A pickup stages its object as a number (`write_word_const MAP_REF, 9`): the value is the room's object `sniff_01`
  and should be written so (a parameter type for the `LOOT_OBJECT` cell, `operands.mts`).
- Animation channels are positions (`anim3` in metatiles.json): name them in animations.json and write the name.
- A script reached from several rooms names objects of the room whose folder holds it (the first to reach it).

## 5. The editor: one look, one click

The Rooms tab already draws a tree's rooms from their files (`src/games/evermore/imports/tree/`). The steps:

1. **Every file of a room in one view**: the map with its triggers labelled by name (`door_01`), the trigger's script
   text beside it, objects by name with their states, animations and grass on the grid. All of it is in the tree
   since v0.457.0; the tab shows the drawing and the inspector only.
2. **Save back to the files**: an edit in the tab writes the room's files (`tree-map.ts roomToTree`, the code
   explode uses), never a ROM.
3. **Build with one click**: implode the tree (errors shown on the files they name), boot the result in the
   emulator at that room.
4. **One editor for every game** (AGENTS.md §0.6): the tree's room becomes one more source of the core map editor,
   as ROM rooms, Mana and Terranigma rooms are.

## 6. Order of work

| Step | What | Unlocks |
|---|---|---|
| 1 *(built, v0.457.0)* | Rooms: scripts out of map folders (`scripts/rooms/<map>/`), `scripts.json`, one concern per file, triggers and objects named, previews optional | R1, R3, R4, R5 for maps; 0 addresses in `maps/rooms` |
| 2 | Small naming gaps: pickup objects, animation channels, ring flags and flag bits by name | R2, R3 in scripts and menus |
| 3 | `$C4` names and UI text as a strings kind (movable, any length) | names of characters, items, weapons, formulas (review §9.2) |
| 4 | Palettes kind (`$90`, `$D0`) | R2 for characters, items, equipment, projectiles |
| 5 | S7d animation records, scripts, sprite infos; `animations.json` dumps removed | R2, R4 for characters; new animations |
| 6 | WRAM names for every remaining `$7E:` field ([wram.md](wram.md)) | R2 everywhere |
| 7 | Editor §5.1–5.3 | one look, one click |
| 8 | Growable in-place tables (ring items, item actions, weapons, formulas) | adding, not repurposing (review §4) |
