---
addr: 8CD224
end: 8CD243
size: 32
kind: code
category: 🧠
name: sub_8CD224
title: Script thread sleep duration calculation and target frame timer setup
confidence: confirmed
tags: [code, subroutine, script, vm]
evidence: ["disasm: checks duration in A, adds `A - 1` to 32-bit field frame counter at `$7E:0B19..$7E:0B1C`, writes expiration timestamp to thread slot `+$05` and sets state `+$03` to 4, returning CLC; if 0, returns SEC at $8C:D224", "c: G1 passed (tools/c-to-rom/g1.mts, v0.399.47): 48/48 states (48/48 oracle, 764/764 fuzzed) match ROM, mutation caught"]
---

Script VM sleep timer routine computing the 32-bit target wakeup frame for the active thread slot identified by DP `$7E`. Computes `($7E:0B19) + (duration - 1)`, stores the timestamp into thread record `+$05` and `+$07`, sets thread state to 4 (sleeping), and clears Carry before RTS. If duration is zero, exits immediately with Carry set.

