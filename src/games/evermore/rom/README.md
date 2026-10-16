# rom/ — ROM tab

The radar panel's **ROM** tab, in three views:

- **File**: every 64 KB bank of the loaded ROM, split into its two 32 KB halves (nothing in Secret
  of Evermore crosses a half line), with what each region is, how big it is, which world uses it,
  and what the CDL recorder saw.
- **Bus**: the CPU's 24-bit address space ($00:0000–$FF:FFFF): WRAM, I/O, SRAM, the four ROM
  windows and open bus, with a resolver for one address (what it reaches, its mirrors, which
  bank halves code ran from).
- **Compare**: file halves beside the bus map; a half is outlined everywhere it appears.

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
| `model/bus-usage.js` | CDL facts on the bus side: bank halves code executed from (pcstats + edges), WRAM strip |
| `webview/rom-tab.js`, `.css` | `_rom`; File view: strips, half table, CDL layer, row details, text search |
| `webview/rom-bus-map.js` | Bus mapping (HiROM / LoROM, FastROM, SRAM), the bank × offset canvas |
| `webview/rom-bus-view.js` | Bus view: map + address resolver + WRAM strip |
| `webview/rom-compare.js` | Compare view: file halves ↔ bus windows, the four-window summary |
| `webview/rom-init.js` | Wiring and view switching; loaded last |

## Rules for changing this folder

Dependencies, invariants and tests: [AGENTS.md](AGENTS.md).
