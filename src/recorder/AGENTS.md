# src/recorder — agent rules

Kind: **composition root** of the second extension (`/AI_ARCHITECTURE_GUIDE.md` §2), like `src/extension.js`. What the folder does: [README.md](README.md).
Related skills: `emulator-subsystem`, `cdl-recorder`, `release-ritual`.

## Owns
- `extension.js`: the SNES CDL Recorder's `activate()`; `recorder/package.json` and
  `recorder/README.md` (at the repo root) are its manifest and store page.

## Dependencies
- Only `../emulator/` (`.depcruise.js`: `recorder-is-the-emulator`); nothing imports this folder
  (`nothing-imports-the-recorder`).
- Every file it reaches ships in its `.vsix` (`tools/recorder/package-files.js`). Do not give the
  emulator panel a top-level `require` of an editor or debugger domain: pass such things in from
  `src/extension.js` through `configureEmulator` (as `cdlTools` is).

## Invariants
- A command in `recorder/package.json` is registered here and listed in its `activationEvents`
  (tested). Command ids are `cdlRecorder.*`, never `everscript.*`, so both extensions install side by side.
- A file the panel loads by path (not by `require`) goes into `ASSETS` in `package-files.js`,
  or the recorder ships without it. The core `copyright` files must stay listed (Snes9x licence).
- No ROM bytes in a bundle; no game data in the package.

## Tests
- `tests/debugger/recorder.test.js`: file list complete (every staged file loads from a copy of
  only those files, commands match the manifest), bundles, the webview by profile and ROM.
