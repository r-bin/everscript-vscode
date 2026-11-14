# games/evermore/imports — rooms from other games as Evermore rooms

| Folder / file | What |
|---|---|
| `mana/` | Secret of Mana maps ([AGENTS.md](mana/AGENTS.md), `docs/mana/evermore-rooms.md`) |
| `terra/` | Terranigma rooms ([AGENTS.md](terra/AGENTS.md), `docs/terra/evermore-rooms.md`) |
| `common/` | the Evermore side both share, no other game's code: `ids.ts` (where a converted room's data sits in its image; tab room ids, family ids per game), `virtual-rom.ts` (the in-memory image), `graphics.ts` (Evermore's graphic layout, the graphics list, fitting it into 256 by the nearest twins), `cycles.ts` (rotations as palette-cycle descriptors), `colours.ts`, `pixels.ts`, `boxes.ts` (trigger boxes), `start.ts` (the Boy's default start) |
| `index.ts` | `createImportedRooms({soeRom, manaRom, terraRom})`: the rail's groups, and each request answered by the bridge that owns the room — the one thing the host (`extension.ts`, `radar-panel.ts`, `rooms/editor-host*.ts`) uses |
