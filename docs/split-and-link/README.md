# Split and link: Evermore as parts that Asar puts back together

Status: **idea and gap analysis (2026-11-18), nothing built beyond what §2 lists.** The goal: take Evermore apart
into documented assembly and editable assets, add content by adding files, and let one build put it all back into
a ROM. Labels as in [../exhirom/layout-options.md](../exhirom/layout-options.md): *(repo)* = read in our code, docs or
the ROM; *(hardware)* = generic SNES; *(estimate)*; *(to verify)*.

| Page | What it answers |
|---|---|
| this page | the idea, what we have, the risks, what must come first |
| [../reverse-engineering/asm-to-c-port.md](../reverse-engineering/asm-to-c-port.md) §4, §8 | the shiftable disassembly and every pointer form it must symbolise |
| [../extension-tables.md](../extension-tables.md), [../table-hack.md](../table-hack.md) | every id-indexed table, its limit, and which ones already move |
| [../exhirom/layout-options.md](../exhirom/layout-options.md), [../sa1/port.md](../sa1/port.md) | where the extra space comes from |

---

## 1. The idea

**Split.** One command reads the user's ROM and writes a source tree, shaped like `soe://rom/`:

```
out/split/                          (generated from the user's ROM, never committed)
  main.asm                          the link script: one `incsrc` per part, layout from layout.asm
  layout.asm                        generated: an `org` per part (§4.3)
  code/<routine>.asm                one routine per file, named and commented from knowledge entries
  tables/<table>.asm                every id-indexed table as `dl label` lines, never raw addresses
  assets/audio/music/<nn>/          a song package: package.bin (+ sequence/samples once decoded)
  assets/combat/projectiles/<nn>/   a projectile: properties.json + sprite + animation (§3.2)
  assets/maps/<room>/  assets/strings/  assets/sprites/ …   the existing soe://rom/assets/ kinds
mods/                               your additions: same tree shape, checked in by you, merged over out/split/
```

**Link.** Asar builds `main.asm`. A table is generated from the folder: `music/` holds 72 packages, so the song
table has 72 entries and the count byte says 72. The script opcode keeps addressing songs by id, so a new song
needs no new code.

**Gates.** Every change must pass one of these three:

| Gate | Means | Proven by |
|---|---|---|
| **G0 identical** | the unchanged tree builds the vanilla ROM byte for byte | sha1 (the Asar export already does this) |
| **G1 shifted** | parts moved, nothing added: the game plays the same | padding test + stored playbacks, same WRAM every frame (`sample-playbacks` skill) |
| **G2 extended** | content added: vanilla playbacks still identical, new content has its own playback | as G1, plus a playback per addition |

---

## 2. What we already have

| Piece | State | Where |
|---|---|---|
| Byte-exact Asar export | ✅ G0, 48 bank files, 403 recorded functions; **3,466 `incbin rom.bin:` runs** remain *(repo, current export)* | `src/platform/cdl/asar-export.ts`, `out/recomp/asar/` |
| Symbolised pointers | rooms (`room_XX` labels, 127 blobs) and strings (`str_<index>`, 3,002) only | [asm-to-c-port.md](../reverse-engineering/asm-to-c-port.md) §8.1.1 |
| Moved tables, proven identical | map table, enter scripts, string keys, script pointers, enemy index, character records, map palettes, `animate()` ids, sprite blocks 16×16 and 8×8 | [extension-tables.md](../extension-tables.md), `tools/table-hack/` |
| Measure → lay out → write | done once, for the tables in `$F1:8000+` | [table-hack.md](../table-hack.md) §2 |
| Space | 4th MB (contested), ExHiROM 8 MB, SA-1 8 MB dual view | [../exhirom/](../exhirom/README.md), [../sa1/](../sa1/README.md) |
| Encoders (implode) | rooms (LZSS/Markov, map editor), the room blob layout | `src/games/evermore/maps/` |
| Decoders (explode) | 14 asset kinds in `soe://rom/assets/`: maps, strings, scripts, sprites, palettes, tiles, audio (70 songs, 54 sounds), tables … | `src/games/evermore/resources/` |
| Documentation per address | ~7,100 knowledge entries; 472 reconstructed C files | `localizations/knowledge/`, `reconstructed-c/` |
| Region list | header, rooms, strings, tables, as known regions | `src/platform/cdl/known-regions.ts` |
| A second allocator | the everscript compiler places its scripts and text in the 4th MB itself | `../everscript` `compiler/linker.py` `MemoryManager` |
| Oracle | stored playbacks, headless snes9x, MesenCE as the WRAM reference | `sample-playbacks`, `reference-emulators` skills |

**Not there:** a padding test, a reader census for most tables, a layout engine shared with the compiler, codecs
for music and animations, and a projectile definition.

---

## 3. The two examples

### 3.1 More music

The chain *(repo)*:

1. Opcode `0x33` (`music()`) reads **one byte, a byte offset into the word table `$8C:8442`**. A negative entry
   leaves the music unchanged (`knowledge/opcodes/33.md`). The script therefore reaches at most 128 entries,
   not 256.
2. The entry selects a song package at `$81:9903` (3 bytes each, 71 used; `$81:9900` holds a count). The
   readers `$8C:8252` and `$8C:8257` are known, but the census is incomplete ([extension-tables.md](../extension-tables.md)).
3. The package is uploaded to the sound driver's RAM (`$8C:8236`,
   [soundbank-streamer.md](../disassembly/audio/soundbank-streamer.md)).

What "add a song by adding a folder" needs:

- Both tables generated from `assets/audio/music/`, and every reader of both known.
- A package format that we can write. Copying and renaming an existing package works today. A *new* song needs
  the Wolfgang sequence format and the sample layout decoded ([../todo/audio-and-music.md](../todo/audio-and-music.md) §1).
- An audio-RAM budget check: each package must fit next to the driver and the resident sound effects. That
  limit is in the SPC700, not in any table *(to verify: the size)*.
- Optional: `0x33` with a 16-bit operand, as a custom opcode, for more than 128 songs.

MSU-1 ([../msu1/README.md](../msu1/README.md)) bypasses the package problem for streamed audio, but it is no
help for songs that must play on a plain cartridge.

### 3.2 More projectiles

A projectile is **not one asset** in Evermore. Opcode `0xB5` (`projectile()`) passes a *kind* that indexes
`$90:D986`, the movement table. `$90:DCC0` then fills an entity slot from it
([opcode-b5-projectile.md](../disassembly/script-vm/opcode-b5-projectile.md),
[projectiles.md](../disassembly/combat/projectiles.md)). What you see and what hits comes from elsewhere:

| Part | Where | Can it grow today? |
|---|---|---|
| movement entry | `$90:D986`, a word per kind | **needs readers**; bank `$90` is full *(repo: sprite palettes row)* |
| animation | animation records in bank `$C4`, ids as 16-bit offsets | only into the 26-group pool ([adding-animations.md](../adding-animations.md)) |
| sprite graphics | sprite block tables `$EC0000` / `$D80000` | ✅ proven moved, 10,922 ids |
| palette | bank `$90` | hook only, **not identical** (RNG drift) |
| damage, hit box | through the entity record and the combat code | not traced for projectiles *(to verify)* |
| slots at runtime | the shared entity pool in WRAM | fixed pool; more projectiles on screen means fewer enemies |

So `properties.json + sprite` is **our own schema**, and the linker compiles it into four or five tables. The
first projectile version should reuse an existing animation and palette, adding only a movement entry and
sprite blocks.

---

## 4. Risks

### 4.1 Legal: the split tree can never be committed

Disassembled game code is ROM bytes in text form, so the same applies to it as to extracted graphics or
music (AGENTS.md §0.1). Therefore:

- `out/split/` is generated from the user's ROM every time, like the Asar export today. Only the generator,
  our schemas and `mods/` holding *our own* content are committed.
- "Documented asm" means comments and names **injected at generation time** from knowledge entries, which
  are our own words and already in the repo. A hand edit inside `out/split/` is lost at the next split, and it
  could not be committed anyway.
- A mod is shared as a BPS patch or as `mods/` sources that need the other person's ROM.

### 4.2 Coverage: unknown readers crash where nobody looks

90.7 % of the ROM was never touched by the CDL in the last export *(repo: STEPS.md)*. A part may move only when
every reader is known. A forgotten `lda.l` into a moved table breaks only the room, boss or menu that uses it,
which no playback may reach. This is the main reason the whole game cannot be split at once.

### 4.3 Asar assembles, it does not link

Asar has `org`, labels and `incsrc`, but it does not place sections by itself. We must therefore generate
`layout.asm` from rules that Asar knows nothing about *(repo: [table-hack.md](../table-hack.md) §1)*:

- strings only in lower halves
- scripts and rooms only in upper halves, never across a bank, rooms ≤ 32 KB
- string keys within one 32 KB half
- bank-bound data (animation records in `$C4`, the bank `$90` palettes) stays in its bank

Whether Asar's `freespace` / `freedata` is any help under HiROM is *(to verify)*; even then it would not know
these rules.

### 4.4 Pointer forms beyond `lda.l`

Every form in [asm-to-c-port.md](../reverse-engineering/asm-to-c-port.md) §8.1 must become a symbol:

- bank taken from DB or PB
- split lo/hi/bank tables
- biased bases
- `mvn` operands
- DMA source registers
- the computed bank of a script pointer (`$92 + n`)
- **pointers inside data**: script operands, animation scripts, room blobs

The data ones need the asset codec, because the assembler cannot see them.

### 4.5 Timing and the RNG

Moving data to slow ROM (ExHiROM `$40–$7D`) or adding a hook changes the cycle count. The RNG then drifts and
G1 can no longer be proven, as with the sprite palette hook *(repo)*. Parts must stay in FastROM banks and keep
their addressing modes. New code paths are G2, never G1.

### 4.6 The limits behind the tables

A bigger table does not lift these limits:

- **id widths**: `0x33` takes a byte offset, and the map id goes through an 8×8 multiply
- **runtime pools**: entity slots, audio RAM, VRAM, the 8 sprite palettes in CGRAM *(hardware)*
- **save data**: if an id is saved, a wider id changes the save format

Each part needs a census of these ([asm-to-c-port.md](../reverse-engineering/asm-to-c-port.md) §8.3) before
anything is promised.

### 4.7 Two allocators, one ROM

The everscript compiler places code in the 4th MB on its own (`MemoryManager`), and so do the table hack and the
hacks in `$FC–$FF` ([table-hack.md](../table-hack.md) §1). A split-and-link build is a third allocator. Without
one shared directory, two of them will write to the same bytes.

### 4.8 Scale and variants

There are 48 banks and 3,466 binary runs. Documenting every routine is years of work *(estimate)*. The
progress figures in [PROGRESS.md](../disassembly/PROGRESS.md) count only the 403 recorded roots. Everything is
US 1.0; other builds have other addresses ([../evermore-releases.md](../evermore-releases.md)).

### 4.9 Downstream consumers

The recomp seeds, `hle_func` hooks, Mesen labels and the C-to-ROM build all use fixed addresses. After a G1
move, they must read the symbol file (`build/out.sym`). They must not keep a list of addresses of their own.

---

## 5. What to provide first, in order

1. **The layout manifest: the better memory map.** One machine-readable file per ROM, listing every region
   with:
   - its kind and its bounds
   - its readers, with their pointer form
   - its placement rule (§4.3)
   - its status (`identical` / `movable` / `needs readers` / `bank-bound`)

   It merges `known-regions.ts`, the ROM tab model and the status column of
   [extension-tables.md](../extension-tables.md); none of these may stay a second copy (AGENTS.md §0.9).
   `soe://rom/` serves it, so the ROM tab, the AI and the linker all read the same map.
2. **The padding test, automated.** Insert N bytes before a part, rebuild, replay the stored playbacks
   headless, and diff WRAM. A part passes or names the first frame where it diverges. This turns "is it
   symbolised?" into a gate (G1), run per part.
3. **One allocator and directory.** The table hack's measure → lay out → write, generalised. It applies the
   manifest's placement rules and emits `layout.asm`. It writes the directory at `$F1:0000`
   ([table-hack.md](../table-hack.md) §3) so the everscript compiler can read the free space instead of
   guessing.
4. **Round-trip codecs per asset kind.** The test for each kind: split → link gives identical bytes. Rooms pass
   today; strings need the decompressor for chunk ends; animation records and song packages come next.
5. **The split command.** It writes `out/split/` in the `soe://rom/` shape, with knowledge entries injected as
   comments. Untouched runs stay `incbin` and are marked as such, so the gaps show.
6. **First vertical slice: song packages.**
   - Why this one: a single table chain (`$8C:8442` → `$81:9903`) and a smoke test that needs no composing:
     copy package 5 to id 71 and play it from a script.
   - It proves the manifest, the allocator, codec round-trips and G2 end to end.
7. **Second slice: projectiles**, with the schema of §3.2. It needs the `$90:D986` reader census, and a place
   for new movement entries outside the full bank `$90`.
8. **After that, banks of code**, one routine file at a time, as each part passes G1.

Items 1–3 pay off before any splitting: the table hack, the everscript compiler, ExHiROM and SA-1 all need
them already.
