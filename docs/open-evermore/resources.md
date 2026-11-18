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

**Folder.** `tile_families/_enum.json` + `tile_families/<family>.json`:

```jsonc
{ "format": "open-evermore/tile-family", "version": 1,
  "colours": ["#000000", "#f8f8f8", …] }          // 16 colours; each channel a multiple of 8 (5 bits on the SNES)
```

- **Names.** `family_<id>` (`family_024`): the repo has no names for families ("a ROM id tied to an area",
  room-reference.md §5). Better names are an open question ([README.md](README.md) §9).
- **References.** Used by maps (`"tileFamilies": ["family_024", …]`, `unknown-reference` when missing). Uses
  nothing.
- **Implode generates** one placeable item, the array (family *n* at base + 32·*n*, in enum order), and the
  two operands of the loader `$90:D05C` that hold its address: `adc #$C322` and `lda #$9C`. They are the only
  readers *(repo: the table hack moved the array the same way)*.
- **Placement.** Upper half (the `$80–$BF` form), never across a bank; at most 1024 families (32 KiB).
  The array sits between two rooms in bank `$9C`, so `--random` shuffles it with them.
- **Proven (G1).** Seeds 1, 2, 99 moved it (`$9C:D25E`, `$9C:8000`, `$9C:8F3C`); the playbacks played identically
  and no WRAM byte points into it (knowledge `asset_9cc322_background_palettes_tile_families`).
- **Limits.** Exactly 16 colours, each `#rrggbb` with channels in steps of 8 (`invalid-value`); no gap in the ids
  (`id-gap`).
- **Later:** sprite palettes (bank `$90`, full) as their own kind once their readers allow it
  ([../split-and-link/extending.md](../split-and-link/extending.md) §5).

## strings

**Folder.** `strings/<string>.txt`, UTF-8, with control codes written as tags *(the tag syntax: the same as the
VFS text view, to verify)*.

- **References.** Used by scripts (by name), and by code (string keys). Uses nothing.
- **Implode generates**: the key table *(repo: 3,002 keys)* and the string data.
- **Limits.** Characters the font has (`invalid-value`); strings only in lower halves, keys within one 32 KiB
  half ([../table-hack.md](../table-hack.md) §1).
- **Codec.** Decoder *(repo)*. G0 needs the compressor to reproduce the vanilla bytes; until there is one,
  unchanged strings are written as their original compressed bytes (cached by text hash) and only edited ones
  are written uncompressed (the key's bit 23 marks compressed strings *(repo)*; whether the engine accepts
  uncompressed strings everywhere is *(to verify)*).

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

## tiles — the master 16×16 tile graphics

**Folder.** `tiles/<tile>.png` (indexed, 16 colours, 16×16) + `tiles/_enum.json`.

- **Names.** `tile_<hexid>` at first; the user's example `floor_sand_01` comes from renaming. Naming 6,688 tiles
  is work for a tool: group by the rooms and families that use them, propose names, let the user accept
  ([progress.md](progress.md) S6).
- **References.** Used by maps (the graphics list and the metatile dictionary, by name). Uses nothing: the
  colours come from the family a map pairs it with.
- **Implode generates**: the master table at `$EE0000` *(repo: 6,688 tiles; ~21,800 possible after the move,
  to verify)*, ids from `tiles/_enum.json`.
- **Limits.** 16×16, at most 16 colours (`invalid-value`); a room's graphics list ≤ 264 slots
  ([../map-format/room-reference.md](../map-format/room-reference.md) §3) is a map limit.
- **Logic warnings.** Two tiles with identical pixels (`duplicate-content`); a tile no map uses (`unreferenced`).
- **Codec.** CHR decompression *(repo: [map_tile_graphics_decompression.md](../map-format/map_tile_graphics_decompression.md))*.
  PNG → CHR needs the colour index of each pixel, so the PNG must be indexed with the 16 slots in order
  (`invalid-value` otherwise). G0: unchanged tiles keep their original compressed bytes (cached by pixel hash)
  until the compressor reproduces them.

## maps — rooms *(built, S1)*

**Folder.**

```
maps/_enum.json                      names[id]: the map table's order (README.md §4)
maps/<map>/map.json                  one room
```

`map.json` today is the room model the repo's encoder reads and writes (`modelFromRom` / `buildBlob`
*(repo)*), losslessly, in JSON:

```jsonc
{
  "format": "open-evermore/map", "version": 2,
  "header": "…",                                   // 13 bytes, hex (room-reference.md §4)
  "stepOn":   [{ "area": [y1, x1, y2, x2], "script": 1234 }],
  "bTrigger": [{ "area": [y1, x1, y2, x2], "script": 1240 }],
  "tileFamilies": ["family_024", "family_025"],    // names in tile_families/ (version 2)
  "extras": "…",                                   // palette-cycle descriptors, hex
  "block1": { "sub": 3, "decomp": 492, "data": "…base64…" },   // graphics list, kept compressed
  "section2": { "count": 13, "data": "…" },        // animation channels
  "objectOffsets": [0, 41],
  "block2": { … }, "section4": "…", "block3": { … },            // grid, cuttable grass, dictionary
  "objectArea": "…"                                // objects and stamps (offsets relative to it)
}
```

The target is the readable form described below the table (tiles, families, scripts by name, grids decoded); it
comes as the kinds it references are exploded and the encoder can write decoded grids.

| Blob field *(repo)* | Target in `map.json` |
|---|---|
| graphics list (Block 1) | `"graphics": ["floor_sand_01", "tile_0a40", …]`: names in `tiles/` |
| tile families | `"families": ["desert_day", …]`: names in `palettes/` (≤ 7 loaded at once) |
| step-on / B-triggers | `{ "area": [y1, x1, y2, x2], "script": "pyramid_outside_door_north" }`: names in `scripts/` |
| enter script | `"enter": "pyramid_outside_enter"` |
| objects, animation, cuttable grass | as decoded, with tile references by name |
| grid, dictionary | arrays of local indices, decoded |

- **Names.** From `localizations/data/rooms.json` *(repo, our own wording)*: region + place + part in snake case
  (`prehistoria_jungle_south_where_the_game_starts`); `map_<hexid>` for a room it does not name.
- **Implode generates** the map table (127 × [24-bit pointer, pad 0], read by `$90:8F69` / `$90:8F6F` *(repo:
  `tools/table-hack/tables.js`)*), in place, in the enum's order. The pointer is the `$80–$BF:8000+` form.
- **Placement.** Upper half of a bank, never across a bank, ≤ 32 KiB *(repo: `writeRoomAt`)*. The vanilla rooms
  fill `$9C–$AD` upper halves to within a few hundred bytes per bank (other data follows each bank's last room),
  so `--random` shuffles rooms inside their bank; moving them between banks needs free space (`"size": "4MiB"`,
  [progress.md](progress.md) §2).
- **Proven (G1).** Seeds 42, 7, 123456, 99 moved 112–122 rooms; the stored playbacks played identically. The
  engine keeps six long pointers into the current blob (`knowledge/wram/DIRECT_PAGE_BLOCK.md`), all translated.
- **Limits.** Every field's range (`invalid-value`); blob ≤ 32 KiB (`over-budget`); 127 ids (the table stays put;
  the engine allows 256).
- **Still numbers:** graphics ids and script ids point into `_base/` until S3, S6.
- **Logic warnings** *(proposal; checked against vanilla first)*: a trigger outside the map; a door to an entrance
  that does not exist; an unused family slot; the Boy's start on a solid cell.

## scripts

**Folder.** `scripts/<script>.evs` once the compiler emits relocatable output, `scripts/<script>.bin` +
`<script>.json` (labels for its pointers) until then.

- **Names.** `<room>_enter`, `<room>_<trigger>`, and the names of global functions *(repo:
  `script-model/`, the script names of the Scripts tab)*; `script_<hexid>` otherwise.
- **References.** Use strings, maps, music, sounds, characters, animations, other scripts — all by name, as
  operands. Used by maps (triggers) and other scripts.
- **Implode generates**: the script pointer table *(repo: 1,917 entries)* and the room script tables; the
  operands that are ids are written from the locks.
- **Limits.** Bytecode never crosses a bank; every operand in range (opcode descriptions:
  `soe://rom/assets/scripts/opcodes/`).
- **Codec.** Decoder and model *(repo: `script-model/`, `script-vm/`, `rooms/data/room-scripts.ts`)*; encoding through the everscript compiler
  needs its relocatable output ([../split-and-link/tool.md](../split-and-link/tool.md) §7 *(owner's call)*).
  Until then: raw bytes with their pointer operands as labels.

## characters, sprites, animations

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
