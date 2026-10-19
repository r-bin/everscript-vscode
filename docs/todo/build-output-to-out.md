# Move the TypeScript build output from `dist/` to `out/dist/`

Open since 2026-10-19; deferred by the owner ("leave it for now"). Purely tidiness: one generated folder less in the
repo root. Name not final (`out/dist/` proposed; `out/build/` also possible).

## Why `out/dist/` and not `out/`
`out/` already holds the `.vsix` files and the user's built ROMs (`out/rom.sfc`, `out/recomp/`, `out/exhirom/`,
`out/table-hack/`). `npm run build:ts` empties its output folder before every build, so pointing it at `out/` would
delete them. `out/` is already gitignored, so the `dist/` line in `.gitignore` goes.

## What has to change (measured 2026-10-19: ~147 files name `dist/`)
- `tsconfig.build.json` `outDir`; `package.json` `build:ts` (the `rmSync('dist')`); `tools/bundle-pages.mts` (`dist/webview/`).
- Configs: `knip.json`, `.madgerc`, `.jscpd.json`, `.depcruise.js`, `.gitignore`.
- `src/platform/source-dir.ts` finds a module's source folder by swapping the path segment `dist` for `src`. Under
  `out/dist/` that gives `out/src/…`. Rewrite it to map from the repo root (it also runs inside the host bundle, where
  each module's `__dirname` is its `dist/` folder, `tools/bundle.mts`); test the packaged `.vsix`, not only the tests.
- Hard-coded relative paths: `src/core/webview/page-bundle.ts`, `src/games/evermore/emulator/host.ts`
  (`webviewFiles()`), `tools/recomp/names.js`, and the tests that `require('../../dist/…')` (65 files) and the tools (29).
- Do **not** touch `build-and-run.ts`: its `'dist'` is the everscript compiler's own `dist/`.
- Docs and skills that name `dist/` (`architecture` skill, `AI_ARCHITECTURE_GUIDE.md`, `docs/todo/port-to-ts.md`, READMEs).

## How
One session, one commit, a mechanical rename with `git grep -l "dist/"` as the worklist. Other agents work in this tree:
stage only the files you changed and say that a rebuild mid-run makes their tests fail until it finishes. Done when:
`npm run test:all`, `npm run typecheck`, the checks of the release ritual and `npm run deploy` (then a smoke test of the
installed extension) pass, and `git grep -n "dist/"` finds only the compiler's.
