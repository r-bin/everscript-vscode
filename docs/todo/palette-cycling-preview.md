# Palette-Cycle Preview in the Map Editor

> Domain: Evermore room palettes and the map editor (`src/games/evermore/maps/`, `src/games/evermore/rooms/`)
> Status: 🟢 previewed (Tile › Animation › Palette, the map's Animation chip); timing right since v0.404.0.
> Format: [room reference](../map-format/room-reference.md) §5; routines `palette_cycle_setup` (`$90D50F`),
> `palette_family_reload_queue_process` (`$90D55F`, the sweep), `cgram_animated_palette_timer_tick_and_step` (`$90D58C`).

## What is settled

A room's palette-cycle descriptors (`[b0, b1, b2]`, legacy property `extraGraphics`) rotate a run of
colours: start CGRAM colour `b0 & 0x7F`, span `b1`, one place every |`b2`| frames, up for a positive
rate and down for a negative one, from the CGRAM mirror `$7E6187`. Two slots per palette.
`paletteCycleFrames` (`maps/palette.ts`) is the one rate-to-frames rule; until v0.404.0 the editor
played every cycle three times too slowly (|rate| × 3).

Converted Secret of Mana maps carry cycles too: a Mana colour rotation becomes one descriptor
([docs/mana/evermore-rooms.md](../mana/evermore-rooms.md)).

## Still open

- A third cycle on one palette: `$90D50F` then steps back to the previous palette's second slot
  (`$90D532`). What the game shows then is untested; the editor should warn before allowing it.
- Script opcode `0xB6` can start cycles on OBJ palettes (slots up to 31); room descriptors reach
  only BG palettes 0-7. The editor knows nothing of script-started cycles.
- Phase: in the game all cycles of a room start at load, while the editor's groups start when shown.
- A test that compares a previewed frame with the running game's CGRAM (the measured rate-13 slot,
  frame 6000 of a no-input boot, is a candidate).
- Editing beyond the rate (start, span, adding or removing a descriptor) with raw bytes kept on
  round trip; never added or removed when tiles are painted.

## Related Work

- [Map Editor backlog](map-editor.md)
- [Animated tiles (Section 2)](../map-format/map_animated_tiles.md)
