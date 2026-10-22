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

What the scripts do not decide is applied as drafted and labelled so: enemy drops (fights have
no model yet), a move between rooms no script in the route makes. Bytes no step wrote are 0.

Routes come from `data/` (the drafts that ship) and from every `*.route.json` in the workspace
root and its `routes/` folder.

## Route file

```json
{ "id": "any-percent", "title": "Any%", "status": "draft", "version": "us",
  "source": "docs/plans/simulation/any-percent-opening.md",
  "start": { "room": "0x38", "note": "…" }, "endpoint": "…", "assumptions": ["…"],
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
| `model/route.ts` | The file format, `parseRoute`, `routeViews` (every step with its effects and the state after it) |
| `model/simulate.ts` | The state, conditions evaluated against it, `playStep` (pure) |
| `data/any-percent.route.json` | The Any% opening draft (from `docs/plans/simulation/any-percent-opening.md`) |
| `webview/routes-tab.dom.ts` | The page (bundle `RoutesTab`, set up inside the radar's script) |
| `webview/routes-tab.css` | What the tab adds to the Scripts tab's styles (`rte-` prefix) |

Host protocol: page → `routesInit`, host → `routesIndex { routes, rooms, files, problems, rom }`;
page → `routesPicture { room, opened }`, host → `routesPicture { room, key, uri, width, height }`;
page → `routesOpen { file }` opens a route file or its notes.

## Rules for changing this folder

Dependencies, invariants and tests: [AGENTS.md](AGENTS.md).
