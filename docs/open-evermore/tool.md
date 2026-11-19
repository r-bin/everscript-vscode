# Open Evermore: the tool

Status: **built for maps, tile families and tiles (2026-11-19).** Back to [README.md](README.md). Labels as there.

`tools/open-evermore/` is an L3 lab ([../projects/README.md](../projects/README.md) §1): TypeScript `.mts` run by
Node. It *calls* the compiled modules in `dist/` and copies none of them. Where this page says nothing,
[../split-and-link/tool.md](../split-and-link/tool.md) still holds (the compiler §7, promotion §10.4).

---

## 1. One tool, the action as its first argument

No npm commands (owner, 2026-11-19). `npm run build:ts` first: the codecs call the decoders in `dist/`.

```sh
T=tools/open-evermore/open-evermore.mts
node $T explode [rom] [--out <dir>] [--force] [--families json|png]   # rom: else the library's base ROM; dir: out/open-evermore
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
| `base.mts` | `_base/`: the unexploded image with the pool and tables blanked; homes; enum hashes |
| `manifest.mts` | `manifest.json`: types, schema and region checks, header agreement, the SNES checksum |
| `codec.mts` | the interface every kind implements (§4) |
| `prove.mts`, `play.mts` | the proof: two snes9x cores in one process, lockstep, pointer translation |
| `tree.mts`, `findings.mts`, `report.mts` | the tree as path → bytes; findings; terminal and `report.md` |
| `evermore/kinds.mts` | Evermore's kinds, in migration order — the only place with game facts, with `evermore/codecs/` |
| `evermore/codecs/maps.mts` | the maps kind ([resources.md](resources.md) §maps) |
| `evermore/codecs/tile-families.mts` | the tile families kind: the array and its two loader operands; JSON or PNG |
| `evermore/codecs/tiles.mts` | the tiles kind: pixel rows, the `$EE0000` table, kept bytes for the six bit-6 tiles |

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
   - A stable build that does not fit grows to 4 MiB too (`grown`).
5. **Build**: the base, each resource where it landed, each kind's tables (they must lie in the table space
   explode recorded), the header checksum.
6. **After**: the header against the manifest; G0 when nothing changed (resources, enums); the round trip
   (explode the image again, named by the tree's enums and with the manifest's `options`, compare; keys a codec
   lists as `derived` are left out).

## 4. Codecs

```ts
interface Codec {
  kind: string; version: number; path: string;
  /** The name of resource `id` when nothing else names it. */
  defaultName(id: number): string;
  /** ROM → files, pool, table space, homes; `name(kind, id)` names any kind's resource (cross-kind references). */
  explode(rom: Uint8Array, name: NameOf, options: Record<string, string>): Exploded;
  /** JSON keys (any depth) explode derives or caches; the round trip skips them. */
  derived?: string[];
  /** The resource names in the tree (unordered); stray files are warnings. */
  names(ctx: ImplodeContext): Set<string>;
  /** Check and encode; findings go to ctx.findings. */
  encode(ctx: ImplodeContext, names: Set<string>): Item[];
  /** The generated tables, from ctx.ids and where each resource landed. */
  tables(ctx: ImplodeContext, placed: Map<string, number>): Write[];
}
```

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

## 5. Editors (after promotion)

Until promotion, the editor sees an imploded ROM the usual way: `soe://rom/…?rom=<dir>/_build/evermore.sfc`
*(repo)*. After promotion: commands for the three actions, `report.json` as Problems-panel diagnostics, and the
editors writing into the tree (the Rooms map editor saves `maps/<map>/map.json`).

## 6. Tests

| Test | Tier | What |
|---|---|---|
| `tests/open-evermore/enum-layout.test.mts` | unit | the enum (ids, gaps, new names, limit, bad names) and the allocator (rules, stable, random, seeds, no space) apart |
| `tests/open-evermore/implode.test.mts` | unit | a synthetic kind on a synthetic image: G0, random + round trip, enum reorder, changed resource, every error |
| `tests/open-evermore/formats.test.mts` | unit | the compact JSON layout; the PNG decoder (RGB, every row filter) |
| `tests/memory/map-units.test.js` | unit | `decodeTile` (bit-6 forms), `encodeTile`, `lzssCompressVanilla` round trips |
| `tests/open-evermore/g0.test.mts` | `rom` | the base ROM: stable = vanilla sha1 with no warning (also with PNG families); two 4 MiB seeds move > 100 resources and round-trip; missing tile or family, bad colour or pixel row; an edited metatile re-compressed |
| `open-evermore.mts prove` | on demand | the playbacks; seconds today, never in a test tier (`test-discipline` skill) |
