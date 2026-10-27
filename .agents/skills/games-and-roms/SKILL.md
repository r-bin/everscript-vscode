---
name: games-and-roms
description: Use when adding a game or variant, touching ROM identification, the ROM library, Switch ROM, game views, or how code and tools find a ROM (romPath, soe:// ?rom=, npm run roms).
applyTo: "src/platform/roms/**,src/platform/games.ts,src/games/*/descriptor.ts,src/games/index.ts,src/games/*/extension.js,src/core/**,tools/roms.js,tools/rom.js"
---

# Games and ROMs

Design and status: `docs/architecture/multi-game.md` (§3 descriptor, §4 variants, §5 library, §6 UX).

## How a ROM becomes a game

1. `platform/roms/header.ts` finds the cartridge header (LoROM / HiROM / ExHiROM, copier header
   skipped) — the one header reader.
2. `platform/roms/identify.ts`: a SHA-1 match picks game **and** variant (wins over a damaged
   header); otherwise the first descriptor whose `matchesHeader()` accepts the header picks the
   game, and the game's `readDerivedMarker()` names a ROM our builders made (`derived`, from the
   base variant it names); anything else is `unknown` — opens with a warning, address features off.
3. The **base variant** (one per game, `base: true`) is the one people hack; address facts are
   written for it. Builders (`tools/table-hack`, `tools/exhirom`) accept only a base ROM and write
   the marker (`games/evermore/derived.ts`: `EVSX`, version, kind, base SHA-1).

## The ROM library (`platform/roms/library.ts`)

One JSON file in the extension's global storage (`roms.json`): paths only (never copies), the
selected ROM, a base marked by hand per game. The extension, MCP, tests and node tools read the
same file. `romFor(game)` = the selected ROM if it is that game's, else the game's base.
- Code reads a ROM through its game's scheme (`soe://`, `som://`; `?rom=<path>` names a specific
  one) or `romPathFor(game)` (`core/roms/host.ts`) — never a setting, env var or fixed path.
- Tests and tools: `require('…/dist/games').romPath('evermore')` / `baseRomPath()`; a test
  **skips** when it returns null. Headless: `npm run roms [add|select|base|remove <path>]`.

## Adding a game

1. `src/games/<id>/descriptor.ts`: `id`, `name`, `scheme`, `matchesHeader`, `variants` (SHA-1 of the
   unheadered file, exactly one `base`), `capabilities` (`full` / `partial`; drives the ROM panel's
   feature table), `docs`. Facts only from the game itself (root AGENTS.md §0.4).
2. Its line in `src/games/index.ts` `registerGames()`.
3. `src/games/<id>/extension.js` with `activate(context)`: commands, its file system, and its main
   view via `core/game-views.ts` `registerGameView(id, { open, panel, refresh })` — Open Memory
   Radar and Switch ROM then reach it without any game naming another. A game's code reads its ROM
   with `romFor(id)` / `romPathFor(id)`, never `selectedRom()`: that is what lets its panels keep their
   ROM while another game is selected.
   With no ROM, it says `missingRomText(id)` (one wording for every panel and file system).
4. Its line in `src/extension.ts` `GAMES`.
5. `src/games/<id>/AGENTS.md`, `docs/<id>/` with evidence. `games-stay-apart` (depcruise) keeps it
   from importing another game; a bridge is `games/<other>/imports/<id>/` only.

Adding a **variant**: its row in the descriptor with the SHA-1 and where it came from
(`docs/evermore-releases.md` for Evermore). Address facts for it go in its own entries only once
something needs them (multi-game.md §4).

## Traps

- `registerGames()` must run before identification (`src/extension.ts` does it first; `romPath()`
  calls it for tests). An unregistered game identifies as `unknown`.
- A panel follows the selected ROM today; "panels keep their ROM" is still open (multi-game.md §7.5).
- The emulator and `platform/` never name a game: Evermore's emulator half comes in through
  `configureEmulator({ game })`, its CDL seeds as `gameRegions`.
