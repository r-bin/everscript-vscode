# 0. Virtual WRAM — the state everything else reads

> Status: **not built.** The hard part, and the reason nothing downstream has
> started.

Every other page here is a view over one mutable state: the game's WRAM as
the simulation believes it to be. Getting this wrong quietly is worse than
not having it, so it is first.

## What it has to hold

| | Where in WRAM | Read by |
|---|---|---|
| Story flags and script memory | the `$7E2xxx` block scripts test and set | enter-script branches, doors, dialog |
| Party stats | HP, levels, weapon and alchemy XP | damage, fight odds, routes |
| Inventory | ingredients, weapons, armour, keys | loot, doors, alchemy casts |
| Entity slots | the `$7E3Dxx`+ table `src/maps` already documents | placed NPCs, fights |
| Current room | map id, the Boy's position and plane | interaction |

The first three are the ones scripts branch on. The entity table only
matters once a fight or a placed NPC is being simulated.

## The honest-starting-state problem

"Base WRAM" is not one thing. The same room entered in act 1 and revisited
in act 3 differ, and the ROM does not say which the user means. Three
options, in increasing order of how much they can be trusted:

1. **Fresh game** — every flag clear. Cheap, reproducible, and wrong for
   most of the game.
2. **Named presets** — "after Thraxx", "after Vigor", each captured once
   from an emulator and committed as a small keyed diff, not a 128 KB dump.
3. **A live snapshot** — read out of the running emulator panel this repo
   already embeds. Exactly right, and only available when it is running.

Build 1 and 3 first; 2 is a convenience that can be filled in from 3. The
choice must be **visible in the UI at all times and switchable**, never a
default the user has to discover. A simulation that silently picks one is
the failure mode this project keeps avoiding.

## The evaluator

`src/script/expression.ts` renders the postfix operand grammar as text. The
simulation needs the same grammar producing a *value*. These two must not
drift, so build one of:

- the evaluator beside the renderer, with a test that walks every operand in
  the ROM through both and asserts the rendering matches a re-render of the
  evaluated form; or
- the renderer rebuilt on top of the evaluator, so there is only one parse.

The second is cleaner and is what [operand_grammar.md](../docs/script-format/operand_grammar.md)
already implies. Either way it is one parse of one grammar, checked against
all ~1600 operand sites the decoder already walks.

## Undecidable is a result

Some conditions will read state the model does not carry — a flag set by a
routine outside the script engine, an RNG draw, a timer. The interpreter
must have a fourth outcome besides true/false/error:

```
{ kind: 'undecided', reason: 'reads $7E2A41, never written by any script' }
```

and the caller decides what to do with it: a spawn view explores **both**
branches and labels the result, a route replay refuses to score past it.
Counting these is the metric that says how much of the game the simulation
actually covers — start by printing it for all 128 rooms.

## How we would know it is right

- Run an enter script under the simulation with a snapshot taken at the same
  moment in the emulator, and diff the resulting entity table against the
  emulator's. That is the whole test, and it is available today because the
  panel is already embedded.
- Cheaper first step: for every room, assert the interpreter reaches an `END`
  and never reads past the script's own bounds. The decoder already knows
  where those are.
