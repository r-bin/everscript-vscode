---
addr: 8FB29B
size: 35
end: 8FB2BD
kind: code
category: 🎮
name: entity_linked_list_validate_entity
title: Move active entity to the front of the active entity linked list ($8F:B29B)
confidence: verified
tags: [entity, linked-list, lru, reconstructed-c, g1-pass]
evidence: ["reconstructed-c/8F/8FB29B_entity_linked_list_validate_entity.c passes Gate G1 (31/31 reference states, mutation caught)"]
see: [routines/entity_sleep_wake.md, routines/entity_go_to_sleep.md]
---
Moves active entity index `<$4C` to the front of the active entity linked list rooted at the anchor passed in Y (with X = initial search node):
1. Pushes initial anchor `Y` to stack.
2. Traverses forward pointer chain `+$5E,X`. If the list terminates with 0 without matching `$4C`, executes `BRK $B9` (engine assertion failure / invariant trap).
3. When matching node `Y == $4C`:
   - `CPY $4C` asserts carry flag (`Y >= $4C`).
   - Unlinks node from its current position: `prev->next = node->next`.
   - Pulls list anchor into `X`.
   - Inserts node immediately after the anchor: `node->next = anchor->next; anchor->next = node`.
4. Leaves A = `node`, X = `anchor`, Y = `node`, sets N and Z flags from `node`, and carry set.

## Callers
- `$8F:C40F` (`entity_sleep_wake`)
- `$8F:C514` (`entity_go_to_sleep`)
