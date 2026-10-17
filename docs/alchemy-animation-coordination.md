# Alchemy Animation Coordination (Bank $91 ASM & Animation VM)

In Secret of Evermore, alchemy spells have **no high-level scripting language**. While room transitions, map events, and NPC dialogues run on Everscript bytecode, and visual sprite sequences run on the Animation Script VM (Bank `$90`), the lifecycle and coordination of alchemy formulas are executed entirely by **native 65816 assembly (ASM)** in **Bank `$91`**.

This document describes how multi-phase animations (e.g. Phase A and Phase B) are stored, who coordinates them, and how the animation VM and native assembly communicate.

---

## 1. Overview: The Split-Role Architecture

```
       ROM Master Tables ($C4)
        │  $C4:5DDF (ALCHEMY_ANIM_MAP)
        ▼
       Formula Descriptor Blocks ($91:80A6)
        │  Stores 1–3 Animation Record IDs ($C4:xxxx)
        ▼
   ┌─────────────────────────────────────────────────────────┐
   │ Bank $91 Native ASM Coordinator                         │
   │  - Dispatches Phase A to Animation VM                   │
   │  - Polls slot +0x26 bit 1 ($91:9BCC, $91:9D2E, $91:A53A)│
   └────────────────────────┬────────────────────────────────┘
                            │ Handshake via 0x5D effect_done
                            ▼
   ┌─────────────────────────────────────────────────────────┐
   │ Bank $90 Animation Script VM ($90:80D0)                 │
   │  - Plays Phase A bytecode in effect slot ($7E:3364..)   │
   │  - Executes opcode 0x5D -> sets +0x26 bit 1             │
   └────────────────────────┬────────────────────────────────┘
                            │
                            ▼
   ┌─────────────────────────────────────────────────────────┐
   │ Bank $91 ASM Advances & Resolves                        │
   │  - Triggers effect handler (Damage/Heal/Buff)           │
   │  - Dispatches Phase B animation record to VM            │
   └─────────────────────────────────────────────────────────┘
```

---

## 2. Formula Descriptor Blocks in Bank `$91`

When a formula is cast:
1. The formula index (`0x00`..`0x44`, step 2) indexes `ALCHEMY_ANIM_MAP` at `$C4:5DDF`.
2. This yields an offset into the table at `$91:80A6`, pointing to the formula's data block in Bank `$91` (e.g., `$91:86F0` for Acid Rain).
3. The block is a **data structure, not 65816 code or bytecode**.
4. 32 of the 35 vanilla formula blocks hold **one to three 16-bit animation record IDs** (`$C4:xxxx` pointing into the master animation table at `$C4:3E3A`) at even offsets `+4..+28`. (Three formulas—Atlas, Corrosion, and Escape—hold none).

These multiple record IDs represent the different visual phases of the spell:
- **Phase A (Initial/Cast):** E.g., charging energy, gathering particles, or firing cast elements.
- **Phase B (Impact/Effect):** E.g., falling acid rain drops, an explosion burst, or rising healing numerals.
- **Phase C (Linger/Dissipate):** Lingering smoke, ripples, or sparkles where applicable.

---

## 3. The Visual Player: Animation Script VM (Bank `$90`)

Each visual phase runs as an ordinary animation script:
- It occupies one of 8 concurrent alchemy effect slots in WRAM (`$7E:3364`..`$7E:3563`, 64 bytes each).
- It is executed frame-by-frame by the animation interpreter at `$90:80D0`.
- The animation script handles only sprite graphics, holds, movement steps, and palettes. It does not know about target HP, magic defense, or ingredient costs.

---

## 4. The Handshake: Opcode `0x5D` (`effect_done`)

To synchronize visual animation phases with spell mechanics, the animation VM provides opcode **`0x5D` (`effect_done`)**:
- Handler address: `$90:8C75`.
- Behavior: Sets **bit 1 of entity slot offset `+0x26`** (`entity[+0x26] |= 0x02`).
- Census: Of 114 occurrences of `0x5D` in the ROM, 106 appear immediately followed by another record's start byte, marking the end of that animation phase script. The remaining 8 signal mid-script keyframes while playback continues.

---

## 5. The Coordinator: Bank `$91` Native ASM

Bank `$91` 65816 assembly operates as the supervisor / coordinator:

1. **Phase Setup:**
   Cast routine `$91:CCD8` deducts ingredients, calculates power, initializes the effect slot, and starts the Phase A animation record via `$90:8124`.

2. **Phase Polling:**
   During the frame loop, Bank `$91` polling routines (`$91:9BCC`, `$91:9D2E`, `$91:A53A`) inspect `+0x26` bit 1 of the active effect slot.

3. **Phase Handover & Effect Resolution:**
   When bit 1 is detected:
   - **Effect Handler Execution:** Depending on the formula type, ASM invokes the resolution routines:
     - Damage: `$91:9C90` (computes Net Damage = `Power * (64 - Magic_Defense) / 64`).
     - Healing: `$91:9D16` (applies HP boost directly, checks Moxa Stick, invokes blue number floater).
     - Status Buffs: `$91:B137` (applies stat additions, sets duration frame timers).
   - **Phase Advance:** If the `$91` data block specifies a subsequent animation record (Phase B), ASM re-initializes the slot's script pointer to that record and clears the `+0x26` done flag.
   - **Termination:** When all phases are complete, ASM frees the effect slot and releases entity lock.

