# The instruction set

> Status: **solved**, within the limits of the reference. Ported in
> `src/script/ops-{flow,memory,entity,system}.ts` from the 207-case switch in
> `list-rooms.cpp`.

## Shape

One opcode byte, then operands that are either fixed-width fields or
expressions from [the operand grammar](operand_grammar.md). Because operand
length depends on content, **an instruction's size cannot be tabulated** —
it has to be parsed.

The cases are split by theme: control flow, memory writes, entities, system.
Wording is copied from the reference verbatim, quirks and all, because
`check:script` scores the rendered text string-for-string — a nicer phrasing
is indistinguishable from a wrong one. A few upstream bugs are reproduced
deliberately with a comment saying so (`0xad` shifts one value twice and the
other not at all; one sniff-spot case tests the wrong variable).

## The walk is not linear

An `END` ends one **path**, not the script. Code after a conditional is
reachable only through the branch, so every branch destination is recorded
and the walk resumes at the next one it has not reached. Without this a Dark
Forest B-trigger reads as one sniff spot instead of fifteen.

**Relative calls (`RCALL`) are inlined**; several rooms factor a pickup out
into one. **Absolute calls are not** — those are shared subroutines (fades,
room changes) and inlining them would bury the script in boilerplate. Both
choices are the reference's.

## Stopping is a feature

`decodeScript` never guesses a length. An opcode with no case ends the walk
with a reason and an address, because inventing a size produces a confident,
wrong, unfalsifiable listing.

Every case in `list-rooms.cpp` is ported, so **an opcode that stops a walk is
one SoEScriptDumper cannot decode either** — it prints those in red as
`UNKNOWN INSTR`. Some scripts will therefore never render in full. The Rooms
tab shows a final row saying where knowledge ends rather than stopping
silently.

## Names

Summaries name what they touch, using tables generated from the reference's
`data.h` plus `sniffflags.inc` and the encoder's `LOOT_REWARD` enum:
842 flag names, 235 absolute scripts, 128 NPC scripts, 126 rooms, 87 loot
rewards, 144 enemies. Regenerate with:

```
node tools/generate-script-names.js [path/to/data.h] [path/to/everscript]
```

The ~0.2% of summaries that differ are placeholder names for unnamed
scripts: upstream caches the first placeholder it invents for an id across a
whole dump, so its wording depends on decode order.
