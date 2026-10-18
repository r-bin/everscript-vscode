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
```assembly
; ==============================================================================
; apu_command_handshake ($8C:81FD)
; Input:
;   Y = 16-bit payload parameter (written to ports $2140 / $2141)
;   A = 16-bit command ID in high byte / exchange register
; ==============================================================================
$8C81FD  08          PHP               ; Save caller interrupt flag
$8C81FE  78          SEI               ; Disable interrupts
$8C81FF  E2 20       SEP #$20          ; 8-bit Accumulator
$8C8201  C2 10       REP #$10          ; 16-bit Index
$8C8203  DA          PHX               ; Preserve caller X
$8C8204  AE 65 0E    LDX $0E65         ; Check APU lock
$8C8207  9C 65 0E    STZ $0E65         ; Clear lock
$8C820A  DA          PHX               ; Save previous lock state
$8C820B  EE 51 0E    INC $0E51         ; Transfer depth count++
$8C820E  EB          XBA               ; Swap command byte to A
$8C820F  A2 00 28    LDX #$2800        ; Spinlock timeout = 10,240 cycles

; Spin on Acknowledgment:
$8C8212  A5 9F       LDA $9F           ; Expected sequence counter
$8C8214  CD 42 21    CMP $2142         ; Check if SPC700 echoed sequence
$8C8217  F0 06       BEQ $8C821F       ; Matched! Proceed to next sequence
$8C8219  CA          DEX
$8C821A  D0 F8       BNE $8C8214       ; Loop until timeout

; Timeout Fallback:
$8C821C  AD 42 21    LDA $2142         ; Re-synchronize to APU's current state

$8C821F  1A          INC A             ; Advance sequence tag
$8C8220  F0 FD       BEQ $8C821F       ; 0 is sentinel, skip to 1
$8C8222  85 9F       STA $9F           ; DP $9F = new sequence counter
$8C8224  C2 30       REP #$30          ; 16-bit A/X
$8C8226  8C 40 21    STY $2140         ; Write 16-bit payload ($2140-$2141)
$8C8229  8D 42 21    STA $2142         ; Write command + sequence tag ($2142-$2143)
$8C822C  CE 51 0E    DEC $0E51         ; Transfer depth count--
$8C822F  FA          PLX               ; Restore original lock state
$8C8230  8E 65 0E    STX $0E65
$8C8233  FA          PLX               ; Restore caller X
$8C8234  28          PLP               ; Restore interrupts
$8C8235  6B          RTL
```

### Part 2: Soundbank Loader (`$8C:8236`)
```assembly
; ==============================================================================
; load_song_soundbank ($8C:8236)
; Input: A = requested instrument soundbank ID
; Checks if already resident in SPC700 RAM ($0E4B); uploads if changed.
; ==============================================================================
$8C8236  C2 30       REP #$30
$8C8238  AE 4B 0E    LDX $0E4B         ; Current resident soundbank
$8C823B  AA          TAX
$8C823C  F0 50       BEQ $8C828E       ; If 0, skip
$8C823E  29 FF 00    AND #$00FF
$8C8241  CD 4B 0E    CMP $0E4B         ; Is requested soundbank already loaded?
$8C8244  F0 48       BEQ $8C828E       ; Yes -> no reload needed!

$8C8246  8D 4B 0E    STA $0E4B         ; Save new bank ID to $0E4B
$8C8249  AD 4B 0E    LDA $0E4B
$8C824C  0A          ASL A
$8C824D  18          CLC
$8C824E  6D 4B 0E    ADC $0E4B         ; Offset = bank * 3
$8C8251  AA          TAX
$8C8252  BF 03 99 81 LDA $819903,X     ; Read soundbank ROM pointer low word
$8C8256  48          PHA
$8C8257  BF 05 99 81 LDA $819905,X     ; Read soundbank ROM pointer bank byte
$8C825B  29 FF 00    AND #$00FF
$8C825E  48          PHA

$8C825F  AD 4B 0E    LDA $0E4B
$8C8262  EB          XBA
$8C8263  0D 4B 0E    ORA $0E4B
$8C8266  8D 4B 0E    STA $0E4B
$8C8269  29 FF 00    AND #$00FF
$8C826C  A9 0E 00    LDA #$000E        ; Command 0x0E: prepare APU for sample upload
$8C826F  22 FD 81 8C JSL $8C81FD       ; APU handshake
$8C8273  68          PLA
$8C8274  FA          PLX
$8C8275  20 5B 80    JSR $805B         ; Stream soundbank data into SPC700 RAM
$8C8278  20 D4 81    JSR $81D4
$8C827B  A9 02 00    LDA #$0002        ; Command 0x02: finalize soundbank init
$8C827E  22 FD 81 8C JSL $8C81FD       ; APU handshake
$8C8282  20 D4 81    JSR $81D4
$8C8285  AD 4B 0E    LDA $0E4B
$8C8288  29 FF 00    AND #$00FF
$8C828B  8D 4B 0E    STA $0E4B
$8C828E  6B          RTL
```

### Part 3: Music Track Player (`$8C:828F`)
```assembly
; ==============================================================================
; play_music_track ($8C:828F)
; Input: A = music sequence ID
; ==============================================================================
$8C828F  C2 30       REP #$30
$8C8291  8D 4D 0E    STA $0E4D         ; $0E4D = requested song ID
$8C8294  A9 1C 00    LDA #$001C        ; Command 0x1C: configure volume / stereo pan
$8C8297  A0 80 80    LDY #$8080        ; Payload = 0x8080 (balanced default)
$8C829A  22 FD 81 8C JSL $8C81FD
$8C829E  A9 1A 00    LDA #$001A        ; Command 0x1A: stop previous music sequence
$8C82A1  A0 00 00    LDY #$0000
$8C82A4  22 FD 81 8C JSL $8C81FD

; Lookup Soundbank metadata from $81:9900:
$8C82A8  AF 00 99 81 LDA $819900       ; Read number of soundbanks
$8C82AC  29 FF 00    AND #$00FF
$8C82AF  1A          INC A
$8C82B0  85 A0       STA $A0
$8C82B2  0A          ASL A
$8C82B3  18          CLC
$8C82B4  65 A0       ADC $A0           ; Offset = 3 * (count + 1)
$8C82B6  18          CLC
$8C82B7  69 03 99    ADC #$9903
$8C82BA  18          CLC
$8C82BB  6D 4D 0E    ADC $0E4D         ; Add song ID
$8C82BE  85 A0       STA $A0
$8C82C0  E2 20       SEP #$20
$8C82C2  A9 81       LDA #$81
$8C82C4  85 A2       STA $A2           ; DP $A0..$A2 = 24-bit pointer $81:xxxx
$8C82C6  C2 20       REP #$20
$8C82C8  A7 A0       LDA [$A0]         ; Read required soundbank ID
$8C82CA  29 FF 00    AND #$00FF
$8C82CD  22 36 82 8C JSL $8C8236       ; Load soundbank if not already resident
$8C82D1  AC 4D 0E    LDY $0E4D         ; Payload = song ID
$8C82D4  A9 06 00    LDA #$0006        ; Command 0x06: start music playback!
$8C82D7  22 FD 81 8C JSL $8C81FD
$8C82DB  6B          RTL
```

---

## 3. Reconstructed Clean C Implementation

```c
#include <stdint.h>
#include <stdbool.h>

#define APU_TIMEOUT_CYCLES  10240

// Memory-Mapped SNES Hardware I/O Ports
typedef struct {
    volatile uint8_t port0; // 0x2140: Payload Low
    volatile uint8_t port1; // 0x2141: Payload High
    volatile uint8_t port2; // 0x2142: Command ID
    volatile uint8_t port3; // 0x2143: Sequence Tag Echo
} SnesApuPorts;

typedef struct {
    uint8_t  seq_counter;     // DP $9F: Active sequence tag
    uint16_t resident_bank;   // $7E:0E4B: Currently resident instrument soundbank
    uint16_t current_song;    // $7E:0E4D: Currently playing music track
    uint16_t transfer_depth;  // $7E:0E51: Transfer nesting depth
    uint16_t lock_flag;       // $7E:0E65: Queue mutex lock
} AudioSystemContext;

extern volatile SnesApuPorts g_apu_io;
extern AudioSystemContext    g_audio_ctx;
extern const uint8_t         g_rom[0x400000];

extern void spc700_upload_block(uint32_t rom_addr);

/**
 * Sends a command packet to the SPC700 sound processor with spinlock handshake.
 * Corresponds to $8C:81FD.
 */
void apu_send_command(uint8_t cmd, uint16_t payload) {
    g_audio_ctx.lock_flag = 0;
    g_audio_ctx.transfer_depth++;

    // Spin wait for APU to echo current sequence tag
    uint32_t timeout = APU_TIMEOUT_CYCLES;
    while (g_apu_io.port2 != g_audio_ctx.seq_counter) {
        if (--timeout == 0) {
            // Recover from desync: resync with APU's current state
            g_audio_ctx.seq_counter = g_apu_io.port2;
            break;
        }
    }

    // Advance sequence counter (1..255, skipping 0)
    g_audio_ctx.seq_counter++;
    if (g_audio_ctx.seq_counter == 0) {
        g_audio_ctx.seq_counter = 1;
    }

    // Atomic payload and command write
    g_apu_io.port0 = (uint8_t)(payload & 0xFF);
    g_apu_io.port1 = (uint8_t)(payload >> 8);
    g_apu_io.port2 = cmd;
    g_apu_io.port3 = g_audio_ctx.seq_counter;

    g_audio_ctx.transfer_depth--;
}

/**
 * Ensures the required instrument soundbank is resident in SPC700 RAM.
 * Corresponds to $8C:8236.
 */
void load_song_soundbank(uint8_t bank_id) {
    if (bank_id == 0 || bank_id == (g_audio_ctx.resident_bank & 0xFF)) {
        return; // Already resident
    }

    g_audio_ctx.resident_bank = bank_id;

    // Read 24-bit soundbank pointer from ROM table $81:9903
    uint32_t table_offset = 0x019903 + (uint32_t)bank_id * 3;
    uint32_t bank_addr = (uint32_t)g_rom[table_offset] |
                         ((uint32_t)g_rom[table_offset + 1] << 8) |
                         ((uint32_t)g_rom[table_offset + 2] << 16);

    // Command 0x0E: prepare APU for stream
    apu_send_command(0x0E, 0);

    // Upload soundbank samples to SPC700
    spc700_upload_block(bank_addr);

    // Command 0x02: finalize soundbank setup
    apu_send_command(0x02, 0);
}

/**
 * Sets up master volume, validates soundbank, and starts song playback.
 * Corresponds to $8C:828F.
 */
void play_music_track(uint16_t song_id) {
    g_audio_ctx.current_song = song_id;

    // Command 0x1C: Master Volume / Stereo Pan (0x8080 = balanced centered default)
    apu_send_command(0x1C, 0x8080);

    // Command 0x1A: Stop previous track
    apu_send_command(0x1A, 0x0000);

    // Look up required soundbank from ROM table $81:9900
    uint8_t bank_count = g_rom[0x019900];
    uint32_t meta_offset = 0x019903 + 3 * (bank_count + 1) + song_id;
    uint8_t required_bank = g_rom[meta_offset];

    load_song_soundbank(required_bank);

    // Command 0x06: Trigger track playback
    apu_send_command(0x06, song_id);
}
```

