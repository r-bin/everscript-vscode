---
addr: 7E0106
end: 7E0125
kind: region
name: JOYPAD1_TRIGGERED
title: PPU register shadows, copied to the PPU every NMI
lifetime: frame
confidence: likely
tags: [widescreen, widescreen.fade]
evidence: ["disasm: NMI $80:823A copies $0106 -> $2100, $010E-$0119 -> $210D-$2112 (two writes each), $011A-$011D -> $2113-$2114, $0122-$0124 -> $2123-$2125 (CDL export, v0.201.10)", "disasm: reset $80:8020 sets $0106 = $8F (screen off) and $0110/$0114/$0118/$011C/$011E/$0120 = $FF"]
see: [docs/recomp/README.md]
---
The game never writes most display settings to the PPU directly: it writes them here, and the
NMI copies them over during vblank, so a change takes effect at the next frame without tearing.

## Fields
| offset | size | PPU register | meaning |
|---|---|---|---|
| $0106 | 1 | $2100 INIDISP | brightness / forced blank (fades write this) |
| $010E | 2 | $210D | BG1 horizontal scroll |
| $0110 | 2 | $210E | BG1 vertical scroll |
| $0112 | 2 | $210F | BG2 horizontal scroll |
| $0114 | 2 | $2110 | BG2 vertical scroll |
| $0116 | 2 | $2111 | BG3 horizontal scroll |
| $0118 | 2 | $2112 | BG3 vertical scroll |
| $011A | 2 | $2113 | BG4 horizontal scroll |
| $011C | 2 | $2114 | BG4 vertical scroll |
| $0122 | 3 | $2123-$2125 | window mask settings |

## Notes
$0107–$010D and $011E–$0121 are not covered by this copy; the NMI also writes $0108/$010A to the
H/V IRQ timer ($4207/$4209).

## Widescreen notes

The first byte, `$7E:0106`, is the INIDISP (master brightness / forced blank) shadow: the NMI ($80:823E) loads it and stores it to `$2100` before anything else; `screen_set_full_brightness` stores `$0F`, `screen_blank_display` stores 0, and `fade_brightness_step_towards_target` ($80:DE96) steps it by one per frame toward the low byte of `$7E:0B83`. The entry's name still says joypad; the joypad state is `$7E:0EC6` (raw pad) and `$7E:0104`. Brightness fades are therefore INIDISP only, and the recomp PPU applies brightness to every composed pixel, margins included (asm read 2026-11-09).
