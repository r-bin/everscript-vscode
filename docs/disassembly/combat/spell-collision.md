# Spell Impact Collision & Multi-Target Hitbox Projection

**Addresses**:
- `spell_screen_projection_with_elevation`: `$8F:C824` – `$8F:C84B`
- `spell_hit_target_bounding_box_test`: `$8F:C84C` – `$8F:C86B`
- `spell_multi_target_aoe_dispatcher`: `$8F:C86C` – `$8F:C8DD`
- `spell_script_payload_unpack`: `$8F:C8DE` – `$8F:C904`

**ROM Source**: Bank `$8F` (US 1.0)
**Subsystem**: Combat Engine / Alchemy Spell Subsystem

---

## 1. Overview & Architectural Role

When an alchemy formula is cast (e.g., Flash, Fireball, Acid Rain, Nitro), the spell creates one or more projectile or particle clusters that travel across the room and trigger damage calculations upon impact. Unlike simple 2D collision tests, Secret of Evermore uses a 2.5D elevation projection system where vertical Z-height offsets the visual particle position without altering ground tile collision.

Key mechanisms:
1. **Screen Projection with Elevation (`spell_screen_projection_with_elevation`)**:
   Transforms entity world coordinates $(X_w, Y_w, Z_w)$ into screen space:
   $$X_s = X_w + \text{offset}_x - \text{CameraX}$$
   $$Y_s = Y_w + \text{offset}_y - \frac{\sim Z_w}{16} - \text{CameraY}$$
   The Z height is bitwise inverted (`EOR #$7FFF`), shifted right by 4, and offset by `$0800` to correctly account for isometric elevation perspective.
2. **Multi-Target AOE Hitbox Iteration (`spell_multi_target_aoe_dispatcher`)**:
   Walks an array of 14-byte hit definitions. For each segment, it calculates relative X/Y offsets, evaluates height thresholds, and submits valid particle slices to the OAM compositor (`$80:960A`).
3. **Dynamic Script Payload Unpacking (`spell_script_payload_unpack`)**:
   Unpacks byte streams from spell bytecode scripts (`[$5D],Y`) directly into active projectile parameters, configuring particle depth, target flags, and animation frames.

---

## 2. Data Structures & Memory Layout

> **Reconstructed C Decompilation**:
> Source moved to [`reconstructed-c/8F/8FC824_spell_collision.c`](../../../reconstructed-c/8F/8FC824_spell_collision.c).
> [View in VFS: soe://rom/code/8FC824](soe://rom/code/8FC824?c=1&asm=0)


---

## 3. Clean C Decompilation

> **Reconstructed C Decompilation**:
> Source moved to [`reconstructed-c/8F/8FC824_spell_collision.c`](../../../reconstructed-c/8F/8FC824_spell_collision.c).
> [View in VFS: soe://rom/code/8FC824](soe://rom/code/8FC824?c=1&asm=0)


---

## 4. Verification & Behavioral Equivalence

1. **Elevation Formula**: Matches assembly `$8F:C833` (`EOR #$7FFF; LSR x4; SBC #$0800`): accounts for isometric elevation in screen space.
2. **14-Byte Stride**: Iteration loop `$8F:C8D3` uses `ADC #$000E` to step through multi-target segment descriptors.
3. **Depth Culling**: Emulates `BMI / BEQ $C8D3` culling particles when calculated depth falls below ground plane.
