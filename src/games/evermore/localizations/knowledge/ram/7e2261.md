---
addr: 7E2261
end: 7E2264
kind: struct
name: CHARM_FLAGS
title: Passive charm, relic, and persistent status bitfields ($7E:2261..$7E:2264)
lifetime: save
confidence: confirmed
tags: [inventory, combat, stats]
evidence: ["disasm: func_CF9210 checks equipment requests and sets bits in $7E:2261..$7E:2263 via bitmask tables", "disasm: $8F:8464 checks Silver Sheath ($2261), $8F:B7D7 checks Insect Incense ($2261 bit 7), $8C:9447 checks Wizard's Coin ($2263 bit 2), $91:9DC0 checks Moxa Stick ($2262 bit 3)", "disasm: $8F:857D checks Chocobo Egg ($2261 bit 6) and Armor Polish ($2262 bit 7) to swap growth curves"]
see: [rom/8f9210.md, rom/8f8464.md, rom/8fb7d7.md, ram/7e22da.md]
---
Persistent SRAM save bitfields (`$7E:2261`..`$7E:2264`) tracking owned charms, relics, and persistent status buff state:

- `$7E:2261`:
  - Bit 0: Barrier active on companion
  - Bit 1: Barrier active on Boy
  - Bit 2: Sun Stone (heat / magma immunity)
  - Bit 5: Atlas buff active / Silver Sheath (+25% sword attack damage, checked by `$8F:8464`)
  - Bit 6: Defender armor boost / Chocobo Egg (+HP table swap, checked by `$8F:857D`)
  - Bit 7: Insect Incense (blocks insect strikes, checked by `$8F:B7D7` and `$8F:B7F3`)
- `$7E:2262`:
  - Bit 3: Moxa Stick (+25% healing spell output, checked by `$91:9DC0`)
  - Bit 7: Armor Polish (+defense calculation boost, checked by `$8F:8398`)
- `$7E:2263`:
  - Bit 2: Wizard's Coin (+5% magic defense, checked by `$8C:9447`)
