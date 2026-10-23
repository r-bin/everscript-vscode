/*
 * Routine: $808597 (hardware_dma_and_prng)
 * Bank: $80 (ROM Offset: $008597)
 * Source: docs/disassembly/engine-core/hardware-dma-and-prng.md
 */

#include <stdint.h>
#include <stdbool.h>

#define CGRAM_QUEUE_CAPACITY 32
#define CGRAM_ENTRY_STRIDE   7
#define CGRAM_QUEUE_BYTES    (CGRAM_QUEUE_CAPACITY * CGRAM_ENTRY_STRIDE)

/**
 * Packed 7-byte deferred CGRAM transfer descriptor.
 */
typedef struct __attribute__((packed)) {
    uint16_t src_addr;    /* +$00: 16-bit source address in bank */
    uint8_t  src_bank;    /* +$02: 8-bit source bank */
    uint16_t cgram_dest;  /* +$03: Target CGRAM color index (CGADD) */
    uint16_t byte_count;  /* +$05: Number of bytes to transfer */
} CgramQueueEntry;

typedef struct {
    uint16_t joypad_edge_buttons;  /* $7E:0104 */
    uint16_t joypad_filter_flags;  /* $7E:0106 */
    uint16_t prng_seeds[4];        /* $7E:0133, $7E:0135, $7E:0137, $7E:0139 */
    uint16_t cgram_lock;           /* $7E:0F3C */
    uint16_t cgram_queue_cursor;   /* $7E:128E */
    uint8_t  cgram_queue[CGRAM_QUEUE_BYTES]; /* $7E:1292..$7E:1371 */
} HardwareState;

extern HardwareState g_hw;

/**
 * PPU / DMA mock hardware registers.
 */
extern void snes_write_cgadd(uint8_t color_index);
extern void snes_dma_channel1_cgram(uint32_t src_addr24, uint16_t count);
extern void wait_for_frame(void);
extern void setup_nmi_vector(void);

/**
 * Atomically tests and acknowledges newly pressed joypad buttons.
 */
uint16_t joypad_acknowledge_or_clear_buttons(uint16_t mask) {
    uint16_t previous = g_hw.joypad_edge_buttons;
    g_hw.joypad_edge_buttons &= ~mask;
    return (previous & mask);
}

/**
 * Master Secret of Evermore 64-bit Pseudo-Random Number Generator.
 *
 * Employs a 4-word cross-coupled Fibonacci / Galois additive feedback shift
 * register. Returns the updated Seed 0 word in the Accumulator.
 */
uint16_t random_number_generator(void) {
    uint32_t acc;
    uint8_t carry = 0;

    /* Step 1: Rotate Seed 3 and add Seed 1 */
    carry = (g_hw.prng_seeds[3] & 0x8000) != 0;
    acc = ((uint32_t)g_hw.prng_seeds[3] << 1) & 0xFFFF;
    if (carry) {
        g_hw.prng_seeds[2]++;
    }
    acc += g_hw.prng_seeds[1] + carry;
    carry = (acc > 0xFFFF);
    g_hw.prng_seeds[3] = (uint16_t)acc;

    /* Step 2: Rotate Seed 2 and add Seed 0 */
    carry = (g_hw.prng_seeds[2] & 0x8000) != 0;
    acc = ((uint32_t)g_hw.prng_seeds[2] << 1) & 0xFFFF;
    if (carry) {
        g_hw.prng_seeds[1]++;
    }
    acc += g_hw.prng_seeds[0] + carry;
    carry = (acc > 0xFFFF);
    g_hw.prng_seeds[2] = (uint16_t)acc;

    /* Step 3: Rotate Seed 1 and add Seed 2 */
    carry = (g_hw.prng_seeds[1] & 0x8000) != 0;
    acc = ((uint32_t)g_hw.prng_seeds[1] << 1) & 0xFFFF;
    if (carry) {
        g_hw.prng_seeds[0]++;
    }
    acc += g_hw.prng_seeds[2] + carry;
    carry = (acc > 0xFFFF);
    g_hw.prng_seeds[1] = (uint16_t)acc;

    /* Step 4: Rotate Seed 0 and add Seed 3 */
    carry = (g_hw.prng_seeds[0] & 0x8000) != 0;
    acc = ((uint32_t)g_hw.prng_seeds[0] << 1) & 0xFFFF;
    if (carry) {
        g_hw.prng_seeds[3]++;
    }
    acc += g_hw.prng_seeds[3] + carry;
    carry = (acc > 0xFFFF);
    g_hw.prng_seeds[0] = (uint16_t)acc;

    return g_hw.prng_seeds[0];
}

/**
 * Suspends thread across two vertical blanking intervals to cleanly apply
 * joypad input filter configuration.
 */
void wait_for_frame_and_prep_input_filter(void) {
    wait_for_frame();
    setup_nmi_vector();
    g_hw.joypad_filter_flags = 0x008F;
    wait_for_frame();
}

/**
 * Uploads a palette block to CGRAM via direct DMA Channel 1, or queues it
 * into the 32-slot deferred ring buffer for execution during VBLANK.
 */
void cgram_palette_dma_enqueue_or_immediate(uint16_t src_addr, uint8_t src_bank,
                                            uint16_t cgram_dest, uint16_t byte_count) {
    if (g_hw.joypad_filter_flags & 0x0080) {
        /* Direct PPU DMA Channel 1 Transfer */
        g_hw.cgram_lock++;
        snes_write_cgadd((uint8_t)cgram_dest);
        snes_dma_channel1_cgram(((uint32_t)src_bank << 16) | src_addr, byte_count);
        g_hw.cgram_lock--;
    } else {
        /* Deferred Queue Mode */
        uint16_t cursor = g_hw.cgram_queue_cursor;
        CgramQueueEntry *entry = (CgramQueueEntry *)&g_hw.cgram_queue[cursor];

        entry->src_addr = src_addr;
        entry->src_bank = src_bank;
        entry->cgram_dest = cgram_dest;
        entry->byte_count = byte_count;

        cursor += CGRAM_ENTRY_STRIDE;
        if (cursor >= CGRAM_QUEUE_BYTES) {
            cursor = 0;
        }
        g_hw.cgram_queue_cursor = cursor;
    }
}
