# Old community Ghidra notes (2019–2022)

An analysis of an old, hand-annotated Ghidra project for Secret of Evermore that came from the
community, plus the copy of a script dumper that was stored next to it. This page says what the
project holds, where it agrees with what we already know, what it adds, and how to use it.
Developer names are left out on purpose.

Nothing from the project is in this repo: no ROM bytes, no export of its comments. Facts taken
from it go into the knowledge base **in our own words** and only after we checked them against
the game (skill `game-knowledge`; the community note is only the lead, the evidence is our own
check).

---

## 1. What it is

| Item | Content |
|---|---|
| `EvermoreASM.gpr` / `.rep` | A Ghidra project with one program, `Evermore.sfc`. Created Dec 2019, last saved Jul 2022 |
| ROM inside | The clean US ROM (MD5 `6e9c9451…`, the same file as our reference ROM) |
| Load mode | **Raw binary at offset 0**, one 3 MB block called `bus`. No SNES loader and no functions were made; all of the analysis is in comments and typed data |
| Language | `65816:LE:16:default`, from an older 65816 plugin than the `ghidra-snes` we use |
| Annotations | 9,131 comments (9,118 end-of-line, 13 plate), ~18,600 typed data items, ~430 user data types, 23 bookmarks, no named functions, no equates |
| `Script Dumper/` | A 2020 clone (2 commits) of the third-party script dumper the root `AGENTS.md` names (GPLv3): one C++ file that lists every room's enter, step-on and B-trigger scripts as text/HTML (§7) |

This is **not** output of the third-party tile viewer. The project contains no tile, map or rendering material.
Its type names and terms differ from both third-party tools, and everything in it was typed in by
hand in Ghidra.

### Opening it

The project does not open in a current Ghidra as it is:

1. **Owner check**: `NotOwnerException: Project is owned by …`. Work on a copy and set the
   `OWNER` value in `EvermoreASM.rep/project.prp` to your own user name.
2. **Missing language** `65816:LE:16:default`. Copy the Ghidra install (`cp -cR` on APFS costs
   almost nothing) and add an `.ldefs` file to the copy's
   `Ghidra/Extensions/ghidra-snes/data/languages/` that declares id `65816:LE:16:default` and
   points at ghidra-snes's `65816.sla` / `65816-snes.pspec` / `65816.cspec`. That is enough to
   read the annotations. Do not use it to analyse code: the address model is not the original
   one.
3. Run headless and read-only: `analyzeHeadless <dir> EvermoreASM -process Evermore.sfc
   -noanalysis -readOnly -postScript <dump script>`. The script that walks symbols, comments,
   defined data, data types and bookmarks belongs outside the repo, like every Ghidra artefact
   (skill `ghidra-analysis`).

### Addresses

An address in the project is a **file offset**. Convert it the way the game sees it:
`off & 0x8000 ? 0x800000 + off : 0xC00000 + off`. Code and scripts sit in the upper half
(`$80–$AF`) and data tables in `$C0–$EF`. In this page every address is already converted.

---

## 2. Its terms mapped to ours

| Community term | Ours | Where |
|---|---|---|
| Main Scripts | Everscript (the room/event script language) | `$92`+, the scripts of the rooms |
| Math Scripts | Expression sub-instructions inside Everscript operands | the `$8C:D000–$8C:EFFF` evaluator, operands in `$92`+ |
| Behavior Scripts | **Animation scripts** (interpreter `$90:80D0`, records `$C4:3E3A`) | bytecode mostly in `$C7:0000–$C9:FFFF` |
| Behavior Script pointer (`$C4` Bank Info) | Animation record: 24-bit pointer + 1 flag byte (4 bytes) | `$C4:3E3A–$C4:5999`, ~1000 records, grouped into 4- and 8-direction sets |
| Spell Scripts | Alchemy formula blocks in bank `$91` (`ALCHEMY_BLOCK_TABLE`, `$91:80A6`) | `$91:8114–$91:9734` |
| Character Type Raw Data | Character record (`$8E:B678 + 74·n`) | 142 records |
| Icon info | Ring-menu entries (item/weapon/alchemy icons) | `$CE:8144`+ |
| Map Exit / Map Interact | Step-on triggers / B-triggers (the room's trigger boxes) | in each room blob |
| Map Basic Data | Room blob header | the start of each room blob, `$9C:8000`+ |
| Mercy Inv. Flag | Short invincibility after a hit | set/cleared around every damage step in `$91` |
| Tactical Fatigue | The attack recovery state after a swing (also forced by some hit checks) | branches in nearly every weapon and dog animation |

---

## 3. Data tables

Status: **known** = already in our knowledge base and the community layout agrees with it;
**checked** = new to us, spot-checked against the ROM for this page (values make sense); **lead** =
new to us, not checked yet.

| Bus address | Size | Content (community reading, our words) | Status |
|---|---|---|---|
| `$C4:001A` | 201 × 24 B | Font glyphs, 12 rows × 2 bytes per glyph (left 8 columns, then right 8) | lead |
| `$C4:0C02`, `$C4:1884` | 2 × 128 B | Width per character code of the two text fonts | checked (A–J: 6,6,5,6,6,5,6,6,2,5) |
| `$C4:1924`, `$C4:19B4` | 8×8 tiles | Text window fill patterns and window borders | lead |
| `$C4:3876–$C4:38E5` | words | Weapon-related word lists (per weapon kind, 3 levels) | lead |
| `$C4:38E6` | 15 × 36 B | **Weapon record**: +0 attack power, +2 name pointer, +8..+1B animation ids (stand, walk, run, L0–L3 attack, dodge, recoil, yawn), +1E icon id | checked (ATK 10/20/30/50 … 200/350/800; icons 40,42,…,70) |
| `$C4:3B02` | 40 × 10 B | **Armor record**: +0 defense, +4 name pointer | checked (four rising groups, e.g. 3,4,7,12,…,169) |
| `$C4:3C92` | 212 words | Global animate() id → record | known (`rom/c43c92.md`) |
| `$C4:3E3A` | ~1000 × 4 B | Animation records; the project names nearly every group (Boy per weapon and direction, each dog form, enemies, bosses, spell effects) | known table; the **names** are a lead for `names.json` / the Scripts tab |
| `$C4:5A12`, `$C4:5A4E`, `$C4:5A75`, `$C4:5CC7` | 24-bit pointer lists (20, 13, 5, 22) | Alchemy/effect related, not named | lead |
| `$C4:5C81`, `$C4:5E25` | 35 words each | One bit-field word per alchemy formula (two different tables) | lead |
| `$C4:5D09` | 35 words | Alchemy formula name pointers | lead |
| `$C4:5D51` | 35 words | Alchemy formula description pointers | lead |
| `$C4:5DDF` | 35 words | Formula → its block in `$91` | known (`rom/c45ddf.md`) |
| `$C4:601F` | 35 × 4 B | **Ingredient cost** per formula: type 1, type 2, amount 1, amount 2 | checked (amounts 1–3) |
| `$CE:8100–$CE:863C` | 8 B entries | Ring-menu entries: name pointer, indirect animation pointer, ?, inventory count; grouped per ring | partly known (`docs/item-icons.md`) |
| `$8E:B55A` | 143 words | Enemy id → record | known (`rom/8eb55a.md`) |
| `$8E:B678` | 142 × 74 B | Character records (§4) | known; field names extend ours |
| `$8F:936D` | 6 × 40 B | **Dog form record**: default standing animation, status icon, palette, aggro range, then animation ids (stand, walk, run, block, recoil, L0–L3 attack, sniff, sniff move, sleep, sit, own action, bark) | partly known (`docs/adding-animations.md`) |
| `$8F:B090` | bytes | Bookmark "1 byte numbers" | in `tables.js` |
| `$8F:BAE3` | 26 × 52 B | Unnamed word arrays | lead |
| `$90:D441` | 2 × 32 B | Unnamed | lead |
| `$90:D9A6` | 21 × 24 B | **Projectile record**: +0 script, +2 palette, +C type, +E velocity, +10 lifespan, +12 upward velocity, +14 attack calc type, +16 fixed attack | lead (the `animation_script.md` reference there names the record start only) |
| `$91:D000` | 3002 × 3 B | Text pointer table | known (`docs/extension-tables.md`) |
| `$91:F000`+ | | Text compression dictionary (two-letter pairs such as "th", "ou") | lead |
| `$92:801B` | 126 × 5 B | Room list ("Map Stuff"), each named with the room it belongs to | known table; the names match our room names |
| `$92:8294–$92:9E09` | 286 × 3 B | Script pointers | known (`docs/table-hack.md`) |
| `$9F:FDE7` | | Room blob pointers ("Map Data pointers") | known |
| room blobs `$9C:8000`… | 6 B boxes | Trigger box: Y min, X min, Y max, X max, then a 2-byte script reference. The plate comments name the room of each blob | known format (`rom-map-data`) |

### Script bytecode layouts

The project types each script instruction as a struct. Most of them line up with what our
decoders already read. Only these are useful leads:

- **Animation scripts** ("Behavior"): `$1F/$20` wait timers (one with a random part), `$22–$2B`
  set the sprite data address in one of the banks `$CA–$D3`, `$2C` is a long form of that used
  for the shadow, `$2E/$2F` play a sound (`$2F` cuts it off 1 time in 4), `$31–$38` store, add
  to or clear a 1/2/3-byte field of the entity, `$39/$3A/$3B/$54` are conditional and plain
  jumps, `$3C/$3E` palette and background colour fades, `$3F/$40` sound volume (one follows the
  Boy's charge), `$45/$46` jump/fly velocity, `$47` hit box (centre X/Y, size X/Y), `$4C`
  spawns a projectile (projectile record + X/Y/Z offset), `$50` coordinate offset. Compare with
  skill `animation-script` before taking any of them.
- **Alchemy blocks** ("Spell"): the project reads them as a **word-coded bytecode** (2-byte
  opcodes), not as plain records: `$18` sprite palette rotation, `$1C` background flash
  (palette, start intensity, target, step per frame), `$3A/$3C` add/remove a status, `$3E`
  set a stat, `$4A` branch when the spell level is outside a range. Our `rom/9180a6.md` calls
  the blocks "data, not 65816 code". The two readings agree: the blocks are not 65816, but they
  are probably a small interpreted language. **Worth checking first**: it would explain the
  animation ids at even offsets.
- **Everscript / expressions**: `$3C` and `$BA` spawn an enemy (id, flags, X, Y). That matches
  our `0x3C`/`0xBA` spawn handlers. `$A7` waits a number of ticks. The expression ops read
  flags as bit tests (`$05/$0A`), event bytes (`$07`) and scenario words (`$08/$09`), and `$0D/$0E`
  index `$7E:2834` (our `ROOM_SCRATCH`). Nothing here that everscript does not already decode.

---

## 4. Character record fields

The project names the whole 74-byte record. Our `src/games/evermore/maps/character-record.ts` reads `+05`
flags, `+09` palette, `+0D` collision radius and the animation words from `+32`, and the
project agrees on all of these. New field names:

| Offset | Size | Field (community) |
|---|---|---|
| +00 | 3 | name pointer |
| +07 | 2 | combat flags |
| +0B | 2 | second palette |
| +0F | 2 | HP |
| +13 | 2 | aggro range |
| +15 | 2 | aggro chance (/256) |
| +19 / +1B / +1D / +1F / +21 | 2 each | ATK / DEF / magic DEF / evade / hit |
| +23 | 4 | EXP |
| +27 | 2 | money |
| +29 | 1 | drop chance (/128) |
| +2C / +2E | 2 each | charge-up limit / charge-up gain rate |
| +30 | 2 | attack calculation type |
| +32..+49 | 12 words | stand, walk, run, L0–L3 attack, recoil, death (no drop), death (drop), cast, block |

Spot check: the first three records (the Boy, the Dog, …) have HP 30, 36, 1, the rest 0, which
fits record templates for party members. `character-record.ts` now reads the record from the
game's own code (v0.283.0, knowledge `rom/8eb678.md`); this table agrees with it.

---

## 5. Code the project annotates

No functions were defined, so only the comments show what the code does. By region:

| Region | What the comments describe |
|---|---|
| `$80:8000–$80:DFFF` | NMI/IRQ setup, frame update hook (`[$0128]`), brightness, DMA of tiles to VRAM and colours to CGRAM, sound start, math helpers (multiply, divide, signed ranges), RNG, controller reading, mode-7 style rotation offsets, palette colour rotation |
| `$8C:8000–$8C:CFFF` | Text window engine: the main window writer, number printing (`[$22]`/`[$02]`), text bank/address and **dictionary** handling, character widths, menu controls ("disable buttons until release") |
| `$8C:D000–$8C:EFFF` | The expression ("Math Script") evaluator and stat access (`Y` = unit stats pointer), currency updates, status removal |
| `$8C:F000–$8D:DFFF` | Shops (insufficient funds, too many items, trade goods count), status/equipment/save screens, alchemy and ingredient menus, EXP/level display, Boy's and Dog's aggro level |
| `$8E:8000–$8E:B7FF` | Ring menu: targeting, spell slots and charge count, weapons/armor/items lists, buying and selling |
| `$8E:B800–$8E:DFFF` | Plate-style labels on each character record (NPCs, enemies, bosses) |
| `$8F:8000–$8F:9FFF` | Level cap 99, status bar HP row, Boy/Dog stats set-up, direction from deltas |
| `$8F:A000–$8F:DFFF` | Collision/tile info lookups, **attack and hit**: standard hit check, revenge aggro, status placement, damage (§6), D-pad and attack-button handling, AI walking |
| `$90:8000–$90:A7FF` | Animation script start/execute, Z position, hit box, camera X/Y set-up, map width |
| `$90:A800–$90:C7FF` | Labels on palette/script sets per spell, NPC and enemy |
| `$90:C800–$90:E0FF` | Palette rows (default + current), background colour intensity, projectiles: position, direction, damage/healing amount, upward velocity |
| `$91:8000–$91:CFFF` | Alchemy: per-formula blocks with **mercy invincibility** set/clear around each hit, damage and healing calculation, reflect, full heal, statuses and their icons on the Boy/Dog outline, "allotted castings" per formula (`$91:CE38`), active-spells check (`$91:98EE`), the friendly-alchemy path (`$8E:87C0`) |
| `$92:A000–$93:DFFF`, `$96`, `$99`, `$9B` | Notes inside Everscript: Thraxx ribcage open counter (`$93:CA76`), Nobilia market first closing timer (`$96:B8DA`: 50400 ticks, which the note reads as 14 minutes), Verminator casting (`$99:EFF8`), Carltron's robot (`$9B:A8DF`) |

Bookmarks worth following: "Likely per frame hit detection" `$8E:E464`, "Spell damage calculation
for enemies, maybe?" `$8C:D125`, "Worth noting, uses damage calculations" `$8C:E459`, "Graphics
script redo" `$90:8140`, "Script check" `$90:82F8`.

---

## 6. Mechanics stated in the comments

All unconfirmed. Each needs a trace in the emulator before it goes into a knowledge entry:

- **Physical damage** ≈ `(ATK − DEF/4) × r`, with `r` random in 3/4 … 5/4 (`$8F:B6D2–$8F:B8E6`,
  one site per attack kind, and `$8C:E459`).
- **Spell damage** ("effective might") ≈ `[$02] × (3…4)/4 × 2 / (targets + 1)`: spread over
  the targets (`$8C:D125`, `$8C:D1D1`, `$91:AD6A`; the alchemy path halves it, rounding up).
- **Charge-up** above 100 % adds damage: "surplus charge-up / 4" and "/256", with separate
  branches for 200–300 % and for 300 % (`$8F:8C7C–$8F:8E14`).
- Each enemy hit sets a **mercy invincibility** flag, and each alchemy block clears and sets it
  per hit.
- **Tactical fatigue**: the recovery state after an attack. One hit check forces it (Y offset −16,
  `$90:80A4`).
- Enemies have an **aggro range** and an **aggro chance /256**. A hit starts a "revenge aggro"
  script.
- The Boy's and the Dog's **aggro level** appear on the status screen (`$8D:86B9`+). An AI
  routine uses `30 + aggro level × 20` (`$8F:D790`).
- Drop chance is out of 128, and death runs a "drop" or "no drop" script.

---

## 7. The script dumper next to it

`Script Dumper/` is a 2020 snapshot of that third-party script dumper (GPLv3). AGENTS.md says not
to take code, tables, layouts or names from it. This section only says what it covers, so we
know where our own tools already reach further:

- It walks the room list, decodes each room's enter, step-on and B-trigger scripts and prints
  them as ANSI text or HTML. It can also find more scripts by following calls.
- It knows the room list address, the conversion between script addresses and ROM addresses in
  the script banks, a partial instruction set (unknown lengths stop the decoding), and
  hand-written labels for some WRAM variables (loot/prize, dog, save spot, shop, map bounds)
  and for sniff-spot flags.
- Our everscript decompiler, `soe://`, the Scripts tab and the Rooms tab cover all of this
  and more. **Nothing to take.** If one of its labels hints at an unknown WRAM address, find
  that address again in the running game and record our own finding.

---

## 8. What to do with it

In order of value:

1. **Alchemy blocks as bytecode** (§3): check the opcode reading against the cast in the
   emulator. It may turn `src/games/evermore/scripts-tab/model/alchemy.js` from "undecoded" into a decoder.
2. **New tables**: weapon, armor, ingredient cost, alchemy name/description pointers, dog form,
   projectile, font widths. Each becomes a `knowledge/rom/<addr>.md` entry after a check of the
   reader in the CDL (who loads it, with what stride).
3. **Character record fields** (§4) into `character-record.ts` and its doc, citing the ROM
   check (done in v0.283.0).
4. **Animation record names** (`$C4:3E3A`): about 1000 group names to compare with our
   generated ones (`re-curator` pass).
5. **Combat formulas** (§6): trace each in the emulator and record it under
   `docs/game-research/`.

Evidence for anything recorded from here is our own `trace`/`disasm`/`read` line. The
evidence may add "(lead: old community Ghidra notes)". A fact backed only by the note is
`confidence: guess`.
