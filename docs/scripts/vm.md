# The script VM

How Secret of Evermore (US) runs its event scripts, read from the interpreter's own code and
checked against the running game. This is the spec `src/games/evermore/script-vm/` is written
from (`docs/cleanup.md` D3). What each opcode does: [opcodes.md](opcodes.md) and
`soe://rom/assets/scripts/opcodes/<xx>.md`.

## The interpreter

A thread is a slot (16+ bytes in WRAM, from `$28FC`; DP `$7E` points at the current one) whose
first three bytes hold its script pointer. The scheduler (`$8C:CFFD`) loads that pointer into DP
`$82`-`$84` and calls the dispatcher.

The dispatcher at `$8C:D0A6` fetches one byte through `[$82]`, advances the pointer, doubles the
byte and calls `JSR ($E8BD,x)`. The handler reads its operands through the same pointer and returns
with **carry set** to run the next instruction in the same turn, or **carry clear** to end the
thread's turn. In both cases the dispatcher writes the pointer back to the slot. Opcodes `$C3`
and up index past the table into code. The unused opcodes below `$C3` point at `STP`
instructions (`$8C:E8B5`-`$E8BC`).

Because every handler returns through `$8C:D0B2`, a breakpoint at `$8C:D0A6` (instruction
address) plus one at `$8C:D0B2` (pointer afterwards, carry) records exactly what each instruction
did. That is how `tools/script-vm/record-goldens.js` builds `tests/script-vm/goldens.json`.

## Script addresses

Script code lives in the upper half (`$8000`-`$FFFF`) of banks `$92` and up, so it occupies
32 KB windows. Stepping past `$FFFF` continues at `$8000` of the next bank: the jump handler
`$8C:D434` ORs in `$8000` and adjusts the bank byte.

A **packed pointer** (3 bytes in script code and tables) is the offset from `$92:8000` in that
window space: bank = `$92 + (p >> 15)`, address = `$8000 | (p & $7FFF)`. The call setup at
`$8C:CF2E` builds the bus pointer exactly that way.

## Operands

Tokens used in `spec.ts` and the `soe://` opcode pages:

| token | bytes | meaning |
|---|---|---|
| `u8` / `u16` | 1 / 2 | an immediate (little-endian) |
| `u24` | 3 | a packed script pointer |
| `E` | varies | an expression (below) |
| `A` | 1 + varies | arguments: a count n, then n expressions, stored at `$0E80 + 2i` by `$8C:D315`. A count of 0 would loop 65536 times; the game never uses it |
| `Z` | varies | expressions up to one whose value is 0 (`0x9E`, `0xAC`). A decoder treats the plain constant 0 as the end |
| `r16` | 2 | a jump: a signed offset counted from the end of the operand |
| `rb` | 1 | a jump back: target = opcode address − (256 − byte). The handler ORs the byte with `$FF00` |
| `cb` / `c16` | 1 / 2 | a call back: packed(opcode) − (256 − byte), or packed(opcode) + word − `$10000` |
| `skip` | 1 | a byte the handler steps over (`0x4C`) |

Flow: **continues** (carry set), **yields** (carry clear: the thread waits, then resumes after the
instruction), **branches** (the next instruction or the target), **jumps** (only the target),
**calls** (the callee runs in this thread, which resumes after the call; the handler yields),
**starts a thread** (the script runs in parallel in a free slot; this one continues), **ends**,
**resets the game**.

## Expressions

`$8C:EA43` evaluates an expression into a 32-bit value (DP `$02` low, `$04` high). Each byte's
low 7 bits pick a sub-op from the table at `$8C:F041`. Bit 7 (rotated into DP `$8A`) marks the
last byte: after that sub-op the evaluator returns. Sub-op `$00` returns at once.

Operands come in postfix order. `push` (`$29`) saves the current value on the stack, and a
binary operator pops the saved value and combines it with the current one. So `a + b` is
`a, push, b, +` with bit 7 on the `+` byte.

| sub-ops | bytes | value |
|---|---|---|
| `$00` | 0 | the current value; ends the expression |
| `$01` / `$02` | 1 | a byte constant, negative (OR `$FF00`, high word `$FFFF`) / plain |
| `$03` / `$04` | 2 | a word constant, negative (high word `$FFFF`) / plain |
| `$05` / `$0A` / `$0F` | 2 / 2 / 1 | a flag bit: bit number from `$2258` (save area) / `$2834` (temp area) / the slot's local bytes (slot + `$0F`); 1 when set |
| `$06`-`$09` | 2 | a byte (signed, unsigned) or word (high word `$FFFF`, `$0000`) at `$2258` + offset |
| `$0B`-`$0E` | 2 | the same at `$2834` + offset |
| `$10`-`$13` | 1 | the same in the slot's local bytes |
| `$14` `$15` `$16` | 0 | `!`, `~`, negate |
| `$17` `$18` `$1A`-`$28` | 0 | `*` `/` `+` `-` `<<` `>>` `<` `>` `<=` `>=` (signed) `==` `!=` `&` `\|` `^` `\|\|` `&&` |
| `$29` | 0 | push |
| `$2A` / `$2B` | 0 | a random word (`$80:859B`) / a random number below the current value |
| `$2C` | 0 | `$8C:A7C6` on the current value with Y = `$034D` |
| `$2D` / `$2E` | 0 | the entity at `$0341` / the slot's own entity (slot + `$0D`) |
| `$30`-`$3F` / `$40`-`$4F` / `$60`-`$6F` | 0 | the constants 0 to 15 / −16 to −1 / 16 to 31 |
| `$50` `$51` `$52` | 0 | the words at `$0F3E`, `$0F40`, `$0F42` (the entity the camera follows) |
| `$53` | 0 | the other character: `$0F42` with `$4E89` (boy) and `$4F37` (dog) swapped, 0 when none |
| `$54` | 0 | the slot's word at +`$09` |
| `$55` / `$56` | 0 | the word / byte at the address in the current value |
| `$57` | 0 | 1 when `$0F42` = `$0F40` |
| `$58` / `$59` | 0 | the low / high word of the field frame counter `$0B19` |
| `$5A` / `$5B` | 0 | shop routines (`$8E:9FA8`, `$8E:9EBE`) on the current value; a small result code |
| `$5C` | 0 | 1 when the entity in the current value has more HP (+`$2A`) than its last damage (+`$76`) |

`$19`, `$2F` and `$5D`-`$5F` branch to themselves and hang the game. `$70`-`$7F` index past
the table.

A signed read differs from the unsigned one only in the high word, and only when its top bit is
set. So the sign cannot change a value that is only tested for zero (a branch, `!`, `&&`, `||`)
or compared with `==` / `!=` to a constant in 0..`$7F` (a byte) or 0..`$7FFF` (a word): the low
part already differs. The script viewers mark such a `signed` with a warning (`script-vm/print.ts`).

## Where scripts start

| table | content |
|---|---|
| `$92:8000` header | word `+0`: offset of the pointer table; word `+8`: where the global ids start in it; a packed pointer at `+$0C` (a script the game runs, `$92:DE49`) |
| `$92:8000 + word[+0]` | the pointer table: packed pointers, 3 bytes each, up to the first script (2344 entries). Trigger ids and `0xA4` operands are byte offsets into it. Global ids (`0xA3`) index it from `word[+8]` |
| `$92:801B + 5 * room` | the room's enter script (packed pointer; 0 = none) and a word |
| `$9F:FDE7 + 4 * room` → blob + `$0D` | step-on triggers, then B triggers: `[length:2]` and 6-byte entries `y1 x1 y2 x2 id:2` |

A static walk from all of these, following jumps, both sides of each branch and every call and
start, reaches 64,839 instructions without one the game cannot run. Every one of the 2,130 the
game was seen running is among them (`tests/script-vm/rom.test.js`).

## Open

- What most opcodes *do* beyond their operands: [opcodes.md](opcodes.md) names only the ones whose
  handler was read for meaning. Names go into the knowledge entries as they are traced.
- Other releases keep their scripts at `$93` and have their own constants: the decoder refuses
  them (`ScriptRom`).
- `0x9E` / `0xAC` without a free slot read three more expressions and then the list from where
  they stand. That only ends at the same place for lists of three or more.
