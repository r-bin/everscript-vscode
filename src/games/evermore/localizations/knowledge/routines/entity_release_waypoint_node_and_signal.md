---
addr: 8FA8E2
end: 8FA905
size: 36
kind: code
category: 🧠
name: entity_release_waypoint_node_and_signal
title: Detach the current entity from its waypoint node
confidence: likely
tags: ["companion","waypoint","entity"]
evidence: ["disasm: full body read (16 instructions): Y = current entity ($4C); X = [Y+$6C, "c: G1 passed (tools/c-to-rom/g1.mts, v0.399.41): 36/36 states (36/36 oracle) and 24/24 fuzzed match ROM, mutation caught"]; if X is not negative: when [X+$3C1A] is non-zero, OR that mask into the word at ([X+$3C18])+9 via $8C:CFF4; then release node X via $8F:9916 and store $FFFF into [Y+$6C]; finally clear bit $0800 of [Y+$14]"]
see: ["src/games/evermore/localizations/knowledge/routines/waypoint_node_release.md","src/games/evermore/localizations/knowledge/routines/wram_word_or_mask_at_x_plus_9.md"]
---
If the current entity ($4C) holds a waypoint node in +$6C, give it up: when the node carries a signal mask (+$3C1A) it is ORed into the flag word the node points to (+$3C18), then the node goes back to the free list and +$6C becomes $FFFF. In every case bit $0800 of the entity flag word +$14 is cleared.

The meaning of the signalled word is not known; the name follows what the code does.
