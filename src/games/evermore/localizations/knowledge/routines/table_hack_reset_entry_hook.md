---
addr: FA0100
size: 256
end: FA01FF
kind: code
category: 🧠
name: table_hack_reset_entry_hook
title: Table hack reset entry initialization hook in Bank $FA
confidence: confirmed
tags: [table-hack, hooks, reset]
evidence: ["tools/table-hack/tables.js injects reset entry hook at $FA:0100"]
---
Boot initialization hook code at `$FA:0100–$FA:01FF` executed early in the reset vector sequence to initialize table hack memory mappings, copy vectors, and prepare expanded data structures before handing control back to the engine.