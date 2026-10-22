# simulation/combat/ — fights, simulated

A melee fight played tick by tick, many times, into distributions: how long it takes, how many
hits and swings, how often someone is knocked back. The game's rules behind every step, the
random rolls and the check against the real game: [docs/entities/combat.md](../../../../../docs/entities/combat.md).

| File | Does |
|---|---|
| `fight.ts` | The tick loop: charge, engage roll, swing, one to-hit roll per swing, the damage roll, knockback with its `hold_random`, attacks cut short by a hit. `simulateFight` (seeded, 10,000 runs by default) → histogram, stats, hits, swings; `bestCase` the floor the rules allow |
| `inputs.ts` | The fighters from the ROM: an enemy's character record and its attack/knockback animations (timed by the animation VM), the Boy's weapon entry, the Dog's form entry, the hit-chance table `$8F:BAAF`; `fightFor` turns a fight or death step into a setup |
| `party.ts` | The party a fight starts from (WRAM records `$0A26` / `$0A70`) |
| `index.ts` | Public API |

Used by the Routes tab (`routes/host.ts`, `routesFight`). Checked against the game by
`tools/routes/fight-in-game.mts`; rerun it after changing a rule here.
