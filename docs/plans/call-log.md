# Everscript Call Log — Module Design

## Purpose

Produce a structured, human-readable log of every script function call made
during a gameplay session, with:

- Function name (from EVS source or core symbol table)
- Argument values at the moment of the call
- Timestamp / frame counter
- Caller function (partial call stack)

The log is optional and opt-in because on a busy map it can reach tens of
thousands of entries per second.

---

## Why it is useful

1. **Debugging** — trace exactly what the script engine did when a bug occurred.
2. **Reverse engineering** — understand vanilla scripts by watching what functions
   they call and with what arguments.
3. **Performance profiling** — find which functions are called the most.
4. **Documentation** — auto-generate call traces for new maps or features.

---

## Data Sources

| Source | What it provides |
|--------|-----------------|
| `out/everscript.evsd` (compiler sidecar) | function name, source file, line, ROM address |
| `.github/memory-map.md` | WRAM address → human name |
| `in/core/*.evs` + `code_highlighter/data/index.json` | core function signatures |
| `tools/snes9x_wram.py --json --watch` | live WRAM stream (byte deltas) |

---

## Detection Strategy

The EVS script VM executes opcodes from a bytecode stream in WRAM.  A "function
call" in the VM corresponds to a `CALL` opcode (e.g. opcode 0x03 or 0x0c
depending on the calling convention) that jumps the instruction pointer to a
known script address.

### Detecting a call event

1. Watch the VM instruction pointer (IP) address in WRAM (documented in
   `memory-map.md` as the running script IP register).
2. On each IP change, look up the new IP value in the compiled function address
   table (from `out/everscript.evsd` or `out/memory_map.txt`).
3. If the IP matches the entry point of a known function → a call just happened.
4. Read the `arg[]` WRAM slots (`arg[0x00]`–`arg[0x0E]`) to capture arguments.

### Vanilla script calls

For vanilla scripts (not compiled from EVS), the function table is built from the
ROM script scan output.  The vanilla script decoder in `tmp/` already knows the
byte layout.  A "named call" in a vanilla script is opcode 0xa3 (CALL script by
ID).  Cross-reference the script ID against known vanilla script names to get a
human-readable label.

---

## Module Structure

```
call-log/
  design.md           ← this file
  call-decoder.js     ← pure: decodes WRAM call events to { name, args, frame }
  log-channel.js      ← VS Code output channel writer + file sink
  log-webview.js      ← optional webview panel with filter/search UI
  tests/
    call-decoder.test.js
```

### `call-decoder.js`

```js
/**
 * Given a snapshot of WRAM (or a delta from snes9x_wram.py),
 * and the compiled function address table, detect calls and decode args.
 *
 * Returns [] or [{ addr, name, args: [{index, value}], frame }]
 */
function decodeCallEvent(wramSnapshot, funcTable, argAddrs) { ... }
```

Pure function — no VS Code dependency, fully testable offline.

### `log-channel.js`

Wraps a `vscode.OutputChannel` named "Everscript Call Log".  Each decoded event
is formatted as:

```
[frame 1234]  trigger_enter()
[frame 1235]    face(BOY, NORTH)           arg[0]=0x01  arg[2]=0x00
[frame 1236]    teleport(DOG, 0x1a, 0x19)  arg[0]=0x02  arg[2]=0x1a  arg[4]=0x19
```

Optional: a rotating file sink (`out/call-log.txt`) controlled by a VS Code
setting `everscript.callLog.writeFile`.

### `log-webview.js`

A VS Code webview panel (like the Memory Radar) showing a live-updating table:

| Frame | Depth | Function | Args | Source |
|-------|-------|----------|------|--------|

Columns are filterable (e.g. hide all `wait_*` calls).  Clicking a row jumps to
the source line (same mechanism as the Radar line links).

---

## Configuration (VS Code settings)

```json
"everscript.callLog.enabled": false,
"everscript.callLog.writeFile": false,
"everscript.callLog.maxEntries": 10000,
"everscript.callLog.hideBuiltins": true
```

---

## Dependencies on other modules

- **Memory Radar** (`memory_radar/radar-utils.js`): reuses `parseEvsNum`,
  `radarLifecycle`, and the memory-map cache for arg address resolution.
- **Debugger** (`debugger/mock-runtime.js`): reuses `parseFunctions` to build
  the function name → line map for source linking.
- **Snes9x WRAM tool** (`tools/snes9x_wram.py`): the live data source.

---

## Phase 1 (mock — no emulator)

Record calls synthetically during a mock debug session:
- Each time `MockRuntime` fires `stopOnStep`, record the current frame + args.
- Write to the output channel.
- This lets the user see a call log without a running emulator.

## Phase 2 (live)

Replace the mock source with the `snes9x_wram.py --json --watch` stream.
The WRAM reader streams JSON lines; `call-decoder.js` processes them.

---

## Open questions

1. **Call depth limit** — the VM stack can be up to ~16 deep; do we track the
   full chain or just the immediate caller?
2. **Inline functions** — some compiler-generated code has no EVS source line;
   how to label them?
3. **Multi-file projects** — when `#import` brings in functions from other files,
   the function table must include all imported files' addresses.
4. **Vanilla script opcode table** — the exact opcode numbers for all call variants
   need verification against the traces in `traces/`.
