---
addr: 8CE100
end: 8CE10B
size: 12
kind: table
category: 📋
name: SCRIPT_ANIMATE_MODE_TARGETS
title: Opcode 0x78 mode dispatch targets (animate's mode)
confidence: confirmed
tags: [script-vm, animation]
evidence: ["rom: $8C:E100 = 39 E1 15 E1 1D E1 30 E1 0C E1 25 E1, read by `jmp ($E100,x)` at $8C:E0FD with X = the mode expression; code starts at $8C:E10C (2026-11-21, corrected: the older list had modes 6, 8 and 10 wrong)"]
see: ["routines/script_op_78_animate.md", "routines/animate_id_to_record.md", "docs/disassembly/script-vm/animate.md"]
---
The six handlers animate()'s mode picks, by mode value (a byte offset, so even values 0-10). Open Evermore
writes them as `characters/animation_modes/`, the compiler's `ANIMATION_MODE` names lowercased.

| Mode | Target | Name | Effect, then `$E139` starts the animation |
|---:|---:|---|---|
| 0 | `$8C:E139` | `animate_id_to_record` | none (ONCE) |
| 2 | `$8C:E115` | `animate_mode_once_freeze` | entity `+$12 \|= $0200` (ONCE_FREEZE) |
| 4 | `$8C:E11D` | `animate_mode_loop` | `+$12 \|= $0100`: `end_check` restarts the script (LOOP) |
| 6 | `$8C:E130` | `animate_mode_freeze` | `+$10 \|= $2000`, which gravity turns into `$0001` (FREEZE) |
| 8 | `$8C:E10C` | `animate_mode_clear_script_pointers` | words `+$01` and `+$03` = 0 (no compiler name; the Desert of Doom's skeleton ship, twice) |
| 10 | `$8C:E125` | `animate_mode_pause` | `+$10 \|= $0001`, hidden and paused (PAUSE) |

Odd values read misaligned words; values above 10 read the code after the table.
