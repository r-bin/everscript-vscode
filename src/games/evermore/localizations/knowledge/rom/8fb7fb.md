---
addr: 8FB7FB
end: 8FB82C
kind: code
category: ⚔️
name: weapon_on_hit_proc_check_25pct
title: Melee weapon on-hit proc check (25% chance)
confidence: likely
tags: [combat, melee, weapon, proc]
evidence: ["disasm: calls $8F:BA06 (melee_to_hit_roll), $8F:C067 (physical_damage_into_pending_0x76), $8F:C0D3 (dispatch_hit_reaction_and_knockback), $8F:C17F (combat_attacker_attribution_bind); rolls $80:859B (RNG) AND #3; on zero (25%) loads X=#$90 and enqueues cutscene script at $8F:B856 via $8C:C521 (REA dossier 0x8fb7fb)"]
---
Evaluates hit success, base damage, and attribution for melee attacks, then rolls a 1-in-4 (25%) chance to trigger a weapon secondary effect script at `$8F:B856`.

