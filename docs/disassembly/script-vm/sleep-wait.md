# Script VM Sleep Scheduling, Thread Yielding & Event Synchronization

- **ROM Locations**:
  - `script_op_39_3b_sleep`: `$8C:D220` – `$8C:D243`
  - `script_op_wait`: `$8C:D244` – `$8C:D2E0`
- **CPU State**: 16-bit A/X (`REP #$30`), Data Bank `$7E` / `$8C`
- **WRAM Core Addresses**:
  - `$7E:0B19` / `$7E:0B1B`: 32-bit field frame counter (`frame_counter_lo` / `frame_counter_hi`).
  - `$7E:0FAE`: Active text box index / dialogue window queue boundary.
  - `$7E:2429`: Active step-on trigger script ID (`-1` / `0xFFFF` when none active).
  - DP `$7E`: Current script thread slot pointer in `$7E:xxxx`.
  - DP `$BF` / `$C1`: Camera scroll target coordinates (X, Y).
  - Thread slot fields (indexed by current thread slot pointer `Y`):
    - `+$03`: Thread state code (0: free, 2: active/ready, 4: sleep, 6: wait entity, 8: wait trigger, 10: wait text box, 12: wait camera).
    - `+$05`: Low word of wake condition / target object pointer / frame tick low.
    - `+$07`: High word of wake condition / frame tick high.

---

## 1. Architectural Role & Execution States

In Secret of Evermore, script threads operate cooperatively. A thread continues executing opcodes in its turn until an opcode explicitly yields CPU time:
- In the 65816 interpreter loop, the carry flag signals whether the thread should continue:
  - **Carry Set (`SEC`)**: The thread continues immediately with the next opcode (no yield).
  - **Carry Clear (`CLC`)**: The thread yields its current turn and relinquishes execution to the scheduler.

```mermaid
flowchart TD
    Op["Opcode Decoded"] --> Sleep{"Opcode 0x39 / 0x3B (Sleep)"}
    Op --> Wait{"Opcode 0x2E (Wait)"}

    Sleep --> EvalSleep["Evaluate Duration Expression ($8C:EA43)"]
    EvalSleep --> CheckZero{"Duration == 0?"}
    CheckZero -->|Yes| SecYield["Return SEC (Continue Turn Immediately)"]
    CheckZero -->|No| CalcTicks["Target Tick = FrameCount32 + Duration - 1"]
    CalcTicks --> SetSleepState["Thread State = 4 (SLEEP)\nStore Target Tick into +0x05 / +0x07"]
    SetSleepState --> ClcYield["Return CLC (Yield Turn to Scheduler)"]

    Wait --> EvalWait["Evaluate Target Expression ($8C:EA43)"]
    EvalWait --> IsEntity{"Target >= 0x2000?"}
    
    IsEntity -->|Yes (Entity WRAM Ptr)| CheckEntityBusy{"Entity Busy?\n($006C, $0010, $0088)"}
    CheckEntityBusy -->|Pending Actions| SetEntityWait["Thread State = 6 (WAIT_ENTITY)\nLink Slot into Entity $0088"]
    CheckEntityBusy -->|Idle| ClcYield

    IsEntity -->|No (< 0x2000)| CheckSpecial{"Target Selector Bitmask"}
    CheckSpecial -->|Bit 0x0100| CheckTextBox{"Target Index < $7E:0FAE?"}
    CheckTextBox -->|Yes| SetTextWait["Thread State = 10 (WAIT_TEXTBOX)\nStore Index in +0x05"]
    CheckTextBox -->|No| ClcYield

    CheckSpecial -->|Target == 1| CheckTrigger{"Trigger $7E:2429 >= 0?"}
    CheckTrigger -->|Yes| SetTrigWait["Thread State = 8 (WAIT_TRIGGER)\nStore Trigger ID in +0x05"]
    CheckTrigger -->|No| ClcYield

    CheckSpecial -->|Target == 2| SetCamWait["Thread State = 12 (WAIT_CAMERA)\nStore Target DP $BF/$C1 into +0x05/+0x06"]
    
    SetEntityWait --> ClcYield
    SetTextWait --> ClcYield
    SetTrigWait --> ClcYield
    SetCamWait --> ClcYield
```

### Thread State Codes
| State ID | Name | Wake Condition Evaluated by Scheduler |
|:---:|---|---|
| `0` | `SCRIPT_STATE_INACTIVE` | Unallocated / free slot |
| `2` | `SCRIPT_STATE_READY` | Runnable immediately on current or next frame |
| `4` | `SCRIPT_STATE_SLEEP` | Wakes when 32-bit frame counter `$7E:0B19` reaches `thread->wake_tick` |
| `6` | `SCRIPT_STATE_WAIT_ENTITY` | Wakes when entity finishes movement path, script action, or animation |
| `8` | `SCRIPT_STATE_WAIT_TRIGGER` | Wakes when step-on trigger script `$7E:2429` terminates |
| `10` | `SCRIPT_STATE_WAIT_TEXTBOX` | Wakes when dialogue window / text box closes (`target < $7E:0FAE`) |
| `12` | `SCRIPT_STATE_WAIT_CAMERA` | Wakes when camera scroll reaches target coordinates (`$BF`, `$C1`) |

---

## 2. Disassembly & Annotations

### Sleep Handler (`$8C:D220` – `$8C:D243`)
```asm
$8CD220  22 43 ea 8c    jsl $8CEA43        ; Evaluate duration expression -> A
$8CD224  a8             tay                ; Test if duration == 0
$8CD225  f0 1b          beq $8CD242        ; If 0: jump to SEC (do not yield)
$8CD227  a4 7e          ldy $7E            ; Y = Current thread slot pointer
$8CD229  3a             dec a              ; Duration - 1 (ticks until wake)
$8CD22A  18             clc
$8CD22B  6d 19 0b       adc $0B19          ; + Low word of 32-bit frame counter
$8CD22E  99 05 00       sta $0005,y        ; thread->wake_tick_lo
$8CD231  ad 1b 0b       lda $0B1B          ; High word of 32-bit frame counter
$8CD234  69 00 00       adc #$0000         ; Propagate carry
$8CD237  99 07 00       sta $0007,y        ; thread->wake_tick_hi
$8CD23A  a9 04 00       lda #$0004
$8CD23D  99 03 00       sta $0003,y        ; thread->state = SCRIPT_STATE_SLEEP (4)
$8CD240  18             clc                ; CLC = Yield turn
$8CD241  60             rts
$8CD242  38             sec                ; SEC = Continue turn
$8CD243  60             rts
```

### Wait Handler (`$8C:D244` – `$8C:D2E0`)
```asm
$8CD244  22 43 ea 8c    jsl $8CEA43        ; Evaluate operand expression -> A
$8CD248  c9 00 20       cmp #$2000         ; Is operand an entity pointer?
$8CD24B  90 4c          bcc $8CD299        ; If < 0x2000: special event selector
$8CD24D  a8             tay                ; Y = entity pointer ($7E:xxxx)
$8CD24E  be 6c 00       ldx $006C,y        ; Check entity script thread link
$8CD251  30 14          bmi $8CD267        ; If negative (none): test movement bits
$8CD253  bd 18 3c       lda $3C18,x        ; Compare entity's owner script slot
$8CD256  c5 7e          cmp $7E            ; Does it match current thread?
$8CD258  d0 0d          bne $8CD267        ; If not matching: check movement bits
$8CD25A  a9 10 00       lda #$0010
$8CD25D  9d 1a 3c       sta $3C1A,x        ; Mark entity script busy flag
$8CD260  a6 7e          ldx $7E
$8CD262  9d 05 00       sta $0005,x        ; thread->wait_param = 0x0010
$8CD265  80 2a          bra $8CD291        ; Set state = 6 (WAIT_ENTITY) and yield

$8CD267  b9 10 00       lda $0010,y        ; Check entity animation / movement status
$8CD26A  89 00 01       bit #$0100
$8CD26D  f0 20          beq $8CD28F        ; If bit 8 clear: not busy, yield 1 tick
$8CD26F  89 40 00       bit #$0040
$8CD272  f0 1b          beq $8CD28F        ; If bit 6 clear: not busy, yield 1 tick
$8CD274  89 01 20       bit #$2001
$8CD277  d0 16          bne $8CD28F        ; If bits 13 or 0 set: busy flag mismatch
$8CD279  b9 88 00       lda $0088,y        ; Entity waiting thread slot
$8CD27C  d0 11          bne $8CD28F        ; If already waiting on a thread, skip
$8CD27E  a6 7e          ldx $7E            ; Current thread slot
$8CD280  8a             txa
$8CD281  99 88 00       sta $0088,y        ; entity->waiting_thread = current_thread
$8CD284  a9 20 00       lda #$0020
$8CD287  99 8a 00       sta $008A,y        ; entity->wait_event_mask = 0x0020
$8CD28A  9d 05 00       sta $0005,x        ; thread->wait_param = 0x0020
$8CD28D  80 02          bra $8CD291

$8CD28F  18             clc                ; Plain yield
$8CD290  60             rts

$8CD291  a9 06 00       lda #$0006         ; SCRIPT_STATE_WAIT_ENTITY
$8CD294  9d 03 00       sta $0003,x        ; thread->state = 6
$8CD297  18             clc
$8CD298  60             rts

; Special wait selector (< 0x2000)
$8CD299  a4 7e          ldy $7E            ; Y = Current thread slot
$8CD29B  89 00 01       bit #$0100         ; Bit 8: Text box wait
$8CD29E  d0 2e          bne $8CD2CE
$8CD2A0  3a             dec a              ; Target == 1? (Step-on trigger)
$8CD2A1  f0 05          beq $8CD2A8
$8CD2A3  3a             dec a              ; Target == 2? (Camera scroll)
$8CD2A4  f0 12          beq $8CD2B8
$8CD2A6  80 e7          bra $8CD28F        ; Unknown target: plain yield

; Step-on trigger wait (target selector = 1)
$8CD2A8  ad 29 24       lda $2429          ; Active step-on trigger script ID
$8CD2AB  30 32          bmi $8CD2DF        ; If negative (none active): exit
$8CD2AD  99 05 00       sta $0005,y        ; thread->wait_target = $7E:2429
$8CD2B0  a9 08 00       lda #$0008         ; SCRIPT_STATE_WAIT_TRIGGER
$8CD2B3  99 03 00       sta $0003,y        ; thread->state = 8
$8CD2B6  18             clc
$8CD2B7  60             rts

; Camera scroll wait (target selector = 2)
$8CD2B8  e2 20          sep #$20           ; 8-bit A
$8CD2BA  a5 bf          lda $BF            ; DP $BF = Target Camera X
$8CD2BC  99 05 00       sta $0005,y        ; thread->wait_cam_x
$8CD2BF  a5 c1          lda $C1            ; DP $C1 = Target Camera Y
$8CD2C1  99 06 00       sta $0006,y        ; thread->wait_cam_y
$8CD2C4  c2 30          rep #$30           ; 16-bit A/X
$8CD2C6  a9 0c 00       lda #$000C         ; SCRIPT_STATE_WAIT_CAMERA
$8CD2C9  99 03 00       sta $0003,y        ; thread->state = 12
$8CD2CC  18             clc
$8CD2CD  60             rts

; Text box wait (bit 8 set)
$8CD2CE  29 ff 00       and #$00FF         ; Extract window / dialogue queue ID
$8CD2D1  cd ae 0f       cmp $0FAE          ; Compare with active queue index
$8CD2D4  b0 09          bcs $8CD2DF        ; If target >= $0FAE: queue already closed!
$8CD2D6  99 05 00       sta $0005,y        ; thread->wait_target = window_id
$8CD2D9  a9 0a 00       lda #$000A         ; SCRIPT_STATE_WAIT_TEXTBOX
$8CD2DC  99 03 00       sta $0003,y        ; thread->state = 10
$8CD2DF  18             clc
$8CD2E0  60             rts
```

---

## 3. Clean C Decompilation

```c
#include <stdint.h>
#include <stdbool.h>

typedef enum {
    SCRIPT_STATE_INACTIVE     = 0,
    SCRIPT_STATE_READY        = 2,
    SCRIPT_STATE_SLEEP        = 4,
    SCRIPT_STATE_WAIT_ENTITY  = 6,
    SCRIPT_STATE_WAIT_TRIGGER = 8,
    SCRIPT_STATE_WAIT_TEXTBOX = 10,
    SCRIPT_STATE_WAIT_CAMERA  = 12
} ScriptThreadState;

typedef struct {
    uint8_t  _pad0[3];
    uint16_t state;             // +0x03: ScriptThreadState
    uint16_t wait_param_lo;     // +0x05: wake tick lo / entity event mask / target ID
    uint16_t wait_param_hi;     // +0x07: wake tick hi / camera Y
    uint8_t  _pad1[2];
    uint16_t return_pc;         // +0x0B
    uint8_t  return_bank;       // +0x0D
    uint8_t  _pad2[48];
    uint16_t parent_slot_id;    // +0x3E
} ScriptThread;

typedef struct {
    uint8_t  _pad0[16];
    uint16_t status_flags;      // +0x10: Animation & busy flags
    uint8_t  _pad1[90];
    int16_t  script_link;       // +0x6C: Owner script thread slot (-1 if none)
    uint8_t  _pad2[26];
    uint16_t waiting_thread;    // +0x88: Waiting thread slot ID
    uint16_t wait_event_mask;   // +0x8A: Event bitmask
} EntityRecord;

// Global WRAM registers
extern uint16_t g_field_frame_counter_lo; // $7E:0B19
extern uint16_t g_field_frame_counter_hi; // $7E:0B1B
extern int16_t  g_active_step_trigger;    // $7E:2429
extern uint16_t g_active_textbox_index;   // $7E:0FAE
extern uint8_t  g_camera_target_x;        // DP $BF
extern uint8_t  g_camera_target_y;        // DP $C1
extern uint16_t g_entity_script_owner[];  // $7E:3C18
extern uint16_t g_entity_script_busy[];   // $7E:3C1A

extern uint16_t script_eval_expression(void); // $8C:EA43

/**
 * script_op_39_3b_sleep ($8C:D220)
 * Evaluates duration expression. If > 0, sets thread state to SLEEP (4)
 * with 32-bit wake timestamp and yields the current turn.
 * 
 * @param thread Pointer to active script thread record.
 * @return true if execution continues immediately; false if turn yields.
 */
bool script_op_39_3b_sleep(ScriptThread *thread) {
    uint16_t duration = script_eval_expression();
    if (duration == 0) {
        // Carry set: duration of 0 ticks continues immediately without yielding
        return true;
    }

    // 32-bit addition with frame counter
    uint32_t current_ticks = ((uint32_t)g_field_frame_counter_hi << 16) | g_field_frame_counter_lo;
    uint32_t wake_ticks = current_ticks + (duration - 1);

    thread->wait_param_lo = (uint16_t)(wake_ticks & 0xFFFF);
    thread->wait_param_hi = (uint16_t)(wake_ticks >> 16);
    thread->state = SCRIPT_STATE_SLEEP;

    // Carry clear: yield current turn to scheduler
    return false;
}

/**
 * script_op_wait ($8C:D244, Opcode 0x2E)
 * Synchronizes execution with an entity, dialogue text box, step trigger, or camera.
 * 
 * @param thread Pointer to active script thread record.
 * @return true if thread continues; false if thread yields turn.
 */
bool script_op_wait(ScriptThread *thread, uint16_t current_thread_id) {
    uint16_t target = script_eval_expression();

    // Check if target is an entity pointer (>= 0x2000 in WRAM)
    if (target >= 0x2000) {
        EntityRecord *entity = (EntityRecord *)(uintptr_t)target;

        // Check if entity has an attached script slot
        if (entity->script_link >= 0) {
            uint16_t slot = (uint16_t)entity->script_link;
            if (g_entity_script_owner[slot] == current_thread_id) {
                g_entity_script_busy[slot] = 0x0010;
                thread->wait_param_lo = 0x0010;
                thread->state = SCRIPT_STATE_WAIT_ENTITY;
                return false;
            }
        }

        // Check entity status flags
        if ((entity->status_flags & 0x0100) &&
            (entity->status_flags & 0x0040) &&
            !(entity->status_flags & 0x2001)) {
            
            if (entity->waiting_thread == 0) {
                entity->waiting_thread = current_thread_id;
                entity->wait_event_mask = 0x0020;
                thread->wait_param_lo = 0x0020;
                thread->state = SCRIPT_STATE_WAIT_ENTITY;
                return false;
            }
        }

        // Entity is idle or not ready; yield 1 tick
        return false;
    }

    // Special event targets (< 0x2000)
    if (target & 0x0100) {
        // Dialogue window / text box wait
        uint16_t window_id = target & 0x00FF;
        if (window_id < g_active_textbox_index) {
            thread->wait_param_lo = window_id;
            thread->state = SCRIPT_STATE_WAIT_TEXTBOX;
        }
        return false;
    }

    // Selector: 1 = Step-on trigger wait
    if (target == 1) {
        if (g_active_step_trigger >= 0) {
            thread->wait_param_lo = (uint16_t)g_active_step_trigger;
            thread->state = SCRIPT_STATE_WAIT_TRIGGER;
        }
        return false;
    }

    // Selector: 2 = Camera scroll wait
    if (target == 2) {
        thread->wait_param_lo = g_camera_target_x;
        thread->wait_param_hi = g_camera_target_y;
        thread->state = SCRIPT_STATE_WAIT_CAMERA;
        return false;
    }

    // Unrecognized event: default 1-tick yield
    return false;
}
```
