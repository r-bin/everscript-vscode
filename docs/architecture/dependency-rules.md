# Dependency Rules — Everscript VS Code Extension

> Rules for dependency-cruiser enforcement.
> Each rule includes motivation, benefit, and enforcement timeline.
>
> Current enforcement: all rules are `warn` (informational).
> Move to `error` after the relevant migration phase completes.
>
> See `.depcruise.js` for the machine-readable configuration.

---

## 1. Enforcement Levels

| Level | Meaning | Current use |
|---|---|---|
| `error` | Blocks commit / CI | Not yet used |
| `warn` | Visible in report, does not block | All current rules |
| `info` | Visible in graph, ignored in CI | Structural notes |

All rules start at `warn`. Graduate to `error` only after the migration phase that
establishes the domain boundary is complete and verified.

---

## 2. Core Isolation Rules

### Rule: `no-script-to-extension`

```
FROM: script_parser/
TO:   !(script_parser/)
```

**Motivation:** `script_parser/` is a completely isolated domain. It has its own
`package.json` and must never import from the VS Code extension tree. If this rule
triggers, a parser file has accidentally created a coupling back to the extension.

**Benefit:** Ensures the parser can be developed, tested, and eventually published
as a standalone npm package without touching the extension.

**Enforcement:** `error` immediately. This boundary was intentional from day one
and is already respected.

---

### Rule: `no-extension-to-script-internals`

```
FROM: extension.js | code_highlighter/ | memory_radar/ | debugger/
TO:   script_parser/src/ | script_parser/model/
```

**Motivation:** The extension must not depend on parser internals. If shared types
are needed, they should be extracted to `shared/` or a published interface.

**Benefit:** Preserves the parser's independence. Extension may use parser output
formats (JSON) but never imports parser TypeScript directly.

**Enforcement:** `warn` now → `error` after Phase 1.

---

### Rule: `no-language-to-debugger`

```
FROM: code_highlighter/ (→ language/)
TO:   debugger/
```

**Motivation:** Language features (hover, completions, grammar) must work even when
the debugger is not active or not installed. Mixing them creates fragile startup dependencies.

**Benefit:** Language providers remain lightweight and activate instantly.

**Enforcement:** `warn` now → `error` after Phase 2.

---

### Rule: `no-language-to-emulator`

```
FROM: code_highlighter/ (→ language/)
TO:   debugger/emulator/
```

**Motivation:** Same as above. The emulator is an optional heavy feature.

**Enforcement:** `warn` now → `error` after Phase 7.

---

### Rule: `no-language-to-radar-ui`

```
FROM: code_highlighter/ (→ language/)
TO:   memory_radar/webview/ | memory_radar/render-
```

**Motivation:** Language providers may use `radar-utils.js` for hex address lookup
(hex literal hover). That is acceptable via `shared/`. They must never import radar
rendering or webview assembly.

**Benefit:** Language providers stay under 5ms activation time.

**Enforcement:** `warn` now → `error` after Phase 2.

---

### Rule: `no-debugger-to-radar`

```
FROM: debugger/adapter.js | debugger/mock-runtime.js
TO:   memory_radar/
```

**Motivation:** The DAP adapter and mock runtime are pure protocol/logic. They must
not trigger radar rendering. Cross-domain communication (emulator → radar focus sync)
routes through `extension.js` only.

**Benefit:** DAP layer remains testable without a VS Code window.

**Enforcement:** `warn` now → `error` after Phase 7.

---

### Rule: `no-radar-to-debugger`

```
FROM: memory_radar/
TO:   debugger/adapter.js | debugger/mock-runtime.js
```

**Motivation:** The radar panel has no reason to call DAP adapter functions directly.

**Benefit:** Radar panel remains usable without an active debug session.

**Enforcement:** `warn` now → `error` after Phase 3.

---

### Rule: `no-sibling-tabs`

```
FROM: memory_radar/tabs/scaling/ | memory/
TO:   memory_radar/tabs/map_browser/ | rooms/
AND vice versa
```

**Motivation:** Each radar tab is an independent feature. Cross-tab coupling makes
it impossible to load one tab without loading all tabs.

**Benefit:** Tab isolation allows future extraction of individual tabs as separate
commands or panels.

**Enforcement:** `warn` now → `error` after Phases 3–6.

---

## 3. Shared Infrastructure Rules

### Rule: `no-shared-to-vscode`

```
FROM: settings-model.js | memory_radar/radar-utils.js | memory_radar/rom-readers.js
      (→ shared/ after Phase 1)
TO:   vscode
```

**Motivation:** Shared utilities must be importable in any Node.js environment,
including test runners that do not have a VS Code host. If they import `vscode`,
they break offline tests.

**Benefit:** All pure utilities remain testable with plain `node test.js`.

**Enforcement:** `warn` now → `error` after Phase 1.

---

### Rule: `no-shared-internal-coupling`

```
FROM: settings-model.js
TO:   memory_radar/radar-utils.js | memory_radar/rom-readers.js
```

**Motivation:** Shared files must not depend on each other (that would make them
un-shareable and create load-order issues).

**Enforcement:** `warn` now → `error` after Phase 1.

---

## 4. Webview Asset Rules

### Rule: `no-webview-to-server`

```
FROM: memory_radar/webview/assets/**
TO:   extension.js | memory_radar/render- | memory_radar/radar-utils
```

**Motivation:** Webview JS files are concatenated into a bundle that runs in a
sandboxed browser context. They cannot `require()` server-side Node.js modules.
This rule catches accidental server imports in client-side files.

**Benefit:** Prevents runtime errors in webview (missing `require` global).

**Enforcement:** `warn` now → `error` after Phase 0.

---

### Rule: `no-cross-domain-webview`

```
FROM: memory_radar/webview/assets/rooms/
TO:   memory_radar/webview/assets/scaling/
AND vice versa
```

**Motivation:** Each tab's client-side bundle is self-contained. Tabs must not
share implementation code through direct file imports (they may share CSS via the
compiled bundle order).

**Enforcement:** `warn` now → `error` after Phase 6.

---

## 5. Structural Rules

### Rule: `no-extension-logic`

```
FROM: extension.js
TO: (detect large code blocks — not expressible as dep rule)
```

**Note:** Dependency-cruiser cannot enforce LOC limits. This is enforced by:
- AI_ARCHITECTURE_GUIDE.md §2.1 (file size law)
- Pre-commit review
- Anti-entropy checklist

---

### Rule: `no-circular`

```
All circular dependencies are errors.
```

**Motivation:** Circular deps cause unpredictable initialization order in Node.js
CommonJS modules.

**Benefit:** Prevents a class of subtle startup bugs.

**Tool:** `madge --circular` (already in `npm run check:circular`).

**Enforcement:** `error` immediately. Already enforced.

---

## 6. Current Known Violations

These are violations of the desired architecture that exist today.
They are tracked here so migration phases can resolve them.

| Rule | From | To | Status |
|---|---|---|---|
| no-language-to-radar-ui | `code_highlighter/hover-provider.js` | `memory_radar/radar-utils.js` | Acceptable transitionally — radar-utils will move to shared/ in Phase 1 |
| no-debugger-to-radar | `debugger/emulator/panel.js` | IPC only through extension.js | Actually compliant — IPC goes through extension.js already |
| no-sibling-tabs | `memory_radar/render-radar.js` | assembles all tabs | Expected — render-radar.js is the panel assembler, not a tab |
| no-extension-to-script-internals | None found | — | Compliant |
| no-script-to-extension | None found | — | Compliant |
| no-shared-to-vscode | `settings-model.js` reads config _shape_ but doesn't import `vscode` | — | Compliant |
| no-webview-to-server | webview assets use no `require()` | — | Compliant |

---

## 7. Graduation Checklist

Each rule graduates from `warn` → `error` when:

1. The migration phase creating the domain boundary is complete.
2. `npm run check:deps` runs clean at `warn` level for that rule.
3. No legitimate cross-domain imports remain for that rule.
4. The rule is documented in `.depcruise.js` with a `comment` field.

Rules should never be suppressed with `allow` unless there is a documented,
reviewed exception with an expiry comment.
