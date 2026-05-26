# Emulator v0.2.71 Revert Notes

Status: rollback stabilized; reintroduction in progress

Reason:
- ROM startup is still failing in the live VS Code webview with `Timeout waiting for webview ready message`.
- To narrow the failure surface, the v0.2.71 emulator-panel additions in [emulator/panel.js](/Users/v/Documents/GitHub/everscript-vscode/emulator/panel.js) were removed from the shipped build.

Features removed by the rollback:
- Semantic script lifecycle detection based on slot snapshots.
- Script-stack detail panel (`ss-detail`) showing executing slots, active-slot interpretation, scheduler chain, and caller summary.
- Focused `0x0F..0x2E` argument dump for the lifecycle-selected slot.
- Lifecycle-based `break all hooks` pause behavior.
- Visible-editor fallback for debugger sync anchoring when the emulator webview owns focus.

Behavior after rollback:
- Script stack returns to the simpler pre-v0.2.71 table: slot, PC, state, entity, timer.
- Breakpoints pause on the first observed raw watched-byte write instead of a derived lifecycle event.
- Debugger sync again requires the active text editor to be an Everscript document.

Re-add checklist:
- Re-introduce lifecycle analysis only after there is a reproducible boot-path test that exercises the full webview startup script.
- Add one executable regression test that proves `webviewBoot` is posted in the same HTML shape shipped to VS Code.
- Re-introduce visible-editor sync anchoring separately from lifecycle rendering so those concerns can be validated independently.

Progress:
- Added a browser-backed runtime harness in [debugger/tests/emulator-runtime.test.js](/Users/v/Documents/GitHub/everscript-vscode/debugger/tests/emulator-runtime.test.js) that opens the real panel HTML, waits for `webviewBoot`/`ready`, loads the Evermore ROM, and exercises both bundled and custom core paths.
- The harness was validated against historical commit `654df3e`: current `v0.2.76` passes, while `654df3e` fails with `timed out waiting for webviewBoot`.
- Reintroduced visible-editor debugger sync anchoring in [emulator/panel.js](/Users/v/Documents/GitHub/everscript-vscode/emulator/panel.js) as the first low-risk v0.2.71 feature slice.
- Restored the pause/resume and hook-control path by merging the custom and vanilla core sources into the new `core/` layout and remapping legacy `debugger/core/...` settings to `core/snes9x2005-wasm/snes9x_2005.js`.
- Restored the read-only script detail panel (`ss-detail`) with active-slot summary, scheduler-chain view, next-slot column, and argument dump, while keeping the riskier lifecycle-derived break behavior out of this slice.