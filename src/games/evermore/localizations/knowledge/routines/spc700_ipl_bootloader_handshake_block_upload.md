---
addr: 8C805B
size: 1
end: 8C805B
kind: code
category: 🧠
name: spc700_ipl_bootloader_handshake_block_upload
title: Upload a music package to the SPC700 — its descriptor's transfers, byte by byte with a handshake
confidence: confirmed
tags: [audio, system, reconstructed-c]
evidence: ["disasm, 2026-11-21 (Open Evermore): X = the descriptor's 16-bit address, A its bank ORed with $80 into $A2 ($A0/$A1 = 0), so the descriptor is read as [$A0],y through upper halves; the first word is the transfer count ($0E47, counted down); each entry is [length:16][source:24][SPC address:16], the source bank to $9E, the SPC address to $2142/$2143, then the bytes go one per handshake on $2140 through the byte loop at $8C:819E ([$9C],y with $9C/$9D = 0)", "disasm: the byte loop's `iny` / `bne` turns the bank (`inc $9E`, `ldy #$8000`) whenever Y wraps, also after a transfer's last byte when that byte is a bank's last; the descriptor's own reads step through spc700_stream_advance_bank_pointer ($8C:8195) the same way", "prove: Open Evermore seeds 3 and 5 (2026-11-21) placed one base-package piece (2 bytes) to end at $1E:FFFF; the boot upload then ended about 460 CPU cycles early (the wait at $8C:81E4 entered 33 iterations sooner) and WRAM never came back in step from frame 359; no vanilla piece ends on a bank's last byte, and with that rule kept the same seeds play in step"]
see: [routines/spc700_stream_advance_bank_pointer.md, routines/spc700_stream_data_block_and_handshake.md, routines/apu_command_handshake.md, reconstructed-c/8C/8C805B_spc700_ipl_stream_uploader.c]
---
Uploads one music package: the descriptor the package pointers at `$81:9903` name, its transfers in order, each
copied byte by byte to the SPC700 with a handshake on `$2140`. Package 0 (the driver and most sound effects) at
boot (`$8C:803D`), the others when a song changes (`$8C:8252`).

## Placement costs cycles

The copy is paced by the SPC700's echo, but not every cycle hides in that wait: a bank turn in the byte loop (`Y`
wrapping past `$FFFF`) costs extra cycles. A transfer that crosses a bank pays it in vanilla, and so does one
whose last byte is a bank's last, even though it reads nothing more. Vanilla has no such piece. A layout that
creates one shifts the end of the upload, and since the engine is busy most of every frame, the game never gets
back in step (Open Evermore keeps the rule: `noBankEnd`, `tools/open-evermore/evermore/codecs/music.mts`).
