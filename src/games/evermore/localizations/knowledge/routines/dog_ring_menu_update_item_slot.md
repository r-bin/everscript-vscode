---
addr: 8D99FE
size: 63
end: 8D9A3C
kind: code
category: 🎮
name: dog_ring_menu_update_item_slot
title: Update Dog ring menu item slot icon graphic and availability ($8D:99FE)
confidence: confirmed
evidence: ["disasm: indexes dog item table $8D:99DA with $D11; fetches icon tile pointer from $C4:3874; enqueues VRAM DMA upload via $90:CFB8; tests unlock bitmask $C4:59C0; toggles bit $10 in $D15; sets cursor animation $5996 via $90:817B; callers: dog ring menu handler $8D:9792"]
see: ["routines/sprite_tile_vram_dma_enqueue.md","routines/anim_record_init_from_script_ref.md","routines/ring_menu_dog_selection_loop.md"]
tags: ["ring-menu","dog","item","icon","vram"]
---
Companion dog ring menu counterpart to `$8D:9713`. Indexes dog items at `$8D:99DA`, enqueues icon tile DMA via `$90:CFB8`, checks unlock bitmask at `$C4:59C0`, toggles availability flag `$10` in `$D15`, and binds dog cursor animation `$5996` via `func_90817B`.
