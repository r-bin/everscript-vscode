---
addr: 92CDBE
kind: script
name: market_dialogue_received_item
title: Market vendor dialogue: trade successful / item received
confidence: confirmed
tags: [scripts, market, dialogue]
evidence: ["script: disassembles to currency_window_close(); text(0x03ae); call $92:CDCA; text(0x03b1); return;", "script: called by 23 market stall triggers in Room 10 (Nobilia) and Room 123 (Ivor Tower)", "script: text(0x03ae) prints prefix 'You received ', $92:CDCA prints item name, 0x03b1 prints '!'"]
see: [ram/7e2463.md, rom/92cdb3.md, rom/92cdca.md]
---
Shared dialogue routine called by market stall scripts in Nobilia (Room 10) and Ivor Tower (Room 123) upon completing a trade transaction.
Closes the currency window, outputs message prefix `0x03AE` ("You received "), delegates to `$92:CDCA` to print the commodity name staged in `MARKET_ITEM_ID` (`$7E:2463`), and closes with punctuation `0x03B1` ("!").

