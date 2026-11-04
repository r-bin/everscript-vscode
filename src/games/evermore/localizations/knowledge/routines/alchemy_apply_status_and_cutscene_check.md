---
addr: 91B1C8
size: 324
end: 91B30B
kind: code
category: 🎮
name: alchemy_apply_status_and_cutscene_check
title: Apply status effect and enqueue cutscene event script ($91:B1C8)
confidence: confirmed
evidence: ["disasm: applies status mask $40 via $91:B9A7; checks lock flag $15D2; if clear, enqueues cutscene event script $91:B1FC via $8C:C521"]
see: ["routines/status_effect_cure_and_remove.md","routines/cutscene_script_enqueue.md"]
tags: ["alchemy","status","cutscene","script"]
---
Applies status effect `$40` via `func_91B9A7`. Checks lock flag `$15D2`; if clear, enqueues cutscene event script `$91:B1FC` via `cutscene_script_enqueue` (`$8C:C521`).
