# Batch 69 Address Audit

The nominated `$8E:A000-$8E:A400` interval does not identify one routine. The inspected clean vanilla VFS disassembly shows distinct control-flow regions inside it, but does not establish the named ring-menu sub-item, ingredient-count, or shortcut-cache behaviors.

## Verified Entry

`conditional_setup_hook` begins at `$8E:A091` and returns at `$8E:A0B2`. The vanilla VFS disassembly shows it reading `$0106`, returning when bit `$0080` is set or the 16-bit compare against `$0008` takes the negative branch, then reading `$05A9` and returning when bit `$0001` is set. Otherwise it calls `$8C:C543`, `$8E:A0B3`, and `$8C:C55D` in that order, then returns. Direct calls to `$8E:A091` are present at `$8E:E520` and `$8E:E53F`.

- Vanilla disassembly: [soe://rom/0EA091.asm](soe://rom/0EA091.asm?rom=vanilla)
- Caller at `$8E:E520`: [soe://rom/0EE520.asm](soe://rom/0EE520.asm?rom=vanilla)
- Caller at `$8E:E53F`: [soe://rom/0EE53F.asm](soe://rom/0EE53F.asm?rom=vanilla)
- Clean C: [8EA091_conditional_setup.c](../../../reconstructed-c/8E/8EA091_conditional_setup.c)

The C reconstruction preserves the observed branch conditions and call order. The callees' effects and any register-level calling convention are not modeled here.

## Range Boundaries

- The instruction stream observed from `$8E:A000` reaches a `JMP $8E:A0DE` at `$8E:A08E`; the entry provenance and complete routine boundary are not assigned here.
- `$8E:A400` lies in an observed loop: `$8E:A441` branches back to `$8E:A3EB`, and `$8E:A443` contains `RTS`. The loop's code extends beyond the nominated endpoint; no clean C file for it was found.
- Existing [ring-menu-builder.md](ring-menu-builder.md) and its C reconstruction cover `$8E:9DF9` and `$8E:9EE2`, not `$8E:A091` or `$8E:A400`.

Thus the actionable verified entry in this audit is `$8E:A091-$8E:A0B2`. The broad Batch 69 purpose label is not supported by this evidence and should not be used as a routine boundary.