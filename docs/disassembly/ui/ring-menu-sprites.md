# Ring Menu Item Icon Loader & Circular Sprite Layout

**Addresses**:
- `ring_menu_render_frame`: `$8E:AE85` – `$8E:AEBB`
- `ring_menu_load_item_icons`: `$8E:AEBC` – `$8E:AEF4`
- `ring_menu_calculate_icon_angles`: `$8E:B000` – `$8E:B075`
- `ring_menu_rotate_step`: `$8E:B076` – `$8E:B0C0`

**ROM Source**: Bank `$8E` (US 1.0)
**Subsystem**: User Interface / Ring Menu Engine

---

## 1. Overview & Architectural Role

The Secret of Evermore Ring Menu provides the signature circular weapon/alchemy/item selection interface inherited from the *Secret of Mana* lineage. Unlike traditional flat menus, items in Evermore are arranged radially along an elliptical orbit centered around the active player character or companion dog.

Key mechanisms:
1. **Dynamic Icon VRAM Staging (`ring_menu_load_item_icons`)**:
   Iterates through items present in the selected ring menu category (referenced by inventory pointer in DP `$95`). For each item slot, it looks up the item's sprite graphics identifier from `$8E:0004,X`, invokes the sprite VRAM allocator (`$90:CEED`), maps the palette attribute word (`$8E:0002,X`), and stores the sprite descriptor into a 16-byte slot entry in table `$7E:06A3`.
2. **Circular Angular Geometry (`ring_menu_calculate_icon_angles`)**:
   Uses the SNES hardware math coprocessor (`$4204` dividend, `$4206` divisor) to divide a full circle ($256$ angular units $= 2\pi$) by the total count of items in the current ring ($N = \text{slot\_count}$):
   $$\theta_i = \left\lfloor \frac{i \times 256 + 128}{N} \right\rfloor$$
   This yields perfectly balanced radial distribution whether the ring contains 2, 4, or 8 items.
3. **Smooth Rotation & Item Snapping (`ring_menu_rotate_step`)**:
   Calculates the minimal angular displacement between the current ring rotation angle (`$7E:061B`) and the target angle (`$7E:061D`), interpolating smooth rotational motion across frames until snapping into focus.

---

## 2. Data Structures & Memory Layout

> **Reconstructed C Decompilation**:
> Source moved to [`reconstructed-c/8E/8EAE85_ring_menu_sprites.c`](../../../reconstructed-c/8E/8EAE85_ring_menu_sprites.c).
> [View in VFS: soe://rom/code/8EAE85](soe://rom/code/8EAE85?c=1&asm=0)


---

## 3. Clean C Decompilation

> **Reconstructed C Decompilation**:
> Source moved to [`reconstructed-c/8E/8EAE85_ring_menu_sprites.c`](../../../reconstructed-c/8E/8EAE85_ring_menu_sprites.c).
> [View in VFS: soe://rom/code/8EAE85](soe://rom/code/8EAE85?c=1&asm=0)


---

## 4. Verification & Behavioral Equivalence

1. **Hardware Divider Verification**: Matches SNES register sequence `$4204` (`WRDIVL = (selected << 8) | 0x80`), `$4206` (`WRDIVB = count`), and `$4214` (`RDDIVL = $061D`).
2. **Radial Angular Balance**: Guarantees equidistant spacing around $360^\circ$ for arbitrary inventory lengths.
3. **Rotational Snapping**: Verified against assembly `$8E:B06A` – `$8E:B076` (`CMP #$0004` threshold, applying 3-unit rotational velocity `LDA #$0003`).

