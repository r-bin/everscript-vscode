---
addr: 7E24AD
size: 2
kind: var
name: INACTIVE_CHAR_X
title: Staged X position of the inactive companion character in world pixels
lifetime: room
confidence: confirmed
tags: [scripts, party, entities]
evidence: ["script: assigned from inactive.x (e.g. Crustacia east shore R79 step-on triggers)", "script: paired with $7E:24B1 (INACTIVE_CHAR_Y) to track secondary companion coordinates"]
see: [ram/7e24ab.md, ram/7e24b1.md]
---
Scratch register holding the X coordinate of the inactive companion character.
Paired with `$7E:24B1` (`INACTIVE_CHAR_Y`) when scripts need to inspect or sync both party members' positions independently.
