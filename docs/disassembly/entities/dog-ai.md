# Companion AI State Machine & Sniffing Logic ($8C:DAC5, $8F:CD4D, $92:A44C)

> **Subsystem**: Entity & Companion AI Engine  
> **ROM Addresses**: `$8C:DAC5` (`companion_input_ai_dispatcher`), `$8F:CD4D` (`companion_entity_update`), `$92:A44C` (Global Script `0x39` Sniff Spot)  
> **Clean C Module**: `entities/dog-ai.c`  
> **Recomp Symbol**: `func_CCDAC5_M0X0`, `func_CFCD4D_M0X0`  
> **Confidence**: Confirmed

---

## 1. Architectural Role

Secret of Evermore features a dual-protagonist party: the **Boy** (primary entity slot at `$7E:4E89`) and his canine companion, the **Dog** (companion entity slot at `$7E:4F37`).
At any frame:
- Exactly one protagonist is directly controlled by human controller input (tracked by active player index in direct page `$02` / `$7E:0002`).
- The non-controlled companion character is driven autonomously by the engine companion AI subsystem (`$8C:DAC5` and `$8F:CD4D`).
- When controlling the Boy, the Dog follows, sniffs out hidden alchemy ingredient spots on the ground, or attacks nearby enemies according to behavioral aggression settings.
- When controlling the Dog, the Boy follows and engages targets.
- Sniffing spots trigger global script `0x39` (`$92:A44C`), causing the Dog to execute a sniffing/digging animation keyframe sequence and the player to dig up alchemy ingredients via B-button interaction.

---

## 2. Companion Entity Structure & Constants

> **Reconstructed C Decompilation**:
> Source moved to [`reconstructed-c/8C/8CDAC5_dog_ai.c`](../../../reconstructed-c/8C/8CDAC5_dog_ai.c).
> [View in VFS: soe://rom/code/8CDAC5](soe://rom/code/8CDAC5?c=1&asm=0)


---

## 3. Disassembly Analysis

> **Interactive 65816 Assembly**:
> Centralized comments infused at runtime.
> [View in VFS: soe://rom/code/8CDAC5](soe://rom/code/8CDAC5?asm=1&c=0)


---

## 4. Clean C Implementation

> **Reconstructed C Decompilation**:
> Source moved to [`reconstructed-c/8C/8CDAC5_dog_ai.c`](../../../reconstructed-c/8C/8CDAC5_dog_ai.c).
> [View in VFS: soe://rom/code/8CDAC5](soe://rom/code/8CDAC5?c=1&asm=0)

