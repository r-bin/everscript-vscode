---
name: feature-validation
description: Standards for verifying features: maps must render in our core map editor matching in-game appearance, tabs require visual inspection with shared CSS, and ROMs require working replays.
applyTo: "src/games/**,src/core/**"
---

# Feature Validation & Definition of "Working"

Never declare a feature, map, tab, or ROM "working" based on unit tests alone or lack of crashes.
All claims of functionality must meet the empirical validation bar.

---

## 1. Maps: The Core Map Editor Standard

A map is **ONLY** considered working if:
1. **It is embedded in our core map editor** (`src/core/map-editor/`). It does not show an ad-hoc,
   isolated canvas; it must use our tested map editor shell and core.
2. **It renders identical to the game / internet map dumps.** If a map renders blank, black, or
   glitched, it is **NOT WORKING**, regardless of whether the decoder returns JSON without throwing.
   Compare with the running game: `tools/mana/check-map.js`, `tools/terra/check-room.mts` (screen vs render), `tools/terra/check-exit.mts`, `check-walk.mts`, `check-chest.mts`, `check-change.mts` (exits, collision, chests, map changes in the game vs the tables).

### Multi-game map feature alignment:
- New game maps must be compared against existing core editor capabilities.
- If a game has objects (e.g. Mana objects/spawns), connect them to the existing object system
  built for Evermore.
- If a game has features that do not exist in Evermore, propose and extend `src/core/map-editor/`
  after discussion—do not fork a second incompatible map editor.

---

## 2. Webviews & Tabs: Visual Look & Feel

A feature tab is **ONLY** considered working if:
1. **Visual inspection passes:** Launch headless Chromium (`npm run test:dom` or Playwright) and
   verify that the tab renders what a user expects. No broken layouts, no unstyled elements.
2. **Global look & feel with shared CSS:** All tabs must look cohesive.
   - Use shared styles from `src/core/webview/` (CSS variables, buttons, tab strips, canvas cards).
   - Tabs in feature A must look like tabs in feature B unless an explicit domain exception exists.

---

## 3. ROMs & Emulation: The Replay Standard

A ROM or emulator feature is **ONLY** considered working if:
1. **A verified replay runs:** Simply reading the header or surviving frame 0 is not enough.
2. **Pick sensible replays:** Boot to title, room transition, or dialogue trigger.
3. **Inspect live state:** Verify that WRAM addresses update to expected values during execution.

---

## 4. Documentation is Part of Done

- Every newly touched WRAM address without documentation must receive a knowledge entry
  (`src/games/evermore/localizations/knowledge/ram/<addr>.md`).
- Every investigated ASM or EVS function must have its purpose and evidence documented.
