# Bounded Random Value ($80:AD62)

- **ROM address:** `$80:AD62` (`random_below`)
- **Input:** upper bound `n` in DP `$02`
- **Output:** `floor(rand16 * n / 65536)` in A
- **PRNG:** `$80:859B`; it is advanced before the zero-bound check
- **Host model:** [`8080AD62_random_below.c`](../../../reconstructed-c/80/8080AD62_random_below.c)

The routine obtains a 16-bit value from `$80:859B`, then uses the SNES 8-by-8 multiplier
(`$4202/$4203`) to form the upper word of the 16-by-16 product with `n`. The assembly handles
the high and low bytes separately, accumulating partial products and carry into DP `$0A`..`$0D`.
When `n` is zero, it still advances the PRNG and returns zero. Otherwise, the returned value is
in the range `0..n-1`.

The physical damage routine at `$8F:C08C` calls this helper with `n = base + 1`, producing a
damage roll in `0..base`. The relevant caller sequence is in
[`to-hit-accuracy.md`](to-hit-accuracy.md); the address-level knowledge entry is
[`80ad62.md`](../../../src/games/evermore/localizations/knowledge/rom/80ad62.md).