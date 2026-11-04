---
addr: 8E9FE1
end: 8EA090
size: 176
kind: code
category: 🧠
name: shop_item_price_and_inventory_formatter
title: Vendor shop item pricing, inventory count, and currency dialogue text formatter
confidence: confirmed
tags: [shop, dialogue, format, text, price, currency]
evidence: ["disasm: 176 bytes at $8E:9FE1..$8E:A090; allocates CGRAM palette via $90:CEED ($0DF7), converts currency amount to decimal ASCII via $80:B21F, appends formatted string via $8C:9E03, jumps to $8E:A0DE"]
see: [rom/8e9fa8.md, rom/8ea091.md, rom/8ea0b3.md, rom/80b21f.md, rom/8c9e03.md]
---
Vendor shop item price tag and currency string formatter:
- Allocates an OAM icon palette slot via `palette_steal` (`$90:CEED`) and stores to `$0DF7`.
- Converts the selected item's buy/sell price into decimal ASCII characters using `format_32bit_integer_to_decimal_ascii` (`$80:B21F`).
- Appends the currency symbol and formatted price into the active shop window text stream via `dialogue_format_and_append_line` (`$8C:9E03`).
- Jumps directly to `$8E:A0DE` within the merchant dialogue session manager.

