# Map Format Documentation

**Imported from the sibling `everscript` repo.** These documents describe the Secret of
Evermore ROM map/room binary format, reverse-engineered and verified there against a
byte-exact round-trip of all 127 vanilla rooms.

They are the specification the TypeScript port in `src/maps/` implements. If a document
here and the code disagree, the document is probably right — but check `everscript`'s
copy first, since that's the upstream.

| Document | Answers |
|---|---|
| **`room-reference.md`** | **Start here.** The blob segment by segment: byte layout, hard limits and vanilla maxima, decoder/encoder, engine routine, what is not in the blob, what is still not understood |
| **`editor-concepts.md`** | What the editor adds on top of the data (stamps, layers, levels, specials, widgets, groups, entrances, the Boy, custom maps), which bytes each becomes, known gaps |
| `rom-map.md` | Where each of the 127 room blobs lives in ROM — offsets, sizes, compression flags, elevation planes, cuttable-grass counts |
| `map_decompression_trace_analysis.md` | How the decompression pipeline was reverse-engineered; the deterministic block layout |
| `map_encoding.md` | Container layout, LZSS + Markov encoders, the never-grows guarantee (the write path) |
| `map_collision_mechanics.md` | The collision word bitfield — geometry, elevation planes, drift, entity gates |
| `cuttable_grass_mechanics.md` | The metatile swap table driven by `$90A6EF` |
| `map_objects.md` | Section 3 object structure and states |
| `map_rendering_pipeline.md` | Turning a decoded room into pixels; Mode 1 compositing |
| `map_tile_graphics_decompression.md` | CHR tile graphics decompression |
| `map_animated_tiles.md` | Section 2 animation channels — frame table, palette extension, and what it takes to play them outside the game |
| `map_palette_extraction.md` | How palettes are built |
| `map_editor_design.md` | Design decisions for a map editor (repo placement, extend vs. fork) |
| `map_editor_architecture_and_limitations.md` | Architecture and known limitations |
| `map_editor_vscode_plan.md` | Repo placement, lexer/parser reuse, IPC/packaging options |
| `map_editor_ui.md` | **The editor's UI**: which tiles can be placed, editing layers independently, resize, and the write-back plan |
| `building-a-room-from-scratch.md` | **Tutorial**: five rooms of increasing difficulty, built and verified; every header field named; the blob as JSON |
| `building-a-room-from-a-picture.md` | Drafting a room from vanilla's vocabulary — the vanilla index, portable constructs, the deco library |
| `collision-suggestions.md` | The collision a painted tile gets from vanilla, stairs, and the two collision views |
| `custom-map-files.md` | **Custom maps on disk**: `map.json`, `history.json`, the export archive, and the widget library `widgets.json` |
| `enemy-sprites-on-maps.md` | Drawing enemy sprites over a map, and why they can't be painted as map tiles without a sprite-to-family import |
| `rom-export.md` | Export ROM: a custom map in room 0x15 — grid, dictionary, cuttable grass, animated tiles — and the round-trip check |
| `secret-of-mana-comparison-and-porting.md` | **Secret of Mana comparison & porting**: how SoM maps work, differences from Evermore, and step-by-step map conversion feasibility |

## Upstream

`/Users/v/Documents/GitHub/everscript/docs/` (and `.github/rom-map.md`), resolvable at
runtime via the `everscript.repoPath` setting. Re-copy from there rather than editing
these in place, unless the change is specific to this repo's TypeScript port.

Note that `map_editor_vscode_plan.md` §3.2 argues the ROM-format logic should stay
Python and be reached over IPC. That recommendation was **superseded**: this repo ports
the decoder to TypeScript instead, to avoid requiring a Python runtime for extension
users. The distinction that makes this safe is in the `map-format` skill — a faithful
port validated against the Python implementation's own output is not the same thing as
the independent re-derivations that failed here before.

## Related

Script, entity and sprite formats are documented in
[../script-format/](../script-format/README.md); its index across sprites, bodies,
attacks, damage and animation is
[entities-reference.md](../script-format/entities-reference.md).
