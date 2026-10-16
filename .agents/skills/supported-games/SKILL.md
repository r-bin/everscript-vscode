---
name: supported-games
description: Use whenever a prompt is about Secret of Mana (SoM, "mana", som://, src/mana*, Mana maps, Mana rooms in the Rooms tab) or touches both games. Says which data plane to read (som:// for Mana, soe:// for Evermore), that facts never cross from one game to the other, where each game's facts are written down and how they are checked, and that the plugin's own features (editor, file systems, headless tools) are the way to work on every supported game.
applyTo: "src/mana*/**,docs/mana/**,tools/mana/**,tests/mana/**"
---

# Supported games: Secret of Evermore and Secret of Mana

The extension supports two games. They share the SNES and nothing else.

## 1. Read each game through its own plane

| | Secret of Evermore | Secret of Mana |
|---|---|---|
| file system (MCP, editor) | `soe://` (`src/resources`, MCP `everscript-soe`) | `som://` (`src/mana-resources`): `som://rom/maps/<hex>.png/.json/.collision.json/.anim.json/.objects.json/.edit.json/.tiles.a.png`, `areas/` |
| library | `src/maps`, `src/script`, … | `src/mana` (pure TS: header, pieces, metatiles, collision, events, objects, cuttable cells, animation on `cpu65816.ts`) |
| Which ROM | the ROM library (Everscript: Switch ROM; headless `npm run roms`): selected Evermore ROM, else the base `us` | the same library: selected Mana ROM, else the base `us` |
| facts written to | `src/localizations/knowledge/` (`game-knowledge` skill) | `docs/mana/README.md` + the `src/mana` file that reads it |
| checked with | CDL, recomp, headless runs | `tools/mana/check-map.js` (screen vs render), `check-events.js` (step events), `find-picture.js` (which map a screenshot shows), the game's own routines run on `cpu65816.ts` (rom tests); `docs/mana/verifying.md` |
| RAM map | `src/localizations/knowledge/` | `docs/mana/wram.md` |

For a Mana question, start with `som://rom/index.md` or `docs/mana/README.md`, not soe://.

## 2. Never carry a fact across

- Nothing known about Evermore (formats, engine, addresses, collision bits, scripts,
  flags, budgets) is a Mana fact, and the other way round. Even a similar-looking byte
  means something else (Mana collision c0 = floor level; Evermore bits 5-4 = plane).
- Only SNES hardware carries over: PPU registers, tilemap word bits, 4bpp chars, DMA,
  HiROM addressing, the 65816.
- Derive Mana facts from Mana's own code (headless core, CDL, `cpu65816.ts`) and check
  them in the running game. Write the routine address next to the fact.
- No code, tables or names from other projects (randomizers, viewers), for either game.

The one place both games meet is `src/mana-to-evermore`: an explicit translation table
(`docs/mana/evermore-rooms.md`) in which each row pairs a documented Mana fact with a
documented Evermore fact. Adding a conversion means adding a row there, with both sides
already documented on their own side. It is a translation, never evidence: what Evermore
does with a converted room says nothing about Mana.

Dependency rules (`.depcruise.js`): `src/mana` imports nothing in `src/`;
`src/mana-resources` only `src/mana`; `src/mana-maps` only `som://`;
`src/mana-to-evermore` only `src/mana`, `src/maps`, `src/shared`; Evermore domains never
import any of them — only `extension.js` wires them in.

## 3. Use the plugin's features for every game

A feature that works for Evermore should work for Mana through the same UI wherever the
game supports it, not through a second tool:

- **Rooms tab** — Mana maps are listed under the vanilla rooms ("Secret of Mana") and open
  in the same editor: tiles and families (`m<n>`), collision, step-on triggers
  (`Mana event NNN`), cuttable cells, event-flag pieces as objects, character objects as
  spawn markers. The webview stays game-neutral: converted rooms arrive as data
  (`rooms-imported.js`), with ids from `0x1000` and family labels.
- **Mana Maps panel** (`everscript.openManaMaps`) — the maps as the game draws them, with
  collision, animation, special cells and objects, and a map editor (Edit button): paint
  metatiles, objects, step events, undo/redo. Nothing it changes is saved. It shares the filter
  bar, the tile animation player, the editor core (history, sessions, notice) and the editor shell
  (frame, rail, canvas card, pill, dock, layout, zoom/pan) with the Rooms tab (`src/shared/webview/map-view/`,
  `.../map-editor-core/`, `.../map-editor-shell/`) — the Mana page looks and behaves like the Evermore editor
  because it is built from the same files. The two editors
  never mix data: the Rooms tab shows Evermore plus *converted* Mana rooms, the panel native
  Mana maps. Plan: `docs/architecture/multi-game.md` (§8; the whole doc: one UX for every game).
- Mana collision is per **metatile**, not per cell. The Mana editor draws collision/specials as wishes and solves
  them into metatiles (copies in free slots, "?" where none fit) — never per-cell bytes (`src/mana-maps/AGENTS.md`).
- **som://** for anything an agent or the user wants to read as files.

When a Mana feature is missing, check `docs/mana/evermore-rooms.md` ("The editor for Mana
rooms") and `docs/mana/README.md` ("Not done yet") before building a parallel path.

## 4. Traps already hit

- The interpreter needs the data bank the routine expects: DB = 0 for code writing I/O
  registers, DB = `$7E` for code reading entities as `$E0xx,X` (`$01:D293`).
- After a forced map load (`check-map.js` style) `$D0` is non-zero and blocks step
  events; `$7E:E800` is reused after the load, so do not read the object count from it.
- "No code writes X" needs every addressing form *and* every indirect path: cutting
  writes the cell through `[$00]`, not the metatile tables — a search for table writes
  once wrongly concluded Mana had no cuttable tiles.
- VS Code's webview CSS `img { max-width: 100% }` squashes wide maps (`webview-dom-safety` §8).
