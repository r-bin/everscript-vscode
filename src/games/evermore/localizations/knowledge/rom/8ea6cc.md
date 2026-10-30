---
addr: 8EA6CC
end: 8EA774
kind: code
category: 🏪
name: shop_alchemy_formula_purchase_prompt_loop
title: Shop alchemy formula purchase prompt loop
confidence: likely
tags: [shop, alchemy, formula, spells, menu]
evidence: ["disasm: closes ring menu via $8E:AE85; sets window $034D; formats formula description and cost; verifies cast viability via $91:CE38 (alchemy_formula_calc_available_casts); dispatches purchase handler via jump table $A777,X (REA dossier 0x8ea6cc)"]
---
Interactive purchase prompt loop when purchasing alchemy formulas from alchemists or teachers, confirming formula availability and cost.
