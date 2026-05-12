# Route Planner Draft

## Goal

- Add a route-planner tab to the extension.
- Model a route as an ordered list of enemy kills.
- Focus on boy-only planning for now.
- Treat dog support as out of scope in the first version.

## Core Facts

- A route step is one enemy encounter plus one chosen kill method.
- Kill methods should at least include:
  - Physical
  - Alchemy
  - Alchemy 8-cast
- A route needs to track progression after every kill:
  - Character XP
  - Character level
  - Alchemy XP
  - Alchemy level
- Level-up rule for the mock/spec:
  - XP is awarded after the kill.
  - At most one character level can be gained per XP event.
  - Excess XP carries forward after the level-up.

## Example Route Steps

- Thraxx's Heart with 8-casts
- Skelesnail with 8-casts to level alchemy
- Magmar with alchemy for Act 1 any%
- Sterling with physical damage / atlas-glitch checks

## Per-Step Data Model

- Enemy name / enemy id
- Method
- Quantity
- Expected hits
- Expected misses
- Expected atlas overflows
- XP reward
- Alchemy XP reward
- Notes

## Simulation Output

- The simulation button should eventually report per enemy:
  - Hits required to kill
  - Miss count
  - Atlas overflow count
  - Resulting XP total
  - Resulting character level
  - Resulting alchemy XP / level
- The simulation should also report route totals:
  - Total hits
  - Total misses
  - Total atlas overflow events
  - Final character level
  - Final alchemy levels

## Known Missing Tech

- Spell damage graphs are still missing.
- Alchemy 8-cast damage tables are still missing.
- Enemy XP tables are not wired into the extension UI yet.
- Character XP curve / level thresholds are not wired into the extension UI yet.
- Alchemy XP / alchemy level thresholds are not wired into the extension UI yet.
- Enemy HP / scripted invulnerability windows are not represented yet.
- Multi-target spell routing is not represented yet.

## Mock UI Requirements

- Show a left column with sample route-step templates.
- Show a main route list with add/remove interactions.
- Show a simulation panel with placeholder output.
- Keep all labels explicit and factual.
- Use bullets for requirement text and assumptions.

## First Real Implementation Pass

- Reuse scaling-tab physical expected-hit data for physical route steps.
- Add a machine-readable XP table for the boy.
- Add a machine-readable alchemy XP table.
- Add spell damage graphs for the most common 8-cast cases.
- Simulate one kill at a time in route order.
- Persist route rows in the webview state.

## Open Questions

- Should route steps support fixed enemy level overrides?
- Should enemy scale patch state be part of the route configuration?
- Should physical steps use expected value, percentile bands, or full RNG simulation by default?
- Should route steps support scripted notes like “walk 3 frames” / “menu once” later?