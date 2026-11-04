---
addr: 7E24AB
size: 2
kind: var
name: ACTIVE_CHAR_X
title: Staged X position of the active player character in world pixels or subpixels
lifetime: room
confidence: confirmed
tags: [scripts, party, entities]
evidence: ["script: assigned from active.x or boy.x in 18 rooms (49 occurrences)", "script: paired with $7E:24AF (ACTIVE_CHAR_Y) for relative party repositioning (teleport boy to ACTIVE_CHAR_X + 8, dog to ACTIVE_CHAR_X - 8)", "script: used by pipe trajectory script $94:AC56 as subpixel X coordinate (shifted left by 4)"]
see: [ram/7e24af.md, ram/7e24ad.md, ram/7e24b1.md]
---
Scratch register holding the X coordinate of the active character running a script.
Frequently used by triggers to capture `active.x`, compute offsets, and reposition or launch the party. In physics/pipe sequences ($94:AC56), holds subpixel X position (`world_x << 4`).
