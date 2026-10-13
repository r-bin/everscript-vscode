# Combat Damage & Route Planning — Open Tasks & Roadmap

> Domain: Damage Calculation Models (`src/scaling/`, `docs/alchemy-damage.md`, Route Planner)
> Master Reference: `docs/atlas-trace-request.md`
> Status key: 🟡 blocked on user trace · 🟢 designed roadmap · ✅ completed

---

## 1. Verified Completed Features (Removed from Open Backlog)

- ✅ **Unified Physical Damage Engine**:
  - *Implemented in:* [`src/scaling/webview/damage-math.js`](file:///Users/v/Documents/GitHub/everscript-vscode/src/scaling/webview/damage-math.js)
  - Single shared physical damage formula across chart, stats panels, crosshair hover, and documentation previews.
- ✅ **Offensive Alchemy & Spell Damage Curves**:
  - *Implemented in:* [`src/scaling/webview/alchemy-math.js`](file:///Users/v/Documents/GitHub/everscript-vscode/src/scaling/webview/alchemy-math.js) and [`chart.js`](file:///Users/v/Documents/GitHub/everscript-vscode/src/scaling/webview/chart.js)
  - Full 16-bit RNG sampling (65,536 samples per calculation), spell levels 0–9, might scaling, magic defense reduction, and 999-cap probability curves.

---

## 2. Active Open Tasks

### 2.1 Atlas Damage Traces & Formula Verification
- **Status: 🟡 Blocked on user hardware trace** (see `docs/atlas-trace-request.md`)
- Regular physical hits are anchored against in-game traces and Lua math helpers.
- **Pending evidence:**
  - Capture Atlas-specific damage trace for a hit at **100% charge**.
  - Capture Atlas-specific damage trace for a hit **below 100% charge** (prefer same enemy).
  - Inspect registers `$4ED3`, `$4EE1`, `$4EE3`, `$4EE5` (duration/modifiers) and enemy defense source.
  - Replace the current hardcoded approximation (`attack - 480`) with a trace-backed live-status formula.

### 2.2 Route Tab Simulation
- **Status: 🟢 UI mock shipped; progression simulation open**
- Ground route progression and speedrun routing simulation in verified physical and spell damage models once Atlas traces are integrated.
