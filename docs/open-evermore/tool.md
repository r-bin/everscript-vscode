# Open Evermore: the tool

Status: **built for maps, tile families, tiles, strings and scripts (2026-11-20).** Back to [README.md](README.md). Labels as there.

`tools/open-evermore/` is an L3 lab ([../projects/README.md](../projects/README.md) §1): TypeScript `.mts` run by
Node. It *calls* the compiled modules in `dist/` and copies none of them. Where this page says nothing,
[../split-and-link/tool.md](../split-and-link/tool.md) still holds (the compiler §7, promotion §10.4).

---

## 1. One tool, the action as its first argument

No npm commands (owner, 2026-11-19). `npm run build:ts` first: the codecs call the decoders in `dist/`.

```sh
T=tools/open-evermore/open-evermore.mts
node $T explode [rom] [--out <dir>] [--force] [--families json|png] [--tiles png|json]   # rom: else the library's base ROM; dir: out/open-evermore
node $T implode <dir> [--random [seed]] [--check-only] [--strict]
node $T prove <dir> [--random [seed]] [--movies <file|dir>…]
```

| Action | Does | Writes |
|---|---|---|
| `explode` | ROM → tree; refuses a folder in the repository outside `out/`, and an existing tree without `--force` | the tree |
| `implode` | validate, ids, encode, place (stable, or shuffled by `--random`, which grows the image to 4 MiB), tables, checksum, validate again | `<dir>/_build/evermore.sfc` (only without errors), `report.md`, `report.json` |
| `prove` | build the original and a random layout from the tree, play every stored playback recorded on the original in lockstep (G1, [README.md](README.md) §5.1) | `<dir>/_build/prove-<seed>/REPORT.md`, both ROMs, one result per playback |

Planned: `rename` (a resource and every reference to it, logged in the manifest), a BPS patch next to the ROM.

## 2. Files

| File | What |
|---|---|
| `open-evermore.mts` | the CLI: the three actions |
| `explode.mts` | `explode(rom, base, game, kinds, names?)` → tree in memory |
| `implode.mts` | `implode(tree, game, kinds, { seed, checkOnly })` → findings, image, placements; the stages of [validation.md](validation.md) §2 |
| `enum.mts` | `<kind>/_enum.json`: names → ids, new names, gaps, the limit |
| `layout.mts` | the allocator: stable or `seed`; placement rules (upper half, no bank crossing, size); free spans |
| `layouts.mts` | the cartridge layouts (manifest.md §1.1): free space beyond the base, pointer forms, the build (exhirom and sa1 through their converters) |
| `base.mts` | `_base/`: the unexploded image with the pool and tables blanked; homes; enum hashes |
| `manifest.mts` | `manifest.json`: types, schema and region checks, header agreement, the SNES checksum |
| `codec.mts` | the interface every kind implements (§4) |
| `prove.mts`, `play.mts` | the proof: two snes9x cores in one process, lockstep, pointer translation |
| `tree.mts`, `findings.mts`, `report.mts` | the tree as path → bytes; findings; terminal and `report.md` |
| `evermore/kinds.mts` | Evermore's kinds, in migration order — the only place with game facts, with `evermore/codecs/` |
| `evermore/codecs/maps.mts` | the maps kind ([resources.md](resources.md) §maps): files, names, placement, the map and enter-script tables (generated items) and `roomBlobs` (every kind walks the rooms through it); the room ↔ files mapping is `src/games/evermore/maps/tree-map.ts` |
| `evermore/codecs/tile-families.mts` | the tile families kind: the array and its two loader operands; JSON or PNG |
| `evermore/codecs/strings.mts` | the strings kind: the text form, the key table, our encoder |
| `evermore/codecs/scripts.mts` | the scripts kind ([resources.md](resources.md) §scripts): one `.txt` per script, groups, the pointer table, the boot pointer; `scriptLayout` names every script (the maps kind names enter scripts with it) |
| `evermore/codecs/tiles.mts` | the tiles kind: indexed PNG or pixel rows, the `$EE0000` table, kept bytes for the six bit-6 tiles |

## 3. Implode, step by step

Each step can be tested on its own (`tests/open-evermore/`):

1. **Manifest and base** (`manifest.mts`, `base.mts`): schema, regions cover the image, `_base/` unedited.
2. **Names → ids** (`enum.mts`): every kind's enum, before any encoding, since resources name other kinds.
3. **Encode** (each codec, in `kinds.mts` order): read, check, encode every resource into bytes with its placement
   rule. A kind may mark another's resources (`ctx.marks`: maps mark tiles `used`, animation frames `dma`), so it
   comes first.
4. **Place** (`layout.mts`): free space = the pool the kinds gave up + `free` manifest regions.
   - *stable*: every resource at its home if it still fits its old footprint; the rest first fit. An unchanged
     tree gives the original (G0).
   - *random (seed)*: the image grows to 4 MiB (the 4th MB free); resources shuffled inside the span they came
     from, among neighbours under the same rule, and about half move out of it. Same seed, same layout.
   - The layout's plans are tried smallest first: a hirom build that does not fit grows to 4 MiB, then exhirom
     (`grown`); exhirom and sa1 have one plan each (manifest.md §1.1).
5. **Build**: the content image (the base, each resource where it landed, each kind's tables, which must lie in
   the table space explode recorded, pointing through the layout's `ctx.pointer`), then the layout's cartridge
   image with its checksum.
6. **After**: the header against the manifest; G0 when nothing changed (resources, enums); the round trip
   (explode the image again, named by the tree's enums and with the manifest's `options`, compare each file's
   `canonical` form).

## 4. Codecs

```ts
interface Codec {
  kind: string; version: number; path: string;
  /** The name of resource `id` when nothing else names it. */
  defaultName(id: number): string;
  /** Only the names _enum.json lists get an id (scripts: one reached only by a call has none). */
  listedIdsOnly?: boolean;
  /** ROM → files, pool, table space, homes; `name(kind, id)` names any kind's resource (cross-kind references);
   *  `count(kind)`: a kind's enum length on a round trip (a grown table does not tell its length); `nameAt(kind,
   *  at)`: on a round trip, the tree's name for what implode put at a file offset (resources no enum orders). */
  explode(rom: Uint8Array, name: NameOf, options: Record<string, string>, count: CountOf, nameAt: NameAt): Exploded;
  /** What of a file the round trip compares, as [path, bytes]: content without derived or cached parts, and
   *  without the file format (a tile PNG or JSON compare by indices). */
  canonical?(path: string, bytes: Uint8Array): [string, Uint8Array];
  /** The resource names in the tree (unordered); stray files are warnings. */
  names(ctx: ImplodeContext): Set<string>;
  /** Check and encode; findings go to ctx.findings. */
  encode(ctx: ImplodeContext, names: Set<string>): Item[];
  /** Named addresses inside this kind's items once placed (`scripts/<name>` inside a group): ctx.symbols. */
  symbols?(ctx: ImplodeContext, placed: Map<string, number>): Map<string, number>;
  /** The generated tables, from ctx.ids, ctx.symbols and where each resource landed: in the table space explode
   *  recorded, in a `generated` item (a table that can grow: encode gives its size, it is placed like any item) or
   *  in a `patched` one (absolute references written after placement). */
  tables(ctx: ImplodeContext, placed: Map<string, number>): Write[];
}
```

An **item** may carry, besides its rule (`upperHalf`, `lowerHalf`, `below`, `noCrossBank`, `maxSize`):
`window` (it lives in upper halves read as one space and may run on into the next bank's: script code), `holes`
(byte ranges inside it that are not its own and stay free for others), `generated` (a table: its bytes are written
by `tables`, never counted as changed) and `patched` (`tables` writes references into it; explode records its home
sha1 with those operands as 0). Stages: names (every kind's, `ctx.names`) → enums → encode in kind order (a kind
may `mark` another's resources: maps mark the scripts they enter) → place → symbols → tables → build → round trip.

**Laws:** explode is lossless (the maps codec refuses a room whose encoding does not give its bytes back); every
resource is reached only through `tables` (the hard rule); a kind enters `evermore/kinds.mts` only when stable,
random and `prove` pass.

**Reused, not copied** *(repo)*:

| Kind | Decoder | Encoder |
|---|---|---|
| maps | `src/games/evermore/maps` (`modelFromRom`, `parseBlobLayout`, `objectAreaEnd`) | `buildBlob` |
| tile families | `maps.decodeRoom` (the count, the users), the bytes themselves (BGR555); `platform/png` | BGR555 from `#rrggbb` or a PNG cell |
| tiles | `decodeTile`, `decodeTilePixels` (chr.ts) | `encodeTilePixels`, `encodeTile` |
| map blocks | `unpackBlock`, `decompressMarkovGrid` | `lzssCompressVanilla`, `encodeBlock2` |
| strings | our reader (the same as `localizations/strings.ts`, with extents) | our fewest-bytes encoder |
| names | `src/games/evermore/localizations/data/rooms.json` | — |
| next kinds | `src/platform/cdl/table-assets.ts`, `resources/`, `script-model/`, `sprites/` | to write per kind |

### 4.1 The proof

`play.mts` boots the extension's snes9x core twice, each in its own VM context, and feeds both the same playback
frame by frame. A WRAM difference passes only when every differing byte lies in a pointer to the same resource and
offset in both ROMs: long (`$80–$BF:8000+` or `$C0–$FF`, the forms may differ, or one past its end), 16-bit with its
bank kept elsewhere, or a lone bank byte; or in dead stack below an equal stack pointer. Screen, VRAM (save state
offset `0xC14`) and PC are compared every 60 frames. A frame out of step starts a drift, which must end in step
within 60 frames (`MAX_DRIFT`), and the playback must end in step. Only differing frames are examined; nothing per frame is written (spare the SSD). The original must keep
the playback's own WRAM checks, or the proof does not count.

## 5. Editors

**Maps, read (2026-11-19).** The Rooms tab finds trees in the workspace (a folder, or one up to two levels below,
whose `manifest.json` is an Evermore tree's) and lists each tree's maps by name under *Open Evermore*. A map is read
from its four files with the codec implode uses (`src/games/evermore/maps/tree-map.ts`), its names resolved through
the tree's `_enum.json` files, and built into a copy of an Evermore image (`src/games/evermore/imports/tree/`): the
tree's `_build/evermore.sfc` when implode left a 3 MiB one, so edited tiles and families show once imploded, else
the library ROM. The tab then draws, inspects and edits it like a ROM room. Files that do not build show the
findings. Tested: `tests/open-evermore/tree-editor-dom.test.mts` (every map draws as the vanilla room; an edit to
`grid.txt` shows).

**Still to do.** The editor saving into the tree (a draft → the room's files; until then, *duplicate as a custom
map* keeps the work); Play in emulator for a tree map (implode, then run `_build/evermore.sfc`); commands for the
three actions; `report.json` as Problems-panel diagnostics. Other kinds are seen through an imploded ROM:
`soe://rom/…?rom=<dir>/_build/evermore.sfc` *(repo)*.

## 6. Tests

| Test | Tier | What |
|---|---|---|
| `tests/open-evermore/enum-layout.test.mts` | unit | the enum (ids, gaps, new names, limit, bad names) and the allocator (rules, stable, random, seeds, no space) apart |
| `tests/open-evermore/implode.test.mts` | unit | a synthetic kind on a synthetic image: G0, random + round trip, enum reorder, changed resource, every error |
| `tests/open-evermore/formats.test.mts` | unit | the compact JSON layout; the PNG decoder (RGB, every row filter, indexed at 1/4/8 bits) |
| `tests/memory/map-units.test.js` | unit | `decodeTile` (bit-6 forms), `encodeTile`, `lzssCompressVanilla` round trips |
| `tests/open-evermore/in-game.test.mts` | `emulator` | G2 in the running game (~1 min), every change made as tree files: the opening's folder holding Brian's files boots into Brian's map (screen and VRAM as vanilla's Brian's room in slot `0x61`); a copy of Brian's room under a new name gets id `0x7F`, both map tables move, `load_map(0x7F)` enters it (screen and VRAM as vanilla's Brian's room), and without the map it does not (the new map has its own `fade_in` enter script; the entering script is the opening's enter script, edited); a new string past the key table, shown by a script (WRAM text as the string it copies). Screenshots in `out/open-evermore-tests/` |
| `tests/open-evermore/g0.test.mts` | `rom` | the base ROM: stable = vanilla sha1 with no warning (also with PNG families); two 4 MiB seeds move > 100 resources and round-trip; missing tile or family, bad colour or pixel row; an edited metatile re-compressed; scripts (an edited one round-trips; unknown `@name`, a relative call out of reach, a bad line); a new tile, string and table script grow and move their tables; every limit the engine's |
| `open-evermore.mts prove` | on demand | the playbacks; seconds today, never in a test tier (`test-discipline` skill) |
