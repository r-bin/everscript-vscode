# routes/ — Routes tab

The radar panel's **Routes** tab: a route is an ordered list of actions through the game
(`docs/plans/simulation/routes.md`), **played** from a fresh game against one WRAM. A step that
names a trigger runs it: the simulation's cases of that trigger (`simulation/` `analyze`) are
tested against the state, the one that holds is applied — loot into its inventory byte, the
taken flag set, the gourd's room object opened, a map change moving the party. Looting the same
gourd again does nothing, the Dog gets nothing, an exit follows the story flags.

| Column | What |
|---|---|
| Rail | Routes, each with its variants (a variant shares the route's first `after` steps) |
| Middle | Totals; the state after the current step (room, Talons, items, flags set, opened objects); the steps by room, each with its effects and a mark (✓ the script agrees with the draft, ≠ differs, ✗ no script does it, · not a script step); route notes (start, files, assumptions, odds: not built, open questions) |
| Right | The current step's room drawn as the state leaves it (opened gourds open), its trigger boxes and the enemies the enter script places; the step's target lit, the hovered step's outlined; Fit / 1× / 2×; the step's result; ◀ Prev / Next ▶ (also ← →) |

**simulate** on a fight or death step (one with an `enemy`) opens a panel in place of the map:
the fight played 10,000 times tick by tick (`simulation/combat/`) — the time it takes as a histogram
with the best case and the median, hits and swings, the inputs and what is assumed. Fight: the
party members the step names (`Both` = Boy and Dog) attack until the enemy dies. Death: the one it
names stands in reach until the enemy kills it. The enemy is the step's spawn (its character
record and animations); the party comes from the route's `start.party`, as WRAM holds it. What is
random in the game is random in the model: the enemy's engage roll each idle tick (the flower's
wait), knockback lengths (`hold_random`), the to-hit roll (once per swing) and the damage roll.

What the scripts do not decide is applied as drafted and labelled so: enemy drops (fights have
no model yet), a move between rooms no script in the route makes. Bytes no step wrote are 0.

Routes come from `data/` (the drafts that ship) and from every `*.route.json` in the workspace
root and its `routes/` folder.

## Route file

```json
{ "id": "any-percent", "title": "Any%", "status": "draft", "version": "us",
  "source": "docs/plans/simulation/any-percent-opening.md",
  "start": { "room": "0x38", "note": "…", "party": { "source": "…", "weapon": 1, "dogForm": 0,
             "boy": { "hp": 30, "atk": 17, "def": 5, "evade": 34, "hitRate": 30, "chargeSpeed": 10 }, "dog": { … } } },
  "endpoint": "…", "assumptions": ["…"],
  "steps": [ { "room": "0x38", "kind": "loot", "action": "…", "who": "Boy", "at": "b1",
               "claim": "+10 Talons", "talons": 10, "check": "…" },
             { "room": "0x38", "kind": "fight", "action": "…", "enemy": 7, "talons": 2 },
             { "room": "0x38", "kind": "exit", "action": "…", "who": "Dog", "at": "step0", "to": "0x5c" } ],
  "variants": [ { "id": "16-hbs", "title": "…", "after": 9, "steps": [] } ],
  "questions": ["…"] }
```

`kind`: `start`, `loot`, `fight`, `death`, `exit` (needs `to`), `wait`, `enter`. `at`: the trigger
the step runs, `b<n>` (B-trigger) or `step<n>` (step-on). `enemy`: the index of the enter script's
spawn the step is about. `who`: `Dog` makes the dog the controlled character. `talons` on a
trigger step is what the draft claims (checked); on any other step it is applied as drafted. A
problem in a file is listed in the route notes, never guessed around.

| File | Role |
|---|---|
| `index.ts` | Public API: `handlesRoutesMessage` / `handleRoutesMessage`, `buildRoutesTabHtml` |
| `host.ts` | `routesInit` (read, play, answer with the room overlays), `routesPicture`, `routesOpen`; trigger analyses, overlays and pictures cached per ROM |
| `render-routes-tab.ts` | The pane scaffold |
| `model/route.ts` | The file format, `parseRoute`, `routeViews` (every step played with `simulation/play.ts`: its effects and the state after it) |
| `webview/fight-panel.dom.ts` | The simulation panel (histogram, counts, inputs, assumptions) |
| `data/any-percent.route.json` | The Any% opening draft (from `docs/plans/simulation/any-percent-opening.md`) |
| `webview/routes-tab.dom.ts` | The page (bundle `RoutesTab`, set up inside the radar's script) |
| `webview/routes-tab.css` | What the tab adds to the Scripts tab's styles (`rte-` prefix) |

Host protocol: page → `routesInit`, host → `routesIndex { routes, rooms, files, problems, rom }`;
page → `routesPicture { room, opened }`, host → `routesPicture { room, key, uri, width, height }`;
page → `routesFight { route, n }`, host → `routesFight { route, n, report, inputs, until, party }`;
page → `routesOpen { file }` opens a route file or its notes.

## Rules for changing this folder

Dependencies, invariants and tests: [AGENTS.md](AGENTS.md).
