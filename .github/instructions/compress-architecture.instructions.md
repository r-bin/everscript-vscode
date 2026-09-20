---
name: compress-architecture
description: Use when a file, module, or subsystem in everscript-vscode has become too large, mixes responsibilities, or has accumulated hidden state that makes AI-local reasoning hard. Covers ownership decomposition and file-splitting procedure.
applyTo: "src/**"
---

# Skill: Compress Architecture

Use this skill when a file, module, or subsystem has become too large, mixes
responsibilities, or has accumulated hidden state that makes AI-local reasoning hard.

---

## When to invoke

- Any file exceeds 400 LOC
- A file owns more than one thing (renders AND parses AND manages state)
- An AI session requires reading 3+ files to understand a single action
- "The same concept appears in multiple files" is true

---

## When splitting isn't the fix: recognize a weaker re-derivation

Not every large or messy file should be decomposed in place. `src/maps/`'s ROM
tilemap decoder is large-ish and heuristic, but the right move isn't to split it into
`map-sentinel.js` + `map-position-table.js` + `map-tilemap.js` — it's to retire its
decoding responsibility in favor of the sibling `everscript` repo's already-verified,
byte-exact Python implementation (see the `map-format` skill). Before decomposing a
file, ask: is this file *structurally* tangled (the normal case — split it), or is it
an independent, weaker reimplementation of something already solved correctly
elsewhere (a different problem — point at the real implementation instead of
polishing the copy)?

---

## Ownership decomposition procedure

1. **Map current ownership** — list every state variable and function in the file. For
   each, ask: which domain under `src/` does this belong to?

2. **Draw ownership boundaries** — one file per ownership domain. Name files after what
   they OWN, not their utility category:
   - GOOD: `panel-lifecycle.js`, `panel-ipc.js`, `panel-html.js`
   - BAD: `panel-helpers.js`, `panel-utils.js`

3. **Extract pure functions first** — zero-side-effect functions move out with zero
   risk.

4. **Extract readers second** — pure I/O functions (file reads, ROM reads). These must
   have ZERO VS Code dependency (candidates for `src/shared/`).

5. **Extract renderers third** — functions that produce HTML/JSON from data. Data in,
   string out, no state mutation.

6. **Leave orchestration last** — the original file becomes a thin orchestrator that
   calls the extracted modules.

---

## File size targets

| Range | Status |
|---|---|
| 50–150 LOC | Ideal |
| 150–250 | Acceptable |
| 250–400 | Needs justification |
| > 400 | MUST split |

---

## Anti-abstraction rules

- Do NOT create a shared helper for functions used by only one owner.
- Do NOT create a utility module for <3 utility functions.
- Do NOT create a base class for <3 concrete instances.
- If two files need the same function, copy it — coupling is worse than duplication at
  this scale.

---

## Standalone goal

After extraction, each file should be independently runnable as a node script (for pure
modules) or independently testable without full extension startup.

---

## After any extraction

Run the `release-ritual` skill (version bump, `npm test`, commit as
`v<ver>: [<domain>] extract <what>`, `npm run deploy`).
