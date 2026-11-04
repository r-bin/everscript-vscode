---
addr: $7E:2F98
name: FORMULA_COMBAT_POWER_ARRAY
type: u16[35]
tags: [alchemy, combat]
confidence: verified
evidence: ["cdl", "disasm: func_91ADD0, func_8DC70D"]
---
35-formula combat power ratings array (35 16-bit words, 70 bytes: $7E:2F98..$7E:2FDD; Acid Rain through Super Heal). Evaluated by func_91ADD0 to multiply base formula potency with character stats.
