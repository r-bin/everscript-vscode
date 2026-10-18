# Script VM Thread Termination, Return Chaining & Run-List Compaction

- **ROM Locations**:
  - `script_op_00_end`: `$8C:D2E1` – `$8C:D314`
- **CPU State**: 16-bit A/X (`REP #$30`), Data Bank `$7E` / `$8C`
- **WRAM Core Addresses**:
  - `$7E:2F28,x`: Active thread run-list array (ordered thread slot IDs, terminated by `0x0000`).
  - DP `$7E`: Current thread slot pointer in `$7E:xxxx`.
  - DP `$80`: Current offset within the active run-list `$7E:2F28`.
  - DP `$83`: Current running thread slot ID (cleared to 0 upon final exit).
  - DP `$86`: Total number of active running script threads (word index counter).
  - Thread Record Fields (indexed by slot pointer `Y`):
    - `+$03`: Thread state code (`0` = inactive/free).
    - `+$0B`: Saved caller return Program Counter (PC).
    - `+$0D`: Saved caller return Bank / parent slot pointer.
    - `+$3E`: Active child threads counter (wait count on spawned subroutines).

---

## 1. Architectural Role & Call Stack Unwinding

Opcode `0x00` (`end`) handles both returning from called subroutines and terminating independent script threads:

```mermaid
flowchart TD
    Op["Opcode 0x00 Executed ($8C:D2E1)"] --> SetInactive["Thread State +0x03 = 0 (Free Slot)"]
    SetInactive --> CheckParent{"Parent Slot in +0x0D != 0?"}
    
    CheckParent -->|Yes| DecChildCount["Decrement Parent's Child Count (DEC +0x3E,x)"]
    CheckParent -->|No| CheckCallerReturn
    DecChildCount --> CheckCallerReturn{"Caller Return PC in +0x0B != 0?"}

    CheckCallerReturn -->|Yes (Called Subroutine)| ResumeCaller["Insert Parent into Run-List ($7E:2F28,x)\nYield Turn (CLC, RTS)"]
    CheckCallerReturn -->|No (Root Script)| CompactRunList["Shift Remaining Run-List Forward:\n$7E:2F28,x = $7E:2F2A,x until 0"]
    
    CompactRunList --> DecActiveCount["Decrement Active Threads Count (DP $86 -= 2)"]
    DecActiveCount --> ClearCurrent["Clear Current Slot (DP $83 = 0)"]
    ClearCurrent --> YieldTurn["Yield Turn (CLC, RTS)"]
```

### Thread Termination Lifecycle
1. **Slot Deallocation**:
   - The thread marks itself inactive by clearing its state word: `thread->state = 0` (`+$03`).
2. **Parent Synchronization**:
   - If the thread was spawned as a child or subroutine (indicated by parent reference in `+$0D`), it decrements the parent's child dependency count `parent->child_count` (`+$3E`). Once this count reaches zero, the parent thread becomes eligible to resume.
3. **Run-List Compaction vs Subroutine Return**:
   - **Subroutine Return (`thread->return_pc != 0`)**: The child thread replaces itself in the run list `$7E:2F28` with its caller's slot ID, immediately unblocking the parent thread.
   - **Root Script Termination (`thread->return_pc == 0`)**: The thread shifts all subsequent thread slots in `$7E:2F28` forward by one word (compaction loop), decrements the active thread count `$86`, zeroes the current thread slot in `$83`, and yields control back to the scheduler with `CLC; RTS`.

---

## 2. Disassembly & Annotations

```asm
; ==============================================================================
; script_op_00_end ($8C:D2E1)
; Ends the current script: returns to caller or terminates the thread.
; ==============================================================================
$8CD2E1  a4 7e          ldy $7E            ; Y = Current thread slot pointer ($7E:xxxx)
$8CD2E3  7b             tdc                ; A = 0
$8CD2E4  99 03 00       sta $0003,y        ; thread->state = SCRIPT_STATE_INACTIVE (0)
$8CD2E7  be 0d 00       ldx $000D,y        ; X = Parent slot pointer / return bank
$8CD2EA  f0 03          beq $8CD2EF        ; If 0: no parent link
$8CD2EC  de 3e 00       dec $003E,x        ; Decrement parent's child wait count (+0x3E)

$8CD2EF  a6 80          ldx $80            ; DP $80 = current run-list offset
$8CD2F1  ca             dex
$8CD2F2  ca             dex                ; Rewind 1 word in run-list
$8CD2F3  86 80          stx $80

$8CD2F5  b9 0b 00       lda $000B,y        ; thread->return_pc
$8CD2F8  d0 14          bne $8CD30E        ; If return PC != 0: resume caller in run-list

; ------------------------------------------------------------------------------
; Root thread termination: Compact run-list array ($7E:2F28)
; ------------------------------------------------------------------------------
$8CD2FA  e8             inx
$8CD2FB  e8             inx
$8CD2FC  bd 2a 2f       lda $2F2A,x        ; Shift forward: slot[i] = slot[i+1]
$8CD2FF  9d 28 2f       sta $2F28,x
$8CD302  d0 f6          bne $8CD2FA        ; Loop until null terminator (0x0000)

$8CD304  a5 86          lda $86            ; Active threads count (bytes/words)
$8CD306  3a             dec a
$8CD307  3a             dec a              ; Decrement active thread count by 2
$8CD308  85 86          sta $86
$8CD30A  64 83          stz $83            ; Clear current thread slot ID
$8CD30C  18             clc                ; CLC = yield turn
$8CD30D  60             rts

; ------------------------------------------------------------------------------
; Subroutine return: Place parent caller slot into run-list
; ------------------------------------------------------------------------------
$8CD30E  e8             inx
$8CD30F  e8             inx
$8CD310  9d 28 2f       sta $2F28,x        ; Resume caller slot in run list
$8CD313  18             clc                ; CLC = yield turn
$8CD314  60             rts
```

---

## 3. Clean C Decompilation

```c
#include <stdint.h>
#include <stdbool.h>

#define MAX_SCRIPT_THREADS 32

typedef struct {
    uint8_t  _pad0[3];
    uint16_t state;             // +0x03: 0 = inactive/free
    uint8_t  _pad1[6];
    uint16_t return_pc;         // +0x0B: Caller return PC
    uint16_t parent_slot_ptr;   // +0x0D: Caller parent slot pointer (or 0 if root)
    uint8_t  _pad2[47];
    uint16_t child_wait_count;  // +0x3E: Child threads wait counter
} ScriptThreadSlot;

// WRAM script scheduler registers
extern uint16_t g_active_thread_run_list[]; // $7E:2F28
extern uint16_t g_current_run_list_offset;  // DP $80
extern uint16_t g_current_thread_id;        // DP $83
extern uint16_t g_total_active_threads;     // DP $86

/**
 * script_op_00_end ($8C:D2E1)
 * Terminates the current script thread or returns from a called subroutine.
 * 
 * @param current_thread Pointer to the executing thread slot.
 * @return Always returns false to yield execution to the next thread.
 */
bool script_op_00_end(ScriptThreadSlot *current_thread) {
    // 1. Mark current thread slot free / inactive
    current_thread->state = 0;

    // 2. If this was a spawned child thread, notify parent
    if (current_thread->parent_slot_ptr != 0) {
        ScriptThreadSlot *parent = (ScriptThreadSlot *)(uintptr_t)current_thread->parent_slot_ptr;
        if (parent->child_wait_count > 0) {
            parent->child_wait_count--;
        }
    }

    // Rewind run-list pointer by 1 slot
    uint16_t offset = g_current_run_list_offset - 2;
    g_current_run_list_offset = offset;

    // 3. Check if returning to caller or terminating root thread
    if (current_thread->return_pc != 0) {
        // Subroutine return: reinsert parent caller into active run-list
        offset += 2;
        g_active_thread_run_list[offset / 2] = current_thread->return_pc;
        return false;
    }

    // 4. Root thread termination: Compact active run-list array ($7E:2F28)
    do {
        offset += 2;
        uint16_t next_slot = g_active_thread_run_list[(offset + 2) / 2];
        g_active_thread_run_list[offset / 2] = next_slot;
    } while (g_active_thread_run_list[offset / 2] != 0);

    // Decrement total active threads count
    g_total_active_threads -= 2;

    // Clear active thread slot ID
    g_current_thread_id = 0;

    // Yield current turn to scheduler
    return false;
}
```
