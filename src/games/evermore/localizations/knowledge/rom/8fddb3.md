---
addr: 8FDDB3
kind: table
category: 📋
name: companion_charge_caps
title: How far an uncontrolled Boy or Dog charges, by its AI setting
confidence: likely
tags: [combat, stamina, ai]
evidence: ["disasm: $8F:CC8E-$8F:CCA9 and $8F:CCB6-$8F:CCD1 compare the uncontrolled member's charge with $8F:DDB3,x (X = $0B0B Boy / $0B0F Dog) and add speed − 3 until it", "rom: words $0400, $0800, $0C00 at X = 2, 4, 6", "wram: $0B0B = $0B0F = 2 in a fresh game (end of the Podunk opening)"]
see: [rom/8fcc40.md]
---
The member the player does not control charges beyond 100 % up to this word, picked by its AI
setting (`$0B0B` Boy, `$0B0F` Dog; ×2): `$0400`, `$0800`, `$0C00`, the attack levels 1–3. A fresh
game sets both to 2: 100 %.
