# tools/compare — run setups side by side, find where they part

```sh
npm run compare -- out/my-hack.sfc                     # one ROM: against vanilla
npm run compare -- a.sfc b.sfc c.sfc                   # the first is the reference
npm run compare -- recomp=                             # the recomp against snes9x (= npm run recomp:lockstep)
npm run compare -- recomp:build/a=rom.sfc recomp:build/b=rom.sfc   # hooks against no hooks
npm run c-to-rom:compare                               # the C-built image against vanilla, + quality.md
```

A **setup** is `backend[:exe]=rom`; a bare path means `snes9x=<path>`, and `recomp=` with no ROM means the
clean ROM. Backends: `snes9x` (our fork's debugger core, `src/core/emulator/core/snes9x2005-wasm/`) and
`recomp` (the game built in the recomp repository, `../SecretOfEvermoreRecomp/build/`, or the executable after the colon).

Options: `--replay x.evsmv` (snes9x setups only), `--frames N` (default 8414, the 2:20 intro; a replay's
length with `--replay`), `--verbose` (check every frame, not every 60th), `--keep-going` (count every
differing checkpoint), `--aram`, `--regions wram,vram,cgram,oam`, `--align frame|nmi`, `--no-cache`,
`--out file.md`, `--rom <clean rom>`.

## How it works

1. All setups start at once as child processes. Each one hashes its regions (CRC-32; default WRAM + VRAM)
   at every 60th key and streams the hashes back. Nothing is written to disk.
2. The **key** is the emulated frame when every setup is snes9x. When backends are mixed, it is the game's
   NMI counter `$7E0100` (counted from the 0 the reset code writes), because two backends do not cut frames
   at the same place. Mixed runs also copy snes9x's RNG `$0133–$013A` into the recomp at counter 115,
   compare nothing before that, and ignore the timing-noise bytes in `game.mts`. The report lists them.
3. The default comparison is one hash over all regions (a CRC of the region CRCs). A target stops at its
   first differing checkpoint, unless `--keep-going` is set.
4. Then, for each target that parted from the reference, both setups run again to that checkpoint and hand
   over their memory in RAM: the differing bytes, with names from `knowledge/ram/`. For snes9x setups, the
   window from the last matching checkpoint is run again with write watchpoints on up to 256 differing
   WRAM bytes. The first CPU write where the two sides part gives the frame, the PC and the routine
   (`localizations/functions`, or the C function from `out/c-to-rom/build.json` for PCs in the 4th MB).
   DMA writes are not watched.
5. Report: a summary on the terminal and `out/compare/<setups>.md`. Exit code 0 only when every target
   stayed in sync for the whole run.

A snes9x reference's hashes for every frame are cached in `out/compare/cache/`, keyed by core, ROM, replay,
length and regions, so vanilla runs once (~5 s for the intro) and costs nothing after that.

| File | What |
|---|---|
| `compare.mts` | the command: setups, scheduling, the cache, the detail pass |
| `diff.mts` | the pure part (tracker, byte and write diffs); `tests/compare/compare-units.test.mts` |
| `snes9x.mts` | the snes9x child process: `hash`, `dump`, `watch`, `rng` jobs |
| `recomp.mts` | the recomp: a headless script plus the recomp glue's `SOE_COMPARE_*` hashing on fd 3 |
| `game.mts` | the Evermore facts it aligns on (frame counter, RNG, noise bytes) |
| `report.mts`, `cache.mts` | the Markdown report and naming; the hash cache |

## Limits (v1)

- The recomp gets no replay input yet. Its script has `press`, so this can come.
- The recomp hashes WRAM, VRAM, CGRAM and OAM, but not ARAM.
- A replay that rewinds (`L` events) is refused.
- Checkpoints are every 60 keys (~1 s), so the first divergence is known to within that window. The
  write watch covers the whole window.
