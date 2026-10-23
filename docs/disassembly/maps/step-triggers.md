# Step-On Trigger Evaluation, Bounding Box Overlap & Gate Pipeline

- **ROM Locations**:
  - `step_on_trigger_search`: `$8F:ACB1` – `$8F:ACCD`
  - `trigger_box_test_origin_added_far_edge_exclusive`: `$8F:ACEF` – `$8F:AD30`
  - `bit_14_gate_before_step_on_search_current_trigge`: `$8F:B078` – `$8F:B0A0`
- **CPU State**: 16-bit A/X (`REP #$30`), Data Bank `$7E` / `$8F`
- **WRAM Core Addresses**:
  - `$7E:0F86`: Room origin tile X offset.
  - `$7E:0F88`: Room origin tile Y offset.
  - `$7E:1067`: Step-on trigger table count.
  - `$7E:1069`–`$7E:106B`: 24-bit pointer to active step-on trigger table.
  - `$7E:2421`–`$7E:2427`: Trigger interaction context coordinates and facing direction.
  - `$7E:2429`: Currently active/latched trigger ID (prevents re-triggering while standing on tile).
  - Entity slot offset `+0x02` (bit 14): Inhibit step-on trigger flag.

---

## 1. Architectural Role & Execution Sequence

Whenever the player or an interactive actor steps into a new 16x16 metatile cell, the field engine evaluates floor boundaries for warp lines, room transitions, and cutscene triggers:

```mermaid
flowchart TD
    Move["Actor Moves to New Coordinates"] --> GateCheck["bit_14_gate ($8F:B078)"]
    GateCheck --> Bit14{"Entity Offset +0x02 Bit 14 Set?"}
    Bit14 -->|Yes (Inhibited)| Abort["Skip Trigger Search"]
    Bit14 -->|No (Active)| Search["step_on_trigger_search ($8F:ACB1)"]
    
    Search --> ConvertCoords["Convert Pixels -> 16px Cells (>> 4) + Origin"]
    ConvertCoords --> Iterate["Iterate 6-Byte Trigger Array ([$26])"]
    Iterate --> TestBox["trigger_box_test ($8F:ACEF)"]
    TestBox --> Bounds{"y1 <= Y < y2 && x1 <= X < x2?"}
    Bounds -->|No| NextTrigger["Advance to Next Trigger (+6 Bytes)"]
    NextTrigger --> Iterate
    Bounds -->|Yes| LatchCheck{"Trigger ID == Latched ID ($7E:2429)?"}
    LatchCheck -->|Yes| StillOn["Ignore (Already Standing on Trigger)"]
    LatchCheck -->|No| FireTrigger["Update Latch ($7E:2429 = Script ID)"]
    FireTrigger --> StoreContext["Store Context in $7E:2421..$7E:2427"]
    StoreContext --> Launch["Launch Script VM Thread via $8C:CE5C"]
```

### 1. Bit-14 Inhibit Gate (`$8F:B078`)
- Checks bit 14 of entity status word `+0x02`.
- Entities with bit 14 set (such as jumping actors, projectile sprites, or NPCs during forced cutscenes) are excluded from activating floor step-on triggers.
- If bit 14 is clear, proceeds to initialize DP `$46`/`$48` with the actor's world coordinates and enters the scanner.

### 2. Step-On Search & Cell Conversion (`$8F:ACB1`)
- Converts actor world pixel coordinates to 16-pixel metatile cells:
  $$\text{Cell X} = (X_{\text{pixel}} \gg 4) + \text{Origin X} \quad (\$7E:0F86)$$
  $$\text{Cell Y} = (Y_{\text{pixel}} \gg 4) + \text{Origin Y} \quad (\$7E:0F88)$$
- Loads trigger count from `$7E:1067` and table pointer from `$7E:1069`.

### 3. Far-Edge Exclusive Box Collision (`$8F:ACEF`)
- Each trigger defines a 6-byte bounding box: `[y1, x1, y2, x2, scriptId:2]`.
- Tests spatial containment:
  $$\text{Hit} \iff y_1 \le Y < y_2 \quad \land \quad x_1 \le X < x_2$$
- If the actor matches the box, checks `$7E:2429` (the currently latched trigger ID):
  - If equal, the actor has remained standing on the trigger from the previous frame; no duplicate script thread is spawned.
  - If different, updates `$7E:2429`, saves the interaction origin, and spawns the VM thread via `$8C:CE5C`.

---

## 2. Disassembly & Annotations

> **Interactive 65816 Assembly**:
> Centralized comments infused at runtime.
> [View in VFS: soe://rom/code/8FACB1](soe://rom/code/8FACB1?asm=1&c=0)


---

## 3. Reconstructed Clean C Implementation

> **Reconstructed C Decompilation**:
> Source moved to [`reconstructed-c/8F/8FACB1_step_triggers.c`](../../../reconstructed-c/8F/8FACB1_step_triggers.c).
> [View in VFS: soe://rom/code/8FACB1](soe://rom/code/8FACB1?c=1&asm=0)

