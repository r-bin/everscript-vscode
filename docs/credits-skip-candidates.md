# Reaching the credits sooner: candidates

> Status: **static analysis of the US ROM, nothing played in the game.** Room scripts read
> through the simulation's decompiler (`soe://rom/assets/scripts/rooms/<id>/decompiled.evs`),
> collision through `decodeRoom`, engine code through the code VFS. Each candidate says what
> would confirm or kill it. Movement and script tricks that are already written up live in
> [cheats.md](cheats.md); this page only links to them.

The question was: is there a glitch that gets a run to the credits faster? The short
answer from the code: **the final boss is behind exactly one check, and that check is a
single item flag.** Whatever ends up faster has to either reach that flag sooner, skip what
comes between the flag and the final room, or make the last fight shorter.

## 1. What has to happen for the credits to roll

Read backwards from the credits:

| Step | Where | What it checks |
|---|---|---|
| Credits | global script at `$92:D0DC`: clears INSIDE_OUTRO, sets IN_CREDITS (`$22F2` bit 0), music, then `call_id 0x5A` (CREDITS) | nothing |
| Epilogue scenes | global script `0x59` (`$92:D00D`): a counter in `$2439` walks through scenes in rooms `0x0A`, `0x19`, `0x10`, `0x54`, fades the music and resets the game | nothing |
| Outro in the final room | room `0x4A` enter script: with INSIDE_OUTRO (`$22F1` bit 6) set it runs `$9B:B4F0` (the Professor arrives, the cutscene) | INSIDE_OUTRO |
| INSIDE_OUTRO set | written at `$9B:B4E6`, directly before `$9B:B4F0`; most likely the end of the final fight (**not traced**) | the fight |
| Final room `0x4A` | its enter script tests only INSIDE_OUTRO and `$22EB` bit 5 (set by every door's fade-out, globals `0x27`/`0x2E`). Its own triggers are the floor and the eight fan/speaker panels; `$9B:AF4B` loops until `$2867` = `0xFF` | **no story flag** |
| The door into `0x4A` | room `0x48` (Metroplex tunnels) B-button #0, box (70,53)–(72,55): `load_map(0x4A, 20, 37)`; also sets `$22F8` bit 2 | **only "the Boy is active"** |

`0x48` B #0 is the only `load_map(0x4A)` in all 127 rooms' scripts.

### The door sits in a sealed chamber

Room `0x48` is the hub of Omnitopia: a 4 × 4 grid of cells joined by scripted lifts
(B-buttons that call `$9A:E40D` / `$9A:E477`, coordinates in `$249D`–`$24A3`, `$24F9`/`$24FB`).
A flood fill of its collision (geometry nibble ≠ `0xF`, all planes) puts the final door's
box in a walkable area of its own, about 14 × 5 tiles, with **walls at least five tiles
thick on every side**. No lift's coordinates point into it. Only two writes do:

- B #0 itself (`$24A1`/`$24A3` = 912, 672), which needs you to already be there, and
- the arrival of the **Energy Core teleporter**: `$24FD` = `0x11` → `$9A:D748` places the
  party at (968, 664), inside the chamber.

### The Energy Core teleporter is the real gate

Junkyard (`0x49`, landing spot) step-on #12, box (13,50)–(17,51), script `$9B:E0D2`:

```
if (ENERGY_CORE || $22EB bit 3) ENERGY_CORE_TELEPORTER_USED = 1 else end
… four objects, 120 ticks, the save prompt …
ENERGY_CORE = 0
$24FD = 0x11; fade; load_map(0x48, 121, 83)   → the sealed chamber
```

- **ENERGY_CORE** is `$2264` bit 5 (flag index `0x65`). It is set in exactly one place, room
  `0x1A` (Chessboard, below the board) B #0 at `$99:DAC2`, which checks nothing but its own
  "taken" bit (`$22E7` bit 6). It is cleared in exactly one place, the teleporter above.
- In the Junkyard, the landing point used on the first arrival (120, 656) and the pad are
  in the **same walkable area** (flood fill, same caveats as above). The Guard Bot spawned
  by the enter script at (110, 24) and its attached script were not read; it may be what
  sends you to the jail (step-on #11 → `0x7E`).

So the shortest possible ending, by the scripts, is:
**take the Energy Core in Gothica → arrive in the Omnitopia Junkyard → walk to the pad →
fight the final boss.** Nothing else in Omnitopia is checked on that path.

## 2. Candidates

Ranked by how likely they are to save real time.

### A. Omnitopia's interior is not on the required path (route, not a glitch)

**Claim:** from the Junkyard landing, with ENERGY_CORE set, the pad goes straight to the
final chamber. The jail, storage room, reactor, greenhouse, alarm room, control room and
the hub's lift puzzle are checked by nothing on the way to the credits.

**Why it may be new:** if the current any% route goes through Omnitopia's interior before
the pad, everything between landing and pad is skippable. If the route already walks
landing → pad, this is just the route, and the page at least proves there is no shorter one
through the scripts.

**To confirm:** play it in the emulator from a save just before the rocket: land, avoid the
Guard Bot, step on the pad. Read the Guard Bot's attached script (`0x1B75` on the entity
spawned by `0x49`'s enter script) to see whether contact forces the jail.

**Still open:** which flags the rocket to Omnitopia needs (the Junkyard's first-arrival
branch keys on flag `0x4B0`, and no plain "set" of it appears in the script banks, so it is
written some other way), and how early room `0x1A` can be reached (entries: Chessboard
`0x19` step-ons #0 and #4, and room `0x21`).

### B. The second key, `$22EB` bit 3 (needs a memory write)

**Claim:** the pad also opens with `$22EB` bit 3, and nothing in the game ever sets it.

**Evidence:** no script "set flag `0x49B`" in the script banks (`$92`–`$9B`); the only matches
of that byte pattern are in code/data banks. The engine's stores to `$22EA`/`$22EB`
(`$80:8B7F`–`$80:8D17`, `$8D:B4AB`, `$90:8F10`) only touch bits 0–2 of `$22EB` (cold-boot
and room-load bookkeeping) and bits 2–6 of `$22EA`. It looks like a developer's key that
was left in the condition.

**Use:** only with an arbitrary-RAM-write glitch, which this game is not known to have.
If one is ever found, setting this bit (or ENERGY_CORE itself) while standing on the pad is
the shortest credits path there is: it skips Act 3's Energy Core entirely.

### C. A lift race in the hub (unlikely)

**Claim:** every lift in `0x48` writes its coordinates into the same WRAM words
(`$249D`/`$249F`/`$24A1`/`$24A3`) and the lift script `$9A:E24F` re-reads them on every tick
of its teleport loops. Two lift scripts running at once would teleport a character to the
other one's coordinates.

**Why it probably dies:** `$9A:E24F` freezes both characters on its first instruction and
sets `$2834` bit 1, which the other triggers check; a second B press would have to land on
the same tick. Worse, none of the coordinates written outside the chamber point into it,
so even a successful race only mixes outer cells. Not worth testing before A.

### D. Shorter final fight: unlimited buff stacking

[5-status-effects-bug.md](5-status-effects-bug.md): casting a fifth buff evicts an old one
without undoing its bonus. Repeating it stacks Atlas's attack bonus without limit. That
saves fight time, not route time. The final fight is the one that profits most, since it
comes right before INSIDE_OUTRO.

### E. Shorter final fight: refilling the Greenhouse chest

[cheats.md § Leaving a room cuts every running script](cheats.md#leaving-a-room-cuts-every-running-script):
the Omnitopia Greenhouse chest gives 30 Cryo-Blast before it records "opened", and its exit
is four cells away. That is a damage-item farm. It conflicts with A, because A avoids the
Greenhouse; it is only worth it if the farm saves more time in the fight than the detour costs.

### F. Already known, no help for the ending

- **Desert of Doom wrap bypass** ([cheats.md](cheats.md#desert-of-doom-wrap-bypass-destination-passability-glitch)):
  the screen-shift teleport (opcode `0x96`) that it exploits is used only in room `0x1B`, so
  the same passability fault cannot be used anywhere else.
- **Walking through enemies** and the **diagonal speed boost**: small movement savings
  everywhere, no skip.

## 3. Checked and ruled out

- **Another way into `0x4A`:** none. One `load_map` in all room scripts.
- **A flag on the final door:** none; B #0 tests only that the Boy is active.
- **Walking or clipping into the chamber:** no thin wall to clip through (five or more solid
  tiles on each side), and no known collision bug lets a character cross solid tiles.
- **A lift that lands in the chamber:** the lift table `$9A:D5C8` (indexed by `$24FD`
  1–`0x10`) only holds outer cells.

## 4. How this was read

- Room scripts: all 127 rooms' `decompiled.evs` from the simulation, searched for
  `load_map(0x4A`, `load_map(0x48`, the gate flags and `$24FD`.
- Single scripts: `soe://rom/assets/scripts/<address>.evs` (`$9A:D434`, `$9A:D5C8`,
  `$9A:E24F`, `$9B:AF4B`, `$9B:B4F0`, `$92:D00D`, `$92:D0DC`).
- Global script table: found from the known entries `0x27` (`$92:9FA0`) and `0x2E`
  (`$92:A010`); entry `0x59` = `$92:D00D`, `0x5A` = `$92:D0F9`.
- Collision: `decodeRoom` for `0x48` and `0x49`; trigger boxes are in world tiles, so
  subtract the header's origin (`0x48`: 14, 12; `0x49`: 8, 11) before indexing the grid
  ([rooms-map-coordinates.md](rooms-map-coordinates.md)).
- Engine stores to `$22EA`/`$22EB`: byte search of the ROM for absolute and long
  stores, read back with the code VFS's disassembler.
