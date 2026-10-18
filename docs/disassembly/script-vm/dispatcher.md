# Script VM Turn Dispatcher & Thread Scheduler

- **ROM Locations**:
  - `script_scheduler_pass`: `$8C:CFFD` – `$8C:D028`
  - `script_thread_state_table`: `$8C:D029` – `$8C:D036`
  - `script_thread_state_handlers`: `$8C:D037` – `$8C:D095`
  - `script_thread_continue`: `$8C:D096` – `$8C:D0A5`
  - `script_vm_opcode_dispatch`: `$8C:D0A6` – `$8C:D0C2`
- **CPU State**: 16-bit A/X (`REP #$30`), Data Bank `$7E` during thread iteration.
- **WRAM Core Addresses**:
  - `$7E:1436`: Reentrancy guard / VM execution lock (1 when active, 0 when idle).
  - `$7E:2F28,x`: Active thread run-list array of 16-bit pointers into thread slot pool.
  - `$7E:28FC`..: Thread slot allocation structures (each slot is 16+ bytes).
  - DP `$7E`: Active thread slot pointer (in bank `$7E`).
  - DP `$80`: Current run-list index `x`.
  - DP `$82`–`$84`: 24-bit direct script instruction pointer `[$82]`.

---

## 1. Architectural Architecture & Turn Protocol

The Secret of Evermore event scripting engine is a cooperative multithreaded virtual machine executed once per field frame tick (at `$80:8C06` during the main game loop).

### The Thread Run List
Active threads are stored in an indexed run-list at `$7E:2F28,x`. Each entry is a 16-bit pointer to a thread slot in `$7E:28FC+`. The list is null-terminated by an entry containing `0x0000`.

### Thread Slot Layout
Each thread slot consists of at least 16 bytes:
- `+0x00`: Script instruction pointer low word (`uint16_t pc_low`)
- `+0x01`: Script instruction pointer high word (`uint8_t pc_high`, `uint8_t bank`) - note overlapping byte layout
- `+0x03`: Thread lifecycle state (`uint16_t state`, indexes jump table `$8C:D029`)
- `+0x05`: Wait target / parameter 1 (e.g. sleep timer deadline low, entity mask, text box ID, camera previous position X)
- `+0x07`: Wait target / parameter 2 (e.g. sleep timer deadline high, camera previous position Y)
- `+0x09`: Wait condition mask / entity busy bits
- `+0x0D`: Associated entity slot offset (for entity-bound scripts)
- `+0x0F`..: Thread-local scratch variables

### Carry Flag Protocol & Turn Semantics
During opcode execution (`$8C:D0A6`):
1. **Carry Set (`BCS $8C:D0A6`)**: The opcode handler finished its synchronous action and requests immediate continuation within the same frame tick. The loop continues without yielding.
2. **Carry Clear (`BCC $8C:D0B4`)**: The opcode handler yielded execution (e.g., `YIELD`, `SLEEP`, `WAIT_WALK`, `CHANGE_MAP`, `END`, or subroutine calls).
3. **Writeback & Termination**:
   - If the script pointer bank/high byte at DP `$83` is non-zero, the updated 24-bit pointer (`$82`–`$84`) is written back to the thread slot (`slot + 0` and `slot + 1`).
   - If DP `$83` is zero (script terminated via `END`), writeback is bypassed, leaving the slot deactivated.

---

## 2. Disassembly & Annotations

### Part 1: Top-Level Scheduler (`$8C:CFFD`)
```assembly
; ==============================================================================
; script_scheduler_pass ($8C:CFFD)
; Executed once per frame tick from main loop ($80:8C06 / $8E:E45C)
; ==============================================================================
$8CCFFD  AD 36 14    LDA $1436         ; Check reentrancy guard
$8CD000  D0 26       BNE $8CD028       ; If already running inside VM, return immediately
$8CD002  1A          INC A             ; Set guard to 1
$8CD003  8D 36 14    STA $1436
$8CD006  8B          PHB               ; Preserve caller Data Bank
$8CD007  F4 7E 7E    PEA $7E7E         ; Push $7E twice
$8CD00A  AB          PLB
$8CD00B  AB          PLB               ; Set Data Bank = $7E
$8CD00C  A2 00 00    LDX #$0000        ; Start at run-list index 0
$8CD00F  80 0E       BRA $8CD01F       ; Jump into run-list loop check

; Process Single Thread:
$8CD011  86 80       STX $80           ; DP $80 = run-list index
$8CD013  84 7E       STY $7E           ; DP $7E = thread slot address ($7E:xxxx)
$8CD015  BE 03 00    LDX $0003,Y       ; X = thread->state
$8CD018  FC 29 D0    JSR ($D029,X)     ; Dispatch state handler
$8CD01B  A6 80       LDX $80           ; Restore run-list index
$8CD01D  E8          INX
$8CD01E  E8          INX               ; X += 2

$8CD01F  BC 28 2F    LDY $2F28,X       ; Y = run_list[X] (pointer to thread slot)
$8CD022  D0 ED       BNE $8CD011       ; If non-null, process thread

; All Threads Complete:
$8CD024  9C 36 14    STZ $1436         ; Clear reentrancy guard
$8CD027  AB          PLB               ; Restore Data Bank
$8CD028  6B          RTL               ; Return to caller
```

### Part 2: Thread State Jump Table & Handlers (`$8C:D029`)
The jump table at `$8C:D029` indexes handlers by thread state byte (`+$03`):

| State | Address | Handler Purpose | Wake Condition |
|---|---|---|---|
| `0` | `$8C:E8BC` | Unused / Halting | `STP` / Invalid |
| `2` | `$8C:D09C` | Active / Running | Always continues execution at `pc` |
| `4` | `$8C:D037` | Sleeping | Frame counter `$0B19` $\ge$ deadline (`+0x05`/`+0x07`) |
| `6` | `$8C:D04A` | Entity Busy Wait | Entity busy mask (`+0x05` & `+0x09`) becomes non-zero |
| `8` | `$8C:D05C` | Dialog Box Wait | Dialog box state `$2429` $\ne$ `+0x05` |
| `10`| `$8C:D086` | Actor Walk Wait | Entity walk step `$107E,x` matches target `$10CE,x` |
| `12`| `$8C:D065` | Camera Settle | Camera coordinates DP `$BF` and `$C1` stop moving |

#### Mode 4: Sleep Timer Handler (`$8C:D037`)
```assembly
$8CD037  AD 19 0B    LDA $0B19         ; Read low word of 32-bit frame counter
$8CD03A  38          SEC
$8CD03B  F9 05 00    SBC $0005,Y       ; Subtract deadline low
$8CD03E  AD 1B 0B    LDA $0B1B         ; Read high word of frame counter
$8CD041  F9 07 00    SBC $0007,Y       ; Subtract deadline high with borrow
$8CD044  10 01       BPL $8CD047       ; If timer >= deadline, timer expired!
$8CD046  60          RTS               ; Still sleeping, yield turn
$8CD047  4C 96 D0    JMP $D096         ; Wake up: transition to State 2 and run!
```

#### Mode 6: Entity Busy Mask Wait (`$8C:D04A`)
```assembly
$8CD04A  B9 05 00    LDA $0005,Y       ; Load wait mask
$8CD04D  39 09 00    AND $0009,Y       ; Test against active entity flags
$8CD050  D0 01       BNE $8CD053       ; If flag condition matched, proceed
$8CD052  60          RTS               ; Still waiting, yield turn
$8CD053  59 09 00    EOR $0009,Y       ; Clear the matched wait bits
$8CD056  99 09 00    STA $0009,Y
$8CD059  4C 96 D0    JMP $D096         ; Wake up: transition to State 2 and run!
```

#### Mode 8: Dialog / Text Box Wait (`$8C:D05C`)
```assembly
$8CD05C  AD 29 24    LDA $2429         ; Read dialog box state
$8CD05F  D9 05 00    CMP $0005,Y       ; Compare against waiting dialog ID
$8CD062  D0 32       BNE $8CD096       ; When changed / dialog dismissed, wake up!
$8CD064  60          RTS               ; Dialog still open, yield turn
```

#### Mode 10: Actor Walk Target Reached (`$8C:D086`)
```assembly
$8CD086  BE 05 00    LDX $0005,Y       ; X = entity slot offset
$8CD089  E2 20       SEP #$20          ; 8-bit accumulator
$8CD08B  BD 7E 10    LDA $107E,X       ; Current walk step index
$8CD08E  5D CE 10    EOR $10CE,X       ; Compare with walk target step
$8CD091  C2 30       REP #$30          ; 16-bit A/X
$8CD093  F0 01       BEQ $8CD096       ; If equal, walk completed! Wake up!
$8CD095  60          RTS               ; Still walking, yield turn
```

#### Mode 12: Camera Stabilization Wait (`$8C:D065`)
```assembly
$8CD065  E2 20       SEP #$20          ; 8-bit accumulator
$8CD067  A5 BF       LDA $BF           ; Camera scroll X position / delta
$8CD069  D9 05 00    CMP $0005,Y
$8CD06C  D0 07       BNE $8CD075       ; If X changed, camera still scrolling
$8CD06E  A5 C1       LDA $C1           ; Camera scroll Y position / delta
$8CD070  D9 06 00    CMP $0006,Y
$8CD073  F0 0D       BEQ $8CD082       ; If both X and Y unchanged, camera stopped!
$8CD075  A5 BF       LDA $BF           ; Update tracked camera X
$8CD077  99 05 00    STA $0005,Y
$8CD07A  A5 C1       LDA $C1           ; Update tracked camera Y
$8CD07C  99 06 00    STA $0006,Y
$8CD07F  C2 30       REP #$30
$8CD081  60          RTS               ; Still moving, yield turn
$8CD082  C2 30       REP #$30
$8CD084  80 10       BRA $8CD096       ; Camera stationary -> wake up!
```

---

### Part 3: Thread Wakeup & Opcode Dispatch Loop (`$8C:D096` – `$8C:D0C2`)
```assembly
; ==============================================================================
; script_thread_continue ($8C:D096 / $8C:D09C)
; Sets thread state to running (2), loads 24-bit pointer, and starts dispatching.
; ==============================================================================
$8CD096  A9 02 00    LDA #$0002
$8CD099  99 03 00    STA $0003,Y       ; thread->state = SCRIPT_STATE_RUNNING (2)

$8CD09C  B9 00 00    LDA $0000,Y       ; Load script pointer low word
$8CD09F  85 82       STA $82           ; DP $82 = pc_low
$8CD0A1  B9 01 00    LDA $0001,Y       ; Load script pointer high byte and bank
$8CD0A4  85 83       STA $83           ; DP $83..$84 = pc_high + bank

; Opcode Fetch & Dispatch:
$8CD0A6  A7 82       LDA [$82]         ; Fetch opcode byte from 24-bit pointer
$8CD0A8  E6 82       INC $82           ; Advance instruction pointer
$8CD0AA  29 FF 00    AND #$00FF        ; Isolate opcode byte (0..255)
$8CD0AD  0A          ASL A             ; Convert to word offset (* 2)
$8CD0AE  AA          TAX
$8CD0AF  FC BD E8    JSR ($E8BD,X)     ; Call opcode handler via master jump table!

$8CD0B2  B0 F2       BCS $8CD0A6       ; If Carry SET: continue immediately in this turn!

; Yield / Turn End:
$8CD0B4  A5 83       LDA $83           ; Check if script pointer is still valid
$8CD0B6  F0 0A       BEQ $8CD0C2       ; If bank == 0, thread terminated (skip writeback)
$8CD0B8  A6 7E       LDX $7E           ; X = thread slot pointer
$8CD0BA  9D 01 00    STA $0001,X       ; Write back high word / bank
$8CD0BD  A5 82       LDA $82
$8CD0BF  9D 00 00    STA $0000,X       ; Write back low word
$8CD0C2  60          RTS               ; Yield turn to next thread in run-list
```

---

## 3. Reconstructed Clean C Implementation

```c
#include <stdint.h>
#include <stdbool.h>

// Thread Lifecycle States
typedef enum {
    SCRIPT_STATE_UNUSED  = 0,
    SCRIPT_STATE_RUNNING = 2,
    SCRIPT_STATE_SLEEP   = 4,
    SCRIPT_STATE_BUSY    = 6,
    SCRIPT_STATE_DIALOG  = 8,
    SCRIPT_STATE_WALK    = 10,
    SCRIPT_STATE_CAMERA  = 12
} ScriptThreadState;

typedef struct {
    uint16_t pc_low;          // +0x00: Script pointer low word
    uint8_t  pc_high;         // +0x01: Script pointer high byte
    uint8_t  bank;            // +0x02: Script ROM bank ($92+)
    uint16_t state;           // +0x03: ScriptThreadState
    uint16_t wait_param1;     // +0x05: Deadline low / mask / entity slot / prev cam X
    uint16_t wait_param2;     // +0x07: Deadline high / prev cam Y
    uint16_t wait_mask;       // +0x09: Entity busy mask bits
    uint16_t unused_0b;       // +0x0B
    uint16_t entity_slot;     // +0x0D: Associated actor entity pointer
    uint16_t locals[8];       // +0x0F: Thread local scratch storage
} ScriptThreadSlot;

// Global VM Context
typedef struct {
    uint16_t reentrancy_guard;           // $7E:1436
    uint32_t frame_counter;              // $7E:0B19
    uint16_t dialog_box_state;           // $7E:2429
    uint8_t  camera_x;                   // DP $BF
    uint8_t  camera_y;                   // DP $C1
    uint16_t run_list[32];               // $7E:2F28
    ScriptThreadSlot slots[16];          // $7E:28FC
} ScriptVmContext;

extern ScriptVmContext g_script_vm;
extern const uint8_t g_rom[0x400000];

// Opcode Handler Function Signature:
// Returns true to CONTINUE in the same turn (Carry Set).
// Returns false to YIELD turn until next tick or wait condition (Carry Clear).
typedef bool (*ScriptOpcodeHandler)(ScriptThreadSlot *thread, uint32_t *pc);
extern const ScriptOpcodeHandler g_script_opcode_table[256];

/**
 * Executes one thread's turn until an opcode yields or terminates.
 */
static void script_vm_execute_thread(ScriptThreadSlot *thread) {
    // Reconstruct 24-bit pointer
    uint32_t pc = ((uint32_t)thread->bank << 16) | ((uint32_t)thread->pc_high << 8) | (thread->pc_low & 0xFF);
    // Note: In 65816 assembly, pc_low is word at +0, pc_high/bank is word at +1

    bool continue_turn = true;
    while (continue_turn) {
        // Fetch opcode byte
        uint8_t opcode = g_rom[pc++];
        
        // Dispatch via opcode jump table ($8C:E8BD)
        ScriptOpcodeHandler handler = g_script_opcode_table[opcode];
        if (handler != NULL) {
            continue_turn = handler(thread, &pc);
        } else {
            // Unknown or STP opcode terminates thread
            thread->bank = 0;
            break;
        }
    }

    // Write back PC on yield, unless terminated
    if (thread->bank != 0) {
        thread->pc_low = (uint16_t)(pc & 0xFFFF);
        thread->pc_high = (uint8_t)((pc >> 16) & 0xFF); // Bank and high word layout
    }
}

/**
 * State handlers corresponding to mode table $8C:D029.
 */
static bool script_thread_check_wake(ScriptThreadSlot *thread) {
    switch (thread->state) {
        case SCRIPT_STATE_RUNNING:
            return true;

        case SCRIPT_STATE_SLEEP: {
            uint32_t deadline = ((uint32_t)thread->wait_param2 << 16) | thread->wait_param1;
            if (g_script_vm.frame_counter >= deadline) {
                thread->state = SCRIPT_STATE_RUNNING;
                return true;
            }
            return false;
        }

        case SCRIPT_STATE_BUSY: {
            if ((thread->wait_param1 & thread->wait_mask) != 0) {
                thread->wait_mask ^= thread->wait_param1;
                thread->state = SCRIPT_STATE_RUNNING;
                return true;
            }
            return false;
        }

        case SCRIPT_STATE_DIALOG: {
            if (g_script_vm.dialog_box_state != thread->wait_param1) {
                thread->state = SCRIPT_STATE_RUNNING;
                return true;
            }
            return false;
        }

        case SCRIPT_STATE_WALK: {
            uint16_t entity_offset = thread->wait_param1;
            uint8_t *entity_wram = (uint8_t *)&g_script_vm + entity_offset;
            uint8_t current_step = entity_wram[0x7E];
            uint8_t target_step  = entity_wram[0xCE];
            if (current_step == target_step) {
                thread->state = SCRIPT_STATE_RUNNING;
                return true;
            }
            return false;
        }

        case SCRIPT_STATE_CAMERA: {
            uint8_t prev_x = (uint8_t)thread->wait_param1;
            uint8_t prev_y = (uint8_t)(thread->wait_param1 >> 8);
            if (g_script_vm.camera_x == prev_x && g_script_vm.camera_y == prev_y) {
                thread->state = SCRIPT_STATE_RUNNING;
                return true;
            }
            thread->wait_param1 = (uint16_t)g_script_vm.camera_x | ((uint16_t)g_script_vm.camera_y << 8);
            return false;
        }

        default:
            return false;
    }
}

/**
 * Top-Level Script Scheduler Pass ($8C:CFFD).
 * Iterates through active threads once per field frame.
 */
void script_scheduler_pass(void) {
    if (g_script_vm.reentrancy_guard != 0) {
        return;
    }
    g_script_vm.reentrancy_guard = 1;

    for (int i = 0; i < 32; i++) {
        uint16_t slot_offset = g_script_vm.run_list[i];
        if (slot_offset == 0) {
            break; // End of active run-list
        }

        ScriptThreadSlot *thread = (ScriptThreadSlot *)((uint8_t *)&g_script_vm + slot_offset);
        if (script_thread_check_wake(thread)) {
            script_vm_execute_thread(thread);
        }
    }

    g_script_vm.reentrancy_guard = 0;
}
```

