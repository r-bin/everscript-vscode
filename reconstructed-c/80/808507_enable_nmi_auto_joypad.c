#include <stdint.h>

typedef struct {
    uint16_t accumulator;
    uint16_t index_x;
    uint8_t processor_status;
    uint8_t wram[0x10000];
    void (*write_io8)(uint16_t address, uint8_t value);
} Cpu65816;

enum {
    PROCESSOR_INTERRUPT_DISABLE = 0x04,
    IO_NMITIMEN = 0x4200,
    WRAM_NMITIMEN_MIRROR = 0x0E6B,
    WRAM_UNKNOWN_012B = 0x012B,
    WRAM_UNKNOWN_012D = 0x012D
};

static void write_wram16(Cpu65816 *cpu, uint16_t address, uint16_t value) {
    cpu->wram[address] = (uint8_t)value;
    cpu->wram[(uint16_t)(address + 1)] = (uint8_t)(value >> 8);
}

void enable_nmi_and_auto_joypad(Cpu65816 *cpu) {
    const uint8_t saved_status = cpu->processor_status;

    cpu->processor_status |= PROCESSOR_INTERRUPT_DISABLE;
    cpu->write_io8(IO_NMITIMEN, 0x81);
    cpu->wram[WRAM_NMITIMEN_MIRROR] = 0x81;

    cpu->index_x = 0x858B;
    cpu->accumulator = 0x0080;
    write_wram16(cpu, WRAM_UNKNOWN_012D, cpu->accumulator);
    write_wram16(cpu, WRAM_UNKNOWN_012B, cpu->index_x);

    cpu->processor_status = saved_status;
}