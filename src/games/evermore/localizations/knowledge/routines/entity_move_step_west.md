---
addr: 8FC3E7
size: 8
end: 8FC3EE
kind: code
category: 🎮
name: entity_move_step_west
title: Apply westward position translation step along X axis ($8F:C3E7)
confidence: confirmed
evidence: ["disasm: subtracts step distance <$12 from horizontal coordinate <$46"]
see: []
tags: ["movement","west","coordinate","vector"]
---
Subtracts step magnitude `<$12>` from X coordinate `<$46>`.
