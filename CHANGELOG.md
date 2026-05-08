# Changelog

## [0.1.2] — 2026-05-08

### Added
- **Hover documentation** — hover over any function name to see its full signature
  and whether it is a native (compiler built-in) or core library function.
  Hover over an enum name to see all its members with values and comments.
  Hover over `ENUM.MEMBER` to see the specific member value.
  Hover over special identifiers (`BOY`, `LAST_ENTITY`, `NORTH`, `True`, …)
  to see a plain-English description.
- **Enum member completion** — typing `DIRECTION.` or any `ENUM.` triggers a
  completion list of all members with values. Typing `@` suggests annotation names.
- **Document symbols (Outline panel)** — `fun`, `map`, `area`, `group`, `enum`,
  and `val` declarations appear in the Outline panel and breadcrumbs.
- **Snippets** — `fun`, `map`, `area`, `group`, `enum`, `if`, `if!`, `ife`,
  `while`, `while!`, `for`, `val`, `var`, `#memory`, `#include`, `@install`,
  `@inject`, `@async`, `transition`, `sleep`, `conversation`, `add_enemy`.
- **Problem matcher** (`everscript`) — register in a `.vscode/tasks.json` task to
  get compiler errors in the Problems panel with clickable file/line links.
- **Task definition** (`everscript`) — task type for future build task support.
- `data/index.json` — 521 function signatures and 111 enum definitions extracted
  from the core library (regenerate with `python3 tools/generate_data.py`).
- `tools/generate_data.py` — data extraction script for dev use.

---

## [0.1.1] — 2026-05-08

### Added
- `.github/copilot-instructions.md` — global agent rules for the plugin repo
  (version bump ritual, file map, test format reference, colour theme policy)
- `docs/future-features.md` — full roadmap: hover docs, auto-completion, diagnostics,
  go-to-definition, signature help, LSP server plan, priority stack

---

## [0.1.0] — 2026-05-08

### Added
- Initial release
- TextMate grammar for `.evs` files (`source.evs`)
- Language configuration (bracket matching, comment toggle, word pattern)
- Bundled Everscript Dark colour theme
- Highlights: keywords, declarations, types, booleans, numbers (hex + 0d-decimal),
  memory addresses, memory ranges, enum access, annotations, preprocessor directives,
  built-in functions, core library functions, user function calls, special identifiers,
  label destinations, operators, strings with in-string placeholders
