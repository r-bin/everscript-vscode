# Script Opcode 0x97: Palette Data Transfer ($8C:E4B1)

The opcode table entry at `$8C:E9EB` points to `$8C:E4B1`. The handler ends with `SEC; RTS` at `$8C:E59F-$8C:E5A0`; opcode `0x98` begins at `$8C:E5A1`. The vanilla ROM slice `$0CE4B1-$0CE5A0` is 240 bytes and contains this complete handler.

## Entry and operands

The script VM dispatches opcode `0x97` through the word at `$8C:E9EB`. A scan found no literal direct `JSL`/`JML` reference through the `$0C/$4C/$8C/$CC` bank mirrors, and no same-bank `JSR $E4B1`; the established entry is the opcode table. Script bytecode reachable from the script tables invokes opcode `0x97`; the vanilla VFS lists examples under `soe://rom/assets/scripts/opcodes/97.md`.

The handler increments `$7E:0F3C`, evaluates seven expressions at `$8C:EA43` in order, and pushes each low word before assigning the values to direct-page fields:

| Expression | Observed use |
|---|---|
| 1 | Added to BGR555 bits `$001F` |
| 2 | Shifted left 5, then added to bits `$03E0` |
| 3 | Byte-swapped and shifted left 2, then added to bits `$7C00` |
| 4 | Stored at DP `$12`; semantic role not established |
| 5 | Stored at DP `$04`; semantic role not established |
| 6 | Doubled into DP `$02`; used as the starting color index |
| 7 | Stored at DP `$1C` and `$10`; used as transfer length and loop count |

## Palette loop

The handler sets DP `$14` to `1`. It calls `$90:D34C` once per loop pass; that helper only reads DP `$14` and returns, with no writes. The handler then reads the word at `$7E:61F1 + DP[$18] + DP[$02]`, adds the three offsets to the corresponding BGR555 bitfields, and writes the combined word back. Red and green underflow clamp to zero and overflow clamps to `$001F`/`$03E0`; the blue path follows its literal 16-bit sign test and `$8000` comparison. The DP `$26` and `$2E` pointers advance by two bytes per pass.

The branch at `$8C:E524` goes to the loop footer at `$8C:E57D`. That footer decrements DP `$10` and branches back to `$8C:E526` while the result is non-negative. Thus the block containing the `$90:D34C` call is reached by the handler's own loop, not by a separate entry point.

## Transfer and return

After the loop, the handler sets the CGRAM source to `$7E:65F1 + DP[$18] + DP[$02]`, sets the destination color index from `DP[$02] >> 1`, loads `X = DP[$1C] * 2`, and calls `$80:85FA`. It then restores the data bank, decrements `$7E:0F3C`, sets carry, and returns.

The fourth and fifth expression roles, the meaning of DP `$18`, and the purpose of the initial source pointer `$7E:6187 + DP[$02]` are not established here. The C file keeps these inputs and register interactions explicit without assigning additional meanings.

## Reconstruction

Source: [`reconstructed-c/8C/8CE4B1_opcode_97_palette_transfer.c`](../../../reconstructed-c/8C/8CE4B1_opcode_97_palette_transfer.c). Its read/write and DMA helper signatures are C-level abstractions of the observed WRAM/register effects, not claims about native C calling conventions.