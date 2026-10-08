# rom/ — ROM tab

The radar panel's **ROM** tab: a map of every 64 KB bank of the loaded ROM, split into its two
32 KB halves (nothing in Secret of Evermore crosses a half line), with what each region is, how
big it is, which world uses it, and what the CDL recorder saw.

Reference: the everscript wiki's ROM map (`wiki/rom/Rom-Map.md`), whose §4 this tab computes live.

| File | Role |
|---|---|
| `index.js` | Public API: `buildRomModel`, `handlesRomMessage` / `handleRomMessage`, `buildRomTabHtml` |
| `build.js` | ROM bytes (+ CDL, wiki text, room names) → model. Pure |
| `host.js` | The webview's `romMapRequest` / `romReaders`; caches one model per ROM hash. No `vscode` |
| `render-rom-tab.js` | The pane scaffold; content arrives by message |
| `model/catalog.js` | Fixed-place content: header, rooms, palettes, strings, scripts, entities, alchemy |
| `model/assets.js` | Map graphics, sprite infos/blocks, animation bytecode, measured item by item |
| `model/audio.js` | Song descriptors and every byte each song loads |
| `model/layout.js` | One owner per byte, rows per half, gaps, overlap notes, strips, CDL counts |
| `model/points.js` | Curated routine / table names (points without a size) |
| `model/wiki-overlay.js` | Extra points from the wiki's §4 rows |
| `model/readers.js` | "Which code reads these bytes", from the CDL library's xrefs |
| `webview/rom-tab.js`, `.css` | Strips, half table, search, CDL layer, row details |

## Dependencies

- May use `../maps` (room, sprite and animation decoders).
- Must **not** import `../emulator`: `extension.js` loads the CDL library and injects
  `{cdl, xrefs, stats}`; the model only takes plain arrays and maps.
- Names: `extension.js` injects the Rooms tab's room catalogue and the wiki text
  (`<workspace>/wiki/rom/Rom-Map.md`, `<workspace>/.github/rom-map.md`, then the copy in the
  extension's own `wiki/` submodule).

## State owned

- `host.js`: `_cache` (model per ROM sha1 + CDL presence), `_cdl` (the library's xrefs/stats).
  The ↻ button rebuilds both (re-reads the CDL library).
- `webview/rom-tab.js`: `_rom` (model, layer, selected half, open row, search, readers).

## Invariants

- Every region is measured from a pointer table or a decoder; the only fill is script bytecode
  (what is left of the upper halves `$92..$9B`), at the lowest priority.
- A byte has one owner: higher priority, then the later start, then the earlier claim.
- Rows never cross a 32 KB half; each half's rows sum to 32 KB.
- Room sizes come from `maps.objectAreaEnd` (no blob overlaps another). The everscript repo's
  Python `_object_area_end` overestimates 22 rooms; do not import its numbers.
- A non-Evermore ROM gets header, gaps and CDL coverage only.
