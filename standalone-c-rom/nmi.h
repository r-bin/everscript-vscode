#ifndef NMI_H
#define NMI_H

#include <stdint.h>

extern volatile uint16_t g_nmi_frame_counter;
extern volatile uint8_t  g_nmi_vblank_flag;

void wait_for_vblank(void);

#endif /* NMI_H */

