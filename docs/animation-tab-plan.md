# Animation tab — plan

Requested 2026-10-02. Phase 1 (widget clean-up) shipped in v0.109.0; Phase 2
is this document. Evidence: a census of all 1020 Section 2 channels
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

## Open questions

1. The widget timeline: removed entirely in favour of an animation group on
   the widget's canvas (as above)?
2. Picking a ▶ swatch in `anim` mode: create an animation group with
   vanilla's timing automatically, or place it still until a group is drawn?
3. Timing variation chips: phases only, or phases × vanilla delay patterns?
4. Colour override limits (a hut must not turn orange, a half gourd may):
   undecided by the user. Today: any family any piece is drawn in.
