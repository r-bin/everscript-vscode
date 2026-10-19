# Port the remaining JavaScript to TypeScript

Language rule (AGENTS.md §0.8): wasm > ts (strict, the default) > js. Every JS file that is left carries
`// TODO port to TS (docs/todo/port-to-ts.md)` as its first line (after a `#!` line), so
`grep -rl "TODO port to TS" src tools tests scripts` is the live list. Remove the line when you port the file.
History and counts: [../cleanup.md](../cleanup.md) 5.5 (host modules), 5.3 (page scripts), 5.1 (page-side copies).

| Group | Files | Blocked by |
|---|---|---|
| Host modules (`src/**`, not `webview/`) | 9 | nothing now: the composition roots (`src/extension.js`, the three `extension.js`), the radar (`radar-open`, `radar-panel`, `render-radar`), `music/index`, `music/model/track-timeline` and `resources/index` can all be ported; start with the leaves |
| Page scripts (`src/**/webview/`) | 173 | 5.3: they are spliced into the page as text (`page-file`), not built; they need one esbuild bundle per page from real `.ts` with DOM typings, then the knip webview ignore goes |
| `tools/`, `scripts/` | 42 | host modules they `require` from `dist/` |
| `tests/` | 77 | last: they require the ports from `dist/` already |

## How a module is ported

1. Pick modules whose requires are all TS/JSON/built-ins (the leaves first), `git mv x.js x.ts`, turn
   `require`/`module.exports` into `import`/`export`, type it by hand (no `any` escape hatches; local
   interfaces for loose data; `err instanceof Error ? err.message : err`).
2. JS users (other modules, tests, tools) now require it from `dist/…` (`npm run build:ts`); tests that read the
   file as text point at the `.ts`.
3. `npx tsc -p tsconfig.build.json --noEmit`, `npm test`, then the release ritual. Porting has found real bugs
   (v0.307.0: five); read each function while typing it.
4. Page scripts: port together with 5.3, not one by one.

## The list (regenerate with `git ls-files | grep js$ | xargs grep -l "TODO port to TS"`)

### Host modules
- `src/`: `extension.js`
- `src/games/evermore/`: `extension.js`, `radar-open.js`, `radar-panel.js`
- `src/games/evermore/memory/`: `render-radar.js`
- `src/games/evermore/music/`: `index.js`
- `src/games/evermore/music/model/`: `track-timeline.js`
- `src/games/evermore/resources/`: `index.js`
- `src/games/mana/`: `extension.js`

### Page scripts
Page code the host also uses is a TypeScript module that `tools/bundle-pages.mts` bundles into `dist/webview/<name>.js` (`shell-frame`, `music-view`, `music-engine`, `evermore-rom`); the page loads the bundle (`core/webview/page-bundle.ts`), the host imports the module. That is the pattern for the rest (5.3).

- `src/core/emulator/webview/`: `apu-stream.js`, `cdl-float.js`, `cdl-strips.js`, `cdl.js`, `emulator-panels.js`, `emulator-profile.js`, `fps.js`, `memory-bridge.js`, `menu-sound.js`, `replays-list.js`
- `src/core/emulator/webview/menu/`: `01-default-key-map.js`, `02-change-menu-value.js`, `03-last-gamepad-buttons.js`
- `src/core/emulator/webview/page/`: `01-last-sampled-pre-state.js`, `02-activate-overlay-focused.js`, `03-set-speed-up.js`, `03b-render-loop.js`, `04-last-layout.js`
- `src/core/emulator/webview/tas/`: `01-tas-buttons.js`, `02-tas-apply-input.js`
- `src/core/map-editor/core/`: `edit-history.js`, `edit-session.js`, `edit-tools.js`
- `src/core/map-editor/shell/`: `frame-dock.js`, `layout.js`, `pan.js`, `rail.js`, `status.js`, `zoom-pan.js`
- `src/core/map-editor/view/`: `tile-animation.js`, `view-chips.js`
- `src/core/roms/webview/`: `rom-panel.js`
- `src/games/evermore/docs-tab/`: `docs-tab.js`, `rng-tab.js`
- `src/games/evermore/emulator/webview/`: `overlay-toggles.js`, `rom-game.js`, `script-debug.js`, `sound-source.js`, `trace.js`
- `src/games/evermore/emulator/webview/bottom-bar/`: `01-alchemy-spell-map.js`, `01b-cheats.js`, `02-update-alchemy-tab.js`
- `src/games/evermore/emulator/webview/menu-tabs/`: `01-menu-local-obj-states.js`, `02-update-object-row-display.js`, `03-toggle-loot-state.js`
- `src/games/evermore/emulator/webview/overlays/`: `01-extend-map-enabled.js`, `02-render-objects-overlay.js`, `03-render-inspect-selection.js`, `04-handle-map-inspect-click.js`, `05-idle-sprites.js`, `06-inidisp-shadow.js`, `07-game-camera-world.js`
- `src/games/evermore/emulator/webview/stack/`: `01-script-base.js`, `02-read-script-stack-region.js`
- `src/games/evermore/memory/webview/`: `shared.js`
- `src/games/evermore/music/engine/`: `spc-engine.js`
- `src/games/evermore/music/webview/`: `music-audio.js`, `music-forecast.js`, `music-hover.js`, `music-init.js`, `music-lists.js`, `music-tab.js`, `music-timeline.js`
- `src/games/evermore/rom/webview/`: `rom-bus-map.js`, `rom-bus-view.js`, `rom-compare.js`, `rom-init.js`, `rom-tab.js`
- `src/games/evermore/rooms/webview/`: `animation.js`, `bootstrap.js`, `detail-renderer.js`, `interactions.js`, `map-editor-actions.js`, `map-editor-anim-map.js`, `map-editor-anim-placed.js`, `map-editor-anim-sets.js`, `map-editor-anim-tab.js`, `map-editor-anim.js`, `map-editor-animations.js`, `map-editor-chips.js`, `map-editor-clipboard.js`, `map-editor-collision-tab.js`, `map-editor-collision.js`, `map-editor-constructs.js`, `map-editor-custom-store.js`, `map-editor-custom.js`, `map-editor-cutlayer.js`, `map-editor-deco.js`, `map-editor-drawable.js`, `map-editor-families.js`, `map-editor-family-sets.js`, `map-editor-filterbar.js`, `map-editor-flag-overlays.js`, `map-editor-gestures.js`, `map-editor-groups.js`, `map-editor-history.js`, `map-editor-info.js`, `map-editor-input.js`, `map-editor-levels.js`, `map-editor-neighbours.js`, `map-editor-newroom.js`, `map-editor-object-holds.js`, `map-editor-object-list.js`, `map-editor-objects.js`, `map-editor-paint.js`, `map-editor-panels.js`, `map-editor-phases.js`, `map-editor-pick.js`, `map-editor-placed-list.js`, `map-editor-preview.js`, `map-editor-relations.js`, `map-editor-rom-export.js`, `map-editor-romroom.js`, `map-editor-special-select.js`, `map-editor-special.js`, `map-editor-stamps.js`, `map-editor-start.js`, `map-editor-stranded.js`, `map-editor-tabs.js`, `map-editor-tile-filters.js`, `map-editor-tile-lazy.js`, `map-editor-tiles.js`, `map-editor-toolbar.js`, `map-editor-trigger-order.js`, `map-editor-trigger-panel.js`, `map-editor-trigger-scripts.js`, `map-editor-trigger-select.js`, `map-editor-ui.js`, `map-editor-widget-colours.js`, `map-editor-widget-edit.js`, `map-editor-widgets.js`, `map-editor.js`, `metatile-palette.js`, `rom-overlay.js`, `rooms-imported.js`, `rooms-rail.js`, `svg-builder.js`, `svg-spawns.js`, `tab-init.js`, `utils.js`
- `src/games/evermore/scaling/webview/`: `alchemy-math.js`, `chart.js`, `damage-math.js`, `events.js`, `helpers.js`, `redraw.js`, `state.js`, `tab-init.js`
- `src/games/evermore/scripts-tab/webview/`: `scripts-anim.js`, `scripts-init.js`, `scripts-music.js`, `scripts-room.js`, `scripts-tab.js`
- `src/games/evermore/sprites/webview/`: `sprites-lazy.js`, `sprites-motion.js`, `sprites-script.js`
- `src/games/evermore/sprites/webview/sprites-view/`: `01-state.js`, `02-pickers.js`, `03-playback.js`, `04-palettes.js`, `05-raw-sprites.js`
- `src/games/mana/maps/webview/`: `editor-dock-cells.js`, `editor-dock.js`, `editor-model.js`, `editor-overlays.js`, `editor-props.js`, `editor-stage.js`, `editor-tools.js`, `editor.js`, `main.js`, `map-svg.js`
- `src/games/terra/maps/webview/`: `page.js`
- `src/platform/cdl/asar-kit/`: `build-cdl.js`

### tools/ and scripts/
- `scripts/`: `auto-decompile.js`
- `tools/`: `derived-marker.js`, `gen-cdl-optable.js`, `gen-sound-animations.js`, `measure-collision.js`, `rom.js`, `roms.js`
- `tools/cdl/`: `replay-states.js`, `replay.js`
- `tools/exhirom/`: `convert.js`, `mesen.js`, `prove.js`, `run.js`
- `tools/mana/`: `check-events.js`, `check-map.js`, `find-picture.js`
- `tools/playbacks/`: `record-attract.js`
- `tools/recomp/`: `bisect.js`, `build.js`, `check-obj-tiles.js`, `host.js`, `lockstep.js`, `names.js`, `report.js`, `room-nav.js`, `s9x-run.js`, `verify-intro.js`
- `tools/recorder/`: `build.js`, `package-files.js`
- `tools/rooms/`: `region-evidence.js`, `write-room-names.js`
- `tools/script-vm/`: `record-goldens.js`
- `tools/simulation/`: `exit-cutoff.js`, `sweep-rooms.js`, `trace-scripts.js`
- `tools/table-hack/`: `build.js`, `hooks.js`, `prove.js`, `run.js`, `tables.js`
- `tools/variants/`: `analyze-variant.js`, `variant-scans.js`

### tests/
- `tests/debugger/`: `cdl-bus.test.js`, `cdl-recomp.test.js`, `cdl-values.test.js`, `cdl.test.js`, `debugger.test.js`, `emulator-bottom-bar.test.js`, `emulator-crash-logging.test.js`, `emulator-health.test.js`, `emulator-map-overlays.test.js`, `emulator-menu.test.js`, `emulator-runtime.test.js`, `everscript-inject.test.js`, `exhirom.test.js`, `recorder.test.js`, `rom-history.test.js`, `rom-library.test.js`, `script-debug-hook.test.js`, `script-trace.test.js`, `settings-model.test.js`, `snes-rom-header-model.test.js`, `tas-events.test.js`, `tas-states.test.js`, `tas-verify.test.js`, `tas.test.js`, `trigger-overlay.test.js`
- `tests/localizations/`: `localizations.test.js`
- `tests/mana/`: `mana-cpu.test.js`, `mana-editor-cells-dom.test.js`, `mana-editor-core.test.js`, `mana-editor-dom.test.js`, `mana-editor-props.test.js`, `mana-evermore.test.js`, `mana-map-editor-dom.test.js`, `mana-panel-dom.test.js`, `mana-rom.test.js`, `mana-rooms-dom.test.js`, `mana-units.test.js`, `panel-page.js`, `synthetic-map.js`
- `tests/memory/`: `activation.test.js`, `bundle.test.js`, `collision-suggest.test.js`, `custom-maps.test.js`, `damage.test.js`, `map-editor-dom.test.js`, `map-editor.test.js`, `map-parity.test.js`, `map-units.test.js`, `mcp-server.test.js`, `music-tab.test.js`, `package-files.test.js`, `radar-hosts.test.js`, `radar.test.js`, `rebuild-invalidation.test.js`, `render-script-model.test.js`, `rom-export.test.js`, `rom-tab.test.js`, `rooms-layout.test.js`, `rooms-rail-dom.test.js`, `scaling-rom.test.js`, `scripts-tab.test.js`, `smoke.test.js`, `soe-resources.test.js`, `soe-tags.test.js`, `sprites.test.js`, `ui.test.js`, `variants.test.js`
- `tests/script-model/`: `rom.test.js`
- `tests/script-vm/`: `rom.test.js`, `units.test.js`
- `tests/simulation/`: `everscript.test.js`, `loot.test.js`, `room.test.js`, `scheduler.test.js`, `sim-units.test.js`
- `tests/terra/`: `terra-maps-page.test.js`, `terra-rom.test.js`
