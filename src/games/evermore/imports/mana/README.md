# games/evermore/imports/mana — Secret of Mana maps as Evermore rooms

Rules: [AGENTS.md](AGENTS.md). Translation table and budgets:
[docs/mana/evermore-rooms.md](../../../../../docs/mana/evermore-rooms.md).

| File | What |
|---|---|
| `convert.js` | `convertManaMap(manaRom, id)`: cells (layer 1, layer 2, collision word each), 16x16 graphics in Evermore's layout, the families `m<n>` it draws with, step-on and B-trigger boxes, the cuttable layer, objects, conversion counts |
| `collision.ts` | Mana collision bytes as Evermore collision words: levels as planes, stairs as Evermore's stairs (only Mana's stair cells carry the mark), currents as drift, sprite priority as bit 12 / the split nibble, signposts and doors as solid B-trigger cells |
| `graphics.ts` | metatiles as 16x16 graphics: palette choice and recolouring, priority (and the pixels Mana never shows), Mana's backdrop instead of black (which layer-B pixels it may fill), Evermore's graphic layout, the graphics list |
| `animation.ts` | the map's animation: colour rotations as palette-cycle descriptors (encoded by `../common/cycles.ts`), moving metatiles as Section 2 channels (their frames, delays, slots past Block 1) |
| `pieces.ts` | event-flag pieces as Evermore objects: one per flag, a state per flag value that changes cells |
| `rooms.ts` | `createManaRooms({soeRom, manaRom})`: the rail's groups, a room's details for the tab, which image answers a request for a converted room or family (4 rooms cached), and `playable(roomId)`: the room's parts, header and default start for Play in emulator (built by the rooms feature's `rendering/rom-export-own.ts`) |
| `index.js` | facade |

The Evermore side it shares with `../terra` is `../common/` ([../README.md](../README.md)): `virtual-rom.ts`
(`buildVirtualRom(soeRom, room, salt)`: the Evermore ROM copied, with the room's graphics, colours and blob in slot
`0x7E`), `ids.ts` (where those go; graphic, family and tab-room ids), the graphic layout and list, colours, pixels,
trigger boxes, the default start.

`convert.ts` (188 lines) is the orchestration: one map's cells, graphics, families, cuts and object
frames share the tile table and word builder it owns. What a cell's bytes become went to
`collision.ts`, what its pixels become to `graphics.ts`, the objects' search to `pieces.ts`, the
animation to `animation.ts`.

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
