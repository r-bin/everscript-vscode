#include "snes_hw.h"

void snes_enable_fastrom(void) {
    /* FastROM (Mode 21 HiROM, 3.58 MHz activated via *MEMSEL = 1 at $420D) */
    REG_MEMSEL = 0x01;
}

void snes_clear_wram(void) {
    /* WRAM BSS is already initialized and cleared by Calypsi cstartup.
     * Clear a 512-byte engine scratchpad buffer in bank $7F. */
    volatile uint8_t *scratch = (volatile uint8_t *)0x7F0000;
    for (uint16_t i = 0; i < 512; i++) {
        scratch[i] = 0;
    }
}

void snes_init_hw(void) {
    /* Force blank during PPU init */
    REG_INIDISP = 0x80;

    REG_OBSEL   = 0x03;
    REG_BGMODE  = 0x01; /* Mode 1 */
    REG_MOSAIC  = 0x00;
    REG_BG1SC   = 0x00;
    REG_BG2SC   = 0x00;
    REG_BG3SC   = 0x08; /* BG3 tilemap at word $0800 */
    REG_BG4SC   = 0x00;
    REG_BG12NBA = 0x44; /* BG1/BG2 tiles at word $4000 */
    REG_BG34NBA = 0x02; /* BG3 tiles at word $2000 */
    REG_VMAIN   = 0x80; /* Increment after $2119 (+1 word) */

    REG_TM      = 0x05; /* Main screen: BG1 + BG3 */
    REG_TS      = 0x02; /* Sub screen: BG2 */
    REG_CGWSEL  = 0x02;
    REG_CGADSUB = 0x63;

    /* Enable V-Blank NMI interrupt */
    REG_NMITIMEN = 0x80;
}

