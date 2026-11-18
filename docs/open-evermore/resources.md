# Open Evermore: the resource kinds

Status: **design (2026-11-18), nothing built.** Back to [README.md](README.md). Labels as there.

Every kind gets the same description. **Folder**: what lives where. **References**: which names it uses, and who
uses its names. **Implode generates**: the tables and counts it writes from the folder. **Limits**: what implode
checks. **Codec**: the decoder and encoder in the repo it reuses (never copies, AGENTS.md §0.9). Counts and
addresses are US 1.0 *(repo)*.

The order of this page is the migration order ([progress.md](progress.md)).

---

## raw — everything not yet exploded

**Folder.** `raw/<region>.bin` + `raw/_raw.json`:

```jsonc
{ "regions": [ { "name": "c0_8000", "at": "$C08000", "length": "0x1234", "file": "c0_8000.bin",
                 "sha1": "…", "why": "not yet exploded" } ] }
```

- Named by address, since nothing else knows them. A region is pinned to its address.
- Each step of [progress.md](progress.md) cuts bytes out of `raw/` and gives them to a kind. When `raw/` is empty,
  the folder describes the whole ROM.
- **Limits.** A `.bin` whose length or sha1 differs from `_raw.json` is an error (`raw-changed`): raw bytes are
  not for editing, since nothing checks what they mean.

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

## palettes — tile families

**Folder.** `palettes/<family>.json`: 16 colours as `#rrggbb` (the 15-bit SNES colour shown in 24 bits;
implode checks that the low 3 bits of each channel are 0).

- **References.** Used by maps (a room's family slots, by name). Uses nothing.
- **Implode generates**: the family table at `$9CC322` *(repo: 365 families; moved once and proven,
  [../extension-tables.md](../extension-tables.md))*, ids from `palettes/_ids.json`.
- **Limits.** Exactly 16 colours (`invalid-value`). A family no map uses is a warning (`unreferenced`).
- **Codec.** Palette decoding *(repo: `resources/`, `maps/` palette extraction)*; encoding is the inverse
  (trivial).
- **Later:** sprite palettes (bank `$90`, full) as `palettes/sprites/` once their readers allow it
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

**Folder.** `tiles/<tile>.png` (indexed, 16 colours, 16×16) + `tiles/_ids.json`.

- **Names.** `tile_<hexid>` at first; the user's example `floor_sand_01` comes from renaming. Naming 6,688 tiles
  is work for a tool: group by the rooms and families that use them, propose names, let the user accept
  ([progress.md](progress.md) S6).
- **References.** Used by maps (the graphics list and the metatile dictionary, by name). Uses nothing: the
  colours come from the family a map pairs it with.
- **Implode generates**: the master table at `$EE0000` *(repo: 6,688 tiles; ~21,800 possible after the move,
  to verify)*, ids from `tiles/_ids.json`.
- **Limits.** 16×16, at most 16 colours (`invalid-value`); a room's graphics list ≤ 264 slots
  ([../map-format/room-reference.md](../map-format/room-reference.md) §3) is a map limit.
- **Logic warnings.** Two tiles with identical pixels (`duplicate-content`); a tile no map uses (`unreferenced`).
- **Codec.** CHR decompression *(repo: [map_tile_graphics_decompression.md](../map-format/map_tile_graphics_decompression.md))*.
  PNG → CHR needs the colour index of each pixel, so the PNG must be indexed with the 16 slots in order
  (`invalid-value` otherwise). G0: unchanged tiles keep their original compressed bytes (cached by pixel hash)
  until the compressor reproduces them.

## maps — rooms

**Folder.**

```
maps/pyramid_outside/
  map.json            the room: header, families, grid, dictionary, triggers, objects, animation — by name
  scripts/            the room's enter and trigger scripts (or references into scripts/, see below)
```

`map.json` is the decoded blob ([../map-format/room-reference.md](../map-format/room-reference.md) §3), as in
the blob-as-JSON of [../map-format/building-a-room-from-scratch.md](../map-format/building-a-room-from-scratch.md)
§2, with every id replaced by a name:

| Blob field *(repo)* | In `map.json` |
|---|---|
| graphics list (Block 1) | `"graphics": ["floor_sand_01", "tile_0a40", …]`: names in `tiles/` |
| tile families | `"families": ["desert_day", …]`: names in `palettes/` (≤ 7 loaded at once) |
| step-on / B-triggers | `{ "area": [y1, x1, y2, x2], "script": "pyramid_outside_door_north" }`: names in `scripts/` |
| enter script | `"enter": "pyramid_outside_enter"` |
| music (set by the enter script) | in the script, by name |
| objects, animation, cuttable grass | as decoded, with tile references by name |
| grid, dictionary | arrays of local indices, as decoded (the grid is the bulk; JSON arrays of numbers) |

- **Names.** From the room names already in the repo (`Antiqua › Pyramid › outside` → `pyramid_outside`
  *(repo: `soe://rom/assets/maps/06/info.md`)*; D4: no new third-party names); `map_<hexid>` otherwise.
- **References.** Used by scripts (doors: `change_map("pyramid_outside", entrance)`) and code that names a room.
  Uses tiles, palettes, scripts, music.
- **Implode generates**: each blob (`buildBlob`), the map table in bank `$9F` *(repo: 127 rooms)*, the enter
  script pointers (`$928000 + 0x1B + 5·room` *(repo)*), ids from `maps/_ids.json`.
- **Limits.** Every limit of the room reference table (sizes, 264 graphics, 7 families, 255 objects …, §3
  there); blob ≤ 32 KiB, upper half, never across a bank.
- **Logic warnings** *(proposal; each to be checked against vanilla first, so vanilla raises none it does
  not deserve)*: a trigger outside the map; a door target entrance that does not exist; a family slot no
  dictionary entry uses; the Boy's start on a solid cell.
- **Codec.** `modelFromRom` → `buildBlob` round-trips all 127 rooms byte for byte *(repo:
  `tests/memory/rom-export.test.js`)*. The map editor's custom map files
  ([../map-format/custom-map-files.md](../map-format/custom-map-files.md)) stay the editor's own format; the
  editor later saves into `maps/` (§ "Editors" in [tool.md](tool.md)).

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
