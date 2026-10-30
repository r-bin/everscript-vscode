---
addr: 8FAB0B
size: 99
kind: code
category: 🧠
name: companion_pathfinding_breadcrumb_queue_pop
title: Pulls historical path breadcrumbs recorded by the Boy for dog companion navigation tracking
confidence: guess
tags: [unverified, rea-partial-read]
evidence: ["disasm: only the first ~20 instructions plus caller/callee names of the REA dossier were read (v0.387.7-12 batch); the purpose is inferred from those, not verified"]
---
Low confidence — Pulls historical path breadcrumbs recorded by the Boy for dog companion navigation tracking.

> Inferred from a partial read of the routine; names, purposes and variable roles below are hypotheses until the whole body is traced or tested.

Extracts navigation waypoints from the protagonist\'s historical movement trail.
The dog companion tracks the player by following a ring buffer of movement breadcrumbs stored in WRAM at `$3BFF,Y`.

The routine checks breadcrumb validity flag bit `$20`; if valid, it pops the next waypoint coordinates from queue index `X` and assigns them as the dog companion\'s navigation pursuit target.

## Callers
- `$8F:D1F6` (`func_8FD1F6`)

## Callees
- None

## Variables and memory (hypotheses)
- `$4E` (Companion entity record pointer)
- `$3BFF,Y` (Player movement breadcrumb ring buffer pointer)
- `$3C12,Y` (Breadcrumb buffer status flags)
