# games/evermore/imports/terra — Terranigma rooms as Evermore rooms

Rules: [AGENTS.md](AGENTS.md). Translation table: [docs/terra/evermore-rooms.md](../../../../../docs/terra/evermore-rooms.md).

| File | What |
|---|---|
| `convert.ts` | `convertTerraRoom(rom, id, familyId)`: which layers are converted and onto which Evermore layer, the cells (three words each), graphics, families, the backdrop fill, exits and chests as boxes, map changes as objects, the header's display bytes, conversion counts |
| `graphics.ts` | a metatile's pixels from the room's VRAM, the seven kept palettes, a tile's palette and recolouring, its priority, the backdrop colour |
| `collision.ts` | cell types as Evermore collision words (the movement tables' rules, the slopes' solid half from the walls around) |
| `rooms.ts` | `createTerraRooms({soeRom, terraRom})`: the rail (one row per picture, groups of 64 ids), a room's details, the family ids, the default start (where the game's exits arrive), `playable`, `resolveRoom`, `resolveFamily` |
| `index.ts` | facade |

The Evermore side both bridges share (image ids, the in-memory ROM image, the graphic list, boxes, the default
start, colours) is `../common/`; `../index.ts` joins the bridges for the host.

Converting a room takes up to ~150 ms (the game's own loader runs on the interpreter); the rail's catalog ~1 s,
once per ROM buffer.
