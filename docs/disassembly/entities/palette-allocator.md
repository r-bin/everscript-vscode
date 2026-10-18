# Dynamic Sprite Palette Allocator, Free Slot Search & Slot 4 Stealing

- **ROM Locations**:
  - `sprite_palette_allocator`: `$90:CD80` – `$90:CDAE`
  - `palette_free_slot_search`: `$90:CDAF` – `$90:CE91`
  - `palette_steal_slot_4`: `$90:CE92` – `$90:CEB0`
- **CPU State**: 16-bit A/X (`REP #$30`), Data Bank `$7E` / `$90`
- **WRAM Core Addresses**:
  - `$7E:0DE0` – `$7E:0DF7`: Sprite palette assignment table (slots 0..7, corresponding to SNES CGRAM palettes 8..15 / colors 128..255).
  - `$7E:0DF8`: Frame age / LRU eviction counter.
  - `$7E:0DFA`: Palette upload queue pointer for VBLANK DMA.
  - Entity slot offset `+0x24`: Palette assignment index (bits 9..11 in OAM attribute word).

---

## 1. Architectural Role & Palette Virtualization

The Super Nintendo hardware permits only **8 palette groups (palettes 8..15, 16 colors each)** for all on-screen sprites. Secret of Evermore dynamically manages this constrained resource across dozens of active enemies, projectiles, NPCs, and items:

```mermaid
flowchart TD
    Spawn["Entity Spawn Request (Enemy, NPC, Projectile)"] --> Allocator["sprite_palette_allocator ($90:CD80)"]
    Allocator --> MatchCheck["Search Loaded Palettes: palette_free_slot_search ($90:CDAF)"]
    
    MatchCheck --> IsLoaded{"Identical Palette Already in Slot?"}
    IsLoaded -->|Yes| ReuseSlot["Reuse Existing Slot (2..7) -> Increment Ref Count"]
    IsLoaded -->|No| FindEmpty{"Any Free Slot Available? (Ref Count == 0)"}
    
    FindEmpty -->|Yes| LoadSlot["Allocate Free Slot -> Queue DMA Upload ($7E:0DFA)"]
    FindEmpty -->|No (Exhausted)| StealSlot["palette_steal_slot_4 ($90:CE92)"]

    StealSlot --> EvictLRU["Evict Oldest Unpinned Dynamic Slot (Slot 4 / LRU)"]
    EvictLRU --> Overwrite["Overwrite Palette -> Queue DMA Upload"]
    
    ReuseSlot --> Assign["Assign Palette Index (0..7) to Entity Offset +0x24"]
    LoadSlot --> Assign
    Overwrite --> Assign
```

### 1. Dedicated vs Dynamic Palette Slots
- **Slot 0 & Slot 1**: Permanently pinned for the Boy (`Slot 0`) and Dog companion (`Slot 1`). They are never evicted or stolen.
- **Slots 2 & 3**: Typically reserved for recurring combat projectiles (bazooka rockets, alchemical spell particles).
- **Slots 4, 5, 6, 7**: Dynamic allocation pool for roaming enemies, bosses, and room NPCs.

### 2. Free Slot Search & Deduplication (`$90:CDAF`)
- Compares the entity's 16-bit palette asset ID against the active entries in `$7E:0DE0`.
- If an exact match is already loaded, reuses that slot and bumps its reference counter.
- If not loaded, checks for any slot with a reference counter of zero.

### 3. Slot 4 Stealing & LRU Eviction (`$90:CE92`)
- When a new enemy spawns and all 6 dynamic palette slots are occupied, the allocator executes `palette_steal_slot_4`.
- Evicts slot 4 (or the slot with the lowest timestamp in `$7E:0DF8`), overwriting its 16 color values in CGRAM shadow RAM and queueing a VBLANK DMA transfer via `$80:8616`.

---

## 2. Disassembly & Annotations

```assembly
; ==============================================================================
; sprite_palette_allocator ($90:CD80)
; ==============================================================================
$90CD80  DA          PHX
$90CD81  5A          PHY
$90CD82  B9 22 00    LDA $0022,y       ; Palette asset ID from sprite descriptor
$90CD85  85 12       STA $12
$90CD87  20 AF CD    JSR $CDAF         ; palette_free_slot_search
$90CD8A  90 0C       BCC $90CD98       ; Carry Clear -> slot successfully found!

; All dynamic slots full: steal slot 4:
$90CD8C  20 92 CE    JSR $CE92         ; palette_steal_slot_4
$90CD8F  A9 04 00    LDA #$0004        ; Assigned to stolen slot 4
$90CD92  99 24 00    STA $0024,y       ; Store palette index in entity +0x24
$90CD95  7A          PLY
$90CD96  FA          PLX
$90CD97  6B          RTL

$90CD98  8A          TXA               ; Slot index returned in X (2..7)
$90CD99  99 24 00    STA $0024,y       ; Store allocated palette index
$90CD9C  7A          PLY
$90CD9D  FA          PLX
$90CD9E  6B          RTL

; ==============================================================================
; palette_free_slot_search ($90:CDAF)
; ==============================================================================
$90CDAF  A2 02 00    LDX #$0002        ; Start at dynamic slot 2 (skip Boy/Dog)
$90CDB2  8A          TXA
$90CDB3  0A          ASL A             ; 2 bytes per palette ID
$90CDB4  A8          TAY
$90CDB5  B9 E0 0D    LDA $0DE0,y       ; Loaded palette asset ID
$90CDB8  C5 12       CMP $12           ; Matches target asset ID?
$90CDBA  F0 18       BEQ $90CDD4       ; Reuse match!

$90CDBC  E8          INX
$90CDBD  E0 08 00    CPX #$0008        ; Scanned all 8 slots?
$90CDC0  90 F0       BCC $90CDB2

; Second pass: scan for empty slot (ID == 0):
$90CDC2  A2 02 00    LDX #$0002
$90CDC5  8A          TXA
$90CDC6  0A          ASL A
$90CDC7  A8          TAY
$90CDC8  B9 E0 0D    LDA $0DE0,y
$90CDCB  F0 07       BEQ $90CDD4       ; Empty slot found!
$90CDCD  E8          INX
$90CDCE  E0 08 00    CPX #$0008
$90CDD1  90 F2       BCC $90CDC5
$90CDD3  38          SEC               ; No slots available -> steal required
$90CDD4  18          CLC               ; Slot found in X
$90CDD5  60          RTS

; ==============================================================================
; palette_steal_slot_4 ($90:CE92)
; ==============================================================================
$90CE92  A5 12       LDA $12           ; New palette asset ID
$90CE94  8D E8 0D    STA $0DE8         ; Overwrite slot 4 in $7E:0DE0 + 4*2
$90CE97  22 40 86 80 JSL $808640       ; Queue 16-color CGRAM DMA upload
$90CE9B  60          RTS
```

---

## 3. Reconstructed Clean C Implementation

```c
#include <stdint.h>
#include <stdbool.h>

#define TOTAL_SPRITE_PALETTES 8
#define DYNAMIC_PALETTE_START 2 // Slots 0 and 1 are pinned for Boy & Dog
#define STOLEN_PALETTE_SLOT   4

typedef struct {
    uint16_t asset_id;      // Unique palette identifier
    uint16_t ref_count;     // Active entities using this palette
    uint32_t last_used_age; // LRU eviction timestamp
} PaletteSlot;

extern PaletteSlot g_sprite_palettes[TOTAL_SPRITE_PALETTES]; // $7E:0DE0
extern uint32_t g_palette_frame_counter;                     // $7E:0DF8

extern void queue_cgram_palette_dma(uint8_t slot_idx, uint16_t asset_id); // $80:8640

/**
 * Searches for an existing loaded palette or a completely free slot.
 * Corresponds to $90:CDAF.
 */
static int8_t palette_free_slot_search(uint16_t asset_id) {
    // Pass 1: Deduplication search for identical loaded palette
    for (int i = DYNAMIC_PALETTE_START; i < TOTAL_SPRITE_PALETTES; i++) {
        if (g_sprite_palettes[i].asset_id == asset_id) {
            g_sprite_palettes[i].ref_count++;
            g_sprite_palettes[i].last_used_age = g_palette_frame_counter;
            return i;
        }
    }

    // Pass 2: Search for empty slot (ref_count == 0)
    for (int i = DYNAMIC_PALETTE_START; i < TOTAL_SPRITE_PALETTES; i++) {
        if (g_sprite_palettes[i].ref_count == 0) {
            g_sprite_palettes[i].asset_id = asset_id;
            g_sprite_palettes[i].ref_count = 1;
            g_sprite_palettes[i].last_used_age = g_palette_frame_counter;
            queue_cgram_palette_dma(i, asset_id);
            return i;
        }
    }

    return -1; // No free slots available
}

/**
 * Steals slot 4 (or oldest LRU slot) when palette capacity is exceeded.
 * Corresponds to $90:CE92.
 */
static uint8_t palette_steal_slot_4(uint16_t asset_id) {
    uint8_t slot = STOLEN_PALETTE_SLOT;

    g_sprite_palettes[slot].asset_id = asset_id;
    g_sprite_palettes[slot].ref_count = 1;
    g_sprite_palettes[slot].last_used_age = g_palette_frame_counter;

    queue_cgram_palette_dma(slot, asset_id);
    return slot;
}

/**
 * Dynamic sprite palette allocator: deduplicates, allocates, or evicts.
 * Corresponds to $90:CD80.
 */
uint8_t sprite_palette_allocator(uint16_t asset_id) {
    int8_t slot = palette_free_slot_search(asset_id);
    if (slot >= 0) {
        return (uint8_t)slot;
    }

    // All dynamic slots exhausted: steal slot 4
    return palette_steal_slot_4(asset_id);
}
```
