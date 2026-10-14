# src/mana-resources — `som://`

Rules for agents: [AGENTS.md](AGENTS.md).

| Path | Content |
|---|---|
| `som://rom/index.md`, `info.json` | title, map and area counts |
| `som://rom/maps/index.md`, `index.json` | every map: id, hex, size in cells, area |
| `som://rom/maps/<hex>.png` | the map as the game draws it (frame 0) |
| `som://rom/maps/<hex>.json` | header bytes, sets, halves, display mode, placed/skipped pieces |
| `som://rom/areas/index.md`, `index.json` | areas, their maps, and `pictures` (ids sharing one picture) |
| `som://rom/areas/<slug>.md` | an area's pictures (open with the Markdown preview) |

| File | Role |
|---|---|
| `index.js` | registers the provider; returns `manaRom()` / `refresh()` to `extension.js` |
| `fs-provider.js` | VS Code `FileSystemProvider`, cache of produced files (64 per ROM) |
| `files.js` | pure path → content resolver and the map/area catalogue |
| `rom-source.js` | ROM lookup: `everscript.manaRomPath`, `romPath` if it is Mana, then Mana ROMs next to `romPath` or in the workspace |
| `png.js` | RGBA → PNG |
