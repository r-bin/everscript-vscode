# Suggested collision

When a tile is picked from a family sheet in the map editor, the stamp it
makes gets the collision **shape** that vanilla usually gives that graphic.
With the bottom bar's **Collision** toggle on, every tile in the list shows
that shape and how much of vanilla agrees. A drafted map draws its collision
the same way a ROM room does.

Code:

- `src/maps/vanilla-suggest.ts`: `suggestGeometry`; `src/maps/vanilla-index.ts`: the `canopyCollisions`
  tally.
- `src/rooms/rendering/room-draft.js`: the family-sheet slots, and
  `buildDraftCollision`.
- `src/rooms/webview/map-editor-collision.js`.

Measurement: `npm run check:collision` (`tools/measure-collision.js`). Tests:
`tests/memory/collision-suggest.test.js`.

## Is the assumption true?

The assumption: vanilla gives the same tile the same collision. To test it,
every one of the 390,584 cells in the 127 rooms was predicted from the
**other** 126 rooms (leave-one-room-out). That is the situation of a tile
placed on a new map.

| Target | Key | Key seen elsewhere | Right when seen |
|---|---|---:|---:|
| shape (`cw & 0x0F`) | terrain graphic | 90.3% | **76.9%** |
| shape | terrain + canopy graphic | 60.5% | 87.2% |
| full collision word | terrain graphic | 90.3% | 57.8% |
| full collision word | terrain + canopy graphic | 60.5% | 67.4% |

For comparison, guessing "solid" every time is right 57.9% of the time.

**The score is calibrated.** The score is the share of vanilla placements that
agree with the suggestion (terrain graphic, shape), and it predicts how often
the suggestion is right:

| Vanilla agreement | Cells | Right in an unseen room |
|---|---:|---:|
| ≥ 95% | 27% | 92% |
| 80–95% | 28% | 85% |
| 60–80% | 25% | 65% |
| < 60% | 11% | 45% |

## What that decided

- **Suggest the shape, not the word.** Planes, entity gates and sprite bits
  depend on the room, not on the tile. Copying a vanilla word would also bring
  its elevation plane along, and a plane-1 tile among plane-0 neighbours is
  solid for the player. A painted stamp gets the suggested shape on **plane
  0**, with every other bit 0. That is the editor's existing default,
  `EMPTY_COLLISION`.
- **The key depends on the layer the tile is painted on.** A ground pick uses
  the terrain graphic. A front (canopy) pick uses the canopy graphic, counted
  only where it is real art: each room's blank canopy word, its most-placed
  one, is excluded, or it would vote for whatever the floor does. The canopy
  key is weaker (about 55% in the same test), which is why it is only used for
  front picks.
- **Misses are mostly solid versus open.** The same floor tile is walkable in
  one room and walled off at another room's edge. That depends on where the
  tile is placed, which no per-tile suggestion can know. So the tile list
  marks a suggestion under 60% agreement as unsure (dashed), and its tooltip
  says the tile is used both ways. Diagonals and half-tiles together are
  under 3% of cells.
- **A graphic vanilla never drew on that layer** shows a `?` and is painted
  open.

## How it is drawn

- **Tile list:** the solid region of the shape (the same regions as
  `geometryMask`, checked by a test), in the map overlay's colours. The line
  is plane 0's contour colour and the fill is the wall tint. The agreement is
  printed in the corner.
- **Map:** a custom map has no ROM render to carry its collision, so
  `buildDraftCollision` builds the draft's collision grid into a room and
  draws it with `drawCollisionOverlay`, the renderer every ROM room uses.
  `overlayLayer` turns that into a transparent image, which the editor places
  above its painted cells (`#rg-canopy-ov`). It is redrawn after every change
  to the cells, and whenever Collision is switched on.

**Colours:** each elevation plane has its own contour colour: plane 0 is blue
and plane 1 red (`PLANE_COLORS`, matching upstream `render_map.py`). The walls
of a custom map are plane 0, so they draw blue.

## Not done yet

- Editing a single cell's collision by hand (a shape picker that rewrites only
  the geometry bits, like the gate and drift specials do).
- Using the terrain + canopy pair when composing a front tile over ground. It
  is more accurate where seen (87%), but it needs the index on the webview
  side.
