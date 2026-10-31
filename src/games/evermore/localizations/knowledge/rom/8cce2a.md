---
addr: 8CCE2A
kind: code
category: 🧠
name: init_global_event_script_engine
title: Global background event script VM bootstrapper ($8C:CE2A)
confidence: confirmed
evidence: ["disasm: switches DBR to $7E; loads root script pointer from $92:800C into DP $26..$27; calls script unpacker $8C:CF18; stores root thread in $7E:2F28; clears $7E:2F2A; sets active thread flag $86 = 2; caller: title bootstrap $80:8CC9"]
see: [rom/808cc9.md]
tags: [scripts, vm, bootstrap]
---
Initializes the global background event script VM during system bootstrap (`$80:8CC9`). Loads the root event script entry point from `$92:800C` into direct page `$26..$27`, unpacks the bytecode via `$8C:CF18`, and registers the active script thread in WRAM `$7E:2F28`, setting execution flag `$86 = 2`.
