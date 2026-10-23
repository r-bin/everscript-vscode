# Dynamic Sound Bank Streaming & SPC700 IPL Bootloader Handshake

**Addresses**:
- `spc_soundbank_load_and_ipl_stream`: `$8C:8236` – `$8C:828E`
- `music_play_song_with_soundbank`: `$8C:828F` – `$8C:82DB`
- `sfx_play_with_bank_switch`: `$8C:82E3` – `$8C:8327`

**ROM Source**: Bank `$8C` (US 1.0)
**Subsystem**: Audio Subsystem / SPC700 Sample Streamer

---

## 1. Overview & Architectural Role

The Secret of Evermore audio architecture dynamically reloads BRR (Bit Rate Reduction) instrument sample banks into SPC700 RAM when switching between environmental background tracks or casting complex spells that require unique sound effects.

Key mechanisms:
1. **Cache Verification (`spc_soundbank_load_and_ipl_stream`)**:
   Before initiating an expensive transfer, the engine compares the requested soundbank identifier against `$7E:0E4B`. If the soundbank is already resident in SPC700 RAM, the function returns immediately.
2. **Master Audio Header Indexing (`$81:9900`)**:
   Song track and sound effect records in ROM point to master entries in Bank `$81`. Each entry provides a 3-byte descriptor (`$81:9903,X` low word, `$81:9905,X` bank byte) pointing directly to the compressed BRR sample block.
3. **IPL Handshake & Upload Protocol**:
   - Sends APU command `0x000E` to prime the SPC700 IPL bootloader.
   - Invokes `spc700_ipl_bootloader_handshake_block` (`$8C:805B`) to stream sample bytes across ports `$2140`–`$2141`.
   - Waits for acknowledgment with timeout loop `$8C:81D4`.
   - Sends confirmation command `0x0002` to finalize the transfer and resume the audio engine.
   - Sends command `0x0006` with the track ID in port `$2140` to begin playback.

---

## 2. Data Structures & Memory Layout

> **Reconstructed C Decompilation**:
> Source moved to [`reconstructed-c/8C/8C8236_soundbank_streamer.c`](../../../reconstructed-c/8C/8C8236_soundbank_streamer.c).
> [View in VFS: soe://rom/code/8C8236](soe://rom/code/8C8236?c=1&asm=0)


---

## 3. Clean C Decompilation

> **Reconstructed C Decompilation**:
> Source moved to [`reconstructed-c/8C/8C8236_soundbank_streamer.c`](../../../reconstructed-c/8C/8C8236_soundbank_streamer.c).
> [View in VFS: soe://rom/code/8C8236](soe://rom/code/8C8236?c=1&asm=0)


---

## 4. Verification & Behavioral Equivalence

1. **Cache Verification**: Matches assembly `$8C:8241` (`CMP $0E4B; BEQ $828E`), preventing redundant sample uploads.
2. **Master Table Arithmetic**: Reconstructs formula `(count + 1) * 3 + 0x9903` from `$8C:82AF`–`$8C:82B7`.
3. **APU Command Protocol**: Uses APU command `0x000E` (upload start), `0x0002` (upload finalize), and `0x0006` (play track) with sequence handshakes.
