---
addr: 8E8BDE
end: 8E8CA6
size: 201
kind: code
category: 🧠
name: alchemy_cast_formula_barrier_and_buff_target_loop
title: Alchemy Barrier, Atlas, and stat-buff formula targeting loops and cast dispatchers
confidence: confirmed
tags: [alchemy, spells, barrier, atlas, targeting, combat]
evidence: ["disasm: 201 bytes at $8E:8BDE..$8E:8CA6; acknowledges joypad input ($80:8597), validates ingredient quantities, prompts target cursor and applies Barrier/Atlas buffs via $91:CE38; returns via RTS"]
see: [routines/alchemy_cast_formula_heal_target_loop.md, routines/alchemy_cast_formula_defend_target_loop.md, routines/combat_companion_attack_target_dispatcher.md]
---
Dedicated player targeting and casting dispatchers for defensive and enhancement alchemy formulas (Barrier, Atlas, and stat buffs):
- Invokes `joypad_acknowledge_or_clear_buttons` (`$80:8597`) on joypad selection.
- Verifies alchemy ingredient availability in inventory.
- Renders player targeting reticle cursor across party members and applies formula effect payload via `$91:CE38`.
- Exits via `RTS`.

