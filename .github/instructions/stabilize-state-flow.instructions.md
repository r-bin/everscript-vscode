---
name: stabilize-state-flow
description: Use when state ownership is ambiguous in everscript-vscode, state is duplicated across files, or implicit synchronization causes bugs. Covers diagnosing duplicated/mirrored state and applying the one-owner rule.
applyTo: "src/**"
---

# Skill: Stabilize State Flow

Use this skill when state ownership is ambiguous, state is duplicated across files, or
implicit synchronization causes bugs.

---

## When to invoke

- Two files both hold a copy of the same data
- A piece of state is updated in multiple places
- Bugs appear when state "gets out of sync"
- You cannot find where a piece of state is authoritatively set
- AI sessions frequently re-search for "where does X come from"

---

## Diagnosis procedure

### Step 1: Enumerate all mutable module-level variables

```bash
grep -n "^let \|^var \|^const _" src/extension.js
grep -n "^let \|^var \|^const _" <other_large_file>.js
```

For each: which domain under `src/` SHOULD own this?

### Step 2: Identify duplication

Look for:
- Same data computed in multiple places
- Cache invalidation happening in multiple places
- Same string/constant defined in multiple files
- Same rendering formula in multiple files

### Step 3: Apply the one-owner rule

Each state has exactly ONE owner:
1. The file that created the initial value owns it.
2. No other file mutates it directly.
3. Other files read it as a return value or parameter — never mutate it.

### Step 4: Make derived state explicit

Derived state must be:
- Computed (not stored) when cheap
- Centralized (single compute function) when expensive
- Documented: "derived from X via formula Y"

---

## State ownership map for this repo

See `STATE_FLOW.md` at the repo root for the authoritative table (paths there predate
the `src/` refactor in places — cross-check against actual file locations under `src/`
before trusting a specific filename).

Key rules:
- Radar-related state vars live in `src/extension.js` (or the extracted radar state
  module, if one exists) — **never add new ones without checking there first**.
- Domain caches (lua watcher cache, vanilla data cache) live in their owning domain
  under `src/`.
- Webview client state (zoom, selection, filter toggles) lives in webview JS only —
  never synchronized back to the extension host.

---

## Hidden state anti-patterns to fix

| Anti-pattern | Fix |
|---|---|
| Two copies of a memory-map cache | Remove one; use a single owner |
| A domain with its own doc-path tracker duplicating the extension's | Move to the one
  authoritative tracker |
| Multiple files calling a ROM reader and caching locally | Centralize in
  `src/shared/rom-readers.js` with one cache |
| Constants duplicated in server and client code | Move to server; inject as a JS
  global in the webview |

---

## After any stabilization work

Run the `release-ritual` skill (version bump, `npm test`, commit as
`v<ver>: [<domain>] centralize <state-name> ownership`, `npm run deploy`).
