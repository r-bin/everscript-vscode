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

> **Interactive 65816 Assembly**:
> Centralized comments infused at runtime.
> [View in VFS: soe://rom/code/8CD2E1](soe://rom/code/8CD2E1?asm=1&c=0)


---

## 3. Clean C Decompilation

> **Reconstructed C Decompilation**:
> Source moved to [`reconstructed-c/8C/8CD2E1_thread_termination.c`](../../../reconstructed-c/8C/8CD2E1_thread_termination.c).
> [View in VFS: soe://rom/code/8CD2E1](soe://rom/code/8CD2E1?c=1&asm=0)

