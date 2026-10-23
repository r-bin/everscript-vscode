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
> **Interactive 65816 Assembly**:
> Centralized comments infused at runtime.
> [View in VFS: soe://rom/code/8CD220](soe://rom/code/8CD220?asm=1&c=0)


### Wait Handler (`$8C:D244` – `$8C:D2E0`)
> **Interactive 65816 Assembly**:
> Centralized comments infused at runtime.
> [View in VFS: soe://rom/code/8CD220](soe://rom/code/8CD220?asm=1&c=0)


---

## 3. Clean C Decompilation

> **Reconstructed C Decompilation**:
> Source moved to [`reconstructed-c/8C/8CD220_sleep_wait.c`](../../../reconstructed-c/8C/8CD220_sleep_wait.c).
> [View in VFS: soe://rom/code/8CD220](soe://rom/code/8CD220?c=1&asm=0)

