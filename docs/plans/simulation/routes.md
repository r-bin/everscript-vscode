# 6. Routes — saving a run and replaying its odds

> Status: **not built.** An earlier sketch exists as
> [docs/route-planner.md](../docs/route-planner.md), from before the
> simulation was on the table; this supersedes its scope but keeps its data
> model.

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
per-fight numbers and combine them afterwards. `route-planner.md` already
has the level-up rule: XP awarded after the kill, at most one level per
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
