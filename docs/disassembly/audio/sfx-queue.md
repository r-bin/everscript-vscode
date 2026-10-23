# Sound Effect Dispatcher & APU Command Queue

> **ROM Bank**: `$8C` (Audio IPC & Driver Interface), `$81` (Soundbank Table `$81:9900`)  
> **Source Routines**: `$8C:82DC` (`play_sound_effect_direct`), `$8C:82E3` (`play_sound_effect_with_package`), `$8C:831D` (`apu_send_sfx_command`)  
> **Related Routines**: `$8C:81FD` (APU handshake & spinlock), `$8C:8236` (Song soundbank loader), `$8C:D6A7` (Script opcode 0x30/0x31/0x32 sound triggers), `$8C:8362` (SFX index table)  
> **Hardware Registers**: `$2140`–`$2143` (APU Communication Ports 0–3)  
> **Memory Map**: `$0E4F` (Active SFX parameter register), `$00A0`–`$00A2` (Direct page pointer to soundbank table)

---

## 1. Architectural Overview

The audio engine of *Secret of Evermore* runs on the dedicated Sony SPC700 audio coprocessor and 64 KB of audio RAM (ARAM). Communication between the 65816 main CPU and the SPC700 occurs exclusively across four 8-bit bidirectional I/O ports (`$2140`–`$2143`).

### Key Subsystems:
1. **Direct Sound Effect Trigger (`$8C:82DC`)**:
   - Used when a sound effect's BRR samples and ADSR envelopes are already resident in ARAM (common shared effects like sword slashes, menu bleeps, footsteps, and dog barks).
   - The sound effect ID is loaded into accumulator `A`, stored into WRAM register `$0E4F`, and immediately forwarded to `$8C:831D`.
2. **Soundbank Package Validation & Loading (`$8C:82E3`)**:
   - When triggering a specialized environment or monster effect whose sample package might not be loaded, the CPU inspects the master soundbank catalog at `$81:9900`.
   - The engine computes the soundbank table offset, reads the bank package ID, and calls `$8C:8236` to upload the missing BRR sample chunk to the SPC700 before firing the sound command.
3. **APU IPC Handshake Protocol (`$8C:831D` & `$8C:81FD`)**:
   - The engine sets register `Y` to the sound effect descriptor in `$0E4F`.
   - Accumulator `A` is loaded with command byte `0x0004` (SPC700 SFX trigger command).
   - Jumps to the APU spinlock handshake `$8C:81FD`:
     - Writes the command to port `$2140` and parameter to `$2141`–`$2142`.
     - Polls port `$2140` until the SPC700 driver acknowledges receipt by echoing back the sequence counter.
4. **Voice Channel Allocation (SPC700 Driver)**:
   - The SPC700 sound driver allocates voices dynamically across its 8 hardware channels:
     - **Channels 0–3**: Dedicated to music background tracks (melody, harmony, bass, rhythm).
     - **Channels 4–7**: Dedicated to dynamic sound effects. If all 4 SFX channels are occupied, higher-priority combat and UI sounds preempt lower-priority ambient effects.

---

## 2. 65816 Assembly Implementation

> **Interactive 65816 Assembly**:
> Centralized comments infused at runtime.
> [View in VFS: soe://rom/code/819900](soe://rom/code/819900?asm=1&c=0)


---

## 3. Clean C Decompilation

> **Reconstructed C Decompilation**:
> Source moved to [`reconstructed-c/81/819900_sfx_queue.c`](../../../reconstructed-c/81/819900_sfx_queue.c).
> [View in VFS: soe://rom/code/819900](soe://rom/code/819900?c=1&asm=0)

