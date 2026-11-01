# Secret of Mana — ROM Addresses

Every routine and table here was read from Secret of Mana's own code and verified in the decoder implementation (`src/games/mana/`). Format and architecture: [README.md](README.md).

## Routines and Tables

| Address | What | Evidence |
|---|---|---|
| `$C0:C481` | Map set loader routine (decompresses graphics and palettes) | `tools/mana/check-events.js`, `src/games/mana/decoder/animate.ts` |
| `$C0:FFC0` | SNES standard internal ROM registration header (title, cart layout, checksum) | `src/games/mana/decoder/rom.ts` |
| `$C1:E76D` | Step-on coordinate event handler and doorway trigger dispatch table | `tools/mana/check-events.js` |
| `$CC:0000` | Compressed character and NPC tile graphics source bank | `src/games/mana/decoder/chars.ts` |
| `$FF:0000` | Character sprite definition and animation bytecode sequence bank | `src/games/mana/decoder/chars.ts` |
