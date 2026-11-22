# Secret of Evermore — SPC700 ARAM Allocation & Soundbank Analysis

> Architectural Study of the 64 KB Sony SPC700 Audio RAM  
> Source Reference: ROM Bank `$8C`, Master Audio Header `$81:9900`, `soe://rom/assets/audio/`  

---

## 1. The 64 KB SPC700 Memory Space

The Sony SPC700 audio coprocessor has access to an isolated 64 KB ($65,536\text{ bytes}$) Audio RAM (ARAM) space. All driver execution, sound effect sequences, instrument BRR samples, echo delay buffers, and background music sequences must coexist inside this 64 KB pool.

### Vanilla ARAM Memory Map (e.g. Song 0x00 *Main Title*)

| Address Range | Size | Allocation Role | Description |
|---|---|---|---|
| `$0000`–`$00FF` | 256 B | **Direct Page (Zero Page)** | Fast-access driver variables, timers, voice volume tracking, command buffers. |
| `$0100`–`$01FF` | 256 B | **Hardware Stack** | SPC700 call stack. |
| `$0200`–`$021F` | 32 B | **APU Communication Ports** | In-RAM shadows and queue tracking for hardware ports `$2140`–`$2143`. |
| `$0220`–`$06FF` | 1,248 B | **Scratch / Dynamic Echo** | DSP echo buffer and voice modulation tables. |
| `$0700`–`$1EDF` | 6,112 B | **Wolfgang v3 Sound Driver** | Complete executable machine code of the Squaresoft/Square USA audio driver. |
| `$1EE0`–`$2351` | 1,138 B | **Base SFX Descriptors** | Voice allocation and sequence pointers for the 62 permanent base sound effects. |
| `$3AC0`–`$6782` | 11,470 B | **Base SFX Sample Blocks (Pkg $00)** | Compressed BRR audio samples for weapon swings, barks, menus, and impacts. |
| `$1F38`–`$1F4B` | 20 B | **Song Sequence Header** | Pointers to active musical voice sequence bytecode tracks. |
| `$678E`–`$C3A9` | 23,616 B | **Active Song Sample Bank (Pkg $01)** | Musical instrument BRR samples (flutes, strings, drums) + sequence event bytecode. |
| `$C3AA`–`$FFFF` | 15,446 B | **Free ARAM (Unallocated)** | Unused audio memory headroom (varies from 15 KB to 23 KB depending on song). |

---

## 2. The Soundbank Swap Bottleneck

In the vanilla engine:
- The base package (Package `$00`) permanently resides in ARAM and provides **62 sound effects**.
- However, the game contains **71 total sound effects**.
- The remaining 9 sound effects belong to external packages associated with specific maps or bosses:
  - *Water Plop* (SFX `$44`, required by Aquagoth / Gothica waterfall)
  - *Raptor Roar & Screech* (SFX `$45`, `$46`, required by Prehistoric Raptors)
  - *Frippo Swamp Cry* (SFX `$47`, required by Swamplands)
  - *Alarm Horn* (SFX `$48`, required by Omnitopia security)
  - *Carltron Squeak* (SFX `$4E`, required by Carltron final boss)

Because the background music instruments consumed **23,616 bytes** of ARAM, Square's sound engineers could not fit all 71 sound effects into ARAM at the same time.

Whenever a player moved between rooms that required different soundbanks (or cast specific complex alchemy spells), the game executed `spc_soundbank_load_and_ipl_stream` (`$8C:8236`):
1. Pauses game engine execution and disables interrupts (`$4200 = 0`).
2. Sends APU command `0x000E` to prime the SPC700 IPL bootloader.
3. Streams sample bytes sequentially across ports `$2140` and `$2141` in a tight spinlock loop.
4. Waits for acknowledgment via timeout loop `$8C:81D4`.
5. Sends command `0x0002` to finalize the transfer and resumes the DSP.

**Result:** A visible and audible **1 to 3 second freeze** on room transitions.

---

## 3. How MSU-1 Solves the Memory & Latency Problem

When background music is streamed via MSU-1:
1. **23,616 Bytes of ARAM are Immediately Freed:** The SPC700 never needs to hold musical instrument samples or sequence bytecode in ARAM.
2. **Every Sound Effect Fits in ARAM Permanently:**
   $$\text{Total Size of ALL 71 SFX Samples} \approx 14,800\text{ Bytes}$$
   $$\text{Total Driver Size} = 6,112\text{ Bytes}$$
   $$\text{Total Base Space Required} = 20,912\text{ Bytes (out of } 65,536\text{ B)}$$
   With over **44 KB of free space remaining**, every sound effect in the entire game can be uploaded once at boot time into ARAM.
3. **Soundbank Swapping Can Be Completely Eliminated:** Room transitions become instantaneous, with zero CPU/APU transfer stalls.

