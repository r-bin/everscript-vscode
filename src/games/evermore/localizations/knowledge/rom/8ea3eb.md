---
addr: 8EA3EB
end: 8EA443
kind: code
category: 🧠
name: walk_indirect_sequence_with_dispatch
title: Indirect sequence iteration and dispatch
confidence: confirmed
evidence: ["disasm: clean vanilla VFS shows an entry immediately after RTS at $8E:A3EA, a loop through $8E:A441, and RTS at $8E:A443", "disasm: loop performs indexed reads based on direct-page pointer $95, conditionally calls an indexed indirect subroutine through $8E:A444,X, and repeats or returns according to carry"]
see: [docs/disassembly/engine-core/record-iteration-dispatch.md]
---
This routine repeatedly performs indexed reads using the pointer at direct-page address `$95` and calls `$8E:ADBC`. Depending on the returned carry and accumulator bit `$0040`, it returns or calls a subroutine selected through `$8E:A444,X`; a carry-clear result from that indirect call repeats the loop. The caller, the data layout at `$95`, and the meanings of the lookup and dispatch tables are unresolved. Its call to `$8E:AE85` does not by itself establish the routine's overall purpose.