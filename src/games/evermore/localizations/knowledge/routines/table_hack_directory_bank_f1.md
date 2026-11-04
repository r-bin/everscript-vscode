---
addr: F10000
size: 32768
end: F17FFF
kind: table
category: 📋
name: table_hack_directory_bank_f1
title: Table hack directory and index descriptor table in Bank $F1
confidence: confirmed
tags: [table-hack, exhirom]
evidence: ["tools/table-hack/tables.js places the relocated table directory in Bank $F1:0000"]
---
Directory structure and relocated table descriptor index located at `$F1:0000–$F1:7FFF`. Stores pointers, entry counts, and layout metadata for tables moved into the table hack expansion space.