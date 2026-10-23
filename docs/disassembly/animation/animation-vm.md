# Animation Bytecode VM & Keyframe Interpreter

- **ROM Locations**:
  - `anim_vm_tick_loop`: `$90:80CE` – `$90:8114`
  - `anim_vm_opcode_table`: `$90:8000` – `$90:80CF` (jump table of handlers)
- **CPU State**: 8-bit A (`SEP #$21`), 16-bit Index (`REP #$10`), Data Bank `$7E`
- **WRAM Core Addresses**:
  - DP `$5D`–`$5F`: 24-bit direct animation bytecode instruction pointer `[$5D]`.
  - `slot + 0x00`: 16-bit low word of animation script PC.
  - `slot + 0x02`: 8-bit ROM bank byte of animation script.
  - `slot + 0x05`: Current keyframe hold duration timer (countdown ticks).
  - `slot + 0x0E`: Total ticks elapsed in current animation state.

---

## 1. Architectural Architecture & Keyframe Hold Mechanics

Secret of Evermore animates sprites (the boy, dog, NPCs, enemies, projectiles) using a dedicated bytecode VM in Bank `$90`.

### Keyframe Hold & Resume Protocol
Each animation keyframe specifies a visual graphic frame, a collision hurtbox, optional particle/sound effects, and a **hold duration**:
1. **Bit 7 Terminal Flag**: The high bit of each command byte indicates the **end of frame definition**. The low 7 bits (`cmd & 0x7F`) index the opcode jump table at `$90:8000`.
2. **Hold Opcode**: Sets the frame countdown timer (`slot + 0x05`). Commands placed *before* the hold execute once when the frame begins (e.g. keyframe attack trigger or SFX); commands placed *after* the hold execute every frame tick while holding.
3. **Timer Decrement**: Every tick, the VM decrements `slot + 0x05`. When the timer expires (`0`), the VM advances the instruction pointer `slot + 0x00` to decode the next keyframe.

---

## 2. Disassembly & Annotations

> **Interactive 65816 Assembly**:
> Centralized comments infused at runtime.
> [View in VFS: soe://rom/code/9080CE](soe://rom/code/9080CE?asm=1&c=0)


---

## 3. Reconstructed Clean C Implementation

> **Reconstructed C Decompilation**:
> Source moved to [`reconstructed-c/90/9080CE_animation_vm.c`](../../../reconstructed-c/90/9080CE_animation_vm.c).
> [View in VFS: soe://rom/code/9080CE](soe://rom/code/9080CE?c=1&asm=0)

