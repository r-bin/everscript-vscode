# Research & Visualizations — Open Tasks & Explorations

> Domain: Reverse Engineering, Visual Diagnostics & Asset Research (`tools/`, `src/games/evermore/script/`, `src/games/evermore/localizations/`)
> Status key: 💡 concept / proposal · 🟡 prototype exists · 🟢 planned pipeline

---

## 1. Visual Analysis Tools (High Payoff Diagnostics)

Visualizations building on data already recorded across the CDL logger, script debugger, and memory inspector:

### 1.1 ✨ Call-Graph Galaxy
- **Concept:** Force-directed 3D/2D graph of the CDL call stack and xrefs. Node size indicates execution hit count, node color maps to ROM bank, and selecting a node displays its disassembly.
- **Status:** **⚪ Prototype removed 2026-10-16 (`tools/call-graph-galaxy/`, in git history); rebuild on the CDL tab if wanted**
- **Follow-ups:**
  - Connect script calls (`src/games/evermore/script/`) to assembly call sites.
  - Export interactive standalone HTML artifact for easy web browsing.

### 1.2 ✨ ROM Heat-Strip Timelapse
- **Concept:** The ROM coverage strip animated over a recorded TAS replay, highlighting code that activates during combat, menu navigation, map transitions, or boss encounters.
- **Status:** 💡 Concept. CDL frame timestamps can generate per-frame execution heatmaps.

### 1.3 ✨ Script Execution Flame Graph
- **Concept:** Record Everscript invocations through debugger script call/end hooks (`src/games/evermore/debugger/`) and display them as a hierarchical flame chart showing execution durations, call chains, and wait states.
- **Status:** 💡 Concept. Useful for spotting script performance bottlenecks or event lockups.

### 1.4 ✨ WRAM Write-Pulse Phosphor Heatmap
- **Concept:** The Memory Radar WRAM grid rendered with phosphor decay: cells flash brightly on memory writes and slowly fade. Filterable by writing routine (CDL routine ownership).
- **Status:** 💡 Concept.

### 1.5 ✨ Event-Flag Dependency DAG
- **Concept:** Directed acyclic graph showing every flag set and checked across all room scripts. Visualizes prerequisite quest chains and helps unblock full headless room simulation.
- **Status:** 💡 Concept. Parsed script opcodes already record flag read/write operands.

### 1.6 ✨ World Atlas
- **Concept:** Interactive world map stitching together all 256+ rooms along their door transitions and scroll boundaries.
- **Status:** 💡 Concept. Room transition tables provide door links and coordinates.

---

## 2. Asset & Engine Research: Act 0 Dog Missing Animations

> Full specification and measurements: see original research dossier in [act0-dog-animations.md](act0-dog-animations.md).

### 2.1 The Problem
The Dog's form table at `$CF945F` has six 40-byte entries (10-byte header + 15 animation record IDs). The Act 0 (Podunk) entry at `$CF936D` has art for only three slots (`ACT0_STAND`, `ACT0_WALK`, `ACT0_RUN`). The remaining 12 slots are borrowed byte-for-byte from the **Act 1 Wolf**, causing an Act 0 dog in combat to morph into the wolf with the Act 0 palette (`$90:B54B`).

### 2.2 Patch & Expansion Steps
1. **Quick Win — Bark Patch:** Point slot 14 at `$4526` (`ACT0_BARK`). This is a 2-byte patch at `$CF938F` requiring no new art.
2. **Trace VRAM Upload Path:** Trace whether the engine decompresses blocks on demand or preloads form tile sets via the form header's `+0` pointer.
3. **ROM Expansion to 4 MB:** Vanilla 3 MB ROM has zero runs of free space ≥ 1 KB. Expand image to 4 MB (HiROM banks `$F0..$FF`) and update header size byte (`$FFD7`).
4. **Codec Implementation:** Add 4bpp block encoder and sprite-info writer to `src/games/evermore/maps/sprites.ts`.
5. **Draw & Integrate Poses:** Pixel ~85 missing poses in the Act 0 palette, allocate dead block IDs, assemble animation scripts, and repoint `$CF936D` form slots.


## 3. Script simulation: fewer paths

> From cleanup 5.6/5.7 (`docs/cleanup.md`): the profiled hot spots are fixed (all 127 rooms 308 → 201 s, output byte-identical).

- **The problem:** the slowest rooms (0x48 and 0x0a, ~20 s each; 0x5a 16 s) have no single hot spot left: ~30 % is GC, the rest is spread over stepping, the scheduler and the symbolic keys (`simulation/sym.ts` `memo` / `key`) across many paths.
- **The way:** fewer paths, i.e. merging them earlier (`simulation/turn.ts` `mergeGroup`), not faster code. Check any change against the sha1 of `room()`'s JSON for all 127 rooms.
- **Status:** 💡 Not started.

## 4. Name Every Room-Script Resource

- **Goal:** Make the room-script viewer render meaningful names instead of unresolved memory addresses, flag bits, call targets, animation IDs, sound IDs, and music IDs.
- **Inventory:** `node tools/unnamed-script-resources.mts --json` reports the current unresolved resources and usage sites across room scripts. Re-run it as names are added; the inventory is ROM- and name-source-dependent.
- **Workflow:** Handle each distinct inventory entry independently. Use a subagent to trace and cross-reference every entry, then verify its proposed name and behavior against the decoded script context and relevant ROM/WRAM evidence before recording it. Do not turn a raw number into a semantic name based only on frequency, nearby addresses, or a generic “scratch” label; leave uncertain behavior explicitly unresolved.
- **Record and expose:** Put verified WRAM cells and flags in `src/games/evermore/localizations/knowledge/ram/`, script routines/targets in `knowledge/rom/`, and sound/music/animation values in the appropriate compiler enum source. Ensure the viewer's printer resolves those authoritative names, rather than adding a second display-only mapping. Add focused tests for each naming path.
- **Completion:** The inventory has no unresolved entries, every added name has evidence and a documented purpose, and representative script listings show no unexplained memory or magic-number resource operands. Track remaining counts by category from the inventory command.
- **Status:** 🟡 Started: `$7E:2491` is documented as `QUICKSAND_TRIGGER_OBJECT_INDEX`; the viewer naming path and a regression test are in place. All other inventory entries remain open.
