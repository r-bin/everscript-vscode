# maps/ — ROM Map Decoder

A **TypeScript port** of the verified room/map decoder from the sibling `everscript`
repo (`tools/dump_room.py`, `collision.py`, `cuttable_grass.py`). Pure: takes a ROM
buffer, returns data. No VS Code API, no filesystem, no rendering.

## Why a port and not a re-derivation

This repo twice shipped independent guesses at logic `everscript` already implemented
correctly — the old sentinel-scan tilemap decoder (now shelved in `sandbox/maps/`,
which failed outright on room `0x38`) and `tools/generate_data.py`'s regex grammar. This
is not that: it is a line-by-line port of an implementation that round-trips all 127
vanilla rooms byte-exactly, and `npm run check:maps` proves the port still agrees with
it. See the `map-format` and `rom-map-data` skills.

## Files

| File | Description |
|---|---|
| `rom.ts` | SNES↔ROM address translation, little-endian reads, map pointer table |
| `lzss.ts` | LZSS sliding-window decompressor ($8C98C9) and raw copy ($8C98B1) |
| `markov.ts` | 2D context-predictive Markov bitstream decoder ($8C9BD0) |
| `blob-layout.ts` | Deterministic section-offset resolution inside a room blob |
| `collision.ts` | Collision word bitfield: geometry, planes, drift, entity gates |
| `cuttable-grass.ts` | Section 4 metatile swap table |
| `room.ts` | `decodeRoom()` — assembles the full room model |
| `palette.ts` | Tile-family palettes, BGR555→RGB888, room CGRAM |
| `chr.ts` | 16x16 CHR decompression and 4bpp planar tile decoding |
| `render.ts` | Layer rasterization and SNES Mode 1 compositing (TM/TS, priority, CGADSUB) |
| `metatiles.ts` | The metatile dictionary as a placement palette — entries, usage counts, and an atlas |
| `vanilla-index.ts` | What the 127 rooms already attest: graphic → tile family, graphic → collision |
| `vanilla-adjacency.ts` | The grid walk behind it: undirected adjacency (tile ranking) and, off the same edges, per-side per-layer neighbours (`directionalNeighbours`, §8b) |
| `encode.ts` | The write path: block encoders, `buildBlob`, `modelFromRom`, `writeRoomAt` (port of `encode_room.py`) |
| `encode-streams.ts` | The LZSS and Markov compressors `encode.ts` uses |
| `custom-room.ts` | A custom map's resolved grid → a room blob, borrowing a donor's graphics ([rom-export.md](../../docs/map-format/rom-export.md)) |
| `budget.ts` | The four ceilings (graphics, families, stamps, WRAM) and what an edit adds to them |
| `overlay-features.ts` | Classifies a room into feature sets; builds the legend and summary |
| `overlay-shapes.ts` | The raster primitives the overlay paints with (contours, grass, arrows) |
| `collision-overlay.ts` | Draw-order orchestration for the feature overlay — a port of `render_full_composition` |
| `font.ts` | The 3x5 bitmap font the overlay labels boxes with |
| `png.ts` | PNG encoding (zlib deflate + CRC-32) |
| `index.ts` | Public API |
| `index.js` | CommonJS facade; requires the compiled output in `dist/` |
| `alchemy-model.js` | Alchemy damage tables (unrelated to map decoding; predates the port) |
| `render-script-model.js` | Opcode 0x93 render-script trace decoder |

## Build

The root `tsconfig.json` is typecheck-only (`noEmit`), so this domain has its own emit
config:

```
npm run build:maps     # tsc -p tsconfig.maps.json  ->  src/maps/dist/
npm run check:maps     # diff the port against the Python implementation
```

`dist/` is gitignored and rebuilt by `npm test`, `npm run package` and `npm run deploy`.
Consumers should `require('../maps')` (the facade), never `./dist` directly.

## Model shape

Every grid is **numbers**, never hex strings. Upstream returns both forms and warns that
mixing them silently produces wrong results; the port keeps only the numeric form and
formats at render time.

```js
const { decodeRoom } = require('../maps');
const room = decodeRoom(romBuffer, 0x38);
room.header.widthTiles;           // 83
room.collisionWords[y][x];        // 16-bit collision word — decode with ./collision
room.layer1MetatileIds[y][x];     // metatile ID (WRAM offset)
room.triggers.stepOn[i].scriptId; // matches script_all's "id:" field
```

Never interpret a collision word by hand — use `passability()`, `tilePlane()`,
`driftVector()`, `entityGate()`. The bitfield is not obvious and a hand-reading of it
was wrong for years upstream.

## Dependency Rules

- No VS Code API
- No imports from other `src/` domains
- No webview rendering (the Rooms tab owns its own — see `src/rooms/rendering/tile-overlay.js`)
- No banners: `render_full_composition` grows the PNG to fit a header and legend;
  the port emits neither, because the Rooms tab needs the raster to stay exactly
  the size of the map so it keeps registering with the interactive SVG layer.
  `buildSummary()` and `buildLegend()` hand that text to the webview as data.
- Testable in plain Node.js (`tests/memory/map-parity.test.js`)

## Sprites

`sprites.ts` decodes character and object sprites — block pools, the
bit-per-word compression, and chunk composition — ported from
SoETilesViewer. Pinned by `checkSprites` against the reference's own walk
count of 5128.

Going from a character to a picture is three layers, each its own file:

| File | Owns |
|---|---|
| `character-record.ts` | the table at `$8EB678` — palette, disposition, hitbox, and which animation record a facing selects |
| `character-animation.ts` | walking that animation script into frames |
| `characters.ts` | blitting those frames, origin-aligned, in the character's palette |

See
[docs/script-format/sprite_format.md](../../docs/script-format/sprite_format.md),
[animation_format.md](../../docs/script-format/animation_format.md),
[character_table.md](../../docs/script-format/character_table.md),
[hitboxes.md](../../docs/script-format/hitboxes.md),
[attack_boxes.md](../../docs/script-format/attack_boxes.md),
[palettes.md](../../docs/script-format/palettes.md) and
[sprite_priority.md](../../docs/script-format/sprite_priority.md).

`render.ts` also renders the **canopy** — `renderRoomForeground`, the pixels
a character standing in the room *can* be drawn behind. In Mode 1 that is
the priority half of whichever layer won.

Whether a given character is actually behind it is a per-tile question:
`$8FC773` reads the collision word of the tile it stands on, compares planes
and then tests bit 12, which is set on 84% of vanilla tiles. Use
`spawnDepth()` for a resting spawn and `spriteDepth()` when the character's
own plane is known — see
[docs/script-format/sprite_priority.md](../../docs/script-format/sprite_priority.md).

`hiddenTileMask()` answers the other half of the same picture: which
metatiles the player genuinely cannot see the ground of — the foreground
covers them **and** bit 12 says a character there is drawn behind it. The
second half matters: priority art is also used for plain floor, so coverage
alone calls a third of room `0x06` hidden. Passed to `drawCollisionOverlay`
as `hidden` it makes every plane solid in its own colour and dots only the
boundaries the foreground hides. Omit it and the drawing is upstream's, byte
for byte.

## The tile palette

`metatiles.ts` exposes the room's **metatile dictionary**: the 16x16 stamps
that can actually be placed. A grid cell stores a metatile id, and Block 3
turns it into a Layer 1 word, a Layer 2 word and a collision word — so a
metatile is a whole stack, and nothing outside the dictionary can be placed
without extending it.

`renderMetatileAtlas` draws the whole dictionary by building a *synthetic
room* whose tilemaps are the dictionary and handing it to
`renderRoomComposite`, rather than reimplementing Mode 1 compositing for one
tile. `checkMetatilePalette` requires every sampled atlas cell to be
pixel-identical to the same metatile in the room it came from.

See [docs/map-format/map_editor_ui.md](../../docs/map-format/map_editor_ui.md).
