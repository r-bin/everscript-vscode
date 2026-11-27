---
addr: 7E22AB
size: 1
kind: flags
name: JUNGLE_START_FLAGS_22AB
title: Story flag byte; bit $40: the Act 1 landing scene in the jungle start was played
lifetime: save
confidence: confirmed
tags: [flag, room, story]
evidence: ["script: the enter script of prehistoria_jungle_south_where_the_game_starts (room $38) tests <0x22ab, 0x40>: clear, it teleports the party to (67, 147), runs enter_sub_2 (the landing) and sets the bit; set, it skips both", "game (MesenCE, 2026-11-28): with the bit set by the enter script before the test, load_map into the room skips the landing and gives control"]
see: [docs/reverse-engineering/debugging-a-rom.md]
---
Inside the saved story flags (`$2258`-`$22E9`). Only bit `$40` has a known meaning: the landing scene of the Act 1
jungle start has played. The other bits are not established.
