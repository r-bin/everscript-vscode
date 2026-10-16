---
name: secret-of-evermore-engine
description: Explains how the Secret of Evermore engine functions, including player/companion mechanics, enter scripts, step-on triggers, B-triggers, entity slots, and dog AI quirks.
---

# Secret of Evermore Game Engine Mechanics

Secret of Evermore runs on an engine originally derived from *Secret of Mana* (Square, 1993), but heavily refactored by Square USA. Understanding the engine's core execution loops and entity models is essential for writing bug-free scripts and custom rooms.

---

## 1. Dual-Protagonist System (Boy & Dog)

- **1 Active Player:** At any given frame, exactly one character is player-controlled.
- **Companion AI:** The non-controlled character is driven by engine AI routines:
  - When controlling the Boy, the Dog follows, sniffs out alchemy ingredients, or attacks nearby enemies according to its behavioral aggression settings.
  - When controlling the Dog, the Boy follows and attacks.
  - Pressing `SELECT` toggles active control between Boy and Dog.
- **Engine Quirk (Companion Desync):**
  - If a script teleports the Boy or loads a new room without explicitly synchronizing the companion, the Dog can spawn at coordinate `(0, 0)` or get pulled across transition boundaries inappropriately.
  - Cutscene scripts must use standard partner freeze/guard flags (`$22EB & 0x20`) during scripted sequences.

---

## 2. Room Execution & Trigger Architecture

Every room in Evermore has three primary execution pipelines:

```
Room Load
    │
    ▼
1. Enter Script ──► Sets music, camera lock, spawns NPCs/enemies, evaluates story flags
    │
    ▼
Active Gameplay Loop (Every Frame)
    ├──► 2. Step-On Triggers (Checks player coordinates against tile bounding boxes)
    └──► 3. B-Triggers (Checks player proximity + B-button press or weapon swing)
```

### 2.1 Enter Scripts
- Executed synchronously when the player transitions into a room.
- Standard tasks:
  1. Call `init_map(...)` with coordinate boundaries.
  2. Set room music: `music(MUSIC.CAVES_OF_DANGER)`.
  3. Load enemies and NPCs using sprite IDs and spawn coordinates.
  4. Branch on progression flags (e.g., if boss is defeated, skip boss cutscene and leave room in cleared state).

### 2.2 Step-On Triggers
- Defined as rectangular boxes in absolute 16-px cells: `[x0, y0 : x1, y1]`. In entity pixel
  space a box is `(cell − room origin) × 16`; the origin is at `$7E0F86`/`$0F88` (= bytes 0/1 of
  the room data). `tools/recomp/room-nav.js` prints them with their destination rooms.
- Checked while the player **moves**: writing the Boy's coordinates into a box does nothing until
  he takes a step onto it (verified headless, v0.201.18).
- Used for:
  - Room exits: calling `map_transition(MAP.NEXT_ROOM, ENTRANCE, DIRECTION)`.
  - Environmental traps: pit falls, quicksand, pressure plates.
  - Cutscene triggers: stepping past an invisible line starts a scripted sequence.

Enemy spawn positions in enter scripts are absolute 8-px units (pixel = unit × 8, no origin).

### 2.3 B-Triggers (Interactions)
- Activated when the player presses the **B button** facing an object, or strikes it with a weapon:
  - **Chests & Gourds:** Displays loot animation, writes persistence flag (`$2268..$22AA`), awards item/ingredient.
  - **NPC Dialogue:** Pauses player movement, displays text dialog window via string keys.
  - **Sniff Spots:** When the Dog's nose animates near a sniff coordinate, pressing B digs up hidden alchemy ingredients.
  - **Obstacles:** Striking an axe-barrier or spear-post checks current weapon (`$235F` / `$2360`) and clears obstacle tiles if criteria are met.

---

## 3. Entity Tables & Enemy Spawning

- Entity records are 0xAE bytes long and linked through `+$5E`: the Dog at `$7E4F37` points to the Boy at `$7E4E89` (x `+$1A`, y `+$1C`, HP `+$2A`; see `src/games/evermore/localizations/knowledge/ram/7e4e89.md`). The old claim of a slot table at `$7E1000..$7E1FFF` is unverified. Enemies are not in that Dog→Boy chain; their home positions sit in per-spawn records near `$7E3DFF` (stride 0x8E, x/y words), observed in room 0x38 (v0.201.18).
- When loading an enemy:
  - Sprite graphic patterns are loaded into VRAM.
  - Hitbox definitions, HP, attack power, and AI routine pointers are assigned.
  - Three prize slots are loaded: drop item 1, drop item 2, drop item 3, along with their respective drop rates and quantities.
- An engine hook system at `$0EAC` tracks 3 active slots (offsets `+0`, `+4`, `+8`) in every room that manages enemy instances.

---

## Frame loop and sprite tiles (v0.201.19)

- The field tick ends in `$8F:9817`, a spare-time loop: until the NMI bumps `$7E0100` it runs entity
  tasks round-robin, then `$80:8F85` finishes the frame. Frame boundaries usually fall inside it.
- Dynamic 8×8 OBJ tiles live in an LRU cache of 128 slots (slot = OBJ tile number), kept as two
  doubly linked lists at `$7E9727` (next) / `$7E96A5` (prev), sentinels `$80` (cache) and `$81`
  (used this frame). `$80:A4B5` allocates, queues uploads at `$7E15D6`; the NMI uploads only while
  `$7E00D9` != 0. Tiles `$80`+ (HUD portrait) are not slots: a broken list hands one out anyway.
