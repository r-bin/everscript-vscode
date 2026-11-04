---
addr: 8D9F35
end: 8D9FB1
size: 125
kind: data
category: 📋
name: str_ui_control_preferences_menu
title: Controller preferences and sound configuration menu UI text strings
confidence: confirmed
tags: [ui, text, strings, options, menu, controller]
evidence: ["disasm: 125 bytes at $8D:9F35..$8D:9FB1; contains null-terminated UI strings: 'Control Prefs', 'Configuration 1', 'Configuration 2', and 'Press UP or DOWN to change configurations.  Press SELECT to change sound mode.'"]
see: [rom/8e95a6.md, rom/8d8000.md]
---
In-game options and controller configuration menu UI text strings:
- `"Control Prefs"`
- `"Configuration 1"`
- `"Configuration 2"`
- `"Press UP or DOWN to change configurations.  Press SELECT to change sound mode."`
Rendered by the options screen to configure joypad button mappings and toggle stereo/mono audio output.
