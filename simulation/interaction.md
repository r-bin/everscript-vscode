# 4. Walking the room

> Status: **not built.** This is the tab the rest of the folder exists for.

Everything on this page is the same mechanism: **click a thing, run its
script against [virtual-wram.md](virtual-wram.md), show what changed.** The
differences are only in what each thing is and what its result looks like.

## The interactions

**Exits.** Solved already — [map_transitions.md](../docs/script-format/map_transitions.md)
gives the destination and landing tile, [arrivals.md](../docs/script-format/arrivals.md)
gives the direction and is already clickable in the tab. Walking through one
means: run the transition's script, set the map and position in WRAM, and
re-derive the new room's scenario. This is the cheapest interaction to build
and the one that makes the rest feel like a game rather than a viewer.

**Ingredients.** [loot.md](../docs/script-format/loot.md) already reads what
a pickup gives and can write it back as Everscript. Looting is: run the
B-trigger's script, add to inventory, set the taken flag. **The dog's fake
pickup** is the interesting case — the dog can trigger the animation without
the item being awarded. That difference has to come out of the script
(different branch on who is active), not out of a rule someone typed.

**Levitate stones and revealers.** An object whose script rewrites the map:
[map_objects.md](../docs/map-format/map_objects.md) and the object-state
machinery in `src/maps/objects.ts` already render every state exactly, and
the Rooms tab already has state chips. Triggering one is that machinery
driven by the script instead of by a click — the stone slides aside, the
invisible bridge appears, and collision follows automatically because it is
looked up from the metatile the stamp rewrote.

**Doors.** A trigger whose script tests inventory for a key. Nothing new:
the branch already exists, it just needs the inventory in WRAM to be real.
A locked door should say *which* key it reads, not just "locked".

**Fights.** Clicking an enemy opens a window over
[damage.md](damage.md): pick physical or alchemy, and see the **distribution
of swings needed**, live. Not an average — a curve, because "13 hits, 70%"
is the shape of the question. The window must account for reach
([attack_boxes.md](../docs/script-format/attack_boxes.md)), for `INVINCIBLE`
(see [entities.md](entities.md)), and it must apply the reward: XP, weapon
and alchemy skill, written into WRAM like everything else.

**NPC dialog.** Show the text, show the choices, let one be picked, run the
branch. The text decoder does not exist yet and is the largest single piece
of unbuilt work on this page — worth its own note before it is started.

## Everything writes to one place

The value of doing these as scripts rather than as special cases is that the
state stays consistent: looting an ingredient changes what an alchemy cast
can do in the fight two rooms later, and a door opened with a key you never
picked up is impossible by construction rather than by a check someone
remembered to write.

It also means **every interaction is undoable** — keep the WRAM as a stack
of diffs, and stepping back is free. That is what makes
[routes.md](routes.md) buildable at all.

## Order to build

1. Exits, because they need nothing new and turn the tab into a world.
2. Loot and doors, because their scripts are already decoded.
3. Objects, because the rendering is already exact.
4. Fights, once `damage()` takes an attacker and a defender.
5. Dialog, last, and only after the text format has its own page.

## How we would know it is right

Per interaction, one traced case: do it in the emulator, snapshot WRAM
before and after, and assert the simulation's diff matches. The emulator
panel is already in this extension, so this is a test that can actually be
run rather than a plan for one.
