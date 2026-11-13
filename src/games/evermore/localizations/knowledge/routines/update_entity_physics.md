---
addr: 8096BB
size: 67
end: 8096FD
kind: code
category: 🎭
name: update_entity_physics
title: Entity velocity and coordinate physics integration loop
confidence: verified
tags: [entities, physics, main-loop, reconstructed-c, g1-pass]
evidence: "[\"disasm: DBR=$7E; X=$5127 (tail node); traverses backward via node->prev ($0000,y); unpacks coordinates +0x06..+0x0A and velocities +0x0C..+0x0D into DP $02-$06 and $26-$27; calls JSL $80:9040; terminates at sentinel $50A7 (status=$FFFE); calls init_entity_pool ($80:9685)\", \"main-loop: invoked during room ticks and physics coordinator passes\"]; G1 pass (34/34 reference states, 0/0 fuzzed states, mutation caught)"
see: [docs/disassembly/entities/physics-integration.md, routines/init_entity_pool.md]
---
Per-frame physics update driver for all active on-screen actors. Traverses the 17-slot circular
doubly-linked entity list backwards from tail (`$7E:5127`) to head (`$7E:50A7`), unpacking world
coordinates and velocities to invoke collision testing and positional translation via `$80:9040`.
Terminates when hitting the sentinel head node (`status = $FFFE`) and refreshes list limits via
`init_entity_pool` (`$80:9685`).
Full disassembly and clean C reconstruction: `docs/disassembly/entities/physics-integration.md`.

