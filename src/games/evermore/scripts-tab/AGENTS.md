# src/games/evermore/scripts-tab — agent rules

Kind: **feature** (see `/AI_ARCHITECTURE_GUIDE.md` §2). What the folder does: [README.md](README.md).
Not to be confused with `src/games/evermore/script-vm/` (the bytecode decoder), or `script-model/`.

## Owns
- The radar panel's **Scripts** tab: Everscript, Maps, Animations and Music views; the
  `scripts*` requests (`host.ts`), the models in `model/`, the pane scaffold and `webview/`.
  (The Alchemy view was removed in v0.327.0: Animations marks the effect records ⚗.)

## Dependencies
- Libraries only: `../script-vm`, `../script-model`, `../maps`, `../localizations`, `../simulation`, and the
  language data file (`../language/data/index.json`, as sprites does).
- Must **not** import another feature (`sprites`, `music`, `rooms`, `emulator`, …):
  `extension.js` injects `animations(rom)` + `renderAnimation` (sprites) and
  `music.{list, sequence, timeline}` (music), `roomVariants(rom, id)` (rooms' variants worker).
  `.depcruise.js` rule `scripts-tab-no-features`.

## State owned
- `host.ts`: `_rooms` (room scripts + picture per room, for one ROM). `model/map-views.ts`:
  `_cache` (decoded room + picture per room, for one ROM). `model/map-tiles.ts`: `_facts`
  (metatile facts per decoded room).
- `model/alchemy.ts`: `_cache` (alchemy model per ROM). `model/simulation.ts`: `_sim`
  (the simulator per ROM, clusters per room).
- `webview/scripts-tab.js`: `_scr` (view, selections, toggles, per-key caches, players).

## Invariants
- Trigger boxes are in the room picture's pixels: `(x - originX) * 16`, x2/y2 exclusive.
- The Maps view's sections are `maps/blob-layout.ts`'s walk and add up to the blob byte for
  byte (tested for all 127 rooms); fields nobody decoded are labelled so, not named.
- A Maps item lists every byte range that is its (an object: record + step descriptors + stamps;
  tested to cover each object area fully), and the same key marks its list row, bytes, box and
  pictures (`data-mk`), so hover links them. `model/map-tiles.ts` caches metatile facts per room.
- Every Maps picture goes through the maps library's renderer (`renderVramLayer`,
  `compositeLayers`); the room picture is sent once (`scriptsMap`) and panels name it `@room`.
- New page code is TypeScript: `webview/scripts-maps.dom.ts` (`ScriptsMaps`) and
  `webview/scripts-listing.dom.ts` (`ScriptsListing`) are bundled into the radar IIFE; they take
  data as arguments and never read `_scr`.
- Camera bounds and arrivals are in room pixels (the picture's, like a spawn's `8 * x`).
- Music bytes remain visible raw; verified commands and the narrowly traced `$9C`/`$D3` driver-state values and `$0A`/`$1E` track timer values may be annotated. Other stream bytes remain unclassified.
- The simulation is work in progress: its failures come back as `error` and the tab keeps
  showing the decoded bytes. Never hide the bytes behind it.
- Page files stay ≤ 250 lines each; commands start with `scripts` (music owns `music*`).

## Tests
- `tests/memory/scripts-tab.test.js` — unit, ROM (models incl. every room's sections, host) and DOM (the page answered
  by the real host; skips without playwright). `SCRIPTS_TAB_SHOT=<dir>` saves a screenshot
  of each view.
