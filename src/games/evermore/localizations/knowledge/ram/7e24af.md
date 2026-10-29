---
addr: 7E24AF
size: 2
kind: var
name: ACTIVE_CHAR_Y
title: Staged Y position of the active player character in world pixels or subpixels
lifetime: room
confidence: confirmed
tags: [scripts, party, entities]
evidence: ["script: assigned from active.y or boy.y in 18 rooms (82 occurrences)", "script: paired with $7E:24AB (ACTIVE_CHAR_X) for relative party repositioning and boundary checking", "script: used by pipe trajectory script $94:AC56 as subpixel Y coordinate (shifted left by 4)"]
see: [ram/7e24ab.md, ram/7e24ad.md, ram/7e24b1.md]
---
Scratch register holding the Y coordinate of the active character running a script.
Frequently used by triggers to capture `active.y`, compute vertical bounds, and reposition or launch the party. In physics/pipe sequences ($94:AC56), holds subpixel Y position (`world_y << 4`).
