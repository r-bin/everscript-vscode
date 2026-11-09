# Outside the screen: camera, limits, sleep and wake, spawners

What the game does with everything outside its 256 × 224 screen. Read in the disassembly on
2026-11-09 for the recomp's widescreen research; the design built on it is in
SecretOfEvermoreRecomp `docs/widescreen/` (`enemies.md`, `camera-and-limits.md`). Marks: **V** the
cited code read, **L** likely, **U** not checked. Addresses are US. Every address here carries the
tag `widescreen` (`soe://tags/widescreen/`).

## Short version

* Collision is **whole-room** and ignores the camera.
* An enemy runs its AI anywhere in the room **while the awake budget has room**; only with the
  budget full do far enemies fall asleep (frozen, not drawn).
* Spawners create enemies **16..48 px outside the screen** and take them back beyond 48 px.
* Alchemy can only target enemies within 8 px of the screen.
* Enter scripts narrow the camera to part of a map (one hut of room `0x51`).

## Two cameras (V)

| DP | Meaning | Written by |
|---|---|---|
| `$BF`/`$C1` | target: scripted target `$242B`/`$242D` if ≥ 0, else deadzone filter on the camera actor `$0F42`; clamped to the camera limits | `$90:9E93` |
| `$C5`/`$C7` | screen shake | effects |
| `$59`/`$5B` | **rendered** camera = target + shake, clamped to [0, `$08F6`] / [0, `$08F8`] | `$90:9F21` |

Every world-to-screen conversion subtracts `$59`/`$5B`. Camera mode 0 (118 of 127 rooms, `$90:9A98`)
writes BG1 and BG2 scroll = `$59`, `$5B` − 1; the NMI copies the shadows `$010E..$0119`. Snaps
(room set-up, fade-in) centre on the actor (− 128, − 112) through `$90:94CD`. Field list:
[DIRECT_PAGE_BLOCK](../../src/games/evermore/localizations/knowledge/wram/DIRECT_PAGE_BLOCK.md).

## Camera limits (V)

`$23E9`/`$23EB`/`$23ED`/`$23EF` = left, top, right, bottom (the compiler's `MAP_X_START` ..
`MAP_Y_END`). The room header reader `$90:8F80` sets the whole room; **enter scripts narrow them**.
Room `0x51` (huts, 800 × 896 px) picks one 256 × 288 box per hut; the huts sit 16 px apart. Maps
with several 512 px screens move between them with `script_op_teleport_screens` (`$90:A001`), which
shifts camera, scroll and every awake entity. The Scripts tab's `cameraBounds`
(`src/games/evermore/scripts-tab/model/rooms.ts`) finds the scripts that write the limits.

## Collision is whole-room (V)

`tile_property_at_pixel_xy` (`$90:9815`) indexes the room grid `$7F:0000` by cell; the collision
word sits at `$7F:0004` + grid word. `probe_metatile_collision` (`$8F:AF48`) tests grid, elevation,
the room-edge box and bodies; nothing reads the camera.

* `$0F48..$0F4E` is a box 14 / 7 px inside the room's edges, written once per room by `$90:8F80`.
  It keeps movement probes in the room; it is **not** a view frustum (old name `VIEWPORT_CULL_*`).
* `$08FA..` are tilemap streaming buffers, **not** collision rows (old name
  `viewport_collision_row_*`). Only a 17 × 15-cell window of the 32 × 32 tilemap ring is drawn
  (`$0FAC`, `$90:93AA`, `$90:98FA`).

## Sleep and wake (V)

30 entity slots at `$3DE5` (stride `$8E`), Boy `$4E89`, Dog `$4F37`; awake list `$3DDF`, asleep list
`$3DE1`. Asleep entities get no AI and are not drawn. The scheduler `$8F:DC34` visits 6 slots per
frame (round robin from `$0EBC`) and calls `entity_sleep_wake` (`$8F:C40F`), positions relative to
`$59`/`$5B`, signed:

| State | Condition | Result |
|---|---|---|
| awake | `+$10 & $0030`, HP 0, `+$6C` ≥ 0, or awake count `$1070` < budget `$1076` | stays awake |
| awake | otherwise, outside [−48, 304) on X or Y | spawner-made: returned to its record (`$8F:DF41`); else sleeps (`$8F:C514`) |
| asleep | `+$10 & $0008` | never wakes |
| asleep | `& $0070`, `+$6C` ≥ 0, `$1070 + 2 < $1076`, or spawner-made | wakes at once |
| asleep | otherwise, inside [−16, 272) on X and Y | wakes, restarts its stand animation |

The budget [`$1076`](../../src/games/evermore/localizations/knowledge/wram/ENTITY_BATCH_PROCESS_LIMIT.md)
is 6 with Boy and Dog; after 3 lagged frames it drops to the awake count (≥ 5), after 1800 clean
frames it climbs back. So with up to 4 enemies awake, **they all run their AI wherever they are**.

## Spawners (V)

Script opcode `0xC2` makes a spawn record ([../scripts/enemy_spawns.md](../scripts/enemy_spawns.md));
`0x3C`, `0xBA`, `0xA2` create an entity directly. The spawner `$8F:DDBB` visits 10 of the 60
records at `$5DC3` (16 bytes: `+$02`/`+$04` point, `+$08` timer, `+$0C` count) per frame and spawns
when the count is > 0, the timer ran out, `$1070 < $1076`, `$1074 < $2435`, and the point is **16..48
px outside the screen**. The spawn decision uses no RNG; the next timer does. The entity keeps its
record in `+$8C`; beyond 48 px with the budget full it goes back (count + 1).

## Targeting (V)

`$8C:8658` accepts alchemy and ring targets only within 8 px of the screen.

## Entity kinds

| Kind | Test | Mark |
|---|---|---|
| script-placed enemy | `+$8C` = 0 | V |
| spawner-made enemy | `+$8C` ≠ 0 | V |
| never sleeps (bosses, scripted) | `+$10 & $0010`, or `+$6C` ≥ 0 | V |
| never wakes | `+$10 & $0008` | V |
| friendly / party side | `+$10 & $0002` / `& $0004` | U |
| driven by a script | a script slot at `$28FC` (`+$0D`) points at it | L |

## Screen-wide effects (V unless said)

* Brightness: `$0106` is the INIDISP shadow (entry still named `JOYPAD1_TRIGGERED`), `$0B83` the
  fade target: fades to black go through brightness. Fades to white and flashes do not; colour
  math with the fixed colour (`$90:98ED`) or palette cross-fades (`$90:D481`) are candidates (U).
* Full-screen menu pages (`$8C:B743` set-up, `$8E:E08B` field restore, L) draw into the room's
  VRAM; the field is redrawn when they close.
* The ring menu's dimming is not a brightness fade; how it works is open (U).
