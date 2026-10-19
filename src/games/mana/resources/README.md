# src/games/mana/resources — `som://`

Rules for agents: [AGENTS.md](AGENTS.md).

| Path | Content |
|---|---|
| `som://rom/index.md`, `info.json` | title, map and area counts |
| `som://rom/maps/index.md`, `index.json` | every map: id, hex, size in cells, area |
| `som://rom/maps/<hex>.png`, `.a.png`, `.b.png` | the map as the game draws it (frame 0); layer A (BG1) or B (BG2) alone |
| `som://rom/maps/<hex>.json` | header bytes, sets, halves, display mode, placed/skipped pieces |
| `som://rom/maps/<hex>.collision.json` | per cell `floor` (0-3) and `diagonal` (0, 4-7) as digit strings; `switches`, `specials` |
| `som://rom/maps/<hex>.objects.json` | `objects`: `index`, `x`, `y` (cells), `flags`, `kind`, raw `bytes` (`src/games/mana/decoder/objects.ts`) |
| `som://rom/maps/<hex>.edit.json` | what the map editor starts from: `a` / `b` metatile numbers per cell (B with its own `sizeB`), `collision.a` / `.b` (4 bytes of each of a half's 192 metatiles), `backdrop`, `lead` / `ownEvent`, `events`, `objects` (the character records), `pieces` (the event-flag pieces and their states: `flag`, `values`, the area box, `frames`) |
| `som://rom/maps/<hex>.tiles.a.png`, `.tiles.b.png` | layer A's / B's 192 metatiles as a 16×12 sheet of 16×16 (colour 0 transparent; no priority, no colour math) |
| `som://rom/maps/<hex>.anim.json` | `length` (frames), `images` (PNG data URIs, shared), `kinds`: `cells`, `starts`, `frames` |
| `som://rom/areas/index.md`, `index.json` | areas, their maps, and `pictures` (ids sharing one picture) |
| `som://rom/areas/<slug>.md` | an area's pictures (open with the Markdown preview) |

| File | Role |
|---|---|
| `index.js` | registers the provider; returns `manaRom()` / `refresh()` to `extension.js` |
| `fs-provider.js` | VS Code `FileSystemProvider`, cache of produced files (64 per ROM) |
| `files.ts` | pure path → content resolver and the map/area catalogue |
| `map-files.ts` | the files of one map (pictures, data, collision, animation) |
| `rom-source.ts` | reads the Mana ROM the ROM library names (title-checked, cached) |
| `png.js` | RGBA → PNG |
