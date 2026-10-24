#include "ppu.h"
#include "snes_hw.h"

void ppu_set_display(uint8_t inidisp) {
    REG_INIDISP = inidisp;
}

void ppu_copy_to_cgram(uint8_t cgram_addr, const void *src, uint16_t size) {
    uint32_t src_addr = (uint32_t)(uintptr_t)src;

    REG_CGADD = cgram_addr;

    /* DMA Channel 0: Mode 0 (1 byte to 1 register: $2122 CGDATA) */
    REG_DMAP0 = 0x00;
    REG_BBAD0 = 0x22;
    REG_A1T0  = (uint16_t)(src_addr & 0xFFFF);
    REG_A1B0  = (uint8_t)((src_addr >> 16) & 0xFF);
    REG_DAS0  = size;

    REG_MDMAEN = 0x01; /* Trigger DMA Ch 0 */
}

void ppu_copy_to_vram(uint16_t vram_word_addr, const void *src, uint16_t size) {
    uint32_t src_addr = (uint32_t)(uintptr_t)src;

    REG_VMAIN = 0x80; /* Increment after $2119 write (+1 word) */
    REG_VMADD = vram_word_addr;

    /* DMA Channel 0: Mode 1 (2 bytes to 2 registers: $2118, $2119 VMDATA) */
    REG_DMAP0 = 0x01;
    REG_BBAD0 = 0x18;
    REG_A1T0  = (uint16_t)(src_addr & 0xFFFF);
    REG_A1B0  = (uint8_t)((src_addr >> 16) & 0xFF);
    REG_DAS0  = size;

    REG_MDMAEN = 0x01; /* Trigger DMA Ch 0 */
}

