---
name: supported-games
description: Use whenever a prompt is about Secret of Mana or Terranigma, or touches more than one game: which file system to read, no facts across games, where each game's facts live.
applyTo: "src/games/mana/**,src/games/terra/**,src/games/evermore/imports/mana/**,docs/mana/**,docs/terra/**,tools/mana/**,tools/terra/**,tests/mana/**,tests/terra/**"
---

# Supported games: Secret of Evermore, Secret of Mana, Terranigma

The extension supports three games. They share the SNES and nothing else.

## 1. Read each game through its own plane

| | Secret of Evermore | Secret of Mana | Terranigma |
|---|---|---|---|
| file system (MCP, editor) | `soe://` (`src/games/evermore/resources`, MCP `everscript-soe`) | `som://` (`src/games/mana/resources`): `som://rom/maps/<hex>.png/.json/.collision.json/.anim.json/.objects.json/.edit.json/.tiles.a.png`, `areas/` | `terra://` (`src/games/terra/resources`): `terra://rom/rooms/<hex>.png/.l0.png/.json/.tiles.l0.png`, `groups/`, `code/<name>/info.md` / `<name>.asm` (routines by name) |
| library | `src/games/evermore/maps`, `src/games/evermore/script`, … | `src/games/mana/decoder` (pure TS: header, pieces, metatiles, collision, events, objects, cuttable cells, animation on `platform/snes/cpu65816.ts`) | `src/games/terra/decoder` (pure TS: the game's room loader run on `platform/snes/cpu65816.ts`; layers, metatiles, picture, catalog; `code.ts` the routines read so far) |
| Which ROM | the ROM library (Everscript: Switch ROM; headless `npm run roms`): selected Evermore ROM, else the base `us` | the same library: selected Mana ROM, else the base `us` | the same library; only the base `eu` is decoded |
| facts written to | `src/games/evermore/localizations/knowledge/` (`game-knowledge` skill) | `docs/mana/README.md` + the `src/games/mana/decoder` file that reads it | `docs/terra/README.md` (topics: `jumping.md`) + the decoder file that reads it; a routine also gets its entry in `src/games/terra/decoder/code.ts` |
| checked with | CDL, recomp, headless runs | `tools/mana/check-map.js` (screen vs render), `check-events.js` (step events), `find-picture.js` (which map a screenshot shows), the game's own routines run on `cpu65816.ts` (rom tests); `docs/mana/verifying.md` | `tools/terra/check-room.mts` (screen vs render, docs/terra/README.md §5), `check-exit.mts` / `check-walk.mts` / `check-chest.mts` / `check-change.mts` (exits, collision, chests, map changes), the headless core's breakpoints and CDL |
| RAM map | `src/games/evermore/localizations/knowledge/` | `docs/mana/wram.md` | `docs/terra/README.md` §3.4 |

For a Mana question, start with `som://rom/index.md` or `docs/mana/README.md`; for Terranigma, `docs/terra/README.md` and `terra://rom/index.md` — not soe://.

## 2. Never carry a fact across

- Nothing known about Evermore (formats, engine, addresses, collision bits, scripts,
  flags, budgets) is a Mana fact, and the other way round. Even a similar-looking byte
  means something else (Mana collision c0 = floor level; Evermore bits 5-4 = plane).
- Only SNES hardware carries over: PPU registers, tilemap word bits, 4bpp chars, DMA,
  HiROM addressing, the 65816.
- Derive Mana facts from Mana's own code (headless core, CDL, `cpu65816.ts`) and check
  them in the running game. Write the routine address next to the fact.
- No code, tables or names from other projects (randomizers, viewers), for either game.

The one place both games meet is `src/games/evermore/imports/mana`: an explicit translation table
(`docs/mana/evermore-rooms.md`) in which each row pairs a documented Mana fact with a
documented Evermore fact. Adding a conversion means adding a row there, with both sides
already documented on their own side. It is a translation, never evidence: what Evermore
does with a converted room says nothing about Mana.

Dependency rules (`.depcruise.js`): `src/games/mana/decoder` imports nothing in `src/`;
`src/games/mana/resources` only `src/games/mana/decoder`; `src/games/mana/maps` only `som://`;
`src/games/evermore/imports/mana` only `src/games/mana/decoder`, `src/games/evermore/maps`, `src/games/evermore/rom-readers.ts`; Evermore domains never
import any of them — only `extension.js` wires them in.

## 3. Use the plugin's features for every game

A feature that works for Evermore should work for Mana through the same UI wherever the
game supports it, not through a second tool:

- **Rooms tab** — Mana maps are listed under the vanilla rooms ("Secret of Mana") and open
  in the same editor: tiles and families (`m<n>`), collision, step-on triggers
  (`Mana event NNN`), cuttable cells, event-flag pieces as objects, character objects as
  spawn markers. The webview stays game-neutral: converted rooms arrive as data
  (`rooms-imported.js`), with ids from `0x1000` and family labels.
- **Mana Maps panel** (Open Memory Radar while a Mana ROM is selected with Switch ROM) — the maps as the game draws them, with
  collision, animation, special cells and objects, and a map editor (Edit button): paint
  metatiles, objects, step events, undo/redo. Nothing it changes is saved. It shares the filter
  bar, the tile animation player, the editor core (history, sessions, notice) and the editor shell
  (frame, rail, canvas card, pill, dock, layout, zoom/pan) with the Rooms tab (`src/core/map-editor/view/`,
  `.../map-editor-core/`, `.../map-editor-shell/`) — the Mana page looks and behaves like the Evermore editor
  because it is built from the same files. The two editors
  never mix data: the Rooms tab shows Evermore plus *converted* Mana rooms, the panel native
  Mana maps. Plan: `docs/architecture/multi-game.md` (§8; the whole doc: one UX for every game).
- Mana collision is per **metatile**, not per cell. The Mana editor draws collision/specials as wishes and solves
  them into metatiles (copies in free slots, "?" where none fit) — never per-cell bytes (`src/games/mana/maps/AGENTS.md`).
- **som://** for anything an agent or the user wants to read as files.
- **The Core Map Editor Rule:** A map from any game (Evermore, Mana, Terranigma) is ONLY working
  if it is embedded into our core map editor (`src/core/map-editor/`) AND renders to what you see in the
  game or internet map dumps. Terranigma's Maps panel (`src/games/terra/maps/`) is the shared shell, read-only.
- **Connect concepts to core:** Mana has objects, so Mana connects to the objects system made for
  Evermore. If a game has features not supported in core, discuss and extend core instead of creating
  a disconnected, ad-hoc viewer.

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
- Terranigma: `$0480` is room × 2 (`$047E` the room): the room table is read at their sum and the room
  properties (display mode) by `$0480` alone — setting `$0480` = room × 3 renders every room with the wrong
  display. Old notes put the tables in bank `$0D` (a LoROM reading); they are `$86:959C` / `$86:A28C`.
- Terranigma's character scripts are 65816 code with `COP n` commands that take argument bytes after them
  (README §7): a plain disassembly runs into the arguments as code. Use `terra://rom/code/` (decoded arguments) or
  `COP_COMMANDS`, and decode a command's handler before reading past it. Script state sits in bank `$7F` at the
  record's offset (`$7F:0012,X` and so on), not in the record.
- Terranigma's jump height `$0970` is drawn and nothing else: collision always uses the ground position, and only
  bit 2 of `$097C` (airborne) changes it (`jumping.md`). The core's write watchpoints miss 16-bit writes
  (`emulator-subsystem` skill), so find a word's writer by searching the ROM and setting exec breakpoints.
- Terranigma's loader waits for vblank (`$4210`) and the sound CPU (music section): the decoder's bus and a
  trap stand in. A room can keep graphics, palette or display mode from the room before; VRAM written below
  word `$3800` is background characters, above `$4000` sprites and the font.
