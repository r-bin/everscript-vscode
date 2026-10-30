# math_vector_scale_and_hardware_division

Clamps scalar factors and computes signed vector division via SNES hardware division registers.

## Metadata
- **Address:** `$90:DFDF`
- **Type:** `routine`
- **Bank:** `$90`
- **Size:** 148 bytes

## Functionality
Mathematical scaling primitive used in physics, homing trajectories, and camera zoom.
The routine clamps the divisor scale factor between 4 and 1023 (`#$03FF`).

It feeds 16-bit signed displacement `$02` into SNES hardware dividend register `$4204` and divisor `$12` into `$4206`, waiting the requisite hardware cycles before returning the scaled 16-bit quotient in the Accumulator.

## Callers
- `$90:DDCA` (`func_90DDCA`)

## Callees
- None

## Variables and Memory
- `$02` (Input signed 16-bit displacement vector)
- `$12` (Clamped scaling divisor)
- `$4204` (Hardware 16-bit dividend register)
- `$4206` (Hardware 8-bit divisor register)
