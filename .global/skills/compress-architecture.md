---
applyTo: "**"
---

# Skill: Compress Architecture

Use this skill when a file, module, or subsystem has become too large, mixes responsibilities, or has accumulated hidden state that makes AI-local reasoning hard.

---

## When to invoke

- Any file exceeds 400 LOC
- A file owns more than one thing (renders AND parses AND manages state)
- AI session requires reading 3+ files to understand a single action
- "The same concept appears in multiple files" is true

---

## Ownership decomposition procedure

1. **Map current ownership** — List every state variable and function in the file. For each, ask: which subsystem domain does this belong to?

2. **Draw ownership boundaries** — Create one file per ownership domain. Name files after what they OWN, not their utility category:
   - GOOD: `panel-lifecycle.js`, `panel-ipc.js`, `panel-html.js`
   - BAD: `panel-helpers.js`, `panel-utils.js`

3. **Extract pure functions first** — Functions with no side effects move out with zero risk.

4. **Extract readers second** — Pure I/O functions (file reads, ROM reads). These must have ZERO VS Code dependency.

5. **Extract renderers third** — Functions that produce HTML/JSON from data. These take data in, return strings out. No state mutation.

6. **Leave orchestration last** — The original file becomes a thin orchestrator that calls the extracted modules.

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

- Do NOT create a shared helper for functions used by only one owner
- Do NOT create a utility module for <3 utility functions
- Do NOT create a base class for <3 concrete instances
- If two files need the same function, copy it — coupling is worse than duplication at this scale

---

## Standalone goal

After extraction, each file should be independently runnable as a node script (for pure modules) or independently testable without full extension startup.

---

## Change Ritual (mandatory after any extraction)

1. Bump version (`package.json`)
2. Run tests: `/opt/homebrew/bin/npm test`
3. Commit: `v<ver>: [<subsystem>] extract <what>`
4. Install: `rsync -a --delete --exclude='.git' /Users/v/Documents/GitHub/everscript-vscode/ ~/.vscode/extensions/everscript-<ver>/`
