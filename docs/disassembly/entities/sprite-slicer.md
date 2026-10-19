# Character Sprite VRAM Slot Allocator & Slicing Compositor

**Addresses**:
- `sprite_vram_3slot_cache_alloc`: `$90:CEED` – `$90:CF39`
- `sprite_slice_descriptor_composite`: `$90:CF3A` – `$90:CF75`
- `sprite_tile_vram_dma_enqueue`: `$90:CFB8` – `$90:CFEF`

**ROM Source**: Bank `$90` (US 1.0)
**Subsystem**: Actor & Animation Engine / Sprite VRAM Allocator

---

## 1. Overview & Architectural Role

Secret of Evermore relies on dynamic, on-demand VRAM streaming to render large, multi-tile actors, bosses, and animated player forms without exhausting the SNES 64KB VRAM budget.

Key mechanisms:
1. **3-Slot Associative VRAM Cache (`sprite_vram_3slot_cache_alloc`)**:
   Maintains a 3-entry LRU-like cache at `$7E:1288`, `$7E:128A`, and `$7E:128C`. When an actor or projectile requests graphics for an asset ID:
   - Evaluates slot 0 (`$1288`), slot 1 (`$128A`), and slot 2 (`$128C`).
   - If an asset ID matches, returns the slot index immediately (hit).
   - If missing, locates an empty slot (`0x0000`), binds the asset ID, and queues asynchronous tile streaming via DMA.
2. **Sprite Slice Assembly (`sprite_slice_descriptor_composite`)**:
   Unpacks 12-byte sprite slice descriptors (`+$02`..`+$0C,Y`) into the active OAM frame buffer at `$7E:6289`, computing composite offsets and priority flags for multi-tile bodies.
3. **VRAM DMA Transfer Queueing (`sprite_tile_vram_dma_enqueue`)**:
   Computes ROM tile source offsets in Bank `$90`, calculates destination VRAM word addresses (`$2E`), and registers the transfer with the engine DMA manager via `$80:85FA`.

---

## 2. Data Structures & Memory Layout

```c
// 3-Slot Sprite Asset Cache in WRAM:
// $7E:1288 - Cached Asset ID for Slot 0 (VRAM base $4000)
// $7E:128A - Cached Asset ID for Slot 1 (VRAM base $4800)
// $7E:128C - Cached Asset ID for Slot 2 (VRAM base $5000)

// Active OAM Frame Buffer ($7E:6289..$7E:62A5):
typedef struct OAMSliceDescriptor {
    uint16_t tile_pattern; // +$02: 4bpp tile base word
    int16_t  offset_x;     // +$04: Screen offset X
    int16_t  offset_y;     // +$06: Screen offset Y
    uint16_t attr_flags;   // +$08: Palette, priority, and flip bits
    uint16_t size_flag;    // +$0A: 8x8 vs 16x16 size flag
    uint16_t slot_link;    // +$0C: Sibling link
} OAMSliceDescriptor;
```

---

## 3. Clean C Decompilation

```c
#include <stdint.h>
#include <stdbool.h>

extern uint16_t g_sprite_vram_cache_slots[3]; // $1288, $128A, $128C
extern OAMSliceDescriptor g_oam_frame_slices[8]; // $7E:6289

extern void vram_dma_enqueue_transfer(uint16_t src_offset, uint8_t src_bank,
                                     uint16_t vram_word_dest, uint16_t byte_len); // $80:85FA

/**
 * $90:CEED - sprite_vram_3slot_cache_alloc
 * Queries 3-slot associative VRAM cache for sprite graphics; streams via DMA on miss.
 */
int16_t sprite_vram_3slot_cache_alloc(uint16_t asset_id) {
    // 1. Check for cache hit in slots 0, 1, or 2
    for (int16_t slot = 0; slot < 3; slot++) {
        if (g_sprite_vram_cache_slots[slot] == asset_id) {
            return slot * 2; // Return slot byte index: 0, 2, or 4
        }
    }

    // 2. Cache miss: find first unallocated slot
    for (int16_t slot = 0; slot < 3; slot++) {
        if (g_sprite_vram_cache_slots[slot] == 0) {
            g_sprite_vram_cache_slots[slot] = asset_id;

            // Enqueue VRAM DMA upload for new sprite graphics
            sprite_tile_vram_dma_enqueue(asset_id, slot * 2);

            return slot * 2;
        }
    }

    // All slots occupied
    return 0;
}

/**
 * $90:CF3A - sprite_slice_descriptor_composite
 * Assembles multi-tile slice definitions into active OAM frame buffer.
 */
void sprite_slice_descriptor_composite(const OAMSliceDescriptor* slice_src, uint16_t slot_idx) {
    uint16_t dest_idx = slot_idx << 4; // 16 bytes per slice slot
    OAMSliceDescriptor* dest = (OAMSliceDescriptor*)((uint8_t*)g_oam_frame_slices + dest_idx);

    dest->tile_pattern = slice_src->tile_pattern;
    dest->offset_x     = slice_src->offset_x;
    dest->offset_y     = slice_src->offset_y;
    dest->attr_flags   = slice_src->attr_flags;
    dest->size_flag    = slice_src->size_flag;
    dest->slot_link    = slice_src->slot_link;
}

/**
 * $90:CFB8 - sprite_tile_vram_dma_enqueue
 * Calculates ROM source address and target VRAM word address for DMA transfer.
 */
void sprite_tile_vram_dma_enqueue(uint16_t asset_id, uint16_t slot_idx) {
    // ROM source pattern in Bank $90
    uint16_t src_offset = asset_id;
    uint8_t  src_bank   = 0x90;

    // VRAM destination address: base offset + (slot_idx * 0x0800)
    uint16_t vram_word_addr = 0x4000 + ((slot_idx >> 1) * 0x0800);

    // Enqueue transfer of 512 bytes (16 tiles * 32 bytes/tile)
    vram_dma_enqueue_transfer(src_offset, src_bank, vram_word_addr, 0x0200);
}
```

---

## 4. Verification & Behavioral Equivalence

1. **3-Slot Associative Match**: Matches assembly `$90:CEF6`, `$90:CEFE`, `$90:CF06` comparing against `$1288`, `$128A`, and `$128C`.
2. **OAM Destination Mapping**: Matches multi-word transfer to `$7E:6289,X` with 16-byte stride (`ASL x4; TAX`).
3. **DMA VRAM Addressing**: Matches `$90:CFDB` calculating target word destination for the selected sprite slot.
