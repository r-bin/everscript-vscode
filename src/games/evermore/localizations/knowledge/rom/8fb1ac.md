---
addr: 8FB1AC
end: 8FB229
kind: code
category: ⚔️
name: combat_hitbox_tables_and_collision_init
title: Combat entity hitbox tables and collision grid reset
confidence: likely
tags: [combat, hitbox, collision, tables, reset]
evidence: ["disasm: called by gameplay_session_subsystems_init ($80:8CC9); clears active combat projectile slot $1074; calls $90:D7CB and $90:DC21; marks entity hitbox bounds $3BC9,X = $FFFF and $3C14,X = $0000 across all combat slots (REA dossier 0x8fb1ac)"]
---
Initializes and clears active combat collision structures, resetting entity hitbox bounding boxes, projectile slots, and attack registration arrays.
