# Script Opcodes 0x58 and 0x59: Music Volume Fade

**Handlers:** `$8C:DC87` (`0x58`), `$8C:DC74` (`0x59`)\
**Operands:** none\
**Confidence:** confirmed

Opcode `0x58` sets the shared music-volume fade step at `$7E:009B` to `$10` and calls `$8C:8619`. Opcode `0x59` sets it to `$F0` (signed `-16`) and calls the same routine. The fade stepper updates the current music volume and sends the resulting volume command; each handler restores the data bank and returns carry set.

The host-side models are in [8CDC74_58_59_music_fade.c](../../../reconstructed-c/8C/8CDC74_58_59_music_fade.c). The shared `$8C:8619` stepper remains an external helper boundary.

## Evidence

- Opcode table entries `$8C:E96D` and `$8C:E96F` dispatch to `$8C:DC87` and `$8C:DC74` respectively.
- `$8C:DC87` stores `$10` to `$9B`; `$8C:DC74` stores `$F0` to `$9B`.
- Both call `$8C:8619`, restore the saved data bank, then execute `SEC; RTS`.
- `$8C:8619` reads `$9B`, updates the current volume toward its target, and commits it through APU command `$28`.