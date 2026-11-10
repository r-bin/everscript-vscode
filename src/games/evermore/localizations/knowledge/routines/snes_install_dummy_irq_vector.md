---
addr: 80857F
size: 13
end: 80858B
kind: code
category: 🎮
name: snes_install_dummy_irq_vector
title: Installs dummy IRQ vector ($80:858B) to IRQ dispatch vector ($80:857F)
confidence: verified
evidence: ["reconstructed-c/80/80857F_snes_install_dummy_irq_vector.c passes Gate G1 (24/24 reference states, 384/384 fuzzed, mutation caught)", "disasm: sets 16-bit IRQ vector pointers at $0128 = $858B and $0129 = $8085; target $80:858B is an RTL; called during hardware reset/boot $80:8034 and unhandled IRQ restore $80:85D8"]
see: ["routines/snes_install_dummy_irq_vector.md","routines/reset_handler.md"]
tags: ["irq","interrupt","vector","boot","reconstructed-c","g1-pass"]
---
Writes `$858B` to `$0128` and `$8085` to `$0129` (pointing indirect IRQ vector `$0128` to dummy handler `$80:858B`, which executes `RTL`). Used during system boot and interrupt teardown to safely discard stray hardware IRQs.
