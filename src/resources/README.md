# resources/ — the `soe://` file system

A read-only `vscode.FileSystemProvider` for the `soe` scheme: the cartridge and
the running game's memory as files. One address works in an editor tab
(`vscode.open`), a webview (`<img src="soe://…">` after rewriting) and a link.
Spec: `docs/soe-filesystem-spec.md`.

```
soe://rom/assets/ingredients/wax/icon.png              the cartridge (ROM)
soe://rom/assets/ingredients/wax/icon.png?rom=vanilla  …from the configured ROM file
soe://ram/0adb.json                                    the emulator's WRAM, live
soe://bus/7e0adb                                       24-bit bus address → links to the above
```

The authority names the memory, the path names what is read, `?rom=` names
where it is read from (`vanilla` = `everscript.romPath`, `emulator` = the ROM
running in the emulator; default: the emulator's when one runs, else vanilla).

## Files

| File | Owns |
|---|---|
| `index.js` | `registerSoeResources(context, deps)`: the provider and the two commands |
| `fs-provider.js` | `SoeFileSystem`: routing, ROM choice, caching, live-file watch, errors |
| `nodes.js` | the `dir` / `file` / `link` shapes handlers return |
| `autoindex.js` | the `index.md` of a directory without its own: links + image gallery |
| `bus-files.js` | `soe://bus/`: maps a bus address to its `ram/` or `rom/` file (no data of its own) |
| `rom-files.js` | `soe://rom/`: `rom.sfc`, `header.json`, offset slices, `<offset>.json` |
| `rom-assets.js` | `soe://rom/assets/`: icons, items by name, alchemy, strings, maps |
| `ram-files.js` | `soe://ram/`: `status.json`, `wram.bin`, slices, `<addr>.json`, flags, symbols |
| `webview.js` | `soeResourceRoots`, `rewriteSoeUrls`, `soeClientScript` for any webview |
| `check-panel.js` | `Everscript: Check soe:// Resources`, the feature's acceptance check |

The address grammar (`parseSoeParts`, `parseAddressName`) is pure and lives in
`src/shared/resource-uri.js`.

## Using `soe://` in a webview

1. Add `...soeResourceRoots()` to the panel's `localResourceRoots`.
2. Allow `img-src ${webview.cspSource}` (and `connect-src` for `fetch`).
3. Pass the HTML through `rewriteSoeUrls(html, webview)`.
4. For elements a script adds later, include `soeClientScript(webview)` in the page.
   It rewrites `src`/`href` and exposes `window.soeUrl()`.

## Dependency rules

- May use `shared/`, `maps/`, `script/`, `localizations/`.
- Never `emulator/`: the emulator's ROM and memory reads are injected by
  `extension.js` (`emulatorRom`, `readMemory`), as `rom/` gets the CDL library.
  `.depcruise.js` rule `no-resources-to-emulator`.

## Invariants

- Read-only: every write operation throws `NoPermissions`.
- `rom/` files are pure functions of the ROM bytes, cached per ROM buffer.
- `ram/` files are `live`: cached 250 ms, re-announced every second while
  watched and an emulator is open, `Unavailable` without a running game.
- Ids in paths are hex without `$`; item names are aliases of their hex reward id.
- Every directory lists an `index.md`: the handler's own (`dir(entries, index)`) or autoindex.js.
- A file stored once and reachable elsewhere is a link: `ingredients/wax/icon.png` → `icons/<id>.png`,
  every `soe://bus/…` → its `ram/` or `rom/` file. Links stat as `File | SymbolicLink`.
