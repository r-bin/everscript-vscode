# Main Loop & Frame Scheduler Disassembly & Decompilation

- **ROM Location**: Bank `$80` (`$80:8B66` – `$80:8CC8`)
- **Primary Function**: `main_loop_entry` (`$80:8B66`)
- **Frame Driver**: `wait_for_frame` (`$80:858C`), `run_frame_tasks` (`$80:8F85` / `$80:8F8A`)
- **First Room Load**: Reads initial map ID from ROM table `$92:8002` into `$0ADB` and calls `enter_room` (`$8E:E4E2`).

---

## 1. Architectural Role

The main loop serves two distinct responsibilities:
1. **Cold Boot Orchestration (`$80:8B66` – `$80:8C7F`)**:
   - Validates battery SRAM integrity (`$30:6001`, `$8D:C905`).
   - Handshakes with the SPC700 sound core across the `$2140`–`$2143` audio communication ports (`$8C:81FD`).
   - Configures initial display parameters and palettes.
   - Loads the starting room ID from ROM pointer `$92:8002` (writing `$0ADB`) and calls `enter_room` (`$8E:E4E2`).
2. **Recurring Per-Frame Driver (`$80:8BB5` – `$80:8BF8`)**:
   - Synchronizes execution to the 60 Hz NTSC vertical refresh via `wait_for_frame` (`$80:858C`), which polls the frame counter incremented by NMI.
   - Clears transient per-frame scratch registers.
   - Dispatches entity physics, player control, collision grid tests, dog AI, and the Everscript bytecode VM scheduler.
   - Prepares graphics and OAM buffers for upload during the subsequent VBLANK period.

---

## 2. Disassembly & Annotations

### Part 1: Boot Handshake, Save Verification & Initial State
```assembly
; ==============================================================================
; Main Loop Entry: Reset Handler jumps here via JML $80:8B66
; CPU State: Native 16-bit Mode (REP #$30)
; ==============================================================================
$80:8B66  C2 30        REP #$30        ; 16-bit A, 16-bit Index
$80:8B68  22 9A 8E 80  JSL $808E9A     ; Initialize memory structures
$80:8B6C  AF 01 60 30  LDA $306001     ; Read SRAM save slot header byte
$80:8B70  29 07 00     AND #$0007      ; Mask save slot index (0..3)
$80:8B73  8D 3B 0B     STA $0B3B       ; Store active save slot ($7E0B3B)
$80:8B76  22 05 C9 8D  JSL $8DC905     ; Validate SRAM checksums
$80:8B7A  D0 22        BNE $808B9E     ; If valid save found, skip slot initialization

$80:8B7C  A9 04 00     LDA #$0004
$80:8B7F  0F EA 22 7E  ORA $7E22EA     ; Mark battery SRAM as freshly initialized
$80:8B83  8F EA 22 7E  STA $7E22EA
$80:8B87  A9 01 00     LDA #$0001
$80:8B8A  8F 00 60 30  STA $306000     ; Set save slot magic byte
$80:8B8E  AA           TAX
$80:8B8F  BF A2 59 C4  LDA $C459A2,X   ; Read audio configuration parameter
$80:8B93  29 FF 00     AND #$00FF
$80:8B96  A8           TAY
$80:8B97  A9 16 00     LDA #$0016
$80:8B9A  22 FD 81 8C  JSL $8C81FD     ; APU Handshake: Spinlock on $2140 until SPC700 ready

$80:8B9E  80 11        BRA $808BB1     ; Proceed to first room initialization
```

### Part 2: Starting Room Selection & Enter Room Dispatch
```assembly
$80:8C70  22 92 E5 8E  JSL $8EE592     ; Initialize collision and camera subsystems
$80:8C74  22 C9 8C 80  JSL $808CC9     ; Clear sprite priority buffers
$80:8C78  AF 02 80 92  LDA $928002     ; Read Default Starting Room ID from ROM
$80:8C7C  8D DB 0A     STA $0ADB       ; Store to Current Map ID ($7E0ADB)
$80:8C7F  22 E2 E4 8E  JSL $8EE4E2     ; ENTER ROOM:
                                       ; 1. Stop background sound
                                       ; 2. Reset per-room WRAM ($90:8E90)
                                       ; 3. Look up map enter script ($8C:CE99)
                                       ; 4. Execute frames until screen fade-in ready!

$80:8C83  AF EB 22 7E  LDA $7E22EB
$80:8C87  89 04 00     BIT #$0004
$80:8C8A  F0 0A        BEQ $808C96
$80:8C8C  29 FB FF     AND #$FFFB
$80:8C8F  8F EB 22 7E  STA $7E22EB
$80:8C93  4C B5 8B     JMP $808BB5     ; Jump into main per-frame execution loop!
```

### Part 3: The Per-Frame Update Loop
```assembly
; ==============================================================================
; Top-Level Game Engine Frame Loop ($80:8BB5)
; ==============================================================================
$80:8BB5  22 85 96 80  JSL $809685     ; Entity & sprite position calculation
$80:8BB9  22 8B E0 8E  JSL $8EE08B     ; Fade effects & screen color palette driver
$80:8BBD  A9 10 22     LDA #$2210      ; Source pointer setup for memory blocks
$80:8BC0  85 22        STA $22
$80:8BC2  A9 7E 00     LDA #$007E
$80:8BC5  85 24        STA $24
$80:8BC7  A9 AB 60     LDA #$60AB
$80:8BCA  85 26        STA $26
$80:8BCC  A9 C4 00     LDA #$00C4
$80:8BCF  85 28        STA $28
$80:8BD1  22 49 B1 80  JSL $80B149     ; Copy animation state buffers
$80:8BD5  A9 34 22     LDA #$2234
$80:8BD8  85 22        STA $22
$80:8BDA  A9 7E 00     LDA #$007E
$80:8BDD  85 24        STA $24
$80:8BDF  A9 AD 8C     LDA #$8CAD
$80:8BE2  85 26        STA $26
$80:8BE4  A9 80 00     LDA #$0080
$80:8BE7  85 28        STA $28
$80:8BE9  22 49 B1 80  JSL $80B149     ; Copy sound queue tables
$80:8BED  AF EB 22 7E  LDA $7E22EB     ; Check map transition request flags
$80:8BF1  89 04 00     BIT #$0004
$80:8BF4  F0 03        BEQ $808BF9
$80:8BF6  4C 70 8C     JMP $808C70     ; Handle room change / transition!

; Standard Frame Continuation:
$80:8BF9  AF EA 22 7E  LDA $7E22EA
$80:8BFD  89 04 00     BIT #$0004
$80:8C00  F0 28        BEQ $808C2A
$80:8C02  22 B5 8C 80  JSL $808CB5     ; Update player HUD and alchemy ring menus
$80:8C06  22 00 80 8D  JSL $8D8000     ; Run Script VM turn dispatcher ($8C:CFFD)
$80:8C0A  A9 15 00     LDA #$0015
$80:8C0D  22 8F 82 8C  JSL $8C828F     ; Music driver update
$80:8C11  9C 06 01     STZ $0106       ; Turn screen ON (shadow $0106 = 0, full brightness)
$80:8C14  A9 0F 80     LDA #$800F
$80:8C17  8D 83 0B     STA $0B83
$80:8C1A  A9 10 22     LDA #$2210
$80:8C1D  85 22        STA $22
$80:8C1F  A9 7E 00     LDA #$007E
$80:8C22  85 24        STA $24
$80:8C24  22 CB 82 8D  JSL $8D82CB     ; Queue VRAM tile transfers
$80:8C28  80 46        BRA $808C70
```

### Part 4: Frame Synchronization & Task Flushing (`$80:858C`)
```assembly
; ==============================================================================
; wait_for_frame ($80:858C)
; Spins until the NMI interrupt increments the frame counter at $7E:0100.
; ==============================================================================
$80:858C  AD 00 01     LDA $0100       ; Snapshot current frame counter
$80:858F  CD 00 01     CMP $0100       ; Loop until $0100 changes
$80:8592  F0 FB        BEQ $80858F     ; (Guarantees we begin right after VBLANK)
$80:8594  4C 85 8F     JMP $808F85     ; Run post-VBLANK task reset ($80:8F85)

; ==============================================================================
; run_frame_tasks ($80:8F85 / $80:8F8A)
; Resets per-frame scratch registers and resets DMA write counters.
; ==============================================================================
$80:8F85  A5 D9        LDA $D9
$80:8F87  D0 01        BNE $808F8A
$80:8F89  6B           RTL

$80:8F8A  64 D9        STZ $D9         ; Clear frame VRAM queue ready flag
$80:8F8C  8B           PHB
$80:8F8D  F4 7E 7E     PEA $7E7E       ; Set Data Bank = $7E
$80:8F90  AB           PLB
$80:8F91  AB           PLB
$80:8F92  64 CB        STZ $CB         ; Reset DMA queue write index ($7E:00CB)
$80:8F94  64 CD        STZ $CD         ; Reset auxiliary buffer pointers
$80:8F96  64 CF        STZ $CF
$80:8F98  64 D1        STZ $D1
$80:8F9A  E2 30        SEP #$30
...
$80:8FD0  AB           PLB             ; Restore caller Data Bank
$80:8FD1  6B           RTL
```

---

## 3. Reconstructed C Decompilation

```c
#include <stdint.h>
#include <stdbool.h>

extern uint16_t g_current_room_id;  /* $7E:0ADB */
extern uint16_t g_frame_counter;    /* $7E:0100 */
extern uint16_t g_map_flags_22eb;   /* $7E:22EB */
extern uint16_t g_system_flags_22ea;/* $7E:22EA */
extern uint16_t g_ppu_shadow_0106;  /* $7E:0106 */

void validate_sram_slots(void);
void apu_handshake_spinlock(uint16_t command);
void enter_room(uint16_t room_id);
void entity_physics_update(void);
void screen_fade_driver(void);
void script_vm_scheduler_run_turn(void);
void update_hud_and_rings(void);
void audio_driver_update(void);
void queue_vram_transfers(void);
void post_vblank_frame_reset(void);

void wait_for_frame(void) {
    uint16_t last_frame = g_frame_counter;
    while (g_frame_counter == last_frame) {
        /* Busy-wait until NMI increments $7E:0100 */
    }
    post_vblank_frame_reset(); /* $80:8F85 */
}

void main_loop_entry(void) {
    /* Step 1: Validate SRAM and select active slot */
    validate_sram_slots();

    /* Step 2: Establish handshake with APU / SPC700 */
    apu_handshake_spinlock(0x0016);

    /* Step 3: Read starting room ID from ROM ($92:8002) and execute Enter Room */
    uint16_t initial_room = *(const uint16_t *)0x928002;
    g_current_room_id = initial_room;
    enter_room(g_current_room_id); /* $8E:E4E2 */

    /* Step 4: The Continuous Per-Frame Loop */
    for (;;) {
        /* Sync execution to the start of the next display field */
        wait_for_frame();

        /* Update entities, collision, and animation state */
        entity_physics_update(); /* $80:9685 */
        screen_fade_driver();     /* $8E:E08B */

        /* Check if a room transition or teleport was requested */
        if (g_map_flags_22eb & 0x0004) {
            g_map_flags_22eb &= ~0x0004;
            enter_room(g_current_room_id);
            continue;
        }

        /* Standard gameplay update */
        update_hud_and_rings();           /* $80:8CB5 */
        script_vm_scheduler_run_turn();   /* $8C:CFFD via $8D:8000 */
        audio_driver_update();            /* $8C:828F */

        /* Ensure screen is unblanked */
        g_ppu_shadow_0106 = 0x0000; /* Brightness full, screen on */

        /* Queue tile, sprite, and palette DMA uploads for next VBLANK */
        queue_vram_transfers(); /* $8D:82CB */
    }
}
```

