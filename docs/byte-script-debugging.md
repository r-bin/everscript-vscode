# Byte-Script Debugging Dossier

## Status

- State: in progress
- Scope handled: emulator-panel manual byte-script breakpoints, live Rooms-tab script focus, ROM-header-backed room extent sizing
- Scope still open: `.evs` source-line mapping from live byte-script execution, debugger-session lifecycle tied to the emulator panel, hex breakpoints inside the VS Code debug UI, full opcode coverage from `script_all`

## Understanding

- There are currently two different debug surfaces in this extension.
- The `everscript` debug adapter is a mock `.evs` source debugger for stepping named source functions.
- The emulator panel exposes the real SNES byte-script scheduler state through the custom core bridge.
- The Rooms tab can decode ROM-backed room scripts and is the closest reliable UI for showing live byte-script execution today.

## Dependency Check

- Validated model availability: byte-script execution state comes from the custom SNES core bridge in [debugger/emulator/panel.js](/Users/v/Documents/GitHub/everscript-vscode/debugger/emulator/panel.js).
- Data sources: active emulator session, configured vanilla ROM, decoded room-script model from [debugger/emulator/room-script-model.js](/Users/v/Documents/GitHub/everscript-vscode/debugger/emulator/room-script-model.js), current open `.evs` file for mock-source debugging.
- Missing dependency for true source stepping: a validated mapping from live byte-script `loc` addresses back to `.evs` source lines. That mapping does not exist yet.

## How To Attach

### `.evs` source debugging

1. Open an `.evs` file.
2. Start the `Everscript Debug (Mock)` configuration from Run and Debug.
3. The adapter in [debugger/adapter.js](/Users/v/Documents/GitHub/everscript-vscode/debugger/adapter.js) launches the mock runtime in [debugger/mock-runtime.js](/Users/v/Documents/GitHub/everscript-vscode/debugger/mock-runtime.js).
4. This path is source-oriented and does not execute the real ROM byte scripts.

### Emulator byte-script inspection

1. Launch the emulator with `F5` or the `Everscript: Open Emulator` command.
2. Load a ROM and wait for the script-stack panel to populate.
3. Read the `loc` values in the stack panel. These are the live byte-script VM addresses.
4. Add a manual breakpoint in the emulator panel using one of those `loc` values, for example `94E5FB`.
5. When the active script slot reaches that address, the emulator panel pauses and forwards the focused byte-script address into the Rooms tab.

### Rooms-tab live script tracking

1. Open Memory Radar and switch to the Rooms tab.
2. Select the active room or the matching vanilla room.
3. The Rooms tab decodes the room's enter/step-on/B-trigger scripts from the ROM.
4. When the emulator reports a focused byte-script address, the matching decoded row/card is highlighted if that address exists in the rendered room-script tables.

## Failure Modes

- No ROM configured: the Rooms tab shows an explicit room error and cannot decode vanilla scripts.
- Vanilla core instead of debugger-capable core: the script stack falls back to save-state reads and cannot pause on manual byte-script breakpoints.
- Room/script mismatch: a highlighted byte-script address only appears when the selected room contains the decoded instruction address.
- No source mapping: the current implementation cannot reliably highlight the corresponding `.evs` source line for a live byte-script address.

## Evidence

- The emulator panel now compares manual breakpoint addresses against active script-slot `loc` values instead of using CPU exec breakpoints.
- The Rooms tab now accepts `byteScriptFocus` messages and highlights decoded script rows carrying the matching ROM address.
- The Rooms map view now sizes its extent from ROM header width/height, using `width * 16` and `height * 16` as the authoritative room geometry.
- Regression coverage was added in [debugger/tests/emulator-health.test.js](/Users/v/Documents/GitHub/everscript-vscode/debugger/tests/emulator-health.test.js), [memory_radar/tests/smoke.test.js](/Users/v/Documents/GitHub/everscript-vscode/memory_radar/tests/smoke.test.js), and [memory_radar/tests/ui.test.js](/Users/v/Documents/GitHub/everscript-vscode/memory_radar/tests/ui.test.js).

## UI Visibility Checklist

- Emulator panel manual breakpoint input is visible.
- Emulator script-stack detail remains visible.
- Rooms decoded script rows remain visible.
- Live focused script row/card highlight is visible when a matching address is present.

## Runtime Error Handling Checklist

- Missing debugger API falls back to read-only save-state inspection.
- Missing ROM surfaces explicit room errors in the Rooms tab.
- Non-browser test harnesses are tolerated by guarding the Rooms-tab message listener.

## Cross-feature Links Added

- Emulator panel -> Rooms tab via `byteScriptFocus`
- Emulator panel -> extension host via internal `everscript._scriptFocus`
- Rooms geometry -> ROM header data already displayed in the same tab

## Known Gaps and Next Steps

- The mock `.evs` debugger is still not tied to the emulator-panel lifecycle.
- Live byte-script execution still does not map back to real `.evs` source lines.
- Manual hex breakpoints are only in the emulator panel, not yet in the Debug view.
- Parser validation still needs broader real-world opcode coverage from `script_all`.