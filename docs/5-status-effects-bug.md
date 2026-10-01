# Secret of Evermore — the "5 status effects" bug

Fix: `everscript/patches/five_status_effects_fix.asm`. Everything below was read
straight out of the vanilla ROM (`Secret of Evermore (U) [!]`, unheadered HiROM).

## Symptom

Cast 4 buffs, then cast a 5th: one of the old buffs disappears from the status
slots, but its bonus stays on the character forever, its outline glow keeps
cycling forever, and there is no "… has worn off" message. Repeat it to stack the
bonus without limit.

## Status slots

Each entity has 4 slots of 6 bytes, starting at `+$46`:

| Slot | id | timer | param (boost) |
|---|---|---|---|
| 1 | `+$46` | `+$48` | `+$4A` |
| 2 | `+$4C` | `+$4E` | `+$50` |
| 3 | `+$52` | `+$54` | `+$56` |
| 4 | `+$58` | `+$5A` | `+$5C` |

`$FFFF` = empty. Bit 15 of the id marks the most recently applied status.

## Handler table `$91AE31` (8 bytes per status, index = status id)

| +0 | +2 | +4 | +6 |
|---|---|---|---|
| tick handler | cleanup handler | outline bit (`$9A,X`) | 1 = buff, 2 = ailment |

`$00` Atlas, `$08` Barrier, `$10` Defend, `$18` Reflect, `$20` Speed … `$50` are
buffs; `$58`+ are ailments.

## Calling contract (tick → cleanup)

The per-frame tick (`$91BC28`: `JMP ($AE31,X)`) runs with `Y` = entity,
`$60`/`$62` = the slot's timer/param pointers, `X` = status id, `DB` = `$7E`. When
the timer runs out the tick handler falls into its own cleanup handler, which:

1. if `$15D2 == 0`, shows "*Atlas has worn off*" (`JSL $8CC521`); `$FFFF` = silent
2. reverts its bonus (Atlas: `SBC ($62)` from `$A0,X`; Defend: clears a bit in `$14,Y`, …)
3. `CLC : JSL $91B9A7` with `X` = its own id → finds that id's slot, writes `$FFFF`,
   zeroes timer/param, and (via `$91BB01`) clears the outline bit with `JSL $90C9B2`
4. Atlas also recalculates stats (`JSL $8F8398`)

`$91B9A7` uses `$02` and `$12` as scratch.

## Apply `$91B632` and the bug at `$91B7FA`

Apply (`X` = new id, stored in `$02`) picks a slot in this order:

1. a slot that already holds the **same** id → refresh
2. an empty slot
3. the first slot holding a **buff that is not the most recent** → eviction
4. otherwise the cast fails

Refresh and eviction both go through `$91B7FA`, which runs the slot's cleanup
silently before the new status is written:

```
91B7FA  STA $60          ; timer pointer of the slot
        INC : INC
        STA $62          ; param pointer of the slot
        LDX $02          ; <-- BUG: the NEW status id, not the id in the slot
        PHY : PHX
        LDA #$FFFF : STA $15D2   ; silent
        JSR ($AE33,X)    ; cleanup handler
        STZ $15D2
        PLX : PLY : STX $02
        RTS
```

For a refresh the two ids are equal, so it works. For an eviction it runs the
**new** status's cleanup. The evicted status is overwritten without reverting its
bonus or clearing its outline bit, which is exactly the symptom.

## The fix

Load the id that is actually in the slot and run **its** cleanup, the same routine
a natural expiry runs. The bonus, slot, outline and message are then handled by
vanilla code. Announce evictions (`$15D2 = 0`), but keep refreshes silent
(`$15D2 = $FFFF`) as vanilla does. Save and restore `$02` around the call because
`$91B9A7` overwrites it.

The routine still fits in the original 27 bytes. A 4-byte `JSL` to extension
space computes `X` and `$15D2`. The `JSR ($AE33,X)` must stay in bank `$91`
because the table read and the handler addresses are bank-relative.

## Traps from earlier attempts

- `LDA $FFFC,X` with `DB = $7E` reads bank **`$7F`** (indexed addressing crosses
  the bank). Compute the slot address and use `LDA $0000,X` instead.
- No custom outline or palette code is needed. `$90C9B2` already restores the
  palette when the last outline bit goes away. Earlier glows lingered because the
  evicted status's bit was never cleared.
- The older "scan all slots after apply and clean up anything missing" approach
  fixes stats but cannot show the message, because it doesn't know what was
  evicted.

## Not fixed: a separate vanilla oddity

`$91BB27` (clear all statuses) sets `$60`/`$62` to **slot 1's** pointers for all
four slots. Clearing slots 2–4 that way reverts the bonus stored in slot 1.
