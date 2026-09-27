# Object / widget frame editing keeps regressing

## What the feature should do

Objects on a map (and inside widgets) can have multiple states:

- **State 0** = the base room look — not stored on the object; it is whatever the map cells already show.
- **Frame 1..N** = delta tiles. Only the changed tiles are stored, relative to the object's top-left corner.

The Object tab UI shows one chip per state. Clicking a chip must switch `_objectActiveFrame`, and painting with the Tile brush must write into **only** the active frame.

## What keeps going wrong

We have shipped at least four partial fixes (v0.81.5 → v0.82.1), and the UI still breaks in similar ways:

1. **Clicks on frame chips do nothing.**
   The panel uses delegated event binding. `e.target` is the deepest node under the pointer — usually a `<span>`, `<img>`, or `<b>` inside the chip button. The code walks up from `e.target` looking for any `data-*` name listed in `EDIT_CLICK_KEYS`. If the actual data attribute (`data-object-frame`, `data-object-add-frame`, etc.) is missing from that list, the walk-up skips past the button, finds nothing it recognizes, and the click is silently swallowed.

   This has happened **twice**: v0.81.6 added the first batch of object keys, v0.82.1 added the rest. The underlying cause is that `EDIT_CLICK_KEYS` is a hand-maintained allow-list, and every new clickable data attribute has to be added to it manually. There is no compiler or test that catches a missing key until a user clicks the new button and nothing happens.

2. **Tiles leak into the wrong frame / all frames.**
   Object frame data is stored as an array of delta layers (`o.frames`). The active frame is tracked by `_objectActiveFrame` (a global). `objectLayerWrite` writes into `frames[_objectActiveFrame - 1]`. If the active frame is not actually switched (because the chip click was swallowed), the user thinks they are painting frame 1 but is still painting whatever frame was last active. With widgets, the save path used to serialize only `o.layer` (the active frame), so all other frames were lost on save.

3. **The dock lives outside `#room-detail`.**
   `bindEditControls` attaches the delegated listener to `#room-detail`. The dock (`#rg-dock`) is inserted as a sibling of `#rg-outer`, not a child of `#room-detail`. Clicks in the dock never reached the room-detail listener until v0.81.9 added a second `bindEditControls(dock, room)`. Now the same click can be handled twice if it bubbles, so v0.82.0 added `stopPropagation` from the dock listener. This is fragile because it depends on the exact DOM nesting, which differs between the real panel and the test harness.

4. **No single source of truth for the active frame.**
   `_objectActiveFrame` is global module state. `o.layer` is also kept in sync manually. If any path updates one without the other, the UI and the data disagree. For example, `objectSelect` clamps and sets `o.layer`, but `_objectActiveFrame` is left wherever it was unless the caller changed it first.

## Why cuttable grass works

Cuttable grass is a single global layer, `_edit.cut`, toggled by a bar button (`data-edit-act="cut-layer"`). It does not have per-cell states, per-object frames, or a global active-frame variable. Its button was already in `EDIT_CLICK_KEYS`, and there is only one place it can be painted. The object frame feature has more moving parts, and every moving part has to be wired through the same brittle `EDIT_CLICK_KEYS` list.

## Why we keep failing to fix it

- **The fix is always adding a missing string to `EDIT_CLICK_KEYS`, but there is no test that enumerates all clickable data attributes.** The existing DOM test exercises some chips, but it does not click every single object button. A new button or a refactor can remove or rename a data attribute and the test suite stays green.
- **State is split between `_objectActiveFrame` and `o.layer`/`o.frames`.** Tests check the rendered HTML, not the invariant that `o.layer === frames[_objectActiveFrame - 1]` after every operation.
- **The real DOM differs from the test harness.** The test harness manually builds a subset of the panel HTML. Fixes that work in the harness (e.g. stopping propagation) can mask or expose different behavior in the real panel where `#rg-dock` is actually nested.
- **We keep patching symptoms instead of replacing the mechanism.** The real fix is either:
  1. Generate `EDIT_CLICK_KEYS` automatically from the dispatch table, so it can never drift, or
  2. Stop using a global walk-up list and bind handlers directly to the buttons when the tab HTML is rendered, or
  3. Store the active frame inside the object (`o.activeFrame`) instead of a global, and make `objectLayerWrite` read it from there.

## What would actually fix it

1. **Move object click dispatch into the tab render path.** When `objectTabHtml` builds the chips, attach a single delegated listener to the `#rg-tab-body` container that knows all object data attributes by construction, or attach per-button handlers. Do not rely on a global string list in a different file.
2. **Make the active frame an object property.** `o.activeFrame` (0..N) plus `o.frames[activeFrame - 1]` for deltas. Then `objectLayerWrite` never reads the wrong frame.
3. **Add an invariant test.** After every object operation, assert `o.layer === (o.activeFrame >= 1 ? o.frames[o.activeFrame - 1] : {})`.
4. **Stop nesting `#rg-dock` inside `#room-detail` in the test harness, or match the real panel exactly.** The current mismatch caused v0.82.0's `stopPropagation` fix to be necessary.

## Current status (v0.82.1)

- All object-tab data attributes are in `EDIT_CLICK_KEYS`.
- Object paint/erase strokes are wrapped in `editBegin`/`editEnd`.
- DOM tests verify frame 0 stays empty and frame 2 keeps only its own tile.
- Widget save/restore preserves the full `frames` array.

The feature works today, but the architecture guarantees it will break again the next time someone adds a new object button without updating `EDIT_CLICK_KEYS`.
