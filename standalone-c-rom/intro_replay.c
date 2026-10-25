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
#define REG_NMI_FRAME_COUNTER (*(volatile uint16_t *)0x7E0100)

static replay_state_t s_state;
static uint8_t s_current_scene;
static uint16_t s_timer;
static uint16_t s_scene_frame;

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

static void update_logo_palette_cycle(uint16_t frame) {
    /* Authentic Squaresoft logo red shimmer matching vanilla Evermore:
     * Frame 0..37: initial palette (c2=0x8, c3=0xc)
     * Frame 38..75: black (c2=0, c3=0)
     * Frame 76..153: ramp up red 1 -> 20 (+1 every 4 frames)
     * Frame 154..305: ramp down red 19 -> 0 (-1 every 8 frames)
     * Frame 306..374: black (c2=0, c3=0)
     */
    uint16_t c2 = 0;
    uint16_t c3 = 0;

    if (frame < 38) {
        c2 = 0x0008;
        c3 = 0x000C;
    } else if (frame < 76) {
        c2 = 0;
        c3 = 0;
    } else if (frame <= 153) {
        uint16_t step = (frame - 76) / 4 + 1;
        if (step > 20) step = 20;
        c2 = step;
        c3 = step / 2;
    } else if (frame <= 305) {
        int16_t step = 19 - (int16_t)((frame - 154) / 8);
        if (step < 0) step = 0;
        c2 = (uint16_t)step;
        c3 = (uint16_t)(step / 2);
    } else {
        c2 = 0;
        c3 = 0;
    }

    REG_CGADD = 0x02;
    REG_CGDATA = (uint8_t)(c2 & 0xFF);
    REG_CGDATA = (uint8_t)((c2 >> 8) & 0xFF);
    REG_CGDATA = (uint8_t)(c3 & 0xFF);
    REG_CGDATA = (uint8_t)((c3 >> 8) & 0xFF);
}

static void update_dynamic_scene_camera(const scene_desc_t *sc, uint8_t scene_id, uint16_t timer) {
    if (scene_id == 2) {
        /* Scene 2: Laboratory Machine Pan (East -> Pause -> North) */
        uint16_t cur_x = 426;
        uint16_t cur_y = 527;

        if (timer < 86) {
            /* 1. Pan East from 426 to 512 */
            cur_x = 426 + timer;
            cur_y = 527;
        } else if (timer < 100) {
            /* 2. Pause over the machine */
            cur_x = 512;
            cur_y = 527;
        } else if (timer < 628) {
            /* 3. Pan North from 527 up towards ceiling / title screen */
            cur_x = 512;
            int32_t dy = 527 - (int32_t)(timer - 100);
            cur_y = (dy < 0) ? 0xFFFF : (uint16_t)dy;
        } else {
            /* 4. Arrived at Title Screen position */
            cur_x = 512;
            cur_y = 0xFFFF;
        }

        REG_BG1HOFS = (uint8_t)(cur_x & 0xFF);
        REG_BG1HOFS = (uint8_t)((cur_x >> 8) & 0xFF);
        REG_BG1VOFS = (uint8_t)(cur_y & 0xFF);
        REG_BG1VOFS = (uint8_t)((cur_y >> 8) & 0xFF);

        REG_BG2HOFS = (uint8_t)(cur_x & 0xFF);
        REG_BG2HOFS = (uint8_t)((cur_x >> 8) & 0xFF);
        REG_BG2VOFS = (uint8_t)(cur_y & 0xFF);
        REG_BG2VOFS = (uint8_t)((cur_y >> 8) & 0xFF);
    } else if (scene_id == 5) {
        /* Scene 5: Antiqua Colosseum Pan (East across desert arena) */
        uint16_t cur_x = 1 + (uint16_t)((timer * 200) / 400);
        uint16_t cur_y = 267;

        REG_BG1HOFS = (uint8_t)(cur_x & 0xFF);
        REG_BG1HOFS = (uint8_t)((cur_x >> 8) & 0xFF);
        REG_BG1VOFS = (uint8_t)(cur_y & 0xFF);
        REG_BG1VOFS = (uint8_t)((cur_y >> 8) & 0xFF);

        REG_BG2HOFS = (uint8_t)(cur_x & 0xFF);
        REG_BG2HOFS = (uint8_t)((cur_x >> 8) & 0xFF);
        REG_BG2VOFS = (uint8_t)(cur_y & 0xFF);
        REG_BG2VOFS = (uint8_t)((cur_y >> 8) & 0xFF);
    } else if (scene_id == 7) {
        /* Scene 7: Omnitopia Space Station Pan (Pan across hub) */
        uint16_t cur_x = 544 - (uint16_t)((timer * 200) / 400);
        uint16_t cur_y = 480;

        REG_BG1HOFS = (uint8_t)(cur_x & 0xFF);
        REG_BG1HOFS = (uint8_t)((cur_x >> 8) & 0xFF);
        REG_BG1VOFS = (uint8_t)(cur_y & 0xFF);
        REG_BG1VOFS = (uint8_t)((cur_y >> 8) & 0xFF);

        REG_BG2HOFS = (uint8_t)(cur_x & 0xFF);
        REG_BG2HOFS = (uint8_t)((cur_x >> 8) & 0xFF);
        REG_BG2VOFS = (uint8_t)(cur_y & 0xFF);
        REG_BG2VOFS = (uint8_t)((cur_y >> 8) & 0xFF);
    } else {
        apply_scroll_registers(sc);
    }
}

void intro_replay_init(void) {
    s_state = STATE_LOAD_SCENE;
    s_current_scene = 0;
    s_timer = 0;
    s_scene_frame = 0;
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

            /* 5. Start fade-in / forced blank */
            ppu_set_display(0x80);
            s_state = STATE_FADE_IN;
            s_timer = 0;
            s_scene_frame = 0;
            break;

        case STATE_FADE_IN:
            {
                update_dynamic_scene_camera(sc, s_current_scene, s_scene_frame);
                if (s_current_scene == 0) {
                    update_logo_palette_cycle(REG_NMI_FRAME_COUNTER + 1);
                    if (s_scene_frame < 38) {
                        ppu_set_display(0x80);
                    } else {
                        ppu_set_display(0x0F);
                    }
                    s_scene_frame++;
                    if (s_scene_frame >= 38) {
                        ppu_set_display(0x0F);
                        s_state = STATE_HOLD;
                        s_timer = 0;
                    }
                } else {
                    uint8_t brightness = (uint8_t)(s_timer / 2);
                    if (brightness > 0x0F) brightness = 0x0F;
                    ppu_set_display(brightness);
                    s_scene_frame++;
                    s_timer++;
                    if (s_timer >= 30) {
                        ppu_set_display(0x0F);
                        s_state = STATE_HOLD;
                        s_timer = 0;
                    }
                }
            }
            break;

        case STATE_HOLD:
            update_dynamic_scene_camera(sc, s_current_scene, s_scene_frame);
            if (s_current_scene == 0) {
                update_logo_palette_cycle(REG_NMI_FRAME_COUNTER + 1);
                if (s_scene_frame < 318) {
                    ppu_set_display(0x0F);
                } else {
                    ppu_set_display(0x80);
                }
                s_scene_frame++;
                if (s_scene_frame >= 374) {
                    ppu_set_display(0x80); /* Force blank */
                    s_current_scene = 1;
                    s_state = STATE_LOAD_SCENE;
                    s_timer = 0;
                    s_scene_frame = 0;
                }
            } else {
                ppu_set_display(0x0F);
                s_scene_frame++;
                s_timer++;
                if (s_timer >= sc->hold_frames) {
                    s_state = STATE_FADE_OUT;
                    s_timer = 0;
                }
            }
            break;

        case STATE_FADE_OUT:
            {
                update_dynamic_scene_camera(sc, s_current_scene, s_scene_frame);
                int16_t b = 15 - (int16_t)(s_timer / 2);
                if (b < 0) b = 0;
                ppu_set_display((uint8_t)b);
                s_scene_frame++;

                s_timer++;
                if (s_timer >= 30) {
                    ppu_set_display(0x80); /* Force blank */
                    s_current_scene = (s_current_scene + 1) % NUM_REPLAY_SCENES;
                    s_state = STATE_LOAD_SCENE;
                    s_timer = 0;
                    s_scene_frame = 0;
                }
            }
            break;
    }
}
