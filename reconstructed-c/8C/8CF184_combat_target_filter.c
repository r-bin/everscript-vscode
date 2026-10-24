#include <stdint.h>

#define ENTITY_FLAG_UNTARGETED 0x0020u
#define WRAM_TARGET_FILTER_RESULT 0x0EB2u

typedef void (*LaunchTriggerScript)(uint16_t trigger_selector);
typedef void (*WriteWramWord)(uint16_t address, uint16_t value);

/** Reconstructs the eligibility gate at $8C:F184-$8C:F196. */
void combat_target_filter_script(uint16_t entity_status_flags,
                                 uint16_t trigger_selector,
                                 LaunchTriggerScript launch_trigger_script,
                                 WriteWramWord write_wram_word)
{
    if ((entity_status_flags & ENTITY_FLAG_UNTARGETED) != 0) {
        return;
    }

    launch_trigger_script(trigger_selector);
    write_wram_word(WRAM_TARGET_FILTER_RESULT, 0xFFFFu);
}