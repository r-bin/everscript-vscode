# Terranigma: jumping, what is solid in the air, and a port to Evermore

How the player's jump works in Terranigma (base ROM `eu`), read from the game's code and checked in the running game,
and a plan for giving Evermore a jump built the same way. §1–§4 are Terranigma facts only. §5 is a design for
Evermore that rests on Evermore's own documented facts. Nothing in §1–§4 is evidence about Evermore
(`AGENTS.md` §0.4).

Addresses are SNES bus addresses. "The player record" is `$7E:1000` (`$0DEA` holds its address);
README §3.4–§3.7 has the map words, cell types and movement tables this doc builds on. When tracing it yourself:
the core's write watchpoints miss 16-bit writes (`emulator-subsystem` skill), and every write to `$0970` is one.

## 1. In short

* The jump never lifts the character off the map. Its x and y stay on the ground, and a separate **height**
  (`$7E:0970`, negative = up) only moves the sprite when it is drawn.
* While the jump runs, **bit 2 of `$7E:097C` is set ("airborne")**. That bit is the only thing the collision code
  checks. Walls stop a jump exactly as they stop a walk. The bit changes three things: a **type 8** cell (a ledge)
  can be crossed moving up, the ground under the feet stops dropping the player off ledges, and the ground's
  other effects are skipped.
* A ledge is a band of type-8 cells, one cell deep. Walking up into it stops you. Jumping into it carries you
  over, because the ground position slides across the band during the jump. If you land with your feet still on
  the band, you are dropped back down off it. Walking down onto a ledge drops you off it at once.

## 2. The jump

### 2.1 Start (`$84:9990`)

The B button runs one of the player's jump scripts, character code in bank `$84` (`$84:976D` and its twins
`$84:979F`, `$84:9DCA` …, one per facing; which is which is not checked). Before that, each script sets the
jump pose with `COP $CB`. The shared start, `$84:9990`, does five things:

1. `TSB $097C` with 4: sets the airborne bit.
2. Clears `$7F:201A,X`.
3. `COP $AF $39` selects entry `$39` of the character's curve table. The table's address is at `$7F:0022,X`
   (`$80:BBDB`). Each entry is 4 bytes, two curve pointers: the first goes to `$7F:0010,X` (and `+$14`), the second
   to `$7F:0012,X` (and `+$16`).
4. Clears `+$26` of the record.
5. Copies the second curve pointer into `$0972`, and clears the frame counter `$0974` and the height `$0970`.

### 2.2 The loop: 25 frames

The script then runs `COP $02 $0019 … COP $03`, a loop that runs its body once per frame for 25 frames.
`COP $02 n` stores the count and the loop start at `$7F:0002,X` / `$7F:0000,X`. `COP $03` counts down and, until
the count reaches zero, yields to the next frame at the loop start (`$80:85DF`, `$80:85F8`). The loop body:

* `$84:98D2` and `$84:9972` let you steer: the box moves at walking speed while a direction is held (1.5 px/frame,
  measured). How they do it is not decoded in detail.
* `$84:97C1` counts `+$26` up.

When the loop ends, the script goes back to walking: in the measured jumps through the walk set-up, which clears
`$097C` entirely (`$84:89F5`); the other exit, `$84:96C6`, clears only bit 2. The loop count is fixed, so every
jump lasts 25 frames, as all the measured ones did.

### 2.3 The height curve (`$84:C1CC`, `$84:C205`)

Every frame, `$84:C1CC` adds the next step of the curve to `$0970`. The curve is a list of word pairs that the
pointer `$0972` walks through: a **count** and then a **delta**. Each delta is applied count + 1 times, and the
list ends at a negative count, where the height is set back to 0. In room `$00A` the player's curve was at
`$7F:6688` (WRAM, so it was copied or built there; the ROM has no uncompressed copy, and its source is not
traced):

| count | 1 | 2 | 2 | 2 | 1 | 2 | 2 | 2 | 1 | end |
|---|---|---|---|---|---|---|---|---|---|---|
| delta (px) | −5 | −3 | −2 | −1 | 0 | +1 | +2 | +3 | +5 | `$FFFF` |

That is 24 frames of motion, peaking at −28 px, and the deltas add up to zero, so the curve lands where it took off.
The measured heights match frame for frame: 0, −5, −10, −13, −16, −19, −21, −23, −25, −26, −27, −28, −28, −28,
−27 … −5, 0. A second, lower curve follows at `$7F:66B0` (it starts −4, −3, −2, −2). What uses it is not checked.

### 2.4 Drawing (`$80:F0BA`)

When the sprite builder draws the player's record (`X = $0DEA`), it adds `$0970` to the screen y (`$22`). No other
code reads the height for position. The record's `+0`/`+2` (x, y), the box `$095E`/`$0960` and the cell
`$0962`/`$0964` do not change during a jump: in the measured standing jump the box stayed at (480, 480) for all
25 frames. While `+$26` is non-zero, `$84:C199` copies the player's x, y and sprite priority into the record at
`$0DF4`. That record is probably the shadow, which stays on the ground (not checked).

## 3. What is solid during a jump

There is no separate collision for the air. The move routine (`$80:D0F9`, README §3.6) checks the same layer-0
cells under the same ground position. Only the handlers that test bit 2 of `$097C` act differently:

| Where | Not airborne | Airborne |
|---|---|---|
| move up into type 8 (`$80:D506`) | wall (`$80:D3B6`) | open (`$80:D3CA`) if the cell above it is **not** type 8 too (`$8D:8D55`, one row up). If the box straddles two cells, the other cell must also be type 8 (`$8D:8CE1`, the cell to the right) |
| every other type and direction | the tables of README §3.6 | the same, so walls, diagonals and type `$1F` still stop a jump |
| ground under the feet, every frame (`$80:CB91`, player only) | ledge class under the feet drops you off (`$80:CF50`); type `$14` under all four corners starts `$84:A553`; other `$14` cases start `$84:9C95` | all skipped (`$80:CF53` tests `$8004`, `$80:CC80` and `$80:CCCC` test bit 2) |
| bumping a wall (`$80:E2FF`) | starts the player's wall-bump reaction script | skipped (`BIT #$8084`) |

`$80:CB91` takes the types of up to four cells under the player's foot box (`$02` the cell, `$04` the cell to the
right, `$06` below, `$08` below-right; offsets −8, −16 from the record's x, y, at `$7F:1028`/`$7F:102C`). It looks
them up in a class table at `$80:CF30` (one byte per type). Types 8, `$14` and `$1F` are class 8, the **ledge
class**. `$80:CED1` reports a ledge when the top two cells (or, deeper than 8 px into the cell, the bottom two)
are both ledge class and not both `$14`. `$80:CF50` then sets bit 0 of `$097C` ("dropping") and starts a drop script
(`$84:9ECC` when the record's `+$14` is 1, else `$84:9EBC`): 3 px per frame down until the box is clear of the band,
then a landing pause of about 15 frames, then walking again.

Cell types, as far as jumping goes:

* **8, a ledge:** you can walk across it left, right and down, walk up into it only to stop, and jump up over it
  if it is one row deep.
* **`$1F`, a drop:** a wall moving up (no airborne test), so it can only be dropped off.
* **`$14`:** ledge class, but special-cased when it is under the whole foot box. What it is in the game is not
  checked; the scripts it starts are not decoded.

### 3.1 Checked in the running game

Room `$00A` (Crysta) has type-8 rows, e.g. row 11 at x 21–24, with open rows 10 and 12, and rows 14–17 at
x 31–36. The checks were run on the headless core the same way as `tools/terra/check-walk.mts` (put the player on
a cell, hold a direction), with B held for three frames, recording the box, `$0970` and `$097C` each frame.

| Start cell | Input | Result |
|---|---|---|
| (30, 30), open | B | height 0 → −28 → 0 over 25 frames (§2.3); box unchanged; `$097C` = 4 for exactly those frames |
| (22, 13) | up | stops at box y 192, the top of row 12: the ledge is a wall when walking |
| (22, 12) | up + B | crosses row 11 in the air, lands at y 156 (fully above the band), walks on |
| (22, 13) | up + B | lands at y 171 with the feet still in row 11, is dropped back down at 3 px/frame to y 192 |
| (22, 9) | down | walks to y 169, then drops at 3 px/frame to y 193, pauses about 15 frames, walks on; `$097C` bit 0 is set during the drop, and the height stays 0 (the drop is a scripted slide, not the jump curve) |
| (33, 18) | up + B | does not move: the band is four rows deep, so the cell above row 17 is type 8 too |
| (32, 32) | up + B | stops at y 496 below the wall in row 30, in mid-air: walls hold during a jump |

### 3.2 WRAM

| Address | What |
|---|---|
| `$7E:0970` | the player's jump height in px, signed (negative = up); added to the sprite's screen y only |
| `$7E:0972` | pointer into the height curve (bank `$7F` in the measured run); 0 = no curve |
| `$7E:0974` | frames left on the current curve step |
| `$7E:097C` | state bits: 0 dropping off a ledge, 1 and 3 the type-`$14` scripts, **2 airborne**, 4 no exits, 15 (tested with 2 by every ground check, not decoded) |
| `$7E:0987` | high byte of `$0986`; bit 2 (`$0400`) mirrors the airborne bit each frame (`$80:CBBC`) |
| `$7E:0978` | the player's current animation or state word: `$415` walking, `$431` dropping, `$435` landing (measured; meaning inferred) |

## 4. Not decoded yet

* Where the height curves at `$7F:6688` come from, and which characters or moves use the other curves of the
  table at `$7F:0022,X`.
* What the first curve of entry `$39` (`$7F:0010,X`) moves. It may be a horizontal push for jumps that also move
  forward.
* Which jump script belongs to which facing, and what `+$26` counts for.
* Type `$14` and its scripts `$84:A553` / `$84:9C95`; bit 15 of `$097C`.
* Whether exits (README §3.7) and enemy hits look at the height.

## 5. Porting the jump to Evermore

Evermore has no player jump. The Terranigma design is worth copying because of its shape, not its bytes: the ground
position stays on the floor, the height is drawn and nothing else, and collision changes only through a few
explicit rules keyed on one "airborne" flag. Below, each step names the **Evermore** fact it rests on and where that
fact is written down. Every Evermore address comes from the Evermore docs, not from §1–§4.

### 5.1 What Evermore already has

* **Planes instead of ledge types.** Evermore's collision word gives every metatile a 4-bit geometry (sub-tile
  shapes and slopes), an elevation **plane** 0–3 in bits 5–4, a plane-transparent bit 6 and an always-walkable
  bit 13. The evaluator `$90:9DE8` treats a tile of another plane as solid, and `$8F:A914` updates the entity's
  plane `$44` (record `+$18`) when it stands on an ordinary tile
  ([`map_collision_mechanics.md`](../map-format/map_collision_mechanics.md) §2–§3). Raised ground in Evermore is
  therefore "a different plane", where Terranigma uses "a type-8 band".
* **A free bit.** Bit 7 of the collision word is set in no vanilla tile
  ([`map_collision_mechanics.md`](../map-format/map_collision_mechanics.md) §2).
* **Shadows.** An entity record can point to a child shadow entity at `+$6A`
  ([`entity-position.md`](../disassembly/entities/entity-position.md)).
* **An altitude in the hit test.** The strike hit test compares an attacker altitude (DP `$4A`) and the planes
  before it lands a hit ([`strike-hittest.md`](../disassembly/combat/strike-hittest.md)). The same document set is
  unsure where that altitude is stored: `entity-position.md` calls record `+$18` "z / jump altitude", while
  `map_collision_mechanics.md` §3.1 reads `+$18` as the plane, from the code that writes it. The second is a
  line-by-line reading, so treat `+$18` as the plane until a run settles it.
* **Ground effects to suppress.** Step-on triggers are only searched while the player stands on a bit-14 tile
  (`$8F:B07B`), and bit 13 tiles drift the player (§6, §7.2 of the same doc).

### 5.2 The design

1. **State.** One airborne flag and a signed height per jumping entity, plus a curve pointer and a step counter,
   all in WRAM that the game never touches (the unused-WRAM entries from commit `4e1f4d57`; `memory-map` skill).
   Ground x and y stay as they are.
2. **The curve.** The same format as §2.3 works well: (count, delta) word pairs ending at a negative count. Only
   this format is reused, not the Terranigma curve, so write our own table, e.g. 24 frames peaking at about 28 px,
   in free ROM (`docs/exhirom/README.md`; the table hack's free space). One step per frame, from the per-frame entity
   update.
3. **Drawing.** Add the height to the sprite's screen y where Evermore builds the entity's OAM entry, and leave the
   shadow child (`+$6A`) on the ground. The OAM builder has to be found first (`code-vfs` skill); this is the only
   change the player sees.
4. **Solid in the air: keep the evaluator.** Walls stay walls, as in §3: the jump does not touch geometry, entity
   gates or plane-transparent tiles.
5. **Jumping up a step.** Terranigma's "type 8 is passable up while airborne, if it is one row deep" becomes, in
   Evermore terms, "while airborne, a tile **one plane above** the entity's plane counts as its own plane". The patch
   point is the plane-mismatch branch of `$90:9DE8` (`$90:9E53`): if the flag is set and the tile's plane is
   `$44 + $10`, continue at the same-plane path (`$90:9E2F`) instead of returning `$0F`. When the entity lands on
   that tile, `$8F:A914` raises its plane by itself. Two options, in order of risk:
   * **opt-in:** honour this only on tiles with bit 7 set (the free bit), so vanilla rooms behave exactly as
     before and the map editor paints "jumpable step" as a flag;
   * **everywhere:** any one-plane step becomes jumpable. Simpler, but it changes vanilla rooms (shortcuts past
     plane-gated areas).
6. **Landing.** On the frame the curve ends, clear the flag and check the tile under the feet as a walking entity
   would. If it is solid for the current plane (a jump that ended half on a step), push the entity back the way it
   came, as Terranigma drops you back off the band (§3.1, row 4). Without this rule an entity can end up standing
   inside a tile the evaluator calls solid.
7. **Ground effects.** While the flag is set, skip the step-on search (`$8F:B07B`) and drift (bit 13), as
   Terranigma skips its ground check (§3). That way a jump can cross a trigger or a conveyor without setting it off.
8. **Dropping down.** Terranigma's walk-off drop (type `$1F` / type 8 moving down) has no Evermore counterpart yet.
   A one-plane drop could start the same curve from a height of one step with the flag set, and land on the lower
   plane through rule 5's mirror ("one plane below counts while airborne").
9. **Input.** B already swings the weapon or interacts (bit 15 of the collision word,
   [`gourds-and-map-objects.md`](../map-format/gourds-and-map-objects.md)), so the jump needs another button. The
   joypad matcher found for the hotkey hack is where it would be bound (knowledge entries from `v0.354.2`).
10. **Combat (optional).** If the height is passed in as the strike test's attacker or target altitude, jumping
   over a low attack falls out of the existing `< $0460` gap test. Whether that holds depends on the open `+$18`
   question in §5.1.

### 5.3 How to build and check it

* An Asar patch under `patches/` (`snes-asm-asar-patching` skill: hooks keep the processor state; the evaluator
  returns with `RTL`, A 16-bit).
* Prove vanilla play is untouched with the stored playbacks (`sample-playbacks` skill). With the opt-in rule
  (bit 7) every vanilla room must replay WRAM-identical.
* Check a jump in the running game with a headless test like §3.1: one room with a one-plane step and the bit-7
  flag, walking into it (stops), jumping into it (lands on the upper plane, `$44` changes), and landing half on
  it (pushed back).
* Show the flag in the Rooms editor's collision layer, so a "jumpable step" is something you paint, not a byte
  you edit by hand (`map-editor-rules` skill).
