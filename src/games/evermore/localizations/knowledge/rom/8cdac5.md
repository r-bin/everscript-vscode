---
addr: 8CDAC5
kind: code
category: 🧠
name: unfreeze_boy
title: Unfreeze Boy
confidence: confirmed
tags: [script-vm, entities, boy]
evidence: ["disasm: handler at $8C:DAC5 selects actor bit 1 and enters shared unfreeze helper $8C:DADB, which calls $8F:CD4D for Boy ($4E89)"]
see: [rom/8fcd4d.md, docs/game-research/script-vm/opcodes.md]
---
Unfreezes Boy by selecting actor bit 1 in the shared unfreeze dispatcher. The dispatcher sets DP `$4C` to `$4E89` and calls `$8F:CD4D` to restore autonomous motion and clear immobilization state.

Previously believed: this address was the per-frame party input/companion AI dispatcher. The opcode-table entry and instructions at `$8C:DAC5` show that this address is the 0xBD unfreeze-Boy handler.
