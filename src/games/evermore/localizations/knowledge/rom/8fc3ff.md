---
addr: 8FC3FF
end: 8FC40E
size: 16
kind: table
category: 🗺️
name: tbl_facing_step_handlers
title: Facing direction -> position step handler, 8 entries ($8F:C3FF)
confidence: likely
tags: [movement, vector, triggers, player]
evidence: ["read: 8 words $C3BA, $C3C9, $C3C9, $C3C9, $C3D8, $C3E7, $C3E7, $C3E7 (north, three times the second handler, then the third, three times the fourth); the bytes from $8F:C40F on are code (rom/8fc40f.md)", "cdl: player_b_trigger_search_box_setup's jsr ($C3FF,x) at $8F:AC98 reached exactly these four handlers; the CDL library saw $8F:C40F onward run as code", "export: the recomp seeds used to count 106 entries, because table word 105 happens to equal one of the four handler addresses; the count now stops where the table's bytes ran as code (everscript v0.387.32)"]
see: [rom/8fac84.md, rom/8fc3ba.md, rom/8fc3c9.md, rom/8fc3d8.md, rom/8fc3e7.md]
---
Jump table indexed by the facing direction (`+$22,Y` of the entity record, see
[player_b_trigger_search_box_setup](8fac84.md)): each entry steps the probe position in DP `$46`/`$48` by the
distance in `$12` (16 px for the B-button search box). Eight entries, four distinct handlers
([entity_move_step_north](8fc3ba.md) is entry 0); which facing values the repeated entries stand for is not
checked. Code follows the table directly at `$8F:C40F`.
