---
addr: 7E22EA
size: 1
kind: flags
name: GAMEPLAY_FLAGS_22EA
title: Shared loot, room-load, and render flags
lifetime: unknown
confidence: confirmed
tags: [loot, room, system, flags]
evidence: ["disasm: global 0x3e clears bit 0 and sets it only when the pickup is counted in; the pickup driver also clears it for the dog's fake pickup (rom/92a584.md, rom/92a482.md)", "disasm: room-entry pre-roll waits until bits 3, 4, and 5 are all set; the documented meanings are map/collision ready, characters positioned, and palette ready (rom/8ee508.md; docs/disassembly/maps/room-spawn-align.md)", "disasm: opcodes 0x82 and 0x83 read bit 7 and copy it to $7E:0B29 bit 0 (rom/8ce20f.md, rom/8ce247.md)", "evs: rooms 0x31 and 0x61 manipulate bits 3, 4, and 5; global 0x56 checks bit 5 as an outro hold-cancel flag (docs/scripts/unnamed-memory-audit.md; rom/92cf84.md)", "disasm: cold-start code sets bit 2; exact lifetime and all readers are not established (docs/disassembly/engine-core/main-loop.md)"]
see: [docs/disassembly/engine-core/shared-flags-22ea-22eb.md, docs/scripts/unnamed-memory-audit.md, rom/808b66.md, rom/92a482.md, rom/92a584.md, rom/8ee508.md, rom/8ce20f.md, rom/8ce247.md]
---
`$7E:22EA` is a shared one-byte flag field, not a single-purpose loot byte or room-load enum. Its bits are read and written by the pickup driver, room-entry synchronization, intro/outro scripts, and screen-layer opcodes. Lifetime is recorded as unknown because these uses mix persistent gameplay state and transient engine handshakes.

## Bits
| bit | meaning |
|---|---|
| `0x01` | Last pickup counted in successfully. Global `0x3E` clears it before attempting the reward and sets it only when the item was added. The gourd driver also clears it when the Dog performs a fake pickup. |
| `0x02` | No meaning established. |
| `0x04` | Set by the cold-start/SRAM initialization path. Its complete lifetime and all readers are not established. |
| `0x08` | Room-entry readiness: map metatiles and collision data are ready. Also explicitly set by the Podunk intro scripts in rooms `0x31` and `0x61`. |
| `0x10` | Room-entry readiness: character records/positions are ready. Also used by the Podunk intro/showcase scripts. |
| `0x20` | Room-entry palette readiness. Also used by the Podunk intro/showcase scripts and checked by global `0x56` to cut an outro hold short. |
| `0x40` | No Secret of Evermore meaning confirmed for this audit. An older external-core label associated it with a Boy flower-death screen; that label is not treated as verified here. |
| `0x80` | Screen-layer override latch: opcodes `0x82` and `0x83` copy this bit into `$7E:0B29` bit 0 after writing the PPU layer/color-math registers. |

## Notes
Some handlers use 16-bit accumulator operations at `$7E:22EA`; the masks they apply to this field are confined to its low byte and preserve the adjacent `$7E:22EB` byte. See the linked decomp note for the access paths and caveats.
