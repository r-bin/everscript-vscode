# games/mana/ — Secret of Mana

Kept apart from Evermore (root AGENTS.md §0.4). Rules: [AGENTS.md](AGENTS.md). Facts and evidence:
`docs/mana/`.

| Path | What |
|---|---|
| `descriptor.ts` | Variants and base ROM |
| `decoder/` | Pure TypeScript: header, pieces, metatiles, characters, palettes, the Mode 1 picture, areas, a 65816 interpreter |
| `resources/` | The read-only `som://` file system |
| `maps/` | The Maps panel (the game's main view), built on `core/map-editor/` |
| `extension.js` | Registers `som://` and the Maps panel |
