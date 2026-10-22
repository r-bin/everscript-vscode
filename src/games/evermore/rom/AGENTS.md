# src/games/evermore/rom — agent rules

Kind: **feature** (see `/AI_ARCHITECTURE_GUIDE.md` §2). What the folder does: [README.md](README.md).
Related skills: `memory-map`, `map-format`, `cdl-recorder` (`.agents/skills/`).

## Owns
- The radar's **Memory › ROM** (File, Compare) and **Memory › Bus** views: the pure model (`build.js`,
  `model/`), the `romMapRequest` / `romReaders` requests and the WRAM view's `wramCdlRequest`
  (`host.js`, `model/bus-usage.ts`), the pane scaffold, and the page code in `webview/`
  (`romShow` is what the Memory bar calls).

## Dependencies
- May use `../maps` (room, sprite and animation decoders) and `../localizations` (names).
- Must **not** import `../emulator`: `extension.js` loads the CDL library and injects
  `{cdl, xrefs, stats}`; the model only takes plain arrays and maps.
- Names: the knowledge entries (`localizations`, through `functions.ts` / `tables.js`); room
  names are injected by `extension.js` from the Rooms tab's catalogue. No wiki text is read.

Existing exceptions (do not add more):
- `webview/rom-init.js` calls the Rooms tab's page global `gotoVanillaRoom` (guarded by
  `typeof`), a feature → feature link through the shared radar page.

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
- A non-Evermore ROM gets header, gaps and CDL coverage only; the bus mapping comes from its header.
- The CDL stores data reads by file offset: the Bus view never claims which mirror *data* went
  through, only which bank halves *code* ran in.

## Tests
- `tests/memory/rom-tab.test.js` — unit (readers, bus usage), rom (model
  against the vanilla ROM; skips without it) and dom (skips without playwright).
