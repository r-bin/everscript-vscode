---
name: debugger-protocol
description: VS Code debugging of .evs scripts in the embedded emulator — DAP session, compiler source map, interpreter hook, stepping model. src/debugger/ and emulator/script-debug-*.
applyTo: "src/debugger/**"
---

# Skill: Debugger Protocol

Read `src/debugger/README.md` first: it has the architecture, file roles and launch flow.

## Hard facts (verified headless, v0.166.0)

- Interpreter opcode fetch: `$8C:D0A6` (`lda [$82]`); `$82-$84` = address of the
  instruction about to run, `$7E` = running slot pointer (slots at `$7E28FC`, 20 × `0x4F`).
- Script call (`0x29`, handler `$8C:D3C9`): new slot, `+0x0B` = caller slot, caller
  suspended. End (`0x00`, `$8C:D2E1`): slot state 0, resumes the `+0x0B` slot.
- Custom core: `Module.onBreakpointHit` returning `false` = keep running (no pause).
  The breakpointed CPU instruction still runs; the script instruction does not.
- Source map addresses are ROM offsets (`SNES & 0x3FFFFF`).

## Rules

- Stop decisions run synchronously inside the core callback: keep them in the webview,
  driven by data from the host (breakpoint offsets, step predicate). No host round trip per opcode.
- Arm the `$8C:D0A6` exec breakpoint only while something is wanted; disarm otherwise.
- A step never ends in a slot running outside the function it was stepping (slot reuse).
- Webview code is in a template literal: ASCII only, no backslashes. Test it from
  `buildHtml()` output (`tests/debugger/script-debug-hook.test.js` does, with the real core).
- Compiler side lives in the everscript repo (`compiler/source_map.py`); markers are
  comments, so the emitted bytes must stay identical — diff `out/patch.clean.txt` after changes.
