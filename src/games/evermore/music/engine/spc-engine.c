/*
 * spc-engine.c - the Music tab's own sound chip.
 *
 * blargg's SPC700 + S-DSP from the emulator core's source tree
 * (src/emulator/core/snes9x2005-wasm/source/apu_blargg.c, which the core itself
 * does not use: it runs snes9x's older APU). Built by build-engine.sh into
 * spc-engine.js (wasm embedded). The tab drives it the way the game drives the
 * real chip: it writes ARAM, sets the CPU registers and talks through the four
 * ports, then pulls 32 kHz stereo samples.
 *
 * Layout of se_view() is the same as the emulator core's getApuView()
 * (src/emulator/core/snes9x2005-wasm/source/exports.c), so the tab reads both
 * the same way.
 */

#include "apu_blargg.c"

#include "emscripten.h"

/* snes9x globals apu_blargg.c refers to. */
SSettings Settings;
SCPUState CPU;

#define SE_MAX_FRAMES 8192
static int16_t se_buf [SE_MAX_FRAMES * 2 + EXTRA_SIZE];
static uint8_t se_view_buf [224];

EMSCRIPTEN_KEEPALIVE void se_init(void)
{
   S9xInitAPU();
   spc_set_output(se_buf, SE_MAX_FRAMES * 2);
}

EMSCRIPTEN_KEEPALIVE uint8_t *se_ram(void) { return m.ram.ram; }
EMSCRIPTEN_KEEPALIVE int16_t *se_samples(void) { return se_buf; }

/* Ports: what the SPC reads ($F4-$F7) and what it last wrote there. */
EMSCRIPTEN_KEEPALIVE void se_set_in(int32_t i, int32_t v) { m.smp_regs[1][R_CPUIO0 + (i & 3)] = (uint8_t) v; }
EMSCRIPTEN_KEEPALIVE void se_set_out(int32_t i, int32_t v) { m.smp_regs[0][R_CPUIO0 + (i & 3)] = (uint8_t) v; }
EMSCRIPTEN_KEEPALIVE int32_t se_out(int32_t i) { return m.smp_regs[0][R_CPUIO0 + (i & 3)]; }
EMSCRIPTEN_KEEPALIVE int32_t se_pc(void) { return m.cpu_regs.pc; }

EMSCRIPTEN_KEEPALIVE void se_set_cpu(int32_t pc, int32_t a, int32_t x, int32_t y, int32_t psw, int32_t sp)
{
   m.cpu_regs.pc = pc & 0xFFFF;
   m.cpu_regs.a = a & 0xFF;
   m.cpu_regs.x = x & 0xFF;
   m.cpu_regs.y = y & 0xFF;
   m.cpu_regs.psw = psw & 0xFF;
   m.cpu_regs.sp = sp & 0xFF;
}

/* Runs `clocks` SPC clocks (1.024 MHz; 32 per output frame) and returns the
   number of int16 samples (stereo, interleaved) now in se_samples(). */
EMSCRIPTEN_KEEPALIVE int32_t se_run(int32_t clocks)
{
   if (clocks > SE_MAX_FRAMES * CLOCKS_PER_SAMPLE) clocks = SE_MAX_FRAMES * CLOCKS_PER_SAMPLE;
   /* blargg's set_output resets the sample clock; this copy leaves that to
      S9xResetAPU, so do it here or the count keeps growing. */
   m.extra_clocks &= CLOCKS_PER_SAMPLE - 1;
   spc_set_output(se_buf, SE_MAX_FRAMES * 2);
   spc_end_frame(clocks);
   return SPC_SAMPLE_COUNT();
}

/* Loads an SPC-file image (0x10200 bytes): registers at 0x25, RAM at 0x100
   (with $F0-$FF holding the SMP registers and timer counters), DSP registers
   at 0x10100, the RAM under the IPL ROM at 0x101C0. */
EMSCRIPTEN_KEEPALIVE void se_load(const uint8_t *img)
{
   int32_t i;

   se_set_cpu(img[0x25] | img[0x26] << 8, img[0x27], img[0x28], img[0x29], img[0x2A], img[0x2B]);

   m.rom_enabled = dsp_m.rom_enabled = 0;
   memcpy(m.ram.ram, img + 0x100, 0x10000);
   memcpy(&m.ram.ram[ROM_ADDR], img + 0x101C0, ROM_SIZE);

   memcpy(m.smp_regs[0], &m.ram.ram[0xF0], REG_COUNT);
   memcpy(m.smp_regs[1], m.smp_regs[0], REG_COUNT);
   m.smp_regs[1][R_TEST] = 0;
   m.smp_regs[1][R_CONTROL] = 0;
   m.smp_regs[1][R_T0TARGET] = 0;
   m.smp_regs[1][R_T1TARGET] = 0;
   m.smp_regs[1][R_T2TARGET] = 0;
   memset(m.ram.padding1, CPU_PAD_FILL, sizeof m.ram.padding1);
   memset(m.ram.padding2, CPU_PAD_FILL, sizeof m.ram.padding2);

   /* The tail of spc_reset_common(), without sending the CPU to the IPL ROM. */
   m.spc_time = 0;
   m.dsp_time = CLOCKS_PER_SAMPLE + 1;
   for (i = 0; i < TIMER_COUNT; i++)
   {
      Timer *t = &m.timers[i];
      t->next_time = 1;
      t->divider = 0;
   }
   spc_enable_rom(m.smp_regs[0][R_CONTROL] & 0x80);
   for (i = 0; i < TIMER_COUNT; i++)
   {
      Timer *t = &m.timers[i];
      t->period = IF_0_THEN_256(m.smp_regs[0][R_T0TARGET + i]);
      t->enabled = m.smp_regs[0][R_CONTROL] >> i & 1;
      t->counter = m.smp_regs[1][R_T0OUT + i] & 0x0F;
   }
   spc_set_tempo(m.tempo);
   m.extra_clocks = 0;
   spc_reset_buffer();

   /* DSP: power-on state, then the image's registers; no voice is sounding. */
   dsp_reset();
   memcpy(dsp_m.regs, img + 0x10100, REGISTER_COUNT);
   dsp_m.regs[R_KON] = 0;
   dsp_m.new_kon = 0;
   dsp_m.t_dir = dsp_m.regs[R_DIR];
   dsp_m.t_esa = dsp_m.regs[R_ESA];

   spc_set_output(se_buf, SE_MAX_FRAMES * 2);
}

/* Same layout as the emulator core's getApuView(). */
EMSCRIPTEN_KEEPALIVE uint8_t *se_view(void)
{
   uint32_t ram = (uint32_t)(uintptr_t) m.ram.ram;
   int32_t i;
   uint8_t keyed = 0;
   memcpy(se_view_buf, &ram, 4);
   se_view_buf[4] = (uint8_t) m.cpu_regs.pc;
   se_view_buf[5] = (uint8_t) (m.cpu_regs.pc >> 8);
   se_view_buf[6] = (uint8_t) m.cpu_regs.a;
   se_view_buf[7] = (uint8_t) m.cpu_regs.x;
   se_view_buf[8] = (uint8_t) m.cpu_regs.y;
   se_view_buf[9] = (uint8_t) m.cpu_regs.psw;
   se_view_buf[10] = (uint8_t) m.cpu_regs.sp;
   se_view_buf[11] = m.smp_regs[0][R_CONTROL];
   for (i = 0; i < 4; i++)
   {
      se_view_buf[12 + i] = m.smp_regs[1][R_CPUIO0 + i];
      se_view_buf[16 + i] = m.smp_regs[0][R_CPUIO0 + i];
   }
   se_view_buf[23] = 0;
   for (i = 0; i < 3; i++)
   {
      se_view_buf[20 + i] = m.smp_regs[0][R_T0TARGET + i];
      if (m.timers[i].enabled) se_view_buf[23] |= 1 << i;
   }
   se_view_buf[24] = (uint8_t) m.rom_enabled;
   for (i = 0; i < VOICE_COUNT; i++)
      if (dsp_m.voices[i].env > 0) keyed |= 1 << i;
   se_view_buf[25] = keyed;
   memcpy(se_view_buf + 32, dsp_m.regs, 128);
   memcpy(se_view_buf + 160, m.rom_enabled ? m.hi_ram : &m.ram.ram[ROM_ADDR], ROM_SIZE);
   return se_view_buf;
}
