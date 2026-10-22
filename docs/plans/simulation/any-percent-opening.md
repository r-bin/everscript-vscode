# Any% Route Opening - Working Draft

> Status: route notes, not a verified speedrun or a simulation result. The
> opening is based on the proposed sequence; unresolved mechanics stay marked
> as questions.

This example starts from the normal fresh-game arrival in Southern Jungle and
follows the proposed route through the first Fire Eyes' village hut. It is a
test case for the route model in [routes.md](routes.md): actions are ordered,
room transitions are explicit, and fights must report odds rather than one
guessed outcome.

## Start State

- **Start map:** Southern Jungle, room `0x38` (the room catalog describes it as
  "south, where the game starts").
- **Entrance:** normal fresh-game arrival after the opening sequence. This is
  the chosen route start, rather than an arbitrary room entrance; exact arrival
  position and the point at which control is handed to the player still need
  validation.
- **Active character:** Boy by default.
- **Run state:** fresh-game state, unless a route preset is later defined.

Room names and ids come from
[the room catalog](../../../src/games/evermore/localizations/data/rooms.json).

## Route

### Southern Jungle — `0x38`

| Step | Action | Character / setup | Result or note |
|---|---|---|---|
| 1 | Start at the normal fresh-game arrival. | Boy (default) | Use the game's actual starting position; do not substitute a hand-picked tile. |
| 2 | Interact with the Petal Gourd. | Boy | `+10 Talons`. Confirm the pickup and amount in the room script. |
| 3 | Kill the first flower. | Both characters participate. | `+2 Talons`. Confirm what “both” means for control, damage, and reward attribution. |
| 4 | Let the flower kill the Boy. | Boy is the death target. | Measure incoming hits to death and elapsed time. Record any dog survival / respawn behavior. |
| 5 | Take the north exit trigger to the raptor screen. | Park the Dog on the trigger; when the Boy dies, press Select, as proposed. | Expected destination is room `0x5C`, with the Dog active. Verify the exact input order. |

### Raptors — `0x5C`

| Step | Action | Character / setup | Result or note |
|---|---|---|---|
| 6 | Wait. | Dog active after transition. | "Wait" is intentional route behavior; determine whether it means a fixed duration, waiting for an enemy/event, or waiting for a transition condition. |

### Fire Eyes' Village Huts — `0x51`

| Step | Action | Character / setup | Result or note |
|---|---|---|---|
| 7 | Interact with the Nectar Gourd. | Active character to verify. | `+100 Talons`. Confirm the gourd identity and amount from its script. |
| 8 | Take the exit trigger to Fire Eyes' village. | Active character to verify. | Destination is village room `0x25`; identify the exact exit and landing point. |

### Fire Eyes' Village — `0x25`

| Step | Action | Character / setup | Result or note |
|---|---|---|---|
| 9 | Enter the next hut. | TBD | Continue the route draft from the correct hut entrance. |
| 10+ | ... | TBD | Remaining route is not drafted yet. |

## What the room scripts say

The Routes tab plays this draft against the US ROM's room scripts
(`src/games/evermore/routes/data/any-percent.route.json`; the gourd is B-trigger #1,
the flower spawn 7, the hut door step-on #6 — each a guess to confirm):

- **0x38's Petal gourds give Petals, not Talons**: the enter script and B-triggers
  #1 (56,74) and #2 (28,37) each give 1 Petal. The room's one money gourd is B #0
  (64,48), 15 Talons. Step 2's "+10 Talons" matches neither.
- **0x38 → 0x5C is a real exit**: step-on #0 (64,16) leads to the raptors (on
  another branch to the village `0x25`).
- **No script in 0x5C changes the map to 0x51**: its step-ons lead to `0x25` and
  back to `0x38`. Arriving in the huts must come from somewhere else (a global or
  cutscene script) — still to trace.
- **0x51's Nectar gourd gives Nectar** (B #19, 37,7); money there is B #15 (11,26)
  18 Talons and B #20 (26,6) 30 Talons. Step 7's "+100 Talons" matches neither.
- **0x51 → 0x25**: eight step-on doors lead back to the village.
- **Played**: after the draft the party holds 1 Petal ($2315) and 1 Nectar ($2316),
  "Gourd in south Jungle" ($2268 bit 6) and "Gourd in Act1 Huts" ($2265 bit 3) are
  set, and the only Talons are the drafted flower drop (2).

## The fights, simulated

The Routes tab's **simulate** (party from WRAM at the end of the Podunk opening: Boy 30 HP,
attack 17 with the Bone Crusher, defence 5; Dog 36 HP, attack 17):

- **Step 3, Boy and Dog kill a Wimpy Flower** (18 HP, defence 28): each hit does 7–12 and always
  lands (evade 0). Both swinging at once kill it with their first hits 79% of the time, 0.22 s
  after the first swing (the Dog's strike comes at tick 12); otherwise a third hit comes with the
  Boy's next full charge, about 2.2 s. The flower drops 2 money by its record (`+$27`), which
  matches the draft's "+2 Talons".
- **Step 4, a flower kills the Boy**: it hits for 6–10 at 58.8%, so 4 hits (72%) or 5 (28%),
  needing 4–20+ attacks. Median 15.9 s, 10–90% 9.7–25.6 s; the fastest of 10,000 about 5.6 s.
  The waits are random: after each attack it recharges for 69 ticks, then engages on a 5/256 roll
  per tick. **Checked in the game** (`tools/routes/fight-in-game.mts`, 80 deaths, the Boy walked
  straight back after each knockback): median 16.5 s, 10–90% 9.8–27.2 s, fastest 7.1 s, 4 hits
  (73%) or 5, 154 frames between attacks on average and never under 102. The rules allow 3.55 s
  (three 10s with no waits), about one fight in 10⁸.

## Route Variants

Routes should be named variants over a shared action sequence, not separate
unrelated lists. A variant can inherit the common opening and record where its
actions diverge, so the planner can compare time, resources, and success odds.

- **Any%**: baseline route; exact ruleset and endpoint still to be specified.
- **Any% 16 HBs (for Thraxx)**: requested variant. "HB" and the exact Thraxx
  requirement are not expanded here; preserve the label until the route rules
  are confirmed.

Each route should identify its starting state, game version, endpoint, and any
assumptions that affect the result. A different starting state is a different
route replay, as described in [routes.md](routes.md).

## Planner Support Needed

### Fight Outcomes and Survival

For each fight, show a probability distribution for hits to kill and hits to
death, plus useful summary stats such as median, mean, and percentile bands.
Render the distribution so its shape is visible; do not force it into a normal
bell curve unless the underlying rolls justify that approximation. Include the
character and enemy stats used for each result, and let the route replay carry
the resulting state forward.

At minimum, the model needs current/max HP, attack and defense, weapon/charge
state, hit and evade behavior, enemy HP and attack, and any relevant buffs or
invulnerability. It must also model the time between attacks if it is to answer
“how long does this take?” Hits-to-death alone do not determine elapsed time.

### Route Variations

Support multiple named routes with shared prefixes and explicit divergence
points. The planner should compare route totals and per-fight odds, while keeping
each route's start state and assumptions visible. The `16 HBs` variant is a
motivating example, not a fully specified rule yet.

### Alchemy 8-Casts

Add 8-cast damage simulation only after the mechanic and menu-cancel behavior
have been researched. The eventual comparison needs both:

- eight casts without menu cancelling;
- eight casts with menu cancelling.

For each, establish the spell/formula, attacker and target stats, damage
distribution, resource cost, input sequence, and elapsed frames. Until those
facts are validated, the route can contain an 8-cast note but must not report a
damage or timing estimate.

## Questions to Resolve

- What are the exact start coordinates and controllable frame for the normal
  fresh-game arrival in room `0x38`?
- Which object/script is the first flower, and what does “both” mean in this
  step?
- How many hits and frames does the death setup require under the intended
  enemy behavior and starting stats?
- What is the precise Dog / Boy / Select sequence that reaches room `0x5C`?
- What event or duration does “wait” on the raptor screen mean?
- Which hut entrance and gourd trigger are intended in rooms `0x51` and `0x25`?
- What rules define the Any% endpoint and the "16 HBs" Thraxx variant?
- What exact 8-cast sequence is being compared, and what counts as menu
  cancelling?
