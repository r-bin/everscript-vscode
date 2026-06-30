# Everscript Debugger — POC Design

## What this is

A source-level mock debugger for `.evs` files that works entirely inside VS Code
using the Debug Adapter Protocol (DAP).  Phase 1 ("mock") has **no emulator**:
it parses the `.evs` source, builds an execution model from the function graph,
and simulates stepping through source lines.  Phase 2 wires the same adapter to
a live Snes9x/Mesen WRAM feed.

---

## Architecture

```
VS Code UI (breakpoints, call stack, variables panels)
        ↕  DAP over stdin/stdout
debugger/adapter.js        — DAP server, no VS Code API
        ↕  event calls
debugger/mock-runtime.js   — source parser + execution engine
        ↕  (Phase 2) WRAM socket
tools/snes9x_wram.py       — live memory reader
```

---

## How the mock runtime works

1. On `launch`, read the target `.evs` file (and any `#import`-ed files it
   references, following the same preprocessor logic the compiler uses).
2. Parse all `fun NAME(args) { ... }` blocks to build a function table:
   - function name
   - source file path
   - start line / end line
   - list of "statement lines" (non-blank, non-comment, non-brace lines)
   - list of outgoing calls per statement (regex `NAME(`)
3. Start "execution" at the entry function (`trigger_enter` by default, or
   whatever the launch config says).
4. Each `next`/`stepIn`/`stepOut` command advances the mock IP through the
   statement list.  Call stack is a plain JS array of `{name, file, line}`.
5. Breakpoints are matched against `{file, line}` at each advance.

This means the user sees the `.evs` source highlighted line-by-line in the
editor, the call stack panel fills with real function names from the file, and
breakpoints work exactly like any other language.

---

## Debug session lifecycle

```
User presses F5 (launch)
  → adapter spawns, runtime parses source
  → StoppedEvent(entry) — halted at first line of entry function
User sets a breakpoint on line 855
User presses Continue
  → runtime walks lines; hits line 855
  → StoppedEvent(breakpoint)
User presses Step Over (F10)
  → runtime advances one statement
  → StoppedEvent(step)
User presses Step Into (F11)
  → if statement has a call, push called function to stack
  → StoppedEvent(step)
```

---

## Compiler changes needed

The mock debugger works entirely from `.evs` source — no compiler output needed.

For the production debugger (Phase 2+), the compiler must emit a **debug
sidecar** alongside `out/everscript.ips`.  Here is the minimal diff:

### 1. `compiler/ast_core.py` — attach source positions to statement nodes

Every `BaseBox` subclass that represents a statement (i.e. `Function`, `If_list`,
`While`, `For`, `Call`, `Asign`) should store the position of its first token:

```python
class BaseBox:
    source_pos = None   # SourcePosition(lineno, colno) | None
```

In `parser.py`, every production that creates a statement node should set it:

```python
@self.pg.production('expression_entry : expression ;')
def parse(p):
    element = p[0]
    # p[1] is the semicolon token — use its position as a fallback
    if hasattr(p[1], 'source_pos') and element.source_pos is None:
        element.source_pos = p[1].source_pos
    return element
```

rply tokens already expose `.source_pos` (a `SourcePosition(lineno, colno)`
object) — the position is just not being forwarded to the AST node today.

### 2. `compiler/codegen.py` — emit `.evsd` debug sidecar

At the end of `Generator.generate()`, add:

```python
def _emit_debug_sidecar(self, out_path):
    import json, os
    records = []
    for fn in self.code:                     # fn is a Function
        byte_offset = 0
        for stmt in fn.code_list:            # walk statement list
            records.append({
                "function": fn.name,
                "file":     fn.source_file,  # set during preprocessing
                "line":     stmt.source_pos.lineno if stmt.source_pos else None,
                "romAddr":  fn.address + byte_offset,
                "byteLen":  len(stmt.calculate([])),
            })
            byte_offset += records[-1]["byteLen"]
    with open(out_path, "w") as f:
        json.dump({"statements": records}, f, indent=2)
```

Output: `out/everscript.evsd` — consumed by the VS Code adapter.

### 3. `compiler/preprocessor.py` — attach source file to functions

When a `fun` is parsed from a specific file (after `#import` resolution), record
the originating file path on the `Function` node so the sidecar can reference it.

---

## Phase 2 — Live emulator connection

Replace the mock stepper with a real VM state reader:

- `tools/snes9x_wram.py --json --watch` streams WRAM deltas over stdout.
- The adapter spawns this tool and listens for the VM instruction pointer address
  (`0x7E28nn` or wherever the running script IP lives in WRAM).
- Each WRAM update ticks the debugger: compare VM IP against the `.evsd` sidecar
  to find the matching source line, then fire `StoppedEvent` if a breakpoint
  matches.

No compiler changes are needed for Phase 2 if the sidecar is available.

---

## Phase 3 — Full DAP (VARIABLES, WATCH, CALL STACK)

- WRAM address → memory-map entry (`memory-map.md`) → variable name/type.
- Variable writes tracked via the `radarAnalyzeScope` logic already in
  `memory_radar/radar-utils.js`.
- `arg[N]` slots readable from WRAM opcode 0x13 area.
- Call stack reconstructed from the VM's stack pointer + function address table
  (from `.evsd` sidecar or the `out/memory_map.txt` generated by the compiler).
