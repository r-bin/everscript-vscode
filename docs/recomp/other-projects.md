# Other Secret of Evermore recomp projects

Other people's ports of Secret of Evermore to PC, what they do and how far they are, so we know
what exists and do not repeat a comparison. Read on 2026-11-02 from their public repositories;
nothing was built or run here. No code or data from them is used in this repository.

---

## aitorcachero/SoE-Recomp

<https://github.com/aitorcachero/SoE-Recomp> — a native Windows x64 build of the game, made with
the [snesrecomp](https://github.com/RetroPortingToolKit/snesrecomp) framework (the same framework
as [SecretOfEvermoreRecomp](https://github.com/r-bin/SecretOfEvermoreRecomp)) and the
`recomp-ui` launcher. State read at commit `34c1f93` ("v1.0", 2026-10-26); the history has two
commits, the scaffold and v1.0, both from that day. No license file is declared to GitHub's API.

**ROM.** Spanish PAL release only: SHA-1 `4363ce4b…`, which is **Spain (Rev 1)** in
[../evermore-releases.md](../evermore-releases.md). A US build is not offered (as of this date a
request for one is open). Because the PAL builds are re-built, not patched (§5 there), a US build
would need its own addresses, though with the current setup that is little work (see below).

**What it adds** (from its README, not tried here): 1080p/4K output, a 16:9 widescreen mode,
shader presets (xBR, FXAA, bicubic, CRT, an "HD-2D" filter), gamepad support through SDL3,
save states, 60 s rewind, and a fix for side artefacts on the Mode 5/6 high-resolution screens
(name entry, menus). Launch scripts and the build script have Spanish names (`JUGAR_16_9.bat`,
`COMPILAR.bat`); a Spanish README is included.

**How it runs the game.** The recompiler input lists two entry points, reset (`$8020`) and NMI
(`$823A`), both kept interpreted (`emit = false`, `force_lle`; the config calls itself an
"LLE-first seed"). No routine is promoted to ahead-of-time code, so the game runs in
snesrecomp's built-in 65816 interpreter tier. The generated `src/gen/` is not checked in (each
user regenerates it from their own ROM), so this is read from the inputs, not the output.

The project's own code is the desktop host (`src/main.c`, about 135 lines) and a patch to the
framework's PPU renderer (`patches/snesrecomp_fixes.patch`): clearing the margins of the widened
picture, centring Mode 5/6 screens, and wrapping tilemap reads for the wider view. The widescreen
view reads the camera from WRAM `$7E0059`/`$7E005B` and the room width from `$7E08EE` (Spain Rev 1
addresses; not checked against the US map here). The frame driver is the framework's default
beam-aligned one; `variables.h` and `gen_stubs.c` are still empty.

**Verification.** The repository has no tests or emulator comparison yet (no trace, WRAM or
replay check against Mesen or another emulator); its CI builds and packages releases.

**Compared with SecretOfEvermoreRecomp.**

| | SoE-Recomp | SecretOfEvermoreRecomp |
|---|---|---|
| ROM | Spain Rev 1 (PAL) | USA |
| Game code | interpreted (no AOT routines) | AOT routines from seeds made here (`npm run recomp`) |
| Framework changes | PPU renderer patch (widescreen) | none (owner's rule) |
| Checked against | — | MesenCE WRAM (`npm run compare`) |
| Focus | playing comfort: resolution, shaders, widescreen, rewind | a faithful recompilation |

The interpreter-first approach is snesrecomp's normal starting point: it is the quickest way to a
playable build and to the framework's host features, and routines can be promoted to compiled
code later. It does not meet the problem that compiled code drifts from MesenCE's WRAM (see the
recomp repository's docs), because no code is compiled yet. How close it plays to the original
then depends on the framework's interpreter and the patched PPU; that has not been measured.

**Worth a look for our recomp:** the widescreen setup (camera and room width taken from WRAM to
decide how far the view may extend) and which host features `recomp-ui` already provides.

---

## Not recomps

- [maluramichael/secret-of-evermore-re](https://github.com/maluramichael/secret-of-evermore-re)
  (Europe ROM): format notes, Ghidra labels and Python extractors; its `.recomp.json` says
  "no buildable source yet". It credits the third-party tools `AGENTS.md` rules out as
  sources, so its code is off limits here; its method notes (letting the game build a room in the
  emulator and reading VRAM back as a reference) are ideas only.
