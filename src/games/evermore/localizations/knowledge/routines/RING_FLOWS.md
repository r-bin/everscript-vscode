---
addr: 8E998C
size: 2
end: 8E998D
kind: table
category: 📋
name: RING_FLOWS
title: Ring flows: the rings Up/Down cycles through
confidence: confirmed
tags: ["ring-menu","table"]
evidence: ["disasm v0.455.0: $8E:A11D lda [$97],y walks the record at $97 (count, then ring ids); $8E:A34F/$8E:E515 set $97 = $998C for the Boy, $8E:A359/$8E:E534 $9998 for the Dog"]
see: ["docs/open-evermore/resources.md"]
---
Records of a count and that many ring ids (2·ring): `$998C` the Boy (options, alchemy, weapons, debug, items), `$9998` the Dog (options), `$999C`/`$99A0`/`$99AC` and `$99A4`/`$99A8` shops (picked by the tables `$CC:E37B` and `$CC:F037`), `$99B0` the Call Bead callers, `$99B4` equipment (the four armour rings), `$99BE` the collars alone, `$99C2` the Call Bead spells, `$99C6` bazooka ammo. Code and bank `$CC` hold their addresses, so they stay where they are. Open Evermore: `menus/ring_flows/`.

Previously believed: "CDL data block ($8E:998C)" (data_8E998C).
