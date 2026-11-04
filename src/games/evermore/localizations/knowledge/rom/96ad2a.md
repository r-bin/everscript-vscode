---
addr: 96AD2A
end: 96ADC3
size: 154
kind: sub
name: MARKET_PEDDLER_DISPATCH_DIALOGUE
title: Nobilia Market entrance peddler dialogue dispatcher
confidence: confirmed
tags: [market, dialogue, npc]
evidence: ["scripts: Room 10 trigger 14 ($96:ad12) calls $96:ad2a; tests <0x244f> across stages 0..19, displaying corresponding message boxes ($109B..$10F5), walking boy south at stage 8, and triggering cooldown at stages 5 and 19"]
see: [knowledge/wram/PEDDLER_STAGE.md, knowledge/wram/DIALOGUE_STRING_PARAM_REGISTERS.md, knowledge/wram/PEDDLER_COOLDOWN_START_FRAME.md]
---
Dialogue dispatcher for the persistent peddler NPC situated at the south entrance of Nobilia Market (Room 10, trigger 14 at [13,44]).

Dispatches based on the stage stored in `MARKET_PEDDLER_STAGE` (`$7E:244F`):
- Stages 0–4: Introductory dialogue pitches and banter.
- Stage 5: Triggers a 60-second cooldown (`MARKET_PEDDLER_COOLDOWN_START_FRAME` in `$7E:254D`).
- Stage 8: Pushes the boy and dog 2 tiles south away from the booth.
- Stages 9–18: Extended persistent conversation progression.
- Stage 19: Final line before re-entering cooldown state.
