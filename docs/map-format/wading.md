# Wading: half a character behind the scenery

> Status: **found in the code, not yet seen in the game.** The engine and the sprite
> art support it; no vanilla room uses it, and the plugin cannot place it yet.
> Engine details: [sprite_priority.md](../entities/sprite_priority.md) ("The split").

A character standing in water with only its upper body showing. Evermore can draw that
with no new art and no engine patch: one tile setting makes the engine split each sprite
in two by priority, and 1145 of the 5128 sprites already mark their lower chunks for it.

## How the game does it

Every frame `$8FC773` builds a character's OAM attribute from the collision word of the
tile it stands on. Normally the whole sprite gets one priority: 3 (in front of everything)
or 2 (behind the priority half of the layers). On a tile with:

- the same plane as the character,
- bit 12 clear,
- bits 8–11 equal to `4`,

it picks `#$FC20` instead of `#$CC20` (`$8FC7BC`). The OAM assembly `$809433` then keeps
each chunk's own bits 4–5 and adds them to priority 2, so a chunk marked 1 is drawn at 3
and a chunk marked 0 stays at 2.

The marks are already in the art. Of the 5128 sprites `walkSprites` (`src/games/evermore/maps/sprites.ts`)
finds, 1161 mix marks 0 and 1, and in 1145 of them the chunks marked 0 are the lower ones.
The first sprite in the list, `$CA0003`, has its legs (y −18..−2) marked 0 and its torso
and head marked 1. 3878 sprites mark every chunk 1 (they would draw fully in front on such a
tile), 89 mark every chunk 0 (fully behind).

Nibble 4 has bit 8 clear, so the movement gate (`$909DEA`, `map_collision_mechanics.md`
§4) ignores it: the tile walks like the same tile with nibble 0.

## Making a wading tile

1. **Collision word.** Bits 8–11 = `4` (`| 0x0400`), bit 12 clear (`& ~0x1000`), plane
   equal to the ground the character comes from, geometry walkable. Example: a plane-1
   floor `0x0010` becomes `0x0410`.
2. **Art.** The water must have opaque pixels with the priority bit set (tilemap word
   `0x2000`) where the legs should disappear, on the canopy (BG1) or the terrain (BG2).
   Plain water on the non-priority half hides nothing.
3. **See-through, optional.** Without colour math the legs are cut off cleanly. To show
   them through the water, as Secret of Mana does, the room needs a blend that adds the
   sub screen (with OBJ on it) into the water's layer: header display bytes, the
   editor's blend presets.

What the split cannot do: the cut is per chunk, not per pixel, so it falls wherever the
art's chunks meet (about y −18 above the feet for the Boy-sized sprites above), and a
sprite with no mixed marks is drawn whole.

## Not checked yet

- **In the running game.** Patch a tile of a room to `0x0400 | plane`, walk onto it
  headless, dump OAM (vanilla-core save state offset `0x902`, see the
  `emulator-script-debugging` skill) and compare each chunk's priority with its mark.
- **Other readers of bits 8–11.** Only `$909DEA` (movement) and `$8FC780` (depth) were
  read. Enemy AI, the Dog's pathing or a script could also test the nibble.
- **Which characters have mixed marks.** The census counts sprites, not characters: the
  Dog, the Boy's other frames (attacks, alchemy) and enemies were not sorted out.

## In the plugin (not built)

- `spriteDepth` (`src/games/evermore/maps/collision.ts`) answers `front`/`behind`/`hidden`; it would need
  a `split` answer for nibble 4, and the Rooms tab would draw marked chunks above the canopy
  and the rest below it.
- The map editor's Special tab would get a "Wading" special that sets `0x0400` and clears
  bit 12 on the painted cells; the collision overlay would show it.
- Converted Secret of Mana rooms could pair Mana's split priority (collision c1 = 2,
  `docs/mana/README.md` "Half-hidden characters") with this, as a row in
  `docs/mana/evermore-rooms.md`. Not done: both sides are documented, the game test above is not.
