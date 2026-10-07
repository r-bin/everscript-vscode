# debugger/ — .evs debugging in the embedded emulator

Breakpoints, stepping, call stacks and memory reads for `.evs` scripts running
in the emulator panel, through VS Code's debugger UI (F5).

## How it works

```
VS Code debug UI ── DAP (in-process) ── emulator-session.js
                                            │  bridge (injected by extension.js)
                                            ▼
                     emulator/script-debug-host.js ── postMessage ── script-debug-view.js (webview)
                                                                          │ exec breakpoint $8C:D0A6
                                                                          ▼
                                                                  custom snes9x core
```

1. **Source map.** The everscript compiler writes `out/source_map.json`
   (`compiler/source_map.py` in that repo): per compiled function its ROM
   address, per statement its ROM address, `.evs` file and line, and, for
   functions without `@install` (inlined at every call), the call sites that
   expanded it. One line is often several script instructions (x:1), and an
   address can sit several inline levels deep.
2. **Hook.** The interpreter fetches every opcode at `$8C:D0A6`
   (`lda [$82]`), with the instruction's address in `$82-$84` and the running
   slot's pointer in `$7E`. While something is wanted, the webview arms an exec
   breakpoint there. The custom core asks `Module.onBreakpointHit` first and keeps
   running when it returns `false`, so the game runs at full speed between stops.
3. **Stops** land between two script instructions: on a breakpoint address, at
   the end of a step, or on a pause (next instruction; with no script running,
   the CPU pauses where it is after 300 ms). The webview sends a snapshot of the
   20 script slots; `script-frames.js` turns it into threads and frames.
4. **Steps** are data, because the decision has to be made synchronously inside
   the core: `{ slot, scope, parent, parentScope, ranges, into, callerOnly }`.
   Step over runs until the slot leaves the line's address ranges. Step into an
   inlined call runs nothing; it shows the same address one level deeper. A
   script call (opcode 0x29 and friends) starts a new slot whose `+0x0B` points
   at the caller, and the callee's end resumes it, so stepping out of a script
   stops when the parent slot runs again. A slot running outside its function
   has been reused by another script: that never ends a step.
5. **Blocks passed to calls are lambdas** (`conversation({ ... });`): line 210 is
   one line, and step over runs the call with its block (breakpoints inside still
   stop). Step in enters the callee (`conversation`), whose `callback();` line steps
   into the block; its frame shows as `portal_act_1 › λ`. Leaving the block returns to
   the callee. A breakpoint stop shows the breakpoint line that starts at that
   address, not an enclosing call that has a breakpoint too.
6. **Focus**: the emulator's `BREAK: code / stay` chip. With `stay`, the panel takes
   the focus back after VS Code shows the stopped line (globalState
   `everscript.emulator.keepFocusOnBreak`).

## Files

| File | Role |
|---|---|
| `inline-adapter.js` | Registers the `everscript` debug type (launch / attach), the only file using the VS Code API |
| `emulator-session.js` | DAP session: breakpoints, stops, steps, threads, stack, variables, evaluate |
| `script-frames.js` | Pure: snapshot → threads / frames / variables; step predicates |
| `source-map.js` | Pure: reads `out/source_map.json`; address ↔ line, inline levels, step ranges, memory symbols |
| `value-types.js` | Pure: which enum a memory value holds (`// @type ENUM` on its declaration, else inferred from the sources) |
| `conditions.js` | Pure: evaluates an `if` / `while` condition against live memory |
| `memory-access.js` | Pure: memory by name or `.evs` notation (type, read, write), the Memory scope, DAP readMemory / writeMemory |

## Launch

- `launch` (F5 in an `.evs` file: `everscript.debugInEmulator`, independent of launch.json, which in the everscript repo debugs the Python compiler): build via
  `everscript.buildAndRun` with `{ inputPath, run: false }`, load the source map,
  set breakpoints, then load the ROM; the breakpoints travel with the
  `loadRom` message, so they are armed before the first frame. Ctrl+F5 only builds and runs.
- `attach` (the panel's "connect dbg" button, `Everscript: Attach Debugger to Emulator`):
  debug the ROM that is already running.
- Rebuilding during a session re-resolves the breakpoints before the new ROM boots.

Needs the custom core (`everscript.snesCorePath`): the vanilla core has no debugger API.

## Allowed dependencies

`inline-adapter.js` → `vscode`, `emulator-session.js`, `source-map.js`.
Everything else is plain Node. No import of `emulator/` or `memory/`: the
emulator bridge is injected by `extension.js`.

## Memory while stopped

The source map's `symbols` are the compiler's enum entries holding memory
(`MEMORY.X`, `FLAG.X`, `CUSTOM_MEMORY.X` ...): WRAM offset, size, flag bit. Names
the map lacks fall back to the bundled language index.

- **Watch / Debug Console / hover** (EvaluatableExpressionProvider): `MEMORY.NAME`,
  `(Byte) <0x0ADA>`, `<0x289D>`, `<0x28FA, 0x10>`, `$7E0ADA`, `arg[0x02]`; typed Byte / Word / Flag.
  Watch entries can be edited (setExpression).
- **Inline values** (InlineValuesProvider): every memory name of the stopped
  function valued next to the code, and after each `if` / `else if` / `while`
  condition what it evaluates to now (`⇒ true`, `⇒ false`, or "skipped" after the
  taken branch of a chain). Below the stopped line that is a prediction: memory can
  change before execution gets there. Conditions with calls or unknown names get no hint.
- **Types**: a value of a typed memory name shows its enum name
  (`ALCHEMY_INDEX.HARD_BALL  0x05 (5)`, type `Byte: ALCHEMY_INDEX`), and edits accept
  constants. Explicit: `SELECTED_ALCHEMY_0 = (Byte) <0x0ADA>, // @type ALCHEMY_INDEX`;
  otherwise the enum the sources assign or compare most. Enum constants come from the
  compiler (`constants` in the source map). Animation ids: see `docs/animation-enum-links.md`.
- **Variables → Memory**: the memory names the frame's function uses; editable (setVariable).
- **Memory view**: values carry a memoryReference, so VS Code's binary data view
  (Hex Editor extension) shows and edits WRAM around them (readMemory / writeMemory).

## Not yet

- Entity-relative memory (`<BOY>[FLAGS_5]`) is not evaluated.
- Vanilla (uncompiled) scripts show as `script $XXXXXX` frames without source; stepping there goes one instruction at a time.
