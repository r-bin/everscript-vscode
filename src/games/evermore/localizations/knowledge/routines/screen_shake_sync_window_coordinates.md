---
addr: 909A98
size: 18
end: 909AA9
kind: code
category: 🎮
name: screen_shake_sync_window_coordinates
title: Synchronize camera screen coordinates to window boundary registers ($90:9A98)
confidence: confirmed
tags: [shake, screen, camera, coordinates, widescreen, widescreen.scroll, reconstructed-c, g1-pass]
reconstructed_c: reconstructed-c/90/909A98_screen_shake_sync_window_coordinates.c
evidence: ["reconstructed-c/90/909A98_screen_shake_sync_window_coordinates.c passes Gate G1 (34/34 reference states, 544/544 fuzzed, mutation caught)", "disasm: writes camera pos <$59 into $010E and $0112; writes vertical pos <$5B - 1 into $0110 and $0114"]
see: []
---
Synchronizes camera screen coordinates `<$59>` and `<$5B - 1>` into window coordinate bounds registers `$010E..$0114`.

## Widescreen notes

Verified: entry 0 of the camera-mode table `$90:8E68`; BG1HOFS = BG2HOFS = `$59`, BG1VOFS = BG2VOFS = `$5B` − 1. BG1 and BG2 scroll together in ordinary rooms (asm read 2026-11-09).
