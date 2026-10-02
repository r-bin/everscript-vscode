# Enemy Sprites on Maps

Can enemy graphics be drawn on a map, or used as tiles in the map editor? Short
answer: **drawing them on top of a map works today; painting them as map tiles does
not, and would need a new import feature.**

Format detail lives in [../script-format/sprite_format.md](../script-format/sprite_format.md),
[../script-format/character_table.md](../script-format/character_table.md) and
[../script-format/animation_format.md](../script-format/animation_format.md). The
editor's budgets are in the `map-editor-rules` skill.

---

## 1. Enemies are sprites, not background tiles

The SNES draws enemies on the sprite (OBJ) layer, separately from the room's
background tilemap. They don't share anything with the map:

| | Map tiles | Enemy sprites |
|---|---|---|
| Graphics | Block 1 of the room blob, 264 slots | Two global pools: 16×16 at `$EC0000` (data `$D90000`), 8×8 at `$D80000` (data `$D10000`) |
| Layout | Tilemap word: `chr` bits 0..9 | Sprite info at `$CA0003…`: a list of chunks, each placing one block at a signed offset |
| Palette | One of the room's **7 family slots** (tilemap bits 10..12) | The character's own palette, from the character table at `$8EB678` |
| Behaviour | Static, plus collision word | Animation script, hitbox, AI |

So **drawing an enemy on a map never touches the map16 palette.** It's a separate
image layered above the background.

## 2. What already exists

| Piece | File |
|---|---|
| Block decoding and composing a sprite from its chunks | [src/maps/sprites.ts](../../src/maps/sprites.ts) |
| Character table: palette, hitbox, disposition | [src/maps/character-record.ts](../../src/maps/character-record.ts) |
| Animation walk: which sprite each frame shows | [src/maps/character-animation.ts](../../src/maps/character-animation.ts) |
| Idle animation as aligned RGBA frames (`renderCharacterFrames`) | [src/maps/characters.ts](../../src/maps/characters.ts) |
| Frames → PNG data URIs for the Rooms view (`buildSprite`) | [src/rooms/data/room-scripts.js](../../src/rooms/data/room-scripts.js) |

The Rooms view already shows the characters a room's scripts spawn, animated, in
their own palettes.

**Positioning:** a sprite's chunk offsets are relative to an origin **at its feet**,
not its centre. Place the frame box by `originX`/`originY`. Placing it by its centre
drops it about a tile too low.

## 3. Showing enemies in the map editor canvas

The drawing code can be reused as-is: one image per spawn point, positioned by origin.
What's missing is the **spawn positions**. They come from the room's scripts, not
from the map blob, so the editor needs the script model's spawn list for the open
room.

**Budget caveat:** the game can only hold so many sprite tiles in VRAM and 8 OBJ
palettes at once. An editor can show any number of enemies side by side, but the game
may not be able to load that combination in one room. Showing what vanilla already
places needs no check. **Letting the user place enemies does:** a budget check like
the editor's existing tile-family and graphics checks.

## 4. Using enemy graphics as map tiles: not supported

A tilemap word can only point into Block 1 and one of the 7 family slots. It can't
reference sprite graphics. Using an enemy as a tile would mean copying it in:

1. Slicing the composed sprite into 8×8 CHR and writing it into Block 1, which spends
   graphics slots out of 264.
2. Copying the character's palette into a family slot, which spends **one of the 7
   families** on a single picture.
3. Stamping the tiles into the grid.

The result is only decoration: no animation, no hitbox, no AI.

It also breaks the editor's rule against **inventing data the ROM does not attest**.
No vanilla family is made of sprite pixels, and the Tile tab only offers attested
families. Doing this properly would be a distinct feature ("import a custom family
from a sprite") with its own write path and its own budget reporting, not a tweak to
the existing palette.

## 5. Which to build

| Want | Approach | Cost |
|---|---|---|
| See where enemies are while editing | Overlay script-spawned sprites on the editor canvas | Low: drawing exists, needs the spawn list |
| Place real enemies | Edit the room script's spawns, plus an OBJ budget check | Medium: script write-back |
| Enemy art as static scenery | Sprite → custom family import | High: new family source, spends a family slot, outside the attested-data rule |

The first two keep enemies as enemies, and they're the recommended direction. The
third only makes sense if custom families become a general feature.
