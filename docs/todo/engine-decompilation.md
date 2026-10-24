# Secret of Evermore Engine Decompilation — Autonomous /goal Continuation

> **Domain:** Complete C Decompilation & Static Reverse Engineering of the Secret of Evermore SNES Engine  
> **Master Dashboard & Progress Tracker:** [`docs/disassembly/PROGRESS.md`](../disassembly/PROGRESS.md)  
> **Autonomous Agent Persona & Guidelines:** [`.agents/agents/decomp-curator.md`](../../.agents/agents/decomp-curator.md)  
> **Current Landmark (Session 67):** **348 / 403** Identified (86.4%) · **346 / 403** Documented (85.9%) · **336 / 403** Clean C Functions (83.4%) · **12,151** WRAM Bytes Mapped (37.6%)

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

1. **Audit finding: `$8F:BA27` is inside the melee hit-chance routine `$8F:BA06`–`$8F:BAAE`, not projectile-homing code.** The routine now has a clean C reconstruction in `reconstructed-c/8F/8FBA06_melee_hit_chance.c`; details and limits are in `docs/disassembly/combat/projectile-homing.md`.

2. **Audit finding: `$80:A2A2` is inside the existing HDMA gradient builder `$80:A1B4`–`$80:A2DF`.** Its clean C reconstruction is `reconstructed-c/80/80A1B4_hdma_gradients.c`; `$80:A2E0` begins a separate existing routine. The proposed palette-shimmer target was not a missing decompilation.

No verified target remains from this queue. Select the next item from a fresh CDL/function inventory; do not infer a missing routine from an interior address or stale purpose label.

---

### Upcoming Batches (The Road to 100% C Decompilation)

#### Batch 68: Boss AI Finite State Machines & Multi-Target Aggro
- **Audit result:** `$8F:BC00-$8F:BE22` is the hit-chance pointer/data table, not boss AI code. No routine is established in the remaining `$8F:BE23-$8F:BEE0` range by this audit. Existing boss documentation points to routines in `$8F:Dxxx`.

#### Batch 69: Advanced Ring Menu Sub-Item Layout & Spell Ring Caching
- **Audit result:** The broad range does not establish the proposed ring-menu behavior. Added evidence-backed reconstructions at `$8E:A091-$8E:A0B2` and `$8E:A3EB-$8E:A443`; the latter's caller and data semantics remain unresolved. `$8E:A400` is inside the `$A3EB` routine.

#### Batch 70: Script VM Secondary Callback Handlers & Far Stack Unwinding
- **Audit result:** `script_op_b3` is already reconstructed at `$8C:D331-$8C:D34B`. Added opcode reconstructions at `$8C:E040-$8C:E08D` and `$8C:E4B1-$8C:E5A0` (opcodes `0xB9` and `0x97` respectively). `$8C:E000` is interior to an earlier handler.

#### Batch 71: Mode 7 Horizon Pitch Perspective & Vanishing Point Scaling
- **Audit result:** `$8E:B350-$8E:B505` is inside the `$8E:B33D` sample-and-sprite-dispatch routine, now control-flow reconstructed in `reconstructed-c/8E/8EB02C_mode7_flight.c`; `$8E:B520-$8E:B559` is a separate sprite projection routine. `$8E:B506-$8E:B51F` is indexed data, not code.

---

## 4. Milestone Checkpoints

| Barrier / Milestone | Status | Details |
|---|---|---|
| **70% Clean C Functions** | ✅ **Passed** | Broken in Session 58 (253 C functions) |
| **75% Clean C Functions** | ✅ **Passed** | Broken in Session 63 (304 C functions) |
| **80% Clean C Functions** | ✅ **Passed** | Broken in Session 65 (323 C functions) |
| **85% Function Identification** | ✅ **Passed** | Broken in Session 66 (346 identified roots, 85.9%) |
| **85% Clean C Functions** | 🎯 **In Sight** | Target: 343 C functions (currently 336) |
| **90% Function Identification** | 🎯 **Pending** | Target: 363 identified roots |
| **90% Clean C Functions** | 🎯 **Pending** | Target: 363 C functions |
| **100% CDL Roots Complete** | 🏆 **Ultimate Goal**| All 403 CDL roots decompiled into verified C |
