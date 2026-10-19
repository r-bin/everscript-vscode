# games/evermore/ — Secret of Evermore

Rules: [AGENTS.md](AGENTS.md). Every folder below has its own `AGENTS.md` and `README.md`.

| Path | Kind | What |
|---|---|---|
| `descriptor.ts`, `derived.ts` | — | Variants and base ROM; the marker our builders write (`EVSX`) |
| `variants.json`, `variant-resolver.ts` | — | Table addresses per release (`docs/evermore-variants.md`) |
| `extension.js` | wiring | Everything Evermore registers in VS Code: the radar, language, debugger, `soe://`, emulator half |
| `radar-panel.js`, `radar-open.js` | wiring | The Memory Radar's state and helpers; opening it and routing its page's messages |
| `rom-readers.ts`, `radar-utils.ts` | library | ROM reads for rooms and characters; Everscript parsing for the radar |
| `maps/` | library | Room format: decode, encode, render, collision, sprites, animation (TypeScript) |
| `script/`, `script-vm/`, `simulation/` | library | The legacy script decoder; its replacement written from the game; symbolic runs of scripts (TypeScript) |
| `localizations/` | library | Names, strings and the knowledge entries (`knowledge/{ram,rom}/`) |
| `resources/` | feature | The read-only `soe://` file system |
| `language/` | feature | Grammar, theme, hover, completion, Build and Run |
| `debugger/` | feature | Debugging `.evs` scripts in the emulator |
| `memory/`, `rooms/`, `sprites/`, `scripts-tab/`, `music/`, `rom/`, `scaling/`, `docs-tab/` | feature | The radar panel and its tabs |
| `emulator/` | feature | Evermore's half of the emulator panel: host side (room pictures, sprites, icons, script trace) and its part of the page, `webview()` (ENTITIES / ALCHEMY / PALETTES and the cheats, `bottom-bar-views.ts`; pause-menu tabs 1-4, `menu-tabs.ts`; the screen overlays, entity sprites, inspector and per-frame RAM sample, `overlays-view.ts` with `room-triggers.ts`) |
| `cdl/` | feature | The CDL export's Evermore seeds and the CDL tab's tools |
| `imports/mana/` | bridge | Secret of Mana maps as Evermore rooms (`docs/mana/evermore-rooms.md`) |
