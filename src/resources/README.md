# resources/ — the `soe://` file system

A read-only `vscode.FileSystemProvider` for the `soe` scheme: the cartridge and
the running game's memory as files. One address works in an editor tab
(`vscode.open`), a webview (`<img src="soe://…">` after rewriting) and a link.
Spec: `docs/soe-filesystem-spec.md`.

```
soe://rom/assets/ingredients/wax/icon.png              the cartridge (ROM)
soe://rom/assets/ingredients/wax/icon.png?rom=vanilla  …from the configured ROM file
soe://rom/~L3BhdGgvdG8vU29tZSBSb20uc21j/assets/…       …from that file: a mount (Open ROM as Folder)
soe://ram/0adb.json                                    the emulator's WRAM, live
soe://bus/7e0adb                                       24-bit bus address → links to the above
soe://tags/boy/hp.md                                   a concept: links to the above, live values
```

The authority names the memory, the path names what is read, `?rom=` names
where it is read from (`vanilla` = `everscript.romPath`, `emulator` = the ROM
running in the emulator, an absolute path = that file; default: the emulator's
when one runs, else vanilla).

**Open ROM as Folder** (right-click a `.smc`/`.sfc` in the Explorer, or the
button in an open ROM's editor title bar) mounts `soe://rom/~<base64url path>/` as an extra workspace
folder, so the game browses like a directory: `rom/` (the cartridge:
`assets/`, `header.json`, `rom.sfc`), `ram/`, `tags/` and `localization/`
(`soe://rom/~…/tags/boy/hp.md` is `soe://tags/boy/hp.md`). The mount's
old root paths (`~…/assets/…`) still resolve, unlisted. Pages that link
across files (tags/, `ram/index.md`) are served with relative link targets
(`page-links.js`): the built-in Markdown preview loads only relative images. VS Code cannot expand a file in
place; remove it with *Remove Folder from Workspace*. The ROM is named in the
path, not the query: a webview checks a requested resource against its roots
with the query stripped from the request but not the root, so a `?rom=` root
would deny the Markdown preview every image.

`.md` files under `soe:` open in VS Code's built-in Markdown preview
(`configurationDefaults` → `workbench.editorAssociations`). Preview extensions
that resolve images as `file:` paths (Markdown Preview Enhanced) show no
`soe:` images. `Everscript: Toggle Markdown Source/Preview` (cmd/ctrl+shift+v
on `soe:` Markdown) swaps a tab in place between text and that preview. MPE
binds the same key and wins on extension load order; a user keybinding
`-markdown-preview-enhanced.openPreview` hands the key back.

## Files

| File | Owns |
|---|---|
| `index.js` | `registerSoeResources(context, deps)`: the provider and its commands (open, check, Open ROM as Folder) |
| `fs-provider.js` | `SoeFileSystem`: routing, ROM choice, caching, live-file watch, errors |
| `nodes.js` | the `dir` / `file` / `link` shapes handlers return |
| `autoindex.js` | the `index.md` of a directory without its own: links + image gallery |
| `bus-files.js` | `soe://bus/`: maps a bus address to its `ram/` or `rom/` file (no data of its own) |
| `rom-files.js` | `soe://rom/`: `rom.sfc`, `header.json`, offset slices, `<offset>.json`, top-level aliases |
| `rom-assets.js` | `soe://rom/assets/`: icons, items by name, alchemy, strings, maps |
| `character-files.js` | `characters/`, `animations/`: records, sprites, animation GIFs, frames, tile blocks |
| `tile-files.js` | `assets/tiles/`: 16×16 CHR tile graphics table ($EE0000); room metatile atlas/tiles |
| `audio-files.js` | `audio/`: music tracks, playable `.spc` snapshots, sound effects, descriptors |
| `table-files.js` | `tables/`: engine lookup and pointer tables with `data.bin` and `data.json` |
| `gif.js` | pure GIF89a encoder for animated character and sprite sequences |
| `ram-symbols.js` | every known WRAM address (names.json + tag links) with size and type; flag bytes; records |
| `page-links.js` | link targets of generated pages: into a mount, relative to the page |
| `ram-files.js` | `soe://ram/`: `status.json`, `wram.bin`, slices, `<addr>.json`, flags, symbols |
| `tag-model.js` | `soe://tags/` graph: merges generated + `tags/tags.json`, inheritance, aliases, conflicts, validation |
| `tag-generate.js` | generated tags (rooms, areas, enemies, music, sounds, flags, RAM names, tables, items) from shipped data |
| `tag-files.js` | `soe://tags/`: routing, directory listings, live values, search, `check.json` |
| `tag-markdown.js` | tag pages as Markdown / JSON |
| `tags/tags.json` | hand-authored tags: `character` → `player` → `boy` / `dog`, `enemy`, precompiled WRAM links |
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
