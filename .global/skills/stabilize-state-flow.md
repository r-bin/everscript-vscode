---
applyTo: "**"
---

# Skill: Stabilize State Flow

Use this skill when state ownership is ambiguous, state is duplicated across files, or implicit synchronization causes bugs.

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
grep -n "^let \|^var \|^const _" extension.js
grep -n "^let \|^var \|^const _" <other_large_file>.js
```

For each: which subsystem SHOULD own this?

### Step 2: Identify duplication

Look for:
- Same data computed in multiple places
- Cache invalidation happening in multiple places
- Same string/constant defined in multiple files
- Same rendering formula in multiple files

### Step 3: Apply one-owner rule

Each state has exactly ONE owner:
1. The file that created the initial value owns it
2. No other file mutates it directly
3. Other files read it as a return value or parameter — never mutate it

### Step 4: Make derived state explicit

Derived state must be:
- Computed (not stored) when cheap
- Centralized (single compute function) when expensive
- Documented: "derived from X via formula Y"

---

## State ownership map for this repo

See `STATE_FLOW.md` for the authoritative table.

Key rules:
- All 14 radar-related state vars live in `extension.js` — **never add new ones**
- Subsystem caches (lua watcher cache, vanilla data cache) live in their owning modules
- Webview client state (zoom, selection, filter toggles) lives in webview JS only — never synchronized back to extension

---

## Hidden state anti-patterns to fix

| Anti-pattern | Fix |
|---|---|
| Two `_radarMapCache` copies | Remove one; use single owner |
| Rooms module with its own doc-path tracker | Move to `extension.js._radarRoomDocPath` |
| Multiple files calling `readRomMapHeader` and caching locally | Centralize in rom-readers with one cache |
| Constants duplicated in server and client | Move to server; inject as JS global in webview |

---

## Change Ritual

1. Bump version
2. `/opt/homebrew/bin/npm test`
3. Commit: `v<ver>: [<subsystem>] centralize <state-name> ownership`
4. Install
