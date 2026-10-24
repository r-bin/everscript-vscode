# Animated Palette Copy Routines ($80:9E93, $80:A003)

> **Subsystem**: Palette shadow-buffer staging
> **ROM Addresses**: `$80:9E93` (group 1 prefix), `$80:A003` (group 2 prefix)
> **C Model**: `reconstructed-c/80/809E93_weather_palette.c`
> **Confidence**: Confirmed

## Observed Entry Prefixes

`$80:9E93` reads eight words from data-bank offsets `Y+$06, Y+$08, ... Y+$14` and writes them to long WRAM addresses `$7E:7321,X` through `$7E:732F,X`. It advances Y by `$10` and jumps to `$80:9FFE`.

`$80:A003` reads eight words from offsets `Y+$07, Y+$09, ... Y+$15` and writes them to `$7E:7331,X` through `$7E:733F,X`. It also advances Y by `$10`, then jumps to `$80:A16E`.

These entries stage words; this evidence does not establish a timer, a color-rotation algorithm, or a DMA request. The `$80:9FFE` and `$80:A16E` continuations perform additional conditional work and are represented as callback boundaries in the C model.

---

## 2. Disassembly Analysis

> **Interactive 65816 Assembly**:
> Centralized comments infused at runtime.
> [View in VFS: soe://rom/code/809E93](soe://rom/code/809E93?asm=1&c=0)


---

## C Model Scope

The C file models only the two observed load/store prefixes and passes the updated Y, unchanged X, and continuation address to a callback. It does not model the continuation routines or assign meaning to the copied words.

