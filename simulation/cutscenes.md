# 5. Playing a cutscene out

> Status: **not built**, and the least certain page here. Listed because it
> was asked for; scoped down because most of it is animation work, not
> simulation work.

A cutscene is an ordinary script. It moves entities, sets facings, plays
animations, shows text and waits. The simulation already has, or plans, most
of the verbs:

| Cutscene verb | Where it already lives |
|---|---|
| place / remove an entity | [entities.md](entities.md) |
| set a facing, play an animation | [`character-animation.ts`](../src/maps/character-animation.ts) |
| change the map | [map_transitions.md](../docs/script-format/map_transitions.md) |
| rewrite the scenery | object stamps, `src/maps/objects.ts` |
| set a flag | [virtual-wram.md](virtual-wram.md) |
| show text | **missing** — the same gap as dialog |

## What is genuinely new

**Movement over time.** Placing an entity is a write; *walking* it from A to
B is a routine running for N frames. The frame timer is understood
([animation_format.md](../docs/script-format/animation_format.md): entity
`+0x05`, `$908100`), and so is the collision that would stop it
([hitboxes.md](../docs/script-format/hitboxes.md)) — but nothing yet steps a
simulation forward one frame at a time. Everything else in this folder is
event-driven and does not need a clock.

**Waits.** A cutscene script blocks on timers and on animations finishing.
That means the interpreter needs to suspend and resume, not just run to
`END`. Worth knowing before the interpreter's shape is fixed in
[virtual-wram.md](virtual-wram.md) — a generator/coroutine shape costs
nothing now and is painful to retrofit.

## A cheaper first version

Before animating anything, a **storyboard**: walk the cutscene script and
list what it does, in order, with each step's entities and positions
resolved and rendered as a still. That is buildable on what exists today,
it is genuinely useful for understanding a scene, and it is the same walk
the animated version would need.

Do that first. Decide whether real playback is worth it after seeing how
many scripts the storyboard already explains.

## How we would know it is right

Storyboard: the step list must match what the decoder already prints for
the same script — this is a presentation of decoded data, so it cannot be
wrong in a new way.

Playback: only a side-by-side against the emulator, frame count included.
Do not claim playback is faithful without that.
