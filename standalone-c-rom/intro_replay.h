#ifndef INTRO_REPLAY_H
#define INTRO_REPLAY_H

#include <stdint.h>

typedef enum {
    STATE_LOAD_SCENE = 0,
    STATE_FADE_IN,
    STATE_HOLD,
    STATE_FADE_OUT
} replay_state_t;

void intro_replay_init(void);
void intro_replay_update(void);
uint8_t intro_replay_get_scene(void);
replay_state_t intro_replay_get_state(void);

#endif /* INTRO_REPLAY_H */
