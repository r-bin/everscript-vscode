# TODO: connect the emulator to the map editor

Status: **planned, not started.** Nothing here is built yet. Each claim below
is either marked with its source or listed as an open question. Read the
`map-editor-rules`, `rom-map-data` and `webview-dom-safety` skills first.

Two features, requested together:

1. **Live painting.** Drawing metatiles in the editor writes them straight
   into the running game, so the change shows up in the emulator without
   rebuilding the ROM.
2. **The emulator on the map.** The emulator's screen is placed over the
   map editor where the game's camera is, and it moves as the camera moves.

Both build on **Play in emulator** (v0.66.0): the editor already turns a
custom map into a ROM (`src/rooms/rendering/rom-export.js`) and loads it into
the emulator panel (`src/emulator/panel.js`, `openEmulatorPanel`).

---

## 1. What exists today

| Piece | Where | What it can do |
|---|---|---|
| Export / Play | `rom-export.js`, `map-editor-rom-export.js` | Builds a ROM with the custom map in room `0x15`, and starts the game in it |
| Emulator panel | `src/emulator/panel.js`, `panel-webview.js` | A **separate** `WebviewPanel` running snes9x2005-wasm |
| Bundled core (`snes9x2005-wasm-vanilla`) | `src/emulator/core/` | Exports `_startWithRom`, `_mainLoop`, `_getScreenBuffer`, `_saveState`, `_loadState`, `_setJoypadInput`. **No direct memory access.** WRAM is read by scanning a save state for the `"RAM "` block (`parseWramFromState`). |
| Custom debugger core (`snes9x2005-wasm`) | same, `DEBUGGER.md` | Adds `readMemory`, `writeMemory`, `readMemoryRange` on the **24-bit bus**, plus `pauseEmulation`/`resumeEmulation` and write breakpoints. Chosen through `everscript.snesCorePath`. |
| Room in WRAM | `docs/map-format/map_decompression_trace_analysis.md` §3 | The grid is at `$7F0000`. The dictionary follows it at `base = W*H*2`, and a metatile id **is** a byte offset into bank `$7F`, used by the tile-streaming routine `$909460` without any lookup. `budget.ts`: grid + dictionary = `W*H*2 + count*8` bytes. |
| Camera bounds | everscript `.github/memory-map.md` | `$23E9..$23EF` `CAMERA_BOUNDRY_*` and `$2401..$2407` `CAMERA_X/Y_MIN/MAX`. Set per room from `W×16`/`H×16`. |
| Camera pan | same | `$242B`/`$242D` `CAMERA_PAN_X/Y`, `$2413`/`$2415` pan targets. These are *scripted* pans, not the live scroll position. |

**Not known yet:** where the live camera (scroll) position is stored in WRAM.
See §4.

---

## 2. Live painting: which of the three things does "written directly" mean?

A painted metatile shows up in the game at three levels, and each needs its
own write:

| Level | Effect | Needed for |
|---|---|---|
| **WRAM** — grid cell at `$7F0000 + (y*W + x)*2`, plus a dictionary entry for a new stamp | The game *uses* the new tile: collision changes immediately, and the tile is drawn the next time the engine streams that row or column to VRAM | Gameplay, and the picture once the cell scrolls back in |
| **VRAM** — the BG1/BG2 tilemap words of the four 8×8 tiles on screen | The picture changes **now**, for a cell already on screen | Seeing the stroke without walking away and back |
| **ROM** — the room blob in the loaded image | The change survives leaving and re-entering the room, and a reset | Anything beyond the current visit |

Plan: do **WRAM plus a redraw** first, and treat ROM as "rebuild and reload".

### 2.1 Phase A — rebuild and reload (no new core features)

After a stroke, debounced to about 1 s:

1. Save a state (`_saveState`).
2. Rebuild the export ROM (`buildExportRom`, a few milliseconds).
3. Load the new ROM (`_startWithRom`), then restore the saved state.

**Open question:** does a restored save state reuse the WRAM copy of the room
that was loaded from the *old* ROM? It almost certainly does, because WRAM is
part of the state. In that case the change appears only after re-entering the
room. That can be forced by re-running `load_map(0x15, x, y)`, but only with a
write to the script VM (custom core), or by adding a door. **Verify before
building on it.**

Phase A is safe and needs nothing new, but it does not feel "live". It is
still worth building first as the fallback for edits Phase B cannot do (§2.3).

### 2.2 Phase B — WRAM writes (needs the custom core, or save-state patching)

- **With the custom core:** pause, write the grid word with `writeMemory`,
  append or overwrite the dictionary entry, then resume.
- **With the bundled core:** save a state, patch the `"RAM "` block, load the
  state. This is the same path `parseWramFromState` reads through, now used to
  write. The cost is one save and one load per stroke, which should be
  measured.
- **The dictionary entry layout in WRAM** is 8 bytes per id, per `budget.ts`
  and the trace doc. Block 3 on the ROM side is three *planar* slices
  (L1 / L2 / collision), so the loader must rearrange them into those 8-byte
  entries. **Read the exact word order from `$909460` or a WRAM dump before
  writing anything.** Do not guess it (map-editor-rules: never invent data the
  ROM does not attest).
- Collision reads the dictionary through the grid, so it should change as
  soon as the WRAM write lands. The redraw does not (§2.4).

### 2.3 Limits: what a live write cannot do

A WRAM write can only reuse what the room has already loaded. The following
need a full reload (Phase A):

- a **new graphic** that is not in VRAM (Block 1 grew);
- a **new tile family** (the palette slots in CGRAM);
- a **resize**: `base = W*H*2` moves, which renumbers every metatile id;
- more stamps than fit in the `$7F` window (`MAX_WRAM`, `budget.ts`).

The editor already knows all four (`addedGraphics`, `autoFamilies`, the
resize path, the budget meter). The live path must check them and fall back
to Phase A *visibly*, never silently.

### 2.4 Phase C — on-screen redraw (VRAM)

The streaming routine `$909460` fills VRAM from the WRAM grid as the camera
moves. For a cell already on screen, either:

- **(a) Reuse the engine.** Object state changes (gourds, doors) already
  redraw metatiles in place. Find the routine (start from the object-state
  opcode `0x62` `tile_animate` and the object-area stamping) and whether it
  can be triggered for an arbitrary cell. This is the preferred option: it
  keeps the engine's own tilemap wrapping and layer placement.
- **(b) Write VRAM directly.** This needs a core export (`writeVram`), since
  VRAM is not on the CPU bus except through `$2116..$2119` at the right time.
  It also needs the tilemap base address and wrap rule. **Decide between (a)
  and (b) only after tracing (a).**

### 2.5 ROM write (optional, after B/C)

Also patch the loaded ROM image, so leaving and re-entering keeps the edit
without a Phase-A reload. This needs a core export such as `writeRom(offset,
bytes)` into `Memory.ROM`. It is easy in C but is a core rebuild (see the
core's `BUILD.md`). The blob would have to fit its slot, or be rewritten
whole; `writeRoomAt` already refuses what does not fit.

---

## 3. The emulator on the map

### 3.1 The architectural problem

The emulator is its own `WebviewPanel`, and the map editor lives in the
Radar panel's Rooms tab. Two webviews share no DOM, so the emulator canvas
cannot simply be moved on top of the map. The options:

| Option | How | Cost |
|---|---|---|
| **A. Viewport rectangle** | The emulator panel reports the camera position (§4) through the host, and the map draws a 256×224 px box where the screen is | Cheap. Few numbers per frame, throttled to about 10 Hz. **Do first.** |
| **B. Frame mirroring** | The emulator posts frames through the host; the map draws them inside that box | 256×224×4 bytes is about 230 KB per frame. Fine at a few fps as a PNG or JPEG data URI, too heavy at 60 fps |
| **C. Host the core in the Rooms webview** | Load snes9x inside the Radar webview and put the canvas in the map's SVG, at the camera's position in map units | Real-time and exact, but it duplicates the emulator panel's loader, audio and input, and makes the Radar bundle heavier. Only worth it if B's frame rate is too low |

Recommendation: **A, then B**, and C only if B is not enough. The
coordinates are simple: the camera is in pixels, and the map SVG uses 1 unit
= 8 px (`MAP_UNIT_PX`, `map-editor-newroom.js`). So the box sits at
`(camX/8, camY/8)`, size `32×28` units.

### 3.2 Which room the emulator is in

The box only makes sense while the game is in the room on screen. For an
exported custom map, that room is `0x15`. For vanilla rooms the current room
id is needed from WRAM. `$2265` is written by everscript's own
`_trigger_enter`, not by vanilla, so find the engine's own variable (e.g. the
`CHANGE MAP` opcode `0x22` handler's store). Hide the box whenever the ids
differ.

### 3.3 Interaction ideas (later)

- Clicking the map while the game is paused could teleport the Boy there
  (opcode `0x20` "Teleport both" is decoded in `src/script/ops-entity.ts`).
  This needs script injection or WRAM writes to the entity position.
- Show the Boy's live position as a marker next to the start marker.

---

## 4. Open questions to answer first

1. **Where is the live camera position?** It is not in the memory map. To
   find it: with the custom core, walk right in a wide room and diff
   `readMemoryRange(0x7E0000, …)` between frames. Look for a word that grows
   by the walk speed and stops at `CAMERA_X_MAX`. Cross-check against the
   BG1 scroll written to `$210D` (`building-a-room-from-scratch.md` §3.3
   names `$7E2417`/`$7E2419` as layer scroll *offsets*, not the camera).
   Then add it to everscript's `.github/memory-map.md`.
2. **The dictionary's word order in WRAM** (§2.2).
3. **Whether a save state keeps the old room's WRAM** after a ROM swap (§2.1).
4. **Which routine redraws one metatile on screen** (§2.4a).
5. **The current room id in WRAM** (§3.2).
6. **Is the save-state round trip fast enough** to run once per stroke on the
   bundled core, or does live painting require the custom core?

## 5. Suggested order

1. §4.1 + §3.1A: the viewport box on the map. Useful on its own, and it
   proves the host path between the emulator and the radar panel.
2. §2.1 Phase A: live-ish painting by rebuild and reload.
3. §4.2–4.4, then §2.2 Phase B + §2.4: real live painting of already-loaded
   stamps.
4. §3.1B: the emulator frames inside the box.
5. §2.5: ROM patching, if the reload in step 2 feels slow.

Each step ends the way Export ROM did: decode what was written, compare it
with the draft, and prove it in the real core (a headless boot like the one
in `rom-export.md` works for anything that does not need the UI).
