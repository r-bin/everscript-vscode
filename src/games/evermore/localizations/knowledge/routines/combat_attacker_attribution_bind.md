---
addr: 8FC17F
size: 60
end: 8FC1BA
kind: code
category: 🧠
name: combat_attacker_attribution_bind
title: Bind attacker entity pointer to victim for AI retaliation and XP crediting
confidence: confirmed
tags: [combat, damage, aggro, ai]
evidence: ["disasm: stores attacker pointer DP $4C into victim+$24 and victim+$80; if victim is Boy/Dog ($4E89/$4F37), records attacker into $7E:4EAD/$7E:4F5B; if victim is enemy, loops $7E:3DDF and sets all pack-mates of same species to target attacker", "c: G1 passed (tools/c-to-rom/g1.mts): the bound C equals the ROM on 3 entry states sampled from the 2:20 no-input reference and 48 fuzzed ones; snes9x agrees with the interpreter on 3; a mutation is caught"]
see: [docs/disassembly/combat/hit-recoil-physics.md, routines/dispatch_hit_reaction_and_knockback.md, reconstructed-c/8F/8FC17F_combat_attacker_attribution_bind.c]
---
Records the identity of the attacking entity into the victim entity structure:
- Sets `victim->last_attacker` at offsets `+$24` and `+$80`.
- Updates global player target pointers at `$7E:4EAD` (Boy) and `$7E:4F5B` (Dog) when player characters take damage.
- Enables enemy AI retaliation loops to acquire the player as an aggressive target.
Full disassembly and clean C reconstruction: `docs/disassembly/combat/hit-recoil-physics.md`.
