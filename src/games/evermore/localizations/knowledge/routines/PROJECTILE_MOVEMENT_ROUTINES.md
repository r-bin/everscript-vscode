---
addr: 90D967
size: 30
end: 90D984
kind: table
category: 🏹
name: PROJECTILE_MOVEMENT_ROUTINES
title: Projectile movement routines ($90:D967)
confidence: confirmed
tags: [combat, entity, graphics, table]
evidence: ["disasm: projectile physics loop $90:DE5E calls JSR ($D967,x) using routine offset from projectile archetype record +$08", "rom: 31 16-bit jump vectors in Bank $90 ($D985, $DD58, $DD61, $DEF7, $DD2D, $DCE7, $DD26, ...), preceding projectile records at $90:D9A6"]
see: [routines/tbl_projectile_records.md, routines/projectile_pool_update.md, docs/disassembly/engine-core/rom-enums.md]
---
Jump table of projectile routines in bank `$90`, indexed by a record's selector (2·k). Three record fields pick
from it: `+$08` the setup when animation command `0x4C` throws the record (`$90:DCBC`), `+$0A` the setup when script
opcode `0xB5` launches it (`$90:DCE4`), `+$0C` (copied to entity `+$26`) the routine `$90:DE5E` runs every tick.
Words k = 0..14 lie before the projectile table at `$90:D986`; from k = 15 on the words are that table's (no record
uses a selector past `$1C`). Corrected v0.451.0 from the disassembly (the earlier descriptions were guesses):

- `$00` (`$90:D985`): STP (`projectile_routine_none_stp`)
- `$02` (`$90:DD58`): power from `$0A3F`, then `$04`
- `$04` (`$90:DD61`): straight along the facing at the record's speed
- `$06` (`$90:DEF7`): start of an ellipse beside the thrower
- `$08` (`$90:DD2D`): strike at the target point at once (`projectile_strike_at_target`)
- `$0A` (`$90:DCE7`): straight to the target point (`projectile_motion_straight_to_target`)
- `$0C` (`$90:DD26`): no velocity, tick `$14` (`projectile_motion_stay`)
- `$0E` (`$90:DE9C`): tick: falls, gone on the ground
- `$10` (`$90:DF44`): tick: on the ellipse (`projectile_orbit_tick`)
- `$12` (`$90:DE88`): tick: timed straight flight
- `$14` (`$90:DFA9`): tick: motion and trail
- `$16` (`$90:DDCA`): aim by time; `$18` (`$90:DE11`): aim by speed; `$1A` (`$90:DE80`): timed, on the thrower's plane
