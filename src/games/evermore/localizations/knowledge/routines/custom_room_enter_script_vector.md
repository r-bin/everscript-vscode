---
addr: BC8000
size: 32768
end: BCFFFF
kind: script
category: 📜
name: custom_room_enter_script_vector
title: Test runner custom room enter script execution vector in Bank $BC
confidence: confirmed
tags: [emulator, script, test]
evidence: ["src/games/evermore/rooms/emulator-test.ts places custom enter-scripts at $BC:8000 for headless testing"]
---
Designated test script execution arena in Bank `$BC` (`$BC:8000–$BC:FFFF`). The custom room test runner injects and executes generated event scripts at this entry address during headless room simulation.