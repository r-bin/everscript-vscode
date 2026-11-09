---
addr: 8FAB92
end: 8FABEC
size: 91
kind: code
category: 🧠
name: companion_idle_sniff_and_scratch_random_dice_roll
title: Directional steering and wander heading updater with RNG decimation
confidence: verified
tags: [reconstructed-c, g1-pass]
evidence: ["reconstructed-c/8F/8FAB92_companion_idle_sniff_and_scratch_random_dice_roll.c passes Gate G1 (31/31 reference states, 492/492 fuzzed, mutation caught)"]
---
Directional steering and wander heading updater with RNG decimation.

Updates companion/entity heading and directional wandering:
1. Reads active entity slot offset from direct page `$4C` into `Y`.
2. Inspects animation/movement sub-frame counter `+$0E,Y` (`AND #$001F`). If non-zero, skips the random roll cycle and branches to `check_state_branch` ($ABBE).
3. Every 32 frames (counter & 0x1F == 0): decimates the shift-register RNG countdown word `$0E94` right by 1 bit (`LSR $0E94`). If `$0E94` underflows to 0, it invokes the PRNG `$80:859B`, rotates the 16-bit random result right through a set carry flag (`SEC; ROR A`), and re-seeds `$0E94`.
4. If the carry bit shifted out of `$0E94` is 0 (carry clear), branches to `check_state_branch` ($ABBE).
5. If carry is 1: inspects entity status flag `+$16,Y & #$0004`:
   - If set: invokes `calc_8way_direction_with_random_jitter` ($8F:AB6E) and directly commits the direction into heading field `+$22,Y`.
   - If clear: invokes `calc_8way_direction_with_random_jitter` ($8F:AB6E), temporarily saves the suggested heading in direct page `$12`, and evaluates angular difference `(suggested - current + 1) & 0x0E`. If the angular step is >= 3 (a non-trivial turn), updates heading `+$22,Y = suggested`; otherwise retains the existing heading (smooth steering damping).
6. `check_state_branch` ($ABBE):
   - If status flag `+$16,Y & #$0004` is clear, clears target tracking slot `+$64,Y = 0`.
   - If set, inspects system mode flag `$0EB8 & #$0001`; if set, clears `+$64,Y = 0`, else leaves it unchanged.

## Callers
- `$8F:9C24` (`companion_waypoint_prune_and_steer`)
- `$8F:DA6D` (`ai_approach`)

## Callees
- `$80:859B` (`random_number_generator`)
- `$8F:AB6E` (`calc_8way_direction_with_random_jitter`)

## Variables and memory
- `$4C` (Direct page active entity pointer)
- `+$0E,Y` (Movement / animation sub-frame counter)
- `+$16,Y` (Entity state & AI mode control flags)
- `+$22,Y` (Current 8-way facing direction: 0=N, 2=NE, 4=E, 6=SE, 8=S, 10=SW, 12=W, 14=NW)
- `+$64,Y` (Target tracking waypoint / interaction state)
- `$0E94` (RNG decimation shift register for steering noise)
- `$0EB8` (Global companion / party state flags)
