# SPC700 APU Command Handshake & Audio Driver

- **ROM Locations**:
  - `apu_command_handshake`: `$8C:81FD` – `$8C:8235`
  - `load_song_soundbank`: `$8C:8236` – `$8C:828E`
  - `play_music_track`: `$8C:828F` – `$8C:82DB`
- **CPU State**: 8-bit Accumulator, 16-bit Index (`SEP #$20 / REP #$10`), interrupts disabled (`SEI`).
- **Hardware Registers**:
  - `$2140`–`$2141`: 16-bit payload / argument registers to SPC700.
  - `$2142`: Command index / ID byte.
  - `$2143`: Echo sequence acknowledgment counter.
- **WRAM Core Addresses**:
  - DP `$9F`: Monotonic sequence counter (1..255, 0 skipped).
  - `$7E:0E4B`: Currently loaded song instrument soundbank ID.
  - `$7E:0E4D`: Currently requested music track ID.
  - `$7E:0E51`: APU transfer recursion / active depth counter.
  - `$7E:0E65`: APU mutex / lock flag.

---

## 1. Architectural Architecture & SPC700 Protocol

The SNES main 65816 CPU communicates with the dedicated SPC700 sound coprocessor across four 8-bit bidirectional I/O ports (`$2140`–`$2143`).

### Handshake Protocol (`$8C:81FD`)
1. **Interrupt Lock**: Disables interrupts via `SEI` to prevent NMI / VBLANK handlers from interleaving commands.
2. **Acknowledgment Spinlock**:
   - The CPU reads expected sequence counter DP `$9F`.
   - Spins on `$2142` checking against DP `$9F` for up to `0x2800` (10,240) loop iterations.
   - If the SPC700 acknowledges within the timeout, the CPU increments DP `$9F` (skipping zero).
   - If timeout occurs, the CPU recovers by reading the current value at `$2142` directly, incrementing it, and updating DP `$9F`.
3. **Atomic 16-Bit Writes**:
   - Writes 16-bit payload (from Y) into `$2140` and `$2141`.
   - Writes 16-bit command + sequence tag (from A) into `$2142` and `$2143`.
4. **Lock Release**: Restores original processor status register (`PLP`).

---

## 2. Disassembly & Annotations

### Part 1: APU Command Spinlock Handshake (`$8C:81FD`)
> **Interactive 65816 Assembly**:
> Centralized comments infused at runtime.
> [View in VFS: soe://rom/code/8C81FD](soe://rom/code/8C81FD?asm=1&c=0)


### Part 2: Soundbank Loader (`$8C:8236`)
> **Interactive 65816 Assembly**:
> Centralized comments infused at runtime.
> [View in VFS: soe://rom/code/8C81FD](soe://rom/code/8C81FD?asm=1&c=0)


### Part 3: Music Track Player (`$8C:828F`)
> **Interactive 65816 Assembly**:
> Centralized comments infused at runtime.
> [View in VFS: soe://rom/code/8C81FD](soe://rom/code/8C81FD?asm=1&c=0)


---

## 3. Reconstructed Clean C Implementation

> **Reconstructed C Decompilation**:
> Source moved to [`reconstructed-c/8C/8C81FD_spc_handshake.c`](../../../reconstructed-c/8C/8C81FD_spc_handshake.c).
> [View in VFS: soe://rom/code/8C81FD](soe://rom/code/8C81FD?c=1&asm=0)


