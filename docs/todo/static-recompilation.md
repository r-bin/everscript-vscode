# Static Recompilation (snesrecomp) — Open Tasks & Roadmap

> Domain: Static Recompilation (`tools/recomp/`, `src/platform/cdl/recomp-*.js`, snesrecomp host)
> Master Reference: `docs/recomp/README.md`, `docs/recomp/bugs-and-todos.md`
> Status key: 🔴 bug / investigation · 🟡 feature gap · 🟢 designed roadmap milestone

---

## 1. Open Bugs & Active Investigations

### 1.1 Timing Drift Against snes9x After NMI Counter ~315
- **Status: 🟡 Open Investigation** (see `docs/recomp/bugs-and-todos.md §1.1`)
- **Symptoms:**
  - WRAM bit-for-bit lockstep comparison matches snes9x2005 through NMI counter 305.
  - Divergence begins at NMI counter 315 (4 bytes differ: `$7E0106` brightness shadow, `$7E0128`).
  - Spikes to 500–2,100 bytes during intro fade/decompression (counters 325–335), settling at 70–190 bytes (mostly shifted RNG).
- **Findings:**
  - Pure interpreter-only build and native recompiled C build diverge from snes9x at the **exact same frame counter and byte count**.
  - Divergence is **not** caused by recompiled C code; it is an artifact of CPU cycle timing differences between snes9x2005 and snesrecomp's beam driver during loops where NMI is disabled (`$7E0F3A != 0`).
- **Next steps:**
  - Compare execution trace against cycle-accurate Mesen2 to identify hardware ground truth.
  - Resolving timing drift enables automated lockstep verification deep into playable rooms.

---

## 2. Upstream Bug Reports & Contributions

Issues identified for contribution back to [RetroPortingToolKit/snesrecomp](https://github.com/RetroPortingToolKit/snesrecomp):

1. **BG Mode 4 Support in `NewRenderer` (`runner/src/snes/ppu.c`):**
   - Mode 4 (8bpp planar, used by SoE for the character name input screen) falls through to Mode 7.
   - *Fix:* Port Mode 4 drawing logic from `ppu_legacy.c` into `ppu.c`. Allows removing the local `SoeAfterConfig` hook.
2. **File Save States Omit CPU and Beam Driver Resume Point:**
   - `RtlSaveSnapshot` / `RtlLoadSnapshot` (`runner/src/common_rtl.c`) serialize `snes->cpu` but not `g_cpu`, and `beam_frame_driver.c` keeps `s_resume_pc` and `s_wai_halted` as inaccessible statics.
   - Any beam driver game loses execution position on load.
   - *Resolution:* Upstream the `SEXC` chunk approach implemented in `tools/recomp/host/src/game_rtl.c`.
3. **Stack-Frame Context Loss in `interp_tier_dispatch_tail`:**
   - When an indirect jump index exceeds directive counts inside a function with stack-allocated locals (via `PEA`/`PHA`), fallback to interpreter can misalign the call frame, causing corrupted returns.

---

## 3. Prioritized Recomp Roadmap Milestones

```text
┌────────────────────────────────────────────────────────────────────────┐
│ [COMPLETED] Milestone 1: Headless Intro & Attract Loop Across Cycles   │
└───────────────────────────────────┬────────────────────────────────────┘
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ Milestone 2: Automated In-Game Playthrough (Press Start, Room 00)      │
└───────────────────────────────────┬────────────────────────────────────┘
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ Milestone 3: High-Level Emulation (HLE) C Replacements (hle_func)      │
└───────────────────────────────────┬────────────────────────────────────┘
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ Milestone 4: Broaden Static CDL Coverage (Ghidra / REA exports)        │
└────────────────────────────────────────────────────────────────────────┘
```

### Milestone 2: Automated In-Game Playthrough
- Write headless script that presses Start at title screen, inputs default character names, and advances through opening cutscenes into the first playable room (`room_00`, Podunk).
- Extend `tools/recomp/lockstep.js` to assert bit-level WRAM integrity across player movement, menu interactions, and weapon strikes.

### Milestone 3: High-Level Emulation (HLE) Replacements (`hle_func`)
- snesrecomp supports replacing assembly routines with pure C implementations using `hle_func <pc16> <c_func_name>`.
- Prioritize leaf routines:
  1. LZ decompressors (matching verified TypeScript decoders in `src/games/evermore/maps/`).
  2. Room tilemap loader and collision unpacker.
- Validate equivalence with automated lockstep runs comparing WRAM output.

### Milestone 4: Broaden Static CDL Coverage
- Ingest Ghidra and REA headless exports (`static.json`) to seed unreached code paths, expanding native C compilation coverage from ~10% toward 100%.

