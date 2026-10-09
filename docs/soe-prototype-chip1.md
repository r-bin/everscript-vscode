# Secret of Evermore prototype: chip 1 of 6

What a single surviving EPROM from a Secret of Evermore prototype holds, and how it differs from the
retail US release.

- **Source:** [SNES Central, "Secret of Evermore (prototype)"](https://snescentral.com/review.php?id=0602&num=0&fancy=yes&article=proto).
  The dump came from a lot the Video Game History Foundation recovered for an anonymous collector. Only
  one of the cart's six chips was in it.
- **File analysed:** `Secret of Evermore (prototype) (chip 1).sfc`
- **Reference ROM:** `Secret of Evermore (U) [!].smc` (3 MB, unheadered, SHA-1 `79e7738630fff5699217ef58ecc421bc8fcbcd89`)

Unless a section says otherwise, addresses are SNES bus addresses written the way the game uses them:
`$Cx:xxxx` for the lower half of a HiROM bank and `$8x:xxxx` for the upper half (see
`../everscript/wiki/rom/Rom-Map.md` §2.1). "Final" means the retail US ROM.

---

## Summary

1. **It is the second 512 KB slice of the cart**: file offset `0x080000–0x0FFFFF`, HiROM banks
   `$08–$0F` (`$C8–$CF` lower halves, `$88–$8F` upper halves). The file name counts from 0 ("chip 1"),
   while SNES Central counts from 1 ("chip 2 of 6"). Both mean the same chip.
2. **It contains a complete debug and cheat system that the final removed.** There is a debug flag at
   `$7E:0E65` and a table of **22 joypad-sequence cheats**: infinite items, all weapons, all armor,
   all spells, max HP, kill all, save anywhere, level-ups, skill-ups, and debug levels 1 and 2. There
   is also an on-screen coordinate HUD, a **built-in sound test** (Select + d-pad), a debug window in
   the script trigger dispatcher, and a "DB: +N EXPERIENCE." message. In this build the sequence that
   turns debug mode on has been **stubbed out with an `RTS`**, so none of it is reachable as dumped.
   The final keeps only the button-sequence matcher, with a single entry: **Select = switch boy/dog**.
3. **The character table is from an earlier format.** Records are 76 bytes, not 74, because money
   (talons) is 32-bit. There are 136 characters instead of 142. **Dark Toaster**, the stronger
   second versions of Rat, Mechaduster, Tentacle and Tiny Tentacle, and NPC slot 2 ("Boy") are
   missing. Several enemies have different stats; for example, Red Jelly Ball has attack 45 instead of
   110 and gives 100 EXP instead of 600.
4. **There is no Confound status attack.** The final adds a third status-inflicting attack proc
   (Plague or "Confounded!") and gives procs to Rat and Mad Monk. The prototype only has Poison and
   Plague.
5. **The music set has 69 songs instead of 71.** Final songs `0x04` and `0x05` (named "Return to
   Podunk" and "Village on the Plateau" in this repo's catalog) are missing, so every later song id
   is 2 lower. Several shared instrument samples are much larger in the prototype; overall it carries
   about 15 KB more music data. "Death of a Minotaur" is missing two instruments the final has.
6. **Most other data is the same content, re-packed.** Sprite frames match 99.4% by layout, but the
   tile ids were renumbered. About 75% of the final's map graphics in these banks are present, at
   different offsets. The ring-menu icons (162), the six dog forms and the menu screens are
   structurally identical. The engine code is 84–97% instruction-for-instruction the same per bank.

The prototype cannot run on its own. The reset vector, header, main loop, strings, scripts, rooms and
most of the audio data are in the five missing chips. It also cannot be combined with the final's other
chips, because nearly every cross-bank call and pointer has moved.

---

## 1. The dump

| | |
|---|---|
| Size | 524,288 bytes (512 KB = one 4 Mbit EPROM) |
| SHA-1 | `4bce54dc1568f40d2c0fd9e584842fc64e73c0d2` |
| Header | none. The cartridge header lives at `$00:FFC0`, which is in chip 0. Offset `0xFFC0` of this file is just data in bank `$08`. |
| Final equivalent | file `0x080000–0x0FFFFF` of the 3 MB retail image |

### How it was identified

Each of the final ROM's six 512 KB slices was compared against the chip. Slice 1 matches 17% of bytes
in place and has 9 identical 4 KB blocks. Every other slice matches about 1% (chance level).

| Final slice | File range | Bytes equal in place | Identical 4 KB blocks |
|---|---|---:|---:|
| 0 | `0x000000` | 0.8% | 0 |
| **1** | **`0x080000`** | **17.0%** | **9** |
| 2 | `0x100000` | 1.3% | 0 |
| 3 | `0x180000` | 0.9% | 0 |
| 4 | `0x200000` | 0.9% | 0 |
| 5 | `0x280000` | 1.0% | 0 |

17% is low for "the same chip" because almost everything in the prototype sits at a slightly different
address. Content was added or removed in front of it, and since the ROM is packed with no free space
(Rom-Map.md §2.11), every insertion pushes the following data along.

### Method

- **Placement:** every 32-byte window of the chip, at 16-byte steps, was looked up in an index of the
  final ROM. Where a window had exactly one match, the address difference gave a run-by-run relocation
  map (§2).
- **Coverage:** the share of chip bytes that sit inside some 16-byte sequence found anywhere in the
  final.
- **Structures** were parsed with the same layouts this repo uses for the final: the character table,
  song packages, sprite chunk lists, ring-menu entries and dog forms. They were then aligned record by
  record. Changed pointers were treated as relocation, not content change.
- **Code** was disassembled with the opcode matrix in `src/emulator/cdl/opcodes.js`. Banks were
  aligned on opcode-and-short-operand streams, so moved absolute addresses don't count as differences.

---

## 2. Bank-by-bank map

"Found in final" is the share of the half-bank's bytes that also appear somewhere in the final ROM.
Low numbers in pointer-heavy data (sprite lists, animation scripts, code) mostly mean relocation, not
new content. Each section below says which is which.

| Prototype half | Found in final | Content | Where it lives in the final |
|---|---:|---|---|
| `$C8:0000` | 84% | Animation bytecode `$C8:0000–15CF`, then 16×16 map graphics | Map graphics move to `$C8:2C6E` (+`$169E`) and to `$C7:5CC5` |
| `$88:8000` | 97% | Song data | `$87:BF73` onwards, `$88:800B` onwards: the final's song data starts about 49 KB earlier |
| `$C9:0000` | 33% | Animation bytecode, map-graphics tail | Graphics move to `$C9:753C` and `$C8:15C3` |
| `$89:8000` | 95% | Song data | `$88:CADB`, `$89:85BC` … |
| `$CA:0000` | 100% | Sprite chunk lists, from `$CA:0003` | **Same addresses**, drifting by at most 15 bytes |
| `$8A:8000` | 71% | Song data, then song package descriptors from **`$8A:E220`** | Song data at `$89:C89C`, `$8A:8A62` …; descriptors at `$8A:A7BE` |
| `$CB:0000` | 100% | Sprite chunk lists | **Identical positions** |
| `$8B:8000` | 45% | Descriptors up to `$8B:C6F6`, then map graphics | Descriptors end at `$8B:8EF2`; graphics at almost the same place (`$8B:C750` → `$8B:C6E9`) |
| `$CC–$CF:0000` | 21–44% | Sprite chunk lists | Same frames, but tile ids renumbered (§8) |
| `$8C:8000` | 65% | Engine: APU upload, decompressors, script VM, **debug block `$8C:F0B7–F9BF`** | Most routines are `$44` bytes later. The debug block is gone and map graphics fill `$8C:F220+` |
| `$8D:8000` | 76% | Menus (`$8D:8000–E0A8`), then map graphics | Menus at almost identical addresses; the graphics move to `$8B:A11E` |
| `$8E:8000` | 53% | Ring-menu tables, code, **character table `$8E:B69C`**, field loop, debug HUD | Character table at `$8E:B678`; the debug HUD is gone |
| `$8F:8000` | 76% | Stats, movement, collision, combat, dog forms (`$8F:935E`) | Dog forms at `$8F:936D`; combat code 60–140 bytes later |

Overall, 64% of the chip's bytes occur somewhere in the final.

---

## 3. The debug and cheat system

The biggest difference is in bank `$8C`. It holds roughly 2.3 KB of debug code, data and strings. The
final replaced all of it with map graphics.

### 3.1 Pieces

| Address | What |
|---|---|
| `$7E:0E65` | **Debug level.** 0 = off, 1 = on, 2 = level 2. Every cheat routine starts with `LDA $0E65 / BNE / RTS`. |
| `$7E:3ABE`, `$7E:3BBE` | Joypad history ring and its index (the final uses the same addresses). |
| `$8C:F0B7` | **Sequence matcher**, called every frame from the field loop at `$8E:E66A`. |
| `$8C:F865` | Pointer list of sequence entries, ending in `$0000`. |
| entry | `[joypad word]… $0000 [routine − 1]`; the routine is entered with the `PEA` + `RTS` trick. |

**How the matcher works.** It reads the held buttons (`$0ECE`). When they change, it pushes the new
state onto the history at `$3ABE`, **newest first**. A release (no buttons held) takes one slot, but
the next press overwrites it. So the history is a list of the distinct button chords you held, with
releases ignored. Each table entry is compared against the newest history slots. The table therefore
stores every sequence **in reverse**. Entries are checked in table order, which is why longer
sequences come before shorter ones that end the same way.

### 3.2 The 23 sequences

Shown in **input order** (the table order reversed). `+` means held together. Lettered buttons follow
the SNES pad: A, B, X, Y, L, R, Start, Select (Sel). A repeated chord means release and press again.

| Input (oldest → newest) | Routine | Effect |
|---|---|---|
| Down, A, B, Right, A | `$8C:F226` | Halve the boy's and the dog's HP, showing the loss as floating numbers |
| A, B, Right, A | `$8C:F1B7` | Set the active character's HP to 100 |
| Right, then **two clockwise d-pad circles** (R, DR, D, DL, L, UL, U, UR, R …), ending on Right | `$8C:F1F3` | Set the active character's HP to 999 |
| Hold B, add A, add Select | `$8C:F257` | Calls `$90:A051` between two screen helpers. Purpose not identified (that code is in a missing chip). |
| A, R, R | `$8C:F271` | Passes the dog and the active character's X/Y/Z to `$8F:C255`. Probably "bring the dog here" (unverified). |
| Hold B, add A, add Start | `$8C:F112` | 99 of each of the 22 ingredients (`$22FE–$2313`) and every alchemy formula learned (`$2258–$225C` = `$FF`, except bit 4 of `$225A`). Prints *"Here, have some ingredients!"*, *"Fine, have all the spells too..."*, *"Jerk!"* |
| B, B, A, A, B, B | `$8C:F29E` | Runs `$8F:B2A3` on every entity in the list at `$3DDF` below the party: kills or removes every enemy |
| **Select** | `$8C:F2BA` | **Switch control between boy and dog.** Not debug-gated; **kept in the final.** |
| Start, Start+Up | `$8C:F3FE` | Increment a state byte (`$1086`) of the nearest room object within 10 cells. Clears Up so you don't walk. |
| Start, Start+Down | `$8C:F419` | Decrement the same byte (minimum 0) |
| Start, B+Start | `$8C:F3DF` | Toggle the same byte between 0 and 99 |
| Hold A, tap Start 3×, then hold Start+A and tap Select | `$8C:F4FF` | **Debug ON / OFF**. Stubbed out, see §3.3. |
| A, B+A, B+A+R | `$8C:F550` | Debug level 2 (only when debug is already on) |
| A, A+L, Start+A+L | `$8C:F34C` | Save anywhere: opens the save screen, titled *"Bogus Game"* / *"Save Game"* |
| Hold L, tap R 3× | `$8C:F4D4` | Clear status bits on both characters (`$4E99`/`$4F47` &= ~`$3061`, `$4E9B`/`$4F49` &= ~`$0300`) and reset four timers to `$FFFF` |
| Hold R, tap L 3× | `$8C:F6AB` | *"Lots-O-Beads"*: `$231B` = 3, plus flag bits in `$225C`, `$225D` and `$22DB` |
| L, L, R, R | `$8C:F71A` | Play global animation `#$0E` on the dog (`$4F37`) |
| Hold A, add B, add Start | `$8C:F578` | *"All Weapons!!!"*: ORs the owned-weapon bits from `$C4:5986` / `$C4:59A2`, and `$2344–$2346` = 10 |
| A, B+A, B+Start+A, B+A, B+Start+A | `$8C:F5C8` | *"All Armor!!!"*: 41 armor counts `$231C–$2344` = 6 |
| A, then (B+A, B+Start+A) ×3 | `$8C:F601` | *"All Charms & Trade Goods!!!"*: ORs charm bits from `$8C:BB6C` / `$8C:BB94`, all 13 trade goods = 99 (`$250C`), then recalculates stats |
| B+A+L | `$8C:F734` | Level up the active character: XP is set to the next-level threshold, then the level-up check runs |
| A+L, A+L+R | `$8C:F76C` | All 35 alchemy formula levels +1, up to 9: *"Alchemy spell levels at level N"* |
| A+R, A+L+R | `$8C:F7D6` | All 12 weapon skills and the dog's attack +1 level, up to 3: *"Weapon skill levels at level N"* |

### 3.3 Debug mode is locked in this build

The ON/OFF entry stores `$F4FE` as its routine. The `RTS` dispatch therefore lands on `$8C:F4FF`,
which is a lone `RTS` one byte before the real toggle at `$8C:F500`. The toggle code is intact: it
flips `$0E65` and prints *"Debug ON"* / *"Debug OFF"*. When switching off, it also clears `$7E:4F19`
and `$7E:4FC7` and resets the HUD layout through `$8E:DEFC`.

Nothing else on this chip writes `$0E65`. Setting `$7E:0E65` = 1, or pointing the entry at `$F4FF`,
would turn everything on. Code in the five missing chips might also set it.

### 3.4 Debug-only behaviour elsewhere in the engine

These hooks only run when `$0E65` ≠ 0:

| Where | What |
|---|---|
| `$8E:E165` | **Collision HUD** for the active character, drawn every frame in the lower right: the collision word under its feet (`+$3C`, 4 digits at x 160 / y 176, probably hex), Z/elevation (`+$18`, 2 digits at x 210 / y 176), and map cell X (`+$62`) and Y (`+$63`) (3 decimal digits at x 160 and x 200, y 192). The print helpers `$80:95C2` / `$80:9623` are in chip 0, so the font is unknown. |
| `$8E:E75C` | **Sound test, music.** Hold Select and press Up/Down to step `$0E5F` through 74 music-table entries; the number is drawn on screen. On release, the track plays through `$8C:8442` → `$8C:828F`. |
| `$8E:E7DB` | **Sound test, effects.** Select + Left/Right steps `$0E5B` through all 112 SFX entries and plays them through `$8C:8362` → `$8C:82E3` |
| `$8E:DEFC` | Sets up an 11-entry HUD layout (`$0F62` = 11, `$0F66…` = 0, 2, … 20) when debug is on, and clears it when off |
| `$8E:E6F4` | At debug level 2, also calls `$8E:DF6D` every frame |
| `$8C:88EE`, `$8C:895F`, `$8C:8986`, `$8C:8A24`, `$8C:8A59` | The script trigger dispatcher opens and updates a debug text window (window struct `$0379`, through `$8C:ADA1`) |
| `$8F:82AF` | After EXP is awarded, prints **"DB: +N EXPERIENCE."** |
| `$8F:AFB3` | When the active character moves while **L or R** is held, takes a different path through `$90:97DC`. This is probably a walk-through-walls mode, but the target routine is in a missing chip. |

### 3.5 What the final kept

- The matcher survives unchanged at `$8C:F121`, still called from the field loop (`$8E:E426`). Its
  table at `$8C:F216` has exactly one entry: `[$2000] $0000 → $8C:F17C`, i.e. **Select switches
  characters**. Every SoE player's Select button runs through the cheat engine.
- The string `"DB: +"` / `" EXPERIENCE."` is still in the final at `$8F:82FC`, but nothing references
  it.
- The cheat, sound-test and HUD routines, their strings, `$0E65` and the sound-test variables
  `$0E5B–$0E61` are gone. No code in the final's `$8C–$8F` touches those RAM addresses, or the
  addresses 8 bytes lower.
- Some RAM moved down by 8 bytes. Examples seen in this chip's code:

  | Prototype | Final | Use |
  |---|---|---|
  | `$0ECE` | `$0EC6` | Held joypad buttons |
  | `$0F4A` | `$0F42` | Active character entity |
  | `$0EBA` | `$0EB2` | Pending character-switch request |
  | `$0B4D` | `$0B49` | Switch-related flag |
  | `$3ABE`, `$3BBE`, `$4E89`, `$4F37` | same | Joypad history, boy and dog entities |

SNES Central says the chip's ASCII strings "are identical to the final version". That holds for the
menu text, but not for the 14 debug strings listed in §12, which exist only here.

---

## 4. Character table

| | Prototype | Final |
|---|---|---|
| Location | `$8E:B69C–$8E:DEFB` | `$8E:B678–$8E:DF39` |
| Record size | **76 bytes** | 74 bytes |
| Records | **136** | 142 |

### 4.1 Record format

The two extra bytes come from the money (talons) field. It is **32-bit** in the prototype, like EXP,
and was cut to 16 bits in the final. Everything after it moves by 2:

| Field | Prototype | Final |
|---|---|---|
| EXP (32-bit) | `+$23` | `+$23` |
| Talons | `+$27`, **32-bit** | `+$27`, 16-bit |
| Prize chance (byte) | `+$2B` | `+$29` |
| Level | `+$2C` | `+$2A` |
| Charge limit / charge speed / attack proc | `+$2E` / `+$30` / `+$32` | `+$2C` / `+$2E` / `+$30` |
| Animation record offsets | `+$34…` | `+$32…` |

In all 136 records the top half of the talons field is zero.

### 4.2 Which characters were added

Records were matched on HP, attack, defense, AI script and EXP. Names can't be read, because the name
strings are in bank `$C4` (chip 0), so the identities below are inferred from stats.

| Final id | Final character | In prototype? |
|---|---|---|
| `0x02` | "Boy" (generic NPC) | **no.** Every final id from `0x03` on is one higher than its prototype id. |
| `0x83` | Rat (second version) | **no** |
| `0x84` | Mechaduster (second version) | **no** |
| `0x85` | Tentacle (stronger version: atk 105, def 280) | **no** |
| `0x86` | Tiny Tentacle (stronger version: atk 85, def 240) | **no** |
| `0x8B` | **Dark Toaster** | **no** |

The last three prototype records are late-game bosses that were re-tuned:

| Prototype id | Final | HP | Attack | Other |
|---|---|---|---|---|
| `0x85` | `0x8A` Eye of Rimsala | **10000** → 6000 | **205** → 175 | prize 100 → 128 |
| `0x86` | `0x8C` Magmar (second version) | **30000** → 25000 | 170 | magic def **59** → 0, hit **100** → 110 |
| `0x87` | `0x8D` Carltron's Robot | **20000** → 30000 | 220 | magic def 59 → 60, hit 100 → 110 |

So in the prototype Carltron's Robot was the *weaker* of the two final bosses. In the final, HP was
swapped between the robot and Magmar.

### 4.3 Stat changes in matched records

Changed palette pointers (pure relocation) are left out.

| Final id | Character | Change (prototype → final) |
|---|---|---|
| `0x3D` | Red Jelly Ball | attack **45 → 110**, defense **120 → 240**, EXP **100 → 600** |
| `0x42` | Neo Greeble | EXP 300 → 500 |
| `0x46` | Mechaduster | EXP **50 → 600** |
| `0x4A` | Aquagoth | talons **1000 → 0** |
| `0x51` | Rat | attack proc 0 → **22** |
| `0x5E` | Mad Monk | attack proc 0 → **28** |
| `0x6A` | Salabog | spawn flags `$0000 → $0010` |
| `0x88` | Raptor (4000 HP) | attack 245 → 225 |
| `0x04`, `0x08` | Man, Child's Pet | field `+$17` swapped (200 ↔ 100) |

Collision radius changes, for the hit-box work in the map editor:

| Final ids | Characters | Radius |
|---|---|---|
| `0x25–0x29` | Horace's Twin, Carltron, Gomi, Tinker Tinderbox, Professor Ruffleberg | 10 → 8 |
| `0x2A–0x2B` | Camellia Bluegarden, White Queen | 10 → 12 |
| `0x2C` | Barker | 18 → 10 |
| `0x2D` | Tiny | 18 → 12 |
| `0x2F–0x32` | Mad Monk ×4 | 10 → 8 |
| `0x76–0x77` | Thraxx's heart, Coleoptera's heart | 18 → 15 |

Every other stat in every other record (HP, attack, defense, magic defense, evade, hit rate, aggro
range and chance, EXP, prize, level, charge values) is identical. Animation record offsets are
uniformly +6 in the final (+38 for the dog), because the animation record table in `$C4` grew.

---

## 5. Combat: no Confound

The status-inflicting attack procs in `$8F:B7EC…` (final `$8F:B82D…`):

| Proc | Prototype | Final |
|---|---|---|
| A | Poison, always; message "Poison!" | same |
| B | Plague, 1 in 8; message "Plague!" | same, and also sets `$0E9C` = 5 |
| C | — | **New.** 1 in 4 something happens: Plague, or **"Confounded!"** (status `$60`) |

The status slot numbers passed to `$91:B61A` differ by 8 (Poison `$98` → `$90`, Plague `$90` → `$88`),
so the status table in bank `$91` changed too. That bank is in a missing chip.

The final also gives procs to Rat (22) and Mad Monk (28) (§4.3). Together this suggests the Confound
status effect was added after this build.

---

## 6. Music and sound

### 6.1 Song list

Song packages (`[count:16]` + 7-byte transfer records, Rom-Map.md §2.8) start at **`$8A:E220`**,
against `$8A:A7BE` in the final. There are **69** packages against 71.

They were matched by the sequence of record lengths. ARAM destinations can't be used, because they
moved when sample sizes changed. The result is a clean one-to-one mapping:

| Prototype | Final |
|---|---|
| `0x00–0x03` | `0x00–0x03` |
| — | **`0x04`, `0x05` (new)** |
| `0x04–0x44` | `0x06–0x46` |

Final songs `0x04` and `0x05` are "Return to Podunk" and "Village on the Plateau" in this repo's music
catalog (`soe://rom/assets/audio/music/`); those names come from SPC-set naming and weren't
re-verified for this doc. 49 of the 69 prototype songs have exactly the same record lengths as their
final counterparts. Most of the bytes behind those records are in chip 0, so their contents couldn't be
compared.

### 6.2 Music translation table

The table that script opcode `0x33` uses (`$8C:8442`, the same address in both) agrees with that
mapping. Every prototype song id ≥ 4 appears as id + 2 in the final, with these exceptions:

| Script music id | Prototype plays | Final plays |
|---|---|---|
| `9` | song 3 | **song 5** (new) |
| `71` | — (`$FFFF`) | song 3 |
| `72` | song `0x23` (final `0x25`, "A Boy and His Dog") | **song 4** (new) |

The prototype's debug sound test steps through 74 entries (`$0E5F` wraps at `$94`).

### 6.3 Samples

The prototype carries **310,223 bytes** of unique transfer data against **295,182** in the final. That
is 15 KB *more*, even though it has two fewer songs. Every large record is 3 + 9n bytes (a 3-byte
header plus 9-byte BRR blocks), so these are instrument samples. The final trimmed several shared
ones:

| Final songs using it | Sample size, prototype → final |
|---|---|
| `0x02` In the Arena, `0x0A` Desert of Doom | **8,967 → 2,181** |
| `0x0B` Queen Bluegarden, `0x17` Game Over, `0x27`, `0x28`, `0x43` Volcano Pipes | **13,053 → 8,877**, and a 28-byte record dropped |
| `0x09` Bugmuck Tar Pits | **4,863 → 1,083**, and a 68-byte record added |
| `0x08` Southern Jungle, `0x24` Staff Roll, `0x2A` Fire Eyes, `0x3A` Regal Castle, `0x44` Final Battle | 786 → 642 |
| `0x08` Southern Jungle | 939 → 741 |

Other per-song changes (small records, probably sequence or instrument data):

| Final song | Change |
|---|---|
| `0x2E` Death of a Minotaur | **+4,419 B**: two new samples (2,082 and 2,127 B) plus extra small records. The prototype version has two fewer instruments. |
| `0x07` Swamplands | two small record pairs removed (−19 B) |
| `0x2F` Fields of Gothica | 150 → 151 and 154 → 58 |
| `0x3A` Regal Castle | 127 + 122 → 30 + 30 |
| `0x3B` Freak Show!!! | 566 + 517 → 488 + 439 |
| `0x3C` Item Fanfare | 399 → 334 |
| `0x3F` Dark Greenhouse | 192 + 194 → 33 + 35 |
| `0x42` Collapse of Ivor Tower | 209/148/115/76 → 197/136/103/74 |

The descriptor block is 25,814 bytes, against 26,420 in the final.

### 6.4 Sound effects

The SFX translation table (`$8C:8362`, 112 words, the same address in both) differs in 12 entries:

- **Driver effects `$42–$4A` were reordered.** Prototype `$4A` became final `$42`, and prototype
  `$42–$49` each moved up one.
- Prototype `$57`/`$58` became `$58`/`$59`.
- Script sound **97 is silent** (`$FFFF`) in the prototype. The final assigns it a new driver effect,
  `$57`.

---

## 7. Engine code

Instruction streams were aligned per bank, considering code regions only:

| Bank | Same shape | Notes |
|---|---:|---|
| `$8C` engine | 94% | The debug block (§3) is the main removal. From the APU code up to `$8C:F0B7`, nearly every routine is `$44` bytes later in the final. |
| `$8D` menus | 97% | All menu strings (Enter Character Name, Window Prefs, Control Prefs, Stats, Alchemy, Ingredients, save/load) are at the same offsets ±4 |
| `$8E` before the character table | 84% | Ring-menu handling at `$8E:8159–85C5` was reworked (about 70-instruction blocks added and removed) |
| `$8E` after the character table | 94% | The debug HUD and sound test (`$8E:DEFC–E1C4`, `$8E:E75C–E854`) were removed |
| `$8F` combat and movement | 95% | Small additions around `$8F:B229` and `$8F:BAE0`. The error *"Error: too many scripted paths"* was removed; *"too many monster generators!"* stayed. |

Named final routines found in the prototype:

| Final | Prototype | Δ (final − prototype) | Routine |
|---|---|---:|---|
| `$8C:81FD` | `$8C:81FD` | 0 | APU handshake |
| `$8C:8362` | `$8C:8362` | 0 | SFX translation table |
| `$8C:8442` | `$8C:8442` | 0 | Music translation table |
| `$8C:988D` | `$8C:9849` | +`$44` | Decompression dispatcher. Same 8 methods, jump table at `$8C:985D`. |
| `$8C:98C9` | `$8C:9885` | +`$44` | LZSS |
| `$8C:9B65` | `$8C:9B21` | +`$44` | 2D Markov grid decoder |
| `$8C:C88C` | `$8C:C848` | +`$44` | Load a 16×16 map graphic |
| `$8C:C9C0` | `$8C:C97C` | +`$44` | Map graphic dual-stream decompressor |
| `$8C:C521` | `$8C:C4DD` | +`$44` | Print message |
| `$8C:D6BE` | `$8C:D67A` | +`$44` | Script opcode `0x30` (sound) |
| `$8C:D709` | `$8C:D6C5` | +`$44` | Script opcode `0x33` (music) |
| `$8C:F121` | `$8C:F0B7` | +`$6A` | Joypad-sequence matcher |
| `$8F:A914` | `$8F:A91E` | −10 | Elevation plane update |
| `$8F:AD51` | `$8F:AD57` | −6 | Entity mover |
| `$8F:ADB2` | `$8F:ADB8` | −6 | Drift / diagonal stairs |
| `$8F:AFF5` | `$8F:B01E` | −41 | Gravity |
| `$8F:B46D` | `$8F:B42E` | +63 | Body collision |
| `$8F:B5F2` | `$8F:B5B3` | +63 | Strike / projectile hit test |
| `$8F:BA06` | `$8F:B97A` | +140 | To-hit roll |
| `$8F:BA1A` | `$8F:B98E` | +140 | Hit cooldown |
| `$8F:C067` | `$8F:BFD8` | +143 | Physical damage |
| `$8F:C237` | `$8F:C1A8` | +143 | Pending damage applied |
| `$8F:C773` | `$8F:C6E8` | +139 | Sprite depth against the canopy |
| `$8F:CA50` / `$8F:CB18` | `$8F:C9C3` / `$8F:CA8B` | +141 | Segment ease tables |

---

## 8. Sprites

The sprite chunk lists (`$CA:0003` onwards, format in `src/maps/sprites.ts`) were walked in both
builds:

| | Prototype | Final |
|---|---|---|
| Frames in `$CA–$CF` | 4,847 (to `$CF:7F7B`) | 4,843 (to `$CF:7F6C`) |
| Same chunk count, flags and x/y, in order | **4,814 (99.4%)** | |
| Same including block ids | 2,391 (49%) | |

The frames are the same; the tile pools were repacked. Of the block-id differences:

- most 8×8 ids are **−2** in the final, later **−10**;
- some 16×16 ids are −8 or −4.

So the final inserted a few tiles near the start of both pools. That also explains the low byte match
from `$CC` on: from there the 16-bit block ids differ in nearly every chunk.

On the prototype's `$CE` tail (`$CE:7FB3`) the list ends with non-sprite data instead of the zero
count the final uses. A walker has to hop to `$CF:0001` by position.

---

## 9. Map graphics

The 16×16 map graphics are packed into every leftover gap (Rom-Map.md §2.11), so they move whenever
anything else changes size.

- Of the 1,047 graphics the final stores in banks `$08–$0F`, **786 (75%)** are on the prototype chip
  byte-for-byte, all at different offsets. The other 261 are either changed or were packed into a
  different chip in the prototype.
- Across the final's 6,688 graphics, 981 occur somewhere on this chip.
- Whole runs changed banks. The prototype's `$8D:E0B0` tail is the final's `$8B:A11E`. Parts of its
  `$8E` and `$8F` tails went to `$8C:FBC3`, `$8B:8EF7`, `$8D:E886` and `$8C:F29F`, and its `$C8` tail
  went to `$C7:5CC5`.

The map graphic table at `$EE:0000` is in chip 5, so it isn't possible to tell which room each
unmatched graphic belongs to, or whether the prototype has graphics the final doesn't.

---

## 10. Animation bytecode

`$C8:0000–15CF` and most of `$C9` lower hold animation scripts. Only 33% of `$C9`'s bytes occur in the
final. These scripts embed addresses of sprite frames and tile data, and those moved (§8). The
animation record table that indexes the scripts is in `$C4` (chip 0), so the scripts couldn't be walked
and compared by opcode. A low byte match here is not evidence that the animations themselves changed.

---

## 11. Unchanged structures

| Structure | Result |
|---|---|
| Ring-menu icon table (`$8E:8000`) | Same 162 entries pointing to the same 8-byte records. Every record has the same in-category index. Name pointers are +`$1E` in the final, animation records +`$22`, palettes −`$8E`. |
| Dog forms | Same six forms with the same headers. Pointer table at `$8F:9450` (final `$8F:945F`). Animation offsets are +38 in the final. |
| Global animation id table | Still read from `$C4:3C92` (the dog-animation cheat uses it) |
| Menu text | Identical |

---

## 12. Strings

Null-terminated ASCII in the chip compared with the same banks of the final:

**Only in the prototype** (all in the debug block, plus one engine error):

```
Here, have some ingredients!        Debug ON
Fine, have all the spells too...    Debug OFF
Jerk!                               Debug level 2
Bogus Game                          All Weapons!!!
Save Game                           All Armor!!!
Lots-O-Beads                        All Charms & Trade Goods!!!
Alchemy spell levels at level       Weapon skill levels at level
Error: too many scripted paths
```

**Only in the final:** `Confounded!`

Everything else is identical: menus, stats screen, "k reaches level", "Received", "Dog attack now
level", "No spells in library", "null life ptr used in script cmd", "I can only talk about one life at
a time!", "player 3", "player 4". The last two are themselves leftovers from the engine's multiplayer
roots.

---

## 13. What this chip can't tell us

These are all in the missing chips (0 and 2–5):

- the header, so there is no build date or version byte;
- the reset vector and main loop;
- dialogue (`$C0–$C3`) and character names (`$C4`);
- event scripts (`$92–$9B`) and rooms (`$9C–$AD`);
- the map graphic table (`$EE`) and sprite pixel data (`$D1`, `$D9`, `$EC`);
- the status, alchemy and projectile tables (`$90–$91`);
- the song pointer table and most song bytes (`$81–$87`).

So it's unknown whether the prototype has different maps, script flow or text. It is also unknown
whether anything outside this chip turns on debug mode.

---

## Appendix: reproducing

The analysis scripts lived in a session scratchpad and are not checked in. Everything above can be
rebuilt from the two ROM files with:

- the chunk relocation map (32-byte window index, §1);
- the `src/emulator/cdl/opcodes.js` matrix for disassembly (`M`/`X` tracked through `REP`/`SEP`);
- the structure layouts already in this repo: character table (`soe://rom/assets/tables/character_table`),
  song packages (`src/music/model/rom-audio.js`), sprite chunk lists (`src/maps/sprites.ts`);
- the parameters given above: prototype character table `$8E:B69C` × 136 × 76, song packages from
  `$8A:E220`, cheat table `$8C:F865`.

---

## TL;DR

Only what is new or different. Unchanged and merely relocated data is left out.

**Completely new: a debug and cheat suite the final deleted (§3)**

- A debug flag at `$7E:0E65` and **22 joypad-sequence cheats**:
  - 99 of every ingredient, all formulas;
  - all weapons, all armor, all charms and trade goods;
  - HP 100 / 999 / halve;
  - kill all enemies;
  - save anywhere;
  - level up;
  - alchemy and weapon skill +1;
  - cure status;
  - edit the state of the nearest room object;
  - debug level 2.

  Their messages include *"Fine, have all the spells too..."*, *"Jerk!"* and *"Lots-O-Beads"*.
- A **built-in sound test**: hold Select and use the d-pad to step through 74 music entries or 112 sound
  effects, which play on release.
- A **collision HUD** showing the collision word under the character's feet, its elevation, and its map
  cell. The developers apparently tuned room collision with it.
- A debug text window in the script trigger dispatcher, a "DB: +N EXPERIENCE." message on kills, and
  an L/R-held movement path that is probably walk-through-walls.
- **It's locked in this build.** The Debug ON/OFF sequence (hold A, tap Start 3×, then Start+A+Select)
  lands on a stray `RTS` one byte before the real toggle. Setting `$7E:0E65` = 1 would enable all of it.

**What this reveals about the retail game**

- **Select (switch boy/dog) still runs through the cheat matcher.** Its table at `$8C:F216` holds just
  that one entry. Retail has no cheat codes.
- The string "DB: + … EXPERIENCE." survives in retail at `$8F:82FC`, with nothing referencing it.

**An earlier game balance and cast (§4–§5)**

- **No Dark Toaster.** The stronger second versions of Rat, Mechaduster, Tentacle and Tiny Tentacle are
  also missing (136 characters against 142).
- **The final bosses were swapped.** Carltron's Robot has 20,000 HP and Magmar 30,000; the final reverses
  that. Eye of Rimsala has 10,000 HP instead of 6,000.
- **Red Jelly Ball** has attack 45 instead of 110, defense 120 instead of 240, and gives 100 EXP instead
  of 600. Mechaduster gives 50 EXP instead of 600. Aquagoth drops 1,000 talons; in the final it drops none.
- **No Confound status.** Rat and Mad Monk have no status attacks.
- Money is a 32-bit field.

**Different music (§6)**

- **Two songs don't exist yet**: final `0x04` and `0x05`. Every later song id is 2 lower.
- Script music id 9 plays a different track.
- Instrument samples are much larger. One shared by "In the Arena" and "Desert of Doom" is 8,967 B
  against 2,181 B in the final; overall there is about 15 KB more music.
- "Death of a Minotaur" has two fewer instruments.
- Sound effects `$42–$4A` are in a different order, and one script sound is silent.

**Unknowable from this chip:** maps, scripts, dialogue and the build date are on the five missing chips.
