# Mirror Mode — Romhack Idea

A "Master Quest"-style alternate build of Secret of Evermore: every room is mirrored
left/right, and the west/east exit triggers are swapped so the overworld stays
navigable. Played straight through, it reads as a familiar-but-backwards version of
the game — same content, mirrored geography.

(Loose framing, not a literal precedent: the systematic global flip is what the 3DS
*Ocarina of Time* remaster did, not vanilla N64 Master Quest, which remixed dungeons
without mirroring them. The idea here is closer to the 3DS case — flip everything,
keep the content.)

Status: **idea only**. Nothing below is implemented. This is a scoping note, written
against what `docs/map-format/` and `src/maps/` currently know about the ROM format,
so a future attempt doesn't have to re-derive it.

---

## What has to flip, per room

Everything here is against the room blob layout in the `rom-map-data` skill /
`docs/map-format/rom-map.md`. Room width in 16×16 metatiles is `width_tiles`
(header byte `$02`); `x` below is always in that 16px-tile space unless noted.

| Data | Where it lives | Mirror transform |
|---|---|---|
| Layer 1 / Layer 2 metatile grid | Payload Block 2 (Markov grid), `width_tiles × height_tiles` | Reverse column order: `new[y][x] = old[y][width_tiles - 1 - x]` |
| VRAM tilemap words per metatile | Payload Block 3, slices 0–1 | Toggle `HFLIP` (bit 14, `0x4000`) on every word — see `src/maps/render.ts:33-44` and `src/maps/chr.ts:118-141`, which already implement this bit for rendering |
| Collision word | Payload Block 3, slice 2 | Geometry nibble (bits 3..0) needs a left/right-aware remap, not just a flip — see `docs/map-format/map_collision_mechanics.md` §6. **Drift/slide direction** is the same nibble under the always-walkable override (bit 13) and must have its east/west component negated, or a drifting current reverses in the mirror but the sprite implies otherwise |
| `origin_x` (header `$00`) | Room header | Stays as the trigger-origin offset; it's what the coordinate transform below is relative to |
| Step-on trigger rects (header `$0F..`) | 6 bytes/entry: `y_min, x_min, y_max, x_max, script_id` | `new_x_min = width_tiles - x_max`, `new_x_max = width_tiles - x_min`. `y` fields untouched. `script_id` untouched — see below |
| B-trigger rects | Same layout, after the step-on table | Same transform |

This repo already has the primitive the tile-grid mirror needs (`HFLIP`), because
it's a real SNES PPU bit the vanilla ROM already uses for graphic reuse (see
`docs/map-format/map_tile_graphics_decompression.md`). Mirroring a room is: flip
column order, then flip the bit on every word that's about to land in a new column.
Symmetric metatiles (there are some — see `map_decompression_trace_analysis.md`'s
H-flip mirror examples) need no bit change, just the column move.

`tools/encode_room.py` already proves a room can be rebuilt byte-for-byte and
round-tripped through the real decompressor; a mirrored room would go through the
same `rebuild_model()` / `write_room_into_rom()` path once the transforms above are
applied to the in-memory model, before re-encoding.

---

## The "trigger left/right" part

A step-on trigger's `script_id` is a pointer to *behavior*, not *geometry* — it
doesn't say "go west," it says "run script N." So mirroring one room's trigger
rectangle (moving it from the west edge to the east edge) is necessary but not
sufficient. Two more things have to line up for the world to stay consistent:

1. **Every room gets mirrored, not just some.** If room A's exit to room B moves
   from A's west edge to A's east edge, the world only stays coherent if B is
   mirrored too — otherwise you'd walk off A's newly-eastern edge into a B that's
   still in its original, un-mirrored orientation. This only works as a whole-ROM
   operation, not a per-room toggle.
2. **The destination spawn point is script data, not table data.** Whatever the
   target script does — set spawn X/Y, set facing direction — is Everscript-compiled
   bytecode, which is outside what `src/maps/`'s decoder currently parses (that
   decoder covers room blobs, not script bytecode). If a transition script hardcodes
   an absolute spawn X near the target room's west edge, that X needs the same
   `width - x` transform as everything else, or the player lands in the mirrored
   room facing/positioned wrong. This is real, unscoped RE work — locating and
   understanding transition-script coordinate operands — before mirroring can be more
   than tile-deep.

Sprite/NPC facing (see `docs/script-format/sprite_format.md`'s flip-X chunk bit) and
any script logic that branches on a literal left/right (`DIRECTION.LEFT` etc.) sit in
the same bucket as #2: real, but explicitly out of scope for a first pass, since
they're script-level rather than map-level.

---

## What a v1 prototype should actually attempt

Not "mirror all 127 rooms." Prove the transform on a small connected cluster first:

1. Pick 2–3 adjacent rooms with a plain step-on exit trigger between them (no
   scripted cutscene on entry, no elevation/drift tiles, so collision transform
   risk is minimal).
2. Apply the table above to each room's in-memory model.
3. Re-encode with `tools/encode_room.py --rebuild --compress`, verify the room
   still round-trips (`--verify-rebuild` semantics).
4. Load in an emulator, cross the mirrored trigger boundary, confirm you land in
   the mirrored neighbor at the mirrored spawn point facing the mirrored direction.
5. Only then decide whether the transition-script coordinate problem is small
   enough (a few dozen hardcoded spawns) or large enough (scattered across most
   scripts) to make a full-ROM mirror worth doing.

## Open questions

- How many transition scripts hardcode an absolute spawn X vs. deriving it from the
  trigger rectangle itself? (If most derive it, step 2 above may be most of the work.)
- Do any rooms rely on asymmetric graphics where a plain `HFLIP` toggle produces a
  visibly wrong tile (text signs, directional arrows, numbered doors)? Those would
  need a manual exception list.
- Object/NPC start positions and patrol waypoints (`docs/map-format/map_objects.md`)
  — same `width - x` transform, not yet checked against that doc's byte layout.
- Collision bits 12 and 15..14 are still listed as unresolved in the `rom-map-data`
  skill's "still open" section — worth re-checking those aren't secretly
  direction-sensitive before assuming the geometry nibble is the only one that needs
  care.
