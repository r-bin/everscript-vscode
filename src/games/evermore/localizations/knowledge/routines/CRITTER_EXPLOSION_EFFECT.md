---
addr: 96B07E
end: 96B09D
size: 32
kind: sub
name: CRITTER_EXPLOSION_EFFECT
title: Exploding critter visual effect and party knockback
confidence: confirmed
tags: [animation, combat, fx]
evidence: ["scripts: Room 10 trigger 0x168 ($96:b124, $96:b153, $96:b16a) calls $96:b07e; sets active.velocity = 0x28, deals damage hp - 1, spawns PLACEHOLDER above entity with EXPLOSION_3 animation and screenshake"]
see: [knowledge/wram/PEDDLER_SPEECH_VARIATION.md, knowledge/wram/DIALOGUE_STRING_PARAM_REGISTERS.md]
---
Visual and mechanical effect routine executed when the player repeatedly bothers the secret exploding critter at the entrance of Nobilia Market (Room 10, trigger 0x168).

Launches the active entity vertically with velocity `0x28`, knocks health down to 1 HP (`damage(active(), active.hp - 1)`), shakes the screen, and spawns the `EXPLOSION_3` animation.
