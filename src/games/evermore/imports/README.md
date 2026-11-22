# games/evermore/imports — rooms from other games as Evermore rooms

| Folder / file | What |
|---|---|
| `mana/` | Secret of Mana maps ([AGENTS.md](mana/AGENTS.md), `docs/mana/evermore-rooms.md`) |
| `terra/` | Terranigma rooms ([AGENTS.md](terra/AGENTS.md), `docs/terra/evermore-rooms.md`) |
| `tree/` | not a conversion: the maps of Open Evermore trees in the workspace, Evermore's own rooms read from their files (`maps/tree-map.ts`) and built into a copy of an Evermore image (`index.ts` header; `docs/open-evermore/tool.md` §5) |
| `common/` | the Evermore side both share, no other game's code: `ids.ts` (where a converted room's data sits in its image; tab room ids, family ids per game), `virtual-rom.ts` (the in-memory image), `graphics.ts` (Evermore's graphic layout, the graphics list, fitting it into 256 by the nearest twins), `redraw.ts` (before that, cells redrawn with fewer graphics, the same picture: a colour twin in another palette, one graphic over another; `fitCells` does both), `status.ts` (the rail's colour of a converted room from its counts: red, cannot be played as an Evermore room; yellow, differs from its source or spends past vanilla, `severe` when graphics ran out (only those tint the name); each bridge's `check(vid)` gives the counts without filling its cache), `cycles.ts` (rotations as palette-cycle descriptors), `colours.ts`, `pixels.ts`, `boxes.ts` (trigger boxes), `start.ts` (the Boy's default start) |
| `index.ts` | `createImportedRooms({soeRom, manaRom, terraRom, treeRoots})`: the rail's groups, each room's `status` (cached), and each request answered by the bridge that owns the room — the one thing the host (`extension.ts`, `radar-panel.ts`, `rooms/editor-host*.ts`) uses |
