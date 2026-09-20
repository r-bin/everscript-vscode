# Map Format Documentation

**Imported from the sibling `everscript` repo.** These documents describe the Secret of
Evermore ROM map/room binary format, reverse-engineered and verified there against a
byte-exact round-trip of all 127 vanilla rooms.

They are the specification the TypeScript port in `src/maps/` implements. If a document
here and the code disagree, the document is probably right — but check `everscript`'s
copy first, since that's the upstream.

| Document | Answers |
|---|---|
| `rom-map.md` | Where each of the 127 room blobs lives in ROM — offsets, sizes, compression flags, elevation planes, cuttable-grass counts |
| `map_decompression_trace_analysis.md` | How the decompression pipeline was reverse-engineered; the deterministic block layout |
| `map_encoding.md` | Container layout, LZSS + Markov encoders, the never-grows guarantee (the write path) |
| `map_collision_mechanics.md` | The collision word bitfield — geometry, elevation planes, drift, entity gates |
| `cuttable_grass_mechanics.md` | The metatile swap table driven by `$90A6EF` |
| `map_objects.md` | Section 3 object structure and states |
| `map_rendering_pipeline.md` | Turning a decoded room into pixels; Mode 1 compositing |
| `map_tile_graphics_decompression.md` | CHR tile graphics decompression |
| `map_palette_extraction.md` | How palettes are built |
| `map_editor_design.md` | Design decisions for a map editor (repo placement, extend vs. fork) |
| `map_editor_architecture_and_limitations.md` | Architecture and known limitations |
| `map_editor_vscode_plan.md` | Repo placement, lexer/parser reuse, IPC/packaging options |

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
