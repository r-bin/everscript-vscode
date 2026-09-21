# Sprite palettes: how many enemies fit in a room

> Status: **solved** for the allocator. `src/maps/character-record.ts` reads
> the field; the Rooms tab shows the budget per room. From the
> `add_enemy__mosquito` trace, where Mesen even labels the table
> (`palette_slot_1`).

## Do map and enemy palettes share slots?

**No.** They are different halves of CGRAM. A character's palette is DMA'd to
`CGADD = $A1` and friends — 128 and up is the sprite half, 0..127 is the
backgrounds'. The two never collide, and adding enemies cannot corrupt the
map's colours.

Within the sprite half there are eight palettes of 16 colours, and *that* is
what runs out.

## The slot table

`$7E1278` holds one 16-bit value per slot: the palette address a slot
currently carries, which is exactly the number in character record `+0x09`.
Slot byte offsets step by 2, and `offset / 2` is the sprite palette number,
CGRAM `128 + (offset/2) * 16`.

Allocation is `$90CD80`, and it does two passes.

**First, reuse.** It compares the wanted palette against five slots, in this
order:

```
90CD83  CMP $1280,X    ; offset 8   -> sprite palette 4
90CD8B  CMP $1282,X    ; offset 10  -> palette 5
90CD93  CMP $1278,X    ; offset 0   -> palette 0
90CD9B  CMP $127A,X    ; offset 2   -> palette 1
90CDA3  CMP $127C,X    ; offset 4   -> palette 2
```

A match ends it. **Two characters with the same `+0x09` therefore cost one
slot between them, however many of them are on screen.**

**Then, a free slot.** `$90CDAF` looks for an empty one — and only checks
four: offsets 8, 10, 0 and 2. Offset 4 is not in that list.

**Then, theft.** With nothing free, `$90CE92` overwrites offset 4 — sprite
palette 2 — unconditionally, and re-points the entities that were using it.
That is the glitch: the fifth distinct palette lives in a slot that the next
thing needing one (an alchemy effect, a heal) will take, and whatever was
wearing it keeps the new colours.

The other three slots (offsets 6, 12, 14) are not in either list. In the
trace, offsets 12 and 14 belong to the Boy and the Dog.

## So, how many enemies can you add?

Count **distinct palettes**, not enemies:

| | |
|---|---|
| Slots a room can fill safely | **4** |
| The fifth | lands in the slot effects steal |
| Characters sharing a palette | free — they cost one slot together |
| Palette `0` | no palette at all; costs nothing |

The Rooms tab shows this per room as a row of slots: one chip per palette
the enter script can place, with a swatch and the characters wearing it,
then a dashed empty chip for each slot still free. Four pips beside the
heading say the same thing at a glance, and a palette past the fourth is
drawn red — that is the one sharing the stolen slot. It counts **every
branch** the enter script can take, so a room that branches shows more than
will ever be on screen at once.

In the vanilla ROM, 7 of the 128 rooms already list more than four, up to six
(room `0x09`) — which is consistent with the effect being a real, occasional
glitch rather than something the game rules out.

## Which characters share

90 distinct palettes cover the 134 named characters that have one — seven
have none at all — and **27 of those palettes are shared**. The largest groups:

| Palette | Characters |
|---|---|
| `$90B06B` | Boy, Girl, Man, Woman, Old man, Old woman, Advisor, Alchemy (8 villagers) |
| `$90B6AB` | Aquagoth, Tentacle, Tiny Tentacle ×2 more |
| `$90AFEB` | Child's Pet ×2, Girl, Boy |
| `$90B00B` | Worman, Man, Old woman, Old man |
| `$90BC0B` | Death Spider, Skullclaw, Mosquito, Magmar |
| `$90B76B` | Mechaduster ×2, Gore Grub |
| `$90B5EB` | Mad Monk ×3 |
| `$0000` | the invisible helpers — no palette, no cost |

So a room already holding a Mosquito can take a Magmar, a Skullclaw or a
Death Spider for free, and any number of villagers cost one slot between
them.

## How to check a candidate

`characterPaletteAddress(rom, character)` is the whole test: two characters
with the same value share a slot, and a character whose value already appears
in the room's list is free to add.

## What is not covered

- **When a slot is released.** The allocator only ever reuses or steals here;
  nothing observed says a slot is cleared when the last user of it dies, so
  the counts above are a budget, not a live simulation.
- **What reserves offsets 6, 12 and 14.** `$7E1432` is a mask of reserved
  slots read at `$90CE20`; the trace shows the Boy and Dog holding 12 and 14,
  but nothing here proves those three are always unavailable.
- **The effect palettes.** Which effects take the shared slot, and when, would
  need a trace of casting alchemy in a busy room.
