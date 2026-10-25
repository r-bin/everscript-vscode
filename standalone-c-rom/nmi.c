#include "nmi.h"
#include "snes_hw.h"

volatile uint16_t g_nmi_frame_counter = 0;
volatile uint8_t  g_nmi_vblank_flag = 0;

#define REG_VANILLA_NMI_FRAME_COUNTER (*(volatile uint16_t *)0x7E0100)

/* Native 65816 V-Blank (NMI) interrupt handler vector at $FFEA */
__attribute__((interrupt(0xffea))) void nmi_handler(void) {
    /* Read RDNMI ($4210) to acknowledge and clear the NMI flag */
    volatile uint8_t rdnmi = REG_RDNMI;
    (void)rdnmi;

    REG_VANILLA_NMI_FRAME_COUNTER++;
    g_nmi_frame_counter++;
    g_nmi_vblank_flag = 1;
}

void wait_for_vblank(void) {
    uint16_t start = g_nmi_frame_counter;
    while (start == g_nmi_frame_counter) {
        /* Spin until NMI advances the frame counter */
    }
}

