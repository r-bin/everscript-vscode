---
addr: 8CC6CB
size: 449
end: 8CC88B
kind: code
category: ⚙️
name: field_transient_effects_and_particles_oam_render
title: Field transient visual effects and particle sprites OAM render
confidence: verified
tags: [field, oam, sprites, particles, effects, reconstructed-c, g1-pass]
evidence: "[\"disasm: called by per_frame_field_tick ($8E:E41E); iterates transient particle effect slots; copies position and attribute data into OAM buffers via $80:9033 (Direct_sprite_draw_OAM_809033); tests animation active mask $0B79 bit 0 (REA dossier 0x8cc6cb)\"]; G1 pass (34/34 reference states, 544/544 fuzzed states, mutation caught)"
---
Draws temporary field visual effects, spell sparks, and damage impact particle sprites directly into the OAM buffer each frame.
