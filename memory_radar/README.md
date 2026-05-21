# Memory Radar

Companion window for exploring WRAM memory layout, room maps, scaling mechanics, and game algorithms. All ROM-backed models (damage, alchemy, map decoding, RNG) live here.

## Structure

- `radar-utils.js` — Pure helper functions for memory-region classification, HTML escaping, enum parsing
- `webview/` — VS Code webview panel implementation with tabs:
  - `index.js` — Main entry point that loads and assembles webview HTML/JS/CSS
  - `assets/` — Precompiled webview code (shared.js, shared.css, tab scripts)
- `models/` — ROM/game algorithm models (strictly ROM-anchored, trace-validated):
  - `alchemy-model.js` — Alchemy damage range and power calculations
  - `map-blob-evidence-model.js` — Map data decoding and trigger analysis
  - `render-script-model.js` — Render opcode tracing and command analysis
- `tests/` — Unit and integration tests for all models and webview behavior

## Testing

Run all radar+model tests:
```bash
npm test
```

Individual test files:
```bash
node memory_radar/tests/radar.test.js
node memory_radar/tests/damage.test.js
node memory_radar/tests/map-blob-evidence-model.test.js
node memory_radar/tests/render-script-model.test.js
node memory_radar/tests/smoke.test.js      # Webview JS execution
node memory_radar/tests/ui.test.js         # Scaling/Docs tab UI
node memory_radar/tests/scaling-rom.test.js # ROM character parsing
```

## Models

Only algorithms with trace or ROM evidence are here. Each model exports helper functions used by the webview and tested against real game data.
