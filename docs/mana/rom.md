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
| `$C3:0000` | sound init (`JMP $002C`, JSL entry): waits up to `$0800` loops for the SPC700 boot ROM's `$BBAA`, then uploads the driver in 6 blocks (pointer table `$C3:0008`, ARAM destinations `$C3:0014`) and starts it at ARAM `$0200`; without `$BBAA` but with a driver recorded in WRAM it sends `$08` and skips the upload. Clears WRAM `$1E00–$1EFF`. At power-on it runs **inside the NMI** (own stack near `$04F2`, from line 225 into the next frame) over frames 25–58, while the main thread idles in `$7E:A29F`; port 1 shows the boot ROM's `$BB` until the driver starts, `$00` after | disasm; MesenCE port writes and stack, frames 25–58 after power-on (2026-11-15) |
| `$C3:0004` | sound command entry (`JMP $0160`, JSL): direct page `$1E00`, command in `$1E00` (`$01` song with params `$1E01–$1E03`, `$02–$6F` → `$C3:059F`, `$70+` → `$C3:05F3`) | disasm |
| ARAM `$0279`, `$0CAF` | the driver's main loop calls its port poll `$0CAF`: port 0 non-zero = command (echoed, then dispatched once port 0 changes). `$FE` = upload: port 1 bits 0–2 pick a receive handler from ARAM `$1418` (mode 3 = 3 bytes per handshake from ports 1–3), ports 2–3 the destination; a counter in port 0 paces it; port 0 = 0 with mode 0 ends it and the driver returns to its main loop at `$027C` | ARAM read in MesenCE at frame 800, disasm (2026-11-15) |
| `$CF:FE34` | pad 1 read during play: `LDA $4218` / `STA $0042` (A 16-bit); pad 2 at `$CF:FE3A`. Main thread, not the NMI: reached from the main loop (`JSR $93B9` at `$C0:B0AC` → `$C0:951C` → `JSL $CF:FE00`) and through the `$C0:8000` entry (`$C0:939F`); before play the pad is read by `$7E:A6E8` from inside the NMI (lines 236–252) | MesenCE read callbacks and stacks along a stored playback (2026-11-15) |
| `$02:B5E7` | PPU reset: forced blank, NMI off, every PPU register to its default ($2130 = `$30`, $2132 = `$E0`, mode-7 matrix identity) | disasm; MesenCE write callbacks |
| `$01:FD52` | field BG set-up (JSR): mode `$09`, BG1/BG2 maps `$51`/`$39`, BG3 map `$58` or `$5C` by bit 0 of direct page `$E8`, character bases `$00`/`$04`; when `$B8 & $F8` is `$F8`, mode 7 instead | disasm; MesenCE write callbacks |
| `$02:AAB1` | field screen set-up: mosaic, main/sub screen and colour math from direct page `$20–$23`, windows cleared, OBSEL `$63` | disasm; MesenCE write callbacks |
| `$C0:27E0` | title screen set-up: mode 5 and its bases, all constants | disasm; MesenCE write callbacks |
| `$00:C0BF` onwards | the NMI during play: brightness, BG1–BG3 scrolls and HDMA enable every frame | MesenCE write callbacks, frames 9000–10137 of a playback |
| `$C1:E76D` | Step-on coordinate event handler and doorway trigger dispatch table | `tools/mana/check-events.js` |
| `$CC:0000` | Compressed character and NPC tile graphics source bank | `src/games/mana/decoder/chars.ts` |
| `$FF:0000` | Character sprite definition and animation bytecode sequence bank | `src/games/mana/decoder/chars.ts` |
