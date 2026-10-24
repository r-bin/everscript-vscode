# Enemy Archetype Record Initialization ($8F:8D80, $8F:8E08-$8F:8F21)

**ROM source**: clean vanilla ROM, Bank `$8F`\
**Entry**: `$8F:8D80`\
**Body**: `$8F:8E08`\
**Shared tail**: `$8F:90BE`

## Overview

`$8F:8D80` sets the mask at data-bank address `$0310` using the incoming accumulator, then jumps to `$8F:8E08`. The body extracts two packed values from the accumulator, conditionally advances an indirect counter for the entity key held in direct-page `$4C`, initializes a record selected through `$008E,Y`, fills repeated 16-byte-spaced records, applies three indexed Bank `$8F` table values, and transfers control to `$8F:90BE`.

The body does not begin immediately after the entry stub. `$8F:8D86` is a separate control-flow path, so the record is documented as two address ranges rather than treating the intervening bytes as one function.

## Register And Record Effects

- `$8F:8E08` stores `((A >> 2) & 0x00FF)` in direct-page `$02`. The upper two bits of that byte become the additional-record loop count in `$42`.
- If direct-page `$4C` matches the word stored at data-bank address `$0F42`, the routine selects indirect-counter address `$0B11` when the key is `$4E89`, or `$0B13` otherwise. It increments the selected word; values below `$000E` skip the associated APU calls. At or above `$000E`, it clears the word and sends accumulator commands `$0030` and `$0004` through `$8C:81FD`, with the corresponding Y values loaded by the routine.
- The descriptor pointer is read from data-bank address `$008E + Y`. Words at descriptor offsets `+$06` and `+$04` are copied to direct-page `$2E` and `$26`; `$28` is set to `$007E`.
- At the selected record base, the routine zeroes word offsets `+$00`, `+$02`, `+$0C`, `+$0E`, `+$10`, `+$12`, `+$1C`, `+$1E`, `+$20`, `+$22`, `+$2C`, `+$2E`, `+$30`, `+$32`, `+$3C`, and `+$3E`. It initializes the listed boundary slots to `$FF00` or `$FFFF`, then applies `$FF00`/`$00FF` values to six slots for each additional iteration, advancing the record base by `$10` each time.
- The table selector is `(((DP[$02] >> 3) & 7) * 2)`. Words read from `$8F:9104`, `$8F:9124`, and `$8F:9134` plus that selector are copied to record offsets `+$02/+$0C`, `+$04/+$0A`, and `+$06/+$08`, respectively. The final table value remains in A, the current record base remains in Y, and control jumps to `$8F:90BE`.

The table entries and record-field meanings are not identified by this routine alone. In particular, this disassembly does not by itself establish that the copied values are HP, defense, or named hurtbox dimensions; those interpretations remain unverified.

## Clean C Reconstruction

Source: [`reconstructed-c/8F/8F8D80_enemy_archetype_spawn.c`](../../../reconstructed-c/8F/8F8D80_enemy_archetype_spawn.c)

The reconstruction keeps data-bank, direct-page, long-address, and APU accesses explicit. Its external accessors represent those machine address spaces; they are not claims about a higher-level game API.

## Evidence And Limits

- Vanilla disassembly at `$8F:8D80` confirms `TSB $0310` followed by `JMP $8E08` in the same program bank.
- Vanilla disassembly from `$8F:8E08` through `$8F:8F21` confirms the packed-field shifts, counter branch, record writes, three long-indexed table reads, and tail jump to `$90BE`.
- The vanilla VFS reports no existing C decompilation for either `$8F:8D80` or `$8F:8E08`.
- The gap from `$8F:8D86` through `$8F:8E07` is not attributed to this entry. The body range ends at the tail jump’s final byte, `$8F:8F21`.