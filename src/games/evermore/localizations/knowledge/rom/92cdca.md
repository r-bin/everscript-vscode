---
addr: 92CDCA
kind: script
name: market_dialogue_print_commodity_name
title: Market vendor dialogue: print commodity item name by ID
confidence: confirmed
tags: [scripts, market, dialogue]
evidence: ["script: branches on MARKET_ITEM_ID ($7E:2463) values 0 to 0x21, outputting text keys 0x03B4, 0x03B7, ..., 0x0417", "script: called by $92:CDB3 and $92:CDBE to inject localized commodity names into trading messages"]
see: [ram/7e2463.md, rom/92cdb3.md, rom/92cdbe.md]
---
Helper script that inspects `MARKET_ITEM_ID` (`$7E:2463`) and emits the localized text key corresponding to the commodity (e.g. pots, beads, rice, spice, perfume, golden jackal, jeweled scarab, etc.), returning control to the parent market message printer.

