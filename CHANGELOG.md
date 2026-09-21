## [0.25.0] — 2026-09-21

**The purple flower renders.** 121 of 141 enemies now resolve, up from 118.

### The fix: bit 7 is "end of frame", not a different opcode
The Wimpy Flower's script stopped at `0xa4`, which looked like an unknown command. It is not a command at all — the interpreter's dispatch masks it:

```
9080F2  ASL              ; carry = bit 7, A = (cmd & 0x7f) * 2
9080FA  BCC $9080EC      ; bit 7 clear: dispatch and keep going
9080FC  JSR ($8000,X)    ; bit 7 set: dispatch, then...
908100  DEC $0005,X      ; ...tick the frame timer and return
```

Both paths index the same table with `(cmd & 0x7f) * 2`. So `0xa4` is command `0x24` — a set-sprite — that also ends the frame, and the Flower's idle sprite (`$CC4F3B`) is reached through exactly that.

### Added
- Opcode masking, plus command lengths for `0x06`, `0x07`, `0x08`, `0x2e`, `0x41`, `0x53`, `0x54`, `0x5a`, measured from the Wimpy Flower trace.
- `$CC4F3B` pinned in the test alongside the Mosquito's `$CC5B1C`.

### A measurement caution, learned the hard way
Pairing consecutive `$5D` reads only gives a correct length when **one** entity is animating. The Flower trace had several, and the interleaving produced a wrong length for `0xa4` (5 instead of 3). It happened to change nothing — verified by diffing every enemy's resolved sprite before and after — but the safe rule is to measure on single-entity stretches and re-check that a new length changes no already-resolved sprite.

### Still missing
Twenty enemies stop on `0x1e` (13), `0x50` (4), `0x57` (2), `0x2d` (1). Both traces so far covered act-1 field enemies; a boss or later-act room would likely cover these.

## [0.24.0] — 2026-09-21

**Enemies are drawn on the room map, in the game's own artwork and palettes.**

### The chain, solved from the Mosquito trace
| Step | Where |
|---|---|
| Character record | `$8EB678 + id * 74` |
| Idle animation | record `+0x32` (`anim_stand`) |
| Animation script | 24-bit pointer at `$C40000 + anim_stand` |
| Sprite command | first opcode in `0x22..0x28` while walking the script |
| Sprite pointer | `((cmd + 0xA8) << 16) \| <u16 operand>` |
| Palette | record `+0x09`, a 16-bit address within bank `$90` |

The command byte carries the sprite's bank in itself — the interpreter does `TXA; LSR; ADC #$A8` on the doubled opcode. Command lengths were **measured**, not guessed: the interpreter reads each command with `LDA [$5D]` at `$9080F0`, so the distance `$5D` moves between reads is that command's length.

### Added
- `resolveCharacterSprite`, `characterPalette` and `renderCharacterSprite` in `src/maps/sprites.ts`.
- Spawns on the room map now draw the enemy's idle sprite instead of a hollow box, cached per character (a jungle places fourteen flowers and they are one picture). Enemies without a resolvable sprite keep the box.
- Test coverage: the Mosquito's sprite pointer `$CC5B1C` is pinned as the anchor — the one case checked against a running game — plus a floor of 118 enemies rendering.

### Measured
**118 of 141 enemies resolve and render.** Verified by eye against recognisable characters: blue mosquito, orange bee, green chameleon, grey boulder, Fire Eyes, Horace in armour.

### Still missing
The other 23 stop on an animation command whose length has not been measured: `0xd2`, `0x50`, `0xcd`, `0xa4`, `0x5a`, `0x2d`. **The Wimpy Flower is one of them** — its script stops at `0xa4`. A trace of entering the South jungle would cover it, since it spawns there.

Item icons are still a separate, unsolved problem: they are menu background tiles, not sprites.

## [0.23.1] — 2026-09-21

### Added
- `docs/sprite-rendering.md` updated from the Mosquito spawn trace. **The animation table is at `$C40000`, indexed by `anim_stand` directly** (`$90817B: LDA $C40000,X`), and a record is a list of 4-byte frames, `[spriteOffset:u16][u8][u8]`. The Mosquito's four frames are 21 bytes apart — exactly a four-chunk sprite — so the word is a byte offset into sprite-info data, not an index.
- **The decoder is now validated against live frames.** The trace hands 11 distinct 24-bit sprite pointers to the game's own renderer; decoding all of them cold from the ROM produces correct sprites. That is a stronger check than the walk count.

### Still missing
The base that frame offset is relative to. Scanning every base in `$C00000..$D00000` for one where both the Mosquito's and the Flower's frame gaps match their sprites' declared sizes finds **zero** candidates, so it is per-character or per-room — consistent with the draw routine taking a full 24-bit pointer from the entity's display list (`$8096DB`) rather than computing one. The next step is a breakpoint on writes to that display-list entry.

Two drawn sprites look like a mosquito and alternate 28/27 times, but they are 7 bytes apart (a one-chunk sprite) while the animation record calls for four-chunk frames — so that pairing is not claimed.

## [0.23.0] — 2026-09-21

Ports the ROM's sprite decoder. **Neither "enemies on the map" nor "all item icons" is finished** — both turned out to need a lookup that does not exist yet, and this is the layer underneath them.

### Added
- **`src/maps/sprites.ts`** — a port of SoETilesViewer's `spriteblock.h` and `spriteinfo.h`, the only implementation of this format anywhere. Decodes both block pools (16×16 at `$EC0000`/`$D90000`, 8×8 at `$D80000`/`$D10000`), the bit-per-word skip-list compression, and composes chunk lists into whole sprites.
- `checkSprites` in the map parity harness. The walk finds **5128 sprites**, the same count the reference's walk ends on — a sharp check, since it chains on each entry's declared length and one wrong size would desynchronise everything after it. 9 of 5128 are blank padding.
- `docs/sprite-rendering.md`.

### Why neither ask is done
- **Enemies.** The character table holds *animation pointers*, not sprite indices. Wimpy Flower's `anim_stand` is `0x495e`, and five readings of it were tried and ruled out (sprite index, `$CA0003+`, `$CA0000+`, `$90495E`, `$7E495E`). SoETilesViewer shows these values but never resolves them either. Drawing a guessed sprite would be worse than drawing none.
- **Item icons.** They are not sprites at all. The earlier menu trace found them composited from background tiles by a blitter at `$8CA6AB`–`$8CA6C6`, and rendering the tail of the sprite list confirms it — effects and particles, no icons.

### Lead worth following first
The everscript `ANIMATION` enum's values are the low 16 bits of a 24-bit pointer, with the bank in the comments (`MENU_CLOSE = 0x61a7` beside `[A7 61 7E]`). So `anim_stand` is probably a low word whose bank comes from elsewhere. Reading the encoder answered the spawn-format question outright last time, so it is worth checking `animate()` before reaching for a trace.

### Notes
- Decoder parity unchanged: 99.992% boundaries, 99.776% summaries, 593/593 sniff flags.

## [0.22.0] — 2026-09-21

Every NPC a script places is now named and plotted on the map.

### Why this went from "unknown" to "settled" in one step
0.21.0 reported spawns as bare indices and refused to place them, because two things were unestablished. Both were answered by reading the sibling `everscript` compiler instead of tracing the game: `add_enemy` is the function that *emits* these opcodes, so it defines them.

- **The index is an `ENEMY` enum value.** The encoder emits `enemy * 2` for the opcodes that store an address (`0x3c`, `0xa2`) and the bare value for the rest (`0xba`, `0xc2`), so unshifting lands back on the enum. Its comments carry the character record and the in-ROM name: `FLOWER_PURPLE = 0x0b, // #109, "Wimpy Flower"`.
- **Coordinates are the same space as `add_enemy(x, y)`**, which the encoder passes straight through — the same values the Rooms tab already plots live enemies at.
- **`$2433` is `ENEMY_SPAWNER_QUANTITY`**, not a character id. That is why it is written just before each spawn.

The earlier guess that the jungle's index 15 was the purple flower was wrong — 15 is the Mosquito; the Wimpy Flower is index 11.

### Added
- **1606 spawns across the ROM, 100% named**, 1603 with a character record. South jungle resolves to 7 Mosquitoes and 14 Wimpy Flowers.
- Spawns plotted on the map, drawn **hollow** because they remain candidates, with a `npc` toggle and a tooltip giving the enum name, the game's name, the character number and the caveat.
- The table under the enter script shows enum name, in-ROM name, character record and position.
- `0xc2` (`add_enemy_spawner`) is now reported too, with the quantity staged in `$2433`.
- `enemies` in `names.json` (144 entries), generated from the `ENEMY` enum.

### Still not built
The simulation itself. Which branch actually runs still needs an expression evaluator and a defensible starting WRAM, so the Rooms tab shows the reachable superset and says so. Drawing an idle animation is now **unblocked** — SoETilesViewer already decodes sprites, and the character record is known for every spawn.

### Notes
- Decoder parity unchanged: 99.992% boundaries, 99.776% summaries, 593/593 sniff flags.

## [0.21.0] — 2026-09-21

Reports which NPCs a room's enter script can place. The simulation that would narrow "can" to "does" is specified but **not built** — see `docs/room-simulation.md`.

### Added
- **`src/script/entities.ts`** — the three NPC-placing opcodes (`0x3c`, `0xba`, `0xa2`) now report what they place: index, state word and raw position. **734 placements across 103 rooms, 707 with a literal position.** `0xa2` computes its position, so it reports that something spawns without claiming where.
- A table under the enter script listing them, labelled **candidates, not contents**.
- `docs/room-simulation.md` — what a real simulation needs and what is still unknown.

### Why this is not the simulation that was asked for
Loot needed no simulation because a pickup writes its reward down as a literal. Room population is genuinely different: rooms are reused across the story and the enter script branches on saved flags, so the answer is *which branch runs*, not what the bytes say. Building that needs two things that do not exist yet — an evaluator for the operand grammar (the current one renders text, it does not compute), and a defensible starting WRAM. "Base boy" is not one state; the same room differs by act. A simulation that silently picks one would be exactly the confident-and-wrong output this decoder is built to avoid.

So the decoder reports the superset and says so.

### Two things deliberately not claimed
- **The NPC index is not a character id.** The jungle spawns index 15 and the enemy there is the Wimpy Flower, character 109. Ruled out: the character table (15 ≠ 109), the map blob's "extras" (those are CHR descriptors), and SoETilesViewer's model (it has no map→NPC relationship). `$2433`, written immediately before each `0x3c` with a different small value per spawn, is the open lead.
- **The coordinate space is not established.** Spawn positions overflow the trigger grid's `(x - offX) * 2` mapping and fit at least two other readings equally well, so they are shown raw and **not drawn on the map**.

### Confirmed along the way
- The character table is at `$8EB678`, stride 74. Record 109 matches the editor exactly: palette `0xb1ab`, HP 18, aggro range 70, `anim_stand` `0x495e`. Porting it is straightforward once the index is understood.
- SoETilesViewer already decodes sprites (`spriteinfo.h`, `spriteblock.h`) and the animation pointers, so drawing an idle flower is a **port**, not new reverse engineering — once the character is identified.

### Notes
- Decoder parity unchanged: 99.992% boundaries, 99.776% summaries, 593/593 sniff flags.

## [0.20.0] — 2026-09-20

Doors are now readable and clickable, and the map no longer yanks the panel around when you click it.

### Added
- **Exit extraction.** `src/script/transition.ts` folds a script's effects into where it sends the player: destination room, landing position, the global scripts it calls on the way out (fades, which edge you leave by), the music it starts and the room state it writes. **605 transitions across the ROM, every destination named.**
- **Destinations are links.** A door trigger's card shows `→ Gothica - Dark Forest`; clicking it opens that room. All 605 land on a room the vanilla catalogue lists, so no link is dead. Navigation goes through the tree's own entry rather than duplicating selection, mode switching and rendering.
- Exits appear on the map too: the trigger's label reads `→ Dark Forest` and its tooltip lists each destination with the preparation that precedes it.
- `changeMap` and `playMusic` effects on decoded instructions.

### Changed
- **Clicking the map no longer jumps to the list entry.** A plain left click selects — highlights the shape and its row. Cmd/ctrl-click selects *and* scrolls the row or script card into view, browser style. Pointing at things on the map used to move the panel under you on every click.

### Notes
- Two exits in one script keep their own preparation; a `CHANGE MAP` closes a transition and the context resets, so a branching trigger does not report one door's fade as the other's.
- Writes to the four pickup bookkeeping addresses are excluded from a transition's "room state", since those belong to the loot system.
- Decoder parity unchanged: 99.992% boundaries, 99.776% summaries, 593/593 sniff flags.

## [0.19.2] — 2026-09-20

### Added
- `docs/ingredient-icons.md` extended with a second trace, one that captures the ring menu *opening*. Settles the menu's setup: background tileset at ROM `$C4:1F74` (`$1000` bytes → VRAM `$2000`), frame tiles at `$C4:2FF4`, palettes at `$C4:1EA4`/`$C4:1EEC`, and the **font at `$C4:0000`, stored 2bpp**, read by the text blitter at `$8CA5AC`. Also records that the sprite tile base is VRAM `$6000` (`OBSEL = $03`) and that nothing uploads there in either trace, so the icon graphics are resident before the menu opens — which is why searching for a ROM→VRAM copy kept coming up empty.
- The note now includes the trace-reading gotcha that cost the most time: Mesen prints `[REG] = $x` as the address's **prior contents**, not the value being written, so DMA parameters have to be reconstructed from the CPU registers and the M/X flag widths.

Still not implemented, and the icon pixel source is still unknown; the note says which breakpoint would settle it.

## [0.19.1] — 2026-09-20

### Added
- `docs/ingredient-icons.md` — research notes from a trace of the Alchemy Formulas screen. Establishes that ingredient icons are **background tiles**, that the menu builds its tilemap in WRAM `$7F:C800` via `$8CAD56` and DMAs it to VRAM `$0800`, and that this screen's palette comes from ROM `$C4:1EA4`. The tileset itself loads before the captured window, so the ROM address is still unknown; the note says exactly what trace would settle it. Not implemented — a research record, not a format.

## [0.19.0] — 2026-09-20

Vanilla rooms now show what a pickup gives, the same way live rooms do.

### Why
The Rooms tab already drew an ingredient icon on a B-trigger — but only for live rooms, where the trigger carries a name from the source (`sniff_wax_2`). Vanilla rooms have no names, so the box stayed empty. Since 0.18.0 the decoder reads the reward straight out of the ROM script, so both paths now know the item and can draw the same icon.

### Added
- **Loot icons on vanilla B-triggers.** `trigIngrName()` resolves a trigger's icon from the source name first, then from the decoded reward, so live and vanilla share one renderer. Strong Heart's Hut now draws Oil, Wax, Wax — matching the live view exactly.
- Trigger labels and tooltips carry the reward: `WAX ×2`, plus the object id, the flag that remembers it was taken, and the bonus to the next pickup.
- The 🌿 toggle appears for vanilla rooms, not just live ones.

### Fixed
- **A string pasted into the webview bundle was treated as a replacement pattern.** `buildMainJs` used `.replace(placeholder, content)`, and `$'` inside `content` expands to "everything after the match" — so one dollar-quote in the webview source silently swallowed the rest of the bundle and left an unterminated string literal. Replacements now go through a function. This had been latent; the first `'flag $'` in the source triggered it.
- **A named ingredient with no asset file rendered as an empty box.** The icon map names 28 ingredients and the assets folder ships 22, so Nectar, Petal, Honey and Mercury drew nothing. The webview now knows which files exist and falls back to the emoji. This affected live rooms too.

### Known limits
- Seven reward kinds are not ingredients (money, charms, equipment) and have no icon; they show as text.

## [0.18.0] — 2026-09-20

Reads what every pickup in the game gives, and writes it back out as Everscript.

### Why no simulator
The plan assumed this needed a WRAM factory and a simulated run. It does not. Pickups never *compute* their reward — they write it down: a sniff spot or chest is a B-trigger that tests an "already taken" flag, writes four literal values, and calls one of two global scripts. **All 922 pickups in the ROM write a literal item; not one computes it.** Reading the bytes tells us everything running the game would.

### Added
- **`src/script/loot.ts`** — folds a decoded script's writes into what it gives: item, amount, bonus for the next pickup, object id, and the flags it tests and sets.
- **`src/script/everscript.ts`** — writes a pickup back as `_loot(0x16, MUSHROOM, 0d01, 0d04);` / `_loot_chest(...)`, matching the encoder's own signature. **921 of 922** render exactly; the one that cannot emits nothing rather than a near-miss that would compile into a different item.
- **`LOOT_REWARD` names** imported from the sibling `everscript` compiler into `names.json` (87 entries) — `WAX`, not `Wax (0x0200)`, because only the former round-trips.
- **`tests/memory/script-loot.test.js`** — regenerates upstream's `sniffflags.inc` from our extraction and requires **593 / 593 lines exactly, in both directions**. That file was itself generated by the reference's own loot extraction, so it is a complete independent record of every sniff spot in the game.
- Pickups shown on each script card in the Rooms tab, with the Everscript form beside them and a tooltip carrying flag, object id, amount and bonus.
- `effects` on every decoded instruction — structured writes, flag tests, calls and branch targets, for callers that read scripts rather than print them.

### Fixed
- **The walk was linear, and scripts are not.** An `END` ends one *path*; code past a conditional is reachable only via the branch. Branch destinations are now recorded and the walk resumes at the next unreached one, as the reference does. Dark Forest's B-trigger read as one sniff spot; it has fifteen.
- **`RCALL` targets are inlined**, again as the reference does — several rooms factor a pickup out into a relative call, so a reader that stopped at the call saw a branch and no reward. Absolute calls are still one row: those are shared subroutines and inlining them would bury the script in boilerplate.
- An undecodable byte no longer ends the listing. It is recorded in `gaps`, shown as a row, and the walk continues at the next branch target.
- `$2461` is read position-sensitively: **amount − 1** before the loot call, **bonus for the next pickup** after it. Upstream's `LootData` reads it position-blind and loses the amount.

### Measured
| | 0.17.0 | 0.18.0 |
|---|---|---|
| Instructions emitted across the ROM | 260,836 | **281,244** |
| On a real instruction boundary | 99.994% | 99.992% |
| Summary text matching the reference | 99.766% | **99.776%** |
| `sniffflags.inc` lines reproduced | — | **593 / 593** both ways |
| Pickups rendered as valid Everscript | — | **921 / 922** |

### Known limits
- **Item icons are not done.** Neither SoEScriptDumper nor SoETilesViewer knows where the ingredient sprites live, so a pickup shows its name, not its picture. That is new reverse-engineering rather than a port — see the release notes.
- Six of Dark Forest's nine B-triggers share one script that picks among fifteen rewards from a room variable at runtime. Those are reported as candidates, with a note, not as fifteen separate pickups.

## [0.17.0] — 2026-09-20

Finishes the script decoder rewrite. The Rooms tab now reads the ported decoder, and the old one is gone.

### Why
0.16.0 got instruction boundaries right but produced no summaries, so the Rooms tab still ran the old decoder — which is what the screenshots showed: a `SET AUDIO volume to 0x82` that was really `0x64` in a 3-byte instruction, then `UNKNOWN OPCODE 0x64` on the next byte, which was not an opcode at all but the tail of the one before. Half the tables ended in a desync dressed up as an unknown instruction.

### Added
- **Instruction summaries**, ported case-for-case from `list-rooms.cpp`'s 207-case switch into `src/script/ops-flow.ts`, `ops-memory.ts`, `ops-entity.ts` and `ops-system.ts`, plus `cursor.ts` for the read head they share.
- **`src/script/names.json`** and `tools/generate-script-names.js`, which imports the name tables out of upstream `data.h` + `sniffflags.inc`: 842 flag names, 235 absolute scripts, 128 NPC scripts, 126 rooms, 33 RAM addresses. Committed, so this repo still does not depend on the SoETilesViewer checkout.
- **`src/script/room-scripts.ts`** — trigger-table discovery (enter / step-on / B-trigger) on top of the new decoder, and `src/rooms/data/room-scripts.js`, the thin shim that finds a ROM on disk.
- **Summary scoring** in `npm run check:script`: the rendered text is compared string for string against the dump, not just the boundaries. A case that reads the right bytes and describes them wrongly is otherwise invisible.
- A final `UNKNOWN INSTR` row when a walk stops, so the table says where knowledge ends instead of just stopping.
- `untraced` on every instruction, and a dimmed row style for it: the reference marks instructions whose length is known but whose meaning is a guess, and that distinction is now carried into the UI instead of being flattened.

### Changed
- The Rooms tab's enter / step-on / B-trigger tables come from `src/script/` (via `src/rooms/data/room-scripts.js`).
- Floors in `script-parity.test.js` raised: boundaries ≥ 99.95%, summaries ≥ 99.5%, clean walks ≥ 63%.

### Removed
- `src/emulator/room-script-model.js` and `opcode-registry.js` (1261 LOC) — replaced.
- Their harness, which only ever compared the old decoder against a snapshot of itself: `tests/debugger/room-script-model.test.js`, `tests/debugger/parser-parity.test.js`, `tests/parity/`, `tests/debugger/parity/` (963 LOC), plus the `test:parity` and `test:parity:strict` scripts. `npm run check:script` measures the same property against real ground truth.
- `src/script/opcodes.ts` — the empirical layout table. The ported cases are the single source of truth for sizes now.

### Measured
| | 0.15.1 | 0.16.0 | 0.17.0 |
|---|---|---|---|
| Instructions on a real boundary | 88.5% | 99.986% | **99.994%** |
| Summary text matching the reference | — | — | **99.766%** (233,943 / 234,492) |
| Entry points walked to a clean END | — | 53.1% | **63.8%** |

### Known limits
- Every case in `list-rooms.cpp` is ported, so an opcode that still stops a walk is one **SoEScriptDumper cannot decode either** — it has no known length. Some scripts will never render in full, whatever we do.
- `SHOW TEXT` reports its pointer but not the string; that needs the text decompressor, so those three opcodes are scored on boundaries only.
- The ~0.23% of summaries that differ are almost all placeholder names for unnamed scripts. Upstream caches the first placeholder it invents for an id across the whole dump, so its wording depends on decode order; these lookups are stateless.

## [0.16.0] — 2026-09-20

Starts the script decoder rewrite. Groundwork only: nothing in the UI changes yet, and the old decoder is still the one the Rooms tab uses.

### Why
The existing decoder (`src/emulator/room-script-model.js`) was an independent re-derivation. Measured against SoEScriptDumper's own dump of the ROM, it put 88.5% of instructions on a real boundary but **lost alignment partway through 2119 of 4000 scripts** — and a decoder that loses alignment does not fail, it keeps emitting plausible nonsense.

The cause was one missing concept, not many small bugs. Script operands are not fixed-width fields; they are little postfix expressions whose length depends on their own contents. Five opcodes (`0x09`, `0x17`, `0x18`, `0x08`, `0x86`) accounted for 2111 of the 2119 derailments, all of them for that reason.

### Added
- **`src/script/`** — a new pure TypeScript domain ported from `list-rooms.cpp`:
  - `expression.ts`, the operand grammar: a stack machine where bit 7 ends an expression, `b & 0x70` in {0x30,0x40,0x60} is an inline constant, and operators pop from a stack that persists across operands (the game's own scripts rely on that).
  - `opcodes.ts`, per-opcode operand layouts. 124 were **measured**: `script_all` prints every instruction's address, so consecutive addresses give true lengths, and only layouts reproducing *every* observed length for an opcode were kept — thousands of instances each for the common ones. A few that end a run or print extra lines were read out of the C++ instead, and the WRITE family plus `0x78/0x79`, `0x6f/0x73/0x9d` are hand-ported because their shape is conditional or interleaved.
  - `decoder.ts`, which **never guesses a length**: an opcode whose layout is not verified stops the walk with a reason and an address, rather than inventing a size.
- **`npm run check:script`** — diffs instruction boundaries against `script_all` across the whole ROM. Skips when the SoETilesViewer checkout or ROM is missing.
- `tests/memory/script-units.test.js` — 16 ROM-free assertions pinning the grammar rules individually.

### Measured
| | before | after |
|---|---|---|
| Instructions on a real boundary | 88.5% | **99.986%** (192,020 / 192,047) |
| Entry points walked to a clean END | — | 53.1% |

The other 47% stop early on purpose. **105 opcodes SoEScriptDumper cannot decode either** — most of `0xC0..0xFF`, which it prints in red as `UNKNOWN INSTR`, its own marker for "length unknown, parsing stops here". Roughly 20 more have layouts not yet pinned down; each is listed in `opcodes.ts` `UNRESOLVED` with how close the best simple layout got, so the next pass knows which C++ cases to read.

### Not done yet
- **Instruction summaries.** The decoder returns structure, not the English rendering. That is the 207-case switch plus `data.h`'s name tables.
- **The old decoder is untouched and still wired in.** Shelving it before the new one can produce summaries would regress the Rooms tab, so that swap and the enter/step-on/B-trigger script view come after.

## [0.15.1] — 2026-09-20

### Fixed
- **Animation erased the overlay markings it ran over.** Animation frames were bare composites, so an animated tile that also carried a contour, an object box, a trigger box or a label had that art wiped the moment a frame landed on it — visible on room 0x25's firepit, where the object box came apart. Frames now re-apply the overlay.

  Freezing the marked pixels would have been the obvious fix and the wrong one: the 20% wall tint alone covers **72%** of the pixels in 0x25, so most of the room would have stopped moving. Instead the overlay is *measured*. Every pass is an alpha blend or an opaque write, so per channel the result is affine in the base colour; probing the pass with a flat black and a flat white image pins both unknowns exactly, and the same mark can then be re-applied to a pixel the pass never saw. Opaque writes fall out as frozen and untouched pixels as passthrough, with no threshold to guess at. Animated pixels now match a real annotated render to within 1 LSB of rounding.

- **Switching an object state left the old animation playing over it.** Which channel drives a cell comes from the tilemap word in it, and an object state rewrites that word: room 0x25's firepit runs on channels **6–9** unlit and **0–3** burning. The animation cache was keyed on the ROM and room alone, so after toggling object 17 to burning the unlit frames kept painting back over the lit tiles — the state change looked like it did nothing. Animation now shares the render's cache key, so it rebuilds whenever the layer, the feature flags or an object state change.

- **Animation ignored the layer selection.** Frames were always full composites, so on an L1-only or L2-only view they blended the other layer back in, and cells animated by the hidden layer animated anyway. Both now follow the selected view.

### Added
- `docs/map-format/map_animated_tiles.md` — the Section 2 format in full: layout, the two corrections to the earlier write-up, a worked example from room 0x71, the ROM-wide validation table, the palette-extension rule that links a tilemap word to a channel, and the three things that bite when playing the animation outside the game (no common period, object states moving a cell between channels, and overlay collision).

## [0.15.0] — 2026-09-20

### Added
- **Animated tiles now animate.** Water, lava, torches, fans and light beams play in the Rooms tab, on the `animate` toggle (on by default). 95 of the 127 vanilla rooms have animation, 1020 channels between them.

### The format
Section 2's channel table *was* documented — `map_tile_graphics_decompression.md` §7 — so the earlier note in the gap analysis that animation was "blocked on upstream research" was wrong. The doc had two errors, both settled by the ROM:

| Claim | Reality | Evidence |
|---|---|---|
| Second descriptor byte is a `timer` | It is the channel's **frame count** | byte span equals `frame_count * 3` in 1020/1020 channels |
| Frame streams are `0xFF`-terminated | The `0xFF` ends the **descriptor table** | first channel's offset lands just past it in 95/95 rooms; last channel ends exactly at `sec2_len` |

A frame stream has no terminator: channel `i` runs to channel `i+1`'s offset. That matters, because a tile id whose low byte is `0xFF` would otherwise cut a stream short — which is what made 686 of 1020 channels look malformed on the first read.

Channel periods have no useful common multiple, so there is no global frame counter and the room cannot be rendered as a handful of whole-room frames. Instead each block of animated cells gets its own small transparent overlay and its own clock, so a torch can flicker at 6Hz while water rolls at 3Hz. Frame 0 of every overlay is pixel-identical to the base render, so the overlay lands seamlessly. Playback is one `requestAnimationFrame` loop for the whole room rather than a timer per block, and it stops when you switch rooms.

Typical cost is 43KB and 28 overlay blocks per room (median); the four heaviest rooms reach ~600KB, and anything beyond 1.5MB is skipped rather than streamed.

### Notes
- **Export is unchanged**: it writes the static base render, which is frame 0 of every channel — the default appearance, as asked.
- The overlays sit on top of the rendered map, so a baked collision marking on an animated tile is hidden while animation is on. Toggle `animate` off to see it.
- Only **1.5 (CGRAM colour cycling)** remains unresearched of the animation items, and nothing so far suggests the map renderer uses it.

## [0.14.0] — 2026-09-20

**The object stamp format is solved**, from the Mesen trace of looting the chest on map 0x71. State previews and room customisation both work as a result.

### The format
`dump_room.py` reads the stamp record as `[tw][th]` plus `tw*th` 16-bit words at `+2`, treating those as metatile IDs. Both halves are wrong. From `$90A4C2..$90A4F2`:

```
[tw][th] then, per tile in row-major order, an inline bit stream:
  a mask byte supplies 8 bits, LSB first
    bit set   -> a 16-bit value follows inline
    bit clear -> this tile is untouched
  a fresh mask byte every 8 tiles
```

And `$90A4E8`, which is the part that mattered:

```
TXA ; EOR [$B0] ; STA [$AD]     new = current XOR value
```

They are **XOR deltas against whatever is already in the grid**, not metatile IDs — `0x5CC8 ^ 0x2470 = 0x78B8` and `0x5CD0 ^ 0x2410 = 0x78C0`, matching the trace's writes exactly. XOR being an involution is how the engine walks a state back down as well as up, and it means a descriptor is the delta *between* two appearances: descriptor `s` turns appearance `s` into `s+1`, so `max_state` descriptors give `max_state + 1` appearances with state 0 needing none.

Validated across all 127 vanilla rooms and pinned by `checkObjectStamps` in the parity suite: record lengths land exactly on the next record's offset **2726/2726**, and cumulative XOR yields a metatile ID that exists in the room's Block 3 table **19797/19797**.

### Added
- **State previews.** Every chip in the object list is a real render of the room with that state applied, cropped to the union of everything that object touches so the states line up for comparison.
- **Room customisation.** Picking a chip re-renders the map with those states stamped in. Collision follows automatically, because it is looked up from the same metatile ID the delta rewrites — an opened chest or an extended bridge changes what you can walk on.
- `reset` puts every object back to its load state; changed objects are marked in the list and outlined on the map.
- PNG export carries the chosen states, and names the file after them.

### Retracted
- v0.13.0 said `docs/map-format/map_objects.md` was wrong about "Total states = max_state + 1". **It was right.** That and its `1 + max_state*5` record size are not in conflict — state 0 needs no descriptor. The test that appeared to disprove it looked for an extra descriptor at state 0's anchor, which presumed descriptors were states; they are transitions, and carry their own anchors.
- Earlier attempts all treated the values as identifiers, so the best fit was `word/8` at 43.4% — close enough to look promising and entirely wrong. The state-0 oracle failed (6 of 8522) for the same reason: descriptor 0 was being compared against the grid it transitions away from. One trace beat all of it.

## [0.13.0] — 2026-09-20

### Correction to 0.12.0
That release said the blue object stamp boxes have "a correct anchor and a guessed extent". **That was wrong.** `target_width`/`target_height` are read at `+0`/`+1` of the stamp record and are correct, upstream and here — the boxes have always been the right size in the right place. Only the record's *contents* were undecoded, and half of that is now solved.

### Added
- **Object stamp header decoded.** The record a state points at is `[tw][th][mask: ceil(tw*th/8) bytes][one 16-bit word per set mask bit]`. Upstream's `dump_room.py` misses the mask and reads `tw*th` words from `+2`, so every word lands early — which is why none of them ever resolved. Verified on room 0x2c, whose 11 contiguous stamp records pin their own lengths: the formula predicts all ten pointer gaps exactly, including a 2×2 footprint with a 3-bit mask. Across all 127 rooms it explains 78.6% of records whose length is pinned. (`src/maps/object-stamps.ts`, with unit tests.)
- **Objects linked to the map, both ways.** The object rectangles are now SVG hit targets sitting exactly over the ones baked into the raster: hover highlights, clicking one selects its row and scrolls it into view, and clicking a row or a state chip highlights the rectangle.
- **Object list rebuilt** as a flat table styled like the trigger tables above it, with a blue section rule: one row per object, anchor, extent, then a chip per state. Chips select; the load state is state 0.
- **`hide boring` filter.** 81.1% of the 1748 objects in the ROM have a single state, and another 0.6% have several states that stamp byte-identical records — so only 18.3% have anything to choose between. The filter hides the rest. (You were right about the sniff spots.)

### Still not delivered: state previews, and painting a state onto the map
The 16-bit words inside the stamp record remain undecoded. They are not absolute metatile IDs, not `baseMetatile`-relative, and index = `word/8` only resolves 43.4% of the time. The obvious oracle fails too: an object's state 0 is its load state and *should* reproduce the decoded grid, but matches 6 of 8522 tiles under the best mapping — almost certainly because the Markov grid is base terrain and the engine stamps initial states over it at load, so the pre-stamp tiles were never in the grid to compare against.

With no oracle, a mapping that merely "looks plausible" cannot be falsified, so there is nothing honest to draw in a thumbnail. Full numbers in `docs/map-port-gap-analysis.md` §1.9. Solving it wants a trace of `$90A5D0` against a known object — sibling-repo tooling.

## [0.12.0] — 2026-09-20

### Fixed
- **The grid was misaligned with the map on 54 of the 127 rooms.** A trigger sitting at the map edge widens the SVG viewBox past the map, and the map image was a CSS-stretched `<img>` filling the canvas — so it was scaled to the widened box while the grid was drawn in true viewBox units. The two drifted apart by 1–3% across the map (3.3% on room 0x10, about 8px). The image is now an SVG `<image>` placed at the map's own extent, in the same coordinate system as the grid, so it cannot drift. Regression-tested against a room with an overhanging trigger.

### Added
- **`export png`** in the ROM view's top bar: saves exactly what is on screen — same layer, same overlay flags — through a save dialog. Distinct from `Everscript: Export Room Maps as PNG`, which asks for scope and layer up front; this one takes its settings from the view so the file matches the picture.
- **Pinch to zoom** on a trackpad, anchored on the cursor so the map does not walk away from whatever you were looking at. Chromium reports a pinch as a `wheel` event with `ctrlKey`; a plain two-finger scroll is left alone so the panel still scrolls over the map. The `+`/`-` buttons now anchor on the viewport centre for the same reason.
- **Object browser** replacing the flat ROM OBJECTS table: one collapsible row per object, its states listed inside with anchor position and stamp pointer, the load state marked `default`, and clicking a state highlights that object's anchor on the map.

### Known limitation: no object state previews, no state switching
Both were asked for and neither is delivered, because the data they need does not decode. A state's `metatile_id` points at a stamp table whose format is unknown: **0 of 2836 object states across all 127 vanilla rooms** yield metatile IDs that exist in their own room's Block 3 table. Four candidate layouts were tested and rejected (see `docs/map-port-gap-analysis.md` §1.9 for the numbers). Upstream's `dump_room.py` reads it the same way, so this is inherited rather than introduced.

Two consequences worth knowing:
- The blue object stamp boxes on the map have a correct **anchor** and a guessed **extent**, since `target_width`/`target_height` come from that same table. The object section says so rather than presenting them as exact.
- `docs/map-format/map_objects.md`'s claim that "Total states = max_state + 1" is also wrong — 0 of 1748 records have a plausible extra descriptor. The record-size formula in the same section (`1 + max_state*5`) is the correct one, and that is what the decoder follows.

Solving this wants a trace of `$90A5D0` against a known object, which is the sibling repo's tooling — upstream research, not a porting task.

## [0.11.0] — 2026-09-20

The ROM map view now shows everything `render_map.py --composition` shows, and the top bar actually controls it.

### Fixed
- **The feature toggles never did anything — "collision is always off".** The webview sent its flags as `msg.overlay`, and the `requestRoomTiles` handler in `src/extension.js` simply did not read the field when calling `buildRoomTileOverlay`. Every render came back bare no matter what the bar said. Forwarded, and the smoke suite now asserts the bar renders one button per flag the host understands.
- **Toggles desynced when you changed rooms.** The buttons were emitted with hardcoded defaults while the flag state lived in module globals that survived the re-render, so after switching rooms the bar disagreed with the image. The bar is built from the live state instead.

### Added
- **The remaining `render_full_composition` passes are ported**, closing gap 1.2:
  - **Index labels** — the 3×5 bitmap font (`src/maps/font.ts`), drawing the object index and the hex script id inside each box, matching what SoEScriptDumper's `script_all` lists. Objects anchor bottom-left and triggers top-left, because the font draws `O` and `0` identically.
  - **Trigger boxes** — yellow B-trigger and magenta step-on, now on by default. The SVG trigger rects drop their paint while these are showing, so triggers are not drawn twice in two colour schemes, but stay live as hover and jump-to-source targets.
  - **The header banner and legend**, as HTML rather than baked pixels — `buildSummary()` and `buildLegend()` return upstream's content as data. Baking them would grow the raster and break its registration with the SVG overlay, and the text would be illegible at fit zoom. Legend entries grey out as their toggle goes off rather than disappearing.
- **One toggle per feature**, all on by default: collision, drift, elevation, pass-thru, gates, grass, rom objects, rom triggers, labels — plus an `all` button. Previously only three of the nine passes were reachable, and two of those forced collision on as a side effect.
- The ROM data table now reports entity gates (grouped by which entities each gate blocks), plane-transparent tiles and elevation changes, and marks which plane is dominant.

### Changed
- **Overlay parity is now exact.** `checkOverlayParity`'s diff budget went from 0.5% to **zero** — the labels were the entire residual. Verified pixel-identical on 0x06 (four planes), 0x1b (shear drift), 0x0b (label-dense: 13 objects, 22 triggers, 15 gates), 0x33, 0x36 and 0x38.
- `src/maps/collision-overlay.ts` split three ways under the 400-line law: `overlay-features.ts` classifies a room (and owns the legend/summary text), `overlay-shapes.ts` holds the raster primitives, and `collision-overlay.ts` keeps only the draw-order orchestration.
- Rooms-tab webview split: `rom-overlay.js` owns the ROM view's top bar and data section; `detail-renderer.js` keeps the request cycle. One owner per global, since the files share a scope.

### Removed
- `src/memory/webview/assets/` — 21 files, a complete stale mirror of the webview tree left behind by the v0.6.0 refactor. Nothing has referenced it since; every file has a live counterpart under `src/docs/`, `src/routes/`, `src/shared/`, `src/rooms/webview/` and `src/scaling/webview/`.

### Unrelated fix
- Two assertions in `tests/debugger/emulator-health.test.js` had been failing on `ENOENT` since v0.6.0, pointing at the pre-refactor `debugger/adapter.js` and root `extension.js`. Both features are present and correct under `src/`; only the test paths were stale.

## [0.10.0] — 2026-09-20

### Fixed
- **Panning snapped the map to the top-left corner.** `setupMouseEvents` receives a hand-built object literal rather than the zoom module itself, and `_getPan` was never forwarded into it — so the accessor added in 0.8.1 was `undefined` there and every drag fell back to an always-zero local copy for its base. Forwarded, with a smoke-test assertion so an un-forwarded helper fails the suite instead of silently breaking the gesture.
- **A pan drag ended by scrolling the panel.** `click` fires after every drag, and `selectAt` calls `scrollIntoView` on the matched row, which yanked the map out of view on release. Drags past a 3px threshold no longer count as clicks.
- Window-level pan handlers were being registered once per room render and never removed. They are now bound once and read whichever gesture is active.

### Changed
- **The collision visualization is now a faithful port of `render_map.py`'s composition pass**, baked into the rendered raster instead of approximated with SVG shapes — verified against upstream with a diff budget of 0.5%, actual residual 0.13–0.25% and entirely the text labels (see below). This replaces the hand-rolled SVG contour/fill overlays, which looked crude next to the Python output because they worked at 16px metatile granularity with uniform strokes.

  What this brings in that was missing entirely:
  - **Entity-gated tiles (collision bit 8) — the dashed white borders.** Gate 3 is solid for everything except the boy and dog, 5 for the dog, 7 for both.
  - **Pixel-accurate per-plane contours** via edge detection on the geometry masks plus 3×3 dilation, so slopes contour along their actual diagonal. Secondary planes are dashed, so a tunnel under a bridge reads as two crossing outlines.
  - **Drift arrows** with real arrowheads and direction, double-headed for the two motion-dependent shear handlers.
  - **Plane-transparent tiles** (bit 6, purple wash), **elevation-change tiles** (amber with step rungs), and **forced-walkable tiles** (bit 13, cyan wash).
  - Cuttable grass as a merged green region with an opaque 2px contour rather than per-tile squares.
- Collision / rom objects / grass toggles now re-render the image host-side (cached per room, layer and flag combination) rather than toggling CSS on an SVG layer.

### Not ported, deliberately
The text labels (script-id digits on triggers and objects) and the legend banner, which need upstream's 3×5 bitmap font. These account for the entire remaining pixel difference. The Rooms tab shows the same information as interactive SVG and table rows instead, which stays readable at any zoom.

## [0.9.0] — 2026-09-20

Works through `docs/map-port-gap-analysis.md`. Eleven of the eighteen gaps closed; the write path and the animation items remain open for the reasons recorded there.

### Fixed
- **Live (author-written) rooms never rendered the ROM map at all.** The overlay resolved its room id by hex-parsing `vanillaId`, which for live rooms is a symbolic MAP enum name (`SOUTH_JUNGLE`), not a hex string — so `parseInt` returned `NaN` and the whole feature silently skipped the workflow it matters most for. The numeric id the host already resolves via `getMapEnum` is now carried through as `romRoomId` for both the Vanilla and Live trees. (gap 2.2, confirmed)
- **Stale map after a rebuild.** The render cache keyed on `roomId:layer` only, so recompiling a ROM left the Rooms tab showing the old map indefinitely. The key now includes a ROM fingerprint, and `everscript.buildAndRun` drops the ROM buffer and render caches explicitly on success. (gap 2.1)
- **Render failures were invisible** outside the devtools console. They now show an in-panel banner reusing the existing error pattern. (gap 2.4)

### Added
- **Loading state** — the map area shows a "decoding ROM map…" badge and dims while the host decodes and renders. (gap 2.3)
- **Contour collision rendering**, matching `render_map.py`'s style: only the edges where a plane's solid region meets open space, so overlapping elevation planes read as crossing outlines instead of stacked translucent blobs. Default; a `solid` button switches back to fills. Also ~7x cheaper in path data (23KB vs 167KB on room 0x38). (gap 1.3)
- **Overlay legend** in the ROM MAP DATA section: a swatch per elevation plane actually present in the room, plus drift, object and grass keys. (gap 2.5)
- **`Everscript: Export Room Maps as PNG`** — one room or all 127, any layer, with progress reporting and cancellation. The in-editor equivalent of `tools/render_map.py --all-rooms`. (gap 1.8)
- **Webview-side overlay cache** keyed by `roomId:layer`, so flipping between layers or returning to a room skips the IPC round trip and its several-hundred-KB payload. (gap 2.8)
- **`tests/memory/map-units.test.js`** — 33 unit assertions covering the modules in isolation: BGR555 expansion, transparent index 0, bitplane weighting, hflip/vflip across the whole grid, CHR mode-1 decompression, collision bitfield semantics (planes, gates, drift, always-walkable, plane-transparent), grass table parsing, Mode 1 compositing priority, and PNG chunk structure. Needs neither a ROM nor the everscript checkout, so it runs anywhere. (gap 1.7)
- **Defensive validation in `decodeRoom`** for room id range, ROM size, pointer targets and the section chain, so a patched or non-Evermore ROM fails with a specific message instead of silently decoding garbage. (gap 1.6, partial — still untested against a real patched ROM)

### Changed
- The ROM MAP DATA header now states its rows are decoded ROM bytes with no source lines, rather than leaving the contrast with the clickable trigger tables unexplained. (gap 2.7)

## [0.8.1] — 2026-09-20

### Fixed
- **Grid no longer misaligns on large maps.** The 8px/16px grids coarsened their spacing to 2 or 4 viewBox units once a room exceeded 64 or 128 units, so on a room like 0x38 the "8px" grid actually drew every 32px and stopped lining up with the rendered map. Both grids now draw at true spacing at any room size, emitted as one `<path>` each instead of several hundred `<line>` elements (3.2KB of path data for the largest room).
- **Panning works.** The pan offset lived in two places — `applyPan` wrote to the zoom module's copy while mousedown read a `state` copy that was only synced once at setup — so every drag after the first started from a stale base and jumped. There is now a single owner with a `_getPan()` accessor. Panning also continues when the pointer leaves the SVG instead of cancelling mid-drag.

### Added
- **Layer selection**: `composite` (SNES Mode 1, default), `L2 terrain` (BG1) and `L1 canopy` (BG2) render the map image from the chosen layer. Each layer is cached per room.
- **New overlay toggles**, all drawn from decoded ROM data: `collision` (real sub-tile geometry, coloured per elevation plane), `rom objects` (Section 3 object stamps with per-state footprints), `drift` (tiles that push an entity, with direction ticks) and `grass` (cuttable-grass metatiles).
- **ROM MAP DATA section** at the bottom of the room panel listing every decoded feature — collision tile count and elevation planes, object and state counts, drift tiles broken down by direction, cuttable grass with table-invariant warnings, tile families, and trigger counts — plus a **ROM OBJECTS** table of each object's states, positions, sizes and metatile IDs.

## [0.8.0] — 2026-09-20

### Added
- **The Rooms tab now shows the actual rendered map**, not a collision approximation. `render_map.py`'s graphics pipeline is ported to TypeScript: SNES palette extraction (`$9CC322`), CHR tile graphics decompression (`$8CC88C`/`$8CC9C0`, both the uncompressed-word and dual-stream nibble-command encodings), 4bpp planar pixel decoding with hardware flips, VRAM tilemap layer rendering, and SNES Mode 1 compositing (main/subscreen selection, per-tile priority, CGADSUB add/half-add/subtract colour math).
  - **Output is pixel-identical to `render_map.py`** — verified across 9 rooms spanning 320×256 to 2048×1120, all 1.9M+ pixels matching on room 0x38. The render comparison is part of `npm run check:maps`, dumping raw RGBA from both sides so neither PNG encoder is in the way.
  - `src/maps/png.ts` encodes PNGs with Node's `zlib`, so the host hands the webview a `data:` URI that slots into the existing room-image layer. A ROM render displays at full brightness, unlike the dimmed static screenshots it replaces.
  - Renders are cached per room (12 most recent): ~146ms cold for the largest room, ~2ms warm.
- **Collision overlay now shows real sub-tile geometry** instead of uniform squares — slopes render as the triangles they actually block, half-blocks as halves — coloured per elevation plane (blue/red/green/purple for planes 0–3, matching `render_map.py`). Drift tiles are detected and marked. Multi-plane rooms like 0x06 now render all four plane colours. Toggled by a `collision` button, off by default so the map is visible.

### Fixed
- Filter buttons never synced their initial state: a button rendered without `.on` would read as off while its content was still shown, because the click handler only toggled. Initial state is now applied on render.
- `tsconfig.json` was missing `types: ["node"]`, so any use of `Buffer`/`zlib` failed `npm run typecheck` despite being valid in a Node extension host.

## [0.7.0] — 2026-09-20

### Added
- **Rooms tab renders real ROM map data**. Selecting a vanilla room now paints its decoded collision grid behind the trigger/entity overlays, so the map area shows the actual room shape instead of an empty grid.
  - `src/rooms/rendering/tile-overlay.js` turns a decoded collision grid into SVG path data, one `<path>` per visual class (solid / partial / drift) with horizontal run-merging — a 128×70 room is 8960 tiles, so per-tile DOM nodes are not viable. Worst-case payload 24KB, average 3.9KB.
  - Decoding is on demand per selected room over a new `requestRoomTiles` / `roomTiles` webview message pair; the rooms tree JSON carries no tile data.
  - New `tiles` filter button toggles the overlay.
- **`src/maps/` is now a TypeScript port of the verified `everscript` room decoder** (`tools/dump_room.py`, `collision.py`, `cuttable_grass.py`): LZSS and 2D Markov decompressors, deterministic blob-layout walking, collision bitfield accessors, cuttable-grass swap table.
  - `npm run check:maps` diffs the port against the Python implementation; it matches on **all 127 rooms**, including `0x38` (which the old decoder failed on) and `0x15` (uncompressed Block 3). `MAP_PARITY_ALL=1` runs the full sweep, and it is wired into `npm test`.
  - `npm run build:maps` compiles via a dedicated `tsconfig.maps.json` (the root config is typecheck-only), emitting to the gitignored `src/maps/dist/`; `src/maps/index.js` is a stable CommonJS facade.
  - Grids are numbers throughout, dropping upstream's parallel hex-string form and the mixing footgun it warns about.
- **Map format documentation imported** from `everscript` into `docs/map-format/`, plus the upstream `rom-map-data` skill.
- `loadRomBuffer()` / `invalidateRomBuffer()` in `src/shared/rom-readers.js` — caches the ~3MB ROM by path+mtime instead of re-reading it per call.

### Fixed
- **`npm test` was red on `develop` since v0.6.0.** That refactor moved `tests/corpus/` and `tests/opcodes/` into `sandbox/` without updating the requires, breaking `parser-parity.test.js` (260 assertions) through a four-deep require chain. All stale paths repointed, including one still aimed at the pre-v0.6.0 `debugger/emulator/` location.
- **`.vscodeignore` excluded `src/**` while `main` is `./src/extension.js`**, so `npm run package` produced a `.vsix` that could not load. Only the TypeScript sources under `src/maps` are excluded now; the compiled output ships. This went unnoticed because the extension was actually being installed by the old `rsync` ritual, not by `npm run deploy`.
- **Deployment cleaned up.** `npm run deploy` is now the verified install path (`rbin.everscript-0.7.0`, 934KB, 240 files). The 19 unregistered full-repo `rsync` copies left in `~/.vscode/extensions/everscript-*` by the old ritual were removed, reclaiming ~9GB. The `.vsix` no longer ships emulator-core C sources, build scripts or submodule git pointers — only the built `snes9x_2005.js`/`.wasm` artifacts.

### Changed
- Shelved the superseded sentinel-scan map decoders (`map-pipeline-model.js`, `map-blob-evidence-model.js`) and their tests into `sandbox/maps/`, out of the extension's runtime path.
- `map-format` skill rewritten around the port: porting with validation is fine, independent re-derivation is what failed twice. `render_map.py` (tile graphics) and `encode_room.py` (write path) remain unported.

## [0.6.0] — 2025-06-30

### Changed
- **Refactored entire codebase into `src/` domain structure**.
  - All production code moved from root-level directories (`code_highlighter/`, `memory_radar/`, `debugger/`) into domain-owned subdirectories under `src/`
  - Domain map: `src/language/` (grammar, theme, hover, completion), `src/memory/` (radar tab), `src/rooms/` (map browser), `src/scaling/` (alchemy/scaling tab), `src/docs/` (docs/RNG tab), `src/routes/` (route planner), `src/maps/` (ROM models), `src/emulator/` (SNES core + panel), `src/debugger/` (DAP adapter), `src/shared/` (cross-domain utils)
  - Emulator git submodules moved from `debugger/core/` to `src/emulator/core/`; legacy path remapping added to `panel.js`
  - Test directories reorganized: `tests/memory/` and `tests/debugger/` replace old `memory_radar/tests/` and `debugger/tests/`; exploration scripts moved to `sandbox/`
  - Added `dependency-cruiser` (`npm run check:deps`) and full validation suite (`npm run typecheck`, `npm run check:circular`, `npm run check:dead`)
  - Zero architecture violations confirmed: dep-cruiser, madge, knip, tsc all clean
  - Added domain `README.md` files for all `src/` subdirectories and `sandbox/`

## [0.5.6] — 2026-06-15

### Changed
- **Standalone script parser experiment and parity baseline refresh**.
  - Add a dedicated `script_parser/` workspace with a minimal ROM script model, script-all truth extraction, generated opcode corpus artifacts, and focused reach-end tests for phase-1 traversal validation
  - Add `.github/agents/script-parser-generator.agent.md` for isolated parser iteration workflow
  - Extend fallback opcode handling in `debugger/emulator/opcode-registry.js` and refresh `tests/parity/snapshots/parser-parity-golden.snapshot.json` after parser behavior updates

## [0.5.5] — 2026-05-30

### Changed
- **Evidence-driven parser iteration (test-first parity loop)**.
  - Adjust opcode `0xA7` sleep summary in `debugger/emulator/room-script-model.js` from raw ticks to dump-aligned tick count (`ticks - 1`)
  - Regenerate parity golden snapshot in `tests/parity/snapshots/parser-parity-golden.snapshot.json` after validated parser behavior change
  - Re-ran mandatory loop commands (`npm test`, `npm run test:parity`, `npm run test:parity:strict`) and recorded deltas from the generated parity report

## [0.5.4] — 2026-05-30

### Changed
- **Corpus-driven parser parity harness expanded** without adding parser logic.
  - Add top-level generated parity modules under `tests/`:
    - `tests/corpus/script-all-corpus.js` for `script_all` ingestion, opcode enumeration, grouped instruction normalization, and ROM byte extraction
    - `tests/opcodes/opcode-report.js` for per-opcode occurrence stats, real decode samples, and variable-length opcode detection
    - `tests/boundaries/boundary-report.js` for instruction boundary validation and script-level parity accounting
    - `tests/parity/report-builder.js` and `tests/parity/failure-types.js` for report orchestration, golden summary snapshots, and expanded failure classes
  - Replace the old single aggregate parity assertion in `debugger/tests/parser-parity.test.js` with generated per-opcode and per-script coverage
  - Add explicit `SIZE_MISMATCH` and `SUBEXPR_DESYNC` defect classes to the parity harness output
  - Emit dedicated reports for aggregate parity, opcode coverage, and unknown-opcode desync investigations to `tmp/`
  - Add `npm run test:parity` and `npm run test:parity:strict` so the suite can run in diagnostic mode by default and red-bar in strict defect mode

## [0.5.3] — 2026-05-29

### Changed
- **Parser correctness validation harness added** (SoEScriptDumper parity focused).
  - Add `debugger/tests/parser-parity.test.js` as CI-ready parity runner integrated into `npm test`
  - Add `debugger/tests/parity/ground-truth-parser.js` to parse SoEScriptDumper `script_all` into script IR blocks
  - Add `debugger/tests/parity/ir-diff.js` and `failure-classifier.js` for structured mismatch reporting:
    - `OPCODE_MISSING`, `OPERAND_MISMATCH`, `PC_DESYNC`, `BRANCH_TARGET_ERROR`, `STATE_DRIFT`, `UNKNOWN_OPCODE`
  - Add `debugger/tests/parity/opcode-interactions.js` for targeted opcode interaction regressions
  - Add `debugger/tests/parity/fuzz-generator.js` for deterministic property/fuzz checks (PC alignment, determinism, unknown-opcode guard)
  - Add golden snapshot baseline at `debugger/tests/parity/snapshots/golden-parity.snapshot.json`
  - Emit structured parity reports to `tmp/parser-parity-report.json` for incremental debugging loops

## [0.5.2] — 2026-05-29

### Changed
- **Room script parser coverage completed against SoEScriptDumper ground truth** — no user-visible UI changes.
  - Add `debugger/emulator/opcode-registry.js` with a unified opcode registry (151 opcodes from SoEScriptDumper `printscript` switch)
  - Add ground-truth fallback decoder for previously unsupported opcodes, including variable-width formats driven by sub-expression parsing
  - Integrate fallback decode path into `debugger/emulator/room-script-model.js` so non-covered opcodes no longer terminate decode as unknown
  - Export `OPCODE_REGISTRY` from `room-script-model.js` for debugger/parser tooling use
  - Extend `debugger/tests/room-script-model.test.js` with:
    - exact registry parity check vs SoEScriptDumper opcode set
    - mixed-script decode test covering previously unsupported instruction classes

## [0.5.1] — 2026-05-29

### Changed
- **Architecture stabilization pass** — no user-visible behavior changes.
  - Split `debugger/emulator/panel.js` (1448 LOC) into lifecycle (`panel.js`, 454 LOC) + webview HTML template (`panel-webview.js`, 1007 LOC)
  - Fix `tsconfig.json` to exclude `memory_radar/webview/assets/**` (browser-concatenated files) — `npm run typecheck` now passes cleanly
  - Delete dead files: `memory_radar/webview/assets/scaling-tab.js` (638 LOC superseded), `memory_radar/room-tree-new.js` (unreferenced shim)
  - Install `madge` + `knip` as dev tools; add `npm run check:circular` and `npm run check:dead` scripts
  - Add `knip.json` with entry points and ignore patterns for webview assets
  - Integrate validation into change ritual: typecheck + circular + dead before every commit
  - Add §§ 12–15 to `copilot-instructions.md`: tab ownership islands, validation tooling, TypeScript migration policy, dead code policy
  - Update `AI_ARCHITECTURE_GUIDE.md`: revised hotspot table, updated ritual with validation gate, new validation tooling section

## [0.5.0] — 2026-06-07

### Changed
- **Major architectural decomposition** — no user-visible behavior changes.
  - Extract `renderRadarHtml` (593 LOC) from `extension.js` into three focused modules:
    - `memory_radar/render-radar.js` — orchestrator (179 LOC)
    - `memory_radar/render-memory-tab.js` — WRAM grid + detail table (300 LOC)
    - `memory_radar/render-docs-tab.js` — docs + RNG tabs (191 LOC)
  - `extension.js` reduced from 1461 → 878 lines
  - Split `code_highlighter/language-providers.js` (559 LOC) into 6 focused modules + 39-line facade:
    - `workspace-index.js`, `hover-provider.js`, `completion-provider.js`, `symbol-provider.js`, `dead-branch.js`, `definition-provider.js`
  - Fix pre-existing `getRadarMap()` ReferenceError in hex literal hover path
  - Fix pre-existing stray HTML string in completion provider
  - Split `memory_radar/webview/assets/scaling-tab.js` (638 LOC) into `assets/scaling/` (8 files):
    - `alchemy-math.js` (88 LOC), `state.js` (37 LOC), `helpers.js` (67 LOC), `events.js` (47 LOC), `damage-math.js` (57 LOC), `chart.js` (73 LOC), `redraw.js` (282 LOC), `tab-init.js` (7 LOC)
  - Alchemy math functions promoted to shared outer scope — accessible from docs tab
  - Updated `AI_ARCHITECTURE_GUIDE.md` and `STATE_FLOW.md` to reflect decompositions

## [0.4.1] — 2026-06-06

### Changed
- **Architectural cognitive stabilization docs added** — no code changes.
  - `AI_ARCHITECTURE_GUIDE.md` — global architectural laws, file size limits, anti-abstraction rules, entropy hotspot table
  - `STATE_FLOW.md` — authoritative state ownership table and full data-flow diagrams for all subsystems
  - `debugger/README.md` — rewritten as ownership contract with dependency rules and invariants
  - `memory_radar/README.md` — rewritten with ownership map, tab ownership table, entropy hotspots
  - `memory_radar/rooms/README.md` — new ownership contract, public API reference, client-side counterpart map
  - `code_highlighter/README.md` — rewritten with allowed deps, state owned, split targets
  - `.global/skills/compress-architecture.md` — reusable ownership decomposition prompt
  - `.global/skills/isolate-subsystem.md` — reusable dependency-direction fix prompt
  - `.global/skills/stabilize-state-flow.md` — reusable one-owner-per-state prompt
  - `.global/skills/split-orchestration.md` — reusable god-file decomposition prompt
  - `.github/agents/everscript-plugin-builder.agent.md` — added cognitive stabilization references
  - `.github/agents/mechanics-modeler.agent.md` — added cognitive stabilization references
  - `.github/copilot-instructions.md` — added §11 Architectural Cognitive Stabilization

## [0.4.0] — 2026-06-05

### Changed
- **Rooms tab decomposed into ownership-local subsystem** (`memory_radar/rooms/`). Every file answers one question only.
  - `rooms/parsing/content-parser.js` — pure .evs map block parser
  - `rooms/parsing/file-scanner.js` — filesystem tree builder with explicit deps injection
  - `rooms/rendering/tree-renderer.js` — server-side tree HTML + JSON
  - `rooms/data/lua-watchers.js` — Lua POI data + script trigger loading
  - `rooms/data/vanilla-data.js` — vanilla room catalogue + ROM-backed content builders
  - `rooms/index.js` — re-export facade + `invalidateRoomDataCaches()`
  - `room-tree.js`, `room-data.js` → thin shims; backward-compatible, no extension.js changes
- **Webview rooms-tab.js split into 8 focused modules** (`memory_radar/webview/assets/rooms/`):
  - `bootstrap.js`, `utils.js`, `svg-builder.js`, `tables-builder.js`, `rom-header.js`, `interactions.js`, `detail-renderer.js`, `tab-init.js`
  - Concatenated in dependency order by `webview/index.js`
- All tests pass (55/55 activation, 16/16 smoke, and all other suites).

## [0.3.6] — 2026-06-02

### Fixed
- Restored 6 functions deleted from [extension.js](/Users/v/Documents/GitHub/everscript-vscode/extension.js) during Phase 5 extraction: `radarReadMemoryMap`, `radarFindOpenBrace`, `radarFindCloseBrace`, `radarDetectScope`, `radarAnalyzeScope`, `refreshRadar`. Their absence caused "radarDetectScope is not defined" when opening the Memory Radar panel.
- Added `onCommand:everscript.buildAndRun` to `activationEvents` in `package.json` (was missing; the command was declared but not listed).

### Added
- [memory_radar/tests/activation.test.js](/Users/v/Documents/GitHub/everscript-vscode/memory_radar/tests/activation.test.js) now validates the `package.json` manifest: verifies `"main"` points to a real file, `engines.vscode` is present, `activationEvents` is non-empty, and every command in `contributes.commands` has a title, is covered by an activation event, and is actually registered by `activate()`. Any future mismatch between package.json and extension.js is caught before release.

## [0.3.5] — 2026-05-28

### Fixed
- Restored `RadarCodeLensProvider` class that was accidentally deleted from [extension.js](/Users/v/Documents/GitHub/everscript-vscode/extension.js) during the Phase 5 language-providers extraction (v0.3.0). Its absence caused a `ReferenceError` in `activate()`, preventing ALL commands from being registered and producing "command not found" errors at runtime.

### Added
- Added [memory_radar/tests/activation.test.js](/Users/v/Documents/GitHub/everscript-vscode/memory_radar/tests/activation.test.js): activation smoke test that mocks vscode, calls `activate()`, and asserts every expected command is registered. Also verifies all public exports of `room-data.js`, `room-tree.js`, `rom-readers.js`, and `language-providers.js`. This class of silent activation failure cannot recur without the test catching it.

## [0.3.4] — 2026-05-27

### Changed
- Extracted ROM reader functions into [memory_radar/rom-readers.js](/Users/v/Documents/GitHub/everscript-vscode/memory_radar/rom-readers.js) (`readRomMapHeader`, `readRomTriggerOffsets`, `readRomCharacters`, `readRomHitLookup`, `detectScaleEnemies`, `readPngDimensions`).
- Extracted room data layer into [memory_radar/room-data.js](/Users/v/Documents/GitHub/everscript-vscode/memory_radar/room-data.js) (`VANILLA_ROOMS`, `getMapEnum`, `readLuaWatchers`, `readScriptAllTriggers`, `buildVanillaRoomContent`, `buildVanillaRoomDetails`).
- Extracted room tree building and rendering into [memory_radar/room-tree.js](/Users/v/Documents/GitHub/everscript-vscode/memory_radar/room-tree.js) (`findRoomImage`, `parseRoomContent`, `collectRoomsFromDir`, `buildRoomTree`, `renderVanillaTree`, `renderRoomsTree`, `buildRoomsJson`, `setRoomImageUris`).
- Reduced [extension.js](/Users/v/Documents/GitHub/everscript-vscode/extension.js) from 3188 lines (pre-cleanup) to 1280 lines (60% reduction) across this and previous cleanup passes.
- Added `tsconfig.json` with `allowJs: true` scaffold for incremental TypeScript adoption.
- Added `typecheck` script to `package.json`.

## [0.3.3] — 2026-05-27

### Added
- Added a byte-script debugger workflow note in [docs/byte-script-debugging.md](/Users/v/Documents/GitHub/everscript-vscode/docs/byte-script-debugging.md), covering how the emulator, mock `.evs` debugger, and Rooms tab currently attach to one another for both source-level and ROM-byte-script inspection.

### Fixed
- Switched manual emulator-panel breakpoints in [debugger/emulator/panel.js](/Users/v/Documents/GitHub/everscript-vscode/debugger/emulator/panel.js) from CPU exec breakpoints to live byte-script `loc` matching, so the addresses shown in the script stack now pause on the intended VM instruction instead of the SNES CPU PC.
- Forwarded active byte-script addresses through [extension.js](/Users/v/Documents/GitHub/everscript-vscode/extension.js) into [memory_radar/webview/assets/rooms-tab.js](/Users/v/Documents/GitHub/everscript-vscode/memory_radar/webview/assets/rooms-tab.js) and [memory_radar/webview/assets/shared.css](/Users/v/Documents/GitHub/everscript-vscode/memory_radar/webview/assets/shared.css), so the current decoded ROM-script row/card can highlight live in the Rooms tab.
- Corrected Rooms map extent sizing in [memory_radar/webview/assets/rooms-tab.js](/Users/v/Documents/GitHub/everscript-vscode/memory_radar/webview/assets/rooms-tab.js) so the rendered view uses the ROM header's `width * 16` and `height * 16` geometry as the authoritative room size.

### Tests
- Extended [debugger/tests/emulator-health.test.js](/Users/v/Documents/GitHub/everscript-vscode/debugger/tests/emulator-health.test.js) for byte-script breakpoint/focus bridging and [memory_radar/tests/smoke.test.js](/Users/v/Documents/GitHub/everscript-vscode/memory_radar/tests/smoke.test.js) for live script-focus highlighting plus ROM-header-driven map extents.

## [0.3.2] — 2026-05-27

### Added
- Added manual exec-breakpoint controls to [debugger/emulator/panel.js](/Users/v/Documents/GitHub/everscript-vscode/debugger/emulator/panel.js) so the emulator panel can add and remove address breakpoints directly through the custom core bridge.
- Added ROM-backed practical coverage to [debugger/tests/room-script-model.test.js](/Users/v/Documents/GitHub/everscript-vscode/debugger/tests/room-script-model.test.js) using the local Evermore ROM when available, anchored on room `0x33` / Strong Heart's Exterior.

### Fixed
- Restored shell-derived PATH handling in [extension.js](/Users/v/Documents/GitHub/everscript-vscode/extension.js) for `everscript.buildAndRun`, so compiler subprocesses can find external tools like `asar` again while still preferring the project venv.
- Corrected room-script decoding in [debugger/emulator/room-script-model.js](/Users/v/Documents/GitHub/everscript-vscode/debugger/emulator/room-script-model.js) for branch sizing and the offset-based `0x08`, `0x09`, `0x0c`, `0x18`, and `0x1b` opcode forms used by real vanilla room scripts.
- Updated the Rooms tab presentation in [memory_radar/webview/assets/rooms-tab.js](/Users/v/Documents/GitHub/everscript-vscode/memory_radar/webview/assets/rooms-tab.js) and [memory_radar/webview/assets/shared.css](/Users/v/Documents/GitHub/everscript-vscode/memory_radar/webview/assets/shared.css) so decoded script errors are clearer, grid layers are toggleable, map fit/pan is more stable, and selected triggers also highlight their script cards.

## [0.3.1] — 2026-05-27

### Added
- Added [debugger/emulator/snes-rom-header-model.js](/Users/v/Documents/GitHub/everscript-vscode/debugger/emulator/snes-rom-header-model.js) with tested HiROM/LoROM cartridge-header parsing based on the SNES internal ROM header.
- Added [debugger/tests/settings-model.test.js](/Users/v/Documents/GitHub/everscript-vscode/debugger/tests/settings-model.test.js) and [debugger/tests/snes-rom-header-model.test.js](/Users/v/Documents/GitHub/everscript-vscode/debugger/tests/snes-rom-header-model.test.js) to lock down repo-path autofill behavior and cartridge-header parsing.

### Fixed
- Centralized repo-derived settings resolution in [settings-model.js](/Users/v/Documents/GitHub/everscript-vscode/settings-model.js) and updated [package.json](/Users/v/Documents/GitHub/everscript-vscode/package.json) so `repoPath` now clearly auto-fills compiler, Python, source, patches, and ROM defaults while keeping legacy `patchesPath` compatibility.
- Reworked the Rooms tab in [extension.js](/Users/v/Documents/GitHub/everscript-vscode/extension.js), [memory_radar/webview/assets/rooms-tab.js](/Users/v/Documents/GitHub/everscript-vscode/memory_radar/webview/assets/rooms-tab.js), and [memory_radar/webview/assets/shared.css](/Users/v/Documents/GitHub/everscript-vscode/memory_radar/webview/assets/shared.css) so vanilla rooms use configured-ROM data, missing-ROM states show explicit errors, the stale placeholder path is gone, and the misleading bottom render block is removed.
- Expanded [debugger/emulator/room-script-model.js](/Users/v/Documents/GitHub/everscript-vscode/debugger/emulator/room-script-model.js) to decode a broader set of fixed-width room-script opcodes including text, audio, call, yield, and UI-related instructions.

### Tests
- Updated [memory_radar/tests/smoke.test.js](/Users/v/Documents/GitHub/everscript-vscode/memory_radar/tests/smoke.test.js) and [memory_radar/tests/ui.test.js](/Users/v/Documents/GitHub/everscript-vscode/memory_radar/tests/ui.test.js) to assert ROM-backed room details, explicit room errors, and the absence of the removed bottom render block.
- Extended [debugger/tests/room-script-model.test.js](/Users/v/Documents/GitHub/everscript-vscode/debugger/tests/room-script-model.test.js) with additional fixed-width opcode coverage.

## [0.3.0] — 2026-05-27

### Added
- Added a ROM-backed room-script parser in [debugger/emulator/room-script-model.js](/Users/v/Documents/GitHub/everscript-vscode/debugger/emulator/room-script-model.js) that resolves the enter script, step-on trigger scripts, and B-trigger scripts directly from the map data pointer, trigger tables, and script pointer tables.
- Added decoded script tables to the Rooms tab in [memory_radar/webview/assets/rooms-tab.js](/Users/v/Documents/GitHub/everscript-vscode/memory_radar/webview/assets/rooms-tab.js), including opcode, size, raw bytes, script addresses, and termination state in a TilesViewer-style view.

### Fixed
- Moved the debugger feature fully under `debugger/`: the emulator panel now lives in [debugger/emulator/panel.js](/Users/v/Documents/GitHub/everscript-vscode/debugger/emulator/panel.js) and both bundled/custom SNES core paths resolve from `debugger/core/...`.
- Replaced the old `script_all` text scrape in [extension.js](/Users/v/Documents/GitHub/everscript-vscode/extension.js) with the ROM-backed parser so Rooms-tab trigger data comes from the same authoritative source as the map header and payload readers.
- Updated emulator health coverage for the debugger-rooted layout and warning-path mocking in [debugger/tests/emulator-health.test.js](/Users/v/Documents/GitHub/everscript-vscode/debugger/tests/emulator-health.test.js).

### Tests
- Added [debugger/tests/room-script-model.test.js](/Users/v/Documents/GitHub/everscript-vscode/debugger/tests/room-script-model.test.js) with synthetic ROM fixtures that validate trigger-table lengths, script-id lookup, opcode sizing, coordinate ordering, and trailing `0x00` termination.

## [0.2.79] — 2026-05-26

### Fixed
- Merged emulator/debugger core handling into the top-level `core/` folder: the debugger-enabled fork now lives in `core/snes9x2005-wasm` and the vanilla base in `core/snes9x2005-wasm-vanilla`.
- Removed the obsolete `debugger/core/snes9x` submodule and stopped using `emulator/core/` as a special bundled-core path.
- Added legacy-path remapping in [emulator/panel.js](/Users/v/Documents/GitHub/everscript-vscode/emulator/panel.js) so existing `everscript.snesCorePath` values that still point at `debugger/core/...` continue to resolve to the debugger core.
- Reworked screen fitting in [emulator/panel.js](/Users/v/Documents/GitHub/everscript-vscode/emulator/panel.js) to size the canvas with actual fitted width/height values instead of relying on CSS transform scaling.
- Fixed manual ROM reloads to redispatch directly to a ready webview instead of rebuilding the whole panel HTML.

### Restored
- Restored working pause/resume and hook controls with the debugger-enabled core, backed by runtime coverage.
- Restored the script detail panel (`ss-detail`) with current active-slot summary, scheduler-chain view, next-slot column, and `0x0F..0x2E` argument dumps as the next safe v0.2.71 feature slice.

### Tests
- Added top-level core build wrappers via `tools/build_snes_core.sh` and updated `npm test`, `npm run test:emulator-runtime`, and VS Code tasks to build both core variants from the merged layout.
- Extended [debugger/tests/emulator-runtime.test.js](/Users/v/Documents/GitHub/everscript-vscode/debugger/tests/emulator-runtime.test.js) to verify fitted canvas sizing, repeat ROM loads, custom-core debugger controls, and the restored script detail panel.
- Extended [debugger/tests/emulator-health.test.js](/Users/v/Documents/GitHub/everscript-vscode/debugger/tests/emulator-health.test.js) for merged-core paths, legacy-path remapping, and restored detail-panel coverage.

## [0.2.78] — 2026-05-26

### Fixed
- Moved the shell-style build/deploy helpers out of [/.vscode/launch.json](/Users/v/Documents/GitHub/everscript-vscode/.vscode/launch.json) into [/.vscode/tasks.json](/Users/v/Documents/GitHub/everscript-vscode/.vscode/tasks.json), including a dedicated `Test Emulator Runtime` task.
- Restored visible-editor debugger anchoring in [emulator/panel.js](/Users/v/Documents/GitHub/everscript-vscode/emulator/panel.js) as the first safe v0.2.71 feature reintroduction.

### Tests
- Added [debugger/tests/emulator-runtime.test.js](/Users/v/Documents/GitHub/everscript-vscode/debugger/tests/emulator-runtime.test.js): a browser-backed runtime harness that loads the real panel HTML, boots the core, loads the Evermore ROM, exercises core commands, and records the actually exported API surface.
- The runtime harness now covers bundled-core auto-load, bundled-core manual-load, and custom-core auto-load.
- The runtime harness supports both debugger-core directory layouts: `debugger/core/snes9x2005-wasm` and `debugger/core/snes9x`.
- Verified manually with the harness that current `v0.2.76` passes while historical commit `654df3e` fails with `timed out waiting for webviewBoot`.

## [0.2.76] — 2026-05-26

### Fixed
- Reverted the v0.2.71 emulator panel lifecycle-analysis changes from [emulator/panel.js](/Users/v/Documents/GitHub/everscript-vscode/emulator/panel.js) to reduce the boot script back to the pre-0.2.71 shape while diagnosing ROM startup failures. The panel now returns to raw script-slot rendering and raw write-triggered break handling.

### Removed
- Removed the semantic script lifecycle summary panel, 0x20-byte argument dump, scheduler-chain view, and focus-row highlighting that were added in v0.2.71.
- Removed the visible-editor fallback for emulator debugger sync anchoring; sync now again requires the active editor to be an `.evs` file.

### Tests
- Dropped the health-test assertions that required the removed v0.2.71 lifecycle-detail UI and visible-editor debugger anchoring.

## [0.2.75] — 2026-05-26

### Fixed
- Emulator panel timeout: restored `script-src * blob: data:` wildcard CSP (identical to the working v0.2.70/v0.2.71 configuration). The v0.2.73 change to `script-src 'nonce-${nonce}' ${cspSource}` and the v0.2.74 change to `script-src ${cspSource} 'unsafe-inline'` both broke the inline boot script — `cspSource` evaluates to `https://*.vscode-cdn.net` which uses a single-label wildcard that does not match the multi-level `file+.vscode-resource.vscode-cdn.net` subdomain used by VS Code's resource server, and can interact with VS Code's own CSP enforcement to suppress `'unsafe-inline'` for inline scripts.
- Removing unused `cspSource = webview.cspSource` from `_buildHtml` since the wildcard CSP no longer needs it.

### Tests
- Renamed test `panel.js uses unsafe-inline CSP (no nonce on script tag)` to `panel.js uses wildcard script-src with unsafe-inline (no nonce on script tag)`.
- Added assertion that `script-src * blob: data:` wildcard is present (prevents regression to restrictive `${cspSource}` form).
- Added comment explaining that nonce in `script-src` suppresses `'unsafe-inline'` per CSP spec.

## [0.2.74] — 2026-05-25

### Fixed
- Emulator panel timeout: switched webview `script-src` CSP from nonce-based (`'nonce-${nonce}'`) to `'unsafe-inline'`. The nonce-based policy was silently blocking the inline `<script>` tag in VS Code's webview Chromium context, preventing `acquireVsCodeApi()` from ever running and causing the 30-second "Timeout waiting for webview ready message" on every build.
- Removed unused `nonce` attribute from the `<style>` tag (style-src had no matching nonce directive).

### Changed
- Webview boot sequence restructured: `window.onerror`, `unhandledrejection`, and `securitypolicyviolation` handlers are now registered **before** `acquireVsCodeApi()` so any init-time error is captured. Uses `var vscodeApi` (hoisted) so the handlers can safely reference it before assignment.
- `vscodeApi.postMessage` calls in Module callbacks and `loadCoreScript.onerror` are now null-safe (`if (vscodeApi)`) in case API acquisition fails.
- `_resetPanelHtml` logs a 220-char HTML head snippet to the output channel for future CSP/script-load diagnostics.
- Added `console.log('[EVS webview] boot...')` and `console.error` calls visible in the webview developer tools.

### Tests
- `debugger/tests/emulator-health.test.js` section G: ROM load simulation. Adds static checks for unsafe-inline CSP, onerror-before-acquireVsCodeApi ordering, webviewBoot placement, and gameStarted flow. Also adds a mock-based runtime test: `openEmulatorPanel` → `ready` → `loadRom` dispatched → `gameStarted` processed without errors.

## [0.2.73] — 2026-05-25

### Added
- `memory_radar/models/map-pipeline-model.js`: comprehensive evidence-backed map pipeline model covering all confirmed stages: blob header, trigger tables, tile families, sentinel scan, position table, nibble-packed tilemap, delta decode, EE descriptor lookup, and render script 0x93 structure. Includes trusted pass1/pass2 word constants for map 0x33 from Mesen2 memory snapshots (2nd decompressor invocation, source: `tmp/map_research.md`).
- `tools/map-dump.js`: unified map dump script (replaces scattered root-level dump scripts). Prints a structured 13-section dump of any map blob including 6-byte sub-header layout, decompressor trace evidence summary, and provisional tilemap formula caveat.
- `memory_radar/tests/map-pipeline-model.test.js`: 44 tests covering address conversion, delta decode, nibble tilemap parse, sentinel scan, render script 0x93 structure, and ROM-dependent blob parse (map 0x33 all stages).
- `.vscode/launch.json`: F5 launches Extension Host. Added `Build Core (snes9x2005-wasm)` and `Dump Map 0x33` configs.
- `npm run package`: packages VSIX to `out/` via `vsce --out out/` with clear error message on failure.
- `npm run deploy`: packages VSIX and installs with `code --install-extension --force`, then verifies `rbin.everscript` is present in the extension list. Clear error messages when `code` CLI is not in PATH or install fails.
- `docs/map-0x33-analysis.md`: decompressor section expanded with sub-header byte layout, trace PC signatures, two-invocation structure, and exact list of what disassembly is still needed.

### Changed
- `.gitignore`: now ignores `out/` (entire build output folder) instead of `*.vsix`. VSIX files are always built to `out/` and never committed.
- `.vscode/launch.json`: `Deploy Plugin` renamed to `Deploy Plugin (VSIX)` and now uses `npm run deploy` instead of rsync.
- `memory_radar/models/map-pipeline-model.js` header: `compressedSectionSize` comment corrected (was "4-byte sub-header", now "6-byte sub-header + 158-byte bitstream"). `parseTilemap` comment updated: `family = nibble >> 2` is marked as provisional with caveat about the 62.8% out-of-range tile ratio. TRUSTED_MAPS block comment now cites `tmp/map_research.md` and the Mesen2 trigger number.

### Fixed
- Emulator panel webview no longer fails to parse on startup. Root cause: v0.2.71 introduced box-drawing characters (`\u2500`) inside the HTML template literal as JS/CSS comment dividers; these non-ASCII bytes caused the webview browser to throw `Invalid or unexpected token` before `onRuntimeInitialized` ever fired, so the `ready` message was never sent, and ROM loading appeared silently broken.
- All non-ASCII characters removed from `emulator/panel.js` (ASCII-only enforcement).

### Removed
- Root-level `build`, `deploy`, `dump-map-blob.js`, `decode-rom-tilemap.js`, `dump-map-trace-flow.js`, `dump-map-evidence.js` removed from repo. Functionality is now in `tools/map-dump.js` and `.vscode/launch.json`.

## [0.2.72] — 2026-05-22

### Added
- Added `debugger/core/snes9x` as a tracked git submodule pointing to `https://github.com/r-bin/snes9x2005-wasm.git`.
- Added `docs/snes9x_integration.md` with the full integration playbook (subtree/submodule options, tmp migration strategy, hook patterns, and architecture layout).
- Documented debugger core submodule setup/update workflow and branch handoff steps in `debugger/README.md`.

## [0.2.71] — 2026-05-22

### Updated
- Script-stack breaking now happens on semantic slot lifecycle snapshots instead of the first raw `0x28FC`-region byte write. This gives the panel a complete slot image after creation/activation, including the populated `0x0F..0x2E` argument block.
- Script-stack panel now shows a richer debugger summary: executing slots, current active-slot interpretation, scheduler chain via `next_script`, and a focused 0x20-byte arg dump for the latest lifecycle event.
- Emulator debugger sync can now anchor from a visible `.evs` editor even when the emulator webview has focus, fixing the earlier `open an .evs editor first` failure mode.

## [0.2.70] — 2026-05-22

### Added
- Emulator panel button to break on all observed hook writes, not just debugger callback hits. This pauses the core when any watched script-slot byte changes.
- Emulator panel button to connect the existing VS Code `everscript` debugger. Emulator hook breaks now sync into the mock debug adapter through a new `syncFromEmulator` request so VS Code shows a real `stopped` event.

### Updated
- Added regression coverage for the emulator-to-debugger sync path and the new panel controls.

## [0.2.69] — 2026-05-22

### Fixed
- Script-hook watchpoints now follow the custom debugger contract again: `addWriteBreakpoint()` receives WRAM offsets, not `$7E` bus addresses.
- Added explicit hook lifecycle and observed-write logs in the Everscript Build output so hook activity is visible even before a breakpoint pause is confirmed.
- Audio now reads the core's exported `Float32` planar `2048 + 2048` sample buffer directly instead of treating it as interleaved `Int16`, fixing the loud robotic output.

## [0.2.68] — 2026-05-22

### Fixed
- Emulator script-stack hook now arms write breakpoints with full `$7E` bus addresses instead of raw WRAM offsets. This fixes the non-firing hook in custom debugger builds.
- Audio startup is now tied to a real webview user gesture and explicitly resumes the `AudioContext` after ROM load, fixing muted playback caused by autoplay suspension.
- Screen scaling now uses deterministic transform-based resizing and refreshes on visibility, resize, and frame updates so the game canvas fills the available panel area instead of staying near native size.

## [0.2.67] — 2026-05-22

### Changed
- **Removed EmulatorJS entirely.** The emulator panel now loads `snes9x2005-wasm` (lrusso Emscripten build) directly in the VS Code webview — no libretro wrapper, no `.data` bundles.
- Core files moved to `emulator/core/snes9x_2005.{js,wasm}` (bundled with extension). Old `emulator/vendor/emulatorjs/` archived to `tmp/emulatorjs-vendor/`.
- `everscript.snesCorePath` setting now accepts a path to a custom `snes9x2005-wasm` `.js` file (matching `.wasm` must be in the same directory). Previously it accepted a `.data` EmulatorJS bundle.

### Added
- **Audio**: Web Audio via `ScriptProcessorNode` + ring buffer. `_getSoundBuffer()` is fed into a 16-bit stereo → float32 pipeline at 44100 Hz after each frame.
- **Proper screen scaling**: canvas CSS scales to fill the panel while preserving the 512:448 aspect ratio via `ResizeObserver` and aspect-ratio math.
- **Script stack WRAM fallback** updated: reads from `Module._saveState()` + `Module._getStateSaveSize()` instead of EmulatorJS game manager.

### Updated
- `debugger/tests/emulator-health.test.js` rewritten for the new architecture: checks `emulator/core/` files, WASM magic bytes, required Emscripten exports, no EJS_Runtime, and panel.js sanity (17 tests, 0 xfail).

## [0.2.64] — 2026-05-21

## [0.2.66] — 2026-05-21

### Added
- `debugger/tests/emulator-health.test.js` — validates vendor assets and both core bundles (pre-delivered + custom) before launch. Checks: file existence, 7-zip magic bytes, required bundle contents, `EJS_Runtime` definition. Custom core `EJS_Runtime` check is marked `xfail` (known: snes9x2005-wasm is a standalone Emscripten build, not a libretro wrapper).
- `emulator.min.css` added to vendor dir (copy of `emulator.css`) — stops EmulatorJS console warning about missing minified CSS.

## [0.2.65] — 2026-05-21

### Added
- Webview error forwarding: `window.onerror`, `unhandledrejection`, and a `console.warn` intercept now pipe EmulatorJS errors into the Everscript Build output channel (auto-reveals on error). Removes the VS Code modal popup for emulator errors.


### Added
- `tools/pack_snes_core.py` — script to package a custom snes9x2005-wasm build into an EmulatorJS-compatible `.data` bundle (7-zip). Running it against `tmp/docker/snes9x_2005.js` + `.wasm` produces `tmp/custom-snes9x.data`.
- Script stack header now shows a **core info row** below the button bar displaying the active core filename and full bundle path, or "snes9x (bundled)" with the vendored `.data` path when no custom core is configured.

# [0.2.63] — 2026-05-21

### Added
- **EmulatorJS script-stack debugger panel**: the script stack table now reads directly from the running module when a custom debugger-enabled SNES core is loaded, and falls back to save-state parsing otherwise.
  - Visible **custom API proof** in the panel (`api: custom debugger active`) using `getCPUState()` / `readMemoryRange()` when available.
  - **Pause / resume controls** wired to the custom debugger API.
  - **Script stack hook toggle** arms write breakpoints on key script-slot fields so stack writes can pause the emulator and be resumed from the panel.
  - Fixed the previous stack reader bug where the panel injected `Module.EmulatorJSGetState()` but still called a missing `gm.getState()`, leaving the table stuck on `connecting...`.

# [0.2.62] — 2026-05-21

### Changed
- **SNES custom core path now stays inside EmulatorJS**: `everscript.snesCorePath` now overrides EmulatorJS's SNES core bundle path instead of switching to a separate custom canvas runtime.
  - **Empty setting**: uses the bundled EmulatorJS `snes9x` core exactly as before.
  - **Custom setting**: must point to an EmulatorJS-compatible SNES core bundle (`*.data`). The panel overrides both `snes9x-wasm.data` and `snes9x-legacy-wasm.data` through EmulatorJS `filePaths`, so the normal EmulatorJS UI, settings overlay, input handling, audio path, and lifecycle remain intact.
  - **Incompatible raw `.js` / `.wasm` paths** are now rejected with a warning instead of silently switching to a separate runtime.

# [0.2.59] — 2026-05-21

### Added
- **`everscript.snesCore` setting**: Choose the SNES emulator core used in the embedded emulator panel.
  - **Default (empty)**: uses the bundled EmulatorJS snes9x libretro core — same as before.
  - **Custom path**: point to `snes9x_2005.js` from a custom `snes9x2005-wasm` build (the matching `.wasm` must be in the same directory). The panel then uses a canvas renderer that calls directly into the WASM module, bypassing EmulatorJS entirely. Enables debugger breakpoint APIs (`Module._addExecBreakpoint`, etc.) added in the snes9x2005-wasm build.
  - Changing the setting and re-opening the panel (F5 or `Open Emulator`) auto-detects the new core. If the panel is already open and the core changes, it is automatically recreated with the correct `localResourceRoots`.

# [0.2.58] — 2026-05-21

### Fixed
- **Compiled ROM now actually boots in the emulator**: EmulatorJS uses `fetch()` internally to load the game. VS Code webviews silently block `fetch()` on `data:` URLs, causing EJS to open its file browser instead of booting the ROM. The base64 payload is now converted to a `Blob` URL in the webview before being passed to EmulatorJS.

### Added
- **Emulator launch logging**: Build output channel now shows ROM path, size, blob creation confirmation, and game-started event. Errors from the emulator side (blob conversion failure, etc.) surface as an error notification.

# [0.2.57] — 2026-05-21

### Fixed
- **Compiled ROM now boots in the embedded emulator**: Loading a ROM into an already-open emulator panel now rebuilds the webview first, so EmulatorJS starts from a clean bootstrap and consumes the new ROM instead of dropping into its file browser.
- **Settings command contribution now loads cleanly**: Removed a duplicate `everscript.romPath` manifest key that could interfere with VS Code contribution parsing.

# [0.2.56] — 2026-05-28

### Fixed
- **F5 Python interpreter**: `buildAndRun` now detects the project's `.venv/bin/python3` and uses it instead of the system `python3`. System Python lacks the `injector` package, causing `ModuleNotFoundError`. Fallback chain: `.venv/bin/python3` → `.venv/bin/python` → `venv/bin/python3` → `venv/bin/python` → `python3`.
- **Relative paths in compiler invocation**: `--patches` and input file arguments are now passed as relative paths from the project root (e.g. `./patches`, `in/practice`), matching the working manual command.
- **Exact command logged**: Output channel now shows the full command as it would be typed in a terminal.

### Added
- **`everscript.pythonPath` setting**: Optional override for the Python interpreter path. When empty, auto-detected from the project `.venv`.
- **`Everscript: Open Everscript Settings` command**: Opens VS Code Settings UI pre-filtered to all `everscript.*` settings (Cmd+, equivalent).

### Removed
- **Settings tab from Emulator panel**: Settings belong in VS Code's built-in settings UI (Cmd+, → search "everscript"). The emulator panel is now a pure emulator again.

# [0.2.55] — 2026-05-21

### Added
- **Settings tab in Emulator panel**: New "Settings" tab alongside "Emulator". Fields: Everscript repo path, patches/ folder, compiler binary or script, vanilla ROM, SNES core (snes9x). Auto-fill button (and Enter key on the repo field) probes the repo and pre-populates all other fields. Save persists to VS Code global settings.
- **Python compiler support**: `buildAndRun` (F5) now detects `everscript.py` in the repo root and runs `python3 everscript.py --rom <ROM> --patches <patchesDir> <input.evs>` instead of the binary. Falls back to `dist/everscript_mac` / `dist/everscript.exe` if no Python script found.
- **New settings**: `everscript.repoPath`, `everscript.patchesPath`, `everscript.romPath`. Together with the existing `everscript.compilerPath` override, these replace `everscript.projectRoot`.

### Changed
- `everscript.projectRoot` removed; replaced by `everscript.repoPath`.
- Error messages now point to "Emulator panel → Settings tab" instead of raw setting names.
- Emulator overlay changed from `position:fixed` to `position:absolute` inside its tab pane, so it no longer covers the Settings tab.

# [0.2.54] — 2026-05-28

### Added
- **Real compiler wiring (F5)**: `everscript.buildAndRun` now auto-detects the Everscript compiler binary by walking up from the active `.evs` file looking for `dist/everscript_mac` / `dist/everscript`. Runs `everscript_mac --rom <ROM> <input.evs>` with the project root as `cwd`, reads `out/<ROM>`, and loads it into the emulator automatically. No configuration required for the standard project layout.
- **Script Stack panel**: A compact live panel appears below the emulator once the game starts. Polls the WRAM via EmulatorJS save-state API every 500 ms; parses the 20 script slots at `0x28FC` (each `0x4F` bytes); shows slot#, PC, state (exec/wait/dead), entity, and timer1. Color-coded rows: green = executing, yellow = standby, red = dead.
- **WRAM delta messages**: The webview posts `{ command: 'wramDelta', offset, data }` to the host after each poll for future Memory Radar live-mode integration.
- **New settings**: `everscript.compilerPath` (override compiler binary path) and `everscript.projectRoot` (override project root). Replaces `everscript.buildCommand` / `everscript.buildOutput`.

### Changed
- `everscript.buildCommand` and `everscript.buildOutput` removed; replaced by `everscript.compilerPath` and `everscript.projectRoot`.
- Emulator webview layout changed to flex-column so the script-stack panel sits below the emulator canvas without overlapping it.

# [0.2.51] — 2026-05-21

### Fixed
- **Command registration bug**: Fixed duplicate `commands` block in `package.json` that prevented "Everscript: Open Emulator Panel" from appearing in the Command Palette. Both commands now show up after reload.

### Added
- **Emulator Panel (Phase 1 — keyboard POC)**: `Everscript: Open Emulator Panel` command opens a webview with a SNES-style canvas + live key log. Proves VS Code webview keyboard capture works end-to-end. ROM picker sends the path to the panel; WASM emulator slot documented for Phase 2.
  - `emulator/panel.js` — panel registration, ROM picker, extension↔webview message bridge.
  - `emulator/webview/index.html` — canvas, SNES button map, held-key chips, key event log.
- **Call Log module design**: `call-log/design.md` — full architecture for a live function-call logger: detection strategy, WRAM data sources, `call-decoder.js` / `log-channel.js` / `log-webview.js` module split, VS Code settings, Phase 1 (mock) + Phase 2 (live WRAM) plan.
- **Emulator rankings doc**: `docs/web-emulator-plan.md` — ranked analysis of ares, Snes9x, Mesen2, RetroArch by license, WASM availability, accuracy, and debug API. Legal summary table. Phase plan through v1.0.
- **`DebugConfigurationProvider`**: F5 on a `.evs` file with no `launch.json` now auto-fills the debugger config from the active editor, fixing the "wrong file" (kaizo.evs) problem.
- **Debug activation events** (`onDebugResolve:everscript`, `onDebugAdapterProtocol:everscript`): extension activates before a debug session starts so gutter breakpoints are always clickable.

### Updated
- `docs/embedded-emulator-panel-concept.md` — added emulator-selection table, keyboard findings, and current implementation status table.

# [0.2.49] — 2026-05-21

### Added
- **Debugger (Phase 1 — mock)**: source-level step debugger for `.evs` files using the Debug Adapter Protocol.
  - `debugger/adapter.js` — DAP server (stdin/stdout, no npm dependencies).
  - `debugger/mock-runtime.js` — parses `.evs` function blocks, simulates stepping line-by-line, fires `stopOnEntry`/`stopOnStep`/`stopOnBreakpoint` events.
  - Supports: Launch, Breakpoints, Continue, Step Over, Step Into, Step Out, Call Stack panel, Locals variables (mock WRAM refs), `arg[]` scope.
  - `package.json` gains `"breakpoints"` + `"debuggers"` contributions; F5 on any `.evs` file launches the mock session.
  - `debugger/poc-design.md` — architecture doc, compiler changes needed for Phase 2 (live WRAM), and Phase 3 (full DAP).
  - 10 new tests in `debugger/tests/debugger.test.js`.

# [0.2.48] — 2026-05-21

### Fixed
- **Memory Radar activation**: added explicit command activation for `everscript.openMemoryRadar` so the command is registered even before an `.evs` editor activates the extension.

# [0.2.48] — 2026-05-20

### Changed
- **Modular webview**: extracted all 7 inline webview template literals (CSS, scaling, rooms, docs, route, rng, shared JS) from `extension.js` into `src/webview/*.js` modules. `extension.js` reduced from 5280 to 2852 lines.
- **Dead code removed**: `alchemyWebview*` variable definitions and the `alchemy-model` destructure require removed from `extension.js` top level (now live in each webview module).
- **Models directory**: `models/alchemy-model.js`, `models/radar-utils.js`, `models/map-blob-evidence-model.js`, `models/render-script-model.js` are the authoritative copies; root files are thin shims.

# [0.2.47] — 2026-05-20

### Changed
- **Prophet simulation redesign**: replaced outer-reset-counting model with a single-run model that tracks *prompts* (total prophet interactions) and *resets* (player-initiated story resets) per run.
- **Output format**: now shows `prompts: avg X p50 Y p90 Z | resets: avg A p50 B` (success rate shown only when < 100%).
- **Four profiles replacing three strategies**: `mash` (never reset, can tilt), `reset4chaos` (reset at state 4 or any chaos), `reset4` (reset only at state 4, allows chaos recovery), `metaonly` (reset unless in meta arc 6–8, except state 0).
- Histogram now plots prompts distribution (was reset count).

# [0.2.46] — 2026-05-20

### Changed
- **Prophet RNG tab**: replaced basic 3-column codename table with full 5-column state analysis (State, Codename, Reach 8%, Reach 5%, Next states with odds).
- **Prophet simulation**: replaced simple reset counter with strategy-aware `simProphetStrategy(strategy)` implementing correct arc transitions (prophecy/meta/chaos).
- **Reset strategy dropdown**: Aggressive (reset on any chaos or tilt), Moderate (allow 2 chaos rounds), Full EV (reset only on permanent tilt lock). Description updates on change.
- Arc color-coded table rows (blue=prophecy, green=meta, red=tilt, muted=chaos).

# [0.2.45] — 2026-05-20

### Added
- **RNG tab** — new tab in the Memory Radar panel with three simulation sections:
  - **Naris / Super Heal**: 50/50 coin-flip, average ~2 attempts.
  - **Prophet / Bronze Armor**: State-machine simulation over 20 codename states (DOOM→FUSELAGE); includes full codenames reference table; average ~24 area resets.
  - **Egg / Chocobo Egg**: Pot-purchase simulation (5 or 10 pot run); average ~43 purchases.
- Each section has a "Simulate 10,000×" button, avg/p50/p90/p99 output, and a bar histogram.

# [0.2.44] — 2026-05-20

### Changed
- Project cleanup: moved all map-analysis and R&D files to tmp/, removed dead test/model scripts, updated .gitignore to exclude dependencies/.
- No change to extension output or user-facing features.

# Changelog

## [0.2.43] — 2026-05-14

### Added
- **Mechanics model artifact** — added `docs/rooms-payload-boundary.model` as the single evidence-backed boundary model for room payload parsing, with validated map outcomes and explicit `TODO_EVIDENCE_NEEDED` items for unresolved decompressor semantics.

## [0.2.42] — 2026-05-14

### Fixed
- **Map payload boundary false positives** — `decodeMapPayload` now constrains sentinel candidate scanning to the current map blob (nearest higher map pointer end) instead of scanning far into later ROM data.
- **Blob-bounded payload parsing** — position-table and tilemap reads now also enforce map-blob bounds, preventing cross-blob overreads and accidental decode acceptance.

### Added
- **ROM-backed payload regression** in `test/map-payload-compression.test.js`:
  - verifies decode succeeds for maps `0x33`, `0x34`, `0x51`, `0x5c` under bounded scan rules,
  - verifies map `0x38` correctly fails under the current known sentinel model.
- **Feature dossier update** in `docs/map-renderer-status.md` documenting the new bounded-scan evidence and revised parse snapshot.

## [0.2.41] — 2026-05-14

### Added
- **Model test: room compressed-section vs tile codec** — added `test/map-payload-compression.test.js` to run a direct experiment applying tile-compression framing to real room compressed data (map `0x33`) and compare against trace-backed map expectations.
- **Trace comparison assertions** — added explicit checks showing tile codec framing does not reproduce the observed room tilemap structure/diversity, and that room sentinel boundary semantics are distinct from tile framing.

### Changed
- **Test pipeline** — `npm test` now includes `node test/map-payload-compression.test.js` in the default sequence.

## [0.2.40] — 2026-05-14

### Fixed
- **Map payload sentinel detection** — `decodeMapPayload` now accepts additional observed boundary variants:
  - strict7 core: `x 00 00 00 01 00 FF` where lead byte `x` is not restricted to `0x30`/`0xC8`.
  - short6 core: `x 00 00 01 00 FF` for variant payloads not matching strict7.
- **Candidate guardrail** — sentinel candidates now reject implausible position-table counts (`posCount > 64`) to reduce false-positive boundary picks.
- **Offset correctness** — decode now uses matched sentinel length (6 or 7) when computing position-table and tilemap starts.

### Added
- **Smoke tests** covering both new sentinel variants:
  - strict7 wildcard-lead sentinel acceptance.
  - short6 sentinel variant acceptance.
- **Map renderer status update** documenting current variant findings and tile-compression comparison status.

## [0.2.39] — 2026-05-14

### Added
- **Agent workflow requirement** — both custom agents now require a comprehensive feature dossier markdown file that tracks progress, user evidence requests, handled scope, research findings, blockers, and model dependencies.
- **tmp sampledata policy in agents** — both agents now require sampledata-heavy artifacts (raw bytes, dumps, traces) to be stored under `tmp/` and referenced from dossier docs.
- **Map renderer consolidated status** — added `docs/map-renderer-status.md` as the authoritative evidence-first status page for Rooms map rendering.

### Changed
- **Map docs cleanup** — reduced `docs/payload-byte-plots.md` to an archive pointer and moved heavy raw data to `tmp/map-renderer-payload-bytes.md`.
- **Legacy/speculation cleanup** — converted `docs/payload-deep-analysis.md` to a legacy pointer with explicit speculation policy.
- **Navigation update** — `docs/map-loading.md` now points to `docs/map-renderer-status.md` for consolidated current state.

## [0.2.38] — 2026-05-14

### Added
- **Custom agent: Mechanics Modeler** in `.github/agents/mechanics-modeler.agent.md` for evidence-first reverse engineering into a single `.model` artifact with explicit missing-evidence requests, progress tracking, assumption labeling, and test/log validation against real examples.
- **Custom agent: Everscript Plugin Builder** in `.github/agents/everscript-plugin-builder.agent.md` for useful-first extension feature delivery with strict model-backed mechanics policy, vertical-layout UI guidance, cross-feature linking, robust runtime error handling, and visibility-focused test requirements.

## [0.2.37] — 2026-05-14

### Fixed
- **Sentinel scoring** — `decodeMapPayload` now picks the earliest sentinel candidate (smallest compressed-section offset) instead of sorting by `invalidRefs`. Real tilemaps always contain nibble values 0–15 across all 16 VRAM slots; counting nibbles >= tileCount as "bad" produced meaningless scores that could cause wrong-candidate selection.
- **Removed false `invalidRefs` counter** — the per-map `invalidRefs` field is gone. All nibble values 0–15 are syntactically valid 4-bit indices by definition; "unresolved" (no declared family for a slot) is the correct term for nibbles >= tileCount.

### Added
- **docs/map-0x33-analysis.md** — complete byte-level and tilemap analysis of map 0x33 (Strong Heart Exterior): full 20×16 nibble grid, nibble distribution table, sentinel and position-table layout, and comparison of raw payload / trace / decoder output.
- **Test** — `'decodeMapPayload produces zero out-of-range nibble values on synthetic ROM'` — enforces the invariant that all decoded nibble values are in [0, 15].
- **Test** — updated `'decodeMapPayload picks earliest sentinel candidate on synthetic ROM'` — verifies that the earliest sentinel wins regardless of nibble content.

## [0.2.36] — 2026-05-13

### Added
- **Renderer contract tests** in smoke suite to enforce map draw invariants:
  - decoded map canvas size must match ROM header `mapW/mapH`.
  - canvas must be white-prefilled before map draw.
  - rendered map must be fully covered (no white holes) for valid tile fixtures.
  - draw diagnostics must report sufficient tile diversity (`uniqueRefsCount`) for varied fixtures.
  - per-tile pixel correctness checks now assert exact expected RGB output on-map.
  - draw-count parity checks validate `drawnTiles`, `tileRefs`, and `renderCommandsEstimate` consistency.

### Changed
- **Map draw geometry source** — decoded map rendering now always sizes and iterates from ROM header dimensions (not inferred tilemap array shape) to keep renderer behavior aligned with map metadata.
- **Coverage fill behavior** — invalid/missing tile refs are now substituted with fallback family tile 0 during draw, preventing sparse black gaps and ensuring complete map coverage for diagnostics.
- **Draw robustness and telemetry** — draw pass now wraps exceptions, logs explicit failures, and reports `fallbackSubstitutions` and `uniqueRefsCount`.

### Validation
- Full `npm test` passes with expanded map renderer contract coverage.
- Single-tile parity suite remains green, reinforcing that per-tile decode is correct while map-level placement decoding remains the primary open research area.

## [0.2.35] — 2026-05-13

### Added
- **Single-tile decoder parity test suite** (`test/map-tile.test.js`) with multiple 16x16 map-tile scenarios compared against an independent reference decoder ported from SoETilesViewer `tile.h` logic:
  - uncompressed random fixtures,
  - uncompressed overflow/clamp behavior,
  - compressed copy-only streams,
  - compressed command-mode fixtures (`0..8,13,14,15`),
  - strict 16x16 output/range assertions.
- **Rooms render diagnostics** now report unresolved ratio in UI metadata and include explicit draw diagnostics (`invalidRefs`, `tileRefs`) for trace comparison.

### Fixed
- **Broken garbage decoded-map display** — Rooms tab now rejects low-quality decoded payload renders (high unresolved tile-reference ratio) and falls back to header canvas with an explicit reason, instead of showing misleading sparse/black tile mosaics as successful decode output.
- **Decode quality telemetry** — backend logs now flag suspicious payload decode quality (`unresolvedRatio`) so trace review can focus on map-level opcode decode gaps rather than per-tile decode.

### Validation
- Full `npm test` passes with the new map-tile parity suite and updated smoke assertions.
- Result confirms single-tile 16x16 decode path matches SoETilesViewer behavior; remaining map-level mismatch is in payload/tile placement interpretation, not in tile decompression or pixel unpack.

## [0.2.34] — 2026-05-13

### Fixed
- **Rooms payload sentinel mis-pick** — payload decode no longer accepts the first structurally-valid sentinel match. It now scores all candidates in scan range by tile-reference validity (invalid nibble refs, max nibble) and picks the best fit, which prevents false positives that produced sparse/black broken renders.
- **Large-map decode scan window** — increased sentinel search window for long payloads so more maps resolve to decoded render instead of fallback white canvas.

### Added
- **Trace-grade decode logging** (`[RoomsRender]`) now reports:
  - number of sentinel candidates found,
  - selected sentinel type/address,
  - `posCount`, invalid ref count, max nibble,
  - final decoded stats (`compressedSize`, `invalidRefs`).
- **Render draw stats logging** in Rooms tab now reports per-draw counts (`drawnTiles`, `invalidRefs`, `tileRefs`, `families`) for direct comparison with emulator/tilemap traces.
- **Stronger smoke tests for map render quality**:
  - synthetic ROM test validates sentinel candidate selection prefers low-invalid decode path,
  - multi-map decoded fixtures assert render canvas is created and output is not all-white,
  - decoded-render path test still enforces non-empty pixel writes.

## [0.2.33] — 2026-05-13

### Fixed
- **Rooms payload decode address bug** — sentinel scanning in `decodeMapPayload` now uses absolute ROM offsets (`dataRom + payload offset`) instead of scanning from the ROM root, so maps with valid payloads decode correctly and render the decoded room canvas instead of incorrectly dropping to fallback.
- **Post-sentinel parsing alignment** — position-table and tilemap parsing now read from absolute addresses consistently, preventing false decode-null outcomes caused by mixed relative/absolute indexing.

### Added
- **Canvas render assertions in smoke tests**:
  - verify decoded map rooms create a render canvas (`#rr-canvas`) with expected dimensions.
  - verify decoded render path writes non-empty pixel data to the canvas (not an empty image buffer).

## [0.2.32] — 2026-05-13

### Fixed
- **Rooms tab visibility hardening** — room render section now always shows a canvas block in ROM Map Data:
  - If payload render data is available, draw the decoded room canvas as before.
  - If payload render data is unavailable, draw a **header fallback canvas** (white area) sized from ROM header `map_w_tiles` / `map_h_tiles` so the render area is always visibly present.
- **Payload sentinel scan robustness** — payload decode no longer stops at a short sentinel window; scan range was expanded and candidate validation now checks that the resulting position-table + tilemap region fits map geometry.

### Added
- **Render-path logging** — added `[RoomsRender]` logs for room-detail entry, decoded-room draw pass, fallback draw pass, and payload decode success/failure reasons.
- **Tests for render visibility and logs**:
  - smoke tests now assert rooms-tab fallback canvas markup is injected and render logs are emitted.
  - UI tests now assert rooms-tab render block styles exist and fallback render block appears when payload render data is missing.

## [0.2.31] — 2026-05-13

### Added
- **Rooms tab — ROM-decoded room canvas render**: the ROM Map Data section now includes a full-size room canvas (`map_w_tiles * 16` by `map_h_tiles * 16`) rendered from decoded payload tilemap data and map-tile graphics.
- **SoETilesViewer-compatible tile decode path**: map family tiles are decoded using the same tile-table/data model as SoETilesViewer (`0xEE0000` map-tile pointer table, `tileInfo` compressed/uncompressed decode rules, SNES 4bpp planar unpack to 16x16 indices).
- **Palette selector in render panel**: map render supports the SoETilesViewer 16-color map palettes (including `Jungle 1`, `Hut Int. 1`, `Hut Ext. 1`) and allows switching in-place for visual verification.

### Changed
- **Payload display now includes render trace order**: the room panel documents the exact draw order currently implemented (family list -> tile decode -> row-major tilemap blit) and reports unresolved tile references when payload indices exceed known family entries.

## [0.2.30] — 2026-05-13

### Added
- **Rooms tab — Complete map payload decoder** — the ROM Map Data panel now fully decodes and displays the map blob payload for all maps:
  - **Tile families**: 1-byte count + count × uint16 IDs from payload opcode 0 — shared CHR/VRAM art references.
  - **Position table** (optional): count + uint16 byte offsets; 0 entries in sparse maps (e.g., `0x33`), full entries in dense maps (e.g., `0x01` has 12, `0x51` has 25).
  - **Decoded nibble-packed tilemap**: rendered as a grid preview showing the first 10 rows and 20 tiles per row; each tile is a 4-bit index into the tile-family list (0–15).
  - **Compressed section size**: bytes consumed by the opaque bitstream (likely layer / collision / LZ-encoded data; not yet decoded).
  - Complete walkthrough documented in updated `docs/map-loading.md`.

### Fixed
- **Map format confirmed from binary analysis**: verified all three test maps (`0x01`, `0x33`, `0x51`) decode identically:
  - **Tilemap encoding**: nibble-packed (2 tiles per byte, 4-bit indices).
  - **Payload structure**: tile families → compressed section → sentinel → position table → tilemap.
  - **Sentinel variations**: `0x30 00 00 00 01 00 FF` (maps `0x33`, `0x01`) and `0xC8 00 00 00 01 00 FF` (map `0x51`); sentinel location marks end of compressed data.

## [0.2.29] — 2026-05-13

### Added
- **Rooms tab — ROM Map Data panel** — every map room in the Rooms tab now shows a collapsible "ROM Map Data" section populated directly from the ROM binary:
  - **13-byte header table**: offset, hex value, field name, WRAM/IO destination, and description with confidence level for every header byte — including the provisional `room_effect_family` / `room_effect_variant` fields.
  - **Derived geometry**: map size in tiles and pixels, horizontal/vertical scroll capacity.
  - **Render preset badge**: classifies the room by its 5-byte signature (`bytes 4–8`) into the 11 known groups (default outdoor, indoor, cave, parallax, darkness-style, etc.).
  - **Trigger table layout**: decoded `step_len` / `b_len` with entry counts, payload offset in the blob.
  - **Payload tile families**: count + hex IDs from payload opcode 0 (the tile-set load list).
  - Designed as a foundation for a future map editor; toggle collapses/expands the section.

## [0.2.28] — 2026-05-13

### Docs
- **Map payload opcode stream** — documented that the room payload after trigger tables is a command/script stream, not a flat bitmap. Evidence from cross-map comparison of three Prehistoria hut maps (`0x33`, `0x51`, `0x01`):
  - Command 0: count byte + `N × 2-byte` tile family IDs (map `0x01` shows a perfect sequential run `7..13`).
  - High-entropy compressed middle section (likely LZ/RLE tile placement commands), length proportional to map complexity.
  - Shared 6-byte sentinel `00 00 00 01 00 ff` in all three maps, separating the compressed section from a structured position table.
  - Position table: count byte + `N × 2-byte` row offsets with step of 6 tiles (96 px); gaps in map `0x01` match the empty vertical stretches visible in-game.
  - Added provisional opcode model to `docs/map-loading.md`.


### Fixed
- **Projectile alchemy damage model** — replaced the old `effective_mdef`/shared-RNG approximation with the traced projectile formula: cast-side power now uses the ROM spell-level scale table plus its own RNG bonus, and hit damage applies the traced `(0x40 - magic_defense) / 0x40` multiplier.

### Added
- **`hb1` offensive alchemy regressions** — damage coverage now includes Hard Ball level 1 against Purple/Wimpy Flower (`10–20`) and Mosquito-like `m.def 0` (`21–41`), alongside the traced level-0 regressions.

## [0.2.26] — 2026-05-13

### Changed
- **Traced alchemy spell-level scaling** — the shared offensive-alchemy spell-level helper no longer uses the old `+10%` placeholder. Level `0` keeps the existing grounded base-might path, while levels `1..9` now use the ROM-traced high-level scale table `2, 4, 7, 11, 15, 20, 26, 32, 39, 46`, which yields Hard Ball cast-side power `21` at level 1 before the cast RNG bonus.
- **Docs copy now distinguishes traced spell power from open target-side math** — the spell-level slider text in Docs now describes the traced cast-side power step for leveled casts and keeps the remaining target-side resistance/popup conversion explicitly open.

## [0.2.25] — 2026-05-12

### Added
- **Projectile alchemy research note in Docs** — the Docs tab and markdown alchemy note now record the active projectile-slot layout anchor at `7E3564`, including the `POWER` field at `+0x2A/+0x2B`, so spell-damage tracing context is visible in the extension.

### Changed
- **Alchemy docs now distinguish producer vs hit path** — the docs explicitly note that hit-only traces start after projectile power is already prepared, and that full throw+hit traces are the right source for deriving leveled projectile spell power.

## [0.2.24] — 2026-05-12

### Added
- **Docs alchemy spell-level slider** — the Docs tab offensive-alchemy calculator now exposes spell level directly so manual range checks can be explored without leaving the docs surface.

### Changed
- **Docs alchemy copy now labels spell level as projected** — the calculator and docs note now spell out that spell level currently uses the shared `+10% base might per level` preview helper rather than a grounded ROM-traced growth formula.

## [0.2.23] — 2026-05-12

### Added
- **Dual offensive alchemy Scaling graphs** — alchemy mode now shows a top graph for damage vs spell level and a second graph beneath it for damage vs target level, with dedicated sliders for spell level and target level.

### Changed
- **Projected alchemy preview model** — the new graphs use one shared preview path across Scaling and tests: spell level applies a labeled `+10% base might per level` projection, and scalable target level temporarily reuses the target defense-growth slope for `magic_defense` growth until grounded data is traced.

## [0.2.22] — 2026-05-12

### Fixed
- **SoETilesViewer `m.def` check** — verified against the local C++ source that SoETilesViewer reads `magic_defense` directly from `+0x1d` and displays that raw value, so the extension no longer assumes any hidden `0x40 - m.def` conversion in the viewer.
- **Shared offensive alchemy formula** — Scaling, Docs, and automated tests now all use the same `effective_mdef = floor((magic_defense + 20) / 4)` level-0 helper, which keeps Wimpy Flower at `6–10`, Carltron's Robot at `0–1`, and Mosquito in the `12–20` band instead of the old inflated `15–26` output.

### Added
- **Offensive alchemy RNG histogram** — the Docs alchemy calculator now renders the same damage-vs-RNG histogram style used by the physical damage calculator.
- **Broader alchemy coverage in `npm test`** — `test/damage.test.js` is now part of the main test script, and the UI regression fixture now covers Wimpy Flower, Mosquito, and Carltron's Robot.

## [0.2.21] — 2026-05-12

### Fixed
- **Offensive alchemy resistance model** — replaced the overfit inverted `magic_defense` helper with a direct raw-stat reduction model, so high-`m.def` enemies now take less damage and low-`m.def` enemies no longer collapse to `0–1`.
- **Scaling and Docs consistency** — both surfaces now use the same corrected level-0 alchemy math and no longer drift in formula text or rendered examples.

### Added
- **Broader alchemy regressions** — unit coverage now includes Wimpy Flower (`m.def 32` => `6–10`), Carltron-like high resistance (`m.def 60` => `0–1`), and Mosquito-like low resistance (`m.def 0` => `15–26`), alongside the existing Docs and parser checks.

## [0.2.20] — 2026-05-12

### Fixed
- **Purple/Wimpy Flower alchemy range** — the level-0 alchemy preview now matches the checked Hard Ball case against `m.def = 32`, producing `6–10` in both Scaling and Docs instead of the broken `0–1` range.
- **Live target stat parsing** — the live ROM reader again uses the Purple/Wimpy Flower `magic_defense = 32` value from the vanilla stat record, matching the external enemy viewer.

### Added
- **Regression coverage for the real bug** — the unit test, parser test, and Docs/Scaling UI tests now all assert the same grounded case: Hard Ball level 0 vs Purple/Wimpy Flower = `6–10`.

## [0.2.19] — 2026-05-12

### Fixed
- **ROM stat reader used the evade slot as magic defense** — `readRomCharacters()` now parses `evade` from `+0x1d` and `magic_defense` from `+0x1f`, which fixes live Scaling alchemy targets such as Hard Ball L0 vs Purple Flower/Wimpy Flower.

### Added
- **Parser regression coverage** — `test/scaling-rom.test.js` now feeds a synthetic ROM record through the real `readRomCharacters()` path and asserts that the parsed target produces the grounded Hard Ball L0 `6–10` range.

## [0.2.18] — 2026-05-12

### Fixed
- **Scaling alchemy target mdef lookup** — the Scaling tab now accepts both `magic_defense` and `magicDefense` on target records instead of silently falling back to `0`, which was producing bogus alchemy ranges like Hard Ball L0 `0–1` vs Wimpy Flower.

### Added
- **Hard Ball purple-flower regression test** — `test/ui.test.js` now asserts that Scaling alchemy mode shows Hard Ball L0 vs Wimpy Flower as `6–10`, matching the grounded level-0 model.

## [0.2.17] — 2026-05-12

### Fixed
- **Scaling tab damage-type selector restored to the right place** — the Physical / Offensive Alchemy selector now lives in Scaling, not Docs, and the matching field rows have the IDs that the existing mode-switching JS expects.
- **Scaling tab render crash** — switching or initializing Scaling no longer fails because `updateLevelFields()` can now find `sc-src-field`, `sc-charge-field`, `sc-scale-field`, and `sc-atlas-field`.
- **Docs alchemy entry restored** — Docs again exposes Offensive Alchemy as its own subtab instead of hiding it behind a misplaced dropdown.

### Added
- **Scaling-focused UI tests** — `test/ui.test.js` now validates the Scaling selector, physical/alchemy field visibility changes, note text updates, and the restored Docs alchemy entry.

## [0.2.16] — 2026-05-12

### Added
- **`test/ui.test.js`** — 18 new UI tests covering Docs tab structure and JS behaviour: dropdown element exists, physical/alchemy content visibility in HTML, no stray subnav button, dropdown change toggles both sections, both charts populate at init.
- **`test/smoke.test.js`** now included in `npm test`; fake DOM fixed to support `document.createElement` and persistent element identity so webview JS execution tests pass.

### Fixed
- **`bindLinks(null)` crash** — `bindLinks` in the webview JS now guards against a null root argument; this prevented webview JS from executing cleanly in test sandboxes.

## [0.2.15] — 2026-05-12

### Changed
- **Docs > Damage section** — replaced the separate "Offensive Alchemy" subnav button with a **Damage type** dropdown inside the Damage section (Physical / Offensive Alchemy). Physical is the default; selecting Offensive Alchemy switches to the spell-might + magic-defense interactive graph.

## [0.2.14] — 2026-05-12

### Added
- **Map-loading header tables** — expanded the room-loader docs with a byte-by-byte header table, a blob-region table, and a clearer separation between known fields and unknown header bytes.
- **Reverse-engineering next-step guidance** — added a concrete trace checklist for progressing the room-loader work, with emphasis on capturing the first 13 bytes and the first payload writes.

### Changed
- **Trigger-record caveat clarified** — the docs now state that the 6-byte step-on/B-trigger record layout matches the current in-repo model, while also being explicit that the external SoE tiles viewer C++ source was not freshly re-verified in this workspace.
- **Repo cleanup ignores generated artifacts** — `tmp/`, Python bytecode, and `tools/__pycache__/` are now ignored so slice outputs and cache files stop showing up as pending changes.

## [0.2.13] — 2026-05-12

### Added
- **Docs tab map-loading section** — added a grounded map-loading explainer covering the room-blob layout, the `LDA [$8B],Y` stream-read breakpoint, and the truncation evidence for how the payload turns into the final room picture.
- **Map-loading markdown doc** — added a dedicated docs file that records the current room-loader model and the confirmed Strong Heart exterior example.

### Changed
- **Room-data docs clarified** — the room data-block note now explicitly says that the bytes after the trigger tables are still-observed room payload, even though the exact codec is not fully decoded yet.

## [0.2.12] — 2026-05-12

### Added
- **Level-0 offensive alchemy preview** — the Scaling tab can now switch from physical attacks to offensive alchemy, plotting spell might against enemy `magic_defense` with the current `effective_mdef` model.
- **Docs tab alchemy section** — added an offensive alchemy explainer and interactive preview so the spell-might table and `magic_defense` subtraction are visible inside the extension.
- **Alchemy markdown doc** — added a dedicated docs file for the grounded offensive alchemy model, including the spell might table and the current level-0 range assumptions.

### Changed
- **Scaling and Docs wiring fixed** — restored the alchemy docs button to the Docs tab and removed duplicate hidden Scaling controls that were hijacking the chart bindings.
- **Alchemy placeholders narrowed** — route-planner copy now points at the remaining gap more honestly: route-grade spell-level / 8-cast modeling is still missing, but the per-cast level-0 preview exists.

## [0.2.11] — 2026-05-12

### Changed
- **Document alchemy damage inputs** — the scaling docs now describe the confirmed offensive alchemy inputs: enemy `magic_defense`, the `effective_mdef = max(0, 0x40 - magic_defense)` term, and the base-might table at ROM offset `0x45E6B`.
- **List vanilla alchemy might values** — added the per-spell might table to the docs, including the current caveat that exact charge / level scaling is still not fully traced.

## [0.2.3] — 2026-05-09

### Changed
- **Correct temp region boundary** — temp region is now `0x2834–0x28FF` (matching the linker's TEMP RAM definition in `main.evs`). Was incorrectly `0x2800–0x28FF`.
- **Remove static loot-function address extraction** — `_loot_chest`, `_loot`, `loot`, `retained_object` are dynamically allocated from the compiler memory pool; their call-site arguments do not indicate a fixed address. Removed the spurious write annotations.

### Added
- **T-shape layout** — sticky header (title, filters, region bars), left panel (grid, independent scroll), right panel (detail table, independent scroll). Clicking a grid cell scrolls both.
- **Multi-byte cursor selection** — clicking any cell now highlights ALL cells belonging to the same entry (e.g. all 35 bytes of `BOY_NAME`). Previously only the clicked cell got the cursor outline.
- **Word byte extension** — `Word`-typed entries with a single address in the memory map now automatically cover both bytes (`addr` and `addr+1`). Previously the second byte appeared as an undocumented gap.
- **Group color stripes** — cells belonging to the same multi-byte entry share a colored bottom-border stripe (10-color rotating palette), visually connecting bytes of the same entry across grid rows.

## [0.2.2] — 2025-05-09

### Added
- **Radar auto-update** — when you move the cursor to a different scope or switch to another `.evs` file, the open radar re-renders automatically. The `pin` button stops auto-update.
- **Cursor highlight in grid** — last-clicked cell gets a persistent white border (`.cursor`), separate from the hover highlight.
- **Multi-byte hover highlight** — hovering any cell in a multi-byte entry (e.g. `BOY_NAME` ×35, `FRAME_COUNTER_1` word) highlights all bytes in the entry, not just addr+1.
- **Emoji in cells** — `emoji` button overlays the entry’s first emoji (from name/notes) onto each 9×9 cell. Based on the memory-map emoji legend.
- **Emoji in popup/detail** — emoji shown alongside address in popup header and detail table addr column.
- **Boring row filter** — `boring` button hides rows where no cells are used in the current scope.
- **Follow mode** — `follow` button makes the detail table auto-scroll to the entry when a grid cell is selected.
- **Pin button** — `pin` button locks the radar to the current scope, stopping editor-driven auto-updates.
- **Detail table layout** — columns are now Addr / Name / T / Rgn / Notes / Lines. Line references in the last column jump to the editor. Clicking a row selects the grid cell (no jump to table by default; use `follow` mode).
- **Memory-map hover** — hovering a hex literal (e.g. `0x22d8`) in `.evs` code now shows the memory-map name, lifecycle, and an “Open Memory Radar” command link if the address is documented.
- **Lifecycle priority fix** — temp (0x2800–0x28FF) and session (0x2200–0x27FF) address ranges now take priority over the `[SRAM]` tag, so temp RAM documented as SRAM is correctly shown as temp.
- **Memory-map cache** — `memory-map.md` is parsed once and cached; cache is invalidated when the file changes.
- **Reuse panel** — `openMemoryRadar` reuses the existing panel instead of creating a new one each time.

## [0.2.1] — 2025-05-09

### Fixed
- **Lifecycle regions corrected** — `temp` is now `0x2800–0x28FF`, `session` is `0x2200–0x27FF`, `system` covers everything else (was using wrong threshold `addr < 0x2000`).
- **Radar HTML tags in tooltips** — memory-map notes that contain `<br>` or other HTML are now stripped before display.

### Added
- **System filter button** — new fifth filter to hide/show system-region addresses.
- **Click-to-popup detail panel** — click any lit cell to see structured Vanilla notes, Writes (destructive, red), and Reads (non-destructive, blue). Replaces tooltip-on-hover.
- **Read / write cell coloring** — cells used only as write targets render with a red inset shadow; cells used for both reads and writes render amber.
- **Word-byte pair highlighting** — hovering a `word`-type cell highlights the adjacent +1 byte cell.
- **`tools/snes9x_wram.py`** — macOS Mach VM prototype for reading live Snes9x WRAM. Use `--addr`, `--watch`, `--json` flags. See file header for usage and VS Code integration plan.
- **Filter hides empty rows** — `recomputeRows()` hides entire grid rows when all their cells are filtered out.

## [0.2.0] — 2026-05-09

### Added
- **Memory Radar merged in** — the standalone `everscript-memory-radar` extension is
  discontinued; its visualizer now lives in this extension.
- **`Everscript: Open Memory Radar` command** — opens a compact, sidebar-friendly WRAM
  visualizer beside the active `.evs` file. Accessible via right-click context menu or
  the `◉ Memory Radar` CodeLens shown above every `fun`/`map`/`area`/`group` declaration.
- **CodeLens** — `◉ Memory Radar` appears above each scope declaration for one-click access.
- **WRAM heatmap grid** — 9×9 px cells, 16 per row, covering the full documented address
  range. Color indicates lifecycle: blue = temp (`<0x2000`), amber = session, green = sram.
  Bright = used in current scope, dim = documented but unused, near-invisible = rest
  (undocumented). Hover tooltip shows address, name, type, and usage lines.
- **Region usage bars** — temp/session/sram each show `used/total (%)`.
- **Filter buttons** — toggle temp/session/sram/rest visibility independently. Rest is
  off by default (collapses entirely-undocumented rows).
- **Detail table** — lists every known address with addr, name, type, lifecycle chip, and
  clickable line numbers that navigate back to the usage site in the editor.
- **Bidirectional navigation** — click a grid cell to jump to its detail table row; click
  a line number in the table to reveal that line in the source editor.
- Reads `.github/memory-map.md` from the workspace root for ground-truth address data.

### Notes on WRAM addresses
Addresses in `memory(0xADDR)` and `<0xADDR>` are treated as absolute 16-bit WRAM
addresses (bank `$7E` implied). No offset arithmetic is applied by the parser.

### Snes9x live-memory feasibility
Theoretically possible on macOS via `task_for_pid()` + `mach_vm_read()` (Mach kernel
API), the same mechanism Cheat Engine uses. Requires a native Node.js C++ addon and
appropriate process entitlements — not implementable in pure JS from a VS Code extension.
A future milestone could ship a small helper binary for this.

## [0.1.5] — 2026-05-08

### Changed
- **Annotations redesigned to P5 amber bold** — `@install`, `@inject`, `@async` etc.
  are now rendered in bold amber (`#FF9900`) instead of lilac. Rationale: they are
  ROM linker directives that specify the exact byte offset where code is placed;
  semantically equivalent to `<0x1234>` address literals.
- **`<NAME>` entity refs are now all-amber** — the identifier inside `<BOY>` was
  previously teal (P2); now amber (P5) so the whole `<BOY>` construct reads as one
  cohesive hardware-access token.
- **`object[n]` / `arg[n]` brackets now amber** — `[` and `]` get scope
  `punctuation.section.accessor.evs` → amber, completing the accessor construct.
- **P6 is now preprocessor-only** — `#memory`, `#include`, `#patch` remain lilac.
  Annotations are no longer grouped with preprocessor.
- **Theme structural corruption fixed** — a duplicate orphaned `tokenColors` section
  that existed outside the valid JSON root has been removed. Several scopes (labels,
  `variable.language.evs` italic) were previously dead code in that section.

### Added
- **Binary number highlighting** — `0b1010` tokens now get scope
  `constant.numeric.binary.evs` → light green (P8), matching hex and decimal.
- **Annotation argument coloring** — `@install(0x99aac0)` now colors the `(` and `)`
  amber too; address/number/enum arguments inside are tokenised correctly.

## [0.1.4] — 2026-05-08

### Added
- **Number hover** — hovering `0xFF`, `0d99`, or `0b1010` shows the value in hex,
  decimal, and binary plus the byte size inferred from the digit count.
- **Unqualified enum member hover** — hovering a bare `SOUTH`, `ACT4_DOOR_OPENING`,
  etc. now shows the parent enum name, value, and (when unambiguous) the full
  enum listing with the matched member highlighted.
- **Dead branch dimming** — `if(False)`, `if!(True)`, and `if(ENUM.MEMBER)` / 
  `if!(ENUM.MEMBER)` where the member value is 0 or non-zero respectively are
  detected at document open/edit and the unreachable block is rendered at 35% opacity.

### Fixed
- **Declaration name hover conflict** — hovering the name in `enum entrance {` or
  `fun entrance(...)` no longer shows the `entrance()` function tooltip.
- **Accessor hover conflict** — hovering `object` in `object[door_id]` no longer
  shows the `object()` function tooltip; same for `arg`, `script`, and `time`.
- **Unqualified SOUND members** — enum members used without their prefix (e.g.
  `ACT4_DOOR_OPENING`) now show a tooltip via the reverse member lookup.

## [0.1.3] — 2026-05-08

### Added
- **Go-to definition** (`F12` / cmd+click) — jumps to the `fun`, `map`, `area`,
  `group`, `enum`, or `val` declaration for any identifier in the workspace.
  Also resolves `#include("path")` to the included file.
- **Find all references** (`Shift+F12`) — finds every occurrence of a function
  or variable name across all `.evs` files in the workspace.
- **Workspace index** — all `.evs` declarations are indexed on activation and
  kept live via a file watcher (creates/changes/deletes).
- **Function name completions** — typing any identifier now offers all 521 core
  and native functions as completions with full parameter snippets.
  e.g. `transition` expands to `transition(${1:map}, ${2:x}, ${3:y}, ...)`.
  User-defined workspace functions are also included.
- **Enum name completions** — all 111 enum types appear in the completion list.

---

## [0.1.2] — 2026-05-08

### Added
- **Hover documentation** — hover over any function name to see its full signature
  and whether it is a native (compiler built-in) or core library function.
  Hover over an enum name to see all its members with values and comments.
  Hover over `ENUM.MEMBER` to see the specific member value.
  Hover over special identifiers (`BOY`, `LAST_ENTITY`, `NORTH`, `True`, …)
  to see a plain-English description.
- **Enum member completion** — typing `DIRECTION.` or any `ENUM.` triggers a
  completion list of all members with values. Typing `@` suggests annotation names.
- **Document symbols (Outline panel)** — `fun`, `map`, `area`, `group`, `enum`,
  and `val` declarations appear in the Outline panel and breadcrumbs.
- **Snippets** — `fun`, `map`, `area`, `group`, `enum`, `if`, `if!`, `ife`,
  `while`, `while!`, `for`, `val`, `var`, `#memory`, `#include`, `@install`,
  `@inject`, `@async`, `transition`, `sleep`, `conversation`, `add_enemy`.
- **Problem matcher** (`everscript`) — register in a `.vscode/tasks.json` task to
  get compiler errors in the Problems panel with clickable file/line links.
- **Task definition** (`everscript`) — task type for future build task support.
- `code_highlighter/data/index.json` — 521 function signatures and 111 enum definitions extracted
  from the core library (regenerate with `python3 tools/generate_data.py`).
- `tools/generate_data.py` — data extraction script for dev use.

---

## [0.1.1] — 2026-05-08

### Added
- `.github/copilot-instructions.md` — global agent rules for the plugin repo
  (version bump ritual, file map, test format reference, colour theme policy)
- `docs/future-features.md` — full roadmap: hover docs, auto-completion, diagnostics,
  go-to-definition, signature help, LSP server plan, priority stack

---

## [0.1.0] — 2026-05-08

### Added
- Initial release
- TextMate grammar for `.evs` files (`source.evs`)
- Language configuration (bracket matching, comment toggle, word pattern)
- Bundled Everscript Dark colour theme
- Highlights: keywords, declarations, types, booleans, numbers (hex + 0d-decimal),
  memory addresses, memory ranges, enum access, annotations, preprocessor directives,
  built-in functions, core library functions, user function calls, special identifiers,
  label destinations, operators, strings with in-string placeholders
