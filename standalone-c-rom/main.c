#include "snes_hw.h"
#include "nmi.h"
#include "intro_replay.h"

int main(void) {
    /* 1. Target FastROM: 3.58 MHz activated via *MEMSEL = 1 at $420D */
    snes_enable_fastrom();

    /* 2. Clear WRAM */
    snes_clear_wram();

    /* 3. Initialize SNES hardware (PPU registers, NMITIMEN enable) */
    snes_init_hw();

    /* 4. Set up the engine state machine */
    intro_replay_init();

    /* 5. Autonomous replay loop synchronized to native V-Blank NMI (60 Hz) */
    while (1) {
        wait_for_vblank();
        intro_replay_update();
    }

    return 0;
}

