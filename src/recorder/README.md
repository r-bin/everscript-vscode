# recorder/ — SNES CDL Recorder

The second VS Code extension built from this repository: an emulator for recording, not for
editing. Its user-facing README is `recorder/README.md`, its manifest `recorder/package.json`.

| | |
|---|---|
| Entry | `extension.js`: configures the emulator panel (`../emulator/panel.ts`) with `profile: 'recorder'` and registers four commands |
| Commands | `cdlRecorder.openEmulator`, `cdlRecorder.openRom`, `cdlRecorder.exportBundle`, `cdlRecorder.openDataFolder` |
| What the panel shows | CDL in the left side bar (movable from its pause-menu tab); CDL tab: record, flush, export bundle (no Asar / WRAM export, no lookup); REPLAYS in the pause menu; pause menu as in Everscript |
| Defaults | CDL recording on (remembered after the first switch), replays recorded every session, the last ROM reopens |
| Storage | its own `globalStorage`: `cdl-library/<sha1>/`, `tas-recordings/`, settings in `globalState` |
| Sharing | `exportBundle` zips one ROM's library and its replays (`../emulator/cdl/bundle.js`); Everscript's `Import Recording Bundle` merges it |

Build: `npm run build:recorder` (then `code --install-extension out/snes-cdl-recorder-<version>.vsix --force`) copies only the files
`tools/recorder/package-files.js` lists (the `require()` closure of this entry and of
`tools/cdl/replay.js`, plus the cores, their `copyright` files and the webview files) into
`out/recorder-stage/` and packages `out/snes-cdl-recorder-<version>.vsix`. It has the main
extension's version.

Which features show for which ROM: `../emulator/README.md` (Profiles and games).
