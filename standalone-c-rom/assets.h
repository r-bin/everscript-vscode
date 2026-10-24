#ifndef ASSETS_H
#define ASSETS_H

#include <stdint.h>

#define NUM_REPLAY_SCENES 8

typedef struct {
    const char *name;
    const uint8_t *palette;
    uint16_t palette_size;

    /* For logo: 2 tilemaps + 2 tile sets */
    const uint8_t *map1;
    uint16_t map1_size;
    const uint8_t *map3;
    uint16_t map3_size;
    const uint8_t *tiles1;
    uint16_t tiles1_size;
    const uint8_t *tiles3;
    uint16_t tiles3_size;

    /* For standard scenes (mansion, title, demos): map (6KB) + tiles (32KB) */
    const uint8_t *scene_map;
    uint16_t scene_map_size;
    const uint8_t *scene_tiles;
    uint16_t scene_tiles_size;

    /* PPU registers */
    uint8_t bgmode;
    uint8_t bg1sc;
    uint8_t bg2sc;
    uint8_t bg3sc;
    uint8_t bg12nba;
    uint8_t bg34nba;
    uint8_t tm;
    uint8_t ts;
    uint8_t cgwsel;
    uint8_t cgadsub;

    uint16_t hold_frames;
} scene_desc_t;

extern const scene_desc_t g_replay_scenes[NUM_REPLAY_SCENES];

#endif /* ASSETS_H */
