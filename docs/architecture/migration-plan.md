# Migration Plan — Everscript VS Code Extension

> Phased roadmap from the current monolithic `memory_radar/` structure
> to the bounded-context architecture defined in `target-architecture.md`.
>
> Each phase must compile, pass tests, and be independently reviewable.
> No phase combines unrelated migrations.

Status: Phase 0 partially complete. Phases 1–6 are future work.

---

## Guiding Constraints

- Every phase leaves the extension in a fully working state.
- File moves happen in isolation — no logic changes in the same commit.
- Every phase ends with a version bump and full test pass.
- Do not combine a file move with a refactor in the same commit.

---

## Phase 0 — Structural Foundations (Partially Complete)

**Objective:** Establish the architectural scaffolding that subsequent phases use.

**Status:** Mostly done as of v0.5.x. Listed here for completeness.

### Completed items

- [x] `AI_ARCHITECTURE_GUIDE.md` created — laws and principles documented
- [x] `STATE_FLOW.md` created — authoritative state flow map
- [x] `extension.js` reduced from 878 → ~454 LOC (ongoing)
- [x] `code_highlighter/language-providers.js` decomposed into 6 focused modules
- [x] `memory_radar/webview/assets/scaling-tab.js` decomposed into `scaling/` (8 files)
- [x] `debugger/emulator/panel.js` decomposed into panel.js + panel-webview.js
- [x] Rooms tab decomposed into `memory_radar/tabs/map_browser/` + `webview/assets/rooms/`
- [x] Per-subsystem `README.md` files created (debugger, memory_radar, rooms, language)

### Remaining Phase 0 items

- [ ] Create `docs/architecture/` documents (this plan, domain-overview, dependency-rules)
- [ ] Add `.depcruise.js` to repository root with informational rules
- [ ] Create empty `docs/architecture/domain-overview.md` skeleton
- [ ] Verify `npm run check:circular` passes with zero cycles
- [ ] Verify `npm run check:dead` reports no unused files

**Success criteria:** All existing tests pass. No circular dependencies. Architecture docs committed.

---

## Phase 1 — Extract `shared/` Domain

**Objective:** Create a single canonical location for cross-domain pure utilities.

**Why first:** Every other phase depends on a stable shared foundation.
Establishing `shared/` before moving domains prevents later churn.

### Steps

1. Create `shared/` directory with `README.md`.
2. Move `settings-model.js` → `shared/config.js`.
   Update all imports (extension.js, debugger/tests/settings-model.test.js).
3. Move `memory_radar/radar-utils.js` → `shared/radar-utils.js`.
   Update all imports (extension.js, code_highlighter/hover-provider.js, memory_radar/ tests).
4. Move `memory_radar/rom-readers.js` → `shared/rom-readers.js`.
   Update all imports.
5. Move `memory_radar/webview/assets/shared.css` → `shared/webview/shared.css`.
6. Move `memory_radar/webview/assets/shared.js` → `shared/webview/shared.js`.
7. Add `shared/README.md` with ownership contract.

**Verification:** `npm test`, `npm run check:circular`, `npm run check:dead`.

**Risk:** Low — these are pure files with no side effects. Import path updates only.

**Version bump:** Minor (structural — new domain created).

---

## Phase 2 — Extract `language/` Domain

**Objective:** Rename `code_highlighter/` to `language/` and update all references.

**Why:** The current name `code_highlighter` undersells the domain and causes confusion.
`language/` is the standard VS Code extension term for this surface.

### Steps

1. Create `language/` directory with `README.md` copied/adapted from `code_highlighter/README.md`.
2. Move all files from `code_highlighter/` to `language/`.
   - `language-providers.js` → `language/providers.js` (facade)
   - `hover-provider.js` → `language/providers/hover.js`
   - `completion-provider.js` → `language/providers/completion.js`
   - `definition-provider.js` → `language/providers/definition.js`
   - `symbol-provider.js` → `language/providers/symbol.js`
   - `dead-branch.js` → `language/providers/dead-branch.js`
   - `workspace-index.js` → `language/workspace-index.js`
   - `syntaxes/` → `language/grammar/`
   - `tests/` → `language/tests/`
   - `themes/` → `language/themes/`
   - `snippets/` → `language/snippets/`
   - `language-configuration.json` → `language/language-configuration.json`
   - `data/` → `language/data/`
3. Update `package.json` manifest paths (grammar, theme, snippets, language configuration).
4. Update `extension.js` require path.
5. Update `knip.json` project paths.
6. Update `tsconfig.json` if applicable.
7. Remove `code_highlighter/` directory.

**Verification:** Grammar tests pass (`vscode-tmgrammar-test`). Extension activates. Hover works.

**Risk:** Medium — manifest paths must be updated carefully. Test with a reload.

**Version bump:** Minor.

---

## Phase 3 — Extract `memory/` Domain (WRAM Grid)

**Objective:** Separate the memory-grid tab from the rest of `memory_radar/`.

**Why:** `memory_radar/` is a catch-all. The WRAM grid, rooms browser, scaling calculator,
and route planner are four independent features that happen to share a webview panel.
Separating the WRAM grid into `memory/` isolates the core radar feature.

### Steps

1. Create `memory/` directory with `README.md`.
2. Move `memory_radar/render-memory-tab.js` → `memory/render-memory-tab.js`.
3. Move `memory_radar/tests/radar.test.js` → `memory/tests/radar.test.js`.
4. Move `memory_radar/tests/activation.test.js` → `memory/tests/activation.test.js`.
5. Move `memory_radar/tests/ui.test.js` → `memory/tests/ui.test.js`.
6. Update imports in `memory_radar/render-radar.js` and `extension.js`.
7. Keep `memory_radar/` as the panel orchestrator (render-radar.js, webview/index.js) — it assembles tabs.

**Note:** `memory_radar/` is not eliminated in this phase. It becomes a thin panel
assembler that delegates to tab-specific domains.

**Verification:** Radar panel opens. Memory grid renders. All tests pass.

**Risk:** Low — moving files with small import updates.

**Version bump:** Patch.

---

## Phase 4 — Extract `maps/` Domain

**Objective:** Give the ROM map analysis models their own domain.

**Why:** `memory_radar/models/` contains heavy ROM analysis code (map-blob-evidence-model,
map-pipeline-model) that is unrelated to the radar grid UI. These models are research
artifacts that should be independently loadable without touching UI code.

### Steps

1. Create `maps/` directory with `README.md`.
2. Move `memory_radar/models/map-blob-evidence-model.js` → `maps/models/map-blob-evidence-model.js`.
3. Move `memory_radar/models/map-pipeline-model.js` → `maps/models/map-pipeline-model.js`.
4. Move `memory_radar/models/render-script-model.js` → `maps/models/render-script-model.js`.
5. Move `memory_radar/models/alchemy-model.js` → `maps/models/alchemy-model.js` (or `rng/`).
6. Create `maps/index.js` exporting public API.
7. Update all imports in `memory_radar/tests/` and `extension.js`.
8. Move corresponding tests from `memory_radar/tests/` → `maps/tests/`.

**Verification:** All model tests pass. Radar panel still renders.

**Risk:** Low — pure model files, no VS Code deps.

**Version bump:** Minor.

---

## Phase 5 — Extract `rooms/` Domain

**Objective:** Promote the rooms tab to a first-class top-level domain.

**Why:** The rooms tab (`memory_radar/tabs/map_browser/`) is already well-decomposed.
It just needs to be at the top level so it loads independently of the full radar.

### Steps

1. Create `rooms/` at the top level (the domain has already been partially structured
   inside `memory_radar/tabs/map_browser/` — this phase promotes it).
2. Move `memory_radar/tabs/map_browser/parsing/` → `rooms/parsing/`.
3. Move `memory_radar/tabs/map_browser/rendering/` → `rooms/rendering/`.
4. Move `memory_radar/tabs/map_browser/data/` → `rooms/data/`.
5. Move `memory_radar/tabs/map_browser/index.js` → `rooms/index.js`.
6. Move `memory_radar/webview/assets/rooms/` → `rooms/webview/`.
7. Move room-related tests → `rooms/tests/`.
8. Update `memory_radar/room-tree.js` and `memory_radar/room-data.js` shims to
   point to the new `rooms/` location.
9. Update `memory_radar/render-radar.js` imports.
10. Evaluate and delete `memory_radar/room-data.js.bak` and `room-tree.js.bak`.

**Verification:** Rooms tab renders. Room tree builds. Line-link navigation works.

**Risk:** Medium — rooms tab has many cross-file dependencies within the domain.
Move entire subtree together.

**Version bump:** Minor.

---

## Phase 6 — Extract `scaling/` and `rng/` Domains

**Objective:** Separate the scaling calculator and docs/RNG tabs.

### Steps — scaling

1. Create `scaling/` top-level directory.
2. `memory_radar/webview/assets/scaling/` is already well-decomposed — move it to `scaling/webview/`.
3. Move server-side scaling render logic from `memory_radar/render-docs-tab.js` → `scaling/render.js`.
4. Move scaling tests → `scaling/tests/`.
5. Update `memory_radar/render-radar.js` imports.

### Steps — rng

1. Create `rng/` top-level directory.
2. Extract RNG/alchemy rendering from `memory_radar/render-docs-tab.js` → `rng/render.js`.
3. Move `memory_radar/models/alchemy-model.js` here (if not moved in Phase 4).
4. Create `rng/README.md`.

**Verification:** Scaling tab works. Docs/RNG tab works.

**Risk:** Low for scaling (already decomposed). Medium for RNG (extract from shared file).

**Version bump:** Minor.

---

## Phase 7 — Extract `emulator/` Domain

**Objective:** Give the emulator panel its own top-level domain, separate from `debugger/`.

**Why:** The debugger (DAP protocol) and the emulator (SNES webview panel) are different
concerns that happen to live in the same directory. Separating them means emulator work
never loads DAP code and vice versa.

### Steps

1. Create `emulator/` top-level directory with `README.md`.
2. Move `debugger/emulator/panel.js` → `emulator/panel.js`.
3. Move `debugger/emulator/panel-webview.js` → `emulator/panel-webview.js`.
4. Move `debugger/emulator/room-script-model.js` → `emulator/room-script-model.js`.
5. Move `debugger/emulator/snes-rom-header-model.js` → `emulator/snes-rom-header-model.js`.
6. Move `debugger/emulator/opcode-registry.js` → `emulator/opcode-registry.js`.
7. Move `debugger/emulator/webview/` → `emulator/webview/`.
8. Move `debugger/core/` → `emulator/core/`.
9. Update all imports in `debugger/adapter.js`, `debugger/mock-runtime.js`, `extension.js`.
10. Update `package.json` debugger core paths.
11. Move emulator tests → `emulator/tests/`.

**Verification:** Emulator launches. ROM loads. Debugger breakpoints work. All tests pass.

**Risk:** High — this touches debugger, emulator, and extension.js together.
Do in a single coordinated commit. Run full test suite including emulator-health.

**Version bump:** Minor.

---

## Phase 8 — Reduce `memory_radar/` to Panel Assembler

**Objective:** After Phases 3–6, `memory_radar/` should contain only the panel
orchestration layer. Everything else has moved out.

**Expected remaining files after all phases complete:**

```
memory_radar/
  render-radar.js      — Assembles tab HTML from domain renderers
  webview/
    index.js           — Concatenates tab JS for webview bundle
  README.md            — Updated to reflect "panel assembler" role
```

**Steps:**

1. Verify that `room-data.js`, `room-tree.js` shims can be deleted.
2. Delete empty tab directories: `tabs/memory/`, `tabs/route/`, `tabs/scaling/`, `tabs/dosc/`.
3. Update `README.md` to reflect new minimal role.
4. Run `npm run check:dead` and remove any newly orphaned files.

**Version bump:** Patch (cleanup only).

---

## Phase 9 — Strict Dependency Enforcement

**Objective:** Enable error-level rules in dependency-cruiser for all completed domain boundaries.

**When:** After Phase 8 completes and all domains are stable.

### Steps

1. Update `.depcruise.js` — change completed domain rules from `warn` to `error`.
2. Add `npm run check:deps` to the CI/test script.
3. Add `check:deps` to the anti-entropy checklist in `AI_ARCHITECTURE_GUIDE.md`.
4. Document any intentional exceptions with `comment` fields in the config.

**Verification:** `npm run check:deps` exits 0 with zero violations.

**Version bump:** Minor (tooling feature).

---

## Parallel Track — `script_parser/` (Isolated, No Migration Needed)

`script_parser/` is already an isolated domain with its own `package.json`.
No migration is required. Maintain isolation by never adding imports from the
main extension tree into `script_parser/`.

---

## Summary Table

| Phase | Domain | Risk | Notes |
|---|---|---|---|
| 0 | Foundations | Done | Architecture docs, tooling |
| 1 | `shared/` | Low | Pure files, import updates only |
| 2 | `language/` | Medium | Manifest path updates required |
| 3 | `memory/` | Low | WRAM grid tab isolation |
| 4 | `maps/` | Low | ROM models only |
| 5 | `rooms/` | Medium | Large subtree move |
| 6 | `scaling/`, `rng/` | Low–Medium | Scaling already decomposed |
| 7 | `emulator/` | High | Cross-cutting with debugger |
| 8 | `memory_radar/` cleanup | Low | Delete dead shims |
| 9 | Strict enforcement | Low | Tooling only |
