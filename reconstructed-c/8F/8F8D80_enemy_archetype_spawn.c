#include <stddef.h>
#include <stdint.h>

typedef struct {
    uint16_t accumulator;
    uint16_t y;
    uint8_t data_bank;
} EnemySpawnRegisters;

extern uint16_t snes_read_direct_page_word(uint16_t offset);
extern void snes_write_direct_page_word(uint16_t offset, uint16_t value);
extern uint16_t snes_read_data_bank_word(uint8_t bank, uint16_t offset);
extern void snes_write_data_bank_word(uint8_t bank, uint16_t offset, uint16_t value);
extern uint16_t snes_read_long_word(uint8_t bank, uint16_t offset);
extern void snes_tsb_data_bank_word(uint8_t bank, uint16_t offset, uint16_t mask);
extern void apu_command_send_sync(uint16_t command, uint16_t y_value);
extern void entity_spawn_shared_tail_90be(void);

static const uint8_t zero_word_offsets[] = {
    0x00, 0x02, 0x0C, 0x0E, 0x10, 0x12, 0x1C, 0x1E,
    0x20, 0x22, 0x2C, 0x2E, 0x30, 0x32, 0x3C, 0x3E,
};

static const uint8_t minimum_bound_offsets[] = {
    0x04, 0x0A, 0x14, 0x1A, 0x24, 0x2A, 0x34, 0x3A,
};

static const uint8_t maximum_bound_offsets[] = {
    0x06, 0x08, 0x16, 0x18, 0x26, 0x28, 0x36, 0x38,
};

static void write_entity_words(
    uint8_t data_bank,
    uint16_t base,
    const uint8_t *offsets,
    size_t count,
    uint16_t value
) {
    for (size_t index = 0; index < count; index++) {
        snes_write_data_bank_word(
            data_bank,
            (uint16_t)(base + offsets[index]),
            value
        );
    }
}

static void enemy_spawn_archetype_unpack_and_bind_body(EnemySpawnRegisters *registers) {
    uint16_t packed_parameters = (uint16_t)((registers->accumulator >> 2) & 0x00FF);
    uint16_t additional_record_count = (uint16_t)(packed_parameters >> 6);
    uint16_t entity_key = snes_read_direct_page_word(0x4C);

    snes_write_direct_page_word(0x02, packed_parameters);
    snes_write_direct_page_word(0x42, additional_record_count);

    if (entity_key == snes_read_data_bank_word(registers->data_bank, 0x0F42)) {
        uint16_t counter_address = entity_key == 0x4E89 ? 0x0B11 : 0x0B13;
        snes_write_direct_page_word(0x0A, counter_address);

        uint16_t counter_pointer = snes_read_direct_page_word(0x0A);
        uint16_t counter = (uint16_t)(
            snes_read_data_bank_word(registers->data_bank, counter_pointer) + 1
        );
        snes_write_data_bank_word(registers->data_bank, counter_pointer, counter);

        if (counter >= 0x000E) {
            snes_write_data_bank_word(registers->data_bank, counter_pointer, 0);

            uint16_t saved_y = registers->y;
            uint8_t saved_data_bank = registers->data_bank;
            registers->data_bank = 0x8F;

            uint16_t first_argument = (uint16_t)(
                snes_read_long_word(0x7E, (uint16_t)(0x002E + entity_key)) >> 2
            );
            apu_command_send_sync(0x0030, first_argument);

            uint16_t second_argument = snes_read_long_word(0x8C, 0x8426);
            apu_command_send_sync(0x0004, second_argument);

            registers->data_bank = saved_data_bank;
            registers->y = saved_y;
        }
    }

    uint16_t descriptor_pointer = snes_read_data_bank_word(
        registers->data_bank,
        (uint16_t)(0x008E + registers->y)
    );
    snes_write_direct_page_word(
        0x2E,
        snes_read_data_bank_word(
            registers->data_bank,
            (uint16_t)(descriptor_pointer + 0x0006)
        )
    );

    uint16_t record = snes_read_data_bank_word(
        registers->data_bank,
        (uint16_t)(descriptor_pointer + 0x0004)
    );
    snes_write_direct_page_word(0x26, record);
    snes_write_direct_page_word(0x28, 0x007E);

    write_entity_words(
        registers->data_bank,
        record,
        zero_word_offsets,
        sizeof(zero_word_offsets),
        0x0000
    );
    write_entity_words(
        registers->data_bank,
        record,
        minimum_bound_offsets,
        sizeof(minimum_bound_offsets),
        0xFF00
    );
    write_entity_words(
        registers->data_bank,
        record,
        maximum_bound_offsets,
        sizeof(maximum_bound_offsets),
        0xFFFF
    );

    uint16_t remaining_records = snes_read_direct_page_word(0x42);
    while (remaining_records != 0) {
        remaining_records--;
        snes_write_direct_page_word(0x42, remaining_records);

        write_entity_words(
            registers->data_bank,
            record,
            (const uint8_t[]){0x02, 0x0C},
            2,
            0xFF00
        );
        write_entity_words(
            registers->data_bank,
            record,
            (const uint8_t[]){0x04, 0x06, 0x08, 0x0A},
            4,
            0x00FF
        );
        record = (uint16_t)(record + 0x0010);
    }

    uint16_t table_index = (uint16_t)(((snes_read_direct_page_word(0x02) >> 3) & 0x0007) * 2);
    uint16_t first_table_value = snes_read_long_word(
        0x8F,
        (uint16_t)(0x9104 + table_index)
    );
    uint16_t second_table_value = snes_read_long_word(
        0x8F,
        (uint16_t)(0x9124 + table_index)
    );
    uint16_t third_table_value = snes_read_long_word(
        0x8F,
        (uint16_t)(0x9134 + table_index)
    );

    snes_write_data_bank_word(registers->data_bank, (uint16_t)(record + 0x02), first_table_value);
    snes_write_data_bank_word(registers->data_bank, (uint16_t)(record + 0x0C), first_table_value);
    snes_write_data_bank_word(registers->data_bank, (uint16_t)(record + 0x04), second_table_value);
    snes_write_data_bank_word(registers->data_bank, (uint16_t)(record + 0x0A), second_table_value);
    snes_write_data_bank_word(registers->data_bank, (uint16_t)(record + 0x06), third_table_value);
    snes_write_data_bank_word(registers->data_bank, (uint16_t)(record + 0x08), third_table_value);

    registers->accumulator = third_table_value;
    registers->y = record;
    entity_spawn_shared_tail_90be();
}

void enemy_spawn_archetype_unpack_and_bind(EnemySpawnRegisters *registers) {
    snes_tsb_data_bank_word(registers->data_bank, 0x0310, registers->accumulator);
    enemy_spawn_archetype_unpack_and_bind_body(registers);
}