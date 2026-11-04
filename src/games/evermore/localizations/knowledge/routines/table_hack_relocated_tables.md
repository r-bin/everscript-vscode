---
addr: B98000
size: 32768
end: B9FFFF
kind: table
category: 📋
name: table_hack_relocated_tables
title: Table hack relocated master tables arena in Bank $B9
confidence: confirmed
tags: [table-hack, exhirom, expansion]
evidence: ["tools/table-hack/tables.js places expanded and relocated game tables in Bank $B9:8000-FFFF"]
---
Expansion arena in Bank `$B9` (`$B9:8000–$B9:FFFF`) used by the table hack to place relocated vanilla tables with expanded capacity for modding.