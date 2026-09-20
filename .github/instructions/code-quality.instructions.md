---
name: code-quality
description: Use when adding new modules under everscript-vscode's src/, migrating a file from JS to TS, or deciding whether to delete something. Covers TypeScript migration policy and dead code policy.
applyTo: "src/**/*.js,src/**/*.ts"
---

# Skill: Code Quality (TypeScript Migration & Dead Code)

Use this skill when adding new modules under `src/`, migrating a file from JS to TS, or
deciding whether to delete something.

## Before writing a new decoder/parser: check for an authoritative implementation first

Before extending ROM-format decoding logic (`src/maps/`) or the `.evs` language-data
generator (`tools/generate_data.py`), check whether the sibling `everscript` repo
already implements it correctly — it usually does. See the `map-format` skill. This
repo has twice shipped a second, weaker, independently-maintained guess at something
`everscript`'s compiler or map tools already solved byte-exact; don't make it a third
time. This applies beyond those two files: if a task looks like "parse/decode some
Everscript or SNES-ROM format," check `everscript`'s `compiler/` and `tools/` (and its
own `.github/skills/`) before writing a new implementation in this repo.

## TypeScript migration policy

TypeScript is preferred for new code in: parsers, state containers, IPC definitions,
ROM models, pure transforms. JavaScript remains acceptable for: unstable orchestration,
rendering, experimental code.

- Migrate incrementally — one file at a time, by domain. Do NOT mass-convert JS files.
- Good TS candidates: `src/shared/radar-utils.js`, `src/shared/config.js`, parser output
  types.
- Use `allowJs: true` + `checkJs: false` (current `tsconfig.json`) to avoid disruption.
- When migrating a file: rename `.js` → `.ts`, add local interfaces only, avoid
  generics.
- Never create a giant shared types file.
- `tsconfig.json` excludes browser-concatenated webview assets
  (`src/**/webview/**`, check the current exclude list before assuming a path).

## Dead code policy

Dead code is entropy. Remove it aggressively.

- Run `npm run check:dead` (knip) before commits.
- Webview asset files are excluded from knip (loaded via `fs.readFileSync`, not
  `require`) — see `knip.json` for the current ignore list.
- When splitting a file, delete the original — do not keep dead shims.
- If a file has no `require()` references and no manifest entry, delete it.

See the `release-ritual` skill for the full pre-commit validation command list.
