# src/games/evermore/sprites — agent rules

Kind: **feature** (see `/AI_ARCHITECTURE_GUIDE.md` §2). What the folder does: [README.md](README.md).
Related skills: `sprites-subsystem`, `animation-script`, `map-entities` (`.agents/skills/`).

## Owns
- The radar panel's **Characters** tab: characters/enemies/NPCs and their stats and
  hitboxes, raw ROM sprites, the animation catalog, and the animation player.
- Host side: `character-model.js`, `animation-*.js`, `frame-compose.js`,
  `projectile-render.js`, `target.js`, `dog-forms.js`, `raw-sprites.js`, `thumbnails.js`,
  `sprites-tab.js`, `index.js`. Browser side: `webview/` (concatenated into the radar page).

## Dependencies
- `src/games/evermore/maps/` (pure ROM functions: `rom.ts`, `sprites.ts`, `character-record.ts`,
  `character-animation.ts`, `animation-vm.ts`, `animation-opcodes.ts`, `projectiles.ts`,
  `hit-test.ts`, `png.ts`, required from `dist/maps/`).
- `src/shared/` (`rom-readers.js`).
- No dependency on `src/rooms/`, `src/games/evermore/debugger/`, `src/games/evermore/scaling/`, or `vscode`.

Existing exceptions (do not add more):
- `character-model.js` and `animation-catalog.js` require `../language/data/index.json`
  (enum definitions for external animations), a platform domain's file rather than a
  `soe://` read.

## Invariants
- The animation and entity rules this tab encodes (attack facing rounding, stamina →
  attack level, palette precedence, the home palette slot, Dog forms) are in the
  `animation-script` and `map-entities` skills. Follow them; do not restate them here.
- Do not port or copy code, tables or layouts from SoETilesViewer/SoEScriptDumper; derive
  from the ROM with a test (guide §3.8).
- Keep each file under the Max LOC listed in the README's file table.
- `webview/` load order: `sprites-lazy.js`, `sprites-script.js`, `sprites-motion.js`,
  then `sprites-view.js` (`src/memory/webview/index.js`).

## Tests
- `tests/memory/sprites.test.js` — unit (tab HTML scaffold) and rom tier (ROM-backed
  checks skip without an Evermore ROM in the ROM library).
