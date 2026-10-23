# Map Trigger Scanner & Script Launcher

- **ROM Locations**:
  - `scan_room_triggers`: `$8F:ACCE` – `$8F:AD4D`
  - `b_trigger_entry`: `$8F:AC84` – `$8F:ACCD`
  - `launch_trigger_script`: `$8C:CE5C` – `$8C:CE98`
- **CPU State**: 16-bit A/X (`REP #$30`), toggles to 8-bit A (`SEP #$20`) during coordinate comparisons.
- **WRAM Core Addresses**:
  - `$7E:0F86`: Room tile origin X offset.
  - `$7E:0F88`: Room tile origin Y offset.
  - `$7E:1067`: Trigger table length / count.
  - `$7E:1069`–`$7E:106B`: 24-bit pointer to active trigger bounding box table (`[$26]`).
  - `$7E:2421`: Interaction entity X position.
  - `$7E:2423`: Interaction entity Y position.
  - `$7E:2425`: Interaction entity direction / facing state.
  - `$7E:2429`: Last triggered script ID (dialog state).
  - `$7E:2F28,x`: Active thread run-list.

---

## 1. Architectural Architecture & Trigger Bounding Boxes

Secret of Evermore room event scripting relies on two classes of triggers stored in each room's decompressed map blob:
1. **Step-on Triggers**: Walkway transitions, doorway warps, hidden cutscene lines. Evaluated when an actor steps onto walkable floor tiles.
2. **B-Triggers**: Interactive objects (gourds, sniff spots, chests, switches, NPCs). Evaluated when the player presses the **B** button while facing an interactive tile.

### The 6-Byte Trigger Structure
Both trigger types share the identical 6-byte format:
```
Offset  Bytes  Field      Description
+0x00     1    y1         Top coordinate bound (in 16px metatile cells)
+0x01     1    x1         Left coordinate bound (in 16px metatile cells)
+0x02     1    y2         Bottom coordinate bound (exclusive)
+0x03     1    x2         Right coordinate bound (exclusive)
+0x04     2    scriptId   16-bit script pointer table index
```

---

## 2. Disassembly & Annotations

### Part 1: Coordinate Conversion & Bounding Box Loop (`$8F:ACCE`)
> **Interactive 65816 Assembly**:
> Centralized comments infused at runtime.
> [View in VFS: soe://rom/code/8FACCE](soe://rom/code/8FACCE?asm=1&c=0)


### Part 2: Script Thread Launcher (`$8C:CE5C`)
> **Interactive 65816 Assembly**:
> Centralized comments infused at runtime.
> [View in VFS: soe://rom/code/8FACCE](soe://rom/code/8FACCE?asm=1&c=0)


---

## 3. Reconstructed Clean C Implementation

> **Reconstructed C Decompilation**:
> Source moved to [`reconstructed-c/8F/8FACCE_trigger_scanner.c`](../../../reconstructed-c/8F/8FACCE_trigger_scanner.c).
> [View in VFS: soe://rom/code/8FACCE](soe://rom/code/8FACCE?c=1&asm=0)


