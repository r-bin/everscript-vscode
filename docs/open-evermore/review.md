# Open Evermore: Architecture & Usability Review

Reviewed: `docs/open-evermore/` (7 docs), `tools/open-evermore/` (40 `.mts` files, ~7,000 LOC), and an exploded US 1.0 tree (`out/open-evermore/`).

---

## 1. Executive Summary

**Open Evermore** is an impressively engineered reverse-engineering and ROM-rebuild pipeline. Its core invariants — the *hard rule* (every exploded resource is reached only through generated tables/pointers), **G0** (byte-identical `--strict` round-trip), **G1** (randomized-layout lockstep `prove`), and **compile-time validation** — are far more rigorous than typical SNES ROM-hacking tools.

However, there is a clear gap between its current state as an **infrastructure & RE lab (A+)** and your stated goal of a **practical, extensible modding SDK (C-)**. Right now:

- **Understanding the game:** Very useful, though cluttered by read-only derived dumps mixed into editable JSONs and thousands of raw hex addresses.
- **Extending the game:** Works well for the big, already-relocatable kinds (maps, tiles, tile families, dialogue strings, scripts, sprite blocks), but hits hard walls on **in-place kinds** (menus, consumables, equipment, alchemy, opcodes, projectiles) and unexploded layers (**animation scripts/records/palettes** and **65C816 code**).
- **Everscript integration:** Not wired up yet — adding a string or resource in Open Evermore does not yet expose it to `.evs`.

---

## 2. Docs & Codebase Audit

### Documentation (`docs/open-evermore/`)
- **Strengths:** Honest, well-organized, and unusually disciplined about recording evidence, limits, and traps (e.g. `Rule.noBankEnd`, cycle sensitivity, `$B0` past-end reads).
- **Drift / staleness:** The code has outpaced the docs:
  - [`manifest.md`](manifest.md) and [`validation.md`](validation.md) still carry `Status: design (2026-11-18), nothing built` even though `manifest.mts`, `layouts.mts`, and 28 validation rules are built and tested.
  - [`tool.md`](tool.md) still says `built for maps, tile families, tiles, strings and scripts`.
  - [`progress.md`](progress.md) does not yet list `equipment` (`equipment.mts`) or `alchemy` (`alchemy.mts`), which are already registered in `tools/open-evermore/evermore/kinds.mts`.

### Tooling (`tools/open-evermore/`)
- **Strengths:** The game-neutral core is remarkably small and clean (`implode.mts` 194 LOC, `layout.mts` 220 LOC, `codec.mts` 164 LOC, `enum.mts` 52 LOC, `layouts.mts` 90 LOC). Codecs reuse `dist/` decoders instead of duplicating game logic.
- **Weaknesses:**
  - `manifest.json`'s `regions` and `placement` policy from [`manifest.md`](manifest.md) §1.3–1.4 are mostly unimplemented stubs (explode writes one `"rom"` region and `"placement": {}`).
  - Two codecs exceed the 400 LOC guideline: `scripts.mts` (422 LOC, largely due to map-folder script scoping) and `menus.mts` (476 LOC).
  - **Two very different kinds of codecs share the same tree:** truly relocatable/growable kinds (`maps`, `tiles`, `strings`, `scripts`, `sprite_blocks_*`) sit next to fixed-size, in-place editors over `_base/` (`menus`, `equipment`, `alchemy`, `projectiles`, `opcodes`, `fonts`, `hud`). Nothing in the tree's layout tells a modder which kinds can grow and which will fail with `id-over-limit` or `no-room` the moment you add an entry or lengthen a string.

---

## 3. Is It Useful to Understand the Game?

**Verdict: Yes (4/5) — already one of the best ways to inspect Secret of Evermore's data, with three friction points.**

### What works well
- **Maps (`maps/rooms/<map>/`)** are genuinely readable: `map.json`, aligned `grid.txt`, symbolic `metatiles.json` (`tile_0d7b p2 pr v`, `gf z1`), decoded `objects.json` states (no XOR math by hand), and `preview.png`.
- **Scripts** with opcode names, infix expressions, WRAM/flag/entity/string/animation names (`write_word ENEMY_SPAWNER_QUANTITY, 1`, `damage dog, 10`) are night-and-day more readable than raw bytecode.
- **Structured tables** (`opcodes/`, `menus/`, `equipment/`, `alchemy/`, `characters/records/`) turn scattered parallel ROM tables into cohesive per-entity JSON files.

### What hurts understanding
1. **Editable vs. derived/read-only data is blurred.** For example, `characters/records/<enemy>/animations.json` is ~1,900 lines per character, 99% of which is a derived dump of facings, frames, and sprite pieces that `implode` completely ignores — only `"record": "$49C6"` is read. A newcomer editing `x`/`y` or `pieces` will think they edited an animation, only for `implode` to silently ignore it.
2. **Duplicated documentation inside every instance file.** Every projectile JSON repeats the same 12-line `"what"` dictionary; every `records.mts` kind repeats notes per file. Field documentation belongs in one schema/README per kind, not copied into every data file.
3. **Numeric placeholder names.** `tile_0d7b`, `string_0afb`, `family_020`, `block_0c49`, `projectile_13`, and `step_1_sub_2` are honest (avoiding third-party names), but mean a human still has to cross-reference previews or search text to understand what an asset is.

---

## 4. Is It Useful to Extend the Game?

### Against Your Stated Goals

| Goal | Status | Reality Today |
|---|---|---|
| **Change a string → every consumer uses the new one** | 🟨 Partial | **Dialogue strings (`strings/`):** Yes, movable and growable (up to 21,845). **UI/item/weapon/formula names (`$C4` ASCII):** No — written in-place, capped at vanilla byte length (`no-room`), and character names are still raw pointers (`"$C46EB0"`). |
| **Add a string → usable from Everscript** | 🟥 No | Usable from Open Evermore's own `.txt` scripts, **not** from the Everscript compiler (`.evs`). Compiler-to-tree integration is still unbuilt. |
| **Adding content doesn't break anything (given free resources)** | 🟨 Partial | True for **movable/growable kinds**: maps (256), strings (21,845), tiles (21,845), tile families (1,024), scripts (21,625), animate IDs (2,048), enemies (256), characters (254), sprite blocks (21,845 each). **False** for all in-place kinds (`ring_items` 162, `item_actions` 9, `weapons` 14, `armour` 40, `formulas` 35, `opcodes` 195, `projectiles` 16, `music` packages 71). |
| **ROM size is not an issue; speed is** | 🟨 Partial | Auto-growth `3 MiB → 4 MiB → ExHiROM 8 MiB` is built, **but** `manifest.json` `placement` (`fast` vs `any` / `heat`) is not implemented yet. Growing to ExHiROM can spill hot data into slow `$41–$7D` banks without warning. |
| **Compile-time limit awareness** | 🟩 Yes | **Strongest feature.** `_enum.json` `limit` + `why`, `id-over-limit`, `over-budget`, `no-space`, `unknown-reference`, and post-build round-trip checks catch mistakes immediately with file + JSON pointer locations. |

### Tested Against Your Three Concrete Examples

#### Example 1: *"Add a new consumable that restores 400 HP"* → 🟥 Blocked
Today you can only **repurpose** an existing consumable (rename it within its vanilla byte length and swap its icon/palette). You cannot *add* one because:
1. `menus/ring_items/` is pinned in-place at 162 entries (`$8E:8000`–`$8E:8653`).
2. `menus/item_actions/` is a fixed 9-entry jump table at `$8E:A873` with code immediately after.
3. The inventory-to-ring mapping table (`$C4:5AAE`) and WRAM item-count slots are still in `_base/`.
4. Writing a 400 HP heal handler requires 65C816 code, and `code/` (S9) is not exploded yet.

#### Example 2: *"Fix Laser and make it available"* → 🟨 Half-works today
- **Works now:** Laser already has a slot in `alchemy/formulas/laser.json` (id 20). You can raise `power` from `0`, set `cost`, `target`, and point `block` to any of the 53 existing spell effect blocks, then grant Laser from any room script (`scripts/`).
- **Blocked:** You cannot author a **new** custom Laser spell animation/effect (`$91:80A6` alchemy bytecode VM blocks are in `_base/`), lengthen its name/description past vanilla bytes, or change its `alchemy_actions` handler in `$8E`.

#### Example 3: *"Add custom animations for entities"* → 🟥 Blocked at S7d
- **Works now:** You can edit/add 16×16 and 8×8 sprite block PNGs (`sprite_blocks_16/`, `sprite_blocks_8/`, up to 21,845 each) and add `animate()` IDs (`characters/animations/`, up to 2,048).
- **Blocked:** S7d (`animation records` in `$C4`, `animation scripts` in `$C7–$C9`, `sprite infos` in `$CA–$D3`, and `sprite palettes` in `$90`) is completely unbuilt (`🟥`). You cannot create a new animation sequence, frame layout, or palette.

---

## 5. File Structure Critique: Scripts Inside Map Folders

Your instinct is backed up by the numbers in the exploded tree:

- **2,766** scripts live under `maps/rooms/<map>/scripts/`, while **522** live under `scripts/global/`.
- **463** script calls cross room boundaries (`@some_other_room/step_1_sub_2`), including calls from `scripts/global/` into arbitrary room folders.
- Because a script is placed in *"whichever room's trigger or enter record reaches it first in table order"*, folder placement is an accidental side effect of ROM table order rather than real ownership.

### Why this hurts both modders and the codebase
1. **Reuse & linking are awkward:** Sharing a script between two rooms means either referencing `@other_room/b_2_sub_1` (fragile if that room is renamed/deleted) or manually promoting it to `scripts/global/`.
2. **Breaks the tree's own folder rule:** Every other kind lives cleanly in one directory managed by `folders.mts`. `scripts` is the sole exception that leaks into `maps/rooms/`, forcing `scripts.mts` (422 LOC) to invent `SCRIPT_NAME_RE`, `relativeName`, `resolveName`, `scriptOf()`, and `@/name` shadowing syntax.
3. **Same pattern in `music/packages/`:** Shared audio chunks live in whichever song package used them first (e.g. `village_on_the_plateau/package.json` references `battle_with_thraxx/data_5` and `return_to_podunk/data_20`). Deleting or replacing one song can break another song's transfers.

### Recommended structure
- Put **all scripts under `scripts/`** (for example: `scripts/global/`, `scripts/shared/` for multi-room subroutines, and `scripts/rooms/<map>/` for single-room scripts — or flat `scripts/<name>.txt`).
- Keep `maps/rooms/<map>/` strictly for **map data** (`map.json`, `grid.txt`, `metatiles.json`, `objects.json`, `preview.png`), referencing scripts by name in `map.json` just like `tileFamilies` and `tiles`.
- Similarly, put shared audio pieces in `music/data/` (or `music/samples/`) instead of inside an arbitrary song's folder.

---

## 6. JSON Content Critique: ROM Pointers vs. Resource Names

A scan of the exploded tree (`out/open-evermore/`) confirms your frustration — raw hex addresses are pervasive in the JSONs:

| Folder | JSON Files | Files with Hex Addresses | Total Hex Addresses | What They Are |
|---|---:|---:|---:|---|
| `characters/records` | 284 | 284 (100%) | **17,905** | `character.json`: `"name": "$C46EB0"`, `"palette": "$B52B"`; `animations.json`: `"record": "$49C6"`, `"script": "$C8:095A"`, `"sprite": "$CC:565C"` |
| `characters/animations` | 212 | 212 (100%) | **1,690** | `"record": "$C4:xxxx"` + derived script/sprite addresses |
| `menus/ring_items` | 162 | 162 (100%) | **324** | `"icon": "$5606"`, `"palette": "$D0:AA0B"` |
| `characters/projectiles` | 16 | 16 (100%) | **64** | `"animation"`, `"palette"`, `"unknown_04"`, `"unknown_06"` |
| `maps/rooms` | 381 | 127 (33%) | **127** | `enter.word` (`"$0001"`) |
| `menus/rings` | 18 | 18 (100%) | **19** | `"flags": "$0000"` |
| `music/packages` | 71 | 71 (100%) | **3,754** | SPC700 ARAM destination addresses (`"to": "$1F50"`) — hardware RAM, not ROM pointers |

*(Equipment and alchemy JSONs also carry `$C4:xxxx` animation pointers and raw hex palette/target words.)*

### Root causes
1. **Unexploded dependencies leak upward:** Because sprite palettes (`$90`/`$D0`), `$C4` UI strings, and animation records (`$C4`) are not exploded as named kinds yet, every kind that points to them (`characters`, `ring_items`, `projectiles`, `weapons`, `armour`, `formulas`) has to emit raw hex pointers.
2. **Derived views pollute editable files:** Almost all 17,905 addresses in `characters/records/` come from the read-only `animations.json` dump.

### How to fix it
- **Explode the three shared leaf kinds next:**
  1. `$C4` plain UI strings (`strings/ui/` or unified with `strings/`) so `character.json`, `ring_items`, `weapons`, `armour`, `formulas`, and `ingredients` all reference string names — and strings can move/grow freely inside `$C4` (or beyond once readers are widened).
  2. Sprite & icon palettes (`graphics/palettes/` for `$90` and `$D0`), referenced by name.
  3. Animation records/scripts (S7d) so `record`, `icon`, and `animations/*` become names.
- **Strictly separate editable data from derived previews:** Keep previews in `preview.png` or an optional `--inspect` output, never mixed into editable JSON fields that `implode` silently discards.

---

## 7. Should We Switch from HiROM to SA-1?

**Short answer: No — keep `hirom` (3 → 4 MiB) → `exhirom` (8 MiB) as Open Evermore's default, and keep `sa1` as an opt-in target.**

### Why NOT switch to SA-1 by default
1. **Vanilla Evermore is rarely CPU-bound:** The repo's own busy-play profile (`docs/sa1/README.md`, `npm run sa1:load`) measured slowdown on only **0.1–3%** of field frames (and 85.6% of intro cycles are spent spinning in `wait_for_nmi`).
2. **Converting to SA-1 gives 0% speed gain by itself:** Stage C1 (already built in `tools/sa1/`) runs the game on the S-CPU with the SA-1 held in reset. Because **the SA-1 cannot see WRAM (`$7E/$7F`)**, and all of Evermore's state (entities, collision, scripts, RNG) lives in WRAM, getting real speed requires Stage C2/C3 (DMA snapshots through `$2180` or moving variables into BW-RAM/I-RAM) — months of invasive engine work that also ends frame-exact lockstep (`prove`).
3. **SA-1 adds permanent complexity to Open Evermore:**
   - **Dual-view duplication:** Code in `$80–$BF` exists twice (LoROM view + linear view), complicating patching, layout, and debugging.
   - **Banked windows vs. flat space:** ExHiROM gives ~7.9 MiB of flat addressable ROM with zero bank-switching; SA-1 requires 1 MiB mapper windows (`$2220–$2223`) for anything past 4 MiB.
   - **Compatibility:** ExHiROM works on every emulator and basic flashcart; SA-1 requires accurate SA-1 emulation or an FXPak Pro–class cart, and is out of scope for `snesrecomp`.

### How to get speed *without* SA-1 (ExHiROM done right)
ExHiROM's only real speed downside is that banks `$41–$7D` are SlowROM (2.68 MHz vs 3.58 MHz). You can neutralize this cleanly inside Open Evermore's allocator:
- **Implement `manifest.json`'s `placement` (`fast` vs `any` / `heat`):** Keep code, scripts, and hot tiles/sprites in FastROM (`$80–$FF`), and push cold/load-time assets (music packages, dialogue strings, cold rooms) into `$41–$7D`.
- **Trade space for speed:** With 4 MiB of extra ROM, you can store room blocks **uncompressed** (`method $00`, raw copy) in free space — making room loads *faster* than vanilla without touching a second CPU.

### When SA-1 *is* worth it (and how)
SA-1 earns its keep when a hack wants things ExHiROM physically cannot do:
- **Low-effort SA-1 wins (work in C1 with no CPU offload):** Up to **256 KB battery-backed BW-RAM** (more save slots, NG+, expanded event flags, decompressed room cache).
- **High-effort SA-1 wins (C2/C3):** More enemies/projectiles on screen without slowdown, 2-player co-op logic, smarter AI/pathfinding, variable-width bitmap fonts, or Mode 7/sprite rotation.
- **How to keep the door open:** `layouts.mts` already supports `"layout": "sa1"`. Keep it opt-in, and only invest in SA-1 C2/C3 *after* `code/` is exploded and a late-game/boss-fight profile proves S-CPU cycles are the real bottleneck.

---

## 8. Personal Verdict: Is This Useful for the Hacking Community?

**Verdict: Not yet for day-to-day modders, but it is a genuinely exceptional foundation — and 2–3 focused milestones away from being the best SNES RPG hacking workflow around.**

- **Why hackers will love where this is going:**
  - **Legal, Git-friendly collaboration:** Modders work on clean JSON/PNG/text files and ship BPS patches — no ROM distribution, easy code review and merging.
  - **Compile-time safety nets:** Catching broken references, bad values, and table overflows at `implode` time eliminates the worst part of SNES ROM hacking (mysterious runtime crashes).
  - **Automatic layout & growth:** Not having to manually hex-hunt for free space in `$F0–$FF` or `$41–$7D` is a massive quality-of-life leap.
- **Why a hacker can't switch to it *today*:**
  - You still cannot do bread-and-butter RPG hack tasks (add a consumable, add an enemy animation, lengthen an item name, add a custom opcode, or compile `.evs` into the tree) without falling back to raw Asar patches.
  - Too many JSONs still expose raw ROM pointers (`$C46EB0`, `$D0:AA0B`, `$5606`) or mix read-only derived dumps with editable fields.

---

## 9. Top Recommendations (Prioritized)

1. **Move scripts out of `maps/rooms/` and shared audio data out of `music/packages/`.**
   Keep all scripts under `scripts/` (e.g. `scripts/rooms/<map>/`, `scripts/shared/`, `scripts/global/`) so every kind owns one directory tree, cross-room reuse is natural, and `scripts.mts` drops its special-case path/shadowing machinery.
2. **Eliminate raw ROM pointers from editable JSONs & separate derived previews.**
   - Explode `$C4` UI/name strings into a real named, relocatable kind (lifting the vanilla byte-length cap on item/weapon/formula/enemy names).
   - Explode sprite/icon palettes (`$90`, `$D0`) into named palette resources.
   - Strip read-only derived dumps out of `characters/records/<name>/animations.json` (and duplicated `"what"` docs out of every JSON) so every field in an editable file is actually honored by `implode`.
3. **Connect the Everscript compiler (`.evs`) to the Open Evermore tree.**
   Let the compiler read `_enum.json`s (strings, maps, enemies, items, animations, sounds) and output scripts directly into `scripts/`. This fulfills the core loop: *"add a string → use it in Everscript"*.
4. **Make gameplay tables growable and unlock S7d (animations) + S9 (`code/`).**
   To support your concrete examples (new consumables, custom Laser effects, custom entity animations, new opcodes), move past in-place editing:
   - Finish S7d (animation scripts/records/sprite infos) so custom entity animations are first-class.
   - Allow `ring_items`, `item_actions`, `weapons`, `formulas`, and `opcodes` tables to relocate and grow when entries are added (via small generated reader patches, just like `maps` and `strings` already do).
   - Add a lightweight `code/` hook mechanism (Asar routines referenced by name from `opcodes/`, `*_actions/`, `attack_procs/`, `behaviours/`) even before the entire ROM's disassembly is exploded.
5. **Implement `manifest.json` `placement` (`fast` vs `any` / `heat`) instead of migrating to SA-1.**
   Keep HiROM 4 MiB → ExHiROM 8 MiB as the default, enforce FastROM placement for hot resources, emit `slow-hot` warnings, and add event-based proof comparison so ExHiROM/promoted builds can be validated cleanly.
6. **Add `rename`, BPS patch export, and sync the docs.**
   `rename` makes cleaning up `tile_xxxx` / `string_xxxx` names painless; BPS export completes the modder sharing loop; updating the stale status headers in `docs/open-evermore/` keeps the project's docs as trustworthy as its tests.
