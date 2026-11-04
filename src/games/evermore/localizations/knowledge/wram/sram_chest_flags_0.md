---
addr: 7E2517
size: 16
kind: table
name: sram_chest_flags_0
title: Persistent treasure chest and gourd collection bitmask array
lifetime: save
confidence: confirmed
tags: [save, sram, gourds, chests]
evidence: ["disasm: func_CCD804 and script VM opcodes test and set bits in $7E:2517..$7E:252F on opening gourds", "disasm: sram_verify_all_save_slots ($8D:C905) serializes this array to Cartridge SRAM Bank $30"]
see: [knowledge/wram/ALCHEMY_KNOWN_FLAGS.md]
---
Persistent 128-bit collection bitmask array (`$7E:2517`..`$7E:252F`, 8 words = 16 bytes) recording opened treasure gourds and chests throughout the campaign.

Each bit corresponds to a distinct map chest flag. When the player opens a gourd, the room script sets the corresponding bit. Packed directly into battery-backed Cartridge SRAM upon saving at inns or energy monuments.
