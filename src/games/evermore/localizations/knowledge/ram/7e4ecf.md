---
addr: 7E4ECF
end: 7E4EE6
kind: struct
name: BOY_STATUS_EFFECT_SLOTS
title: Boy entity active status effect slots (4 slots x 6 bytes)
lifetime: room
confidence: confirmed
tags: [combat, entity, player, boy, status, buff]
evidence: ["reconstructed-c: 91B632_status_effects.c defines CombatEntity status slots at +0x46, +0x4C, +0x52, +0x58 (each 6 bytes: status_id, timer, param_boost)", "routine: func_91B632 ticks and purges active buffs/ailments", "struct offset: $7E:4E89 + 0x46..0x5D"]
see: [docs/disassembly/engine-core/wram-map.md]
---
24-byte array containing 4 dedicated status effect slots within the Boy entity structure (`$7E:4E89`):
- `$7E:4ECF` (+$46, 6 bytes): Status Slot 0
- `$7E:4ED5` (+$4C, 6 bytes): Status Slot 1
- `$7E:4EDB` (+$52, 6 bytes): Status Slot 2
- `$7E:4EE1` (+$58, 6 bytes): Status Slot 3

Each 6-byte slot is structured as:
- `+0x00` (2 bytes): Status ID enum (`0xFFFF` = empty, bit 15 = most recent; Atlas `$00`, Barrier `$08`, Defend `$10`, Reflect `$18`, Speed `$20`, Poison `$58`, Confound `$60`, Plague `$68`).
- `+0x02` (2 bytes): Remaining active duration countdown timer in frames/ticks.
- `+0x04` (2 bytes): Parameter boost value (stat scaling bonus or damage rate).

Processed each frame by `func_91BC28` (status effect ticking) and cleared by `func_91B9A7` (`status_purge_slot`).
