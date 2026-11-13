---
addr: 90D58C
end: 90D5CE
size: 67
kind: code
category: 🎨
name: cgram_animated_palette_timer_tick_and_step
title: Tick one palette-colour cycle and rotate its colours in CGRAM
confidence: confirmed
tags: [palette, map, graphics]
evidence: ["disasm (whole body, v0.404.0): sep #$20; dec $13F2,x; non-zero -> rts. At zero: rate $13D2,x >= 0 -> $13F2 = rate, inc $1392, dec $13B2, on $13B2 = 0 swap ($13B2 = $1392, $1392 = 0); rate < 0 -> $13F2 = -rate, inc $13B2, dec $1392, on $1392 = 0 swap back. Then two $80:85FA copies from the CGRAM mirror $7E:6187: $1392 colours from start+$13B2 to start, $13B2 colours from start to start+$1392", "measured: vanilla ROM in the bundled snes9x core, an active rate-13 slot at frame 6000 shifted every 13 frames (12-15 around lag frames)"]
---
Called by `$90:D55F` for each active cycle slot `X` (once per main-loop pass). `$13F2,X` counts frames down; at zero it is reloaded with |rate| (`$13D2,X`, signed) and the cycle shifts one colour. `$1392,X` and `$13B2,X` split the span into two parts that always add up to it: with `o = $1392` the copies give `CGRAM[start + j] = mirror[start + (j - o) mod span]`, so the colours rotate within `start .. start+span-1` (`$1372,X`, set by `$90:D50F`).

- **Rate** = frames per shift: the timer is reloaded with |rate| and counts once per pass.
- **Positive rate**: `o` grows, colour `j+1` takes colour `j`'s value (the run moves up). **Negative**: `o` shrinks from the span, colour `j` takes colour `j+1`'s (moves down).
- The source is the CGRAM mirror at `$7E:6187`, which the copies leave alone: a cycle rotates whatever the mirror holds (the room's colours, unless something rewrote the mirror — the ring menu halves BG colours there).
- Nothing is copied on frames where the timer has not run out.

## Callers
- `$90:D55F` (`palette_family_reload_queue_process`, which is the cycle sweep)

## Callees
- `$80:85FA` (`cgram_palette_dma_enqueue_or_immediate`)

Previously believed (REA partial read): the timer reload came from a separate duration and `$1392` was a frame index into a colour sequence.
