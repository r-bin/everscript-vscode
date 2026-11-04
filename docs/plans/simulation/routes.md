# 6. Routes — saving a run and replaying its odds

> Status: **replay of script steps built, odds not built.** The radar's Routes
> tab (`src/games/evermore/routes/`) reads route files (`*.route.json`) and plays
> them from a fresh game against one WRAM: a step naming a trigger applies the
> case of its script that holds (loot, taken flag, opened object, map change),
> shown on the room's map step by step. A fight or death step can be simulated
> (`src/games/evermore/simulation/combat/`, the game's rules in [docs/entities/combat.md](../../entities/combat.md)): the time it takes and the hits it needs as distributions, from
> the ROM's records, animations and hit table and the route's party. Checked in
> the game for a Wimpy Flower killing the Boy (`tools/routes/fight-in-game.mts`);
> other fights not yet. Drops are still the draft's numbers. An earlier standalone
> route-planner sketch (from before the simulation was on the table) is folded
> into the last section below.

Opening example: [Any% route draft](any-percent-opening.md). It records the
Southern Jungle start through the first Fire Eyes' village hut and lists the
combat and route-variant support the planner needs.

## What a route is

An ordered list of **actions** taken in the simulation — exactly the
interactions in [interaction.md](interaction.md), recorded as they happen:

```
1. enter 0x0a from 0x09, walking south
2. loot  0x0a b-trigger #2   (Wax)
3. fight 0x0a Hedgadillo     physical
4. exit  0x0a east -> 0x0b
...
```

Because every interaction is already a diff against
[virtual-wram.md](virtual-wram.md), a route is just that log, and replaying
it is re-applying the diffs from the chosen starting state. Nothing extra
has to be modelled — which is the argument for building interaction on one
WRAM in the first place.

Save as JSON next to the workspace, with the starting state named in the
file. A route replayed from a different starting state is a different
route and should say so rather than quietly producing different numbers.

## Replay, and the odds

Each step is deterministic except the fights, which are distributions from
[damage.md](damage.md). So a replay produces:

- **per fight**: the distribution of swings, and the chance of winning given
  the HP the route has at that point ("Thraxx, 13 hit bombs, 70%");
- **per act**: the product over its fights, which is the number that makes
  the feature worth having ("act 1: 50%");
- **the first step that fails**, when a route is impossible — a door with no
  key, an alchemy cast with no ingredients. That is more useful than a
  probability, and it is free, because the inventory is real.

Two cautions worth writing down now:

**Independence is an assumption.** Multiplying per-fight probabilities
assumes the rolls are independent and that the route does not adapt. Real
runs adapt. Label the act number as "if you never deviate", or model a
simple policy ("retry on bad rolls") and say which is shown.

**XP feeds back.** A fight's reward changes the levels the next fight is
computed at, so the replay must be sequential — you cannot precompute the
per-fight numbers and combine them afterwards. The level-up rule
(see "From the earlier route-planner sketch"): XP awarded after the kill, at most one level per
event, excess carries forward.

## What this needs that does not exist

Only the fight reward side: XP, weapon skill and alchemy skill per enemy,
and the level curves. The enemy records are decoded; the reward fields have
not been identified yet and are the one piece of ROM research this page
depends on.

## How we would know it is right

- **Replay determinism**: the same route from the same starting state
  produces the same WRAM, byte for byte. Cheap and catches most bugs.
- **A known run**: take a documented any% route, replay it, and check every
  step is reachable. A route that a human demonstrably performed and the
  simulation calls impossible is a bug in the simulation, and that is the
  most valuable test on this page.
- **The odds themselves** cannot be validated against anything but repeated
  play, so present them as what they are: the model's numbers, with the
  assumptions above shown next to them.

## From the earlier route-planner sketch

Kept from `docs/route-planner.md` (archived 2026-11-03, see [archive/INDEX.md](../../archive/INDEX.md)); its
mock-UI and first-pass lists were dropped because the Routes tab now exists.

- **Scope of the first version:** the Boy only; the dog is out of scope.
- **A step** is one enemy encounter plus one kill method: *physical*, *alchemy* or *alchemy 8-cast*.
  Examples from the sketch: Thraxx's Heart with 8-casts; Skelesnail with 8-casts to level alchemy;
  Magmar with alchemy for act 1 any%; Sterling with physical damage and atlas-glitch checks.
- **Progression tracked after every kill:** character XP and level, alchemy XP and level.
  **Level-up rule:** XP is awarded after the kill, at most one character level per XP event, excess XP
  carries forward.
- **Per-step data:** enemy name / id, method, quantity, expected hits, expected misses, expected atlas
  overflows, XP reward, alchemy XP reward, notes.
- **Output per enemy:** hits to kill, misses, atlas overflows, resulting XP / level / alchemy XP / level.
  **Per route:** total hits, misses, atlas overflow events, final character level, final alchemy levels.
- **Missing when the sketch was written (2026-10; re-check, unverified now):** spell damage graphs and
  alchemy 8-cast damage tables; enemy XP tables and character / alchemy XP curves wired into the UI;
  enemy HP with scripted invulnerability windows; multi-target spell routing.
- **Open questions:** fixed enemy level overrides per step? Is the enemy-scale patch state part of the
  route configuration? Physical steps by expected value, percentile bands or full RNG simulation by
  default? Later support for scripted notes such as "walk 3 frames" or "menu once"?
