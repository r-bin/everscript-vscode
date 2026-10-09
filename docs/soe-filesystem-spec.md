# `soe://` Read-Only File System Specification

> **Status:** Phase 1 implemented (v0.178.0, `bus`/index/links/status v0.179.0) in `src/resources/`. Later phases are proposals.
> **Builds on:** [`resource-paths-and-assets-spec.md`](resource-paths-and-assets-spec.md)
> **Replaces:** §3 of that spec ("VFS rejected") and its `TextDocumentContentProvider` (§3.4)
> **Goal:** One read-only `vscode.FileSystemProvider` for the `soe` scheme. It serves ROM content, decoded assets and live emulator memory as files, so editor tabs, webview `<img>` tags and links share one address.

---

## 1. Addresses

```
soe://<memory>/<path>?rom=<source>

soe://rom/assets/ingredients/wax/icon.png              the cartridge
soe://rom/assets/ingredients/wax/icon.png?rom=vanilla  …read from the configured ROM file
soe://ram/0adb.json                                    the running game's WRAM
```

- **Authority = which memory.** `rom` is the cartridge, `ram` the emulator's WRAM, `bus` the 24-bit CPU bus. `bus` holds no data: each address links to its `ram/` or `rom/` file. `vram`, `cgram`, `oam` and `aram` are reserved for later (§5).
- **Path = what is read.** Every number is hex without `$`. The file extension chooses the representation (§2).
- **Query = where from.** `?rom=vanilla` reads `everscript.romPath`, `?rom=emulator` reads the ROM running in the emulator, and `?rom=<absolute path>` reads that file. A first path segment `~<base64url of a path>` reads that file too: *Open ROM as Folder* mounts a `.smc` in the Explorer as `soe://rom/~…/`, in the path because webview resource roots must not carry a query (VS Code strips the request's query, then compares it with the root's). Without a query, the emulator's ROM is used when one runs, otherwise vanilla. `ram` reads always come from the running emulator. A save-state source (`?state=`) is a possible later addition.
- **Read-only.** Every write operation throws `NoPermissions`.
- **Like a classic VFS.**
  - Every directory has an `index.md`: links, plus a gallery for images.
  - A file stored once is reached elsewhere through a symlink (`File | SymbolicLink`): `ingredients/wax/icon.png` → `icons/<id>.png`, `soe://bus/7e0adb` → `soe://ram/0adb.json`.
  - Arbitrary byte ranges (`<addr>[<len>].bin`) stay unlisted.

**Acceptance checks:**
- `<img src="soe://rom/assets/ingredients/wax/icon.png">` renders in a webview.
- `soe://ram/…` reads the running emulator.

Both are verified by `Everscript: Check soe:// Resources`. The command also returns its results, so an extension-host test can run it.

---

## 2. Why a file system, and how webviews read it

`resource-paths-and-assets-spec.md` §3 rejected a VFS. That reasoning was wrong for webviews:

- **Webviews can read from the provider.** A webview loads local resources through VS Code's file service, and the file service includes extension-registered providers. `webview.asWebviewUri(soe://rom/x)` becomes `https://soe+rom.vscode-resource.vscode-cdn.net/x`, which VS Code serves by calling this provider. Query strings pass through: `?rom=vanilla` gives 200, `?rom=bogus` gives 404. This was verified in VS Code 1.138.
- **What blocks a raw `soe://` URL is the scheme, not the CSP.** A browser cannot fetch `soe://` itself, so every `soe://<authority>/` prefix is swapped for that authority's webview base: on the host for the HTML string (`rewriteSoeUrls`), and in the page for elements added later (`soeClientScript`). See `src/resources/README.md` for the four steps.
- **The extension chooses the representation:**

  | Extension | Content | Opens as |
  |---|---|---|
  | `.bin` | raw bytes | hex editor (if installed) |
  | `.json` | decoded structure | JSON editor; panels can `fetch` it |
  | `.md` | summary with relative links and images | Markdown preview |
  | `.png` | rendered graphic | image preview, `<img>` |
  | `.txt` | decoded text | plain text |

---

## 3. Implemented (Phase 1)

### `soe://rom/`

| Path | Content |
|---|---|
| `index.md` | overview with links |
| `rom.sfc` | the whole unheadered ROM |
| `header.json` | cartridge header at `$FFC0` |
| `<offset>[<len>].bin` | slice by file offset (unlisted; default length `0x100`), e.g. `128000[40].bin` |
| `<offset>.json` | byte, word, long, bus spellings and table/function name, e.g. `0e8000.json` |
| `assets/icons/<id>.png` | ring-menu icon by icon id (`$CE8000` table); only ids that draw are listed (all 162 in vanilla) |
| `assets/{ingredients,armor,consumables}/<name>/icon.png`, `info.json` | by `LOOT_REWARD` name (`wax`, `mud_pepper`) or hex reward id (`0200`); `icon.png` links to `icons/` |
| `assets/alchemy/<name>/icon.png`, `info.json` | by formula name (`acid_rain`), with its "known" flag |
| `assets/strings/<idx>.txt`, `index.md` | in-game string from the 3,002-entry table at `$11D000`; the index is a table of all |
| `assets/maps/index.json`, `index.md` | room id → name, area |
| `assets/maps/<id>/info.md`, `header.json`, `render.png`, `tiles`, `metatiles` | room summary, decoded header, composite render, metatile atlas and tiles |
| `assets/characters/index.json`, `<id>/info.json`, `sprite.png`, `animations/` | 142 character records, idle sprites, animation sets, animated GIFs |
| `assets/characters/<id>/animations/<name>/animation.gif`, `frames/`, `tiles/` | animated GIF, frame PNG/JSON sequences, sprite tile blocks |
| `assets/tiles/<id>.png`, `<id>.bin` | 6,688 master 16×16 CHR tile graphics at `$EE0000` |
| `assets/audio/music/<id>/song.spc`, `info.json`, `sounds/<id>/info.json` | assembled 66 KB playable `.spc` files, descriptor transfers, sound effects |
| `tables/index.json`, `<name>/data.bin`, `data.json`, `info.json` | 27+ engine lookup and pointer tables |

### `soe://ram/`

| Path | Content |
|---|---|
| `index.md` | overview with links |
| `status.json` | emulator `closed` / `open` / `running`, its ROM, `paused`; works without a game |
| `wram.bin` | all 128 KB, `$7E0000-$7FFFFF` |
| `<addr>[<len>].bin` | slice (unlisted); addr is a WRAM offset (`2222`) or bus address (`7e2222`) |
| `<addr>.json` | byte, word, name and value name, e.g. `0adb.json` (current room) |
| `<addr>.<bit>.json` | one flag and its name, e.g. `2258.0.json` (Acid Rain known) |
| `flags.json` | every named flag and whether it is set |
| `symbols.json` | every named address and flag; needs no emulator |

### `soe://bus/`

| Bus range | Links to |
|---|---|
| `$7E0000-$7FFFFF` | `soe://ram/<offset>…` |
| `$00-$3F`, `$80-$BF` : `$0000-$1FFF` | `soe://ram/<offset>…` (WRAM mirror) |
| `$00-$3F`, `$80-$BF` : `$8000-$FFFF`; `$40-$7D`, `$C0-$FF` | `soe://rom/<file offset>…` |
| I/O registers, SRAM | not served (some registers change when read) |

An address without an extension reads as `.json` (`soe://bus/8cd0a6` → `soe://rom/0cd0a6.json`, "Script VM opcode dispatch"). `.bin`, `[<len>]` and `.<bit>` carry over to the target.

**How live reads work:**
- **The bridge.** The core runs in the emulator webview, so the host asks it: `soeRequest` (kind `read` or `status`) → `soeReply` (`src/emulator/memory-bridge.js` and `memory-bridge-view.js`).
- **Which read.** The debugger core reads any bus address with `readMemoryRange`, 4 KB per call. The vanilla core serves WRAM from its save state at offset `0x10c14`.
- **Caching and refresh.** Live files are cached for 250 ms and re-announced once a second while watched. Without a running game, reads throw `Unavailable`.

---

## 3a. AI access over MCP (v0.180.0)

A tool like Claude Code cannot read `soe://` itself, because it only sees the real disk. So the
extension host runs a read-only MCP server (`src/mcp/`) at `http://127.0.0.1:47917/mcp`, and the repo's
`.mcp.json` points Claude Code at it.

- **Clients (v0.181.0):** Claude Code (`.mcp.json`), Antigravity (`.agents/mcp_config.json`), Gemini CLI (`.gemini/settings.json`), and VS Code's chat through `registerMcpServerDefinitionProvider`. Details in `src/mcp/README.md`.
- **Tools:** `soe_list(uri)` and `soe_read(uri)`. PNG files come back as images.
- **Resources:** the entry points and URI templates.

Verified with a headless Claude Code session against a VS Code instance running the emulator. The session read
`status.json` and the live room via `soe://bus/7e0adb`, received the wax icon as an image, and resolved `soe://bus/8cd0a6`. The same check passed with Antigravity's `agy -p`.

## 4. Next (Phase 2): static content

| Path | Content | Source |
|---|---|---|
| `rom/map.md`, `rom/regions.json` | ROM map: every region with label and size | `rom/model/*` (ROM tab) |
| `rom/banks/<bb>.asm` | disassembly with CDL marks and names | `emulator/cdl/disasm.js`: inject it, as for `rom/` |
| `rom/assets/maps/<id>/collision.png`, `objects.json`, `triggers.json`, `blob.bin` | room layers and lists | `maps/collision-overlay.ts`, `maps/objects.ts`, `maps/blob-layout.ts` |
| `rom/assets/maps/<id>/scripts.evs`, `rom/assets/scripts/<id>.evs` | decompiled scripts with Everscript highlighting | `script/room-scripts.ts`, `script/decoder.ts` |
| `rom/assets/tiles/<id>.png` | `$EE` table graphics (6,688) | `maps/chr.ts` |
| `rom/assets/sprites/<id>/…`, `rom/assets/animations/<id>/script.txt` | sprite frames, animation bytecode | `sprites/`, `maps/animation-opcodes.ts` |
| `rom/assets/characters/<id>.json` | character records | `maps/characters.ts`, `names.json` `enemies` |
| `rom/assets/audio/{music,sfx}/index.json` | id → title, package | `localizations/sounds.js`, `rom/model/audio.js` |
| `ram/scripts.json`, `ram/entities/<ptr>.json`, `ram/party.json`, `ram/room.json` | decoded live structures | bridge + WRAM tables in the skills |

---

## 5. Later (Phase 3): hardware memory

Each item needs a new bridge read from the core first.

| Path | Content | Source |
|---|---|---|
| `soe://vram/vram.bin`, `chr/bg.png`, `chr/obj.png`, `bg1.png`, `bg2.png` | 64 KB VRAM and renders of it | save state offset `0xc14` (vanilla core; custom core unverified) |
| `soe://cgram/cgram.bin`, `palettes.png`, `ppu.json` | CGRAM and display registers | custom core `_getPpuView()` |
| `soe://oam/oam.bin`, `oam.json` | sprite table | save state offset `0x902` (vanilla core) |
| `soe://aram/aram.bin`, `dsp.json`, `state.spc`, `layout.json` | SPC700 RAM, DSP registers, a `.spc` snapshot | **missing:** ARAM/DSP are not exported by the core yet |

---

## 6. Open questions

1. **Workspace folder:** should "Add `soe://rom/` to workspace" be offered? Explorer browsing works, but Quick Open and Search over virtual files need proposed APIs.
2. **Hover images:** whether hover Markdown renders `![](soe://…)` is untested.
3. **Writes:** a WRAM poke through `writeFile` stays out of scope. If wanted, it goes behind a setting and the debugger's write path.
4. **String decoding:** `localizations/strings.js` returns control bytes and broken dictionary words ("Found ¢ parts NectW" for Nectar). `assets/strings/` serves its output as-is, and the index only hides the control bytes.
5. **Existing data URIs:** should the Rooms tab and the emulator overlay switch from data-URI icons (`rooms/data/item-icons.js`) to `soe://rom/assets/…/icon.png`?
