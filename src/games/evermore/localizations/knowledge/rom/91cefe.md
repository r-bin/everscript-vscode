---
addr: 91CEFE
size: 21
kind: code
category: 🧠
name: entity_reset_field78_and_raise_flag_0040
title: Clear entity field +$78 and raise flag $0040
confidence: likely
tags: ["alchemy","entity"]
evidence: ["disasm: full body read (12 instructions): word [X+$78] = 0, then $90:811B on the same record (bit $0040 of +$10)","disasm: callers are the Corrosion / Barrier / Crush / Heal / Defend / direct-cast handlers"]
see: ["src/games/evermore/localizations/knowledge/rom/90811b.md"]
---
Zeroes the word at +$78 of the entity in X and sets bit $0040 in its +$10 flag word (rom/90811b.md). Called by most alchemy cast handlers right after they pick their target. What +$78 holds is not known yet.
