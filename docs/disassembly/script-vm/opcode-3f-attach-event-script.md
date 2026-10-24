# Script Opcode 0x3F: Attach an Event Script

**Routine:** `$8C:DD60`\
**Range:** `$8C:DD60`–`$8C:DDAF`\
**Confidence:** confirmed

## Behavior

The handler evaluates a 16-bit target, then always consumes an event-mask word and a trigger-ID word.

For targets below `$2000`, it treats the target as a one-based room-hook index, computes `2*(target-1)`, and writes the event mask to `$7E:0EA2+offset`. If the mask is zero, it writes `$FFFF` to `$7E:0EAC+offset`; otherwise it writes the trigger ID there.

For targets at or above `$2000`, it treats the target as an entity address, writing the mask at `+$68` and trigger ID at `+$66`. If mask bit `$0400` is set, it starts that entity's event script immediately through `$8C:CE4D`, passing `$0400` as the event reason. The handler returns carry set on both branches.

The host-side model is [8CDD60_opcode_3f_attach_event_script.c](../../../reconstructed-c/8C/8CDD60_opcode_3f_attach_event_script.c). The thread-allocation details of `$8C:CE4D` are represented by the named `script_start_entity_event_thread` helper.

## Evidence

- Opcode table entry `$8C:E93B` dispatches `0x3F` to `$8C:DD60`.
- `$8C:DD60` evaluates one expression and compares the result with `$2000`.
- The entity branch stores the first operand at `+$68`, the second at `+$66`, and checks mask bit `$0400` before calling `$8C:CE4D`.
- `$8C:CE4D` reads the trigger from entity `+$66`, starts a script thread, and stores the passed reason in the new slot's `+$09` field.
- The room-hook branch decrements the target, doubles it, writes the first operand at `$0EA2+offset`, and writes the second at `$0EAC+offset`; when the first operand is zero, it still consumes the second and writes `$FFFF` instead.
- Both normal exits end with `SEC; RTS`.