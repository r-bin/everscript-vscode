---
addr: 7E0CD9
size: 2
kind: var
name: RING_CALL_BEAD_CALLERS_COUNT
title: Item count of the Call Bead callers ring
type: u16
lifetime: room
confidence: confirmed
tags: ["ring-menu"]
evidence: ["disasm v0.455.0: RING_BUFFERS ($8E:9920) holds $0CD9; ring loops read +0 count, +2 cursor, +4 items through DP $95"]
see: ["docs/open-evermore/resources.md"]
---
How many items the Call Bead callers ring holds (0: the flow skips the ring). Filled by `call_bead_callers`.

Previously believed: "Total active shopkeeper dialogue interaction options in merchant choice menu" (SHOP_MENU_OPTION_COUNT).
