# Script Opcode 0xB6: Start a Palette Cycle

**Handler entry:** `$8C:E85D`\
**Palette loader:** `$8C:E899`\
**Cycle initializer:** `$90:D50F`\
**Opcode table entry:** `$8C:EA29`\
**Operands:** palette, first colour, last colour, speed expressions\
**Confidence:** evaluation order, range arithmetic, helper calls, and continuation confirmed

## Control Flow

The handler evaluates the palette expression and calls `$8C:E899` immediately. That
helper returns without loading a source palette for values below 8. The handler then
evaluates first colour, last colour, and speed, stages cycle parameters, and calls
`$90:D50F` regardless of the palette loader's early return. Finally it sets carry and
returns, so the script continues in the same turn.

The staged values are palette index shifted left once in DP `$02`, first colour in
`$04`, inclusive colour count (`last - first + 1`) in `$06`, and speed in `$08`. The
cycle helper's speed direction and record layout are outside this handler reconstruction.

## Model

[`reconstructed-c/8C/8CE85D_opcode_b6_palette_cycle.c`](../../../reconstructed-c/8C/8CE85D_opcode_b6_palette_cycle.c)
preserves the expression/helper order and passes the staged parameters through opaque
host-side helper interfaces.

## Evidence

- `$8C:E85D` evaluates the palette and calls `$8C:E899` before evaluating the remaining
  operands.
- `$8C:E874` stores speed; `$8C:E878` subtracts the first-colour stack value from the
  last and `$8C:E87A` adds one for the inclusive count.
- `$8C:E87E` stores first colour; `$8C:E881` shifts palette left once into DP `$02`.
- `$8C:E884` calls `$90:D50F`; `$8C:E888` sets carry before returning.
- `$8C:E899` computes palette minus 8 and returns early for palettes below 8; otherwise
  it loads the palette source using `$23CB` and `$90:CF3A`.