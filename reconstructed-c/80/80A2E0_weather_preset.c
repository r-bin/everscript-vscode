/*
 * Routine: $80A2E0 (weather_preset)
 * Bank: $80 (ROM Offset: $00A2E0)
 * Source: docs/disassembly/engine-core/weather-preset.md
 */

#include <stdint.h>
#include <string.h>

#define WEATHER_CONFIG_WORDS 64
#define WEATHER_CONFIG_BYTES 128

typedef struct {
    int16_t  velocity_x;            // +0x00: $7E:72D1
    int16_t  velocity_y;            // +0x02: $7E:72D3 (fall speed)
    int16_t  wind_sway_amplitude;   // +0x04: $7E:72D5
    int16_t  sway_frequency;        // +0x06: $7E:72D7
    int16_t  spawn_bound_left;      // +0x08: $7E:72D9
    int16_t  spawn_bound_right;     // +0x0A: $7E:72DB
    int16_t  spawn_bound_top;       // +0x0C: $7E:72DD
    int16_t  wrap_bound_bottom;     // +0x0E: $7E:72DF (224 scanlines)
    uint16_t sprite_attributes[24]; // +0x10..+0x3F: OAM sizes, palettes, tiles
    uint16_t animation_phases[32];  // +0x40..+0x7F: Animation lifecycle frames
} WeatherPresetRecord;

// WRAM active weather configuration block
extern WeatherPresetRecord g_active_weather_config; // $7E:72D1..$7E:734F

// Master ROM lookup table in Bank $EC
extern const WeatherPresetRecord *g_rom_weather_presets[]; // $EC:0000

/**
 * load_weather_preset_parameters ($80:A2E0)
 * Copies a 128-byte weather preset definition from ROM Bank $EC into the active
 * simulation parameter block in WRAM ($7E:72D1..$7E:734F).
 * 
 * @param preset_id Index of the weather preset to load.
 */
void load_weather_preset_parameters(uint16_t preset_id) {
    const WeatherPresetRecord *preset = g_rom_weather_presets[preset_id];
    if (preset != NULL) {
        // 64-word sequential copy from ROM to WRAM
        memcpy(&g_active_weather_config, preset, sizeof(WeatherPresetRecord));
    }
}
