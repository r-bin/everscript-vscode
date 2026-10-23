/*
 * Routine: $90A5BA (minimap_blip_sync)
 * Bank: $90 (ROM Offset: $10A5BA)
 * Source: docs/disassembly/ui/minimap-blip-sync.md
 */

#include <stdint.h>
#include <stdbool.h>

/**
 * WRAM layout relevant to the minimap radar subsystem.
 */
typedef struct {
    uint16_t vram_transfer_lock;    /* $7E:0F3A */
    uint16_t dma_commit_trigger;    /* $7E:0FC2 */
    uint16_t minimap_chunk_budget;  /* $7E:116E */
    uint16_t staging_buffer_cursor; /* $7E:1170 */
} MinimapState;

extern MinimapState g_minimap_state;

/**
 * Advances minimap radar tile blitting into staging buffers.
 *
 * @return true if additional chunks remain pending (Carry Set),
 *         false if the transfer queue is completely flushed (Carry Clear).
 */
extern bool hud_minimap_vram_blit(void);

/**
 * Halts CPU execution until the NMI interrupt increments the frame counter.
 * Synchronizes with vertical blanking DMA transfers.
 */
extern void wait_for_frame(void);

/**
 * Synchronously flushes all pending minimap radar VRAM tile blits.
 *
 * Ensures that tile staging and DMA transfers complete across vertical
 * blanking intervals before the caller proceeds with terrain mutations.
 */
void hud_minimap_vram_blit_flush_loop(void) {
    /* Step 1: Initial check - if queue is empty, exit immediately */
    while (hud_minimap_vram_blit()) {
        /* Step 2: Set burst chunk budget to 30 entries */
        g_minimap_state.minimap_chunk_budget = 0x001E;

        /* Step 3: Stage up to 30 chunks into VRAM upload buffers */
        hud_minimap_vram_blit();

        /* Step 4: Synchronize with next VBLANK to let DMA commit tiles */
        wait_for_frame();

        /* Step 5: Loop back until Carry is clear */
    }
}
