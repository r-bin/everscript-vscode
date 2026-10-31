---
addr: 8CAAFA
kind: code
category: 🎮
name: dialogue_window_find_text_wrap_breakpoint
title: Scan line wrap breakpoint table for dialogue text formatting ($8C:AAFA)
confidence: confirmed
evidence: ["disasm: increments line length target in <$12; scans line wrap width table $7E:2000,X until finding width >= target; returns breakpoint index in X; callers: text layout $8C:9E03, $8C:A3AF"]
see: ["rom/8c9e03.md","rom/8ca3af.md"]
tags: ["dialogue","font","text","wrap"]
---
Dialogue text line wrap locator. Increments line length target in `<$12`. Scans line break/width table at `$7E:2000,X` until entry >= target length is found, returning the split index in X.
