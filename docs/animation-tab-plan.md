# Animation tab — plan

Requested 2026-10-02. Phase 1 (widget clean-up) shipped in v0.109.0; Phase 2
shipped in v0.110.0 as described below, with the user's answers (2026-10-02):
the frame controller lives only in the Animation tab (the widget timeline is
gone); ▶ tiles land in the tab while on the map; outside the timing editor a
timing is only its letter A/B/C; colouring limits stay as they are. Evidence: a census of all 1020 Section 2 channels
(docs/map-format/map_animated_tiles.md for the format).

## What the ROM allows, and what vanilla does with it

- A channel swaps the graphic in **one tile slot**: frames are `(graphic, hold
  ticks 1–255)`, plus an initial countdown. Every cell naming that slot moves
  together. There is no per-cell clock.
- **Out of step** = another channel on the same cycle starting at a different
  frame (133 room/cycle cases; the initial countdown is identical in all of
  them). Sometimes the phases also differ slightly in delays and drift (72 of
  the 133).
- **Two copies of one graphic can run on two channels** (room 0x16 runs 2389
  twice with different holds), so a slot is per *(graphic, channel)*, not per
  graphic.
- Delays: 57% equal, 26% equal with a frame nudged by 1–2 ticks, 9% with a
  long pause, 8% free. The same cycle runs at different speeds in different
  rooms (116 of 469 cycles).
- A multi-graphic object (the Antiqua torch: flame 2742–2746 over base
  2747–2751) runs every graphic on the same phase.

## Model

An **animation group** is an object with timing: a rectangle on the map,
frames as layers over it (frame 0 is what the map shows), plus
`delays[]` (one per frame) and `init` (initial countdown, default 0).
`_edit.anims`, beside `_edit.placed` objects; on the one undo history.

- **Animation tab**, after Collision. The pencil drags out a group's rect;
  with a group selected it draws into the selected frame (as the Object tab
  does for states). Rows like the Object tab's, with the timeline (play,
  frame chips, ticks per frame) in the expanded row.
- **Still frames.** A tile picked in the Tile tab's `frames` mode is placed
  still: its graphic is adopted into a slot no channel drives. Today any
  placed graphic vanilla animates plays (stamp-animation.js) and is exported
  with a channel (custom-animation.ts) — that is the "frames still animate"
  bug, and both have to key on the slot's channel, not on the graphic.
- **Export** (custom-animation.ts): per group, per cell and layer, the
  graphics through its frames are one channel's frames, at the group's
  delays. Identical sequences within a group share a channel. Cost shown
  against the 42-channel cap.
- **Vanilla rooms** list their animations in the tab: channels are grouped
  into groups by adjacency of the cells they drive (same timing and phase,
  touching cells). Groups that share a cycle but differ in phase or delays
  are named by timing — "torch · timing A", "torch · timing B".
- **Widgets.** A widget's animation is an animation group drawn on its own
  canvas (it has the same tabs), carried with the widget like its objects.
  The widget-level frame timeline then goes.
- **Timing variation** on a placed widget: chips beside the colouring chips —
  the phases (start frames) and the delay patterns vanilla attests for that
  cycle.

## v0.114.0

- Sets: a pencil rectangle is one animated tile per cell on one timing (a 2×2
  fan); patterns, ticks, countdown, frames apply to every member; one row.
- `animations.cycles`: every cycle per lowest graphic. 167 of 1020 ROM
  channels ran a cycle `byFirst` had dropped (lava's 4410 runs in five) and
  read as `custom`; now every one finds its own pattern (ROM test).
- Cmd/Ctrl+C/V on the tab copy the open placement and paste it at the pointer.
- Long lists: no map copy per row thumbnail, the open row found once; a click
  on a locked map selects the animated tile and scrolls its row into view.

## v0.113.2

- One row per placement (touching cells), not per channel: a vanilla room's
  lava channel on 60 cells in 6 pools is 6 rows, `n of 6`, sharing ticks.
- A custom map's untouched cell takes an animated tile (it has no stamp; the
  tile was silently dropped). A Tile-tab stroke begun on an animated tile
  never falls through to the map.

## v0.113.0

- A frame is one graphic: the Tile tab's pencil on an unfinished animated tile
  tiles its open (else first empty) frame; the frame being looked at is drawn
  over the cell, above the canopy, as the cuttable layer is.
- Frames holding one graphic in a row are one chip with their summed ticks;
  past 127 ticks (vanilla's maximum) a hold is stored as several frames.
- A row's preview is the map's own stamp for its first cell.
- The filter bar's `Animation` chip (default on, saved) shows a violet border
  and the pattern letter on every animated cell.

## v0.112.0 — an animated tile is a channel

The user's rules (2026-10-02): an animated tile is a tile that changes over time —
one channel. The tab lists every animated tile on the map, one row each (where,
a live preview, its pattern). A new one is painted with the pencil as empty
purple frames and works once every frame has a tile. A ▶ swatch is the same
thing, ready-made, at its family's most-used vanilla pattern (`pick` on the
family sheet, from per-family tallies in `vanilla-animation.ts`). Vanilla's
patterns for a cycle are lettered A, B, C… in one global order; a tile shows
its letter, or `custom`. Vanilla animated tiles are locked until disbanded.
Animation can be turned off map-wide (saved). Animation marks are violet
(`--rg-anim`). Groups of channels (v0.110–0.111) are gone, and with them the
drawn rectangle.

## v0.111.0

- A ROM room's animations are listed again (seeding keyed on a flag, not on
  the list existing).
- The pencil's rectangle is an empty animation object (`area`): paint frame
  0, + Frame, paint the next. Each cell gets a slot of its own only where its
  frames differ from the others'.
- One row per animation; its timings are A/B/C chips under the header, `+`
  adds one (it was a new row before). The open timing offers vanilla's own
  timings for exactly those frames as presets, marked `v`; a timing chip whose
  ticks are vanilla's is marked too. `vanilla-animation.ts` now keeps every
  timing per cycle.
- An open, paused timing shows the frame being drawn; ▶ Play runs it.

## Known gaps (v0.110.0)

- A ROM room's own stamps draw their later frames from the host's render of
  the room's channels. Painting a new frame into one of the room's own groups
  changes the data and the export, but the canvas shows it only on stamps the
  draft made (the composed preview). Timing edits show everywhere.
- The initial countdown is drawn as a phase shift; the first loop's longer
  frame 0 is not.

## Questions asked on 2026-10-02 (answered above)

1. The widget timeline: removed entirely in favour of an animation group on
   the widget's canvas (as above)?
2. Picking a ▶ swatch in `anim` mode: create an animation group with
   vanilla's timing automatically, or place it still until a group is drawn?
3. Timing variation chips: phases only, or phases × vanilla delay patterns?
4. Colour override limits (a hut must not turn orange, a half gourd may):
   undecided by the user. Today: any family any piece is drawn in.
