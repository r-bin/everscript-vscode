# Boot & Reset Handler Disassembly & Decompilation

- **ROM Location**: Bank `$80` (`$80:8020` – `$80:8236`) / FastROM mirror of Bank `$00` (`$00:8020` – `$00:8236`)
- **Native Interrupt Vector**: `$00:FFE0` (Emulation Reset Vector holds `$8020`)
- **Primary Function**: `reset_handler` (`$80:8020`)
- **Exit**: `JML $80:8B66` (jumps to `main_loop_entry`)

---

## 1. Sequence Overview

When the SNES CPU is powered on or reset:
1. The 65816 CPU starts in **6502 Emulation Mode** with interrupts disabled.
2. The reset vector fetches `$8020`.
3. The screen is immediately blanked (`$2100 = $8F`), preventing display noise.
4. The CPU switches to **65816 Native 16-bit Mode** (`CLC; XCE; REP #$30`).
5. The stack pointer is initialized to `$1FFF`, Direct Page is set to `$0000`, and Data Bank is set to `$80`.
6. All PPU hardware registers (`$2101`–`$2133`) and CPU registers (`$4200`–`$420D`) are initialized to safe zero or default states.
7. DMA Channel 0 performs fixed-source transfers from ROM offset `$80:8008` (containing `$00`) to wipe:
   - 64 KB VRAM (`$0000`–`$FFFF`)
   - 64 KB WRAM Bank `$7E` (`$7E:0000`–`$7E:FFFF`)
   - 64 KB WRAM Bank `$7F` (`$7F:0000`–`$7F:FFFF`)
8. Shadow PPU registers in RAM are initialized (`$0106 = $8F` for screen off, scroll offsets set to `$00FF`).
9. The 4-word 64-bit PRNG seed at `$0133`–`$0139` is initialized by latching the hardware PPU horizontal/vertical scan counters and XORing with classic programmer constants (`$DEAD`, `$63C7`, `$BABE`, `$E294`, `$BEEF`, `$5A0D`, `$FACE`, `$18BF`).
10. Hardware sub-systems (audio engine, graphics buffers) are initialized via calls to `$8C:8000`, `$80:B5B6`, `$8C:801F`, `$80:B72B`.
11. NMI interrupts and automatic joypad polling are enabled by writing `$81` to `$4200` (and saving to shadow mirror `$0E6B`).
12. The handler executes `JML $80:8B66` to enter the game main loop.

---

## 2. Disassembly & Annotations

### Phase A: 6502 Emulation Mode to 65816 Native Mode
```assembly
; ==============================================================================
; RESET Vector Entry ($00:FFE0 points to $8020)
; CPU State: 6502 Emulation Mode (A=8-bit, X/Y=8-bit, interrupts masked)
; ==============================================================================
$80:8020  A9 8F        LDA #$8F        ; Force Blank (Screen brightness 0, display OFF)
$80:8022  8D 00 21     STA $2100       ; Write INIDISP
$80:8025  18           CLC             ; Clear carry
$80:8026  FB           XCE             ; Exchange Carry with Emulation bit -> Native Mode!
$80:8027  C2 30        REP #$30        ; 16-bit Accumulator (M=0), 16-bit Index (X=0)
$80:8029  5C 2D 80 80  JML $80802D     ; Jump into FastROM space (Bank $80)

; ==============================================================================
; CPU Environment Setup
; ==============================================================================
$80:802D  A2 FF 1F     LDX #$1FFF      ; Set stack pointer to $1FFF (top of Bank $7E mirror)
$80:8030  9A           TXS
$80:8031  F4 00 00     PEA $0000       ; Push $0000 to stack (used later as boot flag)
$80:8034  A9 00 00     LDA #$0000
$80:8037  5B           TCD             ; Direct Page (D) = $0000
$80:8038  4B           PHK             ; Push Program Bank ($80)
$80:8039  AB           PLB             ; Data Bank (B) = $80
```

### Phase B: Wiping PPU & CPU Hardware Registers
```assembly
$80:803A  E2 30        SEP #$30        ; 8-bit A, 8-bit X/Y for hardware MMIO registers
$80:803C  9C 01 21     STZ $2101       ; OBSEL: Sprite base = 0, size = 8x8 / 16x16
$80:803F  9C 05 21     STZ $2105       ; BGMODE: Mode 0
$80:8042  9C 06 21     STZ $2106       ; MOSAIC: Off
$80:8045  9C 07 21     STZ $2107       ; BG1SC: Tilemap base 0
$80:8048  9C 08 21     STZ $2108       ; BG2SC
$80:804B  9C 09 21     STZ $2109       ; BG3SC
$80:804E  9C 0A 21     STZ $210A       ; BG4SC
$80:8051  9C 0B 21     STZ $210B       ; BG12NBA
$80:8054  9C 0C 21     STZ $210C       ; BG34NBA
$80:8057  A9 FF        LDA #$FF
$80:8059  9C 0D 21     STZ $210D       ; BG1HOFS = 0 (low byte)
$80:805C  9C 0D 21     STZ $210D       ; BG1HOFS = 0 (high byte)
$80:805F  8D 0E 21     STA $210E       ; BG1VOFS = -1 (two writes of $FF)
$80:8062  8D 0E 21     STA $210E
$80:8065  9C 0F 21     STZ $210F       ; BG2HOFS = 0
$80:8068  9C 0F 21     STZ $210F
$80:806B  8D 10 21     STA $2110       ; BG2VOFS = -1
$80:806E  8D 10 21     STA $2110
$80:8071  9C 11 21     STZ $2111       ; BG3HOFS = 0
$80:8074  9C 11 21     STZ $2111
$80:8077  8D 12 21     STA $2112       ; BG3VOFS = -1
$80:807A  8D 12 21     STA $2112
$80:807D  9C 13 21     STZ $2113       ; BG4HOFS = 0
$80:8080  9C 13 21     STZ $2113
$80:8083  8D 14 21     STA $2114       ; BG4VOFS = -1
$80:8086  8D 14 21     STA $2114
$80:8089  A9 80        LDA #$80        ; VMAIN: Increment after writing high byte ($2119)
$80:808B  8D 15 21     STA $2115
$80:808E  9C 1A 21     STZ $211A       ; M7SEL
$80:8091  9C 1B 21     STZ $211B       ; M7A (Matrix A = 0x0100 Identity)
$80:8094  A9 01        LDA #$01
$80:8096  8D 1B 21     STA $211B
$80:8099  9C 1C 21     STZ $211C       ; M7B = 0
$80:809C  9C 1C 21     STZ $211C
$80:809F  9C 1D 21     STZ $211D       ; M7C = 0
$80:80A2  9C 1D 21     STZ $211D
$80:80A5  9C 1E 21     STZ $211E       ; M7D (Matrix D = 0x0100 Identity)
$80:80A8  A9 01        LDA #$01
$80:80AA  8D 1E 21     STA $211E
$80:80AD  9C 1F 21     STZ $211F       ; M7X = 0
$80:80B0  9C 1F 21     STZ $211F
$80:80B3  9C 20 21     STZ $2120       ; M7Y = 0
$80:80B6  9C 20 21     STZ $2120
$80:80B9  9C 23 21     STZ $2123       ; W12SEL: Disable window masking
$80:80BC  9C 24 21     STZ $2124       ; W34SEL
$80:80BF  9C 25 21     STZ $2125       ; WOBJSEL
$80:80C2  9C 26 21     STZ $2126       ; WH0
$80:80C5  9C 27 21     STZ $2127       ; WH1
$80:80C8  9C 28 21     STZ $2128       ; WH2
$80:80CB  9C 29 21     STZ $2129       ; WH3
$80:80CE  9C 2A 21     STZ $212A       ; WBGLOG
$80:80D1  9C 2B 21     STZ $212B       ; WOBJLOG
$80:80D4  9C 2C 21     STZ $212C       ; TM: Main screen designation = 0
$80:80D7  9C 2D 21     STZ $212D       ; TS: Sub screen designation = 0
$80:80DA  9C 2E 21     STZ $212E       ; TMW
$80:80DD  9C 2F 21     STZ $212F       ; TSW
$80:80E0  A9 30        LDA #$30        ; CGWSEL: Direct color off, subscreen add off
$80:80E2  8D 30 21     STA $2130
$80:80E5  9C 31 21     STZ $2131       ; CGADSUB: Disable color math
$80:80E8  A9 E0        LDA #$E0        ; COLDATA: Master RGB brightness clear
$80:80EA  8D 32 21     STA $2132
$80:80ED  9C 33 21     STZ $2133       ; SETINI: Non-interlaced, Mode 7 wrap off
$80:80F0  9C 00 42     STZ $4200       ; NMITIMEN: Disable NMI & Auto-Joypad
$80:80F3  A9 FF        LDA #$FF
$80:80F5  8D 01 42     STA $4201       ; WRIO: Programmable I/O port
$80:80F8  9C 07 42     STZ $4207       ; HTIMEL
$80:80FB  9C 08 42     STZ $4208       ; HTIMEH
$80:80FE  9C 09 42     STZ $4209       ; VTIMEL
$80:8101  9C 0A 42     STZ $420A       ; VTIMEH
$80:8104  9C 0B 42     STZ $420B       ; MDMAEN: Disable all DMA channels
$80:8107  9C 0C 42     STZ $420C       ; HDMAEN: Disable all HDMA channels
$80:810A  A9 01        LDA #$01
$80:810C  8D 0D 42     STA $420D       ; MEMSEL: Enable FastROM (2.68 MHz access to banks $80+)
```

### Phase C: DMA Zeroing of VRAM and WRAM Banks $7E and $7F
```assembly
; ==============================================================================
; Clear 64 KB VRAM ($0000..$FFFF) using DMA 0
; ==============================================================================
$80:810F  C2 20        REP #$20        ; 16-bit Accumulator
$80:8111  E2 10        SEP #$10        ; 8-bit Index
$80:8113  9C 05 43     STZ $4305       ; Transfer size $0000 = 65,536 bytes
$80:8116  A9 18 09     LDA #$1809      ; Mode $09: Fixed source, 2 registers ($2118, $2119)
$80:8119  8D 00 43     STA $4300       ; Set DMAP0 / BBAD0 ($2118)
$80:811C  A9 00 80     LDA #$8000      ; Source address: $8008 in Bank $80 (contains $00)
$80:811F  8D 02 43     STA $4302       ; A1T0L / A1T0H
$80:8122  A2 80        LDX #$80        ; Source bank $80
$80:8124  8E 04 43     STX $4304       ; A1B0
$80:8127  9C 16 21     STZ $2116       ; VMADDL/VMADDH = $0000 (Start at VRAM word 0)
$80:812A  A2 01        LDX #$01        ; Trigger DMA Channel 0
$80:812C  8E 0B 42     STX $420B       ; MDMAEN -> Clear 64 KB VRAM!

; ==============================================================================
; Clear 64 KB WRAM Bank $7E ($7E:0000..$7E:FFFF) using DMA 0
; ==============================================================================
$80:812F  9C 05 43     STZ $4305       ; Size 65,536 bytes
$80:8132  A9 80 08     LDA #$8008      ; Mode $08: Fixed source, 1 register write to $2180 (WMDATA)
$80:8135  8D 00 43     STA $4300
$80:8138  A9 00 80     LDA #$8000      ; Source: $8008 ($00)
$80:813B  8D 02 43     STA $4302
$80:813E  A2 80        LDX #$80        ; Bank $80
$80:8140  8E 04 43     STX $4304
$80:8143  9C 81 21     STZ $2181       ; WRAM target address = $0000 (WMADDL)
$80:8146  A2 7E        LDX #$7E        ; Bank $7E (WMADDH / WMADDM)
$80:8148  8E 83 21     STX $2183
$80:814B  9C 82 21     STZ $2182
$80:814E  A2 01        LDX #$01
$80:8150  8E 0B 42     STX $420B       ; Trigger DMA Channel 0 -> Clear WRAM Bank $7E!

; ==============================================================================
; Clear 64 KB WRAM Bank $7F ($7F:0000..$7F:FFFF) using DMA 0
; ==============================================================================
$80:8153  9C 05 43     STZ $4305       ; Size 65,536 bytes
$80:8156  A9 80 08     LDA #$8008      ; Mode $08: Fixed source, write to $2180
$80:8159  8D 00 43     STA $4300
$80:815C  A9 00 80     LDA #$8000
$80:815F  8D 02 43     STA $4302
$80:8162  A2 80        LDX #$80
$80:8164  8E 04 43     STX $4304
$80:8167  9C 81 21     STZ $2181       ; WRAM target address = $0000
$80:816A  A2 7F        LDX #$7F        ; Bank $7F
$80:816C  8E 83 21     STX $2183
$80:816F  9C 82 21     STZ $2182
$80:8172  A2 01        LDX #$01
$80:8174  8E 0B 42     STX $420B       ; Trigger DMA Channel 0 -> Clear WRAM Bank $7F!
```

### Phase D: Initializing PPU Shadow Registers
```assembly
$80:8177  A9 8F 00     LDA #$008F      ; Shadow $0106 = Screen off / force blank
$80:817A  8D 06 01     STA $0106
$80:817D  A9 FF 00     LDA #$00FF      ; Default scroll shadows: -1 ($00FF)
$80:8180  8D 10 01     STA $0110       ; BG2VOFS shadow
$80:8183  8D 14 01     STA $0114       ; BG4VOFS shadow
$80:8186  8D 18 01     STA $0118       ; BG2HOFS shadow
$80:8189  8D 20 01     STA $0120       ; Window shadow
$80:818C  8D 1E 01     STA $011E
$80:818F  8D 1C 01     STA $011C       ; BG3HOFS shadow
$80:8192  A9 FF FF     LDA #$FFFF
$80:8195  8D F4 11     STA $11F4       ; Invalidate active script slot mailbox
$80:8198  22 7F 85 80  JSL $80857F     ; Initialize palette/CGRAM shadow buffer ($80:857F)
```

### Phase E: PRNG Seeding from Hardware Counters
```assembly
; ==============================================================================
; Seed PRNG words $0133, $0135, $0137, $0139 from hardware PPU raster latches
; ==============================================================================
$80:819C  A9 0D F0     LDA #$F00D      ; Magic base constant
$80:819F  E2 20        SEP #$20        ; 8-bit A
$80:81A1  69 01        ADC #$01
$80:81A3  AD 37 21     LDA $2137       ; Latch PPU H/V counters (SLHV)
$80:81A6  4D 38 21     EOR $2138       ; OAMDATA read
$80:81A9  6D 37 21     ADC $2137
$80:81AC  B0 06        BCS $8081B4
$80:81AE  4D 3C 21     EOR $213C       ; OPHCT: Horizontal counter read
$80:81B1  69 01        ADC #$01
$80:81B3  EB           XBA             ; Exchange A bytes
$80:81B4  6D 3D 21     ADC $213D       ; OPVCT: Vertical counter read
$80:81B7  B0 06        BCS $8081BF
$80:81B9  6D 3B 21     ADC $213B       ; MPYH
$80:81BC  C2 30        REP #$30        ; 16-bit A, 16-bit X/Y

; Mix with programmer constants:
$80:81BE  49 AD DE     EOR #$DEAD      ; XOR with $DEAD
$80:81C1  49 C7 63     EOR #$63C7
$80:81C4  8D 33 01     STA $0133       ; Store PRNG Seed Word 0 ($7E0133)

$80:81C7  49 BE BA     EOR #$BABE      ; XOR with $BABE
$80:81CA  49 94 E2     EOR #$E294
$80:81CD  8D 35 01     STA $0135       ; Store PRNG Seed Word 1 ($7E0135)

$80:81D0  49 EF BE     EOR #$BEEF      ; XOR with $BEEF
$80:81D3  49 0D 5A     EOR #$5A0D
$80:81D6  8D 37 01     STA $0137       ; Store PRNG Seed Word 2 ($7E0137)

$80:81D9  49 CE FA     EOR #$FACE      ; XOR with $FACE
$80:81DC  49 BF 18     EOR #$18BF
$80:81DF  8D 39 01     STA $0139       ; Store PRNG Seed Word 3 ($7E0139)

$80:81E2  A9 FF FF     LDA #$FFFF
$80:81E5  8D 74 12     STA $1274       ; Invalidate music track ID
$80:81E8  68           PLA             ; Pull boot flag pushed at $80:8031 ($0000)
$80:81E9  D0 12        BNE $8081FD     ; If non-zero (warm reset), skip initial hardware setup

; Sub-system initialization calls:
$80:81EB  22 00 80 8C  JSL $8C8000     ; Audio driver initialization
$80:81EF  22 B6 B5 80  JSL $80B5B6     ; Graphics buffer / OAM table allocation
$80:81F3  22 1F 80 8C  JSL $8C801F     ; Sound effect dispatcher setup
$80:81F7  22 2B B7 80  JSL $80B72B     ; DMA channel queues clear
$80:81FB  80 26        BRA $808223
```

### Phase F: Interrupt Activation & Jump to Main Loop
```assembly
$80:8227  E2 20        SEP #$20        ; 8-bit A
$80:8229  A9 81        LDA #$81        ; Bit 7 = Enable NMI, Bit 0 = Enable Auto-Joypad
$80:822B  8D 00 42     STA $4200       ; NMITIMEN
$80:822E  8D 6B 0E     STA $0E6B       ; Shadow copy of $4200
$80:8231  C2 30        REP #$30        ; 16-bit A, 16-bit Index
$80:8233  CE 65 0E     DEC $0E65       ; Decrement engine pause counter
$80:8236  5C 66 8B 80  JML $808B66     ; Jump directly to Main Loop Entry!
```

---

## 3. Reconstructed C Decompilation

```c
#include <stdint.h>
#include <stdbool.h>

/* Memory-Mapped I/O and Core Shadows */
extern uint8_t  snes_inidisp;     /* $2100 */
extern uint8_t  snes_nmitimen;    /* $4200 */
extern uint8_t  snes_memsel;      /* $420D */
extern uint16_t g_ppu_shadow_0106;/* $7E:0106 (INIDISP shadow) */
extern uint16_t g_rng_seed[4];    /* $7E:0133, $0135, $0137, $0139 */
extern uint8_t  g_nmitimen_mirror;/* $7E:0E6B */
extern int16_t  g_engine_pause;   /* $7E:0E65 */

void dma_fill_fixed_byte(uint8_t dest_bus, uint16_t dest_addr, uint8_t bank, uint8_t fill_byte, uint32_t size);
void spc_audio_init(void);
void graphics_oam_alloc(void);
void sound_effects_init(void);
void dma_queue_init(void);
void main_loop_entry(void);

void reset_handler(void) {
    /* 1. Blank screen immediately */
    snes_inidisp = 0x8F;

    /* 2. Clear all PPU registers $2101..$2133 and CPU MMIO $4200..$420C */
    reset_snes_mmio_registers();

    /* 3. Enable FastROM 2.68 MHz memory bus access */
    snes_memsel = 0x01;

    /* 4. DMA zeroing of VRAM (64KB), WRAM Bank $7E (64KB), and WRAM Bank $7F (64KB) */
    dma_fill_vram(0x0000, 0x00, 0x10000);
    dma_fill_wram(0x7E0000, 0x00, 0x10000);
    dma_fill_wram(0x7F0000, 0x00, 0x10000);

    /* 5. Initialize PPU register shadows in WRAM */
    g_ppu_shadow_0106 = 0x008F; /* Display OFF */
    *(uint16_t *)0x7E0110 = 0x00FF;
    *(uint16_t *)0x7E0114 = 0x00FF;
    *(uint16_t *)0x7E0118 = 0x00FF;
    *(uint16_t *)0x7E011C = 0x00FF;
    *(uint16_t *)0x7E011E = 0x00FF;
    *(uint16_t *)0x7E0120 = 0x00FF;
    *(uint16_t *)0x7E11F4 = 0xFFFF;
    cgram_palette_shadow_init(); /* $80:857F */

    /* 6. Hardware latch PRNG seeding */
    uint16_t h_v_mix = read_ppu_raster_latches();
    g_rng_seed[0] = h_v_mix ^ 0xDEAD ^ 0x63C7;
    g_rng_seed[1] = g_rng_seed[0] ^ 0xBABE ^ 0xE294;
    g_rng_seed[2] = g_rng_seed[1] ^ 0xBEEF ^ 0x5A0D;
    g_rng_seed[3] = g_rng_seed[2] ^ 0xFACE ^ 0x18BF;

    *(uint16_t *)0x7E1274 = 0xFFFF; /* Invalidate music track ID */

    /* 7. Dispatch core audio and graphics systems */
    spc_audio_init();       /* $8C:8000 */
    graphics_oam_alloc();   /* $80:B5B6 */
    sound_effects_init();   /* $8C:801F */
    dma_queue_init();       /* $80:B72B */

    /* 8. Enable NMI + Auto-Joypad polling */
    snes_nmitimen = 0x81;
    g_nmitimen_mirror = 0x81;
    g_engine_pause--;

    /* 9. Jump to Main Loop */
    main_loop_entry(); /* JML $80:8B66 */
}
```

