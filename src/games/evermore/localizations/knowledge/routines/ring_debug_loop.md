---
addr: 8EA3EA
size: 1
end: 8EA3EA
kind: code
category: 🎮
name: ring_debug_loop
title: The debug ring's loop: a bare RTS
confidence: confirmed
tags: ["ring-menu", "debug"]
evidence: ["rom: $8E:9944 + 2·3 (RING_LOOPS, the debug ring) holds $A3EA; the byte there is $60 (rts) (v0.456.0)", "cdl: never executed in vanilla play; RING_DEBUG_COUNT ($0F5A) is never accessed, so the Boy's flow always skips the ring"]
see: ["docs/open-evermore/resources.md", "knowledge/wram/RING_DEBUG_COUNT.md"]
---
What the debug ring runs while it is open: nothing. Every other ring's loop prints the selected item's
name and waits for a button (`$8E:ADBC`); this one returns at once, so the debug functions its eleven
ring items name (Create a monster, Select map, Mode 7 flight, the background toggles, ROM creation date,
Alchemist …) have no code left in this release. Only their names, icons and indexes (0-20, step 2)
remain in the ring item table.
