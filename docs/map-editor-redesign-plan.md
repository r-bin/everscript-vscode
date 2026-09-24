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

## 7. Ritual reminder

One prompt = one commit. This plan spans multiple prompts/sessions by design
— do not attempt phases 0–6 in a single sitting. Each phase ends with its own
version bump, validation run, and commit per `release-ritual`.
