# Bundling the Everscript Compiler with the VS Code Extension

## Idea

Ship the Everscript compiler (or a thin wrapper around it) inside the extension so
users get build, run, and diagnostics without any external setup.

---

## What form the compiler takes determines the approach

| Compiler form | Bundling strategy |
|---|---|
| Standalone binary | Check in under `tools/`, use `taskDefinitions` to run it |
| Python script | Check in under `tools/`, document Python requirement, check at activation |
| LSP subprocess | Wrap in `everscript_lsp.py`, use `vscode-languageclient` (see future-features.md) |

---

## What you gain

- **Build Task** — run the compiler from VS Code without leaving the editor
- **Diagnostics** — pipe compiler output through the existing `everscript` problem matcher
  (already registered in `package.json`) to surface errors inline
- **"Compile on save"** — optional watch mode via a background task
- **Reproducible builds** — the compiler version is pinned to the extension version,
  which is actually desirable for a ROM toolchain

---

## What makes it awkward

- Compiler updates require publishing a new extension version
- Platform-specific binaries need separate VSIX packages or a download-on-install step
- The extension is currently zero-dependency; a compiler increases install size and
  support surface

---

## Recommended incremental path

### Step 1 — Wire a build task (low risk, reversible)

Add a `taskDefinitions` entry and a default `tasks.json` contribution to `package.json`
that calls `tools/everscript_compiler` (or equivalent). The problem matcher is already
defined — connecting it to a task is the only missing piece.

```json
// package.json → contributes
"taskDefinitions": [
  {
    "type": "everscript",
    "properties": {
      "file": { "type": "string", "description": "Entry-point .evs file" }
    }
  }
]
```

### Step 2 — Activation check

At extension activation, locate the compiler binary/script. If missing or broken,
show a one-time notification with setup instructions (not an error modal).

### Step 3 — LSP server (high value, higher effort)

Wrap the compiler in `everscript_lsp.py` and connect via `vscode-languageclient`.
This unlocks hover docs, go-to-definition, and diagnostics from the AST.
See `docs/future-features.md` for the full feature list.

---

## Notes

- `tools/` is already the pattern used for `snes9x_wram.py` — compiler tooling fits there.
- The existing `everscript` problem matcher in `package.json` already defines output
  patterns; it just needs a task to attach to.
- Compiler version should be recorded in `package.json` (e.g. as a custom field
  `everscriptCompilerVersion`) so users know what they have.
