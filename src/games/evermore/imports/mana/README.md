# games/evermore/imports/mana — Secret of Mana maps as Evermore rooms

Rules: [AGENTS.md](AGENTS.md). Translation table and budgets:
[docs/mana/evermore-rooms.md](../../../../../docs/mana/evermore-rooms.md).

| File | What |
|---|---|
| `convert.js` | `convertManaMap(manaRom, id)`: cells (layer 1, layer 2, collision word each), 16x16 graphics in Evermore's layout, the families `m<n>` it draws with, step-on boxes, the cuttable layer, objects, conversion counts |
| `pieces.ts` | event-flag pieces as Evermore objects: one per flag, a state per flag value that changes cells |
| `virtual-rom.ts` | `buildVirtualRom(soeRom, room, salt)`: the Evermore ROM copied, with the room's graphics, colours and blob (`maps` `buildOwnRoomBlob`: grid, cuttable layer, objects) in slot `0x7E` |
| `ids.ts` | where those go, and the graphic, family and tab-room ids that follow |
| `rooms.js` | `createManaRooms({soeRom, manaRom})`: the rail's groups, a room's details for the tab, and which image answers a request for a converted room or family (4 rooms cached) |
| `index.js` | facade |

`convert.js` is 265 lines: one map's cells, graphics, families, cuts and object frames share
the tile table and word builder it owns; splitting them would pass that state around.
It must split before it grows further (`pieces.ts` already took the objects' search).

Plain CommonJS on top of the two compiled libraries (`dist/games/mana/decoder`, `dist/games/evermore/maps`, built from `src/` by `npm run build:ts`),
so it has no build step of its own.

## Flow

```
rail row (data-import="som-80")  ->  requestImportedRoom  ->  rooms.detail()  -> convert + image
requestRoomTiles {roomId 0x1080} ->  extension.js radarRoomRom() -> rooms.resolveRoom() -> {image, 0x7E}
                                      -> rooms/ buildRoomTileOverlay(image, 0x7E), as for any room
requestFamilySheet {family m..}  ->  rooms.resolveFamily() -> the image that loaded it
```

Converting a map takes about 20 ms; drawing it about 0.3 s, like a vanilla room.
