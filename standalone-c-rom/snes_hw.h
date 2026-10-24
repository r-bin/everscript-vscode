#ifndef SNES_HW_H
#define SNES_HW_H

#include <stdint.h>

/* PPU Registers ($2100 - $213F) */
#define REG_INIDISP     (*(volatile uint8_t  *)0x2100)
#define REG_OBSEL       (*(volatile uint8_t  *)0x2101)
#define REG_OAMADDL     (*(volatile uint8_t  *)0x2102)
#define REG_OAMADDH     (*(volatile uint8_t  *)0x2103)
#define REG_OAMDATA     (*(volatile uint8_t  *)0x2104)
#define REG_BGMODE      (*(volatile uint8_t  *)0x2105)
#define REG_MOSAIC      (*(volatile uint8_t  *)0x2106)
#define REG_BG1SC       (*(volatile uint8_t  *)0x2107)
#define REG_BG2SC       (*(volatile uint8_t  *)0x2108)
#define REG_BG3SC       (*(volatile uint8_t  *)0x2109)
#define REG_BG4SC       (*(volatile uint8_t  *)0x210A)
#define REG_BG12NBA     (*(volatile uint8_t  *)0x210B)
#define REG_BG34NBA     (*(volatile uint8_t  *)0x210C)
#define REG_VMAIN       (*(volatile uint8_t  *)0x2115)
#define REG_VMADDL      (*(volatile uint8_t  *)0x2116)
#define REG_VMADDH      (*(volatile uint8_t  *)0x2117)
#define REG_VMADD       (*(volatile uint16_t *)0x2116)
#define REG_VMDATAL     (*(volatile uint8_t  *)0x2118)
#define REG_VMDATAH     (*(volatile uint8_t  *)0x2119)
#define REG_VMDATA      (*(volatile uint16_t *)0x2118)
#define REG_CGADD       (*(volatile uint8_t  *)0x2121)
#define REG_CGDATA      (*(volatile uint8_t  *)0x2122)
#define REG_TM          (*(volatile uint8_t  *)0x212C)
#define REG_TS          (*(volatile uint8_t  *)0x212D)
#define REG_CGWSEL      (*(volatile uint8_t  *)0x2130)
#define REG_CGADSUB     (*(volatile uint8_t  *)0x2131)
#define REG_COLDATA     (*(volatile uint8_t  *)0x2132)

/* CPU / APU / DMA Registers ($4200 - $437F) */
#define REG_NMITIMEN    (*(volatile uint8_t  *)0x4200)
#define REG_RDNMI       (*(volatile uint8_t  *)0x4210)
#define REG_MDMAEN      (*(volatile uint8_t  *)0x420B)
#define REG_MEMSEL      (*(volatile uint8_t  *)0x420D)

/* DMA Channel 0 Registers ($4300 - $430A) */
#define REG_DMAP0       (*(volatile uint8_t  *)0x4300)
#define REG_BBAD0       (*(volatile uint8_t  *)0x4301)
#define REG_A1T0L       (*(volatile uint8_t  *)0x4302)
#define REG_A1T0H       (*(volatile uint8_t  *)0x4303)
#define REG_A1T0        (*(volatile uint16_t *)0x4302)
#define REG_A1B0        (*(volatile uint8_t  *)0x4304)
#define REG_DAS0L       (*(volatile uint8_t  *)0x4305)
#define REG_DAS0H       (*(volatile uint8_t  *)0x4306)
#define REG_DAS0        (*(volatile uint16_t *)0x4305)

void snes_init_hw(void);
void snes_enable_fastrom(void);
void snes_clear_wram(void);

#endif /* SNES_HW_H */

