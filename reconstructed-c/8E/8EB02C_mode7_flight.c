/*
 * Routine: $8EB02C (mode7_flight)
 * Bank: $8E (ROM Offset: $0EB02C)
 * Source: docs/disassembly/engine-core/mode7-flight.md
 */

#include <stdint.h>
#include <stdbool.h>

#define ANGLE_STEPS         512
#define ANGLE_MASK          (ANGLE_STEPS - 1)
#define COSINE_OFFSET       128 // 90 degrees in 512-step circle

typedef struct {
    int16_t  world_x;        // $7E:0615
    int16_t  world_y;        // $7E:0617
    uint16_t elevation;      // $7E:0619 (speed & altitude factor)
    uint16_t table_index_word;  // $7E:061B
    uint16_t quotient;       // $7E:061D
    uint16_t flags;          // $7E:05AB
} Mode7FlightState;

extern Mode7FlightState g_flight_state;
extern int16_t g_camera_shadow_x;  // DP $59
extern int16_t g_camera_shadow_y;  // DP $5B

// 512-entry signed 16-bit sine lookup table ($80:88A3)
extern const int16_t g_sine_table[ANGLE_STEPS];

extern uint16_t g_dp_02;  // $7E:0002
extern uint16_t g_dp_04;  // $7E:0004
extern uint16_t g_dp_06;  // $7E:0006
extern uint16_t g_dp_12;  // $7E:0012
extern uint16_t g_dp_26;  // $7E:0026
extern uint16_t g_dp_27;  // $7E:0027
extern uint16_t g_dp_28;  // $7E:0028
extern uint16_t g_dp_0a;  // $7E:000A
extern uint16_t g_dp_0e;  // $7E:000E
extern uint16_t g_dp_32;  // $7E:0032

typedef struct {
    uint16_t a;
    uint16_t x;
    uint16_t y;
} Mode7CallRegisters;

extern uint16_t host_read_dp_word(uint8_t address);
extern uint16_t host_read_dp_indirect_y_word(uint8_t address, uint16_t index);
extern uint16_t host_read_data_bank_word(uint16_t address);
extern uint16_t host_read_data_bank_word_y(uint16_t address, uint16_t index);
extern uint16_t host_read_long_word_indexed(uint8_t bank, uint16_t address, uint16_t index);
extern uint16_t snes_multiply_8x8(uint8_t multiplier, uint8_t multiplicand);
extern uint16_t snes_divide_16_by_8(uint16_t dividend, uint8_t divisor);
extern void host_call_9080d2(Mode7CallRegisters *registers);
extern void host_call_809033(Mode7CallRegisters *registers);
extern void host_call_9081bd(Mode7CallRegisters *registers);

extern void direct_sprite_draw_oam(void);
extern void update_entity_physics(void);
extern void setup_mode7_hdma(void);

static uint16_t mode7_exchange_bytes(uint16_t value) {
    return (uint16_t)((value << 8) | (value >> 8));
}

/** Reconstructs the sample and entity dispatch loop at $8E:B33D-$8E:B505. */
void mode7_flight_sample_and_sprite_dispatch(void) {
    uint16_t y = host_read_dp_word(0x95u);
    g_dp_0a = host_read_data_bank_word_y(0x0000u, y);
    g_dp_32 = 0;
    g_dp_0e = 0x06A3u;

    Mode7CallRegisters registers = {0};
    uint16_t sample_index;
    uint16_t sample;
    uint16_t product;
    uint16_t multiplier_word;
    uint16_t lookup_index;
    uint16_t saved_dp_02;
    uint16_t saved_dp_04;
    uint16_t next_count;
    uint16_t flags;
    uint16_t table_value;
    uint16_t table_index;
    bool use_sprite_table;

sample_loop:
    multiplier_word = (uint16_t)(mode7_exchange_bytes(g_dp_32) | 0x0080u);
    product = snes_multiply_8x8((uint8_t)multiplier_word,
                                (uint8_t)(multiplier_word >> 8));
    product = (uint16_t)(product << 1);
    lookup_index = snes_divide_16_by_8(product, (uint8_t)g_dp_0a);
    sample_index = (uint16_t)((g_flight_state.table_index_word - lookup_index) & 0x01FFu);
    sample = host_read_long_word_indexed(0x80u, 0x88A3u, sample_index);

    if ((sample & 0x8000u) != 0) {
        multiplier_word = (uint16_t)(mode7_exchange_bytes(sample >> 1) |
                                     g_flight_state.elevation);
        product = snes_multiply_8x8((uint8_t)multiplier_word,
                                    (uint8_t)(multiplier_word >> 8));
        sample_index = (uint16_t)((sample_index + 0x0080u) & 0x01FFu);
        product = mode7_exchange_bytes((uint16_t)(product << 1));
        g_dp_02 = (uint16_t)(g_flight_state.world_x - (product & 0x01FFu));
    } else {
        multiplier_word = (uint16_t)(mode7_exchange_bytes(
                                        (uint16_t)((uint16_t)(0u - sample) >> 1) & 0x00FFu) |
                                     g_flight_state.elevation);
        product = snes_multiply_8x8((uint8_t)multiplier_word,
                                    (uint8_t)(multiplier_word >> 8));
        sample_index = (uint16_t)((sample_index + 0x0080u) & 0x01FFu);
        product = mode7_exchange_bytes((uint16_t)(product << 1));
        g_dp_02 = (uint16_t)(g_flight_state.world_x + (product & 0x01FFu));
    }

    sample = host_read_long_word_indexed(0x80u, 0x88A3u, sample_index);
    if ((sample & 0x8000u) != 0) {
        multiplier_word = (uint16_t)(mode7_exchange_bytes(sample >> 1) |
                                     g_flight_state.elevation);
        product = snes_multiply_8x8((uint8_t)multiplier_word,
                                    (uint8_t)(multiplier_word >> 8));
        multiplier_word = (uint16_t)((product & 0xFF00u) | 0x0003u);
        product = snes_multiply_8x8((uint8_t)multiplier_word,
                                    (uint8_t)(multiplier_word >> 8));
        g_dp_04 = (uint16_t)(g_flight_state.world_y - ((product >> 1) & 0x01FFu));
    } else {
        multiplier_word = (uint16_t)(mode7_exchange_bytes(
                                        (uint16_t)((uint16_t)(0u - sample) >> 1)) |
                                     g_flight_state.elevation);
        product = snes_multiply_8x8((uint8_t)multiplier_word,
                                    (uint8_t)(multiplier_word >> 8));
        multiplier_word = (uint16_t)((product & 0xFF00u) | 0x0003u);
        product = snes_multiply_8x8((uint8_t)multiplier_word,
                                    (uint8_t)(multiplier_word >> 8));
        g_dp_04 = (uint16_t)(g_flight_state.world_y + ((product >> 1) & 0x01FFu));
    }

    registers.a = g_dp_04;
    registers.x = sample_index;
    registers.y = g_dp_0e;
    host_call_9080d2(&registers);

    saved_dp_02 = g_dp_02;
    saved_dp_04 = g_dp_04;
    g_dp_02 = (uint16_t)(g_dp_02 - (uint16_t)g_camera_shadow_x +
                         host_read_data_bank_word(0x0BFBu));
    g_dp_04 = (uint16_t)(g_dp_04 - (uint16_t)g_camera_shadow_y +
                         host_read_data_bank_word(0x0BFDu));

    flags = host_read_data_bank_word(0x05ABu);
    if ((flags & 0x007Cu) != 0) {
        registers.a = g_dp_32;
        registers.a = (uint16_t)((registers.a << 1) + 0x0004u);
        registers.y = registers.a;
        table_index = host_read_dp_indirect_y_word(0x95u, registers.y);
        registers.x = table_index;
        registers.a = host_read_long_word_indexed(0x8Eu, 0x8000u, registers.x);
        registers.x = registers.a;
        registers.a = host_read_long_word_indexed(0x8Eu, 0x0006u, registers.x);
        g_dp_12 = registers.a;

        flags = host_read_data_bank_word(0x05ABu);
        use_sprite_table = false;
        if ((flags & 0x0040u) != 0) {
            if (host_read_data_bank_word(0x0ABAu) != g_dp_12) {
                goto after_sprite_draw;
            }
            table_index = 0;
            use_sprite_table = true;
            registers.x = 0;
        }

        flags = host_read_data_bank_word(0x05ABu);
        if (!use_sprite_table && (flags & 0x0008u) != 0) {
            registers.x = g_dp_12;
            table_value = host_read_long_word_indexed(0xC4u, 0x3894u, registers.x);
            if (table_value == host_read_data_bank_word(0x0AC0u) ||
                table_value == host_read_data_bank_word(0x0AC4u) ||
                table_value == host_read_data_bank_word(0x0AC2u)) {
                table_index = 0;
                use_sprite_table = true;
            } else if (table_value == host_read_data_bank_word(0x0ABEu)) {
                table_index = host_read_long_word_indexed(
                    0x8Eu, 0xB512u,
                    host_read_long_word_indexed(0x7Eu, 0x2363u, 0));
                use_sprite_table = true;
            } else {
                registers.a = (uint16_t)(table_value | 0x0030u);
                g_dp_06 = registers.a;
                host_call_809033(&registers);
                goto after_sprite_draw;
            }
        }

        if (use_sprite_table) {
            registers.x = table_index;
            g_dp_26 = host_read_long_word_indexed(0xC4u, 0x5A75u, registers.x);
            g_dp_27 = host_read_long_word_indexed(0xC4u, 0x5A76u, registers.x);
            registers.a = host_read_long_word_indexed(0x8Eu, 0xB506u, registers.x);
        } else {
            registers.a = flags;
        }

        registers.a = (uint16_t)(registers.a | 0x0030u);
        g_dp_06 = registers.a;
        host_call_809033(&registers);
    }

after_sprite_draw:
    registers.a = g_dp_32;
    if (registers.a == host_read_data_bank_word(0x0BF9u)) {
        registers.a = host_read_data_bank_word(0x0100u);
        if ((registers.a & 0x0008u) == 0) {
            goto finish_iteration;
        }
        registers.a = 0x0030u;
        g_dp_06 = registers.a;
    }

    registers.x = g_dp_0e;
    host_call_9081bd(&registers);

finish_iteration:
    registers.a = host_read_data_bank_word(0x05ABu);
    g_dp_04 = saved_dp_04;
    g_dp_02 = saved_dp_02;
    g_dp_0e = (uint16_t)(g_dp_0e + 0x0010u);
    next_count = (uint16_t)(g_dp_32 + 1u);
    if (next_count == g_dp_0a) {
        return;
    }
    g_dp_32 = next_count;
    goto sample_loop;
}

/**
 * Projects the vehicle sprite onto the Mode 7 perspective viewport.
 * Corresponds to $8E:B520.
 */
void mode7_flight_sprite_render(void) {
    g_dp_02 = (uint16_t)(g_flight_state.world_x - g_camera_shadow_x);

    uint8_t multiplier = (uint8_t)((g_flight_state.elevation >> 8) | 0x03u);
    uint8_t multiplicand = (uint8_t)g_flight_state.elevation;
    uint16_t product = (uint16_t)multiplier * multiplicand;
    g_dp_12 = (uint16_t)(product >> 2);

    g_dp_04 = (uint16_t)(g_flight_state.world_y - g_dp_12 - g_camera_shadow_y);
    g_dp_06 = 0x003C;
    g_dp_26 = 0x32C9;
    g_dp_28 = 0x00CC;
    direct_sprite_draw_oam();
}

/**
 * Executes one frame of overworld Mode 7 flight simulation.
 * Corresponds to $8E:B02C.
 */
void mode7_flight_frame_engine(int16_t turn_delta, uint16_t vehicle_attr) {
    // 1. Project Windwalker sprite
    (void)vehicle_attr;
    (void)turn_delta;
    mode7_flight_sprite_render();

    // 2. Flight sample and entity dispatch
    mode7_flight_sample_and_sprite_dispatch();

    // 3. Subsystem physics and HDMA gradient refresh
    update_entity_physics();
    setup_mode7_hdma();
}
