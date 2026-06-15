# Current State

## Existing Tests

- Count: 12
- tests/expressions/if-22eb-and-0x20.test.ts
- tests/expressions/if-change-music-eq-zero.test.ts
- tests/expressions/if-not-22f1-and-0x40.test.ts
- tests/expressions/sleep-literal.test.ts
- tests/opcodes/00-end.test.ts
- tests/opcodes/08-if.test.ts
- tests/opcodes/09-if-not.test.ts
- tests/opcodes/1b-write-memory.test.ts
- tests/opcodes/20-teleport.test.ts
- tests/opcodes/29-call.test.ts
- tests/opcodes/a5-rcall.test.ts
- tests/script-boundary.test.ts

## Generated Tests

- Count: 170
- Scripts in truth model: 127
- Opcode samples in corpus: 7880
- Unique opcodes observed: 81
- tests/generated/branch-targets.test.ts
- tests/generated/expression-corpus/bitmask.test.ts
- tests/generated/expression-corpus/flag-check.test.ts
- tests/generated/expression-corpus/memory-compare.test.ts
- tests/generated/expression-corpus/negated-compare.test.ts
- tests/generated/expression-corpus/sleep.test.ts
- tests/generated/opcode-corpus/04.test.ts
- tests/generated/opcode-corpus/05.test.ts
- tests/generated/opcode-corpus/07.test.ts
- tests/generated/opcode-corpus/08.test.ts
- tests/generated/opcode-corpus/09.test.ts
- tests/generated/opcode-corpus/0c.test.ts
- tests/generated/opcode-corpus/0d.test.ts
- tests/generated/opcode-corpus/10.test.ts
- tests/generated/opcode-corpus/14.test.ts
- tests/generated/opcode-corpus/17.test.ts
- tests/generated/opcode-corpus/18.test.ts
- tests/generated/opcode-corpus/19.test.ts
- tests/generated/opcode-corpus/1b.test.ts
- tests/generated/opcode-corpus/1c.test.ts
- tests/generated/opcode-corpus/20.test.ts
- tests/generated/opcode-corpus/22.test.ts
- tests/generated/opcode-corpus/27.test.ts
- tests/generated/opcode-corpus/29.test.ts
- tests/generated/opcode-corpus/2a.test.ts
- tests/generated/opcode-corpus/2b.test.ts
- tests/generated/opcode-corpus/2e.test.ts
- tests/generated/opcode-corpus/30.test.ts
- tests/generated/opcode-corpus/33.test.ts
- tests/generated/opcode-corpus/3a.test.ts
- tests/generated/opcode-corpus/3b.test.ts
- tests/generated/opcode-corpus/3c.test.ts
- tests/generated/opcode-corpus/3d.test.ts
- tests/generated/opcode-corpus/3f.test.ts
- tests/generated/opcode-corpus/42.test.ts
- tests/generated/opcode-corpus/43.test.ts
- tests/generated/opcode-corpus/51.test.ts
- tests/generated/opcode-corpus/52.test.ts
- tests/generated/opcode-corpus/55.test.ts
- tests/generated/opcode-corpus/59.test.ts
- ... (130 more)

## Opcode Coverage

- See generated/opcode-coverage.md
- See generated/opcode-shapes.json

## Parser Files

- model/rom-script-model.ts
- dump-scripts.ts
- src/scripts-all-model.ts
- src/generate-truth-tests.ts

## Known Failures

- opcode 0x18: failing=854, passing=3, corpus=857
- opcode 0x5d: failing=816, passing=0, corpus=816
- opcode 0x09: failing=775, passing=8, corpus=783
- opcode 0xc2: failing=526, passing=0, corpus=526
- opcode 0x5c: failing=500, passing=0, corpus=500
- opcode 0x04: failing=389, passing=0, corpus=389
- opcode 0xa3: failing=308, passing=0, corpus=308
- opcode 0x19: failing=295, passing=0, corpus=295
- opcode 0xba: failing=292, passing=0, corpus=292
- opcode 0x0c: failing=288, passing=7, corpus=295
- opcode 0x1b: failing=178, passing=2, corpus=360
- opcode 0x3c: failing=170, passing=0, corpus=170

## Known Assumptions

- scripts_all instruction extraction uses first top-level indent for each enter script block.
- script end is first top-level opcode 0x00 line in each enter script block.
- branch targets are parsed from text patterns like `(to 0x...)` and `CALL 0x...`.
- LoROM address mapping is used for ROM byte extraction.

## Classification

### Truth-derived
- Script start addresses from `enter script at ... => 0x...` in scripts_all.
- Instruction opcode/address/text from scripts_all top-level lines.
- Expected size from adjacent instruction addresses in scripts_all.
- Branch targets from scripts_all instruction text.

### Parser-derived
- `decodeOpcodeAtSnes` decoded opcode and size for pass/fail scoring.
- `dumpScript` execution output for boundary/reference checks.

### Assumption-derived
- Shape grouping via normalized text templates.
- Expression pattern buckets based on regex categories.
- First top-level END interpreted as script terminator.

## TODO

- Freeze implementation changes to src/rom-script-model.ts, src/opcodes/*, src/expressions/* for opcode phase.
- Use generated/opcode-priority.md to select one opcode for next implementation iteration.
- Produce generated/opcode-XX-investigation.md before any opcode change.
