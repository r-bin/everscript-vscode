# Ring Menu Engine & Item Descriptor Subsystem

- **ROM Locations**:
  - `ring_menu_icon_table`: `$8E:8000` – `$8E:8143` (array of 16-bit pointers)
  - `ring_menu_item_descriptors`: `$8E:8144` – `$8E:83FF` (8-byte item structs)
  - `ring_menu_select_and_cost_check`: `$8E:8D80` – `$8E:8DC5`
- **CPU State**: 16-bit A/X (`REP #$30`), Data Bank `$8E`
- **WRAM Core Addresses**:
  - DP `$95`: Pointer to active ring menu state structure.
  - `$7E:2348`: Player currency / ingredient inventory base.
  - `$7E:0AC6`: Current inventory quantity of selected item.
  - `$7E:0AC8`: High word / maximum allowance for selected item.
  - `$7E:0BC5`: Base item price / ingredient consumption cost.
  - `$7E:05A9`: System interaction status flags (bit 4: rejection error buzz).

---

## 1. Architectural Architecture & Ring Menu Structure

Secret of Evermore adopts the circular "Ring Menu" system from Secret of Mana. When pressing SELECT or opening a submenu:
1. Active gameplay pauses while the ring icons rotate into position around the player or companion.
2. The icons are indexed by the 16-bit pointer table at `$8E:8000`.
3. Each item is defined by an 8-byte descriptor in ROM bank `$8E`.

### The 8-Byte Item Descriptor Format
```
Offset  Bytes  Field         Description
+0x00     2    name_ptr      16-bit pointer to name/description string in Bank $8E
+0x02     2    tile_id       16-bit VRAM icon tile pattern and palette selector
+0x04     2    item_flags    Category, target usability (boy/dog), and equip flags
+0x06     2    sub_index     Sub-item ID (Alchemy formula index, item index, weapon index)
```

---

## 2. Disassembly & Annotations

### Part 1: Selection & Cost Validation (`$8E:8D80`)
> **Interactive 65816 Assembly**:
> Centralized comments infused at runtime.
> [View in VFS: soe://rom/code/8E8000](soe://rom/code/8E8000?asm=1&c=0)


---

## 3. Reconstructed Clean C Implementation

> **Reconstructed C Decompilation**:
> Source moved to [`reconstructed-c/8E/8E8000_ring_menu.c`](../../../reconstructed-c/8E/8E8000_ring_menu.c).
> [View in VFS: soe://rom/code/8E8000](soe://rom/code/8E8000?c=1&asm=0)

