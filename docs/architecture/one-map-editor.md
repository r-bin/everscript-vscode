# One map editor, two games

Decided 2026-10-15 (design interview with the owner). Status: steps 1-3 of "Order of work" are
built (v0.211.0); what is still open is listed under "Status and what is left".

## Shape

- One extension, one set of editor code: a **game-neutral core** plus **one adapter per game**.
  The core imports neither game's domain (to be enforced in `.depcruise.js`). An adapter supplies
  the map model, the layers, the tile source, what collision means and which tools exist.
- Two entry points that never mix data:
  - **Evermore Rooms tab**: Evermore data only, including the Mana maps auto-converted into
    Evermore rooms (`src/mana-to-evermore`, `docs/mana/evermore-rooms.md`).
  - **Mana panel** (`everscript.openManaMaps`): native Mana maps only, a fraction of the
    features. It stays as the entry point; its own page code (`src/mana-maps/webview/main.js`)
    is replaced by the shared core + the Mana adapter. Reads Mana data only through `som://`.
- Shared = game-neutral machinery only: canvas, zoom/pan, layer toggles, undo/redo, selection,
  clipboard, tile-picker shell, overlay chips, tile-animation preview. A feature moves into the
  core only when both games need it with the same meaning. Evermore concepts (families, ROM
  budgets, stamps, triggers) stay in the Evermore adapter.
- A second package for Mana is not planned; the seam above makes splitting it later a folder move.

## Saving

- Only **custom Evermore rooms** are saved.
- Mana edits are **never saved**: no drafts, no write-back (Mana's compressed map would often not
  fit its old slot). Decide write-back later, together with "play my edited Mana map" (which needs
  the same re-encoding and is therefore also out for now).
- A converted Mana room in the Evermore tab can be edited but is not saved. "Make a custom
  Evermore room from this" is the way to keep the work.
- UI: a persistent "changes are not saved" banner while such a map has edits. Edits stay in memory
  per room while the panel is open; closing or reloading discards them, no dialog.

## Mana editor v1

Tile painting from a picker, erase, pick, undo/redo, layer toggles (BG1 / BG2 / Collision), zoom,
animation preview; specials and step events shown. **Collision is not painted on its own**: in Mana
it belongs to the metatile (`docs/mana/README.md`, "Collision"), so painting a metatile changes
picture and collision together and the overlay shows the result. A free per-cell collision brush
would invent data the game does not have.
Also objects and triggers, at the level the facts allow (`docs/mana/README.md`):
- objects: place / move / delete; only known fields editable, unnamed bytes kept as read;
- triggers: add / move / resize step-event cells, set the event number;
- scripts: shown as an event number only (Mana event scripts are not decoded; decoding them is
  separate work, checked in the running game with `tools/mana/check-events.js`).
Left out: families, budgets, stamps (Evermore concepts without a Mana counterpart).

## Order of work

1. Adapter interface + dependency rule. Put the Mana panel's view features (BG1/BG2/Collision,
   Animate, Specials, zoom, area list) on the shared core with a read-only Mana adapter; delete
   the panel's duplicate page code.
2. Mana tile + collision painting with undo/redo.
3. Mana objects and triggers.

The Evermore editor (`src/rooms/webview/map-editor-*.js`) is split into core + adapter one file at
a time alongside these steps, never as a big-bang rewrite. Every step ends with a green suite;
the headless-Chromium Mana editor tests (`tests/mana/mana-editor-dom.test.js`) replace
`tests/mana/mana-panel-dom.test.js`.

## Status and what is left

Built (v0.211.0 – v0.212.0):
- `src/shared/webview/map-editor-core/` — history, sessions, "not saved" notice, tool keys;
  `.depcruise.js` rule `map-editor-core-is-game-neutral`.
- `src/shared/webview/map-editor-shell/` — the page both games are built from: frame, rail, name line, canvas
  column (card, pill, zoom chip, filter bar, status bar), dock and tab strip, layout with compact mode, zoom and
  pan, and their CSS (rule `map-editor-shell-is-game-neutral`). **The Evermore Rooms editor runs on these
  files** (moved out of `src/rooms/webview/` with `git mv`; the Rooms bundle loads them; the Rooms host builds its
  rail and frame with `frame.js`); screenshots of the Evermore editor are unchanged by the move.
- Mana editor on the shell and core (`src/mana-maps/webview/`): same frame, rail, pill, dock, status bar,
  filter bar, zoom/pan as the Rooms tab. Select / Pencil / Erase / Pick / Undo / Redo; the open tab (Tile,
  Object, Trigger) decides what the pencil draws, as in Evermore; Info tab; nothing saved, with the notice.
  Data: `som://rom/maps/<hex>.edit.json` and `.tiles.a.png` / `.tiles.b.png`.
- Mana objects (v0.214.0): the Object tab has Characters (records; stacked ones one ring with a count) and Map
  changes (the event-flag pieces as Evermore-style cards, states as chips, drawn with the Evermore object marks —
  CSS moved into the shell); a variant bar (the shell's side bar, shared with the Evermore level bar) opens the maps
  that draw the same picture. Map changes are read-only for now (painting into a state is not built).
- Evermore tab: an unlocked converted Mana room shows the same notice; **Copy map** works for one (the host
  answers a donor of `0x1000 + map id` from the room's image). A saved copy needs the Mana ROM when reopened.

Left, on purpose (state it plainly, do not assume it done):
- **The action registry** that would replace the Evermore `editAction` switch and the 400-line click router
  (`map-editor-actions.js`, `map-editor-input.js`), and **moving the Evermore draft's undo onto
  `edit-history.js`** (71 `_edit` references in `map-editor.js`). Until then the Evermore editor has its own
  history and click routing and the Mana page its own; the shell and the core do not yet cover those two.
- Evermore-only tabs (Special, Animation, Widgets) and tools (copy, move, stamp) are absent from the Mana page.
- Mana: scripts need decoding first; no write-back, no "play my edited map".
- Changed Mana cells ignore BG priority and colour math (a limit of drawing a cell alone).

## Known state at decision time

- `tests/memory/rooms-rail-dom.test.js` ("rows are the mock's 32px") failed on HEAD v0.210.1,
  unrelated to this plan.
