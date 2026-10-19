# src/games/evermore/rooms — agent rules

Kind: **feature** (see `/AI_ARCHITECTURE_GUIDE.md` §2). What the folder does: [README.md](README.md).
Related skills: `rooms-tab`, `map-editor-rules`, `map-construction`, `map-entities`, `map-format`,
`memory-radar`, `webview-dom-safety`

## Owns
- All Rooms-tab server-side logic: room tree building, room content parsing, vanilla data,
  lua-watcher POIs, server-side HTML/JSON rendering, custom maps and widgets on disk.
- `export-maps.ts`: Export Room Maps as PNG.
- `editor-host.js`: the map editor's ROM-backed messages (tiles, stamps, PNG export; drafts and export / play
  ROM in `editor-host-rom.js`, families, suggestions and deco in `editor-host-suggest.js`); `radar-open.js`
  routes them here with an injected `ctx`.
- Client-side room interactions and SVG rendering live in `webview/`.
- Does NOT own: ROM map decoding (`../maps/`, a pure model), emulator state, memory-map state.

## Dependencies
- Allowed: libraries (`../maps/`, `../script/`, `../localizations/`) and
  platform read APIs (`soe://`).
- Always import rooms functionality through `rooms/index.js`, never bypass to internal files.
- Forbidden: `rooms/` → `extension.js` (no upward call), `../debugger/`, `vscode` (VS Code
  API is injected, e.g. `custom-host.js`), and any other feature (`.depcruise.js`:
  `no-sibling-tabs` rooms ↛ scaling).
- Existing exceptions (do not add more): none in `rooms/`. Inbound: `emulator/panel.js` →
  `data/item-icons`; `memory/` requires `rooms/` and reads `webview/` as the radar host.

## State owned
| State | File | Notes |
|---|---|---|
| Lua watcher POI cache | `data/lua-watchers.ts` | Invalidated by `invalidateLuaWatcherCaches()` |
| Vanilla data cache | `data/vanilla-data.js` | Invalidated by `invalidateVanillaDataCaches()` |
| Room tree cache | `extension.js` `_radarRoomTree` | Rooms module is STATELESS; cache owned by caller |
| Webview globals | one owner file each | see README's client-side list and `webview/STATE.md` |

## Invariants
1. `parsing/content-parser.ts` is pure: file path + line range in, data out — no side effects.
2. `parsing/file-scanner.ts` receives `{getMapEnum, readScriptAllTriggers, readLuaWatchers,
   readRomMapHeader}` by injection — no direct requires of lua-watchers.
3. `buildRoomsJson` flattens the tree to `{ mapName: { content, romHeader, ... } }`.
4. `renderVanillaTree` and `renderRoomsTree` return HTML strings — no DOM operations.
5. `index.js` bridges the old no-arg API (used by `extension.js`) to the dep-injected API.
6. The webview files share one scope, so a global belongs to exactly one of them.
   `rom-overlay.js` owns the view state; `detail-renderer.js` owns the request state.
   Do not mirror either into the other.
7. Loot icons are decoded from the user's ROM (`data/item-icons.ts`), never bundled.
8. Rooms converted from another game arrive as data (`importedRooms` rail groups, then
   one room per `requestImportedRoom`); nothing here knows the other game. Their ids are
   `>= 0x1000` and their family ids carry a `label` — never treat either as a ROM id.
   Nothing about them is saved (only custom maps are); a copy of one is a custom map that
   borrows the converted room, so host requests about a donor go through `radarRoomRom`
   (`extension.js`), never straight to the Evermore ROM.

## Tests
- Unit (`npm test`): `tests/memory/map-editor.test.js`, `rebuild-invalidation.test.js`,
  `smoke.test.js`, `activation.test.js`, `tests/localizations/localizations.test.js`.
- ROM (skip without an Evermore ROM in the ROM library): `tests/memory/map-parity.test.js`,
  `rom-export.test.js`, `collision-suggest.test.js`, `custom-maps.test.js`, `soe-resources.test.js`.
- DOM (Playwright, skips without a browser): `tests/memory/map-editor-dom.test.js`,
  `tests/memory/rooms-rail-dom.test.js`, `tests/mana/mana-rooms-dom.test.js` (converted rooms).

## Pitfalls
- Delegated handlers bind **once per panel node**: `#room-detail` outlives a re-render, and a
  second handler made every toggle fire twice and cancel itself out (`webview-dom-safety` §1).
- Every `display` rule on a popup needs a matching `[hidden]` override: an author rule beats
  the UA `[hidden]{display:none}` regardless of specificity (`webview-dom-safety` §7a).
- `rooms-rail.css` outranks `shared.css` on **specificity**, never on source order, so the
  result does not depend on how the bundle is concatenated.
- Name keywords (`sniff_wax_2` → `WAX`) apply only to an author-written name; a decoded
  reward is matched exactly, or `LIMESTONE_TABLET` would draw as Limestone.
