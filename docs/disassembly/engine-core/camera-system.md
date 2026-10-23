# Camera Centering & Map Margin Clamping

- **ROM Location**: Bank `$90` (`$90:94AB` – `$90:9544`)
- **Primary Function**: `camera_center_and_clamp` (`$90:94AB`)
- **CPU State**: 16-bit A/X (`REP #$30`), Data Bank `$7E`
- **WRAM Core Addresses**:
  - `$7E:0F3A`: VRAM upload queue lock (incremented on entry, decremented on exit).
  - `$7E:0F42`: Pointer to entity the camera tracks (normally player `$4E89`).
  - `$7E:23E9`: Room left boundary limit (minimum camera X).
  - `$7E:23EB`: Room top boundary limit (minimum camera Y).
  - `$7E:23ED`: Room right boundary limit (maximum camera X + 256).
  - `$7E:23EF`: Room bottom boundary limit (maximum camera Y + 224).
  - `$7E:242B`: Fixed camera target X (`$FFFF` = follow entity `$0F42`).
  - `$7E:242D`: Fixed camera target Y (`$FFFF` = follow entity `$0F42`).
  - DP `$BF` & DP `$59`: Camera view origin X coordinate.
  - DP `$C1` & DP `$5B`: Camera view origin Y coordinate.

---

## 1. Architectural Architecture & Tracking Modes

The camera subsystem maintains the visible $256 \times 224$ viewport within the current room's tile dimensions.

### Two Tracking Modes
1. **Follow Entity Mode (`$7E:242B < 0`)**:
   - The camera locks onto the entity pointed to by `$7E:0F42` (typically the boy `$4E89` or the dog `$4F37`).
   - Reads the actor's current world coordinates from `entity + 0x1A` (X) and `entity + 0x1C` (Y).
2. **Fixed Anchor Mode (`$7E:242B >= 0`)**:
   - Pins the camera to a stationary cutscene coordinate specified at `$7E:242B` / `$7E:242D` (offset by $+128, +112$ to center the view).

### VRAM Upload Lock (`$7E:0F3A`)
Before updating camera coordinates, `$90:94AB` increments `$7E:0F3A`. This ensures that the NMI interrupt handler (`$80:823A`) skips VRAM DMA transfers while camera row/column tile buffers are in an intermediate state.

---

## 2. Disassembly & Annotations

> **Interactive 65816 Assembly**:
> Centralized comments infused at runtime.
> [View in VFS: soe://rom/code/9094AB](soe://rom/code/9094AB?asm=1&c=0)


---

## 3. Reconstructed Clean C Implementation

> **Reconstructed C Decompilation**:
> Source moved to [`reconstructed-c/90/9094AB_camera_system.c`](../../../reconstructed-c/90/9094AB_camera_system.c).
> [View in VFS: soe://rom/code/9094AB](soe://rom/code/9094AB?c=1&asm=0)

