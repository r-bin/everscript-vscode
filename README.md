# Everscript VS Code Extension

Full language tooling for `.evs` (Everscript) files — the scripting language for Secret of Evermore ROM hacking.

## Features

### Syntax Highlighting

Token categories, each with a distinct colour in the bundled **Everscript Dark** theme:

| Token | Example |
|-------|---------|
| Memory addresses | `<0x1234>`, `<0x1234, 0x40>`, `<0x7e0020>..<0x7e00ff>` |
| Memory accessors | `object[id]`, `arg[0]`, `script[n]` |
| Numeric literals | `0xFF`, `0d99`, `0b1010` |
| Enum member access | `DIRECTION.SOUTH`, `FLAG.DOG_UNAVAILABLE` |
| Annotations | `@install()`, `@inject(...)`, `@async` |
| Preprocessor | `#memory(...)`, `#include(...)`, `#patch(...)` |
| Built-in functions | compiler-native calls |
| Core library functions | functions from `core/` |
| User-defined calls | functions you define in your project |
| Special identifiers | `BOY`, `DOG`, `NORTH`, `LAST_ENTITY`, `True`, etc. |
| Strings, comments, keywords | |

### Hover Documentation

Hover over any identifier to see its documentation inline:

- **Functions** — full signature(s), native vs core library label
- **Enum names** — all members with values and comments (up to 30 shown)
- **Qualified members** — `DIRECTION.SOUTH` → value + comment
- **Unqualified members** — bare `SOUTH`, `ACT4_DOOR_OPENING` etc. → parent enum + value; full enum shown when unambiguous
- **Special identifiers** — `BOY`, `LAST_ENTITY`, `True` etc. → description
- **Number literals** — `0xFF` → hex + decimal + binary + byte size

### Completions

- **`ENUM.`** — member list with values after typing a dot on an enum name
- **`@`** — annotation names (insert as snippets)
- **Function names** — all 521 core + native functions, each as a tab-stop snippet
- **Workspace functions** — user-defined `fun` declarations across all `.evs` files
- **Enum names** — 111 enum names for bare-identifier completion

### Dead Branch Dimming

Unreachable code blocks are rendered at reduced opacity automatically:

- `if(False)` / `if(0)` — then-block is always skipped
- `if!(True)` / `if!(1)` — then-block is always skipped  
- `if(ENUM.MEMBER)` / `if!(ENUM.MEMBER)` — statically evaluated from the index

### Navigation

- **Go to Definition** (`F12` / cmd+click) — jumps to the declaration of any function, map, area, group, enum, or val. Also resolves `#include("path")` → opens the file.
- **Find All References** (`Shift+F12`) — locates every occurrence of an identifier across all `.evs` files in the workspace.
- **Outline / Breadcrumbs** — Document Symbol provider populates the Outline panel and breadcrumb bar with all `fun`, `map`, `area`, `group`, `enum`, and `val` declarations.

### Snippets

22 built-in snippets (trigger via IntelliSense or the Insert Snippet command):

`fun`, `map`, `area`, `group`, `enum`, `val`, `var`, `if`, `if!`, `ife`, `while`, `while!`, `for`, `#memory`, `#include`, `@install`, `@inject`, `@async`, `transition`, `sleep`, `conversation`, `add_enemy`

### Problem Matcher

The `$everscript` problem matcher parses compiler error output for the Tasks panel.

## Installation

Until published to the Marketplace, install via rsync into the VS Code extensions folder:

```sh
rsync -a --delete --exclude='.git' /path/to/everscript-vscode/ ~/.vscode/extensions/everscript-0.1.4/
```

Then reload VS Code.

Or launch the Extension Development Host from the repo with **F5**.

## Customisation

Override any colour in your `settings.json`:

```jsonc
"editor.tokenColorCustomizations": {
  "textMateRules": [
    {
      "scope": "variable.other.address.evs",
      "settings": { "foreground": "#ff9900" }
    }
  ]
}
```

Key scopes:

| Scope | What it covers |
|-------|----------------|
| `variable.other.address.evs` | `<0x1234>` address values |
| `variable.other.accessor.evs` | `object`, `arg`, `script`, `time` (before `[`) |
| `constant.numeric.hex.evs` | `0xFF` hex literals |
| `constant.numeric.decimal.evs` | `0d99` decimal literals |
| `entity.name.enum.evs` | Namespace in `ENUM.MEMBER` |
| `variable.other.enummember.evs` | Member in `ENUM.MEMBER` |
| `support.function.builtin.evs` | Compiler-native functions |
| `support.function.evs` | Core library functions |
| `entity.name.function.call.evs` | User-defined function calls |
| `variable.language.evs` | `BOY`, `DOG`, `NORTH`, etc. |
| `entity.name.function.decorator.evs` | `@install`, `@inject`, etc. |
| `keyword.preprocessor.evs` | `#memory`, `#include`, `#patch` |
| `variable.other.entity-ref.evs` | Identifier inside `<NAME>` entity refs |

## Development Notes

See [`docs/vscode-highlighter-spec.md`](../everscript/docs/vscode-highlighter-spec.md) in the main repo for the full design spec.

## Customisation

Override any colour in your `settings.json`:

```jsonc
"editor.tokenColorCustomizations": {
  "textMateRules": [
    {
      "scope": "variable.other.address.evs",
      "settings": { "foreground": "#ff9900" }
    },
    {
      "scope": "constant.numeric.evs",
      "settings": { "foreground": "#b5cea8" }
    }
  ]
}
```

Key scopes:

| Scope | What it covers |
|-------|----------------|
| `variable.other.address.evs` | `<0x1234>` address values |
| `constant.numeric.hex.evs` | `0xFF` hex literals |
| `constant.numeric.decimal.evs` | `0d99` decimal literals |
| `entity.name.enum.evs` | Namespace in `ENUM.MEMBER` |
| `variable.other.enummember.evs` | Member in `ENUM.MEMBER` |
| `support.function.builtin.evs` | Compiler-native functions |
| `support.function.evs` | Core library functions |
| `entity.name.function.call.evs` | User-defined function calls |
| `variable.language.evs` | `BOY`, `DOG`, `NORTH`, etc. |
| `entity.name.function.decorator.evs` | `@install`, `@inject`, etc. |
| `keyword.preprocessor.evs` | `#memory`, `#include`, `#patch` |

## Development Notes

See [`docs/vscode-highlighter-spec.md`](../everscript/docs/vscode-highlighter-spec.md) in the main repo for the full design spec.
