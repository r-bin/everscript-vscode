---
addr: 8E917A
size: 50
end: 8E91AB
kind: code
category: 🎮
name: ring_option_targeting
title: Options ring: Targeting
confidence: confirmed
tags: ["ring-menu"]
evidence: ["disasm v0.455.0: RING_OPTION_ACTIONS entry; runs the target cursor $8C:88CC and keeps the chosen entity in $144F (its +$60 in $1451)"]
see: ["docs/open-evermore/resources.md"]
---
What pressing the options ring's Targeting item does. Runs the target cursor $8C:88CC and keeps the chosen entity in $144F (its +$60 in $1451).

Previously believed: "Offensive alchemy spell enemy target acquisition and validator ($8E:917A)" (alchemy_spell_acquire_enemy_target).
