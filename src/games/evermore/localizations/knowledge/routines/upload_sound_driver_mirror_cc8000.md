---
addr: CC8000
end: CC8361
size: 866
kind: code
category: 🧠
name: upload_sound_driver_mirror_cc8000
title: Sound driver uploader and SPC700 initialization routines (HiROM linear bank mirror)
confidence: confirmed
tags: [sound, spc700, dsp, driver, mirror]
evidence: ["disasm: exact 866-byte mirror of Bank $8C sound driver boot routines ($8C:8000..$8C:8361) mapped into HiROM Bank $CC ($CC:8000..$CC:8361)"]
see: [routines/upload_sound_driver.md, routines/spc700_driver_boot_and_music_init.md, routines/SFX_TRANSLATION_TABLE.md]
---
Sound driver upload and SPC700 bootloader routines in HiROM Bank `$CC` (`$CC:8000..$CC:8361`). Linear bank mirror of FastROM routines at `$8C:8000..$8C:8361` (`upload_sound_driver`, `spc700_driver_boot_and_music_init`, `spc700_ipl_bootloader_handshake_block`).

