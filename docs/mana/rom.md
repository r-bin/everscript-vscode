# Secret of Mana — ROM Addresses

Every routine and table here was read from Secret of Mana's own code and verified in the decoder implementation (`src/games/mana/`). Format and architecture: [README.md](README.md).

## Routines and Tables

| Address | What | Evidence |
|---|---|---|
| `$C0:C481` | Map set loader routine (decompresses graphics and palettes) | `tools/mana/check-events.js`, `src/games/mana/decoder/animate.ts` |
| `$C0:FFC0` | SNES standard internal ROM registration header (title, cart layout, checksum) | `src/games/mana/decoder/rom.ts` |
| `$C0:FFD5`–`FFD8` | map mode `$21` (HiROM, SlowROM), type `$02` (ROM + RAM + battery), ROM size `$0B` (2 MB), SRAM size `$03` (8 KB) | read in the US ROM, 2026-11-15 |
| `$00:FFEA`, `$00:FFEE` | NMI vector `$0100`, IRQ vector `$0104`: both point into WRAM, where the game keeps its own jumps; emulation-mode vectors unused | read in the US ROM, 2026-11-15 |
| `$00:8004` | reset entry: emulation off, 8-bit A/X, then `JML $C1:0010` | read in the US ROM, 2026-11-15 |
| `$00–$02:8000–FFFF` | code, densely packed: no run of 64 `$00`/`$FF` bytes; `$00:8020`, `$00:823A`, `$00:84EA` are code (they matter for a combo image, `docs/combo/README.md` §4) | read in the US ROM, 2026-11-15 |
| `$C1:E76D` | Step-on coordinate event handler and doorway trigger dispatch table | `tools/mana/check-events.js` |
| `$CC:0000` | Compressed character and NPC tile graphics source bank | `src/games/mana/decoder/chars.ts` |
| `$FF:0000` | Character sprite definition and animation bytecode sequence bank | `src/games/mana/decoder/chars.ts` |
