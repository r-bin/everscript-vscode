---
addr: 8FBAAF
size: 32
kind: table
category: 📋
name: HIT_CHANCE_POINTERS_BY_EVADE
title: Hit-chance pointers by evade
confidence: confirmed
evidence: ["legacy: migrated from tables.js", "disasm: $8F:BA27-$8F:BAAE: row pointer byte offset = ((evade + 1) >> 1) & $FFFE; adjusted hit-rate is clamped to 0..100, masked with $FFFC, then shifted right once for the row byte offset; zero threshold misses, otherwise ($80:859B & $7FFF) < threshold", "rom: the rows are 26 words ($34 bytes) apart, $8F:BAE3-$8F:BE22"]
see: [rom/8fba06.md, docs/entities/character-properties.md, docs/disassembly/combat/projectile-homing.md]
---
Hit-chance pointers by evade. The lookup uses `((evade + 1) >> 1) & $FFFE` as a byte offset into
these 16 words, equivalent to row index `(evade + 1) >> 2` for evade values 0–62. There is no
bounds check: evade 63 or higher can read beyond this pointer table. Vanilla character records stop
at evade 50. Each pointed-to row has 26 words, one per four-point bucket of the adjusted hit rate
after its 0–100 clamp. The normal rate path starts at `hit + 1`; conditional paths apply the
instruction-derived penalties before clamping and quantizing.

The selected word is compared strictly against `$80:859B & $7FFF`. A zero word always misses;
`$7FFF` misses for the one sample equal to `$7FFF`, while `$8000` or higher guarantees a hit under
that mask. This is the comparison's mathematical limit, not a claim about which thresholds occur
in the table.
