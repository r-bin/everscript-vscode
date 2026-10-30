---
addr: 8CAFEB
size: 100
kind: code
category: 🧠
name: dialogue_window_arrow_cursor_draw
title: Renders the animated bouncing prompt arrow at the bottom of dialogue boxes awaiting button input
confidence: guess
tags: [unverified, rea-partial-read]
evidence: ["disasm: only the first ~20 instructions plus caller/callee names of the REA dossier were read (v0.387.7-12 batch); the purpose is inferred from those, not verified"]
---
Low confidence — Renders the animated bouncing prompt arrow at the bottom of dialogue boxes awaiting button input.

> Inferred from a partial read of the routine; names, purposes and variable roles below are hypotheses until the whole body is traced or tested.

Displays the animated down-pointing arrow cursor in dialogue text windows.
When typewriter text reaches a pause point or concludes a message, the routine computes corner coordinates of the dialogue window and writes the flashing prompt arrow sprite tile into OAM staging memory, signaling to the player that pressing the action button will advance the text.

## Callers
- `$8C:A7C6` (`dialogue_typewriter_step_and_button_wait`)
- `$8C:B05F` (`dialogue_bubble_pointer_tail_vram_stream`)
- `$8C:B2B4` (`dialogue_window_close_and_restore`)

## Callees
- None

## Variables and memory (hypotheses)
- `$22`, `$24` (Dialogue window boundary coordinates)
- `$26` (OAM staging offset for prompt arrow sprite)
