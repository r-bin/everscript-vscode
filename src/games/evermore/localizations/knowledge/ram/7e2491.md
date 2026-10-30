---
addr: 7E2491
size: 2
kind: var
name: QUICKSAND_TRIGGER_OBJECT_INDEX
title: Quicksand Field trigger object index
lifetime: unknown
confidence: confirmed
tags: [map.quicksand_field_desert, object, script]
evidence: ["write: Room 0x59 step-on triggers copy a staged signed object index into <0x2491> before calling trigger-specific helpers", "read: $93:A524 uses signed <0x2491> in a wait duration and as the index of the object set to INSTANT before starting $93:A865 and playing MAGMA_HARDENING"]
see: [docs/scripts/unnamed-memory-audit.md]
---
Holds a signed object index staged by a Quicksand Field step-on trigger. Trigger scripts copy the selected index here before calling their helper sequence; the shared handler at `$93:A524` also uses it in a wait duration and sets the indexed object to `INSTANT` before starting the falling sequence. The script evidence establishes the cell's role, but not how long it survives or how it is cleared.