#include <stdint.h>

typedef struct {
    uint16_t accumulator;
    uint16_t index_x;
    uint16_t index_y;
    uint8_t data_bank;
    uint8_t wram[0x10000];
    void *context;
    uint8_t (*read_irq_status)(void *context);
    void (*dispatch_long)(void *context, uint32_t address);
} IrqCpuState;

enum {
    IO_TIMEUP = 0x4211,
    WRAM_IRQ_VECTOR = 0x012B
};

void irq_dispatch(IrqCpuState *cpu) {
    const uint16_t saved_accumulator = cpu->accumulator;
    const uint16_t saved_x = cpu->index_x;
    const uint16_t saved_y = cpu->index_y;
    const uint8_t saved_data_bank = cpu->data_bank;

    cpu->data_bank = 0x80;
    (void)cpu->read_irq_status(cpu->context);

    const uint32_t target =
        (uint32_t)cpu->wram[WRAM_IRQ_VECTOR] |
        ((uint32_t)cpu->wram[WRAM_IRQ_VECTOR + 1] << 8) |
        ((uint32_t)cpu->wram[WRAM_IRQ_VECTOR + 2] << 16);
    cpu->dispatch_long(cpu->context, target);

    cpu->index_y = saved_y;
    cpu->index_x = saved_x;
    cpu->accumulator = saved_accumulator;
    cpu->data_bank = saved_data_bank;
}