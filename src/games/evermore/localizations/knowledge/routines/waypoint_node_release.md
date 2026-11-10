---
addr: 8F9916
end: 8F9925
size: 16
kind: code
category: 🧠
name: waypoint_node_release
title: Push a waypoint node back onto the free list
confidence: confirmed
tags: ["companion","waypoint","allocator"]
reconstructed_c: reconstructed-c/8F/8F9916_waypoint_node_release.c
evidence: ["disasm: full body read (6 instructions): clears word $3C14+X, copies the list head $3BC7 into $3BC9+X, makes X the new head, returns A = $FFFF","disasm: callers are $8F:A8E2, $8F:B31E, $8F:B3D4, $8F:C514 (all entity detach paths)", "g1: passed (39/39 reference replay, 624/624 fuzzed, mutation caught)"]
see: ["src/games/evermore/localizations/knowledge/routines/companion_waypoint_anchor_init.md"]
---
Releases node X of the waypoint pool that lives at $7E:3BC7..: the node is pushed onto a singly linked free list whose head is $3BC7 and whose next-links are at $3BC9+node. Returns $FFFF in A, which callers store into the entity field +$6C to mean "no node".

See routines/companion_waypoint_anchor_init.md for the opposite side that sets a node up.
