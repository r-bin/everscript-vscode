---
addr: 8E99CA
size: 2
end: 8E99CB
kind: table
category: 📋
name: CALL_BEAD_CALLER_ACTIONS
title: Call Bead caller → the routine that builds its spells ring
confidence: confirmed
tags: ["ring-menu","table"]
evidence: ["disasm v0.455.0: $8E:990E jsr ($99CA,x), X = the caller item's index (+6)"]
see: ["docs/open-evermore/resources.md"]
---
4 words: Fire Eyes, Horace, Camellia, Sidney; each routine fills `RING_CALL_BEAD_SPELLS` with that caller's spells. Open Evermore: `menus/caller_actions/`.

Previously believed: "CDL pointer table ($8E:99CA)" (ptrs_8E99CA).
