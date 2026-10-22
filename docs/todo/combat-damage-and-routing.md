# Combat Damage & Route Planning — Open Tasks & Roadmap

> Domain: Damage Calculation Models (`src/games/evermore/scaling/`, Route Planner)
> Shipped features reference: [`docs/scaling-scenarios.md`](../scaling-scenarios.md) (Physical Damage), [`docs/alchemy-damage.md`](../alchemy-damage.md) (Offensive Alchemy)
> Master Reference: [`docs/atlas-trace-request.md`](../atlas-trace-request.md)
> Status key: 🟡 blocked on user trace · 🟢 designed roadmap

---

## 1. Active Open Tasks

### 1.1 Atlas Damage Traces & Formula Verification
- **Status: 🟡 Blocked on user hardware trace** (see `docs/atlas-trace-request.md`)
- Regular physical hits are anchored against in-game traces and Lua math helpers.
- **Pending evidence:**
  - Capture Atlas-specific damage trace for a hit at **100% charge**.
  - Capture Atlas-specific damage trace for a hit **below 100% charge** (prefer same enemy).
  - Inspect registers `$4ED3`, `$4EE1`, `$4EE3`, `$4EE5` (duration/modifiers) and enemy defense source.
  - Replace the current hardcoded approximation (`attack - 480`) with a trace-backed live-status formula.

### 1.2 Route Tab Progression Simulation
- **Status: 🟢 Routes tab shipped (route files, room-script checks); progression simulation open**
- Ground route progression and speedrun routing simulation in verified physical and spell damage models once Atlas traces are integrated.
