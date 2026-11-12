---
addr: 90866C
size: 61
end: 9086A8
kind: code
category: 🎮
name: animation_step_direction_dispatch
title: Decode directional animation step and dispatch movement vector ($90:866C)
confidence: confirmed
evidence: ["disasm: reads step angle from [<$5D, "c: G1 passed (tools/c-to-rom/g1.mts, v0.399.42): 43/43 states (43/43 oracle) and 4/4 fuzzed match ROM, mutation caught"]; adds entity orientation $0F36; scales to step index; calls movement vector table handler $8F:AD51; advances script pointer <$5D"]
see: ["routines/entity_mover_step_direction_table.md"]
tags: ["animation","movement","direction","vector"]
---
Decodes directional animation movement step from script stream `[<$5D]`. Adjusts angle by character orientation `$0F36`, shifts to step index, and calls direction step table handler `Entity_mover_step_direction_table_8F_AF18_8FAD51` (`$8F:AD51`).
