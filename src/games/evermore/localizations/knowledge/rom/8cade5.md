---
addr: 8CADE5
end: 8CAF21
kind: code
category: 📜
name: cutscene_camera_zoom_and_dialog_anchor_step
title: Cutscene camera zoom and dialogue anchor step using Mode 7 matrix
confidence: likely
tags: [cutscene, camera, mode7, dialogue, ppu]
evidence: ["disasm: called by $8C:C4F6 (cutscene_dialogue_queue_reset), $8C:C543 (cutscene_pause_activate), and $8E:A0B3 (shopkeeper_dialogue_window_init); writes scaling factors to Mode 7 matrix registers $211B and $211C; anchors speech box above entity position ($14,Y / $16,Y / $1C,Y); synchronizes with VBlank via $80:858C (REA dossier 0x8cade5)"]
---
Adjusts camera zoom and anchors dialogue speech bubble windows above the talking entity using Mode 7 hardware matrix registers $211B and $211C during cutscenes and merchant interactions.
