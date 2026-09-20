# script/ — Everscript Script Decoder

A **TypeScript port** of [SoEScriptDumper](https://github.com/black-sliver/SoEScriptDumper)
(`list-rooms.cpp`), the reference disassembler that ships inside the sibling
`SoETilesViewer` checkout. Pure: takes a ROM buffer, returns data. No VS Code
API, no filesystem, no rendering.

This is the only script decoder in the repo. It replaced
`src/emulator/room-script-model.js` + `opcode-registry.js`, which were an
independent re-derivation.

## Why a port, and why this one

Measuring the old decoder against the dumper's own output showed what
re-deriving costs:

| | old | now |
|---|---|---|
| Instructions landing on a real instruction boundary | 88.5% | **99.994%** |
| Summary text matching the reference, word for word | — | **99.77%** |
| Entry points walked to a clean END | — | 63.8% |

The old failure was concentrated in one missing concept. Operands are not
fixed-width fields — they are little postfix expressions whose length depends
on their own contents. Treating `IF`'s operand as a fixed size works until a
script does arithmetic, and then every byte after it decodes as noise, quietly.
`0x09`, `0x17`, `0x18`, `0x08` and `0x86` alone accounted for 2111 of the 2119
scripts that desynced.

## Files

| File | Description |
|---|---|
| `addressing.ts` | SNES↔ROM mapping, script pointer packing, value formatting |
| `expression.ts` | The operand grammar — the stack machine described below |
| `cursor.ts` | The read head one instruction's operands are consumed through |
| `ops-flow.ts` | END, branches, conditionals, calls, sleep |
| `ops-memory.ts` | Variable writes, flag bits, script arguments |
| `ops-entity.ts` | Movement, facing, spawning, damage, teleports |
| `ops-system.ts` | Text, audio, screen, money, shops, state pokes |
| `decoder.ts` | `decodeScript()` — walks a script into summarised instructions |
| `names.ts` / `names.json` | The name tables, generated from `data.h` |
| `room-scripts.ts` | A room's enter / step-on / B-trigger scripts |
| `index.ts` / `index.js` | Public API and the CommonJS facade |

## The operand grammar

Read bytes until one has bit 7 set. Each byte is either

- an **entity** (`0x50`..`0x53`, `0x2d`, `0x2e`) — boy, dog, controlled char…
- an **inline constant**, when `b & 0x70` is `0x30`, `0x40` or `0x60`, giving
  the common range −16..31 in a single byte
- an **operator**, some of which consume one or two further bytes

Operators pop from a stack that `0x29` pushes to. The stack is deliberately
*not* reset between operands: the game's own scripts push a value in one
operand and pop it in a later one, so it belongs to the decode run.

## Summaries, and why the wording is copied exactly

`npm run check:script` scores the rendered text against the dumper's, string
for string. That is what keeps the port honest — a case that reads the right
number of bytes but describes them wrongly is otherwise invisible. So the
phrasing is upstream's, quirks included, and a few upstream bugs are
reproduced deliberately with a comment saying so (`0xad` shifts one value
twice and the other not at all; one sniff-spot case tests the wrong variable).
Improving the wording means losing the measurement, so don't.

The names come from `data.h` and `sniffflags.inc`, imported by
`tools/generate-script-names.js` into the committed `names.json` — 842 flag
names, 235 absolute scripts, 128 NPC scripts, 126 rooms. Re-run it only when
upstream's tables change:

```
node tools/generate-script-names.js [path/to/data.h]
```

The ~0.23% of summaries that differ are almost all placeholder names for
scripts nobody has named. Upstream *caches* the first placeholder it invents
for an id across the whole dump, so which wording it settles on depends on
decode order; these lookups are stateless and describe the call site in hand.

## Stopping is a feature

`decodeScript` never guesses a length. When it meets an opcode with no case it
stops and says so in `stopReason` / `stoppedAt`, because the alternative —
inventing a size — produces a confident, wrong, unfalsifiable listing. That is
exactly how the previous decoder failed.

Every case in `list-rooms.cpp` is ported, so an opcode that stops the walk is
one **SoEScriptDumper cannot decode either**. It prints those in red as
`UNKNOWN INSTR`, its own marker for "length unknown, parsing stops here".
Nobody knows how long they are, so some scripts will never render in full,
whatever we do. `src/rooms` shows a final row saying where knowledge ends
rather than a table that silently stops.

Walks also stop on `bad-operand` — a well-known opcode whose operand bytes do
not parse, which usually means the entry point was not really a script.

## Build and validation

```
npm run build:script    # tsc -p tsconfig.script.json -> src/script/dist/
npm run check:script    # diff boundaries AND summaries against script_all
```

`dist/` is gitignored and rebuilt by `npm test`, `npm run package` and
`npm run deploy`. Consumers `require('../script')` (the facade), never `./dist`.

The parity harness needs the `SoETilesViewer` checkout and a ROM; it *skips*
rather than fails when either is missing, since neither is committed here.
Override with `SOE_TILES_VIEWER`, `SOE_SCRIPT_DUMP`, `EVERSCRIPT_ROM`.

## Not ported yet

- **Decoded game text.** `SHOW TEXT` reports the pointer and whether the blob
  is compressed, but not the string; that needs the text decompressor. These
  three opcodes are scored on boundaries only.
- **Inlined RCALL bodies.** The dumper can recurse into a called script and
  print it inline. Here a call is one row; following it is the caller's job.
