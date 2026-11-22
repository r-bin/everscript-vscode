/*
 * Routine: $8C:AB10 (window_system_reset_and_buffers_clear)
 * Bank: $8C (ROM Offset: $0CAB10)
 * Source: docs/disassembly/ui/dialogue-window.md, src/games/evermore/localizations/knowledge/routines/window_system_reset_and_buffers_clear.md
 *
 * Master reset routine for the game window and dialogue system:
 * - Clears active window flags $0B2F, $0B31, $0B2B.
 * - Initializes window descriptors at $0365..$04B1 and VRAM bases at $0367..$04B3.
 * - Clears window status words at $0377..$04C3.
 * - Performs DMA transfers to VRAM $1FF8 and $1FF0.
 * - Commits base palette from $C4:1EA4 to CGRAM 0 via $80:85FA.
 * - Calls $8C:AC16 and $8C:AFEB.
 * - Queues shadow tilemap DMA via $8C:AFD0 -> $80:8650.
 */

#include <stdint.h>
#include <stdbool.h>

extern uint16_t read_wram_word(uint32_t address);
extern void write_wram_word(uint32_t address, uint16_t value);
extern void cgram_palette_dma_enqueue(uint32_t src, uint16_t cgram_dest, uint16_t count);
extern void vram_dma_enqueue(uint32_t src, uint16_t vram_dest, uint16_t count);
extern void dialogue_window_arrow_cursor_draw(void);
extern void window_manager_init_state(void);

void window_system_reset_and_buffers_clear(void) {
    write_wram_word(0x0B2F, 0);
    write_wram_word(0x0B31, 0);
    write_wram_word(0x0B2B, 0);

    // Initialize 8 window descriptor memory offsets
    write_wram_word(0x0365, 0xA000u);
    write_wram_word(0x0391, 0xA500u);
    write_wram_word(0x03BD, 0xAA00u);
    write_wram_word(0x03F5, 0xAF00u);
    write_wram_word(0x0421, 0xB400u);
    write_wram_word(0x044D, 0xB900u);
    write_wram_word(0x0485, 0xBE00u);
    write_wram_word(0x04B1, 0xC300u);

    // Initialize 8 window descriptor VRAM bases
    write_wram_word(0x0367, 0x0C00u);
    write_wram_word(0x0393, 0x0E80u);
    write_wram_word(0x03BF, 0x1100u);
    write_wram_word(0x03F7, 0x1380u);
    write_wram_word(0x0423, 0x1600u);
    write_wram_word(0x044F, 0x1880u);
    write_wram_word(0x0487, 0x1B00u);
    write_wram_word(0x04B3, 0x1D80u);

    // Clear window status flags
    write_wram_word(0x0377, 0);
    write_wram_word(0x03A3, 0);
    write_wram_word(0x03CF, 0);
    write_wram_word(0x0407, 0);
    write_wram_word(0x0433, 0);
    write_wram_word(0x045F, 0);
    write_wram_word(0x0497, 0);
    write_wram_word(0x04C3, 0);

    // Commit base UI palette from Bank $C4:1EA4 to CGRAM 0
    cgram_palette_dma_enqueue(0xC41EA4u, 0x0000u, 8u);

    // Call secondary initialization handlers
    window_manager_init_state();          /* $8C:AC16 */
    dialogue_window_arrow_cursor_draw();  /* $8C:AFEB */

    // Queue shadow tilemap DMA from $7F:C800 (length $0700) to VRAM $0800
    vram_dma_enqueue(0x7FC800u, 0x0800u, 0x0700u); /* $8C:AFD0 -> $80:8650 */
}
