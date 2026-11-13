---
addr: 8F98A4
size: 17
end: 8F98B4
kind: code
category: 🎮
name: multipart_child_create_with_flag_1000
title: Create primary multipart child entity and assert component flag $1000 ($8F:98A4)
confidence: confirmed
evidence: ["disasm: creates or retrieves child entity via $8F:9877; asserts component flag bit $1000 in child record $3C12,X; returns child entity index in A", "c: G1 passed (tools/c-to-rom/g1.mts, v0.399.40): 39/39 states (39/39 oracle) and 587/587 fuzzed match ROM, mutation caught"]
see: ["routines/multipart_child_get_or_create_primary.md"]
tags: ["entity","multipart","child","boss"]
---
Creates or retrieves primary multipart child entity via `multipart_child_get_or_create_primary` (`$8F:9877`). Asserts component flag bit `$1000` in child record `$3C12,X` and returns child index in A.
