# One map editor, two games

Decided 2026-10-15 (design interview with the owner). Status: **planned**; nothing below is
built yet except the Evermore editor and the read-only Mana views.

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

Tile painting from a picker, erase, collision painting, undo/redo, layer toggles
(BG1 / BG2 / Collision), zoom, animation preview; specials and step events shown.
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

## Known state at decision time

- `tests/memory/rooms-rail-dom.test.js` ("rows are the mock's 32px") fails on HEAD v0.210.1,
  unrelated to this plan.
