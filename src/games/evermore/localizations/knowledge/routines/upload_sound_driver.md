---
addr: 8C8000
size: 31
end: 8C801E
kind: code
name: upload_sound_driver
title: Upload the sound driver to the SPC700 through its boot ROM
confidence: likely
tags: [engine, sound]
evidence: ["disasm: SEI, $4200 = 0, $420C = 0, then X = $8000, A = $0081 and JSR $8C:810E; the next routine in the bank is spc700_ipl_bootloader_handshake_block (CDL export)", "MesenCE 2.2.1, power-on, 2026-10-30: called from the reset code at $80:81EF; 214 writes to $2140 from master clock 1,626,286 to 1,738,444, ~490-570 clocks per byte (each waits for the SPC700 to echo the index)"]
see: [src/games/evermore/localizations/knowledge/routines/reset_handler.md, src/games/evermore/localizations/knowledge/routines/enable_nmi_and_enter_frame_loop.md]
---
Turns NMI and HDMA off and hands the driver, read from `$81:8000`, to the SPC700's boot ROM byte by byte
(`$8C:810E`). The time it takes depends on how fast the SPC700 answers, so an emulator or recomp whose APU
runs differently boots the game at a different moment; the SecretOfEvermoreRecomp repository's
docs/imperfections/apu-port-handshake.md measures it.

What it uploads is only 214 bytes: a loader that keeps answering the boot ROM's protocol (the SPC700 then runs
in direct page, PC around `$0009-$0012`). The driver itself and the first package follow with
`$8C:801F` (spc700_driver_boot_and_music_init), as power-on does a few hundred frames later. Calling this
routine alone leaves no working driver: the combo POC found that out when its resumed Evermore did not
answer command `$0E` (docs/combo/poc.md, MesenCE, 2026-11-15).
