---
addr: 7E2545
size: 2
kind: var
name: DIALOGUE_SELECTION
title: Player selection choice index from message box menu
lifetime: room
confidence: confirmed
tags: [scripts, dialogue, menu]
evidence: ["script: written by opcode lookup_034d(0) in 36 instances across 6 rooms (R4, R54, R57, R58 fire pits; R70, R84 Omnitopia)", "script: tested immediately after text_end() to branch on player's chosen destination or option", "script: tested against 0 (cancel/exit), 1, 2, 3, or 0xFFFF"]
see: [ram/7e2463.md]
---
Player choice selection index returned from an interactive message box menu via `lookup_034d(0)`.
Used extensively at Windwalker landing sites (fire pits in Antiqua, Prehistoria, and Gothica) and Omnitopia transport/flight terminals to receive the player's selected flight destination or menu choice.

This is a transient dialogue response variable with zero persistence benefit; it belongs in `<0x2834>` (`temp[]`).

