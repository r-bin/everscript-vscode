# Checking Secret of Mana facts against the game

How the facts in [README.md](README.md) were found and how to re-check them. All of it
runs headless on the extension's own emulator core; nothing is copied from other projects.

## Compare a map picture with the game

```
node tools/mana/check-map.js 113 out/
```

`tools/mana/check-map.js` plays the opening (title, new game, the log-bridge dialogue),
breaks at the map loader `$00:C481` before the fall to the waterfall, writes the wanted id
into `$DC`, and lets the game load that map instead. It saves `game-<id>.png` (the screen)
and `render-<id>.png` (src/games/mana/decoder), finds the screen inside the render and prints the share
of equal pixels (5-bit colour). Seen: 48 → 98.9%, 113 → 97.6%, 35 → 96.9%; the rest is
sprites. 128 (the waterfall) → ~60%: its water characters animate and palette 7 rotates,
so the frame differs from frame 0.

## Find the code that loads something

The debugger core (`src/core/emulator/core/snes9x2005-wasm`) records CDL xrefs
(`_cdlEnable`, `_cdlDrainXrefs` → `[pc, space<<24 | addr, flags]`, flags `0x40` = DMA to
VRAM). Load a save state just before a map change, enable the CDL, run ~200 frames and
group ROM reads by pc: that is how `$01:F413` (BG characters), `$02:A069` (metatiles),
`$00:CD93` (pieces) and `$02:AA60` (display table) were found. `M.addExecBreakpoint` +
`M.onBreakpointHit` (return `false` to keep running) give register-free probes:
read `M.readMemory(0x7E001B)` etc. at a routine's entry.

## Compare decoded state with the game's

At the waterfall (map 128), after the load:
- layer buffers `$7F:0000` / `$7F:4000` (128-byte rows) = `assembleLayers` (4588/4592 and
  4592/4592 cells; the 4 others are ≥ `$C0` values the game writes later),
- metatile tables `$7F:C000` / `$7F:C800` = `decodeMetatileSet` halves (768/768 words each),
- VRAM chars `$000-$35F` = `loadBgChars` (all but 6 chars the game animates), `$360-$37F`
  = one of the 4 frames of each animated block,
- CGRAM = `loadBgPalettes` except colours 8–15 of palette 7 (rotating).
The same held for maps 48, 350 and 35 loaded with the tool above.

In the save state of this core, `FillRAM` (last values written to `$21xx`) follows WRAM
and SRAM: state offset of WRAM + `$40000`. The 512×448 screen buffer holds the picture
doubled in both directions.

## Animation against the game

Load a map in the emulator (as `check-map.js` does), let it settle, record for 480 frames
the content of every character `traceAnimation` says animates, and the animated CGRAM
colours; then compare the *sets* of states per character/colour with the trace's (the
phase differs, the sets must not), and check that no other character changes in the
game. Map 250 could not be checked: forcing its id at `$00:C481` does not load it.

The same interpreter can run any self-contained routine: `cpu.call(addr)` (JSL/RTL) or
`cpu.call(addr, { rts: true })`; set the routine's direct-page inputs in `bus.wram` first
and keep the data bank 0 unless the routine sets its own (`$01:F403` writes PPU and DMA
registers with absolute addressing).

## Step events against the game

```
node tools/mana/check-events.js 80
```

Loads the map like `check-map.js`, saves the state, and for every cell `mapEvents` lists
restores it, writes the cell's value (read from `$7F` as the game holds it) into
`$7E:E04B/E04C`, clears `$D0` and runs 3 frames with a breakpoint on the event runner
`$01:E76D`. It prints the expected and the run event per cell and exits non-zero on a
difference. This checks the table lookup and the slot numbering, not walking: that a
character's cell value reaches `$E04B` is read from `$00:D682`.

## Converted rooms against the Mana picture

`tests/mana/mana-evermore.test.js` (both ROMs) converts maps to Evermore rooms, draws them
with Evermore's renderer and compares with `src/games/mana/decoder`'s picture. Over all 408 maps 97.8%
of pixels agree; the rest are mixed-palette tiles redrawn in one palette, per-tile
priority, and the backdrop colour (Evermore draws black). See
[evermore-rooms.md](evermore-rooms.md).

## Which map is this picture?

```
node tools/mana/find-picture.js shot.png 122 -4 -77
```

Compares the middle of each whole cell of a picture (a screenshot of the Rooms tab, the
Maps panel or a fan map) with every cell of every map's render and prints the best places.
Give the cell width in picture pixels and where the first cell edge would be. The user's
cuttable-grass screenshot (Rooms tab, ~760%) came out as map `$81` at cell 3,33; maps
`$80`/`$65` tie because the Potos Falls maps share those cells.

## Playing the game headless

What was learned getting a controllable character (2026-10-15):

- `check-map.js`'s opening (title, new game, 68 × Start/B through the log-bridge
  dialogue), then 12 × (300 frames, B) without forcing a map: the boy stands in the river
  at Potos Falls (map `$80`, pixel 508,442 = cell 31,27) with `$D0` = 0 — he can be
  moved. Save a state there (`_saveState`) instead of replaying the opening each time.
- Steer with the d-pad toward a target read from `$7E:E002/E004`; walls stop it, so plan
  the route over layer A's collision first (breadth-first over cells whose c0 & 7 != 3;
  diagonal half walls are passable). From the river, the sword's corner (cells 47,50-51)
  is walled off, so the sword cannot be reached on map `$80` alone.
- Writing `$E002/E004` moves the character's numbers but not the camera, and the
  character then does not move: teleporting this way does not work.

## Cutting on the interpreter

The cut probe `$01:D293` runs on `cpu65816.ts` after the game's own loaders have built
the map (`$02:A000`, `$00:CB90`). Set the attacker: position `$E002/E004`, layer
`$E00B`, weapon type `$E068`, attack out `$E0C2` = 1, reach `$E0C0` = 0, facing `$56` = 0,
bounds `$C0/$C2`; then call with X = the entity offset and **DB = `$7E`** (it reads
`$E0xx,X`; with the usual DB = 0 it silently reads ROM and nothing happens). The cell in
`$7F:0000` then holds c3 or is unchanged. `tests/mana/mana-rom.test.js` does this for
map `$81`.

## A converted room in the editor

`tests/mana/mana-editor-dom.test.js [shots dir]` builds the real radar page, answers its
requests from both ROMs as `extension.js` does, opens Potos 2 and Path to Pandora, and
checks (and screenshots) the Tile, Trigger (Step-on sub-tab) and Object tabs. Use it to
see what the editor shows for a Mana room without VS Code.
