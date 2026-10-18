---
addr: 8fafae
end: 8fb000
kind: code
category: 🧠
name: entity_physics_and_gravity_tick
title: Master per-frame entity physics scheduler, metatile cache, and gravity integration
confidence: confirmed
tags: [physics, entity, actor, gravity, scheduler]
evidence: ["disasm: updates step dither $7E:0F36 via table $8F:B090; iterates active entity linked list at $7E:3DDF; caches metatile collision word from $7F:0004 into +$3C,Y; calls gravity integration $8F:AFF5", "trace: executed every frame tick during exploration mode"]
see: [docs/disassembly/maps/elevation-transfer.md, rom/8faff5.md, rom/8faf48.md]
---
Master entity physics tick engine executed once per frame:
1. Advances 4-step motion dither phase counter `$7E:0F36` via sequence table `$8F:B090`.
2. Iterates across the active entity linked list starting at head pointer `$7E:3DDF`.
3. Caches the underlying metatile collision word from `$7F0004,X` into entity slot record `+$3C,Y`.
4. Executes vertical gravity physics stepper at `$8F:AFF5` (`gravity`), accelerating airborne entities
   downward and clamping landing coordinates.
Full disassembly and clean C reconstruction: `docs/disassembly/maps/elevation-transfer.md`.
