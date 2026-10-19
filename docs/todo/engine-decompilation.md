# Secret of Evermore Engine Decompilation — Autonomous /goal Continuation

> **Domain:** Complete C Decompilation & Static Reverse Engineering of the Secret of Evermore SNES Engine  
> **Master Dashboard & Progress Tracker:** [`docs/disassembly/PROGRESS.md`](../disassembly/PROGRESS.md)  
> **Autonomous Agent Persona & Guidelines:** [`.agents/agents/decomp-curator.md`](../../.agents/agents/decomp-curator.md)  
> **Current Landmark (Session 66):** **346 / 403** Identified (85.9%) · **344 / 403** Documented (85.4%) · **330 / 403** Clean C Functions (81.9%) · **12,151** WRAM Bytes Mapped (37.6%)  

---

## 1. Quick Resumption Command

To resume this autonomous decompilation goal in any future session, provide the following instruction to the AI agent:

```markdown
/goal continue the decompilation iteratively until quota is exhausted or all remaining targets in docs/disassembly/PROGRESS.md are decompiled. For each target, follow .agents/agents/decomp-curator.md, verify tests, commit, and advance to the next target without stopping.
```

---

## 2. Autonomous Execution Protocol & Rituals

Every agent resuming this work must strictly adhere to repository guidelines:

1. **VFS ROM Disassembly Inspection:**
   - Query ROM disassembly via VFS: `soe://bus/<hex_bus_addr>.asm` or `soe://rom/<hex_file_offset>.asm`.
   - Inspect cross-references, call sites, and hardware register accesses ($4200–$4216 math, PPU registers, DMA channels, and APU ports).
2. **Behavioral Equivalence & Clean C Standards:**
   - Reconstruct assembly routines into idiomatic, human-readable C.
   - Preserve signed/unsigned arithmetic, 8-bit/16-bit accumulator semantics, fixed-point scaling, sub-pixel rounding, and boundary clamping.
   - Map Direct Page addresses and WRAM structures using explicit types, bitfields, and enum constants (e.g., `Entity`, `StatusFlags`, `CompassHeading`, `ScriptThread`).
   - Group related subroutines into logical subsystem markdown files under `docs/disassembly/<category>/<topic>.md`.
3. **Confirmed Knowledge Registration:**
   - Every identified routine and entry point must have a companion markdown record in `src/games/evermore/localizations/knowledge/rom/<addr>.md`.
   - Each entry must specify:
     ```yaml
     ---
     addr: <HEX_ADDR>
     end: <HEX_END>
     kind: code
     category: 🧠
     name: <function_name>
     title: <Descriptive title>
     confidence: confirmed
     tags: [...]
     evidence: [...]
     see: [...]
     ---
     ```
4. **Automated Verification:**
   - Run integrity and legal checks:
     ```bash
     node tools/check-knowledge.mts && node tools/check-legal.mts
     ```
   - Ensure 0 errors, 0 unregistered addresses, and 0 legal violations (no raw ROM bytes, no absolute user directory paths).
5. **Dashboard Updates:**
   - Update metrics in `docs/disassembly/PROGRESS.md` (functions identified, documented, clean C, WRAM mapped).
   - Document newly analyzed routines and milestone summaries in the Session History.
6. **Granular Git Commits (Rule 0.5):**
   - Stage **only** specifically modified and newly created files (`git add <files>`), never `git add .`, `git add -A`, or `git commit -a`.
   - Verify staged list with `git diff --cached --name-only`.
   - Commit each completed batch immediately with a descriptive message and `-- <files>`.
   - If blocked by sandbox lock permissions, execute with `BypassSandbox: true`.

---

## 3. Prioritized Targets Queue

### Immediate Queue (Batch 67)

1. **Target 1: Enemy Spawn Archetype Parameter Loader & Hurtbox Bounder (`$8F:8D80` – `$8F:8E50`)**
   - **Location:** Bank `$8F` (`$8F:8D80` – `$8F:8E50`).
   - **Functions:** `enemy_spawn_archetype_unpack_and_bind` / `init_enemy_parameters`.
   - **Purpose:** Archetype parameter unpacking from ROM tables, base HP/defense initialization, hurtbox dimension assignment, and collision mesh placement.
   - **Target File:** `docs/disassembly/entities/enemy-archetype-spawn.md`.
   - **Knowledge Records:** `src/games/evermore/localizations/knowledge/rom/8f8d80.md`.

2. **Target 2: Special Attack Projectile Pierce & Homing Steering Math (`$8F:BA27` – `$8F:BA95`)**
   - **Location:** Bank `$8F` (`$8F:BA27` – `$8F:BA95`).
   - **Functions:** `projectile_piercing_step_and_homing_steer`.
   - **Purpose:** Physical projectile pierce persistence, target tracking angle vector calculations, trajectory adjustments, and lifetime countdown.
   - **Target File:** `docs/disassembly/combat/projectile-homing.md`.
   - **Knowledge Records:** `src/games/evermore/localizations/knowledge/rom/8fba27.md`.

3. **Target 3: Map Palette Cycle Timer & Shimmer HDMA Table Generator (`$80:A2A2` – `$80:A330`)**
   - **Location:** Bank `$80` (`$80:A2A2` – `$80:A330`).
   - **Functions:** `palette_cycle_timer_tick_and_hdma_update`.
   - **Purpose:** Background palette animation delay counters, multi-frame water shimmer DMA generation, and scanline offset table updates.
   - **Target File:** `docs/disassembly/engine-core/palette-shimmer.md`.
   - **Knowledge Records:** `src/games/evermore/localizations/knowledge/rom/80a2a2.md`.

---

### Upcoming Batches (The Road to 100% C Decompilation)

#### Batch 68: Boss AI Finite State Machines & Multi-Target Aggro
- **Addresses:** `$8F:BC00` – `$8F:BEE0`
- **Subsystems:** Magmar, Viper, Thraxx, and Megataur phase transition state tables, aggro radius evaluation, and multi-part vulnerability windows.
- **Documentation Target:** `docs/disassembly/combat/boss-state-machines.md`.

#### Batch 69: Advanced Ring Menu Sub-Item Layout & Spell Ring Caching
- **Addresses:** `$8E:A000` – `$8E:A400`
- **Subsystems:** Sub-item ring spawning, ingredient count rendering, circular position matrix calculations, and spell ring shortcut caching.
- **Documentation Target:** `docs/disassembly/ui/ring-menu-subitems.md`.

#### Batch 70: Script VM Secondary Callback Handlers & Far Stack Unwinding
- **Addresses:** `$8C:E000` – `$8C:E500`
- **Subsystems:** Far callback execution (`script_op_b3`), interruptible script yield mechanics, stack frame cleanup, and timer-driven script events.
- **Documentation Target:** `docs/disassembly/script-vm/far-callbacks.md`.

#### Batch 71: Mode 7 Horizon Pitch Perspective & Vanishing Point Scaling
- **Addresses:** `$8E:B350` – `$8E:B559`
- **Subsystems:** Perspective matrix transformations, hardware multiplier pitch coordinate scaling, dynamic horizon line clipping, and ground tile projection.
- **Documentation Target:** `docs/disassembly/engine-core/mode7-perspective.md`.

---

## 4. Milestone Checkpoints

| Barrier / Milestone | Status | Details |
|---|---|---|
| **70% Clean C Functions** | ✅ **Passed** | Broken in Session 58 (253 C functions) |
| **75% Clean C Functions** | ✅ **Passed** | Broken in Session 63 (304 C functions) |
| **80% Clean C Functions** | ✅ **Passed** | Broken in Session 65 (323 C functions) |
| **85% Function Identification** | ✅ **Passed** | Broken in Session 66 (346 identified roots, 85.9%) |
| **85% Clean C Functions** | 🎯 **In Sight** | Target: 343 C functions (currently 330) |
| **90% Function Identification** | 🎯 **Pending** | Target: 363 identified roots |
| **90% Clean C Functions** | 🎯 **Pending** | Target: 363 C functions |
| **100% CDL Roots Complete** | 🏆 **Ultimate Goal**| All 403 CDL roots decompiled into verified C |
