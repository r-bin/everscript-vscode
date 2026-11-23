# Open Evermore: the road to 10/10

Status: **rule set and plan (owner, 2026-11-22); step 1 (rooms) built in v0.457.0; §4 scored per folder at v0.458.2.** What makes the tree a product
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
| tile, background palette | `"tile_0d7b"`, `"palette_020"` (also in each layer word) | `maps/tiles/`, `palettes/backgrounds/` | built (v0.458.0; moved to `palettes/` v0.464.0) |
| collision form | `"solid"`, `"diagonal_sw_slides"` (level and flags are fields) | `maps/collisions/` | built (v0.458.1) |
| string | `string_0afb` | `strings/` (dialogue) | built for dialogue; **names and UI text (`$C4`) are pointers** (§4) |
| sprite palette | `"boy_bone_crusher"`, `"ring_icon_04d"` | `palettes/sprites/` | built (v0.464.0; 269 bank `$90`/`$D0` palettes) |
| animation | `"boy/walk"` (`animation_groups`), `"dog/act2_leap"` (`animate_ids`) | `animations/groups/`, `animations/animate_ids/` | built (v0.464.0: all 783 groups + 212 ids; **$C7–$C9 scripts stay in `_base/`**) |
| WRAM | `LEVEL_LOW_CURE`, `temp[n]` | `wram/` (v0.459.0, from names.json, the compiler and the WRAM map) | built: scripts, records, rings name it through `wram/`; **unnamed cells stay `$7E:xxxx`**; moving: W2 ([wram.md](wram.md)) |
| flag | `WEAPONS_OWNED_FLAGS_0+1` and its bit | knowledge entries, compiler FLAG enum | the word by name; **the bit is a number** |
| routine | `script_op_5c_set_object_state` | `soe://rom/code/` | built (handlers) |

## 4. What still breaks the rules (fresh US tree, v0.458.2)

Census of 2026-11-22: 29,837 files, 41 MB; `_base/unexploded.bin` keeps ~0.6 MB of the 3 MiB unexploded (code, `$C4`
tables, animation records and scripts), the rest is blanked pool. Raw addresses are `"$…"` values in editable JSON;
scripts have none (247 of 73,540 lines keep a `<0x…>` WRAM cell). Score: against §1 and R1–R6, 10 = no gap.

| Folder | Score | Addresses | What keeps it from 10 | Fix |
|---|---:|---:|---|---|
| `maps/collisions` | 9 | 0 | — | — |
| `scripts/opcodes`, `scripts/entities` | 9 | 0 | field docs (`what`) copied into every file | one README per kind |
| `maps/rooms` | 8.5 | 0 | objects `unknown_NN`; animation channels by position; metatile ids and object `cells` as hex (`"000"`, `"301 302"`); header numbers (`mainScreen: 23`); `metatiles.json` ~2,700 lines a room | step 2; header fields by name |
| `scripts/rooms` | 8 | 0 | 287 of 2,766 scripts `unknown_NN` | name by what they do |
| behaviours, attack_procs, animation_modes, `menus/*_actions`, `ring_flows`, `weapon_schools`, `graphics/fonts` | 8–8.5 | 0 | `what` in every file | one README per kind |
| `equipment/armour`, `graphics/hud` | 7 | 0 / 7 | `"text_2": { "same_as": … }` unexplained; hud's `what` one long string | name the field; README |
| `maps/tiles`, `palettes/backgrounds`, `alchemy/alchemy_levels` | 7 | 0 | numbered names (6,690 `tile_xxxx`, 365 `palette_xxx`) | names by use, where known |
| `scripts/global` | 6.5 | 0 | 223 of 522 `global_NN` | name by what they do |
| `sprites/blocks_8`, `_16`, `metasprites` | 7.5 | 0 | blocks numbered (`block_xxxx`); metasprites owner-attributed | step 5b (`$C7–$C9` scripts) for relocation |
| `strings` | 6 | 0 | 3,002 `string_xxxx`; `$C4` names not here | step 3 |
| `alchemy/formulas`, `alchemy/ingredients` | 6 | 105 | `target: "$2010"`, `level: "$7E:2F98"`, `bit: "$0001"`; `held: "ING_QTY_GREASE+11"` (a cell named off another item) | target enum, flag bits, step 6 |
| `menus/ring_items`, `menus/rings` | 7.5 | 18 | `icon` and `palette` named (v0.464.0); `flags: "$000A"`, `$C4` names capped | flag names, step 3 |
| `music/sounds` | 6 | 0 | only `{ sfx, package }` | — |
| `equipment/weapons`, `bazooka_ammo` | 7.5 | 0 | all 9 animation slots, `unknown_1a`/`1c`, and `palette` named (v0.464.0); `skill: "WEAPON_SKILL_FIST+16"` | step 6 |
| `characters/projectiles` | 7.5 | 32 | `animation` and `palette` named (v0.464.0); `projectile_NN`, `unknown_04`/`06`, `what` per file | README |
| `characters/records` | 8 | 142 | single `<name>.json` per character with named `palette`/`palette2` and 12 `animations` (v0.464.0); `name: "$C4705A"` | step 3 |
| `music/packages` | 4 | 3,754 | 2,650 opaque `data_N.bin`; `to` is ARAM (the sound CPU's RAM), legitimate | decode sequences and samples; named ARAM regions |
| `animations/groups`, `animate_ids` | 8.5 | 0 | all 783 groups (`facing_mode` + compass `facings` + programmatic palettes) and 212 `animate_ids` named (v0.464.0) | `$C7–$C9` animation scripts kind |

Overall ~6.5: maps and scripts are near the product, everything that points into `$C4`, palettes or animations is
still a lab dump. Steps 3–5 fix ~20k of the ~24k addresses left.

Other gaps against R2/R3, found on the way:

- A pickup stages its object as a number (`write_word_const MAP_REF, 9`): the value is the room's object `sniff_01`
  and should be written so (a parameter type for the `LOOT_OBJECT` cell, `operands.mts`).
- Animation channels are positions (`anim3` in metatiles.json): name them in animations.json and write the name.
- A script reached from several rooms names objects of the room whose folder holds it (the first to reach it).
- 376 JSON files carry a `what`: field docs belong in one README per kind (review §3), not in data files.
- explode's closing "Next:" line prints `--out` relative to the repository (`../../../../../private/tmp/…`): print it absolute.
- [tool.md](tool.md)'s status line still says "built for maps, tile families, tiles, strings and scripts".

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
| 4 *(built, v0.464.0)* | Sprite palettes (`palettes/sprites/`, 269 entries at `$90:A7EB-$C98A`) | R2 for characters, items, equipment, projectiles |
| 5a *(built, v0.464.0)* | Animation groups (`animations/groups/`, all 783 groups + facing modes + programmatic palettes); single-file `characters/records/<name>.json` (`animations.json` dumps removed); `sprites/{blocks_16,blocks_8,metasprites}/` | R1, R2, R4 for characters & animations; adding groups (`vacate_c4`) |
| 5b | `$C7–$C9` animation script VM bytecode as a relocatable kind | relocatable metasprites & edited scripts |
| 6 | WRAM names for every remaining `$7E:` field ([wram.md](wram.md)) | R2 everywhere |
| 7 | Editor §5.1–5.3 | one look, one click |
| 8 | Growable in-place tables (ring items, item actions, weapons, formulas); ingredients, consumables, named items first: [../todo/growable-items.md](../todo/growable-items.md) | adding, not repurposing (review §4) |
