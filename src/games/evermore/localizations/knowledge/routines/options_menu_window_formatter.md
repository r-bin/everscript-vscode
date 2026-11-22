---
addr: 8DBF71
size: 687
end: 8DC21F
kind: code
category: 🎛️
name: options_menu_window_formatter
title: Alchemy screen — the ingredients page
confidence: confirmed
tags: [alchemy, ingredients, menu, window, ui]
evidence: ["disasm: called by $8D:C803; establishes option window coordinates at $0391 ($A3C0), $03BD ($B040), $03F5 ($B400); enqueues UI palettes via $80:85FA; formats option labels and toggle state text strings into window buffers via $80:B21F and $8C:9E03 (REA dossier 0x8dbf71)", "disasm + in game (2026-11-23): the alchemy screen loop calls it when L or R is pressed ($8D:C83A, `$0104 & $0030`); it draws the window titled by the string at $8D:C21F and, from $8D:C1AA, each held ingredient (count `$22FF + id`, name `$C4:5FF3`) from id 21 down, alternating two columns (windows $034D/$0379 and $03A5/$03DD by $8D:C22B); $8D:C2CB draws their icons ($C4:5CC7). The screen is hi-res (512 wide)"]
see: [docs/todo/growable-items.md]
---
The alchemy screen's ingredients page (L/R from the formulas page): a window with every held ingredient, its count, name and icon. Previously believed: the game options window (the name stays until the entry is renamed).
