# src/games/evermore/scripts-tab — agent rules

Kind: **feature** (see `/AI_ARCHITECTURE_GUIDE.md` §2). What the folder does: [README.md](README.md).
Not to be confused with `src/games/evermore/script-vm/` (the bytecode decoder), or `script-model/`.

## Owns
- The radar panel's **Scripts** tab: Everscript, Animations, Alchemy and Music views; the
  `scripts*` requests (`host.js`), the models in `model/`, the pane scaffold and `webview/`.

## Dependencies
- Libraries only: `../script`, `../maps`, `../localizations`, `../simulation`, and the
  language data file (`../language/data/index.json`, as sprites does).
- Must **not** import another feature (`sprites`, `music`, `rooms`, `emulator`, …):
  `extension.js` injects `animations(rom)` + `renderAnimation` (sprites) and
  `music.{list, sequence, timeline}` (music). `.depcruise.js` rule `scripts-tab-no-features`.

## State owned
- `host.js`: `_rooms` (room scripts + picture per room, for one ROM).
- `model/alchemy.ts`: `_cache` (alchemy model per ROM). `model/simulation.ts`: `_sim`
  (the simulator per ROM, clusters per room).
- `webview/scripts-tab.js`: `_scr` (view, selections, toggles, per-key caches, players).

## Invariants
- Trigger boxes are in the room picture's pixels: `(x - originX) * 16`, x2/y2 exclusive.
- The Alchemy view lists only what the ROM shows: formula → `$C4:5DDF` → `$91:80A6` → block;
  records are block words that equal a record id. Do not present block fields as decoded.
- Music bytes are shown raw; `≥ $F0` is marked as a command, nothing more is claimed.
- The simulation is work in progress: its failures come back as `error` and the tab keeps
  showing the decoded bytes. Never hide the bytes behind it.
- Page files stay ≤ 250 lines each; commands start with `scripts` (music owns `music*`).

## Tests
- `tests/memory/scripts-tab.test.js` — unit, ROM (models, host) and DOM (the page answered
  by the real host; skips without playwright). `SCRIPTS_TAB_SHOT=<dir>` saves a screenshot
  of each view.
