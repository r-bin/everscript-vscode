---
name: map-format
description: Use before reading, decoding, encoding or drawing Secret of Evermore room data (games/evermore/maps, docs/map-format). Where each fact is documented, how the port is checked, what not to re-derive.
applyTo: "src/games/evermore/maps/**,src/games/evermore/rooms/rendering/tile-overlay.js,docs/map-format/**"
---

# Evermore room format

The room format is decoded in both directions; treat `docs/map-format/` as established fact except
where a line says UNVERIFIED. `src/games/evermore/maps/*.ts` is a TypeScript port of the sibling
`everscript` repo's verified Python (`everscript/tools/dump_room.py`, `collision.py`,
`cuttable_grass.py`, `render_map.py`), held to it by a parity test.

## Rules

- **Port, never re-derive.** This repo twice shipped a weaker guess at something `everscript` had
  solved byte-exact (a sentinel block scanner that failed on room `0x38`; a regex scraper of
  `.evs` files). If a room decodes wrong, fix the logic the Python has; fix it in `everscript`
  too — its copy is the reference.
- **Check every change**: `npm run check:maps` (the decoder and renderer against the Python, RGBA
  pixel for pixel); `MAP_PARITY_ALL=1` for all 127 rooms. It **skips** without the ROM or an
  `everscript` checkout — read the output, a green run that compared nothing means nothing.
- Never hand-decode a collision word: `passability()`, `tilePlane()`, `driftVector()`,
  `entityGate()` in `collision.ts`. Grids are numbers; format hex at render time.
- Something the original can draw (overlays, annotations) is ported, not approximated —
  `docs/map-port-gap-analysis.md` gap 1.2 records the time it was hand-drawn and missed entity gates.
- The TextMate grammar is the deliberate exception to "reuse the compiler" (`grammar-rules` skill).

## The facts in one paragraph

Map pointer table at `$9F:FDE7` (file `0x1FFDE7`), 4 bytes per room (24-bit pointer + pad), 127
rooms; slot `$7F` is not a room. A blob: 13-byte header (origin, size in 16×16 metatiles, PPU
TM/TS/CGADSUB/CGWSEL, effect variant), step-on and B-trigger tables (6 bytes each, compared in
16-pixel tiles plus the origin), tile families, CHR descriptors, then three payload blocks:
Block 1 (delta tile palette, LZSS or raw → `$7F:C300`), Block 2 (2-D Markov metatile grid →
`$7F:0000`), Block 3 (metatile table, LZSS; three planes: BG2 word, BG1 word, collision word),
with section 2 (tile animation) and section 4 (cuttable grass, objects) between them. Every byte
of a blob belongs to a field; the blob ends at its furthest object record or stamping block.

## Which document answers which question

| Question | Document |
|---|---|
| Everything at once: every segment, limits, decoder and engine routine | `docs/map-format/room-reference.md` (start here) |
| Where each room is, sizes, compression flags | `docs/map-format/rom-map.md` |
| How the decompression was traced | `docs/map-format/map_decompression_trace_analysis.md` |
| Writing a room back (LZSS + Markov encoders, never grows) | `docs/map-format/map_encoding.md` |
| Collision word: planes, drift, gates, bits 12–15 | `docs/map-format/map_collision_mechanics.md` |
| Cuttable grass / objects / animated tiles | `docs/map-format/cuttable_grass_mechanics.md`, `map_objects.md`, `map_animated_tiles.md` |
| Rendering, CHR graphics, palettes | `docs/map-format/map_rendering_pipeline.md`, `map_tile_graphics_decompression.md`, `map_palette_extraction.md` |
| What the editor adds (stamps, widgets, levels, entrances) | `docs/map-format/editor-concepts.md`, `map-editor-rules` skill |
| Characters, sprites, bodies, damage | `docs/script-format/entities-reference.md`, `map-entities` skill |
| Open questions | `docs/map-format/room-reference.md` §12, `docs/map-port-gap-analysis.md` |

## In this repo

- Read path: `room.ts`, `blob-layout.ts`, `lzss.ts`, `markov.ts`, `palette.ts`, `chr.ts`, `render.ts`,
  `collision.ts`. Write path (custom rooms, Export / Play ROM): `encode.ts`, `encode-streams.ts`,
  `object-encode.ts`, `custom-room.ts`. JS requires the compiled `dist/games/evermore/maps/`
  through `maps/index.js`.
- The Rooms tab decodes on demand per room (`rooms/editor-host.js` `requestRoomTiles` →
  `rooms/rendering/tile-overlay.js`, which caches the 12 latest renders); the room tree carries no
  tile data. `rom-readers.js` caches the ROM by path and mtime.
- Python-side runbook (inspect, round-trip, render): `everscript/tools/dump_room.py`,
  `everscript/tools/encode_room.py --verify`, `everscript/tools/render_map.py`; their skill is
  `everscript/.github/skills/rom-map-data`. When it and this repo disagree, the Python wins.
