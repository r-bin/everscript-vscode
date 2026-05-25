# Emulator v0.2.71 Revert Notes

Status: active rollback

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