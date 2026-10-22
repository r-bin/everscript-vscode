# routes/ — Routes tab

The radar panel's **Routes** tab: a route is an ordered list of actions through the game
(`docs/plans/simulation/routes.md`); the tab shows each route and its variants as runs of steps
per room, carries the drafted Talons forward, and checks every step against what the room's
scripts in the user's ROM do. Three columns like the Scripts tab (it shares its styles).

| Column | What |
|---|---|
| Rail | Routes, each with its variants (a variant shares the route's first `after` steps) |
| Middle | Totals (steps, rooms, Talons as drafted, to verify, what the room scripts confirm); then one box per room run: kind, action, what the draft says, the Talons tally, the check (✓ agree, ≠ differ, ✗ not found, · nothing to check) |
| Right | The route's terms (start, version, endpoint, file, notes), assumptions, odds (not built), open questions; or the selected step with its check, the room's money and exits, and a link to the room on the Maps tab |

The checks (`model/route.ts` `checkStep`) use `script-model`: a `loot` step names the reward its
pickup gives (`PETAL`, `NECTAR`, `MONEY`), an `exit` step the room it leads to. Fights have no
check until the damage and reward models exist (routes.md, `docs/todo/combat-damage-and-routing.md`).

Routes come from `data/` (the drafts that ship) and from every `*.route.json` in the workspace
root and its `routes/` folder.

## Route file

```json
{ "id": "any-percent", "title": "Any%", "status": "draft", "version": "us",
  "source": "docs/plans/simulation/any-percent-opening.md",
  "start": { "room": "0x38", "note": "…" }, "endpoint": "…", "assumptions": ["…"],
  "steps": [ { "room": "0x38", "kind": "loot", "action": "…", "who": "Boy",
               "claim": "+10 Talons", "talons": 10, "loot": "PETAL", "check": "…" },
             { "room": "0x38", "kind": "exit", "action": "…", "to": "0x5c" } ],
  "variants": [ { "id": "16-hbs", "title": "…", "after": 9, "steps": [] } ],
  "questions": ["…"] }
```

`kind`: `start`, `loot`, `fight`, `death`, `exit` (needs `to`), `wait`, `enter`. A problem in a
file is listed on the right, never guessed around.

| File | Role |
|---|---|
| `index.ts` | Public API: `handlesRoutesMessage` / `handleRoutesMessage`, `buildRoutesTabHtml` |
| `host.ts` | `routesInit` (read, check, answer) and `routesOpen`; room facts from `script-model`, cached per ROM |
| `render-routes-tab.ts` | The pane scaffold |
| `model/route.ts` | The file format, `parseRoute`, `checkStep`, `routeViews` (pure) |
| `data/any-percent.route.json` | The Any% opening draft (from `docs/plans/simulation/any-percent-opening.md`) |
| `webview/routes-tab.dom.ts` | The page (bundle `RoutesTab`, set up inside the radar's script) |
| `webview/routes-tab.css` | What the tab adds to the Scripts tab's styles (`rte-` prefix) |

Host protocol: page → `routesInit`, host → `routesIndex { routes, files, problems, rom }`;
page → `routesOpen { file }` opens a route file or its notes.

## Rules for changing this folder

Dependencies, invariants and tests: [AGENTS.md](AGENTS.md).
