# The operand grammar ("sub-instructions")

> Status: **solved.** Ported in `src/script/expression.ts` from
> `buf_parse_sub` in SoEScriptDumper's `list-rooms.cpp`.

## Why this is the important one

An operand is **not a fixed-width field**. It is a little postfix expression
whose length depends on its own contents. An `IF` carrying `$22f1 & 0x40` is
a different size from one carrying `arg3`.

Missing this is what broke the decoder that came before: it put 88.5% of
instructions on a real boundary but **lost alignment partway through 2119 of
4000 scripts**, and a decoder that loses alignment does not fail — it keeps
emitting plausible nonsense. Five opcodes (`0x09`, `0x17`, `0x18`, `0x08`,
`0x86`) accounted for 2111 of those, all for this reason.

## The encoding

Read bytes until one has **bit 7 set**, which ends the expression. Each byte
is one of:

| Byte | Meaning |
|---|---|
| `0x50`–`0x53`, `0x2d`, `0x2e` (± bit 7) | An entity: boy, dog, controlled char, non-controlled char, last entity, script's entity |
| `b & 0x70` ∈ {`0x30`, `0x40`, `0x60`} | An inline constant, covering −16..31 in one byte |
| anything else | An operator, some consuming one or two further bytes |

Operators pop from a stack that `0x29` pushes to. **The stack is not reset
between operands** — the game's own scripts push a value in one operand and
pop it in a later one — so it belongs to the decode run, not to one call. It
*is* cleared after a parse failure, so a later operand cannot pop something
never meant for it.

Notable operators: `0x01`–`0x04` constants (signed/unsigned, byte/word),
`0x05`/`0x0a` bit tests, `0x06`–`0x0e` variable reads against the `$2258`
(save) or `$2834` (scratch) bank, `0x0f`–`0x13` script arguments,
`0x14`–`0x16` inversions, `0x17`–`0x28` binary operators, `0x2a`/`0x2b`
random, `0x55`/`0x56` dereference, `0x58`/`0x59` the game timer.

## How it is checked

`npm run check:script` decodes every script in the ROM and compares both
instruction boundaries and rendered text against SoEScriptDumper's own dump:
**99.992% of instructions land on a real boundary** and **99.776% of
summaries match word for word**. Floors only move up.
