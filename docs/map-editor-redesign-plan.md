# Map Editor Redesign — Migration Plan

Source material: `/Users/v/Downloads/design_handoff_map_editor/` (`README.md` +
`Map Editor UI.dc.html`, a Claude Design Component mock — layout/interaction
reference, not production code; its colors/typography are an explicit
placeholder per its own README).

Scope decision (confirmed with user): **full structural rebuild** — the right
panel becomes real tabs (Tile / Special / Trigger / Info / Widgets), not just a
restyle of the current docked sidebar.

---

## 1. Current State (grounded in `src/rooms/webview/`)

- **Shell**: left rail (room tree, already exists) + canvas + a single docked
  column (`#rg-dock` > `#rg-panels`, built in `map-editor-ui.js:editDock()`).
  No tab strip — families, tile browser, composer, constructs, and budget bars
  all stack vertically in one scroll column.
- **Toolbar**: `buildEditToolbarHtml()` in `map-editor-ui.js` renders a flat
  inline row of plain text buttons (class `.rdf`, defined in
  `src/shared/shared.css:120` — `border:1px solid #444; opacity:.35` when off).
  Not a floating pill; sits inline in the filter row, not above the canvas.
- **Filters**: per-room *display* toggles already exist (`data-hide="hide-*"`
  in `detail-renderer.js`) but are independent booleans, not a single
  `layerVis` object, and there is no segmented BG/FG/Collision pill or
  Triggers/Special dropdown chips.
- **Triggers**: `bTrigger`/`stepOn` arrays already exist end-to-end (parsed in
  `content-parser.js`, surfaced in `detail-renderer.js`,
  `map-editor-constructs.js`). There is **no** `selectedTriggerRef`, no
  click-to-select/drag-to-move, no copy/paste, no drag-to-reorder.
- **Capacity bars**: partially exists — `map-editor-panels.js` already has a
  `budgetBar(p)` for the metatile/family budget. Step/B-trigger and room-size
  bars are not wired yet.
- **Special tiles** (stairs/drift, gate, entrance-as-placement-helper): **no
  equivalent exists.** Entrances are currently only parsed/read-only room
  metadata (`content-parser.js`), not an editable tile-adjacent concept.
- **Widgets tab**: no equivalent tab, but `map-editor-deco.js` +
  `rooms/rendering/deco-catalogue.js` / `deco-preview.js` already implement
  almost exactly what the mock calls "widgets" (vanilla Section-3 objects as
  portable, floor-free, stampable entries with previews). **This is very
  likely a reskin of an existing subsystem, not a new one** — audit before
  building anything new here.
- **CSS**: one repo-wide `src/shared/shared.css` (591 LOC) shared by every
  radar tab (memory/rooms/scaling/docs/route), using hardcoded hex colors, no
  custom-property theme. Adding tokens here unscoped would bleed into every
  other tab.
- **File sizes**: 14 files, 2935 LOC total under `src/rooms/webview/map-editor-*.js`.
  Several already sit near the 250–400 "must justify" band (`map-editor.js`
  339, `map-editor-newroom.js` 363, `map-editor-ui.js` 292). New tabs *will*
  push files over the 400-LOC hard limit — split points are planned per phase
  below, not discovered after the fact.
- **No CSP** is set on the radar/rooms panel HTML (`render-radar.js`), unlike
  the emulator panel. Remote resources aren't blocked by our own CSP, but
  depending on Google Fonts (as the mock does) is still an unnecessary network
  dependency for an offline-capable dev tool.

## 2. Target State (from the mock)

Three-column shell: left rail | canvas zone (floating tool pill above a
centered canvas card, bottom filter bar docked under just that column) |
right panel with **five real tabs**: Tile, Special, Trigger, Info, Widgets.
Full behavior spec: see the handoff `README.md` §"Screens / Views" — not
duplicated here to avoid drift between two copies.

## 3. Decisions made now (the mock leaves these open)

- **Typography**: skip the Google Fonts network fetch. Use a system font
  stack for UI text (`-apple-system, "Segoe UI", sans-serif`) and keep the
  existing mono stack (`"SF Mono","Cascadia Code",monospace`, already in
  `shared.css:3`) for coordinates/counts/badges. Same visual register as
  Manrope/JetBrains Mono without an offline-breaking dependency.
- **Token scoping**: new CSS custom properties go in a **new file**,
  `src/rooms/webview/map-editor-theme.css`, concatenated onto the existing
  `css` export in `src/memory/webview/index.js` (one extra `loadFile` call) —
  not appended into `shared.css`. Keeps ownership with `rooms/` and guarantees
  zero visual change to the memory/scaling/docs/route tabs. Variables scoped
  under a single root class so nothing leaks.
- **Palette**: port the mock's oklch values (`bgApp`/`bgChrome`/`bgFloat`/
  `border`/`textPrimary`/`accent`/trigger pink+yellow, etc. — see mock
  lines 969–976) as the literal starting values; they're explicitly a
  placeholder per the handoff README, so exact hue-matching isn't a goal.

## 4. Phased plan

Each phase is independently committable (`release-ritual`: version bump +
validation + commit). Phases 0–2 are strictly sequential and blocking.
Phases 3–5 depend on Phase 2 but are largely independent *content-wise* —
running them in parallel on the shared working tree risks merge conflicts on
`map-editor-ui.js`/`map-editor-panels.js`, so default to sequential unless
explicitly run in isolated worktrees.

| # | Phase | Touches | New state owned | Exit criteria | Suggested owner |
|---|---|---|---|---|---|
| 0 | Design tokens | new `map-editor-theme.css`, `src/memory/webview/index.js` (+1 loadFile) | none | Vars available; zero diff on other tabs' rendering | direct edit (small) |
| 1 | Layout shell | `map-editor-ui.js` (toolbar → floating pill, bottom filter bar split out of the inline row) | none | All existing tools still work; pill floats above canvas; filter bar spans only canvas column | `everscript-plugin-builder` + `webview-dom-safety` |
| 2 | Tab shell | `map-editor-panels.js` (likely split off a `map-editor-tabs.js`), re-home existing families/tiles/composer/budget content under Tile/Info tabs, existing trigger tables under Trigger tab | `activeTab` | Tab switching works; no functional regression, just re-homed DOM | `everscript-plugin-builder`, then `split-orchestration` if a file crosses 400 LOC |
| 3 | Special tab (net-new) | new `map-editor-special.js`; edits to `map-editor-phases.js`, `map-editor-paint.js`, `map-editor-ui.js` (dropdown chip) | `currentSpecialId`, `specialCells` | Stairs/Gate/Entrance chips paint/erase glyphs on the grid; filter-bar gating works | `everscript-plugin-builder` |
| 4 | Trigger tab upgrade — **landed** (see §5.2) | `map-editor-gestures.js` (select/move/copy/paste), new `map-editor-trigger-select.js` (model) + `map-editor-trigger-panel.js` (list UI), `map-editor.js` (undo-step extension), `map-editor-paint.js` (outline rendering) | `_edit.selectedTriggerRef`, `_edit.removedTriggers`, `_triggerDrag`, `_triggerClipboard` (instance field, not state) | Click-select, drag-move (clamped), Backspace/Delete, Cmd/Ctrl+C/V, capacity read-outs | `everscript-plugin-builder` + `webview-dom-safety` (input-focus guard on shortcuts) |
| 5 | Widgets tab — **landed** (see §5.3) | `map-editor-tabs.js` (new tab), `map-editor-panels.js` (deco moved out of Tile), `map-editor-deco.js` (category grouping, visible warnings, ready-only toggle), `deco-catalogue.js` (`back` field), `map-editor-theme.css` | none new — see §5.3 for why "Ready only" is not a new boolean | Existing deco/widget stamping reachable through the new tab; cards grouped by category; warnings visible as text; Widget Editor Mode explicitly deferred, not half-built | `everscript-plugin-builder` |
| 6 | Polish — **landed** (see §5.4) | Triggers filter dropdown (detail-renderer.js/map-editor-trigger-panel.js), zoom chip/resize grip restyle (map-editor-theme.css), `rooms/README.md` client-side list + `STATE_FLOW.md` backfilled with every remaining state owner, full anti-entropy checklist | none | All 7 mock screens visually/behaviorally matched; `npm run typecheck && check:circular && check:dead && check:deps && test` green | direct edit |

## 5. Open questions to resolve during Phase 3/5

- Special-tab "Entrance" placement helpers vs. the room's already-parsed
  `entrances` data (`content-parser.js`) — reuse one model, don't duplicate.
- Whether "widgets" fully subsumes "deco" naming/UX, or the mock's Widgets tab
  is deco plus a few new affordances (ready-only toggle, warnings) layered on.

### 5.1 Correction found while scoping Phase 3 (important — read before executing)

`docs/map-format/map_collision_mechanics.md` (byte-exact, verified) shows the
mock's "Special" groups are **not** equally real:

- **Gate** and **Drift** are real, documented collision-word bitfields (entity
  gate = bits 11..8, `GATE_BLOCKS`; drift direction = bits 3..0 when the AW bit
  13 is set, `DRIFT_VECTORS`) — these can and should be wired to genuine
  collision-word writes on the stamp's `collision` field, extending the
  existing `{layer1, layer2, collision}` model `editResolve` already uses.
  Never invent bit values not in this doc.
- **"Stairs" (Vertical/Diagonal L/Diagonal R)** has *no* confirmed distinct
  collision encoding — the doc's own §8 documents a *previous* version of this
  codebase mistaking plane-transparency for a "stairs" test and calls that
  finding out explicitly as wrong. Do not invent a stairs bitfield. If no real
  encoding turns up on inspection, implement "stairs" as a UI-only tile
  category (an icon/label over an ordinary painted tile) rather than fabricate
  collision semantics for it, and say so plainly rather than silently guessing.
- **Entrance** placement helpers are explicitly "stored in the room's data,
  not the tile grid" per the mock's own README — this has no obvious slot in
  the current draft/export shape (`editExport()` in `map-editor.js` has no
  entrance field, and it's unconfirmed whether `docs/map-format/map_encoding.md`'s
  encoder even accepts injected entrances). Default to a **visual-only**
  overlay for entrances in Phase 3 (not wired into `editExport()`) unless the
  encoder contract is confirmed to support it — flag the gap rather than
  guess at an export shape.
- This subsystem (`src/rooms/webview/`) has **no ROM write path** today — see
  `docs/map-format/map_editor_design.md` §1.1 ("no `writeFile`/save call
  anywhere in `src/rooms/` or `src/maps/`"). `editExport()` only produces a
  draft handoff for an external encoder. Nothing added in Phase 3 should
  change that invariant.
- Separately: `AI_ARCHITECTURE_GUIDE.md` §3 describes a **planned, unbuilt**
  `src/map-editor/` domain (a Custom Editor Provider + external map-server
  bridge) — a longer-term replacement vision in
  `docs/map-format/map_editor_design.md`. This redesign plan is **not** that
  project; it restyles/extends the existing shipping
  `src/rooms/webview/map-editor-*.js` system. Do not create `src/map-editor/`
  or assume its existence.

### 5.2 Decisions made while executing Phase 4

- **Unifying base vs. placed triggers**: implemented the plan's own suggested
  design almost exactly. `_edit.removedTriggers` (`{kind, index}`) marks a
  base-room trigger hidden; moving one hides it and pushes a new
  `_edit.placed` entry at the new position (reusing the existing addition
  mechanism, which already flowed into `editExport()`). One refinement beyond
  the suggestion: deleting a *placed* trigger soft-deletes it (`removed:
  true`) rather than splicing it out of the array, and every `placed` entry
  that is a trigger now carries a stable `uid` (`editNextPlacedUid()`,
  map-editor.js) assigned at creation — including the ones a stamped
  construct's B-trigger/step-on already adds (map-editor-constructs.js). Both
  changes exist so a `selectedTriggerRef` of `'placed:'+uid` keeps naming the
  same trigger across re-renders and across the pre-existing tail-only
  undo-prune rule for `_edit.placed` (`editPruneAdded`'s doc comment,
  map-editor.js) — a positionally-addressed splice from the middle would have
  broken that rule the same way removing a middle metatile dictionary entry
  would.
- **Undo/redo extension**: a trigger op (delete/move/paste) is recorded as a
  full before/after snapshot of `{removedTriggers, placed}` (both arrays are
  small — a room's own trigger count plus whatever the draft added), rather
  than a cell-by-cell diff. `editUndo`/`editRedo` branch on whether a step
  carries `.triggers`, sharing one stack with `editApply`'s steps as required
  — see `editApplyTriggerOp()` in map-editor.js. A real bug turned up writing
  the tests for this: undoing a paste (or redoing a delete) could leave
  `_edit.selectedTriggerRef` pointing at a trigger that no longer exists,
  since neither snapshot touches selection (it's UI focus, not draft data).
  Fixed with `editDropStaleTriggerSelection()`, called at the end of both
  `editUndo` and `editRedo`.
- **No "x/16" trigger capacity ceiling**: `docs/map-format/rom-map.md`'s
  step/B-trigger tables are byte-length-prefixed (`step_len`/`b_len`), not
  count-limited, and no per-room maximum trigger count is attested anywhere
  in `docs/map-format/`. The design mock's "x/16" is its own placeholder
  state, not ROM evidence. The Info tab shows the count with no denominator
  instead — the same honest shape the existing "stamps" budget row already
  uses ("no field limit") — rather than fabricate a ceiling.
- **Drag-to-reorder within/between the step and B lists** (mentioned in the
  mock's own spec) was **not implemented**. Reordering a *base* trigger has
  no attested meaning — whether step/B-trigger table order affects in-game
  evaluation priority when boxes overlap is unconfirmed by any doc in
  `docs/map-format/`, and inventing reorder semantics for ROM-sourced entries
  would be exactly the kind of unvalidated mechanics simulation this
  project's rules forbid. Reordering *placed* triggers only (leaving base
  order alone) was considered but cut for scope given everything else in this
  phase; flagged here as an open question for whoever picks up Phase 5/6, not
  silently dropped.
- **File-size proactive split**: `map-editor.js` was already at 396 lines
  before this phase's undo-stack changes; rather than let it cross 400,
  `editStampCount`/`editAddStamp`/`editStampWords`/`editSlotChr`/
  `editAdoptGraphic`/`editBrushFromTile`/`editNeededStamps` (the "stamp
  dictionary" concern, no undo-stack logic of its own) moved to a new
  `map-editor-stamps.js`. Purely a location change — every caller across the
  codebase and the test suite kept working via the bundle's shared scope;
  test files that load `map-editor.js` standalone were updated to also load
  the new file.

### 5.3 Widget Editor Mode — deferred, not built (decided while executing Phase 5)

The mock's own README describes a distinct **screen 7**: a mode where you
author a *custom* widget on its own small W×H grid (an "Edit widgets" entry
card, Export/Import widgets links). This is different in kind from
everything else Phase 5 built — the rest of the Widgets tab picks *existing*
vanilla Section 3 objects by sight; screen 7 is about creating new,
user-defined ones from scratch and saving them.

Checked before deciding, per this phase's own brief:

- `map-editor-deco.js`'s own header comment is explicit that the ROM stores
  no names for its objects and nothing in this subsystem invents a label —
  there is no concept anywhere in this codebase of a user-authored, savable
  widget definition, distinct from a ROM-sourced entry.
- `map-editor-newroom.js` (the blank-room drafting mechanism) was inspected
  for reusable groundwork, since a custom widget is conceptually a tiny
  standalone canvas, similar to a blank room. What it has is a *ROM-borrowing*
  blank room: `requestBlankRoom()` asks the host to render a grid that
  borrows an existing room's graphics/families (`NEW_MAP_BORROW = 0x34`), and
  the result becomes the *editor's own draft* (`_edit.blank`), not a
  separate, independently-savable artifact. There is no serialization format,
  no save/load message, and no storage location for "a widget" as a named,
  reusable thing distinct from a draft room. Building one from scratch is not
  a small extension of the newroom flow — it is a new persistence concept
  (what gets saved, where, in what shape, and how it round-trips back into
  the picker) that no existing model in this repository answers.
- This subsystem also has no ROM write path at all (§5.1) and no export
  format for anything but a room draft (`editExport()`) — a saved custom
  widget would need its own shape, unrelated to that function's contract.

Building Widget Editor Mode inside this phase would have meant inventing a
persistence format and a save/load round-trip with no validated model or
existing convention to build on — exactly the kind of scope creep the
phase's own instructions call out as worse than deferring. **Not built.** The
existing vanilla-picker experience (search, filters, category grouping,
ready-only toggle, visible warnings, arm-and-stamp) is Phase 5's complete
deliverable. If a future phase wants this, it needs its own design pass:
what a saved widget looks like on disk (or in extension storage), how
Export/Import round-trip it, and whether it reuses the construct/stamp
machinery (`map-editor-constructs.js`) or needs its own.

### 5.4 Decisions made while executing Phase 6

- **Triggers filter dropdown**: added the same shape as the Special chip
  (flat toggle + caret + popup of sub-toggles), reusing rather than
  inventing state: `hide-step`/`hide-btrig` were already real
  `shared.css` rules with no chip wired to them (only the combined
  `hide-trigger` was reachable before this phase). Lives in
  `map-editor-trigger-panel.js` (`buildTriggerFilterChipHtml`), the same
  file that already owns the Trigger tab's list UI — not a new file, since
  the chip carries no model of its own (unlike Special's collision-word
  math). The three filter-dropdown CSS classes (`.rg-special-filter`/
  `.rg-special-caret`/`.rg-special-dropdown`) were generalized to
  `.rg-filter-group`/`.rg-filter-caret`/`.rg-filter-popup` so both chips
  share one chrome definition instead of duplicating ~15 lines of CSS; each
  popup's own id (`#rg-special-dropdown`, `#rg-trigger-dropdown`) is what
  the close-on-outside-click logic and each chip's own toggle key off of,
  not the class. `map-editor-input.js`'s single `EDIT_FILTER_MENUS` list
  replaces the Special-only close-on-outside-click block from Phase 3 — a
  third dropdown needs one list entry, not a second mechanism.
- **A real, pre-existing visibility bug found by this phase's own visual QA
  pass**: `.rg-special-filter`/now `.rg-filter-group`'s popup rule set
  `display:flex` unconditionally. Author stylesheet rules always win over
  the browser's own `[hidden]{display:none}` UA rule regardless of
  selector specificity, so the Special dropdown had been visually open at
  all times since Phase 3 shipped — nobody noticed because the only
  regression test asserted the DOM `.hidden` IDL property (which the
  `hidden` *attribute* still reflects correctly), not actual computed
  paint. Fixed with one `.rg-filter-popup[hidden]{display:none}` override,
  and `tests/memory/map-editor-dom.test.js`'s two dropdown-close checks now
  also assert `getComputedStyle(...).display === 'none'` so this class of
  bug cannot regress silently again. Caught by rendering the real bundle
  (`src/memory/webview/index.js`'s `roomsJs`/`css` exports) with Playwright
  and looking at a screenshot, exactly as this phase's brief asked for —
  the existing DOM test suite's own `.hidden`-only assertions would never
  have caught it on their own.
- **Zoom chip / resize grip**: chrome-only restyle
  (`.rg-zoom`/`.rg-resize`/`.rg-resize-label` in map-editor-theme.css,
  scoped under `.rg-theme` like everything else there) — position, sizing
  and drag math (`interactions.js`'s `setupZoomPan`,
  `map-editor-newroom.js`'s `resizeStart`/`resizeMove`/`resizeEnd`) are
  untouched, per the phase's own constraint.
- **STATE_FLOW.md backfill**: one terse table per the brief, appended below
  the existing ownership table rather than interleaved with it, so the
  Phase 3-5 rows (already well-documented) are undisturbed. The forward
  reference that used to say "see `src/rooms/README.md`... for the full
  inventory" now points at this new block instead.
- **Nothing else in the mock's 7 screens needed a fix.** The full visual QA
  pass (browsing mode + all five edit tabs, both filter-bar dropdowns
  open) turned up only the `[hidden]` bug above — no layout overlap, no
  missing theme tokens, no broken tab switching.

## 6. Redesign complete

Phases 0-6 have all landed, across the following commits (develop branch,
chronological): design tokens and layout shell (Phase 0-1), the tab shell
(Phase 2), the Special tab (Phase 3, `v0.52.0`), a filter-bar visual fix
(`v0.53.1`), the Trigger tab upgrade (Phase 4, `v0.53.0`), the Widgets tab
(Phase 5, `v0.54.0`), and this polish pass (Phase 6). The right panel is now
five real tabs (Tile / Special / Trigger / Info / Widgets) over a themed
canvas card, matching the design mock's own screens.

**Known future work, deliberately deferred rather than half-built:**

- **Entrance export-shape gap** (flagged in §5.1, Phase 3): Special-tab
  entrance placement helpers are visual-only — `editExport()` has no field
  for them, and it remains unconfirmed whether the sibling `everscript`
  repo's Python encoder accepts injected entrances at all. Before wiring
  entrances into the real export, confirm that encoder contract first;
  don't guess at a shape.
- **Widget Editor Mode** (flagged in §5.3, Phase 5): authoring a *new*,
  user-defined widget from scratch (the mock's screen 7 — its own small
  W×H grid, Export/Import). This needs a genuinely new persistence concept
  (what gets saved, where, in what shape, how it round-trips into the
  picker) that no existing model in this repository answers yet — not a
  small extension of the existing vanilla-picker Widgets tab.
- **Trigger reorder** (flagged in Phase 4's own decisions, §5.2): the
  mock's drag-to-reorder within/between the step and B lists was not
  built. Reordering a *base* (ROM-sourced) trigger has no attested
  in-game meaning in `docs/map-format/`; reordering only *placed*
  triggers was considered and cut for scope. Still open if a future
  session wants it.

If a future session wants to pick up any of the above, treat it as new
scope with its own design pass — not a continuation of this plan's
already-closed phase table.

## 7. Fidelity pass (phases 7a/7b) — why the redesign still didn't look like the mock

After phases 0–6 all shipped green, the user compared the running editor
against the mock side by side and said: widgets look good, the right sidebar
looks decent (but its **tab order is wrong** — the mock is Tile / Special /
Trigger / **Widgets** / Info, we shipped Info before Widgets), special-tile
drawing looks fine — **and "the rest is way worse."**

**Root cause, and it is a briefing failure, not an execution one.** Every
phase 0–6 brief said some version of "restyle, preserve every existing
button, every `data-*` attribute, no new functionality, no DOM restructuring
beyond styling hooks." Each phase honoured that faithfully. But the mock's
entire design thesis is *reduction* — it shows 6 controls where we render
~25, icon buttons where we render word-labels, one compact pill where we
render a multi-row block, a centered card floating in empty space where we
render a full-bleed grid. "Preserve every control where it is" and "look
like the mock" are contradictory instructions. The result was a **themed
version of the old layout**.

So this pass explicitly authorizes what earlier phases forbade: moving,
regrouping, and hiding-behind-overflow. The constraint changes from *"every
control keeps its position"* to **"every control stays reachable."**

### 7a — the canvas column (highest visual impact) — **landed** (see §7a.1)

| Current | Mock (`Map Editor UI.dc.html`) |
|---|---|
| Multi-row toolbar block: `room`/`deco`, 5 tool icons, `copy`/`move`/`stamp` as words, then `undo`/`redo`/`discard`/`new room`/`copy draft`, then a status line | One compact icon-only pill (`floatingToolbarStyle`, ~line 1100), grouped by dividers, floating above the card |
| `+ − fit` buttons in their own row above the canvas | A `100%` chip inside the card's bottom-left (`zoomChipStyle`, ~line 1196) |
| Full-width flat grid, left-aligned, no card | Centered card: rounded, shadowed, padded (`canvasCardStyle` ~1097 inside `canvasInnerStyle` ~1096) |
| 3 rows of ~25 filter chips | One row: segmented `Background\|Foreground\|Collision` pill (`tileVisGroup.wrapStyle` ~1143) + `Triggers ▾` + `Objects` + `Special ▾` (`layerDockBarStyle` ~1193) |
| Status text buried in the toolbar block | Full-width bottom status bar: `x: 07 y: 04 · 18 × 12 · Edit 4 of 12 · Paint mode` |

Mapping decisions (so nothing is lost):
- `new room` → the rail's `+ New Map` footer (7b) — the mock puts it there.
- `copy draft` / `discard` → overflow (`⋯`) in the pill.
- `undo`/`redo` → icon buttons (`↶ ↷`).
- `room`/`deco` phase → the pill slot where the mock puts `BG`/`FG`. Same
  shape of control (which layer a stroke writes). **Keep this repo's own
  `room`/`deco` names and semantics** — they are a real, documented concept
  (`editResolve`), not a cosmetic label to rename for the mock's benefit.
- The ~19 extra inspector toggles we have and the mock never modelled
  (`map`, `composite`, `drift`, `elevation`, `pass-thru`, `gates`, `grass`,
  `labels`, `animate`, `export png`, `header`, `scripts`, `8px`, `16px`,
  `npc`, `hitbox`, `canopy`, `arrivals`, `🌿`) → folded into the three
  dropdowns by affinity, plus a `more ▾` for the leftovers.
- **Do not render a control for a tool that does not exist.** The mock's
  pill shows `S`/`B` (draw a new step/B trigger) and `◆` (paint collision
  directly); this codebase has no such tools. Leave them out and flag them
  — a dead button is worse than an honest gap.

### 7a.1 What actually landed

Every row of the table above shipped. Details worth carrying forward:

- **Tab order** fixed in one line (`EDIT_TABS`, `map-editor-tabs.js`): Tile /
  Special / Trigger / **Widgets** / Info, matching the mock's own `tabDefs`.
- **The canvas is a centred card.** `svg-builder.js` now wraps the grid in
  `.rg-canvas-zone` > `.rg-canvas-card` (the mock's `canvasInnerStyle` +
  `canvasCardStyle`). The card is deliberately the positioning context for
  both the tool pill and the zoom chip, so `editToggle` inserts the pill into
  `#rg-canvas-card` rather than `#rg-outer`.
- **The toolbar is an icon-only pill** (`map-editor-toolbar.js`, split out of
  `map-editor-ui.js`): `[↖ ✎ ⌫ ▭ ⤵] | [⧉ ✥ ❖] | [room deco] | [↶ ↷] | [⋯]`,
  absolutely positioned over the card's top edge, every button carrying its
  pre-existing tooltip text. `room`/`deco` keep their words — they are a
  documented concept (`editResolve`), and no glyph for "replace the floor" vs
  "add over it" would read.
- **`discard` / `copy draft` / `new room` moved into the `⋯` overflow.**
  `new room` is there *for now*; §7b moves it to the rail's `+ New Map`
  footer, and there is a code comment in `EDIT_OVERFLOW_ACTS` saying so.
- **The zoom row became a chip** in the card's bottom-left, showing a live
  percentage (`100%` = one ROM pixel per screen pixel — the viewBox unit is
  an 8 px tile, so the scale is divided by 8). `+`/`−`/`fit` are still inside
  the chip with their original ids, so `interactions.js`'s `setupZoomPan` is
  untouched apart from writing the read-out from its own `applyZoom`.
- **The filter bar is six controls** (`map-editor-filterbar.js`, split out of
  `detail-renderer.js`): a segmented `Background | Foreground | Collision`
  pill, then `Triggers ▾`, `Objects ▾`, `Special ▾`, `More ▾`, then the two
  actions (`edit`, `locked`) past a divider. All 21 `data-hide` keys and all
  9 ROM feature flags survive — a regression test enumerates them by name so
  dropping one cannot be silent.
- **Background/Foreground are two derived views of one owner.** The host
  bakes exactly one of `composite`/`layer2`/`layer1` per render, so there is
  no "both layers independently visible" state to mirror. `romLayerVis()`
  (rom-overlay.js) derives the two booleans from `_currentLayer`, and
  clicking a segment writes back through it; "both off" is refused because
  there is no render for it. `composite` stays reachable in `More ▾`.
- **`Objects` got a dropdown the mock does not give it.** The mock's editor
  draws one kind of object; this one draws seven (source objects, ROM
  objects, NPCs, hitboxes, grass, entrances, enemies, Lua POIs). The
  alternative was spilling six chips back into the primary row.
- **A full-width status bar** under the filter bar: `x: 07 y: 04 · 24 × 16 ·
  <draft summary> · <hovered entity label>`. `#rg-edit-count` kept its id and
  its writers and just moved out of the toolbar; `#rg-tip` (the hover label)
  likewise moved out of its bare div into the bar's right end. Hover
  coordinates are a capture-phase `mousemove` on `#rg-wrap` — same node as
  `setupEditGestures`'s handler, which calls `stopPropagation()` mid-stroke,
  so a bubble-phase listener on an ancestor would have gone dead during a
  paint drag.
- **Not built, on purpose:** the mock's `S` / `B` (start a step- / B-trigger
  draft) and `◆` (collision brush) pill buttons. This codebase has no such
  tools — no trigger-drawing draft, no collision brush — so no button is
  rendered for them. A dead control is worse than an honest gap. If a future
  phase wants them, they are new *tools*, not new chrome.
- **File split:** `map-editor-ui.js` 309 → 248 (the pill left),
  `detail-renderer.js` 388 → 354 (the bar left), and
  `map-editor-theme.css` 381 → 189 with the canvas column's chrome moving to
  a new `map-editor-canvas.css` (395 — near the limit; the next rule added
  there should be the trigger to split the filter-bar chrome off again).
  `map-editor-input.js`'s per-dropdown `if` blocks collapsed into one loop
  over `EDIT_FILTER_MENUS`, which now also drives the pill's `⋯`.
- **Verified visually**, not just structurally: the real `roomsJs`/`css`
  bundle rendered in headless Playwright, screenshotted in browsing mode,
  edit mode, with both the `More ▾` drawer and the `⋯` overflow open, and on
  every one of the five tabs. That pass caught one real overlap — shared.css's
  "decoding ROM map…" badge is centred on `#rg-outer`'s top edge, which is
  exactly where the pill now hangs — and it was re-hung on the card's own
  top-right corner. Visibility assertions check computed `display`, not the
  `.hidden` IDL property, including for the new `display:grid` popup, which
  needs its own `[hidden]` override for the same cascade reason Phase 6 found.

### 7b — the left rail — **landed** (see §7b.1)

Mock: a `Search rooms` input, a collapsible `VANILLA ROOMS` group with
`ACT 0…4` + `MISC` sub-groups, a `CUSTOM ROOMS` group, and a `+ New Map`
footer button, in a roomy sans-serif list. Before this phase: a dense
monospace list with a `ROOMS` header and `Live`/`Vanilla` mode buttons, no
search, no footer action.

### 7b.1 What actually landed

- **The `Live` / `Vanilla` mode toggle is gone; the rail is one list.** The
  two trees are now two collapsible top-level groups, `VANILLA ROOMS` and
  `CUSTOM ROOMS`, in one scroll box — the mock's own structure. This was a
  judgement call the brief left open, and the reason it is safe is that the
  distinction was never *modal*: a row already said which tree it came from
  (`data-vid` = ROM catalogue, `data-map` + `data-line` = a room declared in
  the active `.evs` file), and `renderRoomDetail` already accepted either
  shape. So `_vanillaMode` was not state at all, only a rendering mode for
  two lists that could always have been shown at once. Custom is expanded
  and Vanilla collapsed on load, which shows exactly the information the old
  `Live` default did. **Real behaviour changes, both improvements:** one
  selection now clears the other (pre-7b each tree cleared only its own
  `.rsel`, so a live row and a vanilla row could both look selected), and
  switching groups no longer blanks the detail panel.
- **Grouping stayed as areas.** The mock shows `ACT 0…4`; the catalogue
  groups by area (`Prehistoria`, `Antiqua`, `Gothica`, …), which is the
  game's own structure and real data. The mock's *treatment* was adopted
  (collapsible headers with a chevron, quiet uppercase 11px labels indented
  18px, roomy rows) — its placeholder content was not.
- **Search is net-new** and client-side only: no host round-trip, no second
  copy of the room list. It matches on a row's label *and* its id, so
  `sewers` and `0x12` both find Ebon Keep sewers; an area sub-header or a
  whole group left with nothing in it is hidden, and "No rooms match" is an
  explicit empty state rather than a blank rail. Expansion state is never
  *written* while filtering — a `.rm-searching` class force-reveals collapsed
  groups and areas through CSS for the duration — so clearing the field
  restores exactly the tree the user had open.
- **`+ New Map` and the editor's `new room…` turned out to be two different
  actions**, so they stayed two controls. §7a's note said 7b would move
  `new room` out of the `⋯` overflow; checking first showed the overflow
  action opens an inline w/h form and drafts a blank room borrowing
  *whichever room is currently open* (`editNewRoom` → `requestBlankRoom`),
  while `everscript.newMap` is a project-level entry point that works with
  nothing open at all (`roomsNewMap()`: navigate to the graphics donor 0x34,
  turn edit mode on, draft a fixed 24×16). The rail footer got the second
  one — it calls `roomsNewMap()` directly rather than posting a message the
  host would only bounce back — and the overflow kept the first. Collapsing
  them would have lost either the size form or the no-room-open path.
- **Font scoping.** The rail is a *sibling* of `#room-detail`, so
  `.rg-theme`'s tokens cannot reach it. It carries its own hook, `.rg-rail`,
  added to theme.css's token selector (`.rg-theme, .rg-rail`) — one
  declaration of the palette, two scopes, no duplicated values — and that
  same hook is what switches the rail, and only the rail, off shared.css's
  monospace body font. Room ids inside it stay mono on purpose.
- **New files, not new rules in a full one.** `rooms-rail.css` (the chrome)
  and `rooms-rail.js` (every rail interaction, split out of `tab-init.js`,
  which now owns only the tab strip). `map-editor-canvas.css` was at 395
  lines and §7a's own note said the next rule added there should trigger a
  split, so nothing was added there; nothing went into `shared.css` either,
  which every radar tab renders with. `shared.css` in fact *lost* three
  rules (`.rm-ph`/`.rm-mode`/`.rmm`) that died with the mode toggle.
  `tree-renderer.js` gained `buildRoomRailHtml()` so `render-radar.js` stays
  an orchestrator.
- **Verified visually and by pixel diff.** The rail was screenshotted from
  the real `renderRadarHtml()` output in headless Playwright in six states
  (default, Vanilla open, a room selected, a search term active, no matches,
  no rooms in the file) and compared against the mock. Separately, the five
  non-Rooms tabs (memory/scaling/route/docs/rng) and the room *detail* panel
  were rendered at `HEAD` and at this change and diffed: **pixel-identical**,
  which is the hard requirement every phase since Phase 0 has carried.
  `tests/memory/rooms-rail-dom.test.js` (33 checks) locks the behaviour in,
  asserting computed `display` rather than the `.hidden` IDL property
  throughout, for the cascade reason Phase 6 found the hard way.
- **Not built, on purpose:** the mock's collapsed 44px rail with per-room
  avatar initials (`railCollapsedFlag`/`avatarStyle`/`railHandleStyle`) — a
  200px rail inside a VS Code panel that is already narrow buys little, and
  a drag-to-resize handle is a whole state owner (persisted width) for a
  cosmetic win. Also not built: the mock's `Widgets` rail mode, which
  belongs to the deferred Widget Editor Mode (§5.3), not to the rail.

## 8a. The Tile tab — **landed** (v0.58.0)

The user's framing: *"work on the tiles tab. it is the focus point of this map
editor."* Same §7 rule applied — restructure, don't restyle.

**What was wrong:** the tab led with two explanatory sentences where the mock
leads with a count; the seven adopted families and the ~300 adoptable
candidates were **one interleaved list** (the `× / +` mix), which was most of
why the panel read as noise; the layer override was three loose chips; the
family group headers were sentences (`187 Prehistoria slot 2 · 9 graphics ·
best match 62%`).

**What landed:**
- `TILE FAMILIES` / `7/7 active` header; both prose sentences deleted, every
  fact they carried moved into tooltips, counts or placeholders.
- Adopted families and candidates **split into two groups**, with a collapsed
  swatch strip and an expanded 2-col card grid, plus an `+ add a family`
  control.
- The **invalid-family banner** promoted out of the Info tab's checks list,
  where `editStrandedCells()` was only a single line, into the mock's banner
  with its two real actions (re-adopt, or clear the stranded cells as one
  undoable `editApply` step) — `map-editor-stranded.js`.
- Segmented brush-modifier row: `auto|front|ground` (the existing
  `_layerForce`) and a **new `H|V` mirror**.
- `LIKELY NEIGHBORS` as the mock's collapsible card over the existing ranked
  list.
- Family group headers restructured from sentences into headers.
- `map-editor-relations.js` split out of `map-editor-chips.js` (the
  relationship model was tangled with the cards that read it).

**Open questions, resolved:**
- **H/V flip is real and correct.** Bit 14 is horizontal flip and bit 15
  vertical (`docs/map-format/map_rendering_pipeline.md` §3); `renderVramLayer`
  reads exactly those bits back per word, so a word this ORs them into renders
  mirrored on canvas and in the composed preview with no second code path.
  `building-a-room-from-a-picture.md` §9.1 ("priority and the two flips are
  geometry, not identity") and §6 (the matcher's search space counts **4 flip
  combinations** per graphic) confirm the format treats a mirrored tile as a
  legal variant of the same art. It costs a dictionary entry but **no**
  graphics slot — mirroring is free art against a 7-family ceiling, which is
  the whole reason it is worth having.
- **The mock's two segmented controls did not both map onto us.** Its
  `Auto|All` + `All|BG|FG` split has no second real axis in our data; we have
  one (`_layerForce`). Rendered as one segmented pill rather than
  manufacturing a second control to match the drawing.

### 8b — directional neighbours — **landed** (v0.61.0, see §8b.1)

The mock's `LIKELY NEIGHBORS` is a **plus-shape**: centre tile, N/E/S/W
candidates. Until v0.61.0 the adjacency model was **undirected** —
`relatedTiles()` (`rendering/vanilla-index.js`) returns `[graphic, score,
uses]` scoring "drawn beside", with no per-direction breakdown — so the card
was a ranked list, because compass points over it would have fabricated a
distinction never measured (the §5.1 "stairs" mistake). Unlike stairs, it was
computable: the walk already visited right and down neighbours separately and
only then collapsed them. §8b.1 is what extending it looked like.

### 8b.1 What landed

The user: *"likely neighbors should be implemented as specified"* — the design
handoff README §2: centre = current tile, N/E/S/W = predicted candidates with
a match-% badge, click/scroll a side to cycle, click the centre to toggle the
draw layer.

**Data (`src/maps/vanilla-adjacency.ts`, split out of `vanilla-index.ts`).**
- The grid walk moved into its own module (vanilla-index.ts 432 → 402 LOC) and
  now files every edge twice more: a right pair is `b` east of `a` and `a`
  west of `b`; a down pair `b` south / `a` north. Same loop, no second scan,
  no new decoding. The undirected `adjacency` is byte-identical (693079 edges,
  49374 pairs) and still drives ranking, `rankByRelationship` and the family
  sort. `npm run check:maps` asserts every pair's four sides over both layers
  sum to exactly its undirected count, and that east/west and north/south are
  exact mirrors (0 mismatches on the real ROM).
- **Per layer.** Keyed `graphic*2 + layer`. The walk only ever pairs canopy
  with canopy and terrain with terrain, so a front brush's east neighbour is
  the next piece of the object and a floor brush's is the next piece of
  floor; merging would hand a gourd the floors it was laid on. Measured: the
  gourd (3736) has four empty terrain sides.
- **Representation.** Built as nested Maps during the walk, then compacted
  to `Map<key, Int32Array>` of `[other*4 + side, uses]` pairs, grouped by side
  and pre-ranked by score, so a query is one scan with no sort. 174586
  entries over 6971 keys: **2.02 MB** retained heap (the undirected map is
  4.53 MB for 98748 entries), whole index 8.7 → 10.7 MB. Build ~115 → ~175 ms
  warm, once per ROM (cached).
- **Score: per-side Jaccard over that layer's cells** —
  `uses / (cells_L(a) + cells_L(b) - uses)`. The sets are edge slots: each
  cell `a` is drawn in has one east slot, each `b` cell one west slot, and an
  attested `a|b` edge is both. It mirrors `relatedGraphics`' denominator
  restricted to the layer asked about. "East edges out of `a`" was rejected
  as the denominator: it excludes self-pairs and room borders, so a floor
  almost always beside more floor gets a tiny denominator and an inflated
  score for its rare neighbours. Self-pairs are skipped (as undirected does):
  "more of the same" is the brush already armed.

**Host.** `neighbourTiles(rom, graphic)` → both layers, 8 candidates per side,
rows `[graphic, pct, uses, families(≤4, most-placed first), canopyUses,
terrainUses]`, on its own `requestNeighbours` / `neighbourTiles` messages. Its
seed is the **armed brush only**; `editPlacedGraphics()` still excludes the
brush (§8a.1's "order changes when I click a tile" stays fixed — its test is
untouched and green).

**Client.**
- Model: `map-editor-relations.js` owns `_nbAnswer` / `_nbKey` / `_nbView` /
  `_nbCycle` / `_nbFocus` (STATE_FLOW.md). The centre is read off the
  **brush's own words** (`nbCentre`), not `_brushTile` alone, since the
  eyedropper arms a brush without clearing `_brushTile`. A reply for a
  graphic other than `_nbKey` is dropped as stale.
- Card: new `map-editor-neighbours.js` (161 LOC); the flat list and
  `tileFamilyOf` left `map-editor-tiles.js` (319 → 285) and `_relatedTop` left
  relations. Cells are 34px with real art cropped from the family sheet at 2x
  (`background-size`, so the mirror can use `transform`); a graphic past the
  sheet's 128-tile cap shows its id, never a guess. No card without an armed
  family tile (the mock's `hasCurrentTile`).
- **Click semantics — one deliberate deviation.** The README says click
  cycles; taken literally, the first click would skip vanilla's best
  candidate and nothing would let you *use* the one you found. So: first
  click **focuses** a side, further clicks (and scroll, either way, wrapping)
  **cycle** it; the focused candidate is spelled out under the grid with a
  **use** button that arms it (via `editUseFamilyTile`, so family adoption,
  layer preference and mirror bits all follow the normal path). The card
  then re-centres on it — walking an object piece by piece. Wheel is
  accumulated (60px per step) so a trackpad does not spin the list; bound
  once in `bindEditControls`, `passive:false` so the dock does not scroll.
- **Centre** = `brushLayerToggle()` in `map-editor-tiles.js` (the owner of
  `_layerForce`): force the opposite of the brush's actual layer and re-arm,
  like the mock's `toggleDrawLayer`. This is a second production writer of
  `_layerForce` (§8a.3 said "exactly one"), kept in the owning file; the pill
  shows the result.
- **Unusable candidates are dimmed, not skipped.** A candidate is drawn from
  an adopted family it is attested in if any; else its most-placed family,
  which needs a free slot. At 7/7 it is shown at 30% opacity with its real
  score, and `use` is disabled with the reason. Skipping would put a weaker
  neighbour in the cell and claim it was vanilla's best.
- **H/V handled, not deferred.** H swaps e↔w and V swaps n↔s
  (`nbSourceSide`), and centre and candidates are drawn — and armed — with
  the same mirror. Vanilla's `[W][A]`, mirrored whole, is `[A'][W']`: still a
  pair vanilla attests. The cycle/focus reset when graphic, layer or mirror
  changes.
- **Empty sides** are a dashed empty cell with no badge; never filled from
  `_related`.

**Verified.** Unit (map-units, synthetic grids: only-east has empty west,
down pairs, four buckets sum to undirected, layers never meet, self skipped,
Jaccard ranking); real ROM (map-parity: counts, sum and mirror invariants,
the gourd's 2x2 at exactly 1.00); DOM (plus geometry by bounding boxes, empty
side, art crop, dimmed candidate, focus → cycle, wheel incl. a double bind and
trackpad accumulation, centre toggle switching layer data with no refetch, H
swap + mirrored art + mirrored `use`, stale reply dropped, collapse). At a
960px viewport / 400px dock with real ROM data and sheets, the dock stayed
at left 550 / right 950 / width 400 through focus, cycle, H and the centre
toggle, with zero horizontal overflow (§7b).

**Resolves** §8a.1's "the mock's plus-shaped N/E/S/W grid" item: it is now
what this codebase renders.

## 8a.1 Bugs found in real use, after v0.58.0

The user tried the shipped Tile tab and reported four things. Two were
confirmed and fixed here; two need more information before touching code —
guessing at either risked either a no-op patch or fabricating behavior the
real format doesn't have, the same trap §5.1/§8a already named.

**Fixed:**
- **"You can't load more tiles when your 7 family slots are full."**
  Confirmed: `tileGroupFamilies()`'s candidate slice was
  `Math.max(0, _tileGroupPage - fams.length)` — a shared budget the adopted
  count ate into. At a full seven-slot palette (the common case, and
  `TILE_GROUP_PAGE` is 6), that's always `Math.max(0, 6-7)=0` until "more
  families" is clicked enough times to push the page past 7. Fixed to
  `.slice(0, _tileGroupPage)` — the page is how many *candidates* to add,
  independent of how many slots are already spent.
  **Superseded by §8a.3.** This read the report backwards: the user wanted
  a full palette to show *fewer* families, not more. §8a.3 gates candidates
  on a free slot, which removes them entirely at 7/7.
- **"When clicking on a tile the order should not change."** Confirmed:
  `editPlacedGraphics()` seeded the relationship lookup with the just-armed
  `_brushTile`, and `relatedTiles()` deletes a seed graphic from its own
  results (it cannot recommend itself), so the tile you just clicked scored
  0 and sank to the bottom of its own family's grid — on every click, before
  anything was even painted. Fixed by seeding only from `d.cells` (actually
  placed content). Order now only moves when the map genuinely changes, not
  when browsing candidates; the neighbours card and per-family ranking still
  work once you've placed something.

**Needs more information, not fixed here:**
- **"Clicking H/V distorts the right sidebar."** Reproduced the click
  sequence in headless Playwright against the real bundle — armed a real
  brush from a seeded family sheet, clicked H then V, measured
  `#rg-outer`/`#rg-dock`/`.rg-edit-row` before and after. No width change in
  any of them (`#rg-dock` stayed exactly 400px throughout). Nothing in
  `map-editor-canvas.css`/`map-editor-tile-tab.css` sets width from content,
  and no JS in `src/rooms/webview/` sets `.style.width` outside the room
  canvas image and the new-room resize grip, neither of which the flip
  toggle touches. Could not confirm this happens from the code alone. Needs
  either a live repro (was a brush already armed? did the *whole* VS Code
  window narrow, or just this panel? does it recover on the next render?)
  or a screen recording.
- **The mock's plus-shaped N/E/S/W "Likely Neighbors" grid, shown expanded.**
  No code in this repository renders a directional plus-shape — `grep` for
  `grid-template-areas`/`rg-nb-n`/`rg-nb-s`/etc. across every webview file
  and stylesheet turns up nothing, and `neighbourCardHtml()` (added in this
  same v0.58.0) explicitly renders a flat `.rg-nb-grid` ranked list, by
  design (§8a, §8b — the index is undirected). The screenshot showing a
  cross-shaped grid with N/S/E/W-positioned color swatches around a centre
  tile matches the *design mock's own* rendering of that widget, not
  anything this codebase can currently produce. Left as-is pending
  confirmation of what was actually being looked at.

## 8a.3 Four more reports from real use, after v0.59.0 (v0.60.0)

(There is no §8a.2 section in this doc; v0.59.0's own changes are recorded in
code comments and `CHANGELOG.md`, which these entries cite by that name.)

**1. "H/V are still broken and move the side bar further to the right."**
*Root cause, measured:* nothing resized the dock. It stayed exactly 400px, and
**it moved.** `#rg-outer` (the canvas column) is a flex item of `.rg-edit-row`
with the default `min-width:auto`, and a flex item's automatic minimum is its
*min-content* width. That width included the status bar's `white-space:nowrap`
note. A flip re-arms the brush, which writes the longest note the editor has
("brush: graphic 4195 in family 58 mirrored H — stamp #2, as ground (how
vanilla draws it). Paint on the map."). The canvas column ratcheted about 150px
wider on every long note and pushed the dock that far past the panel's right
edge. At a 1100px viewport the dock's left edge went 690 → 776 (arm a brush)
→ 842 (click H), with its right end at 1242, so the rightmost 142px of the dock
was off-screen. **That is what clipped the `H | V` pill in the screenshot.** The
earlier repro missed it because it used a 1400px viewport, which had room for
the ratchet, and because it measured the dock's *width*, not its position.
*The segmented row is not the mechanism:* measured at the real width it is
392px inside a 396px tab body, and `scrollWidth === clientWidth` on both it and
`#rg-panels`, both before and after the click. That rules out the suspicion
recorded in the brief and in `webview-dom-safety` §7b.
*Fix:* `.rg-edit-row>.rg-outer{min-width:0}` (shared.css, next to the row's own
rules, and matching only in edit mode, so other tabs are untouched) and
`min-width:0` on the status bar's `.rg-edit-count` so its ellipsis actually
engages. There is no `overflow-x:hidden` anywhere: `.rg-canvas-zone` already
scrolls and the status bar already clips, so both degrade as intended once the
column is allowed to be narrow. At 820px the dock stays fully on screen and the
canvas zone scrolls sideways. *Test:* at a 960px viewport, clicking H must
leave the dock's left edge where it was, keep its right edge inside the
viewport, and leave `#rg-panels` and the segmented row with no horizontal
overflow. With the CSS line reverted the test fails (dock 628 → 968).

**2. "Don't use Strongheart's room as the default for a new map. New maps are
completely empty."** What "completely empty" can mean in this format:
- **The grid is empty.** `blankRoom` (maps/blank-room.ts) used to fill every
  cell with the donor's most-placed walkable floor, so a new map was a picture
  of Strong Heart's Hut. It now fills with `emptyStamp`: the donor's
  **most-placed canopy word on both layers, collision `0x0000`**. That is the
  same rule and evidence (`building-a-room-from-a-picture.md` §8: `$A800`, zero
  opaque pixels) that `editBlankCanopy` already uses client-side, so host and
  client agree on what "nothing" is. The format has no "no metatile" cell, and
  this stamp is the closest thing it has. A new map renders as the backdrop and
  is walkable everywhere.
- **The client no longer claims the cells hold donor content.**
  `applyBlankRoom` used to set `_mtPalette.grid` to zeroes, which meant "donor
  dictionary entry 0". That is not the stamp the host drew. So a front tile
  painted on a "blank" map composed over the donor's entry-0 terrain, and art
  the user never drew appeared underneath it. The grid is now `null` per cell,
  which reads back as -1 ("nothing here") everywhere: the brush lands as
  composed, erase has nothing to erase, and pick has nothing to pick. Nothing
  exports the grid; `editExport` emits only `_edit.cells`.
- **What could not be dropped, stated plainly:** a donor room is still
  required. A room with its own synthetic Block 1 renders black (rule 7.1), and
  `_mtPalette` (the dictionary, budget and tile sheet the whole editor runs on)
  comes from a real room. The donor is still 0x34, and `roomsNewMap` still
  navigates there first to get that palette. **Its seven families also stay
  loaded.** The blank word itself names one of them (`$A800` is palette field 2,
  chr 0, i.e. donor graphic slot 0 in slot-2 colours). Its emptiness is a fact
  about that donor's slot 0, not a universal constant. Clearing the families
  would leave the fill word naming an empty slot, and inventing a palette-0
  "universal blank" word would be exactly the fabrication
  `map-editor-rules` §4 forbids. So the donor now lends **vocabulary only**:
  graphics, families and display registers, and no picture. Any of the seven
  families can be dropped with its card's `×`.

**3. "Drawing a tile that is marked as FG should not draw it to the BG."**
Checked in the order the brief gave:
- *Family-sheet click → paint tool:* correct, as v0.59.0's test already said
  (`{layer1: art, layer2: kept terrain}`).
- *The rect tool, and `move`'s backfill: **broken.*** `editRectWrites`
  (map-editor-paint.js) wrote `d.brush` raw instead of going through
  `editResolve`. A front brush is `{art, blank}`, so a dragged rectangle laid
  the art down **and blanked the terrain under it**. It was the only tool that
  did not honour front vs ground for the same brush. Fixed by resolving per
  cell. `editApplyStroke` (gestures) now also requests the composed preview
  when a resolve invents a stamp, which the paint tool always did and rect
  never did. Paste deliberately stays raw, because it copies whole finished
  cells.
- *`editOnTilePicked` (the room's own raw graphics):* passed no `prefer`, so it
  ignored both `front` and vanilla's layer. It now uses the same precedence as
  `editUseFamilyTile` (`_layerForce || editLayerPreference(id)`). No host change
  was needed: `applyMetatilePalette` already fills `_famLayerHint` for the
  room's own graphics from the host's `vanilla[]` rows. Note that this path is
  currently unreachable in edit mode, because `#rs-mt` is `display:none` while
  editing. The fix is correct but was not the user's bug.
- *Badge vs brush:* they cannot disagree. Both read `_layerForce` first, then
  the same ≥60% hint. `_layerForce` has exactly one production writer
  (map-editor-input.js). The leak remains a test hazard (`webview-dom-safety`
  §7c), not a product one.
- *Rendering:* `editStampSvg` crops the host-composed stamp, so a correctly
  stored stamp renders correctly. It was not a rendering symptom.
- *New map, as a fourth path:* item 2's zero-filled grid was a real way for a
  front tile to pick up terrain it should not have.
*Tests:* rect of a front tile keeps the terrain exactly as painting does; a raw
pick with `front` forced lands in the canopy, and so does one vanilla draws in
front on `auto`; painting a front tile on a drafted room leaves no donor
terrain under it.

**4. "If the tile family list is full (7/7) we don't show tiles from families
outside that list!!!!"** This reverses §8a.1's first fix, which had misread an
earlier report. The rule now: `tileGroupFamilies()` returns only the adopted
families unless `editFreeFamilySlot()` finds a free slot. The new function in
map-editor-families.js is also what `editAdoptFamilyFor` uses, so "can I adopt"
and "should I show candidates" are one answer. The "N more families" pager is
gated the same way, since at 7/7 it would page through nothing. Free a slot and
both come back. §8a.1's two tests ("a full seven-slot palette still shows extra
candidates…", "'more families' grows the count from a full palette") were
rewritten to assert this rule, plus the free-slot case.

**Noticed, not changed:** the collapsed family strip's empty-slot `+` button
carries `data-fam-add`, which is not in `EDIT_CLICK_KEYS` and has no handler.
It is a dead control, left over from §8a.2 removing the explicit add-a-family
browser. It should either go or become a filter-to-candidates action, but that
is a product call, not a bug fix.

## 9. Ritual reminder

One prompt = one commit. This plan spans multiple prompts/sessions by design
— do not attempt phases 0–6 in a single sitting. Each phase ends with its own
version bump, validation run, and commit per `release-ritual`.
