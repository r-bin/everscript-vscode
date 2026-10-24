/*
 * soe.h: what every reconstructed C file sees of the machine, so all of them share one view of
 * WRAM, ROM and I/O (docs/reverse-engineering/c-to-rom.md §10).
 *
 * Two compilers read this file:
 *  - Calypsi (65816, large code and data model): tools/c-to-rom/build.mts compiles bound files into
 *    the 4th MB of a HiROM image. Every access below is a 24-bit long access, so DB never matters.
 *  - a host C compiler (SOE_HOST): gate G0, the file compiles with -Werror. WRAM is g_ram.
 *
 * Rules for C that goes into the ROM:
 *  - no static or global variables: the build gives the linker no RAM for them. State lives in WRAM
 *    under its knowledge-entry name (soe_ram.h), or in locals;
 *  - tables and assets are read from the ROM image (ROM8/ROM16/ROM24) by bus address, never copied
 *    into C;
 *  - integer types of the width the asm uses, explicit casts where it wraps.
 */
#ifndef SOE_H
#define SOE_H

#include <stdint.h>
#include <stdbool.h>

#ifdef __CALYPSI_TARGET_65816__
#define SOE_FAR __far
#else
#define SOE_FAR
extern uint8_t g_ram[0x20000];       /* WRAM $7E0000-$7FFFFF */
extern uint8_t g_io[0x10000];        /* bank $00 I/O, $2000-$5FFF */
extern const uint8_t *g_rom;         /* the ROM image (HiROM, file order) */
#endif

/* ---- WRAM: an offset 0x00000-0x1FFFF from $7E:0000 (bank $7F = 0x10000 + addr) ---- */
#ifdef __CALYPSI_TARGET_65816__
#define RAM8(off)   (*(uint8_t SOE_FAR *)(0x7E0000UL + (uint32_t)(off)))
#define RAM16(off)  (*(uint16_t SOE_FAR *)(0x7E0000UL + (uint32_t)(off)))
#define RAMPTR(type, off) ((type SOE_FAR *)(0x7E0000UL + (uint32_t)(off)))
#else
#define RAM8(off)   (g_ram[(uint32_t)(off) & 0x1FFFF])
#define RAM16(off)  (*(uint16_t *)&g_ram[(uint32_t)(off) & 0x1FFFF])
#define RAMPTR(type, off) ((type *)&g_ram[(uint32_t)(off) & 0x1FFFF])
#endif

/* ---- ROM: a 24-bit bus address ($C0-$FF full banks, $80-$BF upper halves) ---- */
#ifdef __CALYPSI_TARGET_65816__
#define ROM8(bus)   (*(const uint8_t SOE_FAR *)(uint32_t)(bus))
#define ROM16(bus)  (*(const uint16_t SOE_FAR *)(uint32_t)(bus))
#else
#define SOE_ROM_OFFSET(bus) ((uint32_t)(bus) & 0x3FFFFF)
#define ROM8(bus)   (g_rom[SOE_ROM_OFFSET(bus)])
#define ROM16(bus)  ((uint16_t)(g_rom[SOE_ROM_OFFSET(bus)] | g_rom[SOE_ROM_OFFSET(bus) + 1] << 8))
#endif
#define ROM24(bus)  ((uint32_t)ROM16(bus) | (uint32_t)ROM8((uint32_t)(bus) + 2) << 16)

/* ---- I/O registers in bank $00 ($2100-$21FF PPU, $4200-$43FF CPU/DMA): always volatile ---- */
#ifdef __CALYPSI_TARGET_65816__
#define IO8(addr)   (*(volatile uint8_t SOE_FAR *)(uint32_t)(addr))
#define IO16(addr)  (*(volatile uint16_t SOE_FAR *)(uint32_t)(addr))
#else
#define IO8(addr)   (*(volatile uint8_t *)&g_io[(addr) & 0xFFFF])
#define IO16(addr)  (*(volatile uint16_t *)&g_io[(addr) & 0xFFFF])
#endif

/* ---- A bound routine: the CPU state at its entry, and what it leaves ----
 * The bridge (tools/c-to-rom/build.mts) pushes the registers as this record, calls the binding with a
 * pointer to it and pulls them back afterwards, P included. A binding writes every register and flag
 * the asm leaves, since the caller may read any of them; G1 compares all of them. Widths: a and x/y
 * are the full 16-bit registers (with x8, the high byte of x and y is 0). */
typedef struct {
    uint16_t a, x, y, d;
    uint8_t db, p;
} soe_regs_t;

typedef soe_regs_t SOE_FAR *soe_regs;

#define SOE_N 0x80
#define SOE_V 0x40
#define SOE_M 0x20     /* 8-bit accumulator */
#define SOE_X 0x10     /* 8-bit index registers */
#define SOE_D 0x08
#define SOE_I 0x04
#define SOE_Z 0x02
#define SOE_C 0x01

/* N and Z as a load of v leaves them (16-bit, or 8-bit when the asm ends with an 8-bit accumulator). */
static inline void soe_nz16(soe_regs r, uint16_t v) {
    r->p = (uint8_t)((r->p & ~(SOE_N | SOE_Z)) | (v & 0x8000 ? SOE_N : 0) | (v == 0 ? SOE_Z : 0));
}
static inline void soe_nz8(soe_regs r, uint8_t v) {
    r->p = (uint8_t)((r->p & ~(SOE_N | SOE_Z)) | (v & 0x80 ? SOE_N : 0) | (v == 0 ? SOE_Z : 0));
}
static inline void soe_carry(soe_regs r, bool c) {
    r->p = (uint8_t)(c ? r->p | SOE_C : r->p & ~SOE_C);
}

/* ---- Absolute addressing as the asm does it: bank DB at entry (LDA $0139 reads DB:$0139) ----
 * Use these where the asm uses 16-bit absolute operands, so the C reads what the asm reads for any
 * DB the callers pass ($7E, $80, ...); RAM8/RAM16 are for long ($7E:xxxx) operands. */
#ifdef __CALYPSI_TARGET_65816__
#define ABS8(r, a)  (*(uint8_t SOE_FAR *)((uint32_t)(r)->db << 16 | (uint16_t)(a)))
#define ABS16(r, a) (*(uint16_t SOE_FAR *)((uint32_t)(r)->db << 16 | (uint16_t)(a)))
#else
uint8_t *soe_bus(uint32_t addr);
#define ABS8(r, a)  (*soe_bus((uint32_t)(r)->db << 16 | (uint16_t)(a)))
#define ABS16(r, a) (*(uint16_t *)soe_bus((uint32_t)(r)->db << 16 | (uint16_t)(a)))
#endif

/* ---- The flag arithmetic of single instructions, for routines whose callers read the flags ---- */
/* ROL A (16-bit): carry in from P, bit 15 out to P. N and Z as the result. */
static inline uint16_t soe_rol16(soe_regs r, uint16_t v) {
    uint16_t out = (uint16_t)(v << 1 | (r->p & SOE_C));
    soe_carry(r, (v & 0x8000) != 0);
    soe_nz16(r, out);
    return out;
}
/* ADC (16-bit, binary mode): a + m + carry; sets N, V, Z, C. */
static inline uint16_t soe_adc16(soe_regs r, uint16_t a, uint16_t m) {
    uint32_t sum = (uint32_t)a + m + (r->p & SOE_C);
    uint16_t out = (uint16_t)sum;
    soe_carry(r, sum > 0xFFFF);
    r->p = (uint8_t)((r->p & ~SOE_V) | ((~(a ^ m) & (a ^ out) & 0x8000) ? SOE_V : 0));
    soe_nz16(r, out);
    return out;
}

/* SOE_BIND(name, 0x80AD62, RTL) { ... } replaces the ROM routine at that address (its execution
 * address, $8x) with this function; RTS routines are reached through a JSL/RTS trampoline. The build
 * finds bindings by this macro. */
#define SOE_BIND(name, addr, ret) void name##_bind(soe_regs r)

/* ---- Calling a routine that is still asm: registers in and out through a record ----
 * soe_call_rtl: the routine ends in RTL. soe_call_rts: it ends in RTS; the runtime reaches it from
 * its own bank through an RTL byte in that bank (tools/c-to-rom/runtime.s). */
void soe_call_rtl(uint32_t target, soe_regs r);
void soe_call_rts(uint32_t target, soe_regs r);

#endif /* SOE_H */
