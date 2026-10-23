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
> **Interactive 65816 Assembly**:
> Centralized comments infused at runtime.
> [View in VFS: soe://rom/code/8EE4E2](soe://rom/code/8EE4E2?asm=1&c=0)


### Part 2: Spawning Boy and Dog Default Scripts
> **Interactive 65816 Assembly**:
> Centralized comments infused at runtime.
> [View in VFS: soe://rom/code/8EE4E2](soe://rom/code/8EE4E2?asm=1&c=0)


### Part 3: Frame Advance Loop Until Ready (`$8E:E543` – `$8E:E566`)
> **Interactive 65816 Assembly**:
> Centralized comments infused at runtime.
> [View in VFS: soe://rom/code/8EE4E2](soe://rom/code/8EE4E2?asm=1&c=0)


---

## 3. Disassembly of `reset_per_room_state` (`$90:8E90`)

> **Interactive 65816 Assembly**:
> Centralized comments infused at runtime.
> [View in VFS: soe://rom/code/8EE4E2](soe://rom/code/8EE4E2?asm=1&c=0)


---

## 4. Reconstructed C Decompilation

> **Reconstructed C Decompilation**:
> Source moved to [`reconstructed-c/8E/8EE4E2_room_enter.c`](../../../reconstructed-c/8E/8EE4E2_room_enter.c).
> [View in VFS: soe://rom/code/8EE4E2](soe://rom/code/8EE4E2?c=1&asm=0)


