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

```assembly
; ==============================================================================
; camera_center_and_clamp ($90:94AB)
; Centers camera viewport on tracked target and clamps to room boundaries.
; ==============================================================================
; Step 1: Select Target Coordinate Source:
$9094AB  AD 2B 24    LDA $242B         ; Fixed camera target X
$9094AE  30 10       BMI $9094C0       ; If negative ($FFFF), follow entity!
$9094B0  18          CLC
$9094B1  69 80 00    ADC #$0080        ; Add half-screen width (128)
$9094B4  AA          TAX
$9094B5  AD 2D 24    LDA $242D         ; Fixed camera target Y
$9094B8  18          CLC
$9094B9  69 70 00    ADC #$0070        ; Add half-screen height (112)
$9094BC  A8          TAY
$9094BD  4C CD 94    JMP $94CD

; Follow Entity Source:
$9094C0  AC 42 0F    LDY $0F42         ; Y = tracked entity pointer ($7E:0F42)
$9094C3  BE 1A 00    LDX $001A,Y       ; X = entity world coordinate X
$9094C6  B9 1C 00    LDA $001C,Y       ; A = entity world coordinate Y
$9094C9  A8          TAY
$9094CA  4C CD 94    JMP $94CD

; Step 2: Lock VRAM & Clamp X:
$9094CD  8B          PHB
$9094CE  4B          PHK
$9094CF  AB          PLB
$9094D0  EE 3A 0F    INC $0F3A         ; Lock VRAM transfers ($7E:0F3A++)

$9094D3  8A          TXA               ; A = target center X
$9094D4  38          SEC
$9094D5  E9 80 00    SBC #$0080        ; Subtract half-screen (128) -> top-left X
$9094D8  85 BF       STA $BF           ; DP $BF = tentative camera X
$9094DA  85 59       STA $59           ; DP $59 = tentative camera X shadow
$9094DC  CF E9 23 7E CMP $7E23E9       ; Compare against left room bound
$9094E0  10 0A       BPL $9094EC       ; If >= left bound, check right bound
$9094E2  AF E9 23 7E LDA $7E23E9       ; Clamp to left bound
$9094E6  85 BF       STA $BF
$9094E8  85 59       STA $59
$9094EA  80 16       BRA $909502

$9094EC  18          CLC
$9094ED  69 00 01    ADC #$0100        ; Check camera X + 256 (right screen edge)
$9094F0  CF ED 23 7E CMP $7E23ED       ; Compare against right room bound
$9094F4  30 0C       BMI $909502       ; If < right bound, X is valid!
$9094F6  AF ED 23 7E LDA $7E23ED       ; Clamp to right bound - 256
$9094FA  38          SEC
$9094FB  E9 00 01    SBC #$0100
$9094FE  85 BF       STA $BF
$909500  85 59       STA $59

; Step 3: Clamp Y:
$909502  98          TYA               ; A = target center Y
$909503  38          SEC
$909504  E9 70 00    SBC #$0070        ; Subtract half-screen (112) -> top-left Y
$909507  85 C1       STA $C1           ; DP $C1 = tentative camera Y
$909509  85 5B       STA $5B           ; DP $5B = tentative camera Y shadow
$90950B  CF EB 23 7E CMP $7E23EB       ; Compare against top room bound
$90950F  10 0A       BPL $90951B       ; If >= top bound, check bottom bound
$909511  AF EB 23 7E LDA $7E23EB       ; Clamp to top bound
$909515  85 C1       STA $C1
$909517  85 5B       STA $5B
$909519  80 16       BRA $909531

$90951B  18          CLC
$90951C  69 E0 00    ADC #$00E0        ; Check camera Y + 224 (bottom screen edge)
$90951F  CF EF 23 7E CMP $7E23EF       ; Compare against bottom room bound
$909523  30 0C       BMI $909531       ; If < bottom bound, Y is valid!
$909525  AF EF 23 7E LDA $7E23EF       ; Clamp to bottom bound - 224
$909529  38          SEC
$90952A  E9 E0 00    SBC #$00E0
$90952D  85 C1       STA $C1
$90952F  85 5B       STA $5B

; Step 4: Stream Background Metatiles & Unlock VRAM:
$909531  AF 1F 24 7E LDA $7E241F       ; Room scroll mode
$909535  0A          ASL A
$909536  AA          TAX
$909537  FC 68 8E    JSR ($8E68,X)     ; Execute scroll mode handler
$90953A  20 79 93    JSR $9379         ; Update horizontal tile stream
$90953D  20 AA 93    JSR $93AA         ; Update vertical tile stream
$909540  CE 3A 0F    DEC $0F3A         ; Unlock VRAM transfers ($7E:0F3A--)
$909543  AB          PLB
$909544  6B          RTL               ; Return to caller
```

---

## 3. Reconstructed Clean C Implementation

```c
#include <stdint.h>
#include <stdbool.h>

#define SCREEN_WIDTH        256
#define SCREEN_HEIGHT       224
#define HALF_SCREEN_WIDTH   128
#define HALF_SCREEN_HEIGHT  112

typedef struct {
    uint16_t vram_lock;      // $7E:0F3A: VRAM upload safety lock
    uint16_t tracked_entity; // $7E:0F42: Pointer to entity record
    uint16_t min_x;          // $7E:23E9: Room left margin
    uint16_t min_y;          // $7E:23EB: Room top margin
    uint16_t max_x;          // $7E:23ED: Room right margin
    uint16_t max_y;          // $7E:23EF: Room bottom margin
    int16_t  fixed_target_x; // $7E:242B: Fixed anchor X (-1 = follow entity)
    int16_t  fixed_target_y; // $7E:242D: Fixed anchor Y (-1 = follow entity)
    uint16_t scroll_mode;    // $7E:241F: Metatile update pattern
    uint16_t camera_x;       // DP $BF / $59
    uint16_t camera_y;       // DP $C1 / $5B
} CameraSystemContext;

extern CameraSystemContext g_camera;
extern const uint8_t       g_wram[0x20000];

extern void update_bg_tile_stream(uint16_t x, uint16_t y);

/**
 * Calculates camera focus point, centers the viewport, and clamps to room boundaries.
 * Corresponds to $90:94AB.
 */
void camera_center_and_clamp(void) {
    uint16_t center_x;
    uint16_t center_y;

    // 1. Determine Target Center Position
    if (g_camera.fixed_target_x >= 0) {
        // Fixed Anchor Cutscene Target
        center_x = (uint16_t)g_camera.fixed_target_x + HALF_SCREEN_WIDTH;
        center_y = (uint16_t)g_camera.fixed_target_y + HALF_SCREEN_HEIGHT;
    } else {
        // Tracked Entity Target (Boy or Dog)
        uint16_t entity_addr = g_camera.tracked_entity;
        center_x = *(const uint16_t *)&g_wram[entity_addr + 0x1A];
        center_y = *(const uint16_t *)&g_wram[entity_addr + 0x1C];
    }

    // 2. Lock VRAM Updates during camera repositioning
    g_camera.vram_lock++;

    // 3. Compute Top-Left Viewport Origin and Clamp X
    int32_t view_x = (int32_t)center_x - HALF_SCREEN_WIDTH;
    if (view_x < (int32_t)g_camera.min_x) {
        view_x = g_camera.min_x;
    } else if (view_x + SCREEN_WIDTH > (int32_t)g_camera.max_x) {
        view_x = (int32_t)g_camera.max_x - SCREEN_WIDTH;
    }
    g_camera.camera_x = (uint16_t)view_x;

    // 4. Compute Top-Left Viewport Origin and Clamp Y
    int32_t view_y = (int32_t)center_y - HALF_SCREEN_HEIGHT;
    if (view_y < (int32_t)g_camera.min_y) {
        view_y = g_camera.min_y;
    } else if (view_y + SCREEN_HEIGHT > (int32_t)g_camera.max_y) {
        view_y = (int32_t)g_camera.max_y - SCREEN_HEIGHT;
    }
    g_camera.camera_y = (uint16_t)view_y;

    // 5. Update Background Tile Streaming Rows/Columns
    update_bg_tile_stream(g_camera.camera_x, g_camera.camera_y);

    // 6. Unlock VRAM Updates
    g_camera.vram_lock--;
}
```
