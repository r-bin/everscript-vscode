# games/ — one folder per game

Rules: [AGENTS.md](AGENTS.md). How a game is added: the `games-and-roms` skill.

| Path | What |
|---|---|
| `index.ts` | The one list of game descriptors (`registerGames()`), and `romPath` / `baseRomPath` for tests and tools |
| `evermore/` | Secret of Evermore: the decoders, its tabs, `soe://`, the language, the debugger ([README](evermore/README.md)) |
| `mana/` | Secret of Mana: decoder, `som://`, the Maps panel ([README](mana/README.md)) |
| `terra/` | Terranigma: descriptor, ROM tables, the Maps panel |

Each game has `descriptor.ts` (id, header match, variants, capabilities) and `extension.js`
(what it registers in VS Code, called from `src/extension.js`).
