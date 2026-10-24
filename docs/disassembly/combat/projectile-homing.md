# `$8F:BA27` Is Not Projectile Homing

The requested address is inside the melee hit-roll routine that starts at `$8F:BA06`. `$8F:B75A` calls `$8F:BA06`; execution then falls through `$8F:BA27` and returns at `$8F:BAAE`. The clean-ROM disassembly at `soe://bus/8fba06.asm`, `soe://bus/8fba27.asm`, `soe://bus/8fba59.asm`, and `soe://bus/8fbaa4.asm` shows no projectile position, velocity, steering, or projectile-immunity test in this range. The name of this document is retained as requested; the routine is a melee hit-chance roll, not homing code.

The reconstruction is [`reconstructed-c/8F/8FBA06_melee_hit_chance.c`](../../../reconstructed-c/8F/8FBA06_melee_hit_chance.c). Knowledge records: [`8fba06`](../../../src/games/evermore/localizations/knowledge/rom/8fba06.md) and [`8fbaaf`](../../../src/games/evermore/localizations/knowledge/rom/8fbaaf.md).

## Control Flow

- `$8F:BA06` sets bit `$0010` in the entity at direct-page `$4C`, clears bit `$0200` at that entity's `+$14`, writes the `$4C` entity pointer to the entity at `Y + $36`, and writes `$0014` at `Y + $38`.
- `$8F:BA24` loads the target entity's character-record pointer from `Y + $60`. `$8F:BA27` uses that record's evade word (`+$1F`) to index the 16-word pointer table at `$8F:BAAF`.
- `$8F:BA37` loads the attacker record through the entity pointer at `$4C`. One branch compares `(Y XOR $01BE)` with word `$0F42`; if equal and the attacker record's `+$07` has bit `$0002`, the hit rate follows the `$FFE2 + SEC + hit_rate` path. For percentage inputs this is `hit_rate - 29`, 30 below the ordinary `hit_rate + 1` path.
- Otherwise the routine uses `hit_rate + 1`. A later branch subtracts 10 when the attacker record pointer is neither `$0A26` nor `$0A70` and word `$2262` has bit `$0020` set. The adjusted value is clamped to 0–100 and rounded down to a multiple of four.
- `$8F:BA8F` loads the threshold from the selected row and column. Zero goes directly to the miss tail. Otherwise `$8F:BA97` calls `$80:859B`, masks the result with `$7FFF`, and succeeds only when the masked value is strictly less than the threshold.
- Success returns with carry set at `$8F:BAA3`. A miss reaches `$8F:BAA4`, ORs `$0040` into the word at `Y + $12`, and returns with carry clear at `$8F:BAAE`. The meaning of that bit is not established here.

## Limits From the Instructions

- The pointer-table byte offset is `((evade + 1) >> 1) & $FFFE`, equivalent to row index `(evade + 1) >> 2` for ordinary values. The 16 pointers cover evade values 0–62; there is no bounds check, so evade 63 and higher can index beyond the pointer table. Vanilla character records are documented with evade no higher than 50.
- The hit-rate column is selected after the routine's branch-specific adjustments, the 0–100 clamp, and four-point quantization. The table has 26 word columns, representing 0 through 100.
- The RNG sample is in 0–`$7FFF`. Threshold zero always misses. The comparison is strict: `$7FFF` still misses for sample `$7FFF`; a threshold of `$8000` or greater would always hit under this mask. This documents the comparison only; it does not assert which thresholds occur in the table.
- The adjustments above describe the observed 16-bit instruction path. No additional projectile-specific behavior or meaning for the `$2262` gate or target `+$12` bit is inferred.