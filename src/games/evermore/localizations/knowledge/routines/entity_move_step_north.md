---
addr: 8FC3BA
size: 8
end: 8FC3C1
kind: code
category: 🎮
name: entity_move_step_north
title: Apply northward position translation step along Y axis ($8F:C3BA)
confidence: confirmed
evidence: ["disasm: subtracts step distance <$12 from vertical coordinate <$48"]
see: []
tags: ["movement","north","coordinate","vector"]
---
Subtracts step magnitude `<$12>` from Y coordinate `<$48>`.
