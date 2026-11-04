---
addr: 7E2539
size: 2
kind: var
name: LOOT_TEXT_ARG_1
title: Primary text parameter mailbox for loot pickup message box formatting
lifetime: room
confidence: confirmed
tags: [loot, dialogue, scripts]
evidence: ["code: src/games/evermore/simulation/understand.ts lists LOOT.TEXT_ARG at 0x2539 as part of the loot mailbox", "scripts: global loot drivers ($92:A482 / $92:A584) stage currency or item names into $2539 for string interpolation"]
see: [knowledge/wram/LOOT_TEXT_ARG_2.md, knowledge/wram/LOOT_MAILBOX.md, knowledge/wram/LOOT_AMOUNT_CURRENCY.md]
---
16-bit mailbox parameter register used by global loot scripts to stage primary message parameters (e.g. currency amounts or item names) when displaying pickup dialogue.
