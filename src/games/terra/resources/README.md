# src/games/terra/resources — terra://

Rules: [../AGENTS.md](../AGENTS.md). The read-only file system over the Terranigma ROM of the ROM library
(registered by `../extension.ts`, served by `core/resources/rom-file-system.ts`). Pure path resolution in
`files.ts` / `room-files.ts`, so tests call it without VS Code.

| Path | What |
|---|---|
| `terra://rom/index.md`, `info.json` | the ROM: decoded or not, room counts, pictures |
| `terra://rom/rooms/index.md`, `index.json` | every used room: id, script, sections, size, the rooms loaded before it, picture key |
| `terra://rom/rooms/<hex>.png`, `.l0.png`, `.l1.png` | a room's map, both layers / one |
| `terra://rom/rooms/<hex>.tiles.l0.png`, `.tiles.l1.png` | a layer's 512 metatiles, 16 per row |
| `terra://rom/rooms/<hex>.json` | what the Maps page starts from: sizes, both layers' map and tile words, palette, display registers, the load, the exits, chests and map changes |
| `terra://rom/rooms/<hex>.c<k>.png` | the map with the room's map change k applied |
| `terra://rom/groups/index.json` | the rail: rooms by id range, as pictures |
| `terra://rom/cell-types.json` | the 32 cell types: what each does to a move in each direction, the ground table, the overlay's look |

Ids are three lower-case hex digits. A room without a map of its own has no files.
