# Open Evermore: the resource kinds

Status: **design 2026-11-18; the kinds marked *(built)* exist** ([progress.md](progress.md)). Back to [README.md](README.md). Labels as there.

Every kind gets the same description. **Folder**: what lives where. **References**: which names it uses, and who
uses its names. **Implode generates**: the tables and counts it writes from the folder. **Limits**: what implode
checks. **Codec**: the decoder and encoder in the repo it reuses (never copies, AGENTS.md §0.9). Counts and
addresses are US 1.0 *(repo)*.

The migration order is in [progress.md](progress.md); maps came first.

---

## _base — everything not yet exploded

**Folder.** `_base/unexploded.bin` + `_base/_base.json` *(built: `base.mts`)*.

- Not a resource: the ROM with every exploded resource (the *pool*) and every generated table blanked to `$FF`,
  pinned where it is. `_base.json` lists the pool and table ranges, each resource's home (address, length,
  sha1) and each enum's sha1, so implode knows what changed.
- **Not split into banks or regions**: a piece of `_base/` would be a resource nothing references by name, which
  the hard rule forbids ([README.md](README.md) §1). Each step explodes one kind out of it.
- **Limits.** An edited `_base/unexploded.bin` is an error (`base-changed`): change a resource through its kind.

## header

See [manifest.md](manifest.md) §2. `header.json` at the root. Referenced by nothing; references code names
(vectors) and the manifest.

## tables — engine tables without an owner yet

**Folder.** `tables/<table>.json`, one per table the VFS lists *(repo: 168 in `soe://rom/assets/tables/`, each
with `data.json`; decoder `src/platform/cdl/table-assets.ts`)*. Same JSON as the VFS `data.json`, keyed by the table's name.

- A table moves into a kind once that kind owns it (the song table belongs to `music`, the map table to `maps`).
  `tables/` holds only the rest.
- **Implode generates**: the table bytes from the JSON, at the table's vanilla address.
- **Limits.** Each entry's value range, from the table's description (`invalid-value`). A count that disagrees
  with a count byte elsewhere is an error.

## palettes — background palettes *(built, S2; named palettes v0.458.0; moved to `palettes/` v0.464.0)*

What the room format calls a *tile family* is one 16-colour palette; up to 7 a room's set, loaded into BG palettes
1–7. v0.458.0 calls them what they are (owner: "I can't see the palettes"): the folder was `maps/tile_families/`, then
`maps/palettes/`, and now lives at `palettes/backgrounds/` beside shared sprite palettes (`palettes/sprites/`).

**Folder.** `palettes/backgrounds/_enum.json` + one file per palette, by default `<palette>.json`:

```jsonc
{ "format": "open-evermore/palette", "version": 1,
  "colours": ["#000000", "#f8f8f8", …],            // 16 colours; each channel a multiple of 8 (5 bits on the SNES)
  "maps": ["antiqua_pyramid_outside", …] }         // derived: the maps that use it; implode ignores it
```

`explode --palettes png` writes `<palette>.png` instead: a 128×8 stripe of 16 solid 8×8 cells, colour 0 on the left
(owner, 2026-11-19: easier to see; JSON stays the default because it carries more). The choice is kept in
`manifest.json` `options`, so the round trip writes the same form. Implode reads either; a palette that is both is
`duplicate-name`; a cell that is not one opaque colour, or a stripe of another size, is `invalid-value`.

- **Names.** `palette_<id>` (`palette_024`): the repo has no names for them ("a ROM id tied to an area",
  room-reference.md §5). Better names are an open question ([README.md](README.md) §9); `maps` is there to help.
- **References.** Used by maps: `map.json` `"palettes": ["palette_024", …]` (`unknown-reference` when missing), and
  every layer word in `metatiles.json` names the palette it draws with (`tile_026d palette_01c`, §maps). Uses nothing.
- **Implode generates** one placeable item, the array (palette *n* at base + 32·*n*, in enum order), and the
  two operands of the loader `$90:D05C` that hold its address: `adc #$C322` and `lda #$9C`. They are the only
  readers *(repo: the table hack moved the array the same way)*.
- **Placement.** Upper half (the `$80–$BF` form), never across a bank; at most 1024 palettes (32 KiB).
  The array sits between two rooms in bank `$9C`, so `--random` shuffles it with them (or into the 4th MB).
- **Proven (G1).** Seeds 1, 2, 99 moved it (`$9C:D25E`, `$9C:8000`, `$9C:8F3C`); the playbacks played identically
  and no WRAM byte points into it (knowledge `asset_9cc322_background_palettes_tile_families`).
- **Limits.** Exactly 16 colours, each `#rrggbb` with channels in steps of 8 (`invalid-value`); no gap in the ids
  (`id-gap`).

## sprite_palettes — shared sprite and icon palettes *(built, S2c, v0.464.0)*

All **269** 16-colour sprite and ring-icon palettes at `$90:A7EB–$C98A` (`0x10A7EB..0x10C98B`, 32 bytes each; mirror in
bank `$D0` at `$D0:A7EB`). Shared across characters, weapons, Bazooka ammo, Dog forms, projectiles, HUD portraits, ring
menu icons, and animation opcode `0x4B`.

**Folder.** `palettes/sprites/_enum.json` + `<name>.json` (`open-evermore/palette` colours + derived `used_by`) or
`<name>.png` with `--palettes png` (128×8 colour stripe, matching `palettes/backgrounds/`).

- **Names.** Named programmatically from their consumers (`boy_bone_crusher`, `boy_unarmed`, `dog_act1`, `fire_eyes`,
  `ring_icon_<id>`, `effect_<id>`, else `palette_<id>`).
- **References.** Referenced by `characters/records/`, `equipment/{weapons,bazooka_ammo}`, `characters/projectiles/`,
  `menus/ring_items/`, and `animations/` (derived attribution).
- **Placement.** Pinned to `$90:A7EB–$C98A` while bank-`$90`/`$D0` palette loaders (`$90:CF3A`, `$90:CFD2`, `$8E:AEBC`)
  remain in `_base/`; counts stay fixed at 269.

## collisions — collision forms *(built, v0.458.1)*

The 16 forms a cell's collision can take (which part of it is solid), named as the Rooms editor's Collision tab names
them. A metatile names its form (`"collision": "solid"`); its level and flags are its own fields (§maps). No bytes of
its own: the form is bits 3–0 of each collision word in a room's Block 3, which implode writes.

**Folder.** `maps/collisions/_enum.json` (names[code]: the form's code, 0–15) + `<name>.json`, all for the reader:

```jsonc
{ "format": "open-evermore/collision", "version": 1,
  "what": "The SW triangle is solid; you slide along it (three compass points open, a slide entry) — unconfirmed in game.",
  "shape": ["#...............", "##..............", …],     // 16×16, # solid ($909DE8, maps/collision.ts geometryMask)
  "metatiles": 659, "maps": ["antiqua_…", …] }               // how often vanilla uses it, where
```

- **Names.** `open`, `solid`, `top_half`, `bottom_half`, `left_half`, `right_half`, and `diagonal_<corner>_slides` /
  `diagonal_<corner>_stops` for the twins that share a triangle (the engine's tables `$8FA3F8` / `$8FA418`: three
  compass points open and a slide entry, or one point and none; unconfirmed in game). `top_half_unused` (0xB) and
  `bottom_half_unused` (0x4) are open in both tables and in no vanilla room.
- **Renaming** a form (its `_enum.json` entry and its file) renames it in every room; the G0 test renames `solid` to
  `wall` and gets the vanilla ROM. Without the kind (`--kinds`) a metatile's form is read by these default names.

## strings *(built, S4; `strings/dialogue/` v0.469.0)*

**Folder.** `strings/dialogue/_enum.json`, `_strings.json` and one `<string>.txt` per string, UTF-8 (the menus' plain
texts are the texts kind beside it, `strings/menu/`):

```
[SLOW]Whoa![PAUSE:3d] Now I know how `Dandy' Don Carlisle felt in `Sink, Boat, Sink!'[B]I think …
```

- **Text form** (lossless, ours): a line break is a line break; control bytes are tags (`[BOY]`, `[DOG]`, `[B]`, `[PAGE]`,
  `[PAUSE:3d]` for `$80 nn $80`, `[CHOICE_INLINE]`, `[SLOW]`, …); the font's special glyphs are `…` `‘` `’` `→` `←`;
  `[` is `[[`; any other byte `[0xNN]`. The repo's everscript form writes `$60` and `$7B` both as a backtick, so
  it is not used here. The file ends with one line break that is not part of the string.
- **Names.** `string_<hexid>` (`string_0375`), numbers for now. Scripts name a string by its key, id·3, so the enum's
  order is what they see.
- **`_strings.json`**: `plain` lists the 144 strings stored uncompressed (they stay so); `encoded` keeps the vanilla
  bytes of the 2,157 compressed strings our encoder does not reproduce, used while they still give their text
  (`reencoded`, info, once they do not).
- **Implode generates** the key table, in enum order: in place at `$91:D000` while the ids fit it (data follows
  it), else elsewhere in one bank, with the bank and offset immediates of both readers (`$8C:CCF5`, `$8C:CD35`:
  `lda #$0091`, `ldy #$D000`, then `lda [$26],y` with the key at `$26`) rewritten. An entry is the address in a
  lower half (15 bits), the bank above `$C0` (8 bits), and bit 23 = compressed (asm `$8C:CD33`).
- **Placement.** A string starts in a bank's lower half, in the first 4 MiB, and never crosses a bank (rules
  `lowerHalf`, `below`, `noCrossBank`). Vanilla fills `$C0–$C3`.
- **Encoding.** Compressed strings use the tables in bank `$91` (single characters, pairs, words, phrases; they stay
  in `_base/`). Our encoder takes the fewest bytes (dynamic programming over every token); vanilla's choices are
  neither greedy nor fewest-bytes (ours is shorter for 1,001 strings), so its rule is open.
- **Proven (G1).** Seeds 1 and 99: 2,954 strings moved, both playbacks in step; nothing points into the strings but
  the key table (a scan found no code operand doing so; the text pointers in WRAM, `$22–$24` and neighbours,
  translate).
- **Limits.** Characters of the text form (`invalid-value`, with the reason); no 0 inside a string; 21,845 ids (a key is
  id·3, added to the table's offset in one bank; the table-hack page's 10,900 assumed it stays in an upper half).
  A new string is shown in game (`tests/open-evermore/in-game.test.mts`).

## music and sounds *(built, 2026-11-20)*

**Folder.**

```
music/packages/_enum.json                 names[package id]: 0 the base (driver data, most sound effects), 1–70 the songs
music/packages/<package>/package.json       the transfers the driver's upload makes, in order: { "data", "to": "$1F38" }
                                   (+ "offset", "length" for part of a piece); for the reader the music ids and
                                   driver sound effects that load the package
music/packages/<package>/data_<n>.bin       the bytes those transfers copy (sequences, instruments, samples: raw)
music/sounds/<name>.json                 a script sound id (opcode 0x30, animation opcode 0x2E): { "sfx": <driver effect> }
music/sounds/_enum.json                 names[script sound id]
```

- **Names.** Packages by our music names (`localizations/sounds.ts`: package p plays music p − 1), the base
  `sound_base`; sounds by its sound names (ids 2·id); data `data_<n>` in order of first use. A piece several packages
  load lives in the first one's folder; the others name it `<package>/data_<n>`. Overlapping reads are one piece
  (6 in vanilla): a transfer then says `offset` and `length`.
- **Implode generates** every package's descriptor (`[count][length, source:24, spc address] …`, a generated item
  read on through upper halves) and the package pointers at `$81:9903` (in place); the sound id table at `$8C:8362`
  (in place). The data move anywhere: in a window of upper halves, or for the 11 pieces vanilla reads inside a
  lower half, within one bank.
- **Placement keeps vanilla's cycles.** The upload is paced by the SPC700, but a bank turn in its byte loop costs
  cycles: the 22 pieces that cross a bank keep their offset in it, the rest never cross, and **no piece or descriptor
  ends on a bank's last byte** (`Rule.noBankEnd`: the copy's `iny` would turn the bank after it; routines
  `spc700_ipl_bootloader_handshake_block_upload`). Items held to an offset are placed first (`layout.mts`).
- **Proven (G1).** Music alone: seeds 1, 2, 3, 7 (2,721 resources moved each); with every kind: progress.md §2.
- **Limits.** 71 packages: the tables after the pointers (`$81:99D8` music → package, `$81:9A1E` driver sound →
  package) are found from the count (`$8C:82A8`), so the count and those tables stay (`_base/`); 112 sound ids.
- **Next.** Decode the pieces (sample directory entries, BRR samples, sequences, instruments) so a package reads as
  instruments and a song; name pieces by role; let packages grow once the three tables move together.

## tiles — the 16×16 map graphics *(built, S3)*

**Folder.** `maps/tiles/_enum.json` + one file per tile, by default `<tile>.png` (owner, 2026-11-19): an **indexed** PNG,
16×16, 16 palette entries, index 0 transparent. The indices are the tile; the palette only shows it (the family
vanilla draws the tile with most, from every room's metatile words), so an editor can repaint it but must save it
indexed (an RGB PNG is `invalid-value`). `explode --tiles json` writes `<tile>.json` instead:

```jsonc
{ "format": "open-evermore/tile", "version": 1,
  "pixels": ["55555555eeee2e2f", …] }              // 16 rows of 16 palette indices, one hex digit each
```

`tiles/_encoded.json` keeps the vanilla bytes of the six tiles our encoder does not reproduce
(`{ "tile_1669": { "encoded": "4290…", "followedBy": "tile_1668" } }`). Either form may be mixed in one tree; the
round trip compares the indices, not the file.

- **Names.** `tile_<hexid>` (`tile_1669`), numbers until there are names (owner, 2026-11-19). The user's example
  `floor_sand_01` comes from renaming; naming 6,688 tiles is work for a tool (group by the rooms and families that
  use them, propose names, let the user accept).
- **References.** Used by maps: the graphics list and the animation frames, by name (`unknown-reference`). Uses
  nothing. The maps kind marks every tile it uses (`used`) and every animation frame (`dma`).
- **Implode generates** the pointer table, in enum order: in place at `$EE0000` while the ids fit it, else
  elsewhere in one bank, with its six reader operands (`$8C:C898`/`C8A1`, `$90:A16A`/`A170`, `$90:A237`/`A23D`)
  rewritten. Census 2026-11-20: every long operand into `$EE0000–$EE0004` in the ROM is one of these or recorded
  as data by the vanilla CDL; no immediate builds an `$EE` pointer. The pointer takes the `$80–$BF` form in an upper half, `$C0–$FF`
  in a lower half, as vanilla does.
- **Encoding.** `encodeTile` *(repo: chr.ts)* gives back 6,682 vanilla tiles byte for byte; an animation frame is
  64 raw words (the streamer DMAs it). The six in the bit-6 form keep `encoded`
  ([../map-format/map_tile_graphics_decompression.md](../map-format/map_tile_graphics_decompression.md) §4.1); two
  of them (run form) are fetched three bytes past their end, so implode places each with the tile after it as one
  item while both still give their pixels. A changed tile is encoded anew (`reencoded`, info).
- **Placement.** Anywhere, never across a bank, and ending on a bank's last byte only where vanilla's did (13
  tiles; `Rule.noBankEnd`, as music's). Vanilla scatters them over ~80 banks in the gaps other data leaves; `--random` shuffles them among their neighbours and into the 4th MB.
- **Limits.** 16 rows of 16 hex digits (`invalid-value`); 21,845 ids (the readers index the table with id·3 in
  16 bits); a room's graphics list ≤ 264 slots is a map limit.
- **Logic warnings.** A tile no map uses (`unreferenced`; vanilla uses all 6,688). *(Proposal: identical pixels.)*
- **Proven (G1).** Seeds 1, 2, 99 (≈6,660 tiles moved each, 4 MiB): both playbacks in step, VRAM identical at
  every check. Moving tiles shifts room-load timing (drifts back in step within 17 frames); seed 7 lost a lag frame
  and never came back (progress.md §2).

## maps — rooms *(built, S1)*

**Folder.** One folder per room, one concern per file; nothing of another kind lives in it (owner, 2026-11-22: a
room *references* its scripts, as it references its tiles and families):

```
maps/rooms/_enum.json                    names[id]: the map table's order (README.md §4); up to 256 ids
maps/rooms/<map>/map.json                  header, palettes, graphics
maps/rooms/<map>/scripts.json              the scripts the room runs: enter, step-on and B triggers (names of scripts/)
maps/rooms/<map>/animations.json           animated tiles (Section 2) and palette cycles
maps/rooms/<map>/grass.json                cuttable grass (Section 4)
maps/rooms/<map>/grid.txt                  the cells: one row per line, each cell its metatile id in hex
maps/rooms/<map>/metatiles.json            what each metatile draws (front, back) and how it collides
maps/rooms/<map>/objects.json              each object by name: its states, where, which cells, how long each is held
maps/rooms/<map>/preview.png               only with `explode --previews`: the room drawn, for the reader; implode ignores it
```

`map.json` (version 8, v0.458.0; the files are `src/games/evermore/maps/tree-map.ts`, which the Rooms tab reads too):

```jsonc
{
  "format": "open-evermore/map", "version": 7,
  "header": { "triggerOrigin": [17, 11], "mainScreen": 23, "subScreen": 0, "colourMath": 0, "colourWindow": 2,
              "effect": 2, "cameraFlags": 0, "reserved": 0 },  // room-reference.md §4; width and height come from grid.txt
  "palettes": ["palette_020", …],                  // names in palettes/; BG palettes 1-7 are the first seven
  "graphics": { "compression": "lzss", "tiles": ["tile_0d7b", …] }    // Block 1, names in tiles/
}
```

`scripts.json`: what runs when, every script by its full name (`scripts/rooms/<map>/<name>.txt`, §scripts):

```jsonc
{ "format": "open-evermore/room-scripts", "version": 1,
  "enter": "antiqua_desert_of_doom/enter",   // the enter-script record's script; null: none (Brian's room)
  "enterWord": 1,                            // the word after its pointer, when not 0 (the room loader never reads it)
  "stepOn": [
    { "name": "door_01", "from": [64, 16], "to": [68, 18], "script": "antiqua_desert_of_doom/door_01" }   // cells [x, y]
  ],
  "bTrigger": [ { "name": "sniff_01", … } ] }
```

`animations.json`: `{ "tiles": [{ "countdown": 0, "frames": [{ "ticks": 8, "tile": "tile_0a40" }, …] }, …],
"paletteCycles": [{ "start": 27, "colours": 4, "rate": 5 }] }` (a channel per entry, `anim<n>` in metatiles.json; a
cycle: CGRAM colour, how many, frames per step, signed). `grass.json`: `{ "list": [{ "cut": "000", "into": ["507"] }, …] }`.

- **Names of a room's entries** (`room-names.mts`). A trigger is `<what>_<nn>`, counted per room over the step-on then
  the B triggers, by what its script does with everything it calls (script-model `roleOf`): `door` (changes the map),
  `sniff` (the sniff spot's loot driver), `loot` (a gourd's or chest's driver, or a staged reward), `scene` (text,
  animations), `unknown`. The room's script is named after the first trigger that runs it, so `door_01` the trigger,
  `<map>/door_01` its script and, below, `door_01` the object it opens are one thing. An object takes the name of the
  first trigger whose script (or a script of the room it calls) names it or stages it as the pickup's object
  (`LOOT_OBJECT`); `_2`, `_3` for more objects of one trigger; `unknown_<nn>` for objects no trigger touches. Names
  are optional and unique per file (`duplicate-name`); the round trip ignores them (they say what, not which bytes).

`grid.txt`, one row per line (`048 048 049 …`), and `metatiles.json`, one metatile per line:

```jsonc
{ "format": "open-evermore/metatiles", "version": 4, "compression": "lzss",
  "list": [
    { "id": "000", "front": { "tile": "tile_026d", "palette": "palette_021", "over": true, "flipV": true }, "back": { "tile": "tile_02ac" }, "collision": "solid", "inFront": true },
    { "id": "1a4", "front": { … }, "back": { … }, "alwaysWalkable": "drift_sw", "level": 2, "stepOn": true }, …
  ] }
```

`objects.json`, one object per line, by name (the room's scripts write `object sniff_03, 1`): a named object may
move in the list, its scripts follow; one with `id` instead of a name is reached by its position (`object_<n>`):

```jsonc
{ "format": "open-evermore/objects", "version": 1,
  "list": [
    { "name": "sniff_03", "holds": [1], "states": [{ "at": [39, 63], "cells": ["53d 53e", "53f 540"] }] }, …
  ] }
```

- **A state** is how its cells look once reached (state 1 is `states[0]`; state 0 is grid.txt): a rectangle at
  `at` (cells), one row per string, `.` for a cell it leaves alone. The cells are the object's own steps applied in
  order to grid.txt (other objects at state 0); implode turns them back into the XOR deltas the engine applies, so an
  edited grid.txt keeps each object's look. `holds[s]`: ticks state *s* stays up while a script steps through it
  (the first is never read). `^<4 hex>` is a delta written as is: a cell off the grid (room `0x6E`, 3 stamps).
- **Layout** is vanilla's: all records, then all stamps, in order (127 of 127 rooms rebuild byte for byte).
- **Cuttable grass** (`grass.json`): `cut` is a metatile the Boy cuts, `into` what is stamped in its place; `steps` if
  not 1. The source count Section 4 starts with (also the grid's first Markov counter) is the number of distinct
  `cut`s, as in all 7 vanilla rooms; `sources` overrides it. `#<4 hex>` is a word that is no metatile.

- **Layers** (`front` = BG1, drawn over `back` = BG2; front holds tree tops, shadows, building details, whatever covers
  the ground): `{ tile, palette?, over?, flipH?, flipV? }`, only `tile` required (owner 2026-11-22: no meaning packed
  into strings). `over` is the BG priority bit (13): the layer is drawn over the sprites (a roof edge the Boy walks
  behind); `flipH` (14), `flipV` (15); each only when set. `palette` left out is BG palette 1, the list's first. The
  tile is a name from `graphics.tiles` (`tile_10ee#2` for its second occurrence), `anim<n>` for
  animation channel *n*'s slot, or `chr<3 hex>` for a character no slot names (82 vanilla words use `$3F0–$3FF`). The
  palette is a name from `map.json` `palettes` (BG palette *n* is entry *n*−1; `#2` for a palette listed twice in the
  first seven), or `p<n>` for one the list does not name (`p0`, the HUD's). A room with more than 7 palettes (22 rooms)
  holds several sets that a script switches (`MAP_PALETTE`): the name is the first set's palette in that slot.
- **Collision** ([../map-format/room-reference.md](../map-format/room-reference.md) §9), as the Rooms editor splits
  it: `collision`, the form (a name of `maps/collisions/`, §collisions), or `alwaysWalkable` instead when bit 13 is
  set (bits 3–0 then say how the cell moves you: `stairs_vertical`, `stairs_diagonal_l` / `_r`, `drift_n` …
  `drift_sw`, `walkable`, `walkable_3`/`_5`/`_6`/`_7`); `level` 0–3, left out when 1 (91 % of vanilla metatiles). Then only what is set: `seeThrough` (bit 6),
  `gate` (bits 11–8: `blocks_boy_and_dog`, `blocks_dog`, `blocks_others`, `deflect` (the editor's unconfirmed
  reading), `hides_character`, else `gate_<hex>`), `inFront` (12: the character here is drawn in front of the front layer), `stepOn` (14),
  `interact` (15: B runs a B trigger), `bit7` (never in vanilla). A flag written `false` is the same as left out.
- `id` is the entry's position, written for the reader (`invalid-value` if it disagrees). Flags may come in any
  order and grid ids without padding: the round trip compares what they mean.
- **Compression** is noted, not stored: `lzss` is our `lzssCompressVanilla`, which gives back 237 of the 241 vanilla
  LZSS blocks ([../map-format/lzss-vanilla.md](../map-format/lzss-vanilla.md)); the grid is always Markov (all 127
  reproduced). The four other blocks (Block 3 of `0x0A`, `0x16`, `0x2D`, `0x67`) carry `"packed"`, their vanilla
  bytes, used while they still unpack to the data (`repacked`, info, once they do not). `none` stores a block raw.

**Readability, rated (owner asked, 2026-11-19).** Version 4 (one `map.json`): about **2/5**. Named: families,
graphics, animations (4/5). Triggers in `[y1, x1, y2, x2]` with script numbers (3/5). A grid of unaligned numbers
(2/5). Header, palette cycles and metatiles as hex words (1/5). Objects and cuttable grass as base64 (0/5).
Version 5: about **3.5/5**. Named header and palette cycles, `from`/`to` triggers, an aligned `grid.txt`, metatiles
in words, and a preview (4–5/5). Version 6 (2026-11-19): objects and cuttable grass decoded, in metatile ids like
the grid (0/5 → 4/5). 2026-11-20 (v0.446.0): triggers and the enter script name their scripts, which live in the
room's `scripts/` folder (owner: no central `_enter_scripts.json`). Version 7 (v0.457.0): one concern per file,
scripts moved out to `scripts/rooms/<map>/` and referenced from `scripts.json`, triggers and objects named by what they
do, previews optional. Version 8 (v0.458.0): layer words name their palette (`tile_026d palette_01c`, was `p2`), and
a collision is its form by name (`"collision": "solid"`, the 16 forms in `maps/collisions/`) beside its level and
flags as fields (`"level": 1, "inFront": true`; was `"gf z1 front"`). Still open: a grid of names rather than ids, animation channels by name in metatiles.json.

- **Names.** From `localizations/data/rooms.json` *(repo, our own wording)*: region + place + part in snake case
  (`prehistoria_jungle_south_where_the_game_starts`); `map_<hexid>` for a room it does not name.
- **Implode generates** both id-indexed tables, in the enum's order: the map table (per id [24-bit pointer, pad 0],
  read by `lda.l` at `$90:8F69` / `$90:8F6F`) and the enter-script table (per id [packed pointer, word], read by
  `lda.l` at `$8C:CECC` / `$8C:CED2`, which read bytes 0–2 only) *(repo: `tools/table-hack/tables.js`)*. Each is a
  generated item: in place while the ids fit it (vanilla's 127; byte for byte, G0), placed like any item once a map
  is added (the enter table's vanilla footprint ends 2 bytes early: its last word lies on the script pointer
  table), and the four reader operands are rewritten to wherever it landed. Explode finds both through those
  operands. The blob pointer is the `$80–$BF:8000+` form.
- **Enter script.** `scripts.json` `enter`: the script, and `enterWord` the word after its pointer (the room loader
  does not read it; vanilla holds 0–4). `null`: none (packed 0, as Brian's room). Copying a map's look over another's
  means its map files with the target's `enter` kept: Brian's map in `podunk_opening_over_the_machine` boots
  under the intro's fade-in (tested); with Brian's own (none) the screen stays black.
- **Placement.** Upper half of a bank, never across a bank, ≤ 32 KiB *(repo: `writeRoomAt`)*. The vanilla rooms
  fill `$9C–$AD` upper halves to within a few hundred bytes per bank (other data follows each bank's last room).
  `--random` grows the image to 4 MiB: rooms shuffle inside their bank or move to the 4th MB; a stable build grows
  only when an edited room no longer fits (`grown`, info).
- **Proven (G1).** Seeds 42, 7, 123456, 99 moved 112–122 rooms; the stored playbacks played identically. The
  engine keeps six long pointers into the current blob (`knowledge/wram/DIRECT_PAGE_BLOCK.md`), all translated.
- **Limits.** Every field's range (`invalid-value`); blob ≤ 32 KiB (`over-budget`); 256 ids (the enter-script
  lookup's 8×8 multiply). A new map gets the next id: **proven in game** for `0x7F`, a copy of Brian's room
  entered by `load_map(0x7F, …)` (`tests/open-evermore/in-game.test.mts`, G2).
- **Still numbers:** script ids point into `_base/` until S6.
- **The Rooms tab reads trees.** A workspace folder holding a tree (or one up to two levels below) gets an *Open
  Evermore* rail group: its maps by name, built from their files into a copy of an Evermore image
  (`src/games/evermore/imports/tree/`), drawn and edited like a ROM room; a file edit shows when the map is opened
  again. Saving back into the tree is not done yet ([tool.md](tool.md) §5).
- **Logic warnings** *(proposal; checked against vanilla first)*: a trigger outside the map; a door to an entrance
  that does not exist; an unused family slot; the Boy's start on a solid cell.

## scripts *(built, S6, 2026-11-20)*

**Folder.** One file per script; one script is one entry of the Scripts tab (a room's enter script, a step-on or
B trigger, a global) or a script those call. Scripts are their own kind in their own folder, never inside a map's
(owner, 2026-11-22, replacing 2026-11-20's room `scripts/` folders): a room's scripts are `<map>/<name>`, named after
the first trigger that runs them (`door_01`, `sniff_02`: §maps, names of a room's entries), `enter`, and
`<root>_sub_<n>` for what they call first. A script belongs to the room whose trigger or enter record reaches it first
(table order). The rest (globals, the boot script and what they call first) in `scripts/global/`:

```
scripts/_enum.json               names[id]: the pointer table (trigger ids are byte offsets 3·id; globals from id 1,917)
scripts/_scripts.json            the boot script (header +$0C) and the groups (below)
scripts/global/<script>.txt      globals, the boot script and what they call
scripts/rooms/<map>/<name>.txt   the room's scripts (2,700 of 3,288); full name `<map>/<name>`, as scripts.json names them
```

A line is one command (format 2, v0.452.0): the opcode by its name in `opcodes/` (a hex byte works too), then its
operands separated by commas, one per operand token of the opcode (`script-vm/spec.ts`); another script as `@name`
(`@door_01` this room's, `@global_x` a global one, `@<map>/door_01` another room's, `@/name` the global one when this
room has one of that name too); a jump's target as a label; `label_<n>:` where a jump lands; `skip <n>`:

```
call_global @global_fade_in              call a global by name (its id is generated)
call @enter_sub_1                        call (absolute: the packed pointer is generated)
label_1:                                 a jump lands here
jump_if_false !IN_ANIMATION, label_1     an expression, then the label: the offset is generated
write_word ENEMY_SPAWNER_QUANTITY, 1     a save-area cell by its WRAM name, then the value
write_byte STORY_STATE, signed (Byte)STORY_STATE + 1
damage dog, 10                           an entity (entities/), then an expression
text string_0afb                         a string (strings/), sound, animation, enemy, projectile by name too
animate dog, dog/act2_leap, once     an animation (a key of animations/animate.json), a mode (animations/modes/)
add_shop_item WATER, 30                  an item of the compiler's SHOP_ITEM enum
load_map 23, 40, 21                      numbers in decimal (0x… for ids and cells)
skip 7                                   7 bytes no command reaches: not this script's
```

- **Operands** (`operands.mts`). An expression in infix (`expressions.mts`, the Scripts tab's notation): a save-area
  cell by its WRAM name or `<0x2391>`, the temp area `temp[n]`, the slot's bytes `arg[n]`, a flag by its name or
  `<0x2260, 0x10>` / `temp_flag[n, 0x10]` / `arg_flag[n, 0x10]`, `(Byte)` a byte read, `signed` a sign-extended one,
  `boy.hp` an entity's field (`deref(boy + 42)`), entities by their `entities/` names, functions (`random_below(3)`,
  `camera_on_dog()`). Exact by construction: a constant not in its shortest form says so (`5:byte`, `5:word`), a cell
  read from the other area says so (`save:` / `temp:`), negation is `-(x)`. A command's own cell or flag (write_word's
  cell, set_flag's bit) is written as an expression would name it. Values that name something are names: another kind's
  resource where the parameter's type says so (`parameters.json` `types`: `kind`, `scale`), an enum's constant (`enum`;
  flag enums stay numbers). `[85 23 04]` is an operand's bytes as they are, always valid. Explode writes the readable
  form only when it reads back to the same bytes: in vanilla every operand does (no `[…]`); 1,710 lines still show a
  cell without a WRAM name (`<0x22e5, 0x01>`). WRAM names are the Scripts tab's (names.json, the compiler's MEMORY and
  FLAG enums, knowledge entries); a name that means two things is not used.
- **Round trip** compares each command as its bytes (the operands read back), so a name and its number compare equal.

- **Names.** A table entry: the room trigger that uses it first (`<map>/door_01`, `<map>/sniff_02`), a global's name
  (`global_<name>`, `script-model/names.ts`), else `script_<id>`. An enter script `<map>/enter`, the boot script
  `boot`, a called one `<root>_sub_<n>` after the first table script, map or boot script that reaches it. A map
  names its enter script and its triggers' scripts in `scripts.json`. Every name and folder is the tree's: on a round
  trip, implode tells explode where each named script landed and which folder held it.
- **References.** `@name` replaces the operand of `07`, `29`, `af`, `b4` (a packed pointer, any script), of
  `a5`, `b2` (one byte back), `a6`, `b3` (a word back), and the id of `a3`, `b0` (a global: id − header word +8 / 3)
  and `a4`, `b1` (a trigger: 3·id), and of `attach_talk_script` (`3d`) and `attach_script` (`3f`), which hand an entity a
  script by its trigger offset; a number still works. Still numbers: window slots, music, sounds past the table.
- **More names** (v0.453.0). A room's script names that room's objects (its `objects.json` names since v0.457.0:
  `object sniff_03, 1`; `object_<n>` always means index n, also in a room whose map was replaced; global scripts keep numbers:
  their room is the one running), maps by their folder (`load_map 23, 40,
  <room>` with `:n` for an entrance), the character's own animations with bit 15 (`own.stand`, `own.death_with_drop`),
  flag enums as `A | B` (`SPAWNER | INACTIVE`), fonts (`font default`), a value written to or compared with a named cell
  by that cell's value names (`write_word PRIZE, HONEY`, `SAVE_SPOT == MADRONIUS_BROTHER`).
- **Jumps** (`04`, `05`, `08`–`0b`, `8e`, `8f`) name a label of their own script: a line may change length and the
  offsets follow. `goto_back` (`05`, one byte back) takes `goto`'s form when its label is out of its reach.
- **Groups.** Vanilla ties 141 groups of scripts (the largest 20 KB) by relative calls, which only reach backwards
  inside one item. `call_back` (`a5`, `a6`) does what `call` (`29`) does and `call_back_with_args` (`b2`, `b3`)
  what `call_with_args` (`af`) does (opcodes/a5.md): each ends in `29`'s code, so the absolute form is faster too.
  **Without `--strict` every relative call into another script is written absolute** (owner, 2026-11-21), so no
  script has to lie near another, and every script is placed alone (a few KB more, which no longer fits the full
  3 MiB image: it grows to 4 MiB). Jumps inside a script (loops, labels) and calls by global or trigger id keep
  their form, and the files never change: only the bytes implode writes. **`--strict`** keeps
  every form as written: vanilla's groups placed together, a call out of reach an error (`out-of-range`), the
  vanilla sha1 (G0). `goto_back` stays: it reads one byte where `goto` reads two, and takes `goto` only out of reach. The bytes between a group's scripts are holes (`skip`): vanilla keeps tiles in bank `$95`
  between two scripts of one group; a script placed alone drops the hole after it.
- **Absolute calls cost fewer cycles** (`29` about half of `a5`), and the engine is busy most of every frame, so a
  random build without `--strict` plays the same scenes but not frame for frame: `prove` builds its layout
  `--strict` (seed 1: the screens differ in 1,029 of 6,224 attract frames, and match again from frame 5,400).
- **Implode generates** the pointer table (a generated item: in place while the ids fit, else moved, with the
  four reader operands rebased by header word +0, which stays), the packed pointers of `@name` calls, the boot
  pointer and (maps kind) the enter-script table.
- **Placement.** The script window: the upper halves of `$92–$BF`, read as one space, so a script may run on
  from `$xx:FFFF` into `$xx+1:8000` (`Rule.window`). Three vanilla groups do.
- **Reached.** The table's scripts, the maps' enter scripts, the boot script and what they name; a script nothing
  reaches is left out of the ROM (`left-out`, a warning).
- **Limits.** 21,625 ids (header word +0 plus 3·id in 16 bits); globals 256 (a one-byte operand).
- **Proven (G1).** Seed 1 moved 2,597 of 2,599 script items; both stored playbacks identical. The proof
  translates packed pointers (the engine keeps one at `$7E0026`) and the script program counter `$82–$84`, stretch by
  stretch where a command took a longer form (`Item.segments`).
  In game (G2): the opening's enter script rewritten to `load_map(0x7F)`, and a new map's own enter script
  (`tests/open-evermore/in-game.test.mts`).
- **Next.** WRAM names for the remaining cells (knowledge entries); a songs kind for `music`; everscript text once the compiler writes relocatable output ([../split-and-link/tool.md](../split-and-link/tool.md) §7).

## opcodes *(built, 2026-11-20)*

**Folder.** `scripts/opcodes/<name>.json`, one per opcode `$00–$C2`; `scripts/opcodes/_enum.json` gives each its byte:

```jsonc
{
  "handler": "script_op_7e_currency_convert",  // the routine's name (soe://rom/code/): implode encodes this only
  "what": "Exchange money",                    // knowledge/opcodes/<xx>.md
  "params": [{ "name": "currency_from", "type": "uint16_t", "enum": "CURRENCY", "encoding": "expression",
               "unit": "currency: offset into $0AC6 (0 talons, 3 jewels, 6 gold coins, 9 credits)" }, …],
  "flow": "next: the next command runs in the same frame"
}
```

Names are the Scripts tab's (`script-vm/spec.ts`); a name two opcodes share takes the byte (`write_byte_14`); the 27
without a handler are `unused_<xx>` (STP). Handlers are written by the name of their knowledge entry; every one of
the 195 has one (2026-11-21: the STP bytes got entries, `script_op_<xx>_stop`, `script_op_unused_stop`); a name
stands for its address in `$8C` while code is not a kind, `$8C:xxxx` is still read. Parameters, types, units:
`script-vm/parameters.json`; **every parameter is named** (2026-11-21: `color_filter` red, green, blue, mix,
colour, first, count from `$8C:E4B1`; `mode7_scene` from, to, heading; `projectile` speed).

- **Implode generates** the dispatch table at `$8C:E8BD` (`JSR ($E8BD,x)` in `$8C:D0A6`), in place: handlers
  live in bank `$8C` and the table cannot grow (opcodes `$C3` and up index past it into code): 195.
- **Scripts** write each command's opcode by these names; renaming an opcode here renames it in every script.

## entities *(built, 2026-11-21)*

`scripts/entities/<name>.json`, one per expression sub-op that stands for an entity: `last_entity` (`$2D`, the one at
`$0341`), `script_owner` (`$2E`, the script slot's `+$0D`), `boy` (`$50`, `$0F3E`), `dog` (`$51`, `$0F40`), `active`
(`$52`, `$0F42`, the one the player controls) and `inactive` (`$53`, the other one). A file is `{ "handler", "what" }`;
`_enum.json` names[sub-op], null for the sub-ops that are constants, reads and operators (they stay in `_base/`).
Scripts write a lone entity byte (sub-op | `$80`) by these names. Implode writes the six words of the sub-op table
`$8C:F041` (`JMP ($F041,x)` at `$8C:EA5D`) in place; a new name gets no sub-op (an error: the others are not
entities). Handlers got their entries (`expression_boy` …).

## attack_procs, behaviours *(built, 2026-11-21)*

Two jump tables a character record picks by an even id: `attack_procs/<name>.json` (record `+$30`, the contact
handler table `$8F:B6AE`, `JSR ($B6AE,x)`; projectiles use it too) and `behaviours/<name>.json` (record `+$03`, the
idle-tick table `$8F:CBE0`, `JMP ($CBE0,x)`). A file is `{ "handler": <routine name>, "what": … }`; `_enum.json`
names[id], the record holds 2·id. Names are ours from what each does (`melee`, `melee_poison_1_in_4`,
`damage_without_roll`; `chase`, `wander`, the `IDLE_BEHAVIOR` names). Implode writes each table in place: 15 entries,
code right after (`handler-tables.mts`). Id `$10`'s handler got its entry (`attack_proc_melee_no_knockback`).

## projectiles *(built, 2026-11-21)*

`characters/projectiles/<name>.json`, one per entry of the table script opcode `0xB5` launches from (`$90:D986`, 16
record addresses in bank `$90`, read only by `lda.l $90D986,x` at `$8C:E851`, X = the kind = 2·id). A file is the
24-byte record by field: `animation` (`animations/` name or `null`; patched in `tables()`), `palette`
(`palettes/sprites/` name or `null`), `unknown_04`, `unknown_06` (hex words), `routine` (`+$08`, setup when an
animation throws it), `script_routine` (`+$0A`, setup when a script launches it), `behaviour` (`+$0C`, the tick) by
routine name (the table `$90:D967`, 2·k, k ≤ 14; a selector outside it as hex), `speed`, `lifetime`, `z_speed`,
`attack_proc` by its `attack_procs/` name, `power` (0: the thrower's attack by its stamina). Decoder:
`maps/projectiles.ts`. Names (v0.470.0, `projectile-names.mts`) by what throws each: the animation that throws it
(`vigor_boomerang`: `vigor/attack_1`; `bazooka_shell`: every ammo's `attack_1`), or the scripts that launch it
(`vigor_arena_throw_1`-`4`: Vigor's colosseum scripts pick 2·id 18-24 at random into `temp[21]`; `cutscene_trail`,
`script_strike`, `falling_shell`: cutscenes and the final boss). What each field does is in the kind's `README.md`, once
(not a `what` in every file).

- **Vigor's boomerang from a script.** Possible: `projectile vigor_boomerang, …` is a valid script line (id 6 is in the
  table), but a script launch runs the record's `script_routine`, which for ids 0-12 is the straight flight to the
  target (`projectile_motion_straight_to_target`); the tick (`behaviour`, the orbit) then runs on an ellipse its setup
  never placed. For the orbit, set `script_routine` to the boomerang's `routine` (`projectile_trajectory_polar_to_cartesian`):
  implode takes it (one word at `$90:DA58`), not tried in game. A copy with its own setup needs a free record, and bank
  `$90` has none: repurpose one of ids 9-12 (only Vigor's colosseum uses them).

- **Implode generates** the table, in place (the records follow it: 16 ids, no gap).
- **Records stay home.** Animation command `0x4C` throws records by their address, from animation scripts in
  `_base/`, so each record is an item only its home fits; a renamed projectile keeps its id's home (vanilla lists them
  in address order). A new one is an error (`no-room`: bank `$90` has no free byte). The five records the table does
  not list (`$D9EE`, `$DB0E`, `$DB26`, `$DB56`, `$DB6E`) stay in `_base/`.
- **Next.** Records that move once animation scripts name them (they do since v0.465.0; the home rule is what is left).

## fonts, hud *(built, 2026-11-21; sliced v0.454.0)*

Graphics the engine uploads from bank `$C4` by fixed addresses; each stays at its home (an item only its home fits).

```
graphics/fonts/<font>/font.json         height (12), columns (2: 16 pixels), and per code $20-$9F its width and what a
                                        string file writes for it ("A", "[[", "…"; control: a tag byte, never drawn)
graphics/fonts/<font>/glyphs/<code>.png one glyph, 16×12, 2 colours (paper, ink); the shadow is the rasterizer's
graphics/hud/tiles/<name>.png           one 8×8 2bpp tile: edge, corner, side, digit_0-9, glyph_3f6/3f7, slash,
                                        level_1-3_left/right; _enum.json is their BG3 order ($3E9 on)
graphics/hud/hud.json                   palettes (box: CGRAM 8, gauge: CGRAM 12), box (3 rows of 10 cells:
                                        "corner 2 h v": tile, palette, flips, `behind`), boxes.boy / .dog: column and
                                        column_alone (editable) with `at` (derived: box, HP, gauge in BG3 cells,
                                        portrait in pixels), portraits (derived: sprite and block)
graphics/hud/portraits/<name>.png       preview only: the Boy's and each Dog form's portrait in its colours
```

- **fonts**: `default` (`$C4:0000`) and `outro` (`$C4:0C82`), the two offsets of the table `$8C:E6E6` that `font`
  (`0x9A`) indexes with 2·id. A glyph is 1bpp, one byte a row, the left 8 pixels' rows then the right 8's (only
  W, m, w and the hands `$80`/`$81` use them). Scripts write `font default`.
- **hud**: the tiles `$C4:3704` (→ BG3 tiles `$3E9`-`$3FE`), the palettes `$C4:3864` / `$C4:386C`, the box
  `$8F:8000` and the columns (`lda #imm` at `$8F:875E`, `$8F:8A04`, `$8F:89FC` Boy; `$8F:8764`, `$8F:89D2`,
  `$8F:89C4` Dog). Every reader takes the column from the widget, so a column moves the box, its HP, gauge and
  portrait; the rows are immediates in many places and stay. Facts: `docs/disassembly/ui/field-hud.md`.
- **Portraits** are sprites in bank `$CC` naming 16×16 blocks: their pixels are
  `sprites/blocks_16/<owner>/<block>.png` (one owner per byte); `hud.json` names the block, `portraits/` shows it.
- **Next.** The menu screen as a kind (8bpp tiles, palette, tilemap: all verified, `$8C:B797`); the HUD rows (many
  immediates); moving fonts within bank `$C4` (rewrite `$8C:E6E6` and the `ldx #0` callers).

## animation modes *(built, 2026-11-21)*

`animations/modes/<mode>.json`: the six handlers `animate`'s mode picks (`$8C:E100`, `JMP ($E100,x)`),
each `{ handler, what }` by routine name; `_enum.json` names[mode / 2]. Names: the compiler's `ANIMATION_MODE`
lowercased (`once`, `once_freeze`, `loop`, `freeze`, `pause`) and `clear_script_pointers` for mode 8, which the
compiler does not name (the skeleton ship in the Desert of Doom uses it). Scripts write the mode by these names.
The table is written in place (code follows it).

## References between kinds *(v0.469.0)*

A value that names another kind's resource is written as its place in the tree, `<folder>/<name>`, so a reader sees what
it is and where to look (`links.mts`): `wram/DOG_BISCUIT`, `menus/ring_items/item_honey`, `strings/menu/rare_item`,
`targets/party_or_all`, `animations/icon/item_honey`, `palettes/sprites/ring_icon_011`, `alchemy/ingredients/root`.
Written so by the records kinds (equipment, alchemy, items) and ring items; implode reads that or the bare name. Still
bare: names inside scripts, rings' `items`, ring flows, characters, a fixed list's entry (`block: "petals"`), routines.

## texts — the menus' plain texts *(built, v0.469.0)*

```
strings/menu/<name>.txt     the text, one line (printable ASCII); ids are ROM order
```

Every NUL-terminated text in bank `$C4` that a known reader points at (16-bit pointers, bank `$C4` fixed by the
reader): ring item names (`$8E:8000` entries `+0`), weapon, ammo and armour record names and armour `text_2`, weapon
descriptions (`$C4:59F8`), formula names and descriptions (`$C4:5D09`, `$C4:5D51`), ingredient names (`$C4:5FF3`),
named items' names and descriptions (`$8C:BC1A`, `$8C:C3D0`). 246 texts; a reader names one by reference, and texts
the ROM shares by pointer are one file (a weapon's name is its ring item's; the six key items share
`strings/menu/rare_item`; all 40 armour `text_2` are `strings/menu/empty`). Names from the text (`armor_polish`,
descriptions cut at a word within 40 characters). Explode throws if a pointer lands inside another text.

- **Placement.** A text stays where it was while it fits (padded with zeros: same bytes, same readers' cycles). A longer
  or new one may go anywhere free in bank `$C4` (`no-space` otherwise): vanilla has no free byte there, so it fits only
  where a text was left out or shortened (§Why a menu text keeps its length).
- **A new named item, ingredient** writes its own text (`"name": "Lucky Coin"`) or names one; its codec copies it into
  its generated strings, so it needs no room in `$C4`.
- **Proven** (v0.469.0): G0 (vanilla sha1) with every kind; seeds 1 and 2026 round-trip; a shorter text lands in its
  bytes, a longer one is `no-space` (`g0.test.mts`). Same bytes and places as v0.468.0, so no new `prove` seeds.

## targets — what the target cursor may pick *(built, v0.469.0)*

```
targets/<name>.json         { rules: [ ... ] }   no bytes, no ids: a formula's or consumable's target names it
```

A formula (`$C4:5BF5`) and a consumable (`$C4:5A84`) store the same word to the request mask `$05AD` before the target
cursor (`alchemy_cast_action_direct_targeting`, `_area_targeting`, `item_use_on_target`), so both name one shared
resource. A file is the rules by name; the name explode gives is the rules joined (`enemies_nearest_three` = `$2010`,
Fireball's; `party_or_all` = `$000A`, Petals'), so a new file is a new target and a word reads back to the same name.
The rules (disassembly `$8C:8658`-`$8C:89DE`, knowledge `TARGET_REQUEST_MASK`):

| rule | bit | picks |
|---|---|---|
| `boy`, `dog` | `$0800`, `$0400` | only the Boy, only the Dog |
| `party` | `$0008` | entities whose `+$10` has bit `$0004` (the party) |
| `enemies` | `$0010` | ordinary entities (no friendly bit) |
| `marked_friends` | `$0020` | friendly entities whose record `+$07` has bit 2 |
| `record_bit_3_only` | `$4000` | only entities whose record `+$07` has bit 3 |
| `also_flag_1000` | `$0040` | entities whose `+$10` has bit `$1000` too |
| `alive_or_dead`, `dead` | `$0080`, `$1000` | HP 0 allowed; only HP 0 |
| `or_all` | `$0002` | the cursor may step past the last entity to all of them |
| `all` | `$0200` | all valid entities, the cursor cannot leave it |
| `nearest_three` | `$2000` | all of them: the three nearest the Boy when four or more |
| `off_screen_too` | `$0004` | no on-screen test |
| `result_several`, `listing`, `bit_8000` | `$0001`, `$0100`, `$8000` | written by the cursor and builders; no reader of `$8000` |

Vanilla has 10: `boy`, `dog_dead`, `dog_dead_or_all` (Dog Biscuit), `enemies_all`, `enemies_nearest_three`,
`marked_friends_or_all`, `party`, `party_all`, `party_or_all`, `record_bit_3_only_or_all`. **Proven** (v0.469.0): G0, seeds 1
and 2026 round-trip (same bytes as before). Not cast in game with a changed target yet.

## menus — the ring menus *(built, v0.455.0)*

Everything sits in bank `$8E` between code and is read by fixed addresses or code immediates, so it is written in
place; counts are fixed. Facts: knowledge `RING_ITEMS`, `RING_BUFFERS`, `RING_LOOPS`, `RING_FLOWS`, `*_ACTIONS`,
`ring_*_loop`, `RING_<ring>_COUNT` (corrected v0.455.0: the old names called the armour rings key items and spells,
the Call Bead rings formula actions and shop options, and ids `$F8`-`$116` unused formulas).

```
menus/ring_items/<item>.json    { name (a text), icon, palette, index | action | formula }; <item>.png a preview, only
                                with `explode --previews` (v0.470.0: `icon` is the animation, animated icons included)
menus/rings/<ring>.json         { buffer, loop, flags, items | items_by_caller (code immediates), filled_from (derived) }
menus/ring_flows/<flow>.json    { rings: [...] }: what Up/Down cycles through, in order
menus/<x>_actions/<entry>.json  { handler, what }: what pressing an item does (option, item, alchemy, caller, spell)
```

- **ring items** (162, `$8E:8000` → 8-byte entries `$8E:8144`): `name` is the text the ring prints, by reference
  (`strings/menu/<text>`, §texts). Weapon records, formula and ingredient names name the same texts, so editing the text
  changes the item everywhere; a longer one needs room in bank `$C4` (`no-space`, why: §Why a menu text keeps its length). `icon` names an animation in `animations/`, `palette` names a palette in `palettes/sprites/`. The index is what the ring that shows the item reads: by id range it is an
  `action` (options → `option_actions`, consumables → `item_actions`, Call Bead callers → `caller_actions`, their
  spells → `spell_actions`), a `formula` (`alchemy_actions`: also the number the learned bits and levels use) or a
  plain `index` (weapon, ammo, armour ×2, ingredient). Names from the item's own text (`weapon_bone_crusher`).
- **rings** (18): ring id → buffer (WRAM name), loop (routine name), flags. The two options rings, the Call Bead
  callers and each caller's spells, the bazooka ammo and the Pouch are code immediates (`lda #imm : sta`): `items`
  lists them in order with `when` (derived), so they can be swapped but their number is fixed. The other rings are
  built from inventory through tables in `$C4` (`filled_from`). Shop rings are `shop_<id>`, not yet told apart.
- **ring flows** (12, `$8E:998C`): each keeps its length (packed; code and `$CC:E37B`/`$CC:F037` hold their addresses).
- **actions**: handler tables in bank `$8E` (`handler-tables.mts`), each followed by code.
- **Proven** (v0.455.0): G0 alone and with every kind; seeds 1 and 2026 round-trip (same bytes: nothing moves). In
  game (`10-11_08-20-51` recording, Y at frame 17200 opens the Boy's options ring, B confirms): every name in capitals
  shows on the ring; "Player Status" with `action: control_prefs` opens Control Prefs; `window_edit` in the first
  options slot shows there.
- **Growing** consumables and the named items list (charms and key items, `$8C:BBB0`/`$BBD8`/`$BC1A`, the sub-menu of
  `$8C:C0E9`): [../todo/growable-items.md](../todo/growable-items.md).
- **Next.** The `$C4` tables that turn inventory into ring items (consumables `$C4:5AAE`, armour `$C4:5ABE`, formulas
  `$C4:5BAF`, ingredients `$C4:5B10`, weapon records +`$1E`) as references by name; moving names (needs every reader
  of a name string); `when` conditions as data (code today); shop rings named from `$0E6C`.

### Why a menu text keeps its length *(open; (b) built v0.469.0: the texts kind)*

Implode writes each menu text (`strings/menu/`) back into its own bytes, padded with zeros. A longer or new one may go
anywhere free in bank `$C4`, and there is none, so it is `no-space`. Dialogue does not have this limit, and neither do
the everscript compiler's strings: the difference is how a reader finds the text.

**Dialogue can go anywhere, menu texts cannot.** A dialogue string is reached through its key: the key table at
`$91:D000` holds, per string, a 15-bit offset and the bank (§strings), so a string may live in the lower half of any
bank. That is what the everscript compiler uses (sibling repo, `compiler/linker.py`): a script's `#memory(...)` lists
free ROM, typically the 4th MB that an expanded ROM adds (`0x300000..0x3fffff`, "extension"). The linker splits each
bank into its lower half for strings and its upper half for scripts (`MemoryManager._add`), and `allocate_text` gives a
new string the next free lower-half address and the next free string key (`string_key(...)` ranges in `#memory`). The
strings kind here does the same: lower halves in the first 4 MiB, the key table generated, and a random build grows
the image to 4 MiB. A menu text has no key: each reader holds a 16-bit offset and puts the bank there itself, so the
text has to be in the bank that reader names.

What stands in the way:

1. **The bank is in the code, at many sites.** A ring loop prints with `lda #$00C4 : sta $24` and then `$8C:9E03`. That
   exact pattern is at 48 places in the ROM (a byte search, 2026-11-25: `$8C:BDD3`, `$8C:C124`, `$8C:C3C1`, 12 in
   `$8D:8C45`-`$8D:9145`, the ring loops `$8E:A40F`-`$8E:AD10`, `$90:8538`, `$91:999D`, `$91:CDAF`, …), and the alchemy
   screen sets it with `lda #$C460 : sta $23` (`$8D:C1F1`). Other forms (an 8-bit `lda #$C4`, `pea`, a bank copied from
   a table) are not counted, so the list of readers is not complete.
2. **Texts are shared across readers.** One text is the ring item's name, the weapon record's (`$C4:3874` records) and
   the formula's (`$C4:5D09`) or ingredient's (`$C4:5FF3`) at once (§texts). Every reader of a text has to agree on its
   bank, so moving one text to another bank means changing the bank for every site of every reader that can reach it.
   In practice that is all ring-item names together.
3. **Bank `$C4` has no free byte.** The texts lie back to back (names `$C4:60D0`-`$C4:7240`, descriptions among them)
   between tables no kind owns yet. Implode's pool is exactly vanilla's resources, so room in `$C4` only comes from a
   `$C4` resource giving it up: a shorter text, a text no reader names any more, or a table that leaves the bank (the
   animate id table `$C4:3C92`-`$3E39`, the alchemy tables once they are generated).
4. **The box may be too narrow** *(unverified)*. The ring prints the name in a window of fixed width. How many pixels
   it holds, and what a longer name does (clipped, wrapped, drawn over the frame), is not checked. The fonts kind has
   each glyph's width, so the limit is in pixels, not characters.

What is already movable: a grown named items list writes its texts with its tables in any bank and rewrites its two
bank immediates (`$8C:C124`, `$8C:C3C1`), and a grown ingredients list does the same with `$8D:C1F1` (§items, §alchemy).
Those two reader groups have one bank site each, so they can move on their own.

**To lift it:** (a) list every reader of the `$C4` texts from the CDL library: each instruction that reads one, with
the pointer and the bank it used, not a byte search; (b) *(built, v0.469.0)* the texts as a kind of their own,
referenced by name; (c) group the readers by the texts they share and give each group a bank. Implode then places
that group's texts in that bank (any free lower half, as the compiler does for dialogue, or the 4th MB) and writes
the group's bank immediates. A text two groups share would be written once per group; (d) until then, give `$C4` the
room other kinds release; (e) measure the box in game (a 20-character name on the ring) and check widths in pixels.

### Full-screen menus *(explored, not a kind)*

Each options action fades out, runs an init and a loop in bank `$8D` and fades back (Action `$8D:82F0`/`$862A`,
Control Prefs `$9DB4`/`$9FB6`, Window Edit `$9B2A`/`$9CD1`, Alchemy `$C321`/`$C803`, status `$A0E9`/`$A6F6`); the
`$8D` routine names still describe other screens. The screen's background is verified (8bpp tiles, palette, tilemap,
`$8C:B797`). Before a kind: per screen, read the init for its tilemap, tiles and palette uploads (resources), the
loop for the text it formats (WRAM fields shown: a table of `{ at, field, format }` only where the code reads them
from data, otherwise derived and read-only) and the buttons it tests on `$0104` (immediates, like the HUD columns).

### HUD layout *(open)*

`graphics/hud/hud.json` already holds the tiles, palettes, the box and each box's column. Open: the rows (immediates
at many sites), the HP digits' and gauge's cells and the WRAM each reads (`docs/disassembly/ui/field-hud.md`), as a
`placement` list of `{ what, at, reads }` where code holds them as immediates.

### The debug ring *(explored, v0.456.0)*

Ring 3 (`menus/rings/debug.json`) sits in the Boy's flow between the weapons and the options, but nothing fills its
buffer (`RING_DEBUG_COUNT` `$0F5A`: no access in any recorded play), so the flow always skips it, and its loop is a bare
`rts` (`ring_debug_loop`, `$8E:A3EA`): the functions are gone. What is left are its eleven ring items (`debug_*`:
Create a monster, Show thud balls on path, Heel, the background toggles, Select map, Mode 7 flight, Alchemist, ROM
creation date), with text, icon and an index 0-20 (step 2) that no table reads. **To make it usable**: a loop routine
(new code, or another ring's loop with an action table the indexes fit) and something that fills the buffer (a script
writing `RING_DEBUG_COUNT` and `RING_DEBUG_ITEMS`, or a fill site in the Boy's ring build). Neither is tried in game.

## equipment — weapons, ammo, schools, armour *(built, v0.456.0)*

Records the game reads in place, by id (`records.mts`): their pointer table `$C4:3874` stays in `_base/`, and WRAM
keeps the equipped armour's record address (`$0AC0`-`$0AC4`, saved with the game), so no record moves and counts are
fixed. Every field is written where it was. Facts: knowledge `weapon_entries`, `BOY_WEAPON_TABLE`, `WEAPON_OWNED_BYTE`,
`WEAPON_OWNED_BIT`, `WEAPON_SCHOOL`, `WEAPON_DESCRIPTIONS`, `tbl_armor_records`, `weapon_skill_page_*` (corrected
v0.456.0: the pointer table is 57 words with the armour's, armour `+2` is the defence the ring shows, not magic defence).

```
equipment/weapons/<weapon>.json        { school, owned {flags, bit}, description, name, ring_item, attack, range, palette,
                                         animations {stand … knockback, idle, idle_rare}; skill (derived) }
equipment/bazooka_ammo/<ammo>.json     the same record fields (the Bazooka's record is its ammo's)
equipment/weapon_schools/<school>.json { skill_screen {draw, loop}; what (derived) }
equipment/armour/<armour>.json         { name, ring_item, defense, defense_shown, text_2; slot (derived) }
```

- **weapons** (14, the weapon index: `fist`, 12 weapons, `bazooka`): `name` is the text the record shows (its ring
  item's, `strings/menu/`); `ring_item` the item the weapons ring shows; `owned` the WRAM byte and bit
  (`$22DA`/`$22DB`: bits `$40`, `$80` of `$22DB` are free); `palette` names a `palettes/sprites/` entry, `animations` name
  `animations/` entries `boy_load_weapon` copies into the Boy's character record. `idle`/`idle_rare` (record
  `+$1A`/`+$1C`, v0.470.0; were `unknown_1a`/`1c`) go to `BOY_IDLE_ANIMATION`/`_RARE` (`$1460`/`$1462`): after
  1200-3247 frames standing still the Boy plays `idle` (15 rolls in 16) or `idle_rare` (1 in 16); vanilla gives both
  the same animation, none for the spears; `description` the weapon skill page's line (a text). The fist has only a school; the Bazooka has no record
  of its own (its ammo's).
- **weapon schools** (4: `sword`, `axe`, `spear`, `bazooka`): a weapon's `school` is 2·id. What a school is, is code:
  the weapon skill screen (options ring) jumps by the equipped weapon's school to a draw and a loop of its own page
  (`$8E:93D8`, `$8E:9404`: the Bazooka's are the sword's), and school `sword` adds a quarter of the attack again
  (`$8F:8491`). So a school can point at another school's page; a new school needs a page (code in `$8D`) and a slot in
  both jump tables (code follows them).
- **armour** (40): 12 body, 12 helm, 12 gloves, 4 collars (`slot`, derived). `text_2` is one empty text all 40 share
  (`$C4:60AD`, `strings/menu/empty`; was `{ same_as }` before v0.469.0); what reads it is not known.
- **The slot is code, not data** (v0.470.0, `ring_menu_inventory_item_availability_filter` `$8E:9DAE`): the id ranges
  0-11, 12-23, 24-35, 36-39 go to the body, helm, gloves and collar rings (`$0BFF`, `$0C23`, `$0C47`, `$0C6B`), the
  cursor sits on what `$0AC0`/`$0AC2`/`$0AC4` (the Boy) and `$0ABE` (the Dog) hold, and the defence adds those words. So
  `slot` stays derived. **A new armour type** needs: a slot kind (`equipment/armour_slots/<slot>.json`: its ids, its ring,
  its equipped WRAM word) with the filter's range immediates generated; a ring buffer and a ring flow entry (menus); an
  equipped word in the save area (WRAM W2+, [wram.md](wram.md)); and the defence sum (`$8F:84BD`) taught a fourth Boy
  word. Tracked in [roadmap.md](roadmap.md) §7.
- **Proven** (v0.456.0): G0 alone and with every kind, seeds 1 and 2026 round-trip; an attack, a school and a defence
  land in place (`g0.test.mts`). Not yet seen in game.
- **To add a weapon or a school** (open): every per-weapon table holds 14 words with the next table right after it, the
  loops stop at index 13 (`cpx #$1A`), the weapon skill pages lay out four weapons each, and WRAM holds one skill word
  per weapon (`$0ADD + 2·index`, the Dog's at `$0B07` right after): growing needs the tables moved (their readers are
  `lda.l table,x` operands, so they can move), the loop bounds as generated immediates and WRAM for the skill. That WRAM
  is the hard part ([wram.md](wram.md)).

## alchemy — formulas, ingredients, levels *(built, v0.456.0)*

Parallel tables in bank `$C4`, one word (or byte) per formula, each read by `lda.l`/`and.l`/`ora.l table,x` (X =
2·formula); written in place, count fixed at 35. Facts: knowledge `ALCHEMY_*`, `FORMULA_RING_ITEMS`,
`FORMULA_XP_PER_CAST`, `LEVEL_MULTIPLIER`, `ALCHEMY_BLOCK_TABLE` (corrected v0.456.0: 53 blocks, the readers of the
block map, power is one byte).

```
alchemy/formulas/<formula>.json        { name, ring_item, description, block, power, target, learned {flags, bit},
                                         cost [{ingredient, count} ×2]; wram (derived: experience, level, casts) }
alchemy/ingredients/<ingredient>.json  { name (a text); held (derived) }  ids 0-21; a new one (id 22-63): { text, held, icon }
alchemy/alchemy_levels/level_<n>.json  { experience_per_cast (0-8), power_factor }
```

- **block** names the cast's effect: the entry of `$91:80A6` the formula plays (its animation records and what bank
  `$91` does with them). Blocks 0-33 are named after the formula that has them, 34-52 after the Call Bead spell that
  casts them (`heat_wave`, `storm`, `confound`, `plague`, `disrupt`; the rest `block_<n>`). **Laser** has power 0 and
  Acid Rain's block in vanilla (its own description says "Halves target's HP"): `"block": "lance", "power": 60` gives it
  Lance's effect at that power (written and round-tripped; not cast in game yet). An effect of its own needs a new
  block, which is `$91` code and data, not a kind yet.
- **power** is one byte: the cast ORs the word with the level factor << 8 and multiplies (`$4202`), so 0-255.
- **target** names a target (`targets/enemies_nearest_three`, §targets), shared with the consumables.
- **Proven** (v0.456.0): G0 alone and with every kind, seeds 1 and 2026 round-trip; Laser's block, power and a shorter
  description land in place; a longer text, a power past 255 and an unknown block are errors (`g0.test.mts`).
- **Adding an ingredient** *(v0.460.0)*: a file past the 22 (and its name in `_enum.json`, limit 64) is a new one,
  `{ "text": "Salt", "held": "temp[198]", "icon": "crystal" }`: its name, the WRAM word that counts it (a `temp[]` cell,
  `temp[n]` = `$2834 + n`: wiped on every room load and not saved, said as an info; or a WRAM name) and the vanilla
  ingredient whose icon it shows. Formulas take it as a cost by name. Implode then generates the names (table and
  strings in one bank, the alchemy screen's bank immediate `$8D:C1F3`), the icon table (five pairs of `lda.l` operands)
  and the hooks (`codecs/ingredient-hooks.mts`): the 11 count readers (`$22FF,x`: alchemy screen, a ring's held count,
  the cast's check and use in `$91`, the shop's buy) become a `jsl` of the same length that keeps vanilla's access below
  id 22, and the alchemy screen's loops count from the last id. With 22 ingredients every one of those bytes is vanilla's.
  **Loot** is scripts: a gourd or sniff spot stages the reward (`write_word PRIZE, 534`, reward `$0216` = the first new
  ingredient by convention: `$0200 + id`) and calls its driver; `scripts/global/global_loot_part1` counts it in (a branch
  like vanilla's, writing the cell with `write_temp_byte temp[198], …`: `write_byte_14` reaches only the save area),
  `global_loot_part2` says "Found …" and `global_loot_part3` "can't carry more" (new strings). **Proven**: G0 with 22;
  seeds 1, 2026 (vanilla tree) and 1, 7 (grown) round-trip; in game (the user's recording to free play, WRAM written):
  the ingredients page (L/R in the alchemy screen) lists "5× Salt" with Crystal's icon, Cure costing Salt shows "×1" and
  a cast takes Salt 5→4, Root 2→0; a real gourd (`prehistoria_jungle_south_where_the_game_starts/loot_02`, `write_word
  PRIZE, salt`) counts one in and says "Found some Salt" (v0.461.0); a sniff spot runs the same three scripts (not seen). Not done: shops (a ring item per ingredient, ring items fixed at 162), a save that keeps
  the count ([../todo/growable-items.md](../todo/growable-items.md)).
- **To add a formula** (open): the nine tables touch each other (moving them is possible: every reader is a long
  operand), the ring item ids for formulas are a fixed range (`$48`-`$8C`), the alchemy action table has 36 entries
  with code after it, and WRAM holds 35 of everything, packed: learned bits `$2258`-`$225C` (5 bits free), experience
  `$2F52`, level `$2F98`, casts `$2FDE` (35 words each, back to back). The WRAM is what cannot grow today:
  [wram.md](wram.md).

## experience — XP per level *(built, v0.470.0)*

```
characters/experience/boy.json   { next_level_at: [100 numbers] }   by level 0-99: the total experience for the next
characters/experience/dog.json   { next_level_at: [99 numbers] }    level (24-bit); the Boy's 99th is 16777215 (none)
```

Two tables in bank `$8C` read in place (`records.mts`, 3-byte fields): the Boy's `$8C:8BD0` (100 entries), the Dog's
right after it, `$8C:8CFC` (99: the three bytes after them are the next table's, and the Dog stops at level 99 before
it reads them). Readers (`lda.l table,x`, checked at explode in place of the values): the level-up copy `$8D:B676`,
`$B67E`, `$B691`, `$B699` and the level-up check `$8F:8336`, `$833D`, `$851B`, `$8522`. Facts: knowledge
`BOY_XP_PER_LEVEL`, `DOG_XP_PER_LEVEL`. Counts fixed (moving the tables means rewriting those operands; not done).
**Proven**: G0 (vanilla sha1), seeds 1 and 2026 round-trip, an edited level lands at its byte (`$8C:8BD3`); not seen in
game.

## dog_forms — the Dog's looks per act *(built, v0.472.0)*

```
characters/dog_forms/<form>.json   menu_sprite, portrait (metasprites), palette (palettes/sprites/), aggro_range,
                                   animations: { stand, walk, run, slot_3, knockback, attack_0-3, sniff,
                                   sniff_look_around, steered_still, idle_wait, idle_wait_2, slot_14 } (animations/)
characters/dog_forms/README.md     what each field does (not compared)
```

Six 40-byte entries in bank `$8F` (`act1` `$9395`, `act1_stick` `$93BD`, `act2` `$93E5`, `act3` `$940D`, `act0` `$936D`,
`act4` `$9435`), ids in the order of the pointer table `$8F:945D` (word 0 = no form; a script asks for form n with
2·(n+1) in `$2443`). Read in place (`records.mts` with `entryAt`: entries by the mapping file's `dog_forms.entries`, checked
against the pointer table at explode); the table stays in `_base/`. The loader `$8F:9471` reads them with 16-bit offsets in
`$8F`, so they cannot move. Behaviour and stats are `characters/records/dog.json`. The HUD portraits (`$CC:3C72`…) are now
metasprites `portraits/dog_<form>` (they were in `_base/`; `act1` and `act1_stick` share one; Act 0's is also played by a
debug script). Slot roles: [extending.md](extending.md) §2. Count fixed at 6: a 7th form needs a loader hook (§1 there).
**Proven**: G0 (vanilla sha1), seeds 11 and 12 round-trip, `prove --random 11`; an edit by name lands (`act0` slot 14 →
`dog/act0_bark` writes `$4526` at `$8F:9395`, entry `+$26`); not seen in game.

## items — consumables, named items *(built, v0.461.0)*

```
items/consumables/<name>.json   { ring_item, target, block, power; held, action (derived) }   ids 0-8 (8 the Pouch: action only)
                                a new one (id 9-15): { held, ring_item, target, block, power }
items/named_items/<name>.json   { name, description, flag {flags, bit} }              ids 0-19 (0-13 charms, 14-19 key items)
                                a new one (id 20-39): { name, description, flag {flags, bit}, icon }
```

Records read in place (`records.mts`, wrapped by `items.mts`); the facts and every reader are in `items.mts`' header and the
knowledge entries `item_use_on_target`, `tbl_C45A84`, `tbl_C45A92`, `tbl_consumable_items`, `tbl_8CBBB0`, `tbl_8CC3D0`,
`tbl_C45A12`. With vanilla's count every byte is vanilla's (G0).

- **A consumable** is the ring item's index, and so the entry of `menus/item_actions/` that pressing it runs (`action`, a
  link to read on): 0-6 `item_use_on_target`, Call Bead its callers ring, the Pouch `pause_menu_entry_and_dispatcher`,
  which runs the pause screen loop itself (`pause_menu_loop`, no menu id: nothing more to explode). Using one of 0-6
  picks a target by `target` (a target, §targets), counts one down
  and plays `block` (an alchemy block by name, as formulas take it: Wings play `escape`) with `power`. **A new one** needs a
  ring item no ring shows, i.e. a `debug_*` one (11): give it a name (at most its vanilla length), an icon, a palette and
  `"index": <the consumable's id>`, and name it as `ring_item`. `held` is a `temp[]` cell (wiped on every room load, not
  saved) or a WRAM name. Implode then generates the four tables (target, block, power, ring item), the count cells and
  hooks (`consumable-hooks.mts`): the ring build's loop counts every id, its count read, the ring's count shown, the use's
  count down, and the dispatch (`tax : jsr ($A873,x)` → a `jsl` that enters vanilla's handler, or the use handler for a new
  id, in bank `$8E`). Limits: the ring holds 16 (the Pouch one of them); shops never list a new one (their catalogs map
  shop ids through `$C4:5ABE`: not done).
- **A named item** is an entry of four `$8C` tables: its flag (WRAM word and mask), name, description. **A new one** gives
  them and a vanilla named item's `icon`; implode moves the tables, the icons and the strings (one bank, the two print
  loops' bank immediates) and lengthens every loop. A key item needs only a flag that scripts set and test: free saved bits
  are `$22DB` `$40`/`$80` and `$225C` `$08`-`$40` (a flag outside the save is an info). The list has 20 places: more held
  at once is not handled (an info). Scripts give one by setting its flag, or by `EQUIPMENT_GRANT_COMMAND` (`$243D` = 2·entry).
- **Loot**: `PRIZE` takes a new item by its file's name (`write_word PRIZE, salt`): `$0100 + k` a named item, `$0200 + id`
  an ingredient, `$0800 + id` a consumable (`operands.mts` `REWARD_KINDS`). The three loot scripts need a branch for it
  (§alchemy, "Adding an ingredient").
- **Proven** (v0.461.0): G0; seeds 1 and 2026 round-trip, vanilla and grown; the hooks on the 65816 interpreter
  (`item-hooks.test.mts`). In game: a Salve on `debug_heel` shows "Salve ×3" on the items ring and heals 5 → 15 HP at power
  10 (count 3 → 2); a Lucky Coin (`$22DB` `$40`, Wizard's Coin's icon) is listed in the Pouch with its description.

## characters, animations, sprites *(built, 2026-11-20; v0.464.0 layout)*

The table hack's tables (`tools/table-hack/`, moved and proven there) alongside the shared animation and sprite layers:

```
characters/records/<name>.json             one 74-byte record as named fields (hp, attack, …), `palette`/`palette2`
                                           (`palettes/sprites/`), `animations` (12 slots naming `animations/`),
                                           `behaviour` and `attack_proc`, `flags`/`flags2` as bit names, and `spawn` for
                                           the Boy/Dog whose ENEMY ids spawn from WRAM ($0A26, $0A70)
characters/records/_enum.json              names[ENEMY id], what spawn opcodes take; null: an id with no record
characters/records/_records.json           the record block in order: record k at $xx:B678 + 74·k
animations/<owner>/<name>.json             all 783 animations: `facing_mode`, per facing the symbolic script (or `same_as`),
                                           derived `palettes` & `used_by`; no ROM pointers
animations/animate.json                    the `$C4:3C92` table the `animate()` opcode reads: parameter name → animation[#facing] | null (212, limit 2,048)
animations/modes/<mode>.json               the 6 mode handlers at $8C:E100
sprites/blocks_16/<owner>/<name>.png       4,854 16×16 sprite blocks, indexed grey PNG, in the folder of the owner whose animations draw them
sprites/blocks_8/<owner>/<name>.png        6,265 8×8 sprite blocks (plus the alias block 6085 as .json)
```

- **Names.** Characters: our compiler's ENEMY names (`language/data/index.json`), `boy`, `dog`. Animation groups &
  `animate()` IDs: attributed `<owner>/<name>` using character records, weapons, Dog forms, ring items, projectiles,
  alchemy, script chains, and enums, stripping redundant prefixes.
- **Characters.** Single `<name>.json` per character (redundant `animations.json` dumps removed in v0.464.0). Records
  stay a block at offset `$B678` of a bank in `$80–$BF` form (`Rule.bankOffset`); `patched: true` lets `tables()` update
  moved/new animation group offsets. 254 records, 256 ENEMY ids max.
- **Animations (`animations`, v0.465.0).** All 783 animations in one file each, with explicit `facing_mode` (`any`, `4_way` in `$90:815B` order `[N, E, S, W]`, or `8_way`), the symbolic `$C7–$C9` scripts inline (1,595 scripts, re-assembled byte for byte at explode) and programmatic palette attribution (`animation-analysis.mts`, `animation-scripts.mts`). Vanilla `$C4` records keep their offset; a new animation marks `animations/_table` (`vacate_c4`) so `$C4:3C92–$3E39` opens inside bank `$C4`. `animations/animate.json` keeps vanilla's 212 `animate()` ids (key = parameter name) and grows to 2,048. Scripts, records and the table are generated and relocate; format and extending: [animations.md](animations.md).
- **Sprite blocks.** `sprites/blocks_16/` and `sprites/blocks_8/`, compressed exactly when shorter (plus alias `block_17c5`),
  21,845 ids each.
- **Proven (G1).** See [progress.md](progress.md).

## metasprites — composite sprite frames *(built, S7d; `sprites/` v0.464.0)*

The 4,904 discrete composite sprite frames (metasprites) assembled from 16×16 and 8×8 sprite blocks across banks `$CA–$D3`.
Each file describes the chunks, signed offsets from the origin anchor (feet), flags (size, flipX, flipY, priority, palette),
and hardware bounding box.

**Folder.** `sprites/metasprites/<owner>/<frame>.json`, organized by owner attributed via `animations` (`boy/`, `dog/`, enemies, `shared/`, `alchemy/`, `icon/`, `projectile/`, `effect/`, `misc/`).

```jsonc
{ "format": "open-evermore/metasprite", "version": 1,
  "bounds": { "x": -16, "y": -32, "w": 32, "h": 32 },
  "chunks": [
    { "block": "boy/boy_block_014a", "size": 16, "x": -8, "y": -28, "priority": 2, "flip_x": false, "flip_y": false, "palette": 0 }
  ]
}
```

- **Names.** `<owner>/<animation>_<facing>_<n>`: after the first animation script that plays the frame (`boy/dragged_0`, `boy/axe_walk_east_3`); `frame_NNN` only for a frame no script reaches ([animations.md](animations.md) §3.5).
- **References.** Used by animation scripts (`sprite` opcodes `0x22–0x2B`, `sprite2`, `sprite_long`, `sprite_aim`). References `sprite_blocks_16` and `sprite_blocks_8` by block name.
- **Implode generates**: The exact byte sequences for `$CA–$D3` sprite records (validated bounds, chunk fields, block refs, and record length).
- **Placement**: Vanilla records stay at home (code and `_base/` tables name them by address); a brand-new metasprite is placed anywhere in `$CA–$D3` and referenced by name from animation scripts.

## animation scripts — `$C7–$C9` bytecode *(built, v0.465.0)*

Not a kind of their own: each script is a facing inside an animation file (`animations/<owner>/<name>.json`, [animations.md](animations.md) §4.1), written as symbolic lines. Scripts relocate freely (below 4 MiB, a jump into another script stays in its bank); under `--strict` they keep their 256-byte page behaviour (`Rule.noPageCross` / `Rule.pageOffset`) because the VM spends 4 extra cycles when its pointer crosses a page (`$90:80F3`).

## wram — WRAM variables *(built, W1, v0.459.0)*

**Folder**: `wram/<NAME>.json` per named variable (1,216; UPPER_CASE names, the ones scripts read cells by), `_enum.json`
empty (no ids). A file holds `at` (`"$7E:0133"`) or `in` + `offset` (inside another variable, moving with it) and `size`
when known. **References**: script operands (`write_word ENEMY_SPAWNER_QUANTITY, 1`), records' `wram` fields, rings'
`buffer` use its names; implode reads it first (`KINDS[0]`) and hands the addresses on. **Implode generates**: nothing
yet; a variable off its vanilla place is an error (`wram-moved`) until W2. **Limits**: `$7E:0000`-`$7F:FFFF`, an `in`
variable inside its parent's size, names unique. **Codec**: `codecs/wram.mts` (names: script-model/names.ts
`displayNames`; sizes: `localizations/wram-map.ts`). Design and steps: [wram.md](wram.md),
[../todo/wram-allocation.md](../todo/wram-allocation.md).

## code

**Folder.** `code/<routine>.asm`, one routine per file, named like `soe://rom/code/<routine>/` *(repo)*.
Subfolders by subsystem are allowed (`code/nmi/nmi_handler.asm`); the name is the file name, not the path, so it
stays unique.

- **References.** By label: other routines, data labels of every kind (`map_pyramid_outside`), id symbols
  (`!music_<name>`, [README.md](README.md) §4). Used by `header.json` (vectors) and by other code.
- **Implode generates**: `_build/main.asm` (an `incsrc` per file, an `org` per placed routine), then runs Asar.
  This is the first kind that needs Asar; before it, implode writes bytes itself ([tool.md](tool.md) §3).
- **Limits.** Assembles; every label resolves; size equals the vanilla routine while it is pinned.
- **Codec.** The byte-exact Asar export *(repo: `src/platform/cdl/asar-export.ts`)*, cut per routine;
  symbols as [../split-and-link/symbolic-export.md](../split-and-link/symbolic-export.md) M0–M9 provide them.
  A routine with a raw operand left is pinned. Knowledge entries become comments.
- **Reconstructed C** is not in the tree: `reconstructed-c/` documents the ROM and is not built into it here
  (the C-to-ROM build is its own project, AGENTS.md §0.11).
