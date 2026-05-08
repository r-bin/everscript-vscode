# Everscript VS Code Extension

Syntax highlighting for `.evs` (Everscript) files — the scripting language for Secret of Evermore ROM hacking.

## Features

- Full syntax highlighting for all language constructs
- Distinct colouring for:
  - Memory addresses `<0x1234>`, `<0x1234, 0x40>`, ranges `<0x1234>..<0x5fff>`
  - Hex literals `0xFF` and decimal literals `0d99` — both highlighted identically
  - Enum member access `FLAG.DOG_UNAVAILABLE`
  - Annotations `@install()`, `@inject(...)`
  - Preprocessor `#memory(...)`, `#include(...)`, `#patch(...)`
  - Built-in compiler functions vs core library functions vs user-defined calls
  - Special identifiers: `BOY`, `DOG`, `BOTH`, `NORTH`, `LAST_ENTITY`, etc.
- Bracket matching and auto-close
- Comment toggle (`//`)
- Bundled **Everscript Dark** colour theme

## Installation

Until published to the Marketplace, install via VSIX:

```sh
vsce package
code --install-extension everscript-0.1.0.vsix
```

Or open the repo in VS Code and press **F5** to launch the Extension Development Host.

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
