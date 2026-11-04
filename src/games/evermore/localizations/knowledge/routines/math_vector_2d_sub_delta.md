---
addr: 80AD54
end: 80AD61
size: 14
kind: code
category: 🧠
name: math_vector_2d_sub_delta
title: Compute 2D coordinate delta vector by subtracting point 2 from point 1
confidence: confirmed
tags: [math, vector, delta, coordinates]
evidence: ["disasm: LDA $02; SEC; SBC $06; STA $0A; LDA $04; SEC; SBC $08; STA $0C; RTL at $80:AD54..$80:AD61"]
see: [routines/trig_sine_fixed_point_scale.md, routines/random_below.md, routines/face_8.md]
---
Core 2D vector delta subtractor. Computes displacement vector `(dx, dy)` between Point 1 `(x1, y1)` at direct page `$02, $04` and Point 2 `(x2, y2)` at direct page `$06, $08`:
- `dx = x1 - x2` stored to `$0A`
- `dy = y1 - y2` stored to `$0C`
Directly feeds distance calculations and direction resolver `face_8` (`$80:ADF0`).
