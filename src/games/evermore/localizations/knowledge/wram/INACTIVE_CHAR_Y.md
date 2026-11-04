---
addr: 7E24B1
size: 2
kind: var
name: INACTIVE_CHAR_Y
title: Staged Y position of the inactive companion character in world pixels
lifetime: room
confidence: confirmed
tags: [scripts, party, entities]
evidence: ["script: assigned from inactive.y (e.g. Crustacia east shore R79 step-on triggers)", "script: used for vertical threshold comparisons in companion puzzle triggers"]
see: [ram/7e24ad.md, ram/7e24af.md]
---
Scratch register holding the Y coordinate of the inactive companion character.
Paired with `$7E:24AD` (`INACTIVE_CHAR_X`) when scripts need to inspect or sync both party members' positions independently.
