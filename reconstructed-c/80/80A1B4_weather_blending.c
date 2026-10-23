/*
 * Routine: $80A1B4 (weather_blending)
 * Bank: $80 (ROM Offset: $00A1B4)
 * Source: docs/disassembly/engine-core/weather-blending.md
 */

#include <stdint.h>
#include <stdbool.h>

extern HDMASkyGradient g_hdma_sky_gradient; // $7E:7341
extern uint16_t g_weather_buffer_cursor;    // DP $D1
extern uint16_t g_active_weather_block[64]; // $7E:72D1

/**
 * $80:A1B4 - hdma_sky_gradient_sparse_unpack
 * Decompresses 4 HDMA color bands from sparse bitmask stream into $7E:7341..$7E:734F.
 */
void hdma_sky_gradient_sparse_unpack(uint16_t bitmask, const uint16_t* stream_data) {
    uint16_t* dest_bands = (uint16_t*)&g_hdma_sky_gradient;
    uint16_t stream_idx = 4; // Data offset starts after header (at +$08)

    for (int band = 0; band < 4; band++) {
        uint8_t code = bitmask & 0x03;
        bitmask >>= 2;

        if (code == 0) {
            // Both words present in stream
            dest_bands[band * 2 + 0] = stream_data[stream_idx++];
            dest_bands[band * 2 + 1] = stream_data[stream_idx++];
        } else if (code == 1) {
            // Word 1 present, word 2 zeroed
            dest_bands[band * 2 + 0] = stream_data[stream_idx++];
            dest_bands[band * 2 + 1] = 0;
        } else if (code == 2) {
            // Word 1 zeroed, word 2 present
            dest_bands[band * 2 + 0] = 0;
            dest_bands[band * 2 + 1] = stream_data[stream_idx++];
        } else {
            // Both words zeroed
            dest_bands[band * 2 + 0] = 0;
            dest_bands[band * 2 + 1] = 0;
        }
    }
}

/**
 * $80:A2E0 - weather_preset_load_from_rom_database
 * Copies a 128-byte weather preset from Bank $EC into active WRAM staging block.
 */
void weather_preset_load_from_rom_database(uint16_t preset_id) {
    const uint16_t* preset_src = (const uint16_t*)(0xEC0000 + (preset_id * 128));

    // Advance 128-byte circular cursor in WRAM
    g_weather_buffer_cursor += 128;

    // Copy 64 words (128 bytes) into active weather preset config block
    for (int i = 0; i < 64; i++) {
        g_active_weather_block[i] = preset_src[i];
    }
}
