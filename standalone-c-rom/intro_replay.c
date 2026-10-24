#include "intro_replay.h"
#include "snes_hw.h"
#include "ppu.h"
#include "assets.h"

/* Scroll registers ($210D - $2114, write-twice) */
#define REG_BG1HOFS (*(volatile uint8_t *)0x210D)
#define REG_BG1VOFS (*(volatile uint8_t *)0x210E)
#define REG_BG2HOFS (*(volatile uint8_t *)0x210F)
#define REG_BG2VOFS (*(volatile uint8_t *)0x2110)
#define REG_BG3HOFS (*(volatile uint8_t *)0x2111)
#define REG_BG3VOFS (*(volatile uint8_t *)0x2112)

static replay_state_t s_state;
static uint8_t s_current_scene;
static uint16_t s_timer;

static void apply_scroll_registers(const scene_desc_t *sc) {
    REG_BG1HOFS = (uint8_t)(sc->bg1_scroll_x & 0xFF);
    REG_BG1HOFS = (uint8_t)((sc->bg1_scroll_x >> 8) & 0xFF);
    REG_BG1VOFS = (uint8_t)(sc->bg1_scroll_y & 0xFF);
    REG_BG1VOFS = (uint8_t)((sc->bg1_scroll_y >> 8) & 0xFF);

    REG_BG2HOFS = (uint8_t)(sc->bg2_scroll_x & 0xFF);
    REG_BG2HOFS = (uint8_t)((sc->bg2_scroll_x >> 8) & 0xFF);
    REG_BG2VOFS = (uint8_t)(sc->bg2_scroll_y & 0xFF);
    REG_BG2VOFS = (uint8_t)((sc->bg2_scroll_y >> 8) & 0xFF);

    REG_BG3HOFS = (uint8_t)(sc->bg3_scroll_x & 0xFF);
    REG_BG3HOFS = (uint8_t)((sc->bg3_scroll_x >> 8) & 0xFF);
    REG_BG3VOFS = (uint8_t)(sc->bg3_scroll_y & 0xFF);
    REG_BG3VOFS = (uint8_t)((sc->bg3_scroll_y >> 8) & 0xFF);
}

void intro_replay_init(void) {
    s_state = STATE_LOAD_SCENE;
    s_current_scene = 0;
    s_timer = 0;
}

uint8_t intro_replay_get_scene(void) {
    return s_current_scene;
}

replay_state_t intro_replay_get_state(void) {
    return s_state;
}

void intro_replay_update(void) {
    const scene_desc_t *sc = &g_replay_scenes[s_current_scene];

    switch (s_state) {
        case STATE_LOAD_SCENE:
            /* 1. Force blank during DMA transfer */
            ppu_set_display(0x80);

            /* 2. Upload Palette to CGRAM */
            if (sc->palette && sc->palette_size > 0) {
                ppu_copy_to_cgram(0x00, sc->palette, sc->palette_size);
            }

            /* 3. Upload tilemaps and CHR tiles to VRAM */
            if (sc->map1_size > 0) {
                /* Logo dual-layer layout */
                ppu_copy_to_vram(0x0000, sc->map1, sc->map1_size);
                ppu_copy_to_vram(0x0800, sc->map3, sc->map3_size);
                ppu_copy_to_vram(0x2000, sc->tiles3, sc->tiles3_size);
                ppu_copy_to_vram(0x4000, sc->tiles1, sc->tiles1_size);
            } else if (sc->scene_map_size > 0) {
                /* Standard game scene layout */
                ppu_copy_to_vram(0x0000, sc->scene_map, sc->scene_map_size);
                ppu_copy_to_vram(0x2000, sc->scene_tiles, sc->scene_tiles_size);
            }

            /* 4. Configure PPU registers for this scene */
            REG_BGMODE  = sc->bgmode;
            REG_BG1SC   = sc->bg1sc;
            REG_BG2SC   = sc->bg2sc;
            REG_BG3SC   = sc->bg3sc;
            REG_BG12NBA = sc->bg12nba;
            REG_BG34NBA = sc->bg34nba;
            REG_TM      = sc->tm;
            REG_TS      = sc->ts;
            REG_CGWSEL  = sc->cgwsel;
            REG_CGADSUB = sc->cgadsub;

            apply_scroll_registers(sc);

            /* 5. Start fade-in from brightness 0 */
            ppu_set_display(0x00);
            s_state = STATE_FADE_IN;
            s_timer = 0;
            break;

        case STATE_FADE_IN:
            {
                apply_scroll_registers(sc);
                uint8_t brightness = (uint8_t)(s_timer / 2);
                if (brightness > 0x0F) brightness = 0x0F;
                ppu_set_display(brightness);

                s_timer++;
                if (s_timer >= 30) {
                    ppu_set_display(0x0F);
                    s_state = STATE_HOLD;
                    s_timer = 0;
                }
            }
            break;

        case STATE_HOLD:
            apply_scroll_registers(sc);
            ppu_set_display(0x0F);
            s_timer++;
            if (s_timer >= sc->hold_frames) {
                s_state = STATE_FADE_OUT;
                s_timer = 0;
            }
            break;

        case STATE_FADE_OUT:
            {
                apply_scroll_registers(sc);
                int16_t b = 15 - (int16_t)(s_timer / 2);
                if (b < 0) b = 0;
                ppu_set_display((uint8_t)b);

                s_timer++;
                if (s_timer >= 30) {
                    ppu_set_display(0x80); /* Force blank */
                    s_current_scene = (s_current_scene + 1) % NUM_REPLAY_SCENES;
                    s_state = STATE_LOAD_SCENE;
                    s_timer = 0;
                }
            }
            break;
    }
}
