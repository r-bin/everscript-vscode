# Multi-game architecture

Decided 2026-10-16 in a design interview with the owner; it absorbs the earlier
"one map editor, two games" plan (2026-10-15, now §8). The cleanup that gets us here is
[../cleanup.md](../cleanup.md) (step 4). Nothing here is built yet except what §8 marks as built.

## 1. Goal

One extension that works with any SNES game we know something about: Evermore today, Secret of
Mana next to it, Terranigma later. You drop in ROMs; the plugin recognises each one and offers what
it knows about it. Evermore and Mana share one UX again: the same panels and commands, not a
separate Mana side panel.

The extension id and the `everscript.*` command and setting prefix stay for now; renaming them
breaks users' settings and keybindings and is a later, separate step.

## 2. Layout and dependency rules

```
src/
  extension.ts          composition root; the one list of games
  platform/             no game knowledge: SNES facts (bus, 65816, SPC700), emulator core, CDL,
                        recorder, MCP server, the resolver core, ROM identification
  core/                 game-neutral features and UI shells: map editor core + shell, Rooms /
                        Memory / Scripts tab shells, docs tab, file-system base, knowledge-entry
                        format, ROM panel, status bar item
  games/
    evermore/           decoder, soe:// provider, map adapter, emulator panels (ENTITIES,
                        ALCHEMY…), knowledge entries, names, language (grammar, theme, debugger),
                        script VM, table hack / ExHiROM support
      imports/mana/     the Mana-to-Evermore bridge (was src/games/evermore/imports/mana)
    mana/               decoder, som:// provider, map adapter, knowledge entries
docs/platform/  docs/games/<game>/   mirror the code
```

Rules (`.depcruise.js`, `check:deps`):
- `platform/` imports nothing from `core/` or `games/`.
- `core/` imports `platform/` only.
- A game imports `platform/` and `core/`, never another game — except `games/evermore/imports/<game>/`,
  which may import that game's public `index` only. Each row of such a bridge pairs two documented
  facts (today: `docs/mana/evermore-rooms.md`).
- Tabs never import each other.
- No fact crosses games (AGENTS.md §0.4): only SNES hardware facts live in `platform/`.

## 3. The game descriptor

Each `src/games/<game>/index.ts` exports one descriptor and nothing else is visible to `core/`:

| Field | Meaning |
|---|---|
| `id` | `evermore`, `mana`, … |
| `identify(header, hash)` | header match picks the game; hash picks the variant (§4) |
| `variants` | known variants: id (`us`, `de`, `us-1.1`…), region, version, hash; one marked `base` |
| `scheme` + file-system provider | `soe`, `som`, … (§5) |
| `capabilities` | what the game offers: map adapter, emulator panels, language features, scripts, sprites, memory names… — drives the ROM panel's feature table and the empty states |
| `knowledge` | the game's knowledge store (`game-knowledge` format, its own folder) |

Games register through `registerGame(descriptor)` — called internally from the one list in
`extension.ts`. Removing a game is deleting its folder and its line. VS Code supports extensions
that extend another extension (`activate()` returns an API; the other declares
`extensionDependencies`), so `registerGame()` can later become public and a game can ship as its
own extension. For now: one extension, one repo — splitting later is packaging work, not a redesign.

The check that the descriptor is game-neutral: Mana fits it with no special case, and Terranigma
does too (registered in `src/games/terra/`, European base ROM title `TERRANIGMA P`, 4 MB, map mode
`$31` HiROM FastROM like Evermore and Mana, region `$02` PAL, header checksum valid; facts in `docs/terra/`).

## 4. ROMs: identification, variants, base ROM, derived ROMs

- **Identity = game + variant.** The plugin is game-agnostic: the header (title, map mode) picks
  the game, the hash picks the variant.
- **Unknown variant:** known header, unknown hash. It opens with a warning; features that depend on
  addresses are off.
- **Base ROM:** each game names one base variant — the one people hack: Evermore `us`, Mana `us`,
  Terranigma the English European ROM (it had no US release). Address facts in knowledge entries
  are written for the base variant (an entry records the variant it was checked on, default the
  base); other variants map to them through a per-variant hook that stays empty until a second
  variant is really needed. Our builders (table hack, ExHiROM) accept only a base ROM.
- **Derived ROMs:** our builders write a small marker into unused header/ROM space (base variant +
  build kind, e.g. `evermore us + table-hack`), so their output keeps the address features. The
  marker format is documented in the game's docs. Other people's hacks without a marker are
  unknown variants.
- **Regions:** the platform takes NTSC or PAL timing from the detected region. The emulator assumes
  NTSC today; PAL (German Evermore, Terranigma) is a roadmap item, not part of the cleanup.

## 5. The ROM library, URIs and the headless resolver

- **The library** is one JSON file in the extension's global storage: the paths of the ROMs you
  loaded (never copies) with their detected game and variant, plus which ROM is the base for a game
  when you marked one yourself. No setting: `everscript.romPath`, `$SOE_ROM` and
  `EVERSCRIPT_ROM` are removed.
- **The resolver** is one module without a VS Code dependency. The extension, the MCP server, the
  tests and the node tools (`recomp`, `exhirom`, `table-hack`, playbacks) all import it and read
  through the game schemes; it reads the library file directly, so headless runs see the same ROMs
  as VS Code. Tests skip when the library has no base ROM for their game.
- **URIs:** one scheme per game.
  - `soe://…` means the selected ROM when it is an Evermore ROM, otherwise the Evermore **base
    ROM** in the library; if there is none, the error asks you to drop one in.
  - `soe://…?rom=<path>` addresses a specific ROM; an unknown path is added to the library.
  - `som://` works the same way for Mana. MCP tools and knowledge links keep working unchanged.
- **Only source:** everything about a game is read through its scheme (cleanup D5); decoded data
  `soe://` already serves is read from there, not re-parsed.

## 6. UX

- **Status bar item:** game icon, short name, variant (`◆ Evermore · us`). Clicking it, or
  **Everscript: Switch ROM**, opens the ROM panel.
- **ROM panel:** per game, your ROMs; the base ROM marked ★ and listed first; for an unknown
  variant you can mark it as base yourself. Each row: variant, region, hash match (known /
  unknown / derived), select, remove. Below, a **feature table**: one row per feature (maps, map
  editor, scripts, sprites, emulator panels, memory names, …), one column per ROM, ✓ / ◐ partial /
  — unknown, built from the descriptor's capabilities and whether the variant is known.
- **No known ROM:** the plugin asks you to drop one in; the ROM panel is then a drop zone.
- **Panels keep their ROM:** a panel opens on the selected ROM and keeps it; its title says which
  (`Map editor — Mana · us`). Switch ROM while a panel is focused switches that panel and becomes
  the ROM for new panels. Evermore and Mana side by side = open a panel, switch, open another.
- **Missing features:** a panel whose capability the game lacks shows an empty state saying what
  is unknown for this game/variant, with a link to the game's docs — it is not hidden. Commands are
  never game-specific: `everscript.openManaMaps` merges into the one map editor command.

## 7. Order of work (cleanup step 4)

1. Resolver core + library file + ROM identification in `platform/`; switch every
   `$SOE_ROM` / `romPath` / hard-coded path reader to it (tools, tests, `rom-readers.js`,
   `script-trace.js`, `gen-sound-animations.js`, the npm/sh wrappers and their docs).
2. Game descriptor and `registerGame()`; Evermore and Mana descriptors with variants and base.
3. Move domains, one per commit with `git mv`, converting to TS as they move:
   `src/mana*` → `games/mana/` (done in v0.232.0); Evermore domains (`maps`, `script`, `sprites`, `localizations`,
   `resources`, `language`, `debugger`, `music`, `scaling`, `routes`, `rom`…) → `games/evermore/`
   or, where game-neutral, `core/`; `emulator` core / CDL / `recorder` / `mcp` → `platform/`.
   Each move updates the domain's `AGENTS.md` and README.
4. depcruise rules of §2; `check:deps` blocking.
5. Status bar item, ROM panel with feature table, Switch ROM, empty states; panels keep their
   ROM; `openManaMaps` merged.
6. Derived-ROM marker in `tools/table-hack` and `tools/exhirom`.

**Status (v0.233.0):**
- Built: 1 (resolver, library file, identification; every ROM reader in the extension, tests, tools and
  scripts goes through it; `romPath` / `manaRomPath` / `$SOE_ROM` / `EVERSCRIPT_ROM` are gone; old
  settings are adopted once into the library), 2 (`registerGame`, Evermore and Mana descriptors),
  4 (rules `platform-knows-no-game`, `core-knows-no-game`, `games-stay-apart`; depcruise now reads
  `.ts`), 6 (marker `EVSX`, `src/games/evermore/derived.ts`, written by both builders).
- Built in part, 5: status bar item, Switch ROM opening the ROM panel (ROMs per game, ★ base, "use as
  base", feature table, drop zone), the drop-a-ROM prompt. Panels keep their ROM (v0.264.0): the library remembers the ROM last chosen per
  game (`current`; `romFor` reads it before the base), so selecting a Mana ROM leaves an open Evermore radar on
  its ROM, and every game view's title names its ROM (`Memory Radar — Evermore · us`). Still open: each game
  has one main view, so two variants of one game cannot sit side by side, and that view follows its game's
  selection; per-panel empty states are still the old messages.
  `openManaMaps` is merged (v0.236.0): Open Memory Radar opens the Mana Maps panel when the selected ROM is
  a Mana ROM, and opens Terranigma Maps (v0.240.0) when a Terranigma ROM is selected.
- Built in part, 3: one TypeScript build (`tsconfig.build.json`, `dist/` mirrors `src/`, v0.231.0); Secret of
  Mana moved (v0.232.0): `games/mana/decoder`, `games/mana/resources`, `games/mana/maps`, and the bridge
  `games/evermore/imports/mana`. The twelve Evermore-only domains moved as they were (v0.233.0):
  `games/evermore/{language,localizations,maps,script,simulation,sprites,resources,rom,scripts-tab,music,
  scaling,debugger}`; their JS→TS conversion is cleanup 5.5, not part of the move. v0.241.0: the map editor's view/core/shell → `core/map-editor/`, `mcp` → `core/mcp`, the Docs/RNG
  tab → `games/evermore/docs-tab`. v0.242.0: Evermore helpers out of `shared/`. v0.243.0: the CDL engine →
  `platform/cdl` (Evermore's seeds come in as `gameRegions` from `games/evermore/cdl/`), TAS movie format →
  `platform/tas`, `zip.js` and the SNES header model → `platform/`; rule `platform-stands-alone`. v0.245.0: `rooms` and `memory` →
  `games/evermore/` whole (Evermore's Rooms and Memory Radar; the editor's game-neutral pieces are already
  `core/map-editor`, and a tab shell moves to `core/` only when a second game uses it). v0.246.0: the emulator's host
  side knows no game (rule `emulator-knows-no-game`): Evermore's half is `games/evermore/emulator/host.js`,
  handed in through `configureEmulator({ game })`; the recorder's package has no game code (103 → 52 files). v0.247.0: `shared/` is gone
  (`shared.css` → `core/webview/`, the Memory tab's `shared.js` → `games/evermore/memory/webview/`). v0.248.0: `src/extension.js` is the composition
  root (ROM library, the list of games, `core/game-views.js`, MCP); each game has `games/<game>/extension.js`;
  `core/game-views.js` opens the selected game's view (Evermore radar / Mana or Terranigma Maps). Still at `src/<domain>`
  because each mixes game-neutral and Evermore code and must be split first: `emulator` (its webview still holds the
  ENTITIES / ALCHEMY panels and the pause menu, which read Evermore WRAM: they move with cleanup 5.3; then
  the folder → `core/emulator`), and
  `recorder`, which stays: it is the second extension's composition root, like `extension.js`.
- Headless: `npm run roms` lists the library and adds/selects/marks ROMs (`tools/roms.js`).

## 8. The map editor (from the 2026-10-15 plan)

- One editor: a **game-neutral core** plus **one adapter per game**. The adapter supplies the map
  model, layers, tile source, what collision means and which tools exist. Shared is only
  game-neutral machinery (canvas, zoom/pan, layer toggles, undo/redo, selection, clipboard,
  tile-picker shell, overlay chips, animation preview); a feature moves into the core only when
  both games need it with the same meaning. Evermore concepts (families, ROM budgets, stamps,
  triggers) stay in the Evermore adapter.
- **Saving:** only custom Evermore rooms are saved. Mana edits are never saved (no drafts, no
  write-back: Mana's compressed map often would not fit its slot); write-back and "play my edited
  Mana map" are decided later, together. A converted Mana room in the Evermore Rooms tab can be
  edited but not saved — "make a custom Evermore room from this" keeps the work. A persistent "changes
  are not saved" banner shows while such a map has edits; closing discards them without a dialog.
- **Mana editor v1:** tile painting, erase, pick, undo/redo, BG1/BG2/Collision toggles, zoom,
  animation preview, specials and step events. Collision belongs to the metatile in Mana, so
  painting a metatile changes picture and collision together. Since v0.217 collision, specials and
  trigger kind are drawn as wishes and solved into metatiles (`src/games/mana/maps/webview/editor-props.js`);
  no cell ever gets bytes no metatile has. Objects: place/move/delete, only known fields editable.
  Triggers: add/move/resize step-event cells, set the event number. Scripts show as an event number
  only until Mana event scripts are decoded (checked with `tools/mana/check-events.js`).

**Built (v0.211–v0.217):** `src/core/map-editor/core/` (history, sessions, "not saved"
notice, tool keys; rule `map-editor-core-is-game-neutral`) and `src/core/map-editor/shell/`
(frame, rail, name line, canvas column, dock, tab strip, layout, zoom/pan, CSS; rule
`map-editor-shell-is-game-neutral`) — the Evermore Rooms editor runs on these; the Mana editor
(`src/games/mana/maps/webview/`) on the same shell and core with Select / Pencil / Erase / Pick /
Undo / Redo, Characters and Map-changes object cards (read-only), and the collision/special solver.
Copy map works for a converted Mana room in the Evermore tab. In the new layout both folders are
`core/map-editor/`.

**Left, on purpose (do not assume it done):**
- The action registry replacing the Evermore `editAction` switch and the click router
  (`map-editor-actions.js`, `map-editor-input.js`), and moving the Evermore draft's undo onto
  `edit-history.js`. Until then each game page keeps its own history and click routing.
- Evermore-only tabs (Special, Animation, Widgets) and tools (copy, move, stamp) are absent from
  the Mana page.
- Mana: scripts need decoding first; no write-back, no "play my edited map"; changed cells ignore
  BG priority and colour math.
