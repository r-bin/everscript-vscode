# src/games/evermore/resources — agent rules

Kind: **platform** (see `/AI_ARCHITECTURE_GUIDE.md` §2). What the folder does: [README.md](README.md).

## Owns
- The read-only `soe://` `FileSystemProvider` (`rom/`, `ram/`, `bus/`, `tags/`,
  `localization/`), its commands (open, check, Open ROM as Folder) and the webview helpers
  in `webview.ts`. Spec: `docs/soe-filesystem-spec.md`.
- This is the data plane (`/AI_ARCHITECTURE_GUIDE.md` §3.4): ROM/RAM-derived data that more
  than one consumer needs is exposed here first.
- Not the address grammar: `parseSoeParts` / `parseAddressName` are pure and live in
  `src/games/evermore/resources/resource-uri.ts`.

## Dependencies
- May use `platform/`, `maps/`, `script/`, `simulation/`, `localizations/`.
- Never `emulator/`: the emulator's ROM and memory reads are injected by
  `extension.js` (`emulatorRom`, `readMemory`), as `rom/` gets the CDL library.
  `.depcruise.js` rule `no-resources-to-emulator`.
- Existing exceptions (do not add more; move the code down into a library instead):
  - `audio-songs.js` → `music/model/catalog`, `music/model/rom-audio`, `music/webview/music-view`
  - `map-objects.js` → `rooms/rendering/deco-catalogue`, `rooms/rendering/deco-preview`
  - `character-files.ts` → `sprites/animation-decoder`, `sprites/character-model`
  - `sound-source.js` → `sprites`

## Invariants
- Read-only: every write operation throws `NoPermissions`.
- `rom/` files are pure functions of the ROM bytes, cached per ROM buffer.
- `ram/` files are `live`: cached 250 ms, re-announced every second while
  watched and an emulator is open, `Unavailable` without a running game.
- Ids in paths are hex without `$`; item names are aliases of their hex reward id.
- Every directory lists an `index.md`: the handler's own (`dir(entries, index)`) or autoindex.ts.
- A file stored once and reachable elsewhere is a link: `ingredients/wax/icon.png` → `icons/<id>.png`,
  every `soe://bus/…` → its `ram/` or `rom/` file. Links stat as `File | SymbolicLink`.
- The ROM of a mount is named in the path (`soe://rom/~<base64url>/`), never the query:
  webviews strip the query from requests but not from roots.
- Pages that link across files (tags/, `ram/index.md`) use relative link targets
  (`page-links.ts`): the built-in Markdown preview loads only relative images.

## Tests
- `tests/memory/soe-resources.test.js` — unit; ROM routes skip without the test ROM (rom).
- `tests/memory/soe-tags.test.js` — unit; ROM routes skip without the test ROM (rom).
- `tests/memory/music-tab.test.js` — `rom-files`, `sound-source`; ROM + headless browser + core (emulator).
