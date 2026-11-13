# games/evermore/imports/mana — Secret of Mana maps as Evermore rooms

Rules: [AGENTS.md](AGENTS.md). Translation table and budgets:
[docs/mana/evermore-rooms.md](../../../../../docs/mana/evermore-rooms.md).

| File | What |
|---|---|
| `convert.js` | `convertManaMap(manaRom, id)`: cells (layer 1, layer 2, collision word each), 16x16 graphics in Evermore's layout, the families `m<n>` it draws with, step-on boxes, the cuttable layer, objects, conversion counts |
| `animation.ts` | the map's animation: colour rotations as palette-cycle descriptors, moving metatiles as Section 2 channels (their frames, delays, slots past Block 1) |
| `pixels.ts` | a 16x16 block's mirror images and key (shared by the two above) |
| `pieces.ts` | event-flag pieces as Evermore objects: one per flag, a state per flag value that changes cells |
| `virtual-rom.ts` | `buildVirtualRom(soeRom, room, salt)`: the Evermore ROM copied, with the room's graphics (Block 1, then animation frames), colours and blob (`maps` `buildOwnRoomBlob`: grid, cuttable layer, objects, palette cycles, Section 2) in slot `0x7E` |
| `ids.ts` | where those go, and the graphic, family and tab-room ids that follow |
| `rooms.ts` | `createManaRooms({soeRom, manaRom})`: the rail's groups, a room's details for the tab, which image answers a request for a converted room or family (4 rooms cached), and `playable(roomId)`: the room's parts, header and default start for Play in emulator (built by the rooms feature's `rendering/rom-export-own.ts`) |
| `index.js` | facade |

`convert.js` is 289 lines: one map's cells, graphics, families, cuts and object frames share
the tile table and word builder it owns; splitting them would pass that state around.
It must split before it grows further (`pieces.ts` took the objects' search, `animation.ts` the animation).

Plain CommonJS on top of the two compiled libraries (`dist/games/mana/decoder`, `dist/games/evermore/maps`, built from `src/` by `npm run build:ts`),
so it has no build step of its own.

## Flow

```
rail row (data-import="som-80")  ->  requestImportedRoom  ->  rooms.detail()  -> convert + image
requestRoomTiles {roomId 0x1080} ->  extension.js radarRoomRom() -> rooms.resolveRoom() -> {image, 0x7E}
                                      -> rooms/ buildRoomTileOverlay(image, 0x7E), as for any room
requestFamilySheet {family m..}  ->  rooms.resolveFamily() -> the image that loaded it
```

Converting a map takes about 50 ms (its animation is traced: `games/mana/decoder` `traceAnimation`, 480 frames); drawing it about 0.3 s, like a vanilla room.
