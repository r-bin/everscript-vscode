# Giving the Act 0 Dog its missing animations

> Status: **plan, nothing built.** Every number below was measured from the US
> ROM with `src/maps/dist/sprites` and `src/maps/dist/animation-vm` (2026-10-03).
> Background: [animation_script.md § The Dog's forms](../script-format/animation_script.md#the-dogs-forms),
> [sprite_format.md](../script-format/sprite_format.md).

## The problem

The Dog's form table at `$CF945F` has six 40-byte entries. Each one is a
10-byte header followed by 15 animation record ids (16-bit offsets into bank
`$C4`). The Act 0 (Podunk) entry, `$CF936D`, has art for only three of its 15
slots. The other twelve are the **Act 1 wolf's records, byte for byte**:

| Slot | 0 stand | 1 walk | 2 run | 3 | 4 damage | 5–8 attack | 9 | 10 | 11 sleep | 12 sit | 13 | 14 bark |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Act 1 `$CF9395` | `424e` | `426e` | `428e` | `42ae` | `42be` | `429e` | `425e` | `427e` | `42ee` | `4302` | `4312` | `433a` |
| Act 0 `$CF936D` | **`4502`** | **`4512`** | **`44f2`** | `42ae` | `42be` | `429e` | `425e` | `427e` | `42ee` | `4302` | `4312` | `433a` |

So an Act 0 Dog that attacks, takes damage, sits, sleeps or barks through its
form slot turns into the wolf, drawn in the Act 0 palette (`$90:B54B`). Vanilla
never shows this, because the Podunk prologue only walks and runs the Dog. It
does show up as soon as a custom map sets `CHANGE DOGGO ($2443) = Regular (0x0A)`
(form index `(0x0A − 2) / 2 = 4`) and lets the player fight.

Act 0 does have more art than its three slots use. It owns six record groups,
all 4-facing (flags `$40`), except `$4522`:

| Record | Id | What |
|---|---|---|
| `$44F2` | `ACT0_RUN` (`0x68`) | slot 2 |
| `$4502` | `ACT0_STAND` (`0x6A`) | slot 0 |
| `$4512` | `ACT0_WALK` (`0x6C`) | slot 1 |
| `$4522` | none | 1 facing, unnamed. Check what it draws before step 1 |
| `$4526` | `ACT0_BARK` (`0x170`) | **not in slot 14**, which is the wolf's `$433A` |
| `$4536` | `ACT0_EATING` (`0x1A0`) | cutscene only |

Together they draw **38 sprites** from **48 16×16 and 49 8×8 blocks**.

**Quick win, no art needed:** point slot 14 at `$4526`. That is a 2-byte data
patch at `$CF936D + 10 + 14·2` = `$CF938F`, and Act 0 barks as itself. Do this
first. It proves the whole patch → build → emulator loop on something tiny.

## There is no hidden art to recover

All 38 Act 0 sprites are used by records. The sprites listed around them
(`$CB51DC`–`$CB5631`, list indices 1389–1426) belong to the neighbouring forms.
None of them is an unused Act 0 sit or attack pose. So the missing poses have to
be **drawn**.

## How much to draw

These are the wolf groups that the twelve borrowed slots point at, with one
distinct sprite per pose across the four facings:

| Slot | Record | Facings | Sprites |
|---|---|---|---|
| 3 (?) | `$42AE` | 4 | 4 |
| 4 damage | `$42BE` | 4 | 4 |
| 5–8 attack (one group for all four levels) | `$429E` | 4 | 23 |
| 9 (?) | `$425E` | 4 | 20 |
| 10 (?) | `$427E` | 4 | 24 |
| 11 sleep | `$42EE` | 1 | 2 |
| 12 sit | `$4302` | 4 | 2 |
| 13 (?) | `$4312` | 4 | 4 |
| 14 bark | `$433A` → use `$4526` | | 0 |
| **Total** | | | **85 sprites** (wolf: 158 16×16 + 221 8×8 blocks) |

The Act 0 mutt is smaller than the wolf: about 1.3 blocks of each size per
sprite, where the wolf uses about 2. Expect roughly **110 + 110 blocks**. Mirror
east from west wherever the wolf does (flags bit 6) to cut the count further.
Slots 9, 10, 3 and 13 have no name yet. Play them in the Sprites tab (Dog → Act 1)
before drawing, and drop any slot that nothing in the game ever selects.

## The three layers a new pose needs

Nothing below touches engine code. Each layer is data the engine already
reads through a pointer or an id.

```
form slot ($CF936D+10+2s) ──16-bit──▶ record group in bank $C4 (4 bytes per facing)
record ──24-bit──▶ animation script (anywhere)
script `sprite` cmd 0x22..0x2B ──bank cmd+$A8, 16-bit──▶ sprite info in banks $CA..$D3
sprite info chunk ──16-bit block id──▶ $EC0000 / $D80000 pointer table ──23-bit──▶ pixels
```

### 1. Pixels: blocks

- Format: 4bpp planar. A 16×16 block is four 8×8 tiles (TL, TR, BL, BR, 32
  bytes each). The pixels use the Act 0 palette `$90:B54B`, so draw in those 16
  colours only, with index 0 transparent.
- Compression is optional. With bit 23 of the pointer set, the data is a
  bit-per-word skip list. `blockBytes()` in `src/maps/sprites.ts` decodes it.
  The encoder is its inverse: one status byte per 8 words, with a bit set for
  each zero word, followed by the non-zero words. Add that encoder next to the
  decoder, with a round-trip test over all 4,854 + 6,265 vanilla blocks.
- **The catch is ids, not bytes.** Block ids index fixed pointer tables:
  16×16 at `$EC0000` (ids 0–4853) and 8×8 at `$D80000` (ids 0–6264). Both tables
  are full and are followed directly by other data, so they cannot be appended
  to, and every id is used by at least one sprite. What is left:
  - **136 16×16 ids and 213 8×8 ids are used only by sprites that no record
    script references.** Those sprites may still be reached from code, from
    projectile records, or from the form header's `+0` pointer, which is itself
    one of them. They become reusable only after every one is checked against
    those three sources, and ideally against a playthrough trace (Mesen sprite
    pointer log). That is roughly the ~110 + 110 we need. It is tight but
    plausible.
  - Repointing an id only rewrites its 3-byte table entry. The data base
    `$D90000` plus a 23-bit offset reaches all the way to `$FFFFFF`, so the
    pixels can live in new space.
  - If the dead ids run out, the fallback is to move a table, and that is an
    engine change (the bases are hard-coded). Out of scope here.

### 2. Sprites: chunk lists

A sprite info is `[count][dataOffset]` followed by 5-byte chunks (`vhoopppn`
flags, signed x, signed y, block id). The animation script's `sprite` command
addresses it by **bank = opcode + `$A8`** (`0x22` → `$CA` … `0x2B` → `$D3`) and
a 16-bit offset. New sprite infos can therefore go in any free space **inside
banks `$CA`–`$D3`**, not just anywhere.

The sprite list is walked end to end with nothing indexing it
(`walkSprites`). New infos must therefore go **outside** the walked chain, or the
extension's own census (5,128 sprites) will desync. The engine does not care,
but our tools do.

### 3. Animation: records and scripts

- **Scripts** are reached by a 24-bit pointer and can live anywhere. Copy the
  wolf's scripts for the matching slot as templates. Keep the timing, `step`,
  `strike` boxes and `mode` bits (invulnerable frames, `end_check!` endings),
  and swap only the `sprite` operands. The strike/hurt boxes may need shrinking
  for the smaller mutt
  ([attack_boxes.md](../script-format/attack_boxes.md), [hitboxes.md](../script-format/hitboxes.md)).
  Run every new script through `runAnimation()` and require it to reach `loop`
  or `end_check!`, as the census does.
- **Records** are the hard constraint. A record id is a 16-bit offset into bank
  `$C4`, so each new group (16 bytes for 4 facings, 4 for one) must sit **in
  bank `$C4`**. The record table `$C43E3A`–`$C45999` is followed by other data,
  and the scan found no proven-free run in `$C4`. The zero runs at
  `$C409E4` (+542) and `$C41666` (+542) are the first candidates, but **zeros
  are not proof of free space**: confirm that nothing reads them (a
  `$C4` read breakpoint over a playthrough of a few areas) before writing.
  About 9 groups × 16 bytes ≈ 150 bytes are needed.
  - Fallback if `$C4` has no room: overwrite records that nothing references.
    That means no form, no character and no `animate()` id; `$4522` is the first
    to check. The wolf's own records are off limits, because Act 1 still uses them.
- **Form slots**: write the new record ids into `$CF936D + 10 + 2·slot`. That is
  the one place the Dog's form is wired up, and it is data.

## Where it goes: the ROM has no free space

A scan for runs of `$00`/`$FF` of 1 KB or more over the whole 3 MB (`$300000`)
ROM found **none**. About 220 blocks (~20–28 KB uncompressed, less compressed)
plus sprite infos and scripts will not fit in the vanilla image.

So the build has to **expand the ROM to 4 MB** (HiROM banks `$F0`–`$FF`, 1 MB
free) and put the block pixels and scripts there. Sprite infos cannot go there,
because they must be in `$CA`–`$D3`, and neither can records, which must be in
`$C4`. These two small pieces still need verified slack inside those banks:
sprite infos take about 85 × (2 + 5·chunks) ≈ 2–3 KB.

To check before committing to this:
- that the header's ROM size byte (`$FFD7`) and the checksum are rewritten,
  and that SoE boots and runs correctly at 4 MB in Mesen/bsnes and on an
  SD2SNES/FXPak. Randomizer builds of SoE are a lead for whether 4 MB is safe.
  Verify, do not assume.
- that the long reads behind block pointers (`$D90000 + offset`) are plain
  24-bit adds. If they wrap inside a bank, `$F0+` is unreachable.

## The one engine question to settle first

**How do sprite blocks reach VRAM?** This is not traced anywhere in this repo.
If the engine decompresses and DMAs blocks on demand per frame, which the
id-indexed, per-block-compressed design suggests, then new blocks need no
engine change. If it instead preloads a per-form tile set when `CHANGE DOGGO`
fires, the form header is the likely list for it. Its `+0` is a sprite pointer
(`$CB1867`, `$CB32B7`, `$CB43AC`, `0`, `$CB5755`), and **Act 0's is `0`**. In
that case the header must be filled in too, and VRAM space for the extra poses
may run out. Trace this with a Mesen VRAM-write breakpoint on the OBJ
area while the Dog changes pose, and record the result in
[animation_script.md § The Dog's forms](../script-format/animation_script.md#the-dogs-forms)
(the form loader is also still untraced there).

## Build steps

1. **Bark fix** (`$CF938F` ← `$4526`). It is 2 bytes and confirms the patch pipeline.
2. **Trace** the VRAM upload path and the form loader (above). Stop if it turns
   out to be a preloaded tile set; that is a different plan.
3. **Expansion** to 4 MB, plus checksum, booted in an emulator.
4. **Codec**: a block encoder and a sprite-info writer in `src/maps/sprites.ts`.
   A round trip over every vanilla block and sprite must be byte-identical.
5. **Free-space ledger**: confirm the dead block ids, the `$C4` record space and
   the `$CA`–`$D3` sprite-info space, each with the evidence for why it is free.
   Never write over bytes that are only "probably unused"
   ([map-editor-rules](../../.agents/skills/map-editor-rules/SKILL.md)'s
   "never invent data the ROM does not have" applies in reverse here: never
   claim space the ROM does not give up).
6. **Art**: pixel the ~85 poses in the Act 0 palette. Start from the wolf's
   poses for silhouette and timing, and the mutt's walk for proportions.
   Import from PNG (indexed, 16 colours, matching `$90:B54B`).
7. **Scripts + records**: clone the wolf's scripts per slot, swap the sprites,
   write the records, and point the Act 0 slots at them.
8. **Extension**: the Sprites tab's Dog → Act 0 should show the new slots with
   no code change, since `dog-forms.js` reads the slots from the ROM. Add a test
   that every Act 0 slot's record differs from Act 1's.
9. **In-game check**: a custom map with `CHANGE DOGGO = 0x0A`, then fight, take
   damage, sit and sleep.

## Open questions

- What do slots 3, 9, 10 and 13 do, and does anything select them?
- What is the form header: `+0` sprite, `+3` byte (`72 79 80 8E 87` across
  forms), `+8` word (`$20`, `$FA` on Act 4)?
- What does `$4522` draw?
- Is a 4 MB SoE image safe on real hardware, and how do existing SoE hacks
  handle it?
