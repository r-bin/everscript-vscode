#include <stdint.h>

#define PALETTE_GROUP_1_DESTINATION 0x7E7321u
#define PALETTE_GROUP_2_DESTINATION 0x7E7331u
#define PALETTE_GROUP_1_CONTINUATION 0x809FFEu
#define PALETTE_GROUP_2_CONTINUATION 0x80A16Eu
#define PALETTE_COPY_WORD_COUNT 8u

typedef uint16_t (*ReadDataBankWord)(void *context, uint16_t offset);
typedef void (*WriteWramWord)(void *context, uint32_t address, uint16_t value);
typedef void (*ContinuePaletteRoutine)(void *context, uint32_t address,
                                       uint16_t y, uint16_t x);

typedef struct {
    void *context;
    ReadDataBankWord read_data_bank_word;
    WriteWramWord write_wram_word;
    ContinuePaletteRoutine continue_routine;
} PaletteCopyCallbacks;

static uint16_t add_16(uint16_t value, uint16_t increment)
{
    return (uint16_t)(value + increment);
}

static void copy_palette_words(const PaletteCopyCallbacks *callbacks,
                               uint16_t y, uint16_t x,
                               uint16_t source_offset,
                               uint32_t destination_base,
                               uint32_t continuation)
{
    for (uint16_t index = 0; index < PALETTE_COPY_WORD_COUNT; ++index) {
        uint16_t word_offset = (uint16_t)(source_offset + (index * 2u));
        uint16_t value = callbacks->read_data_bank_word(
            callbacks->context, add_16(y, word_offset));
        uint32_t destination = destination_base + x + (index * 2u);
        callbacks->write_wram_word(callbacks->context, destination, value);
    }

    callbacks->continue_routine(callbacks->context, continuation,
                               add_16(y, 0x0010u), x);
}

/** Models the eight loads/stores at $80:9E93-$80:9EC7 and their tail jump. */
void copy_palette_group_1_prefix(const PaletteCopyCallbacks *callbacks,
                                 uint16_t y, uint16_t x)
{
    copy_palette_words(callbacks, y, x, 0x0006u,
                       PALETTE_GROUP_1_DESTINATION,
                       PALETTE_GROUP_1_CONTINUATION);
}

/** Models the eight loads/stores at $80:A003-$80:A037 and their tail jump. */
void copy_palette_group_2_prefix(const PaletteCopyCallbacks *callbacks,
                                 uint16_t y, uint16_t x)
{
    copy_palette_words(callbacks, y, x, 0x0007u,
                       PALETTE_GROUP_2_DESTINATION,
                       PALETTE_GROUP_2_CONTINUATION);
}
