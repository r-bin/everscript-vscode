---
addr: 8CCFFD
kind: code
name: script_scheduler_pass
title: Script scheduler — one pass over every running script thread
confidence: confirmed
tags: [script-vm]
evidence: ["disasm: guard $1436; x=0; while (slot = $7E2F28[x]) { $80=x; $7E=slot; jsr ($D029 + slot.state) ; x=$80+2 }", "disasm: called from the field tick $8E:E45C right after $0B19 is incremented, skipped while $143C = $FFFF", "trace: tools/simulation/trace-scripts.js — 10051 ticks of the intro; tests/simulation/scheduler.test.js replays 5338 instructions on the same tick and slot (v0.203.0)", "cdl: the handlers return into the loop at $8C:D01B by a pushed address (recomp seed export, 2026-10-30); compiled by snesrecomp it breaks loading a save, so the recomp keeps it interpreted (docs/recomp/README.md §2, v0.385.1)"]
see: [ram/7e2f28.md, ram/7e28fc.md, rom/8cd244.md, docs/disassembly/script-vm/dispatcher.md, src/games/evermore/simulation/README.md]
---
One pass per field tick. Threads run in run-list order; each runs until an instruction
handler returns carry clear (its turn is over) — carry set means the next instruction
follows at once. The handler for a thread is picked by its slot state (`+3`) from the word
table at `$8C:D029`:

| state | handler | thread is |
|---|---|---|
| 2 | `$8C:D09C` | running: continue at its pc |
| 4 | `$8C:D037` | sleeping: runs when the 32-bit timer `$0B19` ≥ deadline `+5/+7` |
| 6 | `$8C:D04A` | waiting for bits `+9` of the word `+5` (an entity's busy bits); clears them and runs |
| 8 | `$8C:D05C` | waiting until `$2429` differs from `+5` (text box) |
| 10 | `$8C:D086` | waiting until an entity's `$107E` equals `$10CE` (walk finished) |
| 12 | `$8C:D065` | waiting until the camera (`$BF`,`$C1`) stops moving |

Turn-ending opcodes (traced; no opcode was ever seen both ending and continuing):
`0x00` END, `0x38/0x3a` YIELD, `0x39/0x3b/0xa7/0xa8` SLEEP (n = 0 does not end the turn; else
wakes `max(1, n−1)` ticks later — deadline = timer + n − 1), `0x2e` wait (sets one of states
6–12, or just yields when nothing is pending), `0x22` CHANGE MAP. Calls (`0x29`, `0xa3`, `0xa5`,
`0xa6`, `0xaf`…) also return clear, but put the callee in the caller's run-list place and step
`$80` back, so the callee starts in the same pass; END with a caller does the same in reverse.
`0x07`/`0xb4` start a script in a new slot appended to the run list, so it runs later in the
same pass, and return set — the starter continues.

`CHANGE MAP` loads the next room synchronously: no thread survives it (12 of 12 traced) and the
new room's enter script starts in the same tick.
