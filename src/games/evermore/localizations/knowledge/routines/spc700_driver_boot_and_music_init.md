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
