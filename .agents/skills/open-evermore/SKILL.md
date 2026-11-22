---
name: open-evermore
description: Use when working on Open Evermore (tools/open-evermore: explode, implode, prove), adding or changing a kind or codec, or when a proof leaves step.
---

# Open Evermore

The ROM as a folder of named parts. The design, every kind and the state of each live in
`docs/open-evermore/` (README, resources, progress, tool); read the kind's section in `resources.md`
before touching its codec. This skill is how to work on it and what bit us.

## Owner's rules (do not re-litigate)

- **Hard rule:** whatever explode writes implodes to a working ROM in any layout. A resource is reached
  only through what implode generates (tables, pointers, ids); a kind is exploded only when that holds.
- **Names, never addresses.** Every reference between resources is a name: scripts by `@name` (calls by
  id too), handlers by routine name (`readers.mts` `routines(bank)`), fields by the name of the entry they
  pick, flag words as `a | b` (null when 0), operands that are one entity or projectile byte by its name. No name yet: create the knowledge entry first
  (`game-knowledge` skill), then use it.
- **One tool, no npm commands**; `<kind>/_enum.json` is the one ordered file of a kind.
- **Untangled by default, vanilla with `--strict`.** Without `--strict` every relative call into another
  script is written absolute (it ends in `0x29`'s code anyway), so no script must lie near another; jumps
  inside a script and id calls keep their form, and the files never change. `--strict` keeps vanilla's
  forms and groups: G0 (vanilla sha1) and the lockstep proof.
- Related kinds share a group folder, every kind in a subfolder of its own (`characters/records/` beside
  `characters/behaviours/`, `maps/rooms/` beside `maps/tiles/`): `Codec.folder`.

## A kind is done when

1. explode writes it by name, losslessly (explode throws rather than lose bytes);
2. `implode --strict` of a fresh tree gives the vanilla sha1, no warning;
3. `implode --random <seed>` round-trips (explode again, compare `canonical` forms) on 2+ seeds;
4. `prove --random <seed>` plays the stored playbacks in step on 4+ seeds, alone (`explode --kinds`) and
   with every kind;
5. `progress.md` (row, §2, log) and `resources.md` say so, with the seeds.

**Test what the change can break, no more (owner: an hour for a small change is too long).** A change to how
files *name* things (bytes identical) is proven by implode `--strict` = vanilla sha1 and two `--random` round trips
(seconds), then `g0.test.mts`; `prove` adds nothing (same bytes, same layout) beyond one smoke seed. `prove` on several
seeds only when placement, rules or bytes change.

Tests: `tests/open-evermore/g0.test.mts` (rom tier, ~4 min), `in-game.test.mts` (emulator), unit
`implode.test.mts`, `enum-layout.test.mts`, `formats.test.mts`. `prove` is on demand, ~1 min a seed.

## How the code fits

- A codec reads and writes **its kind's paths** (`tiles/…`); `folders.mts` moves them into the tree's
  folders and back, findings included. Item keys are `<kind>/<name>` and never move.
- `canonical(path, bytes, ctx)` says what the round trip compares: derived fields out, an id and a name
  for the same thing equal (scripts resolve ids and folder-relative names through `ctx`).
- An item that is the same content in another encoding sets `same` (not "changed"); one whose bytes
  shift against the written form gives `segments`, so `prove` maps WRAM pointers stretch by stretch.
- Placement rules (`Rule` in `codec.mts`) carry timing as well as addressing (traps below).

## Proving and debugging

- Prove kinds apart: `explode --kinds a,b --out <scratch>`, then `implode`/`prove` on that tree.
  Maps, scripts, tiles and tile families need each other; scripts need entities and projectiles, which
  need attack procs.
- **Removing a kind reshuffles every other** (the RNG sequence changes), so a bisect by kind tests
  layouts, not kinds. Compare like with like: pin chosen items at home in one layout (a throwaway
  hack in `allocate`), or census the failing layout directly.
- When a proof leaves step, trace both ROMs per frame around the first bad frame (PC, X/Y, the DP
  pointers of the routine) with `play.mts`'s `boot()`; the PC tells which loop is ahead.
- A build that cannot be lockstep (fast forms) is checked by screen: count frames whose screen hash
  differs, per window; the same scenes come back.

## Traps

- **The engine is cycle-sensitive**: any cycle change leaves WRAM out of step for good. Moving data is
  free only while every reader takes the same path. Found so far:
  - a read that ends on a bank's last byte turns the bank after it (`iny` wraps): `Rule.noBankEnd`
    (music always, tiles where vanilla did not end there);
  - pieces that crossed a bank keep their offset in it (`bankOffset`);
  - an image grown to ExHiROM puts data in slow banks: the allocator places tight rules, then the
    largest items first, so a random build fits 4 MiB;
  - an absolute script call is faster than a relative one: `prove` builds `--strict`.
- **A resource `_base/` reads by address stays home** (projectile records: animation scripts throw them by
  address): an item only its home fits (`above`/`below`/`bankOffset`), the home found by id when renamed.
  `allocate` places such items first without a random draw: a draw would reshuffle every other kind's layout.
- **Script lines are operands, not bytes** (`op a, b, c`): `operands.mts` per token and parameter type, expressions
  in `expressions.mts`. Explode keeps a readable operand only if it reads back to the same bytes, else `[hex]`; the
  round trip compares bytes. `<`/`>` are operators except in `<0x…>` cells (`splitTop`).
- **The 3 MiB image has no free byte for implode**: the pool is exactly vanilla's resources (padding stays
  in `_base/`), so anything longer grows the image to 4 MiB (the fast forms: ~10 KB).
- `--random` starts at 4 MiB on purpose (half the items leave their bank); it is not growth.
- A test that asserts a random layout moved a given item is a coin flip; assert what the rule guarantees.
- **A round trip does not prove a layout**: any reading of bytes round-trips. Look at a wide and an odd item (v0.453.0
  read glyphs as ink and shadow planes; "W" showed they are two byte columns) and read the reader's loop.
- `npm run typecheck` does not check `tools/**/*.mts` strictly: run `npx tsc --noEmit --ignoreConfig
  --allowImportingTsExtensions --module nodenext --moduleResolution nodenext --target es2022 --strict
  --skipLibCheck --types node tools/open-evermore/open-evermore.mts`.
- Shell loops over a list: zsh does not split `$VAR`; write such scripts for bash.
- `npm run build:ts` deletes `dist/`, which the codecs load: never while a test or proof runs.
- `tools/generate-rom-map.mts` (needed after new knowledge entries) also rewrites sizes of entries
  around them, re-creates entries from the CDL export where no entry covers an address, and deletes and rewrites
  entries it owns: run it as it is, once, and read its diff; never a modified copy (one with writes stubbed out deleted
  a thousand entries, 2026-11-21). It calls unknown gaps padding: check the bytes before keeping such an entry.
