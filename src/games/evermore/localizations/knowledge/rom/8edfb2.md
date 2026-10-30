# entity_linear_interpolation_fixed_point_multiply

Computes fixed-point linear interpolation between entity coordinate endpoints via hardware multiplication.

## Metadata
- **Address:** `$8E:DFB2`
- **Type:** `routine`
- **Bank:** `$8E`
- **Size:** 217 bytes

## Functionality
Mathematical utility for smooth entity position interpolation (LERP) during cutscenes and scripted transitions.
The routine computes displacement `$10,X` by subtracting initial position `$06,X` from destination `$0C,X`.

It multiplies displacement with interpolation progress ratio `$00,X` using SNES hardware multiplier `$4202`, outputting the interpolated coordinate step into entity record variable `$0E,X`.

## Callers
- `$91:9823` (`func_919823`)

## Callees
- None

## Variables and Memory
- `$06,X` (Starting coordinate of interpolation path)
- `$0C,X` (Target coordinate of interpolation path)
- `$00,X` (Progress step multiplier)
- `$10,X` (Displacement delta vector)
- `$0E,X` (Resultant interpolated intermediate position)
- `$4202` (Hardware multiplier register)
