---
addr: 7E2537
size: 2
kind: var
name: LOOT_TEXT_ARG_2
title: Secondary text parameter mailbox for loot pickup message box formatting
lifetime: room
confidence: confirmed
tags: [loot, dialogue, scripts]
evidence: ["code: src/games/evermore/simulation/understand.ts lists LOOT.TEXT_ARG2 at 0x2537 as part of the loot mailbox", "scripts: global loot drivers ($92:A482 / $92:A584) stage auxiliary quantity or item details into $2537"]
see: [ram/7e2539.md, ram/7e2391.md, ram/7e2393.md]
---
16-bit mailbox parameter register used by global loot scripts to stage secondary message parameters (e.g. quantity or condition details) when displaying pickup dialogue.
