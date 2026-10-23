# Sound Effect Priority Dispatcher & Spatial 3D Panning

**Addresses**:
- `apu_command_send_sync`: `$8C:81FD` – `$8C:8235`
- `music_track_switch_load`: `$8C:8236` – `$8C:828E`
- `music_play_song`: `$8C:828F` – `$8C:82B6`
- `sfx_play_dispatch`: `$8C:82DC` – `$8C:8327`
- `audio_spatial_panning_and_attenuation`: `$8C:8590` – `$8C:85EC`

**ROM Source**: Bank `$8C` (US 1.0)
**Subsystem**: Audio Subsystem / SPC700 Inter-Processor Communication

---

## 1. Overview & Architectural Role

The Secret of Evermore audio driver implements inter-processor communication between the 65c816 CPU and the Sony SPC700 audio coprocessor via memory-mapped I/O ports `$2140`–`$2143`.

Key architectural components:
1. **Synchronous Sequence-Numbered Handshake (`apu_command_send_sync`)**:
   Prevents lost audio packets by managing an incrementing 8-bit handshake sequence counter in DP `$9F`. Before writing, it polls `$2142` with a 10,240-iteration countdown loop (`LDX #$2800`) to guarantee the SPC700 processed the prior command.
2. **SFX Play Dispatcher (`sfx_play_dispatch`)**:
   Accepts sound effect IDs, evaluates whether sample bank switching is required via master audio header table at `$81:9900`, and issues APU command `0x04` with sound effect ID in port `$2140`.
3. **Spatial 3D Panning & Distance Attenuation (`audio_spatial_panning_and_attenuation`)**:
   Calculates realistic screen-space stereo panning and volume falloff for positional sound effects (explosions, enemy roars, spell hits). It measures Euclidean $\Delta X$ and $\Delta Y$ from screen center (`Camera X + 0x80`, `Camera Y + 0x70`), looks up precomputed squared components via ROM table `$80:AA27`, computes distance using square root routine `$80:AC27`, maps distance to attenuation via `$8C:84D4`, and sends stereo volume commands (`0x0036`) to the SPC700.

---

## 2. Data Structures & ROM Tables

> **Reconstructed C Decompilation**:
> Source moved to [`reconstructed-c/8C/8C81FD_sfx_arbitration.c`](../../../reconstructed-c/8C/8C81FD_sfx_arbitration.c).
> [View in VFS: soe://rom/code/8C81FD](soe://rom/code/8C81FD?c=1&asm=0)


---

## 3. Clean C Decompilation

> **Reconstructed C Decompilation**:
> Source moved to [`reconstructed-c/8C/8C81FD_sfx_arbitration.c`](../../../reconstructed-c/8C/8C81FD_sfx_arbitration.c).
> [View in VFS: soe://rom/code/8C81FD](soe://rom/code/8C81FD?c=1&asm=0)


---

## 4. Verification & Behavioral Equivalence

1. **APU Port Protocol**: Fully conforms to the SNES APU 4-port handshake specification. Port `$2140`/`$2141` payload and Port `$2142`/`$2143` command/sequence pairing matches assembly `$8C:8226` (`STY $2140`) and `$8C:8229` (`STA $2142`).
2. **Positional Center**: Matches assembly `$8C:8592` (`ADC #$0070` for vertical center) and `$8C:85A7` (`ADC #$0080` for horizontal center).
3. **Distance Cutoff**: Verified against cutoff `$8C:85C3` (`CMP #$3F01`), zeroing volume when entities move beyond screen boundary.

