# Arrivals: the doors that lead into a room

> Status: **built.** `src/script/arrivals.ts`, shown on the Rooms map.

A room's own scripts say where they *send* you. Nothing in a room says where
you *come in* — an entrance is only a `CHANGE MAP` somewhere else. So the
index is built the other way round: walk every map's triggers once, collect
each transition, and key them by destination.

That costs **45 ms for all 128 rooms** and is cached per ROM, so the first
room pays for it and the rest are free.

## What a door carries

`extractTransitions` ([map_transitions.md](map_transitions.md)) already reads
the destination and the landing position out of the script. Two things are
added here:

**Map units.** The landing position is in pixels; the Rooms map draws in
8-pixel units, so `x / 8` is what a marker is placed at.

**The direction.** The trigger calls a global script on the way out, and
those are named:

```
"Prepare room change? South exit/north entrance outdoor-outdoor?"
"Prepare room change? East exit/west entrance outdoor-outdoor?"
```

The *exit* word is the one that survives: leaving southwards, you arrive at
the destination's north edge still walking south. So the arrow drawn on the
map points the way the player is moving as they come in. A transition whose
script names no such preparation gets no arrow rather than a guessed one.

## On the map

Each arrival is a circle at the landing tile with that arrow, labelled with
the room it comes from; clicking it opens that room. Doors that land on the
same tile from the same room are merged — a wide doorway is several trigger
rows leading to one spot, and six markers on one tile say less than one.

Room `0x76` has two: from `0x6C` walking west, and from `0x7B` walking south.

## What this is not

Still the **superset**, like the spawns: a script that branches can reach
several destinations and all of them are indexed. A door that only opens
after a story flag is listed the same as one that always works. Deciding that
needs [the simulation](../room-simulation.md).
