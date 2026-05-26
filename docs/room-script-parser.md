# Room Script Parser Dossier

## Status
- Implemented in the Rooms tab.
- Backed by focused synthetic-ROM tests.
- Partial opcode semantics only; unsupported opcodes stop decoding explicitly instead of inventing behavior.

## Scope Handled
- Study the room-script language entry points used by SoETilesViewer's SoEScriptDumper.
- Parse room-linked script sources from ROM for one enter script, `0..n` step-on scripts, and `0..n` B-trigger scripts.
- Show the decoded data in the Rooms tab as instruction tables with addresses, opcode ids, sizes, raw bytes, and summaries.

## Data Sources
- Vanilla ROM in workspace root: `Secret of Evermore (U) [!].smc` or `Secret of Evermore.smc`.
- Active EVS room context and `MAP` enum resolution in [extension.js](/Users/v/Documents/GitHub/everscript-vscode/extension.js).
- External research reference only: `SoETilesViewer/SoEScriptDumper/list-rooms.cpp` and `data.h`.

## Model Availability
- Validated model available for room trigger table structure and script pointer resolution.
- Validated model available for a small instruction subset currently used in transition-oriented room scripts: `0x00`, `0x04`, `0x08`, `0x09`, `0x0c`, `0x18`, `0x1b`, `0x20`, `0x22`, `0x29`, `0x33`, `0x86`, `0xa3`, `0xa7`.
- No validated full mechanics model is required here; this feature is data parsing and presentation only.

## Evidence
- `MAP_LIST_ADDR_US = 0x9ffde7` and `SCRIPTS_START_ADDR_US = 0x928000` from SoEScriptDumper `data.h`.
- Enter script pointer formula: `0x92801b + mapId * 5` from SoEScriptDumper `list-rooms.cpp`.
- Local trigger script pointer base: `0x928000 + read16(0x928000)` from SoEScriptDumper `list-rooms.cpp`.
- Step-on and B-trigger record size: 6 bytes from existing room-data/header evidence and SoETilesViewer output.

## Implementation
- Parser module: [debugger/emulator/room-script-model.js](/Users/v/Documents/GitHub/everscript-vscode/debugger/emulator/room-script-model.js)
- Extension integration seam: [extension.js](/Users/v/Documents/GitHub/everscript-vscode/extension.js)
- Rooms-tab rendering: [memory_radar/webview/assets/rooms-tab.js](/Users/v/Documents/GitHub/everscript-vscode/memory_radar/webview/assets/rooms-tab.js)
- Tests: [debugger/tests/room-script-model.test.js](/Users/v/Documents/GitHub/everscript-vscode/debugger/tests/room-script-model.test.js)

## User Requests Handled
- Correct debugger feature layout so `debugger/` is the owning feature root and `core/` plus `emulator/` are subfolders.
- Study the script language used by SoEScriptDumper enough to build a real ROM-backed room parser.
- Validate right record size, right opcode identification, and trailing `0x00` termination.
- Print parsed enter, step-on, and B-trigger data in the map/Rooms tab in a TilesViewer-like table.

## Pending Requests To User
- Provide additional traced scripts or opcode notes if broader opcode coverage is required beyond transition-heavy room scripts.
- Confirm whether the Rooms tab should eventually show symbolic map names for `0x22 CHANGE MAP` rows instead of raw room ids only.

## Known Gaps
- Unsupported opcodes currently stop decoding with an explicit stop reason instead of speculative parsing.
- Opcode summaries are intentionally conservative; they identify known fields but do not claim full semantics for every operand.
- No UI automation yet asserts the rendered script tables inside the Rooms tab webview.

## Cross-Feature Links
- Related map renderer status: [docs/map-renderer-status.md](/Users/v/Documents/GitHub/everscript-vscode/docs/map-renderer-status.md)
- Related room/payload work: [docs/map-loading.md](/Users/v/Documents/GitHub/everscript-vscode/docs/map-loading.md)