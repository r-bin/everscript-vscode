---
addr: CF6EC2
end: CF7192
size: 721
kind: data
category: 🧍
name: asset_cf6ec2_sprite_infos_chunk_lists
title: Sprite infos chunk lists ($CF:6EC2)
confidence: confirmed
tags: [asset, sprite, chunk, oam]
evidence: ["Game asset catalog: 721 bytes of sprite chunk descriptors [flags][x][y][block:16] bridging asset_cf015b and asset_cf7193 in Bank $CF"]
see: [routines/asset_cf015b_sprite_infos_chunk_lists.md, routines/asset_cf7193_sprite_infos_chunk_lists.md]
---
Sprite infos chunk list descriptors holding 721 bytes of 5-byte composite sprite chunk records `[flags][x][y][block:16]`. Defines multi-tile OAM layout definitions for world entities and NPC character frames in Bank `$CF`.
