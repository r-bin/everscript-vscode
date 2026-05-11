# Plugin Release Checklist

> **Status:** Pre-release draft. The plugin is not being released yet and copyright material does not need to be removed right now. This document tracks what must change before any public release.

---

## 1. Copyright Material — Must Remove Before Release

| Item | Location | Importance | Alternative |
|------|----------|------------|-------------|
| `Secret of Evermore (U) [!].smc` | workspace root (hardcoded default ROM path) | 🔴 CRITICAL — cannot ship a copyrighted ROM | User provides their own ROM via `everscript.romPath` setting |
| Hardcoded ROM path fallback `"Secret of Evermore (U) [!].smc"` | `extension.js` (`readRomCharacters`, `readRomTriggerOffsets`, etc.) | 🔴 CRITICAL | Read from `everscript.romPath` setting with a clear "ROM not found" message |
| Ingredient images (`/Users/v/Documents/assets/ingredients/*.webp`) | Local assets path baked into extension code | 🔴 CRITICAL if sprites are ripped from ROM; 🟡 MEDIUM if they are original art | Bundle original art in the extension, OR strip ingredient images entirely (fall back to labels/emoji), OR provide a downloadable asset pack |
| Room images (`docs/rooms/images/*.png`) | `wsRoot/docs/rooms/images/` | 🟡 MEDIUM — these are screenshots/renders from the game | Replace with original art or procedurally-generated minimaps, OR gate behind user-supplied ROM |
| Memory map data (`.github/memory-map.md`) | Workspace (not extension) | 🟢 LOW — it is documentation, not game assets | Keep as-is; it is community research, not copyrighted game data |
| Script dump (`SoETilesViewer/SoEScriptDumper/script_all`) | Sibling repo (not bundled in extension) | 🟢 LOW — not bundled | Remove path references from copilot-instructions if repo is open-sourced |

---

## 2. User-Configurable Settings (needed for release)

The extension currently assumes a specific workspace layout and local asset paths. All of these must become user-configurable settings before a public release.

| Setting | Key | Default (dev) | Notes |
|---------|-----|--------------|-------|
| `in/` directory | `everscript.inDirectory` | `<workspace>/in` | Required for static code analysis (scope detection, room tree, imports) |
| `patches/` directory | `everscript.patchesDirectory` | `<workspace>/patches` | Required for `detectScaleEnemies` and patch resolution |
| ROM path | `everscript.romPath` | `<workspace>/Secret of Evermore (U) [!].smc` | Required for character data (Scaling tab) and trigger offset reads |
| Assets directory | `everscript.assetsPath` | `<hardcoded local path>` | Contains ingredient images. Should ship bundled in the extension instead |
| `scale_enemies` patch detection | (derived from in/patches dirs above) | — | Re-evaluated per-document already |

---

## 3. What Else to Remove / Change

| Item | Importance | Notes |
|------|------------|-------|
| Hardcoded local paths (`/Users/v/Documents/…`) | 🔴 CRITICAL | Replace with settings or extension-bundled paths |
| `console.log` / debug output in extension host | 🟡 MEDIUM | Strip or gate behind a debug flag |
| Test fixture files that contain ROM-derived values | 🟡 MEDIUM | Verify test fixtures contain no ROM data; replace with synthetic test data if needed |
| `.github/copilot-instructions.md` (agent rules, path to sibling repo) | 🟡 MEDIUM | Remove or sanitize before public release |
| `dev_notes.md`, `todo.md` (internal notes) | 🟢 LOW | Remove or archive |
| Dependency on `SoETilesViewer` sibling repo (C++ tool) | 🟢 LOW | Extension does not bundle it, but scripts reference its path |

---

## 4. What to Bundle in the Extension

| Asset | Format | Notes |
|-------|--------|-------|
| Ingredient images (if original art) | `.webp`, bundled under `assets/ingredients/` | Contributor needs to confirm art is original or properly licensed |
| Memory-map schema (`.github/memory-map.md`) | Static copy embedded as JSON | Export once per ROM version; community can contribute |
| Vanilla room list (room IDs + names) | Static JS constant | Already embedded in extension; source is `SoETilesViewer/SoEScriptDumper/data.h` (MIT-licensed C++ tool, not the ROM itself) |
| Core enum definitions (`in/core/`) | `.evs` files bundled with extension | User's workspace may override; extension falls back to bundled copy |

---

## 5. Settings Graceful Degradation

When a setting is not configured, the extension should degrade gracefully:

- **ROM not found:** Scaling tab shows "ROM not found — place the .smc in workspace root or configure `everscript.romPath`". All other tabs still work.
- **`in/` not found:** Scope detection, room tree, and radar still work for the currently open file. Import resolution and `#include` tracing will be limited.
- **Assets not found:** Ingredient icons fall back to text labels in SVG. The filter button is hidden.
- **Vanilla mode with no images:** Show room list as plain text; no map overlay.

---

## 6. Asset Pack (Optional)

If ingredient images and/or room maps cannot be bundled in the extension:

- Provide a separate optional downloadable zip (`everscript-assets-<version>.zip`)
- The user configures `everscript.assetsPath` to point to the unzipped folder
- Document this in the README

---

## 7. Release Steps (checklist)

- [ ] All hardcoded local paths replaced with settings + defaults
- [ ] ROM file confirmed absent from repo and `.vscodeignore`
- [ ] Ingredient images confirmed: original art or properly licensed
- [ ] Room images confirmed: original art or removed
- [ ] Test suite passes with no ROM present (mock ROM data or skip ROM-dependent tests)
- [ ] `.github/copilot-instructions.md` sanitized for public view
- [ ] `dev_notes.md`, `todo.md` archived or removed
- [ ] `CHANGELOG.md` and `README.md` updated
- [ ] Version bumped in `package.json`
- [ ] `vsce package` produces a clean `.vsix` with no copyrighted assets
- [ ] Manual smoke-test: fresh install, no ROM, configure ROM path, verify all tabs
