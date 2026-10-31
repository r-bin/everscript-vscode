---
addr: 91ACBD
kind: code
category: 🎮
name: entity_status_collect_active_proc_bitmask
title: Collect active status effect bitmask from entity attachment slot ($91:ACBD)
confidence: confirmed
evidence: ["disasm: checks status slot +$46,Y; if active (!= $FFFF), looks up status flag bitmask from table $91:AE35,X and ORs into <$16; steps Y by 6 bytes; callers: status cleanse $91:AC84"]
see: ["rom/91ac84.md"]
tags: ["status","entity","bitmask","proc"]
---
Inspects status slot pointer `+$46,Y`. If active ($
e $FFFF$), looks up corresponding status flag bitmask from table `$91:AE35,X` and accumulates into bitmask `<$16>`. Advances Y by 6 bytes to inspect next status slot.
