---
name: isolate-subsystem
description: Use when a domain under everscript-vscode's src/ has leaked dependencies into a sibling domain, or when a module needs to become independently testable and reconstructable. Covers dependency auditing and cutting forbidden cross-domain directions.
applyTo: "src/**"
---

# Skill: Isolate Subsystem

Use this skill when a domain under `src/` has leaked dependencies into a sibling domain,
or when you want a module to be independently testable and reconstructable.

---

## When to invoke

- A module requires files from a sibling domain (e.g. `src/debugger/` requiring
  `src/memory/`)
- A module cannot be tested without loading unrelated domains
- Changing module A breaks module B for unclear reasons
- A module calls back into `src/extension.js` for data it should own itself

---

## Isolation procedure

### Step 1: Audit current dependencies

```bash
grep -n "require(" <file.js> | sort
```

For each `require(path)`:
- Is this a legitimate dependency (same domain, or `shared`)?
- Is it a forbidden direction (see `docs/architecture/domain-overview.md` and
  `.depcruise.js`)?
- Is it a `vscode` import in a module that's supposed to be pure?

### Step 2: Cut forbidden directions

Forbidden dependency directions (see `docs/architecture/domain-overview.md` for the
authoritative per-domain "Allowed deps" / "Forbidden deps" table, enforced by
`npm run check:deps`):
- `src/rooms` → `src/memory` (rendering)
- `src/shared` → any domain module or `vscode`
- `src/language` → `src/debugger` or `src/emulator`
- `src/debugger` → `src/memory` rendering

For each forbidden direction:
- Move the data production to the correct owner.
- Pass data as a parameter instead of pulling it.

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

The caller (usually `src/extension.js` or the domain's `index.js`) injects the deps.

### Step 4: Create a public API facade

Every domain gets one `index.js` (see `src/rooms/index.js` for an existing example)
that:
- Re-exports the public API.
- Provides backward-compat adapters for old callers.
- Hides internal file structure from external callers.

### Step 5: Validate standalone execution

```bash
node <module>.js                    # should not crash for pure modules
node tests/<domain>/<test>.js       # should pass without full extension
```

---

## Domain boundaries in this repo

```
src/extension.js  ← orchestrator only, no business logic
  ├── src/memory/    ← WRAM grid rendering
  ├── src/rooms/     ← map browser
  ├── src/maps/      ← ROM map/blob models (being retired in favor of a map-server — see the `map-format` skill)
  ├── src/scaling/   ← scaling calculator
  ├── src/docs/      ← docs/RNG tab
  ├── src/routes/    ← route planner
  ├── src/language/  ← grammar, hover, completion, definitions
  ├── src/debugger/  ← DAP adapter
  ├── src/emulator/  ← SNES emulator panel
  ├── src/shared/    ← pure infra: config, radar-utils, rom-readers (no vscode dep)
  └── src/map-editor/ ← PLANNED, not yet created — a map-server bridge into the
                         sibling `everscript` repo's verified Python map/room decoder.
                         See the `map-format` skill before creating this domain or
                         adding anything to `src/maps/` that assumes it won't exist.
```

## A distinct instance of the same problem: pointing at a sibling repo's authoritative implementation

Everything above is about domains *inside* `src/`. The same isolation discipline
applies across the repo boundary too: `src/maps/`'s ROM decoder and
`tools/generate_data.py`'s grammar scraper are both independent re-derivations of logic
the sibling `everscript` repo already implements correctly and verified byte-exact. The
fix for that is not "isolate it better" in the usual sense — it's "stop maintaining a
second implementation and call the real one." See the `map-format` skill before
extending either file, or before designing the eventual `src/map-editor/` domain's
dependency direction (extension → compiler/map-server, never the reverse).

Cross-domain communication ONLY through:
- Return values (pure functions)
- Explicit parameters (dependency injection)
- VS Code message passing (`postMessage` for webviews)
- `src/extension.js` relay (for cross-panel IPC)

---

## After any isolation work

Run the `release-ritual` skill (version bump, `npm test`, commit as
`v<ver>: [<domain>] isolate <module>`, `npm run deploy`).
