---
applyTo: "**"
---

# Skill: Isolate Subsystem

Use this skill when a subsystem has leaked dependencies into other subsystems, or when you want to make a module independently testable and reconstructable.

---

## When to invoke

- A module requires files from a sibling subsystem (e.g., `debugger/` requiring `memory_radar/`)
- A module cannot be tested without loading unrelated subsystems
- Changing module A breaks module B for unclear reasons
- A module calls back into `extension.js` for data it should own itself

---

## Isolation procedure

### Step 1: Audit current dependencies

```bash
grep -n "require(" <file.js> | sort
```

For each `require(path)`:
- Is this a legitimate dependency (same subsystem)?
- Is it a forbidden direction (see `STATE_FLOW.md`)?
- Is it a VS Code dependency in a pure module?

### Step 2: Cut forbidden directions

Forbidden dependency directions (from `STATE_FLOW.md`):
- renderer → parser
- rom-readers → vscode
- rom-readers → rendering
- language → debugger
- debugger → radar rendering

For each forbidden direction:
- Move the data production to the correct owner
- Pass data as a parameter instead of pulling it

### Step 3: Inject dependencies explicitly

When module A needs something from module B but the direction is questionable:
```js
// BAD: module pulls from sibling
const { readLuaWatchers } = require('../sibling-module');

// GOOD: caller injects deps
function doThing(data, deps) {
  const watchers = deps.readLuaWatchers(wsRoot, mapName);
}
```

The caller (usually the thin adapter in `index.js`) injects the deps.

### Step 4: Create public API facade

Every subsystem gets one `index.js` that:
- Re-exports the public API
- Provides backward-compat adapters (inject defaults for old callers)
- Hides internal file structure from external callers

### Step 5: Validate standalone execution

```bash
node <module>.js  # should not crash for pure modules
node <subsystem>/tests/<test>.js  # should pass without full extension
```

---

## Subsystem boundaries in this repo

```
extension.js  ← orchestrator only, no business logic
  ├── memory_radar/  ← pure radar domain
  ├── code_highlighter/  ← pure language domain
  ├── debugger/  ← pure debug domain
  └── (calls all via require() — one-directional only)
```

Cross-subsystem communication ONLY through:
- Return values (pure functions)
- Explicit parameters (dep injection)
- VS Code message passing (`postMessage` for webview)
- `extension.js` relay (for debugger → radar IPC)

---

## Change Ritual (mandatory after isolation work)

1. Bump version
2. `/opt/homebrew/bin/npm test`
3. Commit: `v<ver>: [<subsystem>] isolate <module>`
4. Install
