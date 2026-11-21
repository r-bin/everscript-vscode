---
addr: 908BBE
size: 38
end: 908BE3
kind: code
category: 🎮
name: animation_script_loop_counter_branch
title: Decrement loop counter in animation record and branch or advance ($90:8BBE)
confidence: confirmed
evidence: ["disasm: reads offset Y from [<$5D]; decrements counter in record; if non-zero branches back to target [<$5D]; if zero advances script PC <$5D past loop body by 3 bytes", "c: G1 passed (tools/c-to-rom/g1.mts, v0.399.72): 30/30 states (30/30 oracle, 452/452 fuzzed) match ROM, mutation caught"]
see: []
tags: ["animation","loop","counter","branch","reconstructed-c","g1-pass"]
---
Loop counter handler in animation script. Reads offset Y from `[<$5D]`, decrements loop counter `(<12),Y`. If non-zero, saves counter and branches back to loop target `[<$5D]`; if zero, advances script pointer past loop body by 3 bytes.
