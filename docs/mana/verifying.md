# Checking Secret of Mana facts against the game

How the facts in [README.md](README.md) were found and how to re-check them. All of it
runs headless on the extension's own emulator core; nothing is copied from other projects.

## Compare a map picture with the game

```
EVERSCRIPT_MANA_ROM="…/Secret of Mana (U) [!].smc" node tools/mana/check-map.js 113 out/
```

`tools/mana/check-map.js` plays the opening (title, new game, the log-bridge dialogue),
breaks at the map loader `$00:C481` before the fall to the waterfall, writes the wanted id
into `$DC`, and lets the game load that map instead. It saves `game-<id>.png` (the screen)
and `render-<id>.png` (src/mana), finds the screen inside the render and prints the share
of equal pixels (5-bit colour). Seen: 48 → 98.9%, 113 → 97.6%, 35 → 96.9%; the rest is
sprites. 128 (the waterfall) → ~60%: its water characters animate and palette 7 rotates,
so the frame differs from frame 0.

## Find the code that loads something

The debugger core (`src/emulator/core/snes9x2005-wasm`) records CDL xrefs
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
