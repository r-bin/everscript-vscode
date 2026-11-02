/*
 * Routine: $808020 (boot_reset)
 * Bank: $80 (ROM Offset: $008020)
 * Source: docs/disassembly/engine-core/boot-reset.md
 */

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

uint8_t ppu_read_reg(uint16_t reg);   /* a PPU/WRAM port read: $2137..$213D, $2180 */
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

    /* 6. PRNG seed from PPU reads ($80:819A..$80:81E5). A = $F00D, then the low
     * byte (8-bit A) mixes port reads; two BCS skip parts on the carry. With the
     * display on, $2138 and $213B return what the PPU itself fetches at that dot,
     * so the seed depends on the beam and the sprites (recomp: snesrecomp's
     * ppu_renderOamAddress / ppu_renderCgramAddress). */
    uint8_t a = 0x0D, b = 0xF0;              /* lda #$F00D; sep #$20; adc #$01: carry clear */
    unsigned sum;
    a = ppu_read_reg(0x2137);                /* latches H/V; reads open bus ($21 on MesenCE) */
    a ^= ppu_read_reg(0x2138);               /* OAM data */
    sum = a + ppu_read_reg(0x2137);          /* latches again */
    a = (uint8_t)sum;
    if (sum < 0x100) {
        a ^= ppu_read_reg(0x213C);           /* H counter, first read */
        sum = a + 1u;
        a = (uint8_t)sum;
        uint8_t t = a; a = b; b = t;         /* xba */
    }
    sum = a + ppu_read_reg(0x213D) + (sum >> 8);   /* V counter, first read */
    a = (uint8_t)sum;
    if (sum < 0x100) {
        a ^= ppu_read_reg(0x2180);           /* WRAM data port */
        sum = a + ppu_read_reg(0x2139);      /* VRAM data, low */
        a = (uint8_t)sum;
    }
    sum = a + ppu_read_reg(0x213B) + (sum >> 8);   /* CGRAM data */
    a = (uint8_t)sum;
    uint16_t h_v_mix = (uint16_t)(b << 8 | a);    /* rep #$30 */
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
