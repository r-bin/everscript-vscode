---
addr: 7E2515
size: 2
kind: var
name: MARKET_TIMER_MINUTES_REMAINING
title: Nobilia Market countdown remaining minutes (15..1)
lifetime: room
confidence: confirmed
tags: [scripts, market, timer]
evidence: ["script: calculated in $92:CC6C from frame_counter_low() - MARKET_TIMER_START_FRAME ($2513)", "script: values 15 down to 1 assigned based on 3600-frame (1-minute) intervals", "script: copied to STRING_PARAMETER_2 in $96:811A to warn player in market dialogue", "script: tested in Room 8 (square) enter script ($95:E25F..$95:E2CE) to alter town crowd and ambient reactions"]
see: [ram/7e2513.md, rom/92cc6c.md, rom/96811a.md]
---
Number of minutes remaining (from 15 down to 1) before the Nobilia Market session expires and the Vigor event triggers.
Computed by routine `$92:CC6C`. Injected into market vendor warning dialogues (`$96:811A`) via `STRING_PARAMETER_2` to notify the player as time runs low, and tested by Room 8 (Nobilia square) scripts to change crowd NPC layouts and music tempo as the deadline approaches.

This is a volatile countdown indicator with zero persistence benefit; it belongs in `<0x2834>` (`temp[]`).
