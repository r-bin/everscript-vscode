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
| string | `string_0afb` | `strings/dialogue/` | built for dialogue |
| menu text | `"strings/menu/rare_item"` | `strings/menu/` (texts) | built (v0.469.0): ring items, equipment, formulas, ingredients, named items; character names (`$C4705A`) still pointers |
| target | `"targets/enemies_nearest_three"` | `targets/` (rules of `$05AD`) | built (v0.469.0): formulas, consumables |
| sprite palette | `"boy_bone_crusher"`, `"ring_icon_04d"` | `palettes/sprites/` | built (v0.464.0; 269 bank `$90`/`$D0` palettes) |
| animation | `"boy/walk"`, `"dog/act2_leap"` (`animate.json` keys) | `animations/` (`animate.json` for ids) | built (v0.465.0: 783 animations with inline scripts + 212 `animate()` ids; no addresses) |
| WRAM | `wram/LEVEL_LOW_CURE` (typed, v0.469.0), `temp[n]` | `wram/` (v0.459.0, from names.json, the compiler and the WRAM map; region files v0.474.0) | built: scripts, records, rings name it through `wram/`; **unnamed cells stay `$7E:xxxx`**; moving: W2 ([wram.md](wram.md)) |
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
| `equipment/armour`, `graphics/hud` | 7 | 0 / 7 | `text_2` a text link since v0.469.0 (one empty text all 40 share; reader unknown); `slot` derived from code ranges (§7); hud's `what` one long string | armour slots kind (§7); README |
| `maps/tiles`, `palettes/backgrounds`, `alchemy/alchemy_levels` | 7 | 0 | numbered names (6,690 `tile_xxxx`, 365 `palette_xxx`) | names by use, where known |
| `scripts/global` | 6.5 | 0 | 223 of 522 `global_NN` | name by what they do |
| `sprites/blocks_8`, `_16`, `metasprites` | 7.5 | 0 | blocks grouped by owner but still numbered (`<owner>/<owner>_block_xxxx`); metasprites named by what plays them | step 5b (`$C7–$C9` scripts) for relocation |
| `strings` | 6 | 0 | 3,002 `string_xxxx`; `$C4` names not here | step 3 |
| `alchemy/formulas`, `alchemy/ingredients` | 7 | 70 | targets by name (v0.469.0); `bit: "$0001"`; `held: "wram/ING_QTY_GREASE+11"` (a cell named off another item) | flag bits, step 6 |
| `menus/ring_items`, `menus/rings` | 7.5 | 18 | `icon` and `palette` named (v0.464.0); `flags: "$000A"`, `$C4` names capped | flag names, step 3 |
| `music/sounds` | 6 | 0 | only `{ sfx, package }`: a driver effect number and its (derived) package, nothing says what it sounds like | §7: driver effects by name |
| `equipment/weapons`, `bazooka_ammo` | 8 | 0 | all 11 animation slots named, `idle`/`idle_rare` decoded (v0.470.0); `skill: "WEAPON_SKILL_FIST+16"` | step 6 |
| `characters/projectiles` | 8.5 | 0 | named by what throws them, field docs in one README (v0.470.0); `unknown_04`/`06` (no reader seen) | — |
| `characters/records` | 8 | 142 | single `<name>.json` per character with named `palette`/`palette2` and 12 `animations` (v0.464.0); `name: "$C4705A"` | step 3 |
| `music/packages` | 4 | 3,754 | 2,650 opaque `data_N.bin`; `to` is ARAM (the sound CPU's RAM), legitimate but unnamed | §7: an ARAM map, then decode |
| `animations` | 9 | 0 | 783 animations with `facing_mode`, inline symbolic scripts and programmatic palettes; `animate.json` (v0.465.0) | name unnamed frames by pose |

Overall ~6.5: maps and scripts are near the product, everything that points into `$C4`, palettes or animations is
still a lab dump. Steps 3–5 fix ~20k of the ~24k addresses left.

Other gaps against R2/R3, found on the way:

- A pickup stages its object as a number (`write_word_const MAP_REF, 9`): the value is the room's object `sniff_01`
  and should be written so (a parameter type for the `LOOT_OBJECT` cell, `operands.mts`).
- Animation channels are positions (`anim3` in metatiles.json): name them in animations.json and write the name.
- A script reached from several rooms names objects of the room whose folder holds it (the first to reach it).
- 376 JSON files carry a `what`: field docs belong in one README per kind (review §3), not in data files.
- explode's closing "Next:" line prints `--out` relative to the repository (`../../../../../private/tmp/…`): print it absolute.

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
| 3 *(texts built, v0.469.0)* | `$C4` names and UI text as a strings kind (movable, any length: needs free `$C4`; character names still pointers) | names of characters, items, weapons, formulas (review §9.2) |
| 4 *(built, v0.464.0)* | Sprite palettes (`palettes/sprites/`, 269 entries at `$90:A7EB-$C98A`) | R2 for characters, items, equipment, projectiles |
| 5a *(built, v0.464.0, unified v0.465.0)* | Animations (`animations/<owner>/<name>.json`, all 783 + facing modes + programmatic palettes + inline scripts, `animate.json`); single-file `characters/records/<name>.json` (`animations.json` dumps removed); `sprites/{blocks_16,blocks_8,metasprites}/` | R1, R2, R4 for characters & animations; adding groups (`vacate_c4`) |
| 5b *(built, v0.465.0)* | `$C7–$C9` animation scripts inline in `animations/` (relocatable, symbolic) | relocatable metasprites & edited scripts |
| 6 | WRAM names for every remaining `$7E:` field ([wram.md](wram.md)) | R2 everywhere |
| 7 | Editor §5.1–5.3 | one look, one click |
| 7b | Tool speed and CLI ([optimizing.md](optimizing.md): U1, P1-P5 first) | an implode in seconds, the editor's one click |
| 8 | Growable in-place tables (ring items, item actions, weapons, formulas); ingredients, consumables, named items first: [../todo/growable-items.md](../todo/growable-items.md) | adding, not repurposing (review §4) |

## 7. Owner's review, 2026-11-25: answers and what is next

Built in v0.470.0: projectile names, weapon idle animations, ring icons as previews only, `characters/experience/`
([progress.md](progress.md) log). The rest, with what was found:

- **Known tables not exploded yet** (the Data tab's list, `src/games/evermore/data-tab/model/tables.ts`, against a fresh
  tree). Content a hack edits, in order of value: Dog growth curves (`$8C:9515`) beside `characters/experience/`; ~~Dog
  forms~~ (built v0.472.0, `characters/dog_forms/`; a 7th form: [extending.md](extending.md) §1); the alchemy effect programs (`$91:80A6`, bytecode: §3 there); weapon skill thresholds
  (`$C4:5B4A`, a weapon school's levels); Call Bead spell powers (`$C4:5F17`) and the script cast spells
  (`$C4:5F97`); the sfx distance curve (`$8C:84D4`); the dialogue dictionaries (`$91:F32E`, `$F3EC`, `$F46C`: the
  strings encoder's, a translation would change them). Engine constants stay in `_base/` (sine `$80:88A3`, the boomerang
  ellipse `$80:8923`, squares `$80:AA27`). Already kinds: XP, projectiles, armour, weapons, ammo, formulas, ingredients,
  consumables, ring icons, rooms, enter scripts, opcodes, behaviours, attack procs, sound ids.
- **Vigor's boomerang and `projectile()`**: yes, id 6 (`vigor_boomerang`) is in the script table, but a script launch
  runs `script_routine` (the straight flight), so it would not orbit; set `script_routine` to its `routine`
  ([resources.md](resources.md) §projectiles). Not tried in game.
- **Colour variants as groups** (planned): records that draw with the same animations, grouped by the owner folder of
  those animations: 25 families, 57 records (`flower_black`/`_orange`/`_purple`, `raptor_*`, `slime_*`, `rat_*`, `boy` and
  `boy_black`, `dog` and `dog_1_black`/`dog_4_black`, the two Thraxx fights' parts, `tinker`/`tinker_twin`, …). Layout as
  sprite blocks (v0.467.0): `characters/records/<family>/<name>.json`, names unchanged (scripts say `spawn flower_orange`),
  the family named by the shared prefix (`flower/`), its animations' owner folder renamed the same. Needs the records
  codec's paths, the Rooms tab's tree reader and the animation owner rule. Also open there: records still write animations
  bare (`bee/stand`, not `animations/bee/stand`) and `name` as `$C4…` (step 3).
- **Armour `slot`**: code, not data (id ranges in `$8E:9DAE`, equipped words `$0AC0`-`$0AC4`, `$0ABE`); a new type is an
  `armour_slots` kind plus a ring, a ring flow entry, a saved equipped word (W2) and the defence sum taught it
  ([resources.md](resources.md) §equipment). After W2.
- **Weapon schools**: weapons already link theirs (`"school": "equipment/weapon_schools/axe"`); a school is what the
  skill screen draws and whether the quarter-attack bonus applies.
- **ARAM** (`"to": "$206C"`): yes, those are sound-CPU addresses. Named regions need an `aram` knowledge space like
  `wram/` (the driver at `$0700`, its tables: songs `$2EB8`, instruments `$2124`; the small transfers every package makes
  around `$1F38`-`$21FF` (role not decoded); the large ones higher up (`$678E`-`$BE5E` in one package); the echo buffer `$D400-$FBFF`; `$2400-$3ABF` unused
  everywhere: [../todo/audio-and-music.md](../todo/audio-and-music.md), the SPC dumper notes). Then a transfer names its
  target (`"to": "aram/INSTRUMENT_TABLE+12"`) and the pieces get roles (sequence, instrument, sample).
- **Sounds** (`{ "sfx": 15, "package": "sound_base" }`): `sfx` is the sound driver's effect number (the script id → effect
  table `$8C:8362`), `package` derived (`$81:9A1E`). To read: a `music/effects/` kind naming the driver's effects (and
  what loads each), so a sound says `"effect": "music/effects/explosion"`; `package` is then the effect's. Names from
  listening (the Music tab plays effects).
- **Weapon `description`, armour `text_2`**: text links since v0.469.0 (`strings/menu/…`); the `out/open-evermore` tree
  the review read was exploded with v0.467.0: re-explode (`--force`).
- **Open naming debt found on the way**: routines still named for the Dog though they serve the Boy's idle
  (`dog_forage_random_timer_reset`, `animation_script_reset_dog_forage_timer`; bound C uses the first), to rename with
  their C file.

