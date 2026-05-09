# Everscript VS Code Extension — Agent Rules

These rules apply to **every agent** working in this repository.
They cannot be overridden by individual agent spec files.

---

## 1. Goal

Make Everscript code **more readable** in VS Code.
Every change must serve one or more of:
- Better visual differentiation of token categories
- More information on hover, completion, or diagnostics
- Better developer tooling (build tasks, problem matchers, snippets)

---

## 2. Change Ritual (mandatory for every commit)

Every session that modifies any project file must complete all four steps before ending:

1. **Bump the version** in `package.json` — patch for fixes/docs, minor for new features, major for breaking changes.
2. **Run tests** — `npm test`. All tests must pass. Fix failures before proceeding.
3. **Commit** to `develop` branch with a descriptive message following the format in §5.
4. **Install** the extension by syncing to `~/.vscode/extensions/everscript-0.1.0/`:
   ```
   rsync -a --delete --exclude='.git' /Users/v/Documents/GitHub/everscript-vscode/ ~/.vscode/extensions/everscript-$(version)/
   ```
   Update the target path if the version folder name changes.

One prompt = one commit. Do not batch unrelated changes.

---

## 3. File Map

| File / Dir | Role |
|---|---|
| `package.json` | Extension manifest — version lives here |
| `syntaxes/everscript.tmLanguage.json` | TextMate grammar — syntax token rules |
| `themes/everscript-dark.json` | Bundled colour theme — P1–P9 palette |
| `language-configuration.json` | Bracket matching, comment toggle, word pattern |
| `test/highlight.test.evs` | Grammar unit tests (vscode-tmgrammar-test 0.1.3) |
| `docs/future-features.md` | Roadmap — read before starting new features |
| `docs/vscode-highlighter-spec.md` | Token category spec — update when grammar changes |
| `CHANGELOG.md` | User-facing change history — update on every version bump |
| `.github/copilot-instructions.md` | This file |

---

## 9. Memory Radar (merged from everscript-memory-radar)

The `everscript.openMemoryRadar` command and all radar logic live in `extension.js`.
The `everscript-memory-radar` repo is now dormant — do not modify it.

**Radar data sources:**
- `.github/memory-map.md` in the **open workspace folder** — ground-truth WRAM address names and lifecycle.
- Active `.evs` document — scope-parsed for `memory(0xADDR)`, `<0xADDR>`, and bit-allocator helpers.

**Address convention:**
- All addresses in `memory()` and `<>` are treated as **absolute 16-bit WRAM** addresses (bank `$7E` implied).
- No offset arithmetic. `memory(0x22d8)` = WRAM byte at `$7E22D8`.
- Do not invent an offset or base; the parser reads hex literals as-is.

**Lifecycle classification (radarLifecycle) — four regions:**
- `sram`    — entry notes/type contains `[SRAM]` or the word `sram` (case-insensitive).
- `temp`    — addr in `0x2800–0x28FF` (compiler scratch, cleared on room load).
- `session` — addr in `0x2200–0x27FF` (cross-room persistent vars).
- `system`  — everything else (engine/HW addresses, 0x0000–0x21FF and 0x2900+).

**Read / Write detection (radarAnalyzeScope):**
- A reference is a **write** if it is immediately followed by `=` (but not `==`, `!=`, `<=`, `>=`).
  This matches both `<0xADDR> = value` and `memory(0xADDR) = value`.
- All other references are **reads**.
- The radar grid cell gets class `.crw` (amber) if both reads and writes are found, `.cw` (red) if write-only.

**UI features (renderRadarHtml):**
- Filter buttons: `temp / session / sram / system / rest` — hide entire grid rows when all cells in a row are filtered out (`recomputeRows()`).
- Cell click opens a structured popup with: Vanilla notes, Writes (destructive), Reads (non-destructive).
- Word-byte highlighting: hovering a cell for a `word` entry highlights the adjacent addr+1 cell with class `.chi`.
- CELLS data is embedded as a JS object (`var CELLS = {...}`) in the webview, keyed by address.

**Snes9x live memory prototype:**
- `tools/snes9x_wram.py` — macOS Mach VM reader. Uses `task_for_pid` + `mach_vm_read` to read the 128 KB WRAM buffer from a running Snes9x process.
- `--addr 0xNNNN` reads a specific address; `--watch` polls every 0.5 s; `--json` emits JSON lines for VS Code integration.
- Requires `sudo` or `get-task-allow` entitlement on macOS.

**No overlap expected** — the WRAM address space is memory-mapped; two scripts should never legitimately share the same address. Do not add overlap-warning UI.

---

## 4. Grammar Rules

- Pattern order matters: first match wins. See `syntaxes/everscript.tmLanguage.json` §patterns array.
- All JSON must be ASCII-only. No em-dashes (`—`), curly quotes, or box-drawing characters.
- Use named captures (`captures`) when a single `match` produces multiple token types.
- After adding a grammar rule, add at least one test assertion in `test/highlight.test.evs`.

### Test assertion format

```
some_token_here
// <- scope.name.evs         ← tests col 0 (the leftmost char)
//  ^^^^^scope.name.evs      ← tests cols 2..7 (caret range, from/to are absolute in line)
```

`from = commentLength + startIdx`, `to = commentLength + lastCaretIdx + 1`.
Token overlap check: `from < t.endIndex && to > t.startIndex`.
Do **not** let carets extend past the last character of the target token.

---

## 5. Commit Message Format

```
<type>: <short description>

- <bullet: what changed and why>
- <bullet: what changed and why>
```

Types: `feat` (new token/feature), `fix` (bug), `test` (test-only), `docs` (docs-only), `chore` (version bump, sync).

---

## 6. Colour Theme

Colours follow the P1–P9 priority system defined in `docs/vscode-highlighter-spec.md §Color Priority Tiers`.
When reassigning a scope to a different priority, update both the theme JSON and the spec table.

---

## 7. Version Installed Path

The install rsync target must match the version in `package.json`:
- `~/.vscode/extensions/everscript-0.1.x/` while on 0.1.x
- Rename the target folder if major/minor changes.

After rsync, tell the user to reload VS Code (`Developer: Reload Window`) for changes to take effect.

---

## 8. npm Path

npm is at `/opt/homebrew/bin/npm` — not in the default PATH.
Always use the full path: `/opt/homebrew/bin/npm test`, `/opt/homebrew/bin/npm install`.
