---
addr: 908C4D
size: 26
end: 908C66
kind: code
category: 🎮
name: animation_script_trigger_combat_hit_reaction
title: Evaluate controller inputs and trigger combat hit stun / knockback ($90:8C4D)
confidence: confirmed
evidence: ["disasm: inspects button mask $0100 against $D03F; reads direction <$80; masks to 2 bits; adds 3; invokes entity hit reaction $8F:C143"]
see: ["routines/entity_add_pending_damage_or_status_proc.md"]
tags: ["combat","hitbox","reaction","knockback"]
---
Checks input button mask `$0100` against `$D03F`. Reads direction `<$80>`, masks to 2 bits, adds 3, and invokes entity hit stun / combat knockback reaction via `func_8FC143` (`$8F:C143`).
