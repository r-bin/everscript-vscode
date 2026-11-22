# Open Evermore: WRAM by name

Status: **proof of concept (v0.456.0)**: one variable moved by name, the stored playbacks in step. Back to
[README.md](README.md). Labels as there.

The ROM kinds place resources anywhere because every reference to them is generated. WRAM is the same problem one level
down: the files already name WRAM (`write_word ENEMY_SPAWNER_QUANTITY, 1` in scripts, a ring's `buffer`, a formula's
`learned/flags`, a weapon's `owned/flags`), but the game reaches each variable through fixed operands. Growing a table
whose per-id state lives in WRAM (a 36th formula, a 15th weapon) needs WRAM that is not there: the formulas' experience,
level and cast words are 35 each, back to back; the weapon skill words run into the Dog's.

## 1. Until WRAM can be allocated: `temp[]` as a placeholder

The compiler's `temp[]` (`COMPILER_TEMP`, `$7E:2834`-`$28FB`, 100 words, `REGION_ROOM_SCRATCH`) is the one block meant
for anyone's use. A kind that grows past the WRAM its ids have may give the new ids cells of `temp[]` as a placeholder,
named in the kind's file (`"experience": "temp[90]"`), taken from the top down: vanilla's room scripts use low cells (`temp[1]`, `temp[3]`, `temp[8]` seen), and a
room's own scripts keep theirs. The price, said in the file: `temp[]` is wiped on every room load and not saved, so the state
lasts one room. Good enough to try a new formula or weapon; not for a release. The real fix is §3.

## 2. The proof of concept: `tools/open-evermore/wram-poc.mts`

```
node tools/open-evermore/wram-poc.mts --scan                       every WRAM entry the recorded play reached, by blockers
node tools/open-evermore/wram-poc.mts RNG_SEED_0                   its references, what blocks a move
node tools/open-evermore/wram-poc.mts RNG_SEED_0 --to RING_DEBUG_ITEMS [--movie <file.evsmv>] [--frames n]
```

**References.** From the vanilla CDL library (`cdl-recorder` skill): `xrefs.bin` lists each PC with every WRAM byte it
touched, how wide, and whether through a pointer (PCs are bus addresses, `$8F:A198`); capped PCs (128+ addresses) keep
only a lowest-to-highest range; `script-xrefs.bin` the script instructions. Plus a static scan of every recorded
instruction head for an operand inside the variable.

**What can move.** An instruction whose operand is the variable: absolute or long, plain or indexed, base inside it,
and touching nothing outside it. The rewrite keeps the opcode, length and cycle count (all WRAM is one speed), so the
build can stay in lockstep. **What blocks**: direct page, indirect, a pointer, a base outside the variable (an array or
block holding it), an instruction that also touches bytes past it, DMA, a script. **Unknown**, not rewritten: capped PCs
whose range covers it (a range does not say they touch it) and static operands never seen touching it (a 16-bit operand
is WRAM only when the data bank mirrors low RAM; with DB `$C4` it reads ROM).

**The check.** Vanilla and the build play a stored playback in two snes9x cores; after every frame WRAM must be equal
through the move (vanilla's old place = the build's new place, and back) and so must the PC.

**Results** (2026-11-22; target: the debug ring's buffer `$0F5A`-`$0F7F`, which nothing in vanilla touches):

| Variable | Rewritten | Playback | Result |
|---|---|---|---|
| `RNG_SEED_0` (`$0133`, 8 B) | 27 instructions | intro 2m20 (8,414 frames), attract loop (6,224) | **in step**, every frame |
| `CONTROL_CONFIGURATION` (`$0B21`, 2 B) | 5 | intro 2m20 | in step (its screen never runs: proves only boot) |
| `JOYPAD1_HELD` (`$0104`, 2 B) | 73 | intro 2m20 | **leaves step at frame 473** (`$0004` differs): a reader the CDL does not pin down (a capped PC or a direct-page access with D ≠ 0); open |

`--scan`: of 191 entries the play reached, 13 have no blocker; most have one to a few (arrays reached through another
base, pointers, scripts). The 42 capped PCs (generic copy and pointer routines) cover nearly every variable.

## 3. Toward allocated WRAM *(proposal; todo: [../todo/wram-allocation.md](../todo/wram-allocation.md))*

A `wram` kind: one file per variable or struct (from the knowledge entries: name, size, lifetime room/save), and
implode places them like ROM items: saved state inside the save block (`$2258`-`$2833`, copied to SRAM), room state
anywhere, the Boy's struct and the pointer to it (`$0F3E`) as one item. What implode then generates, per variable: every
operand the CDL ties to it, the data that holds its address (the formulas' `learned/flags`, a weapon's `owned/flags`, a
ring's `buffer`: already names in their files), script operands (already names). Before that holds, every blocker class
above needs a rule: arrays move as one item with their base; pointer and direct-page readers need their pointer's
source found (often an immediate: `lda #$0F5A`); capped routines are block copies whose source and length are
immediates or tables; DMA sources are immediates. A save written by one layout does not load in another: the save
block's layout must be part of the manifest.
