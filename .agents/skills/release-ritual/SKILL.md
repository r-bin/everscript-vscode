---
name: release-ritual
description: Use at the end of every session that changed a project file: version bump, tests and checks, commit format, npm run deploy. Doc-only changes: just commit.
applyTo: "**"
---

# Skill: Release Ritual

Use this skill at the end of any session that changed a project file (code, config, or
non-doc content). If only documentation changed and no code changed, you may skip this
and just commit.

Exception: while operating in the **Mechanics Modeler** workflow, do not perform this
ritual by default — focus on evidence, model code, and tests. Only run it when the user
explicitly asks for release/commit/install, or when handing off to the Plugin Builder
workflow.

---

## The four mandatory steps

1. **Bump the version** in `package.json` — patch for fixes/docs/corrections, minor for
   new features, major for breaking changes.
2. **Validate**:
   ```
   npm test                            # grammar + unit tier (seconds; no ROM, browser or cores)
   npm run test:all                    # every tier (tests/tiers.json): + rom, dom, emulator; builds cores
                                       # touched code with a ROM / page / core behind it: at least its tier
   npm run typecheck                   # tsc --noEmit
   npm run check:circular              # madge circular dependency scan (src/)
   npm run check:dead                  # knip unused files/exports scan
   npm run check:deps                  # depcruise domain boundary rules (warn level)
   npm run check:legal -- --staged     # no game data, upstream code or home paths staged
   npm run check:dup                   # no clone of 30+ lines (jscpd)
   npm run check:knowledge             # no new WRAM/ROM address in code without a knowledge entry (Terranigma code: named in docs/terra/)
   npm run check:ai-context            # AI files within budget, their links resolve
   ```
   All of these must pass before proceeding (`check:deps` warnings are reported, errors fail).
   The legal, knowledge and AI-context checks keep a baseline / allow list of known findings in
   `tools/`; it only shrinks — never add to it to make a check pass. Fix failures before continuing.
   `check:knowledge` scans `git ls-files` only: `git add` new files before running it, or their
   addresses are not counted (a moved file then looks like fewer addresses, not a pass).
3. **Commit** to `develop` with the message format below.
4. **Push** branch commits to remote:
   ```
   git push origin develop
   ```
5. **Install** the extension for local use:
   ```
   npm run deploy
   ```
   This builds the host bundle (`tools/bundle.mts` → `bundle/extension.js`, the `main`; F5 runs the
   "Build Bundle" task first), packages a `.vsix` via `vsce` (`--ignoreFile bundle/.vscodeignore`: the JS
   the bundle holds stays out; `package-files.test.js` guards the files read from disk) and installs it with
   `code --install-extension --force`, then verifies `rbin.everscript` shows up in
   `code --list-extensions`. Reload VS Code afterwards (`Developer: Reload Window`).

   **Do not use `rsync` to `~/.vscode/extensions/`.** That was the old ritual and it
   left 19 unregistered full-repo copies behind (~9GB) before being cleaned up in
   v0.7.0. It also masked a real bug: `.vscodeignore` excluded `src/**` while `main` was
   `./src/extension.js`, so the `.vsix` path was broken for a long time without anyone
   noticing, because the rsync copies were what actually ran.

   The deploy path installs to `~/.vscode/extensions/rbin.everscript-<version>/`, which
   VS Code registers in `extensions.json`. A folder named `everscript-<version>/`
   (no publisher prefix) is an rsync leftover — delete it.

One prompt = one commit. Do not batch unrelated changes.

---

## npm / vsce path

`npm` is at `/opt/homebrew/bin/npm` on this machine — not in the default PATH used by
some tool invocations. Use the full path when running `npm test` or `npm install`
outside an interactive shell: `/opt/homebrew/bin/npm test`.

---

## Commit message format

```
v<version>: [<affected screen or tab>] <short description>

- <bullet: what changed and why>
- <bullet: what changed and why>
```

Types: `feat` (new token/feature), `fix` (bug), `test` (test-only), `docs` (docs-only),
`chore` (version bump, sync).

---

## Anti-entropy checklist (run before every commit)

- [ ] No file exceeds 400 LOC without documented justification
- [ ] No logic or state added to `src/extension.js` or a game's `extension.js` (use the owning folder)
- [ ] No new cross-domain `require()` added without checking allowed direction (see
      `src/README.md`, the folder's `AGENTS.md` and `.depcruise.js`)
- [ ] Every new directory has a `README.md` or is trivially named
- [ ] `npm run typecheck`, `npm run check:circular` pass
- [ ] `npm run check:dead`, `npm run check:deps` reviewed (advisory/warn)
- [ ] Tests pass: `npm test`
- [ ] Version bumped in `package.json`
- [ ] Everything learned about the game this session is recorded (`game-knowledge` skill)
- [ ] Skills / `AGENTS.md` files that turned out wrong or incomplete are fixed
- [ ] Nothing legally risky staged: no ROM bytes, extracted assets, game text, or third-party code
      (`npm run check:legal -- --staged`; the tree baseline `tools/check-legal.baseline.json` only shrinks)

---

## External data handling

Traces, ROM dumps, and other large external evidence belong in the `traces/` directory
or another designated external-data folder — not committed to version control. Document
any required external data in the relevant feature dossier or README.
