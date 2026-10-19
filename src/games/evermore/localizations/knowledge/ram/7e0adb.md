---
addr: 7E0ADB
size: 1
kind: var
name: CURRENT_MAP_ID
title: Room (map) id of the room being played
lifetime: room
confidence: confirmed
tags: [room, map]
evidence: ["read: the emulator panel overlay keys the room's triggers on it (src/core/emulator/panel-webview.ts)", "trace: headless recomp runs walking out of the huts read 0x51 -> 0x25 (Fire Eyes' Village) -> 0x38 (South jungle), matching the destination rooms (v0.201.18)"]
see: [src/games/evermore/localizations/knowledge/ram/7e0f86.md]
---
Index into the room table at `$9FFDE7` (4 bytes per room) for the room currently loaded.
Reads `0x61` during the intro and the title menus.
