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

```assembly
; ==============================================================================
; bit_14_gate_before_step_on_search_current_trigge ($8F:B078)
; ==============================================================================
$8FB078  BD 02 00    LDA $0002,x       ; Entity status word
$8FB07B  89 00 40    BIT #$4000        ; Bit 14: Step-on trigger inhibit?
$8FB07E  D0 10       BNE $8FB090       ; If set, ignore triggers
$8FB080  A5 46       LDA $46           ; Actor X pixel position
$8FB082  8D 21 24    STA $2421         ; Stage interaction X
$8FB085  A5 48       LDA $48           ; Actor Y pixel position
$8FB087  8D 23 24    STA $2423         ; Stage interaction Y
$8FB08A  20 B1 AC    JSR $ACB1         ; Call step_on_trigger_search
$8FB08D  18          CLC
$8FB08E  6B          RTL

$8FB090  38          SEC               ; Trigger search inhibited
$8FB091  6B          RTL

; ==============================================================================
; step_on_trigger_search ($8F:ACB1)
; ==============================================================================
$8FACB1  AD 67 10    LDA $1067         ; Number of active room triggers
$8FACB4  F0 15       BEQ $8FACCB       ; 0 triggers -> exit
$8FACB6  AF 69 10 7E LDA $7E1069       ; Low 16 bits of trigger table pointer
$8FACBA  85 26       STA $26
$8FACBC  AF 6B 10 7E LDA $7E106B       ; Bank byte of trigger table pointer
$8FACBF  85 28       STA $28
$8FACC1  20 CE AC    JSR $ACCE         ; scan_room_triggers coordinate convert
$8FACC4  A0 00 00    LDY #$0000
$8FACC7  4C EF AC    JMP $ACEF         ; Enter bounding box loop

$8FACCB  60          RTS

; ==============================================================================
; trigger_box_test_origin_added_far_edge_exclusive ($8F:ACEF)
; ==============================================================================
$8FACEF  B7 26       LDA [$26],y       ; Load y1 (top bound)
$8FACF1  29 FF 00    AND #$00FF
$8FACF4  C5 48       CMP $48           ; Cell Y < y1?
$8FACF6  10 1F       BPL $8FAD17       ; Miss -> advance to next trigger
$8FACF8  C8          INY               ; Point to x1 (left bound)
$8FACF9  B7 26       LDA [$26],y
$8FACFB  29 FF 00    AND #$00FF
$8FACFE  C5 46       CMP $46           ; Cell X < x1?
$8FAD00  10 15       BPL $8FAD17
$8FAD02  C8          INY               ; Point to y2 (bottom bound, exclusive)
$8FAD03  B7 26       LDA [$26],y
$8FAD05  29 FF 00    AND #$00FF
$8FAD08  C5 48       CMP $48           ; Cell Y >= y2?
$8FAD0A  90 0B       BCC $8FAD17
$8FAD0C  C8          INY               ; Point to x2 (right bound, exclusive)
$8FAD0D  B7 26       LDA [$26],y
$8FAD0F  29 FF 00    AND #$00FF
$8FAD12  C5 46       CMP $46           ; Cell X >= x2?
$8FAD14  90 01       BCC $8FAD17
$8FAD16  60          RTS               ; Match found! Y points to script ID field

; Next trigger:
$8FAD17  98          TYA
$8FAD18  18          CLC
$8FAD19  69 06 00    ADC #$0006        ; Advance by 6 bytes
$8FAD1C  A8          TAY
$8FAD1D  CC 67 10    CPY $1067         ; Reached end of trigger table?
$8FAD20  90 CD       BCC $8FACEF
$8FAD22  60          RTS
```

---

## 3. Reconstructed Clean C Implementation

```c
#include <stdint.h>
#include <stdbool.h>

typedef struct {
    uint8_t  y1;        // Top coordinate (16px metatile cell)
    uint8_t  x1;        // Left coordinate
    uint8_t  y2;        // Bottom coordinate (exclusive)
    uint8_t  x2;        // Right coordinate (exclusive)
    uint16_t script_id; // 16-bit Script pointer ID
} TriggerBox;

extern uint16_t g_origin_tile_x;        // $7E:0F86
extern uint16_t g_origin_tile_y;        // $7E:0F88
extern uint16_t g_trigger_count;        // $7E:1067
extern const TriggerBox *g_trigger_tbl; // $7E:1069..$7E:106B
extern uint16_t g_current_latched_trig; // $7E:2429
extern uint16_t g_interaction_x;        // $7E:2421
extern uint16_t g_interaction_y;        // $7E:2423

extern void launch_trigger_script(uint16_t script_id); // $8C:CE5C

/**
 * Tests if cell coordinate falls inside the far-edge exclusive trigger bounding box.
 * Corresponds to $8F:ACEF.
 */
static inline bool trigger_box_contains(const TriggerBox *box, uint8_t cell_x, uint8_t cell_y) {
    return (cell_y >= box->y1 && cell_y < box->y2 &&
            cell_x >= box->x1 && cell_x < box->x2);
}

/**
 * Scans active room step-on triggers against actor cell coordinates.
 * Corresponds to $8F:ACB1.
 */
void step_on_trigger_search(uint16_t pixel_x, uint16_t pixel_y) {
    if (g_trigger_count == 0 || g_trigger_tbl == NULL) {
        return;
    }

    // Convert world pixels to 16px metatile cells with room origin offset
    uint8_t cell_x = (uint8_t)((pixel_x >> 4) + g_origin_tile_x);
    uint8_t cell_y = (uint8_t)((pixel_y >> 4) + g_origin_tile_y);

    for (uint16_t i = 0; i < g_trigger_count; i++) {
        const TriggerBox *box = &g_trigger_tbl[i];

        if (trigger_box_contains(box, cell_x, cell_y)) {
            // Check if already standing on this trigger from previous frame
            if (box->script_id == g_current_latched_trig) {
                return;
            }

            // Latch new trigger and launch script VM thread
            g_current_latched_trig = box->script_id;
            launch_trigger_script(box->script_id);
            return;
        }
    }

    // Stepped off any trigger -> clear latched trigger
    g_current_latched_trig = 0;
}

/**
 * Gate check: verifies bit 14 in entity status flags before performing trigger search.
 * Corresponds to $8F:B078.
 */
void bit_14_gate_before_step_on_search(uint16_t entity_flags, uint16_t pixel_x, uint16_t pixel_y) {
    // Bit 14 (0x4000): Inhibit step-on triggers
    if ((entity_flags & 0x4000) != 0) {
        return;
    }

    g_interaction_x = pixel_x;
    g_interaction_y = pixel_y;
    step_on_trigger_search(pixel_x, pixel_y);
}
```
