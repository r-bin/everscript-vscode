---
name: emulator-script-debugging
description: Explains the debug technique of starting the emulator, launching a ROM or custom room, teleporting the Boy into position to test triggers, and analyzing the real-time execution trace logs and VFS log endpoints.
---

# Emulator Script Debugging Technique

This skill describes the standard interactive and automated debugging workflow in Everscript: launching a ROM or custom room draft in the embedded emulator, teleporting the Boy into position to test specific scripts or triggers, and analyzing the resulting script trace logs and VFS log endpoints.

---

## 1. Workflow Overview

```
Map Editor / Code / ROM
        │
        ▼
1. Launch ROM in Emulator ──► "Play in emulator" / Test Room boots Room 0x15
        │
        ▼
2. Teleport Boy to Target ──► Set WRAM $7E4EA3 (X), $7E4EA5 (Y) to adjacent cell
        │
        ▼
3. Step onto Trigger      ──► Walk 1 step into bit-14 tile to fire $8FACB1
        │
        ▼
4. Analyze Trace Logs     ──► Check Everscript Script Trace, #ss-trace-log, or soe://logs/
```

---

## 2. Launching the ROM

There are three ways to launch a ROM for testing:

1. **Map Editor ("Play in emulator"):**
   - Click the `Play in emulator` action in the Map Editor top-bar actions menu (or press the test button).
   - This compiles the current custom room draft into Room `0x15`, links the test enter script (`0xBC8000`), and starts the game straight into this map.
2. **From VS Code Explorer:**
   - Right-click a `.smc` or `.sfc` file -> `Open with...` -> `Everscript SNES Emulator`.
3. **From Everscript Command / DAP:**
   - Execute `everscript.runRomFile` or start a debugging session via `.vscode/launch.json`.

Boot verification:
- Look for `$(check) Emulator: <rom_name> running` in the VS Code status bar.
- Check launch history via the VFS: `soe://logs/launches.json` or `soe://logs/launches.md`.

---

## 3. Teleporting the Boy into Position

### 3.1 Key WRAM Addresses

| Address | Size | Description | Units |
|---|---|---|---|
| `$7E4EA3` | 2 bytes | Boy X position | 16-bit pixel coordinate |
| `$7E4EA5` | 2 bytes | Boy Y position | 16-bit pixel coordinate |
| `$7E4F23` | 2 bytes | Dog X position | 16-bit pixel coordinate |
| `$7E4F25` | 2 bytes | Dog Y position | 16-bit pixel coordinate |
| `$7E0F86` | 2 bytes | Room Trigger Origin X (`trigOffX`) | 16-px cell units |
| `$7E0F88` | 2 bytes | Room Trigger Origin Y (`trigOffY`) | 16-px cell units |
| `$7E2429` | 2 bytes | Currently active step-on script ID | 16-bit script ID (`$FFFF` = none) |

### 3.2 Coordinate Conversion Math

Secret of Evermore trigger bounding boxes (`x1, y1, x2, y2`) in ROM are defined in **absolute 16-pixel tile cells**.
The SNES engine search routine at `$8FACB1` calculates the player's tile position as:

$$\text{PlayerTileX} = (\text{BoyX} \gg 4) + \text{OriginX}$$
$$\text{PlayerTileY} = (\text{BoyY} \gg 4) + \text{OriginY}$$

To position the Boy at target tile $(\text{TileX}, \text{TileY})$:

$$\text{BoyX} = (\text{TileX} - \text{OriginX}) \times 16$$
$$\text{BoyY} = (\text{TileY} - \text{OriginY}) \times 16$$

### 3.3 Critical Teleportation Pitfalls

1. **Step-on Requires Walking Across the Boundary:**
   - Writing the Boy's coordinates directly inside a trigger bounding box does **not** fire the trigger immediately.
   - The engine checks `$8FACB1` only when the player takes a step or transitions into a step-on tile.
   - **Best Practice:** Teleport the Boy **1 tile outside/adjacent** to the trigger, then press the directional key to take one step into the box.
2. **Collision Bit 14 Requirement:**
   - The engine collision checker at `$8FB078` checks bit 14 of the collision word under the player (`BIT #$4000`).
   - If bit 14 is not set on the tile under the trigger, `$8FACB1` is never called, and `$7E2429` is cleared to `$FFFF`.
   - In the Map Editor, verify that the tiles under step-on triggers have the Step-On overlay enabled (`Special -> Step-on`).
3. **Companion Desync:**
   - Teleporting the Boy without updating the Dog (`$7E4F23` / `$7E4F25`) leaves the Dog at his old coordinates, which may cause camera tension or leash snapping. Always update both when testing partner mechanics.

---

## 4. Analyzing Execution Logs

### 4.1 Log Viewing Locations

1. **Output Channel:**
   - Open View -> Output -> Select `Everscript Script Trace`.
   - Logs real-time text formatted with TextMate syntax highlighting.
2. **Webview Trace Log:**
   - Inside the emulator panel, expand the collapsible bottom panel `#ss-trace-log`.
   - Provides live row-by-row color-coded entries.
3. **Virtual File System (`soe://logs/`):**
   - `soe://logs/script-trace.log`: Plaintext log of recent execution entries.
   - `soe://logs/script-trace.json`: Structured JSON array of trace events.
   - `soe://logs/crashes.md`: Detailed crash reports with CPU registers and script slots.
   - `soe://logs/launches.md`: History of ROM launches and test builds.

### 4.2 Dissecting a Trace Line

A standard trace output line has the format:

```
[+62.81s, f3770] [s0 | 4E89 | start] [0x15.step[0]] 0x92A42F: END (return) [00]
[+62.81s, f3770] [s0 | 4E89 | end]   [0x15.step[0]] 0x92A42F: END of script
```

Breaking down each token:
- `[+62.81s, f3770]`: Elapsed seconds since ROM boot, and SNES frame number (`f3770`).
- `[s0 | 4E89 | start]`:
  - `s0`: Script slot index (0–31 in `$7E28FC`). Slot 0 is usually the player/room enter/step-on script.
  - `4E89`: Entity pointer in WRAM (`$4E89` = Boy, `$4F09` = Dog).
  - `start` / `end` / `resume` / `step`: Execution lifecycle state.
- `[0x15.step[0]]`: Resolved trigger attribution tag (`<room>.<type>[<index>]`).
  - `step[0]`: Step-on trigger #0.
  - `b[0]`: B-trigger #0.
  - `enter`: Room enter script.
  - `global[0x36]`: Named global script.
- `0x92A42F`: 24-bit SNES ROM script address.
- `END (return) [00]`: Disassembled Everscript bytecode instruction and raw opcode bytes.

### 4.3 Diagnostic Checklist

| Symptom | Cause | Solution |
|---|---|---|
| Step-on trigger never appears in log | Bit 14 not set on collision tile under trigger | Enable Step-on flag in Map Editor on the trigger cells |
| Script shows red `END` without `start` | Frame boundary edge case or uninitialized slot | Verify slot tracker is active; check for 0-frame paired logging |
| Wrong trigger index reported (e.g. `step[2]` instead of `step[0]`) | Trigger boxes overlapping or stale origin offset | Ensure cell math uses `((boyX >> 4) + originX)`; eliminate box overlap |
| Teleported Boy freezes or walks in place | Script slot in state 4 (waiting) or partner freeze flag set | Check `$7E22EB`; clear scripted wait flags |
| Emulator crash | Invalid jump, stack overflow, or execution of non-script data | Open `soe://logs/crashes.md` to inspect CPU PC and slot locations |
