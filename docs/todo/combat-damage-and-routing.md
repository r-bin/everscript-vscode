# Combat Damage & Route Planning — Open Tasks & Roadmap

> Domain: Damage Calculation Models (`src/scaling/`, `docs/alchemy-damage.md`, Route Planner)
> Master Reference: `docs/atlas-trace-request.md`
> Status key: 🟡 blocked on user trace · 🟢 designed roadmap

---

## 1. Atlas Damage Traces & Formula Verification

### 1.1 Trace Request Requirements
To prove the Atlas subtraction and clamp-bypass mechanics against the SNES engine rather than empirical behavior matching, real Atlas damage traces are required:
- Capture Atlas-specific damage trace for a hit at **100% charge**.
- Capture Atlas-specific damage trace for a hit **below 100% charge**.
- Capture both traces against the **same enemy** (removing defense variables).
- Target memory and status values to log:
  - `$4ED3`, `$4EE1`, `$4EE3`, `$4EE5` (Atlas status duration and modifier registers)
  - Boy attack before the hit
  - Current charge / stamina value
  - Enemy defense source
  - Pre-RNG damage variable (`wram0012` context)
  - Final displayed damage number

### 1.2 Open Mathematical Questions
- Does the Atlas subtraction apply unconditionally at 100% charge, or only below 100% charge?
- Is the weak 100% Atlas hit caused by the standard signed clamp remaining active?
- Is the mostly-999 sub-100% hit caused by wrapped 16-bit underflow bypassing the clamp?
- Can the hardcoded approximation (`attack - 480`) be replaced by a live-status-driven formula from `$4EE1..$4EE5`?

### 1.3 Implementation Actions (Once Trace Received)
- Update Scaling tab physical damage engine with trace-backed formulas.
- Verify tests reflect true ROM execution path.
- Keep the Scaling tab on **one unified physical damage formula** (no separate shortcut range formulas in stats panels, crosshair info, or previews).

---

## 2. Spell Damage Modeling & Graphs

- **Status: 🟡 feature gap**
- Move alchemy calculations from simple placeholders to full formula curves in the Scaling and Route tabs.
- Incorporate formula level, alchemy slot bonuses, magic defense subtraction, and status timers (see `.agents/skills/alchemy-spell-mechanics/SKILL.md`).
- Add real interactive spell damage graphs alongside physical weapon charts.

---

## 3. Route Tab Simulation

- **Status: 🟢 UI mock shipped; simulation pending**
- Keep the Route tab visible as a mock UI during development.
- Flesh out full speedrun / route progression simulation only after physical and alchemy damage models are mathematically grounded to avoid fake certainty.
- Support step-by-step route checklists (gourds collected, boss kill times, formula levels).
