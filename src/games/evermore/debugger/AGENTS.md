# src/games/evermore/debugger — agent rules

Kind: **platform** (see `/AI_ARCHITECTURE_GUIDE.md` §2). What the folder does: [README.md](README.md).

## Owns
- The `everscript` debug type (launch / attach) and the in-process DAP session for `.evs`
  scripts running in the emulator panel: breakpoints, stops, steps, threads, stack,
  variables, evaluate, readMemory / writeMemory.
- Not the webview side: `src/emulator/script-debug-host.js` (the emulator's) and
  `games/evermore/emulator/script-debug-view.js`; the bridge to them is injected.

## Dependencies
- `inline-adapter.js` → `vscode`, `emulator-session.js`, `source-map.js`. It is the only
  file using the VS Code API; everything else is plain Node.
- No import of `emulator/` or `memory/`: the emulator bridge is injected by `extension.js`.
  `.depcruise.js` rule `no-debugger-to-memory`.
- Existing exceptions: none (no `require('../…')` in this folder).

## Invariants
- `script-frames.js`, `source-map.js`, `value-types.js`, `conditions.js`,
  `memory-access.js` are pure.
- Steps are data (`{ slot, scope, parent, parentScope, ranges, into, callerOnly }`): the
  decision is made synchronously inside the core's `Module.onBreakpointHit`, which keeps
  running when it returns `false`.
- Stops land between two script instructions, never mid-instruction.
- A slot running outside its function has been reused by another script: that never ends a step.
- On `launch`, breakpoints travel with the `loadRom` message so they are armed before the
  first frame; a rebuild re-resolves them before the new ROM boots.
- Needs the custom core (`everscript.snesCorePath`): the vanilla core has no debugger API.

## Tests
- `tests/debugger/debugger.test.js` — session, frames, source map, conditions, memory
  access, value types (unit).
- `tests/debugger/script-debug-hook.test.js` — real hook in the custom core; skips without
  the ROM, its `source_map.json` and the core (emulator).

## Pitfalls
- One `.evs` line is often several script instructions, and an address can sit several
  inline levels deep (functions without `@install` are inlined at every call site).
- Inline-value hints below the stopped line are predictions: memory can change first.
