#ifndef PPU_H
#define PPU_H

#include <stdint.h>

void ppu_set_display(uint8_t inidisp);
void ppu_copy_to_cgram(uint8_t cgram_addr, const void *src, uint16_t size);
void ppu_copy_to_vram(uint16_t vram_word_addr, const void *src, uint16_t size);

#endif /* PPU_H */

