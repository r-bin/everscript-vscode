---
addr: 7E03D1
end: 7E03DC
size: 12
kind: struct
name: WINDOW_SUBGRID_2
title: Menu option subgrid descriptor for window 2 (12 bytes)
lifetime: session
confidence: confirmed
tags: [dialogue]
evidence: ["disasm: subgrid menu navigation routines in bank $8C evaluate column/row selection pitch for interactive windows"]
---
Menu option subgrid descriptor for interactive selection window 2 (12 bytes).

## Fields
| offset | size | name | meaning |
|---|---|---|---|
| +$00 | 2 | COLS | Number of selectable option columns in menu subgrid |
| +$02 | 2 | ROWS | Number of selectable option rows in menu subgrid |
| +$04 | 2 | TOTAL_CELLS | Total selectable option cells (cols * rows) in menu subgrid |
| +$06 | 2 | COL_PITCH | Column tile stride / pixel spacing between options |
| +$08 | 2 | ROW_PITCH | Row tile stride / pixel spacing between options |
| +$0A | 2 | SELECTED_CELL | Currently selected cell / item option index in menu subgrid |
