---
addr: 90885A
size: 19
end: 90886C
kind: code
category: 🎮
name: animation_script_bind_palette_resource
title: Allocate and bind sprite palette resource from script operand ($90:885A)
confidence: confirmed
evidence: ["disasm: reads palette definition index from [<$5D, "c: G1 passed (tools/c-to-rom/g1.mts, v0.399.40): 38/38 states (38/38 oracle) match ROM, mutation caught"]; allocates CGRAM palette via $90:CD5C; advances script pointer <$5D by 2 bytes"]
see: ["routines/entity_alloc_and_assign_sprite_palette.md"]
tags: ["animation","palette","cgram","resource"]
---
Reads palette definition resource index from `[<$5D]`, allocates CGRAM palette via `FUN_90cd5c` (`$90:CD5C`), and advances script pointer `<$5D` by 2 bytes.
