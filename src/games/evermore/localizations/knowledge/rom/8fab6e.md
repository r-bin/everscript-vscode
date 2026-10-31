---
addr: 8FAB6E
kind: code
category: ⚔️
name: calc_8way_direction_with_random_jitter
title: Target directional heading calculator with random angular jitter ($8F:AB6E)
confidence: confirmed
evidence: ["disasm: samples random word via $80:859B; masks with $3E to index jitter table $8F:DB0C; subtracts entity coordinates +$1A,Y and +$1C,Y from target DP $46/$48; calls $8F:AA05 to get base 8-way direction; adds jitter offset and masks with $0E; caller: $8F:AB92"]
see: [rom/80859b.md, rom/8faa05.md]
tags: [ai, combat, movement, rng]
---
Calculates an 8-way directional heading from entity `Y` toward target coordinate `$46`/`$48` with pseudo-random angular jitter. Uses `$8F:AA05` to derive the base 8-way heading from coordinate deltas, adds a random angular offset from table `$8F:DB0C` indexed via `random_number_generator` (`$80:859B`), and clamps the result to an even direction enum (0..14) for natural enemy pursuit and wandering AI.
