# src/games/mana/resources — agent rules

Kind: **platform** (see `/AI_ARCHITECTURE_GUIDE.md` §2). The read-only `som://` file
system: Secret of Mana's data plane. What the folder does: [README.md](README.md).

## Owns
- The `som://` FileSystemProvider and finding the Mana ROM (`rom-source.ts`).
- `som://` is separate from `soe://`: no Evermore path ever serves Mana data and back.

## Dependencies
- `decoder/` only (plus `vscode` in `index.js`/`fs-provider.js`). Never the Evermore `resources/`,
  `maps/` or any Evermore domain (`.depcruise.js` `mana-resources-only-mana`).
- Settings arrive injected from `extension.js` (`where()`); this domain reads no config.

## Invariants
- Read-only: writes throw `NoPermissions`.
- `files.js` is pure (no `vscode`); files are functions of the ROM bytes, cached per buffer.
- A file is served only from a ROM whose internal title is Secret of Mana.
- Ids in paths are hex without `$` (`som://rom/maps/80.png` = map 128).

## Tests
- `tests/mana/mana-rom.test.js` — `files.js` routes (rom tier, Mana ROM from the ROM library).
