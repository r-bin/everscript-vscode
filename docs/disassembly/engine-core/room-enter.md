# Room Enter & Screen Fade Disassembly & Decompilation

- **ROM Location**: Bank `$8E` (`$8E:E4E2` – `$8E:E566`)
- **Primary Function**: `enter_room` (`$8E:E4E2`)
- **Per-Room State Reset**: `reset_per_room_state` (`$90:8E90`)
- **Enter Script Dispatch**: `script_start_room_enter_script` (`$8C:CE99`)
- **Called by**: `main_loop_entry` (`$80:8B66`) at cold boot and upon room transition (`$80:8C7F`)

---

## 1. Architectural Role

When Secret of Evermore transitions between rooms (or boots into the first room), the engine executes `enter_room` (`$8E:E4E2`):

1. **Stop Audio & Fade Sound**: Dispatches APU commands `$001A` and `$001C` across the `$2140` communication ports via `$8C:81FD`.
2. **Reset Per-Room WRAM**: Invokes `reset_per_room_state` (`$90:8E90`), which zeroes transient screen shake, camera offsets, collision structures, and trigger lines, while setting the VRAM safety lock `$7E:0F3A`.
3. **Lookup & Launch Enter Script**: Calls `script_start_room_enter_script` (`$8C:CE99`), which reads the 5-byte room table entry at `$92:801B + (room_id * 5)`, allocates a Script VM thread slot, and queues the enter script.
4. **Pre-Roll Frames Loop**: Executes field frames (`$8E:E41E`) until system flags `$7E:22EA` bits 3, 4, and 5 (`0x0008`, `0x0010`, `0x0020`) are asserted. These bits signal that:
   - Bit 3 (`0x0008`): Metatiles and collision grid are decompressed and loaded.
   - Bit 4 (`0x0010`): Character entity records (Boy and Dog) are spawned into their initial coordinates.
   - Bit 5 (`0x0020`): Palette fade-in is initialized and the screen is ready to unblank.
5. **Entity Script Dispatch**: If player/companion start flags are set in `$05A9`, dispatches their default behavior scripts via `$8E:A091`.
6. **Collision & Camera Finalization**: Calls `$8E:E592` to compute initial camera focus and returns to the main loop.

---

## 2. Disassembly & Annotations

### Part 1: Audio Silence & Subsystem Invocation (`$8E:E4E2`)
```assembly
; ==============================================================================
; enter_room ($8E:E4E2)
; Prepares sound, resets room state, starts enter script, runs setup frames.
; ==============================================================================
$8E:E4E2  58           CLI             ; Ensure interrupts are unmasked
$8E:E4E3  A9 1A 00     LDA #$001A      ; APU Command $1A: Stop current music track
$8E:E4E6  A0 00 00     LDY #$0000
$8E:E4E9  22 FD 81 8C  JSL $8C81FD     ; APU Handshake via $2140 spinlock

$8E:E4ED  A0 00 80     LDY #$8000
$8E:E4F0  A9 1C 00     LDA #$001C      ; APU Command $1C: Fade out sound effects
$8E:E4F3  22 FD 81 8C  JSL $8C81FD

$8E:E4F7  22 90 8E 90  JSL $908E90     ; Reset per-room state (camera, collision, scratch)
$8E:E4FB  22 99 CE 8C  JSL $8CCE99     ; Start room enter script ($92:801B + 5 * map)

$8E:E4FF  A9 74 30     LDA #$3074
$8E:E502  8D 57 0B     STA $0B57       ; Initialize room timer
$8E:E505  EE 77 0B     INC $0B77       ; Increment room transition counter
```

### Part 2: Spawning Boy and Dog Default Scripts
```assembly
; ==============================================================================
; Check Player (Boy) Start Script Flag ($05A9 Bit 1)
; ==============================================================================
$8E:E508  A9 02 00     LDA #$0002      ; Test and reset Bit 1 (Player spawn requested)
$8E:E50B  1C A9 05     TRB $05A9
$8E:E50E  F0 17        BEQ $8E:E527    ; If not set, check Dog

$8E:E510  A9 99 8E     LDA #$8E99
$8E:E513  85 98        STA $98
$8E:E515  A9 8C 99     LDA #$998C
$8E:E518  85 97        STA $97
$8E:E51A  A9 89 4E     LDA #$4E89      ; Script address for Boy initialization
$8E:E51D  8D A7 05     STA $05A7
$8E:E520  22 91 A0 8E  JSL $8EA091     ; Spawn script thread for Boy
$8E:E524  4C 43 E5     JMP $8EE543

; ==============================================================================
; Check Companion (Dog) Start Script Flag ($05A9 Bit 2)
; ==============================================================================
$8E:E527  A9 04 00     LDA #$0004      ; Test and reset Bit 2 (Dog spawn requested)
$8E:E52A  1C A9 05     TRB $05A9
$8E:E52D  F0 14        BEQ $8E:E543    ; If not set, advance to frame tick

$8E:E52F  A9 99 8E     LDA #$8E99
$8E:E532  85 98        STA $98
$8E:E534  A9 98 99     LDA #$9998
$8E:E537  85 97        STA $97
$8E:E539  A9 37 4F     LDA #$4F37      ; Script address for Dog initialization
$8E:E53C  8D A7 05     STA $05A7
$8E:E53F  22 91 A0 8E  JSL $8EA091     ; Spawn script thread for Dog
```

### Part 3: Frame Advance Loop Until Ready (`$8E:E543` – `$8E:E566`)
```assembly
; ==============================================================================
; Run Frames Until Room Subsystems Are Loaded
; ==============================================================================
$8E:E543  22 1E E4 8E  JSL $8EE41E     ; Run 1 frame field tick (physics, script VM turn)

$8E:E547  AF EA 22 7E  LDA $7E22EA     ; Check system state flags
$8E:E54B  89 08 00     BIT #$0008      ; Bit 3: Map metatiles & collision loaded?
$8E:E54E  F0 17        BEQ $8EE567     ; If not ready, continue frame loop

$8E:E550  AF EA 22 7E  LDA $7E22EA
$8E:E554  89 10 00     BIT #$0010      ; Bit 4: Character entities positioned?
$8E:E557  F0 0E        BEQ $8EE567

$8E:E559  AF EA 22 7E  LDA $7E22EA
$8E:E55D  89 20 00     BIT #$0020      ; Bit 5: Palette fade initialized?
$8E:E560  F0 05        BEQ $8EE567

; All 3 flags asserted: Room is fully ready!
$8E:E562  22 92 E5 8E  JSL $8EE592     ; Initialize camera focus and collision vectors
$8E:E566  6B           RTL             ; Return to Main Loop!

$8E:E567  4C 08 E5     JMP $8EE508     ; Repeat pre-roll loop
```

---

## 3. Disassembly of `reset_per_room_state` (`$90:8E90`)

```assembly
; ==============================================================================
; reset_per_room_state ($90:8E90)
; ==============================================================================
$90:8E90  8B           PHB
$90:8E91  4B           PHK
$90:8E92  AB           PLB             ; Set Data Bank = $90
$90:8E93  22 07 85 80  JSL $808507     ; Enable NMI and auto-joypad ($4200 = $81)
$90:8E97  22 95 97 91  JSL $919795     ; Clear entity collision grid lists
$90:8E9B  22 29 B2 8F  JSL $8FB229     ; Clear step-on trigger line tables

; Clear screen shake & transient counters:
$90:8E9F  9C 3A 14     STZ $143A
$90:8EA2  9C CC 15     STZ $15CC
$90:8EA5  64 C3        STZ $C3         ; Direct Page screen shake flags
$90:8EA7  64 C5        STZ $C5
$90:8EA9  64 C7        STZ $C7
$90:8EAB  64 C9        STZ $C9
$90:8EAD  9C E4 14     STZ $14E4
$90:8EB0  9C 38 0F     STZ $0F38

; Set default camera deadzones & speeds:
$90:8EB3  A9 06 00     LDA #$0006
$90:8EB6  8D 76 10     STA $1076
$90:8EB9  A9 11 00     LDA #$0011
$90:8EBC  8D AC 0F     STA $0FAC
$90:8EBF  A9 48 00     LDA #$0048      ; Camera horizontal lead margin (72 px)
$90:8EC2  8F 0F 24 7E  STA $7E240F
$90:8EC6  A9 48 00     LDA #$0048
$90:8EC9  8F 11 24 7E  STA $7E2411
$90:8ECD  A9 68 00     LDA #$0068      ; Camera vertical lead margin (104 px)
$90:8ED0  8F 13 24 7E  STA $7E2413
$90:8ED4  A9 38 00     LDA #$0038      ; Camera vertical lower margin (56 px)
$90:8ED7  8F 15 24 7E  STA $7E2415
$90:8EDB  A9 80 00     LDA #$0080      ; Camera tracking speed
$90:8EDE  8F 2F 24 7E  STA $7E242F
$90:8EE2  A9 15 00     LDA #$0015
$90:8EE5  8F 35 24 7E  STA $7E2435

; Reset camera target coordinates to -1 ($FFFF) so it locks onto player $0F42:
$90:8F14  A9 FF FF     LDA #$FFFF
$90:8F17  8F 2B 24 7E  STA $7E242B     ; Camera target X = -1
$90:8F1B  8F 2D 24 7E  STA $7E242D     ; Camera target Y = -1

; Engage VRAM upload lock during room loading:
$90:8F33  EE 3A 0F     INC $0F3A       ; Increment $7E:0F3A (NMI skips VRAM uploads)
$90:8F36  EE 3C 0F     INC $0F3C

; Read room metatile dimensions from table $9F:FDE7 + (room_id * 4):
$90:8F63  AD DB 0A     LDA $0ADB       ; Read current room ID
$90:8F66  0A           ASL A           ; Multiply room ID by 4
$90:8F67  0A           ASL A
$90:8F68  AA           TAX
$90:8F69  BF E7 FD 9F  LDA $9FFDE7,X   ; Read pointer to room metatile record
$90:8F6D  85 8B        STA $8B
$90:8F6F  BF E8 FD 9F  LDA $9FFDE8,X
$90:8F73  85 8C        STA $8C
$90:8F77  A9 7F        LDA #$7F        ; Bank $7F
$90:8F79  85 58        STA $58

$90:8F7D  A0 00 00     LDY #$0000
$90:8F80  B7 8B        LDA [$8B],Y     ; Read room width (in 16x16 metatiles)
$90:8F83  29 FF 00     AND #$00FF
$90:8F86  8D 86 0F     STA $0F86       ; Store room width ($7E:0F86)
$90:8F9B  0A           ASL A           ; width * 2
$90:8F9C  8D 46 0F     STA $0F46
$90:8F9F  0A           ASL A
$90:8FA0  0A           ASL A
$90:8FA1  0A           ASL A           ; width * 16 (stride in bytes)
$90:8FA2  8F ED 23 7E  STA $7E23ED

$90:8F89  B7 8B        LDA [$8B],Y     ; Read room height
$90:8F8F  8D 88 0F     STA $0F88       ; Store room height ($7E:0F88)
```

---

## 4. Reconstructed C Decompilation

```c
#include <stdint.h>
#include <stdbool.h>

extern uint16_t g_current_room_id;     /* $7E:0ADB */
extern uint16_t g_system_state_flags;  /* $7E:22EA */
extern uint16_t g_spawn_script_flags;  /* $7E:05A9 */
extern uint16_t g_room_timer_0b57;     /* $7E:0B57 */
extern uint16_t g_room_counter_0b77;   /* $7E:0B77 */
extern uint16_t g_vram_queue_lock;     /* $7E:0F3A */
extern uint16_t g_room_width;          /* $7E:0F86 */
extern uint16_t g_room_height;         /* $7E:0F88 */
extern int16_t  g_camera_target_x;     /* $7E:242B */
extern int16_t  g_camera_target_y;     /* $7E:242D */

void apu_handshake_spinlock(uint16_t command);
void reset_per_room_state(void);
void script_start_room_enter_script(uint16_t room_id);
void spawn_script_thread(uint32_t script_ptr);
void run_single_frame_tick(void);
void init_camera_and_collision(void);

/**
 * Resets per-room state, initializes camera margins, locks VRAM uploads,
 * and extracts room dimensions from ROM table $9F:FDE7.
 */
void reset_per_room_state(void) {
    /* 1. Reset collision grid and trigger boundaries */
    clear_collision_grid();       /* $91:9795 */
    clear_step_on_triggers();     /* $8F:B229 */

    /* 2. Clear screen shake and transient animation state */
    clear_screen_shake();

    /* 3. Configure camera deadzones and tracking speeds */
    set_camera_deadzones(72, 72, 104, 56);
    set_camera_speed(0x0080, 0x0015);

    /* 4. Force camera target to follow active player entity */
    g_camera_target_x = -1;
    g_camera_target_y = -1;

    /* 5. Lock VRAM upload queue during room decompression */
    g_vram_queue_lock++;

    /* 6. Look up room metatile dimensions from ROM table $9F:FDE7 */
    const uint8_t *room_table = (const uint8_t *)(0x9F0000 | *(const uint16_t *)(0x9FFDE7 + g_current_room_id * 4));
    g_room_width  = room_table[0];
    g_room_height = room_table[1];
}

/**
 * Primary room enter orchestrator: silences audio, resets room state,
 * kicks off enter scripts, and advances frames until ready to render.
 */
void enter_room(uint16_t room_id) {
    /* 1. Stop audio and fade background sound effects */
    apu_handshake_spinlock(0x001A);
    apu_handshake_spinlock(0x001C);

    /* 2. Reset per-room structures and camera */
    reset_per_room_state();

    /* 3. Look up and trigger room enter script */
    script_start_room_enter_script(room_id);

    /* 4. Reset room frame timer and iteration counter */
    g_room_timer_0b57 = 0x3074;
    g_room_counter_0b77++;

    /* 5. Pre-roll frames until all subsystems (tiles, entities, fade) are ready */
    for (;;) {
        /* Check if player (Boy) spawn script is queued */
        if (g_spawn_script_flags & 0x0002) {
            g_spawn_script_flags &= ~0x0002;
            spawn_script_thread(0x8E994E89);
        }

        /* Check if companion (Dog) spawn script is queued */
        if (g_spawn_script_flags & 0x0004) {
            g_spawn_script_flags &= ~0x0004;
            spawn_script_thread(0x8E994F37);
        }

        /* Advance 1 engine frame tick */
        run_single_frame_tick(); /* $8E:E41E */

        /* Check if room is fully ready (Bits 3, 4, 5 of $7E:22EA must all be set) */
        const uint16_t kReadyMask = (1 << 3) | (1 << 4) | (1 << 5); /* 0x0038 */
        if ((g_system_state_flags & kReadyMask) == kReadyMask) {
            break;
        }
    }

    /* 6. Compute initial camera coordinates and collision vectors */
    init_camera_and_collision(); /* $8E:E592 */
}
```

