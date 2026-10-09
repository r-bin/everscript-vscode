# Enemy AI in Secret of Evermore

> Status: **solved.** Native 65816 assembly routines dispatched at `$8FCD1A` via the
> jump table at `$8FCBE0` in Bank `$8F`.
> Character stats at `$8EB678` (stride 74). Animation VM at `$9080D0`.
> Traced and verified against ROM disassembly.

---

## 1. Overview & Architectural Boundaries

Enemy intelligence in *Secret of Evermore* is divided across three distinct systems that operate at different levels of the engine:

```
┌────────────────────────────────────────────────────────────────────────┐
│ 1. Engine AI Routines (Bank $8F, native 65816 code)                   │
│    - Master dispatch at $8FCD1A via jump table $8FCBE0                 │
│    - Evaluates stamina, dice rolls, proximity, and target tracking     │
│    - Governs state machine (+0x78): roam, advance, attack, retreat    │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │ selects attack & triggers animation
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│ 2. Animation Bytecode VM (Bank $90 at $9080D0, bytecode streams $C4..$CE)│
│    - Executes bytecode for walk, run, cast, and attacks 0–3           │
│    - Emits strike boxes (0x47 dx dy w h) on specific impact frames    │
│    - Emits projectiles (0x4C) or enables charging mode (mode $4000)   │
│    - Handles damage knockback (+0x40) and death/spoils (+0x42/+0x44)  │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │ placed & coordinated by
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│ 3. Room Enter & Event Scripts (Bank $92+, Everscript bytecode)        │
│    - Spawns entities into rooms (opcodes 0x3C, 0xBA, 0xA2, 0xC2)      │
│    - Can override control for cutscenes via attach_script (0x3D, 0x3F)│
│    - Standard combat AI does NOT run through Everscript bytecode       │
└────────────────────────────────────────────────────────────────────────┘
```

The character table at `$8EB678` (74 bytes per record; see [character_table.md](character_table.md)) supplies the parameters that configure each character's AI:

| Offset | Size | Field | Engine Role |
|---|---|---|---|
| `+0x03` | 2 | `behaviour` | Word index into the jump table at `$8FCBE0` (`JMP ($CBE0,X)`) |
| `+0x05` | 2 | `spawn_flags` | Default entity flags (bit 1 `0x0002` = INVINCIBLE for friendly NPCs) |
| `+0x0D` | 2 | `radius` | Collision radius `r` in pixels (body box `2r × r`, hurt box `2r × 2r`) |
| `+0x13` | 2 | `aggro_range` | Distance threshold in pixels (half-width of the aggro square) |
| `+0x15` | 2 | `aggro_chance` | Threshold (0..255) for the RNG roll to engage |
| `+0x2C` | 2 | `charge_limit` | Meter cap on entity stamina `+0x2E` (`$400` = 100%) |
| `+0x2E` | 2 | `charge_speed` | Stamina recharge points added to `+0x2E` every tick (`$8FCC5D`) |
| `+0x30` | 2 | `attack_proc` | Hit resolution routine (`$8FB6A5`; default `$8FB75A`) |
| `+0x32..+0x3E` | 2 each | `stand`, `walk`, `run`, `atk0..atk3` | Animation record pointers in `$C40000` |

---

## 2. How Enemies Identify the Player

The engine tracks active party members in low WRAM:
- `$7E0F3E`: Pointer to Party Member 1 (Boy entity, `$4E89` or `$4E45`)
- `$7E0F40`: Pointer to Party Member 2 (Dog entity, `$4F37` or `$4EB5`)
- `$7E0F42`: Pointer to the currently active (player-controlled) entity

### The Aggro Detection Pipeline (`$8FD69B` – `$8FD6FA`)

Every tick, an active enemy evaluates whether to engage a player character through a strict multi-stage filter:

```
                  ┌──────────────────────────────┐
                  │ Enemy Tick (Entity in Y)     │
                  └──────────────┬───────────────┘
                                 │
                   [Stamina +0x2E >= $0400?]
                                 ├──► NO  ──► Continue roaming / recharging
                                 │
                                 ▼ YES
                     [rand(0..255) < aggro_chance?]
                                 ├──► NO  ──► Abort aggro check for this tick
                                 │
                                 ▼ YES
                  ┌──────────────────────────────┐
                  │ Check Party 1: LDX $0F3E     │
                  │ Check Party 2: LDX $0F40     │
                  └──────────────┬───────────────┘
                                 │
                     [Target HP +0x2A > 0?]
                                 ├──► NO  ──► Skip dead target
                                 │
                                 ▼ YES
                    [|dx| < aggro_range (+0x13)?]
                                 ├──► NO  ──► Target out of range horizontally
                                 │
                                 ▼ YES
                    [|dy| < aggro_range (+0x13)?]
                                 ├──► NO  ──► Target out of range vertically
                                 │
                                 ▼ YES
                  ┌──────────────────────────────┐
                  │ TARGET ACQUIRED!             │
                  │ - Store target pointer: +0x24│
                  │ - Face target ($80ADF0)      │
                  │ - Set Action State (+0x78)   │
                  └──────────────────────────────┘
```

### The 65816 Detection Subroutine

At `$8FD69B`, the check begins:
```assembly
8FD69B  LDA $002E,Y      ; Entity stamina / charge meter
8FD69E  CMP #$0400       ; Must be full (>= 1024)
8FD6A1  BMI $D6C9        ; If not fully charged, abort
8FD6A3  LDX $0060,Y      ; Load character record pointer
8FD6A6  JSL $80859B      ; Call engine RNG (returns 16-bit pseudo-random value)
8FD6AA  AND #$00FF       ; 0..255
8FD6AD  CMP $8E0015,X    ; Compare with character record +0x15 (aggro chance)
8FD6B1  BPL $D6C9        ; If rand >= aggro_chance, failed roll -> abort
8FD6B3  LDA $8E0013,X    ; Load character record +0x13 (aggro range)
8FD6B7  STA $06          ; Store aggro range in DP $06
8FD6B9  LDX $0F3E        ; Load Boy entity pointer
8FD6BC  BEQ $D6C1        ; If absent, check Dog
8FD6BE  JSR $D6CE        ; Test proximity to Boy
8FD6C1  LDX $0F40        ; Load Dog entity pointer
8FD6C4  BEQ $D6C9        ; If absent, exit
8FD6C6  JSR $D6CE        ; Test proximity to Dog
8FD6C9  PLA              ; Abort return
8FD6CA  JML $90828E
```

And the distance comparison subroutine at `$8FD6CE`:
```assembly
8FD6CE  LDA $002A,X      ; Target HP
8FD6D1  BEQ $D6FA        ; Target is dead (HP == 0) -> ignore
8FD6D3  LDA $001A,X      ; Target X
8FD6D7  SBC $001A,Y      ; - Enemy X
8FD6DC  BPL $D6E2
8FD6DE  DEC / EOR #$FFFF ; |dx|
8FD6E2  CMP $06          ; Compare with aggro range
8FD6E4  BCS $D6FA        ; |dx| >= range -> outside horizontal bound
8FD6E6  LDA $001C,X      ; Target Y
8FD6EA  SBC $001C,Y      ; - Enemy Y
8FD6EF  BPL $D6F5
8FD6F1  DEC / EOR #$FFFF ; |dy|
8FD6F5  CMP $06          ; Compare with aggro range
8FD6F7  BCS $D6FA        ; |dy| >= range -> outside vertical bound
8FD6F9  PLA              ; Success! Pop stack so caller returns target locked
8FD6FA  RTS
```

### The Aggro Zone is a Square, Not a Circle
Because the distance check tests `|dx| < range` and `|dy| < range` independently, an enemy's detection field is an **axis-aligned square** of dimensions $2 \times \text{aggro\_range}$, centred at the enemy's feet coordinates $(cx, cy)$. It does not calculate Euclidean distance ($\sqrt{dx^2 + dy^2}$).

---

## 3. How Enemies Chain Animations to Hurt the Player

Once a target is locked, the AI state machine transitions from roaming/patrol to approach and attack.

### 1. Attack Level Selection by Stamina (`$9082D8`)
When close enough to strike, the AI invokes `$9082D8`. This routine inspects current entity stamina (`+0x2E`) to pick which of the character's four attack animation fields (`+0x38`, `+0x3A`, `+0x3C`, `+0x3E`) to play:

```assembly
9082DD  LDA $002E,Y      ; Entity stamina
9082E0  CMP #$0400       ; Under 100%?
9082E3  BCC $8313        ; -> Attack 0 (+0x38)
9082E5  CMP #$0800       ; Under 200%?
9082E8  BCC $830D        ; -> Attack 1 (+0x3A)
9082EA  CMP #$0C00       ; Under 300%?
9082ED  BCC $82FE        ; -> Attack 2 (+0x3C)
                         ; -> Attack 3 (+0x3E)
```

The selected animation record pointer is loaded into the entity's active animation slot, resetting the frame timer (`+0x05`).

### Who Drains the Stamina?
Stamina (`+0x2E`) is drained by the **Animation VM and the Engine Collision/Movement handlers**, not by high-level AI:
1. **The Animation VM `reset` Opcode (`0x52` at `$908453`):**
   Nearly every animation script opens with opcode `0x52` (`reset`). The handler at `$908453` tests whether the previous animation was in attacking mode:
   ```assembly
   908459  LDA $0016,X      ; Entity mode
   90845C  BIT #$0010       ; Was mode bit $10 (ATTACKING) set?
   90845F  BEQ $846D
   908461  STZ $002E,X      ; Zero stamina! (+0x2E = 0)
   ```
   So when an attack animation starts or transitions back to idle, opcode `0x52` detects the attacking flag and dumps the stamina meter to 0.
2. **Dedicated Animation Drain Opcode (`0x4E` at `$908495`):**
   Certain attack animations explicitly invoke opcode `0x4E`, whose handler directly clears stamina:
   ```assembly
   908495  TYX
   908496  REP #$30
   908498  STZ $002E,X      ; Force clear stamina
   ```
3. **Contact Damage Impact (`$8FB584`):**
   When a charging enemy (`mode $4000` or `$8000`) deals contact damage via physical collision (`$8FB52C`), the collision handler directly executes `STZ $002E,X` on impact (`$8FB584`). This prevents charging enemies from dealing damage every single subframe of overlap.
4. **Running Drain (`$9082B0`–`$9082D2`):**
   Entities running across the screen (`mode & 8`) decrement stamina every tick until exhausted.

### Who Recharges the Stamina?
Stamina is recharged by the engine's main tick loop at **`$8FCC5D`**:
```assembly
8FCC5D  LDA $002E,Y      ; Current stamina
8FCC60  CLC
8FCC61  ADC $8E002E,X    ; Add character record +0x2E (charge_speed)
8FCC65  CMP $8E002C,X    ; Cap at character record +0x2C (charge_limit, $400 = 100%)
8FCC69  BCC $8FCC6E
8FCC6B  LDA $8E002C,X    ; Clamp to max charge
8FCC6E  STA $002E,Y
```

### 2. Delivering the Hit: Three Attack Mechanics

Once the animation bytecode starts playing, damage is inflicted via one of three mechanisms declared in the animation stream:

#### A. Melee Strike Boxes (Opcode `0x47`)
In melee animations (e.g. Wimpy Flower lunging, Raptor bite, Megataur horn sweep), specific frames execute bytecode command `0x47`:
$$\text{Opcode: } \mathtt{47}\ \langle dx \rangle\ \langle dy \rangle\ \langle w \rangle\ \langle h \rangle$$
- Handled at `$9087BA`, which computes the strike centre relative to the attacker:
  $$cx_{\text{strike}} = cx_{\text{attacker}} + dx, \quad cy_{\text{strike}} = cy_{\text{attacker}} + dy$$
- Routine `$8FB5E6` walks candidate entities and tests against the target's hurtbox (`+0x0D` radius $r$ around torso/feet):
  $$2(|dx| - r) < w \quad \text{and} \quad 2(|dy| - r) < h$$
- If the geometry overlaps and the target is not invulnerable or already on cooldown, the hit connects.

#### B. Projectiles (Opcode `0x4C`)
Shooters and ranged enemies (e.g. Stone Cobra spit, Bone Buzzard feathers, Floating Fan wind) declare opcode `0x4C` in their attack animation:
- Opcode `0x4C` spawns a projectile entity (`$90DCA4`) aimed at the target pointer stored in entity `+0x24` or launched along the attacker's facing vector.
- The projectile flies according to its projectile behaviour record (`$900000 + id`), carrying its own collision box and damage values.

#### C. Contact Damage (Charging Mode)
Enemies that ram into the player (Lime Slime, Magmar rolling, Rimsala charging, Widowmaker leap) have animations that set entity mode bits:
$$\mathtt{mode}\ \$4000 \quad \text{or} \quad \mathtt{mode}\ \$8000 \quad (\text{stored in entity } +0x16)$$
- When moving, standard body collision (`$8FB4AB`) checks if the mover's body box ($2r \times r$) hits the player.
- Routine `$8FB52C` checks:
  ```assembly
  8FB52C  LDA $0016,X      ; Mover state
  8FB52F  BIT #$C000       ; Is mover in charging mode?
  8FB534  LDA $002E,X      ; Is stamina >= $0400?
  ```
- If true, contact deals damage directly through the mover's `attack_proc` without any `0x47` strike box!

### 3. Hit Resolution and the 21-Tick Cooldown
When a hit registers:
1. Attacker's `attack_proc` (`+0x30`, usually `$8FB75A`) executes.
2. To-hit roll compares target evade (`+0x1F`) against attacker hit rate (`+0x21`).
3. Damage formula (`$8FC067`) evaluates attacker attack power (`+0x19`) against target defence (`+0x1B`).
4. Damage is written to target pending damage (`$0076,Y`).
5. **Hit Cooldown:** Target records the attacker ID in `$0036,Y` (`DAMAGE_SOURCE`) and sets timer `$0038,Y = 20` (`DAMAGE_SOURCE_TIMER`). The same attacker cannot hit that target again for 21 ticks.
6. Target triggers damage knockback animation (`+0x40`).
7. At the end of the attack animation, opcode `0x2D` or bytecode completion resets the attacker to `stand` (`+0x32`), allowing stamina `+0x2E` to begin recharging.

---

## 4. Master Table of All 15 Enemy AI Behaviours

The engine dispatches enemy behaviour through the jump table at **`$8FCBE0`** in Bank `$8F`. The character record field `+0x03` provides the word index (`0, 2, 4, ..., 28`):

| Index | Routine | Classification | Characters | Typical Examples | Behaviour Summary |
|---|---|---|---|---|---|
| `0x00` | `$8FD34B` | **Standard Roaming / Chasing Monster** | 53 | Raptor, Oglin, Son of Set, Hedgadillo, Bone Buzzard, Skelesnail, Frippo, Sand Spider, Neo Greeble, Guardbot, Timberdrake, Sterling, FootKnight, Bad Boy, Bad Dawg | Roams within spawn leash radius (`+0x40`); tests both Boy and Dog proximity against `aggro_range`; rolls `aggro_chance` when stamina $\ge \$400$; turns to face target; advances along 8/16-angle vectors; initiates stamina-level attacks (0–3). |
| `0x02` | `$8FD76A` | **Static Props & Scripted Boss Parts** | 20 | Rock, Statue, Bridge, Bomb, Face, Mungola, Aquagoth, Aegis, Thraxx Heart, Coleoptera Heart, Fan, Speaker, Carltron's Robot | Stationary (`range=0, chance=0`); zero autonomous roaming or target hunting; awaits room script triggers, hit events, or parent boss orchestration. |
| `0x04` | `$8FD05E` | **Autonomous Boy Companion** | 1 | The Boy (`#0`) | Runs when the Dog is the actively controlled character (`$0F42`); follows the Dog, maintains formation distance, and attacks the Dog's current combat target. |
| `0x06` | `$8FD0A8` | **Autonomous Dog Companion** | 1 | The Dog (`#1`) | Runs when the Boy is the actively controlled character; follows the Boy; polls room alchemy sniff coordinates (`$1453..$1459`); navigates to sniff spots; attacks enemies based on behaviour settings. |
| `0x08` | `$8FD6FB` | **Stationary Plant / Turret Hazard** | 12 | Wimpy Flower, Carniflower, Flowering Death, Tiny Tentacle, Stone Cobra (x2), Thraxx Claws (x4), Sphere Bot | Immobile (no walking/running); waits in idle stance until target enters aggro square; when stamina is full and roll succeeds, turns towards player and fires attack (extended lunge bite, claw swipe, or venom spit). |
| `0x0A` | `$8FD76E` | **Friendly NPCs & Townsfolk** | 36 | Villagers, Fire Eyes, Horace, Strongheart, Madronius, Professor Ruffleberg, Tinker, Gomi, Tiny, Barker | Flagged `INVINCIBLE` (`0x0002`); wanders slowly or stands idle; non-hostile; triggers dialogue windows upon B-button interaction; completely ignores player aggro checks. |
| `0x0C` | `$8FD4FB` | **Erratic Aerial / Buzzing Monster** | 5 | Mosquito (x2), Old Nick, Mephista, Floating Fan | Levitates/oscillates vertical height (`+0x1E`); sinusoidal and zigzag flight paths; evasive buzzing; dives into player with strike boxes or contact damage. |
| `0x0E` | `$8FD715` | **Submerging Swamp Ambush** | 2 | Tar Skull, Salabog | Hides submerged beneath swamp/mud plane; monitors player proximity; breaches surface to spit tar/mud projectiles or bite; submerges again to reposition. |
| `0x10` | `$8FD5D2` | **Magmar (Lava Boss AI)** | 2 | Magmar (both encounters) | Submerges into molten lava; tracks player position under the surface; surfaces to spit projectiles; transitions into rolling fireball attack (`mode $4000` charging contact damage). |
| `0x12` | `$8FD421` | **Viper (Snake Slither & Strike)** | 2 | Viper, Viper Commander | S-curve slithering pathing; coils defensively; lunges forward with extended multi-tile strike boxes; spits venom sprays. |
| `0x14` | `$8FD394` | **Rimsala (Hovering Gaze Boss)** | 3 | Rimsala, Rimsla, Eye of Rimsala | Levitates and tracks player; alternates between intangible shadow phase and solid vulnerable phase; emits eye laser attacks; dashes across room with contact damage. |
| `0x16` | `$8FD3DC` | **Spark / Environmental Hazard** | 1 | Spark (`#75`) | Continuous fast patrol bouncing along collision boundaries and room walls; deals immediate contact damage on impact. |
| `0x18` | `$8FD380` | **Mini-Taur (Labyrinth Bull)** | 1 | Mini-Taur | Labyrinth corridor tracking; charges along straight lines with `mode $4000`; heavy club smash when target is within close melee reach. |
| `0x1A` | `$8FD52E` | **Megataur (Colosseum Boss)** | 1 | Megataur | Arena boss routine; ground stomps producing shockwaves; wide horn cleave (59×34 strike box); arena-wide charging bull ram. |
| `0x1C` | `$8FD708` | **Water / Pit Tentacle Hazard** | 2 | Tentacle (both encounters) | Stationed in deep water / swamp holes; erupts upward when player approaches water edge; sweeps shore with whip strikes; submerges to avoid attacks. |

---

## 5. Are Enemies Using a Script Language?

**No. Enemy AI in Secret of Evermore does not run an interpreted script language.**

The AI decision-making logic is **compiled 65816 machine code** residing in Bank `$8F`. The jump table at `$8FCBE0` indexes 15 distinct native routines that perform register-level math, branch on memory flags, and invoke engine subroutines.

However, the confusion often arises because two other systems *do* use bytecode interpreters:
1. **The Animation Interpreter (`$9080D0`):** Once native AI selects an attack, the visual frames, strike boxes, sound triggers, and projectile spawns are executed by a **bytecode virtual machine** reading streams in Banks `$C4`–`$CE` (see [animation_script.md](animation_script.md)).
2. **The Room/Event Script Engine (`$928000`):** Cutscenes and scripted NPC movements use **Everscript bytecode** (spawns, dialogue, room transitions). A room script can commandeer an entity using `attach_script` (`0x3D`/`0x3F`), temporarily replacing the native combat AI loop with scripted instructions.

---

## 6. Are They Using Pre-Compiled Waypoints to Move?

**No. The ROM contains no pre-compiled waypoints, path nodes, or navigation meshes for standard enemies.**

Instead, enemies navigate using dynamic steering and vector calculations:

1. **Spawn Tether / Leash Point (`+0x26`, `+0x28`):**
   When spawned, an enemy's initial coordinates are stored as its anchor point. An aggroed enemy tracks the target, but if lured beyond its leash limit (`+0x40`), the AI disengages and steers back towards `(+0x26, +0x28)`.
2. **Vector Angle Calculation (`$80ADF0` / `$80AE78`):**
   When pursuing, the engine computes $\Delta x = x_{\text{target}} - x_{\text{enemy}}$ and $\Delta y = y_{\text{target}} - y_{\text{enemy}}$. A lookup table translates $(\Delta x, \Delta y)$ into one of 8 or 16 facing directions (`+0x22`), advancing the enemy directly along that vector.
3. **Collision Deflection:**
   When an advancing enemy attempts a step, the movement routine tests terrain collision words (`$8FA946`) and entity collision boxes (`$8FB4AB`). If blocked, the move fails (`CLC`), and the enemy halts or deflects along the unblocked axis.
4. **Random Walk Wander Timer:**
   During the idle/roam state (`+0x78 = 0`), a step timer (`+0x7A`) counts down. Upon expiration, the engine calls RNG `$80859B` to pick a new random facing angle and tick duration, producing natural wandering.

---

## 7. Do They React to Anything Besides Proximity?

Proximity is only the spatial trigger. Enemies react to numerous additional internal and external conditions:

1. **Stamina Meter (`+0x2E`):**
   An enemy will **never** initiate an aggro charge or attack cycle if its stamina meter is below `$0400` (100%). It must wait for its stamina to recharge at the rate defined in character record `+0x2E`.
2. **Aggro Dice Roll (`+0x15`):**
   Even with the player standing directly adjacent, an enemy will not engage unless `rand(0..255) < aggro_chance`. For passive enemies like Wimpy Flowers (`aggro_chance = 5`), the roll fails over 98% of the time on any given tick.
3. **Taking Damage (Interrupts & Retaliation):**
   When struck by a weapon or spell:
   - Entity state raises `$0012 |= $0438` (`$8FC0F9`).
   - The ongoing action is interrupted, forcing the entity into knockback mode (`+0x40`).
   - The attacker's pointer is recorded in `$0036,Y`.
   - **Retaliation:** Evil clones (Bad Boy, Bad Dawg, Dark Toaster) check state `+0x12 bit $40` when damaged and immediately retaliate using the special animation in record `+0x48`.
4. **Target Invulnerability & HP:**
   The detection check explicitly verifies:
   - Target HP > 0 (`$002A,X > 0`). Dead characters are completely ignored.
   - Invulnerability status (`$0016,X & $0020`). Characters dodging, rolling, or in the middle of casting alchemy cannot be targeted or struck.
5. **Elevation Plane Matching (`$0018`):**
   The engine checks whether the enemy and player share the same collision elevation plane (bits `0x0030` of the tile collision word). An enemy on low ground cannot engage or strike a player standing on an upper cliff or bridge unless the tile has `PLANE_TRANSPARENT` (`0x0040`).
6. **Leash Distance (`+0x40`):**
   If pulled too far from its home spawn coordinate, an enemy breaks combat, ceases attacking, and retreats to its spawn origin.
7. **Boss Phase Timers & HP Thresholds:**
   Complex bosses (Salabog, Magmar, Megataur) evaluate their remaining HP and phase timers, triggering state transitions such as submerging into lava, burrowing underground, or switching attack patterns.

---

## 8. Is the Dog Sniffing an AI Script?

### The Mechanics of Sniffing in the Companion AI (`AI 0x06`, `$8FD0A8`)
Sniffing is **hardcoded into the Dog's native companion AI routine** (`AI 0x06` at `$8FD0A8`). It is not an Everscript bytecode script.

When the Dog is acting autonomously (i.e. the Boy is player-controlled, verified by `CPY $0F42` $\ne 0$):
1. Routine `$8FD0F7` reads room WRAM address **`$1459`**, which holds the active ingredient sniff-spot count.
2. If non-zero, `$8FD0FC` calls `$8F98A4` to test proximity between the Dog and the hidden alchemy ingredient coordinates stored at **`$1453` (X)** and **`$1455` (Y)**.
3. When within sniffing range, the Dog AI overrides standard following behaviour, steers directly to `($1453, $1455)`, and starts the sniffing animation (`0x429E`).
4. Standing near the sniffing Dog and pressing the **B button** activates the B-Trigger that excavates the alchemy ingredient and awards it to the inventory.

### Why Changing the Dog to a Raptor Made Him Attack the Boy
The user's observation is 100% accurate and explained directly by the character records:

1. **The Dog's Record (Character `#1`):**
   - Configured with `behaviour = 0x0006` (AI Routine 6: `$8FD0A8`, Dog Companion AI).
   - This routine contains the companion follow logic, sniff spot polling (`$1453..$1459`), and player-assistance combat routines.
2. **The Raptor's Record (Character `#89` / `#90` / `#110` / `#136`):**
   - Configured with `behaviour = 0x0000` (AI Routine 0: `$8FD34B`, Generic Monster AI).
   - Flagged with enemy party bits (`flags = 0x0000`, hostile).
   - Aggro range: 60 px. Aggro chance: 60.

When the Dog entity slot is populated with the Raptor's character record:
- The entity now executes **AI Routine 0 (`$8FD34B`)**.
- AI 0 has **zero code** to check alchemy sniff spots (`$1453..$1459`) or follow the Boy.
- Instead, AI 0's detection routine (`$8FD6B9`) tests proximity against Party Slot 1 (`$0F3E`, the Boy).
- Because the Raptor is hostile and within 60 px of the Boy, it passes the proximity check, locks the Boy as its target (`STA $0024,Y`), advances towards him, and lunges with its bite attack!

