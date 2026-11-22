---
addr: 8C801F
size: 60
end: 8C805A
kind: code
category: 🔊
name: spc700_driver_boot_and_music_init
title: SPC700 audio driver bootloader and music initialization ($8C:801F)
confidence: confirmed
evidence: ["disasm: disables interrupts (SEI) and clears DMA registers $4200/$420C; streams driver block $81:80DC via $8C:810E; sends APU command $0E via $8C:81FD; uploads IPL bootloader block from $81:9903 via $8C:805B; waits for ready via $8C:81D4; sends APU music command $02 via $8C:81FD; caller: $8E:E124"]
see: [routines/spc700_stream_data_block_and_handshake.md, routines/spc700_ipl_bootloader_handshake_block_upload.md, routines/apu_command_handshake.md, routines/apu_wait_ready_timeout.md]
tags: [audio, spc700, music, bootstrap]
---
Boots the SPC700 sound coprocessor and initializes music playback during startup or room transitions. Disables interrupts and clears HDMA channels, streams the main sound driver binary `$81:80DC` to the APU via `$8C:810E`, executes the IPL handshake via `$8C:805B`, and issues music playback command `$02` via `apu_command_handshake` (`$8C:81FD`).

## The driver's start (MesenCE, 2026-11-15)
At power-on the reset calls only `$8C:8000` (frame 4). Its loader then shows `$FFFF` in ports 0-1 for ~180
frames, then `$BBAA`, and ignores commands. This routine runs about 320 frames after power-on; its upload takes
17 frames. Its bank-0 package writes ARAM `$1EE1` = `$D4`: the echo buffer's start page. After the final `$02`
the driver starts at ARAM `$0700`. It writes `[$1EE1]` to DSP `ESA` and clears from that page up to `$FBFF`,
keeping its pointer in ARAM `$00/$01`. Then its main loop moves 21 DSP registers (addresses at ARAM `$07E0`,
targets at `$0228`) a step at a time to their values. Its echo of `$02` never comes; the next command times out
in `apu_command_handshake` and goes on.

It resets no DSP register itself. If the DSP still holds another driver's echo start and length (the boot ROM
leaves them as they were), the echo writes over the driver's ARAM while the registers move. In the combo POC
this happened after Mana: `$1EE1` became 0, and the driver's next start cleared from `$0000` over its own pointer
and never ended. The POC resets the DSP first: FLG = `$E0`, every other register 0, then ~0.4 s for the echo pointer to run out the old buffer (docs/combo/poc.md §4).
