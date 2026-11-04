---
addr: C460AB
end: C4781C
size: 6002
kind: table
category: 📜
name: tbl_weapon_item_lore_descriptions
title: Master weapon, item, currency, and lore string database
confidence: confirmed
tags: [item, weapon, strings, lore, currency, database]
evidence: ["binary data: null-terminated ASCII strings for 4 currencies ('talons', 'jewels', 'gold pieces', 'credits'), all weapons ('Gladiator Sword', 'Crusader Sword', 'Neutron Blade', 'Bone Crusher'...), armor, and item lore descriptions (out/recomp/asar/rom.bin:0x0460AB)"]
see: [src/games/evermore/localizations/knowledge/routines/tbl_item_icon_sprite_pointers.md]
---
Master uncompressed string database for in-game currencies, weapons, armor, and inventory lore:
- Contains null-terminated ASCII strings for all four regional currencies: Prehistoria (talons), Antiqua (jewels), Gothica (gold pieces), and Omnitopia (credits).
- Holds full display names for all weapons across sword, axe, spear, and bazooka categories.
- Includes descriptive flavor text and item lore strings displayed on the ring menu weapon and item inspect screens (e.g. *"The Femur of Fury. Useful for mangling mosquitos."*).
- Directly indexed by item archetype ID through the Bank `$8E` shop and inventory systems.
