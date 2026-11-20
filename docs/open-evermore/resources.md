# Open Evermore: the resource kinds

Status: **design (2026-11-18), nothing built.** Back to [README.md](README.md). Labels as there.

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

## tile_families — background palettes *(built, S2)*

**Folder.** `tile_families/_enum.json` + one file per family, by default `<family>.json`:

```jsonc
{ "format": "open-evermore/tile-family", "version": 1,
  "colours": ["#000000", "#f8f8f8", …],            // 16 colours; each channel a multiple of 8 (5 bits on the SNES)
  "maps": ["antiqua_pyramid_outside", …] }         // derived: the maps that use it; implode ignores it
```

`explode --families png` writes `<family>.png` instead: a 128×8 stripe of 16 solid 8×8 cells, colour 0 on the left
(owner, 2026-11-19: easier to see; JSON stays the default because it carries more). The choice is kept in
`manifest.json` `options`, so the round trip writes the same form. Implode reads either; a family that is both is
`duplicate-name`; a cell that is not one opaque colour, or a stripe of another size, is `invalid-value`.

- **Names.** `family_<id>` (`family_024`): the repo has no names for families ("a ROM id tied to an area",
  room-reference.md §5). Better names are an open question ([README.md](README.md) §9); `maps` is there to help.
- **References.** Used by maps (`"tileFamilies": ["family_024", …]`, `unknown-reference` when missing). Uses
  nothing.
- **Implode generates** one placeable item, the array (family *n* at base + 32·*n*, in enum order), and the
  two operands of the loader `$90:D05C` that hold its address: `adc #$C322` and `lda #$9C`. They are the only
  readers *(repo: the table hack moved the array the same way)*.
- **Placement.** Upper half (the `$80–$BF` form), never across a bank; at most 1024 families (32 KiB).
  The array sits between two rooms in bank `$9C`, so `--random` shuffles it with them (or into the 4th MB).
- **Proven (G1).** Seeds 1, 2, 99 moved it (`$9C:D25E`, `$9C:8000`, `$9C:8F3C`); the playbacks played identically
  and no WRAM byte points into it (knowledge `asset_9cc322_background_palettes_tile_families`).
- **Limits.** Exactly 16 colours, each `#rrggbb` with channels in steps of 8 (`invalid-value`); no gap in the ids
  (`id-gap`).
- **Later:** sprite palettes (bank `$90`, full) as their own kind once their readers allow it
  ([../split-and-link/extending.md](../split-and-link/extending.md) §5).

## strings *(built, S4)*

**Folder.** `strings/_enum.json`, `strings/_strings.json` and one `strings/<string>.txt` per string, UTF-8:

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

## music and sounds

**Folder.** `music/<track>/` and `sounds/<sound>/`:

```
music/village_on_the_plateau/
  track.json          { "volume": …, other descriptor fields the VFS decodes }
  package.bin         the song package (raw until the sequence format is decoded)
```

- **Names**: from `src/games/evermore/localizations/sounds.ts` *(repo)*, snake case. The open naming question is
  [README.md](README.md) §9 Q1.
- **References.** Used by maps and scripts (`play_music("village_on_the_plateau")`, compiled to the id). Uses
  nothing until samples are shared resources.
- **Implode generates**: the song table `$8C:8442` (byte offsets) → descriptors `$81:9903` + the count *(repo:
  70 tracks, ids `$00–$45`)*; the sound table `$8C:8362` *(repo: 54 sounds)*.
- **Limits.** Music ids < 128 (opcode `0x33` takes a byte offset, [extending.md](../split-and-link/extending.md)
  §5); a package must fit the audio RAM the driver leaves free *(the exact budget: to verify,
  [../todo/audio-and-music.md](../todo/audio-and-music.md))*.
- **Logic warnings.** A track no map or script plays (`unreferenced`; vanilla has unused tracks, so the vanilla
  ones are listed as known).
- **Codec.** Descriptors *(repo: `soe://rom/assets/audio/`)*; packages raw. This is the first vertical slice
  of split-and-link: copy a package under a new name, play it from a script ([split-and-link](../split-and-link/README.md) §5.6).

## tiles — the 16×16 map graphics *(built, S3)*

**Folder.** `tiles/_enum.json` + one file per tile, by default `<tile>.png` (owner, 2026-11-19): an **indexed** PNG,
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
- **Placement.** Anywhere, never across a bank. Vanilla scatters them over ~80 banks in the gaps other data
  leaves; `--random` shuffles them among their neighbours and into the 4th MB.
- **Limits.** 16 rows of 16 hex digits (`invalid-value`); 21,845 ids (the readers index the table with id·3 in
  16 bits); a room's graphics list ≤ 264 slots is a map limit.
- **Logic warnings.** A tile no map uses (`unreferenced`; vanilla uses all 6,688). *(Proposal: identical pixels.)*
- **Proven (G1).** Seeds 1, 2, 99 (≈6,660 tiles moved each, 4 MiB): both playbacks in step, VRAM identical at
  every check. Moving tiles shifts room-load timing (drifts back in step within 17 frames); seed 7 lost a lag frame
  and never came back (progress.md §2).

## maps — rooms *(built, S1)*

**Folder.** One folder per room:

```
maps/_enum.json                      names[id]: the map table's order (README.md §4); up to 256 ids
maps/<map>/map.json                  header, families, palette cycles, graphics, animations, triggers, cuttable grass
maps/<map>/grid.txt                  the cells: one row per line, each cell its metatile id in hex
maps/<map>/metatiles.json            what each metatile draws (canopy, terrain) and how it collides
maps/<map>/objects.json              each object's states: where, which cells, how long each is held
maps/<map>/scripts/<script>.txt      the scripts this room reaches first (enter, step-on, B and what they call; §scripts)
maps/<map>/preview.png               the room drawn by the repo's renderer; for the reader, implode ignores it
```

`map.json` (version 6; the files are `src/games/evermore/maps/tree-map.ts`, which the Rooms tab reads too):

```jsonc
{
  "format": "open-evermore/map", "version": 6,
  "header": { "triggerOrigin": [17, 11], "mainScreen": 23, "subScreen": 0, "colourMath": 0, "colourWindow": 2,
              "effect": 2, "cameraFlags": 0, "reserved": 0 },  // room-reference.md §4; width and height come from grid.txt
  "tileFamilies": ["family_020", …],               // names in tile_families/
  "paletteCycles": [{ "start": 27, "colours": 4, "rate": 5 }],  // CGRAM colour, how many, frames per step (signed)
  "graphics": { "compression": "lzss", "tiles": ["tile_0d7b", …] },   // Block 1, names in tiles/
  "animations": [{ "countdown": 0, "frames": [{ "ticks": 8, "tile": "tile_0a40" }, …] }],   // Section 2
  "stepOn": [
    { "from": [64, 16], "to": [68, 18], "script": "pyramid_outside_step_1" }   // cells [x, y]; a script by name
  ],
  "bTrigger": [ … ],
  "cuttableGrass": [{ "cut": "000", "into": ["507"] }, …],  // Section 4: metatile ids as in grid.txt
  "enter": { "script": "pyramid_outside_enter", "word": "$0001" }  // the enter-script record; none: no `enter`
}
```

`grid.txt`, one row per line (`048 048 049 …`), and `metatiles.json`, one metatile per line:

```jsonc
{ "format": "open-evermore/metatiles", "version": 1, "compression": "lzss",
  "list": [
    { "id": "000", "canopy": "tile_0d7b p2 pr v", "terrain": "tile_02a3 p1 h", "collision": "gf z1" }, …
  ] }
```

`objects.json`, one object per line (its id is its position: scripts set `object[n]`):

```jsonc
{ "format": "open-evermore/objects", "version": 1,
  "list": [
    { "id": 0, "holds": [1], "states": [{ "at": [39, 63], "cells": ["53d 53e", "53f 540"] }] }, …
  ] }
```

- **A state** is how its cells look once reached (state 1 is `states[0]`; state 0 is grid.txt): a rectangle at
  `at` (cells), one row per string, `.` for a cell it leaves alone. The cells are the object's own steps applied in
  order to grid.txt (other objects at state 0); implode turns them back into the XOR deltas the engine applies, so an
  edited grid.txt keeps each object's look. `holds[s]`: ticks state *s* stays up while a script steps through it
  (the first is never read). `^<4 hex>` is a delta written as is: a cell off the grid (room `0x6E`, 3 stamps).
- **Layout** is vanilla's: all records, then all stamps, in order (127 of 127 rooms rebuild byte for byte).
- **Cuttable grass** (`map.json`): `cut` is a metatile the Boy cuts, `into` what is stamped in its place; `steps` if
  not 1. The source count Section 4 starts with (also the grid's first Markov counter) is the number of distinct
  `cut`s, as in all 7 vanilla rooms; `grassSources` overrides it. `#<4 hex>` is a word that is no metatile.

- **Layer words** (`canopy` = BG1, `terrain` = BG2): `<graphic> p<palette>` and the set flags `pr` (priority), `h`, `v`
  (flips). The graphic is a name from `graphics.tiles` (`tile_10ee#2` for its second occurrence), `anim<n>` for
  animation channel *n*'s slot, or `chr<3 hex>` for a character no slot names (82 vanilla words use `$3F0–$3FF`).
- **Collision words** ([../map-format/room-reference.md](../map-format/room-reference.md) §9): `g<geometry>` and the
  set flags `z<plane>`, `see`, `gate<n>`, `front`, `walk`, `step` (step-on cell), `b` (B-trigger cell); `bit7` if set.
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
room's `scripts/` folder (owner: no central `_enter_scripts.json`). Still open: a grid of names rather than ids.

- **Names.** From `localizations/data/rooms.json` *(repo, our own wording)*: region + place + part in snake case
  (`prehistoria_jungle_south_where_the_game_starts`); `map_<hexid>` for a room it does not name.
- **Implode generates** both id-indexed tables, in the enum's order: the map table (per id [24-bit pointer, pad 0],
  read by `lda.l` at `$90:8F69` / `$90:8F6F`) and the enter-script table (per id [packed pointer, word], read by
  `lda.l` at `$8C:CECC` / `$8C:CED2`, which read bytes 0–2 only) *(repo: `tools/table-hack/tables.js`)*. Each is a
  generated item: in place while the ids fit it (vanilla's 127; byte for byte, G0), placed like any item once a map
  is added (the enter table's vanilla footprint ends 2 bytes early: its last word lies on the script pointer
  table), and the four reader operands are rewritten to wherever it landed. Explode finds both through those
  operands. The blob pointer is the `$80–$BF:8000+` form.
- **Enter script.** `map.json` `enter`: the script and the word after its pointer (the room loader does not read
  the word; vanilla holds 0–4). No `enter`: none (packed 0, as Brian's room). Copying a map's look over another's
  means its four map files with the target's `enter` kept: Brian's map in `podunk_opening_over_the_machine` boots
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
B trigger, a global) or a script those call. A script that only rooms reach lives in the folder of the first room
(lowest id) that reaches it (owner, 2026-11-20); the rest in `scripts/`. Names are unique across both:

```
scripts/_enum.json          names[id]: the pointer table (trigger ids are byte offsets 3·id; globals from id 1,917)
scripts/_scripts.json       the boot script (header +$0C) and the groups (below)
scripts/<script>.txt        globals, the boot script and what they reach
maps/<map>/scripts/<script>.txt   the room's enter, step-on and B scripts and what they call (2,800 of 3,288)
```

A line is one command: the opcode by its name in `opcodes/` (a hex byte works too), then its operand bytes in hex;
another script as `@name`; `skip <n>`:

```
call_global 36              call_id(FADE_IN)
call @podunk_podunk_town_1965_enter_sub_1    call (absolute: the packed pointer is generated)
call_back @global_loot_part1_sub_1           call back (relative: the offset is generated)
load_map 17 28 15 00        load_map(0x15, 0x17, 40): ends the script
skip 7                      7 bytes no command reaches: not this script's
```

- **Names.** A table entry: the room trigger that uses it (`<map>_step_<n>`, `<map>_b_<n>`), a global's name
  (`global_<name>`, `script-model/names.ts`), else `script_<id>`. An enter script `<map>_enter`, the boot script
  `boot`, a called one `<root>_sub_<n>` after the first table script, map or boot script that reaches it. A map
  names its enter script and its triggers' scripts in `map.json`. Every name and folder is the tree's: on a round
  trip, implode tells explode where each named script landed and which folder held it.
- **References.** `@name` replaces the operand of `07`, `29`, `af`, `b4` (a packed pointer, any script) and of
  `a5`, `b2` (one byte back), `a6`, `b3` (a word back). Ids stay numbers: global ids (`a3`, `b0`), trigger
  offsets (`a4`, `b1`), string keys, map ids, enemy ids, animate ids.
- **Groups.** Scripts that call each other backwards by a relative offset are placed as one item, in the order
  `_scripts.json` lists them; implode works out each offset and says when one is out of reach (`out-of-range`).
  141 groups in vanilla, the largest 20 KB. The bytes between them are holes (`skip`): vanilla keeps tiles in
  bank `$95` between two scripts of one group.
- **Implode generates** the pointer table (a generated item: in place while the ids fit, else moved, with the
  four reader operands rebased by header word +0, which stays), the packed pointers of `@name` calls, the boot
  pointer and (maps kind) the enter-script table.
- **Placement.** The script window: the upper halves of `$92–$BF`, read as one space, so a script may run on
  from `$xx:FFFF` into `$xx+1:8000` (`Rule.window`). Three vanilla groups do.
- **Reached.** The table's scripts, the maps' enter scripts, the boot script and what they name; a script nothing
  reaches is left out of the ROM (`left-out`, a warning).
- **Limits.** 21,625 ids (header word +0 plus 3·id in 16 bits); globals 256 (a one-byte operand).
- **Proven (G1).** Seed 1 moved 2,597 of 2,599 script items; both stored playbacks identical. The proof
  translates packed pointers (the engine keeps one at `$7E0026`) and the script program counter `$82–$84`.
  In game (G2): the opening's enter script rewritten to `load_map(0x7F)`, and a new map's own enter script
  (`tests/open-evermore/in-game.test.mts`).
- **Next.** Labels for jumps inside a script (they are relative: editing a line's length moves the targets after
  it); everscript text once the compiler writes relocatable output ([../split-and-link/tool.md](../split-and-link/tool.md) §7).

## opcodes *(built, 2026-11-20)*

**Folder.** `opcodes/<name>.json`: `{ "handler": "$8C:D2A1", "operands": "u16 E", "flow": "next" }`, one per
opcode `$00–$C2`; `opcodes/_enum.json` gives each its byte. Names are the Scripts tab's (`script-vm/spec.ts`); a
name two opcodes share takes the byte (`write_byte_14`); the 27 without a handler are `unused_<xx>` (STP).
`operands` and `flow` are for the reader: implode encodes the handler only.

- **Implode generates** the dispatch table at `$8C:E8BD` (`JSR ($E8BD,x)` in `$8C:D0A6`), in place: handlers
  live in bank `$8C` and the table cannot grow (opcodes `$C3` and up index past it into code): 195.
- **Scripts** write each command's opcode by these names; renaming an opcode here renames it in every script.

## characters, enemies, animate ids, sprite blocks *(built, 2026-11-20)*

The table hack's tables (`tools/table-hack/`, moved and proven there), now resources:

```
characters/<name>.json      one 74-byte record as named fields (hp, attack, …, palette, animations: { stand, … })
characters/_enum.json       the records in order: id = place in the block, so 16-bit address $B678 + 74·id
enemies/<name>.json         an ENEMY id: { "character": "<name>" } or { "address": "$0A26" } (the Boy, the Dog)
enemies/_enum.json          names[ENEMY id]
animate_ids/<name>.json     { "record": "$C4:477A" }: the animation record an animate() id plays
sprite_blocks_16/<name>.png 16×16 sprite block pixels, indexed, grey (the palette comes from the entity)
sprite_blocks_8/<name>.png  8×8; sprite_blocks_8/block_17c5.json: an alias (below)
```

- **Names.** Enemies: our compiler's ENEMY names (`language/data/index.json`); a record takes its first
  enemy's name (records 0 and 1: `boy`, `dog`, the templates copied to WRAM); `animate_<id>`, `block_<id>`.
- **Characters.** One item: the records stay a block at offset `$B678` of a bank in the `$80–$BF` form
  (`Rule.bankOffset`), because the game keeps them by 16-bit address (enemy index, entity `+$60`, and five code
  immediates that name records). Only the bank moves: implode writes it into the `mvn` at `$8F:8046` and the 131
  `op $8E00xx,X` operands. Order is identity: add records at the end. 254 at most (to the end of the bank).
- **Enemies.** The index (`$8E:B55A`, four `lda.l` in the spawn handlers) is a generated item; a character's entry
  is its record's 16-bit address. 256 ids (opcodes `0xBA`/`0xC2` take a byte).
- **Animate ids.** The table (`$C4:3C92`, one `lda.l` at `$8C:E13C`) is a generated item; records stay in
  `_base/` (bank `$C4`, [animations.md](animations.md)). 2,048 ids.
- **Sprite blocks.** Each block is a resource placed anywhere from its base bank (`$D9` / `$D1`) to the end of the
  4 MiB (`Rule.above`, `below`), never across a bank; the tables (`$EC:0000`, `$D8:0000`, three `lda.l` each) are
  generated. Stored compressed exactly when shorter (vanilla's rule for all 11,119), so the PNG is the whole block.
  8×8 block 6085 reads raw the bytes of blocks 0 and 407 compressed: `{ "bytes_of": [...], "compressed": false }`,
  placed as one run. 21,845 ids each.
- **Proven (G1).** See [progress.md](progress.md).

## characters, sprites, animations — the rest

Explored 2026-11-20: [animations.md](animations.md) (what binds each layer, what can be exploded first).

**Folder.**

```
characters/<character>/   character.json (the record), referencing sprites, palette, animations by name
sprites/<block>/          sprite.png (+ block layout)
animations/<animation>/   animation.json (the decoded animation script)
```

- **Facts *(repo)*.** 142 characters (`soe://rom/assets/characters/`); character records and enemies in bank
  `$8E`; sprite blocks at `$EC0000` and `$D80000` (moved and proven); animation records bound to bank `$C4`,
  212 ids ([../extension-tables.md](../extension-tables.md), `animation-script` skill).
- **Implode generates**: the enemy index, the record bank, the sprite block tables, the animation record pool
  and `animate()` ids.
- **Limits.** Animation records stay in `$C4` (`bank-bound`); records stay in `$8E` until readers take a bank.
- **Codec.** Decoders *(repo)*; encoders: the table hack moved these tables (`tools/table-hack/` *(repo)*), the
  block encoder and new animation content are open ([../todo/table-hack.md](../todo/table-hack.md)).

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
