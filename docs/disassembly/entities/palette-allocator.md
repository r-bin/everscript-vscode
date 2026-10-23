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

> **Interactive 65816 Assembly**:
> Centralized comments infused at runtime.
> [View in VFS: soe://rom/code/90CD80](soe://rom/code/90CD80?asm=1&c=0)


---

## 3. Reconstructed Clean C Implementation

> **Reconstructed C Decompilation**:
> Source moved to [`reconstructed-c/90/90CD80_palette_allocator.c`](../../../reconstructed-c/90/90CD80_palette_allocator.c).
> [View in VFS: soe://rom/code/90CD80](soe://rom/code/90CD80?c=1&asm=0)

