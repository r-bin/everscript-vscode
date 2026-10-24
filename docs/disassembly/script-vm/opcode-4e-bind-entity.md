# Script Opcode 0x4E: Bind an Entity to the Current Script

**Routine:** `$8C:DDB0`\
**Confidence:** confirmed

## Behavior

The handler evaluates an entity expression, reads the current script slot's bound entity at `+$0D`, and decrements that entity's reference count at `+$3E` when nonzero. It then increments the new entity's reference count at `+$3E` when nonzero, stores the new entity address at the current slot's `+$0D`, and returns carry set. If the old and new entity are the same, the decrement still occurs before the increment.

The host-side model is [8CDDB0_opcode_4e_bind_entity.c](../../../reconstructed-c/8C/8CDDB0_opcode_4e_bind_entity.c).

## Evidence

- Opcode table entry `$8C:E959` dispatches `0x4E` to `$8C:DDB0`.
- `$8C:DDB0` calls `$8C:EC8E` to evaluate the entity.
- The handler reads slot `+$0D`, conditionally decrements old entity `+$3E`, conditionally increments new entity `+$3E`, then stores the new entity to slot `+$0D`.
- The handler ends with `SEC; RTS`.