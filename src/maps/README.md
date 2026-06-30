# maps/ — ROM Map Models

Pure data models for ROM map analysis. No VS Code API. No rendering.

## Files

| File | Description |
|---|---|
| `map-pipeline-model.js` | Pipeline model: trace segments, opcode sequences, layer data |
| `map-blob-evidence-model.js` | Blob evidence model: compressed tile data analysis |
| `render-script-model.js` | Script trace decoder: opcode 0x93 rendering commands |
| `alchemy-model.js` | Alchemy damage tables, character stats, RNG state |

## Dependency Rules

- No VS Code API
- No imports from other `src/` domains
- No webview rendering
- All models are testable in plain Node.js (see `tests/memory/`)
