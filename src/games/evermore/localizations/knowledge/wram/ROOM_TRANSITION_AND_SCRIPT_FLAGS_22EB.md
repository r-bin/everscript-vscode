---
addr: 7E22EB
size: 1
kind: flags
name: ROOM_TRANSITION_AND_SCRIPT_FLAGS_22EB
title: Shared room-transition and script flags
lifetime: unknown
confidence: likely
tags: [room, room-change, script, flags]
evidence: ["disasm: main-loop reload path tests bit 2, fades, reloads the ROM's default starting room, and enters it; after room entry, the path clears bit 2 if it remains set (docs/disassembly/engine-core/main-loop.md)", "disasm: $80:8C96 sets bit 1; another apparent write at $80:8BA2 is in a block skipped by the visible branches, so its runtime reachability is unconfirmed", "disasm: reset_per_room_state performs a 16-bit AND with 0xFFFE at $7E:22EB, clearing bit 0 while preserving the other bits and adjacent $7E:22EC", "script: room scripts use bits 0, 4, 6, and 7 for local gates; bit 4 is handed from rooms 0x5B/0x67 into 0x59, and bit 6 is set before door transitions and consumed by destination enter scripts (docs/scripts/unnamed-memory-audit.md)", "script: globals 0x27 and 0x2E set bit 5 as part of their exit sequences (rom/929fa0.md, rom/92a010.md)"]
see: [docs/disassembly/engine-core/shared-flags-22ea-22eb.md, docs/scripts/unnamed-memory-audit.md, docs/disassembly/engine-core/main-loop.md, rom/808b66.md, rom/929fa0.md, rom/92a010.md, rom/908e90.md]
---
`$7E:22EB` is a shared one-byte flag field used by the main loop, per-room reset code, room scripts, and transition globals. It is not exclusively a room-change request: different bits carry engine-control, room-routing, and doorway state. Its overall lifetime is unknown because some bits are consumed locally while others deliberately cross a room transition.

## Bits
| bit | meaning |
|---|---|
| `0x01` | Room-script latch used and cleared by scripts in rooms `0x02` and `0x77`; its event meaning is unresolved. The per-room reset routine also clears this bit. |
| `0x02` | Set at `$80:8C96` on a post-room-entry branch; meaning is unresolved. A second apparent write at `$80:8BA2` is in a block skipped by the visible control-flow branches, so that site's runtime reachability is unconfirmed. |
| `0x04` | Main-loop reload request. `$80:8BF1` tests it and branches to `$80:8C70`, which fades out, reloads the ROM's default starting room ID, and enters that room. After room entry, the path tests the bit again and clears it only if it remains set. The writer and intended trigger are unresolved; this is not the ordinary script `load_map` path. |
| `0x08` | No meaning established. |
| `0x10` | Quicksand Field route handoff. Rooms `0x5B` and `0x67` set it before entering room `0x59`; room `0x59` clears it when leaving by its east/south exits. |
| `0x20` | Set by global exit scripts `0x27` and `0x2E` before their fade/walk/wait sequence. Its consumer and clearing path are unresolved. |
| `0x40` | Doorway-arrival latch. Several exits set it before loading another room; destination enter scripts test it and, in documented cases, clear it after handling the arrival. |
| `0x80` | Read by a timed B-trigger in room `0x0A` as a gate. The matching writer and exact purpose are unresolved. |

## Notes
The reset routine reads and writes a 16-bit word starting at `$7E:22EB`, but applies `AND #$FFFE`: only bit 0 of `$22EB` is cleared, while the other bits and `$22EC` are preserved. The bytes are adjacent, but script-visible flags at `$22EB` are byte-wide. See the linked decomp note for instruction-level behavior and representative room uses.