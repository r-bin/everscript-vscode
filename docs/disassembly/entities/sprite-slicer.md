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

> **Reconstructed C Decompilation**:
> Source moved to [`reconstructed-c/90/90CEED_sprite_slicer.c`](../../../reconstructed-c/90/90CEED_sprite_slicer.c).
> [View in VFS: soe://rom/code/90CEED](soe://rom/code/90CEED?c=1&asm=0)


---

## 3. Clean C Decompilation

> **Reconstructed C Decompilation**:
> Source moved to [`reconstructed-c/90/90CEED_sprite_slicer.c`](../../../reconstructed-c/90/90CEED_sprite_slicer.c).
> [View in VFS: soe://rom/code/90CEED](soe://rom/code/90CEED?c=1&asm=0)


---

## 4. Verification & Behavioral Equivalence

1. **3-Slot Associative Match**: Matches assembly `$90:CEF6`, `$90:CEFE`, `$90:CF06` comparing against `$1288`, `$128A`, and `$128C`.
2. **OAM Destination Mapping**: Matches multi-word transfer to `$7E:6289,X` with 16-byte stride (`ASL x4; TAX`).
3. **DMA VRAM Addressing**: Matches `$90:CFDB` calculating target word destination for the selected sprite slot.
