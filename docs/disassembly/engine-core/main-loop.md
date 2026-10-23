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
> **Interactive 65816 Assembly**:
> Centralized comments infused at runtime.
> [View in VFS: soe://rom/code/808B66](soe://rom/code/808B66?asm=1&c=0)


### Part 2: Starting Room Selection & Enter Room Dispatch
> **Interactive 65816 Assembly**:
> Centralized comments infused at runtime.
> [View in VFS: soe://rom/code/808B66](soe://rom/code/808B66?asm=1&c=0)


### Part 3: The Per-Frame Update Loop
> **Interactive 65816 Assembly**:
> Centralized comments infused at runtime.
> [View in VFS: soe://rom/code/808B66](soe://rom/code/808B66?asm=1&c=0)


### Part 4: Frame Synchronization & Task Flushing (`$80:858C`)
> **Interactive 65816 Assembly**:
> Centralized comments infused at runtime.
> [View in VFS: soe://rom/code/808B66](soe://rom/code/808B66?asm=1&c=0)


---

## 3. Reconstructed C Decompilation

> **Reconstructed C Decompilation**:
> Source moved to [`reconstructed-c/80/808B66_main_loop.c`](../../../reconstructed-c/80/808B66_main_loop.c).
> [View in VFS: soe://rom/code/808B66](soe://rom/code/808B66?c=1&asm=0)


