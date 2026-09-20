# script/ — Everscript Script Decoder

A **TypeScript port** of [SoEScriptDumper](https://github.com/black-sliver/SoEScriptDumper)
(`list-rooms.cpp`), the reference disassembler that ships inside the sibling
`SoETilesViewer` checkout. Pure: takes a ROM buffer, returns data. No VS Code
API, no filesystem, no rendering.

## Why a port, and why this one

The repo already had a script decoder (`src/emulator/room-script-model.js`).
It was an independent re-derivation, and measuring it against the dumper's own
output showed what that costs:

| | |
|---|---|
| Instructions landing on a real instruction boundary | 88.5% |
| Scripts that lost alignment partway through | **2119 of 4000 (53%)** |

The failure was concentrated in one missing concept. Operands are not
fixed-width fields — they are little postfix expressions whose length depends
on their own contents. Treating `IF`'s operand as a fixed size works until a
script does arithmetic, and then every byte after it decodes as noise, quietly.
`0x09`, `0x17`, `0x18`, `0x08` and `0x86` alone accounted for 2111 of the 2119
derailments.

Current state of the port:

| | |
|---|---|
| Instructions landing on a real boundary | **99.986%** (192,020 / 192,047) |
| Entry points walked to a clean END | 53.1% |

The remaining 47% stop early *on purpose* — see "Stopping is a feature".

## Files

| File | Description |
|---|---|
| `addressing.ts` | SNES↔ROM mapping, script pointer packing, value formatting |
| `expression.ts` | The operand grammar — the stack machine described below |
| `opcodes.ts` | Per-opcode operand layout, and what is known about the rest |
| `decoder.ts` | `decodeScript()` — walks a script into instructions |
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

## Stopping is a feature

`decodeScript` never guesses a length. When it meets an opcode whose layout is
not verified it stops and says so in `stopReason` / `stoppedAt`, because the
alternative — inventing a size — produces a confident, wrong, unfalsifiable
listing. That is exactly how the previous decoder failed.

Two reasons a walk stops early:

- **105 opcodes SoEScriptDumper cannot decode either**, most of `0xC0`..`0xFF`.
  It prints them in red as `UNKNOWN INSTR`, its own marker for "length unknown,
  parsing stops here". Nobody knows how long they are.
- **~20 opcodes whose layout is not pinned down yet** — listed in
  `opcodes.ts` `UNRESOLVED` with how close the best simple layout got, so the
  next pass knows exactly which cases to read out of `list-rooms.cpp`.

## Build and validation

```
npm run build:script    # tsc -p tsconfig.script.json -> src/script/dist/
npm run check:script    # diff instruction boundaries against script_all
```

`dist/` is gitignored and rebuilt by `npm test`, `npm run package` and
`npm run deploy`. Consumers `require('../script')` (the facade), never `./dist`.

The parity harness needs the `SoETilesViewer` checkout and a ROM; it *skips*
rather than fails when either is missing, since neither is committed here.
Override with `SOE_TILES_VIEWER`, `SOE_SCRIPT_DUMP`, `EVERSCRIPT_ROM`.

## How the opcode table was built

`script_all` prints every instruction with its address, so consecutive
addresses give each instruction's true length. Every candidate layout was
tested against every real instance of its opcode — thousands each for the
common ones — and only layouts reproducing *every* observed length were kept.
Opcodes that end a run or print extra lines have no measurable successor;
those few were read out of `list-rooms.cpp` and are marked in the table.

A few opcodes need a shape a flat layout cannot express and are hand-ported in
`OPCODE_STEPS`: the WRITE family (`0x10/11/14/15/18/19/1c/1d`) whose value byte
may be the value, a literal announcement, or the first byte of an expression;
and `0x78/0x79`, `0x6f/0x73/0x9d`, which interleave fields and expressions.

## Not ported yet

- **Instruction summaries.** The decoder produces structure (address, opcode,
  operands, size) but not yet the English rendering (`CHANGE MAP = 0x34 …`).
  That is `list-rooms.cpp`'s 207-case switch plus `data.h`'s name tables.
- **The old decoder is still the one wired into the Rooms tab.** It stays until
  this one produces summaries, so the UI does not regress.
