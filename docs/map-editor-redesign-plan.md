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
| 4 | Trigger tab upgrade | `map-editor-gestures.js` (select/move/copy/paste), panels/list UI | `selectedTriggerRef`, `moveDrag`, `_triggerClipboard` (instance field, not state) | Click-select, drag-move, Backspace/Delete, Cmd/Ctrl+C/V, drag-reorder, capacity bars (x/16) | `everscript-plugin-builder` + `webview-dom-safety` (input-focus guard on shortcuts) |
| 5 | Widgets tab | **audit `map-editor-deco.js` + `deco-catalogue.js`/`deco-preview.js` first** — likely a reskin, not new work; then Widget Editor Mode (rail swap, canvas banner, back-to-map) | possibly none (if reskin) | Existing deco/widget stamping reachable through the new tab; Widget Editor Mode round-trip works | `everscript-plugin-builder` |
| 6 | Polish | outside-click dropdown close, zoom chip/resize grip restyle, `rooms/README.md` client-side list + `STATE_FLOW.md` updated with every new state owner, full anti-entropy checklist | — | All 7 mock screens visually/behaviorally matched; `npm run typecheck && check:circular && check:dead && test` green | direct edit or `architecture-compressor` if cleanup needed |

## 5. Open questions to resolve during Phase 3/5

- Special-tab "Entrance" placement helpers vs. the room's already-parsed
  `entrances` data (`content-parser.js`) — reuse one model, don't duplicate.
- Whether "widgets" fully subsumes "deco" naming/UX, or the mock's Widgets tab
  is deco plus a few new affordances (ready-only toggle, warnings) layered on.

## 6. Ritual reminder

One prompt = one commit. This plan spans multiple prompts/sessions by design
— do not attempt phases 0–6 in a single sitting. Each phase ends with its own
version bump, validation run, and commit per `release-ritual`.
